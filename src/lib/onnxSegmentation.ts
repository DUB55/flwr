import * as ort from 'onnxruntime-react-native';
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
    if (!this.session || !this.isInitialized) {
      await this.initialize();
    }

    try {
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
      console.error('Segmentation inference failed:', error);
      throw new Error(`Segmentation failed: ${error}`);
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
