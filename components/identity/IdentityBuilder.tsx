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
} from 'react-native';
import Svg, { Path as SvgPath, Line as SvgLine } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { ArrowLeft, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { IdentityBuilderResult, RawInputEntry, Dimension } from './types';
import { scheduleTaskReminder } from './notifications';
import { WhenPickerValue } from './WhenPickerModal';
import { DecodePath, FlowGoal, AnchoredInput, LockedGoal } from './flow/types';
import { WelcomeSeriesScreen } from './flow/WelcomeScreens';
import { GoalsEntryScreen, IntroScreen, GoalDoneLooksScreen, GoalFuelRedirectScreen } from './flow/GoalsEntry';
import { PathSelectorScreen, PathNumbers, PathPractice, PathStarting } from './flow/PathScreens';
import { AnchorScreen, AddInputScreen, GoalLockedScreen, GoalBadge, formatGoalLabel, displayGoalLabel } from './flow/AnchorScreens';
import { IdentityScreen, deriveIdentityLine } from './flow/IdentityScreens';
import { CompassStoryScreen, CompassDominoScreen, CompassMechanismScreen } from './flow/CompassScreens';
import { FinaleScreen } from './flow/FinaleScreens';

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
  identityOverrides: Record<number, string>,
): string {
  const lines = goals.map(g => {
    const lock = locked.find(l => l.goalId === g.id);
    if (!lock) return null;
    const override = identityOverrides[g.id];
    if (override !== undefined) return override.trim();
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
  onComplete,
}: {
  locked: ExtendedLockedGoal[];
  onComplete: () => void;
}) {
  const { colors, isDark } = useTheme();
  const screenFade = useSharedValue(0);
  useEffect(() => { screenFade.value = withTiming(1, { duration: 500 }); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: screenFade.value }));

  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
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
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(`M${locationX.toFixed(1)},${locationY.toFixed(1)}`);
      },
      onPanResponderMove: evt => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(prev => `${prev} L${locationX.toFixed(1)},${locationY.toFixed(1)}`);
      },
      onPanResponderRelease: () => {
        setCurrentPath(prev => {
          if (prev) setPaths(ps => [...ps, prev]);
          return '';
        });
      },
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
    >
      <Animated.View style={[fadeStyle, { gap: 0 }]}>
        <Text style={[sigStyles.headline, { color: colors.text, marginBottom: 6 }]}>
          {'I commit to hitting\nmy daily inputs\nevery day for '}
          <Text style={{ color: colors.primary }}>{'77 days'}</Text>
          {'.'}
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

        <TouchableOpacity
          style={[sigStyles.ctaBtn, {
            backgroundColor: hasSig ? '#CCFF00' : (isDark ? '#1C2400' : '#D8E8C0'),
            marginTop: 24,
            opacity: hasSig ? 1 : 0.38,
          }]}
          onPress={() => { if (hasSig) onComplete(); }}
          activeOpacity={hasSig ? 0.85 : 1}
          disabled={!hasSig}
        >
          <Text style={[sigStyles.ctaText, { color: hasSig ? '#000' : (isDark ? '#3A4A00' : '#7A9A40') }]}>
            Start My 77-Day Challenge
          </Text>
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
  | { kind: 'path-select'; goalIdx: number }
  | { kind: 'goal-done-looks'; goalIdx: number; chosenPath: DecodePath; doneLooksInitial?: string }
  | { kind: 'goal-fuel-redirect'; goalIdx: number; practiceText: string; redirectInitial?: string }
  | { kind: 'decode'; goalIdx: number; path: DecodePath; doneLooksText?: string }
  | { kind: 'anchor'; goalIdx: number; dailyInput: string; isStandard?: boolean; decodePath: DecodePath; resolvedTargetStr?: string; doneLooksText?: string; dailyNumber?: number; winNoun?: string; actionNoun?: string; ratio?: number; periodSuffix?: 'week' | 'month' | 'year' }
  | { kind: 'add-input'; goalIdx: number }
  | { kind: 'locked'; goalIdx: number; dailyInput: string }
  | { kind: 'identity' }
  | { kind: 'compass-story' }
  | { kind: 'compass-domino' }
  | { kind: 'compass-mechanism'; dominoGoalId: number }
  | { kind: 'finale'; beat: 0 | 1 | 2 }
  | { kind: 'signature' };

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (result: IdentityBuilderResult) => void;
}

export default function IdentityBuilder({ onComplete }: Props) {
  const { colors } = useTheme();

  const [phase, setPhase] = useState<Phase>({ kind: 'welcome', screen: 0 });
  const [history, setHistory] = useState<Phase[]>([]);
  const [goals, setGoals] = useState<FlowGoal[]>(HARDCODED_GOALS);
  const [locked, setLocked] = useState<ExtendedLockedGoal[]>([]);
  const [decodeResults, setDecodeResults] = useState<Record<number, string>>({});
  const [goalLabelOverrides, setGoalLabelOverrides] = useState<Record<number, string>>({});
  const [identityOverrides, setIdentityOverrides] = useState<Record<number, string>>({});
  const [compassFilter, setCompassFilter] = useState<string>('');
  const [dominoGoalId, setDominoGoalId] = useState<number | null>(null);
  const [savedStates, setSavedStates] = useState<Record<string, string>>({});

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
    screenAnim.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.ease) });
    slideAnim.value = withTiming(-20, { duration: 220 });
    setTimeout(() => {
      setPhase(next);
      slideAnim.value = 30;
      screenAnim.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.ease) });
      slideAnim.value = withSpring(0, { damping: 20, stiffness: 160 });
    }, 230);
  };

  const goBack = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    screenAnim.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.ease) });
    slideAnim.value = withTiming(20, { duration: 180 });
    setTimeout(() => {
      setPhase(prev);
      slideAnim.value = -30;
      screenAnim.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.ease) });
      slideAnim.value = withSpring(0, { damping: 20, stiffness: 160 });
    }, 190);
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
        setGoalLabelOverrides(prev => ({ ...prev, [goal.id]: `earning ${resolvedTargetStr}/${suffix} consistently` }));
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
  ) => {
    const goal = goals[goalIdx];
    const goalLabel = formatGoalLabel(goal, goalLabelOverrides);
    if (schedule?.reminder) {
      scheduleTaskReminder(schedule, dailyInput);
    }
    setLocked(prev => [
      ...prev.filter(l => l.goalId !== goal.id),
      {
        goalId: goal.id, dailyInput, goalLabel, doneLooksText,
        what: dailyInput, when, where, schedule, isStandard, decodePath,
        resolvedTargetStr, dailyNumber, winNoun, actionNoun, ratio, periodSuffix,
        additionalInputs: [],
      },
    ]);
    navigate({ kind: 'locked', goalIdx, dailyInput });
  };

  const handleAddInputDone = (goalIdx: number, inp: AnchoredInput) => {
    const goal = goals[goalIdx];
    if (inp.schedule?.reminder) {
      scheduleTaskReminder(inp.schedule, inp.dailyInput);
    }
    setLocked(prev => prev.map(l => l.goalId === goal.id ? { ...l, additionalInputs: [...l.additionalInputs, inp] } : l));
    navigate({ kind: 'locked', goalIdx, dailyInput: inp.dailyInput });
  };

  const handleLockedNext = (goalIdx: number) => {
    const nextIdx = goalIdx + 1;
    if (nextIdx < goals.length) {
      navigate({ kind: 'path-select', goalIdx: nextIdx });
    } else {
      navigate({ kind: 'identity' });
    }
  };

  const handleSignatureComplete = () => {
    const identityStatement = buildIdentityStatement(goals, locked, identityOverrides);
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

    onComplete({ identityStatement, dimensions, inputs, rawInputs, compass: { vision: compassVision, declaration: '', filterQuestion } });
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
            onContinue={parsedGoals => {
              setGoals(parsedGoals);
              setLocked([]);
              setDecodeResults({});
              setGoalLabelOverrides({});
              setIdentityOverrides({});
              navigate({ kind: 'intro' });
            }}
          />
        );

      case 'intro':
        return (
          <IntroScreen
            goals={goals}
            goalLabelOverrides={goalLabelOverrides}
            onNext={() => navigate({ kind: 'path-select', goalIdx: 0 })}
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
            initialText={savedStates[phaseKey(phase)]}
            onBack={goBack}
            onStateChange={v => saveState(phaseKey(phase), v)}
            onSkipAsStandard={actionText => handleDecodeDone(goalIdx, actionText, undefined, true, 'starting', phase.practiceText)}
            onContinue={redirectText => {
              const updated = { ...goals[goalIdx], label: redirectText };
              setGoals(prev => prev.map((x, i) => i === goalIdx ? updated : x));
              navigate({ kind: 'path-select', goalIdx });
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
                onDone={(when, where, schedule) => handleAnchorDone(goalIdx, dailyInput, when, where, schedule, isStandard, decodePath, resolvedTargetStr, doneLooksText, dailyNumber, winNoun, actionNoun, ratio, periodSuffix)}
              />
            </ScrollView>
          </View>
        );
      }

      case 'locked': {
        const lockedGoalData = locked.find(l => l.goalId === goals[phase.goalIdx].id);
        if (!lockedGoalData) return null;
        return (
          <GoalLockedScreen
            n={phase.goalIdx + 1}
            total={goals.length}
            goal={goals[phase.goalIdx]}
            resolvedLabel={formatGoalLabel(goals[phase.goalIdx], goalLabelOverrides)}
            lockedGoal={lockedGoalData}
            onNext={() => handleLockedNext(phase.goalIdx)}
            onAddInput={() => navigate({ kind: 'add-input', goalIdx: phase.goalIdx })}
          />
        );
      }

      case 'add-input': {
        const { goalIdx } = phase;
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
                onDone={(dailyInput, when, where, schedule) => handleAddInputDone(goalIdx, { dailyInput, when, where, schedule })}
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
            onOverrideChange={(goalId, text) => setIdentityOverrides(prev => ({ ...prev, [goalId]: text }))}
            onAccept={() => navigate({ kind: 'compass-story' })}
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
            identityOverrides={identityOverrides}
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
            onComplete={handleSignatureComplete}
          />
        );
    }
  };

  return (
    <View style={[ibStyles.root, { backgroundColor: colors.background }]}>
      <Animated.View style={containerStyle}>
        {renderPhase()}
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
