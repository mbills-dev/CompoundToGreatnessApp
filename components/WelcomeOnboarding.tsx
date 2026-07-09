import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

interface WelcomeOnboardingProps {
  onComplete: () => void;
}

const LINES = [
  'Most people set goals.',
  'Few become the person\nwho achieves them.',
  "This app doesn't track\nyour goals.",
  'It builds the person who\nmakes them inevitable.',
];

export default function WelcomeOnboarding({ onComplete }: WelcomeOnboardingProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();

  const line0Opacity = useSharedValue(0);
  const line0Y = useSharedValue(24);
  const line1Opacity = useSharedValue(0);
  const line1Y = useSharedValue(24);
  const line2Opacity = useSharedValue(0);
  const line2Y = useSharedValue(24);
  const line3Opacity = useSharedValue(0);
  const line3Y = useSharedValue(24);
  const buttonOpacity = useSharedValue(0);
  const buttonY = useSharedValue(24);

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    const dur = 550;

    line0Opacity.value = withDelay(100, withTiming(1, { duration: dur, easing: ease }));
    line0Y.value = withDelay(100, withTiming(0, { duration: dur, easing: ease }));

    line1Opacity.value = withDelay(450, withTiming(1, { duration: dur, easing: ease }));
    line1Y.value = withDelay(450, withTiming(0, { duration: dur, easing: ease }));

    line2Opacity.value = withDelay(800, withTiming(1, { duration: dur, easing: ease }));
    line2Y.value = withDelay(800, withTiming(0, { duration: dur, easing: ease }));

    line3Opacity.value = withDelay(1150, withTiming(1, { duration: dur, easing: ease }));
    line3Y.value = withDelay(1150, withTiming(0, { duration: dur, easing: ease }));

    buttonOpacity.value = withDelay(1700, withTiming(1, { duration: 600, easing: ease }));
    buttonY.value = withDelay(1700, withTiming(0, { duration: 600, easing: ease }));
  }, []);

  const makeLineStyle = (opacity: Animated.SharedValue<number>, y: Animated.SharedValue<number>) =>
    useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ translateY: y.value }],
    }));

  const l0Style = makeLineStyle(line0Opacity, line0Y);
  const l1Style = makeLineStyle(line1Opacity, line1Y);
  const l2Style = makeLineStyle(line2Opacity, line2Y);
  const l3Style = makeLineStyle(line3Opacity, line3Y);
  const btnStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonY.value }],
  }));

  const textColor = colors.text;
  const mutedColor = colors.textSecondary;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={isDark ? ['#000000', '#050505', '#000000'] : ['#F5F5F0', '#F0F0EB', '#F5F5F0']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.lines}>
            <Animated.Text style={[styles.line, styles.lineMuted, { color: mutedColor }, l0Style]}>
              {LINES[0]}
            </Animated.Text>
            <Animated.Text style={[styles.line, { color: textColor }, l1Style]}>
              {LINES[1]}
            </Animated.Text>
            <Animated.Text style={[styles.line, styles.lineMuted, { color: mutedColor }, l2Style]}>
              {LINES[2]}
            </Animated.Text>
            <Animated.Text style={[styles.line, styles.lineAccent, { color: textColor }, l3Style]}>
              {LINES[3]}
            </Animated.Text>
          </View>
        </View>

        <Animated.View style={[styles.footer, btnStyle]}>
          <TouchableOpacity
            style={styles.button}
            onPress={onComplete}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDark ?? colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>COMPOUND TO GREATNESS</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  lines: {
    gap: 28,
  },
  line: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  lineMuted: {
    fontWeight: '500',
    opacity: 0.5,
  },
  lineAccent: {
    fontWeight: '900',
    fontSize: 28,
    lineHeight: 36,
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 56,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 2,
  },
});
