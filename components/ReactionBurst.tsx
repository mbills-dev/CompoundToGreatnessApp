import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

interface ParticleConfig {
  emoji: string;
  startX: number;
  startY: number;
  driftX: number;
  driftY: number;
  rotation: number;
  rotationDir: 1 | -1;
  scale: number;
  delay: number;
  duration: number;
}

function ReactionParticle({ cfg, onDone }: { cfg: ParticleConfig; onDone?: () => void }) {
  const translateX = useSharedValue(cfg.startX);
  const translateY = useSharedValue(cfg.startY);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(cfg.scale);

  useEffect(() => {
    opacity.value = withDelay(
      cfg.delay,
      withTiming(1, { duration: 150, easing: Easing.out(Easing.ease) }),
    );

    translateX.value = withDelay(
      cfg.delay,
      withTiming(cfg.startX + cfg.driftX, {
        duration: cfg.duration,
        easing: Easing.bezier(0.25, 0.0, 0.5, 1.0),
      }),
    );

    translateY.value = withDelay(
      cfg.delay,
      withTiming(cfg.startY + cfg.driftY, {
        duration: cfg.duration,
        easing: Easing.bezier(0.33, 0.0, 0.67, 1.0),
      }),
    );

    rotate.value = withDelay(
      cfg.delay,
      withTiming(cfg.rotationDir * cfg.rotation, {
        duration: cfg.duration,
        easing: Easing.linear,
      }),
    );

    opacity.value = withDelay(
      cfg.delay + 150,
      withTiming(0, {
        duration: cfg.duration - 150,
        easing: Easing.in(Easing.ease),
      }),
    );

    scale.value = withDelay(
      cfg.delay,
      withTiming(cfg.scale * 1.3, { duration: cfg.duration, easing: Easing.out(Easing.ease) }),
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
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[styles.particle, style]} pointerEvents="none">
      {cfg.emoji}
    </Animated.Text>
  );
}

interface ReactionBurstProps {
  emoji: string;
  count: number;
  onComplete: () => void;
}

export default function ReactionBurst({ emoji, count, onComplete }: ReactionBurstProps) {
  const doneCalledRef = useRef(false);

  const particles: ParticleConfig[] = Array.from({ length: count }, () => {
    const duration = randomBetween(1800, 2500);
    const delay = randomBetween(0, 400);
    return {
      emoji,
      startX: randomBetween(140, 180),
      startY: randomBetween(300, 400),
      driftX: randomBetween(-120, 120),
      driftY: randomBetween(-280, -180),
      rotation: randomBetween(180, 540),
      rotationDir: Math.random() > 0.5 ? 1 : -1,
      scale: randomBetween(28, 44),
      delay,
      duration,
    };
  });

  const longestIdx = particles.reduce((best, p, i) =>
    p.delay + p.duration > particles[best].delay + particles[best].duration ? i : best, 0);

  const handleDone = () => {
    if (!doneCalledRef.current) {
      doneCalledRef.current = true;
      onComplete();
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((cfg, i) => (
        <ReactionParticle
          key={i}
          cfg={cfg}
          onDone={i === longestIdx ? handleDone : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    left: 0,
    top: 0,
    fontSize: 36,
  },
});
