import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
  PanResponder,
  Animated as RNAnimated,
} from 'react-native';
import Svg, { Path as SvgPath, Line as SvgLine } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, ArrowRight, Check, Zap, RefreshCw, ChartBar as BarChart2, Dumbbell, Heart, Pencil, Sparkles, ListFilter as Filter } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import WhenPickerModal, { WhenPickerValue } from './WhenPickerModal';
import SignupSplashScreen from '@/components/SignupSplashScreen';
import PaywallGate from '@/components/PaywallGate';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DecodePath = 'numbers' | 'practice' | 'starting';

export interface MockGoal {
  id: number;
  // Static label used when no override is active.
  label: string;
  // If the goal has a variable component (e.g. a target amount), this
  // function derives the full label from the current value. When present,
  // callers must use formatGoalLabel() instead of goal.label directly.
  deriveLabel?: (currentTarget: string) => string;
  category: string;
  deadline: string;
  practiceSeed?: string;
  defaultPath: DecodePath;
  inheritedTarget?: string;
}

export interface AnchoredInput {
  dailyInput: string;
  when: string;
  where: string;
  schedule: WhenPickerValue | null;
  isStandard?: boolean;
}

export interface LockedGoal {
  goalId: number;
  dailyInput: string;
  goalLabel: string;
  doneLooksText?: string;
  what: string;
  when: string;
  where: string;
  schedule: WhenPickerValue | null;
  isStandard?: boolean;
  decodePath: DecodePath;
  resolvedTargetStr?: string;
  additionalInputs: AnchoredInput[];
}

// Returns the current display label for a goal. Pass goalLabelOverrides from
// root state; when no override exists the static goal.label is used.
function formatGoalLabel(
  goal: MockGoal,
  goalLabelOverrides: Record<number, string>,
): string {
  return goalLabelOverrides[goal.id] ?? goal.label;
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

// Parse a number from a raw string. Handles:
//   "$25,000" → 25000, "100k" → 100000, "$1.5M" → 1500000
function parseNum(raw: string): number {
  const s = raw.trim();
  // Match optional $ + digits/decimals + optional K/M suffix
  const match = s.match(/\$?([\d,]+(?:\.\d+)?)\s*([KkMm])?/);
  if (!match) return NaN;
  const digits = parseFloat(match[1].replace(/,/g, ''));
  if (isNaN(digits)) return NaN;
  const suffix = match[2]?.toUpperCase();
  if (suffix === 'K') return Math.round(digits * 1_000);
  if (suffix === 'M') return Math.round(digits * 1_000_000);
  return Math.round(digits);
}

// ratio is stored as an integer (e.g. 10 means "1-in-10")
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

function bankHours(deadlineMonths: number, minPerDay: number): number {
  const days = deadlineMonths * 30;
  return Math.round((days * minPerDay) / 60);
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}

// Normalizes a raw target string for display: trims, prefixes "$" if missing,
// uppercases K/M suffix. e.g. "100k" → "$100K", "$25,000" → "$25,000".
function normalizeTarget(raw: string): string {
  const s = raw.trim();
  const withDollar = s.startsWith('$') ? s : `$${s}`;
  return withDollar.replace(/([kmKM])$/, m => m.toUpperCase());
}

// Normalizes money tokens in a goal label at parse time.
// Only activates when the label contains money-context words — "run a 5K"
// and "10,000 steps a day" pass through unchanged.
function normalizeMoneyInLabel(label: string): string {
  const hasMoneyContext =
    /\$|earn|make|revenue|income|profit|save|salary|sales/i.test(label);
  if (!hasMoneyContext) return label;
  return label.replace(
    /(\$\s*)?(\d[\d,]*(?:\.\d+)?)\s*([kKmM])\b/g,
    (_, _dollar, num, suf) => `$${num}${suf.toUpperCase()}`,
  );
}

// ─── Goals ───────────────────────────────────────────────────────────────────

const GOALS: MockGoal[] = [
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

const DEADLINE_MONTHS: Record<string, number> = {
  ongoing: 12,
  '6 months': 6,
};

// ─── PresetChip ───────────────────────────────────────────────────────────────
// Extracted into its own component so useSharedValue + useAnimatedStyle are
// called at the top level of a component, never inside a .map() loop.

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
    anim.value = withDelay(
      delayMs,
      withSpring(1, { damping: 16, stiffness: 120 }),
    );
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

// ─── ChipGroup ────────────────────────────────────────────────────────────────
// selected: currently selected value (may be a custom string not in options[])
// onSelect: receives the committed string
// On confirm: input collapses → lime selected chip showing the value + pencil.
// Tapping the lime chip re-opens the input pre-filled for editing.
// Selecting a preset chip clears any custom selection.

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

  // A custom value is active when selected is set and not one of the presets.
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
        {/* Preset chips — each is its own component to satisfy Rules of Hooks */}
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

        {/* Lime selected chip for committed custom values */}
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

        {/* "my own" dashed entry chip — hidden when input open or custom active */}
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

      {/* Inline input — shown while editing */}
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

// ─── Shared sub-components ────────────────────────────────────────────────────

export function GoalBadge({
  goal,
  n,
  resolvedLabel,
}: {
  goal: MockGoal;
  n: number;
  resolvedLabel: string;
}) {
  const { colors, isDark } = useTheme();
  const allIcons = [
    <BarChart2 key={1} size={16} color={colors.primary} strokeWidth={2.5} />,
    <Dumbbell key={2} size={16} color={colors.primary} strokeWidth={2.5} />,
    <Heart key={3} size={16} color={colors.primary} strokeWidth={2.5} />,
    <Zap key={4} size={16} color={colors.primary} strokeWidth={2.5} />,
    <Sparkles key={5} size={16} color={colors.primary} strokeWidth={2.5} />,
  ];
  return (
    <View
      style={[
        styles.goalBadge,
        {
          backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5',
          borderColor: colors.border,
        },
      ]}
    >
      {allIcons[(n - 1) % allIcons.length]}
      <Text
        style={[styles.goalBadgeText, { color: colors.textSecondary }]}
        numberOfLines={1}
      >
        Goal {n}: {resolvedLabel}
      </Text>
    </View>
  );
}

function ProgressBar({ value, total }: { value: number; total: number }) {
  const { colors } = useTheme();
  const pct = total > 0 ? value / total : 0;
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withSpring(pct, { damping: 20, stiffness: 90 });
  }, [pct]);
  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%` as any,
  }));
  return (
    <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
      <Animated.View
        style={[
          styles.progressFill,
          { backgroundColor: colors.primary },
          barStyle,
        ]}
      />
    </View>
  );
}

// ─── Path A: Numbers ──────────────────────────────────────────────────────────

// Extract the first number-like token from a string for target inheritance.
// Prefers a value with K/M suffix or $ sign; falls back to bare digits.
function extractTargetFromText(text: string): string | null {
  const match = text.match(/\$[\d,]+(?:\.\d+)?(?:\s*[KkMm])?|[\d,]+(?:\.\d+)?\s*[KkMm]|\$[\d,]+/);
  return match ? match[0].trim() : null;
}

export function PathNumbers({
  goal,
  doneLooksText,
  onDone,
}: {
  goal: MockGoal;
  doneLooksText?: string;
  // Second arg carries the resolved target string so the root can
  // derive the updated goal label without duplicating state.
  // Third arg carries the structured decode payload for Dimension enrichment.
  onDone: (
    result: string,
    resolvedTargetStr: string,
    payload: { dailyNumber: number; winNoun: string; actionNoun: string; ratio: number },
  ) => void;
}) {
  const { colors, isDark } = useTheme();

  // Target: prefer doneLooksText extraction, then goal.inheritedTarget.
  // Normalize immediately so every downstream consumer gets a clean value.
  const rawTarget =
    (doneLooksText ? extractTargetFromText(doneLooksText) : null) ??
    goal.inheritedTarget ??
    '';
  const derivedTarget = rawTarget ? normalizeTarget(rawTarget) : '';

  const [targetStr, setTargetStr] = useState(derivedTarget);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState('');

  const resolvedTarget = parseNum(targetStr);
  // Monthly target always uses 30-day period regardless of deadline
  const daysPerPeriod = 30;

  // Win noun
  const winNounOptions = ['deal', 'sale', 'client', 'order'];
  const [winNoun, setWinNoun] = useState<string | null>(null);

  // Win worth (stored as raw string so custom values round-trip cleanly)
  const worthOptions = ['$500', '$1,000', '$2,500', '$5,000', '$10,000'];
  const [worthStr, setWorthStr] = useState<string | null>(null);
  const perWin =
    worthStr !== null ? parseNum(worthStr) : NaN;

  // Action noun
  const actionNounOptions = ['offer', 'call', 'text', 'email'];
  const [actionNoun, setActionNoun] = useState<string | null>(null);

  // Ratio (stored as raw string: "1-in-10" or custom "15,000")
  const ratioOptions = ['1-in-5', '1-in-10', '1-in-20', '1-in-50'];
  const [ratioStr, setRatioStr] = useState<string | null>(null);

  // Parse ratio: preset "1-in-10" → 10; custom "15,000" → 15000
  const parseRatio = (s: string): number => {
    if (s.startsWith('1-in-')) return parseInt(s.slice(5), 10);
    return parseNum(s);
  };
  const ratio =
    ratioStr !== null ? parseRatio(ratioStr) : NaN;

  const [revealed, setRevealed] = useState(false);
  const revealAnim = useSharedValue(0);

  // Reset reveal whenever inputs change
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

  // Scale reveal number font down for larger values
  const dailyFontSize =
    daily >= 10000 ? 36 : daily >= 1000 ? 44 : 56;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.decodeScroll}
    >
      {/* ── Target: inherited card (when parsed) or chip entry (when not) ── */}
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
              MONTHLY TARGET
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

      {/* ── Win noun ── */}
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

      {/* ── Win worth ── */}
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

      {/* ── Action noun ── */}
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

      {/* ── Ratio ── */}
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

      {/* ── Reveal button ── */}
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

      {/* ── Reveal card ── */}
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
              { dailyNumber: daily, winNoun: wn, actionNoun: an, ratio },
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

// ─── Path B: Practice ─────────────────────────────────────────────────────────

export function PathPractice({
  goal,
  onDone,
}: {
  goal: MockGoal;
  onDone: (result: string) => void;
}) {
  const { colors } = useTheme();
  const deadlineMonths = DEADLINE_MONTHS[goal.deadline];
  // When no deadline (or "ongoing"), frame on the 77-day challenge.
  const use77Days = deadlineMonths === undefined || goal.deadline === 'ongoing';

  const hourChips = ['~100 hrs', '~300 hrs', '~600 hrs', '~1,000 hrs', 'No idea'];
  const paceChips = ['15 min/day', '30 min/day', '60 min/day', '120 min/day'];

  const [hoursChip, setHoursChip] = useState<string | null>(null);
  const [paceChip, setPaceChip] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

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

  // Banked hours: use 77 days or explicit deadline months.
  const bankedDays = use77Days ? 77 : (deadlineMonths ?? 12) * 30;
  const banked =
    paceChip && !knowsHours && pace
      ? Math.round((bankedDays * pace) / 60)
      : null;
  const timeline =
    knowsHours && hours && pace ? hoursToYears(hours, pace) : null;

  const canReveal = hoursChip !== null && paceChip !== null;

  // Human-readable timeframe label (never "ongoing" or bare "deadline").
  const timeframeLabel = use77Days
    ? 'your first 77 days'
    : `your ${goal.deadline} deadline`;

  const result = knowsHours
    ? `${paceChip} — done in ${timeline}`
    : `${paceChip} — ${banked} hrs banked in ${timeframeLabel}`;

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

// ─── Path C: Just starting ────────────────────────────────────────────────────

export function PathStarting({
  goal,
  resolvedLabel,
  doneLooksText,
  onDone,
}: {
  goal: MockGoal;
  resolvedLabel: string;
  doneLooksText?: string;
  // isStandard auto-detected: true when user locks without editing the prefill.
  onDone: (result: string, isStandard: boolean) => void;
}) {
  const { colors, isDark } = useTheme();

  // Only prefill from practiceSeed (fuel-redirect / option-4 route).
  // Never prefill with outcome / goal text.
  const seedPrefill = goal.practiceSeed ?? '';
  const [text, setText] = useState(seedPrefill);
  const canDone = text.trim().length > 0;

  const handleLock = () => {
    if (!canDone) return;
    const trimmed = text.trim();
    // Standard: user locked without changing the seed prefill.
    const isStandard = seedPrefill.trim().length > 0 && trimmed === seedPrefill.trim();
    onDone(trimmed, isStandard);
  };

  // Finish line: prefer doneLooksText; fall back to resolvedLabel.
  const finishLine = (doneLooksText ?? '').trim() || resolvedLabel;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.decodeScroll}
    >
      {/* ── Finish line context card ── */}
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

// ─── Anchor screen ────────────────────────────────────────────────────────────

export function AnchorScreen({
  goal,
  dailyInput,
  isStandard,
  onDone,
}: {
  goal: MockGoal;
  dailyInput: string;
  isStandard?: boolean;
  onDone: (when: string, where: string, schedule: WhenPickerValue | null) => void;
}) {
  const { colors, isDark } = useTheme();
  const [what, setWhat] = useState(dailyInput);
  const [editingWhat, setEditingWhat] = useState(false);

  const [whenPickerOpen, setWhenPickerOpen] = useState(false);
  const [whenValue, setWhenValue] = useState<WhenPickerValue | null>(null);
  const [where, setWhere] = useState('');

  const canCommit = whenValue !== null && where.trim().length > 0;

  const formatWhen = (v: WhenPickerValue) => {
    const days =
      v.days.length === 7
        ? 'every day'
        : v.days.length === 5 &&
          ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].every(d =>
            v.days.includes(d),
          )
        ? 'weekdays'
        : v.days.join(', ');
    if (v.allDay) return `All day · ${days}`;
    const min = String(v.minute).padStart(2, '0');
    return `${v.hour}:${min} ${v.period} · ${days}`;
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.decodeScroll}
    >
      {/* WHAT */}
      <Text style={[styles.fieldLabel, { color: colors.primary }]}>
        WHAT
      </Text>
      {!editingWhat ? (
        <View
          style={[
            styles.anchorWhatCard,
            {
              backgroundColor: isDark
                ? colors.backgroundSecondary
                : '#F5F5F5',
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[styles.anchorWhatText, { color: colors.text }]}
          >
            {what}
          </Text>
          <TouchableOpacity
            onPress={() => setEditingWhat(true)}
            style={styles.editAffordance}
            activeOpacity={0.7}
          >
            <Pencil
              size={14}
              color={colors.textTertiary}
              strokeWidth={2}
            />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.customRow}>
          <TextInput
            style={[
              styles.customInlineInput,
              styles.anchorEditInput,
              {
                color: colors.text,
                borderColor: colors.primary + '80',
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.03)',
              },
            ]}
            value={what}
            onChangeText={setWhat}
            autoFocus
            multiline
            returnKeyType="done"
            onSubmitEditing={() => setEditingWhat(false)}
          />
          <TouchableOpacity
            style={[
              styles.customConfirmBtn,
              { backgroundColor: colors.primary },
            ]}
            onPress={() => setEditingWhat(false)}
          >
            <Check size={16} color="#000" strokeWidth={3} />
          </TouchableOpacity>
        </View>
      )}

      {/* WHEN */}
      <Text
        style={[
          styles.fieldLabel,
          { color: colors.primary, marginTop: 24 },
        ]}
      >
        WHEN
      </Text>
      <TouchableOpacity
        style={[
          styles.whenField,
          {
            backgroundColor: isDark
              ? colors.backgroundSecondary
              : '#F5F5F5',
            borderColor: whenValue
              ? colors.primary + '60'
              : colors.border,
          },
        ]}
        onPress={() => setWhenPickerOpen(true)}
        activeOpacity={0.8}
      >
        {whenValue ? (
          <Text style={[styles.whenFieldText, { color: colors.text }]}>
            {formatWhen(whenValue)}
          </Text>
        ) : (
          <Text
            style={[
              styles.whenFieldText,
              { color: colors.textTertiary },
            ]}
          >
            Tap to set schedule...
          </Text>
        )}
        <Pencil
          size={14}
          color={colors.textTertiary}
          strokeWidth={2}
        />
      </TouchableOpacity>
      <Text
        style={[styles.calendarHint, { color: colors.textTertiary }]}
      >
        → will sync to your calendar
      </Text>

      {/* WHERE */}
      <Text
        style={[
          styles.fieldLabel,
          { color: colors.primary, marginTop: 24 },
        ]}
      >
        WHERE
      </Text>
      <TextInput
        style={[
          styles.whereInput,
          {
            color: colors.text,
            borderColor: where.trim()
              ? colors.primary + '60'
              : colors.border,
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.04)'
              : 'rgba(0,0,0,0.03)',
          },
        ]}
        value={where}
        onChangeText={setWhere}
        placeholder="e.g. my home office desk"
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="sentences"
      />

      {whenValue && where.trim() && (
        <View
          style={[
            styles.systemPreview,
            {
              backgroundColor: isDark
                ? 'rgba(204,255,0,0.04)'
                : 'rgba(204,255,0,0.06)',
              borderColor: 'rgba(204,255,0,0.3)',
            },
          ]}
        >
          <Text
            style={[styles.systemPreviewText, { color: colors.text }]}
          >
            {formatWhen(whenValue)},{' '}
            <Text style={{ color: colors.primary }}>{where}</Text>:{' '}
            {what}.
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.revealBtn,
          {
            backgroundColor: canCommit ? colors.primary : colors.border,
            opacity: canCommit ? 1 : 0.45,
            marginTop: 28,
          },
        ]}
        onPress={() =>
          canCommit &&
          onDone(
            whenValue ? formatWhen(whenValue) : '',
            where.trim(),
            whenValue,
          )
        }
        activeOpacity={0.85}
        disabled={!canCommit}
      >
        <Zap
          size={18}
          color={canCommit ? '#000' : colors.textTertiary}
          strokeWidth={2.5}
        />
        <Text
          style={[
            styles.revealBtnText,
            { color: canCommit ? '#000' : colors.textTertiary },
          ]}
        >
          Confirm
        </Text>
      </TouchableOpacity>

      <WhenPickerModal
        visible={whenPickerOpen}
        onClose={() => setWhenPickerOpen(false)}
        onConfirm={v => {
          setWhenValue(v);
          setWhenPickerOpen(false);
        }}
        initialValue={whenValue ?? undefined}
      />
    </ScrollView>
  );
}

// ─── Add additional input screen ─────────────────────────────────────────────
// Compact anchor form for adding more daily inputs to an already-locked goal.

export function AddInputScreen({
  goal,
  onDone,
  onCancel,
}: {
  goal: MockGoal;
  onDone: (dailyInput: string, when: string, where: string, schedule: WhenPickerValue | null) => void;
  onCancel: () => void;
}) {
  const { colors, isDark } = useTheme();
  const [text, setText] = useState('');
  const [whenPickerOpen, setWhenPickerOpen] = useState(false);
  const [whenValue, setWhenValue] = useState<WhenPickerValue | null>(null);
  const [where, setWhere] = useState('');

  const canCommit =
    text.trim().length > 0 && whenValue !== null && where.trim().length > 0;

  const formatWhen = (v: WhenPickerValue) => {
    const days =
      v.days.length === 7
        ? 'every day'
        : v.days.length === 5 &&
          ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].every(d => v.days.includes(d))
        ? 'weekdays'
        : v.days.join(', ');
    if (v.allDay) return `All day · ${days}`;
    const min = String(v.minute).padStart(2, '0');
    return `${v.hour}:${min} ${v.period} · ${days}`;
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.decodeScroll}
    >
      <Text style={[styles.fieldLabel, { color: colors.primary }]}>WHAT</Text>
      <TextInput
        style={[
          styles.startingInput,
          {
            color: colors.text,
            borderColor: text.trim() ? colors.primary + '80' : isDark ? '#333' : '#D8D8D8',
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.04)'
              : 'rgba(0,0,0,0.03)',
          },
        ]}
        value={text}
        onChangeText={setText}
        placeholder={`e.g. 10,000 steps`}
        placeholderTextColor={colors.textTertiary}
        multiline
        autoCapitalize="sentences"
        autoFocus
      />

      <Text style={[styles.fieldLabel, { color: colors.primary, marginTop: 24 }]}>
        WHEN
      </Text>
      <TouchableOpacity
        style={[
          styles.whenField,
          {
            backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5',
            borderColor: whenValue ? colors.primary + '60' : colors.border,
          },
        ]}
        onPress={() => setWhenPickerOpen(true)}
        activeOpacity={0.8}
      >
        {whenValue ? (
          <Text style={[styles.whenFieldText, { color: colors.text }]}>
            {formatWhen(whenValue)}
          </Text>
        ) : (
          <Text style={[styles.whenFieldText, { color: colors.textTertiary }]}>
            Tap to set schedule...
          </Text>
        )}
        <Pencil size={14} color={colors.textTertiary} strokeWidth={2} />
      </TouchableOpacity>

      <Text style={[styles.fieldLabel, { color: colors.primary, marginTop: 24 }]}>
        WHERE
      </Text>
      <TextInput
        style={[
          styles.whereInput,
          {
            color: colors.text,
            borderColor: where.trim() ? colors.primary + '60' : colors.border,
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.04)'
              : 'rgba(0,0,0,0.03)',
          },
        ]}
        value={where}
        onChangeText={setWhere}
        placeholder="e.g. outside around the block"
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="sentences"
      />

      <TouchableOpacity
        style={[
          styles.revealBtn,
          {
            backgroundColor: canCommit ? colors.primary : colors.border,
            opacity: canCommit ? 1 : 0.45,
            marginTop: 28,
          },
        ]}
        onPress={() =>
          canCommit &&
          onDone(text.trim(), whenValue ? formatWhen(whenValue) : '', where.trim(), whenValue)
        }
        disabled={!canCommit}
        activeOpacity={0.85}
      >
        <Check size={18} color={canCommit ? '#000' : colors.textTertiary} strokeWidth={3} />
        <Text style={[styles.revealBtnText, { color: canCommit ? '#000' : colors.textTertiary }]}>
          Add this input
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.standardsSkipBtn}
        onPress={onCancel}
        activeOpacity={0.7}
      >
        <Text style={[styles.standardsSkipText, { color: colors.textTertiary }]}>
          Cancel
        </Text>
      </TouchableOpacity>

      <WhenPickerModal
        visible={whenPickerOpen}
        onClose={() => setWhenPickerOpen(false)}
        onConfirm={v => {
          setWhenValue(v);
          setWhenPickerOpen(false);
        }}
        initialValue={whenValue ?? undefined}
      />
    </ScrollView>
  );
}

// ─── Per-goal micro-celebration ───────────────────────────────────────────────

export function GoalLockedScreen({
  n,
  total,
  goal,
  resolvedLabel,
  lockedGoal,
  onNext,
  onAddInput,
}: {
  n: number;
  total: number;
  goal: MockGoal;
  resolvedLabel: string;
  lockedGoal: LockedGoal;
  onNext: () => void;
  onAddInput: () => void;
}) {
  const { colors, isDark } = useTheme();
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);
  const btnOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 120 });
    opacity.value = withTiming(1, { duration: 400 });
    btnOpacity.value = withDelay(700, withTiming(1, { duration: 400 }));
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
  }));

  const isLast = n === total;
  const allInputs = [lockedGoal, ...lockedGoal.additionalInputs];
  const canAddMore = allInputs.length < 5;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        styles.screen,
        { justifyContent: 'center', alignItems: 'center', paddingVertical: 32 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View
        style={[
          styles.lockedCard,
          {
            backgroundColor: isDark ? colors.backgroundSecondary : '#FAFAFA',
            borderColor: colors.primary,
            width: '100%',
          },
          cardStyle,
        ]}
      >
        <LinearGradient
          colors={['rgba(204,255,0,0.12)', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        {/* Header row */}
        <View style={styles.lockedHeaderRow}>
          <View style={[styles.lockedBadge, { backgroundColor: colors.primary }]}>
            <Zap size={16} color="#000" strokeWidth={2.5} />
            <Text style={styles.lockedBadgeText}>Goal {n} locked</Text>
          </View>
          {lockedGoal.isStandard && (
            <View style={[styles.standardTag, { borderColor: colors.primary }]}>
              <Text style={[styles.standardTagText, { color: colors.primary }]}>
                STANDARD
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.lockedGoalLabel, { color: colors.textSecondary }]}>
          {resolvedLabel}
        </Text>

        {/* All inputs */}
        {allInputs.map((inp, i) => (
          <View
            key={i}
            style={[
              styles.lockedInputRow,
              {
                borderTopColor: colors.border,
                borderTopWidth: i === 0 ? 0 : 1,
              },
            ]}
          >
            <Text style={[styles.lockedInput, { color: colors.text, flex: 1 }]}>
              {inp.dailyInput}
            </Text>
            {'isStandard' in inp && (inp as LockedGoal).isStandard && i === 0 && null}
          </View>
        ))}

        {/* Add another */}
        {canAddMore && (
          <TouchableOpacity
            style={[styles.addAnotherBtn, { borderColor: colors.primary + '60' }]}
            onPress={onAddInput}
            activeOpacity={0.8}
          >
            <Text style={[styles.addAnotherText, { color: colors.primary }]}>
              ＋ Add another daily input to this goal
            </Text>
          </TouchableOpacity>
        )}

        {!isLast && (
          <Text style={[styles.lockedNextHint, { color: colors.textTertiary }]}>
            {total - n} more to go
          </Text>
        )}
      </Animated.View>

      <Animated.View style={[btnStyle, { width: '100%', marginTop: 24 }]}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: colors.primary },
          ]}
          onPress={onNext}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>
            {isLast ? 'See my full plan' : `Reverse engineer goal ${n + 1}`}
          </Text>
          <ArrowRight size={20} color="#000" strokeWidth={3} />
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

// ─── Path selector ────────────────────────────────────────────────────────────

export function PathSelectorScreen({
  goal,
  n,
  resolvedLabel,
  onSelect,
  onDailyAction,
  onBack,
}: {
  goal: MockGoal;
  n: number;
  resolvedLabel: string;
  onSelect: (path: DecodePath) => void;
  onDailyAction: () => void;
  onBack: () => void;
}) {
  const { colors, isDark } = useTheme();
  const paths: Array<{ id: DecodePath | 'daily'; label: string; sub: string; onPress: () => void }> = [
    {
      id: 'numbers',
      label: "It's a numbers game",
      sub: 'More attempts → more wins. Deals, clients, outreach.',
      onPress: () => onSelect('numbers'),
    },
    {
      id: 'practice',
      label: 'It takes time invested',
      sub: 'Hours in → ability out. Skills, crafts, languages.',
      onPress: () => onSelect('practice'),
    },
    {
      id: 'starting',
      label: "It's built on daily habits",
      sub: 'Repeat the right actions and the result follows. Health, energy, character.',
      onPress: () => onSelect('starting'),
    },
    {
      id: 'daily',
      label: 'This is the daily action',
      sub: 'No math needed — lock it in.',
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
                {p.sub}
              </Text>
            </View>
            <ArrowRight size={18} color={colors.textTertiary} strokeWidth={2} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Final summary ────────────────────────────────────────────────────────────

function SummaryScreen({
  goals,
  locked,
  goalLabelOverrides,
  onReset,
  onContinue,
}: {
  goals: MockGoal[];
  locked: LockedGoal[];
  goalLabelOverrides: Record<number, string>;
  onReset: () => void;
  onContinue: () => void;
}) {
  const { colors, isDark } = useTheme();
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500 });
  }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: colors.background }]}
      contentContainerStyle={styles.summaryContent}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={fadeStyle}>
        <View
          style={[
            styles.stepPill,
            {
              backgroundColor: colors.backgroundSecondary,
              borderColor: colors.border,
              marginBottom: 20,
            },
          ]}
        >
          <Check size={13} color={colors.primary} strokeWidth={2.5} />
          <Text
            style={[
              styles.stepPillText,
              { color: colors.textSecondary },
            ]}
          >
            Daily Plan
          </Text>
        </View>
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          Your{'\n'}{goals.length} daily inputs.
        </Text>
        <Text
          style={[
            styles.heroSubtitle,
            { color: colors.textSecondary, marginBottom: 28 },
          ]}
        >
          Do these every day and the goals take care of themselves.
        </Text>

        {goals.map((goal, i) => {
          const lock = locked.find(l => l.goalId === goal.id);
          const displayLabel = lock?.goalLabel ?? formatGoalLabel(goal, goalLabelOverrides);
          const allSummaryIcons = [
            <BarChart2 key="a" size={18} color={colors.primary} strokeWidth={2.5} />,
            <Dumbbell key="b" size={18} color={colors.primary} strokeWidth={2.5} />,
            <Heart key="c" size={18} color={colors.primary} strokeWidth={2.5} />,
            <Zap key="d" size={18} color={colors.primary} strokeWidth={2.5} />,
            <Sparkles key="e" size={18} color={colors.primary} strokeWidth={2.5} />,
          ];
          const icons = allSummaryIcons;
          return (
            <View
              key={goal.id}
              style={[
                styles.summaryCard,
                {
                  backgroundColor: isDark
                    ? colors.backgroundSecondary
                    : '#FAFAFA',
                  borderColor: lock ? colors.primary : colors.border,
                },
              ]}
            >
              {lock && (
                <LinearGradient
                  colors={['rgba(204,255,0,0.07)', 'transparent']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              )}
              <View style={styles.summaryCardHeader}>
                {icons[i % icons.length]}
                <Text
                  style={[
                    styles.summaryCardGoalLabel,
                    { color: colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {displayLabel}
                </Text>
              </View>
              {lock ? (
                <>
                  {/* Primary input */}
                  <View style={styles.summaryInputRow}>
                    {lock.isStandard && (
                      <Text style={[styles.summaryStandardTag, { color: colors.primary }]}>
                        STANDARD ·{' '}
                      </Text>
                    )}
                    <Text style={[styles.summaryCardInput, { color: colors.text, flex: 1 }]}>
                      {lock.dailyInput}
                    </Text>
                  </View>
                  <Text style={[styles.summaryCardWhen, { color: colors.textTertiary }]}>
                    {lock.when} · {lock.where}
                  </Text>
                  {/* Additional inputs */}
                  {lock.additionalInputs.map((inp, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.summaryAdditionalRow,
                        { borderTopColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.summaryCardInput, { color: colors.text }]}>
                        {inp.dailyInput}
                      </Text>
                      <Text style={[styles.summaryCardWhen, { color: colors.textTertiary }]}>
                        {inp.when} · {inp.where}
                      </Text>
                    </View>
                  ))}
                </>
              ) : (
                <Text
                  style={[
                    styles.summaryCardInput,
                    { color: colors.textTertiary, fontStyle: 'italic' },
                  ]}
                >
                  Not completed yet
                </Text>
              )}
            </View>
          );
        })}

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 32 }]}
          onPress={onContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Continue →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.resetBtn,
            {
              backgroundColor: isDark
                ? colors.backgroundSecondary
                : '#F0F0F0',
              borderColor: colors.border,
            },
          ]}
          onPress={onReset}
          activeOpacity={0.8}
        >
          <RefreshCw
            size={16}
            color={colors.textSecondary}
            strokeWidth={2}
          />
          <Text
            style={[styles.resetBtnText, { color: colors.textSecondary }]}
          >
            Start over
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

// ─── Identity screen ──────────────────────────────────────────────────────────

type IdentityShape =
  | { kind: 'sentence'; text: string }
  | { kind: 'stacked'; finishLine: string; declaration: string };

// Returns the best display label for a locked goal.
// Numbers-path goals: goalLabel already carries the derived "earning $X/month consistently".
// Other paths: prefer doneLooksText (user's refined description) over the raw goalLabel.
function displayGoalLabel(lock: LockedGoal): string {
  if (lock.decodePath === 'numbers' && lock.resolvedTargetStr) {
    return lock.goalLabel;
  }
  return lock.doneLooksText?.trim() || lock.goalLabel;
}

function applyBecomeTransform(text: string): string | null {
  const lower = text.trim().toLowerCase();
  if (lower.startsWith('become ')) {
    const rest = text.trim().slice('become '.length).trim();
    return `I am ${rest}.`;
  }
  return null;
}

function deriveIdentityLine(lock: LockedGoal): IdentityShape {
  const refined = lock.doneLooksText?.trim();

  switch (lock.decodePath) {
    case 'numbers': {
      const target = lock.resolvedTargetStr ?? lock.goalLabel;
      return { kind: 'sentence', text: `I earn ${target}/month — consistently.` };
    }
    case 'practice': {
      if (refined) {
        const transformed = applyBecomeTransform(refined);
        if (transformed) return { kind: 'sentence', text: transformed };
        return { kind: 'stacked', finishLine: refined, declaration: 'I make this real — every day.' };
      }
      return { kind: 'stacked', finishLine: lock.goalLabel, declaration: 'I make this real — every day.' };
    }
    case 'starting': {
      if (lock.isStandard) {
        const action = lock.dailyInput.replace(/\.$/, '').trim();
        return { kind: 'sentence', text: `I never miss "${action}".` };
      }
      if (refined) {
        const transformed = applyBecomeTransform(refined);
        if (transformed) return { kind: 'sentence', text: transformed };
        return { kind: 'stacked', finishLine: refined, declaration: 'I make this real — every day.' };
      }
      return { kind: 'stacked', finishLine: lock.goalLabel, declaration: 'I make this real — every day.' };
    }
  }
}

function identityShapeToString(shape: IdentityShape): string {
  if (shape.kind === 'sentence') return shape.text;
  return `"${shape.finishLine}" — ${shape.declaration}`;
}

export function IdentityScreen({
  goals,
  locked,
  identityOverrides,
  onOverrideChange,
  onAccept,
}: {
  goals: MockGoal[];
  locked: LockedGoal[];
  identityOverrides: Record<number, string>;
  onOverrideChange: (goalId: number, text: string) => void;
  onAccept: () => void;
}) {
  const { colors, isDark } = useTheme();
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500 });
  }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);

  // Build list of (goalId, shape) pairs for goals that have been locked.
  const lockedEntries = goals.map(g => {
    const lock = locked.find(l => l.goalId === g.id);
    if (!lock) return null;
    return { goalId: g.id, lock };
  }).filter(Boolean) as Array<{ goalId: number; lock: LockedGoal }>;

  // Resolve the current display shape for a goal, applying any override.
  const resolveShape = (goalId: number, lock: LockedGoal): IdentityShape => {
    const override = identityOverrides[goalId];
    if (override !== undefined) {
      return { kind: 'sentence', text: override };
    }
    return deriveIdentityLine(lock);
  };

  // What to prefill the editor with: for stacked cards, full combined text;
  // for sentence cards (including overridden ones), the current text.
  const editInitial = (goalId: number, lock: LockedGoal): string => {
    const override = identityOverrides[goalId];
    if (override !== undefined) return override;
    const base = deriveIdentityLine(lock);
    if (base.kind === 'stacked') {
      return `"${base.finishLine}"\n${base.declaration}`;
    }
    return base.text;
  };

  const handleSave = (goalId: number, text: string) => {
    onOverrideChange(goalId, text.trim() || editInitial(goalId, locked.find(l => l.goalId === goalId)!));
    setEditingGoalId(null);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.summaryContent}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={fadeStyle}>
        <View
          style={[
            styles.stepPill,
            {
              backgroundColor: colors.backgroundSecondary,
              borderColor: colors.border,
              marginBottom: 20,
            },
          ]}
        >
          <Sparkles size={13} color={colors.primary} strokeWidth={2.5} />
          <Text style={[styles.stepPillText, { color: colors.textSecondary }]}>
            Your Identity
          </Text>
        </View>
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          Who you're{'\n'}becoming.
        </Text>
        <Text
          style={[
            styles.heroSubtitle,
            { color: colors.textSecondary, marginBottom: 8 },
          ]}
        >
          These are true right now — not after you earn it.
        </Text>
        <Text style={{ color: colors.textTertiary, fontSize: 13, marginBottom: 24 }}>
          Tap ✏️ to rewrite any of these in your own words — an "I am..." statement hits hardest.
        </Text>

        <View style={{ gap: 12 }}>
          {lockedEntries.map(({ goalId, lock }) => {
            const shape = resolveShape(goalId, lock);
            return (
              <View
                key={goalId}
                style={[
                  styles.identityTileCard,
                  {
                    backgroundColor: isDark ? colors.backgroundSecondary : '#FAFAFA',
                    borderColor: colors.primary,
                  },
                ]}
              >
                {editingGoalId === goalId ? (
                  <IdentityLineEditor
                    initial={editInitial(goalId, lock)}
                    onSave={text => handleSave(goalId, text)}
                    onCancel={() => setEditingGoalId(null)}
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.identityTileRow}
                    onPress={() => setEditingGoalId(goalId)}
                    activeOpacity={0.7}
                  >
                    {shape.kind === 'sentence' ? (
                      <Text style={[styles.identityLine, { color: colors.text, flex: 1 }]}>
                        {shape.text}
                      </Text>
                    ) : (
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={[styles.identityLine, { color: colors.primary, fontStyle: 'italic' }]}>
                          "{shape.finishLine}"
                        </Text>
                        <Text style={[styles.identityLine, { color: colors.text, fontWeight: '700' }]}>
                          {shape.declaration}
                        </Text>
                      </View>
                    )}
                    <Pencil size={14} color={colors.primary} strokeWidth={2} style={{ marginTop: 2, opacity: 0.6, flexShrink: 0 }} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 32 }]}
          onPress={onAccept}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>I Accept My Identity →</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

function IdentityLineEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const { colors, isDark } = useTheme();
  const [text, setText] = useState(initial);
  return (
    <View style={{ gap: 10 }}>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        autoFocus
        style={[
          styles.identityEditInput,
          {
            color: colors.text,
            borderColor: colors.primary,
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          },
        ]}
      />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity
          style={[styles.identityEditSave, { backgroundColor: colors.primary }]}
          onPress={() => onSave(text.trim() || initial)}
        >
          <Text style={[styles.identityEditSaveText, { color: '#000' }]}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.identityEditCancel, { borderColor: colors.border }]}
          onPress={onCancel}
        >
          <Text style={[styles.identityEditCancelText, { color: colors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Finale screen (beat-by-beat) ────────────────────────────────────────────

function FinaleBeatCard({ delay, children }: { delay: number; children: React.ReactNode }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withSpring(1, { damping: 18, stiffness: 120 }));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: [{ translateY: interpolate(anim.value, [0, 1], [16, 0]) }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function FinaleScreen({
  beat,
  goals,
  locked,
  identityOverrides,
  compassFilter,
  onNext,
  onBack,
}: {
  beat: 0 | 1 | 2;
  goals: MockGoal[];
  locked: LockedGoal[];
  identityOverrides: Record<number, string>;
  compassFilter: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const { colors, isDark } = useTheme();

  const identityShapes = goals.map(g => {
    const lock = locked.find(l => l.goalId === g.id);
    if (!lock) return null;
    const override = identityOverrides[g.id];
    if (override !== undefined) {
      return { kind: 'sentence', text: override } as IdentityShape;
    }
    return deriveIdentityLine(lock);
  }).filter(Boolean) as IdentityShape[];

  const tiles: Array<{ dailyInput: string; when: string; where: string; goalLabel: string }> = [];
  goals.forEach(g => {
    const lock = locked.find(l => l.goalId === g.id);
    if (!lock) return;
    const refinedLabel = displayGoalLabel(lock);
    tiles.push({ dailyInput: lock.dailyInput, when: lock.when, where: lock.where, goalLabel: refinedLabel });
    lock.additionalInputs.forEach(inp =>
      tiles.push({ dailyInput: inp.dailyInput, when: inp.when, where: inp.where, goalLabel: refinedLabel }),
    );
  });

  const filterQuestion = compassFilter.trim()
    ? `Will this help me ${compassFilter.trim().replace(/\.$/, '')}?`
    : '';

  const BEAT_META = [
    { eyebrow: 'YOUR IDENTITY', cta: 'Next' },
    { eyebrow: 'YOUR COMPASS', cta: 'Next' },
    { eyebrow: 'YOUR SUCCESS STACK', cta: "I'm ready!" },
  ] as const;

  const meta = BEAT_META[beat];

  const renderContent = () => {
    if (beat === 0) {
      return (
        <View style={{ gap: 10 }}>
          {identityShapes.map((shape, idx) => (
            <FinaleBeatCard key={idx} delay={idx * 80}>
              <View style={[styles.identityTileCard, { backgroundColor: isDark ? colors.backgroundSecondary : '#FAFAFA', borderColor: colors.primary }]}>
                {shape.kind === 'sentence' ? (
                  <Text style={[styles.identityLine, { color: colors.text }]}>{shape.text}</Text>
                ) : (
                  <View style={{ gap: 4 }}>
                    <Text style={[styles.identityLine, { color: colors.primary, fontStyle: 'italic' }]}>"{shape.finishLine}"</Text>
                    <Text style={[styles.identityLine, { color: colors.text, fontWeight: '700' }]}>{shape.declaration}</Text>
                  </View>
                )}
              </View>
            </FinaleBeatCard>
          ))}
        </View>
      );
    }
    if (beat === 1) {
      return (
        <FinaleBeatCard delay={0}>
          <View style={[styles.compassCard,
            filterQuestion
              ? { backgroundColor: isDark ? 'rgba(204,255,0,0.08)' : 'rgba(204,255,0,0.10)', borderColor: colors.primary }
              : { backgroundColor: isDark ? colors.backgroundSecondary : '#FAFAFA', borderColor: colors.border }
          ]}>
            {filterQuestion ? (
              <>
                <Text style={[styles.compassFilterLabel, { color: colors.primary }]}>YOUR FILTER QUESTION</Text>
                <Text style={[styles.compassFilterText, { color: colors.text, fontStyle: 'italic' }]}>
                  "{filterQuestion}"
                </Text>
              </>
            ) : (
              <>
                <Filter size={20} color={colors.textTertiary} strokeWidth={1.5} />
                <Text style={[styles.compassPlaceholder, { color: colors.textTertiary }]}>
                  Your filter question lives here.
                </Text>
              </>
            )}
          </View>
        </FinaleBeatCard>
      );
    }
    // beat === 2
    return (
      <View style={{ gap: 10 }}>
        {tiles.map((tile, idx) => (
          <FinaleBeatCard key={idx} delay={idx * 70}>
            <View style={[styles.finaleStackTile, { backgroundColor: isDark ? colors.backgroundSecondary : '#FAFAFA', borderColor: colors.border }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View style={[styles.finaleGoalTag, { backgroundColor: isDark ? 'rgba(204,255,0,0.08)' : 'rgba(204,255,0,0.10)', borderColor: colors.primary + '50' }]}>
                  <Text style={[styles.finaleGoalTagText, { color: colors.primary }]} numberOfLines={1}>{tile.goalLabel}</Text>
                </View>
                <Text style={[styles.finaleStackText, { color: colors.text, marginTop: 8 }]}>{tile.dailyInput}</Text>
                <Text style={[styles.finaleStackWhen, { color: colors.textTertiary }]}>{tile.when}{tile.where ? ` · ${tile.where}` : ''}</Text>
              </View>
              <View style={[styles.finaleCheckOuter, { borderColor: colors.border }]}>
                <View style={[styles.finaleCheckInner, { borderColor: colors.border }]} />
              </View>
            </View>
          </FinaleBeatCard>
        ))}
      </View>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.summaryContent}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity onPress={onBack} style={[styles.backBtn, { marginBottom: 20 }]}>
        <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
      </TouchableOpacity>

      <Text style={[styles.finaleSectionLabel, { color: colors.primary, fontSize: 13, marginBottom: 20 }]}>
        HERE'S WHAT YOU BUILT
      </Text>
      <Text style={[styles.finaleHeadline, { color: colors.text, marginBottom: 24 }]}>
        {meta.eyebrow}
      </Text>

      {renderContent()}

      <View style={{ marginTop: 32, gap: 16 }}>
        {/* Beat dots */}
        <View style={[styles.welcomeDots, { alignSelf: 'center' }]}>
          {([0, 1, 2] as const).map(i => (
            <View key={i} style={[styles.welcomeDot, {
              backgroundColor: i <= beat ? colors.primary : (isDark ? '#333' : '#D0D0D0'),
              width: i === beat ? 20 : 8,
            }]} />
          ))}
        </View>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={onNext}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>{meta.cta}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Signature commit screen ───────────────────────────────────────────────────

function SignatureCommitScreen({
  locked,
  onStartChallenge,
  onRestart,
}: {
  locked: LockedGoal[];
  onStartChallenge: () => void;
  onRestart: () => void;
}) {
  const { colors, isDark } = useTheme();
  const screenFade = useSharedValue(0);
  useEffect(() => {
    screenFade.value = withTiming(1, { duration: 500 });
  }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: screenFade.value }));

  // Signature state — plain React state, no Reanimated touching SVG props
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');

  // Placeholder fade — use RNAnimated (not Reanimated) so no CSSStyleDeclaration issues
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
    lock.additionalInputs.forEach(inp => {
      if (inp.dailyInput) checklistItems.push(inp.dailyInput);
    });
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.summaryContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View style={[fadeStyle, { gap: 0 }]}>
        <Text style={[styles.heroTitle, { color: colors.text, marginBottom: 6 }]}>
          {'I, '}
          <Text style={{ color: colors.primary }}>{'Matt B'}</Text>
          {',\ncommit to hitting\nmy daily inputs\nevery day for '}
          <Text style={{ color: colors.primary }}>{'77 days'}</Text>
          {'.'}
        </Text>

        <View style={[styles.commitChecklistCard, { backgroundColor: isDark ? colors.backgroundSecondary : '#F6F6F6', borderColor: colors.border, marginTop: 24, marginBottom: 28 }]}>
          {checklistItems.length === 0 ? (
            <View style={styles.commitChecklistRow}>
              <View style={[styles.commitCheckCircle, { borderColor: colors.primary }]}>
                <Check size={11} color={colors.primary} strokeWidth={3} />
              </View>
              <Text style={[styles.commitChecklistText, { color: colors.text }]}>Show up every day.</Text>
            </View>
          ) : (
            checklistItems.map((item, idx) => (
              <View key={idx} style={[styles.commitChecklistRow, idx < checklistItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10 }]}>
                <View style={[styles.commitCheckCircle, { borderColor: colors.primary, backgroundColor: isDark ? 'rgba(204,255,0,0.12)' : 'rgba(204,255,0,0.18)' }]}>
                  <Check size={11} color={colors.primary} strokeWidth={3} />
                </View>
                <Text style={[styles.commitChecklistText, { color: colors.text }]}>{item}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={[styles.sigLabel, { color: colors.textSecondary, marginBottom: 10 }]}>
          Sign your name in the box to continue
        </Text>

        {/* Signature pad — PanResponder → React state → plain Svg render, zero Reanimated on SVG */}
        <View
          style={[styles.sigPad, { backgroundColor: isDark ? '#0A0A0A' : '#111', borderColor: isDark ? '#333' : '#222', height: 220 }]}
          {...panResponder.panHandlers}
        >
          {/* Placeholder view — RNAnimated View wrapper (not SVG prop animation) */}
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

          {/* Ink strokes — plain Svg, zero Reanimated */}
          <Svg style={StyleSheet.absoluteFill}>
            {paths.map((d, i) => (
              <SvgPath key={i} d={d} stroke="#CCFF00" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {currentPath ? (
              <SvgPath d={currentPath} stroke="#CCFF00" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
          </Svg>

          {hasSig && (
            <TouchableOpacity
              style={styles.sigClear}
              onPress={() => { setPaths([]); setCurrentPath(''); }}
            >
              <Text style={[styles.sigClearText, { color: '#666' }]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, {
            backgroundColor: hasSig ? '#CCFF00' : (isDark ? '#1C2400' : '#D8E8C0'),
            marginTop: 24,
            opacity: hasSig ? 1 : 0.38,
          }]}
          onPress={() => { if (hasSig) onStartChallenge(); }}
          activeOpacity={hasSig ? 0.85 : 1}
          disabled={!hasSig}
        >
          <Text style={[styles.primaryBtnText, { color: hasSig ? '#000' : (isDark ? '#3A4A00' : '#7A9A40') }]}>
            Start My 77-Day Challenge
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onRestart}
          style={{ marginTop: 20, alignItems: 'center', paddingBottom: 8 }}
          activeOpacity={0.7}
        >
          <Text style={{ color: colors.textTertiary, fontSize: 13, fontWeight: '500' }}>
            ↻ Restart mockup
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

// ─── Compass screens ──────────────────────────────────────────────────────────

const COMPASS_STORY_BEATS = [
  {
    id: 'intro',
    eyebrow: 'OLYMPICS · SYDNEY 2000',
    headline: 'The Compass',
    body: "The British Men's Eight rowing team hadn't won Olympic gold in ",
    boldSuffix: '88 years.',
    hint: 'Tap to continue',
  },
  {
    id: 'decision',
    eyebrow: 'THE DECISION',
    headline: 'They made one decision that changed everything.',
    body: 'Every choice — training, diet, sleep, relationships — got run through a single question:',
  },
  {
    id: 'question',
    eyebrow: '',
    headline: '',
    quote: '"Will it make\nthe boat go faster?"',
    body: 'Not "is it fun?" Not "do I feel like it?"\nOne question. Every time.',
  },
  {
    id: 'rule',
    eyebrow: 'THE RULE',
    headline: '',
    rule: true,
    body: 'Simple enough to use under pressure. Powerful enough to change everything.',
  },
  {
    id: 'gold',
    eyebrow: '',
    headline: '',
    goldBeat: true,
  },
] as const;

function CompassStoryBeat({
  beat,
  colors,
  isDark,
  visible,
}: {
  beat: typeof COMPASS_STORY_BEATS[number];
  colors: any;
  isDark: boolean;
  visible: boolean;
}) {
  const anim = useSharedValue(0);
  useEffect(() => {
    if (visible) {
      anim.value = withSpring(1, { damping: 18, stiffness: 120 });
    } else {
      anim.value = 0;
    }
  }, [visible]);
  const beatStyle = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: [{ translateY: interpolate(anim.value, [0, 1], [20, 0]) }],
  }));

  return (
    <Animated.View style={[beatStyle, { gap: 16 }]}>
      {beat.eyebrow ? (
        <Text style={[styles.compassCinematicEyebrow, { color: colors.primary }]}>{beat.eyebrow}</Text>
      ) : null}
      {beat.headline ? (
        <Text style={[styles.compassCinematicHeadline, { color: colors.text }]}>{beat.headline}</Text>
      ) : null}
      {'quote' in beat && beat.quote ? (
        <View style={[styles.compassCinematicQuote, { borderColor: colors.primary }]}>
          <Text style={[styles.compassCinematicQuoteText, { color: colors.primary }]}>{beat.quote}</Text>
        </View>
      ) : null}
      {'rule' in beat && beat.rule ? (
        <View style={{ gap: 10 }}>
          <View style={styles.compassCinematicRuleRow}>
            <View style={[styles.compassCinematicChip, { backgroundColor: colors.primary }]}>
              <Text style={styles.compassCinematicChipText}>YES</Text>
            </View>
            <Text style={[styles.compassCinematicRuleText, { color: colors.text }]}>Do it. Full commitment.</Text>
          </View>
          <View style={styles.compassCinematicRuleRow}>
            <View style={[styles.compassCinematicChip, { backgroundColor: isDark ? colors.backgroundSecondary : '#DDD' }]}>
              <Text style={[styles.compassCinematicChipText, { color: isDark ? '#888' : '#666' }]}>NO</Text>
            </View>
            <Text style={[styles.compassCinematicRuleText, { color: colors.text }]}>Cut it. No exceptions.</Text>
          </View>
        </View>
      ) : null}
      {'goldBeat' in beat && beat.goldBeat ? (
        <View style={[styles.compassCinematicGoldCard, { borderColor: colors.primary, backgroundColor: isDark ? 'rgba(204,255,0,0.08)' : 'rgba(204,255,0,0.10)' }]}>
          <View style={[styles.compassCinematicGoldTag, { backgroundColor: colors.primary }]}>
            <Text style={styles.compassCinematicGoldTagText}>SYDNEY 2000</Text>
          </View>
          <Text style={[styles.compassCinematicWinTitle, { color: colors.text }]}>They Won Gold.</Text>
          <Text style={[styles.compassCinematicWinSub, { color: colors.textSecondary }]}>88 years of drought. Ended by one question.</Text>
        </View>
      ) : null}
      {('body' in beat && beat.body) ? (
        ('boldSuffix' in beat && beat.boldSuffix) ? (
          <Text style={[styles.compassCinematicBody, { color: colors.textSecondary }]}>
            {(beat as any).body}
            <Text style={[styles.compassCinematicBodyBold, { color: colors.text }]}>{(beat as any).boldSuffix}</Text>
          </Text>
        ) : (
          <Text style={[styles.compassCinematicBody, { color: colors.textSecondary }]}>{(beat as any).body}</Text>
        )
      ) : null}
    </Animated.View>
  );
}

export function CompassStoryScreen({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const { colors, isDark } = useTheme();
  const [beatIdx, setBeatIdx] = useState(0);
  const isLast = beatIdx === COMPASS_STORY_BEATS.length - 1;

  const advance = () => {
    if (isLast) {
      onNext();
    } else {
      setBeatIdx(i => i + 1);
    }
  };

  return (
    <View style={[styles.compassPinnedOuter, { backgroundColor: colors.background }]}>
      {/* Pinned top */}
      <View style={styles.compassPinnedTop}>
        <TouchableOpacity onPress={onBack} style={[styles.backBtn, { marginBottom: 16 }]}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={[styles.stepPill, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <Sparkles size={13} color={colors.primary} strokeWidth={2.5} />
          <Text style={[styles.stepPillText, { color: colors.textSecondary }]}>YOUR COMPASS</Text>
        </View>
      </View>

      {/* Centered content */}
      <View style={styles.compassPinnedContent}>
        <CompassStoryBeat
          key={COMPASS_STORY_BEATS[beatIdx].id}
          beat={COMPASS_STORY_BEATS[beatIdx]}
          colors={colors}
          isDark={isDark}
          visible={true}
        />
      </View>

      {/* Pinned bottom */}
      <View style={styles.compassPinnedBottom}>
        <View style={[styles.welcomeDots, { marginBottom: 16 }]}>
          {COMPASS_STORY_BEATS.map((_, i) => (
            <View key={i} style={[styles.welcomeDot, {
              backgroundColor: i <= beatIdx ? colors.primary : (isDark ? '#333' : '#D0D0D0'),
              width: i === beatIdx ? 20 : 8,
            }]} />
          ))}
        </View>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={advance}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>{isLast ? 'Build My Compass' : 'Continue'}</Text>
          <ArrowRight size={20} color="#000" strokeWidth={3} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function CompassDominoScreen({
  goals,
  locked,
  goalLabelOverrides,
  onNext,
  onBack,
}: {
  goals: MockGoal[];
  locked: LockedGoal[];
  goalLabelOverrides: Record<number, string>;
  onNext: (dominoGoalId: number) => void;
  onBack: () => void;
}) {
  const { colors, isDark } = useTheme();
  const opacity = useSharedValue(0);
  useEffect(() => { opacity.value = withTiming(1, { duration: 500 }); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const [selectedId, setSelectedId] = useState<number | null>(null);

  return (
    <Animated.View style={[fadeStyle, styles.compassPinnedOuter, { backgroundColor: colors.background }]}>
      {/* Pinned top */}
      <View style={styles.compassPinnedTop}>
        <TouchableOpacity onPress={onBack} style={[styles.backBtn, { marginBottom: 16 }]}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          The big{'\n'}domino.
        </Text>
        <Text style={[styles.heroSubtitle, { color: colors.textSecondary, marginTop: 8 }]}>
          Out of everything you just built... which goal, if you hit it, changes everything?
        </Text>
      </View>

      {/* Content — goal cards */}
      <View style={[styles.compassPinnedContent, { gap: 10 }]}>
        {goals.map((g, i) => {
          const lockEntry = locked.find(l => l.goalId === g.id);
          const label = lockEntry ? displayGoalLabel(lockEntry) : formatGoalLabel(g, goalLabelOverrides);
          const isSelected = selectedId === g.id;
          return (
            <TouchableOpacity
              key={g.id}
              style={[
                styles.compassDominoCard,
                {
                  backgroundColor: isSelected
                    ? (isDark ? 'rgba(204,255,0,0.10)' : 'rgba(204,255,0,0.12)')
                    : (isDark ? colors.backgroundSecondary : '#F8F8F8'),
                  borderColor: isSelected ? colors.primary : colors.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
              onPress={() => setSelectedId(g.id)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.compassDominoNum, { color: isSelected ? colors.primary : colors.textTertiary }]}>
                  Goal {i + 1}
                </Text>
                <Text style={[styles.compassDominoLabel, { color: colors.text }]}>
                  {label}
                </Text>
              </View>
              {isSelected && (
                <View style={[styles.compassDominoCheck, { backgroundColor: colors.primary }]}>
                  <Check size={14} color="#000" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Pinned bottom */}
      <View style={styles.compassPinnedBottom}>
        <TouchableOpacity
          style={[styles.primaryButton, {
            backgroundColor: selectedId !== null ? colors.primary : colors.border,
            opacity: selectedId !== null ? 1 : 0.4,
          }]}
          onPress={() => selectedId !== null && onNext(selectedId)}
          disabled={selectedId === null}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>This is my big domino</Text>
          <ArrowRight size={20} color="#000" strokeWidth={3} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

export function CompassMechanismScreen({
  dominoGoal,
  goalLabelOverrides,
  initialText,
  onNext,
  onBack,
}: {
  dominoGoal: MockGoal;
  goalLabelOverrides: Record<number, string>;
  initialText?: string;
  onNext: (filter: string) => void;
  onBack: () => void;
}) {
  const { colors, isDark } = useTheme();
  const opacity = useSharedValue(0);
  useEffect(() => { opacity.value = withTiming(1, { duration: 500 }); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const [text, setText] = useState(initialText ?? '');
  const dominoLabel = formatGoalLabel(dominoGoal, goalLabelOverrides);
  const filterPreview = text.trim() ? `Will it help me ${text.trim().replace(/\.$/, '')}?` : '';
  const canNext = text.trim().length > 0;

  return (
    <Animated.View style={[fadeStyle, styles.compassPinnedOuter, { backgroundColor: colors.background }]}>
      {/* Pinned top */}
      <View style={styles.compassPinnedTop}>
        <TouchableOpacity onPress={onBack} style={[styles.backBtn, { marginBottom: 16 }]}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          The mechanism.
        </Text>
        <Text style={[styles.heroSubtitle, { color: colors.textSecondary, marginTop: 8 }]}>
          <Text style={{ color: colors.primary }}>"{dominoLabel}"</Text>
          {' literally cannot happen unless...'}
        </Text>
      </View>

      {/* Content */}
      <View style={[styles.compassPinnedContent, { gap: 16 }]}>
        {/* Example row */}
        <View style={[styles.compassExampleRow, { borderColor: colors.border, backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5' }]}>
          <Text style={[styles.compassExampleLabel, { color: colors.textTertiary }]}>e.g.</Text>
          <Text style={[styles.compassExampleText, { color: colors.textSecondary }]}>
            Win Olympic gold → <Text style={{ color: colors.primary, fontWeight: '700' }}>the boat goes faster</Text>
          </Text>
        </View>

        <TextInput
          style={[
            styles.doneLooksInput,
            {
              color: colors.text,
              borderColor: text.trim() ? colors.primary + '80' : isDark ? '#333' : '#D8D8D8',
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            },
          ]}
          value={text}
          onChangeText={setText}
          placeholder="e.g. make more offers than anyone"
          placeholderTextColor={colors.textTertiary}
          multiline
          autoCapitalize="sentences"
          textAlignVertical="top"
          autoFocus
        />

        {/* Live filter preview */}
        {filterPreview.length > 0 && (
          <View style={[
            styles.compassFilterPreview,
            {
              backgroundColor: isDark ? 'rgba(204,255,0,0.08)' : 'rgba(204,255,0,0.10)',
              borderColor: colors.primary + '60',
            },
          ]}>
            <Text style={[styles.compassFilterLabel, { color: colors.primary }]}>YOUR COMPASS QUESTION</Text>
            <Text style={[styles.compassFilterText, { color: isDark ? colors.primary : '#2A4A00' }]}>
              {filterPreview}
            </Text>
          </View>
        )}
      </View>

      {/* Pinned bottom */}
      <View style={styles.compassPinnedBottom}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            {
              backgroundColor: canNext ? colors.primary : colors.border,
              opacity: canNext ? 1 : 0.45,
            },
          ]}
          onPress={() => canNext && onNext(text.trim())}
          disabled={!canNext}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Lock My Compass</Text>
          <ArrowRight size={20} color="#000" strokeWidth={3} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── Goal parsing ─────────────────────────────────────────────────────────────

const DIGIT_COMMA_PLACEHOLDER = '\x00DC\x00';

let _goalIdSeq = 100;
function parseGoalsFromText(text: string): MockGoal[] {
  // Protect digit-comma-digit sequences (thousands separators) so "$10,000
  // steps" doesn't split into two goals.
  const protected_ = text.replace(/(\d),(\d)/g, `$1${DIGIT_COMMA_PLACEHOLDER}$2`);
  const parts = protected_
    .split(',')
    .map(s => s.trim().replace(new RegExp(DIGIT_COMMA_PLACEHOLDER, 'g'), ','))
    .filter(s => s.length > 0);
  if (parts.length === 0) return GOALS;
  return parts.map(rawLabel => ({
    id: _goalIdSeq++,
    label: normalizeMoneyInLabel(rawLabel),
    category: 'General',
    deadline: 'ongoing',
    defaultPath: 'starting' as DecodePath,
  }));
}

// ─── Welcome series ───────────────────────────────────────────────────────────

const WELCOME_SCREENS = [
  {
    icon: 'flame' as const,
    headline: 'Welcome to\nCompound to\nGreatness.',
    body: "Goals don't make you great — daily inputs do. Small actions, repeated daily, compound into outcomes that feel inevitable.",
    cta: 'Continue →',
  },
  {
    icon: 'compass' as const,
    headline: "Here's what\nwe'll build.",
    body: "In the next few minutes you'll name your goals, reverse engineer each one into a single daily number, and build the compass that guides every decision.",
    cta: 'Continue →',
  },
  {
    icon: 'trophy' as const,
    headline: 'Then you\ncommit.',
    body: "You'll sign your name to your daily inputs and show up for 77 days. Miss a day, and you start over from Day 1. That's what makes finishing mean something.",
    cta: "Let's Go →",
  },
] as const;

function WelcomeIconTile({ icon, colors, isDark }: { icon: 'flame' | 'compass' | 'trophy'; colors: any; isDark: boolean }) {
  const scale = useSharedValue(0);
  const rotation = useSharedValue(-15);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 10, stiffness: 180, mass: 0.8 });
    rotation.value = withSpring(0, { damping: 12, stiffness: 200 });
  }, [icon]);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));
  return (
    <Animated.View
      style={[
        iconStyle,
        {
          width: 56,
          height: 56,
          borderRadius: 16,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'flex-start',
        },
      ]}
    >
      {icon === 'flame' && <Zap size={28} color="#000" strokeWidth={2.5} />}
      {icon === 'compass' && <Filter size={28} color="#000" strokeWidth={2.5} />}
      {icon === 'trophy' && <Sparkles size={28} color="#000" strokeWidth={2.5} />}
    </Animated.View>
  );
}

export function WelcomeSeriesScreen({
  screen,
  onNext,
  onBack,
}: {
  screen: 0 | 1 | 2;
  onNext: () => void;
  onBack?: () => void;
}) {
  const { colors, isDark } = useTheme();
  const data = WELCOME_SCREENS[screen];

  // Per-screen animation keys — reset when screen changes
  const headlineY = useSharedValue(24);
  const headlineOp = useSharedValue(0);
  const bodyY = useSharedValue(24);
  const bodyOp = useSharedValue(0);
  const ctaOp = useSharedValue(0);

  useEffect(() => {
    // Reset before animating in
    headlineY.value = 24;
    headlineOp.value = 0;
    bodyY.value = 24;
    bodyOp.value = 0;
    ctaOp.value = 0;

    headlineY.value = withDelay(120, withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) }));
    headlineOp.value = withDelay(120, withTiming(1, { duration: 320 }));
    bodyY.value = withDelay(240, withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) }));
    bodyOp.value = withDelay(240, withTiming(1, { duration: 320 }));
    ctaOp.value = withDelay(400, withTiming(1, { duration: 280 }));
  }, [screen]);

  const headlineStyle = useAnimatedStyle(() => ({
    opacity: headlineOp.value,
    transform: [{ translateY: headlineY.value }],
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: bodyOp.value,
    transform: [{ translateY: bodyY.value }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaOp.value }));

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, flex: 1 }]}>
      {/* Back button (hidden on screen 0) */}
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={[styles.backBtn, { marginBottom: 32 }]}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
      ) : (
        <View style={{ height: 52 }} />
      )}

      {/* Icon tile */}
      <WelcomeIconTile icon={data.icon} colors={colors} isDark={isDark} />

      {/* Headline */}
      <Animated.Text style={[styles.heroTitle, headlineStyle, { color: colors.text, marginTop: 28, marginBottom: 16 }]}>
        {data.headline}
      </Animated.Text>

      {/* Body */}
      <Animated.Text style={[styles.heroSubtitle, bodyStyle, { color: colors.textSecondary, lineHeight: 26 }]}>
        {data.body}
      </Animated.Text>

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* Page dots */}
      <View style={styles.welcomeDots}>
        {WELCOME_SCREENS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.welcomeDot,
              {
                backgroundColor: i === screen ? colors.primary : (isDark ? '#333' : '#D0D0D0'),
                width: i === screen ? 20 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* CTA */}
      <Animated.View style={[ctaStyle, { marginTop: 20, marginBottom: 8 }]}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={onNext}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>{data.cta}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── F1: Goals entry screen ───────────────────────────────────────────────────

export function GoalsEntryScreen({ onContinue, onBack }: { onContinue: (goals: MockGoal[]) => void; onBack: () => void }) {
  const { colors, isDark } = useTheme();
  const [text, setText] = useState('');
  const opacity = useSharedValue(0);
  useEffect(() => { opacity.value = withTiming(1, { duration: 400 }); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const canContinue = text.trim().length > 0;

  const handleContinue = () => {
    if (!canContinue) return;
    onContinue(parseGoalsFromText(text));
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.screen}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View style={[fadeStyle, { flex: 1 }]}>
        <TouchableOpacity onPress={onBack} style={[styles.backBtn, { marginBottom: 20 }]}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            What do you{'\n'}want to achieve?
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary, marginBottom: 28 }]}>
            Separate multiple goals with commas.
          </Text>

          <TextInput
            style={[
              styles.goalsEntryInput,
              {
                color: colors.text,
                borderColor: text.trim() ? colors.primary + '80' : isDark ? '#333' : '#D8D8D8',
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              },
            ]}
            value={text}
            onChangeText={setText}
            placeholder="e.g. earn $100k, lose 20 lbs, read more books"
            placeholderTextColor={colors.textTertiary}
            multiline
            autoCapitalize="sentences"
            textAlignVertical="top"
          />
        </View>

        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: canContinue ? colors.primary : colors.border, opacity: canContinue ? 1 : 0.45 }]}
            onPress={handleContinue}
            activeOpacity={0.85}
            disabled={!canContinue}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
            <ArrowRight size={20} color="#000" strokeWidth={3} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

// ─── Fuel redirect screen ─────────────────────────────────────────────────────

export function GoalFuelRedirectScreen({
  practiceText,
  initialText,
  onSkipAsStandard,
  onContinue,
  onBack,
  onStateChange,
}: {
  practiceText: string;
  initialText?: string;
  // Called with the edited action text when locking as standard.
  onSkipAsStandard: (actionText: string) => void;
  onContinue: (redirectText: string) => void;
  onBack: () => void;
  onStateChange: (text: string) => void;
}) {
  const { colors, isDark } = useTheme();
  // actionText: the daily action they confirmed (editable, prefilled with practiceText).
  const [actionText, setActionText] = useState(practiceText);
  // fuelText: the "it fuels" answer — only used once they tap the secondary button.
  const [fuelText, setFuelText] = useState(initialText ?? '');
  const [showFuelMode, setShowFuelMode] = useState(false);
  const opacity = useSharedValue(0);
  useEffect(() => { opacity.value = withTiming(1, { duration: 400 }); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const canLock = actionText.trim().length > 0;
  const canFuel = fuelText.trim().length > 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.screen}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View style={[fadeStyle, { flex: 1 }]}>
        <TouchableOpacity onPress={onBack} style={[styles.backBtn, { marginBottom: 16 }]}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={[styles.heroTitle, { color: colors.text, fontSize: 32, marginBottom: 8 }]}>
            {'This '}
            <Text style={{ color: colors.primary, fontStyle: 'italic' }}>is</Text>
            {' the\ndaily action.'}
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary, marginBottom: 24 }]}>
            Edit it if needed, then lock it in.
          </Text>

          {/* Editable action input */}
          <TextInput
            style={[
              styles.doneLooksInput,
              {
                color: colors.text,
                borderColor: actionText.trim() ? colors.primary + '80' : isDark ? '#333' : '#D8D8D8',
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              },
            ]}
            value={actionText}
            onChangeText={setActionText}
            multiline
            autoCapitalize="sentences"
            textAlignVertical="top"
          />

          {/* Fuel mode: expanded question */}
          {showFuelMode && (
            <View style={{ marginTop: 20 }}>
              <View style={[styles.fuelRedirectCard, { backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5', borderColor: colors.border }]}>
                <Text style={[styles.fuelRedirectIf, { color: colors.textTertiary }]}>
                  That's fuel. What's it fuel for?
                </Text>
                <Text style={[styles.fuelRedirectAction, { color: colors.text }]}>
                  {actionText.trim().length >= 3 ? (
                    <>
                      {'If I '}
                      <Text style={{ color: colors.primary }}>"{actionText.trim()}"</Text>
                      {' every day, it would get me...'}
                    </>
                  ) : (
                    'If I do this every day, it would get me...'
                  )}
                </Text>
              </View>
              <TextInput
                style={[
                  styles.goalsEntryInput,
                  {
                    marginTop: 16,
                    color: colors.text,
                    borderColor: fuelText.trim() ? colors.primary + '80' : isDark ? '#333' : '#D8D8D8',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  },
                ]}
                value={fuelText}
                onChangeText={v => { setFuelText(v); onStateChange(v); }}
                placeholder="e.g. better health, more energy, weight loss"
                placeholderTextColor={colors.textTertiary}
                multiline
                textAlignVertical="top"
                autoFocus
              />
            </View>
          )}
        </View>

        <View style={styles.bottomSection}>
          {!showFuelMode ? (
            <>
              {/* PRIMARY: lock as standard */}
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: canLock ? colors.primary : colors.border, opacity: canLock ? 1 : 0.45 }]}
                onPress={() => canLock && onSkipAsStandard(actionText.trim())}
                disabled={!canLock}
                activeOpacity={0.85}
              >
                <Check size={18} color="#000" strokeWidth={3} />
                <Text style={styles.primaryButtonText}>Lock it in as my standard</Text>
              </TouchableOpacity>
              {/* SECONDARY: it fuels a bigger goal */}
              <TouchableOpacity
                style={[styles.fuelSecondaryBtn, { borderColor: colors.border }]}
                onPress={() => setShowFuelMode(true)}
                activeOpacity={0.75}
              >
                <Text style={[styles.fuelSecondaryText, { color: colors.textSecondary }]}>
                  It fuels a bigger goal →
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: canFuel ? colors.primary : colors.border, opacity: canFuel ? 1 : 0.45 }]}
              onPress={() => canFuel && onContinue(fuelText.trim())}
              disabled={!canFuel}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
              <ArrowRight size={20} color="#000" strokeWidth={3} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </ScrollView>
  );
}

// Returns true when the string contains a numeric quantity (digits, currency,
// K/M suffix, or unit words like lbs/steps/hrs/min).
function goalHasNumber(s: string): boolean {
  return /\d/.test(s) || /\b(lbs?|steps?|hrs?|hours?|minutes?|min|miles?|km)\b/i.test(s);
}

// ─── "Done looks like" screen ─────────────────────────────────────────────────

export function GoalDoneLooksScreen({
  goal,
  goalIdx,
  total,
  chosenPath,
  initialText,
  onContinue,
  onBack,
  onStateChange,
}: {
  goal: MockGoal;
  goalIdx: number;
  total: number;
  chosenPath: DecodePath;
  initialText?: string;
  onContinue: (doneLooksText: string) => void;
  onBack: () => void;
  onStateChange: (text: string) => void;
}) {
  const { colors, isDark } = useTheme();

  // Posture A: goal label already contains a measurable number.
  const isPostureA = goalHasNumber(goal.label);

  // initialText from savedStates wins; otherwise posture A seeds with goal label.
  const defaultText = initialText ?? (isPostureA ? goal.label : '');
  const [text, setText] = useState(defaultText);

  const opacity = useSharedValue(0);
  useEffect(() => { opacity.value = withTiming(1, { duration: 400 }); }, [goalIdx]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const canContinue = text.trim().length > 0;

  const handleChange = (v: string) => {
    setText(v);
    onStateChange(v);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.screen}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View style={[fadeStyle, { flex: 1 }]}>
        <View style={[styles.decodeHeader, { paddingHorizontal: 0, paddingTop: 0, marginBottom: 8 }]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
          </TouchableOpacity>
          <GoalBadge goal={goal} n={goalIdx + 1} resolvedLabel={goal.label} />
        </View>

        <View style={{ flex: 1, justifyContent: 'center' }}>
          {isPostureA ? (
            <>
              <Text style={[styles.doneLooksEyebrow, { color: colors.primary }]}>
                YOUR FINISH LINE:
              </Text>
              <Text style={[styles.heroTitle, { color: colors.text, marginBottom: 8 }]}>
                Confirm it.
              </Text>
              <Text style={[styles.heroSubtitle, { color: colors.textSecondary, marginBottom: 24 }]}>
                Sharpen it or keep it — then break it down.
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.heroTitle, { color: colors.text, marginBottom: 8 }]}>
                Done looks like...
              </Text>
              <Text style={[styles.heroSubtitle, { color: colors.textSecondary, marginBottom: 24 }]}>
                Describe the finish line clearly. Be specific.
              </Text>
            </>
          )}

          <TextInput
            style={[
              styles.doneLooksInput,
              {
                color: colors.text,
                borderColor: text.trim() ? colors.primary + '80' : isDark ? '#333' : '#D8D8D8',
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              },
            ]}
            value={text}
            onChangeText={handleChange}
            placeholder="e.g. I weigh 175 lbs and feel strong every day"
            placeholderTextColor={colors.textTertiary}
            multiline
            autoCapitalize="sentences"
            textAlignVertical="top"
            autoFocus={!isPostureA}
          />

          {isPostureA && (
            <Text style={[styles.doneLooksHint, { color: colors.textTertiary }]}>
              Sharper = better — add a number or timeframe. e.g. "earn $100K/month"
            </Text>
          )}

          {!isPostureA && text.trim().length === 0 && (
            <>
              <Text style={[styles.doneLooksHint, { color: colors.textTertiary }]}>
                Weak: "get healthier" · Strong: "run a 5K in under 30 min"
              </Text>
              <TouchableOpacity
                style={[
                  styles.doneLooksUseChip,
                  {
                    backgroundColor: isDark
                      ? colors.backgroundSecondary
                      : '#F0F0F0',
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => handleChange(goal.label)}
                activeOpacity={0.75}
              >
                <Check size={13} color={colors.primary} strokeWidth={3} />
                <Text style={[styles.doneLooksUseChipText, { color: colors.textSecondary }]}>
                  Use: "{goal.label}"
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: canContinue ? colors.primary : colors.border, opacity: canContinue ? 1 : 0.45 }]}
            onPress={() => canContinue && onContinue(text.trim())}
            disabled={!canContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Break it down</Text>
            <ArrowRight size={20} color="#000" strokeWidth={3} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

// ─── Intro screen ─────────────────────────────────────────────────────────────

export function IntroScreen({
  goals,
  onNext,
  goalLabelOverrides,
}: {
  goals: MockGoal[];
  onNext: () => void;
  goalLabelOverrides: Record<number, string>;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.screen}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View
          style={[
            styles.stepPill,
            {
              backgroundColor: colors.backgroundSecondary,
              borderColor: colors.border,
              marginBottom: 24,
            },
          ]}
        >
          <Zap size={13} color={colors.primary} strokeWidth={2.5} />
          <Text style={[styles.stepPillText, { color: colors.textSecondary }]}>
            REVERSE ENGINEER
          </Text>
        </View>
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          Let's reverse{'\n'}engineer each{'\n'}goal.
        </Text>
        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
          Every goal becomes a single daily number — the exact action you
          repeat until the outcome is inevitable.
        </Text>

        <View style={{ gap: 12, marginTop: 32 }}>
          {goals.map((g, i) => (
            <GoalBadge
              key={g.id}
              goal={g}
              n={i + 1}
              resolvedLabel={formatGoalLabel(g, goalLabelOverrides)}
            />
          ))}
        </View>
      </View>

      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={onNext}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Reverse engineer goal 1</Text>
          <ArrowRight size={20} color="#000" strokeWidth={3} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Phase =
  | { kind: 'splash' }
  | { kind: 'welcome'; screen: 0 | 1 | 2 }
  | { kind: 'goals-entry' }
  | { kind: 'intro' }
  | { kind: 'path-select'; goalIdx: number }
  | { kind: 'goal-done-looks'; goalIdx: number; chosenPath: DecodePath; doneLooksInitial?: string }
  | { kind: 'goal-fuel-redirect'; goalIdx: number; practiceText: string; redirectInitial?: string }
  | { kind: 'decode'; goalIdx: number; path: DecodePath; doneLooksText?: string }
  | { kind: 'anchor'; goalIdx: number; dailyInput: string; isStandard?: boolean; decodePath: DecodePath; resolvedTargetStr?: string; doneLooksText?: string }
  | { kind: 'add-input'; goalIdx: number }
  | { kind: 'locked'; goalIdx: number; dailyInput: string }
  | { kind: 'summary' }
  | { kind: 'identity' }
  | { kind: 'compass-story' }
  | { kind: 'compass-domino' }
  | { kind: 'compass-mechanism'; dominoGoalId: number }
  | { kind: 'finale'; beat: 0 | 1 | 2 }
  | { kind: 'commit' }
  | { kind: 'paywall' };

export default function ReverseEngineerMockup() {
  const { colors, isDark } = useTheme();

  const [phase, setPhase] = useState<Phase>({ kind: 'splash' });
  // History stack for back navigation. Each entry is the phase to return to.
  const [history, setHistory] = useState<Phase[]>([]);
  const [goals, setGoals] = useState<MockGoal[]>(GOALS);
  const [locked, setLocked] = useState<LockedGoal[]>([]);
  const [decodeResults, setDecodeResults] = useState<Record<number, string>>({});
  const [goalLabelOverrides, setGoalLabelOverrides] = useState<Record<number, string>>({});
  const [identityOverrides, setIdentityOverrides] = useState<Record<number, string>>({});
  const [compassFilter, setCompassFilter] = useState<string>('');
  // Persisted screen state keyed by a string derived from phase. Screens
  // read initialState from here and write back via onStateChange.
  const [savedStates, setSavedStates] = useState<Record<string, string>>({});

  const screenAnim = useSharedValue(1);
  const slideAnim = useSharedValue(0);

  const phaseKey = (p: Phase): string => {
    switch (p.kind) {
      case 'splash': return 'splash';
      case 'welcome': return `welcome-${p.screen}`;
      case 'goals-entry': return 'goals-entry';
      case 'intro': return 'intro';
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

  const saveState = (key: string, value: string) => {
    setSavedStates(prev => ({ ...prev, [key]: value }));
  };

  const transition = (next: Phase) => {
    setHistory(prev => [...prev, phase]);
    screenAnim.value = withTiming(0, {
      duration: 220,
      easing: Easing.in(Easing.ease),
    });
    slideAnim.value = withTiming(-20, { duration: 220 });
    setTimeout(() => {
      setPhase(next);
      slideAnim.value = 30;
      screenAnim.value = withTiming(1, {
        duration: 280,
        easing: Easing.out(Easing.ease),
      });
      slideAnim.value = withSpring(0, { damping: 20, stiffness: 160 });
    }, 230);
  };

  const goBack = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    // Reverse motion: spring down from below
    screenAnim.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.ease) });
    slideAnim.value = withTiming(20, { duration: 180 });
    setTimeout(() => {
      setPhase(prev);
      slideAnim.value = -30;
      screenAnim.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.ease) });
      slideAnim.value = withSpring(0, { damping: 20, stiffness: 160 });
    }, 190);
  };

  const containerStyle = useAnimatedStyle(() => ({
    opacity: screenAnim.value,
    transform: [{ translateY: slideAnim.value }],
    flex: 1,
  }));

  // resolvedTargetStr only from PathNumbers; isStandard only from PathStarting.
  const handleDecodeDone = (
    goalIdx: number,
    result: string,
    resolvedTargetStr?: string,
    isStandard?: boolean,
    decodePath?: DecodePath,
    doneLooksText?: string,
  ) => {
    const goal = goals[goalIdx];
    if (resolvedTargetStr) {
      if (goal.deriveLabel) {
        const derived = goal.deriveLabel(resolvedTargetStr);
        setGoalLabelOverrides(prev => ({ ...prev, [goal.id]: derived }));
      } else {
        // User-entered goal with a numeric target — resolvedTargetStr is already normalized.
        setGoalLabelOverrides(prev => ({ ...prev, [goal.id]: `earning ${resolvedTargetStr}/month consistently` }));
      }
    }
    setDecodeResults(prev => ({ ...prev, [goalIdx]: result }));
    transition({
      kind: 'anchor',
      goalIdx,
      dailyInput: result,
      isStandard,
      decodePath: decodePath ?? 'starting',
      resolvedTargetStr,
      doneLooksText,
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
  ) => {
    const goal = goals[goalIdx];
    const goalLabel = formatGoalLabel(goal, goalLabelOverrides);
    setLocked(prev => [
      ...prev.filter(l => l.goalId !== goal.id),
      {
        goalId: goal.id,
        dailyInput,
        goalLabel,
        doneLooksText,
        what: dailyInput,
        when,
        where,
        schedule,
        isStandard,
        decodePath,
        resolvedTargetStr,
        additionalInputs: [],
      },
    ]);
    transition({ kind: 'locked', goalIdx, dailyInput });
  };

  const handleAddInputDone = (
    goalIdx: number,
    input: AnchoredInput,
  ) => {
    const goal = goals[goalIdx];
    setLocked(prev =>
      prev.map(l =>
        l.goalId === goal.id
          ? { ...l, additionalInputs: [...l.additionalInputs, input] }
          : l,
      ),
    );
    transition({ kind: 'locked', goalIdx, dailyInput: input.dailyInput });
  };

  const handleLockedNext = (goalIdx: number) => {
    const nextIdx = goalIdx + 1;
    if (nextIdx < goals.length) {
      transition({ kind: 'path-select', goalIdx: nextIdx });
    } else {
      transition({ kind: 'identity' });
    }
  };

  const completedSteps = locked.length * 2;
  const totalSteps = goals.length * 2;

  const renderPhase = () => {
    switch (phase.kind) {
      case 'splash': {
        const advanceToWelcome = () => transition({ kind: 'welcome', screen: 0 });
        return (
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={advanceToWelcome}
            activeOpacity={1}
          >
            <SignupSplashScreen onComplete={advanceToWelcome} />
          </TouchableOpacity>
        );
      }

      case 'welcome':
        return (
          <WelcomeSeriesScreen
            screen={phase.screen}
            onNext={() => {
              if (phase.screen < 2) {
                transition({ kind: 'welcome', screen: (phase.screen + 1) as 0 | 1 | 2 });
              } else {
                transition({ kind: 'goals-entry' });
              }
            }}
            onBack={phase.screen === 0 ? undefined : () => goBack()}
          />
        );

      case 'goals-entry':
        return (
          <GoalsEntryScreen
            onBack={() => transition({ kind: 'welcome', screen: 2 })}
            onContinue={parsedGoals => {
              setGoals(parsedGoals);
              setLocked([]);
              setDecodeResults({});
              setGoalLabelOverrides({});
              setIdentityOverrides({});
              transition({ kind: 'intro' });
            }}
          />
        );

      case 'goal-fuel-redirect': {
        const goalIdx = phase.goalIdx;
        return (
          <GoalFuelRedirectScreen
            practiceText={phase.practiceText}
            initialText={savedStates[phaseKey(phase)]}
            onBack={() => goBack()}
            onStateChange={v => saveState(phaseKey(phase), v)}
            onSkipAsStandard={(actionText) => {
              handleDecodeDone(goalIdx, actionText, undefined, true, 'starting', phase.practiceText);
            }}
            onContinue={redirectText => {
              const g = goals[goalIdx];
              const updated = { ...g, label: redirectText };
              setGoals(prev => prev.map((x, i) => i === goalIdx ? updated : x));
              transition({ kind: 'path-select', goalIdx });
            }}
          />
        );
      }

      case 'goal-done-looks': {
        const goalIdx = phase.goalIdx;
        const chosenPath = phase.chosenPath;
        return (
          <GoalDoneLooksScreen
            goal={goals[goalIdx]}
            goalIdx={goalIdx}
            total={goals.length}
            chosenPath={chosenPath}
            initialText={savedStates[phaseKey(phase)]}
            onBack={() => goBack()}
            onStateChange={v => saveState(phaseKey(phase), v)}
            onContinue={doneLooksText => {
              transition({ kind: 'decode', goalIdx, path: chosenPath, doneLooksText });
            }}
          />
        );
      }

      case 'intro':
        return (
          <IntroScreen
            goals={goals}
            onNext={() => transition({ kind: 'path-select', goalIdx: 0 })}
            goalLabelOverrides={goalLabelOverrides}
          />
        );

      case 'path-select':
        return (
          <PathSelectorScreen
            goal={goals[phase.goalIdx]}
            n={phase.goalIdx + 1}
            resolvedLabel={formatGoalLabel(goals[phase.goalIdx], goalLabelOverrides)}
            onSelect={path =>
              transition({ kind: 'goal-done-looks', goalIdx: phase.goalIdx, chosenPath: path })
            }
            onDailyAction={() =>
              transition({ kind: 'goal-fuel-redirect', goalIdx: phase.goalIdx, practiceText: goals[phase.goalIdx].label })
            }
            onBack={() => goBack()}
          />
        );

      case 'decode': {
        const goal = goals[phase.goalIdx];
        const goalIdx = phase.goalIdx;
        return (
          <View style={{ flex: 1 }}>
            <View style={[styles.decodeHeader, { paddingHorizontal: 24 }]}>
              <TouchableOpacity onPress={() => goBack()} style={styles.backBtn}>
                <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
              </TouchableOpacity>
              <GoalBadge
                goal={goal}
                n={phase.goalIdx + 1}
                resolvedLabel={formatGoalLabel(goal, goalLabelOverrides)}
              />
            </View>
            <ScrollView style={{ flex: 1, paddingHorizontal: 24 }} showsVerticalScrollIndicator={false}>
              {phase.path === 'numbers' && (
                <PathNumbers
                  goal={goal}
                  doneLooksText={phase.doneLooksText}
                  onDone={(r, tStr, _payload) => handleDecodeDone(goalIdx, r, tStr, undefined, 'numbers', phase.doneLooksText)}
                />
              )}
              {phase.path === 'practice' && (
                <PathPractice
                  goal={goal}
                  onDone={r => handleDecodeDone(goalIdx, r, undefined, undefined, 'practice', phase.doneLooksText)}
                />
              )}
              {phase.path === 'starting' && (
                <PathStarting
                  goal={goal}
                  resolvedLabel={formatGoalLabel(goal, goalLabelOverrides)}
                  doneLooksText={phase.doneLooksText}
                  onDone={(r, isStd) => handleDecodeDone(goalIdx, r, undefined, isStd, 'starting', phase.doneLooksText)}
                />
              )}
            </ScrollView>
          </View>
        );
      }

      case 'anchor': {
        const goal = goals[phase.goalIdx];
        const goalIdx = phase.goalIdx;
        const isStd = phase.isStandard;
        return (
          <View style={{ flex: 1 }}>
            <View style={[styles.decodeHeader, { paddingHorizontal: 24 }]}>
              <TouchableOpacity onPress={() => goBack()} style={styles.backBtn}>
                <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
              </TouchableOpacity>
              <GoalBadge
                goal={goal}
                n={phase.goalIdx + 1}
                resolvedLabel={formatGoalLabel(goal, goalLabelOverrides)}
              />
            </View>
            <ScrollView style={{ flex: 1, paddingHorizontal: 24 }} showsVerticalScrollIndicator={false}>
              <AnchorScreen
                goal={goal}
                dailyInput={phase.dailyInput}
                isStandard={isStd}
                onDone={(when, where, schedule) =>
                  handleAnchorDone(goalIdx, phase.dailyInput, when, where, schedule, isStd, phase.decodePath, phase.resolvedTargetStr, phase.doneLooksText)
                }
              />
            </ScrollView>
          </View>
        );
      }

      case 'add-input': {
        const goal = goals[phase.goalIdx];
        const goalIdx = phase.goalIdx;
        return (
          <View style={{ flex: 1 }}>
            <View style={[styles.decodeHeader, { paddingHorizontal: 24 }]}>
              <View style={{ width: 40 }} />
              <GoalBadge
                goal={goal}
                n={phase.goalIdx + 1}
                resolvedLabel={formatGoalLabel(goal, goalLabelOverrides)}
              />
            </View>
            <ScrollView style={{ flex: 1, paddingHorizontal: 24 }} showsVerticalScrollIndicator={false}>
              <AddInputScreen
                goal={goal}
                onDone={(dailyInput, when, where, schedule) =>
                  handleAddInputDone(goalIdx, { dailyInput, when, where, schedule: schedule ?? null })
                }
                onCancel={() => transition({ kind: 'locked', goalIdx, dailyInput: '' })}
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
            onAddInput={() => transition({ kind: 'add-input', goalIdx: phase.goalIdx })}
          />
        );
      }

      case 'summary':
        return (
          <SummaryScreen
            goals={goals}
            locked={locked}
            goalLabelOverrides={goalLabelOverrides}
            onContinue={() => transition({ kind: 'identity' })}
            onReset={() => {
              setGoals(GOALS);
              setLocked([]);
              setDecodeResults({});
              setGoalLabelOverrides({});
              setIdentityOverrides({});
              transition({ kind: 'goals-entry' });
            }}
          />
        );

      case 'identity':
        return (
          <IdentityScreen
            goals={goals}
            locked={locked}
            identityOverrides={identityOverrides}
            onOverrideChange={(goalId, text) =>
              setIdentityOverrides(prev => ({ ...prev, [goalId]: text }))
            }
            onAccept={() => transition({ kind: 'compass-story' })}
          />
        );

      case 'compass-story':
        return (
          <CompassStoryScreen
            onNext={() => transition({ kind: 'compass-domino' })}
            onBack={() => goBack()}
          />
        );

      case 'compass-domino':
        return (
          <CompassDominoScreen
            goals={goals}
            locked={locked}
            goalLabelOverrides={goalLabelOverrides}
            onNext={dominoGoalId => transition({ kind: 'compass-mechanism', dominoGoalId })}
            onBack={() => goBack()}
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
              transition({ kind: 'finale', beat: 0 });
            }}
            onBack={() => goBack()}
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
                transition({ kind: 'finale', beat: (phase.beat + 1) as 0 | 1 | 2 });
              } else {
                transition({ kind: 'commit' });
              }
            }}
            onBack={() => goBack()}
          />
        );

      case 'commit':
        return (
          <SignatureCommitScreen
            locked={locked}
            onStartChallenge={() => transition({ kind: 'paywall' })}
            onRestart={() => {
              setGoals(GOALS);
              setLocked([]);
              setDecodeResults({});
              setGoalLabelOverrides({});
              setIdentityOverrides({});
              setCompassFilter('');
              setHistory([]);
              setPhase({ kind: 'splash' });
            }}
          />
        );

      case 'paywall':
        return (
          <View style={StyleSheet.absoluteFillObject}>
            <PaywallGate onDismiss={() => goBack()} />
          </View>
        );
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Progress bar */}
      {phase.kind !== 'splash' && phase.kind !== 'welcome' && phase.kind !== 'goals-entry' && phase.kind !== 'goal-done-looks' && phase.kind !== 'goal-fuel-redirect' && phase.kind !== 'intro' && phase.kind !== 'summary' && phase.kind !== 'identity' && phase.kind !== 'compass-story' && phase.kind !== 'compass-domino' && phase.kind !== 'compass-mechanism' && phase.kind !== 'finale' && phase.kind !== 'commit' && phase.kind !== 'paywall' && (
        <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
          <ProgressBar value={completedSteps} total={totalSteps} />
        </View>
      )}

      <Animated.View style={containerStyle}>
        {renderPhase()}
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 52 : 32,
  },
  screen: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 48,
    marginBottom: 16,
  },
  heroSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
  },
  bottomSection: {
    paddingTop: 16,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.2,
  },
  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  stepPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  devBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  devLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginRight: 2,
  },
  devToggle: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  devToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  goalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  goalBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  decodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decodeScroll: {
    paddingBottom: 80,
    paddingTop: 8,
  },
  decodeQuestion: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 36,
    marginBottom: 8,
  },
  decodeSub: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  customInlineInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    minHeight: 44,
  },
  customConfirmBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customCancelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  customCancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inheritedTargetCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 28,
    gap: 8,
  },
  inheritedLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  inheritedValue: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 28,
  },
  editAffordance: {
    padding: 4,
    marginTop: 2,
  },
  helperHint: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    marginTop: 8,
  },
  revealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 28,
  },
  revealBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
  },
  revealCard: {
    borderRadius: 20,
    borderWidth: 2,
    padding: 24,
    marginTop: 24,
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  revealLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  revealNumber: {
    fontWeight: '900',
    letterSpacing: -2,
  },
  revealUnit: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  mathBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 4,
    width: '100%',
    marginTop: 8,
  },
  mathLine: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
  lockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginTop: 4,
    width: '100%',
  },
  lockBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
  },
  startingInput: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    minHeight: 64,
  },
  seedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  seedNoticeText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  anchorWhatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 4,
    gap: 8,
  },
  anchorWhatText: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
    flex: 1,
  },
  anchorEditInput: {
    fontSize: 17,
    fontWeight: '700',
  },
  whenField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  whenFieldText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  calendarHint: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    paddingLeft: 4,
  },
  whereInput: {
    fontSize: 15,
    fontWeight: '600',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    minHeight: 48,
  },
  systemPreview: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginTop: 20,
  },
  systemPreviewText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 24,
  },
  lockedCard: {
    borderRadius: 24,
    borderWidth: 2,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    width: '100%',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  lockedBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000',
  },
  lockedGoalLabel: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  lockedInput: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 28,
  },
  lockedNextHint: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  pathCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  pathCardLabel: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 3,
  },
  pathCardSub: {
    fontSize: 13,
    fontWeight: '500',
  },
  summaryContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 60,
  },
  summaryCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 20,
    marginBottom: 14,
    gap: 6,
    overflow: 'hidden',
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  summaryCardGoalLabel: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  summaryCardInput: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 26,
  },
  summaryCardWhen: {
    fontSize: 13,
    fontWeight: '500',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  standardsSkipBtn: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 20,
  },
  standardsSkipText: {
    fontSize: 13,
    fontWeight: '500',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  lockedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  lockedInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    paddingTop: 10,
    marginTop: 4,
  },
  standardTag: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  standardTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  addAnotherBtn: {
    marginTop: 16,
    width: '100%',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addAnotherText: {
    fontSize: 14,
    fontWeight: '700',
  },
  summaryInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  summaryStandardTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  summaryAdditionalRow: {
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 10,
    gap: 2,
  },
  stackSectionHeader: {
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 4,
  },
  stackSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  stackSectionSub: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  stackTile: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  stackCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    marginTop: 2,
    flexShrink: 0,
  },
  stackTileInput: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  stackTileWhen: {
    fontSize: 13,
    fontWeight: '500',
  },
  stackGoalTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 4,
  },
  stackGoalTagText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Identity screen
  identityFrame: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    gap: 0,
  },
  identityTileCard: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 20,
    overflow: 'hidden',
  },
  identityTileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  identityLineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 14,
  },
  identityLine: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
    flex: 1,
  },
  identityDivider: {
    height: 1,
  },
  identityEditInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    minHeight: 80,
  },
  identityEditSave: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  identityEditSaveText: {
    fontSize: 14,
    fontWeight: '700',
  },
  identityEditCancel: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  identityEditCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Finale screen
  finaleHeadline: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 42,
    marginBottom: 32,
  },
  finaleSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  compassCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  compassPlaceholder: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  compassSub: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
  finaleStackTile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
  },
  finaleStackText: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 4,
  },
  finaleStackWhen: {
    fontSize: 13,
    fontWeight: '500',
  },
  finaleCheckOuter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finaleCheckInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
  },

  // Signature commit screen
  sigLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  sigPad: {
    height: 180,
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigHint: {
    fontSize: 14,
    color: '#555',
    fontStyle: 'italic',
  },
  sigClear: {
    position: 'absolute',
    bottom: 10,
    right: 14,
  },
  sigClearText: {
    fontSize: 13,
    fontWeight: '600',
  },
  commitChecklistCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  commitChecklistRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    paddingTop: 0,
  },
  commitCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
    marginTop: 1,
  },
  commitChecklistText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    flex: 1,
  },
  commitCheckWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commitDoneTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  commitDoneSub: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
  },
  paywallCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    width: '100%',
    marginTop: 8,
  },
  paywallLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  paywallSub: {
    fontSize: 14,
    fontStyle: 'italic',
  },

  // Shared primary button (used across new screens)
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 0.2,
  },

  // Front-half screens
  goalsEntryInput: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    minHeight: 110,
  },
  doneLooksInput: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    minHeight: 100,
  },
  prefillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  prefillBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  classifyGoalPill: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  classifyGoalText: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
  },
  finishLineCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  finishLineLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  finishLineText: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
  },
  fuelSecondaryBtn: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  fuelSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
  },
  fuelRedirectCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    gap: 6,
  },
  fuelRedirectIf: {
    fontSize: 14,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  fuelRedirectAction: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },
  doneLooksEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  doneLooksHint: {
    fontSize: 13,
    fontWeight: '500',
    fontStyle: 'italic',
    marginTop: 10,
    lineHeight: 20,
  },
  doneLooksUseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  doneLooksUseChipText: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },

  // Compass screens
  compassBeatCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    gap: 6,
  },
  compassBeatYear: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  compassBeatText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  compassDominoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  compassDominoNum: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  compassDominoLabel: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  compassDominoCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  compassExampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 20,
  },
  compassExampleLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  compassExampleText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    flex: 1,
  },
  compassFilterPreview: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginTop: 16,
    gap: 6,
  },
  compassFilterLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  compassFilterText: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
    fontStyle: 'italic',
  },
  finaleGoalTag: {
    alignSelf: 'flex-start' as const,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  finaleGoalTagText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  compassCinematicEyebrow: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
  compassCinematicHeadline: {
    fontSize: 42,
    fontWeight: '900' as const,
    lineHeight: 48,
    letterSpacing: -1,
  },
  compassCinematicBody: {
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 24,
  },
  compassCinematicBodyBold: {
    fontWeight: '800' as const,
  },
  compassCinematicQuote: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 24,
  },
  compassCinematicQuoteText: {
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 36,
    fontStyle: 'italic',
    letterSpacing: -0.5,
  },
  compassCinematicRuleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
  },
  compassCinematicChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 54,
    alignItems: 'center' as const,
  },
  compassCinematicChipText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  compassCinematicRuleText: {
    fontSize: 17,
    fontWeight: '600',
  },
  compassCinematicGoldCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 24,
    gap: 12,
  },
  compassCinematicGoldTag: {
    alignSelf: 'flex-start' as const,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  compassCinematicGoldTagText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1.5,
  },
  compassCinematicWinTitle: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 36,
  },
  compassCinematicWinSub: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  compassCinematicCloserBold: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  welcomeDots: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    alignSelf: 'center' as const,
  },
  welcomeDot: {
    height: 8,
    borderRadius: 4,
  },
  compassPinnedOuter: {
    flex: 1,
    paddingHorizontal: 24,
  },
  compassPinnedTop: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  compassPinnedContent: {
    flex: 1,
    justifyContent: 'flex-start' as const,
    paddingTop: 24,
  },
  compassPinnedBottom: {
    paddingBottom: 20,
  },
});
