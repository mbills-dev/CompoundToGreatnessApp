import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlowGoal } from './types';

export interface FocusGoal {
  id: number;
  label: string;
}

// ─── Screen 1: Focus Philosophy ───────────────────────────────────────────────

export function FocusPhilosophyScreen({
  goalCount,
  onNext,
  onBack,
}: {
  goalCount: number;
  onNext: () => void;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const fade = useSharedValue(0);
  useEffect(() => { fade.value = withTiming(1, { duration: 600 }); }, []);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <View style={[fpStyles.container, { backgroundColor: '#0A0A0A', paddingTop: insets.top }]}>
      <View style={fpStyles.header}>
        <TouchableOpacity onPress={onBack} style={fpStyles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <Animated.View style={[fadeStyle, { flex: 1, paddingHorizontal: 28, justifyContent: 'center' }]}>
        <Text style={fpStyles.eyebrow}>
          77-DAY FOCUS
        </Text>

        <Text style={fpStyles.headline}>
          <Text style={fpStyles.headlineWhite}>FOCUS{'\n'}</Text>
          <Text style={fpStyles.headlineWhite}>MULTIPLIES{'\n'}</Text>
          <Text style={fpStyles.headlineLime}>FORCE.</Text>
        </Text>

        <Text style={fpStyles.body}>
          You only have so much time, energy, and attention.
        </Text>
        <Text style={fpStyles.body}>
          Spread it across everything and you make a little progress everywhere.
        </Text>
        <Text style={fpStyles.body}>
          Concentrate it on what matters most and you create momentum.
        </Text>

        <Text style={fpStyles.standout}>
          Go deeper. Not wider.
        </Text>

        <FocusLinesVisual />
      </Animated.View>

      <View style={[fpStyles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity
          style={fpStyles.cta}
          onPress={onNext}
          activeOpacity={0.85}
        >
          <Text style={fpStyles.ctaText}>Choose my focus</Text>
          <ArrowRight size={20} color="#000" strokeWidth={3} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FocusLinesVisual() {
  const line1X = useSharedValue(-60);
  const line1Opacity = useSharedValue(0.2);
  const line2X = useSharedValue(60);
  const line2Opacity = useSharedValue(0.2);
  const line3X = useSharedValue(-40);
  const line3Opacity = useSharedValue(0.15);
  const line4X = useSharedValue(40);
  const line4Opacity = useSharedValue(0.15);

  useEffect(() => {
    const easing = Easing.bezier(0.22, 1, 0.36, 1);
    line1X.value = withDelay(300, withTiming(0, { duration: 900, easing }));
    line1Opacity.value = withDelay(300, withTiming(0.9, { duration: 900 }));
    line2X.value = withDelay(450, withTiming(0, { duration: 900, easing }));
    line2Opacity.value = withDelay(450, withTiming(0.9, { duration: 900 }));
    line3X.value = withDelay(600, withTiming(0, { duration: 900, easing }));
    line3Opacity.value = withDelay(600, withTiming(0.7, { duration: 900 }));
    line4X.value = withDelay(750, withTiming(0, { duration: 900, easing }));
    line4Opacity.value = withDelay(750, withTiming(0.7, { duration: 900 }));
  }, []);

  const l1 = useAnimatedStyle(() => ({ transform: [{ translateX: line1X.value }], opacity: line1Opacity.value }));
  const l2 = useAnimatedStyle(() => ({ transform: [{ translateX: line2X.value }], opacity: line2Opacity.value }));
  const l3 = useAnimatedStyle(() => ({ transform: [{ translateX: line3X.value }], opacity: line3Opacity.value }));
  const l4 = useAnimatedStyle(() => ({ transform: [{ translateX: line4X.value }], opacity: line4Opacity.value }));

  return (
    <View style={fpStyles.linesContainer}>
      <Animated.View style={[fpStyles.convergedLine, l1]} />
      <Animated.View style={[fpStyles.convergedLine, l2]} />
      <Animated.View style={[fpStyles.convergedLine, l3]} />
      <Animated.View style={[fpStyles.convergedLine, l4]} />
    </View>
  );
}

const fpStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#555',
    marginBottom: 20,
  },
  headline: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 50,
    marginBottom: 28,
  },
  headlineWhite: { color: '#FFFFFF' },
  headlineLime: { color: '#CCFF00' },
  body: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: '#888',
    marginBottom: 8,
  },
  standout: {
    fontSize: 18,
    fontWeight: '800',
    color: '#CCC',
    marginTop: 16,
    marginBottom: 24,
  },
  linesContainer: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  convergedLine: {
    width: 48,
    height: 3,
    backgroundColor: '#CCFF00',
    borderRadius: 2,
  },
  footer: { paddingHorizontal: 28 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: '#CCFF00',
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.2,
  },
});

// ─── Screen 2: Focus Select ───────────────────────────────────────────────────

export function FocusSelectScreen({
  goals,
  goalLabelOverrides,
  initialSelected,
  overrideAcknowledged,
  onConfirm,
  onBack,
}: {
  goals: FlowGoal[];
  goalLabelOverrides: Record<number, string>;
  initialSelected: Set<number>;
  overrideAcknowledged: boolean;
  onConfirm: (selectedIds: Set<number>, overrideAcknowledged: boolean) => void;
  onBack: () => void;
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Set<number>>(initialSelected);
  const [showLimitSheet, setShowLimitSheet] = useState(false);
  const [acknowledged, setAcknowledged] = useState(overrideAcknowledged);
  const fade = useSharedValue(0);
  useEffect(() => { fade.value = withTiming(1, { duration: 500 }); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const resolvedGoals = goals.map(g => ({
    id: g.id,
    label: goalLabelOverrides[g.id] ?? g.label,
  }));

  const selectedCount = selected.size;

  const toggleGoal = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 3 && !acknowledged) {
          setShowLimitSheet(true);
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const handleStayFocused = () => {
    setShowLimitSheet(false);
  };

  const handleAddAnyway = () => {
    setAcknowledged(true);
    setShowLimitSheet(false);
    setSelected(prev => {
      const next = new Set(prev);
      const pendingId = resolvedGoals.find(g => !next.has(g.id))?.id;
      if (pendingId !== undefined) next.add(pendingId);
      return next;
    });
  };

  const ctaDisabled = selectedCount === 0;
  const ctaLabel = selectedCount === 1
    ? 'Build around this goal'
    : 'Build around these goals';

  return (
    <View style={[fsStyles.container, { backgroundColor: '#0A0A0A', paddingTop: insets.top }]}>
      <View style={fsStyles.header}>
        <TouchableOpacity onPress={onBack} style={fsStyles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <Animated.View style={[fadeStyle, { flex: 1 }]}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}>
          <Text style={fsStyles.headline}>
            <Text style={fsStyles.headlineWhite}>WHAT MATTERS{'\n'}</Text>
            <Text style={fsStyles.headlineLime}>MOST RIGHT NOW?</Text>
          </Text>

          <Text style={fsStyles.support}>
            Choose the goals you want to go deep on for the next 77 days.
          </Text>
          <Text style={fsStyles.recommendation}>
            1-3 is the sweet spot.
          </Text>
          <Text style={fsStyles.microcopy}>
            Fewer goals lets you concentrate more energy on each transformation.
          </Text>

          <View style={{ gap: 10, marginTop: 28 }}>
            {resolvedGoals.map((g, i) => {
              const isSelected = selected.has(g.id);
              return (
                <TouchableOpacity
                  key={g.id}
                  style={[
                    fsStyles.goalRow,
                    {
                      backgroundColor: isSelected ? 'rgba(204,255,0,0.08)' : 'rgba(255,255,255,0.03)',
                      borderColor: isSelected ? '#CCFF00' : '#222',
                    },
                  ]}
                  onPress={() => toggleGoal(g.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[fsStyles.goalNumber, { color: isSelected ? '#CCFF00' : '#444' }]}>
                    {String(i + 1).padStart(2, '0')}
                  </Text>
                  <Text style={[fsStyles.goalText, { color: isSelected ? '#FFF' : '#BBB' }]} numberOfLines={3}>
                    {g.label}
                  </Text>
                  {isSelected && (
                    <View style={fsStyles.checkCircle}>
                      <Check size={16} color="#000" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={[fsStyles.countSection, { paddingBottom: insets.bottom + 24 }]}>
          {selectedCount <= 3 ? (
            <Text style={fsStyles.countText}>
              {selectedCount} selected{selectedCount === 3 ? '  -  THE SWEET SPOT' : ''}
            </Text>
          ) : (
            <Text style={fsStyles.countTextOverride}>
              {selectedCount} GOALS SELECTED  -  More goals = less focus.
            </Text>
          )}
          <TouchableOpacity
            style={[fsStyles.cta, { backgroundColor: ctaDisabled ? '#1A1A1A' : '#CCFF00', opacity: ctaDisabled ? 0.5 : 1 }]}
            onPress={() => onConfirm(selected, acknowledged)}
            disabled={ctaDisabled}
            activeOpacity={0.85}
          >
            <Text style={[fsStyles.ctaText, { color: ctaDisabled ? '#555' : '#000' }]}>
              {ctaLabel}
            </Text>
            <ArrowRight size={20} color={ctaDisabled ? '#555' : '#000'} strokeWidth={3} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Modal
        visible={showLimitSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLimitSheet(false)}
      >
        <View style={fsStyles.sheetOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setShowLimitSheet(false)} activeOpacity={1} />
          <View style={[fsStyles.sheetCard, { backgroundColor: isDark ? '#0F0F0F' : '#FFFFFF' }]}>
            <Text style={fsStyles.sheetHeadline}>
              GO DEEPER.{'\n'}NOT WIDER.
            </Text>
            <Text style={fsStyles.sheetBody}>
              You've already chosen 3 transformations.
            </Text>
            <Text style={fsStyles.sheetBody}>
              Every additional goal divides the time, energy, and attention you can give the others.
            </Text>
            <Text style={fsStyles.sheetBody}>
              We recommend staying at 3 or fewer - but this is your Challenge.
            </Text>

            <TouchableOpacity style={fsStyles.sheetPrimaryBtn} onPress={handleStayFocused} activeOpacity={0.85}>
              <Text style={fsStyles.sheetPrimaryText}>Stay focused on 3</Text>
            </TouchableOpacity>
            <TouchableOpacity style={fsStyles.sheetSecondaryBtn} onPress={handleAddAnyway} activeOpacity={0.7}>
              <Text style={fsStyles.sheetSecondaryText}>Add another anyway</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const fsStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headline: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
    marginBottom: 16,
    marginTop: 8,
  },
  headlineWhite: { color: '#FFFFFF' },
  headlineLime: { color: '#CCFF00' },
  support: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: '#888',
    marginBottom: 8,
  },
  recommendation: {
    fontSize: 15,
    fontWeight: '700',
    color: '#CCFF00',
    marginBottom: 4,
  },
  microcopy: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    color: '#555',
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 64,
  },
  goalNumber: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    width: 32,
  },
  goalText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#CCFF00',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  countSection: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 12,
  },
  countText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 0.3,
  },
  countTextOverride: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.3,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  sheetCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 40,
  },
  sheetHeadline: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 34,
    color: '#FFF',
    marginBottom: 16,
  },
  sheetBody: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    color: '#888',
    marginBottom: 6,
  },
  sheetPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: '#CCFF00',
    marginTop: 24,
  },
  sheetPrimaryText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000',
  },
  sheetSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  sheetSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#666',
  },
});

// ─── Screen 3: Focus Confirm ──────────────────────────────────────────────────

export function FocusConfirmScreen({
  selectedGoals,
  savedGoals,
  onNext,
  onBack,
}: {
  selectedGoals: FocusGoal[];
  savedGoals: FocusGoal[];
  onNext: () => void;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [showSaved, setShowSaved] = useState(false);
  const fade = useSharedValue(0);
  useEffect(() => { fade.value = withTiming(1, { duration: 500 }); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const ctaLabel = selectedGoals.length === 1 ? 'Build this goal' : 'Build my first goal';

  return (
    <View style={[fcStyles.container, { backgroundColor: '#0A0A0A', paddingTop: insets.top }]}>
      <View style={fcStyles.header}>
        <TouchableOpacity onPress={onBack} style={fcStyles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <Animated.View style={[fadeStyle, { flex: 1 }]}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 120 }}>
          <Text style={fcStyles.eyebrow}>
            YOUR 77-DAY FOCUS
          </Text>
          <Text style={fcStyles.headline}>
            GO <Text style={fcStyles.headlineLime}>DEEP.</Text>
          </Text>
          <Text style={fcStyles.support}>
            These are the transformations you're focusing on for the next 77 days.
          </Text>

          <View style={{ gap: 12, marginTop: 32 }}>
            {selectedGoals.map((g, i) => (
              <View key={g.id} style={fcStyles.selectedRow}>
                <Text style={fcStyles.selectedNumber}>
                  {String(i + 1).padStart(2, '0')}
                </Text>
                <Text style={fcStyles.selectedText}>{g.label}</Text>
              </View>
            ))}
          </View>

          {savedGoals.length > 0 && (
            <View style={{ marginTop: 36 }}>
              <TouchableOpacity
                style={fcStyles.savedRow}
                onPress={() => setShowSaved(prev => !prev)}
                activeOpacity={0.7}
              >
                <Text style={fcStyles.savedText}>
                  {savedGoals.length} other {savedGoals.length === 1 ? 'goal' : 'goals'} saved for later
                </Text>
                {showSaved ? <ChevronUp size={18} color="#666" strokeWidth={2.5} /> : <ChevronDown size={18} color="#666" strokeWidth={2.5} />}
              </TouchableOpacity>

              {showSaved && (
                <View style={{ gap: 8, marginTop: 12, paddingHorizontal: 4 }}>
                  {savedGoals.map((g, i) => (
                    <Text key={g.id} style={fcStyles.savedGoalText}>
                      {g.label}
                    </Text>
                  ))}
                </View>
              )}

              <Text style={fcStyles.savedMicrocopy}>
                Nothing is lost. They'll be waiting when you're ready for what's next.
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={[fcStyles.footer, { paddingBottom: insets.bottom + 24 }]}>
          <TouchableOpacity style={fcStyles.cta} onPress={onNext} activeOpacity={0.85}>
            <Text style={fcStyles.ctaText}>{ctaLabel}</Text>
            <ArrowRight size={20} color="#000" strokeWidth={3} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const fcStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#555',
    marginBottom: 16,
    marginTop: 8,
  },
  headline: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 50,
    marginBottom: 16,
  },
  headlineLime: { color: '#CCFF00' },
  support: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: '#888',
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  selectedNumber: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: '#CCFF00',
    width: 36,
  },
  selectedText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
    color: '#FFF',
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  savedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#777',
  },
  savedGoalText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    lineHeight: 20,
  },
  savedMicrocopy: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    color: '#444',
    marginTop: 12,
  },
  footer: { paddingHorizontal: 28 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: '#CCFF00',
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.2,
  },
});
