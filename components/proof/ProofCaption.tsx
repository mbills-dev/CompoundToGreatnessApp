import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';

const LIME = '#CCFF00';

interface ProofCaptionProps {
  /** Assigned Success Stack input name; null/undefined shows "General progress". */
  assignment: string | null | undefined;
  note?: string | null;
  /**
   * Zero-based index of the displayed proof; `X / N` shows only when
   * total > 1. Omit both when the screen shows its position elsewhere.
   */
  index?: number;
  total?: number;
  /** Optional content above the lime rule (e.g. Journey's DAY X / 77 + date). */
  leading?: React.ReactNode;
  /** Position overrides (e.g. a larger bottom offset over the safe area). */
  style?: StyleProp<ViewStyle>;
  /** Muted text before the assignment, e.g. "DAY 1 · ". */
  assignmentPrefix?: string;
  /** Inline element after the assignment, e.g. a chevron for an editable caption. */
  trailing?: React.ReactNode;
  /** Makes the whole caption a button (editing screens). Omit for read-only. */
  onPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * The proof caption pinned to the bottom of an immersive canvas:
 * `X / N`, lime rule, assignment, optional note. Read-only by default and
 * non-interactive, so swipes that start on it still reach the pager
 * underneath; with `onPress` it becomes a button (editing screens).
 */
export default function ProofCaption({
  assignment,
  note,
  index = 0,
  total = 0,
  leading,
  style,
  assignmentPrefix,
  trailing,
  onPress,
  accessibilityLabel,
}: ProofCaptionProps) {
  const assignmentText = (
    <Text style={[styles.assignment, trailing ? styles.assignmentInRow : null]} numberOfLines={2}>
      {assignmentPrefix ? <Text style={styles.prefix}>{assignmentPrefix}</Text> : null}
      {assignment ?? 'General progress'}
    </Text>
  );
  const content = (
    <>
      {total > 1 && (
        <Text style={styles.position}>
          {index + 1} / {total}
        </Text>
      )}
      {leading}
      <View style={styles.rule} />
      {trailing ? (
        <View style={styles.assignmentRow}>
          {assignmentText}
          {trailing}
        </View>
      ) : (
        assignmentText
      )}
      {!!note && (
        <Text style={styles.note} numberOfLines={3}>
          {note}
        </Text>
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.caption, style]}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {content}
      </TouchableOpacity>
    );
  }
  return (
    <View style={[styles.caption, style]} pointerEvents="none">
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  caption: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
  },
  position: {
    alignSelf: 'center',
    marginBottom: 16,
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 1,
    fontFamily: 'Inter-Bold',
    fontVariant: ['tabular-nums'],
  },
  rule: {
    width: 36,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: LIME,
    marginBottom: 12,
  },
  assignment: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assignmentInRow: {
    flexShrink: 1,
  },
  prefix: {
    color: 'rgba(255,255,255,0.6)',
  },
  note: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'Inter-Regular',
  },
});
