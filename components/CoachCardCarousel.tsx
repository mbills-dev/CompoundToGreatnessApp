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
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path, Line } from 'react-native-svg';
import { getMilestoneProgress } from '@/constants/milestones';
import { supabase } from '@/lib/supabase';
import CoachCard from './CoachCard';

const LIME = '#CCFF00';
const SCREEN_WIDTH = Dimensions.get('window').width;
const AnimatedPath = Animated.createAnimatedComponent(Path);
const TOTAL_CURVE_DAYS = 77;

// Canonical carousel height — both panels share this exact footprint
const CARD_HEIGHT = 280;

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
  const curveProgress = useSharedValue(0);
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

    curveProgress.value = 0;
    curveProgress.value = withTiming(progressFraction, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });

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
  const curveW = (SCREEN_WIDTH - 36) * 0.5;
  const curveH = 126;
  const PAD_L = 10;
  const PAD_R = 10;
  const PAD_T = 10;
  const PAD_B = 14;
  const plotW = curveW - PAD_L - PAD_R;
  const plotH = curveH - PAD_T - PAD_B;
  const maxCurveScore = computeScore(TOTAL_CURVE_DAYS);

  const cubicPoint = (t: number): { x: number; y: number } => {
    const start = { x: PAD_L, y: PAD_T + plotH };
    const control1 = { x: PAD_L + plotW * 0.42, y: PAD_T + plotH * 0.98 };
    const control2 = { x: PAD_L + plotW * 0.78, y: PAD_T + plotH * 0.62 };
    const end = { x: PAD_L + plotW, y: PAD_T };
    const inverse = 1 - t;
    return {
      x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * control1.x + 3 * inverse * t ** 2 * control2.x + t ** 3 * end.x,
      y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * control1.y + 3 * inverse * t ** 2 * control2.y + t ** 3 * end.y,
    };
  };

  const pathFromCubic = (): string => {
    const start = cubicPoint(0);
    const control1 = cubicPoint(0.42);
    const control2 = cubicPoint(0.78);
    const end = cubicPoint(1);
    return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${control1.x.toFixed(1)} ${control1.y.toFixed(1)}, ${control2.x.toFixed(1)} ${control2.y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
  };

  const streakClamped = Math.min(Math.max(streak, 1), TOTAL_CURVE_DAYS);
  const progressFraction = streakClamped / TOTAL_CURVE_DAYS;
  const fullPath = pathFromCubic();
  const guideRatios = [0.14, 0.24, 0.34, 0.44, 0.54, 0.64, 0.74, 0.84, 0.94];
  const pathSamples: { x: number; y: number; length: number }[] = [];
  let pathLength = 0;
  for (let i = 0; i <= 400; i++) {
    const point = cubicPoint(i / 400);
    if (i > 0) {
      const previous = pathSamples[i - 1];
      pathLength += Math.hypot(point.x - previous.x, point.y - previous.y);
    }
    pathSamples.push({ ...point, length: pathLength });
  }

  const pointAtPathFraction = (fraction: number): { x: number; y: number } => {
    const targetLength = pathLength * fraction;
    const point = pathSamples.find((sample) => sample.length >= targetLength) ?? pathSamples[pathSamples.length - 1];
    return { x: point.x, y: point.y };
  };

  const endPt = pointAtPathFraction(progressFraction);
  const startPt = pointAtPathFraction(0);
  const animDotX = useSharedValue(startPt.x);
  const animDotY = useSharedValue(startPt.y);

  useEffect(() => {
    if (hasAnimatedScore) {
      animDotX.value = startPt.x;
      animDotY.value = startPt.y;
      animDotX.value = withTiming(endPt.x, { duration: 900, easing: Easing.out(Easing.cubic) });
      animDotY.value = withTiming(endPt.y, { duration: 900, easing: Easing.out(Easing.cubic) });
    } else {
      animDotX.value = startPt.x;
      animDotY.value = startPt.y;
    }
  }, [hasAnimatedScore]);

  const animDotStyle = useAnimatedStyle(() => ({
    left: animDotX.value - 4,
    top: animDotY.value - 4,
  }));

  const animGlowStyle = useAnimatedStyle(() => ({
    left: animDotX.value - 10,
    top: animDotY.value - 10,
  }));

  // --- Animated styles ---
  const progressPathProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLength * (1 - curveProgress.value),
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

  return (
    <View style={styles.container}>
      <View style={styles.cardFrame}>
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
              cardHeight={CARD_HEIGHT}
            />
          </View>

          {/* PANEL 2 — COMPOUND SCORE */}
          <View style={styles.panel}>
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

                  {/* Compound curve — full muted track always visible, lime portion animated */}
                  <View style={[styles.curveOuter, { width: curveW }]} pointerEvents="none">
                    <Svg width={curveW} height={curveH} viewBox={`0 0 ${curveW} ${curveH}`}>
                      {guideRatios.map((ratio) => {
                        const point = cubicPoint(ratio);
                        return (
                          <Line
                            key={ratio}
                            x1={point.x}
                            y1={PAD_T + plotH}
                            x2={point.x}
                            y2={point.y}
                            stroke={ratio <= progressFraction ? 'rgba(204,255,0,0.13)' : 'rgba(120,120,120,0.18)'}
                            strokeWidth={0.8}
                          />
                        );
                      })}
                      <Path
                        d={fullPath}
                        stroke="rgba(200,200,200,0.68)"
                        strokeWidth={2}
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={[pathLength, pathLength]}
                      />
                      <Path
                        d={fullPath}
                        stroke="rgba(200,200,200,0.12)"
                        strokeWidth={5}
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={[pathLength, pathLength]}
                      />
                      <AnimatedPath
                        d={fullPath}
                        stroke={LIME}
                        strokeWidth={6}
                        fill="none"
                        strokeLinecap="round"
                        opacity={0.2}
                        strokeDasharray={[pathLength, pathLength]}
                        animatedProps={progressPathProps}
                      />
                      <AnimatedPath
                        d={fullPath}
                        stroke={LIME}
                        strokeWidth={2.5}
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={[pathLength, pathLength]}
                        animatedProps={progressPathProps}
                      />
                    </Svg>
                    {/* Current-position glowing dot — travels with animation */}
                    <Animated.View style={[styles.endpointGlow, animGlowStyle, endpointGlowStyle]} />
                    <Animated.View style={[styles.endpointDot, animDotStyle, endpointStyle]} />
                    <View style={[styles.futureEndpoint, { left: PAD_L + plotW - 4, top: PAD_T - 4 }]} />
                  </View>
                </View>

                {/* Bottom metrics strip — 3 equal centered columns */}
                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>CONSISTENCY</Text>
                    <Text style={styles.metricValue}>{consistencyPct}</Text>
                    <Text style={styles.metricSub}>Show up over time.</Text>
                  </View>
                  <View style={[styles.metricDivider, { left: '33.333%' }]} />
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>STREAK</Text>
                    <Text style={styles.metricValue}>{streak} DAYS</Text>
                    <Text style={styles.metricSub}>Keep the chain alive.</Text>
                  </View>
                  <View style={[styles.metricDivider, { left: '66.666%' }]} />
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>EXECUTION</Text>
                    <Text style={styles.metricValue}>{executionPct === null ? '—' : `${executionPct}%`}</Text>
                    <Text style={styles.metricSub}>Turn intentions{`\n`}into action.</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Pagination dots — overlaid INSIDE the card footprint */}
        <View style={styles.dotsOverlay} pointerEvents="box-none">
          <TouchableOpacity
            onPress={() => scrollToPanel(0)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.dotWrapper}
          >
            <Animated.View style={[styles.dot, dot1Style]} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => scrollToPanel(1)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.dotWrapper}
          >
            <Animated.View style={[styles.dot, dot2Style]} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  cardFrame: {
    position: 'relative',
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
  },
  scroll: {
    flexDirection: 'row',
    height: CARD_HEIGHT,
  },
  panel: {
    width: SCREEN_WIDTH,
    height: CARD_HEIGHT,
    overflow: 'hidden',
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
    padding: 18,
    paddingBottom: 28,
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
    flex: 1,
    position: 'relative',
  },
  heroLeft: {
    width: '44%',
    zIndex: 2,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  scoreNumber: {
    fontSize: 58,
    fontWeight: '900',
    color: LIME,
    lineHeight: 60,
    letterSpacing: -2,
  },
  scorePct: {
    fontSize: 28,
    fontWeight: '900',
    color: LIME,
    lineHeight: 60,
    marginBottom: 2,
  },
  deltaPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(204,255,0,0.12)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    marginBottom: 8,
  },
  deltaText: {
    fontSize: 9,
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
    position: 'absolute',
    top: 0,
    right: 0,
    height: 126,
    overflow: 'visible',
  },
  endpointGlow: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(204,255,0,0.22)',
  },
  endpointDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: LIME,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  futureEndpoint: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(190,190,190,0.35)',
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
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  metricLabel: {
    width: '100%',
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 3,
    textAlign: 'center',
  },
  metricValue: {
    width: '100%',
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 2,
    textAlign: 'center',
  },
  metricSub: {
    width: '100%',
    fontSize: 8,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
    lineHeight: 10,
    paddingHorizontal: 2,
  },
  metricDivider: {
    position: 'absolute',
    top: 2,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  // Dots overlay — INSIDE the card, 12px from bottom
  dotsOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dotWrapper: {
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
