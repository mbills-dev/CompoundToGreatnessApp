import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ConfettiPieceProps {
  delay: number;
  colors: string[];
  onComplete?: () => void;
}

const ConfettiPiece: React.FC<ConfettiPieceProps> = ({ delay, colors, onComplete }) => {
  const translateY = useSharedValue(-50);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  const color = colors[Math.floor(Math.random() * colors.length)];
  const centerX = SCREEN_WIDTH / 2;
  const spread = (Math.random() - 0.5) * SCREEN_WIDTH * 0.8;
  const startX = centerX + spread;
  const horizontalDrift = (Math.random() - 0.5) * 150;
  const endX = startX + horizontalDrift;
  const translateX = useSharedValue(startX);
  const duration = 3000 + Math.random() * 1500;
  const rotations = 3 + Math.random() * 4;
  const size = 10 + Math.random() * 10;

  useEffect(() => {
    const timer = setTimeout(() => {
      translateY.value = withTiming(
        SCREEN_HEIGHT + 100,
        { duration, easing: Easing.bezier(0.25, 0.1, 0.25, 1) },
        (finished) => {
          if (finished && onComplete) {
            runOnJS(onComplete)();
          }
        }
      );
      translateX.value = withTiming(endX, { duration, easing: Easing.inOut(Easing.ease) });
      rotate.value = withTiming(rotations * 360, { duration, easing: Easing.linear });
      opacity.value = withSequence(
        withTiming(1, { duration: duration * 0.75 }),
        withTiming(0, { duration: duration * 0.25 })
      );
      scale.value = withSequence(
        withTiming(1.3, { duration: duration * 0.15 }),
        withTiming(0.9, { duration: duration * 0.85 })
      );
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.confettiPiece,
        animatedStyle,
        {
          backgroundColor: color,
          width: size,
          height: size,
        },
      ]}
    />
  );
};

interface ConfettiAnimationProps {
  onComplete?: () => void;
}

export const ConfettiAnimation: React.FC<ConfettiAnimationProps> = ({ onComplete }) => {
  const confettiColors = [
    '#FFD700',
    '#FFA500',
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#DFE6E9',
    '#FF7675',
    '#74B9FF',
  ];

  const confettiCount = 150;
  const [completedCount, setCompletedCount] = React.useState(0);

  const handlePieceComplete = () => {
    setCompletedCount((prev) => {
      const newCount = prev + 1;
      if (newCount >= confettiCount && onComplete) {
        setTimeout(onComplete, 500);
      }
      return newCount;
    });
  };

  return (
    <View style={styles.container} pointerEvents="none">
      {Array.from({ length: confettiCount }).map((_, index) => (
        <ConfettiPiece
          key={index}
          delay={index * 15}
          colors={confettiColors}
          onComplete={handlePieceComplete}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  confettiPiece: {
    position: 'absolute',
    borderRadius: 4,
  },
});
