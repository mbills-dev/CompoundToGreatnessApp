import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ImageSourcePropType,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { getNextMilestone, getMilestoneProgress } from '@/constants/milestones';
import { supabase } from '@/lib/supabase';
import CoachCard from './CoachCard';

const LIME = '#CCFF00';
const SCREEN_WIDTH = Dimensions.get('window').width;

const COACHING_BG: ImageSourcePropType = require('@/assets/images/CleanCinematicMountainSunriseCard.png');

function computeScore(streak: number): number {
  return (Math.pow(1.01, streak) - 1) * 100;
}

interface CoachCardCarouselProps {
  goalId: string;
  challengeDay: number;
  firstName?: string;
  streak: number;
  perfectDays: number;
  totalChallengeDays: number;
  activitiesCount: number;
}

export default function CoachCardCarousel({
  goalId,
  challengeDay,
  firstName,
  streak,
  perfectDays,
  totalChallengeDays,
  activitiesCount,
}: CoachCardCarouselProps) {
  const [activePanel, setActivePanel] = useState(0);
  const [hasAnimatedScore, setHasAnimatedScore] = useState(false);
  const [executionPct, setExecutionPct] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const score = computeScore(streak);
  const todayDelta = streak > 0 ? computeScore(streak) - computeScore(streak - 1) : 0;

  const consistencyPct = totalChallengeDays > 0
    ? Math.round((perfectDays / totalChallengeDays) * 100)
    : 0;

  // Fetch per-activity execution rate from daily_completions.activities_completed
  useEffect(() => {
    if (totalChallengeDays === 0 || activitiesCount === 0) {
      setExecutionPct(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('daily_completions')
      .select('activities_completed, completed_at')
      .eq('goal_id', goalId)
      .not('completed_at', 'is', null)
      .then(({ data }) => {
        if (cancelled || !data) return;
        let totalExecuted = 0;
        for (const row of data) {
          const arr = row.activities_completed;
          if (Array.isArray(arr)) totalExecuted += arr.length;
        }
        const totalPossible = data.length * activitiesCount;
        if (totalPossible > 0) {
          setExecutionPct(Math.round((totalExecuted / totalPossible) * 100));
        } else {
          setExecutionPct(null);
        }
      });
    return () => { cancelled = true; };
  }, [goalId, activitiesCount, totalChallengeDays]);

  // Score count-up animation
  const scoreAnim = useSharedValue(0);

  // Curve draw animation
  const curveProgress = useSharedValue(0);

  // Milestone progress animation
  const milestoneFill = useSharedValue(0);
  const milestoneProgress = getMilestoneProgress(challengeDay);

  useEffect(() => {
    milestoneFill.value = withTiming(milestoneProgress, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, []);

  const triggerScoreAnimation = () => {
    if (hasAnimatedScore) return;
    setHasAnimatedScore(true);

    scoreAnim.value = 0;
    scoreAnim.value = withTiming(score, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });

    curveProgress.value = 0;
    curveProgress.value = withTiming(1, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    const panel = Math.round(x / SCREEN_WIDTH);
    if (panel !== activePanel) {
      setActivePanel(panel);
      if (panel === 1) {
        triggerScoreAnimation();
      }
    }
  };

  const scrollToPanel = (panel: number) => {
    scrollRef.current?.scrollTo({ x: panel * SCREEN_WIDTH, animated: true });
  };

  // Score display text
  const [scoreText, setScoreText] = useState('0');

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (hasAnimatedScore) {
      interval = setInterval(() => {
        setScoreText(String(Math.round(scoreAnim.value)));
      }, 16);
      const stopTimer = setTimeout(() => {
        if (interval) clearInterval(interval);
        setScoreText(String(Math.round(score)));
      }, 850);
      return () => {
        clearTimeout(stopTimer);
        if (interval) clearInterval(interval);
      };
    } else {
      setScoreText(String(Math.round(score)));
    }
  }, [hasAnimatedScore, score]);

  // Compound curve path
  const W = SCREEN_WIDTH * 0.45;
  const H = 100;
  const PAD_LEFT = 8;
  const PAD_RIGHT = 8;
  const PAD_TOP = 10;
  const PAD_BOT = 10;
  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP - PAD_BOT;

  const days = Math.max(streak, 2);
  const maxScore = computeScore(days);

  const allPoints: { x: number; y: number }[] = [];
  for (let d = 1; d <= days; d++) {
    const s = computeScore(d);
    const x = PAD_LEFT + ((d - 1) / (days - 1)) * plotW;
    const y = PAD_TOP + plotH - (s / maxScore) * plotH;
    allPoints.push({ x, y });
  }

  const endPt = allPoints[allPoints.length - 1] ?? { x: PAD_LEFT + plotW, y: PAD_TOP + plotH };

  const fullPathD =
    allPoints.length > 1
      ? allPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
      : `M ${PAD_LEFT} ${PAD_TOP + plotH} L ${PAD_LEFT + plotW} ${PAD_TOP + plotH}`;

  const curveAnimStyle = useAnimatedStyle(() => ({
    opacity: curveProgress.value,
  }));

  const dot1Style = useAnimatedStyle(() => ({
    backgroundColor: activePanel === 0 ? LIME : 'rgba(255,255,255,0.2)',
  }));
  const dot2Style = useAnimatedStyle(() => ({
    backgroundColor: activePanel === 1 ? LIME : 'rgba(255,255,255,0.2)',
  }));

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        scrollEnabled
        style={styles.scroll}
      >
        {/* PANEL 1 — COACHING */}
        <View style={styles.panel}>
          <CoachCard
            challengeDay={challengeDay}
            firstName={firstName}
            backgroundImage={COACHING_BG}
            animatedMilestoneProgress={milestoneFill}
          />
        </View>

        {/* PANEL 2 — COMPOUND SCORE */}
        <View style={styles.panel}>
          <View style={styles.scoreCard}>
            <Image
              source={COACHING_BG}
              style={styles.scoreBg}
              resizeMode="stretch"
            />
            <View style={styles.scoreOverlay} />

            <View style={styles.scoreContent}>
              <Text style={styles.eyebrow}>YOUR</Text>
              <Text style={styles.eyebrowAccent}>COMPOUND SCORE</Text>

              <View style={styles.heroRow}>
                <View style={styles.heroLeft}>
                  <View style={styles.scoreRow}>
                    <Text style={styles.scoreNumber}>{scoreText}</Text>
                    <Text style={styles.scorePct}>%</Text>
                  </View>
                  {todayDelta > 0 && (
                    <View style={styles.deltaPill}>
                      <Text style={styles.deltaText}>
                        +{Math.round(todayDelta)} TODAY ↑
                      </Text>
                    </View>
                  )}
                  <Text style={styles.supportingCopy}>
                    Your consistency{'\n'}is compounding.
                  </Text>
                </View>

                <View style={styles.curveContainer}>
                  <Animated.View style={[{ flex: 1 }, curveAnimStyle]}>
                    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
                      {[0.2, 0.4, 0.6, 0.8].map((ratio, i) => {
                        const lx = PAD_LEFT + ratio * plotW;
                        return (
                          <Line
                            key={i}
                            x1={lx}
                            y1={PAD_TOP}
                            x2={lx}
                            y2={PAD_TOP + plotH}
                            stroke="rgba(204,255,0,0.06)"
                            strokeWidth={0.5}
                          />
                        );
                      })}
                      <Path d={fullPathD} stroke={LIME} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      <Circle cx={endPt.x} cy={endPt.y} r={4} fill={LIME} />
                      <Circle cx={endPt.x} cy={endPt.y} r={8} fill={LIME} opacity={0.15} />
                    </Svg>
                  </Animated.View>
                </View>
              </View>

              {/* Bottom metrics — only show metrics with real, distinct data */}
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>CONSISTENCY</Text>
                  <Text style={styles.metricValue}>{consistencyPct}</Text>
                  <Text style={styles.metricSub}>Show up over time.</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>STREAK</Text>
                  <Text style={styles.metricValue}>{streak} DAYS</Text>
                  <Text style={styles.metricSub}>Keep the chain alive.</Text>
                </View>
                {executionPct !== null && (
                  <>
                    <View style={styles.metricDivider} />
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>EXECUTION</Text>
                      <Text style={styles.metricValue}>{executionPct}%</Text>
                      <Text style={styles.metricSub}>Turn intentions into action.</Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Pagination dots — tappable */}
      <View style={styles.dotsContainer}>
        <TouchableOpacity onPress={() => scrollToPanel(0)} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Animated.View style={[styles.dot, dot1Style]} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => scrollToPanel(1)} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Animated.View style={[styles.dot, dot2Style]} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  scroll: {
    flexDirection: 'row',
  },
  panel: {
    width: SCREEN_WIDTH,
  },
  scoreCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  scoreBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  scoreOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(8,8,8,0.93)',
  },
  scoreContent: {
    padding: 16,
    paddingBottom: 14,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  eyebrowAccent: {
    fontSize: 9,
    fontWeight: '800',
    color: LIME,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  heroLeft: {
    flex: 1,
    marginRight: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  scoreNumber: {
    fontSize: 52,
    fontWeight: '900',
    color: LIME,
    lineHeight: 56,
    letterSpacing: -1.5,
  },
  scorePct: {
    fontSize: 28,
    fontWeight: '900',
    color: LIME,
    lineHeight: 56,
    marginBottom: 2,
  },
  deltaPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(204,255,0,0.15)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    marginBottom: 8,
  },
  deltaText: {
    fontSize: 9,
    fontWeight: '800',
    color: LIME,
    letterSpacing: 0.8,
  },
  supportingCopy: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 17,
  },
  curveContainer: {
    width: SCREEN_WIDTH * 0.45,
    height: 100,
  },
  metricsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 12,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  metricSub: {
    fontSize: 8,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
    lineHeight: 11,
  },
  metricDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
