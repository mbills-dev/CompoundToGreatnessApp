import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

const LIME = '#CCFF00';
const WHITE = '#FFFFFF';
const MUTED = '#8D8D8D';
const BG = '#050505';
const ROW_BG = '#191919';
const ROW_BORDER = 'rgba(255,255,255,0.07)';

const EASE_OUT = Easing.out(Easing.cubic);

type Props = {
  onContinue: () => void;
  onBack: () => void;
};

export default function InputsConceptScreen({ onContinue }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [brokenDown, setBrokenDown] = useState(false);

  const isSmall = width <= 375;
  const isNarrowHeight = height < 700;
  const headline1Size = isSmall ? 32 : 36;
  const headline2Size = isSmall ? 22 : 24;
  const goalTextSize = isSmall ? 16 : 17;
  const inputTextSize = isSmall ? 14 : 15;
  const stackLimeSize = isSmall ? 26 : 30;
  const rowHeight = isSmall ? 52 : 56;
  const rowGap = isSmall ? 7 : 8;

  // Phase 1 — auto-entrance
  const outcomeOpacity = useSharedValue(0);
  const outcomeTranslate = useSharedValue(0);
  const goalOpacity = useSharedValue(0);
  const goalTranslate = useSharedValue(0);
  const breakDownOpacity = useSharedValue(0);
  const breakDownPulse = useSharedValue(1);

  // Phase 2 — after tap
  const inputsOpacity = useSharedValue(0);
  const row1 = useSharedValue(0);
  const row2 = useSharedValue(0);
  const row3 = useSharedValue(0);
  const row4 = useSharedValue(0);
  const chk1 = useSharedValue(0);
  const chk2 = useSharedValue(0);
  const chk3 = useSharedValue(0);
  const chk4 = useSharedValue(0);
  const reverseOpacity = useSharedValue(0);
  const stackArrowOpacity = useSharedValue(0);
  const stackOpacity = useSharedValue(0);
  const stackGlow = useSharedValue(0);
  const ctaOpacity = useSharedValue(0);

  // Phase 1: auto-entrance on mount
  useEffect(() => {
    outcomeOpacity.value = withTiming(1, { duration: 450, easing: EASE_OUT });
    goalOpacity.value = withDelay(500, withTiming(1, { duration: 380, easing: EASE_OUT }));
    goalTranslate.value = withDelay(500, withTiming(0, { duration: 380, easing: EASE_OUT }));
    breakDownOpacity.value = withDelay(950, withTiming(1, { duration: 350, easing: EASE_OUT }));
    // Subtle slow vertical pulse on the break-down arrow
    breakDownPulse.value = withDelay(
      1300,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );

    return () => {
      outcomeOpacity.value = 0;
      outcomeTranslate.value = 0;
      goalOpacity.value = 0;
      goalTranslate.value = 16;
      breakDownOpacity.value = 0;
      breakDownPulse.value = 1;
      inputsOpacity.value = 0;
      reverseOpacity.value = 0;
      row1.value = row2.value = row3.value = row4.value = 0;
      chk1.value = chk2.value = chk3.value = chk4.value = 0;
      stackArrowOpacity.value = 0;
      stackOpacity.value = 0;
      stackGlow.value = 0;
      ctaOpacity.value = 0;
    };
  }, []);

  const handleBreakDown = useCallback(() => {
    if (brokenDown) return;
    setBrokenDown(true);

    // 1. Fade out outcome headline
    outcomeOpacity.value = withTiming(0, { duration: 380, easing: EASE_OUT });
    outcomeTranslate.value = withTiming(-16, { duration: 380, easing: EASE_OUT });

    // 2. Replace with inputs headline
    inputsOpacity.value = withDelay(300, withTiming(1, { duration: 400, easing: EASE_OUT }));

    // 3. Reveal reverse-engineer label, then inputs one at a time, 800ms apart
    const reverseT = 850;
    reverseOpacity.value = withDelay(reverseT, withTiming(1, { duration: 350, easing: EASE_OUT }));

    const t0 = reverseT + 450; // first input after reverse label settles
    const gap = 800;
    const rowDur = 380;

    row1.value = withDelay(t0, withTiming(1, { duration: rowDur, easing: EASE_OUT }));
    chk1.value = withDelay(t0 + 100, withTiming(1, { duration: 250, easing: EASE_OUT }));

    row2.value = withDelay(t0 + gap, withTiming(1, { duration: rowDur, easing: EASE_OUT }));
    chk2.value = withDelay(t0 + gap + 100, withTiming(1, { duration: 250, easing: EASE_OUT }));

    row3.value = withDelay(t0 + gap * 2, withTiming(1, { duration: rowDur, easing: EASE_OUT }));
    chk3.value = withDelay(t0 + gap * 2 + 100, withTiming(1, { duration: 250, easing: EASE_OUT }));

    row4.value = withDelay(t0 + gap * 3, withTiming(1, { duration: rowDur, easing: EASE_OUT }));
    chk4.value = withDelay(t0 + gap * 3 + 100, withTiming(1, { duration: 250, easing: EASE_OUT }));

    // 4. After input 04 + 900ms pause → arrow, then success stack
    const stackT = t0 + gap * 3 + 900;
    stackArrowOpacity.value = withDelay(stackT, withTiming(1, { duration: 300, easing: EASE_OUT }));
    stackOpacity.value = withDelay(stackT + 350, withTiming(1, { duration: 550, easing: EASE_OUT }));
    stackGlow.value = withDelay(stackT + 550, withTiming(1, { duration: 700, easing: EASE_OUT }));

    // 5. CTA emphasis after stack has fully appeared
    ctaOpacity.value = withDelay(stackT + 550 + 500, withTiming(1, { duration: 500, easing: EASE_OUT }));
  }, [brokenDown]);

  const outcomeStyle = useAnimatedStyle(() => ({
    opacity: outcomeOpacity.value,
    transform: [{ translateY: outcomeTranslate.value }],
  }));

  const inputsStyle = useAnimatedStyle(() => ({
    opacity: inputsOpacity.value,
    transform: [{ translateY: interpolate(inputsOpacity.value, [0, 1], [16, 0], Extrapolation.CLAMP) }],
  }));

  const goalStyle = useAnimatedStyle(() => ({
    opacity: goalOpacity.value,
    transform: [{ translateY: interpolate(goalOpacity.value, [0, 1], [14, 0], Extrapolation.CLAMP) }],
  }));

  const breakDownStyle = useAnimatedStyle(() => ({
    opacity: breakDownOpacity.value,
  }));

  const breakDownArrowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breakDownPulse.value, [0, 1], [0.45, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(breakDownPulse.value, [0, 1], [3, -3], Extrapolation.CLAMP) },
    ],
  }));

  const rowStyle = (sv: SharedValue<number>) =>
    useAnimatedStyle(() => ({
      opacity: sv.value,
      transform: [{ translateY: interpolate(sv.value, [0, 1], [10, 0], Extrapolation.CLAMP) }],
    }));

  const checkAnim = (sv: SharedValue<number>) =>
    useAnimatedStyle(() => ({
      opacity: sv.value,
      transform: [{ scale: interpolate(sv.value, [0, 1], [0.4, 1], Extrapolation.CLAMP) }],
    }));

  const reverseStyle = useAnimatedStyle(() => ({
    opacity: reverseOpacity.value,
  }));

  const stackArrowStyle = useAnimatedStyle(() => ({
    opacity: stackArrowOpacity.value,
  }));

  const stackStyle = useAnimatedStyle(() => ({
    opacity: stackOpacity.value,
    transform: [{ scale: interpolate(stackOpacity.value, [0, 1], [0.94, 1], Extrapolation.CLAMP) }],
  }));

  const stackBorderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(204,255,0,${interpolate(stackGlow.value, [0, 1], [0.15, 0.5], Extrapolation.CLAMP)})`,
    shadowColor: LIME,
    shadowOpacity: interpolate(stackGlow.value, [0, 1], [0, 0.15], Extrapolation.CLAMP),
    shadowRadius: interpolate(stackGlow.value, [0, 1], [0, 14], Extrapolation.CLAMP),
    shadowOffset: { width: 0, height: 0 },
  }));

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
  }));

  const rows = [
    { num: '01', text: '145g protein/day', style: rowStyle(row1), checkStyle: checkAnim(chk1) },
    { num: '02', text: '10,000 steps/day', style: rowStyle(row2), checkStyle: checkAnim(chk2) },
    { num: '03', text: '45 min strength training', style: rowStyle(row3), checkStyle: checkAnim(chk3) },
    { num: '04', text: 'Whole foods. No sugar.', style: rowStyle(row4), checkStyle: checkAnim(chk4) },
  ];

  const topPad = insets.top + (isNarrowHeight ? 16 : 24);
  const bottomPad = insets.bottom + 12;

  return (
    <View style={styles.container}>
      <View style={[styles.content, { paddingTop: topPad, paddingBottom: bottomPad }]}>
        {/* Headline region — both headlines share the same absolute space */}
        <View style={styles.headlineRegion}>
          <Animated.View style={[styles.headlineAbsolute, outcomeStyle]} pointerEvents="none">
            <Text style={[styles.headline1, { fontSize: headline1Size }]}>
              <Text style={styles.textWhite}>STOP FOCUSING{'\n'}ON THE OUTCOME.</Text>
            </Text>
          </Animated.View>

          <Animated.View style={[styles.headlineAbsolute, inputsStyle]} pointerEvents="none">
            <Text style={[styles.headline2, { fontSize: headline2Size }]}>
              <Text style={styles.textWhite}>FOCUS ON THE{'\n'}</Text>
              <Text style={styles.textLime}>INPUTS{'\n'}</Text>
              <Text style={styles.textWhite}>THAT CREATE IT.</Text>
            </Text>
          </Animated.View>
        </View>

        {/* Example area */}
        <View style={styles.exampleArea}>
          {/* Goal — always visible after entrance */}
          <Animated.View style={[styles.goalRow, goalStyle]}>
            <Text style={styles.goalLabel}>GOAL</Text>
            <Text style={[styles.goalText, { fontSize: goalTextSize }]}>LOSE 20 LBS.</Text>
          </Animated.View>

          {/* Break it down — tappable control (Phase 1) */}
          {!brokenDown && (
            <Animated.View style={[styles.breakDownWrap, breakDownStyle]}>
              <TouchableOpacity
                onPress={handleBreakDown}
                activeOpacity={0.7}
                style={styles.breakDownTouch}
              >
                <Animated.View style={breakDownArrowStyle}>
                  <Text style={styles.arrow}>↓</Text>
                </Animated.View>
                <Text style={styles.reverseLabel}>BREAK IT DOWN</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Reverse engineer label — Phase 2 */}
          {brokenDown && (
            <Animated.View style={[styles.reverseWrap, reverseStyle]}>
              <Text style={styles.arrow}>↓</Text>
              <Text style={styles.reverseLabel}>REVERSE ENGINEER</Text>
            </Animated.View>
          )}

          {/* Input rows — Phase 2 */}
          {brokenDown && (
            <View style={{ width: '100%', gap: rowGap, marginTop: 2 }}>
              {rows.map((item) => (
                <Animated.View key={item.num} style={[styles.inputRowCard, { height: rowHeight }, item.style]}>
                  <Text style={styles.inputNum}>{item.num}</Text>
                  <Text style={[styles.inputText, { fontSize: inputTextSize }]}>{item.text}</Text>
                  <Animated.View style={[styles.checkWrap, item.checkStyle]}>
                    <Text style={styles.checkMark}>✓</Text>
                  </Animated.View>
                </Animated.View>
              ))}
            </View>
          )}

          {/* Arrow to stack + Success Stack — Phase 2 */}
          {brokenDown && (
            <>
              <Animated.View style={[styles.stackArrowWrap, stackArrowStyle]}>
                <Text style={styles.arrow}>↓</Text>
              </Animated.View>

              <Animated.View style={[styles.stackCard, stackStyle, stackBorderStyle]}>
                <Text style={styles.stackMuted}>YOUR DAILY</Text>
                <Text style={[styles.stackLime, { fontSize: stackLimeSize }]}>SUCCESS STACK</Text>
              </Animated.View>
            </>
          )}
        </View>

        {/* Bottom area */}
        <View style={styles.bottomArea}>
          <View style={styles.progressWrap}>
            <View style={styles.progressDot} />
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <View style={styles.progressDot} />
          </View>

          <Animated.View style={[styles.ctaWrap, ctaStyle]}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onContinue}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryText}>Show me how →</Text>
            </TouchableOpacity>
          </Animated.View>
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
    paddingHorizontal: 26,
  },
  headlineRegion: {
    width: '100%',
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  headlineAbsolute: {
    position: 'absolute',
    alignItems: 'center',
  },
  headline1: {
    fontFamily: 'Inter-Black',
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: 0.3,
  },
  headline2: {
    fontFamily: 'Inter-Black',
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 30,
    letterSpacing: 0.2,
  },
  textWhite: {
    color: WHITE,
  },
  textLime: {
    color: LIME,
  },
  exampleArea: {
    flex: 1,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  goalRow: {
    alignItems: 'center',
  },
  goalLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 2.5,
    marginBottom: 2,
  },
  goalText: {
    fontFamily: 'Inter-Black',
    fontWeight: '900',
    color: WHITE,
    letterSpacing: 0.3,
  },
  breakDownWrap: {
    alignItems: 'center',
    marginTop: 12,
  },
  breakDownTouch: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 48,
  },
  reverseWrap: {
    alignItems: 'center',
    paddingVertical: 6,
    marginTop: 4,
  },
  arrow: {
    fontFamily: 'Inter-Black',
    fontSize: 18,
    color: MUTED,
    marginBottom: 2,
  },
  reverseLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 2.5,
  },
  inputRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ROW_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ROW_BORDER,
    paddingHorizontal: 16,
  },
  inputNum: {
    fontFamily: 'Inter-Black',
    fontSize: 12,
    fontWeight: '900',
    color: LIME,
    letterSpacing: 1,
    width: 28,
  },
  inputText: {
    flex: 1,
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
    color: WHITE,
    letterSpacing: 0.1,
  },
  checkWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: LIME,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontFamily: 'Inter-Black',
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
  },
  stackArrowWrap: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  stackCard: {
    width: '100%',
    backgroundColor: 'rgba(204,255,0,0.04)',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  stackMuted: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 2.5,
    marginBottom: 2,
  },
  stackLime: {
    fontFamily: 'Inter-Black',
    fontWeight: '900',
    color: LIME,
    letterSpacing: 0.3,
  },
  bottomArea: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    paddingTop: 8,
  },
  progressWrap: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 10,
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
  ctaWrap: {
    width: '100%',
  },
  primaryButton: {
    backgroundColor: LIME,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: 'Inter-Black',
    fontSize: 17,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.3,
  },
});
