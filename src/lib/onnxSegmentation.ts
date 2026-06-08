import * as ort from 'onnxruntime-web/webgl';
import { ImageData, MaskData } from '../types';

export class ONNXSegmentationEngine {
  private session: ort.InferenceSession | null = null;
  private modelPath: string;
  private isInitialized: boolean = false;

  constructor(modelPath: string = '/assets/segmentation.onnx') {
    this.modelPath = modelPath;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Configure ONNX Runtime Web for web execution
      ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;

      // Load the model
      this.session = await ort.InferenceSession.create(this.modelPath, {
        executionProviders: ['webgl', 'wasm'],
      });

      this.isInitialized = true;
      console.log('ONNX model loaded successfully');
    } catch (error) {
      console.error('Failed to load ONNX model:', error);
      throw new Error(`Failed to initialize ONNX segmentation: ${error}`);
    }
  }

  async segment(imageUri: string, originalWidth: number, originalHeight: number): Promise<MaskData> {
    try {
      if (!this.session || !this.isInitialized) {
        await this.initialize();
      }

      // Load image from URI
      const imageBitmap = await this.loadImage(imageUri);
      
      // Preprocess image
      const inputTensor = this.preprocessImage(imageBitmap);

      // Run inference
      const outputs = await this.session!.run({
        input: inputTensor,
      });

      // Postprocess to extract probability mask
      const probabilityMask = this.postprocessOutput(outputs, originalWidth, originalHeight);

      return probabilityMask;
    } catch (error) {
      console.warn('ONNX segmentation unavailable, using local subject selection fallback:', error);
      return await this.createHeuristicSubjectMask(imageUri, originalWidth, originalHeight);
    }
  }

  private async loadImage(imageUri: string): Promise<ImageBitmap> {
    const response = await fetch(imageUri);
    const blob = await response.blob();
    return await createImageBitmap(blob);
  }

  private preprocessImage(imageBitmap: ImageBitmap): ort.Tensor {
    const targetSize = 513; // Common input size for DeepLabV3

    // Create canvas for resizing
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Draw and resize image
    ctx.drawImage(imageBitmap, 0, 0, targetSize, targetSize);

    // Get resized image data
    const resizedImageData = ctx.getImageData(0, 0, targetSize, targetSize);
    const resizedData = resizedImageData.data;

    // Convert to tensor format (NCHW: [1, 3, H, W])
    // Normalize to [0, 1] and convert to Float32
    const tensorData = new Float32Array(1 * 3 * targetSize * targetSize);
    
    for (let i = 0; i < targetSize * targetSize; i++) {
      const pixelIndex = i * 4;
      // RGB to BGR conversion (if needed by model)
      // Normalize to [0, 1]
      tensorData[i] = resizedData[pixelIndex] / 255.0; // R
      tensorData[targetSize * targetSize + i] = resizedData[pixelIndex + 1] / 255.0; // G
      tensorData[2 * targetSize * targetSize + i] = resizedData[pixelIndex + 2] / 255.0; // B
    }

    return new ort.Tensor('float32', tensorData, [1, 3, targetSize, targetSize]);
  }

  private postprocessOutput(outputs: Record<string, ort.Tensor>, originalWidth: number, originalHeight: number): MaskData {
    // Get the output tensor (name depends on model)
    const outputKeys = Object.keys(outputs);
    const output = outputs[outputKeys[0]];

    const outputData = output.data as Float32Array;
    const [batch, classes, height, width] = output.dims;

    // For segmentation, we typically want the foreground class probability
    // Assuming class 1 is foreground, class 0 is background
    const maskData = new Uint8Array(width * height);

    for (let i = 0; i < width * height; i++) {
      // Get probability for foreground class (class 1)
      const foregroundProb = outputData[width * height + i];
      
      // Convert to 0-255 range for display
      maskData[i] = Math.round(foregroundProb * 255);
    }

    // Resize back to original image size
    const resizedMask = this.resizeMask(maskData, width, height, originalWidth, originalHeight);

    return {
      data: resizedMask,
      width: originalWidth,
      height: originalHeight,
      isProbability: true,
    };
  }

  private resizeMask(maskData: Uint8Array, srcWidth: number, srcHeight: number, dstWidth: number, dstHeight: number): Uint8Array {
    const resizedData = new Uint8Array(dstWidth * dstHeight);
    
    const scaleX = srcWidth / dstWidth;
    const scaleY = srcHeight / dstHeight;

    for (let y = 0; y < dstHeight; y++) {
      for (let x = 0; x < dstWidth; x++) {
        const srcX = Math.floor(x * scaleX);
        const srcY = Math.floor(y * scaleY);
        const srcIndex = srcY * srcWidth + srcX;
        const dstIndex = y * dstWidth + x;
        resizedData[dstIndex] = maskData[srcIndex];
      }
    }

    return resizedData;
  }

  private async createHeuristicSubjectMask(imageUri: string, width: number, height: number): Promise<MaskData> {
    const img = await this.loadImage(imageUri);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    ctx.drawImage(img, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const borderProfiles = this.getBorderColorProfiles(imageData);
    const scores = new Float32Array(width * height);
    let maxScore = 0;

    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;
    const maxCenterDistance = Math.sqrt(cx * cx + cy * cy) || 1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const pixel = this.getPixel(imageData, idx);
        const backgroundDistance = Math.min(
          ...borderProfiles.map((profile) => this.colorDistance(pixel, profile))
        );
        const saturation = this.getSaturation(pixel);
        const centerDistance = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxCenterDistance;
        const centerBias = 1 - centerDistance;
        const score = backgroundDistance * 1.35 + saturation * 48 + centerBias * 38;
        scores[idx] = score;
        maxScore = Math.max(maxScore, score);
      }
    }

    const threshold = this.otsuThreshold(scores, maxScore);
    const binary = new Uint8Array(width * height);
    for (let i = 0; i < scores.length; i++) {
      binary[i] = scores[i] >= threshold ? 255 : 0;
    }

    let mask = this.closeMask(binary, width, height, 2);
    mask = this.keepBestSubjectComponent(mask, width, height);
    mask = this.blurMask(mask, width, height, 2);

    return {
      data: mask,
      width,
      height,
      isProbability: true,
    };
  }

  private getBorderColorProfiles(imageData: globalThis.ImageData): Array<{ r: number; g: number; b: number }> {
    const { width, height, data } = imageData;
    const sampleInset = Math.max(1, Math.floor(Math.min(width, height) * 0.04));
    const profiles = [
      { r: 0, g: 0, b: 0, count: 0 },
      { r: 0, g: 0, b: 0, count: 0 },
      { r: 0, g: 0, b: 0, count: 0 },
      { r: 0, g: 0, b: 0, count: 0 },
    ];

    const addSample = (profileIndex: number, x: number, y: number) => {
      const idx = (y * width + x) * 4;
      profiles[profileIndex].r += data[idx];
      profiles[profileIndex].g += data[idx + 1];
      profiles[profileIndex].b += data[idx + 2];
      profiles[profileIndex].count++;
    };

    for (let x = 0; x < width; x += sampleInset) {
      addSample(0, x, 0);
      addSample(1, x, height - 1);
    }
    for (let y = 0; y < height; y += sampleInset) {
      addSample(2, 0, y);
      addSample(3, width - 1, y);
    }

    return profiles.map((profile) => ({
      r: profile.r / Math.max(1, profile.count),
      g: profile.g / Math.max(1, profile.count),
      b: profile.b / Math.max(1, profile.count),
    }));
  }

  private getPixel(imageData: globalThis.ImageData, pixelIndex: number): { r: number; g: number; b: number } {
    const idx = pixelIndex * 4;
    return {
      r: imageData.data[idx],
      g: imageData.data[idx + 1],
      b: imageData.data[idx + 2],
    };
  }

  private colorDistance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
    return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
  }

  private getSaturation(color: { r: number; g: number; b: number }): number {
    const max = Math.max(color.r, color.g, color.b);
    const min = Math.min(color.r, color.g, color.b);
    return max === 0 ? 0 : (max - min) / max;
  }

  private otsuThreshold(scores: Float32Array, maxScore: number): number {
    const bins = 128;
    const histogram = new Uint32Array(bins);
    const scale = maxScore > 0 ? (bins - 1) / maxScore : 0;

    for (const score of scores) {
      histogram[Math.max(0, Math.min(bins - 1, Math.floor(score * scale)))]++;
    }

    let total = scores.length;
    let sum = 0;
    for (let i = 0; i < bins; i++) {
      sum += i * histogram[i];
    }

    let sumBackground = 0;
    let weightBackground = 0;
    let bestVariance = 0;
    let bestThreshold = Math.floor(bins * 0.45);

    for (let i = 0; i < bins; i++) {
      weightBackground += histogram[i];
      if (weightBackground === 0) continue;
      const weightForeground = total - weightBackground;
      if (weightForeground === 0) break;

      sumBackground += i * histogram[i];
      const meanBackground = sumBackground / weightBackground;
      const meanForeground = (sum - sumBackground) / weightForeground;
      const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

      if (variance > bestVariance) {
        bestVariance = variance;
        bestThreshold = i;
      }
    }

    return (bestThreshold / Math.max(1, bins - 1)) * maxScore;
  }

  private closeMask(mask: Uint8Array, width: number, height: number, iterations: number): Uint8Array {
    let result = mask;
    for (let i = 0; i < iterations; i++) {
      result = this.dilateMask(result, width, height);
    }
    for (let i = 0; i < iterations; i++) {
      result = this.erodeMask(result, width, height);
    }
    return result;
  }

  private dilateMask(mask: Uint8Array, width: number, height: number): Uint8Array {
    const result = new Uint8Array(mask);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (mask[idx] === 255) continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (mask[(y + dy) * width + x + dx] === 255) {
              result[idx] = 255;
            }
          }
        }
      }
    }
    return result;
  }

  private erodeMask(mask: Uint8Array, width: number, height: number): Uint8Array {
    const result = new Uint8Array(mask);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (mask[idx] === 0) continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (mask[(y + dy) * width + x + dx] === 0) {
              result[idx] = 0;
            }
          }
        }
      }
    }
    return result;
  }

  private keepBestSubjectComponent(mask: Uint8Array, width: number, height: number): Uint8Array {
    const visited = new Uint8Array(width * height);
    const result = new Uint8Array(width * height);
    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;
    let bestPixels: number[] = [];
    let bestScore = -Infinity;

    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 0 || visited[i]) continue;
      const queue = [i];
      const pixels: number[] = [];
      visited[i] = 1;
      let centerSum = 0;

      for (let q = 0; q < queue.length; q++) {
        const idx = queue[q];
        pixels.push(idx);
        const x = idx % width;
        const y = Math.floor(idx / width);
        centerSum += 1 - Math.min(1, Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / Math.sqrt(cx ** 2 + cy ** 2));

        const neighbors = [idx - 1, idx + 1, idx - width, idx + width];
        for (const neighbor of neighbors) {
          if (
            neighbor >= 0 &&
            neighbor < mask.length &&
            !visited[neighbor] &&
            mask[neighbor] === 255 &&
            Math.abs((neighbor % width) - x) <= 1
          ) {
            visited[neighbor] = 1;
            queue.push(neighbor);
          }
        }
      }

      const centrality = centerSum / Math.max(1, pixels.length);
      const score = pixels.length * (0.55 + centrality);
      if (score > bestScore) {
        bestScore = score;
        bestPixels = pixels;
      }
    }

    for (const idx of bestPixels) {
      result[idx] = 255;
    }
    return result;
  }

  private blurMask(mask: Uint8Array, width: number, height: number, iterations: number): Uint8Array {
    let result = mask;
    for (let iter = 0; iter < iterations; iter++) {
      const next = new Uint8Array(result);
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              sum += result[(y + dy) * width + x + dx];
            }
          }
          next[y * width + x] = Math.round(sum / 9);
        }
      }
      result = next;
    }
    return result;
  }

  async dispose(): Promise<void> {
    if (this.session) {
      await this.session.release();
      this.session = null;
      this.isInitialized = false;
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.session !== null;
  }
}
