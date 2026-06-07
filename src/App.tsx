import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ImageUpload } from './components/ImageUpload';
import { CanvasEditor } from './components/CanvasEditor';
import { SettingsPanel } from './components/SettingsPanel';
import { AppleGlassCard } from './components/AppleGlassCard';
import { LoadingIndicator } from './components/LoadingIndicator';
import { AddIcon, RemoveIcon, EraserIcon, EyeIcon, EyeOffIcon, CheckIcon, BlurIcon, SettingsIcon, ExportIcon, RefreshIcon, UndoIcon, RedoIcon, ReprocessIcon } from './components/Icons';
import { ONNXSegmentationEngine } from './lib/onnxSegmentation';
import { MaskRefineEngine } from './lib/maskRefine';
import { BlurEngine } from './lib/blurEngine';
import { ScribbleGuidedRefinement } from './lib/scribbleGuidedRefinement';
import { ImageDifferenceAnalyzer } from './lib/imageDifferenceAnalyzer';
import { resizeImage, loadImage, canvasToBlob, downloadImage } from './utils/imageUtils';
import { ImageData, MaskData, ScribblePoint, ScribbleData, BrushType, Settings, ProcessingState } from './types';
import { loadTranslations, toggleLanguage, getLanguage, t, Language } from './i18n/i18n';

export default function App() {
  const [language, setLanguage] = useState<Language>('nl');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [originalImageData, setOriginalImageData] = useState<ImageData | null>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [mask, setMask] = useState<MaskData | null>(null);
  const [scribbles, setScribbles] = useState<ScribbleData[]>([]);
  const [brushType, setBrushType] = useState<BrushType>('add');
  const [brushSize, setBrushSize] = useState(20);
  const [showMask, setShowMask] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [brushMode, setBrushMode] = useState<'manual' | 'ai'>('manual');
  const [dualMode, setDualMode] = useState<'single' | 'dual'>('single');
  const [backgroundImageData, setBackgroundImageData] = useState<ImageData | null>(null);
  const [showProbabilityMask, setShowProbabilityMask] = useState(false);
  const [showEdgeMap, setShowEdgeMap] = useState(false);
  const [showScribbleOverlay, setShowScribbleOverlay] = useState(true);

  // Load translations on mount
  useEffect(() => {
    loadTranslations(language);
  }, [language]);
  const [settings, setSettings] = useState<Settings>({
    blur: {
      strength: 15,
      type: 'gaussian',
      brightness: 0,
      desaturation: 30,
    },
    subject: {
      sharpness: 20,
      contrast: 10,
      exposure: 5,
    },
    ai: {
      maskSensitivity: 50,
      edgeStrictness: 50,
      smoothingStrength: 2,
    },
  });
  const [processing, setProcessing] = useState<ProcessingState>({
    isProcessing: false,
    stage: 'idle',
    progress: 0,
  });
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);

  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const segmentationEngine = useRef<ONNXSegmentationEngine>(new ONNXSegmentationEngine());
  const maskRefineEngine = useRef<MaskRefineEngine>(new MaskRefineEngine());
  const scribbleGuidedRefinement = useRef<ScribbleGuidedRefinement>(new ScribbleGuidedRefinement());
  const blurProcessor = useRef<BlurEngine>(new BlurEngine());
  const differenceAnalyzer = useRef<ImageDifferenceAnalyzer>(new ImageDifferenceAnalyzer());

  useEffect(() => {
    segmentationEngine.current.initialize();
    return () => {
      segmentationEngine.current.dispose();
    };
  }, []);

  const addToHistory = (uri: string) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(uri);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setImageUri(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setImageUri(history[historyIndex + 1]);
    }
  };

  const handleImageSelect = async (uri: string) => {
    setProcessingStartTime(Date.now());
    setProcessing({ isProcessing: true, stage: 'segmenting', progress: 0 });
    
    try {
      const resized = await resizeImage(uri, 1024, 1024);
      setImageUri(resized.uri);
      setOriginalImageData(resized);
      setImageData(resized);
      setHistory([resized.uri]);
      setHistoryIndex(0);

      setProcessing({ isProcessing: true, stage: 'segmenting', progress: 50 });
      
      let segmentationMask: MaskData;
      
      if (dualMode === 'dual' && backgroundImageData) {
        // Use difference analysis in dual mode
        const differenceResult = await differenceAnalyzer.current.analyze(
          resized,
          backgroundImageData,
          {
            colorThreshold: 30,
            textureThreshold: 20,
            minDifference: 10,
          }
        );
        
        // Run ONNX segmentation
        const onnxMask = await segmentationEngine.current.segment(resized.uri, resized.width, resized.height);
        
        // Combine difference mask with ONNX segmentation
        segmentationMask = differenceAnalyzer.current.combineWithSegmentation(
          onnxMask,
          differenceResult.differenceMask,
          0.3
        );
      } else {
        // Standard single image segmentation
        segmentationMask = await segmentationEngine.current.segment(resized.uri, resized.width, resized.height);
      }
      
      setMask(segmentationMask);
      
      setProcessing({ isProcessing: false, stage: 'idle', progress: 0 });
      setProcessingStartTime(null);
    } catch (error) {
      console.error('Error processing image:', error);
      setProcessing({ isProcessing: false, stage: 'idle', progress: 0 });
      setProcessingStartTime(null);
    }
  };

  const handleBackgroundImageSelect = async (uri: string) => {
    try {
      const resized = await resizeImage(uri, 1024, 1024);
      setBackgroundImageData(resized);
    } catch (error) {
      console.error('Error processing background image:', error);
    }
  };

  const handleModeChange = (mode: 'single' | 'dual') => {
    setDualMode(mode);
    // Reset state when switching modes
    if (mode === 'single') {
      setBackgroundImageData(null);
    }
  };

  const getEstimatedTimeRemaining = () => {
    if (!processingStartTime || processing.progress <= 0) return null;
    
    const elapsed = Date.now() - processingStartTime;
    const progress = processing.progress / 100;
    
    if (progress <= 0) return null;
    
    const estimatedTotal = elapsed / progress;
    const remaining = estimatedTotal - elapsed;
    
    if (remaining < 0) return null;
    
    const seconds = Math.ceil(remaining / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const handleReprocess = async () => {
    if (!originalImageData) return;

    setProcessing({ isProcessing: true, stage: 'segmenting', progress: 0 });
    
    try {
      setImageUri(originalImageData.uri);
      setImageData(originalImageData);
      setMask(null);
      setScribbles([]);

      setProcessing({ isProcessing: true, stage: 'segmenting', progress: 50 });
      
      const segmentationMask = await segmentationEngine.current.segment(originalImageData.uri, originalImageData.width, originalImageData.height);
      setMask(segmentationMask);
      
      setProcessing({ isProcessing: false, stage: 'idle', progress: 0 });
    } catch (error) {
      console.error('Error reprocessing image:', error);
      setProcessing({ isProcessing: false, stage: 'idle', progress: 0 });
    }
  };

  const handleScribble = (point: ScribblePoint) => {
    // Add confidence based on brush type
    const confidence = point.type === 'add' ? 0.9 : point.type === 'remove' ? 0.9 : 0.5;
    const scribbleData: ScribbleData = {
      points: [point],
      timestamp: Date.now(),
    };
    setScribbles([...scribbles, scribbleData]);
  };

  const handleApplyScribbles = async () => {
    if (!mask || !imageData) return;

    setProcessing({ isProcessing: true, stage: 'refining', progress: 0 });
    
    try {
      // Use new ScribbleGuidedRefinement pipeline for both manual and AI modes
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setProcessing({ isProcessing: true, stage: 'refining', progress: 20 });
      
      const refinedMask = await scribbleGuidedRefinement.current.refine(
        mask,
        scribbles,
        imageData,
        {
          colorExpansionStrength: brushMode === 'manual' ? 20 : 30 + (100 - settings.ai.maskSensitivity) / 2,
          edgeStrictness: settings.ai.edgeStrictness,
          smoothingIterations: brushMode === 'manual' ? 1 : settings.ai.smoothingStrength + 2,
        }
      );
      
      setMask(refinedMask);
      setScribbles([]);
      
      setProcessing({ isProcessing: false, stage: 'idle', progress: 0 });
    } catch (error) {
      console.error('Error refining mask:', error);
      setProcessing({ isProcessing: false, stage: 'idle', progress: 0 });
    }
  };

  const handleProcessImage = async () => {
    if (!mask || !imageData) return;

    setProcessing({ isProcessing: true, stage: 'blurring', progress: 0 });
    
    try {
      const img = await loadImage(imageData.uri);
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');
      ctx.drawImage(img, 0, 0);
      let imageDataRaw = ctx.getImageData(0, 0, imageData.width, imageData.height);

      setProcessing({ isProcessing: true, stage: 'blurring', progress: 20 });

      if (settings.blur.type === 'gaussian') {
        imageDataRaw = blurProcessor.current.applyGaussianBlur(imageDataRaw, mask, settings.blur.strength);
      } else if (settings.blur.type === 'radial') {
        imageDataRaw = blurProcessor.current.applyRadialBlur(imageDataRaw, mask, settings.blur.strength);
      } else {
        imageDataRaw = blurProcessor.current.applyDiffusionBlur(imageDataRaw, mask, settings.blur.strength);
      }

      setProcessing({ isProcessing: true, stage: 'blurring', progress: 40 });

      if (settings.blur.brightness !== 0) {
        imageDataRaw = blurProcessor.current.adjustBrightness(imageDataRaw, mask, settings.blur.brightness);
      }
      if (settings.blur.desaturation !== 0) {
        imageDataRaw = blurProcessor.current.adjustSaturation(imageDataRaw, mask, settings.blur.desaturation);
      }

      setProcessing({ isProcessing: true, stage: 'blurring', progress: 60 });

      imageDataRaw = blurProcessor.current.enhanceSubject(
        imageDataRaw,
        mask,
        settings.subject.sharpness,
        settings.subject.contrast,
        settings.subject.exposure
      );

      setProcessing({ isProcessing: true, stage: 'blurring', progress: 80 });

      ctx.putImageData(imageDataRaw, 0, 0);
      const newUri = canvas.toDataURL('image/jpeg', 0.95);
      setImageUri(newUri);
      addToHistory(newUri);
      setShowSettings(true);

      setProcessing({ isProcessing: false, stage: 'idle', progress: 0 });
    } catch (error) {
      console.error('Error processing image:', error);
      setProcessing({ isProcessing: false, stage: 'idle', progress: 0 });
    }
  };

  const handleExport = async () => {
    if (!imageUri) return;

    setProcessing({ isProcessing: true, stage: 'exporting', progress: 0 });
    
    try {
      const img = await loadImage(imageUri);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');
      ctx.drawImage(img, 0, 0);

      setProcessing({ isProcessing: true, stage: 'exporting', progress: 50 });

      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.95);
      downloadImage(blob, 'ai-edited-photo.jpg');

      setProcessing({ isProcessing: false, stage: 'idle', progress: 0 });
    } catch (error) {
      console.error('Error exporting image:', error);
      setProcessing({ isProcessing: false, stage: 'idle', progress: 0 });
    }
  };

  const handleReset = () => {
    setImageUri(null);
    setOriginalImageData(null);
    setImageData(null);
    setMask(null);
    setScribbles([]);
    setShowMask(true);
    setShowSettings(false);
    setHistory([]);
    setHistoryIndex(-1);
  };

  if (!imageUri) {
    return (
      <View style={styles.container}>
        <StatusBar style="auto" />
        <ImageUpload 
          onImageSelect={handleImageSelect} 
          onBackgroundImageSelect={handleBackgroundImageSelect}
          onModeChange={handleModeChange}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.editorContainer}>
        <CanvasEditor
          imageUri={imageUri}
          mask={mask}
          scribbles={scribbles.flatMap(s => s.points)}
          brushType={brushType}
          brushSize={brushSize}
          onScribble={handleScribble}
          showMask={showMask}
          showProbabilityMask={showProbabilityMask}
          showEdgeMap={showEdgeMap}
          showScribbleOverlay={showScribbleOverlay}
        />
      </View>

      {processing.isProcessing && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingModal}>
            <LoadingIndicator 
              size={60} 
              stage={processing.stage}
              progress={processing.progress}
              stages={['segmenting', 'refining', 'blurring']}
              estimatedTimeRemaining={getEstimatedTimeRemaining()}
            />
            <Text style={styles.processingText}>
              {t(processing.stage)}...
            </Text>
          </View>
        </View>
      )}

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.navButton, brushType === 'add' && styles.activeButton]}
          onPress={() => setBrushType('add')}
        >
          <AddIcon size={24} color={brushType === 'add' ? '#FFFFFF' : '#FFFFFF'} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.navButton, brushType === 'remove' && styles.activeButton]}
          onPress={() => setBrushType('remove')}
        >
          <RemoveIcon size={24} color={brushType === 'remove' ? '#FFFFFF' : '#FFFFFF'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, brushMode === 'manual' && styles.activeButton]}
          onPress={() => setBrushMode('manual')}
        >
          <Text style={styles.navButtonText}>M</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, brushMode === 'ai' && styles.activeButton]}
          onPress={() => setBrushMode('ai')}
        >
          <Text style={styles.navButtonText}>AI</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, brushType === 'eraser' && styles.activeButton]}
          onPress={() => setBrushType('eraser')}
        >
          <EraserIcon size={24} color={brushType === 'eraser' ? '#FFFFFF' : '#FFFFFF'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setShowMask(!showMask)}
        >
          {showMask ? <EyeIcon size={24} color="#FFFFFF" /> : <EyeOffIcon size={24} color="#FFFFFF" />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, showProbabilityMask && styles.activeButton]}
          onPress={() => setShowProbabilityMask(!showProbabilityMask)}
        >
          <Text style={styles.navButtonText}>P</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, showEdgeMap && styles.activeButton]}
          onPress={() => setShowEdgeMap(!showEdgeMap)}
        >
          <Text style={styles.navButtonText}>E</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, !showScribbleOverlay && styles.activeButton]}
          onPress={() => setShowScribbleOverlay(!showScribbleOverlay)}
        >
          <Text style={styles.navButtonText}>S</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={handleApplyScribbles}
        >
          <CheckIcon size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={handleProcessImage}
        >
          <BlurIcon size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setShowSettings(!showSettings)}
        >
          <SettingsIcon size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={handleExport}
        >
          <ExportIcon size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={handleReprocess}
        >
          <ReprocessIcon size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={handleUndo}
          disabled={historyIndex <= 0}
        >
          <UndoIcon size={24} color={historyIndex <= 0 ? '#666666' : '#FFFFFF'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={handleRedo}
          disabled={historyIndex >= history.length - 1}
        >
          <RedoIcon size={24} color={historyIndex >= history.length - 1 ? '#666666' : '#FFFFFF'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, styles.resetButton]}
          onPress={handleReset}
        >
          <RefreshIcon size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {showSettings && (
        <View style={styles.settingsPanel}>
          <SettingsPanel settings={settings} onSettingsChange={setSettings} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
      },
    }),
  },
  processingModal: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
      },
    }),
  },
  processingText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
  },
  editorContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  bottomBar: {
    flexDirection: 'row',
    width: '100%',
    height: 'auto',
    paddingVertical: 8,
    paddingHorizontal: 12,
    justifyContent: 'space-around',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  activeButton: {
    backgroundColor: '#FFFFFF',
  },
  resetButton: {
    backgroundColor: '#FF3B30',
  },
  settingsPanel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 320,
    zIndex: 100,
    padding: 8,
  },
});
