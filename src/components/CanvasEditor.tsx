import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { MaskData, ScribblePoint, BrushType } from '../types';

interface CanvasEditorProps {
  imageUri: string;
  mask: MaskData | null;
  scribbles: ScribblePoint[];
  brushType: BrushType;
  brushSize: number;
  onScribble: (point: ScribblePoint) => void;
  showMask: boolean;
  showProbabilityMask?: boolean;
  showEdgeMap?: boolean;
  showScribbleOverlay?: boolean;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  imageUri,
  mask,
  scribbles,
  brushType,
  brushSize,
  onScribble,
  showMask,
  showProbabilityMask = false,
  showEdgeMap = false,
  showScribbleOverlay = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scribbleCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const edgeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const loadImage = async () => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageRef.current = img;
        setImageLoaded(true);
        render();
      };
      img.src = imageUri;
    };
    loadImage();
  }, [imageUri]);

  useEffect(() => {
    if (imageLoaded) {
      render();
    }
  }, [mask, scribbles, showMask, showProbabilityMask, showEdgeMap, showScribbleOverlay]);

  const render = () => {
    requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      const scribbleCanvas = scribbleCanvasRef.current;
      if (!canvas || !imageRef.current) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = imageRef.current;
      canvas.width = img.width;
      canvas.height = img.height;

    // Draw original image
    ctx.drawImage(img, 0, 0);

    // Draw mask overlay if enabled
    if (showMask && mask) {
      // Use cached mask canvas if available and mask hasn't changed
      if (!maskCanvasRef.current) {
        maskCanvasRef.current = document.createElement('canvas');
        maskCanvasRef.current.width = mask.width;
        maskCanvasRef.current.height = mask.height;
      }
      
      const maskCanvas = maskCanvasRef.current;
      const maskCtx = maskCanvas.getContext('2d');
      if (maskCtx) {
        const maskImageData = maskCtx.createImageData(mask.width, mask.height);
        
        if (showProbabilityMask && mask.isProbability) {
          // Probability mask visualization: show heatmap
          for (let i = 0; i < mask.data.length; i++) {
            const probability = mask.data[i] / 255; // Convert 0-255 to 0-1
            // Heatmap: blue (low) -> green (medium) -> red (high)
            let r, g, b;
            if (probability < 0.5) {
              // Blue to green
              const t = probability * 2;
              r = 0;
              g = Math.round(t * 255);
              b = Math.round((1 - t) * 255);
            } else {
              // Green to red
              const t = (probability - 0.5) * 2;
              r = Math.round(t * 255);
              g = Math.round((1 - t) * 255);
              b = 0;
            }
            maskImageData.data[i * 4] = r;
            maskImageData.data[i * 4 + 1] = g;
            maskImageData.data[i * 4 + 2] = b;
            maskImageData.data[i * 4 + 3] = 180; // Fixed opacity
          }
        } else if (mask.isProbability) {
          // Standard probability mask: use probability value for opacity
          for (let i = 0; i < mask.data.length; i++) {
            const probability = mask.data[i] / 255; // Convert 0-255 to 0-1
            const alpha = Math.round(probability * 180); // Max opacity 180/255
            maskImageData.data[i * 4] = 0;     // R
            maskImageData.data[i * 4 + 1] = 255; // G
            maskImageData.data[i * 4 + 2] = 0; // B
            maskImageData.data[i * 4 + 3] = alpha; // A based on probability
          }
        } else {
          // Binary mask: use current behavior
          for (let i = 0; i < mask.data.length; i++) {
            const value = mask.data[i];
            maskImageData.data[i * 4] = value === 255 ? 0 : 255;
            maskImageData.data[i * 4 + 1] = value === 255 ? 255 : 0;
            maskImageData.data[i * 4 + 2] = value === 255 ? 0 : 0;
            maskImageData.data[i * 4 + 3] = value === 255 ? 100 : 50;
          }
        }
        
        maskCtx.putImageData(maskImageData, 0, 0);
        ctx.globalAlpha = 0.5;
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.globalAlpha = 1.0;
      }
    }

    // Draw edge map if enabled
    if (showEdgeMap && mask && mask.isProbability) {
      // Use cached edge canvas if available
      if (!edgeCanvasRef.current) {
        edgeCanvasRef.current = document.createElement('canvas');
        edgeCanvasRef.current.width = mask.width;
        edgeCanvasRef.current.height = mask.height;
      }
      
      const edgeCanvas = edgeCanvasRef.current;
      const edgeCtx = edgeCanvas.getContext('2d');
      if (edgeCtx) {
        const edgeImageData = edgeCtx.createImageData(mask.width, mask.height);
        
        // Simple edge detection using gradient
        for (let y = 1; y < mask.height - 1; y++) {
          for (let x = 1; x < mask.width - 1; x++) {
            const idx = y * mask.width + x;
            const current = mask.data[idx];
            const right = mask.data[idx + 1];
            const bottom = mask.data[idx + mask.width];
            
            const gradient = Math.abs(current - right) + Math.abs(current - bottom);
            const edgeValue = Math.min(255, gradient * 2);
            
            edgeImageData.data[idx * 4] = edgeValue;
            edgeImageData.data[idx * 4 + 1] = edgeValue;
            edgeImageData.data[idx * 4 + 2] = edgeValue;
            edgeImageData.data[idx * 4 + 3] = edgeValue > 50 ? 200 : 0;
          }
        }
        
        edgeCtx.putImageData(edgeImageData, 0, 0);
        ctx.globalAlpha = 0.7;
        ctx.drawImage(edgeCanvas, 0, 0);
        ctx.globalAlpha = 1.0;
      }
    }

    // Draw scribbles on separate canvas for smooth lines
    if (scribbleCanvas && showScribbleOverlay) {
      scribbleCanvas.width = canvas.width;
      scribbleCanvas.height = canvas.height;
      const scribbleCtx = scribbleCanvas.getContext('2d');
      if (scribbleCtx) {
        scribbleCtx.clearRect(0, 0, scribbleCanvas.width, scribbleCanvas.height);
        
        // Group scribbles by type and draw as continuous lines
        const scribblesByType = scribbles.reduce((acc, scribble) => {
          if (!acc[scribble.type]) {
            acc[scribble.type] = [];
          }
          acc[scribble.type].push(scribble);
          return acc;
        }, {} as Record<BrushType, ScribblePoint[]>);

        Object.entries(scribblesByType).forEach(([type, points]) => {
          if (points.length === 0) return;

          scribbleCtx.lineCap = 'round';
          scribbleCtx.lineJoin = 'round';
          scribbleCtx.lineWidth = brushSize;

          if (type === 'add') {
            scribbleCtx.strokeStyle = 'rgba(0, 255, 0, 1)';
          } else if (type === 'remove') {
            scribbleCtx.strokeStyle = 'rgba(255, 0, 0, 1)';
          } else {
            scribbleCtx.strokeStyle = 'rgba(255, 255, 255, 1)';
          }

          // Draw strokes separately to avoid connecting different strokes
          let currentStroke: ScribblePoint[] = [];
          const MAX_DISTANCE = 30; // Maximum distance to consider points as part of the same stroke

          for (let i = 0; i < points.length; i++) {
            const point = points[i];
            
            if (currentStroke.length === 0) {
              currentStroke.push(point);
            } else {
              const lastPoint = currentStroke[currentStroke.length - 1];
              const distance = Math.sqrt(
                Math.pow(point.x - lastPoint.x, 2) + Math.pow(point.y - lastPoint.y, 2)
              );
              
              if (distance > MAX_DISTANCE) {
                // End current stroke and start a new one
                if (currentStroke.length > 0) {
                  scribbleCtx.beginPath();
                  scribbleCtx.moveTo(currentStroke[0].x, currentStroke[0].y);
                  for (let j = 1; j < currentStroke.length; j++) {
                    scribbleCtx.lineTo(currentStroke[j].x, currentStroke[j].y);
                  }
                  scribbleCtx.stroke();
                }
                currentStroke = [point];
              } else {
                currentStroke.push(point);
              }
            }
          }

          // Draw the last stroke
          if (currentStroke.length > 0) {
            scribbleCtx.beginPath();
            scribbleCtx.moveTo(currentStroke[0].x, currentStroke[0].y);
            for (let j = 1; j < currentStroke.length; j++) {
              scribbleCtx.lineTo(currentStroke[j].x, currentStroke[j].y);
            }
            scribbleCtx.stroke();
          }
        });

        // Draw scribble canvas on main canvas
        ctx.drawImage(scribbleCanvas, 0, 0);
      }
    }
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    lastPointRef.current = null;
    // Don't call handlePointerMove immediately to avoid connecting to previous strokes
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Interpolate between points to avoid holes when moving fast
    if (lastPointRef.current) {
      const lastX = lastPointRef.current.x;
      const lastY = lastPointRef.current.y;
      const distance = Math.sqrt(Math.pow(x - lastX, 2) + Math.pow(y - lastY, 2));
      const stepSize = 2; // Interpolate every 2 pixels
      const steps = Math.floor(distance / stepSize);

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const interpX = lastX + (x - lastX) * t;
        const interpY = lastY + (y - lastY) * t;
        onScribble({ x: interpX, y: interpY, type: brushType });
      }
    } else {
      onScribble({ x, y, type: brushType });
    }

    lastPointRef.current = { x, y };
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  return (
    <View style={styles.container}>
      <View style={styles.backgroundGradient} />
      <canvas
        ref={canvasRef}
        style={styles.canvas}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <canvas
        ref={scribbleCanvasRef}
        style={styles.hiddenCanvas}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  canvas: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    zIndex: 10,
  },
  hiddenCanvas: {
    display: 'none',
  },
});
