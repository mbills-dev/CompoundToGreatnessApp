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

  // Responsive scaling
  const isSmall = width <= 375;
  const isNarrowHeight = height < 700;
  const headline1Size = isSmall ? 32 : 36;
  const headline2Size = isSmall ? 22 : 24;
  const goalTextSize = isSmall ? 16 : 17;
  const inputTextSize = isSmall ? 14 : 15;
  const stackLimeSize = isSmall ? 26 : 30;
  const rowHeight = isSmall ? 52 : 56;
  const rowGap = isSmall ? 7 : 8;

  // Phase 1: outcome headline (visible then fades up and out)
  const outcomeOpacity = useSharedValue(0);
  const outcomeTranslate = useSharedValue(0);

  // Phase 2: inputs headline
  const inputsOpacity = useSharedValue(0);
  const inputsTranslate = useSharedValue(0);

  // Goal card
  const goalOpacity = useSharedValue(0);
  const goalTranslate = useSharedValue(0);

  // Reverse arrow
  const reverseOpacity = useSharedValue(0);

  // Input rows
  const row1 = useSharedValue(0);
  const row2 = useSharedValue(0);
  const row3 = useSharedValue(0);
  const row4 = useSharedValue(0);
  const chk1 = useSharedValue(0);
  const chk2 = useSharedValue(0);
  const chk3 = useSharedValue(0);
  const chk4 = useSharedValue(0);

  // Success stack
  const stackOpacity = useSharedValue(0);
  const stackGlow = useSharedValue(0);

  // CTA emphasis
  const ctaOpacity = useSharedValue(0.4);

  // Down arrow to stack
  const stackArrowOpacity = useSharedValue(0);

  useEffect(() => {
    // Timeline (ms):
    // 0     — outcome headline fades in
    // 900   — hold done, start fade out + translate up
    // 1400  — inputs headline fades in + slides up
    // 2100  — goal appears
    // 2550  — reverse arrow appears
    // 2900  — input 01
    // 3150  — input 02
    // 3400  — input 03
    // 3650  — input 04
    // 3950  — success stack
    // 4200  — CTA emphasis

    // Outcome: fade in at 0, fade out at 900
    outcomeOpacity.value = withTiming(1, { duration: 400, easing: EASE_OUT });
    outcomeTranslate.value = withDelay(900, withTiming(-20, { duration: 420, easing: EASE_OUT }));
    outcomeOpacity.value = withDelay(900, withTiming(0, { duration: 420, easing: EASE_OUT }));

    // Inputs: fade in at 1400
    inputsOpacity.value = withDelay(1400, withTiming(1, { duration: 400, easing: EASE_OUT }));
    inputsTranslate.value = withDelay(1400, withTiming(0, { duration: 400, easing: EASE_OUT }));

    // Goal
    goalOpacity.value = withDelay(2100, withTiming(1, { duration: 380, easing: EASE_OUT }));
    goalTranslate.value = withDelay(2100, withTiming(0, { duration: 380, easing: EASE_OUT }));

    // Reverse arrow
    reverseOpacity.value = withDelay(2550, withTiming(1, { duration: 350, easing: EASE_OUT }));

    // Input rows — 250ms apart
    row1.value = withDelay(2900, withTiming(1, { duration: 300, easing: EASE_OUT }));
    chk1.value = withDelay(3150, withTiming(1, { duration: 250, easing: EASE_OUT }));
    row2.value = withDelay(3150, withTiming(1, { duration: 300, easing: EASE_OUT }));
    chk2.value = withDelay(3400, withTiming(1, { duration: 250, easing: EASE_OUT }));
    row3.value = withDelay(3400, withTiming(1, { duration: 300, easing: EASE_OUT }));
    chk3.value = withDelay(3650, withTiming(1, { duration: 250, easing: EASE_OUT }));
    row4.value = withDelay(3650, withTiming(1, { duration: 300, easing: EASE_OUT }));
    chk4.value = withDelay(3900, withTiming(1, { duration: 250, easing: EASE_OUT }));

    // Stack arrow + stack
    stackArrowOpacity.value = withDelay(3950, withTiming(1, { duration: 300, easing: EASE_OUT }));
    stackOpacity.value = withDelay(4100, withTiming(1, { duration: 500, easing: EASE_OUT }));
    stackGlow.value = withDelay(4300, withTiming(1, { duration: 700, easing: EASE_OUT }));

    // CTA emphasis
    ctaOpacity.value = withDelay(4400, withTiming(1, { duration: 500, easing: EASE_OUT }));

    return () => {
      // Reset on unmount so re-entry replays
      outcomeOpacity.value = 0;
        outcomeTranslate.value = 0;
        inputsOpacity.value = 0;
        inputsTranslate.value = 20;
        goalOpacity.value = 0;
        goalTranslate.value = 16;
        reverseOpacity.value = 0;
        row1.value = row2.value = row3.value = row4.value = 0;
        chk1.value = chk2.value = chk3.value = chk4.value = 0;
        stackOpacity.value = 0;
        stackGlow.value = 0;
        stackArrowOpacity.value = 0;
      ctaOpacity.value = 0.4;
    };
  }, []);

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

  const reverseStyle = useAnimatedStyle(() => ({
    opacity: reverseOpacity.value,
  }));

  const rowStyle = (sv: SharedValue<number>) =>
    useAnimatedStyle(() => ({
      opacity: sv.value,
      transform: [{ translateX: interpolate(sv.value, [0, 1], [-12, 0], Extrapolation.CLAMP) }],
    }));

  const checkAnim = (sv: SharedValue<number>) =>
    useAnimatedStyle(() => ({
      opacity: sv.value,
      transform: [{ scale: interpolate(sv.value, [0, 1], [0.4, 1], Extrapolation.CLAMP) }],
    }));

  const stackArrowStyle = useAnimatedStyle(() => ({
    opacity: stackArrowOpacity.value,
  }));

  const stackStyle = useAnimatedStyle(() => ({
    opacity: stackOpacity.value,
    transform: [{ scale: interpolate(stackOpacity.value, [0, 1], [0.95, 1], Extrapolation.CLAMP) }],
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
    { num: '01', text: '145g protein/day', sv: row1, check: chk1, style: rowStyle(row1), checkStyle: checkAnim(chk1) },
    { num: '02', text: '10,000 steps/day', sv: row2, check: chk2, style: rowStyle(row2), checkStyle: checkAnim(chk2) },
    { num: '03', text: '45 min strength training', sv: row3, check: chk3, style: rowStyle(row3), checkStyle: checkAnim(chk3) },
    { num: '04', text: 'Whole foods. No sugar.', sv: row4, check: chk4, style: rowStyle(row4), checkStyle: checkAnim(chk4) },
  ];

  // Layout: [headline region — overlapping] [example — flex:1] [progress + CTA — fixed bottom]
  const topPad = insets.top + (isNarrowHeight ? 16 : 24);
  const bottomPad = insets.bottom + 12;

  return (
    <View style={styles.container}>
      <View style={[styles.content, { paddingTop: topPad, paddingBottom: bottomPad }]}>
        {/* Headline region — both headlines occupy same space via absolute positioning */}
        <View style={styles.headlineRegion}>
          <Animated.View style={[styles.headlineAbsolute, outcomeStyle]} pointerEvents="none">
            <Text style={[styles.headline1, { fontSize: headline1Size }]}>
              <Text style={styles.textWhite}>STOP FOCUSING{'\n'}ON THE OUTCOME.</Text>
            </Text>
          </Animated.View>

          <Animated.View style={[styles.headlineAbsolute, inputsStyle]}>
            <Text style={[styles.headline2, { fontSize: headline2Size }]}>
              <Text style={styles.textWhite}>FOCUS ON THE{'\n'}</Text>
              <Text style={styles.textLime}>INPUTS{'\n'}</Text>
              <Text style={styles.textWhite}>THAT CREATE IT.</Text>
            </Text>
          </Animated.View>
        </View>

        {/* Example area — flex:1, grows to fill available space */}
        <View style={styles.exampleArea}>
          {/* Goal */}
          <Animated.View style={[styles.goalRow, goalStyle]}>
            <Text style={styles.goalLabel}>GOAL</Text>
            <Text style={[styles.goalText, { fontSize: goalTextSize }]}>LOSE 20 LBS.</Text>
          </Animated.View>

          {/* Reverse arrow */}
          <Animated.View style={[styles.reverseWrap, reverseStyle]}>
            <Text style={styles.arrow}>↓</Text>
            <Text style={styles.reverseLabel}>REVERSE ENGINEER</Text>
          </Animated.View>

          {/* Input rows */}
          <View style={{ width: '100%', gap: rowGap }}>
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

          {/* Arrow to stack */}
          <Animated.View style={[styles.stackArrowWrap, stackArrowStyle]}>
            <Text style={styles.arrow}>↓</Text>
          </Animated.View>

          {/* Success Stack */}
          <Animated.View style={[styles.stackCard, stackStyle, stackBorderStyle]}>
            <Text style={styles.stackMuted}>YOUR DAILY</Text>
            <Text style={[styles.stackLime, { fontSize: stackLimeSize }]}>SUCCESS STACK</Text>
          </Animated.View>
        </View>

        {/* Bottom area — progress dots + CTA in dedicated layout space */}
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
  // Headline region — fixed height, both headlines absolute-positioned inside
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
  // Example area
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
  reverseWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  arrow: {
    fontFamily: 'Inter-Black',
    fontSize: 16,
    color: MUTED,
    marginBottom: 1,
  },
  reverseLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 9,
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
  // Bottom area
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
