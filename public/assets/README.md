# ONNX Segmentation Model

This directory should contain the ONNX segmentation model file.

## Recommended Models

For web-based segmentation, we recommend one of the following models:

### Option 1: DeepLabV3+ with MobileNet Backbone
- **File**: `deeplabv3_mobilenet.onnx`
- **Size**: ~20-30MB
- **Input**: 513x513 RGB image
- **Output**: Segmentation mask with probability scores
- **Source**: https://github.com/onnx/models

### Option 2: U-Net Variant
- **File**: `unet_segmentation.onnx`
- **Size**: ~50-100MB
- **Input**: 512x512 RGB image
- **Output**: Segmentation mask with probability scores
- **Source**: https://github.com/onnx/models

## Download Instructions

1. Visit https://github.com/onnx/models
2. Navigate to the "Vision" -> "Segmentation" section
3. Download a suitable model in ONNX format
4. Place the `.onnx` file in this directory
5. Rename it to `segmentation.onnx` for consistency

## Model Requirements

The model should:
- Accept RGB images as input (3 channels)
- Output probability values (0-1) for each pixel
- Be optimized for web inference (quantized if possible)
- Support input resolution of at least 512x512

## Current Status

**Model file**: Not yet downloaded
**Expected file**: `segmentation.onnx`
**Expected location**: `public/assets/segmentation.onnx`

## Next Steps

After downloading the model:
1. Update the model path in `src/lib/onnxSegmentation.ts`
2. Test model loading
3. Verify inference output format
