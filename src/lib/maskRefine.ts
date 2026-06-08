import { MaskData, ScribblePoint } from '../types';

export class MaskRefineEngine {
  // Color propagation: expand mask based on similar colors with aggressive pattern recognition
  propagateColor(
    mask: MaskData,
    imageData: ImageData,
    threshold: number = 30
  ): MaskData {
    const newMask = new Uint8Array(mask.data);
    const width = mask.width;
    const height = mask.height;

    // Multiple passes for better pattern recognition
    for (let pass = 0; pass < 3; pass++) {
      const changed = new Set<number>();

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (newMask[idx] === 255) {
            // Check neighbors and propagate if similar color
            this.propagateToNeighbors(newMask, imageData, x, y, width, height, threshold, changed);
          }
        }
      }

      // If no changes in this pass, stop early
      if (changed.size === 0) break;
    }

    return { data: newMask, width, height, isProbability: mask.isProbability };
  }

  private propagateToNeighbors(
    mask: Uint8Array,
    imageData: ImageData,
    x: number,
    y: number,
    width: number,
    height: number,
    threshold: number,
    changed: Set<number>
  ): void {
    const idx = y * width + x;
    const baseR = imageData.data[idx * 4];
    const baseG = imageData.data[idx * 4 + 1];
    const baseB = imageData.data[idx * 4 + 2];

    const neighbors = [
      [x - 1, y], [x + 1, y],
      [x, y - 1], [x, y + 1],
      [x - 1, y - 1], [x + 1, y - 1],
      [x - 1, y + 1], [x + 1, y + 1]
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIdx = ny * width + nx;
        if (mask[nIdx] === 0) {
          const nR = imageData.data[nIdx * 4];
          const nG = imageData.data[nIdx * 4 + 1];
          const nB = imageData.data[nIdx * 4 + 2];

          const colorDiff = Math.sqrt(
            Math.pow(baseR - nR, 2) +
            Math.pow(baseG - nG, 2) +
            Math.pow(baseB - nB, 2)
          );

          if (colorDiff < threshold) {
            mask[nIdx] = 255;
            changed.add(nIdx);
          }
        }
      }
    }
  }

  // Edge detection to stop propagation at strong edges
  detectEdges(imageData: ImageData, threshold: number = 50): Uint8Array {
    const width = imageData.width;
    const height = imageData.height;
    const edges = new Uint8Array(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        // Sobel operator
        const gx = 
          -imageData.data[((y - 1) * width + (x - 1)) * 4] +
          imageData.data[((y - 1) * width + (x + 1)) * 4] +
          -2 * imageData.data[(y * width + (x - 1)) * 4] +
          2 * imageData.data[(y * width + (x + 1)) * 4] +
          -imageData.data[((y + 1) * width + (x - 1)) * 4] +
          imageData.data[((y + 1) * width + (x + 1)) * 4];

        const gy = 
          -imageData.data[((y - 1) * width + (x - 1)) * 4] +
          -2 * imageData.data[((y - 1) * width + x) * 4] +
          -imageData.data[((y - 1) * width + (x + 1)) * 4] +
          imageData.data[((y + 1) * width + (x - 1)) * 4] +
          2 * imageData.data[((y + 1) * width + x) * 4] +
          imageData.data[((y + 1) * width + (x + 1)) * 4];

        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[idx] = magnitude > threshold ? 255 : 0;
      }
    }

    return edges;
  }

  // Apply scribble guidance to mask with high-quality pattern recognition
  applyScribbles(
    mask: MaskData,
    scribbles: ScribblePoint[],
    brushSize: number = 20,
    imageData?: ImageData
  ): MaskData {
    const newMask = new Uint8Array(mask.data);
    const width = mask.width;
    const height = mask.height;

    // Increase brush size for better visibility
    const effectiveBrushSize = brushSize * 3;

    // Group scribbles by type
    const scribbleGroups: Record<string, { points: {x: number, y: number}[] }> = {
      add: { points: [] },
      remove: { points: [] },
      eraser: { points: [] }
    };

    for (const scribble of scribbles) {
      const idx = Math.floor(scribble.y) * width + Math.floor(scribble.x);
      if (idx >= 0 && idx < mask.data.length) {
        scribbleGroups[scribble.type].points.push({ x: scribble.x, y: scribble.y });
      }
    }

    // If no image data, fall back to simple brush application
    if (!imageData) {
      for (const [type, group] of Object.entries(scribbleGroups)) {
        if (group.points.length === 0) continue;

        for (const point of group.points) {
          const startX = Math.max(0, Math.floor(point.x - effectiveBrushSize / 2));
          const startY = Math.max(0, Math.floor(point.y - effectiveBrushSize / 2));
          const endX = Math.min(width, Math.floor(point.x + effectiveBrushSize / 2));
          const endY = Math.min(height, Math.floor(point.y + effectiveBrushSize / 2));

          for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
              const dx = x - point.x;
              const dy = y - point.y;
              const distance = Math.sqrt(dx * dx + dy * dy);

              if (distance <= effectiveBrushSize / 2) {
                const idx = y * width + x;
                if (type === 'add') {
                  newMask[idx] = 255;
                } else if (type === 'remove') {
                  newMask[idx] = 0;
                } else if (type === 'eraser') {
                  newMask[idx] = mask.data[idx];
                }
              }
            }
          }
        }
      }
      return { data: newMask, width, height, isProbability: mask.isProbability };
    }

    // High-quality pattern recognition algorithm
    // Step 1: Extract color signatures from scribbled areas
    const addColors: number[][] = [];
    const removeColors: number[][] = [];

    for (const point of scribbleGroups.add.points) {
      const px = Math.floor(point.x);
      const py = Math.floor(point.y);
      if (px >= 0 && px < width && py >= 0 && py < height) {
        const idx = py * width + px;
        addColors.push([
          imageData.data[idx * 4],
          imageData.data[idx * 4 + 1],
          imageData.data[idx * 4 + 2]
        ]);
      }
    }

    for (const point of scribbleGroups.remove.points) {
      const px = Math.floor(point.x);
      const py = Math.floor(point.y);
      if (px >= 0 && px < width && py >= 0 && py < height) {
        const idx = py * width + px;
        removeColors.push([
          imageData.data[idx * 4],
          imageData.data[idx * 4 + 1],
          imageData.data[idx * 4 + 2]
        ]);
      }
    }

    // Step 2: Apply direct scribble strokes first
    for (const [type, group] of Object.entries(scribbleGroups)) {
      if (group.points.length === 0) continue;

      for (const point of group.points) {
        const startX = Math.max(0, Math.floor(point.x - effectiveBrushSize / 2));
        const startY = Math.max(0, Math.floor(point.y - effectiveBrushSize / 2));
        const endX = Math.min(width, Math.floor(point.x + effectiveBrushSize / 2));
        const endY = Math.min(height, Math.floor(point.y + effectiveBrushSize / 2));

        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const dx = x - point.x;
            const dy = y - point.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= effectiveBrushSize / 2) {
              const idx = y * width + x;
              if (type === 'add') {
                newMask[idx] = 255;
              } else if (type === 'remove') {
                // Remove brush can only remove, never add
                newMask[idx] = 0;
              } else if (type === 'eraser') {
                newMask[idx] = mask.data[idx];
              }
            }
          }
        }
      }
    }

    // Step 3: Pattern recognition - propagate to similar colors throughout image
    // Color similarity function
    const colorSimilarity = (c1: number[], c2: number[]): number => {
      const dr = c1[0] - c2[0];
      const dg = c1[1] - c2[1];
      const db = c1[2] - c2[2];
      return Math.sqrt(dr * dr + dg * dg + db * db);
    };

    // Threshold for color similarity (lower = more strict)
    const colorThreshold = 40;

    // Multiple passes for better propagation
    for (let pass = 0; pass < 8; pass++) {
      let changed = false;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const pixelColor = [
            imageData.data[idx * 4],
            imageData.data[idx * 4 + 1],
            imageData.data[idx * 4 + 2]
          ];

          // Check if this pixel matches add scribbles
          if (addColors.length > 0) {
            for (const addColor of addColors) {
              if (colorSimilarity(pixelColor, addColor) < colorThreshold) {
                if (newMask[idx] !== 255) {
                  newMask[idx] = 255;
                  changed = true;
                }
                break;
              }
            }
          }

          // Check if this pixel matches remove scribbles
          if (removeColors.length > 0) {
            for (const removeColor of removeColors) {
              if (colorSimilarity(pixelColor, removeColor) < colorThreshold) {
                if (newMask[idx] !== 0) {
                  newMask[idx] = 0;
                  changed = true;
                }
                break;
              }
            }
          }
        }
      }

      // Stop if no changes
      if (!changed) break;
    }

    // Step 4: Spatial coherence - smooth the mask
    for (let smoothPass = 0; smoothPass < 3; smoothPass++) {
      const tempMask = new Uint8Array(newMask);
      
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          
          let fgCount = 0;
          let bgCount = 0;
          
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nIdx = (y + dy) * width + (x + dx);
              if (tempMask[nIdx] === 255) fgCount++;
              else bgCount++;
            }
          }
          
          // Apply majority vote with bias towards current value
          if (fgCount > bgCount + 2) {
            newMask[idx] = 255;
          } else if (bgCount > fgCount + 2) {
            newMask[idx] = 0;
          }
        }
      }
    }

    return { data: newMask, width, height, isProbability: mask.isProbability };
  }

  // Smooth mask using morphological operations
  smoothMask(mask: MaskData, iterations: number = 2): MaskData {
    let currentMask = new Uint8Array(mask.data);
    const width = mask.width;
    const height = mask.height;

    for (let iter = 0; iter < iterations; iter++) {
      const newMask = new Uint8Array(currentMask);

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          
          // Count foreground neighbors
          let fgCount = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nIdx = (y + dy) * width + (x + dx);
              if (currentMask[nIdx] === 255) fgCount++;
            }
          }

          // Morphological smoothing
          if (currentMask[idx] === 255 && fgCount < 3) {
            newMask[idx] = 0; // Erosion
          } else if (currentMask[idx] === 0 && fgCount > 5) {
            newMask[idx] = 255; // Dilation
          }
        }
      }

      currentMask = newMask;
    }

    return { data: currentMask, width, height, isProbability: mask.isProbability };
  }
}
