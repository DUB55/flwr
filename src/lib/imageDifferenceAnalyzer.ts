import { ImageData, MaskData } from '../types';

export interface DifferenceAnalysisOptions {
  colorThreshold?: number;
  textureThreshold?: number;
  minDifference?: number;
}

export interface DifferenceResult {
  differenceMask: MaskData;
  colorDifference: Float32Array;
  textureDifference: Float32Array;
}

/**
 * ImageDifferenceAnalyzer - Analyzes differences between two images
 * Used in dual image mode to improve segmentation by comparing foreground and background images
 */
export class ImageDifferenceAnalyzer {
  /**
   * Analyze differences between two images
   */
  async analyze(
    foregroundImage: ImageData,
    backgroundImage: ImageData,
    options: DifferenceAnalysisOptions = {}
  ): Promise<DifferenceResult> {
    const {
      colorThreshold = 30,
      textureThreshold = 20,
      minDifference = 10,
    } = options;

    // Load both images as native ImageData
    const foregroundData = await this.loadImageData(foregroundImage.uri);
    const backgroundData = await this.loadImageData(backgroundImage.uri);

    const width = foregroundImage.width;
    const height = foregroundImage.height;

    // Calculate color differences
    const colorDifference = this.calculateColorDifference(
      foregroundData,
      backgroundData,
      width,
      height
    );

    // Calculate texture differences
    const textureDifference = this.calculateTextureDifference(
      foregroundData,
      backgroundData,
      width,
      height
    );

    // Generate combined difference mask
    const differenceMask = this.generateDifferenceMask(
      colorDifference,
      textureDifference,
      colorThreshold,
      textureThreshold,
      minDifference,
      width,
      height
    );

    return {
      differenceMask,
      colorDifference,
      textureDifference,
    };
  }

  /**
   * Load image as native browser ImageData
   */
  private async loadImageData(uri: string): Promise<globalThis.ImageData> {
    const response = await fetch(uri);
    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob);
    
    const canvas = document.createElement('canvas');
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    ctx.drawImage(imageBitmap, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  /**
   * Calculate pixel-wise color difference between two images
   */
  private calculateColorDifference(
    foreground: globalThis.ImageData,
    background: globalThis.ImageData,
    width: number,
    height: number
  ): Float32Array {
    const differences = new Float32Array(width * height);

    for (let i = 0; i < width * height; i++) {
      const fgIdx = i * 4;
      const bgIdx = i * 4;

      const dr = foreground.data[fgIdx] - background.data[bgIdx];
      const dg = foreground.data[fgIdx + 1] - background.data[bgIdx + 1];
      const db = foreground.data[fgIdx + 2] - background.data[bgIdx + 2];

      // Euclidean distance in RGB space
      const distance = Math.sqrt(dr * dr + dg * dg + db * db);
      differences[i] = distance;
    }

    return differences;
  }

  /**
   * Calculate texture difference using local variance
   */
  private calculateTextureDifference(
    foreground: globalThis.ImageData,
    background: globalThis.ImageData,
    width: number,
    height: number
  ): Float32Array {
    const differences = new Float32Array(width * height);
    const kernelSize = 3;
    const radius = Math.floor(kernelSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;

        // Calculate local variance for foreground
        const fgVariance = this.calculateLocalVariance(foreground, x, y, width, height, radius);
        // Calculate local variance for background
        const bgVariance = this.calculateLocalVariance(background, x, y, width, height, radius);

        differences[idx] = Math.abs(fgVariance - bgVariance);
      }
    }

    return differences;
  }

  /**
   * Calculate local variance around a pixel
   */
  private calculateLocalVariance(
    imageData: globalThis.ImageData,
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    radius: number
  ): number {
    let sum = 0;
    let count = 0;
    const values: number[] = [];

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;

        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = y * width + x;
          const gray = (imageData.data[idx * 4] + imageData.data[idx * 4 + 1] + imageData.data[idx * 4 + 2]) / 3;
          values.push(gray);
          sum += gray;
          count++;
        }
      }
    }

    if (count === 0) return 0;

    const mean = sum / count;
    let variance = 0;

    for (const value of values) {
      variance += (value - mean) ** 2;
    }

    return variance / count;
  }

  /**
   * Generate combined difference mask
   */
  private generateDifferenceMask(
    colorDifference: Float32Array,
    textureDifference: Float32Array,
    colorThreshold: number,
    textureThreshold: number,
    minDifference: number,
    width: number,
    height: number
  ): MaskData {
    const maskData = new Uint8Array(width * height);

    for (let i = 0; i < width * height; i++) {
      const colorDiff = colorDifference[i];
      const textureDiff = textureDifference[i];

      // Normalize differences to 0-255 range
      const normalizedColorDiff = Math.min(255, (colorDiff / colorThreshold) * 255);
      const normalizedTextureDiff = Math.min(255, (textureDiff / textureThreshold) * 255);

      // Combine color and texture differences
      const combinedDiff = (normalizedColorDiff + normalizedTextureDiff) / 2;

      // Apply minimum difference threshold
      if (combinedDiff >= minDifference) {
        maskData[i] = Math.round(combinedDiff);
      } else {
        maskData[i] = 0;
      }
    }

    return {
      data: maskData,
      width,
      height,
      isProbability: true,
    };
  }

  /**
   * Combine difference mask with ONNX segmentation mask
   */
  combineWithSegmentation(
    segmentationMask: MaskData,
    differenceMask: MaskData,
    differenceWeight: number = 0.3
  ): MaskData {
    const width = segmentationMask.width;
    const height = segmentationMask.height;

    if (width !== differenceMask.width || height !== differenceMask.height) {
      throw new Error('Mask dimensions do not match');
    }

    const combinedData = new Uint8Array(width * height);

    for (let i = 0; i < width * height; i++) {
      const segValue = segmentationMask.data[i];
      const diffValue = differenceMask.data[i];

      // Weighted combination
      const combinedValue = segValue * (1 - differenceWeight) + diffValue * differenceWeight;
      combinedData[i] = Math.min(255, Math.round(combinedValue));
    }

    return {
      data: combinedData,
      width,
      height,
      isProbability: true,
    };
  }
}
