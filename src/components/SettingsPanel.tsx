import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Settings, BlurType } from '../types';
import { AppleGlassCard } from './AppleGlassCard';
import { t } from '../i18n/i18n';

interface SettingsPanelProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSettingsChange,
}) => {
  const updateBlur = (key: keyof Settings['blur'], value: any) => {
    onSettingsChange({
      ...settings,
      blur: { ...settings.blur, [key]: value },
    });
  };

  const updateSubject = (key: keyof Settings['subject'], value: any) => {
    onSettingsChange({
      ...settings,
      subject: { ...settings.subject, [key]: value },
    });
  };

  const updateAI = (key: keyof Settings['ai'], value: any) => {
    onSettingsChange({
      ...settings,
      ai: { ...settings.ai, [key]: value },
    });
  };

  return (
    <ScrollView style={styles.container}>
      <AppleGlassCard material="thin" style={styles.card}>
        <Text style={styles.sectionTitle}>{t('settings')}</Text>
        
        <View style={styles.settingRow}>
          <Text style={styles.label}>{t('blur_strength')}</Text>
          <input
            type="range"
            min="0"
            max="50"
            value={settings.blur.strength}
            onChange={(e) => updateBlur('strength', parseInt(e.target.value))}
            style={styles.slider}
          />
          <Text style={styles.value}>{settings.blur.strength}px</Text>
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.label}>{t('blur_type')}</Text>
          <select
            value={settings.blur.type}
            onChange={(e) => updateBlur('type', e.target.value as BlurType)}
            style={styles.select}
          >
            <option value="gaussian">{t('gaussian')}</option>
            <option value="radial">{t('radial')}</option>
            <option value="diffusion">{t('diffusion')}</option>
          </select>
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.label}>{t('brightness')}</Text>
          <input
            type="range"
            min="-50"
            max="50"
            value={settings.blur.brightness}
            onChange={(e) => updateBlur('brightness', parseInt(e.target.value))}
            style={styles.slider}
          />
          <Text style={styles.value}>{settings.blur.brightness}</Text>
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.label}>{t('desaturation')}</Text>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.blur.desaturation}
            onChange={(e) => updateBlur('desaturation', parseInt(e.target.value))}
            style={styles.slider}
          />
          <Text style={styles.value}>{settings.blur.desaturation}%</Text>
        </View>

        <Text style={styles.sectionTitle}>{t('subject_sharpness')}</Text>
        
        <View style={styles.settingRow}>
          <Text style={styles.label}>{t('subject_sharpness')}</Text>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.subject.sharpness}
            onChange={(e) => updateSubject('sharpness', parseInt(e.target.value))}
            style={styles.slider}
          />
          <Text style={styles.value}>{settings.subject.sharpness}</Text>
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.label}>Contrast</Text>
          <input
            type="range"
            min="-50"
            max="50"
            value={settings.subject.contrast}
            onChange={(e) => updateSubject('contrast', parseInt(e.target.value))}
            style={styles.slider}
          />
          <Text style={styles.value}>{settings.subject.contrast}</Text>
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.label}>Exposure</Text>
          <input
            type="range"
            min="-50"
            max="50"
            value={settings.subject.exposure}
            onChange={(e) => updateSubject('exposure', parseInt(e.target.value))}
            style={styles.slider}
          />
          <Text style={styles.value}>{settings.subject.exposure}</Text>
        </View>

        <Text style={styles.sectionTitle}>AI Settings</Text>
        
        <View style={styles.settingRow}>
          <Text style={styles.label}>{t('mask_sensitivity')}</Text>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.ai.maskSensitivity}
            onChange={(e) => updateAI('maskSensitivity', parseInt(e.target.value))}
            style={styles.slider}
          />
          <Text style={styles.value}>{settings.ai.maskSensitivity}</Text>
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.label}>Edge Strictness</Text>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.ai.edgeStrictness}
            onChange={(e) => updateAI('edgeStrictness', parseInt(e.target.value))}
            style={styles.slider}
          />
          <Text style={styles.value}>{settings.ai.edgeStrictness}</Text>
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.label}>{t('smoothing_strength')}</Text>
          <input
            type="range"
            min="0"
            max="5"
            value={settings.ai.smoothingStrength}
            onChange={(e) => updateAI('smoothingStrength', parseInt(e.target.value))}
            style={styles.slider}
          />
          <Text style={styles.value}>{settings.ai.smoothingStrength}</Text>
        </View>
      </AppleGlassCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    flex: 1,
  },
  slider: {
    flex: 2,
    marginHorizontal: 8,
  },
  select: {
    flex: 2,
    marginHorizontal: 8,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#FFFFFF',
    borderRadius: 8,
    ...Platform.select({
      web: {
        border: 'none' as any,
      }
    }),
  },
  value: {
    fontSize: 14,
    color: '#FFFFFF',
    width: 50,
    textAlign: 'right',
  },
});
