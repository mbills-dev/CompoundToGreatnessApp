import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ArrowRight, Check, Zap, Pencil } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FlowGoal, DecodePath } from './types';
import { GoalBadge } from './AnchorScreens';
import styles from './styles';

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

function PresetChip({
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

function ChipGroup({
  label,
  options,
  selected,
  onSelect,
  keyboardType = 'default',
  customPlaceholder = 'Type your own...',
}: {
  label: string;
  options: string[];
  selected: string | null;
  onSelect: (v: string) => void;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  customPlaceholder?: string;
}) {
  const { colors, isDark } = useTheme();

  const isCustomSelected =
    selected !== null && !options.includes(selected);

  const [showInput, setShowInput] = useState(false);
  const [draft, setDraft] = useState('');

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
    revealAnim.value = withSpring(1, { damping: 14, stiffness: 100 });
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
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.decodeScroll}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {targetStr.trim() ? (
        <View
          style={[
            styles.inheritedTargetCard,
            {
              backgroundColor: isDark
                ? 'rgba(204,255,0,0.06)'
                : 'rgba(204,255,0,0.08)',
              borderColor: colors.primary + '50',
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.inheritedLabel, { color: colors.primary }]}>
              {period.label} TARGET
            </Text>
            {!editingTarget ? (
              <Text style={[styles.inheritedValue, { color: colors.text }]}>
                {targetStr}{' '}
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
        </View>
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
    </ScrollView>
  );
}

// ─── PathPractice ─────────────────────────────────────────────────────────────

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

  const hourChips = ['~100 hrs', '~300 hrs', '~600 hrs', '~1,000 hrs', 'No idea'];
  const paceChips = ['15 min/day', '30 min/day', '60 min/day', '120 min/day'];

  const [hoursChip, setHoursChip] = useState<string | null>(null);
  const [paceChip, setPaceChip] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [actionText, setActionText] = useState('');

  const hoursMap: Record<string, number> = {
    '~100 hrs': 100,
    '~300 hrs': 300,
    '~600 hrs': 600,
    '~1,000 hrs': 1000,
    'No idea': 300,
  };
  const paceMap: Record<string, number> = {
    '15 min/day': 15,
    '30 min/day': 30,
    '60 min/day': 60,
    '120 min/day': 120,
  };

  const revealAnim = useSharedValue(0);

  const knowsHours = hoursChip !== null && hoursChip !== 'No idea';
  const hours = hoursChip
    ? hoursMap[hoursChip] ?? parseNum(hoursChip)
    : null;
  const pace = paceChip
    ? paceMap[paceChip] ?? parseNum(paceChip)
    : null;

  const bankedDays = use77Days ? 77 : (deadlineMonths ?? 12) * 30;
  const banked =
    paceChip && !knowsHours && pace
      ? Math.round((bankedDays * pace) / 60)
      : null;
  const timeline =
    knowsHours && hours && pace ? hoursToYears(hours, pace) : null;

  const canReveal = hoursChip !== null && paceChip !== null && actionText.trim().length > 0;

  const timeframeLabel = use77Days
    ? 'your first 77 days'
    : `your ${goal.deadline} deadline`;

  const actionLabel = actionText.trim();
  const result = actionLabel ? `${actionLabel} — ${paceChip}` : paceChip ?? '';

  const reset = () => {
    setRevealed(false);
    revealAnim.value = 0;
  };

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
    transform: [
      { scale: interpolate(revealAnim.value, [0, 1], [0.85, 1]) },
    ],
  }));

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.decodeScroll}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <ChipGroup
        label="Total hours to mastery"
        options={hourChips}
        selected={hoursChip}
        onSelect={v => {
          setHoursChip(v);
          reset();
        }}
        keyboardType="numeric"
        customPlaceholder="e.g. 500"
      />

      {hoursChip && (
        <View style={{ marginTop: 20 }}>
          <ChipGroup
            label={
              knowsHours
                ? 'Daily pace (see timeline)'
                : `Time budget (hours banked in ${timeframeLabel})`
            }
            options={paceChips}
            selected={paceChip}
            onSelect={v => {
              setPaceChip(v);
              reset();
            }}
            keyboardType="numeric"
            customPlaceholder="e.g. 45 min/day"
          />
        </View>
      )}

      {paceChip && (
        <View style={{ marginTop: 20 }}>
          <Text style={[styles.fieldLabel, { color: colors.primary }]}>
            What will you actually do?
          </Text>
          <TextInput
            style={[
              styles.customInlineInput,
              { flex: 0 },
              {
                color: colors.text,
                borderColor: colors.primary + '80',
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              },
            ]}
            value={actionText}
            onChangeText={t => {
              setActionText(t);
              reset();
            }}
            placeholder="e.g. listen to a French podcast"
            placeholderTextColor={colors.textTertiary}
            returnKeyType="done"
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
            {paceChip}
          </Text>
          {knowsHours ? (
            <Text
              style={[styles.revealUnit, { color: colors.textSecondary }]}
            >
              Goal reached in {timeline}
            </Text>
          ) : (
            <Text
              style={[styles.revealUnit, { color: colors.textSecondary }]}
            >
              {banked} hours banked in {timeframeLabel}
            </Text>
          )}
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
    </ScrollView>
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
  const [text, setText] = useState(seedPrefill);
  const canDone = text.trim().length > 0;

  const handleLock = () => {
    if (!canDone) return;
    const trimmed = text.trim();
    const isStandard = seedPrefill.trim().length > 0 && trimmed === seedPrefill.trim();
    onDone(trimmed, isStandard);
  };

  const finishLine = (doneLooksText ?? '').trim() || resolvedLabel;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.decodeScroll}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
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
      />

      {seedPrefill.trim().length > 0 && (
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

      <TouchableOpacity
        style={[
          styles.revealBtn,
          {
            backgroundColor: canDone ? colors.primary : colors.border,
            opacity: canDone ? 1 : 0.45,
            marginTop: 28,
          },
        ]}
        onPress={handleLock}
        activeOpacity={0.85}
        disabled={!canDone}
      >
        <Check
          size={18}
          color={canDone ? '#000' : colors.textTertiary}
          strokeWidth={3}
        />
        <Text
          style={[
            styles.revealBtnText,
            { color: canDone ? '#000' : colors.textTertiary },
          ]}
        >
          Lock This In
        </Text>
      </TouchableOpacity>
    </ScrollView>
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
