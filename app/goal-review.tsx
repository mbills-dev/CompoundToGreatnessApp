import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft,
  ArrowRight,
  Check,
  RotateCw,
  Sparkles,
  Plus,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Suggestion {
  input: string;
  frequency: 'daily' | 'weekly';
}

interface GoalInputResult {
  goal: string;
  specificity: 'high' | 'low';
  clarifying_question: string | null;
  suggestions: Suggestion[];
}

type SelectedInputs = Record<number, string[]>;

// ─── API call ──────────────────────────────────────────────────────────────────

async function fetchDailyInputs(
  goal: string,
  clarificationAnswer?: string,
): Promise<GoalInputResult | null> {
  try {
    const body: Record<string, string> = { goal };
    if (clarificationAnswer && clarificationAnswer.trim()) {
      body.clarification_answer = clarificationAnswer.trim();
    }

    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-daily-inputs`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) return null;
    const data = await response.json();
    if (data && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
      return data as GoalInputResult;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Per-goal card ────────────────────────────────────────────────────────────

function GoalInputCard({
  goalIndex,
  goal,
  result,
  loading,
  selectedInputs,
  onToggleInput,
  onAddCustom,
  onRegenerate,
}: {
  goalIndex: number;
  goal: string;
  result: GoalInputResult | null;
  loading: boolean;
  selectedInputs: SelectedInputs;
  onToggleInput: (goalIndex: number, input: string) => void;
  onAddCustom: (goalIndex: number, input: string) => void;
  onRegenerate: (goalIndex: number, answer: string) => void;
}) {
  const { colors, isDark } = useTheme();
  const [customText, setCustomText] = useState('');
  const [clarifyText, setClarifyText] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const selected = selectedInputs[goalIndex] ?? [];

  const handleRegenerate = async () => {
    if (!clarifyText.trim() || regenerating) return;
    setRegenerating(true);
    await onRegenerate(goalIndex, clarifyText.trim());
    setRegenerating(false);
  };

  const handleAddCustom = () => {
    const trimmed = customText.trim();
    if (!trimmed) return;
    onAddCustom(goalIndex, trimmed);
    setCustomText('');
  };

  return (
    <View
      style={[
        styles.goalCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.goalLabel, { color: colors.text }]}>
        {goal}
      </Text>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Generating suggestions...
          </Text>
        </View>
      ) : result ? (
        <>
          {result.clarifying_question && (
            <View
              style={[
                styles.clarifyCard,
                {
                  backgroundColor: isDark ? 'rgba(204,255,0,0.06)' : 'rgba(204,255,0,0.04)',
                  borderColor: colors.primary + '40',
                },
              ]}
            >
              <Text style={[styles.clarifyLabel, { color: colors.primary }]}>
                CLARIFY
              </Text>
              <Text style={[styles.clarifyQuestion, { color: colors.text }]}>
                {result.clarifying_question}
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
                    { backgroundColor: colors.primary, opacity: regenerating || !clarifyText.trim() ? 0.5 : 1 },
                  ]}
                  onPress={handleRegenerate}
                  disabled={regenerating || !clarifyText.trim()}
                  activeOpacity={0.8}
                >
                  {regenerating ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <RotateCw size={16} color="#000" strokeWidth={2.5} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.suggestionList}>
            {result.suggestions.map((s, i) => {
              const isSelected = selected.includes(s.input);
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.suggestionCard,
                    {
                      backgroundColor: isSelected
                        ? colors.primary + '18'
                        : isDark
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.03)',
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => onToggleInput(goalIndex, s.input)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.suggestionCheck,
                      {
                        backgroundColor: isSelected ? colors.primary : 'transparent',
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    {isSelected && <Check size={14} color="#000" strokeWidth={3} />}
                  </View>
                  <Text style={[styles.suggestionText, { color: colors.text }]}>
                    {s.input}
                  </Text>
                  <View
                    style={[
                      styles.frequencyBadge,
                      { backgroundColor: s.frequency === 'weekly' ? colors.primary + '15' : colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.frequencyText,
                        { color: s.frequency === 'weekly' ? colors.primary : colors.textSecondary },
                      ]}
                    >
                      {s.frequency}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.customRow}>
            <TextInput
              style={[
                styles.customInput,
                {
                  color: colors.text,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  borderColor: customText.trim() ? colors.primary + '60' : colors.border,
                },
              ]}
              value={customText}
              onChangeText={setCustomText}
              placeholder="Write your own..."
              placeholderTextColor={colors.textTertiary}
              returnKeyType="done"
              blurOnSubmit
            />
            <TouchableOpacity
              style={[
                styles.customAddBtn,
                { backgroundColor: customText.trim() ? colors.primary : colors.border, opacity: customText.trim() ? 1 : 0.5 },
              ]}
              onPress={handleAddCustom}
              disabled={!customText.trim()}
              activeOpacity={0.8}
            >
              <Plus size={20} color="#000" strokeWidth={3} />
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.customRow}>
          <TextInput
            style={[
              styles.customInput,
              {
                color: colors.text,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                borderColor: customText.trim() ? colors.primary + '60' : colors.border,
              },
            ]}
            value={customText}
            onChangeText={setCustomText}
            placeholder="Write your own input..."
            placeholderTextColor={colors.textTertiary}
            returnKeyType="done"
            blurOnSubmit
          />
          <TouchableOpacity
            style={[
              styles.customAddBtn,
              { backgroundColor: customText.trim() ? colors.primary : colors.border, opacity: customText.trim() ? 1 : 0.5 },
            ]}
            onPress={handleAddCustom}
            disabled={!customText.trim()}
            activeOpacity={0.8}
          >
            <Plus size={20} color="#000" strokeWidth={3} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function GoalReviewScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ goals?: string }>();

  const goals: string[] = (() => {
    try {
      return params.goals ? JSON.parse(params.goals) : [];
    } catch {
      return [];
    }
  })();

  const [results, setResults] = useState<Record<number, GoalInputResult | null>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [selectedInputs, setSelectedInputs] = useState<SelectedInputs>({});
  const fetchedRef = useRef(false);

  const callForGoal = useCallback(async (goalIndex: number, goal: string, answer?: string) => {
    setLoading(prev => ({ ...prev, [goalIndex]: true }));
    const result = await fetchDailyInputs(goal, answer);
    setResults(prev => ({ ...prev, [goalIndex]: result }));
    setLoading(prev => ({ ...prev, [goalIndex]: false }));
  }, []);

  useEffect(() => {
    if (fetchedRef.current || goals.length === 0) return;
    fetchedRef.current = true;
    Promise.all(goals.map((g, i) => callForGoal(i, g)));
  }, [goals, callForGoal]);

  const toggleInput = (goalIndex: number, input: string) => {
    setSelectedInputs(prev => {
      const current = prev[goalIndex] ?? [];
      const next = current.includes(input)
        ? current.filter(x => x !== input)
        : [...current, input];
      return { ...prev, [goalIndex]: next };
    });
  };

  const addCustom = (goalIndex: number, input: string) => {
    setSelectedInputs(prev => {
      const current = prev[goalIndex] ?? [];
      if (current.includes(input)) return prev;
      return { ...prev, [goalIndex]: [...current, input] };
    });
  };

  const regenerate = async (goalIndex: number, answer: string) => {
    setSelectedInputs(prev => ({ ...prev, [goalIndex]: [] }));
    await callForGoal(goalIndex, goals[goalIndex], answer);
  };

  const totalSelected = Object.values(selectedInputs).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );

  const handleContinue = () => {
    // Draft state is ready — session 3 will persist to daily_activities.
    router.back();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.6}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Review Goals</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introBlock}>
          <Sparkles size={22} color={colors.primary} strokeWidth={2} />
          <View style={styles.introText}>
            <Text style={[styles.title, { color: colors.text }]}>
              Build your Success Stack
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Tap the daily inputs that fit your life. Add your own if none feel right.
            </Text>
          </View>
        </View>

        <View style={styles.goalList}>
          {goals.map((goal, i) => (
            <GoalInputCard
              key={i}
              goalIndex={i}
              goal={goal}
              result={results[i] ?? null}
              loading={loading[i] ?? false}
              selectedInputs={selectedInputs}
              onToggleInput={toggleInput}
              onAddCustom={addCustom}
              onRegenerate={regenerate}
            />
          ))}
          {goals.length === 0 && (
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              No goals were extracted. Try uploading another photo or entering them manually.
            </Text>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: totalSelected > 0 ? 1 : 0.5 }]}
          activeOpacity={0.85}
          disabled={totalSelected === 0}
          onPress={handleContinue}
        >
          <Text style={styles.primaryButtonText}>
            {totalSelected > 0
              ? `Continue with ${totalSelected} input${totalSelected !== 1 ? 's' : ''}`
              : 'Select at least one input'}
          </Text>
          <ArrowRight size={20} color="#000" strokeWidth={3} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 120,
  },
  introBlock: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 24,
  },
  introText: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  goalList: {
    gap: 16,
  },
  goalCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  goalLabel: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  clarifyCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  clarifyLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  clarifyQuestion: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  clarifyInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  clarifyInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '500',
    minHeight: 44,
  },
  regenerateBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionList: {
    gap: 8,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
  },
  suggestionCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  frequencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  frequencyText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  customRow: {
    flexDirection: 'row',
    gap: 8,
  },
  customInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500',
    minHeight: 48,
  },
  customAddBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    textAlign: 'center',
    paddingTop: 40,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: 'transparent',
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
});
