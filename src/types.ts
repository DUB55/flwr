export type BrushType = 'add' | 'remove' | 'eraser';

export type BlurType = 'gaussian' | 'radial' | 'diffusion';

export interface ImageData {
  uri: string;
  width: number;
  height: number;
}

export interface MaskData {
  data: Uint8Array;
  width: number;
  height: number;
  isProbability: boolean; // true = probability mask (0-255 represents 0-1), false = binary mask
}

export interface ScribblePoint {
  x: number;
  y: number;
  type: BrushType;
  confidence?: number; // 0-1 strength of the scribble hint
}

export interface ScribbleData {
  points: ScribblePoint[];
  timestamp: number;
}

export interface Settings {
  blur: {
    strength: number;
    type: BlurType;
    brightness: number;
    desaturation: number;
  };
  subject: {
    sharpness: number;
    contrast: number;
    exposure: number;
  };
  ai: {
    maskSensitivity: number;
    edgeStrictness: number;
    smoothingStrength: number;
  };
}

export interface ProcessingState {
  isProcessing: boolean;
  stage: 'idle' | 'segmenting' | 'refining' | 'blurring' | 'exporting';
  progress: number;
}
