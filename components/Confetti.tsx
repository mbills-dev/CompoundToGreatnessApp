import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';

const LIME = '#CCFF00';
const WHITE = '#FFFFFF';
const GRAY = '#888888';

const COLORS = [LIME, LIME, LIME, WHITE, GRAY];

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

interface PieceConfig {
  x: number;
  width: number;
  height: number;
  color: string;
  delay: number;
  duration: number;
  swayAmount: number;
  swayLegDuration: number;
  rotationSpeed: number;
  rotationDir: 1 | -1;
  startY: number;
}

function ConfettiPiece({ cfg, screenHeight, onDone }: { cfg: PieceConfig; screenHeight: number; onDone?: () => void }) {
  const translateY = useSharedValue(cfg.startY);
  const translateX = useSharedValue(cfg.x);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const fadeStart = 0.8;

    translateY.value = withDelay(
      cfg.delay,
      withTiming(screenHeight + 60, {
        duration: cfg.duration,
        easing: Easing.bezier(0.33, 0.0, 0.67, 1.0),
      }),
    );

    translateX.value = withDelay(
      cfg.delay,
      withRepeat(
        withSequence(
          withTiming(cfg.x + cfg.swayAmount, { duration: cfg.swayLegDuration, easing: Easing.inOut(Easing.sin) }),
          withTiming(cfg.x - cfg.swayAmount, { duration: cfg.swayLegDuration, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );

    rotate.value = withDelay(
      cfg.delay,
      withRepeat(
        withTiming(cfg.rotationDir * 360, { duration: cfg.rotationSpeed, easing: Easing.linear }),
        -1,
        false,
      ),
    );

    opacity.value = withDelay(
      cfg.delay,
      withSequence(
        withTiming(1, { duration: cfg.duration * fadeStart }),
        withTiming(0, {
          duration: cfg.duration * (1 - fadeStart),
          easing: Easing.out(Easing.ease),
        }),
      ),
    );

    if (onDone) {
      const total = cfg.delay + cfg.duration;
      const timer = setTimeout(() => { onDone(); }, total);
      return () => clearTimeout(timer);
    }
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute',
          width: cfg.width,
          height: cfg.height,
          borderRadius: 1,
          backgroundColor: cfg.color,
          left: 0,
          top: 0,
        },
      ]}
    />
  );
}

interface ConfettiProps {
  count?: number;
  onDone?: () => void;
  fallDurationMin?: number;
  fallDurationMax?: number;
}

export default function Confetti({ count = 36, onDone, fallDurationMin = 6500, fallDurationMax = 9500 }: ConfettiProps) {
  const doneCalledRef = useRef(false);

  const pieces: PieceConfig[] = Array.from({ length: count }, () => {
    const duration = randomBetween(fallDurationMin, fallDurationMax);
    const delay = randomBetween(0, 600);
    return {
      x: randomBetween(0, 380),
      width: randomBetween(8, 14),
      height: randomBetween(3, 6),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay,
      duration,
      swayAmount: randomBetween(8, 18),
      swayLegDuration: randomBetween(1600, 2400),
      rotationSpeed: randomBetween(1200, 2800),
      rotationDir: Math.random() > 0.5 ? 1 : -1,
      startY: randomBetween(-120, -20),
    };
  });

  const longestIdx = pieces.reduce((best, p, i) =>
    p.delay + p.duration > pieces[best].delay + pieces[best].duration ? i : best, 0);

  const handleDone = () => {
    if (!doneCalledRef.current) {
      doneCalledRef.current = true;
      onDone?.();
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((cfg, i) => (
        <ConfettiPiece
          key={i}
          cfg={cfg}
          screenHeight={900}
          onDone={i === longestIdx ? handleDone : undefined}
        />
      ))}
    </View>
  );
}
