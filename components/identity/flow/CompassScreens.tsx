import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { ArrowLeft, ArrowRight, Check, Sparkles, ListFilter as Filter } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FlowGoal, LockedGoal } from './types';
import { formatGoalLabel, displayGoalLabel } from './AnchorScreens';
import styles from './styles';

// ─── CompassStoryScreen ───────────────────────────────────────────────────────

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

// ─── CompassDominoScreen ──────────────────────────────────────────────────────

export function CompassDominoScreen({
  goals,
  locked,
  goalLabelOverrides,
  onNext,
  onBack,
}: {
  goals: FlowGoal[];
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

// ─── CompassMechanismScreen ───────────────────────────────────────────────────

export function CompassMechanismScreen({
  dominoGoal,
  goalLabelOverrides,
  initialText,
  onNext,
  onBack,
}: {
  dominoGoal: FlowGoal;
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
          returnKeyType="done"
          blurOnSubmit={true}
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
