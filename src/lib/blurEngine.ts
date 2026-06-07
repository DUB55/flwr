import { MaskData, BlurType } from '../types';

export class BlurEngine {
  // Apply Gaussian blur to background
  applyGaussianBlur(
    imageData: ImageData,
    mask: MaskData,
    strength: number
  ): ImageData {
    const result = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    const radius = Math.floor(strength / 2);
    if (radius === 0) return imageData;

    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        const idx = y * imageData.width + x;
        
        if (mask.isProbability) {
          // Probability mask: blend based on probability
          const probability = mask.data[idx] / 255; // 0-1
          
          if (probability < 0.5) {
            // More likely background - apply blur
            const blurred = this.getGaussianBlur(imageData, x, y, radius);
            const blendFactor = 1 - probability; // Higher blur for lower probability
            result.data[idx * 4] = Math.round(imageData.data[idx * 4] * (1 - blendFactor) + blurred.r * blendFactor);
            result.data[idx * 4 + 1] = Math.round(imageData.data[idx * 4 + 1] * (1 - blendFactor) + blurred.g * blendFactor);
            result.data[idx * 4 + 2] = Math.round(imageData.data[idx * 4 + 2] * (1 - blendFactor) + blurred.b * blendFactor);
            result.data[idx * 4 + 3] = imageData.data[idx * 4 + 3];
          } else {
            // More likely foreground - keep original
            result.data[idx * 4] = imageData.data[idx * 4];
            result.data[idx * 4 + 1] = imageData.data[idx * 4 + 1];
            result.data[idx * 4 + 2] = imageData.data[idx * 4 + 2];
            result.data[idx * 4 + 3] = imageData.data[idx * 4 + 3];
          }
        } else {
          // Binary mask: current behavior
          if (mask.data[idx] === 0) {
            const blurred = this.getGaussianBlur(imageData, x, y, radius);
            result.data[idx * 4] = blurred.r;
            result.data[idx * 4 + 1] = blurred.g;
            result.data[idx * 4 + 2] = blurred.b;
            result.data[idx * 4 + 3] = imageData.data[idx * 4 + 3];
          } else {
            result.data[idx * 4] = imageData.data[idx * 4];
            result.data[idx * 4 + 1] = imageData.data[idx * 4 + 1];
            result.data[idx * 4 + 2] = imageData.data[idx * 4 + 2];
            result.data[idx * 4 + 3] = imageData.data[idx * 4 + 3];
          }
        }
      }
    }

    return result;
  }

  private getGaussianBlur(
    imageData: ImageData,
    x: number,
    y: number,
    radius: number
  ): { r: number; g: number; b: number } {
    let r = 0, g = 0, b = 0, count = 0;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx >= 0 && nx < imageData.width && ny >= 0 && ny < imageData.height) {
          const idx = ny * imageData.width + nx;
          r += imageData.data[idx * 4];
          g += imageData.data[idx * 4 + 1];
          b += imageData.data[idx * 4 + 2];
          count++;
        }
      }
    }

    return { r: r / count, g: g / count, b: b / count };
  }

  // Apply radial blur (depth-style)
  applyRadialBlur(
    imageData: ImageData,
    mask: MaskData,
    strength: number,
    centerX: number = 0.5,
    centerY: number = 0.5
  ): ImageData {
    const result = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    const width = imageData.width;
    const height = imageData.height;
    const cx = centerX * width;
    const cy = centerY * height;
    const maxDist = Math.sqrt(cx * cx + cy * cy);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        
        if (mask.isProbability) {
          // Probability mask: blend based on probability
          const probability = mask.data[idx] / 255; // 0-1
          
          if (probability < 0.5) {
            // More likely background - apply blur
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const normalizedDist = dist / maxDist;
            
            const localStrength = Math.floor(strength * normalizedDist);
            const blendFactor = (1 - probability); // Higher blur for lower probability
            
            if (localStrength > 0) {
              const blurred = this.getGaussianBlur(imageData, x, y, localStrength);
              result.data[idx * 4] = Math.round(imageData.data[idx * 4] * (1 - blendFactor) + blurred.r * blendFactor);
              result.data[idx * 4 + 1] = Math.round(imageData.data[idx * 4 + 1] * (1 - blendFactor) + blurred.g * blendFactor);
              result.data[idx * 4 + 2] = Math.round(imageData.data[idx * 4 + 2] * (1 - blendFactor) + blurred.b * blendFactor);
              result.data[idx * 4 + 3] = imageData.data[idx * 4 + 3];
            } else {
              result.data[idx * 4] = imageData.data[idx * 4];
              result.data[idx * 4 + 1] = imageData.data[idx * 4 + 1];
              result.data[idx * 4 + 2] = imageData.data[idx * 4 + 2];
              result.data[idx * 4 + 3] = imageData.data[idx * 4 + 3];
            }
          } else {
            // More likely foreground - keep original
            result.data[idx * 4] = imageData.data[idx * 4];
            result.data[idx * 4 + 1] = imageData.data[idx * 4 + 1];
            result.data[idx * 4 + 2] = imageData.data[idx * 4 + 2];
            result.data[idx * 4 + 3] = imageData.data[idx * 4 + 3];
          }
        } else {
          // Binary mask: current behavior
          if (mask.data[idx] === 0) {
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const normalizedDist = dist / maxDist;
            
            const localStrength = Math.floor(strength * normalizedDist);
            
            if (localStrength > 0) {
              const blurred = this.getGaussianBlur(imageData, x, y, localStrength);
              result.data[idx * 4] = blurred.r;
              result.data[idx * 4 + 1] = blurred.g;
              result.data[idx * 4 + 2] = blurred.b;
              result.data[idx * 4 + 3] = imageData.data[idx * 4 + 3];
            } else {
              result.data[idx * 4] = imageData.data[idx * 4];
              result.data[idx * 4 + 1] = imageData.data[idx * 4 + 1];
              result.data[idx * 4 + 2] = imageData.data[idx * 4 + 2];
              result.data[idx * 4 + 3] = imageData.data[idx * 4 + 3];
            }
          } else {
            result.data[idx * 4] = imageData.data[idx * 4];
            result.data[idx * 4 + 1] = imageData.data[idx * 4 + 1];
            result.data[idx * 4 + 2] = imageData.data[idx * 4 + 2];
            result.data[idx * 4 + 3] = imageData.data[idx * 4 + 3];
          }
        }
      }
    }

    return result;
  }

  // Apply diffusion blur (soft effect)
  applyDiffusionBlur(
    imageData: ImageData,
    mask: MaskData,
    strength: number,
    iterations: number = 3
  ): ImageData {
    let current = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    for (let iter = 0; iter < iterations; iter++) {
      const next = new ImageData(
        new Uint8ClampedArray(current.data),
        current.width,
        current.height
      );

      for (let y = 0; y < current.height; y++) {
        for (let x = 0; x < current.width; x++) {
          const idx = y * current.width + x;
          
          if (mask.isProbability) {
            // Probability mask: blend based on probability
            const probability = mask.data[idx] / 255; // 0-1
            
            if (probability < 0.5) {
              // More likely background - apply blur
              const avg = this.getNeighborAverage(current, x, y, strength);
              const blend = 0.3; // Blend factor
              const blendFactor = (1 - probability); // Higher blur for lower probability
              next.data[idx * 4] = Math.round(current.data[idx * 4] * (1 - blend * blendFactor) + avg.r * blend * blendFactor);
              next.data[idx * 4 + 1] = Math.round(current.data[idx * 4 + 1] * (1 - blend * blendFactor) + avg.g * blend * blendFactor);
              next.data[idx * 4 + 2] = Math.round(current.data[idx * 4 + 2] * (1 - blend * blendFactor) + avg.b * blend * blendFactor);
              next.data[idx * 4 + 3] = current.data[idx * 4 + 3];
            } else {
              // More likely foreground - keep original
              next.data[idx * 4] = current.data[idx * 4];
              next.data[idx * 4 + 1] = current.data[idx * 4 + 1];
              next.data[idx * 4 + 2] = current.data[idx * 4 + 2];
              next.data[idx * 4 + 3] = current.data[idx * 4 + 3];
            }
          } else {
            // Binary mask: current behavior
            if (mask.data[idx] === 0) {
              const avg = this.getNeighborAverage(current, x, y, strength);
              const blend = 0.3; // Blend factor
              next.data[idx * 4] = Math.round(current.data[idx * 4] * (1 - blend) + avg.r * blend);
              next.data[idx * 4 + 1] = Math.round(current.data[idx * 4 + 1] * (1 - blend) + avg.g * blend);
              next.data[idx * 4 + 2] = Math.round(current.data[idx * 4 + 2] * (1 - blend) + avg.b * blend);
              next.data[idx * 4 + 3] = current.data[idx * 4 + 3];
            } else {
              next.data[idx * 4] = current.data[idx * 4];
              next.data[idx * 4 + 1] = current.data[idx * 4 + 1];
              next.data[idx * 4 + 2] = current.data[idx * 4 + 2];
              next.data[idx * 4 + 3] = current.data[idx * 4 + 3];
            }
          }
        }
      }

      current = next;
    }

    return current;
  }

  private getNeighborAverage(
    imageData: ImageData,
    x: number,
    y: number,
    radius: number
  ): { r: number; g: number; b: number } {
    let r = 0, g = 0, b = 0, count = 0;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx >= 0 && nx < imageData.width && ny >= 0 && ny < imageData.height) {
          const idx = ny * imageData.width + nx;
          r += imageData.data[idx * 4];
          g += imageData.data[idx * 4 + 1];
          b += imageData.data[idx * 4 + 2];
          count++;
        }
      }
    }

    return { r: r / count, g: g / count, b: b / count };
  }

  // Apply brightness adjustment to background
  adjustBrightness(
    imageData: ImageData,
    mask: MaskData,
    brightness: number // -100 to 100
  ): ImageData {
    const result = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    const factor = brightness / 100;

    for (let i = 0; i < mask.data.length; i++) {
      if (mask.isProbability) {
        // Probability mask: blend based on probability
        const probability = mask.data[i] / 255; // 0-1
        
        if (probability < 0.5) {
          // More likely background - apply brightness
          const blendFactor = 1 - probability;
          const adjustedR = Math.min(255, Math.max(0, imageData.data[i * 4] + imageData.data[i * 4] * factor));
          const adjustedG = Math.min(255, Math.max(0, imageData.data[i * 4 + 1] + imageData.data[i * 4 + 1] * factor));
          const adjustedB = Math.min(255, Math.max(0, imageData.data[i * 4 + 2] + imageData.data[i * 4 + 2] * factor));
          
          result.data[i * 4] = Math.round(imageData.data[i * 4] * (1 - blendFactor) + adjustedR * blendFactor);
          result.data[i * 4 + 1] = Math.round(imageData.data[i * 4 + 1] * (1 - blendFactor) + adjustedG * blendFactor);
          result.data[i * 4 + 2] = Math.round(imageData.data[i * 4 + 2] * (1 - blendFactor) + adjustedB * blendFactor);
          result.data[i * 4 + 3] = imageData.data[i * 4 + 3];
        } else {
          // More likely foreground - keep original
          result.data[i * 4] = imageData.data[i * 4];
          result.data[i * 4 + 1] = imageData.data[i * 4 + 1];
          result.data[i * 4 + 2] = imageData.data[i * 4 + 2];
          result.data[i * 4 + 3] = imageData.data[i * 4 + 3];
        }
      } else {
        // Binary mask: current behavior
        if (mask.data[i] === 0) {
          result.data[i * 4] = Math.min(255, Math.max(0, imageData.data[i * 4] + imageData.data[i * 4] * factor));
          result.data[i * 4 + 1] = Math.min(255, Math.max(0, imageData.data[i * 4 + 1] + imageData.data[i * 4 + 1] * factor));
          result.data[i * 4 + 2] = Math.min(255, Math.max(0, imageData.data[i * 4 + 2] + imageData.data[i * 4 + 2] * factor));
          result.data[i * 4 + 3] = imageData.data[i * 4 + 3];
        } else {
          result.data[i * 4] = imageData.data[i * 4];
          result.data[i * 4 + 1] = imageData.data[i * 4 + 1];
          result.data[i * 4 + 2] = imageData.data[i * 4 + 2];
          result.data[i * 4 + 3] = imageData.data[i * 4 + 3];
        }
      }
    }

    return result;
  }

  // Apply desaturation to background
  adjustSaturation(
    imageData: ImageData,
    mask: MaskData,
    saturation: number // 0 to 100 (percentage to desaturate)
  ): ImageData {
    const result = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    const factor = 1 - saturation / 100;

    for (let i = 0; i < mask.data.length; i++) {
      if (mask.isProbability) {
        // Probability mask: blend based on probability
        const probability = mask.data[i] / 255; // 0-1
        
        if (probability < 0.5) {
          // More likely background - apply desaturation
          const blendFactor = 1 - probability;
          const r = imageData.data[i * 4];
          const g = imageData.data[i * 4 + 1];
          const b = imageData.data[i * 4 + 2];
          
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          
          const adjustedR = Math.round(r * factor + gray * (1 - factor));
          const adjustedG = Math.round(g * factor + gray * (1 - factor));
          const adjustedB = Math.round(b * factor + gray * (1 - factor));
          
          result.data[i * 4] = Math.round(imageData.data[i * 4] * (1 - blendFactor) + adjustedR * blendFactor);
          result.data[i * 4 + 1] = Math.round(imageData.data[i * 4 + 1] * (1 - blendFactor) + adjustedG * blendFactor);
          result.data[i * 4 + 2] = Math.round(imageData.data[i * 4 + 2] * (1 - blendFactor) + adjustedB * blendFactor);
          result.data[i * 4 + 3] = imageData.data[i * 4 + 3];
        } else {
          // More likely foreground - keep original
          result.data[i * 4] = imageData.data[i * 4];
          result.data[i * 4 + 1] = imageData.data[i * 4 + 1];
          result.data[i * 4 + 2] = imageData.data[i * 4 + 2];
          result.data[i * 4 + 3] = imageData.data[i * 4 + 3];
        }
      } else {
        // Binary mask: current behavior
        if (mask.data[i] === 0) {
          const r = imageData.data[i * 4];
          const g = imageData.data[i * 4 + 1];
          const b = imageData.data[i * 4 + 2];
          
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          
          result.data[i * 4] = Math.round(r * factor + gray * (1 - factor));
          result.data[i * 4 + 1] = Math.round(g * factor + gray * (1 - factor));
          result.data[i * 4 + 2] = Math.round(b * factor + gray * (1 - factor));
          result.data[i * 4 + 3] = imageData.data[i * 4 + 3];
        } else {
          result.data[i * 4] = imageData.data[i * 4];
          result.data[i * 4 + 1] = imageData.data[i * 4 + 1];
          result.data[i * 4 + 2] = imageData.data[i * 4 + 2];
          result.data[i * 4 + 3] = imageData.data[i * 4 + 3];
        }
      }
    }

    return result;
  }

  // Enhance subject (sharpen, contrast, exposure)
  enhanceSubject(
    imageData: ImageData,
    mask: MaskData,
    sharpness: number = 0,
    contrast: number = 0,
    exposure: number = 0
  ): ImageData {
    const result = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    for (let i = 0; i < mask.data.length; i++) {
      if (mask.isProbability) {
        // Probability mask: blend based on probability
        const probability = mask.data[i] / 255; // 0-1
        
        if (probability > 0.5) {
          // More likely foreground - apply enhancements
          let r = imageData.data[i * 4];
          let g = imageData.data[i * 4 + 1];
          let b = imageData.data[i * 4 + 2];

          // Apply contrast
          if (contrast !== 0) {
            const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
            r = Math.min(255, Math.max(0, factor * (r - 128) + 128));
            g = Math.min(255, Math.max(0, factor * (g - 128) + 128));
            b = Math.min(255, Math.max(0, factor * (b - 128) + 128));
          }

          // Apply exposure
          if (exposure !== 0) {
            const factor = 1 + exposure / 100;
            r = Math.min(255, Math.max(0, r * factor));
            g = Math.min(255, Math.max(0, g * factor));
            b = Math.min(255, Math.max(0, b * factor));
          }

          const blendFactor = probability; // Higher enhancement for higher probability
          result.data[i * 4] = Math.round(imageData.data[i * 4] * (1 - blendFactor) + r * blendFactor);
          result.data[i * 4 + 1] = Math.round(imageData.data[i * 4 + 1] * (1 - blendFactor) + g * blendFactor);
          result.data[i * 4 + 2] = Math.round(imageData.data[i * 4 + 2] * (1 - blendFactor) + b * blendFactor);
          result.data[i * 4 + 3] = imageData.data[i * 4 + 3];
        } else {
          // More likely background - keep original
          result.data[i * 4] = imageData.data[i * 4];
          result.data[i * 4 + 1] = imageData.data[i * 4 + 1];
          result.data[i * 4 + 2] = imageData.data[i * 4 + 2];
          result.data[i * 4 + 3] = imageData.data[i * 4 + 3];
        }
      } else {
        // Binary mask: current behavior
        if (mask.data[i] === 255) {
          let r = imageData.data[i * 4];
          let g = imageData.data[i * 4 + 1];
          let b = imageData.data[i * 4 + 2];

          // Apply contrast
          if (contrast !== 0) {
            const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
            r = Math.min(255, Math.max(0, factor * (r - 128) + 128));
            g = Math.min(255, Math.max(0, factor * (g - 128) + 128));
            b = Math.min(255, Math.max(0, factor * (b - 128) + 128));
          }

          // Apply exposure
          if (exposure !== 0) {
            const factor = 1 + exposure / 100;
            r = Math.min(255, Math.max(0, r * factor));
            g = Math.min(255, Math.max(0, g * factor));
            b = Math.min(255, Math.max(0, b * factor));
          }

          result.data[i * 4] = r;
          result.data[i * 4 + 1] = g;
          result.data[i * 4 + 2] = b;
          result.data[i * 4 + 3] = imageData.data[i * 4 + 3];
        } else {
          result.data[i * 4] = imageData.data[i * 4];
          result.data[i * 4 + 1] = imageData.data[i * 4 + 1];
          result.data[i * 4 + 2] = imageData.data[i * 4 + 2];
          result.data[i * 4 + 3] = imageData.data[i * 4 + 3];
        }
      }
    }

    // Apply sharpening (convolution)
    if (sharpness > 0) {
      return this.applySharpen(result, mask, sharpness);
    }

    return result;
  }

  private applySharpen(
    imageData: ImageData,
    mask: MaskData,
    strength: number
  ): ImageData {
    const result = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    const factor = strength / 100;
    const kernel = [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0
    ];

    for (let y = 1; y < imageData.height - 1; y++) {
      for (let x = 1; x < imageData.width - 1; x++) {
        const idx = y * imageData.width + x;
        
        if (mask.isProbability) {
          // Probability mask: blend based on probability
          const probability = mask.data[idx] / 255; // 0-1
          
          if (probability > 0.5) {
            // More likely foreground - apply sharpening
            let r = 0, g = 0, b = 0;
            
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const kIdx = (ky + 1) * 3 + (kx + 1);
                const pixelIdx = (y + ky) * imageData.width + (x + kx);
                
                r += imageData.data[pixelIdx * 4] * kernel[kIdx];
                g += imageData.data[pixelIdx * 4 + 1] * kernel[kIdx];
                b += imageData.data[pixelIdx * 4 + 2] * kernel[kIdx];
              }
            }

            const blendFactor = probability; // Higher sharpening for higher probability
            result.data[idx * 4] = Math.min(255, Math.max(0, imageData.data[idx * 4] + (r - imageData.data[idx * 4]) * factor * blendFactor));
            result.data[idx * 4 + 1] = Math.min(255, Math.max(0, imageData.data[idx * 4 + 1] + (g - imageData.data[idx * 4 + 1]) * factor * blendFactor));
            result.data[idx * 4 + 2] = Math.min(255, Math.max(0, imageData.data[idx * 4 + 2] + (b - imageData.data[idx * 4 + 2]) * factor * blendFactor));
            result.data[idx * 4 + 3] = imageData.data[idx * 4 + 3];
          } else {
            // More likely background - keep original
            result.data[idx * 4] = imageData.data[idx * 4];
            result.data[idx * 4 + 1] = imageData.data[idx * 4 + 1];
            result.data[idx * 4 + 2] = imageData.data[idx * 4 + 2];
            result.data[idx * 4 + 3] = imageData.data[idx * 4 + 3];
          }
        } else {
          // Binary mask: current behavior
          if (mask.data[idx] === 255) {
            let r = 0, g = 0, b = 0;
            
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const kIdx = (ky + 1) * 3 + (kx + 1);
                const pixelIdx = (y + ky) * imageData.width + (x + kx);
                
                r += imageData.data[pixelIdx * 4] * kernel[kIdx];
                g += imageData.data[pixelIdx * 4 + 1] * kernel[kIdx];
                b += imageData.data[pixelIdx * 4 + 2] * kernel[kIdx];
              }
            }

            result.data[idx * 4] = Math.min(255, Math.max(0, imageData.data[idx * 4] + (r - imageData.data[idx * 4]) * factor));
            result.data[idx * 4 + 1] = Math.min(255, Math.max(0, imageData.data[idx * 4 + 1] + (g - imageData.data[idx * 4 + 1]) * factor));
            result.data[idx * 4 + 2] = Math.min(255, Math.max(0, imageData.data[idx * 4 + 2] + (b - imageData.data[idx * 4 + 2]) * factor));
            result.data[idx * 4 + 3] = imageData.data[idx * 4 + 3];
          }
        }
      }
    }

    return result;
  }
}
