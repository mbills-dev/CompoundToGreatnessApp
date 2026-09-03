import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { ArrowLeft, ArrowRight, Check, Zap, Pencil, RotateCw, Turtle, Rabbit } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FlowGoal, DecodePath, TargetResolution } from './types';
import { GoalBadge } from './AnchorScreens';
import styles from './styles';
import KeyboardStepWrapper, { KEYBOARD_DONE_ACCESSORY_ID, KeyboardStepWrapperRef } from './KeyboardStepWrapper';
import { useInputSpecificity, SpecificityNudgeBanner } from './InputValidation';
import { fetchDailyInputs, GoalInputResult } from './AiDailyInputsScreen';
import { formatTargetDisplay } from './IdentityScreens';

// ─── Math helpers ─────────────────────────────────────────────────────────────

function parseNum(raw: string): number {
  const s = raw.trim();
  const match = s.match(/\$?([\d,]+(?:\.\d+)?)\s*([KkMm])?/);
  if (!match) return NaN;
  const digits = parseFloat(match[1].replace(/,/g, ''));
  if (isNaN(digits)) return NaN;
  const suffix = match[2]?.toUpperCase();
  if (suffix === 'K') return Math.round(digits * 1_000);
  if (suffix === 'M') return Math.round(digits * 1_000_000);
  return Math.round(digits);
}

function computeDailyNumber(
  target: number,
  perWin: number,
  ratio: number,
  daysPerPeriod: number,
): number {
  const wins = Math.ceil(target / perWin);
  const attempts = wins * ratio;
  const perDay = Math.ceil(attempts / daysPerPeriod);
  return Math.max(perDay + 1, Math.ceil(perDay * 1.3));
}

function hoursToYears(hours: number, minPerDay: number): string {
  const daysNeeded = (hours * 60) / minPerDay;
  const years = daysNeeded / 365;
  if (years < 0.5) return `${Math.ceil(daysNeeded / 30)} months`;
  if (years < 1.5) return '~1 year';
  return `~${Math.round(years)} years`;
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}
function normalizeTarget(raw: string): string {
  const s = raw.trim();
  const withDollar = s.startsWith('$') ? s : `$${s}`;
  return withDollar.replace(/([kmKM])$/, m => m.toUpperCase());
}

function extractTargetFromText(text: string): string | null {
  const match = text.match(/\$[\d,]+(?:\.\d+)?(?:\s*[KkMm])?|[\d,]+(?:\.\d+)?\s*[KkMm]|\$[\d,]+/);
  return match ? match[0].trim() : null;
}

// ─── Period detection ──────────────────────────────────────────────────────────

export type PeriodInfo = {
  label: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  days: 7 | 30 | 365;
  suffix: 'week' | 'month' | 'year';
};

export function detectPeriod(...texts: string[]): PeriodInfo {
  const combined = texts.join(' ').toLowerCase();
  if (/\b(week|weekly|wk)\b/.test(combined)) {
    return { label: 'WEEKLY', days: 7, suffix: 'week' };
  }
  if (/\b(year|yearly|annual|annually|yr)\b/.test(combined)) {
    return { label: 'YEARLY', days: 365, suffix: 'year' };
  }
  return { label: 'MONTHLY', days: 30, suffix: 'month' };
}

// ─── Shared ChipGroup internals ───────────────────────────────────────────────

export function PresetChip({
  label,
  isSelected,
  delayMs,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  delayMs: number;
  onPress: () => void;
}) {
  const { colors, isDark } = useTheme();
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.value = 0;
    anim.value = withSpring(1, { damping: 16, stiffness: 120 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: [{ translateY: interpolate(anim.value, [0, 1], [12, 0]) }],
  }));

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        style={[
          styles.chip,
          {
            backgroundColor: isSelected
              ? colors.primary
              : isDark
              ? colors.backgroundSecondary
              : '#F0F0F0',
            borderColor: isSelected ? colors.primary : colors.border,
          },
        ]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        {isSelected && <Check size={12} color="#000" strokeWidth={3} />}
        <Text
          style={[
            styles.chipText,
            { color: isSelected ? '#000' : colors.text },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ChipGroup({
  label,
  options,
  selected,
  onSelect,
  keyboardType = 'default',
  customPlaceholder = 'Type your own...',
  onCustomInputOpenChange,
}: {
  label: string;
  options: string[];
  selected: string | null;
  onSelect: (v: string) => void;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  customPlaceholder?: string;
  onCustomInputOpenChange?: (open: boolean) => void;
}) {
  const { colors, isDark } = useTheme();

  const isCustomSelected =
    selected !== null && !options.includes(selected);

  const [showInput, setShowInput] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    onCustomInputOpenChange?.(showInput);
  }, [showInput, onCustomInputOpenChange]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed.length > 0) {
      onSelect(trimmed);
      setShowInput(false);
      setDraft('');
    }
  };

  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={[styles.fieldLabel, { color: colors.primary }]}>
        {label}
      </Text>
      <View style={styles.chipWrap}>
        {options.map((opt, i) => (
          <PresetChip
            key={opt}
            label={opt}
            isSelected={selected === opt}
            delayMs={i * 30}
            onPress={() => {
              onSelect(opt);
              setShowInput(false);
            }}
          />
        ))}

        {isCustomSelected && !showInput && (
          <TouchableOpacity
            style={[
              styles.chip,
              {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => {
              setDraft(selected ?? '');
              setShowInput(true);
            }}
            activeOpacity={0.75}
          >
            <Check size={12} color="#000" strokeWidth={3} />
            <Text style={[styles.chipText, { color: '#000' }]}>
              {selected}
            </Text>
            <Pencil size={11} color="#000" strokeWidth={2.5} />
          </TouchableOpacity>
        )}

        {!showInput && !isCustomSelected && (
          <TouchableOpacity
            style={[
              styles.chip,
              {
                backgroundColor: isDark
                  ? colors.backgroundSecondary
                  : '#F0F0F0',
                borderColor: colors.border,
                borderStyle: 'dashed',
              },
            ]}
            onPress={() => {
              setDraft('');
              setShowInput(true);
            }}
            activeOpacity={0.75}
          >
            <Pencil size={12} color={colors.textTertiary} strokeWidth={2} />
            <Text style={[styles.chipText, { color: colors.textTertiary }]}>
              my own
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {showInput && (
        <View style={styles.customRow}>
          <TextInput
            style={[
              styles.customInlineInput,
              {
                color: colors.text,
                borderColor: colors.primary + '80',
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.03)',
              },
            ]}
            value={draft}
            onChangeText={setDraft}
            placeholder={customPlaceholder}
            placeholderTextColor={colors.textTertiary}
            keyboardType={keyboardType}
            autoFocus
            returnKeyType="done"
            inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
            onSubmitEditing={commit}
          />
          <TouchableOpacity
            style={[
              styles.customConfirmBtn,
              {
                backgroundColor: draft.trim()
                  ? colors.primary
                  : colors.border,
              },
            ]}
            disabled={!draft.trim()}
            onPress={commit}
          >
            <Check size={16} color="#000" strokeWidth={3} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.customCancelBtn}
            onPress={() => setShowInput(false)}
          >
            <Text
              style={[
                styles.customCancelText,
                { color: colors.textTertiary },
              ]}
            >
              cancel
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── PathNumbers ──────────────────────────────────────────────────────────────

export function PathNumbers({
  goal,
  doneLooksText,
  onDone,
}: {
  goal: FlowGoal;
  doneLooksText?: string;
  onDone: (
    result: string,
    resolvedTargetStr: string,
    payload: { dailyNumber: number; winNoun: string; actionNoun: string; ratio: number; periodSuffix: 'week' | 'month' | 'year' },
  ) => void;
}) {
  const { colors, isDark } = useTheme();

  const rawTarget =
    (doneLooksText ? extractTargetFromText(doneLooksText) : null) ??
    goal.inheritedTarget ??
    '';
  const derivedTarget = rawTarget ? normalizeTarget(rawTarget) : '';

  const [targetStr, setTargetStr] = useState(derivedTarget);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState('');

  const resolvedTarget = parseNum(targetStr);
  const period = detectPeriod(goal.label, doneLooksText ?? '', targetStr);
  const daysPerPeriod = period.days;

  const winNounOptions = ['deal', 'sale', 'client', 'order'];
  const [winNoun, setWinNoun] = useState<string | null>(null);

  const worthOptions = ['$500', '$1,000', '$2,500', '$5,000', '$10,000'];
  const [worthStr, setWorthStr] = useState<string | null>(null);
  const perWin =
    worthStr !== null ? parseNum(worthStr) : NaN;

  const actionNounOptions = ['offer', 'call', 'text', 'email'];
  const [actionNoun, setActionNoun] = useState<string | null>(null);

  const ratioOptions = ['1-in-5', '1-in-10', '1-in-20', '1-in-50'];
  const [ratioStr, setRatioStr] = useState<string | null>(null);

  const parseRatio = (s: string): number => {
    if (s.startsWith('1-in-')) return parseInt(s.slice(5), 10);
    return parseNum(s);
  };
  const ratio =
    ratioStr !== null ? parseRatio(ratioStr) : NaN;

  const [revealed, setRevealed] = useState(false);
  const revealAnim = useSharedValue(0);
  const scrollRef = useRef<KeyboardStepWrapperRef>(null);

  const targetCardAnim = useSharedValue(0);
  useEffect(() => {
    targetCardAnim.value = withSpring(1, { damping: 14, stiffness: 100 });
  }, []);
  const targetCardStyle = useAnimatedStyle(() => ({
    opacity: targetCardAnim.value,
    transform: [
      { scale: interpolate(targetCardAnim.value, [0, 1], [0.85, 1]) },
    ],
  }));

  const resetReveal = () => {
    setRevealed(false);
    revealAnim.value = 0;
  };

  const canReveal =
    !isNaN(resolvedTarget) &&
    resolvedTarget > 0 &&
    !isNaN(perWin) &&
    perWin > 0 &&
    actionNoun !== null &&
    !isNaN(ratio) &&
    ratio > 0;

  const wins = canReveal
    ? Math.ceil(resolvedTarget / perWin)
    : 0;
  const totalAttempts = wins * ratio;
  const perDayRaw =
    daysPerPeriod > 0 ? Math.ceil(totalAttempts / daysPerPeriod) : 0;
  const daily = canReveal
    ? computeDailyNumber(resolvedTarget, perWin, ratio, daysPerPeriod)
    : 0;

  const doReveal = () => {
    setRevealed(true);
    const triggerScroll = () => scrollRef.current?.scrollToEnd({ animated: true });
    revealAnim.value = withSpring(1, { damping: 14, stiffness: 100 });
    setTimeout(() => triggerScroll(), 400);
    if (Platform.OS !== 'web') {
      let tick = 0;
      const interval = setInterval(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        tick++;
        if (tick >= 8) clearInterval(interval);
      }, 80);
    }
  };

  const revealStyle = useAnimatedStyle(() => ({
    opacity: revealAnim.value,
    transform: [
      { scale: interpolate(revealAnim.value, [0, 1], [0.85, 1]) },
    ],
  }));

  const wn = winNoun ?? 'win';
  const an = actionNoun ?? 'action';

  const dailyFontSize =
    daily >= 10000 ? 36 : daily >= 1000 ? 44 : 56;

  return (
    <KeyboardStepWrapper ref={scrollRef} contentContainerStyle={styles.decodeScroll}>
      {targetStr.trim() ? (
        <Animated.View
          style={[
            styles.inheritedTargetCard,
            {
              backgroundColor: isDark
                ? 'rgba(204,255,0,0.06)'
                : 'rgba(204,255,0,0.08)',
              borderColor: colors.primary + '50',
            },
            targetCardStyle,
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.inheritedLabel, { color: colors.primary }]}>
              {period.label} TARGET
            </Text>
            {!editingTarget ? (
              <Text style={[styles.inheritedValue, { color: colors.text }]}>
                {formatTargetDisplay(targetStr)}{' '}
                <Text style={{ color: colors.primary, fontSize: 14 }}>
                  ✓ from your goal
                </Text>
              </Text>
            ) : (
              <View style={styles.customRow}>
                <TextInput
                  style={[
                    styles.customInlineInput,
                    {
                      color: colors.text,
                      borderColor: colors.primary + '80',
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.03)',
                    },
                  ]}
                  value={targetDraft}
                  onChangeText={setTargetDraft}
                  placeholder="e.g. $100,000"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="default"
                  autoFocus
                  returnKeyType="done"
                  inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
                  onSubmitEditing={() => {
                    const trimmed = targetDraft.trim();
                    if (trimmed) {
                      setTargetStr(normalizeTarget(trimmed));
                      resetReveal();
                    }
                    setEditingTarget(false);
                  }}
                />
                <TouchableOpacity
                  style={[
                    styles.customConfirmBtn,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={() => {
                    const trimmed = targetDraft.trim();
                    if (trimmed) {
                      setTargetStr(normalizeTarget(trimmed));
                      resetReveal();
                    }
                    setEditingTarget(false);
                  }}
                >
                  <Check size={16} color="#000" strokeWidth={3} />
                </TouchableOpacity>
              </View>
            )}
          </View>
          {!editingTarget && (
            <TouchableOpacity
              onPress={() => {
                setTargetDraft(targetStr);
                setEditingTarget(true);
              }}
              style={styles.editAffordance}
              activeOpacity={0.7}
            >
              <Pencil
                size={14}
                color={colors.textTertiary}
                strokeWidth={2}
              />
            </TouchableOpacity>
          )}
        </Animated.View>
      ) : (
        <ChipGroup
          label="Monthly target"
          options={['$10,000', '$25,000', '$50,000', '$100,000', '$250,000']}
          selected={targetStr || null}
          onSelect={v => {
            setTargetStr(normalizeTarget(v));
            resetReveal();
          }}
          keyboardType="default"
          customPlaceholder="e.g. $100,000"
        />
      )}

      <ChipGroup
        label="What do you call a win?"
        options={winNounOptions}
        selected={winNoun}
        onSelect={v => {
          setWinNoun(v);
          resetReveal();
        }}
        customPlaceholder="e.g. contract"
      />

      {winNoun && (
        <View style={{ marginTop: 20 }}>
          <ChipGroup
            label={`What's one ${wn} worth?`}
            options={worthOptions}
            selected={worthStr}
            onSelect={v => {
              setWorthStr(v);
              resetReveal();
            }}
            keyboardType="decimal-pad"
            customPlaceholder="e.g. $20,000"
          />
        </View>
      )}

      {winNoun && worthStr && (
        <View style={{ marginTop: 20 }}>
          <ChipGroup
            label="What's the last action in the chain YOU fully control?"
            options={actionNounOptions}
            selected={actionNoun}
            onSelect={v => {
              setActionNoun(v);
              resetReveal();
            }}
            customPlaceholder="e.g. message"
          />
          <Text
            style={[styles.helperHint, { color: colors.textTertiary }]}
          >
            The final thing you personally do before the outcome is out of
            your hands. Everything after it — replies, visits, closings —
            gets absorbed into your ratio.
          </Text>
        </View>
      )}

      {winNoun && worthStr && actionNoun && (
        <View style={{ marginTop: 20 }}>
          <ChipGroup
            label={`About how many ${an}s per ${wn}?`}
            options={ratioOptions}
            selected={ratioStr}
            onSelect={v => {
              setRatioStr(v);
              resetReveal();
            }}
            keyboardType="numeric"
            customPlaceholder="e.g. 15,000"
          />
        </View>
      )}

      {canReveal && !revealed && (
        <TouchableOpacity
          style={[styles.revealBtn, { backgroundColor: colors.primary }]}
          onPress={doReveal}
          activeOpacity={0.85}
        >
          <Zap size={18} color="#000" strokeWidth={2.5} />
          <Text style={styles.revealBtnText}>Reveal my daily number</Text>
        </TouchableOpacity>
      )}

      {revealed && (
        <Animated.View
          style={[
            styles.revealCard,
            { borderColor: colors.primary },
            revealStyle,
          ]}
        >
          <LinearGradient
            colors={['rgba(204,255,0,0.10)', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Text style={[styles.revealLabel, { color: colors.primary }]}>
            YOUR DAILY NUMBER
          </Text>
          <Text
            style={[
              styles.revealNumber,
              { color: colors.primary, fontSize: dailyFontSize },
            ]}
          >
            {fmtNum(daily)}
          </Text>
          <Text
            style={[styles.revealUnit, { color: colors.textSecondary }]}
          >
            {an}s per day
          </Text>
          <View
            style={[
              styles.mathBox,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(0,0,0,0.04)',
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[styles.mathLine, { color: colors.textSecondary }]}
            >
              {fmtNum(wins)} {wn}s needed × {fmtNum(ratio)} {an}s each
              {' = '}{fmtNum(totalAttempts)} {an}s
            </Text>
            <Text
              style={[styles.mathLine, { color: colors.textSecondary }]}
            >
              {fmtNum(totalAttempts)} ÷ {daysPerPeriod} days
              {' = '}{fmtNum(perDayRaw)}/{an} · with 30% buffer → {fmtNum(daily)}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.lockBtn, { backgroundColor: colors.primary }]}
            onPress={() => onDone(
              `${fmtNum(daily)} ${an}s per day`,
              targetStr,
              { dailyNumber: daily, winNoun: wn, actionNoun: an, ratio, periodSuffix: period.suffix },
            )}
            activeOpacity={0.85}
          >
            <Check size={18} color="#000" strokeWidth={3} />
            <Text style={styles.lockBtnText}>Lock This In</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </KeyboardStepWrapper>
  );
}

// ─── PathPractice ─────────────────────────────────────────────────────────────

function positionToPace(pos: number): number {
  const THIRD = 100 / 3;
  if (pos <= THIRD) {
    return Math.round(15 + (pos / THIRD) * 5);
  } else if (pos <= 2 * THIRD) {
    return Math.round(30 + ((pos - THIRD) / THIRD) * 10);
  } else {
    return Math.round(90 + ((pos - 2 * THIRD) / THIRD) * 30);
  }
}

const DEADLINE_MONTHS: Record<string, number> = {
  ongoing: 12,
  '6 months': 6,
};

export function PathPractice({
  goal,
  onDone,
}: {
  goal: FlowGoal;
  onDone: (result: string) => void;
}) {
  const { colors, isDark } = useTheme();
  const deadlineMonths = DEADLINE_MONTHS[goal.deadline];
  const use77Days = deadlineMonths === undefined || goal.deadline === 'ongoing';

  const hours = goal.estimatedMasteryHours ?? 300;

  const [trackPosition, setTrackPosition] = useState(50);
  const pace = positionToPace(trackPosition);
  const [revealed, setRevealed] = useState(false);
  const [actionText, setActionText] = useState('');
  const [aiResult, setAiResult] = useState<GoalInputResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const lastFetchedPace = useRef<number | null>(null);
  const specificity = useInputSpecificity();
  const scrollRef = useRef<KeyboardStepWrapperRef>(null);

  const revealAnim = useSharedValue(0);

  const loadSuggestions = useCallback(async (paceVal: number) => {
    setAiLoading(true);
    const goalStr = `${goal.label} — spend exactly ${paceVal} minutes per day on this`;
    const res = await fetchDailyInputs(goalStr);
    setAiResult(res);
    setAiLoading(false);
  }, [goal.label]);

  useEffect(() => {
    loadSuggestions(pace);
    lastFetchedPace.current = pace;
  }, [loadSuggestions]);

  const chipOptions = useMemo(() => aiResult?.suggestions?.map(s => s.input) ?? [], [aiResult]);

  useEffect(() => {
    if (actionText && !chipOptions.includes(actionText)) {
      specificity.validate(actionText);
    } else if (specificity.result) {
      specificity.dismiss();
    }
  }, [actionText, chipOptions]);

  const timeline = hoursToYears(hours, pace);

  const canReveal = actionText.trim().length > 0;

  const timeframeLabel = use77Days
    ? 'your first 77 days'
    : `your ${goal.deadline} deadline`;

  const actionLabel = actionText.trim();
  const result = actionLabel ? `${actionLabel} — ${pace} min/day` : `${pace} min/day`;

  const reset = () => {
    setRevealed(false);
    revealAnim.value = 0;
  };

  const doReveal = () => {
    setRevealed(true);
    const triggerScroll = () => scrollRef.current?.scrollToEnd({ animated: true });
    revealAnim.value = withSpring(1, { damping: 14, stiffness: 100 });
    setTimeout(() => triggerScroll(), 400);
    if (Platform.OS !== 'web') {
      let tick = 0;
      const interval = setInterval(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        tick++;
        if (tick >= 6) clearInterval(interval);
      }, 90);
    }
  };

  const revealStyle = useAnimatedStyle(() => ({
    opacity: revealAnim.value,
    transform: [
      { scale: interpolate(revealAnim.value, [0, 1], [0.85, 1]) },
    ],
  }));

  const zones = [
    { label: 'Slow', range: '15-20 min' },
    { label: 'Recommended', range: '30-40 min' },
    { label: 'Fast', range: '90-120 min' },
  ];

  const activeZone = trackPosition <= 100 / 3 ? 0 : trackPosition <= 200 / 3 ? 1 : 2;

  const zoneIconPositions = [100 / 6, 50, 100 - 100 / 6];

  return (
    <KeyboardStepWrapper ref={scrollRef} contentContainerStyle={styles.decodeScroll}>
      <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 8 }}>
        <Text
          style={[
            styles.fieldLabel,
            { color: colors.primary, fontSize: 11, letterSpacing: 1.5, marginBottom: 8 },
          ]}
        >
          YOUR DAILY COMMITMENT
        </Text>
        <Text
          style={{
            fontSize: 56,
            fontWeight: '800',
            color: colors.primary,
            fontVariant: ['tabular-nums'],
          }}
        >
          {pace}
        </Text>
        <Text
          style={{
            fontSize: 18,
            fontWeight: '600',
            color: colors.textSecondary,
            marginTop: -2,
          }}
        >
          min/day
        </Text>
      </View>

      <View style={{ marginTop: 16, paddingHorizontal: 4 }}>
        {/* Zone icons + labels positioned above the track at their true proportional locations */}
        <View style={{ position: 'relative', height: 52, marginBottom: 4 }}>
          {zones.map((zone, i) => {
            const left = zoneIconPositions[i];
            return (
              <View
                key={zone.label}
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  transform: [{ translateX: '-50%' }],
                  alignItems: 'center',
                  opacity: activeZone === i ? 1 : 0.45,
                }}
              >
                <View style={{ marginBottom: 2 }}>
                  {zone.label === 'Slow' && (
                    <Turtle size={20} color={activeZone === i ? colors.primary : colors.textTertiary} strokeWidth={2} />
                  )}
                  {zone.label === 'Recommended' && (
                    <Rabbit size={20} color={activeZone === i ? colors.primary : colors.textTertiary} strokeWidth={2} />
                  )}
                  {zone.label === 'Fast' && (
                    <Zap size={20} color={activeZone === i ? colors.primary : colors.textTertiary} strokeWidth={2} />
                  )}
                </View>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: activeZone === i ? '800' : '600',
                    color: activeZone === i ? colors.primary : colors.textSecondary,
                    letterSpacing: 0.5,
                  }}
                >
                  {zone.label.toUpperCase()}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '500',
                    color: colors.textTertiary,
                    marginTop: 1,
                  }}
                >
                  {zone.range}
                </Text>
              </View>
            );
          })}
        </View>

        <Slider
          style={{ width: '100%', height: 48 }}
          minimumValue={0}
          maximumValue={100}
          step={1}
          value={trackPosition}
          onValueChange={(v: number) => {
            setTrackPosition(Math.round(v));
            reset();
          }}
          onSlidingComplete={(v: number) => {
            const newPace = positionToPace(v);
            if (newPace !== lastFetchedPace.current) {
              lastFetchedPace.current = newPace;
              loadSuggestions(newPace);
            }
          }}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={isDark ? '#333' : '#D8D8D8'}
          thumbTintColor={colors.primary}
        />

        <Text
          style={{
            fontSize: 15,
            fontWeight: '500',
            color: colors.textSecondary,
            marginTop: 14,
            textAlign: 'center',
          }}
        >
          At this pace, you'll get there in about {timeline}
        </Text>
      </View>

      <View style={{ marginTop: 24, position: 'relative' }}>
        {aiLoading && !aiResult ? (
          <View style={[styles.loadingRow, { marginTop: 0 }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Generating suggestions...
            </Text>
          </View>
        ) : (
          <View style={{ position: 'relative' }}>
            <View pointerEvents={aiLoading ? 'none' : 'auto'} style={[aiLoading && { opacity: 0.4 }]}>
              <ChipGroup
                label="WHAT WILL YOU ACTUALLY DO?"
                options={chipOptions}
                selected={actionText || null}
                onSelect={(v: string) => {
                  setActionText(v);
                  reset();
                }}
                customPlaceholder="Write your own..."
              />
              {specificity.result && (
                <SpecificityNudgeBanner
                  result={specificity.result}
                  onAcceptExample={(ex: string) => {
                    setActionText(ex);
                    specificity.dismiss();
                  }}
                  onDismiss={specificity.dismiss}
                />
              )}
            </View>
            {aiLoading && (
              <View style={styles.updatingOverlay}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.updatingText, { color: colors.textSecondary }]}>
                  Updating...
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {canReveal && !revealed && (
        <TouchableOpacity
          style={[styles.revealBtn, { backgroundColor: colors.primary }]}
          onPress={doReveal}
          activeOpacity={0.85}
        >
          <Zap size={18} color="#000" strokeWidth={2.5} />
          <Text style={styles.revealBtnText}>See my daily commitment</Text>
        </TouchableOpacity>
      )}

      {revealed && (
        <Animated.View
          style={[
            styles.revealCard,
            { borderColor: colors.primary },
            revealStyle,
          ]}
        >
          <LinearGradient
            colors={['rgba(204,255,0,0.10)', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Text style={[styles.revealLabel, { color: colors.primary }]}>
            YOUR DAILY COMMITMENT
          </Text>
          <Text
            style={[
              styles.revealNumber,
              { color: colors.primary, fontSize: 38 },
            ]}
          >
            {pace} min/day
          </Text>
          <Text
            style={[styles.revealUnit, { color: colors.textSecondary }]}
          >
            At this pace, you'll get there in about {timeline}
          </Text>
          <TouchableOpacity
            style={[styles.lockBtn, { backgroundColor: colors.primary }]}
            onPress={() => onDone(result)}
            activeOpacity={0.85}
          >
            <Check size={18} color="#000" strokeWidth={3} />
            <Text style={styles.lockBtnText}>Lock This In</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </KeyboardStepWrapper>
  );
}

// ─── PathStarting ─────────────────────────────────────────────────────────────

export function PathStarting({
  goal,
  resolvedLabel,
  doneLooksText,
  onDone,
}: {
  goal: FlowGoal;
  resolvedLabel: string;
  doneLooksText?: string;
  onDone: (result: string, isStandard: boolean) => void;
}) {
  const { colors, isDark } = useTheme();

  const seedPrefill = goal.practiceSeed ?? '';
  const isStandardPath = seedPrefill.trim().length > 0;

  const [text, setText] = useState(seedPrefill);
  const [showEdit, setShowEdit] = useState(false);
  const specificity = useInputSpecificity();
  const canDone = text.trim().length > 0;
  const scrollRef = useRef<KeyboardStepWrapperRef>(null);

  const [aiResult, setAiResult] = useState<GoalInputResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [clarifyText, setClarifyText] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [chipSelected, setChipSelected] = useState<string | null>(null);

  useEffect(() => {
    if (isStandardPath) return;
    let cancelled = false;
    setAiLoading(true);
    fetchDailyInputs(goal.label).then(res => {
      if (cancelled) return;
      setAiResult(res);
      setAiLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    });
    return () => { cancelled = true; };
  }, [isStandardPath, goal.label]);

  const chipOptions = useMemo(() => aiResult?.suggestions?.map(s => s.input) ?? [], [aiResult]);

  useEffect(() => {
    if (isStandardPath) return;
    if (chipSelected && !chipOptions.includes(chipSelected)) {
      specificity.validate(chipSelected);
    } else if (specificity.result) {
      specificity.dismiss();
    }
  }, [chipSelected, chipOptions, isStandardPath]);

  const handleRegenerate = async () => {
    if (!clarifyText.trim() || regenerating) return;
    setRegenerating(true);
    const history = aiResult?.clarifying_question
      ? [{ question: aiResult.clarifying_question, answer: clarifyText.trim() }]
      : [{ question: '', answer: clarifyText.trim() }];
    const res = await fetchDailyInputs(goal.label, history);
    setAiResult(res);
    setClarifyText('');
    setRegenerating(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  };

  const handleLock = () => {
    if (isStandardPath) {
      if (!canDone) return;
      const trimmed = text.trim();
      onDone(trimmed, trimmed === seedPrefill.trim());
      return;
    }
    if (!chipSelected) return;
    onDone(chipSelected, false);
  };

  const finishLine = (doneLooksText ?? '').trim() || resolvedLabel;
  const isRedundant = isStandardPath && seedPrefill.trim().toLowerCase() === finishLine.trim().toLowerCase();
  const lockEnabled = isStandardPath ? canDone : !!chipSelected;

  return (
    <KeyboardStepWrapper ref={scrollRef} contentContainerStyle={styles.decodeScroll}>
      <View
        style={[
          styles.finishLineCard,
          {
            backgroundColor: isDark
              ? 'rgba(204,255,0,0.06)'
              : 'rgba(204,255,0,0.08)',
            borderColor: colors.primary + '40',
          },
        ]}
      >
        <Text style={[styles.finishLineLabel, { color: colors.primary }]}>
          YOUR FINISH LINE
        </Text>
        <Text style={[styles.finishLineText, { color: colors.text }]}>
          {finishLine}
        </Text>
      </View>

      {isStandardPath ? (
        isRedundant && !showEdit ? (
          <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={[styles.seedNoticeText, { color: colors.textSecondary, flex: 1 }]}>
              This is already your daily action — lock it in, or edit it below.
            </Text>
            <TouchableOpacity
              onPress={() => setShowEdit(true)}
              style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border }}
              activeOpacity={0.7}
            >
              <Pencil size={15} color={colors.textSecondary} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        ) : (
        <>
          <Text style={[styles.fieldLabel, { color: colors.primary, marginTop: 20 }]}>
            Daily action that produces it
          </Text>
          <TextInput
            style={[
              styles.startingInput,
              {
                color: colors.text,
                borderColor: text.trim()
                  ? colors.primary + '80'
                  : isDark
                  ? '#333'
                  : '#D8D8D8',
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(0,0,0,0.03)',
              },
            ]}
            value={text}
            onChangeText={setText}
            placeholder="e.g. write 500 words, 30 min cardio"
            placeholderTextColor={colors.textTertiary}
            multiline
            returnKeyType="done"
            blurOnSubmit={true}
            autoCapitalize="sentences"
            inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
            onBlur={() => specificity.validate(text)}
          />

          {specificity.result && (
            <SpecificityNudgeBanner
              result={specificity.result}
              onAcceptExample={(ex) => { setText(ex); specificity.dismiss(); }}
              onDismiss={specificity.dismiss}
            />
          )}

          {!isRedundant && (
            <View
              style={[
                styles.seedNotice,
                {
                  backgroundColor: isDark
                    ? 'rgba(204,255,0,0.06)'
                    : 'rgba(204,255,0,0.10)',
                  borderColor: 'rgba(204,255,0,0.25)',
                },
              ]}
            >
              <Zap size={13} color={colors.primary} strokeWidth={2.5} />
              <Text style={[styles.seedNoticeText, { color: colors.textSecondary }]}>
                Pre-filled from your goal — edit freely.
              </Text>
            </View>
          )}
        </>
        )
      ) : (
        <>
          {aiLoading && !aiResult ? (
            <View style={[styles.loadingRow, { marginTop: 20 }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Generating suggestions...
              </Text>
            </View>
          ) : (
            <>
              {aiResult?.clarifying_question && (
                <View
                  style={[
                    styles.clarifyCard,
                    {
                      backgroundColor: isDark ? 'rgba(204,255,0,0.06)' : 'rgba(204,255,0,0.08)',
                      borderColor: colors.primary + '50',
                      marginTop: 20,
                    },
                  ]}
                >
                  <Text style={[styles.clarifyLabel, { color: colors.primary }]}>CLARIFY</Text>
                  <Text style={[styles.clarifyQuestion, { color: colors.text }]}>
                    {aiResult.clarifying_question}
                  </Text>
                  <View style={styles.clarifyInputRow}>
                    <TextInput
                      style={[
                        styles.clarifyInput,
                        {
                          color: colors.text,
                          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                          borderColor: colors.border,
                        },
                      ]}
                      value={clarifyText}
                      onChangeText={setClarifyText}
                      placeholder="Your answer..."
                      placeholderTextColor={colors.textTertiary}
                      multiline
                    />
                    <TouchableOpacity
                      style={[
                        styles.regenerateBtn,
                        {
                          backgroundColor: colors.primary,
                          opacity: regenerating || !clarifyText.trim() ? 0.5 : 1,
                        },
                      ]}
                      onPress={handleRegenerate}
                      disabled={regenerating || !clarifyText.trim()}
                      activeOpacity={0.8}
                    >
                      {regenerating ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <ArrowRight size={16} color="#000" strokeWidth={2.5} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={{ position: 'relative', marginTop: 20 }}>
                <View pointerEvents={aiLoading ? 'none' : 'auto'} style={[aiLoading && { opacity: 0.4 }]}>
                  <ChipGroup
                    label="DAILY ACTION THAT PRODUCES IT"
                    options={chipOptions}
                    selected={chipSelected}
                    onSelect={setChipSelected}
                    customPlaceholder="Write your own..."
                  />
                  {specificity.result && (
                    <SpecificityNudgeBanner
                      result={specificity.result}
                      onAcceptExample={(ex) => { setChipSelected(ex); specificity.dismiss(); }}
                      onDismiss={specificity.dismiss}
                    />
                  )}
                </View>
                {aiLoading && (
                  <View style={styles.updatingOverlay}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.updatingText, { color: colors.textSecondary }]}>
                      Updating...
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </>
      )}

      <TouchableOpacity
        style={[
          styles.revealBtn,
          {
            backgroundColor: lockEnabled ? colors.primary : colors.border,
            opacity: lockEnabled ? 1 : 0.45,
            marginTop: 28,
          },
        ]}
        onPress={handleLock}
        activeOpacity={0.85}
        disabled={!lockEnabled}
      >
        <Check
          size={18}
          color={lockEnabled ? '#000' : colors.textTertiary}
          strokeWidth={3}
        />
        <Text
          style={[
            styles.revealBtnText,
            { color: lockEnabled ? '#000' : colors.textTertiary },
          ]}
        >
          Lock This In
        </Text>
      </TouchableOpacity>
    </KeyboardStepWrapper>
  );
}

// ─── PathSelectorScreen ───────────────────────────────────────────────────────

export function PathSelectorScreen({
  goal,
  n,
  resolvedLabel,
  onSelect,
  onDailyAction,
  onBack,
}: {
  goal: FlowGoal;
  n: number;
  resolvedLabel: string;
  onSelect: (path: DecodePath) => void;
  onDailyAction: () => void;
  onBack: () => void;
}) {
  const { colors, isDark } = useTheme();
  const paths: Array<{ id: DecodePath | 'daily'; label: string; mechanism: string; examples: string; onPress: () => void }> = [
    {
      id: 'numbers',
      label: "It's a numbers game",
      mechanism: 'More attempts → more wins.',
      examples: 'Deals, clients, outreach, sales calls, income.',
      onPress: () => onSelect('numbers'),
    },
    {
      id: 'practice',
      label: 'It takes time invested',
      mechanism: 'Hours in → ability out.',
      examples: 'Skills, crafts, languages.',
      onPress: () => onSelect('practice'),
    },
    {
      id: 'starting',
      label: "It's built on daily habits",
      mechanism: 'Repeat the right actions and the result follows.',
      examples: 'Health, energy, character.',
      onPress: () => onSelect('starting'),
    },
    {
      id: 'daily',
      label: 'This is the daily action',
      mechanism: 'No math needed — lock it in.',
      examples: 'e.g. Walk 10,000 steps a day. Drink a gallon of water. Save $10 a day.',
      onPress: onDailyAction,
    },
  ];

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.screen}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.decodeHeader, { paddingHorizontal: 0, paddingTop: 0 }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <GoalBadge goal={goal} n={n} resolvedLabel={resolvedLabel} />
      </View>
      <Text style={[styles.decodeQuestion, { color: colors.text, marginTop: 20 }]}>
        Which sounds like this goal?
      </Text>
      <Text style={[styles.decodeSub, { color: colors.textSecondary }]}>
        This tells us how to break it down.
      </Text>
      <View style={{ gap: 14, marginTop: 24 }}>
        {paths.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[
              styles.pathCard,
              {
                backgroundColor: isDark ? colors.backgroundSecondary : '#F8F8F8',
                borderColor: colors.border,
              },
            ]}
            onPress={p.onPress}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.pathCardLabel, { color: colors.text }]}>
                {p.label}
              </Text>
              <Text style={[styles.pathCardSub, { color: colors.textTertiary }]}>
                {p.mechanism}
              </Text>
              <Text style={[styles.pathCardSub, { color: colors.primary, marginTop: 2 }]}>
                {p.examples}
              </Text>
            </View>
            <ArrowRight size={18} color={colors.textTertiary} strokeWidth={2} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── PathNumbersDirect ───────────────────────────────────────────────────────

function fmtNumDirect(n: number): string {
  return n.toLocaleString('en-US');
}

export function PathNumbersDirect({
  goal,
  doneLooksText,
  onDone,
}: {
  goal: FlowGoal;
  doneLooksText?: string;
  onDone: (result: string, resolvedTargetStr: string) => void;
}) {
  const { colors, isDark } = useTheme();
  const targetRes = goal.targetResolution;
  const unit = goal.directUnit ?? targetRes?.unit ?? 'units';

  const deadlineMonths = DEADLINE_MONTHS[goal.deadline];
  const use77Days = deadlineMonths === undefined || goal.deadline === 'ongoing';
  const days = use77Days ? 77 : deadlineMonths * 30;

  const parsedInherited = goal.inheritedTarget ? parseFloat(goal.inheritedTarget) : NaN;
  const inferredValue = !isNaN(parsedInherited) ? parsedInherited : null;
  const askData = targetRes?.type === 'ask' ? targetRes : null;

  const [targetNum, setTargetNum] = useState<number | null>(inferredValue);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState('');
  const [askSelection, setAskSelection] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [timeframeDays, setTimeframeDays] = useState(77);
  const [timeframeSelection, setTimeframeSelection] = useState<string | null>('77 days');
  const [customTimeframeDraft, setCustomTimeframeDraft] = useState('');
  const [timeframeInputOpen, setTimeframeInputOpen] = useState(false);
  const revealAnim = useSharedValue(0);
  const targetCardAnim = useSharedValue(0);

  useEffect(() => {
    targetCardAnim.value = withSpring(1, { damping: 14, stiffness: 100 });
  }, []);
  const targetCardStyle = useAnimatedStyle(() => ({
    opacity: targetCardAnim.value,
    transform: [{ scale: interpolate(targetCardAnim.value, [0, 1], [0.85, 1]) }],
  }));

  const rawTarget = askData ? parseNum(askSelection ?? '') : (targetNum ?? NaN);
  const canReveal = !isNaN(rawTarget) && rawTarget > 0 && !timeframeInputOpen;
  const resolvedTarget = canReveal ? rawTarget : 0;

  const dailyRaw = canReveal ? Math.ceil(resolvedTarget / timeframeDays) : 0;
  const daily = canReveal ? Math.ceil(dailyRaw * 1.1) : 0;

  const doReveal = () => {
    setRevealed(true);
    revealAnim.value = withSpring(1, { damping: 14, stiffness: 100 });
    if (Platform.OS !== 'web') {
      let tick = 0;
      const interval = setInterval(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        tick++;
        if (tick >= 6) clearInterval(interval);
      }, 90);
    }
  };

  const revealStyle = useAnimatedStyle(() => ({
    opacity: revealAnim.value,
    transform: [{ scale: interpolate(revealAnim.value, [0, 1], [0.85, 1]) }],
  }));

  const handleLock = () => {
    if (!canReveal) return;
    const result = `${fmtNumDirect(daily)} ${unit}/day`;
    const targetStr = String(resolvedTarget);
    onDone(result, targetStr);
  };

  const dailyFontSize = daily >= 10000 ? 36 : daily >= 1000 ? 44 : 56;

  const handleEditTarget = () => {
    setTargetDraft(String(targetNum ?? ''));
    setEditingTarget(true);
  };

  const commitEdit = () => {
    const parsed = parseNum(targetDraft.trim());
    if (!isNaN(parsed) && parsed > 0) {
      setTargetNum(parsed);
    }
    setEditingTarget(false);
  };

  const askOptions = useMemo(() => askData?.suggestions ?? [], [askData]);

  return (
    <KeyboardStepWrapper contentContainerStyle={styles.decodeScroll}>
      {inferredValue !== null ? (
        <Animated.View
          style={[
            styles.inheritedTargetCard,
            {
              backgroundColor: isDark ? 'rgba(204,255,0,0.06)' : 'rgba(204,255,0,0.08)',
              borderColor: colors.primary + '50',
            },
            targetCardStyle,
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.inheritedLabel, { color: colors.primary }]}>
              ESTIMATED TARGET
            </Text>
            {!editingTarget ? (
              <Text style={[styles.inheritedValue, { color: colors.text }]}>
                {fmtNumDirect(targetNum ?? inferredValue)}{' '}
                <Text style={{ color: colors.primary, fontSize: 14 }}>
                  {unit} ✓ editable
                </Text>
              </Text>
            ) : (
              <View style={styles.customRow}>
                <TextInput
                  style={[
                    styles.customInlineInput,
                    {
                      color: colors.text,
                      borderColor: colors.primary + '80',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    },
                  ]}
                  value={targetDraft}
                  onChangeText={setTargetDraft}
                  placeholder={`e.g. ${inferredValue}`}
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="default"
                  autoFocus
                  returnKeyType="done"
                  inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
                  onSubmitEditing={commitEdit}
                />
                <TouchableOpacity
                  style={[styles.customConfirmBtn, { backgroundColor: colors.primary }]}
                  onPress={commitEdit}
                >
                  <Check size={16} color="#000" strokeWidth={3} />
                </TouchableOpacity>
              </View>
            )}
          </View>
          {!editingTarget && (
            <TouchableOpacity
              onPress={handleEditTarget}
              style={styles.editAffordance}
              activeOpacity={0.7}
            >
              <Pencil size={14} color={colors.textTertiary} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </Animated.View>
      ) : askData ? (
        <View style={{ marginTop: 8 }}>
          <Text style={[styles.fieldLabel, { color: colors.primary, marginBottom: 4 }]}>
            {(askData.question ?? 'What\'s your target?').toUpperCase()}
          </Text>
          <ChipGroup
            label={`YOUR TARGET IN ${unit.toUpperCase()}`}
            options={askOptions}
            selected={askSelection}
            onSelect={setAskSelection}
            customPlaceholder={`Enter your target...`}
            keyboardType="numeric"
          />
        </View>
      ) : (
        <ChipGroup
          label="YOUR TARGET"
          options={[]}
          selected={askSelection}
          onSelect={setAskSelection}
          customPlaceholder="Enter your target..."
          keyboardType="numeric"
        />
      )}

      {canReveal && (
        <View style={{ marginTop: 8 }}>
          <ChipGroup
            label="YOUR TIMEFRAME"
            options={['77 days', '3 months', '6 months', '1 year']}
            selected={timeframeSelection}
            onSelect={(v) => {
              setTimeframeSelection(v);
              setCustomTimeframeDraft('');
              setTimeframeInputOpen(false);
              if (v === '77 days') setTimeframeDays(77);
              else if (v === '3 months') setTimeframeDays(90);
              else if (v === '6 months') setTimeframeDays(180);
              else if (v === '1 year') setTimeframeDays(365);
              else {
                const numMatch = v.match(/(\d[\d,]*)/);
                if (!numMatch) return;
                const num = parseInt(numMatch[1].replace(/,/g, ''), 10);
                if (isNaN(num) || num <= 0) return;
                const unitMatch = v.match(/\d[\d,]*\s*([a-zA-Z]+)/);
                const unitLetter = unitMatch ? unitMatch[1][0].toLowerCase() : '';
                let multiplier = 1;
                if (unitLetter === 'y') multiplier = 365;
                else if (unitLetter === 'm') multiplier = 30;
                else if (unitLetter === 'w') multiplier = 7;
                else multiplier = 1;
                setTimeframeDays(num * multiplier);
              }
            }}
            customPlaceholder="e.g. 45 days, 6 months, 2 years"
            onCustomInputOpenChange={setTimeframeInputOpen}
          />
        </View>
      )}

      {canReveal && !revealed && (
        <TouchableOpacity
          style={[styles.revealBtn, { backgroundColor: colors.primary }]}
          onPress={doReveal}
          activeOpacity={0.85}
        >
          <Zap size={18} color="#000" strokeWidth={2.5} />
          <Text style={styles.revealBtnText}>Reveal my daily number</Text>
        </TouchableOpacity>
      )}

      {revealed && (
        <Animated.View
          style={[
            styles.revealCard,
            { borderColor: colors.primary },
            revealStyle,
          ]}
        >
          <LinearGradient
            colors={['rgba(204,255,0,0.10)', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Text style={[styles.revealLabel, { color: colors.primary }]}>
            YOUR DAILY NUMBER
          </Text>
          <Text
            style={[
              styles.revealNumber,
              { color: colors.primary, fontSize: dailyFontSize },
            ]}
          >
            {fmtNumDirect(daily)}
          </Text>
          <Text style={[styles.revealUnit, { color: colors.textSecondary }]}>
            {unit}/day
          </Text>
          <View
            style={[
              styles.mathBox,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.mathLine, { color: colors.textSecondary }]}>
              {fmtNumDirect(resolvedTarget)} {unit} ÷ {timeframeDays} days = {fmtNumDirect(dailyRaw)}/{unit}
            </Text>
            <Text style={[styles.mathLine, { color: colors.textSecondary }]}>
              with 10% buffer → {fmtNumDirect(daily)} {unit}/day
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.lockBtn, { backgroundColor: timeframeInputOpen ? colors.border : colors.primary, opacity: timeframeInputOpen ? 0.45 : 1 }]}
            onPress={handleLock}
            activeOpacity={0.85}
            disabled={timeframeInputOpen}
          >
            <Check size={18} color={timeframeInputOpen ? colors.textTertiary : '#000'} strokeWidth={3} />
            <Text style={[styles.lockBtnText, { color: timeframeInputOpen ? colors.textTertiary : '#000' }]}>Lock This In</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </KeyboardStepWrapper>
  );
}
