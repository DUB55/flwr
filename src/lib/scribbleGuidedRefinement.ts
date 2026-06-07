import { MaskData, ScribbleData, ScribblePoint, ImageData } from '../types';
import { loadImage } from '../utils/imageUtils';

export class ScribbleGuidedRefinement {
  /**
   * Main entry point for scribble-guided refinement
   * Combines probability mask with scribble hints and image features
   */
  async refine(
    probabilityMask: MaskData,
    scribbles: ScribbleData[],
    imageData: ImageData,
    settings?: {
      colorExpansionStrength?: number;
      textureExpansionStrength?: number;
      edgeStrictness?: number;
      smoothingIterations?: number;
    }
  ): Promise<MaskData> {
    const {
      colorExpansionStrength = 30,
      textureExpansionStrength = 20,
      edgeStrictness = 50,
      smoothingIterations = 2,
    } = settings || {};

    // Load actual image data from URI using offscreen canvas
    const img = await loadImage(imageData.uri);
    const offscreenCanvas = new OffscreenCanvas(imageData.width, imageData.height);
    const offscreenCtx = offscreenCanvas.getContext('2d');
    if (!offscreenCtx) {
      // Fallback to regular canvas if OffscreenCanvas not supported
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');
      ctx.drawImage(img, 0, 0);
      var imageDataRaw = ctx.getImageData(0, 0, imageData.width, imageData.height);
    } else {
      offscreenCtx.drawImage(img, 0, 0);
      var imageDataRaw = offscreenCtx.getImageData(0, 0, imageData.width, imageData.height);
    }

    // Extract foreground and background hints
    const foregroundHints = this.extractForegroundHints(scribbles);
    const backgroundHints = this.extractBackgroundHints(scribbles);

    // If no scribbles, return original mask
    if (foregroundHints.length === 0 && backgroundHints.length === 0) {
      return probabilityMask;
    }

    // Create edge map from image
    const edgeMap = this.createEdgeMap(imageDataRaw);

    // Process foreground hints
    let refinedMask = this.processForegroundHints(
      probabilityMask,
      foregroundHints,
      imageDataRaw,
      edgeMap,
      colorExpansionStrength,
      edgeStrictness
    );

    // Process background hints
    refinedMask = this.processBackgroundHints(
      refinedMask,
      backgroundHints,
      imageDataRaw,
      edgeMap,
      colorExpansionStrength,
      edgeStrictness
    );

    // Apply connectivity analysis
    refinedMask = this.applyConnectivityAnalysis(refinedMask, imageDataRaw);

    // Smooth the refined mask
    refinedMask = this.smoothMask(refinedMask, smoothingIterations);

    return refinedMask;
  }

  /**
   * Extract foreground (add) hints from scribbles
   */
  private extractForegroundHints(scribbles: ScribbleData[]): ScribblePoint[] {
    return scribbles
      .flatMap(s => s.points)
      .filter(p => p.type === 'add');
  }

  /**
   * Extract background (remove) hints from scribbles
   */
  private extractBackgroundHints(scribbles: ScribbleData[]): ScribblePoint[] {
    return scribbles
      .flatMap(s => s.points)
      .filter(p => p.type === 'remove');
  }

  /**
   * Process foreground hints to expand mask
   */
  private processForegroundHints(
    mask: MaskData,
    hints: ScribblePoint[],
    imageDataRaw: globalThis.ImageData,
    edgeMap: Uint8Array,
    expansionStrength: number,
    edgeStrictness: number
  ): MaskData {
    if (hints.length === 0) return mask;

    const refinedData = new Uint8Array(mask.data);
    const width = mask.width;
    const height = mask.height;

    // Apply color-based expansion from each hint
    for (const hint of hints) {
      const hintX = Math.floor(hint.x);
      const hintY = Math.floor(hint.y);
      const hintIdx = hintY * width + hintX;

      if (hintIdx < 0 || hintIdx >= refinedData.length) continue;

      // Get color at hint location
      const hintColor = this.getPixelColor(imageDataRaw, hintX, hintY);

      // Expand from hint based on color similarity
      this.expandFromPoint(
        refinedData,
        imageDataRaw,
        edgeMap,
        hintX,
        hintY,
        hintColor,
        expansionStrength,
        edgeStrictness,
        true, // isForeground
        width,
        height
      );
    }

    return {
      data: refinedData,
      width,
      height,
      isProbability: mask.isProbability,
    };
  }

  /**
   * Process background hints to shrink mask
   */
  private processBackgroundHints(
    mask: MaskData,
    hints: ScribblePoint[],
    imageDataRaw: globalThis.ImageData,
    edgeMap: Uint8Array,
    expansionStrength: number,
    edgeStrictness: number
  ): MaskData {
    if (hints.length === 0) return mask;

    const refinedData = new Uint8Array(mask.data);
    const width = mask.width;
    const height = mask.height;

    // Apply color-based expansion from each hint
    for (const hint of hints) {
      const hintX = Math.floor(hint.x);
      const hintY = Math.floor(hint.y);
      const hintIdx = hintY * width + hintX;

      if (hintIdx < 0 || hintIdx >= refinedData.length) continue;

      // Get color at hint location
      const hintColor = this.getPixelColor(imageDataRaw, hintX, hintY);

      // Expand from hint based on color similarity
      this.expandFromPoint(
        refinedData,
        imageDataRaw,
        edgeMap,
        hintX,
        hintY,
        hintColor,
        expansionStrength,
        edgeStrictness,
        false, // isForeground
        width,
        height
      );
    }

    return {
      data: refinedData,
      width,
      height,
      isProbability: mask.isProbability,
    };
  }

  /**
   * Expand mask from a point based on color similarity
   */
  private expandFromPoint(
    maskData: Uint8Array,
    imageDataRaw: globalThis.ImageData,
    edgeMap: Uint8Array,
    startX: number,
    startY: number,
    targetColor: { r: number; g: number; b: number },
    maxDistance: number,
    edgeStrictness: number,
    isForeground: boolean,
    width: number,
    height: number
  ): void {
    const visited = new Set<number>();
    const queue: { x: number; y: number; distance: number }[] = [];
    const startIdx = startY * width + startX;

    queue.push({ x: startX, y: startY, distance: 0 });
    visited.add(startIdx);

    while (queue.length > 0) {
      const { x, y, distance } = queue.shift()!;

      if (distance > maxDistance) continue;

      const idx = y * width + x;
      const currentColor = this.getPixelColor(imageDataRaw, x, y);
      const colorSimilarity = this.calculateColorSimilarity(targetColor, currentColor);
      const edgeStrength = edgeMap[idx] / 255;

      // Check if we should expand to this pixel
      const shouldExpand = colorSimilarity > (1 - edgeStrictness / 100) && edgeStrength < edgeStrictness / 100;

      if (shouldExpand) {
        if (isForeground) {
          // Increase probability for foreground
          maskData[idx] = Math.min(255, maskData[idx] + Math.round(colorSimilarity * 50));
        } else {
          // Decrease probability for background
          maskData[idx] = Math.max(0, maskData[idx] - Math.round(colorSimilarity * 50));
        }

        // Add neighbors to queue
        const neighbors = [
          { x: x - 1, y },
          { x: x + 1, y },
          { x, y: y - 1 },
          { x, y: y + 1 },
        ];

        for (const neighbor of neighbors) {
          if (neighbor.x >= 0 && neighbor.x < width && neighbor.y >= 0 && neighbor.y < height) {
            const neighborIdx = neighbor.y * width + neighbor.x;
            if (!visited.has(neighborIdx)) {
              visited.add(neighborIdx);
              queue.push({ x: neighbor.x, y: neighbor.y, distance: distance + 1 });
            }
          }
        }
      }
    }
  }

  /**
   * Calculate color similarity between two colors
   */
  private calculateColorSimilarity(
    color1: { r: number; g: number; b: number },
    color2: { r: number; g: number; b: number }
  ): number {
    const dr = color1.r - color2.r;
    const dg = color1.g - color2.g;
    const db = color1.b - color2.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    const maxDistance = Math.sqrt(255 * 255 * 3);
    return 1 - distance / maxDistance;
  }

  /**
   * Get pixel color from image data
   */
  private getPixelColor(imageDataRaw: globalThis.ImageData, x: number, y: number): { r: number; g: number; b: number } {
    const idx = y * imageDataRaw.width + x;
    return {
      r: imageDataRaw.data[idx * 4],
      g: imageDataRaw.data[idx * 4 + 1],
      b: imageDataRaw.data[idx * 4 + 2],
    };
  }

  /**
   * Create edge map from image using Sobel edge detection
   */
  private createEdgeMap(imageDataRaw: globalThis.ImageData): Uint8Array {
    const width = imageDataRaw.width;
    const height = imageDataRaw.height;
    const edgeMap = new Uint8Array(width * height);

    // Sobel kernels
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0;
        let gy = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixelIdx = (y + ky) * width + (x + kx);
            const gray = (imageDataRaw.data[pixelIdx * 4] + imageDataRaw.data[pixelIdx * 4 + 1] + imageDataRaw.data[pixelIdx * 4 + 2]) / 3;
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            gx += gray * sobelX[kernelIdx];
            gy += gray * sobelY[kernelIdx];
          }
        }

        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edgeMap[y * width + x] = Math.min(255, magnitude);
      }
    }

    return edgeMap;
  }

  /**
   * Create edge map from image using Canny edge detection
   */
  private createCannyEdgeMap(imageDataRaw: globalThis.ImageData, lowThreshold: number = 50, highThreshold: number = 150): Uint8Array {
    const width = imageDataRaw.width;
    const height = imageDataRaw.height;
    
    // Step 1: Gaussian blur for noise reduction
    const blurred = this.gaussianBlur(imageDataRaw);
    
    // Step 2: Sobel filter to get gradients
    const { gradientMagnitude, gradientDirection } = this.computeGradients(blurred);
    
    // Step 3: Non-maximum suppression
    const suppressed = this.nonMaximumSuppression(gradientMagnitude, gradientDirection, width, height);
    
    // Step 4: Double threshold and hysteresis
    const edges = this.hysteresis(suppressed, lowThreshold, highThreshold, width, height);
    
    return edges;
  }

  /**
   * Apply Gaussian blur to image
   */
  private gaussianBlur(imageDataRaw: globalThis.ImageData, sigma: number = 1.4): globalThis.ImageData {
    const width = imageDataRaw.width;
    const height = imageDataRaw.height;
    const kernelSize = Math.ceil(sigma * 3) * 2 + 1;
    const kernel = this.createGaussianKernel(kernelSize, sigma);
    const kernelRadius = Math.floor(kernelSize / 2);
    
    const blurredData = new Uint8ClampedArray(imageDataRaw.data);
    
    // Convert to grayscale first
    const gray = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      gray[i] = (imageDataRaw.data[i * 4] + imageDataRaw.data[i * 4 + 1] + imageDataRaw.data[i * 4 + 2]) / 3;
    }
    
    // Apply Gaussian blur
    const blurred = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let ky = -kernelRadius; ky <= kernelRadius; ky++) {
          for (let kx = -kernelRadius; kx <= kernelRadius; kx++) {
            const ny = y + ky;
            const nx = x + kx;
            
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const weight = kernel[(ky + kernelRadius) * kernelSize + (kx + kernelRadius)];
              sum += gray[ny * width + nx] * weight;
              weightSum += weight;
            }
          }
        }
        
        blurred[y * width + x] = sum / weightSum;
      }
    }
    
    // Convert back to ImageData
    const result = new ImageData(width, height);
    for (let i = 0; i < width * height; i++) {
      const val = Math.round(blurred[i]);
      result.data[i * 4] = val;
      result.data[i * 4 + 1] = val;
      result.data[i * 4 + 2] = val;
      result.data[i * 4 + 3] = 255;
    }
    
    return result;
  }

  /**
   * Create Gaussian kernel
   */
  private createGaussianKernel(size: number, sigma: number): Float32Array {
    const kernel = new Float32Array(size * size);
    const center = Math.floor(size / 2);
    let sum = 0;
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const value = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
        kernel[y * size + x] = value;
        sum += value;
      }
    }
    
    // Normalize
    for (let i = 0; i < kernel.length; i++) {
      kernel[i] /= sum;
    }
    
    return kernel;
  }

  /**
   * Compute gradient magnitude and direction using Sobel
   */
  private computeGradients(imageDataRaw: globalThis.ImageData): { gradientMagnitude: Float32Array; gradientDirection: Float32Array } {
    const width = imageDataRaw.width;
    const height = imageDataRaw.height;
    const gradientMagnitude = new Float32Array(width * height);
    const gradientDirection = new Float32Array(width * height);
    
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0;
        let gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixelIdx = (y + ky) * width + (x + kx);
            const gray = (imageDataRaw.data[pixelIdx * 4] + imageDataRaw.data[pixelIdx * 4 + 1] + imageDataRaw.data[pixelIdx * 4 + 2]) / 3;
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            gx += gray * sobelX[kernelIdx];
            gy += gray * sobelY[kernelIdx];
          }
        }
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        const direction = Math.atan2(gy, gx);
        
        gradientMagnitude[y * width + x] = magnitude;
        gradientDirection[y * width + x] = direction;
      }
    }
    
    return { gradientMagnitude, gradientDirection };
  }

  /**
   * Non-maximum suppression to thin edges
   */
  private nonMaximumSuppression(gradientMagnitude: Float32Array, gradientDirection: Float32Array, width: number, height: number): Float32Array {
    const suppressed = new Float32Array(width * height);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const direction = gradientDirection[idx];
        const magnitude = gradientMagnitude[idx];
        
        // Quantize direction to 0, 45, 90, 135 degrees
        let angle = direction * (180 / Math.PI);
        if (angle < 0) angle += 180;
        
        let neighbor1 = 0;
        let neighbor2 = 0;
        
        if ((angle >= 0 && angle < 22.5) || (angle >= 157.5 && angle <= 180)) {
          // Horizontal
          neighbor1 = gradientMagnitude[y * width + (x - 1)];
          neighbor2 = gradientMagnitude[y * width + (x + 1)];
        } else if (angle >= 22.5 && angle < 67.5) {
          // Diagonal /
          neighbor1 = gradientMagnitude[(y - 1) * width + (x + 1)];
          neighbor2 = gradientMagnitude[(y + 1) * width + (x - 1)];
        } else if (angle >= 67.5 && angle < 112.5) {
          // Vertical
          neighbor1 = gradientMagnitude[(y - 1) * width + x];
          neighbor2 = gradientMagnitude[(y + 1) * width + x];
        } else {
          // Diagonal \
          neighbor1 = gradientMagnitude[(y - 1) * width + (x - 1)];
          neighbor2 = gradientMagnitude[(y + 1) * width + (x + 1)];
        }
        
        if (magnitude >= neighbor1 && magnitude >= neighbor2) {
          suppressed[idx] = magnitude;
        } else {
          suppressed[idx] = 0;
        }
      }
    }
    
    return suppressed;
  }

  /**
   * Hysteresis thresholding for edge linking
   */
  private hysteresis(suppressed: Float32Array, lowThreshold: number, highThreshold: number, width: number, height: number): Uint8Array {
    const edges = new Uint8Array(width * height);
    const visited = new Set<number>();
    
    // First pass: mark strong edges
    for (let i = 0; i < suppressed.length; i++) {
      if (suppressed[i] >= highThreshold) {
        edges[i] = 255;
      } else if (suppressed[i] < lowThreshold) {
        edges[i] = 0;
      } else {
        edges[i] = 128; // Weak edge
      }
    }
    
    // Second pass: track weak edges connected to strong edges
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        if (edges[idx] === 128 && !visited.has(idx)) {
          const connected = this.traceWeakEdge(edges, x, y, width, height, visited);
          
          if (connected) {
            edges[idx] = 255;
          } else {
            edges[idx] = 0;
          }
        }
      }
    }
    
    return edges;
  }

  /**
   * Trace weak edge to see if it's connected to a strong edge
   */
  private traceWeakEdge(edges: Uint8Array, startX: number, startY: number, width: number, height: number, visited: Set<number>): boolean {
    const queue: { x: number; y: number }[] = [];
    const startIdx = startY * width + startX;
    
    queue.push({ x: startX, y: startY });
    visited.add(startIdx);
    
    let hasStrongConnection = false;
    
    while (queue.length > 0) {
      const { x, y } = queue.shift()!;
      const idx = y * width + x;
      
      if (edges[idx] === 255) {
        hasStrongConnection = true;
      }
      
      // Check neighbors
      const neighbors = [
        { x: x - 1, y },
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 },
      ];
      
      for (const neighbor of neighbors) {
        if (neighbor.x >= 0 && neighbor.x < width && neighbor.y >= 0 && neighbor.y < height) {
          const neighborIdx = neighbor.y * width + neighbor.x;
          
          if ((edges[neighborIdx] === 128 || edges[neighborIdx] === 255) && !visited.has(neighborIdx)) {
            visited.add(neighborIdx);
            queue.push(neighbor);
          }
        }
      }
    }
    
    return hasStrongConnection;
  }

  /**
   * Apply connectivity analysis to remove isolated regions
   */
  private applyConnectivityAnalysis(mask: MaskData, imageDataRaw: globalThis.ImageData): MaskData {
    const refinedData = new Uint8Array(mask.data);
    const width = mask.width;
    const height = mask.height;
    const visited = new Set<number>();

    // Find connected components
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const probability = refinedData[idx] / 255;

        if (probability > 0.5 && !visited.has(idx)) {
          const component = this.findConnectedComponent(refinedData, x, y, width, height, visited);
          
          // Remove small isolated components
          if (component.size < 100) {
            for (const pixelIdx of component) {
              refinedData[pixelIdx] = Math.round(refinedData[pixelIdx] * 0.3);
            }
          }
        }
      }
    }

    return {
      data: refinedData,
      width,
      height,
      isProbability: mask.isProbability,
    };
  }

  /**
   * Find connected component using flood fill
   */
  private findConnectedComponent(
    maskData: Uint8Array,
    startX: number,
    startY: number,
    width: number,
    height: number,
    visited: Set<number>
  ): Set<number> {
    const component = new Set<number>();
    const queue: { x: number; y: number }[] = [];
    const startIdx = startY * width + startX;

    queue.push({ x: startX, y: startY });
    visited.add(startIdx);
    component.add(startIdx);

    while (queue.length > 0) {
      const { x, y } = queue.shift()!;

      const neighbors = [
        { x: x - 1, y },
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 },
      ];

      for (const neighbor of neighbors) {
        if (neighbor.x >= 0 && neighbor.x < width && neighbor.y >= 0 && neighbor.y < height) {
          const neighborIdx = neighbor.y * width + neighbor.x;
          const probability = maskData[neighborIdx] / 255;

          if (probability > 0.5 && !visited.has(neighborIdx)) {
            visited.add(neighborIdx);
            component.add(neighborIdx);
            queue.push(neighbor);
          }
        }
      }
    }

    return component;
  }

  /**
   * Smooth the mask using Gaussian blur
   */
  private smoothMask(mask: MaskData, iterations: number): MaskData {
    let refinedData = new Uint8Array(mask.data);
    const width = mask.width;
    const height = mask.height;

    for (let iter = 0; iter < iterations; iter++) {
      const smoothedData = new Uint8Array(width * height);

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let sum = 0;
          let count = 0;

          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = (y + ky) * width + (x + kx);
              sum += refinedData[idx];
              count++;
            }
          }

          smoothedData[y * width + x] = Math.round(sum / count);
        }
      }

      refinedData = smoothedData;
    }

    return {
      data: refinedData,
      width,
      height,
      isProbability: mask.isProbability,
    };
  }
}
