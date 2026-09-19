import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
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
  runOnJS,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

const LIME = '#CCFF00';
const WHITE = '#FFFFFF';
const MUTED = '#8D8D8F';
const BG = '#050505';
const GOAL_BG = '#111111';
const ROW_BG = '#191919';
const ROW_BORDER = 'rgba(255,255,255,0.07)';

const EASE_OUT = Easing.out(Easing.cubic);

type Props = {
  index: number;
  isActive: boolean;
  onCompleted: () => void;
  swipeProgress: SharedValue<number>;
  pageWidth: number;
};

export default function Example2Card({ index, isActive, onCompleted, pageWidth }: Props) {
  const { width, height } = useWindowDimensions();
  const [brokenDown, setBrokenDown] = useState(false);
  const completedRef = useRef(false);

  const isSmall = width <= 375;
  const headline1Size = isSmall ? 30 : 34;
  const headline2Size = isSmall ? 20 : 22;
  const goalTextSize = isSmall ? 16 : 18;
  const inputTextSize = isSmall ? 14 : 15;
  const stackLimeSize = isSmall ? 26 : 30;
  const rowHeight = isSmall ? 50 : 54;

  const outcomeH = isSmall ? 88 : 94;
  const inputsH = isSmall ? 88 : 94;

  // Phase 1 — auto-entrance
  const outcomeOpacity = useSharedValue(0);
  const outcomeTranslateY = useSharedValue(0);
  const outcomeWrapH = useSharedValue(outcomeH);
  const goalOpacity = useSharedValue(0);
  const goalEntranceY = useSharedValue(14);
  const breakDownOpacity = useSharedValue(0);
  const breakDownPulse = useSharedValue(1);

  // Phase 2 — after tap
  const inputsOpacity = useSharedValue(0);
  const inputsWrapH = useSharedValue(0);
  const row1 = useSharedValue(0);
  const row2 = useSharedValue(0);
  const row3 = useSharedValue(0);
  const row4 = useSharedValue(0);
  const reverseOpacity = useSharedValue(0);
  const stackArrowOpacity = useSharedValue(0);
  const stackOpacity = useSharedValue(0);
  const stackGlow = useSharedValue(0);
  const finalRowOpacity = useSharedValue(0);
  const finalCheckOpacity = useSharedValue(0);

  useEffect(() => {
    if (index === 0 && isActive) {
      outcomeOpacity.value = withTiming(1, { duration: 450, easing: EASE_OUT });
      goalOpacity.value = withDelay(550, withTiming(1, { duration: 380, easing: EASE_OUT }));
      goalEntranceY.value = withDelay(550, withTiming(0, { duration: 380, easing: EASE_OUT }));
      breakDownOpacity.value = withDelay(1000, withTiming(1, { duration: 350, easing: EASE_OUT }));
      breakDownPulse.value = withDelay(
        1350,
        withRepeat(
          withSequence(
            withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        ),
      );
    }

    return () => {
      outcomeOpacity.value = 0;
      outcomeTranslateY.value = 0;
      outcomeWrapH.value = outcomeH;
      goalOpacity.value = 0;
      goalEntranceY.value = 14;
      breakDownOpacity.value = 0;
      breakDownPulse.value = 1;
      inputsOpacity.value = 0;
      inputsWrapH.value = 0;
      reverseOpacity.value = 0;
      row1.value = row2.value = row3.value = row4.value = 0;
      stackArrowOpacity.value = 0;
      stackOpacity.value = 0;
      stackGlow.value = 0;
      finalRowOpacity.value = 0;
      finalCheckOpacity.value = 0;
    };
  }, [index]);

  useEffect(() => {
    if (isActive && !brokenDown && outcomeOpacity.value === 0 && index > 0) {
      outcomeOpacity.value = withTiming(1, { duration: 450, easing: EASE_OUT });
      goalOpacity.value = withDelay(200, withTiming(1, { duration: 380, easing: EASE_OUT }));
      goalEntranceY.value = withDelay(200, withTiming(0, { duration: 380, easing: EASE_OUT }));
      breakDownOpacity.value = withDelay(650, withTiming(1, { duration: 350, easing: EASE_OUT }));
      breakDownPulse.value = withDelay(
        1000,
        withRepeat(
          withSequence(
            withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        ),
      );
    }
  }, [isActive]);

  const handleBreakDown = useCallback(() => {
    if (brokenDown) return;
    setBrokenDown(true);

    outcomeOpacity.value = withTiming(0, { duration: 400, easing: EASE_OUT });
    outcomeTranslateY.value = withTiming(-50, { duration: 400, easing: EASE_OUT });
    outcomeWrapH.value = withTiming(0, { duration: 400, easing: EASE_OUT });

    inputsWrapH.value = withDelay(300, withTiming(inputsH, { duration: 400, easing: EASE_OUT }));
    inputsOpacity.value = withDelay(300, withTiming(1, { duration: 400, easing: EASE_OUT }));

    const reverseT = 750;
    reverseOpacity.value = withDelay(reverseT, withTiming(1, { duration: 350, easing: EASE_OUT }));

    const t0 = reverseT + 250;
    const gap = 350;
    const rowDur = 350;

    row1.value = withDelay(t0, withTiming(1, { duration: rowDur, easing: EASE_OUT }));
    row2.value = withDelay(t0 + gap, withTiming(1, { duration: rowDur, easing: EASE_OUT }));
    row3.value = withDelay(t0 + gap * 2, withTiming(1, { duration: rowDur, easing: EASE_OUT }));
    row4.value = withDelay(t0 + gap * 3, withTiming(1, { duration: rowDur, easing: EASE_OUT }));

    const input4Settle = t0 + gap * 3 + rowDur;
    const stackT = input4Settle + 650;
    stackArrowOpacity.value = withDelay(stackT, withTiming(1, { duration: 300, easing: EASE_OUT }));
    stackOpacity.value = withDelay(stackT + 300, withTiming(1, { duration: 550, easing: EASE_OUT }));
    stackGlow.value = withDelay(stackT + 500, withTiming(1, { duration: 700, easing: EASE_OUT }));

    const finalRowT = stackT + 850;
    finalRowOpacity.value = withDelay(finalRowT, withTiming(1, { duration: 350, easing: EASE_OUT }));
    finalCheckOpacity.value = withDelay(finalRowT + 250, withTiming(1, { duration: 220, easing: EASE_OUT }));

    const totalDelay = finalRowT + 250 + 220 + 400;
    finalCheckOpacity.value = withDelay(
      totalDelay,
      withTiming(1, { duration: 1 }, (finished) => {
        if (finished && !completedRef.current) {
          completedRef.current = true;
          runOnJS(onCompleted)();
        }
      }),
    );
  }, [brokenDown, inputsH, onCompleted]);

  const outcomeWrapStyle = useAnimatedStyle(() => ({
    height: outcomeWrapH.value,
    overflow: 'visible',
  }));

  const outcomeStyle = useAnimatedStyle(() => ({
    opacity: outcomeOpacity.value,
    transform: [{ translateY: outcomeTranslateY.value }],
  }));

  const inputsWrapStyle = useAnimatedStyle(() => ({
    height: inputsWrapH.value,
    overflow: 'visible',
  }));

  const inputsStyle = useAnimatedStyle(() => ({
    opacity: inputsOpacity.value,
    transform: [{ translateY: interpolate(inputsOpacity.value, [0, 1], [12, 0], Extrapolation.CLAMP) }],
  }));

  const goalStyle = useAnimatedStyle(() => ({
    opacity: goalOpacity.value,
    transform: [{ translateY: goalEntranceY.value }],
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
      transform: [{ translateY: interpolate(sv.value, [0, 1], [8, 0], Extrapolation.CLAMP) }],
    }));

  const reverseStyle = useAnimatedStyle(() => ({
    opacity: reverseOpacity.value,
  }));

  const arrow12Style = useAnimatedStyle(() => ({
    opacity: interpolate(row2.value, [0, 0.2], [0, 0.5], Extrapolation.CLAMP),
  }));

  const arrow23Style = useAnimatedStyle(() => ({
    opacity: interpolate(row3.value, [0, 0.2], [0, 0.5], Extrapolation.CLAMP),
  }));

  const arrow34Style = useAnimatedStyle(() => ({
    opacity: interpolate(row4.value, [0, 0.2], [0, 0.5], Extrapolation.CLAMP),
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

  const finalRowStyle = useAnimatedStyle(() => ({
    opacity: finalRowOpacity.value,
    transform: [{ translateY: interpolate(finalRowOpacity.value, [0, 1], [8, 0], Extrapolation.CLAMP) }],
  }));

  const finalCheckStyle = useAnimatedStyle(() => ({
    opacity: finalCheckOpacity.value,
    transform: [{ scale: interpolate(finalCheckOpacity.value, [0, 1], [0.4, 1], Extrapolation.CLAMP) }],
  }));

  const mathSteps = [
    { num: '01', text: '$20K PROFIT / DEAL', style: rowStyle(row1) },
    { num: '02', text: '5 DEALS / MONTH', style: rowStyle(row2) },
    { num: '03', text: '1 DEAL / 10 OFFERS', style: rowStyle(row3) },
    { num: '04', text: '\u2248 3 OFFERS / BUSINESS DAY', style: rowStyle(row4) },
  ];

  return (
    <View style={[styles.container, { width: pageWidth }]}>
      <View style={styles.exampleArea}>
        {/* Outcome headline — wrapper collapses on tap, headline exits upward */}
        <Animated.View style={outcomeWrapStyle} pointerEvents="none">
          <Animated.View style={[styles.headlineCenter, outcomeStyle]}>
            <Text style={[styles.headline1, { fontSize: headline1Size }]}>
              <Text style={styles.textWhite}>STOP FOCUSING{'\n'}ON THE OUTCOME.</Text>
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Goal card — lime-bordered container, moves up as headline collapses */}
        <Animated.View style={[styles.goalCard, goalStyle]}>
          <Text style={styles.goalLabel}>GOAL</Text>
          <Text style={[styles.goalText, { fontSize: goalTextSize, color: LIME }]}>MAKE $100K/MONTH</Text>
        </Animated.View>

        {/* Inputs headline — wrapper expands on tap, fills space below goal */}
        <Animated.View style={[inputsWrapStyle, { marginTop: 36 }]} pointerEvents="none">
          <Animated.View style={[styles.headlineCenter, inputsStyle]}>
            <Text style={[styles.headline2, { fontSize: headline2Size }]}>
              <Text style={styles.textWhite}>FOCUS ON THE{'\n'}</Text>
              <Text style={styles.textLime}>INPUTS{'\n'}</Text>
              <Text style={styles.textWhite}>THAT CREATE IT.</Text>
            </Text>
          </Animated.View>
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
                <Text style={styles.arrowLime}>↓</Text>
              </Animated.View>
              <Text style={styles.reverseLabel}>BREAK IT DOWN</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Reverse engineer label — Phase 2 */}
        {brokenDown && (
          <Animated.View style={[styles.reverseWrap, reverseStyle]}>
            <Text style={styles.arrowLime}>↓</Text>
            <Text style={styles.reverseLabel}>REVERSE ENGINEER</Text>
          </Animated.View>
        )}

        {/* Math chain — sequential reverse-engineering calculation */}
        {brokenDown && (
          <View style={{ width: '100%', marginTop: 2 }}>
            <Animated.View style={[styles.inputRowCard, { height: rowHeight }, mathSteps[0].style]}>
              <Text style={styles.inputNum}>{mathSteps[0].num}</Text>
              <Text style={[styles.inputText, { fontSize: inputTextSize }]}>{mathSteps[0].text}</Text>
            </Animated.View>

            <Animated.View style={[styles.mathArrowWrap, arrow12Style]}>
              <Text style={styles.mathArrowText}>↓</Text>
            </Animated.View>

            <Animated.View style={[styles.inputRowCard, { height: rowHeight }, mathSteps[1].style]}>
              <Text style={styles.inputNum}>{mathSteps[1].num}</Text>
              <Text style={[styles.inputText, { fontSize: inputTextSize }]}>{mathSteps[1].text}</Text>
            </Animated.View>

            <Animated.View style={[styles.mathArrowWrap, arrow23Style]}>
              <Text style={styles.mathArrowText}>↓</Text>
            </Animated.View>

            <Animated.View style={[styles.inputRowCard, { height: rowHeight }, mathSteps[2].style]}>
              <Text style={styles.inputNum}>{mathSteps[2].num}</Text>
              <Text style={[styles.inputText, { fontSize: inputTextSize }]}>{mathSteps[2].text}</Text>
            </Animated.View>

            <Animated.View style={[styles.mathArrowWrap, arrow34Style]}>
              <Text style={styles.mathArrowText}>↓</Text>
            </Animated.View>

            <Animated.View style={[styles.inputRowCard, { height: rowHeight }, mathSteps[3].style]}>
              <Text style={styles.inputNum}>{mathSteps[3].num}</Text>
              <Text style={[styles.inputText, { fontSize: inputTextSize }]}>{mathSteps[3].text}</Text>
            </Animated.View>
          </View>
        )}

        {/* Arrow to stack + Success Stack with single resolved input */}
        {brokenDown && (
          <>
            <Animated.View style={[styles.stackArrowWrap, stackArrowStyle]}>
              <Text style={styles.arrowLime}>↓</Text>
            </Animated.View>

            <Animated.View style={[styles.stackCard, stackStyle, stackBorderStyle]}>
              <Text style={styles.stackMuted}>YOUR DAILY</Text>
              <Text style={[styles.stackLime, { fontSize: stackLimeSize }]}>SUCCESS STACK</Text>

              <Animated.View style={[styles.stackInputRow, finalRowStyle]}>
                <Text style={styles.inputNum}>01</Text>
                <Text style={[styles.inputText, { fontSize: inputTextSize }]}>3 offers/day</Text>
                <Animated.View style={[styles.checkWrap, finalCheckStyle]}>
                  <Text style={styles.checkMark}>✓</Text>
                </Animated.View>
              </Animated.View>
            </Animated.View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 26,
  },
  exampleArea: {
    flex: 1,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  headlineCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline1: {
    fontFamily: 'Inter-Black',
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: 0.3,
  },
  headline2: {
    fontFamily: 'Inter-Black',
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 28,
    letterSpacing: 0.2,
  },
  textWhite: {
    color: WHITE,
  },
  textLime: {
    color: LIME,
  },
  goalCard: {
    width: '82%',
    backgroundColor: GOAL_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LIME,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  goalLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 2.5,
    marginBottom: 3,
  },
  goalText: {
    fontFamily: 'Inter-Black',
    fontWeight: '900',
    color: LIME,
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
  arrowLime: {
    fontFamily: 'Inter-Black',
    fontSize: 18,
    color: LIME,
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
  mathArrowWrap: {
    alignItems: 'center',
    height: 18,
    justifyContent: 'center',
  },
  mathArrowText: {
    fontFamily: 'Inter-Black',
    fontSize: 14,
    color: LIME,
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
  stackInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(204,255,0,0.15)',
    width: '100%',
  },
});
