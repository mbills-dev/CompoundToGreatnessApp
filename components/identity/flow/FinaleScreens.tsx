import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  interpolate,
} from 'react-native-reanimated';
import { ArrowLeft, ListFilter as Filter } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FlowGoal, LockedGoal } from './types';
import { displayGoalLabel } from './AnchorScreens';
import { IdentityShape, deriveIdentityLine } from './IdentityScreens';
import styles from './styles';

// ─── FinaleBeatCard ───────────────────────────────────────────────────────────

function FinaleBeatCard({ delay, children }: { delay: number; children: React.ReactNode }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withSpring(1, { damping: 18, stiffness: 120 }));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: [{ translateY: interpolate(anim.value, [0, 1], [16, 0]) }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

// ─── FinaleScreen ─────────────────────────────────────────────────────────────

export function FinaleScreen({
  beat,
  goals,
  locked,
  identityOverrides,
  compassFilter,
  onNext,
  onBack,
}: {
  beat: 0 | 1 | 2;
  goals: FlowGoal[];
  locked: LockedGoal[];
  identityOverrides: Record<number, string>;
  compassFilter: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const { colors, isDark } = useTheme();

  const identityShapes = goals.map(g => {
    const lock = locked.find(l => l.goalId === g.id);
    if (!lock) return null;
    const override = identityOverrides[g.id];
    if (override !== undefined) {
      return { kind: 'sentence', text: override } as IdentityShape;
    }
    return deriveIdentityLine(lock);
  }).filter(Boolean) as IdentityShape[];

  const tiles: Array<{ dailyInput: string; when: string; where: string; goalLabel: string }> = [];
  goals.forEach(g => {
    const lock = locked.find(l => l.goalId === g.id);
    if (!lock) return;
    const refinedLabel = displayGoalLabel(lock);
    tiles.push({ dailyInput: lock.dailyInput, when: lock.when, where: lock.where, goalLabel: refinedLabel });
    lock.additionalInputs.forEach(inp =>
      tiles.push({ dailyInput: inp.dailyInput, when: inp.when, where: inp.where, goalLabel: refinedLabel }),
    );
  });

  const filterQuestion = compassFilter.trim()
    ? `Will this help me ${compassFilter.trim().replace(/\.$/, '')}?`
    : '';

  const BEAT_META = [
    { eyebrow: 'YOUR IDENTITY', cta: 'Next' },
    { eyebrow: 'YOUR COMPASS', cta: 'Next' },
    { eyebrow: 'YOUR SUCCESS STACK', cta: "I'm ready!" },
  ] as const;

  const meta = BEAT_META[beat];

  const renderContent = () => {
    if (beat === 0) {
      return (
        <View style={{ gap: 10 }}>
          {identityShapes.map((shape, idx) => (
            <FinaleBeatCard key={idx} delay={idx * 80}>
              <View style={[styles.identityTileCard, { backgroundColor: isDark ? colors.backgroundSecondary : '#FAFAFA', borderColor: colors.primary }]}>
                {shape.kind === 'sentence' ? (
                  <Text style={[styles.identityLine, { color: colors.text }]}>{shape.text}</Text>
                ) : (
                  <Text style={[styles.identityLine, { color: colors.primary, fontStyle: 'italic' }]}>"{shape.finishLine}"</Text>
                )}
              </View>
            </FinaleBeatCard>
          ))}
        </View>
      );
    }
    if (beat === 1) {
      return (
        <FinaleBeatCard delay={0}>
          <View style={[styles.compassCard,
            filterQuestion
              ? { backgroundColor: isDark ? 'rgba(204,255,0,0.08)' : 'rgba(204,255,0,0.10)', borderColor: colors.primary }
              : { backgroundColor: isDark ? colors.backgroundSecondary : '#FAFAFA', borderColor: colors.border }
          ]}>
            {filterQuestion ? (
              <>
                <Text style={[styles.compassFilterLabel, { color: colors.primary }]}>YOUR FILTER QUESTION</Text>
                <Text style={[styles.compassFilterText, { color: colors.text, fontStyle: 'italic' }]}>
                  "{filterQuestion}"
                </Text>
              </>
            ) : (
              <>
                <Filter size={20} color={colors.textTertiary} strokeWidth={1.5} />
                <Text style={[styles.compassPlaceholder, { color: colors.textTertiary }]}>
                  Your filter question lives here.
                </Text>
              </>
            )}
          </View>
        </FinaleBeatCard>
      );
    }
    // beat === 2
    return (
      <View style={{ gap: 10 }}>
        {tiles.map((tile, idx) => (
          <FinaleBeatCard key={idx} delay={idx * 70}>
            <View style={[styles.finaleStackTile, { backgroundColor: isDark ? colors.backgroundSecondary : '#FAFAFA', borderColor: colors.border }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View style={[styles.finaleGoalTag, { backgroundColor: isDark ? 'rgba(204,255,0,0.08)' : 'rgba(204,255,0,0.10)', borderColor: colors.primary + '50' }]}>
                  <Text style={[styles.finaleGoalTagText, { color: colors.primary }]} numberOfLines={1}>{tile.goalLabel}</Text>
                </View>
                <Text style={[styles.finaleStackText, { color: colors.text, marginTop: 8 }]}>{tile.dailyInput}</Text>
                <Text style={[styles.finaleStackWhen, { color: colors.textTertiary }]}>{tile.when}{tile.where ? ` · ${tile.where}` : ''}</Text>
              </View>
              <View style={[styles.finaleCheckOuter, { borderColor: colors.border }]}>
                <View style={[styles.finaleCheckInner, { borderColor: colors.border }]} />
              </View>
            </View>
          </FinaleBeatCard>
        ))}
      </View>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.summaryContent}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity onPress={onBack} style={[styles.backBtn, { marginBottom: 20 }]}>
        <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
      </TouchableOpacity>

      <Text style={[styles.finaleSectionLabel, { color: colors.primary, fontSize: 13, marginBottom: 20 }]}>
        HERE'S WHAT YOU BUILT
      </Text>
      <Text style={[styles.finaleHeadline, { color: colors.text, marginBottom: 24 }]}>
        {meta.eyebrow}
      </Text>

      {renderContent()}

      <View style={{ marginTop: 32, gap: 16 }}>
        {/* Beat dots */}
        <View style={[styles.welcomeDots, { alignSelf: 'center' }]}>
          {([0, 1, 2] as const).map(i => (
            <View key={i} style={[styles.welcomeDot, {
              backgroundColor: i <= beat ? colors.primary : (isDark ? '#333' : '#D0D0D0'),
              width: i === beat ? 20 : 8,
            }]} />
          ))}
        </View>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={onNext}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>{meta.cta}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
