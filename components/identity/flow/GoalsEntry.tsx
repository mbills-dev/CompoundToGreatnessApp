import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { ArrowLeft, ArrowRight, Check, Zap } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FlowGoal, DecodePath } from './types';
import { GoalBadge, formatGoalLabel } from './AnchorScreens';
import styles from './styles';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIGIT_COMMA_PLACEHOLDER = '\x00DC\x00';

let _goalIdSeq = 100;

function normalizeMoneyInLabel(label: string): string {
  const hasMoneyContext =
    /\$|earn|make|revenue|income|profit|save|salary|sales/i.test(label);
  if (!hasMoneyContext) return label;
  return label.replace(
    /(\$\s*)?(\d[\d,]*(?:\.\d+)?)\s*([kKmM])\b/g,
    (_, _dollar, num, suf) => `$${num}${suf.toUpperCase()}`,
  );
}

export function parseGoalsFromText(text: string): FlowGoal[] {
  const protected_ = text.replace(/(\d),(\d)/g, `$1${DIGIT_COMMA_PLACEHOLDER}$2`);
  const parts = protected_
    .split(',')
    .map(s => s.trim().replace(new RegExp(DIGIT_COMMA_PLACEHOLDER, 'g'), ','))
    .filter(s => s.length > 0);
  if (parts.length === 0) return [];
  return parts.map(rawLabel => ({
    id: _goalIdSeq++,
    label: normalizeMoneyInLabel(rawLabel),
    category: 'General',
    deadline: 'ongoing',
    defaultPath: 'starting' as DecodePath,
  }));
}

function goalHasNumber(s: string): boolean {
  return /\d/.test(s) || /\b(lbs?|steps?|hrs?|hours?|minutes?|min|miles?|km)\b/i.test(s);
}

// ─── GoalsEntryScreen ─────────────────────────────────────────────────────────

export function GoalsEntryScreen({ onContinue, onBack }: { onContinue: (goals: FlowGoal[]) => void; onBack: () => void }) {
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
          <Text style={[styles.heroSubtitle, { color: colors.primary, marginBottom: 28 }]}>
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

// ─── GoalFuelRedirectScreen ───────────────────────────────────────────────────

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
  onSkipAsStandard: (actionText: string) => void;
  onContinue: (redirectText: string) => void;
  onBack: () => void;
  onStateChange: (text: string) => void;
}) {
  const { colors, isDark } = useTheme();
  const [actionText, setActionText] = useState(practiceText);
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
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: canLock ? colors.primary : colors.border, opacity: canLock ? 1 : 0.45 }]}
                onPress={() => canLock && onSkipAsStandard(actionText.trim())}
                disabled={!canLock}
                activeOpacity={0.85}
              >
                <Check size={18} color="#000" strokeWidth={3} />
                <Text style={styles.primaryButtonText}>Lock it in as my standard</Text>
              </TouchableOpacity>
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

// ─── GoalDoneLooksScreen ──────────────────────────────────────────────────────

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
  goal: FlowGoal;
  goalIdx: number;
  total: number;
  chosenPath: DecodePath;
  initialText?: string;
  onContinue: (doneLooksText: string) => void;
  onBack: () => void;
  onStateChange: (text: string) => void;
}) {
  const { colors, isDark } = useTheme();

  const isPostureA = goalHasNumber(goal.label);

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

// ─── IntroScreen ──────────────────────────────────────────────────────────────

export function IntroScreen({
  goals,
  onNext,
  onBack,
  goalLabelOverrides,
}: {
  goals: FlowGoal[];
  onNext: () => void;
  onBack: () => void;
  goalLabelOverrides: Record<number, string>;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.screen}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <TouchableOpacity onPress={onBack} style={[styles.backBtn, { marginBottom: 20 }]}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
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
