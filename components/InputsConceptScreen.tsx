import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

const LIME = '#CCFF00';
const WHITE = '#FFFFFF';
const MUTED = '#8D8D8D';
const BG = '#050505';
const CARD_BG = '#0E0E0E';
const CARD_BORDER = 'rgba(255,255,255,0.08)';

const EASE_OUT = Easing.out(Easing.cubic);
const DURATION = 520;

type Props = {
  onContinue: () => void;
  onBack: () => void;
};

export default function InputsConceptScreen({ onContinue }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Responsive scaling
  const isSmall = width <= 375;
  const headlineSize = isSmall ? 30 : 34;
  const goalSize = isSmall ? 17 : 18;
  const inputSize = isSmall ? 15 : 16;
  const stackSize = isSmall ? 36 : 40;
  const spacing = isSmall ? 10 : 14;
  const cardGap = isSmall ? 8 : 10;

  // Animation progress values (0 → 1)
  const goalProgress = useSharedValue(0);
  const arrowProgress = useSharedValue(0);
  const input1 = useSharedValue(0);
  const input2 = useSharedValue(0);
  const input3 = useSharedValue(0);
  const input4 = useSharedValue(0);
  const check1 = useSharedValue(0);
  const check2 = useSharedValue(0);
  const check3 = useSharedValue(0);
  const check4 = useSharedValue(0);
  const stackProgress = useSharedValue(0);
  const stackGlow = useSharedValue(0);
  const ctaEmphasis = useSharedValue(0);

  useEffect(() => {
    goalProgress.value = withDelay(350, withTiming(1, { duration: DURATION, easing: EASE_OUT }));
    arrowProgress.value = withDelay(850, withTiming(1, { duration: DURATION, easing: EASE_OUT }));
    input1.value = withDelay(1250, withTiming(1, { duration: DURATION, easing: EASE_OUT }));
    check1.value = withDelay(1550, withTiming(1, { duration: 300, easing: EASE_OUT }));
    input2.value = withDelay(1600, withTiming(1, { duration: DURATION, easing: EASE_OUT }));
    check2.value = withDelay(1900, withTiming(1, { duration: 300, easing: EASE_OUT }));
    input3.value = withDelay(1950, withTiming(1, { duration: DURATION, easing: EASE_OUT }));
    check3.value = withDelay(2250, withTiming(1, { duration: 300, easing: EASE_OUT }));
    input4.value = withDelay(2300, withTiming(1, { duration: DURATION, easing: EASE_OUT }));
    check4.value = withDelay(2600, withTiming(1, { duration: 300, easing: EASE_OUT }));
    stackProgress.value = withDelay(2750, withTiming(1, { duration: 640, easing: EASE_OUT }));
    stackGlow.value = withDelay(2900, withTiming(1, { duration: 800, easing: EASE_OUT }));
    ctaEmphasis.value = withDelay(3100, withTiming(1, { duration: 500, easing: EASE_OUT }));
  }, []);

  const fadeSlide = (progress: SharedValue<number>) =>
    useAnimatedStyle(() => ({
      opacity: progress.value,
      transform: [
        {
          translateY: interpolate(progress.value, [0, 1], [18, 0], Extrapolation.CLAMP),
        },
      ],
    }));

  const goalStyle = fadeSlide(goalProgress);
  const arrowStyle = fadeSlide(arrowProgress);
  const input1Style = fadeSlide(input1);
  const input2Style = fadeSlide(input2);
  const input3Style = fadeSlide(input3);
  const input4Style = fadeSlide(input4);

  const stackStyle = useAnimatedStyle(() => ({
    opacity: stackProgress.value,
    transform: [{ scale: interpolate(stackProgress.value, [0, 1], [0.94, 1], Extrapolation.CLAMP) }],
  }));

  const stackBorderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(204,255,0,${interpolate(stackGlow.value, [0, 1], [0.12, 0.55], Extrapolation.CLAMP)})`,
    shadowColor: LIME,
    shadowOpacity: interpolate(stackGlow.value, [0, 1], [0, 0.18], Extrapolation.CLAMP),
    shadowRadius: interpolate(stackGlow.value, [0, 1], [0, 18], Extrapolation.CLAMP),
    shadowOffset: { width: 0, height: 0 },
  }));

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ctaEmphasis.value, [0, 1], [0.5, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(ctaEmphasis.value, [0, 1], [0.97, 1], Extrapolation.CLAMP) }],
  }));

  const checkStyle = (val: SharedValue<number>) =>
    useAnimatedStyle(() => ({
      opacity: val.value,
      transform: [{ scale: interpolate(val.value, [0, 1], [0.5, 1], Extrapolation.CLAMP) }],
    }));

  const inputs = [
    { num: '01', text: '145 g of protein a day', style: input1Style, check: check1, checkStyle: checkStyle(check1) },
    { num: '02', text: '10,000 steps a day', style: input2Style, check: check2, checkStyle: checkStyle(check2) },
    { num: '03', text: '45 minutes of strength training', style: input3Style, check: check3, checkStyle: checkStyle(check3) },
    { num: '04', text: 'Whole foods. No sugar.', style: input4Style, check: check4, checkStyle: checkStyle(check4) },
  ];

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 40,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        {/* Headline */}
        <View style={styles.headlineWrap}>
          <Text style={[styles.headline, { fontSize: headlineSize }]}>
            <Text style={styles.headlineWhite}>STOP FOCUSING{'\n'}ON THE OUTCOMES.{'\n\n'}</Text>
            <Text style={styles.headlineWhite}>FOCUS ON THE </Text>
            <Text style={styles.headlineLime}>INPUTS{'\n'}</Text>
            <Text style={styles.headlineWhite}>THAT CREATE THEM.</Text>
          </Text>
        </View>

        {/* Animated example */}
        <View style={styles.exampleArea}>
          {/* Goal card */}
          <Animated.View style={[styles.goalCard, goalStyle]}>
            <Text style={styles.goalLabel}>GOAL</Text>
            <Text style={[styles.goalText, { fontSize: goalSize }]}>LOSE 20 LBS.</Text>
          </Animated.View>

          {/* Arrow + label */}
          <Animated.View style={[styles.arrowWrap, arrowStyle]}>
            <Text style={styles.arrow}>↓</Text>
            <Text style={styles.arrowLabel}>REVERSE ENGINEER THE OUTCOME</Text>
          </Animated.View>

          {/* Input cards */}
          <View style={{ gap: cardGap, width: '100%' }}>
            {inputs.map((item) => (
              <Animated.View key={item.num} style={[styles.inputCard, item.style]}>
                <View style={styles.inputRow}>
                  <Text style={styles.inputNum}>{item.num}</Text>
                  <Text style={[styles.inputText, { fontSize: inputSize }]}>{item.text}</Text>
                  <Animated.View style={[styles.checkWrap, item.checkStyle]}>
                    <Text style={styles.checkMark}>✓</Text>
                  </Animated.View>
                </View>
              </Animated.View>
            ))}
          </View>

          {/* Arrow down to stack */}
          <Animated.View style={[styles.arrowWrap, stackStyle]}>
            <Text style={styles.arrow}>↓</Text>
          </Animated.View>

          {/* Success Stack */}
          <Animated.View style={[styles.stackCard, stackStyle, stackBorderStyle]}>
            <Text style={[styles.stackHeadline, { fontSize: stackSize }]}>
              <Text style={styles.stackWhite}>YOUR DAILY{'\n'}</Text>
              <Text style={styles.stackLime}>SUCCESS STACK</Text>
            </Text>
          </Animated.View>
        </View>

        {/* CTA */}
        <Animated.View style={[styles.ctaWrap, ctaStyle]}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryText}>Show me how →</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Progress indicator */}
        <View style={styles.progressWrap}>
          <View style={styles.progressDot} />
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={styles.progressDot} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  headlineWrap: {
    alignItems: 'center',
    marginBottom: 30,
  },
  headline: {
    fontFamily: 'Inter-Black',
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 38,
    letterSpacing: 0.3,
  },
  headlineWhite: {
    color: WHITE,
  },
  headlineLime: {
    color: LIME,
  },
  exampleArea: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    flex: 1,
  },
  goalCard: {
    width: '100%',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingHorizontal: 22,
    paddingVertical: 16,
    alignItems: 'center',
  },
  goalLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 2,
    marginBottom: 4,
  },
  goalText: {
    fontFamily: 'Inter-Black',
    fontWeight: '900',
    color: WHITE,
    letterSpacing: 0.3,
  },
  arrowWrap: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  arrow: {
    fontFamily: 'Inter-Black',
    fontSize: 20,
    color: MUTED,
    marginBottom: 2,
  },
  arrowLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 2.5,
  },
  inputCard: {
    width: '100%',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputNum: {
    fontFamily: 'Inter-Black',
    fontSize: 13,
    fontWeight: '900',
    color: LIME,
    letterSpacing: 1,
    width: 32,
  },
  inputText: {
    flex: 1,
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
    color: WHITE,
    letterSpacing: 0.2,
  },
  checkWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: LIME,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontFamily: 'Inter-Black',
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },
  stackCard: {
    width: '100%',
    backgroundColor: 'rgba(204,255,0,0.04)',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
  },
  stackHeadline: {
    fontFamily: 'Inter-Black',
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: 0.3,
  },
  stackWhite: {
    color: WHITE,
  },
  stackLime: {
    color: LIME,
  },
  ctaWrap: {
    width: '100%',
    maxWidth: 440,
    marginTop: 18,
  },
  primaryButton: {
    backgroundColor: LIME,
    height: 62,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: 'Inter-Black',
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.3,
  },
  progressWrap: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 18,
    alignItems: 'center',
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  progressDotActive: {
    backgroundColor: LIME,
  },
});
