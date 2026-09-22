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
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import { ArrowLeft, ArrowRight, Check, Plus, X, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
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
const CARD_BORDER = '#222';
const FAINT = '#555';
const MUTED = '#888';

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

function hapticSuccess(): void {
  if (Platform.OS !== 'web') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
}

function hapticMedium(): void {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
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
  finalTitle,
  finalSubtitle,
  onReveal,
}: {
  stages: ReverseEngineeringStage[];
  finalTitle: string;
  finalSubtitle: string;
  onReveal: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [completedStages, setCompletedStages] = useState<number>(-1);
  const [allDone, setAllDone] = useState(false);
  const headlineOpacity = useSharedValue(0);
  const ctaOpacity = useSharedValue(0);

  // Circular progress — driven by stage completion (0..1)
  const progress = useSharedValue(0);
  // Ring color transition from gray track to lime
  const ringColorR = useSharedValue(85);
  const ringColorG = useSharedValue(85);
  const ringColorB = useSharedValue(85);
  // Completion burst
  const boltScale = useSharedValue(0);
  const glowScale = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  // Energy wave animation values
  const wave1X = useSharedValue(0);
  const wave2X = useSharedValue(0);
  const wave3X = useSharedValue(0);
  const waveAmplitude = useSharedValue(1);
  const waveOpacity = useSharedValue(0.15);

  useEffect(() => {
    headlineOpacity.value = withTiming(1, { duration: 600 });

    // Start energy wave loops — noisy at first, stabilize as progress increases
    wave1X.value = withRepeat(withTiming(-60, { duration: 1800 }), -1, true);
    wave2X.value = withRepeat(withTiming(40, { duration: 2200 }), -1, true);
    wave3X.value = withRepeat(withTiming(-30, { duration: 2800 }), -1, true);

    let currentStage = 0;

    const advance = () => {
      if (currentStage >= stages.length) {
        // ── Completion moment ──
        progress.value = withTiming(1, { duration: 500, easing: Easing.bezier(0.22, 1, 0.36, 1) });

        // Ring transitions to full lime
        ringColorR.value = withTiming(204, { duration: 500 });
        ringColorG.value = withTiming(255, { duration: 500 });
        ringColorB.value = withTiming(0, { duration: 500 });

        // Energy wave stabilizes and concentrates
        waveAmplitude.value = withTiming(0.3, { duration: 600 });
        waveOpacity.value = withTiming(0.05, { duration: 600 });

        // Brief pause, then bolt + glow burst
        setTimeout(() => {
          boltScale.value = withSequence(
            withTiming(0, { duration: 0 }),
            withTiming(1.3, { duration: 250, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
            withTiming(1, { duration: 150 }),
          );
          glowScale.value = withSequence(
            withTiming(0, { duration: 0 }),
            withTiming(1.8, { duration: 600, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
          );
          glowOpacity.value = withSequence(
            withTiming(0.6, { duration: 200 }),
            withTiming(0, { duration: 500 }),
          );

          // Stabilize wave after burst
          waveAmplitude.value = withDelay(300, withTiming(0.15, { duration: 400 }));

          hapticSuccess();

          setTimeout(() => {
            runOnJS(setAllDone)(true);
            ctaOpacity.value = withDelay(300, withTiming(1, { duration: 500 }));
          }, 700);
        }, 400);

        return;
      }

      setCompletedStages(currentStage);

      // Advance circular progress by ~1/stages
      const targetProgress = (currentStage + 1) / stages.length;
      progress.value = withTiming(targetProgress, {
        duration: 600,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      });

      // Gradually shift ring color toward lime as progress increases
      const intensity = targetProgress;
      ringColorR.value = withTiming(85 + (204 - 85) * intensity * 0.6, { duration: 600 });
      ringColorG.value = withTiming(85 + (255 - 85) * intensity * 0.6, { duration: 600 });
      ringColorB.value = withTiming(85 - 85 * intensity * 0.6, { duration: 600 });

      // Wave gradually organizes
      waveAmplitude.value = withTiming(1 - intensity * 0.5, { duration: 600 });

      // Subtle haptic per stage
      hapticLight();

      currentStage++;
      setTimeout(advance, 1100);
    };

    const timer = setTimeout(advance, 800);
    return () => {
      clearTimeout(timer);
      cancelAnimation(wave1X);
      cancelAnimation(wave2X);
      cancelAnimation(wave3X);
    };
  }, []);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: headlineOpacity.value }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaOpacity.value }));

  // Circular progress animated styles
  const ringStyle = useAnimatedStyle(() => {
    const color = `rgb(${Math.round(ringColorR.value)}, ${Math.round(ringColorG.value)}, ${Math.round(ringColorB.value)})`;
    return {
      borderColor: color,
      transform: [{ rotate: `${progress.value * 360}deg` }],
    };
  });

  // Conic-gradient-style progress using rotation + masked arc
  // We simulate circular progress with a rotating half-ring overlay
  const progressArcStyle = useAnimatedStyle(() => {
    const pct = progress.value;
    return {
      opacity: pct > 0 ? 1 : 0,
      transform: [{ rotate: `${pct * 360}deg` }],
    };
  });

  const boltStyle = useAnimatedStyle(() => ({
    transform: [{ scale: boltScale.value }],
    opacity: boltScale.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: glowOpacity.value,
  }));

  // Energy wave animated styles
  const wave1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: wave1X.value }],
    opacity: waveOpacity.value,
  }));
  const wave2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: wave2X.value }],
    opacity: waveOpacity.value,
  }));
  const wave3Style = useAnimatedStyle(() => ({
    transform: [{ translateX: wave3X.value }],
    opacity: waveOpacity.value,
  }));
  const waveAmpStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: waveAmplitude.value }],
  }));

  return (
    <View style={[reStyles.container, { backgroundColor: DARK, paddingTop: insets.top }]}>
      <Animated.View style={[fadeStyle, { flex: 1, paddingHorizontal: 28 }]}>
        {!allDone ? (
          <>
            <Text style={reStyles.eyebrow}>REVERSE ENGINEERING</Text>
            <Text style={reStyles.headline}>
              <Text style={reStyles.headlineWhite}>REVERSE ENGINEERING{'\n'}</Text>
              <Text style={reStyles.headlineLime}>YOUR GOAL...</Text>
            </Text>

            {/* Energy wave + circular progress */}
            <View style={reStyles.vizContainer}>
              <View style={reStyles.vizInner}>
                {/* Energy wave bars */}
                <Animated.View style={[reStyles.waveWrap, waveAmpStyle]} >
                  <Animated.View style={[reStyles.waveBar, reStyles.waveBar1, wave1Style]} />
                  <Animated.View style={[reStyles.waveBar, reStyles.waveBar2, wave2Style]} />
                  <Animated.View style={[reStyles.waveBar, reStyles.waveBar3, wave3Style]} />
                  <Animated.View style={[reStyles.waveBar, reStyles.waveBar4, wave1Style]} />
                  <Animated.View style={[reStyles.waveBar, reStyles.waveBar5, wave3Style]} />
                </Animated.View>

                {/* Circular progress ring */}
                <View style={reStyles.ringOuter}>
                  {/* Glow burst on completion */}
                  <Animated.View style={[reStyles.glowBurst, glowStyle]} />

                  {/* Track (dark gray) */}
                  <View style={reStyles.ringTrack} />

                  {/* Progress arc (lime, rotates) */}
                  <Animated.View style={[reStyles.ringProgress, progressArcStyle]} />

                  {/* Center content: stage count or bolt on completion */}
                  <View style={reStyles.ringCenter}>
                    {completedStages >= stages.length - 1 ? (
                      <Animated.View style={boltStyle}>
                        <Zap size={28} color={LIME} fill={LIME} strokeWidth={1.5} />
                      </Animated.View>
                    ) : (
                      <Text style={reStyles.ringPercent}>
                        {Math.round(((completedStages + 1) / stages.length) * 100)}%
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </View>

            {/* Stage list */}
            <View style={{ marginTop: 24, gap: 18 }}>
              {stages.map((stage, idx) => {
                const isComplete = completedStages >= idx;
                const isActive = completedStages === idx - 1 || (idx === 0 && completedStages === -1);
                return (
                  <StageRow
                    key={idx}
                    stage={stage}
                    isComplete={isComplete}
                    isActive={isActive && !isComplete}
                  />
                );
              })}
            </View>
          </>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-start' }}>
            <Text style={reStyles.finalTitle}>
              <Text style={reStyles.headlineWhite}>YOUR SYSTEM{'\n'}</Text>
              <Text style={reStyles.headlineLime}>IS READY.</Text>
            </Text>
            <Text style={reStyles.finalSubtitle}>{finalSubtitle}</Text>
          </View>
        )}
      </Animated.View>

      <Animated.View style={[ctaStyle, { paddingHorizontal: 28, paddingBottom: insets.bottom + 24 }]}>
        {allDone && (
          <TouchableOpacity
            style={reStyles.cta}
            onPress={() => { hapticMedium(); onReveal(); }}
            activeOpacity={0.85}
          >
            <Text style={reStyles.ctaText}>Reveal My Success Stack</Text>
            <ArrowRight size={20} color="#000" strokeWidth={3} />
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

function StageRow({
  stage,
  isComplete,
  isActive,
}: {
  stage: ReverseEngineeringStage;
  isComplete: boolean;
  isActive: boolean;
}) {
  const checkScale = useSharedValue(0);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    if (isComplete) {
      checkScale.value = withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1, { duration: 300, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
      );
      textOpacity.value = withTiming(1, { duration: 400 });
    } else if (isActive) {
      textOpacity.value = withTiming(0.6, { duration: 400 });
    } else {
      textOpacity.value = withTiming(0.2, { duration: 300 });
    }
  }, [isComplete, isActive]);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));

  return (
    <Animated.View style={[reStyles.stageRow, textStyle]}>
      <View style={reStyles.stageNumberWrap}>
        <Text style={[reStyles.stageNumber, { color: isComplete ? LIME : FAINT }]}>
          {stage.number}
        </Text>
        <Animated.View style={[reStyles.checkWrap, checkStyle]}>
          <View style={reStyles.checkCircle}>
            <Check size={14} color="#000" strokeWidth={3} />
          </View>
        </Animated.View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[reStyles.stageTitle, { color: isComplete ? '#FFF' : MUTED }]}>
          {stage.title}
        </Text>
        <Text style={[reStyles.stageDesc, { color: isComplete ? '#AAA' : '#444' }]}>
          {isComplete && stage.resultValue ? stage.resultValue : stage.description}
        </Text>
      </View>
    </Animated.View>
  );
}

const reStyles = StyleSheet.create({
  container: { flex: 1 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: FAINT,
    marginTop: 24,
  },
  headline: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 44,
    marginTop: 8,
  },
  headlineWhite: { color: '#FFFFFF' },
  headlineLime: { color: LIME },
  finalTitle: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 46,
  },
  finalSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: MUTED,
    marginTop: 12,
    lineHeight: 24,
  },
  vizContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    height: 140,
  },
  vizInner: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveWrap: {
    position: 'absolute',
    width: 120,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: LIME,
  },
  waveBar1: { height: 28 },
  waveBar2: { height: 44 },
  waveBar3: { height: 20 },
  waveBar4: { height: 36 },
  waveBar5: { height: 16 },
  ringOuter: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowBurst: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: LIME,
  },
  ringTrack: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#222',
  },
  ringProgress: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderTopColor: LIME,
    borderRightColor: LIME,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPercent: {
    fontSize: 18,
    fontWeight: '900',
    color: '#AAA',
  },
  stageRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  stageNumberWrap: {
    width: 32,
    alignItems: 'center',
    paddingTop: 2,
  },
  stageNumber: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  checkWrap: {
    marginTop: 4,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: LIME,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  stageDesc: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 2,
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
      <Text style={bcStyles.flowArrowText}>→</Text>
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
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 48,
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
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
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

// ─── Plan Screen ──────────────────────────────────────────────────────────────

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
  const fade = useSharedValue(0);
  useEffect(() => { fade.value = withTiming(1, { duration: 500 }); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const planRows = [
    { label: 'GOAL', value: goalLabel },
    { label: 'STARTING WEIGHT', value: `${result.startingWeightLbs} lbs` },
    { label: 'TARGET WEIGHT', value: `${result.targetWeightLbs} lbs` },
    { label: 'ESTIMATED CALORIE TARGET', value: `~${result.suggestedCalorieTarget} / day` },
    { label: 'ESTIMATED PROTEIN TARGET', value: `~${result.suggestedProteinGrams}g / day` },
    { label: 'ESTIMATED PACE', value: `~${result.estimatedWeeklyRateLbs} lbs / week` },
    { label: 'ESTIMATED TIMEFRAME', value: result.estimatedWeeks > 0 ? `~${result.estimatedWeeks} weeks` : 'N/A' },
  ];

  return (
    <View style={[planStyles.container, { backgroundColor: DARK, paddingTop: insets.top }]}>
      <View style={planStyles.header}>
        <TouchableOpacity onPress={onBack} style={planStyles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <Animated.View style={[fadeStyle, { flex: 1 }]}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 120 }}>
          <Text style={planStyles.headline}>
            <Text style={planStyles.headlineWhite}>YOUR{'\n'}</Text>
            <Text style={planStyles.headlineLime}>PLAN</Text>
          </Text>
          <Text style={planStyles.support}>
            Here's the starting plan we built from your goal and the information you gave us.
          </Text>

          <View style={planStyles.cardGroup}>
            {planRows.map((row, i) => (
              <View key={i} style={[planStyles.cardRow, i < planRows.length - 1 && planStyles.cardRowBorder]}>
                <Text style={planStyles.cardLabel}>{row.label}</Text>
                <Text style={planStyles.cardValue}>{row.value}</Text>
              </View>
            ))}
          </View>

          <Text style={planStyles.disclaimer}>
            These are estimates, not guarantees. Real-world progress varies.
          </Text>
          <Text style={planStyles.medicalNote}>
            If you have a medical condition, are pregnant, or have an eating-disorder history, please seek individualized professional guidance rather than relying on a generic estimate.
          </Text>
        </ScrollView>
      </Animated.View>

      <View style={[planStyles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity style={planStyles.cta} onPress={() => { hapticLight(); onReveal(); }} activeOpacity={0.85}>
          <Text style={planStyles.ctaText}>Reveal My Success Stack</Text>
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
    marginBottom: 24,
  },
  cardGroup: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
  },
  cardRow: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 4,
  },
  cardRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: FAINT,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  disclaimer: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    marginTop: 20,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  medicalNote: {
    fontSize: 12,
    fontWeight: '500',
    color: '#444',
    marginTop: 12,
    lineHeight: 18,
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
      style={[stackStyles.tile, { borderColor: input.selected ? LIME : CARD_BORDER, backgroundColor: input.selected ? 'rgba(204,255,0,0.04)' : 'rgba(255,255,255,0.02)' }]}
      onPress={onToggle}
      activeOpacity={0.85}
    >
      <View style={stackStyles.tileHeader}>
        <Text style={stackStyles.tileNumber}>{String(index).padStart(2, '0')}</Text>
        <View style={[stackStyles.tileCheck, { borderColor: input.selected ? LIME : '#333', backgroundColor: input.selected ? LIME : 'transparent' }]}>
          {input.selected && <Check size={14} color="#000" strokeWidth={3} />}
        </View>
      </View>
      <Text style={[stackStyles.tileLabel, { color: input.selected ? '#FFF' : '#888' }]}>
        {input.label}
      </Text>
      {input.valueDetail && (
        <Text style={stackStyles.tileDetail}>{input.valueDetail}</Text>
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
    gap: 12,
  },
  tile: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    gap: 4,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileNumber: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: FAINT,
  },
  tileCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  tileDetail: {
    fontSize: 13,
    fontWeight: '600',
    color: LIME,
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
