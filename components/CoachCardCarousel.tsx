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
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { getMilestoneProgress } from '@/constants/milestones';
import { supabase } from '@/lib/supabase';
import CoachCard from './CoachCard';

const LIME = '#CCFF00';
const SCREEN_WIDTH = Dimensions.get('window').width;
const TOTAL_CURVE_DAYS = 77;

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
  const [cardHeight, setCardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const score = computeScore(streak);
  const todayDelta = streak > 0 ? computeScore(streak) - computeScore(streak - 1) : 0;

  const consistencyPct = totalChallengeDays > 0
    ? Math.round((perfectDays / totalChallengeDays) * 100)
    : 0;

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

  // --- Animation shared values ---
  const scoreAnim = useSharedValue(0);
  const curveClipWidth = useSharedValue(0);
  const endpointOpacity = useSharedValue(0);
  const endpointScale = useSharedValue(0);
  const endpointGlowOpacity = useSharedValue(0);
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
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });

    // Curve draws left to right
    curveClipWidth.value = 0;
    curveClipWidth.value = withTiming(1, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });

    // Endpoint arrives after curve, then one subtle pulse
    endpointOpacity.value = withDelay(700, withTiming(1, { duration: 200 }));
    endpointScale.value = withDelay(700, withSequence(
      withTiming(1.4, { duration: 120 }),
      withTiming(1, { duration: 200 }),
    ));
    endpointGlowOpacity.value = withDelay(700, withSequence(
      withTiming(0.4, { duration: 120 }),
      withTiming(0.15, { duration: 400 }),
    ));
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
      }, 950);
      return () => {
        clearTimeout(stopTimer);
        if (interval) clearInterval(interval);
      };
    } else {
      setScoreText(String(Math.round(score)));
    }
  }, [hasAnimatedScore, score]);

  // --- Compound curve geometry ---
  const curveW = SCREEN_WIDTH * 0.42;
  const curveH = 92;
  const PAD_L = 6;
  const PAD_R = 6;
  const PAD_T = 8;
  const PAD_B = 8;
  const plotW = curveW - PAD_L - PAD_R;
  const plotH = curveH - PAD_T - PAD_B;
  const maxCurveScore = computeScore(TOTAL_CURVE_DAYS);

  const curvePoints: { x: number; y: number }[] = [];
  for (let d = 1; d <= TOTAL_CURVE_DAYS; d++) {
    const s = computeScore(d);
    const x = PAD_L + ((d - 1) / (TOTAL_CURVE_DAYS - 1)) * plotW;
    const y = PAD_T + plotH - (s / maxCurveScore) * plotH;
    curvePoints.push({ x, y });
  }

  const streakClamped = Math.min(Math.max(streak, 1), TOTAL_CURVE_DAYS);
  const endpointIdx = streakClamped - 1;
  const endPt = curvePoints[endpointIdx] ?? curvePoints[0];

  // Split path: achieved (1 → streak) and projected (streak → 77)
  const achievedPts = curvePoints.slice(0, endpointIdx + 1);
  const projectedPts = curvePoints.slice(endpointIdx);

  const pathFromPts = (pts: { x: number; y: number }[]) =>
    pts.length > 1
      ? pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
      : '';

  const achievedPath = pathFromPts(achievedPts);
  const projectedPath = pathFromPts(projectedPts);

  // --- Animated styles ---
  const curveClipStyle = useAnimatedStyle(() => ({
    width: `${curveClipWidth.value * 100}%`,
  }));

  const endpointStyle = useAnimatedStyle(() => ({
    opacity: endpointOpacity.value,
    transform: [{ scale: endpointScale.value }],
  }));

  const endpointGlowStyle = useAnimatedStyle(() => ({
    opacity: endpointGlowOpacity.value,
  }));

  const dot1Style = useAnimatedStyle(() => ({
    backgroundColor: activePanel === 0 ? LIME : 'rgba(255,255,255,0.2)',
  }));
  const dot2Style = useAnimatedStyle(() => ({
    backgroundColor: activePanel === 1 ? LIME : 'rgba(255,255,255,0.2)',
  }));

  const onCardLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - cardHeight) > 1) {
      setCardHeight(h);
    }
  };

  // Minimum height for score panel content
  const MIN_SCORE_HEIGHT = 210;
  const sharedHeight = Math.max(cardHeight, MIN_SCORE_HEIGHT);

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
        <View style={[styles.panel, { height: sharedHeight }]} onLayout={onCardLayout}>
          <View style={styles.cardClip}>
            <CoachCard
              challengeDay={challengeDay}
              firstName={firstName}
              backgroundImage={COACHING_BG}
              animatedMilestoneProgress={milestoneFill}
            />
          </View>
        </View>

        {/* PANEL 2 — COMPOUND SCORE */}
        <View style={[styles.panel, { height: sharedHeight }]}>
          <View style={styles.scoreCard}>
            <Image
              source={COACHING_BG}
              style={styles.scoreBg}
              resizeMode="cover"
            />
            <View style={styles.scoreOverlay} />

            <View style={styles.scoreContent}>
              {/* Eyebrow */}
              <Text style={styles.eyebrow}>YOUR</Text>
              <Text style={styles.eyebrowAccent}>COMPOUND SCORE</Text>

              {/* Hero row: score on left, curve on right */}
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

                {/* Compound curve with clip draw-in */}
                <View style={styles.curveOuter}>
                  <Animated.View style={[styles.curveClip, curveClipStyle]}>
                    <Svg width={curveW} height={curveH} viewBox={`0 0 ${curveW} ${curveH}`}>
                      {[0.25, 0.5, 0.75].map((ratio, i) => {
                        const lx = PAD_L + ratio * plotW;
                        return (
                          <Line
                            key={i}
                            x1={lx}
                            y1={PAD_T}
                            x2={lx}
                            y2={PAD_T + plotH}
                            stroke="rgba(204,255,0,0.05)"
                            strokeWidth={0.5}
                          />
                        );
                      })}
                      {projectedPath ? (
                        <Path
                          d={projectedPath}
                          stroke="rgba(204,255,0,0.12)"
                          strokeWidth={1}
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray="3 3"
                        />
                      ) : null}
                      {achievedPath ? (
                        <Path
                          d={achievedPath}
                          stroke={LIME}
                          strokeWidth={4}
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity={0.15}
                        />
                      ) : null}
                      {achievedPath ? (
                        <Path
                          d={achievedPath}
                          stroke={LIME}
                          strokeWidth={2}
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ) : null}
                    </Svg>
                  </Animated.View>
                  {/* Endpoint glow + dot overlaid using computed coords */}
                  <Animated.View
                    style={[
                      styles.endpointGlow,
                      { left: endPt.x - 10, top: endPt.y - 10 },
                      endpointGlowStyle,
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.endpointDot,
                      { left: endPt.x - 4, top: endPt.y - 4 },
                      endpointStyle,
                    ]}
                  />
                </View>
              </View>

              {/* Bottom metrics strip */}
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

      {/* Pagination dots — tappable, tight below card */}
      <View style={styles.dotsContainer}>
        <TouchableOpacity onPress={() => scrollToPanel(0)} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Animated.View style={[styles.dot, dot1Style]} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => scrollToPanel(1)} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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
    overflow: 'hidden',
  },
  cardClip: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  // Score panel
  scoreCard: {
    flex: 1,
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
    backgroundColor: 'rgba(6,6,6,0.72)',
  },
  scoreContent: {
    flex: 1,
    padding: 16,
    paddingBottom: 12,
    justifyContent: 'space-between',
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
    marginBottom: 10,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  heroLeft: {
    flex: 1,
    marginRight: 6,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  scoreNumber: {
    fontSize: 64,
    fontWeight: '900',
    color: LIME,
    lineHeight: 66,
    letterSpacing: -2,
  },
  scorePct: {
    fontSize: 32,
    fontWeight: '900',
    color: LIME,
    lineHeight: 66,
    marginBottom: 2,
  },
  deltaPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(204,255,0,0.12)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 2,
    marginBottom: 6,
  },
  deltaText: {
    fontSize: 8,
    fontWeight: '800',
    color: LIME,
    letterSpacing: 0.6,
  },
  supportingCopy: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.38)',
    lineHeight: 15,
  },
  // Curve
  curveOuter: {
    width: SCREEN_WIDTH * 0.42,
    height: 92,
    overflow: 'hidden',
  },
  curveClip: {
    height: 92,
    overflow: 'hidden',
  },
  endpointGlow: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: LIME,
  },
  endpointDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: LIME,
  },
  // Bottom metrics
  metricsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    paddingTop: 10,
    marginTop: 6,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 3,
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
    lineHeight: 10,
  },
  metricDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 2,
  },
  // Dots
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
