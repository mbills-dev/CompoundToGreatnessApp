import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
  Modal,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  Easing,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Check, Zap, ChartBar as BarChart2, Dumbbell, Heart, Sparkles, Pencil, Plus, X, Lock } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WhenPickerModal, { WhenPickerValue } from '../WhenPickerModal';
import { FlowGoal, LockedGoal, AnchoredInput, BodyCompStackInput } from './types';
import styles from './styles';
import KeyboardStepWrapper, { KEYBOARD_DONE_ACCESSORY_ID, KeyboardStepWrapperRef } from './KeyboardStepWrapper';
import { useInputSpecificity, SpecificityNudgeBanner } from './InputValidation';

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
  onDone: (dailyInput: string, when: string, where: string, schedule: WhenPickerValue | null, wasFlaggedNonSpecific: boolean) => void;
}) {
  const { colors, isDark } = useTheme();
  const [what, setWhat] = useState(dailyInput);
  const [editingWhat, setEditingWhat] = useState(false);
  const specificity = useInputSpecificity();

  const [whenPickerOpen, setWhenPickerOpen] = useState(false);
  const [whenValue, setWhenValue] = useState<WhenPickerValue | null>(null);
  const [where, setWhere] = useState('');
  const scrollRef = useRef<KeyboardStepWrapperRef>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedScrollToEnd = useCallback(() => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 160);
  }, []);

  const canCommit = whenValue !== null && where.trim().length > 0;

  const handleEditDone = () => {
    setEditingWhat(false);
    if (what.trim() !== dailyInput.trim()) {
      specificity.validate(what);
    } else {
      specificity.dismiss();
    }
  };

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
    <KeyboardStepWrapper ref={scrollRef} contentContainerStyle={styles.decodeScroll}>
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
            blurOnSubmit={true}
            inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
            onSubmitEditing={handleEditDone}
          />
          <TouchableOpacity
            style={[
              styles.customConfirmBtn,
              { backgroundColor: colors.primary },
            ]}
            onPress={handleEditDone}
          >
            <Check size={16} color="#000" strokeWidth={3} />
          </TouchableOpacity>
        </View>
      )}
      {specificity.result && !editingWhat && (
        <SpecificityNudgeBanner
          result={specificity.result}
          onAcceptExample={(ex) => { setWhat(ex); specificity.dismiss(); }}
          onDismiss={specificity.dismiss}
        />
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
        onChangeText={(t) => { setWhere(t); debouncedScrollToEnd(); }}
        placeholder="e.g. my home office desk"
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="sentences"
        inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
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
            what.trim(),
            whenValue ? formatWhen(whenValue) : '',
            where.trim(),
            whenValue,
            !!specificity.result,
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
    </KeyboardStepWrapper>
  );
}

// ─── AddInputScreen ───────────────────────────────────────────────────────────

export function AddInputScreen({
  goal,
  onDone,
  onCancel,
  prefillText,
}: {
  goal: FlowGoal;
  onDone: (dailyInput: string, wasFlaggedNonSpecific: boolean) => void;
  onCancel: () => void;
  prefillText?: string;
}) {
  const { colors, isDark } = useTheme();
  const [text, setText] = useState(prefillText ?? '');
  const specificity = useInputSpecificity();
  const [awaitingRefiner, setAwaitingRefiner] = useState(false);

  const canCommit = text.trim().length > 0;

  const handleSubmit = async () => {
    if (!canCommit) return;
    const result = await specificity.validate(text);
    if (result && !result.specific) {
      setAwaitingRefiner(true);
      return;
    }
    onDone(text.trim(), false);
  };

  const handleAcceptRefinement = (refined: string) => {
    setText(refined);
    specificity.dismiss();
    onDone(refined, true);
  };

  const handleKeepAsIs = () => {
    specificity.dismiss();
    onDone(text.trim(), true);
  };

  return (
    <KeyboardStepWrapper contentContainerStyle={styles.decodeScroll}>
      <Text style={[styles.fieldLabel, { color: colors.primary }]}>WHAT</Text>
      <Text style={[goalPlanStyles.support, { marginBottom: 16, marginTop: 4 }]}>
        What daily action will move you toward this goal?
      </Text>
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
        onChangeText={(t) => { setText(t); if (awaitingRefiner) setAwaitingRefiner(false); }}
        placeholder={`e.g. 10,000 steps`}
        placeholderTextColor={colors.textTertiary}
        multiline
        returnKeyType="done"
        blurOnSubmit={true}
        autoCapitalize="sentences"
        autoFocus
        inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
        onBlur={() => { if (!awaitingRefiner) specificity.validate(text); }}
      />

      {specificity.result && (
        <SpecificityNudgeBanner
          result={specificity.result}
          onAcceptExample={handleAcceptRefinement}
          onDismiss={handleKeepAsIs}
        />
      )}

      {!specificity.result && (
        <TouchableOpacity
          style={[
            styles.revealBtn,
            {
              backgroundColor: canCommit ? colors.primary : colors.border,
              opacity: canCommit ? 1 : 0.45,
              marginTop: 28,
            },
          ]}
          onPress={handleSubmit}
          disabled={!canCommit || specificity.checking}
          activeOpacity={0.85}
        >
          <Check size={18} color={canCommit ? '#000' : colors.textTertiary} strokeWidth={3} />
          <Text style={[styles.revealBtnText, { color: canCommit ? '#000' : colors.textTertiary }]}>
            {specificity.checking ? 'Checking...' : 'Add this input'}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.standardsSkipBtn}
        onPress={onCancel}
        activeOpacity={0.7}
      >
        <Text style={[styles.standardsSkipText, { color: colors.textTertiary }]}>
          Cancel
        </Text>
      </TouchableOpacity>
    </KeyboardStepWrapper>
  );
}

// ─── GoalPlanInput (universal) ────────────────────────────────────────────────

export interface GoalPlanInput {
  id: string;
  title: string;
  target: string;
  selected: boolean;
  editable: boolean;
  category?: string;
  optional?: boolean;
  configured?: boolean;
  removable?: boolean;
}

export type OptionalAdditionType = 'nutrition_rule' | 'hydration' | 'bedtime';

export interface OptionalAddition {
  type: OptionalAdditionType;
  label: string;
}

// ─── GoalPlanScreen (universal goal finalization) ────────────────────────────

export function GoalPlanScreen({
  n,
  total,
  goalLabel,
  inputs,
  optionalAdditions,
  onToggleInput,
  onEditInputDetail,
  onAddInput,
  onConfigureOptional,
  onRemoveInput,
  onLock,
}: {
  n: number;
  total: number;
  goalLabel: string;
  inputs: GoalPlanInput[];
  optionalAdditions: OptionalAddition[];
  onToggleInput: (id: string) => void;
  onEditInputDetail: (id: string, detail: string) => void;
  onAddInput: () => void;
  onConfigureOptional: (type: OptionalAdditionType, existingId?: string, existingValue?: string) => void;
  onRemoveInput: (id: string) => void;
  onLock: () => void;
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const fade = useSharedValue(0);
  const lockScale = useSharedValue(1);
  const lockLabelOpacity = useSharedValue(1);
  const lockedBadgeOpacity = useSharedValue(0);
  const lockedBadgeScale = useSharedValue(0.5);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    fade.value = withTiming(1, { duration: 500 });
  }, []);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const lockCtaStyle = useAnimatedStyle(() => ({
    opacity: lockLabelOpacity.value,
    transform: [{ scale: lockScale.value }],
  }));

  const lockedBadgeStyle = useAnimatedStyle(() => ({
    opacity: lockedBadgeOpacity.value,
    transform: [{ scale: lockedBadgeScale.value }],
  }));

  const selectedInputs = inputs.filter(i => i.selected);
  const canAddMore = selectedInputs.length < 5;
  const canLock = selectedInputs.length > 0;

  const handleLock = () => {
    if (!canLock || isLocked) return;
    setIsLocked(true);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    lockLabelOpacity.value = withTiming(0, { duration: 150 });
    lockScale.value = withTiming(0.9, { duration: 150 });

    lockedBadgeOpacity.value = withDelay(100, withTiming(1, { duration: 300 }));
    lockedBadgeScale.value = withSequence(
      withTiming(0.01, { duration: 1 }),
      withTiming(1.15, { duration: 300, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
      withTiming(1, { duration: 200 }),
    );

    setTimeout(() => onLock(), 900);
  };

  const renderInputCard = (inp: GoalPlanInput, idx: number) => (
    <GoalPlanInputCard
      key={inp.id}
      index={idx + 1}
      input={inp}
      colors={colors}
      isDark={isDark ?? true}
      onToggle={() => onToggleInput(inp.id)}
      onEditDetail={(detail) => onEditInputDetail(inp.id, detail)}
      onRemove={() => onRemoveInput(inp.id)}
      onEditOptional={(value) => {
        const cat = inp.category as OptionalAdditionType | undefined;
        if (cat) onConfigureOptional(cat, inp.id, value);
      }}
    />
  );

  return (
    <View style={[goalPlanStyles.container, { backgroundColor: isDark ? '#0A0A0A' : '#FAFAFA', paddingTop: insets.top }]}>
      <Animated.View style={[fadeStyle, { flex: 1 }]}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 120 }}>
          {/* Eyebrow with goal count */}
          <View style={goalPlanStyles.eyebrowRow}>
            <Text style={goalPlanStyles.eyebrow}>GOAL {n} OF {total}</Text>
            <View style={goalPlanStyles.progressDots}>
              {Array.from({ length: total }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    goalPlanStyles.progressDot,
                    i < n && { backgroundColor: '#CCFF00' },
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Headline */}
          <Text style={goalPlanStyles.headline}>
            <Text style={goalPlanStyles.headlineWhite}>YOUR PLAN FOR{'\n'}</Text>
            <Text style={goalPlanStyles.headlineGoal}>{goalLabel.toUpperCase()}.</Text>
          </Text>

          {/* Support */}
          <Text style={goalPlanStyles.support}>
            These are the daily inputs designed to move you toward this goal.
          </Text>

          {/* Core input cards — only actual inputs, no empty slots */}
          <View style={goalPlanStyles.inputList}>
            {inputs.map(renderInputCard)}
          </View>

          {/* Add another daily input */}
          {canAddMore && (
            <TouchableOpacity
              style={goalPlanStyles.addBtn}
              onPress={onAddInput}
              activeOpacity={0.7}
            >
              <Plus size={16} color={colors.textTertiary} strokeWidth={2} />
              <Text style={goalPlanStyles.addBtnText}>Add another daily input</Text>
            </TouchableOpacity>
          )}

          {/* Optional additions — rendered as add-action rows, not cards */}
          {optionalAdditions.length > 0 && (
            <View style={goalPlanStyles.optionalSection}>
              <Text style={goalPlanStyles.optionalTitle}>OPTIONAL ADDITIONS</Text>
              <Text style={goalPlanStyles.optionalSub}>Add only what you're ready to own every day.</Text>
              {optionalAdditions.map((add) => (
                <TouchableOpacity
                  key={add.type}
                  style={goalPlanStyles.optionalAddRow}
                  onPress={() => onConfigureOptional(add.type)}
                  activeOpacity={0.7}
                >
                  <Plus size={16} color={colors.textTertiary} strokeWidth={2} />
                  <Text style={goalPlanStyles.optionalAddText}>{add.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!isLocked && total > n && (
            <Text style={goalPlanStyles.moreHint}>{total - n} more goal{total - n > 1 ? 's' : ''} to go</Text>
          )}
        </ScrollView>
      </Animated.View>

      {/* Footer with lock CTA / confirmation */}
      <View style={[goalPlanStyles.footer, { paddingBottom: insets.bottom + 24 }]}>
        {!isLocked ? (
          <TouchableOpacity
            style={[goalPlanStyles.lockCta, !canLock && { opacity: 0.4 }]}
            onPress={handleLock}
            disabled={!canLock}
            activeOpacity={0.85}
          >
            <Animated.View style={[lockCtaStyle, goalPlanStyles.lockCtaInner]}>
              <Lock size={18} color="#000" strokeWidth={2.5} />
              <Text style={goalPlanStyles.lockCtaText}>LOCK IN THIS GOAL</Text>
              <ArrowRight size={20} color="#000" strokeWidth={3} />
            </Animated.View>
          </TouchableOpacity>
        ) : (
          <Animated.View style={[goalPlanStyles.lockedBadge, lockedBadgeStyle]}>
            <Zap size={18} color="#000" strokeWidth={2.5} fill="#000" />
            <Text style={goalPlanStyles.lockedBadgeText}>GOAL {n} LOCKED</Text>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

function GoalPlanInputCard({
  index,
  input,
  colors,
  isDark,
  onToggle,
  onEditDetail,
  onRemove,
  onEditOptional,
}: {
  index: number;
  input: GoalPlanInput;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
  onToggle: () => void;
  onEditDetail: (detail: string) => void;
  onRemove?: () => void;
  onEditOptional?: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [targetDraft, setTargetDraft] = useState(input.target);
  const [titleDraft, setTitleDraft] = useState(input.title);

  const handleDoneEdit = () => {
    setEditing(false);
    if (input.category === 'custom') {
      if (titleDraft.trim() !== input.title) {
        onEditDetail(titleDraft.trim());
      }
    } else if (targetDraft.trim() !== input.target) {
      onEditDetail(targetDraft.trim());
    }
  };

  const cardBg = isDark ? '#0F0F0F' : '#F5F5F5';
  const cardBorder = input.selected
    ? (isDark ? '#1F1F1F' : '#E0E0E0')
    : (isDark ? '#161616' : '#ECECEC');
  const lime = '#CCFF00';
  const isOptionalConfigured = input.optional && input.configured;
  const isCustom = input.category === 'custom';

  const handleEditTap = () => {
    if (isOptionalConfigured && onEditOptional) {
      onEditOptional(input.target);
    } else if (input.editable) {
      if (isCustom) {
        setTitleDraft(input.title);
      } else {
        setTargetDraft(input.target);
      }
      setEditing(true);
    }
  };

  return (
    <View style={[goalPlanStyles.inputCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={goalPlanStyles.inputCardRow}>
        <Text style={goalPlanStyles.inputNumber}>{String(index).padStart(2, '0')}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          {isCustom && editing ? (
            <View style={goalPlanStyles.editRow}>
              <TextInput
                style={[goalPlanStyles.editInput, { color: isDark ? '#FFF' : '#000', borderColor: lime + '80', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
                value={titleDraft}
                onChangeText={setTitleDraft}
                autoFocus
                returnKeyType="done"
                blurOnSubmit={true}
                onSubmitEditing={handleDoneEdit}
              />
              <TouchableOpacity style={[goalPlanStyles.editConfirm, { backgroundColor: lime }]} onPress={handleDoneEdit}>
                <Check size={14} color="#000" strokeWidth={3} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text
                style={[
                  goalPlanStyles.inputTitle,
                  { color: input.selected ? (isDark ? '#FFF' : '#000') : (isDark ? '#555' : '#999') },
                ]}
                numberOfLines={2}
              >
                {input.title}
              </Text>
              {input.selected && input.target ? (
                input.editable && editing && !isOptionalConfigured ? (
                  <View style={goalPlanStyles.editRow}>
                    <TextInput
                      style={[goalPlanStyles.editInput, { color: isDark ? '#FFF' : '#000', borderColor: lime + '80', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
                      value={targetDraft}
                      onChangeText={setTargetDraft}
                      autoFocus
                      returnKeyType="done"
                      blurOnSubmit={true}
                      onSubmitEditing={handleDoneEdit}
                    />
                    <TouchableOpacity style={[goalPlanStyles.editConfirm, { backgroundColor: lime }]} onPress={handleDoneEdit}>
                      <Check size={14} color="#000" strokeWidth={3} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={goalPlanStyles.targetRow}>
                    <Text style={goalPlanStyles.targetText}>
                      {input.target}
                    </Text>
                    {(input.editable || isOptionalConfigured) && (
                      <TouchableOpacity onPress={handleEditTap} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Pencil size={12} color={isDark ? '#555' : '#999'} strokeWidth={2} />
                      </TouchableOpacity>
                    )}
                  </View>
                )
              ) : null}
              {isCustom && input.editable && !editing && (
                <TouchableOpacity onPress={handleEditTap} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginTop: 2 }}>
                  <Pencil size={12} color={isDark ? '#555' : '#999'} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
        <TouchableOpacity onPress={onToggle} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <View style={[
            goalPlanStyles.inputCheckbox,
            {
              borderColor: input.selected ? lime : (isDark ? '#333' : '#CCC'),
              backgroundColor: input.selected ? lime : 'transparent',
            },
          ]}>
            {input.selected && <Check size={12} color="#000" strokeWidth={3} />}
          </View>
        </TouchableOpacity>
      </View>
      {/* Remove affordance for configured optional or custom inputs */}
      {(isOptionalConfigured || input.removable) && onRemove && (
        <TouchableOpacity style={goalPlanStyles.removeRow} onPress={onRemove} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={goalPlanStyles.removeText}>Remove</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── OptionalAdditionSheet (bottom sheet for nutrition / hydration / bedtime) ──

export function OptionalAdditionSheet({
  visible,
  type,
  initialValue,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  type: OptionalAdditionType | null;
  initialValue?: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const backdropOpacity = useSharedValue(0);
  const sheetTranslate = useSharedValue(400);

  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [hour, setHour] = useState(10);
  const [minute, setMinute] = useState(0);
  const [period, setPeriod] = useState<'AM' | 'PM'>('PM');

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 250 });
      sheetTranslate.value = withTiming(0, { duration: 250 });
      setCustomMode(false);
      setCustomText('');
      setSelectedPreset('');
      if (initialValue) {
        if (type === 'bedtime') {
          const m = initialValue.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
          if (m) {
            setHour(parseInt(m[1], 10));
            setMinute(parseInt(m[2], 10));
            setPeriod(m[3].toUpperCase() as 'AM' | 'PM');
          }
        } else {
          setSelectedPreset(initialValue);
          setCustomText(initialValue);
        }
      } else if (type === 'bedtime') {
        setHour(10); setMinute(0); setPeriod('PM');
      }
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      sheetTranslate.value = withTiming(400, { duration: 250 });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetTranslate.value }] }));

  if (!visible || !type) return null;

  const presets: Record<OptionalAdditionType, string[]> = {
    nutrition_rule: ['No added sugar', 'Whole foods only', 'No food after 8 PM'],
    hydration: ['64 oz water', '80 oz water', '100 oz water', '120 oz water'],
    bedtime: [],
  };

  const titles: Record<OptionalAdditionType, string> = {
    nutrition_rule: 'ADD A NUTRITION RULE',
    hydration: 'ADD A HYDRATION TARGET',
    bedtime: 'SET YOUR BEDTIME',
  };

  const supports: Record<OptionalAdditionType, string> = {
    nutrition_rule: 'Choose one simple rule you can own every day.',
    hydration: 'How much water will you drink each day?',
    bedtime: 'What time will you be in bed each night?',
  };

  const handleConfirm = () => {
    let value = '';
    if (type === 'bedtime') {
      value = `${hour}:${String(minute).padStart(2, '0')} ${period}`;
    } else if (customMode) {
      value = customText.trim();
    } else {
      value = selectedPreset;
    }
    if (!value) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onConfirm(value);
  };

  const canConfirm = type === 'bedtime' || (customMode ? customText.trim().length > 0 : selectedPreset.length > 0);

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <View style={optSheetStyles.wrapper}>
        <Animated.View style={[optSheetStyles.backdrop, backdropStyle]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[optSheetStyles.sheet, sheetStyle, { backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF', paddingBottom: insets.bottom + 20 }]}>
          <View style={optSheetStyles.handle}>
            <View style={[optSheetStyles.handleBar, { backgroundColor: isDark ? colors.border : '#D0D0D0' }]} />
          </View>
          <View style={optSheetStyles.headerRow}>
            <Text style={[optSheetStyles.title, { color: colors.text }]}>{titles[type]}</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={optSheetStyles.closeBtn}>
              <X size={20} color={colors.textTertiary} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
          <Text style={[optSheetStyles.support, { color: colors.textTertiary }]}>{supports[type]}</Text>

          {type === 'bedtime' ? (
            <View style={optSheetStyles.bedtimeRow}>
              {[10, 11, 12, 1, 2].map(h => (
                <TouchableOpacity
                  key={h}
                  style={[optSheetStyles.timePill, { backgroundColor: hour === h ? colors.primary : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'), borderColor: hour === h ? colors.primary : 'transparent' }]}
                  onPress={() => setHour(h)}
                  activeOpacity={0.8}
                >
                  <Text style={[optSheetStyles.timePillText, { color: hour === h ? '#000' : colors.textSecondary, fontWeight: hour === h ? '800' : '600' }]}>{h}</Text>
                </TouchableOpacity>
              ))}
              <View style={optSheetStyles.minSec}>
                {[0, 15, 30, 45].map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[optSheetStyles.timePill, { backgroundColor: minute === m ? colors.primary : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'), borderColor: minute === m ? colors.primary : 'transparent' }]}
                    onPress={() => setMinute(m)}
                    activeOpacity={0.8}
                  >
                    <Text style={[optSheetStyles.timePillText, { color: minute === m ? '#000' : colors.textSecondary, fontWeight: minute === m ? '800' : '600' }]}>{String(m).padStart(2, '0')}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={optSheetStyles.periodCol}>
                {(['AM', 'PM'] as const).map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[optSheetStyles.timePill, { backgroundColor: period === p ? colors.primary : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'), borderColor: period === p ? colors.primary : 'transparent' }]}
                    onPress={() => setPeriod(p)}
                    activeOpacity={0.8}
                  >
                    <Text style={[optSheetStyles.timePillText, { color: period === p ? '#000' : colors.textSecondary, fontWeight: period === p ? '800' : '600' }]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {presets[type].map(preset => (
                <TouchableOpacity
                  key={preset}
                  style={[optSheetStyles.presetRow, {
                    backgroundColor: selectedPreset === preset && !customMode
                      ? (isDark ? 'rgba(204,255,0,0.08)' : 'rgba(204,255,0,0.10)')
                      : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                    borderColor: selectedPreset === preset && !customMode ? colors.primary + '60' : 'transparent',
                  }]}
                  onPress={() => { setSelectedPreset(preset); setCustomMode(false); }}
                  activeOpacity={0.8}
                >
                  <Text style={[optSheetStyles.presetText, { color: selectedPreset === preset && !customMode ? colors.primary : colors.text }]}>
                    {preset}
                  </Text>
                  {selectedPreset === preset && !customMode && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
                </TouchableOpacity>
              ))}
              {customMode ? (
                <View style={optSheetStyles.customRow}>
                  <TextInput
                    style={[optSheetStyles.customInput, { color: colors.text, borderColor: colors.primary + '80', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
                    value={customText}
                    onChangeText={setCustomText}
                    autoFocus
                    placeholder="Type your rule..."
                    placeholderTextColor={colors.textTertiary}
                    returnKeyType="done"
                    blurOnSubmit={true}
                    onSubmitEditing={handleConfirm}
                  />
                </View>
              ) : (
                <TouchableOpacity style={optSheetStyles.writeOwnBtn} onPress={() => { setCustomMode(true); setCustomText(selectedPreset); }} activeOpacity={0.7}>
                  <Text style={[optSheetStyles.writeOwnText, { color: colors.textSecondary }]}>Write my own →</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[optSheetStyles.confirmBtn, { backgroundColor: canConfirm ? colors.primary : (isDark ? '#222' : '#DDD') }]}
            onPress={handleConfirm}
            disabled={!canConfirm}
            activeOpacity={0.85}
          >
            <Text style={optSheetStyles.confirmBtnText}>Confirm</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const optSheetStyles = StyleSheet.create({
  wrapper: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    maxHeight: '90%',
  },
  handle: { alignItems: 'center', paddingVertical: 10 },
  handleBar: { width: 40, height: 4, borderRadius: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  support: { fontSize: 14, fontWeight: '500', marginBottom: 16, lineHeight: 20 },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  presetText: { fontSize: 15, fontWeight: '600' },
  customRow: { marginTop: 8 },
  customInput: {
    fontSize: 15,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  writeOwnBtn: { paddingVertical: 14, paddingHorizontal: 4, marginTop: 4 },
  writeOwnText: { fontSize: 15, fontWeight: '700' },
  bedtimeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 16 },
  minSec: { flexDirection: 'row', gap: 8 },
  periodCol: { flexDirection: 'row', gap: 8 },
  timePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  timePillText: { fontSize: 15 },
  confirmBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 16,
  },
  confirmBtnText: { fontSize: 17, fontWeight: '800', color: '#000' },
});

// ─── GoalPlanScreen styles below ─────────────────────────────────────────────

const goalPlanStyles = StyleSheet.create({
  container: { flex: 1 },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#555',
  },
  progressDots: {
    flexDirection: 'row',
    gap: 4,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#222',
  },
  headline: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 42,
    marginTop: 6,
  },
  headlineWhite: { color: '#FFFFFF' },
  headlineGoal: { color: '#CCFF00' },
  support: {
    fontSize: 15,
    fontWeight: '500',
    color: '#777',
    marginTop: 12,
    lineHeight: 22,
    marginBottom: 24,
  },
  inputList: {
    gap: 10,
  },
  inputCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  inputCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputNumber: {
    fontSize: 11,
    fontWeight: '800',
    color: '#444',
    minWidth: 18,
  },
  inputTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  targetText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#CCFF00',
  },
  inputCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionalSection: {
    marginTop: 24,
  },
  optionalTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#555',
    marginBottom: 4,
  },
  optionalSub: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  optionalAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#2A2A2A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  optionalAddText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  removeRow: {
    alignSelf: 'flex-end',
    marginTop: 6,
    marginRight: 4,
  },
  removeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
    textDecorationLine: 'underline',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#333',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  editInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  editConfirm: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  moreHint: {
    fontSize: 13,
    fontWeight: '500',
    color: '#555',
    textAlign: 'center',
    marginTop: 20,
  },
  footer: {
    paddingHorizontal: 28,
  },
  lockCta: {
    borderRadius: 16,
    backgroundColor: '#CCFF00',
    overflow: 'hidden',
  },
  lockCtaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  lockCtaText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 0.3,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(204,255,0,0.15)',
    borderWidth: 1.5,
    borderColor: '#CCFF00',
  },
  lockedBadgeText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#CCFF00',
    letterSpacing: 0.3,
  },
});

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
