import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Text } from 'react-native';

interface LoadingIndicatorProps {
  size?: number;
  stage?: string;
  progress?: number;
  stages?: string[];
  estimatedTimeRemaining?: string | null;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ 
  size = 60, 
  stage = '',
  progress = 0,
  stages = ['segmenting', 'refining', 'blurring'],
  estimatedTimeRemaining = null
}) => {
  const blob1Anim = useRef(new Animated.Value(0)).current;
  const blob2Anim = useRef(new Animated.Value(0)).current;
  const blob3Anim = useRef(new Animated.Value(0)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Blob 1 animation - morphing border-radius
    const blob1Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blob1Anim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.bezier(0.25, 1, 0.5, 1)),
          useNativeDriver: true,
        }),
        Animated.timing(blob1Anim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.bezier(0.25, 1, 0.5, 1)),
          useNativeDriver: true,
        }),
      ])
    );

    // Blob 2 animation - morphing border-radius (offset timing)
    const blob2Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blob2Anim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.bezier(0.25, 1, 0.5, 1)),
          useNativeDriver: true,
          delay: 600,
        }),
        Animated.timing(blob2Anim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.bezier(0.25, 1, 0.5, 1)),
          useNativeDriver: true,
        }),
      ])
    );

    // Blob 3 animation - morphing border-radius (offset timing)
    const blob3Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blob3Anim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.bezier(0.25, 1, 0.5, 1)),
          useNativeDriver: true,
          delay: 1200,
        }),
        Animated.timing(blob3Anim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.bezier(0.25, 1, 0.5, 1)),
          useNativeDriver: true,
        }),
      ])
    );

    // Rotation animation
    const rotationLoop = Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 360,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Breathing scale animation
    const scaleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 900,
          easing: Easing.inOut(Easing.bezier(0.25, 1, 0.5, 1)),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.bezier(0.25, 1, 0.5, 1)),
          useNativeDriver: true,
        }),
      ])
    );

    blob1Loop.start();
    blob2Loop.start();
    blob3Loop.start();
    rotationLoop.start();
    scaleLoop.start();

    return () => {
      blob1Loop.stop();
      blob2Loop.stop();
      blob3Loop.stop();
      rotationLoop.stop();
      scaleLoop.stop();
    };
  }, [blob1Anim, blob2Anim, blob3Anim, rotationAnim, scaleAnim]);

  const blob1BorderRadius = blob1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['30%', '70%'],
  });

  const blob2BorderRadius = blob2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['40%', '60%'],
  });

  const blob3BorderRadius = blob3Anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['35%', '65%'],
  });

  const rotation = rotationAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  const currentStageIndex = stages.indexOf(stage);
  const stageProgress = currentStageIndex >= 0 ? ((currentStageIndex + 1) / stages.length) * 100 : 0;
  const totalProgress = Math.min(100, Math.max(progress, stageProgress));

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, { width: size, height: size }]}>
        <Animated.View
          style={[
            styles.blob,
            {
              width: size,
              height: size,
              backgroundColor: '#16B0DD',
              borderRadius: blob1BorderRadius,
              transform: [{ rotate: rotation }, { scale: scaleAnim }],
              opacity: 0.8,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            {
              width: size * 0.8,
              height: size * 0.8,
              backgroundColor: '#974994',
              borderRadius: blob2BorderRadius,
              transform: [{ rotate: rotation }, { scale: scaleAnim }],
              opacity: 0.7,
              position: 'absolute',
              top: size * 0.1,
              left: size * 0.1,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            {
              width: size * 0.6,
              height: size * 0.6,
              backgroundColor: '#E43B37',
              borderRadius: blob3BorderRadius,
              transform: [{ rotate: rotation }, { scale: scaleAnim }],
              opacity: 0.6,
              position: 'absolute',
              top: size * 0.2,
              left: size * 0.2,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            {
              width: size * 0.4,
              height: size * 0.4,
              backgroundColor: '#F7BC24',
              borderRadius: blob1BorderRadius,
              transform: [{ rotate: rotation }, { scale: scaleAnim }],
              opacity: 0.5,
              position: 'absolute',
              top: size * 0.3,
              left: size * 0.3,
            },
          ]}
        />
      </View>
      
      {stage && (
        <View style={styles.stageContainer}>
          <Text style={styles.stageText}>{stage}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${totalProgress}%` }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(totalProgress)}%</Text>
          {estimatedTimeRemaining && (
            <Text style={styles.timeText}>~{estimatedTimeRemaining} remaining</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  blob: {
    shadowColor: '#16B0DD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  stageContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  stageText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  progressBar: {
    width: 200,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#16B0DD',
    borderRadius: 2,
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 8,
  },
  timeText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 4,
  },
});
