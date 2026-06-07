import { MaskData } from '../types';

// Load MediaPipe Selfie Segmentation dynamically
declare global {
  interface Window {
    SelfieSegmentation: any;
  }
}

export class SegmentationEngine {
  private selfieSegmentation: any = null;
  private isInitialized = false;
  private currentResult: any = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Load MediaPipe script dynamically
    if (!window.SelfieSegmentation) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js');
    }

    this.selfieSegmentation = new window.SelfieSegmentation({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
      },
    });

    this.selfieSegmentation.setOptions({
      modelSelection: 1, // 0: general, 1: landscape (better for flowers/objects)
      selfieMode: false,
      minDetectionConfidence: 0.5,
      minSegmentationConfidence: 0.5,
    });

    this.selfieSegmentation.onResults((results: any) => {
      this.currentResult = results;
    });

    await this.selfieSegmentation.initialize();
    this.isInitialized = true;
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async segmentImage(imageElement: HTMLImageElement): Promise<MaskData> {
    if (!this.selfieSegmentation) {
      await this.initialize();
    }

    this.currentResult = null;
    await this.selfieSegmentation!.send({ image: imageElement });
    
    // Wait for results
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.currentResult) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 10);
    });

    if (!this.currentResult || !this.currentResult.segmentationMask) {
      throw new Error('Failed to get segmentation mask');
    }

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = imageElement.width;
    maskCanvas.height = imageElement.height;
    const maskCtx = maskCanvas.getContext('2d');
    
    if (!maskCtx) {
      throw new Error('Failed to get mask canvas context');
    }

    maskCtx.drawImage(this.currentResult.segmentationMask, 0, 0, imageElement.width, imageElement.height);
    const imageData = maskCtx.getImageData(0, 0, imageElement.width, imageElement.height);
    
    // Convert to binary mask (foreground = 255, background = 0)
    const maskData = new Uint8Array(imageData.data.length / 4);
    for (let i = 0; i < maskData.length; i++) {
      maskData[i] = imageData.data[i * 4] > 128 ? 255 : 0;
    }

    return {
      data: maskData,
      width: imageElement.width,
      height: imageElement.height,
    };
  }

  destroy(): void {
    if (this.selfieSegmentation) {
      this.selfieSegmentation.close();
      this.selfieSegmentation = null;
    }
    this.currentResult = null;
    this.isInitialized = false;
  }
}
