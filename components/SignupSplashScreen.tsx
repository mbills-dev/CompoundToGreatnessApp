import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FONT_SIZE = Math.min(SCREEN_WIDTH * 0.18, 76);

interface Props {
  onComplete: () => void;
}

export default function SignupSplashScreen({ onComplete }: Props) {
  const { colors } = useTheme();

  const screenOpacity = useSharedValue(0);
  const line1Opacity = useSharedValue(0);
  const line1Y = useSharedValue(-40);
  const makeOpacity = useSharedValue(0);
  const makeY = useSharedValue(60);
  const itOpacity = useSharedValue(0);
  const itY = useSharedValue(60);
  const countOpacity = useSharedValue(0);
  const countY = useSharedValue(60);

  useEffect(() => {
    screenOpacity.value = withSequence(
      withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) }),
      withDelay(2800, withTiming(0, { duration: 700, easing: Easing.in(Easing.ease) }, (finished) => {
        if (finished) runOnJS(onComplete)();
      }))
    );

    line1Opacity.value = withDelay(200, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
    line1Y.value = withDelay(200, withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }));

    makeOpacity.value = withDelay(900, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
    makeY.value = withDelay(900, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));

    itOpacity.value = withDelay(1100, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
    itY.value = withDelay(1100, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));

    countOpacity.value = withDelay(1300, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
    countY.value = withDelay(1300, withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, []);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));
  const line1Style = useAnimatedStyle(() => ({
    opacity: line1Opacity.value,
    transform: [{ translateY: line1Y.value }],
  }));
  const makeStyle = useAnimatedStyle(() => ({
    opacity: makeOpacity.value,
    transform: [{ translateY: makeY.value }],
  }));
  const itStyle = useAnimatedStyle(() => ({
    opacity: itOpacity.value,
    transform: [{ translateY: itY.value }],
  }));
  const countStyle = useAnimatedStyle(() => ({
    opacity: countOpacity.value,
    transform: [{ translateY: countY.value }],
  }));

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.primary }, screenStyle]}>
      <View style={styles.topThird}>
        <Animated.Text style={[styles.headline, line1Style]}>
          YOUR LIFE{'\n'}MATTERS
        </Animated.Text>
      </View>

      <View style={styles.bottomThird}>
        <Animated.Text style={[styles.headline, makeStyle]}>MAKE</Animated.Text>
        <Animated.Text style={[styles.headline, itStyle]}>IT</Animated.Text>
        <Animated.Text style={[styles.headline, countStyle]}>COUNT</Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    flexDirection: 'column',
  },
  topThird: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 28,
    paddingTop: SCREEN_HEIGHT * 0.04,
  },
  bottomThird: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 28,
    paddingBottom: 0,
  },
  headline: {
    fontFamily: 'Inter-Black',
    fontSize: FONT_SIZE,
    fontWeight: '900',
    color: '#000000',
    lineHeight: FONT_SIZE * 1.0,
    letterSpacing: -2,
  },
});
