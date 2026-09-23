/**
 * Body Composition specialized path — fat loss questionnaire, reverse
 * engineering moment, plan summary, Success Stack customization, and
 * commitment screen. Uses the existing CTG onboarding visual system.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useAnimatedReaction,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { ArrowLeft, ArrowRight, Check, Plus, X, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle as SvgCircle, Line as SvgLine, Path as SvgPath } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BodyCompositionData,
  BodyCompStackInput,
  FatLossCalculationResult,
} from './types';
import {
  calculateFatLoss,
  deriveTargetWeight,
  parseFatLossGoal,
  FatLossInput,
} from '@/lib/bodyComposition';

const LIME = '#CCFF00';
const DARK = '#0A0A0A';
const CARD_BORDER = '#1C1C1C';
const CARD_BG = '#0F0F0F';
const FAINT = '#555';
const MUTED = '#888';

const RING_SIZE = 160;
const STROKE_WIDTH = 6;
const RING_RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// ─── Haptics helper (platform-safe) ──────────────────────────────────────────

function hapticSelection(): void {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync().catch(() => {});
  }
}

function hapticLight(): void {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

function hapticMedium(): void {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }
}

function hapticHeavy(): void {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }
}

function hapticSuccess(): void {
  if (Platform.OS !== 'web') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
}

// ─── Reusable Reverse Engineering Component ─────────────────────────────────

export interface ReverseEngineeringStage {
  number: string;
  title: string;
  description: string;
  resultValue?: string;
}

export function ReverseEngineeringScreen({
  stages,
  result,
  goalLabel,
  onReveal,
}: {
  stages: ReverseEngineeringStage[];
  result: FatLossCalculationResult | null;
  goalLabel: string;
  onReveal: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [currentStageIdx, setCurrentStageIdx] = useState(-1);
  const [phase, setPhase] = useState<'processing' | 'complete'>('processing');
  const [displayPercent, setDisplayPercent] = useState(0);

  const headlineOpacity = useSharedValue(0);
  const ctaOpacity = useSharedValue(0);
  const progress = useSharedValue(0);
  const ringGlowOpacity = useSharedValue(0);
  const boltScale = useSharedValue(0);
  const boltOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);
  const bottomProgressWidth = useSharedValue(0);
  const stageDescOpacity = useSharedValue(0);
  const processingUIOpacity = useSharedValue(1);
  const completionHeadlineOpacity = useSharedValue(0);
  const completionHeadlineTranslateY = useSharedValue(20);

  const stageBoundaries = [0.22, 0.47, 0.72, 1.0];
  const lastStageFired = useRef(-1);

  useEffect(() => {
    headlineOpacity.value = withTiming(1, { duration: 600 });

    // One deliberate 4.5-second continuous progress sequence.
    // Segments ease from quick start → steady middle → increasingly deliberate near 100%.
    const segments: { to: number; duration: number; easing: ReturnType<typeof Easing.bezier> }[] = [
      { to: 0.25, duration: 1100, easing: Easing.bezier(0.4, 0, 0.6, 1) },
      { to: 0.50, duration: 1000, easing: Easing.bezier(0.25, 0.1, 0.25, 1) },
      { to: 0.75, duration: 1000, easing: Easing.bezier(0.2, 0.0, 0.3, 1) },
      { to: 0.99, duration: 1100, easing: Easing.bezier(0.15, 0.0, 0.15, 1) },
    ];

    let elapsed = 700;

    segments.forEach((seg) => {
      progress.value = withDelay(
        elapsed,
        withTiming(seg.to, { duration: seg.duration, easing: seg.easing }),
      );
      bottomProgressWidth.value = withDelay(
        elapsed,
        withTiming(seg.to, { duration: seg.duration, easing: seg.easing }),
      );
      elapsed += seg.duration;
    });

    // Brief anticipation hold at 99%, then final push to 100
    const SUSPENSE_HOLD = 300;
    const finalDelay = elapsed + SUSPENSE_HOLD;

    progress.value = withDelay(
      finalDelay,
      withTiming(1, { duration: 300, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
    );
    bottomProgressWidth.value = withDelay(
      finalDelay,
      withTiming(1, { duration: 300, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
    );

    const totalDuration = finalDelay + 300;

    // Completion sequence fires after ring reaches 100%
    const completionTimer = setTimeout(() => {
      // Strong success haptic
      hapticSuccess();

      // Intensify completed lime ring glow
      ringGlowOpacity.value = withSequence(
        withTiming(0.5, { duration: 200 }),
        withTiming(0.15, { duration: 600 }),
      );

      // Reveal CTG bolt in center — replaces the percentage number
      boltOpacity.value = withTiming(1, { duration: 200 });
      boltScale.value = withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1.3, { duration: 300, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
        withTiming(1, { duration: 200 }),
      );

      // One controlled outward radial pulse, then settle
      pulseOpacity.value = withSequence(
        withTiming(0.3, { duration: 200 }),
        withTiming(0, { duration: 700 }),
      );
      pulseScale.value = withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(1.6, { duration: 700, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
      );

      // Transform processing UI into completion headline
      processingUIOpacity.value = withTiming(0, { duration: 400 });
      completionHeadlineOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
      completionHeadlineTranslateY.value = withDelay(
        200,
        withTiming(0, { duration: 500, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
      );

      runOnJS(setPhase)('complete');

      // Reveal CTA
      ctaOpacity.value = withDelay(700, withTiming(1, { duration: 500 }));
    }, totalDuration);

    return () => clearTimeout(completionTimer);
  }, []);

  const onStageChange = (idx: number) => {
    if (idx < 0 || idx >= stages.length) return;
    setCurrentStageIdx(idx);
    stageDescOpacity.value = withSequence(
      withTiming(0, { duration: 150 }),
      withTiming(1, { duration: 300 }),
    );
    if (idx > 0) hapticLight();
  };

  // Continuous percentage display — update state from shared value
  useAnimatedReaction(
    () => progress.value,
    (p) => {
      runOnJS(setDisplayPercent)(Math.round(p * 100));
      // Determine current stage from continuous progress
      let stageIdx = -1;
      for (let i = 0; i < stageBoundaries.length; i++) {
        if (p < stageBoundaries[i]) {
          stageIdx = i;
          break;
        }
        if (i === stageBoundaries.length - 1) {
          stageIdx = i;
        }
      }
      if (stageIdx !== lastStageFired.current && stageIdx >= 0) {
        lastStageFired.current = stageIdx;
        runOnJS(onStageChange)(stageIdx);
      }
    },
  );

  const fadeStyle = useAnimatedStyle(() => ({ opacity: headlineOpacity.value }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaOpacity.value }));

  const animatedCircleProps = useAnimatedProps(() => {
    const offset = CIRCUMFERENCE * (1 - progress.value);
    return { strokeDashoffset: offset };
  });

  const ringGlowStyle = useAnimatedStyle(() => ({
    opacity: ringGlowOpacity.value,
  }));

  const ringWrapStyle = useAnimatedStyle(() => ({}));

  const boltStyle = useAnimatedStyle(() => ({
    transform: [{ scale: boltScale.value }],
    opacity: boltOpacity.value,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));

  const bottomProgressStyle = useAnimatedStyle(() => ({
    width: `${bottomProgressWidth.value * 100}%`,
  }));

  const stageDescStyle = useAnimatedStyle(() => ({ opacity: stageDescOpacity.value }));

  const processingUIStyle = useAnimatedStyle(() => ({ opacity: processingUIOpacity.value }));

  const completionHeadlineStyle = useAnimatedStyle(() => ({
    opacity: completionHeadlineOpacity.value,
    transform: [{ translateY: completionHeadlineTranslateY.value }],
  }));

  // Progressive glow — intensifies more from 80-99% to build anticipation
  const progressiveGlowStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const intensity = p < 0.8 ? p * 0.12 : 0.096 + (p - 0.8) * 0.77;
    return {
      opacity: intensity * 0.3,
      transform: [{ scale: 1 + intensity * 0.12 }],
    };
  });

  const currentStageData =
    currentStageIdx >= 0 && currentStageIdx < stages.length
      ? stages[currentStageIdx]
      : null;

  return (
    <View style={[reStyles.container, { backgroundColor: DARK, paddingTop: insets.top }]}>
      <Animated.View style={[fadeStyle, { flex: 1 }]}>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 120, flexGrow: 1 }}
        >
          {/* Processing heading */}
          <Animated.View style={processingUIStyle}>
            <Text style={reStyles.eyebrow}>REVERSE ENGINEERING</Text>
            <Text style={reStyles.headline}>
              <Text style={reStyles.headlineWhite}>REVERSE ENGINEERING{'\n'}</Text>
              <Text style={reStyles.headlineLime}>YOUR GOAL...</Text>
            </Text>
          </Animated.View>

          {/* Completion headline — appears in same location */}
          <Animated.View style={[reStyles.completionHeadlineWrap, completionHeadlineStyle]} pointerEvents="none">
            <Text style={reStyles.headline}>
              <Text style={reStyles.headlineWhite}>YOUR PLAN{'\n'}</Text>
              <Text style={reStyles.headlineLime}>IS READY.</Text>
            </Text>
          </Animated.View>

          {/* Circular progress ring — stays mounted through completion */}
          <View style={reStyles.ringContainer}>
            {/* Outward pulse on completion */}
            <Animated.View style={[reStyles.ringPulse, pulseStyle]} />
            {/* Progressive ambient glow */}
            <Animated.View style={[reStyles.ringGlow, progressiveGlowStyle]} />
            {/* Completion burst glow */}
            <Animated.View style={[reStyles.ringGlow, ringGlowStyle]} />

            <Animated.View style={ringWrapStyle}>
              <Svg width={RING_SIZE} height={RING_SIZE} style={reStyles.svgRing}>
                {/* Track */}
                <SvgCircle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke="#1A1A1A"
                  strokeWidth={STROKE_WIDTH}
                  fill="none"
                />
                {/* Progress arc */}
                <AnimatedCircle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke={LIME}
                  strokeWidth={STROKE_WIDTH}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={CIRCUMFERENCE}
                  animatedProps={animatedCircleProps}
                  transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                />
              </Svg>
            </Animated.View>

            {/* Center content */}
            <View style={reStyles.ringCenter}>
              {phase === 'complete' ? (
                <Animated.View style={boltStyle}>
                  <Zap size={36} color={LIME} fill={LIME} strokeWidth={1.5} />
                </Animated.View>
              ) : (
                <Animated.View style={processingUIStyle}>
                  <Text style={reStyles.ringPercent}>{displayPercent}%</Text>
                  {currentStageData && (
                    <Animated.Text style={[reStyles.ringStageTitle, stageDescStyle]} numberOfLines={1}>
                      {currentStageData.title}
                    </Animated.Text>
                  )}
                  {currentStageData && (
                    <Animated.Text style={[reStyles.ringStageDesc, stageDescStyle]} numberOfLines={2}>
                      {currentStageData.description}
                    </Animated.Text>
                  )}
                </Animated.View>
              )}
            </View>
          </View>

          {/* Stage list — fades out on completion */}
          <Animated.View style={processingUIStyle}>
            <View style={reStyles.stageList}>
              {stages.map((stage, idx) => {
                const isComplete = currentStageIdx > idx;
                const isCurrent = currentStageIdx === idx;
                return (
                  <StageRow
                    key={idx}
                    stage={stage}
                    isComplete={isComplete}
                    isCurrent={isCurrent}
                    isUpcoming={!isComplete && !isCurrent}
                  />
                );
              })}
            </View>
          </Animated.View>
        </ScrollView>
      </Animated.View>

      {/* Bottom thin progress line */}
      <View style={[reStyles.bottomProgressTrack, { marginBottom: insets.bottom + 20, marginHorizontal: 28 }]}>
        <Animated.View style={[reStyles.bottomProgressFill, bottomProgressStyle]} />
      </View>

      {/* CTA */}
      <Animated.View style={[ctaStyle, { paddingHorizontal: 28, paddingBottom: insets.bottom + 24 }]}>
        {phase === 'complete' && (
          <TouchableOpacity
            style={reStyles.cta}
            onPress={() => { hapticMedium(); onReveal(); }}
            activeOpacity={0.85}
          >
            <Text style={reStyles.ctaText}>See My Success Stack</Text>
            <ArrowRight size={20} color="#000" strokeWidth={3} />
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

// Animated SVG Circle wrapper
const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);
const AnimatedPath = Animated.createAnimatedComponent(SvgPath);

function StageRow({
  stage,
  isComplete,
  isCurrent,
  isUpcoming,
}: {
  stage: ReverseEngineeringStage;
  isComplete: boolean;
  isCurrent: boolean;
  isUpcoming: boolean;
}) {
  const checkScale = useSharedValue(0);
  const dotOpacity = useSharedValue(0.3);

  useEffect(() => {
    if (isComplete) {
      checkScale.value = withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1, { duration: 300, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
      );
      dotOpacity.value = withTiming(1, { duration: 300 });
    } else if (isCurrent) {
      dotOpacity.value = withTiming(0.6, { duration: 300 });
    } else {
      dotOpacity.value = withTiming(0.25, { duration: 300 });
    }
  }, [isComplete, isCurrent]);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));

  return (
    <View style={reStyles.stageRow}>
      {/* Left indicator */}
      <View style={reStyles.stageIndicatorWrap}>
        {isComplete ? (
          <Animated.View style={[reStyles.stageCheckCircle, checkStyle]}>
            <Check size={12} color="#000" strokeWidth={3} />
          </Animated.View>
        ) : (
          <Animated.View style={[reStyles.stageDot, dotStyle, isCurrent && { backgroundColor: LIME }]} />
        )}
      </View>

      {/* Text content */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[
            reStyles.stageTitle,
            { color: isComplete ? '#FFF' : isCurrent ? '#DDD' : '#444' },
            isCurrent && { fontWeight: '800' },
          ]}
          numberOfLines={1}
        >
          {stage.title}
        </Text>
        <Text
          style={[
            reStyles.stageDesc,
            { color: isComplete ? '#888' : isCurrent ? LIME : '#333' },
          ]}
          numberOfLines={2}
        >
          {isComplete && stage.resultValue ? stage.resultValue : stage.description}
        </Text>
      </View>
    </View>
  );
}

const reStyles = StyleSheet.create({
  container: { flex: 1 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: FAINT,
    marginTop: 20,
  },
  headline: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 38,
    marginTop: 6,
    marginBottom: 8,
  },
  headlineWhite: { color: '#FFFFFF' },
  headlineLime: { color: LIME },
  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  ringGlow: {
    position: 'absolute',
    width: RING_SIZE + 40,
    height: RING_SIZE + 40,
    borderRadius: (RING_SIZE + 40) / 2,
    backgroundColor: LIME,
  },
  ringPulse: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: LIME,
  },
  completionHeadlineWrap: {
    position: 'absolute',
    top: 20,
    left: 28,
    right: 28,
  },
  svgRing: {
    position: 'relative',
    zIndex: 1,
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: RING_SIZE,
    height: RING_SIZE,
    paddingHorizontal: 12,
    zIndex: 2,
  },
  ringPercent: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -1,
  },
  ringStageTitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: LIME,
    marginTop: 4,
    textAlign: 'center',
  },
  ringStageDesc: {
    fontSize: 10,
    fontWeight: '500',
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
    lineHeight: 14,
  },
  stageList: {
    gap: 14,
  },
  stageRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  stageIndicatorWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stageCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: LIME,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  stageTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    letterSpacing: 0.3,
  },
  stageDesc: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    marginTop: 1,
  },
  finalTitle: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 42,
  },
  finalSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: MUTED,
    marginTop: 12,
    lineHeight: 24,
  },
  bottomProgressTrack: {
    height: 2,
    backgroundColor: '#1A1A1A',
    borderRadius: 1,
    overflow: 'hidden',
  },
  bottomProgressFill: {
    height: '100%',
    backgroundColor: LIME,
    borderRadius: 1,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: LIME,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.2,
  },
});

// ─── Screen 1: Path Intro ────────────────────────────────────────────────────

export function BodyCompIntroScreen({
  goalLabel,
  onNext,
  onBack,
}: {
  goalLabel: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const fade = useSharedValue(0);
  useEffect(() => { fade.value = withTiming(1, { duration: 600 }); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <View style={[bcStyles.container, { backgroundColor: DARK, paddingTop: insets.top }]}>
      <View style={bcStyles.header}>
        <TouchableOpacity onPress={onBack} style={bcStyles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <Animated.View style={[fadeStyle, { flex: 1, paddingHorizontal: 28 }]}>
        <Text style={bcStyles.eyebrow}>REVERSE ENGINEER</Text>
        <Text style={bcStyles.headline}>
          <Text style={bcStyles.headlineWhite}>LET'S BUILD{'\n'}</Text>
          <Text style={bcStyles.headlineLime}>YOUR SYSTEM.</Text>
        </Text>

        <Text style={bcStyles.goalRef}>You want to {goalLabel.toLowerCase()}.</Text>

        <Text style={bcStyles.support}>
          We'll use a few details to turn your goal into daily actions you can control.
        </Text>

        <View style={bcStyles.flowDiagram}>
          <FlowNode label="YOUR GOAL" />
          <FlowArrow />
          <FlowNode label="YOUR SYSTEM" />
          <FlowArrow />
          <FlowNode label="DAILY INPUTS" />
        </View>
      </Animated.View>

      <View style={[bcStyles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity style={bcStyles.cta} onPress={() => { hapticLight(); onNext(); }} activeOpacity={0.85}>
          <Text style={bcStyles.ctaText}>Let's do it</Text>
          <ArrowRight size={20} color="#000" strokeWidth={3} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FlowNode({ label }: { label: string }) {
  return (
    <View style={bcStyles.flowNode}>
      <Text style={bcStyles.flowNodeText}>{label}</Text>
    </View>
  );
}

function FlowArrow() {
  return (
    <View style={bcStyles.flowArrow}>
      <Text style={bcStyles.flowArrowText}>↓</Text>
    </View>
  );
}

const bcStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: FAINT,
    marginTop: 24,
  },
  headline: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 46,
    marginTop: 8,
  },
  headlineWhite: { color: '#FFFFFF' },
  headlineLime: { color: LIME },
  goalRef: {
    fontSize: 18,
    fontWeight: '700',
    color: '#CCC',
    marginTop: 24,
    lineHeight: 26,
  },
  support: {
    fontSize: 16,
    fontWeight: '500',
    color: MUTED,
    marginTop: 12,
    lineHeight: 24,
  },
  flowDiagram: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 40,
    gap: 12,
  },
  flowNode: {
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  flowNodeText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#AAA',
  },
  flowArrow: {
    paddingVertical: 2,
  },
  flowArrowText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '700',
  },
  footer: { paddingHorizontal: 28 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: LIME,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.2,
  },
});

// ─── Questionnaire Screens ────────────────────────────────────────────────────

export type QuestionnaireStep =
  | 'weight' | 'height' | 'age' | 'sex' | 'activity' | 'pace';

export interface QuestionnaireState {
  currentWeightLbs: string;
  heightFeet: string;
  heightInches: string;
  age: string;
  sex: 'male' | 'female' | null;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'very' | null;
  pace: 'steady' | 'recommended' | 'faster' | null;
}

export function BodyCompQuestionnaire({
  step,
  state,
  onStateChange,
  onNext,
  onBack,
}: {
  step: QuestionnaireStep;
  state: QuestionnaireState;
  onStateChange: (partial: Partial<QuestionnaireState>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={[qStyles.container, { backgroundColor: DARK, paddingTop: insets.top }]}>
          <View style={qStyles.header}>
            <TouchableOpacity onPress={onBack} style={qStyles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 100 }}>
            {step === 'weight' && (
              <WeightStep state={state} onStateChange={onStateChange} />
            )}
            {step === 'height' && (
              <HeightStep state={state} onStateChange={onStateChange} />
            )}
            {step === 'age' && (
              <AgeStep state={state} onStateChange={onStateChange} />
            )}
            {step === 'sex' && (
              <SexStep state={state} onStateChange={onStateChange} />
            )}
            {step === 'activity' && (
              <ActivityStep state={state} onStateChange={onStateChange} />
            )}
            {step === 'pace' && (
              <PaceStep state={state} onStateChange={onStateChange} />
            )}
          </ScrollView>

          <View style={[qStyles.footer, { paddingBottom: insets.bottom + 24 }]}>
            <QuestionnaireCTA
              step={step}
              state={state}
              onNext={onNext}
            />
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

function QuestionnaireCTA({
  step,
  state,
  onNext,
}: {
  step: QuestionnaireStep;
  state: QuestionnaireState;
  onNext: () => void;
}) {
  const canContinue =
    step === 'weight' ? state.currentWeightLbs.trim().length > 0 :
    step === 'height' ? state.heightFeet.trim().length > 0 :
    step === 'age' ? state.age.trim().length > 0 :
    step === 'sex' ? state.sex !== null :
    step === 'activity' ? state.activityLevel !== null :
    step === 'pace' ? state.pace !== null : false;

  const label = step === 'pace' ? 'Build my plan' : 'Continue';

  return (
    <TouchableOpacity
      style={[qStyles.cta, !canContinue && qStyles.ctaDisabled]}
      onPress={canContinue ? () => { hapticLight(); onNext(); } : undefined}
      disabled={!canContinue}
      activeOpacity={0.85}
    >
      <Text style={[qStyles.ctaText, !canContinue && { color: '#555' }]}>
        {label} {step !== 'pace' && '→'}
      </Text>
      {step === 'pace' && canContinue && <ArrowRight size={20} color="#000" strokeWidth={3} />}
    </TouchableOpacity>
  );
}

function WeightStep({ state, onStateChange }: { state: QuestionnaireState; onStateChange: (p: Partial<QuestionnaireState>) => void }) {
  return (
    <>
      <Headline title="WHAT'S YOUR" highlight="CURRENT WEIGHT?" />
      <Support text="This gives us a starting point for your plan." />
      <NumericInput
        value={state.currentWeightLbs}
        onChangeText={v => { hapticSelection(); onStateChange({ currentWeightLbs: v }); }}
        placeholder="180"
        unit="lbs"
        keyboardType="numeric"
      />
    </>
  );
}

function HeightStep({ state, onStateChange }: { state: QuestionnaireState; onStateChange: (p: Partial<QuestionnaireState>) => void }) {
  return (
    <>
      <Headline title="WHAT'S YOUR" highlight="HEIGHT?" />
      <Support text="We'll use this to estimate your daily energy needs." />
      <View style={qStyles.dualInputRow}>
        <View style={qStyles.dualInputCol}>
          <Text style={qStyles.inputLabel}>FT</Text>
          <NumericInput
            value={state.heightFeet}
            onChangeText={v => { hapticSelection(); onStateChange({ heightFeet: v }); }}
            placeholder="5"
            keyboardType="numeric"
          />
        </View>
        <View style={qStyles.dualInputCol}>
          <Text style={qStyles.inputLabel}>IN</Text>
          <NumericInput
            value={state.heightInches}
            onChangeText={v => { hapticSelection(); onStateChange({ heightInches: v }); }}
            placeholder="10"
            keyboardType="numeric"
          />
        </View>
      </View>
    </>
  );
}

function AgeStep({ state, onStateChange }: { state: QuestionnaireState; onStateChange: (p: Partial<QuestionnaireState>) => void }) {
  return (
    <>
      <Headline title="HOW OLD" highlight="ARE YOU?" />
      <Support text="This helps us estimate your daily energy needs." />
      <NumericInput
        value={state.age}
        onChangeText={v => { hapticSelection(); onStateChange({ age: v }); }}
        placeholder="32"
        keyboardType="numeric"
      />
    </>
  );
}

function SexStep({ state, onStateChange }: { state: QuestionnaireState; onStateChange: (p: Partial<QuestionnaireState>) => void }) {
  return (
    <>
      <Headline title="WHICH SEX SHOULD" highlight="WE USE FOR THE" highlight2="ESTIMATE?" />
      <Support text="This is used only to estimate your energy needs." />
      <View style={qStyles.optionGroup}>
        <OptionButton
          label="Male"
          selected={state.sex === 'male'}
          onPress={() => { hapticLight(); onStateChange({ sex: 'male' }); }}
        />
        <OptionButton
          label="Female"
          selected={state.sex === 'female'}
          onPress={() => { hapticLight(); onStateChange({ sex: 'female' }); }}
        />
      </View>
    </>
  );
}

function ActivityStep({ state, onStateChange }: { state: QuestionnaireState; onStateChange: (p: Partial<QuestionnaireState>) => void }) {
  const options: { value: 'sedentary' | 'light' | 'moderate' | 'very'; title: string; desc: string }[] = [
    { value: 'sedentary', title: 'MOSTLY SEDENTARY', desc: 'Little intentional exercise; mostly sitting / desk-based day' },
    { value: 'light', title: 'LIGHTLY ACTIVE', desc: 'Some regular movement or light exercise roughly 1–3 days/week' },
    { value: 'moderate', title: 'MODERATELY ACTIVE', desc: 'Regular exercise/activity roughly 3–5 days/week' },
    { value: 'very', title: 'VERY ACTIVE', desc: 'Hard exercise most days or a physically demanding lifestyle/job' },
  ];
  return (
    <>
      <Headline title="WHAT'S YOUR" highlight="ACTIVITY LEVEL" highlight2="RIGHT NOW?" />
      <Support text="Choose the option that best describes your typical week right now." />
      <View style={qStyles.optionGroup}>
        {options.map(opt => (
          <DetailedOption
            key={opt.value}
            title={opt.title}
            desc={opt.desc}
            selected={state.activityLevel === opt.value}
            onPress={() => { hapticLight(); onStateChange({ activityLevel: opt.value }); }}
          />
        ))}
      </View>
    </>
  );
}

function PaceStep({ state, onStateChange }: { state: QuestionnaireState; onStateChange: (p: Partial<QuestionnaireState>) => void }) {
  const options: { value: 'steady' | 'recommended' | 'faster'; title: string; desc: string; badge?: string }[] = [
    { value: 'steady', title: 'STEADY', desc: 'Easier to sustain' },
    { value: 'recommended', title: 'RECOMMENDED', desc: 'Balanced progress', badge: 'RECOMMENDED' },
    { value: 'faster', title: 'FASTER', desc: 'More aggressive' },
  ];
  return (
    <>
      <Headline title="HOW DO YOU WANT" highlight="TO APPROACH THIS?" />
      <Support text="We'll set a sustainable starting target based on your goal and your body." />
      <View style={qStyles.optionGroup}>
        {options.map(opt => (
          <PaceOption
            key={opt.value}
            title={opt.title}
            desc={opt.desc}
            badge={opt.badge}
            selected={state.pace === opt.value}
            onPress={() => { hapticLight(); onStateChange({ pace: opt.value }); }}
          />
        ))}
      </View>
      <Text style={qStyles.safetyNote}>
        We'll keep your target within a reasonable starting range.
      </Text>
    </>
  );
}

// ─── Shared Questionnaire UI Primitives ──────────────────────────────────────

function Headline({ title, highlight, highlight2 }: { title: string; highlight: string; highlight2?: string }) {
  const fade = useSharedValue(0);
  useEffect(() => { fade.value = withTiming(1, { duration: 400 }); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  return (
    <Animated.View style={fadeStyle}>
      <Text style={qStyles.headline}>
        <Text style={qStyles.headlineWhite}>{title}{'\n'}</Text>
        <Text style={qStyles.headlineLime}>{highlight}</Text>
        {highlight2 && <Text style={qStyles.headlineLime}>{'\n'}{highlight2}</Text>}
      </Text>
    </Animated.View>
  );
}

function Support({ text }: { text: string }) {
  return <Text style={qStyles.support}>{text}</Text>;
}

function NumericInput({
  value,
  onChangeText,
  placeholder,
  unit,
  keyboardType,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  unit?: string;
  keyboardType?: 'default' | 'numeric' | 'number-pad';
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={qStyles.inputWrap}>
      <TextInput
        style={[
          qStyles.input,
          {
            color: colors.text,
            borderColor: focused ? LIME : CARD_BORDER,
            backgroundColor: '#111',
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#444"
        keyboardType={keyboardType || 'default'}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {unit && <Text style={qStyles.inputUnit}>{unit}</Text>}
    </View>
  );
}

function OptionButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[qStyles.optionBtn, { borderColor: selected ? LIME : CARD_BORDER, backgroundColor: selected ? 'rgba(204,255,0,0.08)' : 'rgba(255,255,255,0.02)' }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[qStyles.optionLabel, { color: selected ? '#FFF' : MUTED }]}>{label}</Text>
      {selected && (
        <View style={qStyles.optionCheck}>
          <Check size={16} color="#000" strokeWidth={3} />
        </View>
      )}
    </TouchableOpacity>
  );
}

function DetailedOption({ title, desc, selected, onPress }: { title: string; desc: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[qStyles.detailedOption, { borderColor: selected ? LIME : CARD_BORDER, backgroundColor: selected ? 'rgba(204,255,0,0.06)' : 'rgba(255,255,255,0.02)' }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={qStyles.detailedOptionHeader}>
        <Text style={[qStyles.detailedOptionTitle, { color: selected ? '#FFF' : '#CCC' }]}>{title}</Text>
        {selected && (
          <View style={qStyles.optionCheck}>
            <Check size={16} color="#000" strokeWidth={3} />
          </View>
        )}
      </View>
      <Text style={qStyles.detailedOptionDesc}>{desc}</Text>
    </TouchableOpacity>
  );
}

function PaceOption({ title, desc, badge, selected, onPress }: { title: string; desc: string; badge?: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[qStyles.paceOption, { borderColor: selected ? LIME : CARD_BORDER, backgroundColor: selected ? 'rgba(204,255,0,0.08)' : 'rgba(255,255,255,0.02)' }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {badge && <View style={qStyles.paceBadge}><Text style={qStyles.paceBadgeText}>{badge}</Text></View>}
      <Text style={[qStyles.paceTitle, { color: selected ? '#FFF' : '#CCC' }]}>{title}</Text>
      <Text style={qStyles.paceDesc}>{desc}</Text>
      {selected && (
        <View style={qStyles.optionCheck}>
          <Check size={16} color="#000" strokeWidth={3} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const qStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headline: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 40,
    marginTop: 16,
  },
  headlineWhite: { color: '#FFFFFF' },
  headlineLime: { color: LIME },
  support: {
    fontSize: 16,
    fontWeight: '500',
    color: MUTED,
    marginTop: 12,
    lineHeight: 24,
    marginBottom: 28,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 22,
    fontWeight: '700',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    minHeight: 56,
  },
  inputUnit: {
    fontSize: 16,
    fontWeight: '700',
    color: FAINT,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: FAINT,
    marginBottom: 6,
  },
  dualInputRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  dualInputCol: {
    flex: 1,
    minWidth: 0,
  },
  optionGroup: {
    gap: 10,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  optionCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: LIME,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailedOption: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    gap: 4,
  },
  detailedOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailedOptionTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  detailedOptionDesc: {
    fontSize: 13,
    fontWeight: '500',
    color: '#777',
    lineHeight: 19,
  },
  paceOption: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 18,
    gap: 4,
  },
  paceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: LIME,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  paceBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  paceTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  paceDesc: {
    fontSize: 14,
    fontWeight: '500',
    color: '#777',
  },
  safetyNote: {
    fontSize: 13,
    fontWeight: '500',
    color: '#555',
    marginTop: 20,
    fontStyle: 'italic',
  },
  footer: { paddingHorizontal: 28 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: LIME,
  },
  ctaDisabled: {
    backgroundColor: '#1A1A1A',
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.2,
  },
});

// ─── Plan Screen → "YOUR PATH" ───────────────────────────────────────────────

export function BodyCompPlanScreen({
  result,
  goalLabel,
  onReveal,
  onBack,
}: {
  result: FatLossCalculationResult;
  goalLabel: string;
  onReveal: () => void;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const fade = useSharedValue(0);
  const pathDraw = useSharedValue(0);
  const startNodeOpacity = useSharedValue(0);
  const endNodeOpacity = useSharedValue(0);
  const targetsOpacity = useSharedValue(0);
  const timeframeOpacity = useSharedValue(0);

  // Data-driven direction: descending for weight loss, ascending for gain
  const isDescending = result.targetWeightLbs < result.startingWeightLbs;

  useEffect(() => {
    fade.value = withTiming(1, { duration: 500 });

    // Sequence: start node → path draws → destination resolves → haptic → targets
    startNodeOpacity.value = withDelay(200, withTiming(1, { duration: 300 }));
    pathDraw.value = withDelay(500, withTiming(1, { duration: 1000, easing: Easing.bezier(0.22, 1, 0.36, 1) }));
    endNodeOpacity.value = withDelay(1400, withTiming(1, { duration: 300, easing: Easing.bezier(0.22, 1, 0.36, 1) }));

    // Haptic when destination resolves
    const destTimer = setTimeout(() => hapticLight(), 1500);

    // Timeframe and targets appear after destination
    timeframeOpacity.value = withDelay(1700, withTiming(1, { duration: 400 }));
    targetsOpacity.value = withDelay(1900, withTiming(1, { duration: 400 }));

    return () => clearTimeout(destTimer);
  }, []);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const startNodeStyle = useAnimatedStyle(() => ({ opacity: startNodeOpacity.value }));
  const endNodeStyle = useAnimatedStyle(() => ({ opacity: endNodeOpacity.value }));
  const targetsStyle = useAnimatedStyle(() => ({ opacity: targetsOpacity.value }));
  const timeframeStyle = useAnimatedStyle(() => ({ opacity: timeframeOpacity.value }));

  const pathWidth = Math.max(0, screenWidth - 80);
  const curveHeight = 70;

  // Build S-curve path. For descending: start top-left, end bottom-right.
  // For ascending: start bottom-left, end top-right.
  const startY = isDescending ? 6 : curveHeight - 6;
  const endY = isDescending ? curveHeight - 6 : 6;
  const pathD = `M 6 ${startY} C ${pathWidth * 0.2} ${startY}, ${pathWidth * 0.35} ${(startY + endY) / 2}, ${pathWidth * 0.5} ${(startY + endY) / 2} S ${pathWidth * 0.8} ${endY}, ${pathWidth - 6} ${endY}`;
  const pathLength = pathWidth * 1.35;

  const pathStyle = useAnimatedProps(() => ({
    strokeDashoffset: pathLength * (1 - pathDraw.value),
  }));

  const useStacked = screenWidth < 380;
  const timeframeLabel = result.estimatedWeeks > 0 ? `≈${result.estimatedWeeks} WEEKS` : 'N/A';
  const paceLabel = `at your selected pace of ≈${result.estimatedWeeklyRateLbs} lb/week`;

  return (
    <View style={[planStyles.container, { backgroundColor: DARK, paddingTop: insets.top }]}>
      <View style={planStyles.header}>
        <TouchableOpacity onPress={onBack} style={planStyles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <Animated.View style={[fadeStyle, { flex: 1 }]}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 120 }}>
          {/* Heading */}
          <Text style={planStyles.headline}>
            <Text style={planStyles.headlineWhite}>YOUR{'\n'}</Text>
            <Text style={planStyles.headlineLime}>PATH</Text>
          </Text>
          <Text style={planStyles.support}>
            Here's the starting plan we built around your goal.
          </Text>

          {/* Journey visualization */}
          <View style={planStyles.journeySection}>
            <View style={planStyles.journeyLabelsRow}>
              <View style={planStyles.journeyLabelLeft}>
                <Text style={planStyles.journeyWeight}>{Math.round(result.startingWeightLbs)} lbs</Text>
                <Text style={planStyles.journeyLabel}>YOU ARE HERE</Text>
              </View>
              <View style={planStyles.journeyLabelRight}>
                <Text style={[planStyles.journeyWeight, { color: LIME }]}>{Math.round(result.targetWeightLbs)} lbs</Text>
                <Text style={[planStyles.journeyLabel, { color: LIME }]}>YOUR GOAL</Text>
              </View>
            </View>

            {/* Curved journey path */}
            <View style={[planStyles.pathContainer, { height: curveHeight + 16 }]}>
              <Svg width={pathWidth} height={curveHeight + 16} style={planStyles.pathSvg}>
                {/* Dashed track */}
                <SvgPath
                  d={pathD}
                  stroke="#222"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  fill="none"
                />
                {/* Animated lime path */}
                <AnimatedPath
                  d={pathD}
                  stroke={LIME}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={pathLength}
                  animatedProps={pathStyle}
                />
              </Svg>
              {/* Start node */}
              <Animated.View
                style={[planStyles.pathDotLeft, isDescending ? { top: 0 } : { top: curveHeight - 6 }, startNodeStyle]}
              />
              {/* End node */}
              <Animated.View
                style={[planStyles.pathDotRight, isDescending ? { top: curveHeight - 6 } : { top: 0 }, endNodeStyle]}
              />
            </View>
          </View>

          {/* Timeframe beneath visualization */}
          <Animated.View style={[planStyles.paceSummary, timeframeStyle]}>
            <Text style={planStyles.paceSummaryTime}>{timeframeLabel}</Text>
            <Text style={planStyles.paceSummaryDetail}>{paceLabel}</Text>
          </Animated.View>

          {/* Daily targets — fade in after path completes */}
          <Animated.View style={targetsStyle}>
            <Text style={planStyles.sectionHeader}>YOUR DAILY TARGETS</Text>

            <View style={[planStyles.targetsRow, useStacked && { flexDirection: 'column' }]}>
              <View style={[planStyles.targetCard, useStacked && { width: '100%' }]}>
                <Text style={planStyles.targetValue}>{result.suggestedCalorieTarget.toLocaleString()}</Text>
                <Text style={planStyles.targetLabel}>CALORIES / DAY</Text>
              </View>
              {!useStacked && <View style={planStyles.targetGap} />}
              <View style={[planStyles.targetCard, useStacked && { width: '100%' }]}>
                <Text style={planStyles.targetValue}>{result.suggestedProteinGrams}g</Text>
                <Text style={planStyles.targetLabel}>PROTEIN / DAY</Text>
              </View>
            </View>

            {/* Disclaimer */}
            <Text style={planStyles.disclaimer}>
              These are estimates, not guarantees. Real-world progress varies.
            </Text>
            <Text style={planStyles.medicalNote}>
              If you have a medical condition, are pregnant, or have an eating-disorder history, please seek individualized professional guidance rather than relying on a generic estimate.
            </Text>
          </Animated.View>
        </ScrollView>
      </Animated.View>

      <View style={[planStyles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity style={planStyles.cta} onPress={() => { hapticLight(); onReveal(); }} activeOpacity={0.85}>
          <Text style={planStyles.ctaText}>See My Success Stack</Text>
          <ArrowRight size={20} color="#000" strokeWidth={3} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const planStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headline: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 46,
    marginTop: 12,
  },
  headlineWhite: { color: '#FFFFFF' },
  headlineLime: { color: LIME },
  support: {
    fontSize: 16,
    fontWeight: '500',
    color: MUTED,
    marginTop: 12,
    lineHeight: 24,
    marginBottom: 28,
  },
  journeySection: {
    alignItems: 'center',
  },
  journeyLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  journeyLabelLeft: {
    alignItems: 'flex-start',
  },
  journeyLabelRight: {
    alignItems: 'flex-end',
  },
  journeyWeight: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  journeyLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: FAINT,
    marginTop: 2,
  },
  pathContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pathSvg: {
    position: 'absolute',
  },
  pathDotLeft: {
    position: 'absolute',
    left: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: DARK,
  },
  pathDotRight: {
    position: 'absolute',
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: LIME,
    borderWidth: 2,
    borderColor: DARK,
  },
  paceSummary: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 28,
  },
  paceSummaryTime: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  paceSummaryDetail: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: FAINT,
    marginBottom: 14,
  },
  targetsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  targetGap: {
    width: 12,
  },
  targetCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 4,
  },
  targetValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -1,
  },
  targetLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: FAINT,
  },
  disclaimer: {
    fontSize: 12,
    fontWeight: '500',
    color: '#555',
    marginTop: 28,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  medicalNote: {
    fontSize: 11,
    fontWeight: '500',
    color: '#444',
    marginTop: 10,
    lineHeight: 16,
  },
  footer: { paddingHorizontal: 28 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: LIME,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.2,
  },
});

// ─── Success Stack Screen ─────────────────────────────────────────────────────

export function BodyCompStackScreen({
  result,
  inputs,
  onInputsChange,
  onCommit,
  onBack,
}: {
  result: FatLossCalculationResult;
  inputs: BodyCompStackInput[];
  onInputsChange: (inputs: BodyCompStackInput[]) => void;
  onCommit: () => void;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const fade = useSharedValue(0);
  useEffect(() => { fade.value = withTiming(1, { duration: 500 }); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const toggleInput = (id: string) => {
    hapticLight();
    onInputsChange(inputs.map(inp => inp.id === id ? { ...inp, selected: !inp.selected } : inp));
  };

  const updateInputDetail = (id: string, detail: string) => {
    onInputsChange(inputs.map(inp => inp.id === id ? { ...inp, valueDetail: detail, dailyInput: detail } : inp));
  };

  const coreInputs = inputs.filter(i => ['calories', 'protein', 'steps', 'exercise'].includes(i.category));
  const optionalInputs = inputs.filter(i => ['nutrition_rule', 'hydration', 'bedtime'].includes(i.category));

  return (
    <View style={[stackStyles.container, { backgroundColor: DARK, paddingTop: insets.top }]}>
      <View style={stackStyles.header}>
        <TouchableOpacity onPress={onBack} style={stackStyles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <Animated.View style={[fadeStyle, { flex: 1 }]}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 120 }}>
          <Text style={stackStyles.headline}>
            <Text style={stackStyles.headlineWhite}>RECOMMENDED{'\n'}</Text>
            <Text style={stackStyles.headlineLime}>FOR YOU</Text>
          </Text>
          <Text style={stackStyles.support}>
            Based on your goal and starting point, here's the system we recommend.
          </Text>

          <View style={stackStyles.coreGroup}>
            {coreInputs.map((inp, idx) => (
              <StackTile
                key={inp.id}
                index={idx + 1}
                input={inp}
                onToggle={() => toggleInput(inp.id)}
                onDetailChange={d => updateInputDetail(inp.id, d)}
              />
            ))}
          </View>

          <Text style={stackStyles.optionalHeader}>WANT TO MAKE IT STRONGER?</Text>
          <Text style={stackStyles.optionalSupport}>
            Optional inputs. Add only what you're ready to own every day.
          </Text>

          <View style={stackStyles.optionalGroup}>
            {optionalInputs.map(inp => (
              <OptionalTile
                key={inp.id}
                input={inp}
                onToggle={() => toggleInput(inp.id)}
                onDetailChange={d => updateInputDetail(inp.id, d)}
              />
            ))}
          </View>
        </ScrollView>
      </Animated.View>

      <View style={[stackStyles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity style={stackStyles.cta} onPress={() => { hapticLight(); onCommit(); }} activeOpacity={0.85}>
          <Text style={stackStyles.ctaText}>Continue →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StackTile({
  index,
  input,
  onToggle,
  onDetailChange,
}: {
  index: number;
  input: BodyCompStackInput;
  onToggle: () => void;
  onDetailChange: (detail: string) => void;
}) {
  return (
    <TouchableOpacity
      style={[
        stackStyles.tile,
        {
          borderColor: input.selected ? 'rgba(204,255,0,0.25)' : CARD_BORDER,
          backgroundColor: input.selected ? 'rgba(204,255,0,0.03)' : CARD_BG,
        },
      ]}
      onPress={onToggle}
      activeOpacity={0.85}
    >
      <View style={stackStyles.tileRow}>
        <Text style={stackStyles.tileNumber}>{String(index).padStart(2, '0')}</Text>
        <Text
          style={[
            stackStyles.tileLabel,
            { color: input.selected ? '#FFF' : '#888' },
          ]}
          numberOfLines={1}
        >
          {input.label}
        </Text>
        <View style={[stackStyles.tileCheck, { borderColor: input.selected ? LIME : '#333', backgroundColor: input.selected ? LIME : 'transparent' }]}>
          {input.selected && <Check size={12} color="#000" strokeWidth={3} />}
        </View>
      </View>
      {input.valueDetail && (
        <Text style={stackStyles.tileDetail} numberOfLines={1}>{input.valueDetail}</Text>
      )}
    </TouchableOpacity>
  );
}

function OptionalTile({
  input,
  onToggle,
  onDetailChange,
}: {
  input: BodyCompStackInput;
  onToggle: () => void;
  onDetailChange: (detail: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(input.valueDetail || '');

  const handleAdd = () => {
    hapticLight();
    setExpanded(true);
    onToggle();
  };

  const handleConfirm = () => {
    hapticLight();
    onDetailChange(detail);
    setExpanded(false);
  };

  if (!input.selected && !expanded) {
    return (
      <TouchableOpacity style={stackStyles.optionalAddBtn} onPress={handleAdd} activeOpacity={0.85}>
        <Plus size={16} color={LIME} strokeWidth={2.5} />
        <Text style={stackStyles.optionalAddText}>{input.label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[stackStyles.optionalTile, { borderColor: input.selected ? LIME : CARD_BORDER }]}>
      <View style={stackStyles.optionalHeaderRow}>
        <Text style={[stackStyles.optionalLabel, { color: input.selected ? '#FFF' : '#888' }]}>
          {input.label}
        </Text>
        <TouchableOpacity onPress={() => { hapticLight(); onToggle(); setExpanded(false); setDetail(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={18} color="#555" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
      {input.category === 'nutrition_rule' && (
        <>
          <TextInput
            style={stackStyles.optionalInput}
            value={detail}
            onChangeText={setDetail}
            placeholder="e.g. No added sugar, Whole foods focus, No fast food..."
            placeholderTextColor="#444"
          />
          <TouchableOpacity style={stackStyles.optionalConfirm} onPress={handleConfirm}>
            <Text style={stackStyles.optionalConfirmText}>Add</Text>
          </TouchableOpacity>
        </>
      )}
      {input.category === 'hydration' && (
        <>
          <TextInput
            style={stackStyles.optionalInput}
            value={detail}
            onChangeText={setDetail}
            placeholder="e.g. 100 oz water"
            placeholderTextColor="#444"
          />
          <TouchableOpacity style={stackStyles.optionalConfirm} onPress={handleConfirm}>
            <Text style={stackStyles.optionalConfirmText}>Add</Text>
          </TouchableOpacity>
        </>
      )}
      {input.category === 'bedtime' && (
        <>
          <TextInput
            style={stackStyles.optionalInput}
            value={detail}
            onChangeText={setDetail}
            placeholder="e.g. In bed by 10:30 PM"
            placeholderTextColor="#444"
          />
          <TouchableOpacity style={stackStyles.optionalConfirm} onPress={handleConfirm}>
            <Text style={stackStyles.optionalConfirmText}>Add</Text>
          </TouchableOpacity>
        </>
      )}
      {input.selected && input.valueDetail && !expanded && (
        <Text style={stackStyles.tileDetail}>{input.valueDetail}</Text>
      )}
    </View>
  );
}

const stackStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headline: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 44,
    marginTop: 12,
  },
  headlineWhite: { color: '#FFFFFF' },
  headlineLime: { color: LIME },
  support: {
    fontSize: 16,
    fontWeight: '500',
    color: MUTED,
    marginTop: 12,
    lineHeight: 24,
    marginBottom: 24,
  },
  coreGroup: {
    gap: 10,
  },
  tile: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 2,
  },
  tileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tileNumber: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#444',
    minWidth: 20,
  },
  tileLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  tileCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tileDetail: {
    fontSize: 13,
    fontWeight: '700',
    color: LIME,
    marginLeft: 30,
  },
  optionalHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#666',
    marginTop: 24,
  },
  optionalSupport: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginTop: 6,
    lineHeight: 20,
    marginBottom: 14,
  },
  optionalGroup: {
    gap: 10,
  },
  optionalAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#333',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  optionalAddText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#AAA',
  },
  optionalTile: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  optionalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionalLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  optionalInput: {
    fontSize: 15,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFF',
    backgroundColor: '#111',
  },
  optionalConfirm: {
    alignSelf: 'flex-end',
    backgroundColor: LIME,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  optionalConfirmText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000',
  },
  footer: { paddingHorizontal: 28 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: LIME,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.2,
  },
});

// ─── Commitment Screen ────────────────────────────────────────────────────────

export function BodyCompCommitScreen({
  confirmedInputs,
  onConfirm,
  onAdjust,
  onBack,
}: {
  confirmedInputs: BodyCompStackInput[];
  onConfirm: () => void;
  onAdjust: () => void;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const fade = useSharedValue(0);
  useEffect(() => { fade.value = withTiming(1, { duration: 500 }); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <View style={[commitStyles.container, { backgroundColor: DARK, paddingTop: insets.top }]}>
      <View style={commitStyles.header}>
        <TouchableOpacity onPress={onBack} style={commitStyles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <Animated.View style={[fadeStyle, { flex: 1 }]}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 120 }}>
          <Text style={commitStyles.headline}>
            <Text style={commitStyles.headlineWhite}>YOUR{'\n'}</Text>
            <Text style={commitStyles.headlineLime}>SUCCESS STACK</Text>
          </Text>
          <Text style={commitStyles.support}>
            These are the daily inputs you're committing to for the next 77 days.
          </Text>

          <View style={commitStyles.stackGroup}>
            {confirmedInputs.map((inp, idx) => (
              <View key={inp.id} style={commitStyles.stackRow}>
                <Text style={commitStyles.stackNumber}>{String(idx + 1).padStart(2, '0')}</Text>
                <Text style={commitStyles.stackLabel}>{inp.valueDetail || inp.dailyInput}</Text>
              </View>
            ))}
          </View>

          <Text style={commitStyles.commitQuestion}>
            CAN YOU OWN THESE{'\n'}EVERY DAY FOR 77 DAYS?
          </Text>
        </ScrollView>
      </Animated.View>

      <View style={[commitStyles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity
          style={commitStyles.primaryCta}
          onPress={() => { hapticSuccess(); onConfirm(); }}
          activeOpacity={0.85}
        >
          <Text style={commitStyles.primaryCtaText}>Yes — lock it in →</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={commitStyles.secondaryCta}
          onPress={() => { hapticLight(); onAdjust(); }}
          activeOpacity={0.85}
        >
          <Text style={commitStyles.secondaryCtaText}>I want to adjust my Stack</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const commitStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headline: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 46,
    marginTop: 12,
  },
  headlineWhite: { color: '#FFFFFF' },
  headlineLime: { color: LIME },
  support: {
    fontSize: 16,
    fontWeight: '500',
    color: MUTED,
    marginTop: 12,
    lineHeight: 24,
    marginBottom: 28,
  },
  stackGroup: {
    gap: 14,
  },
  stackRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  stackNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: LIME,
    paddingTop: 2,
  },
  stackLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
    lineHeight: 23,
    flex: 1,
  },
  commitQuestion: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 30,
    color: '#FFF',
    marginTop: 36,
  },
  footer: { paddingHorizontal: 28, gap: 10 },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: LIME,
  },
  primaryCtaText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.2,
  },
  secondaryCta: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryCtaText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
});

// ─── Helper: Build default stack inputs from calculation result ───────────────

export function buildDefaultStackInputs(result: FatLossCalculationResult): BodyCompStackInput[] {
  return [
    {
      id: 'calories',
      label: 'Hit your calorie target',
      dailyInput: `${result.suggestedCalorieTarget} calories or less`,
      when: 'Throughout the day',
      where: '',
      category: 'calories',
      selected: true,
      valueDetail: `${result.suggestedCalorieTarget} calories or less`,
    },
    {
      id: 'protein',
      label: 'Hit your protein target',
      dailyInput: `${result.suggestedProteinGrams}g protein`,
      when: 'Throughout the day',
      where: '',
      category: 'protein',
      selected: true,
      valueDetail: `${result.suggestedProteinGrams}g protein`,
    },
    {
      id: 'steps',
      label: 'Walk 10,000 steps',
      dailyInput: '10,000 steps',
      when: 'Throughout the day',
      where: '',
      category: 'steps',
      selected: true,
      valueDetail: '10,000 steps',
    },
    {
      id: 'exercise',
      label: 'Exercise 30 minutes',
      dailyInput: '30 min exercise',
      when: '',
      where: '',
      category: 'exercise',
      selected: true,
      valueDetail: '30 min exercise',
    },
    {
      id: 'nutrition_rule',
      label: 'Add a nutrition rule',
      dailyInput: '',
      when: 'Throughout the day',
      where: '',
      category: 'nutrition_rule',
      selected: false,
    },
    {
      id: 'hydration',
      label: 'Add a hydration target',
      dailyInput: '',
      when: 'Throughout the day',
      where: '',
      category: 'hydration',
      selected: false,
    },
    {
      id: 'bedtime',
      label: 'Add a bedtime',
      dailyInput: '',
      when: 'Evening',
      where: '',
      category: 'bedtime',
      selected: false,
    },
  ];
}
