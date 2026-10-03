import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const LIME = '#CCFF00';

interface ProofCaptionProps {
  /** Assigned Success Stack input name; null/undefined shows "General progress". */
  assignment: string | null | undefined;
  note?: string | null;
  /** Zero-based index of the displayed proof; `X / N` shows only when total > 1. */
  index: number;
  total: number;
}

/**
 * The proof caption pinned to the bottom of an immersive canvas:
 * `X / N`, lime rule, assignment, optional note. Non-interactive, so swipes
 * that start on it still reach the pager underneath.
 */
export default function ProofCaption({ assignment, note, index, total }: ProofCaptionProps) {
  return (
    <View style={styles.caption} pointerEvents="none">
      {total > 1 && (
        <Text style={styles.position}>
          {index + 1} / {total}
        </Text>
      )}
      <View style={styles.rule} />
      <Text style={styles.assignment} numberOfLines={2}>
        {assignment ?? 'General progress'}
      </Text>
      {!!note && (
        <Text style={styles.note} numberOfLines={3}>
          {note}
        </Text>
      )}
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
  note: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'Inter-Regular',
  },
});
