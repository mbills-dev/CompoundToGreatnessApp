import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Zap } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

const STEPS = [
  'Identifying key dimensions',
  'Crafting your specific identity',
  'Preparing your success inputs',
];

export default function ProcessingScreen() {
  const { colors, isDark } = useTheme();
  const pulse = useSharedValue(1);
  const barWidths = STEPS.map(() => useSharedValue(0));

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    barWidths.forEach((bw, i) => {
      bw.value = withDelay(
        i * 600,
        withTiming(100, { duration: 1200, easing: Easing.bezierFn(0.25, 0.1, 0.25, 1) })
      );
    });
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Animated.View style={pulseStyle}>
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBadge}
          >
            <Zap size={40} color="#000000" strokeWidth={2.5} />
          </LinearGradient>
        </Animated.View>

        <Text style={[styles.title, { color: colors.text }]}>
          Analyzing{'\n'}Your Goal...
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          We're building your transformation roadmap.
        </Text>

        <View style={styles.steps}>
          {STEPS.map((step, i) => {
            const animWidth = useAnimatedStyle(() => ({
              width: `${barWidths[i].value}%`,
            }));

            return (
              <View key={i} style={styles.stepRow}>
                <View style={[styles.stepBar, { backgroundColor: isDark ? colors.backgroundSecondary : '#E0E0E0' }]}>
                  <Animated.View style={[styles.stepBarFill, { backgroundColor: colors.primary }, animWidth]} />
                </View>
                <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>{step}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
  },
  iconBadge: {
    width: 96,
    height: 96,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 42,
    letterSpacing: -0.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    marginBottom: 40,
    textAlign: 'center',
  },
  steps: {
    width: '100%',
    gap: 16,
  },
  stepRow: {
    gap: 8,
  },
  stepBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  stepBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
