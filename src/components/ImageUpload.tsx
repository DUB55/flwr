import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { AppleGlassCard } from './AppleGlassCard';
import { UploadIcon } from './Icons';
import { t } from '../i18n/i18n';

interface ImageUploadProps {
  onImageSelect: (uri: string) => void;
  onBackgroundImageSelect?: (uri: string) => void;
  onModeChange?: (mode: 'single' | 'dual') => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ onImageSelect, onBackgroundImageSelect, onModeChange }) => {
  const [mode, setMode] = useState<'single' | 'dual'>('single');
  const [foregroundUri, setForegroundUri] = useState<string | null>(null);
  const [backgroundUri, setBackgroundUri] = useState<string | null>(null);

  const handleModeChange = (newMode: 'single' | 'dual') => {
    setMode(newMode);
    onModeChange?.(newMode);
    // Reset images when switching modes
    setForegroundUri(null);
    setBackgroundUri(null);
  };

  const handleForegroundFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Validate image dimensions match in dual mode
        if (mode === 'dual' && backgroundUri) {
          const img = new Image();
          img.onload = () => {
            const bgImg = new Image();
            bgImg.onload = () => {
              if (img.width !== bgImg.width || img.height !== bgImg.height) {
                alert(t('image_dimension_mismatch'));
                return;
              }
              const reader = new FileReader();
              reader.onload = (event) => {
                const uri = event.target?.result as string;
                setForegroundUri(uri);
                onImageSelect(uri);
              };
              reader.readAsDataURL(file);
            };
            bgImg.src = backgroundUri;
          };
          img.src = URL.createObjectURL(file);
        } else {
          const reader = new FileReader();
          reader.onload = (event) => {
            const uri = event.target?.result as string;
            setForegroundUri(uri);
            onImageSelect(uri);
          };
          reader.readAsDataURL(file);
        }
      }
    };
    input.click();
  };

  const handleBackgroundFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Validate image dimensions match in dual mode
        if (mode === 'dual' && foregroundUri) {
          const img = new Image();
          img.onload = () => {
            const fgImg = new Image();
            fgImg.onload = () => {
              if (img.width !== fgImg.width || img.height !== fgImg.height) {
                alert(t('image_dimension_mismatch'));
                return;
              }
              const reader = new FileReader();
              reader.onload = (event) => {
                const uri = event.target?.result as string;
                setBackgroundUri(uri);
                onBackgroundImageSelect?.(uri);
              };
              reader.readAsDataURL(file);
            };
            fgImg.src = foregroundUri;
          };
          img.src = URL.createObjectURL(file);
        } else {
          const reader = new FileReader();
          reader.onload = (event) => {
            const uri = event.target?.result as string;
            setBackgroundUri(uri);
            onBackgroundImageSelect?.(uri);
          };
          reader.readAsDataURL(file);
        }
      }
    };
    input.click();
  };

  return (
    <View style={styles.container}>
      <View style={styles.backgroundGradient} />
      
      <AppleGlassCard material="regular" style={styles.glassCard}>
        <Text style={styles.title}>{t('app_title')}</Text>
        <Text style={styles.subtitle}>{t('subtitle')}</Text>
        
        {/* Mode Selection */}
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'single' && styles.modeButtonActive]}
            onPress={() => handleModeChange('single')}
          >
            <Text style={[styles.modeButtonText, mode === 'single' && styles.modeButtonTextActive]}>
              {t('single_mode')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'dual' && styles.modeButtonActive]}
            onPress={() => handleModeChange('dual')}
          >
            <Text style={[styles.modeButtonText, mode === 'dual' && styles.modeButtonTextActive]}>
              {t('dual_mode')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Foreground Image Upload */}
        <TouchableOpacity style={styles.button} onPress={handleForegroundFileSelect}>
          <View style={styles.buttonContent}>
            <UploadIcon size={24} color="#FFFFFF" />
            <Text style={styles.buttonText}>
              {mode === 'dual' ? t('upload_foreground') : t('upload_photo')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Background Image Upload (Dual Mode Only) */}
        {mode === 'dual' && (
          <TouchableOpacity style={styles.button} onPress={handleBackgroundFileSelect}>
            <View style={styles.buttonContent}>
              <UploadIcon size={24} color="#FFFFFF" />
              <Text style={styles.buttonText}>{t('upload_background')}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Status Messages */}
        {foregroundUri && mode === 'single' && (
          <Text style={styles.status}>{t('image_loaded')}</Text>
        )}
        {mode === 'dual' && foregroundUri && (
          <Text style={styles.status}>{t('foreground_loaded')}</Text>
        )}
        {mode === 'dual' && backgroundUri && (
          <Text style={styles.status}>{t('background_loaded')}</Text>
        )}
        {mode === 'dual' && foregroundUri && backgroundUri && (
          <Text style={styles.status}>{t('both_images_loaded')}</Text>
        )}
      </AppleGlassCard>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  glassCard: {
    width: '100%',
    maxWidth: 400,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 32,
    textAlign: 'center',
  },
  modeSelector: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 8,
  },
  modeButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  modeButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: '#FFFFFF',
  },
  modeButtonText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    minWidth: 200,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  buttonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  status: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 8,
  },
  info: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    marginTop: 24,
  },
});
