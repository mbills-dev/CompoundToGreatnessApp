import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

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
  const translateX = useRef(new Animated.Value(cfg.startX)).current;
  const translateY = useRef(new Animated.Value(cfg.startY)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(cfg.scale)).current;

  useEffect(() => {
    const animations: Animated.CompositeAnimation[] = [];

    const fadeIn = 120;
    const holdDuration = Math.max(0, cfg.duration * 0.65 - fadeIn);
    const fadeOut = cfg.duration * 0.35;

    animations.push(
      Animated.sequence([
        Animated.delay(cfg.delay),
        Animated.timing(opacity, { toValue: 1, duration: fadeIn, useNativeDriver: true }),
        Animated.delay(holdDuration),
        Animated.timing(opacity, { toValue: 0, duration: fadeOut, useNativeDriver: true }),
      ]),
    );

    animations.push(
      Animated.timing(translateX, {
        toValue: cfg.startX + cfg.driftX,
        duration: cfg.duration,
        delay: cfg.delay,
        useNativeDriver: true,
      }),
    );

    animations.push(
      Animated.timing(translateY, {
        toValue: cfg.startY + cfg.driftY,
        duration: cfg.duration,
        delay: cfg.delay,
        useNativeDriver: true,
      }),
    );

    animations.push(
      Animated.timing(rotate, {
        toValue: cfg.rotationDir * cfg.rotation,
        duration: cfg.duration,
        delay: cfg.delay,
        useNativeDriver: true,
      }),
    );

    animations.push(
      Animated.timing(scale, {
        toValue: cfg.scale * 1.15,
        duration: cfg.duration,
        delay: cfg.delay,
        useNativeDriver: true,
      }),
    );

    Animated.parallel(animations).start();

    if (onDone) {
      const total = cfg.delay + cfg.duration;
      const timer = setTimeout(() => { onDone(); }, total);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <Animated.Text
      style={[
        styles.particle,
        {
          transform: [
            { translateX },
            { translateY },
            { rotate: rotate.interpolate({ inputRange: [-40, 40], outputRange: ['-40deg', '40deg'] }) },
            { scale },
          ],
          opacity,
        },
      ]}
      pointerEvents="none"
    >
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
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const t1 = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, 200);
    const t2 = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, 450);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const particleCount = Math.min(14 + count * 6, 34);

  const particles: ParticleConfig[] = Array.from({ length: particleCount }, () => {
    const duration = randomBetween(1700, 2600);
    const delay = randomBetween(0, 550);
    return {
      emoji,
      startX: randomBetween(10, width - 46),
      startY: height - randomBetween(30, 160),
      driftX: randomBetween(-50, 50),
      driftY: -(height * randomBetween(0.6, 0.95)),
      rotation: randomBetween(15, 40),
      rotationDir: Math.random() > 0.5 ? 1 : -1,
      scale: Math.random() < 0.2 ? randomBetween(1.5, 2.0) : randomBetween(0.6, 1.5),
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
