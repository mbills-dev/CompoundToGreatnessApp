import React, { useState, useEffect, useRef } from 'react';
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
import { Pencil, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { LockedGoal, FlowGoal } from './types';
import styles from './styles';

// ─── Identity helpers ─────────────────────────────────────────────────────────

export type IdentityShape =
  | { kind: 'sentence'; text: string }
  | { kind: 'stacked'; finishLine: string };

function applyBecomeTransform(text: string): string | null {
  const lower = text.trim().toLowerCase();
  if (lower.startsWith('become ')) {
    const rest = text.trim().slice('become '.length).trim();
    return `I am ${rest}.`;
  }
  return null;
}

export function deriveIdentityLine(lock: LockedGoal): IdentityShape {
  const refined = lock.doneLooksText?.trim();

  switch (lock.decodePath) {
    case 'numbers': {
      const target = lock.resolvedTargetStr ?? lock.goalLabel;
      const suffix = lock.periodSuffix ?? 'month';
      return { kind: 'sentence', text: `I earn ${target} a ${suffix} consistently.` };
    }
    case 'practice': {
      if (refined) {
        const transformed = applyBecomeTransform(refined);
        if (transformed) return { kind: 'sentence', text: transformed };
        return { kind: 'stacked', finishLine: refined };
      }
      return { kind: 'stacked', finishLine: lock.goalLabel };
    }
    case 'starting': {
      if (lock.isStandard) {
        const action = lock.dailyInput.replace(/\.$/, '').trim();
        return { kind: 'sentence', text: `I never miss "${action}".` };
      }
      if (refined) {
        const transformed = applyBecomeTransform(refined);
        if (transformed) return { kind: 'sentence', text: transformed };
        return { kind: 'stacked', finishLine: refined };
      }
      return { kind: 'stacked', finishLine: lock.goalLabel };
    }
  }
}

export function identityShapeToString(shape: IdentityShape): string {
  if (shape.kind === 'sentence') return shape.text;
  return shape.finishLine;
}

// ─── IdentityLineEditor ───────────────────────────────────────────────────────

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
        returnKeyType="done"
        blurOnSubmit={true}
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

// ─── IdentityScreen ───────────────────────────────────────────────────────────

export function IdentityScreen({
  goals,
  locked,
  identityOverrides,
  aiStatements,
  onOverrideChange,
  onAccept,
}: {
  goals: FlowGoal[];
  locked: LockedGoal[];
  identityOverrides: Record<number, string>;
  aiStatements: Record<number, string>;
  onOverrideChange: (goalId: number, text: string) => void;
  onAccept: (resolved: Record<number, string>) => void;
}) {
  const { colors, isDark } = useTheme();
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500 });
  }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);

  const aiSnapshot = useRef(aiStatements);
  // Intentionally no effect — aiSnapshot is captured once at mount and
  // must never update while this screen is visible. If AI statements
  // arrive after the user is already viewing this screen, they must not
  // see cards change under them.

  const lockedEntries = goals.map(g => {
    const lock = locked.find(l => l.goalId === g.id);
    if (!lock) return null;
    return { goalId: g.id, lock };
  }).filter(Boolean) as Array<{ goalId: number; lock: LockedGoal }>;

  const resolveShape = (goalId: number, lock: LockedGoal): IdentityShape => {
    const override = identityOverrides[goalId];
    if (override !== undefined) {
      return { kind: 'sentence', text: override };
    }
    const ai = aiSnapshot.current[goalId];
    if (ai !== undefined) {
      return { kind: 'sentence', text: ai };
    }
    return deriveIdentityLine(lock);
  };

  const editInitial = (goalId: number, lock: LockedGoal): string => {
    const override = identityOverrides[goalId];
    if (override !== undefined) return override;
    const base = deriveIdentityLine(lock);
    if (base.kind === 'stacked') {
      return base.finishLine;
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
                      <Text style={[styles.identityLine, { color: colors.primary, fontStyle: 'italic', flex: 1 }]}>
                        "{shape.finishLine}"
                      </Text>
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
          onPress={() => {
            const resolved: Record<number, string> = {};
            lockedEntries.forEach(({ goalId, lock }) => {
              const shape = resolveShape(goalId, lock);
              resolved[goalId] = shape.kind === 'sentence' ? shape.text : shape.finishLine;
            });
            onAccept(resolved);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>I Accept My Identity →</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}
