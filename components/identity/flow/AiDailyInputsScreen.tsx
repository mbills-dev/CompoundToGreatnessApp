import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { ArrowRight, Check, RotateCw, Sparkles, ArrowLeft, Pencil, X, GitMerge, Scissors, Lightbulb } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FlowGoal } from './types';
import { ChipGroup } from './PathScreens';
import { useInputSpecificity, SpecificityNudgeBanner } from './InputValidation';
import { AiThinkingIndicator } from './AiThinkingIndicator';
import { logEdgeFunctionCall } from '@/lib/edgeFunctionLogger';

export interface Suggestion {
  input: string;
  frequency: 'daily' | 'weekly';
}

export interface GoalInputResult {
  goal: string;
  identityLine?: string;
  specificity: 'high' | 'low';
  clarifying_question: string | null;
  suggestions: Suggestion[];
}

type SelectedInputs = Record<number, string[]>;

export interface OverlapGroup {
  indices: number[];
  reason: string;
}

export async function fetchOverlappingGoals(goalLabels: string[]): Promise<OverlapGroup[]> {
  try {
    logEdgeFunctionCall('detect-overlapping-goals');
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/detect-overlapping-goals`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ goals: goalLabels }),
      },
    );
    if (!response.ok) return [];
    const data = await response.json();
    if (data && Array.isArray(data.groups)) {
      return data.groups as OverlapGroup[];
    }
    return [];
  } catch {
    return [];
  }
}

export function OverlapBanner({
  reason,
  onKeepSeparate,
  onCombine,
}: {
  reason: string;
  onKeepSeparate: () => void;
  onCombine: () => void;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        ovStyles.banner,
        {
          backgroundColor: isDark ? 'rgba(250,180,50,0.08)' : 'rgba(250,180,50,0.06)',
          borderColor: '#F0A030' + '50',
        },
      ]}
    >
      <View style={ovStyles.bannerHeader}>
        <GitMerge size={16} color="#F0A030" strokeWidth={2.5} />
        <Text style={[ovStyles.bannerTitle, { color: '#F0A030' }]}>These goals look related</Text>
        <TouchableOpacity onPress={onKeepSeparate} style={ovStyles.dismissBtn} activeOpacity={0.6}>
          <X size={16} color={colors.textSecondary} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
      <Text style={[ovStyles.bannerReason, { color: colors.text }]}>{reason}</Text>
      <View style={ovStyles.bannerActions}>
        <TouchableOpacity
          style={[ovStyles.keepBtn, { borderColor: colors.border }]}
          onPress={onKeepSeparate}
          activeOpacity={0.7}
        >
          <Text style={[ovStyles.keepBtnText, { color: colors.textSecondary }]}>Keep Separate</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[ovStyles.combineBtn, { backgroundColor: '#F0A030' }]}
          onPress={onCombine}
          activeOpacity={0.8}
        >
          <Text style={ovStyles.combineBtnText}>Combine These</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function MergeEditor({
  defaultLabel,
  onConfirm,
  onCancel,
}: {
  defaultLabel: string;
  onConfirm: (label: string) => void;
  onCancel: () => void;
}) {
  const { colors, isDark } = useTheme();
  const [text, setText] = useState(defaultLabel);
  return (
    <View
      style={[
        ovStyles.mergeEditor,
        {
          backgroundColor: isDark ? 'rgba(250,180,50,0.08)' : 'rgba(250,180,50,0.06)',
          borderColor: '#F0A030' + '50',
        },
      ]}
    >
      <Text style={[ovStyles.mergeEditorLabel, { color: '#F0A030' }]}>COMBINE GOALS</Text>
      <TextInput
        style={[
          ovStyles.mergeInput,
          {
            color: colors.text,
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            borderColor: '#F0A030' + '60',
          },
        ]}
        value={text}
        onChangeText={setText}
        autoFocus
        multiline
        returnKeyType="done"
        blurOnSubmit
      />
      <View style={ovStyles.bannerActions}>
        <TouchableOpacity
          style={[ovStyles.keepBtn, { borderColor: colors.border }]}
          onPress={onCancel}
          activeOpacity={0.7}
        >
          <Text style={[ovStyles.keepBtnText, { color: colors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[ovStyles.combineBtn, { backgroundColor: '#F0A030', opacity: text.trim() ? 1 : 0.5 }]}
          onPress={() => text.trim() && onConfirm(text.trim())}
          disabled={!text.trim()}
          activeOpacity={0.8}
        >
          <Text style={ovStyles.combineBtnText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export interface VagueFlag {
  index: number;
  reason: string;
  suggestion: string;
}

export async function fetchVagueGoals(goalLabels: string[]): Promise<VagueFlag[]> {
  try {
    logEdgeFunctionCall('detect-vague-goals');
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/detect-vague-goals`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ goals: goalLabels }),
      },
    );
    if (!response.ok) return [];
    const data = await response.json();
    if (data && Array.isArray(data.flags)) {
      return data.flags as VagueFlag[];
    }
    return [];
  } catch {
    return [];
  }
}

export function VagueGoalBanner({
  reason,
  suggestion,
  onUseThis,
  onKeepAsIs,
}: {
  reason: string;
  suggestion: string;
  onUseThis: () => void;
  onKeepAsIs: () => void;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        vagueStyles.banner,
        {
          backgroundColor: isDark ? 'rgba(232,146,60,0.08)' : 'rgba(232,146,60,0.06)',
          borderColor: '#E8923C' + '50',
        },
      ]}
    >
      <View style={vagueStyles.bannerHeader}>
        <Lightbulb size={16} color="#E8923C" strokeWidth={2.5} />
        <Text style={[vagueStyles.bannerTitle, { color: '#E8923C' }]}>This goal could be more specific</Text>
        <TouchableOpacity onPress={onKeepAsIs} style={vagueStyles.dismissBtn} activeOpacity={0.6}>
          <X size={16} color={colors.textSecondary} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
      <Text style={[vagueStyles.bannerReason, { color: colors.text }]}>{reason}</Text>
      <Text style={[vagueStyles.bannerSuggestion, { color: colors.textSecondary }]}>
        Suggested: <Text style={{ fontWeight: '700', color: colors.text }}>"{suggestion}"</Text>
      </Text>
      <View style={vagueStyles.bannerActions}>
        <TouchableOpacity
          style={[vagueStyles.keepBtn, { borderColor: colors.border }]}
          onPress={onKeepAsIs}
          activeOpacity={0.7}
        >
          <Text style={[vagueStyles.keepBtnText, { color: colors.textSecondary }]}>Keep As Is</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[vagueStyles.useBtn, { backgroundColor: '#E8923C' }]}
          onPress={onUseThis}
          activeOpacity={0.8}
        >
          <Text style={vagueStyles.useBtnText}>Use This</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function remapRecord<T>(
  prev: Record<number, T>,
  removeSet: Set<number>,
  goalsLength: number,
  defaultValue: T,
): Record<number, T> {
  const next: Record<number, T> = {};
  let newIdx = 0;
  for (let i = 0; i < goalsLength; i++) {
    if (removeSet.has(i)) continue;
    next[newIdx] = prev[i] ?? defaultValue;
    newIdx++;
  }
  return next;
}

export function GoalCountNudge({
  count,
  onTrim,
  onKeepAll,
}: {
  count: number;
  onTrim: () => void;
  onKeepAll: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[nudgeStyles.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
      <View style={[nudgeStyles.card, { backgroundColor: colors.card }]}>
        <View style={nudgeStyles.iconWrap}>
          <Scissors size={28} color={colors.primary} strokeWidth={2.5} />
        </View>
        <Text style={[nudgeStyles.title, { color: colors.text }]}>
          You've got {count} goals
        </Text>
        <Text style={[nudgeStyles.body, { color: colors.textSecondary }]}>
          Most people succeed by focusing on fewer at once. Want to trim your list before we build your Success Stack?
        </Text>
        <View style={nudgeStyles.actions}>
          <TouchableOpacity
            style={[nudgeStyles.trimBtn, { backgroundColor: colors.primary }]}
            onPress={onTrim}
            activeOpacity={0.8}
          >
            <Text style={nudgeStyles.trimBtnText}>Trim My List</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[nudgeStyles.keepBtn, { borderColor: colors.border }]}
            onPress={onKeepAll}
            activeOpacity={0.7}
          >
            <Text style={[nudgeStyles.keepBtnText, { color: colors.textSecondary }]}>
              Keep All {count}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export function TrimModal({
  goals,
  checked,
  onToggle,
  onConfirm,
  onCancel,
}: {
  goals: FlowGoal[];
  checked: Set<number>;
  onToggle: (idx: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { colors, isDark } = useTheme();
  const checkedCount = goals.filter((_, i) => checked.has(i)).length;
  return (
    <View style={[nudgeStyles.overlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
      <View style={[nudgeStyles.trimCard, { backgroundColor: colors.card }]}>
        <View style={nudgeStyles.trimHeader}>
          <TouchableOpacity onPress={onCancel} style={nudgeStyles.closeBtn} activeOpacity={0.6}>
            <X size={20} color={colors.textSecondary} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={[nudgeStyles.trimTitle, { color: colors.text }]}>Trim your list</Text>
          <View style={nudgeStyles.closeBtn} />
        </View>
        <Text style={[nudgeStyles.trimSubtitle, { color: colors.textSecondary }]}>
          Uncheck any goals you want to save for later
        </Text>
        <ScrollView style={nudgeStyles.trimScroll} showsVerticalScrollIndicator={false}>
          {goals.map((goal, i) => {
            const isChecked = checked.has(i);
            return (
              <TouchableOpacity
                key={goal.id}
                style={[
                  nudgeStyles.trimItem,
                  {
                    backgroundColor: isChecked
                      ? isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
                      : isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
                    borderColor: isChecked ? colors.primary + '40' : colors.border,
                  },
                ]}
                onPress={() => onToggle(i)}
                activeOpacity={0.7}
              >
                <View style={[
                  nudgeStyles.trimCheck,
                  {
                    backgroundColor: isChecked ? colors.primary : 'transparent',
                    borderColor: isChecked ? colors.primary : colors.border,
                  },
                ]}>
                  {isChecked && <Check size={16} color="#000" strokeWidth={3} />}
                </View>
                <Text style={[nudgeStyles.trimItemText, { color: colors.text }]}>{goal.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity
          style={[
            nudgeStyles.trimConfirmBtn,
            { backgroundColor: colors.primary, opacity: checkedCount > 0 ? 1 : 0.5 },
          ]}
          onPress={onConfirm}
          disabled={checkedCount === 0}
          activeOpacity={0.8}
        >
          <Text style={nudgeStyles.trimConfirmText}>
            Continue with {checkedCount} goal{checkedCount !== 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export async function fetchDailyInputs(
  goal: string,
  history?: { question: string; answer: string }[],
  otherGoalsContext?: { goal: string; context: string }[],
): Promise<GoalInputResult | null> {
  try {
    const body: Record<string, unknown> = { goal };
    if (history && history.length > 0) {
      body.history = history;
    }
    if (otherGoalsContext && otherGoalsContext.length > 0) {
      body.otherGoalsContext = otherGoalsContext;
    }
    logEdgeFunctionCall('generate-daily-inputs');
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

function GoalInputCard({
  goalIndex,
  goal,
  result,
  loading,
  selectedInputs,
  onSelectPrimary,
  onRegenerate,
  onEditGoal,
}: {
  goalIndex: number;
  goal: string;
  result: GoalInputResult | null;
  loading: boolean;
  selectedInputs: SelectedInputs;
  onSelectPrimary: (goalIndex: number, input: string) => void;
  onRegenerate: (goalIndex: number, answer: string) => void;
  onEditGoal: (goalIndex: number, newLabel: string) => void;
}) {
  const { colors, isDark } = useTheme();
  const [clarifyText, setClarifyText] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalText, setGoalText] = useState(goal);
  const primarySelected = (selectedInputs[goalIndex] ?? [])[0] ?? null;
  const chipOptions = result?.suggestions?.map(s => s.input) ?? [];
  const specificity = useInputSpecificity();

  useEffect(() => {
    if (primarySelected && !chipOptions.includes(primarySelected)) {
      specificity.validate(primarySelected);
    } else if (specificity.result) {
      specificity.dismiss();
    }
  }, [primarySelected, chipOptions]);

  const handleRegenerate = async () => {
    if (!clarifyText.trim() || regenerating) return;
    setRegenerating(true);
    await onRegenerate(goalIndex, clarifyText.trim());
    setClarifyText('');
    setRegenerating(false);
  };

  return (
    <View style={diStyles.goalCard}>
      {editingGoal ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput
            style={[diStyles.goalLabel, { color: colors.text, flex: 1, borderBottomWidth: 2, borderBottomColor: colors.primary, paddingBottom: 2 }]}
            value={goalText}
            onChangeText={setGoalText}
            autoFocus
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={() => {
              const trimmed = goalText.trim();
              if (trimmed) onEditGoal(goalIndex, trimmed);
              setEditingGoal(false);
            }}
            onEndEditing={() => setEditingGoal(false)}
          />
          <TouchableOpacity
            onPress={() => {
              const trimmed = goalText.trim();
              if (trimmed) onEditGoal(goalIndex, trimmed);
              setEditingGoal(false);
            }}
            style={{ padding: 4 }}
          >
            <Check size={20} color={colors.primary} strokeWidth={3} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => { setGoalText(goal); setEditingGoal(true); }} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[diStyles.goalLabel, { color: colors.text }]}>{goal}</Text>
          <Pencil size={13} color={colors.textTertiary} strokeWidth={2} />
        </TouchableOpacity>
      )}

      {loading && !result ? (
        <View style={diStyles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[diStyles.loadingText, { color: colors.textSecondary }]}>
            Generating suggestions...
          </Text>
        </View>
      ) : (
        <>
          {result?.clarifying_question && (
            <View
              style={[
                diStyles.clarifyCard,
                {
                  backgroundColor: isDark ? 'rgba(204,255,0,0.06)' : 'rgba(204,255,0,0.08)',
                  borderColor: colors.primary + '50',
                },
              ]}
            >
              <Text style={[diStyles.clarifyLabel, { color: colors.primary }]}>CLARIFY</Text>
              <Text style={[diStyles.clarifyQuestion, { color: colors.text }]}>
                {result.clarifying_question}
              </Text>
              <View style={diStyles.clarifyInputRow}>
                <TextInput
                  style={[
                    diStyles.clarifyInput,
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
                    diStyles.regenerateBtn,
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

          <View style={{ position: 'relative' }}>
            <View pointerEvents={loading ? 'none' : 'auto'} style={[loading && { opacity: 0.4 }]}>
              <ChipGroup
                label="PICK YOUR DAILY ACTION"
                options={chipOptions}
                selected={primarySelected}
                onSelect={(v) => onSelectPrimary(goalIndex, v)}
                customPlaceholder="Write your own..."
              />
              {specificity.result && (
                <SpecificityNudgeBanner
                  result={specificity.result}
                  onAcceptExample={(ex) => { onSelectPrimary(goalIndex, ex); specificity.dismiss(); }}
                  onDismiss={specificity.dismiss}
                />
              )}
            </View>
            {loading && (
              <View style={diStyles.updatingOverlay}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[diStyles.updatingText, { color: colors.textSecondary }]}>
                  Updating...
                </Text>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

export function AiDailyInputsScreen({
  goals,
  onDone,
  onBack,
  onEditGoal,
  onMergeGoals,
  onRemoveGoals,
}: {
  goals: FlowGoal[];
  onDone: (selectedInputs: Record<number, string[]>, identityLines: Record<number, string>) => void;
  onBack: () => void;
  onEditGoal: (goalIndex: number, newLabel: string) => void;
  onMergeGoals: (keepIndex: number, newLabel: string, removeIndices: number[]) => void;
  onRemoveGoals: (removeIndices: number[]) => void;
}) {
  const { colors } = useTheme();
  const [results, setResults] = useState<Record<number, GoalInputResult | null>>({});
  const [identityLines, setIdentityLines] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [selectedInputs, setSelectedInputs] = useState<SelectedInputs>({});
  const [clarifyHistory, setClarifyHistory] = useState<Record<number, { question: string; answer: string }[]>>({});
  const [overlapGroups, setOverlapGroups] = useState<OverlapGroup[]>([]);
  const [dismissedGroups, setDismissedGroups] = useState<Set<number>>(new Set());
  const [mergeGroupIdx, setMergeGroupIdx] = useState<number | null>(null);
  const [vagueFlags, setVagueFlags] = useState<VagueFlag[]>([]);
  const [dismissedVague, setDismissedVague] = useState<Set<number>>(new Set());
  const [goalCountResolved, setGoalCountResolved] = useState(goals.length <= 10);
  const [showTrimModal, setShowTrimModal] = useState(false);
  const [trimChecked, setTrimChecked] = useState<Set<number>>(new Set());
  const fetchedRef = useRef(false);

  const callForGoal = useCallback(async (
    goalIndex: number,
    goal: string,
    history: { question: string; answer: string }[] = [],
    otherGoalsContext: { goal: string; context: string }[] = [],
  ) => {
    setLoading(prev => ({ ...prev, [goalIndex]: true }));
    const result = await fetchDailyInputs(goal, history, otherGoalsContext);
    setResults(prev => ({ ...prev, [goalIndex]: result }));
    if (result?.identityLine) {
      setIdentityLines(prev => ({ ...prev, [goalIndex]: result.identityLine! }));
    }
    setLoading(prev => ({ ...prev, [goalIndex]: false }));
  }, []);

  useEffect(() => {
    if (fetchedRef.current || goals.length === 0 || !goalCountResolved) return;
    fetchedRef.current = true;
    Promise.all(goals.map((g, i) => callForGoal(i, g.label)));
    if (goals.length >= 2) {
      fetchOverlappingGoals(goals.map(g => g.label)).then(groups => {
        setOverlapGroups(groups);
      });
    }
    fetchVagueGoals(goals.map(g => g.label)).then(flags => {
      setVagueFlags(flags);
    });
  }, [goals, callForGoal, goalCountResolved]);

  const selectPrimary = (goalIndex: number, input: string) => {
    setSelectedInputs(prev => ({ ...prev, [goalIndex]: [input] }));
  };

  const regenerate = async (goalIndex: number, answer: string) => {
    const currentResult = results[goalIndex];
    const question = currentResult?.clarifying_question ?? '';
    const newEntry = { question, answer };
    const newHistory = [...(clarifyHistory[goalIndex] ?? []), newEntry];

    const otherGoalsContext = goals
      .map((g, i) => {
        if (i === goalIndex) return null;
        const hist = clarifyHistory[i] ?? [];
        if (hist.length === 0) return null;
        const context = hist.map(h => `Q: ${h.question} A: ${h.answer}`).join('; ');
        return { goal: g.label, context };
      })
      .filter((x): x is { goal: string; context: string } => x !== null);

    setSelectedInputs(prev => ({ ...prev, [goalIndex]: [] }));
    setClarifyHistory(prev => ({ ...prev, [goalIndex]: newHistory }));
    await callForGoal(goalIndex, goals[goalIndex].label, newHistory, otherGoalsContext);
  };

  const handleConfirmMerge = (groupIdx: number, newLabel: string) => {
    const group = overlapGroups[groupIdx];
    if (!group || group.indices.length < 2) return;
    const keepIndex = group.indices[0];
    const removeIndices = group.indices.slice(1);

    const removeSet = new Set(removeIndices);

    setResults(prev => {
      const next: Record<number, GoalInputResult | null> = {};
      let newIdx = 0;
      for (let i = 0; i < goals.length; i++) {
        if (removeSet.has(i)) continue;
        if (i === keepIndex) {
          next[newIdx] = prev[i] ?? null;
        } else {
          next[newIdx] = prev[i] ?? null;
        }
        newIdx++;
      }
      return next;
    });

    setLoading(prev => {
      const next: Record<number, boolean> = {};
      let newIdx = 0;
      for (let i = 0; i < goals.length; i++) {
        if (removeSet.has(i)) continue;
        next[newIdx] = prev[i] ?? false;
        newIdx++;
      }
      return next;
    });

    setSelectedInputs(prev => {
      const next: SelectedInputs = {};
      let newIdx = 0;
      for (let i = 0; i < goals.length; i++) {
        if (removeSet.has(i)) continue;
        if (i === keepIndex) {
          next[newIdx] = prev[i] ?? [];
        } else {
          next[newIdx] = prev[i] ?? [];
        }
        newIdx++;
      }
      return next;
    });

    setClarifyHistory(prev => {
      const next: Record<number, { question: string; answer: string }[]> = {};
      let newIdx = 0;
      for (let i = 0; i < goals.length; i++) {
        if (removeSet.has(i)) continue;
        next[newIdx] = prev[i] ?? [];
        newIdx++;
      }
      return next;
    });

    setIdentityLines(prev => {
      const next: Record<number, string> = {};
      let newIdx = 0;
      for (let i = 0; i < goals.length; i++) {
        if (removeSet.has(i)) continue;
        next[newIdx] = prev[i] ?? '';
        newIdx++;
      }
      return next;
    });

    setOverlapGroups([]);
    setDismissedGroups(new Set());
    setMergeGroupIdx(null);

    onMergeGoals(keepIndex, newLabel, removeIndices);
  };

  const handleConfirmTrim = () => {
    const removeIndices = goals
      .map((_, i) => i)
      .filter(i => !trimChecked.has(i));

    if (removeIndices.length === 0) {
      setGoalCountResolved(true);
      setShowTrimModal(false);
      return;
    }

    if (removeIndices.length >= goals.length) return;

    const removeSet = new Set(removeIndices);

    setResults(prev => remapRecord(prev, removeSet, goals.length, null as GoalInputResult | null));
    setLoading(prev => remapRecord(prev, removeSet, goals.length, false));
    setSelectedInputs(prev => remapRecord(prev, removeSet, goals.length, [] as string[]));
    setClarifyHistory(prev => remapRecord(prev, removeSet, goals.length, [] as { question: string; answer: string }[]));
    setIdentityLines(prev => remapRecord(prev, removeSet, goals.length, ''));

    setGoalCountResolved(true);
    setShowTrimModal(false);
    onRemoveGoals(removeIndices);
  };

  const totalSelected = Object.values(selectedInputs).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );
  const allHaveSelection = goals.every((_, i) => (selectedInputs[i] ?? []).length > 0);
  const anyResultLoaded = goals.some((_, i) => results[i] != null);
  const allInitiallyLoading = !anyResultLoaded && goals.length > 0 && goals.every((_, i) => loading[i] === true);

  if (allInitiallyLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AiThinkingIndicator
          phrases={[
            'Reading your goals...',
            'Mapping your path...',
            'Crafting daily actions...',
            'Almost there...',
          ]}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={diStyles.header}>
        <TouchableOpacity onPress={onBack} style={diStyles.backButton} activeOpacity={0.6}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={[diStyles.headerTitle, { color: colors.text }]}>Success Stack</Text>
        <View style={diStyles.backButton} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={diStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={diStyles.introBlock}>
          <Sparkles size={22} color={colors.primary} strokeWidth={2} />
          <View style={diStyles.introText}>
            <Text style={[diStyles.title, { color: colors.text }]}>Build your Success Stack</Text>
            <Text style={[diStyles.subtitle, { color: colors.textSecondary }]}>
              Pick the daily input that fits each goal. Add your own if none feel right.
            </Text>
          </View>
        </View>

        <View style={diStyles.goalList}>
          {goals.map((goal, i) => {
            const activeGroups = overlapGroups
              .map((g, gi) => ({ group: g, groupIdx: gi }))
              .filter(({ group }) =>
                group.indices.includes(i) &&
                group.indices[0] === i &&
                !dismissedGroups.has(group.indices[0]) &&
                mergeGroupIdx === null,
              );

            return (
              <View key={goal.id}>
                {activeGroups.map(({ group, groupIdx }) =>
                  mergeGroupIdx === groupIdx ? (
                    <MergeEditor
                      key={`merge-${groupIdx}`}
                      defaultLabel={`${goals[group.indices[0]]?.label ?? ''} (includes ${group.indices.slice(1).map(idx => goals[idx]?.label ?? '').join(', ')})`}
                      onConfirm={(label) => handleConfirmMerge(groupIdx, label)}
                      onCancel={() => setMergeGroupIdx(null)}
                    />
                  ) : (
                    <OverlapBanner
                      key={`overlap-${groupIdx}`}
                      reason={group.reason}
                      onKeepSeparate={() => setDismissedGroups(prev => new Set(prev).add(group.indices[0]))}
                      onCombine={() => setMergeGroupIdx(groupIdx)}
                    />
                  ),
                )}
                {vagueFlags
                  .filter(f => f.index === i && !dismissedVague.has(f.index))
                  .map(f => (
                    <VagueGoalBanner
                      key={`vague-${f.index}`}
                      reason={f.reason}
                      suggestion={f.suggestion}
                      onUseThis={() => {
                        setDismissedVague(prev => new Set(prev).add(f.index));
                        onEditGoal(i, f.suggestion);
                      }}
                      onKeepAsIs={() => setDismissedVague(prev => new Set(prev).add(f.index))}
                    />
                  ))}
                <GoalInputCard
                  goalIndex={i}
                  goal={goal.label}
                  result={results[i] ?? null}
                  loading={loading[i] ?? false}
                  selectedInputs={selectedInputs}
                  onSelectPrimary={selectPrimary}
                  onRegenerate={regenerate}
                  onEditGoal={onEditGoal}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={diStyles.footer}>
        <TouchableOpacity
          style={[
            diStyles.primaryButton,
            { backgroundColor: colors.primary, opacity: allHaveSelection ? 1 : 0.5 },
          ]}
          activeOpacity={0.85}
          disabled={!allHaveSelection}
          onPress={() => onDone(selectedInputs, identityLines)}
        >
          <Text style={diStyles.primaryButtonText}>
            {allHaveSelection
              ? `Continue with ${totalSelected} input${totalSelected !== 1 ? 's' : ''}`
              : 'Pick one input per goal'}
          </Text>
          <ArrowRight size={20} color="#000" strokeWidth={3} />
        </TouchableOpacity>
      </View>

      {!goalCountResolved && (
        <GoalCountNudge
          count={goals.length}
          onTrim={() => {
            setTrimChecked(new Set(goals.map((_, i) => i)));
            setShowTrimModal(true);
          }}
          onKeepAll={() => setGoalCountResolved(true)}
        />
      )}

      {showTrimModal && (
        <TrimModal
          goals={goals}
          checked={trimChecked}
          onToggle={(idx) => setTrimChecked(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
          })}
          onConfirm={handleConfirmTrim}
          onCancel={() => setShowTrimModal(false)}
        />
      )}
    </View>
  );
}

const diStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 120 },
  introBlock: { flexDirection: 'row', gap: 14, marginBottom: 24 },
  introText: { flex: 1, gap: 6 },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -0.6, lineHeight: 32 },
  subtitle: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  goalList: { gap: 16 },
  goalCard: { borderRadius: 16, padding: 18, gap: 14 },
  goalLabel: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, lineHeight: 24 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  loadingText: { fontSize: 14, fontWeight: '500' },
  clarifyCard: { borderRadius: 14, borderWidth: 1.5, padding: 16, gap: 10 },
  clarifyLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  clarifyQuestion: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  clarifyInputRow: { flexDirection: 'row', gap: 8 },
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
  regenerateBtn: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  updatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  updatingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  primaryButtonText: { fontSize: 17, fontWeight: '800', color: '#000000', letterSpacing: 0.2 },
});

export const ovStyles = StyleSheet.create({
  banner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 8,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
    flex: 1,
  },
  bannerReason: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
  },
  bannerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  keepBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  combineBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  combineBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
  },
  dismissBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mergeEditor: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 8,
  },
  mergeEditorLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  mergeInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
    minHeight: 48,
  },
});

const vagueStyles = StyleSheet.create({
  banner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 8,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
    flex: 1,
  },
  bannerReason: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
  },
  bannerSuggestion: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
  },
  bannerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  keepBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  useBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  dismissBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const nudgeStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 16,
    maxWidth: 400,
    width: '100%',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(204,255,0,0.08)',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    textAlign: 'center',
  },
  actions: {
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  trimBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trimBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
  },
  keepBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  trimCard: {
    borderRadius: 20,
    padding: 20,
    maxWidth: 440,
    width: '100%',
    maxHeight: '85%',
    gap: 14,
  },
  trimHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trimTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  trimSubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  trimScroll: {
    flex: 1,
  },
  trimItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 8,
  },
  trimCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trimItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  trimConfirmBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trimConfirmText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
  },
});
