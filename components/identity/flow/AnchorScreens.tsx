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
  withTiming,
  withSpring,
  withDelay,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Check, Zap, ChartBar as BarChart2, Dumbbell, Heart, Sparkles, Pencil } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import WhenPickerModal, { WhenPickerValue } from '../WhenPickerModal';
import { FlowGoal, LockedGoal, AnchoredInput } from './types';
import styles from './styles';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatGoalLabel(
  goal: FlowGoal,
  goalLabelOverrides: Record<number, string>,
): string {
  return goalLabelOverrides[goal.id] ?? goal.label;
}

export function displayGoalLabel(lock: LockedGoal): string {
  if (lock.decodePath === 'numbers' && lock.resolvedTargetStr) {
    return lock.goalLabel;
  }
  return lock.doneLooksText?.trim() || lock.goalLabel;
}

// ─── GoalBadge ────────────────────────────────────────────────────────────────

export function GoalBadge({
  goal,
  n,
  resolvedLabel,
}: {
  goal: FlowGoal;
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

// ─── AnchorScreen ─────────────────────────────────────────────────────────────

export function AnchorScreen({
  goal,
  dailyInput,
  isStandard,
  onDone,
}: {
  goal: FlowGoal;
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

// ─── AddInputScreen ───────────────────────────────────────────────────────────

export function AddInputScreen({
  goal,
  onDone,
  onCancel,
}: {
  goal: FlowGoal;
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

// ─── GoalLockedScreen ─────────────────────────────────────────────────────────

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
  goal: FlowGoal;
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
