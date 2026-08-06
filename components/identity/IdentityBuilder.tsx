/**
 * IdentityBuilder — Phase 2A.
 *
 * Contains the full phase machine from ReverseEngineerMockup. The only
 * difference from the mockup: instead of going to paywall after the
 * signature, we assemble IdentityBuilderResult and call onComplete().
 *
 * Sacred contracts kept:
 *  - onComplete(result) is the single exit point (no paywall here).
 *  - Dimension: category, label, vague, specific, icon always present.
 *  - compass: vision=Big Domino label, declaration='', filterQuestion=full question.
 *  - inputs[]+rawInputs[] = flat list of ALL locked inputs across all goals.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  PanResponder,
  Animated as RNAnimated,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Confetti from '@/components/Confetti';
import Svg, { Path as SvgPath, Line as SvgLine } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  interpolate,
  Easing,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import { ArrowLeft, Check, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { IdentityBuilderResult, RawInputEntry, Dimension } from './types';
import { WhenPickerValue } from './WhenPickerModal';
import { DecodePath, FlowGoal, AnchoredInput, LockedGoal } from './flow/types';
import { WelcomeSeriesScreen } from './flow/WelcomeScreens';
import { GoalsEntryScreen, IntroScreen, GoalDoneLooksScreen, GoalFuelRedirectScreen } from './flow/GoalsEntry';
import { PathSelectorScreen, PathNumbers, PathPractice, PathStarting } from './flow/PathScreens';
import { AnchorScreen, AddInputScreen, GoalLockedScreen, GoalBadge, formatGoalLabel, displayGoalLabel } from './flow/AnchorScreens';
import { AiDailyInputsScreen } from './flow/AiDailyInputsScreen';
import { logInputFeedback, InputSource } from './flow/InputValidation';
import { IdentityScreen, deriveIdentityLine, formatTargetDisplay } from './flow/IdentityScreens';
import { CompassStoryScreen, CompassDominoScreen, CompassMechanismScreen } from './flow/CompassScreens';
import { FinaleScreen } from './flow/FinaleScreens';
import { generateIdentityStatements } from './identityAi';
import { supabase } from '@/lib/supabase';
import { CHALLENGE_RULES } from '@/constants/challengeRules';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Helpers (local — result assembly only) ───────────────────────────────────

type ExtendedLockedGoal = LockedGoal & {
  dailyNumber?: number;
  winNoun?: string;
  actionNoun?: string;
  ratio?: number;
};

function normalizeTarget(raw: string): string {
  const s = raw.trim();
  const withDollar = s.startsWith('$') ? s : `$${s}`;
  return withDollar.replace(/([kmKM])$/, m => m.toUpperCase());
}

function normalizeMoneyInLabel(label: string): string {
  const hasMoneyContext = /\$|earn|make|revenue|income|profit|save|salary|sales/i.test(label);
  if (!hasMoneyContext) return label;
  return label.replace(
    /(\$\s*)?(\d[\d,]*(?:\.\d+)?)\s*([kKmM])\b/g,
    (_, _dollar, num, suf) => `$${num}${suf.toUpperCase()}`,
  );
}

const DIGIT_COMMA_PLACEHOLDER = '\u200B';

let _goalIdSeq = 100;

function parseGoalsFromText(text: string): FlowGoal[] {
  const protected_ = text.replace(/(\d),(\d)/g, `$1${DIGIT_COMMA_PLACEHOLDER}$2`);
  const parts = protected_
    .split(',')
    .map(s => s.trim().replace(new RegExp(DIGIT_COMMA_PLACEHOLDER, 'g'), ','))
    .filter(s => s.length > 0);
  if (parts.length === 0) return HARDCODED_GOALS;
  return parts.map(rawLabel => ({
    id: ++_goalIdSeq,
    label: normalizeMoneyInLabel(rawLabel),
    category: 'General',
    deadline: 'ongoing',
    defaultPath: 'starting' as DecodePath,
  }));
}

// ─── Result assembly ──────────────────────────────────────────────────────────

function buildIdentityStatement(
  goals: FlowGoal[],
  locked: ExtendedLockedGoal[],
  acceptedIdentity: Record<number, string>,
): string {
  const lines = goals.map(g => {
    const text = acceptedIdentity[g.id];
    if (text !== undefined) return text;
    const lock = locked.find(l => l.goalId === g.id);
    if (!lock) return null;
    const shape = deriveIdentityLine(lock);
    return shape.kind === 'sentence' ? shape.text : shape.finishLine;
  }).filter(Boolean) as string[];
  return lines.join('\n');
}

function buildDimensions(
  goals: FlowGoal[],
  locked: ExtendedLockedGoal[],
  goalLabelOverrides: Record<number, string>,
): Dimension[] {
  return goals.map(g => {
    const lock = locked.find(l => l.goalId === g.id);
    const specific = lock ? displayGoalLabel(lock) : formatGoalLabel(g, goalLabelOverrides);
    const dim: Dimension = {
      category: g.category !== 'General' ? g.category.toLowerCase() : 'personal',
      label: formatGoalLabel(g, goalLabelOverrides),
      vague: g.label,
      specific,
      icon: 'Target',
    };
    if (lock) {
      dim.decodePath = lock.decodePath;
      if (lock.resolvedTargetStr) dim.resolvedTargetStr = lock.resolvedTargetStr;
      if (lock.isStandard !== undefined) dim.isStandard = lock.isStandard;
      if (lock.dailyNumber !== undefined) dim.dailyNumber = lock.dailyNumber;
      if (lock.winNoun !== undefined) dim.winNoun = lock.winNoun;
      if (lock.actionNoun !== undefined) dim.actionNoun = lock.actionNoun;
      if (lock.ratio !== undefined) dim.ratio = lock.ratio;
    }
    return dim;
  });
}

function buildInputsAndRaw(locked: ExtendedLockedGoal[]): {
  inputs: string[];
  rawInputs: RawInputEntry[];
} {
  const inputs: string[] = [];
  const rawInputs: RawInputEntry[] = [];
  locked.forEach(lock => {
    inputs.push(lock.dailyInput);
    rawInputs.push({ what: lock.what, when_time: lock.when, where_location: lock.where, schedule: lock.schedule });
    lock.additionalInputs.forEach(inp => {
      inputs.push(inp.dailyInput);
      rawInputs.push({ what: inp.dailyInput, when_time: inp.when, where_location: inp.where, schedule: inp.schedule });
    });
  });
  return { inputs, rawInputs };
}

// ─── Signature screen (inline — owns result assembly + onComplete call) ───────

function SignatureScreen({
  locked,
  displayName,
  onComplete,
}: {
  locked: ExtendedLockedGoal[];
  displayName: string;
  onComplete: () => Promise<boolean>;
}) {
  const { colors, isDark } = useTheme();
  const screenFade = useSharedValue(0);
  useEffect(() => { screenFade.value = withTiming(1, { duration: 500 }); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: screenFade.value }));

  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [committed, setCommitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [sigActive, setSigActive] = useState(false);
  const placeholderAnim = useRef(new RNAnimated.Value(1)).current;
  const hasSig = paths.length > 0 || currentPath.length > 0;

  useEffect(() => {
    if (hasSig) {
      RNAnimated.timing(placeholderAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }
  }, [hasSig]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => {
        setSigActive(true);
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(`M${locationX.toFixed(1)},${locationY.toFixed(1)}`);
      },
      onPanResponderMove: evt => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(prev => `${prev} L${locationX.toFixed(1)},${locationY.toFixed(1)}`);
      },
      onPanResponderRelease: () => {
        setSigActive(false);
        setCurrentPath(prev => {
          if (prev) setPaths(ps => [...ps, prev]);
          return '';
        });
      },
      onPanResponderTerminate: () => setSigActive(false),
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const checklistItems: string[] = [];
  locked.forEach(lock => {
    if (lock.dailyInput) checklistItems.push(lock.dailyInput);
    lock.additionalInputs.forEach(inp => { if (inp.dailyInput) checklistItems.push(inp.dailyInput); });
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={sigStyles.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={!sigActive}
    >
      <Animated.View style={[fadeStyle, { gap: 0 }]}>
        <Text style={[sigStyles.headline, { color: colors.text, marginBottom: 6 }]}>
          {displayName
            ? <>
                {'I, '}
                <Text style={{ color: colors.primary }}>{displayName}</Text>
                {', commit to hitting\nmy daily inputs\nevery day for '}
                <Text style={{ color: colors.primary }}>{'77 days'}</Text>
                {'.'}
              </>
            : <>
                {'I commit to hitting\nmy daily inputs\nevery day for '}
                <Text style={{ color: colors.primary }}>{'77 days'}</Text>
                {'.'}
              </>
          }
        </Text>

        <View style={[sigStyles.checklistCard, {
          backgroundColor: isDark ? colors.backgroundSecondary : '#F6F6F6',
          borderColor: colors.border,
          marginTop: 24,
          marginBottom: 28,
        }]}>
          {checklistItems.length === 0 ? (
            <View style={sigStyles.checkRow}>
              <View style={[sigStyles.checkCircle, { borderColor: colors.primary }]}>
                <Check size={11} color={colors.primary} strokeWidth={3} />
              </View>
              <Text style={[sigStyles.checkText, { color: colors.text }]}>Show up every day.</Text>
            </View>
          ) : (
            checklistItems.map((item, idx) => (
              <View key={idx} style={[sigStyles.checkRow, idx < checklistItems.length - 1 && {
                borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10,
              }]}>
                <View style={[sigStyles.checkCircle, {
                  borderColor: colors.primary,
                  backgroundColor: isDark ? 'rgba(204,255,0,0.12)' : 'rgba(204,255,0,0.18)',
                }]}>
                  <Check size={11} color={colors.primary} strokeWidth={3} />
                </View>
                <Text style={[sigStyles.checkText, { color: colors.text }]}>{item}</Text>
              </View>
            ))
          )}
        </View>

        <View style={[sigStyles.rulesBlock, { borderColor: colors.border }]}>
          <Text style={[sigStyles.rulesEyebrow, { color: colors.primary }]}>THE RULES</Text>
          {CHALLENGE_RULES.map((rule, i) => (
            <Text key={i} style={[sigStyles.rulesLine, { color: colors.textSecondary }]}>
              {i + 1}.{'  '}{rule}
            </Text>
          ))}
        </View>

        <Text style={[sigStyles.sigLabel, { color: colors.textSecondary, marginBottom: 10 }]}>
          Sign your name in the box to continue
        </Text>

        <View
          style={[sigStyles.sigPad, { backgroundColor: isDark ? '#0A0A0A' : '#111', borderColor: isDark ? '#333' : '#222' }]}
          {...panResponder.panHandlers}
        >
          <RNAnimated.View style={[StyleSheet.absoluteFill, { opacity: placeholderAnim }]} pointerEvents="none">
            <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 220">
              <SvgLine x1="40" y1="158" x2="360" y2="158" stroke="#888" strokeWidth="1" strokeDasharray="4,6" opacity="0.35" />
              <SvgPath
                d="M 55 155 C 60 130, 72 130, 78 148 C 84 166, 88 140, 96 145 C 106 151, 110 138, 118 142 C 128 147, 130 135, 140 140 C 150 145, 155 133, 164 138 C 174 144, 178 132, 188 136 C 200 140, 205 128, 216 133 C 228 138, 232 126, 244 130"
                stroke="#888" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.35"
              />
              <SvgLine x1="344" y1="32" x2="356" y2="44" stroke="#888" strokeWidth="1.5" opacity="0.35" />
              <SvgLine x1="356" y1="32" x2="344" y2="44" stroke="#888" strokeWidth="1.5" opacity="0.35" />
            </Svg>
          </RNAnimated.View>
          <Svg style={StyleSheet.absoluteFill}>
            {paths.map((d, i) => (
              <SvgPath key={i} d={d} stroke="#CCFF00" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {currentPath ? (
              <SvgPath d={currentPath} stroke="#CCFF00" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
          </Svg>
          {hasSig && (
            <TouchableOpacity style={sigStyles.clearBtn} onPress={() => { setPaths([]); setCurrentPath(''); }}>
              <Text style={[sigStyles.clearText, { color: '#666' }]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {submitError && (
          <View style={{ marginTop: 24, paddingHorizontal: 24, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#FF4444', textAlign: 'center', lineHeight: 20 }}>
              Something went wrong creating your challenge. Please try again.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[sigStyles.ctaBtn, {
            backgroundColor: hasSig ? '#CCFF00' : (isDark ? '#1C2400' : '#D8E8C0'),
            marginTop: submitError ? 16 : 24,
            opacity: (hasSig && !submitting) ? 1 : 0.38,
          }]}
          onPress={async () => {
            if (!hasSig || submitting) return;
            setCommitted(true);
            setSubmitting(true);
            setSubmitError(false);
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            const success = await onComplete();
            if (!success) {
              setSubmitting(false);
              setSubmitError(true);
              setCommitted(false);
            }
          }}
          activeOpacity={(hasSig && !submitting) ? 0.85 : 1}
          disabled={!hasSig || submitting}
        >
          {submitting ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator size="small" color="#000" />
              <Text style={[sigStyles.ctaText, { color: '#000' }]}>
                Creating your challenge...
              </Text>
            </View>
          ) : (
            <Text style={[sigStyles.ctaText, { color: hasSig ? '#000' : (isDark ? '#3A4A00' : '#7A9A40') }]}>
              {submitError ? 'Try Again' : 'Start My 77-Day Challenge'}
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

const sigStyles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 48 },
  headline: { fontSize: 36, fontWeight: '900' as const, letterSpacing: -1, lineHeight: 44 },
  checklistCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  checkRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 12 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: 2 },
  checkText: { flex: 1, fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
  rulesBlock: { borderTopWidth: 1, paddingTop: 20, marginBottom: 20, gap: 8 },
  rulesEyebrow: { fontSize: 10, fontWeight: '800' as const, letterSpacing: 1.4, textTransform: 'uppercase' as const, marginBottom: 4 },
  rulesLine: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  sigLabel: { fontSize: 13, fontWeight: '500' as const },
  sigPad: { height: 220, borderRadius: 16, borderWidth: 1, overflow: 'hidden' as const },
  clearBtn: { position: 'absolute' as const, top: 10, right: 14 },
  clearText: { fontSize: 13, fontWeight: '600' as const },
  ctaBtn: { borderRadius: 16, paddingVertical: 18, alignItems: 'center' as const, justifyContent: 'center' as const },
  ctaText: { fontSize: 17, fontWeight: '800' as const, letterSpacing: 0.2 },
});

// ─── Hard-coded demo goals (shown on the demo route, not in live flow) ────────

const HARDCODED_GOALS: FlowGoal[] = [
  {
    id: 1,
    label: 'earning $25,000/month consistently',
    deriveLabel: (t: string) => `earning ${t}/month consistently`,
    category: 'Revenue / Income',
    deadline: 'ongoing',
    inheritedTarget: '$25,000',
    defaultPath: 'numbers',
  },
  {
    id: 2,
    label: 'losing 20 lbs',
    category: 'Health & Fitness',
    deadline: '6 months',
    defaultPath: 'practice',
  },
  {
    id: 3,
    label: 'being a present, patient dad',
    category: 'Relationships',
    deadline: 'ongoing',
    practiceSeed: 'phone away 5–8pm',
    defaultPath: 'starting',
  },
];

// ─── Phase union ──────────────────────────────────────────────────────────────

type Phase =
  | { kind: 'welcome'; screen: 0 | 1 | 2 }
  | { kind: 'goals-entry' }
  | { kind: 'intro' }
  | { kind: 'classifying'; goalIdx: number }
  | { kind: 'path-select'; goalIdx: number }
  | { kind: 'goal-done-looks'; goalIdx: number; chosenPath: DecodePath; doneLooksInitial?: string }
  | { kind: 'goal-fuel-redirect'; goalIdx: number; practiceText: string; redirectInitial?: string }
  | { kind: 'decode'; goalIdx: number; path: DecodePath; doneLooksText?: string }
  | { kind: 'anchor'; goalIdx: number; dailyInput: string; isStandard?: boolean; decodePath: DecodePath; resolvedTargetStr?: string; doneLooksText?: string; dailyNumber?: number; winNoun?: string; actionNoun?: string; ratio?: number; periodSuffix?: 'week' | 'month' | 'year' }
  | { kind: 'ai-daily-inputs' }
  | { kind: 'add-input'; goalIdx: number; prefillText?: string }
  | { kind: 'locked'; goalIdx: number; dailyInput: string }
  | { kind: 'identity' }
  | { kind: 'compass-story' }
  | { kind: 'compass-domino' }
  | { kind: 'compass-mechanism'; dominoGoalId: number }
  | { kind: 'finale'; beat: 0 | 1 | 2 }
  | { kind: 'signature' };

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (result: IdentityBuilderResult) => Promise<boolean>;
}

export default function IdentityBuilder({ onComplete }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<Phase>({ kind: 'welcome', screen: 0 });
  const [history, setHistory] = useState<Phase[]>([]);
  const [goals, setGoals] = useState<FlowGoal[]>(HARDCODED_GOALS);
  const [locked, setLocked] = useState<ExtendedLockedGoal[]>([]);
  const [decodeResults, setDecodeResults] = useState<Record<number, string>>({});
  const [goalLabelOverrides, setGoalLabelOverrides] = useState<Record<number, string>>({});
  const [identityOverrides, setIdentityOverrides] = useState<Record<number, string>>({});
  const [aiStatements, setAiStatements] = useState<Record<number, string>>({});
  const [acceptedIdentity, setAcceptedIdentity] = useState<Record<number, string> | null>(null);
  const [compassFilter, setCompassFilter] = useState<string>('');
  const requestedGoalIds = useRef<Set<number>>(new Set());
  const [dominoGoalId, setDominoGoalId] = useState<number | null>(null);
  const [savedStates, setSavedStates] = useState<Record<string, string>>({});
  const [displayName, setDisplayName] = useState<string>('');
  const [isAiSourced, setIsAiSourced] = useState(false);
  const [aiSelectedInputs, setAiSelectedInputs] = useState<Record<number, string[]>>({});
  const [aiIdentityLines, setAiIdentityLines] = useState<Record<number, string>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user;
      if (!user) return;

      // 1. Check auth user_metadata first (populated at signup).
      const meta = user.user_metadata;
      const metaName = [meta?.first_name, meta?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (metaName) {
        setDisplayName(metaName);
        return;
      }

      // 2. Fall back to profiles.display_name for existing/social users.
      supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data: profile }) => {
          const name = profile?.display_name?.trim() ?? '';
          if (name) setDisplayName(name);
        });
    });
  }, []);

  const screenAnim = useSharedValue(1);
  const slideAnim = useSharedValue(0);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: screenAnim.value,
    transform: [{ translateY: slideAnim.value }],
    flex: 1,
  }));

  const saveState = (key: string, value: string) => setSavedStates(prev => ({ ...prev, [key]: value }));

  const phaseKey = (p: Phase): string => {
    switch (p.kind) {
      case 'welcome': return `welcome-${p.screen}`;
      case 'path-select': return `path-select-${p.goalIdx}`;
      case 'goal-done-looks': return `done-looks-${p.goalIdx}-${p.chosenPath}`;
      case 'goal-fuel-redirect': return `fuel-redirect-${p.goalIdx}`;
      case 'decode': return `decode-${p.goalIdx}-${p.path}`;
      case 'anchor': return `anchor-${p.goalIdx}`;
      case 'add-input': return `add-input-${p.goalIdx}`;
      case 'locked': return `locked-${p.goalIdx}`;
      default: return p.kind;
    }
  };

  const navigate = (next: Phase) => {
    setHistory(prev => [...prev, phase]);
    screenAnim.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.ease) }, (finished) => {
      if (finished) {
        runOnJS(setPhase)(next);
        slideAnim.value = 30;
        screenAnim.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.ease) });
        slideAnim.value = withSpring(0, { damping: 20, stiffness: 160 });
      }
    });
    slideAnim.value = withTiming(-20, { duration: 220 });
  };

  const navigateReplace = (next: Phase) => {
    screenAnim.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.ease) }, (finished) => {
      if (finished) {
        runOnJS(setPhase)(next);
        slideAnim.value = 30;
        screenAnim.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.ease) });
        slideAnim.value = withSpring(0, { damping: 20, stiffness: 160 });
      }
    });
    slideAnim.value = withTiming(-20, { duration: 220 });
  };

  const goBack = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    screenAnim.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.ease) }, (finished) => {
      if (finished) {
        runOnJS(setPhase)(prev);
        slideAnim.value = -30;
        screenAnim.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.ease) });
        slideAnim.value = withSpring(0, { damping: 20, stiffness: 160 });
      }
    });
    slideAnim.value = withTiming(20, { duration: 180 });
  };

  const handleDecodeDone = (
    goalIdx: number,
    result: string,
    resolvedTargetStr?: string,
    isStandard?: boolean,
    decodePath?: DecodePath,
    doneLooksText?: string,
    numbersPayload?: { dailyNumber: number; winNoun: string; actionNoun: string; ratio: number; periodSuffix: 'week' | 'month' | 'year' },
  ) => {
    const goal = goals[goalIdx];
    if (resolvedTargetStr) {
      if (goal.deriveLabel) {
        setGoalLabelOverrides(prev => ({ ...prev, [goal.id]: goal.deriveLabel!(resolvedTargetStr) }));
      } else {
        const suffix = numbersPayload?.periodSuffix ?? 'month';
        setGoalLabelOverrides(prev => ({ ...prev, [goal.id]: `earning ${formatTargetDisplay(resolvedTargetStr)}/${suffix} consistently` }));
      }
    }
    setDecodeResults(prev => ({ ...prev, [goalIdx]: result }));
    navigate({
      kind: 'anchor',
      goalIdx,
      dailyInput: result,
      isStandard,
      decodePath: decodePath ?? 'starting',
      resolvedTargetStr,
      doneLooksText,
      ...numbersPayload,
    });

    // Fire per-goal AI identity generation for eligible goals
    const isAiEligible = !(decodePath === 'numbers' && resolvedTargetStr);
    if (isAiEligible) {
      const goalId = goal.id;
      if (!requestedGoalIds.current.has(goalId)) {
        requestedGoalIds.current.add(goalId);
        const finishLineText = doneLooksText?.trim() || formatGoalLabel(goal, goalLabelOverrides);
        if (finishLineText.length > 0) {
          generateIdentityStatements([finishLineText]).then(result => {
            if (!result) return;
            const statement = result[0];
            if (statement && typeof statement === 'string') {
              setAiStatements(prev => ({ ...prev, [goalId]: statement }));
            }
          });
        }
      }
    }
  };

  const handleAnchorDone = (
    goalIdx: number,
    dailyInput: string,
    when: string,
    where: string,
    schedule: WhenPickerValue | null,
    isStandard?: boolean,
    decodePath: DecodePath = 'starting',
    resolvedTargetStr?: string,
    doneLooksText?: string,
    dailyNumber?: number,
    winNoun?: string,
    actionNoun?: string,
    ratio?: number,
    periodSuffix?: 'week' | 'month' | 'year',
    wasFlaggedNonSpecific?: boolean,
  ) => {
    const goal = goals[goalIdx];
    const goalLabel = formatGoalLabel(goal, goalLabelOverrides);
    setLocked(prev => [
      ...prev.filter(l => l.goalId !== goal.id),
      {
        goalId: goal.id, dailyInput, goalLabel, doneLooksText,
        what: dailyInput, when, where, schedule, isStandard, decodePath,
        resolvedTargetStr, dailyNumber, winNoun, actionNoun, ratio, periodSuffix,
        identityLine: isAiSourced ? aiIdentityLines[goalIdx] : undefined,
        additionalInputs: [],
      },
    ]);
    const source: InputSource = isAiSourced ? 'ai_suggested' : 'user_written';
    logInputFeedback({
      goalText: goalLabel,
      source,
      finalInputText: dailyInput,
      specificityFlagTriggered: !!wasFlaggedNonSpecific,
    });
    navigate({ kind: 'locked', goalIdx, dailyInput });
  };

  const handleAddInputDone = (goalIdx: number, inp: AnchoredInput, wasFlaggedNonSpecific?: boolean) => {
    const goal = goals[goalIdx];
    const goalLabel = formatGoalLabel(goal, goalLabelOverrides);
    setLocked(prev => prev.map(l => l.goalId === goal.id ? { ...l, additionalInputs: [...l.additionalInputs, inp] } : l));
    const isFromAi = (aiSelectedInputs[goalIdx] ?? []).includes(inp.dailyInput);
    const source: InputSource = isFromAi ? 'ai_suggested' : 'user_written';
    logInputFeedback({
      goalText: goalLabel,
      source,
      finalInputText: inp.dailyInput,
      specificityFlagTriggered: !!wasFlaggedNonSpecific,
    });
    navigate({ kind: 'locked', goalIdx, dailyInput: inp.dailyInput });
  };

  const handleLockedNext = (goalIdx: number) => {
    const nextIdx = goalIdx + 1;
    if (nextIdx < goals.length) {
      if (isAiSourced) {
        const nextInput = (aiSelectedInputs[nextIdx] ?? [])[0];
        if (nextInput) {
          navigate({ kind: 'anchor', goalIdx: nextIdx, dailyInput: nextInput, decodePath: 'starting' });
          return;
        }
      }
      navigate({ kind: 'classifying', goalIdx: nextIdx });
    } else {
      navigate({ kind: 'identity' });
    }
  };

  const handleSignatureComplete = async (): Promise<boolean> => {
    const identityStatement = buildIdentityStatement(goals, locked, acceptedIdentity ?? {});
    const dimensions = buildDimensions(goals, locked, goalLabelOverrides);
    const { inputs, rawInputs } = buildInputsAndRaw(locked);

    const dominoGoal = dominoGoalId !== null ? goals.find(g => g.id === dominoGoalId) : goals[0];
    const compassVision = dominoGoal
      ? (() => {
          const lock = locked.find(l => l.goalId === dominoGoal.id);
          return lock ? displayGoalLabel(lock) : formatGoalLabel(dominoGoal, goalLabelOverrides);
        })()
      : '';

    const filterQuestion = compassFilter.trim()
      ? `Will it help me ${compassFilter.trim().replace(/\.$/, '')}?`
      : '';

    return onComplete({ identityStatement, dimensions, inputs, rawInputs, compass: { vision: compassVision, declaration: '', filterQuestion } });
  };

  const renderPhase = () => {
    switch (phase.kind) {
      case 'welcome':
        return (
          <WelcomeSeriesScreen
            screen={phase.screen}
            onNext={() => {
              if (phase.screen < 2) {
                navigate({ kind: 'welcome', screen: (phase.screen + 1) as 0 | 1 | 2 });
              } else {
                navigate({ kind: 'goals-entry' });
              }
            }}
            onBack={phase.screen === 0 ? undefined : goBack}
          />
        );

      case 'goals-entry':
        return (
          <GoalsEntryScreen
            onBack={goBack}
            onContinue={(parsedGoals, aiSourced) => {
              setGoals(parsedGoals);
              setLocked([]);
              setDecodeResults({});
              setGoalLabelOverrides({});
              setIdentityOverrides({});
              setIsAiSourced(!!aiSourced);
              setAiSelectedInputs({});
              setAiIdentityLines({});
              navigate(aiSourced ? { kind: 'ai-daily-inputs' } : { kind: 'intro' });
            }}
          />
        );

      case 'ai-daily-inputs':
        return (
          <AiDailyInputsScreen
            goals={goals}
            onBack={goBack}
            onEditGoal={(goalIdx, newLabel) => {
              setGoals(prev => prev.map((g, i) => i === goalIdx ? { ...g, label: newLabel } : g));
            }}
            onMergeGoals={(keepIndex, newLabel, removeIndices) => {
              const removeSet = new Set(removeIndices);
              setGoals(prev => {
                const kept = prev[keepIndex];
                if (!kept) return prev;
                const next: FlowGoal[] = [];
                for (let i = 0; i < prev.length; i++) {
                  if (removeSet.has(i)) continue;
                  if (i === keepIndex) {
                    next.push({ ...prev[i], label: newLabel });
                  } else {
                    next.push(prev[i]);
                  }
                }
                return next;
              });
              setAiSelectedInputs(prev => {
                const maxIdx = Object.keys(prev).reduce((m, k) => Math.max(m, Number(k)), 0);
                const next: Record<number, string[]> = {};
                let newIdx = 0;
                for (let i = 0; i <= maxIdx; i++) {
                  if (removeSet.has(i)) continue;
                  next[newIdx] = prev[i] ?? [];
                  newIdx++;
                }
                return next;
              });
            }}
            onRemoveGoals={(removeIndices) => {
              const removeSet = new Set(removeIndices);
              setGoals(prev => {
                const next: FlowGoal[] = [];
                for (let i = 0; i < prev.length; i++) {
                  if (removeSet.has(i)) continue;
                  next.push(prev[i]);
                }
                return next;
              });
              setAiSelectedInputs(prev => {
                const maxIdx = Object.keys(prev).reduce((m, k) => Math.max(m, Number(k)), 0);
                const next: Record<number, string[]> = {};
                let newIdx = 0;
                for (let i = 0; i <= maxIdx; i++) {
                  if (removeSet.has(i)) continue;
                  next[newIdx] = prev[i] ?? [];
                  newIdx++;
                }
                return next;
              });
            }}
            onDone={(selected, idLines) => {
              setAiSelectedInputs(selected);
              setAiIdentityLines(idLines);
              const firstInput = (selected[0] ?? [])[0];
              if (firstInput) {
                navigate({ kind: 'anchor', goalIdx: 0, dailyInput: firstInput, decodePath: 'starting' });
              } else {
                navigate({ kind: 'path-select', goalIdx: 0 });
              }
            }}
          />
        );

      case 'classifying': {
        const goalIdx = phase.goalIdx;
        const goalLabel = goals[goalIdx]?.label ?? '';
        return (
          <ClassifyingPhase
            goalLabel={goalLabel}
            onClassified={(path, extractedTarget, standardAction, estimatedMasteryHours) => {
              if (path === 'numbers' && extractedTarget) {
                setGoals(prev => prev.map((g, i) =>
                  i === goalIdx ? { ...g, inheritedTarget: extractedTarget } : g
                ));
              }
              if (path === 'starting' && standardAction) {
                setGoals(prev => prev.map((g, i) =>
                  i === goalIdx ? { ...g, practiceSeed: standardAction } : g
                ));
              }
              if (path === 'practice' && estimatedMasteryHours) {
                setGoals(prev => prev.map((g, i) =>
                  i === goalIdx ? { ...g, estimatedMasteryHours } : g
                ));
              }
              navigateReplace({ kind: 'decode', goalIdx, path });
            }}
          />
        );
      }

      case 'intro':
        return (
          <IntroScreen
            goals={goals}
            goalLabelOverrides={goalLabelOverrides}
            onNext={() => navigate({ kind: 'classifying', goalIdx: 0 })}
            onBack={goBack}
            onMergeGoals={(keepIndex, newLabel, removeIndices) => {
              const removeSet = new Set(removeIndices);
              setGoals(prev => {
                const kept = prev[keepIndex];
                if (!kept) return prev;
                const next: FlowGoal[] = [];
                for (let i = 0; i < prev.length; i++) {
                  if (removeSet.has(i)) continue;
                  if (i === keepIndex) {
                    next.push({ ...prev[i], label: newLabel });
                  } else {
                    next.push(prev[i]);
                  }
                }
                return next;
              });
            }}
          />
        );

      case 'path-select':
        return (
          <PathSelectorScreen
            goal={goals[phase.goalIdx]}
            n={phase.goalIdx + 1}
            resolvedLabel={formatGoalLabel(goals[phase.goalIdx], goalLabelOverrides)}
            onSelect={path => navigate({ kind: 'goal-done-looks', goalIdx: phase.goalIdx, chosenPath: path })}
            onDailyAction={() => navigate({ kind: 'goal-fuel-redirect', goalIdx: phase.goalIdx, practiceText: goals[phase.goalIdx].label })}
            onBack={goBack}
          />
        );

      case 'goal-done-looks': {
        const { goalIdx, chosenPath } = phase;
        return (
          <GoalDoneLooksScreen
            goal={goals[goalIdx]}
            goalIdx={goalIdx}
            total={goals.length}
            chosenPath={chosenPath}
            initialText={savedStates[phaseKey(phase)]}
            onBack={goBack}
            onStateChange={v => saveState(phaseKey(phase), v)}
            onContinue={doneLooksText => navigate({ kind: 'decode', goalIdx, path: chosenPath, doneLooksText })}
          />
        );
      }

      case 'goal-fuel-redirect': {
        const { goalIdx } = phase;
        return (
          <GoalFuelRedirectScreen
            practiceText={phase.practiceText}
            goalLabel={formatGoalLabel(goals[goalIdx], goalLabelOverrides)}
            initialText={savedStates[phaseKey(phase)]}
            onBack={goBack}
            onStateChange={v => saveState(phaseKey(phase), v)}
            onSkipAsStandard={actionText => handleDecodeDone(goalIdx, actionText, undefined, true, 'starting', phase.practiceText)}
            onContinue={redirectText => {
              const updated = { ...goals[goalIdx], label: redirectText };
              setGoals(prev => prev.map((x, i) => i === goalIdx ? updated : x));
              navigate({ kind: 'classifying', goalIdx });
            }}
          />
        );
      }

      case 'decode': {
        const { goalIdx, path, doneLooksText } = phase;
        const goal = goals[goalIdx];
        return (
          <View style={{ flex: 1 }}>
            <View style={[ibStyles.decodeHeader]}>
              <TouchableOpacity onPress={goBack} style={ibStyles.backBtn}>
                <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
              </TouchableOpacity>
              <GoalBadge goal={goal} n={goalIdx + 1} resolvedLabel={formatGoalLabel(goal, goalLabelOverrides)} />
            </View>
            <ScrollView style={{ flex: 1, paddingHorizontal: 24 }} showsVerticalScrollIndicator={false}>
              {path === 'numbers' && (
                <PathNumbers
                  goal={goal}
                  doneLooksText={doneLooksText}
                  onDone={(r, tStr, payload) => handleDecodeDone(goalIdx, r, tStr, undefined, 'numbers', doneLooksText, payload)}
                />
              )}
              {path === 'practice' && (
                <PathPractice
                  goal={goal}
                  onDone={r => handleDecodeDone(goalIdx, r, undefined, undefined, 'practice', doneLooksText)}
                />
              )}
              {path === 'starting' && (
                <PathStarting
                  goal={goal}
                  resolvedLabel={formatGoalLabel(goal, goalLabelOverrides)}
                  doneLooksText={doneLooksText}
                  onDone={(r, isStd) => handleDecodeDone(goalIdx, r, undefined, isStd, 'starting', doneLooksText)}
                />
              )}
            </ScrollView>
          </View>
        );
      }

      case 'anchor': {
        const { goalIdx, dailyInput, isStandard, decodePath, resolvedTargetStr, doneLooksText, dailyNumber, winNoun, actionNoun, ratio, periodSuffix } = phase;
        const goal = goals[goalIdx];
        return (
          <View style={{ flex: 1 }}>
            <View style={ibStyles.decodeHeader}>
              <TouchableOpacity onPress={goBack} style={ibStyles.backBtn}>
                <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
              </TouchableOpacity>
              <GoalBadge goal={goal} n={goalIdx + 1} resolvedLabel={formatGoalLabel(goal, goalLabelOverrides)} />
            </View>
            <ScrollView style={{ flex: 1, paddingHorizontal: 24 }} showsVerticalScrollIndicator={false}>
              <AnchorScreen
                goal={goal}
                dailyInput={dailyInput}
                isStandard={isStandard}
                onDone={(editedDailyInput, when, where, schedule, wasFlaggedNonSpecific) => handleAnchorDone(goalIdx, editedDailyInput, when, where, schedule, isStandard, decodePath, resolvedTargetStr, doneLooksText, dailyNumber, winNoun, actionNoun, ratio, periodSuffix, wasFlaggedNonSpecific)}
              />
            </ScrollView>
          </View>
        );
      }

      case 'locked': {
        const lockedGoalData = locked.find(l => l.goalId === goals[phase.goalIdx].id);
        if (!lockedGoalData) return null;
        const aiRemaining = (aiSelectedInputs[phase.goalIdx] ?? []).filter(
          inp => inp !== lockedGoalData.dailyInput && !lockedGoalData.additionalInputs.some(a => a.dailyInput === inp)
        );
        return (
          <GoalLockedScreen
            n={phase.goalIdx + 1}
            total={goals.length}
            goal={goals[phase.goalIdx]}
            resolvedLabel={formatGoalLabel(goals[phase.goalIdx], goalLabelOverrides)}
            lockedGoal={lockedGoalData}
            onNext={() => handleLockedNext(phase.goalIdx)}
            onAddInput={() => navigate({ kind: 'add-input', goalIdx: phase.goalIdx, prefillText: aiRemaining[0] })}
          />
        );
      }

      case 'add-input': {
        const { goalIdx, prefillText } = phase;
        const goal = goals[goalIdx];
        return (
          <View style={{ flex: 1 }}>
            <View style={ibStyles.decodeHeader}>
              <View style={{ width: 40 }} />
              <GoalBadge goal={goal} n={goalIdx + 1} resolvedLabel={formatGoalLabel(goal, goalLabelOverrides)} />
            </View>
            <ScrollView style={{ flex: 1, paddingHorizontal: 24 }} showsVerticalScrollIndicator={false}>
              <AddInputScreen
                goal={goal}
                prefillText={prefillText}
                onDone={(dailyInput, when, where, schedule, wasFlaggedNonSpecific) => handleAddInputDone(goalIdx, { dailyInput, when, where, schedule }, wasFlaggedNonSpecific)}
                onCancel={() => navigate({ kind: 'locked', goalIdx, dailyInput: '' })}
              />
            </ScrollView>
          </View>
        );
      }

      case 'identity':
        return (
          <IdentityScreen
            goals={goals}
            locked={locked}
            identityOverrides={identityOverrides}
            aiStatements={aiStatements}
            onOverrideChange={(goalId, text) => setIdentityOverrides(prev => ({ ...prev, [goalId]: text }))}
            onAccept={(resolved) => {
              setAcceptedIdentity(resolved);
              navigate({ kind: 'compass-story' });
            }}
          />
        );

      case 'compass-story':
        return (
          <CompassStoryScreen
            onNext={() => navigate({ kind: 'compass-domino' })}
            onBack={goBack}
          />
        );

      case 'compass-domino':
        return (
          <CompassDominoScreen
            goals={goals}
            locked={locked}
            goalLabelOverrides={goalLabelOverrides}
            onNext={id => {
              setDominoGoalId(id);
              navigate({ kind: 'compass-mechanism', dominoGoalId: id });
            }}
            onBack={goBack}
          />
        );

      case 'compass-mechanism': {
        const dominoGoal = goals.find(g => g.id === phase.dominoGoalId) ?? goals[0];
        return (
          <CompassMechanismScreen
            dominoGoal={dominoGoal}
            goalLabelOverrides={goalLabelOverrides}
            initialText={compassFilter}
            onNext={filter => {
              setCompassFilter(filter);
              navigate({ kind: 'finale', beat: 0 });
            }}
            onBack={goBack}
          />
        );
      }

      case 'finale':
        return (
          <FinaleScreen
            beat={phase.beat}
            goals={goals}
            locked={locked}
            acceptedIdentity={acceptedIdentity ?? {}}
            compassFilter={compassFilter}
            onNext={() => {
              if (phase.beat < 2) {
                navigate({ kind: 'finale', beat: (phase.beat + 1) as 0 | 1 | 2 });
              } else {
                navigate({ kind: 'signature' });
              }
            }}
            onBack={goBack}
          />
        );

      case 'signature':
        return (
          <SignatureScreen
            locked={locked}
            displayName={displayName}
            onComplete={handleSignatureComplete}
          />
        );
    }
  };

  return (
    <View style={[ibStyles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Animated.View style={containerStyle}>
        {renderPhase()}
      </Animated.View>
    </View>
  );
}

// ─── Classifying phase (inline loading state) ──────────────────────────────────

function ClassifyingPhase({
  goalLabel,
  onClassified,
}: {
  goalLabel: string;
  onClassified: (path: DecodePath, extractedTarget: string | null, standardAction: string | null, estimatedMasteryHours: number | null) => void;
}) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0);
  useEffect(() => { opacity.value = withTiming(1, { duration: 300 }); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // Animated Sparkles icon: continuous pulse + slow rotation
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    rotation.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(scale);
      cancelAnimation(rotation);
    };
  }, []);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  // Cycling status phrases
  const phrases = [
    'Reading your goal...',
    'Checking the numbers...',
    'Choosing your path...',
    'Almost there...',
  ];
  const [phraseIdx, setPhraseIdx] = useState(0);
  const phraseOpacity = useSharedValue(1);
  useEffect(() => {
    let step = 0;
    const interval = setInterval(() => {
      phraseOpacity.value = withTiming(0, { duration: 200 }, () => {
        step = (step + 1) % phrases.length;
        runOnJS(setPhraseIdx)(step);
        phraseOpacity.value = withTiming(1, { duration: 200 });
      });
    }, 800);
    return () => clearInterval(interval);
  }, []);
  const phraseStyle = useAnimatedStyle(() => ({ opacity: phraseOpacity.value }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('classify-goal-path', {
          body: { goal: goalLabel },
        });
        if (cancelled) return;
        if (error || !data || (data.path !== 'numbers' && data.path !== 'practice' && data.path !== 'starting')) {
          onClassified('starting', null, null, null);
          return;
        }
        const extracted = typeof data.extractedTarget === 'string' && data.extractedTarget.trim().length > 0
          ? data.extractedTarget.trim()
          : null;
        const standard = typeof data.standardAction === 'string' && data.standardAction.trim().length > 0
          ? data.standardAction.trim()
          : null;
        const masteryHours = typeof data.estimatedMasteryHours === 'number' && !isNaN(data.estimatedMasteryHours) && data.estimatedMasteryHours > 0
          ? Math.round(data.estimatedMasteryHours)
          : null;
        onClassified(data.path as DecodePath, extracted, standard, masteryHours);
      } catch {
        if (!cancelled) onClassified('starting', null, null, null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
      <Animated.View style={[fadeStyle, { alignItems: 'center', gap: 20 }]}>
        <Animated.View style={iconStyle}>
          <Sparkles size={48} color={colors.primary} strokeWidth={2} />
        </Animated.View>
        <Animated.Text style={[{ fontSize: 16, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' }, phraseStyle]}>
          {phrases[phraseIdx]}
        </Animated.Text>
        <Text style={{ fontSize: 14, color: colors.textTertiary, textAlign: 'center', maxWidth: 280 }}>
          {goalLabel}
        </Text>
      </Animated.View>
    </View>
  );
}

const ibStyles = StyleSheet.create({
  root: { flex: 1 },
  decodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
