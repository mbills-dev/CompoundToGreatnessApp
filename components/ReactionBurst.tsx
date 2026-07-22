import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

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

    animations.push(
      Animated.sequence([
        Animated.delay(cfg.delay),
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: cfg.duration - 150, useNativeDriver: true }),
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
            { rotate: rotate.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) },
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
      scale: randomBetween(0.8, 1.3),
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
