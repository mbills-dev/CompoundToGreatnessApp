import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  LayoutAnimation,
  Animated,
  Platform,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import Svg, { Path, Circle, Text as SvgText, Line } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { Goal, DailyActivity, DailyCompletion, EvidenceLog } from '@/types/database';
import { toLocalDateString } from '@/lib/dateHelpers';
import { useTheme } from '@/contexts/ThemeContext';

const LIME = '#CCFF00';
const PILL_BG = '#1A1A1A';
const CARD_BG = '#1A1A1A';
const INNER_BG = '#111111';
const MUTED_35 = 'rgba(255,255,255,0.35)';
const MUTED_28 = 'rgba(255,255,255,0.28)';
const MUTED_22 = 'rgba(255,255,255,0.22)';
const MUTED_10 = 'rgba(255,255,255,0.10)';
const MUTED_06 = 'rgba(255,255,255,0.06)';
const MUTED_25 = 'rgba(255,255,255,0.25)';
const MUTED_65 = 'rgba(255,255,255,0.65)';
const MUTED_40 = 'rgba(255,255,255,0.40)';
const RED = 'rgba(255,68,68,0.8)';

interface Props {
  goal: Goal;
  completions: DailyCompletion[];
  activities: DailyActivity[];
  onScoreUpdated?: (score: number) => void;
}

function computeStreak(completions: DailyCompletion[]): number {
  if (!completions.length) return 0;
  const today = toLocalDateString(new Date());
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toLocalDateString(d);
  })();

  const completedSet = new Set(
    completions
      .filter((c) => c.completed_at !== null)
      .map((c) => c.completion_date)
  );

  let streak = 0;
  const cursor = new Date();

  if (!completedSet.has(today) && !completedSet.has(yesterday)) return 0;

  if (completedSet.has(today)) {
    cursor.setHours(0, 0, 0, 0);
  } else {
    cursor.setDate(cursor.getDate() - 1);
    cursor.setHours(0, 0, 0, 0);
  }

  while (true) {
    const ds = toLocalDateString(cursor);
    if (!completedSet.has(ds)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function computeScore(streak: number): number {
  return (Math.pow(1.01, streak) - 1) * 100;
}

function getSubtitle(streak: number): string {
  if (streak <= 6) return 'better than Day 1 — the magic is just beginning.';
  if (streak <= 20) return 'better than Day 1 — you can feel it compounding.';
  if (streak <= 76) return 'better than Day 1 — you are becoming someone different.';
  return 'better than Day 1 — the magic penny, fully paid out.';
}

function formatScore(score: number): string {
  return String(Math.round(score));
}

interface CurveGraphProps {
  streak: number;
  score: number;
}

function CurveGraph({ streak, score }: CurveGraphProps) {
  const W = 320;
  const H = 80;
  const PAD_LEFT = 4;
  const PAD_RIGHT = 52;
  const PAD_TOP = 8;
  const PAD_BOT = 4;
  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP - PAD_BOT;

  const days = Math.max(streak, 2);
  const maxScore = computeScore(days);

  const points: { x: number; y: number }[] = [];
  for (let d = 1; d <= days; d++) {
    const s = computeScore(d);
    const x = PAD_LEFT + ((d - 1) / (days - 1)) * plotW;
    const y = PAD_TOP + plotH - (s / maxScore) * plotH;
    points.push({ x, y });
  }

  const pathD =
    points.length > 1
      ? points
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(' ')
      : `M ${PAD_LEFT} ${PAD_TOP + plotH} L ${PAD_LEFT + plotW} ${PAD_TOP + plotH}`;

  const endPt = points[points.length - 1] ?? { x: PAD_LEFT + plotW, y: PAD_TOP + plotH };
  const labelX = endPt.x;
  const labelY = endPt.y + 14;

  const midDay = days >= 3 ? Math.round(days / 2) : null;

  return (
    <View style={curveStyles.container}>
      <View style={curveStyles.graphHeader}>
        <Text style={curveStyles.graphLabel}>YOUR COMPOUND CURVE</Text>
        <View style={curveStyles.graphLegend}>
          <View style={curveStyles.limeLine} />
          <Text style={curveStyles.graphLegendText}>1% better daily</Text>
        </View>
      </View>
      <View style={[curveStyles.svgWrap, { height: H + 20 }]}>
        <Svg width="100%" height={H + 20} viewBox={`0 0 ${W} ${H + 20}`}>
          <Path d={pathD} stroke={LIME} strokeWidth={1.5} fill="none" />
          <Circle cx={endPt.x} cy={endPt.y} r={3.5} fill={LIME} />
          <SvgText
            x={labelX}
            y={labelY + 8}
            fill={LIME}
            fontSize={9}
            fontWeight="700"
            textAnchor="middle"
          >
            {formatScore(score)}%
          </SvgText>
        </Svg>
      </View>
      <View style={curveStyles.xLabels}>
        <Text style={curveStyles.xLabel}>Day 1</Text>
        <Text style={curveStyles.xLabel}>{midDay != null ? `Day ${midDay}` : ''}</Text>
        <Text style={curveStyles.xLabel}>Day {days}</Text>
      </View>
    </View>
  );
}

const curveStyles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  graphHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  graphLabel: {
    fontSize: 9,
    color: MUTED_35,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  graphLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  limeLine: {
    width: 16,
    height: 1.5,
    backgroundColor: LIME,
    borderRadius: 1,
  },
  graphLegendText: {
    fontSize: 9,
    color: MUTED_35,
    fontWeight: '500',
  },
  svgWrap: {
    backgroundColor: INNER_BG,
    borderRadius: 10,
    overflow: 'hidden',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 2,
  },
  xLabel: {
    fontSize: 8,
    color: MUTED_28,
    fontWeight: '500',
  },
});

export default function CompoundScoreSection({ goal, completions, activities, onScoreUpdated }: Props) {
  const { isDark } = useTheme();
  const isLight = !isDark;

  const [evidenceLogs, setEvidenceLogs] = useState<EvidenceLog[]>([]);
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const [compoundScore, setCompoundScore] = useState<number>(goal.compound_score ?? 0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerOpacity = useRef(new Animated.Value(0)).current;

  const streak = computeStreak(completions);
  const liveScore = computeScore(streak);
  const displayScore = Math.max(liveScore, compoundScore);
  const multiplier = Math.pow(1.01, streak);

  useEffect(() => {
    loadEvidenceLogs();
  }, [goal.id]);

  useEffect(() => {
    if (liveScore > compoundScore) {
      updateCompoundScore(liveScore);
    }
  }, [liveScore]);

  const loadEvidenceLogs = async () => {
    const { data } = await supabase
      .from('evidence_logs')
      .select('*')
      .eq('goal_id', goal.id)
      .order('completion_date', { ascending: false })
      .limit(20);
    if (data) setEvidenceLogs(data);
  };

  const updateCompoundScore = async (score: number) => {
    setCompoundScore(score);
    await supabase
      .from('goals')
      .update({ compound_score: score })
      .eq('id', goal.id);
    onScoreUpdated?.(score);
  };

  const toggleDrawer = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const opening = !drawerOpen;
    setDrawerOpen(opening);
    Animated.timing(drawerOpacity, {
      toValue: opening ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const getActivityConsistency = () => {
    const totalDays = goal.current_challenge_day || 0;
    if (totalDays === 0 || activities.length === 0) return [];

    const completedWithDate = completions.filter((c) => c.completed_at !== null);

    return activities.map((activity) => {
      const daysCompleted = completedWithDate.filter(
        (c) => c.activities_completed && c.activities_completed.includes(activity.id)
      ).length;
      const pct = totalDays > 0 ? Math.round((daysCompleted / totalDays) * 100) : 0;
      return {
        id: activity.id,
        name: activity.activity_name,
        daysCompleted,
        totalDays,
        percentage: pct,
      };
    });
  };

  const activityStats = getActivityConsistency();
  const visibleLogs = showAllEvidence ? evidenceLogs : evidenceLogs.slice(0, 5);

  const formatLogDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getChallengeDay = (completion_date: string): number => {
    if (!goal.challenge_start_date) return 1;
    const start = new Date(goal.challenge_start_date + 'T00:00:00');
    const target = new Date(completion_date + 'T00:00:00');
    const diff = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff + 1;
  };

  const sectionTitleColor = isLight ? '#1A1A1A' : '#FFFFFF';
  const progressTrackColor = isLight ? 'rgba(0,0,0,0.1)' : MUTED_10;

  return (
    <View style={styles.root}>
      <View style={styles.divider} />

      {/* COMPOUND SCORE SECTION */}
      <View style={styles.sectionPill}>
        <Text style={styles.sectionPillText}>COMPOUND SCORE</Text>
      </View>
      <Text style={[styles.sectionTitle, { color: sectionTitleColor }]}>1% better. Every day.</Text>

      {/* Simplified hero card — always dark */}
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroLeft}>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreNumber}>{formatScore(displayScore)}</Text>
              <Text style={styles.scorePct}>%</Text>
            </View>
            <Text style={[styles.scoreSubtitle, { color: MUTED_35 }]}>{getSubtitle(streak)}</Text>
          </View>
          <View style={styles.streakBadge}>
            <Text style={styles.streakNumber}>{streak}</Text>
            <Text style={[styles.streakLabel, { color: MUTED_35 }]}>DAY STREAK</Text>
          </View>
        </View>

        {/* Expandable drawer */}
        {drawerOpen && (
          <Animated.View style={{ opacity: drawerOpacity }}>
            <View style={styles.drawerDivider} />

            {/* Three stat tiles — always #111111, no theme conditional */}
            <View style={styles.statTiles}>
              <View style={styles.statTile}>
                <Text style={[styles.statTileLabel, { color: MUTED_28 }]}>DAILY MULTIPLIER</Text>
                <Text style={styles.statTileValue}>{multiplier.toFixed(2)}x</Text>
                <Text style={[styles.statTileSub, { color: MUTED_22 }]}>current</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={[styles.statTileLabel, { color: MUTED_28 }]}>DAY 77 POTENTIAL</Text>
                <Text style={styles.statTileValue}>114%</Text>
                <Text style={[styles.statTileSub, { color: MUTED_22 }]}>at full streak</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={[styles.statTileLabel, { color: MUTED_28 }]}>DAY 365 POTENTIAL</Text>
                <Text style={styles.statTileValue}>3,678%</Text>
                <Text style={[styles.statTileSub, { color: MUTED_22 }]}>at full streak</Text>
              </View>
            </View>

            {/* Compound curve graph */}
            <CurveGraph streak={Math.max(streak, 1)} score={displayScore} />

            {/* Rules */}
            <View style={styles.rules}>
              <Text style={[styles.rulesTitle, { color: MUTED_35 }]}>THE RULES</Text>
              <View style={styles.ruleRow}>
                <View style={[styles.ruleDot, { backgroundColor: LIME }]} />
                <Text style={[styles.ruleText, { color: MUTED_28 }]}>Show up every day — percentage grows 1% per day.</Text>
              </View>
              <View style={styles.ruleRow}>
                <View style={[styles.ruleDot, { backgroundColor: MUTED_28 }]} />
                <Text style={[styles.ruleText, { color: MUTED_28 }]}>Miss a day — streak resets. Your score stays. Rebuild from 1.01x.</Text>
              </View>
              <View style={styles.ruleRow}>
                <View style={[styles.ruleDot, { backgroundColor: 'rgba(204,255,0,0.5)' }]} />
                <Text style={[styles.ruleText, { color: MUTED_28 }]}>Never miss twice. One miss is an accident. Two is a new habit.</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* See more / See less button */}
        <TouchableOpacity onPress={toggleDrawer} activeOpacity={0.7} style={styles.seeMoreBtn}>
          <Text style={styles.seeMoreText}>{drawerOpen ? 'See less ›' : 'See more ›'}</Text>
        </TouchableOpacity>
      </View>

      {/* CONSISTENCY SECTION */}
      {activityStats.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionPill}>
            <Text style={styles.sectionPillText}>CONSISTENCY</Text>
          </View>
          <Text style={[styles.sectionTitle, { color: sectionTitleColor }]}>How you're showing up</Text>
          {activityStats.map((stat) => (
            <View key={stat.id} style={styles.consistencyCard}>
              <View style={styles.consistencyTop}>
                <Text style={styles.consistencyName}>{stat.name}</Text>
                <Text style={[styles.consistencyPct, { color: LIME }]}>
                  {stat.percentage}%
                </Text>
              </View>
              {/* Sub-label inside dark card — hardcoded */}
              <Text style={[styles.consistencyDays, { color: MUTED_35 }]}>
                {stat.daysCompleted} of {stat.totalDays} days
              </Text>
              <View style={[styles.progressTrack, { backgroundColor: progressTrackColor }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${stat.percentage}%`,
                      backgroundColor: LIME,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* EVIDENCE LOG FEED */}
      <View style={styles.section}>
        <View style={styles.sectionPill}>
          <Text style={styles.sectionPillText}>EVIDENCE LOG</Text>
        </View>
        <Text style={[styles.sectionTitle, { color: sectionTitleColor }]}>Your journey in your own words</Text>

        {visibleLogs.length === 0 ? (
          <View style={styles.evidenceCard}>
            {/* Empty state inside dark card — hardcoded */}
            <Text style={[styles.evidenceEmpty, { color: MUTED_25 }]}>
              Your evidence log entries will appear here as you write them.
            </Text>
          </View>
        ) : (
          visibleLogs.map((log) => (
            <View key={log.id} style={styles.evidenceCard}>
              <View style={styles.evidenceCardHeader}>
                <Text style={styles.evidenceDay}>DAY {getChallengeDay(log.completion_date)}</Text>
                {/* Date inside dark card — hardcoded */}
                <Text style={[styles.evidenceDate, { color: 'rgba(255,255,255,0.3)' }]}>{formatLogDate(log.completion_date)}</Text>
              </View>
              {/* Body inside dark card — hardcoded */}
              <Text style={[styles.evidenceContent, { color: MUTED_65 }]}>{log.content}</Text>
            </View>
          ))
        )}

        {evidenceLogs.length > 5 && !showAllEvidence && (
          <TouchableOpacity onPress={() => setShowAllEvidence(true)} activeOpacity={0.7}>
            <Text style={styles.viewAll}>View all entries →</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* STAKES CARD */}
      <View style={styles.section}>
        <View style={styles.sectionPill}>
          <Text style={styles.sectionPillText}>THE STAKES</Text>
        </View>
        <Text style={[styles.sectionTitle, { color: sectionTitleColor }]}>There is no standing still.</Text>
        <View style={styles.stakesCard}>
          <View style={styles.stakesRow}>
            <View style={[styles.stakesIcon, { borderColor: LIME }]}>
              <Text style={[styles.stakesArrow, { color: LIME }]}>↑</Text>
            </View>
            <View style={styles.stakesText}>
              <Text style={styles.stakesRowTitle}>1% better every day</Text>
              {/* Description inside dark card — hardcoded */}
              <Text style={[styles.stakesRowSub, { color: 'rgba(255,255,255,0.3)' }]}>Show up. Do the inputs. Compound.</Text>
            </View>
            <Text style={[styles.stakesValue, { color: LIME }]}>3,678%</Text>
          </View>
          <View style={styles.stakesDivider} />
          <View style={styles.stakesRow}>
            <View style={[styles.stakesIcon, { borderColor: 'rgba(255,68,68,0.5)' }]}>
              <Text style={[styles.stakesArrow, { color: RED }]}>↓</Text>
            </View>
            <View style={styles.stakesText}>
              <Text style={styles.stakesRowTitle}>1% worse every day</Text>
              {/* Description inside dark card — hardcoded */}
              <Text style={[styles.stakesRowSub, { color: 'rgba(255,255,255,0.3)' }]}>Skip inputs. Make excuses. Decline.</Text>
            </View>
            <Text style={[styles.stakesValue, { color: RED }]}>-97%</Text>
          </View>
          {/* Truth line inside dark card — hardcoded */}
          <Text style={[styles.stakesTruth, { color: MUTED_25 }]}>
            There is no neutral. Every day you either compound forward or compound backward.
          </Text>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 16,
  },
  divider: {
    height: 1,
    backgroundColor: MUTED_06,
    marginVertical: 24,
  },

  /* Hero card */
  heroCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 20,
    paddingBottom: 16,
    marginBottom: 0,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  heroLeft: {
    flex: 1,
    marginRight: 12,
  },
  youAreLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  scoreNumber: {
    fontSize: 56,
    fontWeight: '900',
    color: LIME,
    lineHeight: 60,
    letterSpacing: -1,
  },
  scorePct: {
    fontSize: 32,
    fontWeight: '900',
    color: LIME,
    lineHeight: 60,
    marginBottom: 2,
  },
  scoreSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  streakBadge: {
    backgroundColor: INNER_BG,
    borderWidth: 1,
    borderColor: MUTED_10,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 72,
  },
  streakNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 28,
  },
  streakLabel: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 2,
  },

  /* Drawer */
  drawerDivider: {
    height: 1,
    backgroundColor: MUTED_06,
    marginTop: 14,
    marginBottom: 14,
  },
  seeMoreBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  seeMoreText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
  },

  /* Stat tiles — always #111111 background */
  statTiles: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 0,
  },
  statTile: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    backgroundColor: INNER_BG,
  },
  statTileLabel: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 4,
  },
  statTileValue: {
    fontSize: 15,
    fontWeight: '900',
    color: LIME,
  },
  statTileSub: {
    fontSize: 9,
    marginTop: 2,
  },

  /* Rules */
  rules: {
    borderTopWidth: 1,
    borderTopColor: MUTED_06,
    marginTop: 14,
    paddingTop: 13,
  },
  rulesTitle: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  ruleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  ruleText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },

  /* Section layout */
  section: {
    marginTop: 24,
  },
  sectionPill: {
    alignSelf: 'flex-start',
    backgroundColor: PILL_BG,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  sectionPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: LIME,
    letterSpacing: 0.12 * 9,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
    letterSpacing: -0.3,
  },

  /* Consistency cards */
  consistencyCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  consistencyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  consistencyName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  consistencyPct: {
    fontSize: 18,
    fontWeight: '900',
  },
  consistencyDays: {
    fontSize: 11,
    marginBottom: 8,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },

  /* Evidence log */
  evidenceCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  evidenceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  evidenceDay: {
    fontSize: 10,
    color: LIME,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  evidenceDate: {
    fontSize: 10,
  },
  evidenceContent: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  evidenceEmpty: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
  viewAll: {
    fontSize: 12,
    color: LIME,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },

  /* Stakes */
  stakesCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    paddingHorizontal: 16,
  },
  stakesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  stakesIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  stakesArrow: {
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
  },
  stakesText: {
    flex: 1,
  },
  stakesRowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stakesRowSub: {
    fontSize: 11,
    marginTop: 1,
  },
  stakesValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  stakesDivider: {
    height: 1,
    backgroundColor: MUTED_06,
    marginVertical: 2,
  },
  stakesTruth: {
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
  },
});
