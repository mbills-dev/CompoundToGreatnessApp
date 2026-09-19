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
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

const LIME = '#CCFF00';
const WHITE = '#FFFFFF';
const MUTED = '#8D8D8D';
const BG = '#050505';
const GOAL_BG = '#111111';
const ROW_BG = '#191919';
const ROW_BORDER = 'rgba(255,255,255,0.07)';

const EASE_OUT = Easing.out(Easing.cubic);

export type ExampleInput = {
  num: string;
  text: string;
};

export type ExampleConfig = {
  id: string;
  category: string;
  goal: string;
  inputs: ExampleInput[];
  /** Optional reverse-engineer math steps shown before the Success Stack (Business example) */
  mathSteps?: string[];
};

type Props = {
  config: ExampleConfig;
  isActive: boolean;
  isSmall: boolean;
  isNarrowHeight: boolean;
  onSequenceComplete: () => void;
};

export default function ExamplePanel({ config, isActive, isSmall, isNarrowHeight, onSequenceComplete }: Props) {
  const { width } = useWindowDimensions();
  const [brokenDown, setBrokenDown] = useState(false);
  const hasFiredComplete = useRef(false);

  const headline1Size = isSmall ? 30 : 34;
  const headline2Size = isSmall ? 20 : 22;
  const goalTextSize = isSmall ? 16 : 18;
  const inputTextSize = isSmall ? 14 : 15;
  const stackLimeSize = isSmall ? 26 : 30;
  const rowHeight = isSmall ? 50 : 54;
  const rowGap = isSmall ? 7 : 8;
  const mathStepSize = isSmall ? 13 : 14;

  const outcomeH = isSmall ? 88 : 94;
  const inputsH = isSmall ? 88 : 94;

  const outcomeOpacity = useSharedValue(0);
  const outcomeTranslateY = useSharedValue(0);
  const outcomeWrapH = useSharedValue(0);
  const goalOpacity = useSharedValue(0);
  const goalEntranceY = useSharedValue(14);
  const breakDownOpacity = useSharedValue(0);
  const breakDownPulse = useSharedValue(1);

  const inputsOpacity = useSharedValue(0);
  const inputsWrapH = useSharedValue(0);
  const reverseOpacity = useSharedValue(0);
  const stackArrowOpacity = useSharedValue(0);
  const stackOpacity = useSharedValue(0);
  const stackGlow = useSharedValue(0);

  // Math steps — fixed maximum of 4 shared values (Business example uses 4)
  const mathSv0 = useSharedValue(0);
  const mathSv1 = useSharedValue(0);
  const mathSv2 = useSharedValue(0);
  const mathSv3 = useSharedValue(0);
  const mathSvs = [mathSv0, mathSv1, mathSv2, mathSv3];

  // Input rows — fixed maximum of 4 shared values
  const rowSv0 = useSharedValue(0);
  const rowSv1 = useSharedValue(0);
  const rowSv2 = useSharedValue(0);
  const rowSv3 = useSharedValue(0);
  const rowSvs = [rowSv0, rowSv1, rowSv2, rowSv3];

  // Checks — fixed maximum of 4 shared values
  const chkSv0 = useSharedValue(0);
  const chkSv1 = useSharedValue(0);
  const chkSv2 = useSharedValue(0);
  const chkSv3 = useSharedValue(0);
  const chkSvs = [chkSv0, chkSv1, chkSv2, chkSv3];

  const resetAll = useCallback(() => {
    outcomeOpacity.value = 0;
    outcomeTranslateY.value = 0;
    outcomeWrapH.value = 0;
    goalOpacity.value = 0;
    goalEntranceY.value = 14;
    breakDownOpacity.value = 0;
    breakDownPulse.value = 1;
    inputsOpacity.value = 0;
    inputsWrapH.value = 0;
    reverseOpacity.value = 0;
    stackArrowOpacity.value = 0;
    stackOpacity.value = 0;
    stackGlow.value = 0;
    mathSvs.forEach((sv) => (sv.value = 0));
    rowSvs.forEach((sv) => (sv.value = 0));
    chkSvs.forEach((sv) => (sv.value = 0));
    hasFiredComplete.current = false;
  }, [outcomeOpacity, outcomeTranslateY, outcomeWrapH, goalOpacity, goalEntranceY, breakDownOpacity, breakDownPulse, inputsOpacity, inputsWrapH, reverseOpacity, stackArrowOpacity, stackOpacity, stackGlow, mathSvs, rowSvs, chkSvs]);

  const runEntrance = useCallback(() => {
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
  }, [outcomeOpacity, goalOpacity, goalEntranceY, breakDownOpacity, breakDownPulse]);

  // Entrance: runs when panel becomes active (or on mount if already active)
  useEffect(() => {
    if (isActive) {
      resetAll();
      const t = setTimeout(() => runEntrance(), 50);
      return () => clearTimeout(t);
    } else {
      resetAll();
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

    let currentTime = reverseT + 250;

    // Math steps (Business example) — reveal sequentially before input rows
    if (config.mathSteps && config.mathSteps.length > 0) {
      const mathGap = 450;
      const mathDur = 400;
      config.mathSteps.forEach((_, i) => {
        mathSvs[i].value = withDelay(currentTime, withTiming(1, { duration: mathDur, easing: EASE_OUT }));
        currentTime += mathGap;
      });
      currentTime += 200; // pause after math steps
    }

    // Input cascade — 350ms apart
    const gap = 350;
    const rowDur = 350;
    config.inputs.forEach((_, i) => {
      rowSvs[i].value = withDelay(currentTime, withTiming(1, { duration: rowDur, easing: EASE_OUT }));
      chkSvs[i].value = withDelay(currentTime + 80, withTiming(1, { duration: 220, easing: EASE_OUT }));
      currentTime += gap;
    });

    const lastInputSettle = currentTime - gap + rowDur;
    const stackT = lastInputSettle + 650;
    stackArrowOpacity.value = withDelay(stackT, withTiming(1, { duration: 300, easing: EASE_OUT }));
    stackOpacity.value = withDelay(stackT + 300, withTiming(1, { duration: 550, easing: EASE_OUT }));
    stackGlow.value = withDelay(stackT + 500, withTiming(1, { duration: 700, easing: EASE_OUT }));

    const stackDone = stackT + 300 + 550;
    const completeT = stackDone + 500;
    // Fire onSequenceComplete callback after the stack has fully appeared
    setTimeout(() => {
      if (!hasFiredComplete.current) {
        hasFiredComplete.current = true;
        onSequenceComplete();
      }
    }, completeT);
  }, [brokenDown, config, inputsH, mathSvs, rowSvs, chkSvs, onSequenceComplete, outcomeOpacity, outcomeTranslateY, outcomeWrapH, inputsWrapH, inputsOpacity, reverseOpacity, stackArrowOpacity, stackOpacity, stackGlow]);

  // Styles
  const outcomeWrapStyle = useAnimatedStyle(() => ({ height: outcomeWrapH.value, overflow: 'visible' as const }));
  const outcomeStyle = useAnimatedStyle(() => ({ opacity: outcomeOpacity.value, transform: [{ translateY: outcomeTranslateY.value }] }));
  const inputsWrapStyle = useAnimatedStyle(() => ({ height: inputsWrapH.value, overflow: 'visible' as const }));
  const inputsStyle = useAnimatedStyle(() => ({ opacity: inputsOpacity.value, transform: [{ translateY: interpolate(inputsOpacity.value, [0, 1], [12, 0], Extrapolation.CLAMP) }] }));
  const goalStyle = useAnimatedStyle(() => ({ opacity: goalOpacity.value, transform: [{ translateY: goalEntranceY.value }] }));
  const breakDownStyle = useAnimatedStyle(() => ({ opacity: breakDownOpacity.value }));
  const breakDownArrowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breakDownPulse.value, [0, 1], [0.45, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(breakDownPulse.value, [0, 1], [3, -3], Extrapolation.CLAMP) }],
  }));
  const reverseStyle = useAnimatedStyle(() => ({ opacity: reverseOpacity.value }));
  const stackArrowStyle = useAnimatedStyle(() => ({ opacity: stackArrowOpacity.value }));
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

  const rowStyle = (sv: SharedValue<number>) =>
    useAnimatedStyle(() => ({
      opacity: sv.value,
      transform: [{ translateY: interpolate(sv.value, [0, 1], [8, 0], Extrapolation.CLAMP) }],
    }));

  const checkAnim = (sv: SharedValue<number>) =>
    useAnimatedStyle(() => ({
      opacity: sv.value,
      transform: [{ scale: interpolate(sv.value, [0, 1], [0.4, 1], Extrapolation.CLAMP) }],
    }));

  const mathStyle = (sv: SharedValue<number>) =>
    useAnimatedStyle(() => ({
      opacity: sv.value,
      transform: [{ translateY: interpolate(sv.value, [0, 1], [8, 0], Extrapolation.CLAMP) }],
    }));

  return (
    <View style={panelStyles.container}>
      <View style={panelStyles.exampleArea}>
        {/* Outcome headline */}
        <Animated.View style={outcomeWrapStyle} pointerEvents="none">
          <Animated.View style={[panelStyles.headlineCenter, outcomeStyle]}>
            <Text style={[panelStyles.headline1, { fontSize: headline1Size }]}>
              <Text style={panelStyles.textWhite}>STOP FOCUSING{'\n'}ON THE OUTCOME.</Text>
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Goal card */}
        <Animated.View style={[panelStyles.goalCard, goalStyle]}>
          <Text style={panelStyles.goalLabel}>{config.category}</Text>
          <Text style={[panelStyles.goalText, { fontSize: goalTextSize }]}>{config.goal}</Text>
        </Animated.View>

        {/* Inputs headline */}
        <Animated.View style={[inputsWrapStyle, { marginTop: 36 }]} pointerEvents="none">
          <Animated.View style={[panelStyles.headlineCenter, inputsStyle]}>
            <Text style={[panelStyles.headline2, { fontSize: headline2Size }]}>
              <Text style={panelStyles.textWhite}>FOCUS ON THE{'\n'}</Text>
              <Text style={panelStyles.textLime}>INPUTS{'\n'}</Text>
              <Text style={panelStyles.textWhite}>THAT CREATE IT.</Text>
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Break it down */}
        {!brokenDown && (
          <Animated.View style={[panelStyles.breakDownWrap, breakDownStyle]}>
            <TouchableOpacity
              onPress={handleBreakDown}
              activeOpacity={0.7}
              style={panelStyles.breakDownTouch}
            >
              <Animated.View style={breakDownArrowStyle}>
                <Text style={panelStyles.arrowLime}>↓</Text>
              </Animated.View>
              <Text style={panelStyles.reverseLabel}>BREAK IT DOWN</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Reverse engineer label */}
        {brokenDown && (
          <Animated.View style={[panelStyles.reverseWrap, reverseStyle]}>
            <Text style={panelStyles.arrowLime}>↓</Text>
            <Text style={panelStyles.reverseLabel}>REVERSE ENGINEER</Text>
          </Animated.View>
        )}

        {/* Math steps (Business example) */}
        {brokenDown && config.mathSteps && (
          <View style={panelStyles.mathContainer}>
            {config.mathSteps.map((step, i) => (
              <Animated.View key={i} style={[panelStyles.mathStepRow, mathStyle(mathSvs[i])]}>
                <Text style={[panelStyles.mathStepText, { fontSize: mathStepSize }]}>{step}</Text>
                {i < (config.mathSteps?.length ?? 0) - 1 && (
                  <Animated.View style={[panelStyles.mathArrow, mathStyle(mathSvs[i])]}>
                    <Text style={panelStyles.arrowLime}>↓</Text>
                  </Animated.View>
                )}
              </Animated.View>
            ))}
          </View>
        )}

        {/* Input rows */}
        {brokenDown && (
          <View style={{ width: '100%', gap: rowGap, marginTop: 2 }}>
            {config.inputs.map((item, i) => (
              <Animated.View key={item.num} style={[panelStyles.inputRowCard, { height: rowHeight }, rowStyle(rowSvs[i])]}>
                <Text style={panelStyles.inputNum}>{item.num}</Text>
                <Text style={[panelStyles.inputText, { fontSize: inputTextSize }]}>{item.text}</Text>
                <Animated.View style={[panelStyles.checkWrap, checkAnim(chkSvs[i])]}>
                  <Text style={panelStyles.checkMark}>✓</Text>
                </Animated.View>
              </Animated.View>
            ))}
          </View>
        )}

        {/* Arrow + Success Stack */}
        {brokenDown && (
          <>
            <Animated.View style={[panelStyles.stackArrowWrap, stackArrowStyle]}>
              <Text style={panelStyles.arrowLime}>↓</Text>
            </Animated.View>

            <Animated.View style={[panelStyles.stackCard, stackStyle, stackBorderStyle]}>
              <Text style={panelStyles.stackMuted}>YOUR DAILY</Text>
              <Text style={[panelStyles.stackLime, { fontSize: stackLimeSize }]}>SUCCESS STACK</Text>
            </Animated.View>
          </>
        )}
      </View>
    </View>
  );
}

const panelStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
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
  textWhite: { color: WHITE },
  textLime: { color: LIME },
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
  mathContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 6,
  },
  mathStepRow: {
    alignItems: 'center',
  },
  mathStepText: {
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
    color: WHITE,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  mathArrow: {
    paddingVertical: 2,
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
});
