import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { ArrowLeft, ArrowRight, Zap, ListFilter as Filter, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import styles from './styles';

// ─── WelcomeScreens ───────────────────────────────────────────────────────────

const WELCOME_SCREENS = [
  {
    icon: 'flame' as const,
    headline: 'Welcome to\nCompound to\nGreatness.',
    body: "Goals don't make you great — daily inputs do. Small actions, repeated daily, compound into outcomes that feel inevitable.",
    cta: 'Continue →',
  },
  {
    icon: 'compass' as const,
    headline: "Here's what\nwe'll build.",
    body: "In the next few minutes you'll name your goals, reverse engineer each one into a single daily number, and build the compass that guides every decision.",
    cta: 'Continue →',
  },
  {
    icon: 'trophy' as const,
    headline: 'Then you\ncommit.',
    body: "You'll sign your name to your daily inputs and show up for 77 days. Miss a day, and you start over from Day 1. That's what makes finishing mean something.",
    cta: "Let's Go →",
  },
] as const;

function WelcomeIconTile({ icon, colors, isDark }: { icon: 'flame' | 'compass' | 'trophy'; colors: any; isDark: boolean }) {
  const scale = useSharedValue(0);
  const rotation = useSharedValue(-15);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 10, stiffness: 180, mass: 0.8 });
    rotation.value = withSpring(0, { damping: 12, stiffness: 200 });
  }, [icon]);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));
  return (
    <Animated.View
      style={[
        iconStyle,
        {
          width: 56,
          height: 56,
          borderRadius: 16,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'flex-start',
        },
      ]}
    >
      {icon === 'flame' && <Zap size={28} color="#000" strokeWidth={2.5} />}
      {icon === 'compass' && <Filter size={28} color="#000" strokeWidth={2.5} />}
      {icon === 'trophy' && <Sparkles size={28} color="#000" strokeWidth={2.5} />}
    </Animated.View>
  );
}

export function WelcomeSeriesScreen({
  screen,
  onNext,
  onBack,
}: {
  screen: 0 | 1 | 2;
  onNext: () => void;
  onBack?: () => void;
}) {
  const { colors, isDark } = useTheme();
  const data = WELCOME_SCREENS[screen];

  const headlineY = useSharedValue(24);
  const headlineOp = useSharedValue(0);
  const bodyY = useSharedValue(24);
  const bodyOp = useSharedValue(0);
  const ctaOp = useSharedValue(0);

  useEffect(() => {
    headlineY.value = 24;
    headlineOp.value = 0;
    bodyY.value = 24;
    bodyOp.value = 0;
    ctaOp.value = 0;

    headlineY.value = withDelay(120, withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) }));
    headlineOp.value = withDelay(120, withTiming(1, { duration: 320 }));
    bodyY.value = withDelay(240, withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) }));
    bodyOp.value = withDelay(240, withTiming(1, { duration: 320 }));
    ctaOp.value = withDelay(400, withTiming(1, { duration: 280 }));
  }, [screen]);

  const headlineStyle = useAnimatedStyle(() => ({
    opacity: headlineOp.value,
    transform: [{ translateY: headlineY.value }],
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: bodyOp.value,
    transform: [{ translateY: bodyY.value }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaOp.value }));

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, flex: 1 }]}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={[styles.backBtn, { marginBottom: 32 }]}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
      ) : (
        <View style={{ height: 52 }} />
      )}

      <WelcomeIconTile icon={data.icon} colors={colors} isDark={isDark} />

      <Animated.Text style={[styles.heroTitle, headlineStyle, { color: colors.text, marginTop: 28, marginBottom: 16 }]}>
        {data.headline}
      </Animated.Text>

      <Animated.Text style={[styles.heroSubtitle, bodyStyle, { color: colors.textSecondary, lineHeight: 26 }]}>
        {data.body}
      </Animated.Text>

      <View style={{ flex: 1 }} />

      <View style={styles.welcomeDots}>
        {WELCOME_SCREENS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.welcomeDot,
              {
                backgroundColor: i === screen ? colors.primary : (isDark ? '#333' : '#D0D0D0'),
                width: i === screen ? 20 : 8,
              },
            ]}
          />
        ))}
      </View>

      <Animated.View style={[ctaStyle, { marginTop: 20, marginBottom: 8 }]}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={onNext}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>{data.cta}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
