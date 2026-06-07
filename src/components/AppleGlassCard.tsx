import React from 'react';
import { View, StyleSheet, Platform, ViewStyle } from 'react-native';

export type GlassMaterial = 'ultraThin' | 'thin' | 'regular' | 'thick';

interface AppleGlassCardProps {
  children?: React.ReactNode;
  material?: GlassMaterial;
  isDarkMode?: boolean;
  style?: ViewStyle;
}

export const AppleGlassCard: React.FC<AppleGlassCardProps> = ({ 
  children, 
  material = 'thin', 
  isDarkMode = true, 
  style 
}) => {
  
  const getGlassStyle = () => {
    switch (material) {
      case 'ultraThin':
        return {
          backdropFilter: 'blur(10px) saturate(200%)',
          webkitBackdropFilter: 'blur(10px) saturate(200%)',
          backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.40)' : 'rgba(255, 255, 255, 0.35)',
        };
      case 'regular':
        return {
          backdropFilter: 'blur(30px) saturate(180%)',
          webkitBackdropFilter: 'blur(30px) saturate(180%)',
          backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.80)' : 'rgba(255, 255, 255, 0.75)',
        };
      case 'thick':
        return {
          backdropFilter: 'blur(50px) saturate(160%)',
          webkitBackdropFilter: 'blur(50px) saturate(160%)',
          backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.92)' : 'rgba(242, 242, 247, 0.85)',
        };
      case 'thin':
      default:
        return {
          backdropFilter: 'blur(20px) saturate(190%)',
          webkitBackdropFilter: 'blur(20px) saturate(190%)',
          backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.60)',
        };
    }
  };

  const dynamicStyles = getGlassStyle();

  return (
    <View 
      style={[
        styles.baseGlassContainer, 
        dynamicStyles as unknown as ViewStyle, 
        style
      ]}
    >
      <View style={[styles.innerBorderHighlight, isDarkMode ? styles.darkBorder : styles.lightBorder]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  baseGlassContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        willChange: 'backdrop-filter',
        transform: 'translateZ(0)',
      }
    }),
  },
  innerBorderHighlight: {
    flex: 1,
    padding: 24,
    borderRadius: 20,
    borderWidth: 0.5,
  },
  lightBorder: {
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  darkBorder: {
    borderColor: 'rgba(255, 255, 255, 0.12)',
  }
});
