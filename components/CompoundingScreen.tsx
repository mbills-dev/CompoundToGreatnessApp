import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import Svg, { Path, Circle, Line, Defs, Filter, Text as SvgText, Rect, ClipPath } from 'react-native-svg';

const LIME = '#CCFF00';
const WHITE = '#FFFFFF';
const MUTED = '#8D8D8F';
const BG = '#050505';

const EASE_OUT = Easing.out(Easing.cubic);

type Props = {
  onContinue: () => void;
  onBack: () => void;
};

const MILESTONES = [
  { day: 1, label: 'DAY 1' },
  { day: 20, label: 'DAY 20' },
  { day: 40, label: 'DAY 40' },
  { day: 77, label: 'DAY 77' },
];

// Piecewise curve: flat for a long time, then dramatic explosion.
// progress 0..1 maps to Day 1..77.
function curvePoint(
  progress: number,
  graphW: number,
  graphH: number,
  padX: number,
  padTop: number,
  padBottom: number,
) {
  const usableH = graphH - padTop - padBottom;
  const x = padX + progress * (graphW - 2 * padX);

  // Normalize the y value piecewise:
  // 0.00–0.26 (Day 1–20): nearly flat, only ~2% growth
  // 0.26–0.52 (Day 20–40): subtle bend, ~8% total
  // 0.52–0.72 (Day 40–55): noticeable acceleration, ~25%
  // 0.72–1.00 (Day 55–77): dramatic hockey-stick to 100%
  let yNorm: number;
  if (progress < 0.26) {
    yNorm = (progress / 0.26) * 0.02;
  } else if (progress < 0.52) {
    const local = (progress - 0.26) / 0.26;
    yNorm = 0.02 + local * 0.06;
  } else if (progress < 0.72) {
    const local = (progress - 0.52) / 0.20;
    yNorm = 0.08 + local * 0.17;
  } else {
    const local = (progress - 0.72) / 0.28;
    // Exponential kick for the final section
    yNorm = 0.25 + (Math.exp(3.5 * local) - 1) / (Math.exp(3.5) - 1) * 0.75;
  }

  const y = padTop + usableH - yNorm * usableH;
  return { x, y };
}

export default function CompoundingScreen({ onContinue }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const isSmall = width <= 375;
  const isNarrowHeight = height < 700;

  const topPad = insets.top + (isNarrowHeight ? 8 : 14);
  const bottomPad = insets.bottom + 28;
  const maxContentWidth = 480;
  const pageWidth = Math.min(width, maxContentWidth);

  // Reanimated values for non-SVG elements
  const headlineOpacity = useSharedValue(0);
  const subOpacity = useSharedValue(0);
  const quitOpacity = useSharedValue(0);
  const keepGoingOpacity = useSharedValue(0);
  const greatnessOpacity = useSharedValue(0);
  const challengeOpacity = useSharedValue(0);
  const challengeScale = useSharedValue(0.92);
  const challengeSubOpacity = useSharedValue(0);
  const ctaOpacity = useSharedValue(0);

  // Day 77 dot pulse
  const dot77Scale = useSharedValue(0);
  const dot77Opacity = useSharedValue(0);

  // React state for SVG animation (curve draw + milestones)
  const [curveProgress, setCurveProgress] = useState(0);
  const [visibleMilestones, setVisibleMilestones] = useState(0);

  const visibleMilestonesRef = React.useRef(0);

  useEffect(() => {
    // 0.0s — headline visible
    headlineOpacity.value = withTiming(1, { duration: 500, easing: EASE_OUT });
    // 0.4s — supporting line
    subOpacity.value = withDelay(400, withTiming(1, { duration: 400, easing: EASE_OUT }));

    // 0.7s — graph begins drawing (1.8s duration → done at ~2.5s)
    const curveStart = 700;
    const curveDuration = 1800;
    const curveStartTs = Date.now() + curveStart;
    let curveRaf: ReturnType<typeof requestAnimationFrame>;
    const animateCurve = () => {
      const elapsed = Date.now() - curveStartTs;
      const t = Math.max(0, Math.min(1, elapsed / curveDuration));
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setCurveProgress(eased);

      // Reveal milestones as curve passes them
      const milestoneTs = [0.01, 0.26, 0.52, 1.0];
      for (let i = 0; i < milestoneTs.length; i++) {
        if (eased >= milestoneTs[i] && visibleMilestonesRef.current <= i) {
          visibleMilestonesRef.current = i + 1;
          setVisibleMilestones(i + 1);
        }
      }

      if (t < 1) {
        curveRaf = requestAnimationFrame(animateCurve);
      }
    };
    const curveTimer = setTimeout(() => {
      curveRaf = requestAnimationFrame(animateCurve);
    }, curveStart);

    // Annotations
    quitOpacity.value = withDelay(1200, withTiming(1, { duration: 500, easing: EASE_OUT }));
    keepGoingOpacity.value = withDelay(1800, withTiming(1, { duration: 500, easing: EASE_OUT }));
    greatnessOpacity.value = withDelay(2700, withTiming(1, { duration: 500, easing: EASE_OUT }));

    // Day 77 dot pulse — fires when curve completes (~2.5s)
    dot77Opacity.value = withDelay(2500, withTiming(1, { duration: 200, easing: EASE_OUT }));
    dot77Scale.value = withDelay(
      2500,
      withSequence(
        withTiming(1.5, { duration: 300, easing: Easing.out(Easing.cubic) }),
        withTiming(1.0, { duration: 300, easing: Easing.inOut(Easing.ease) }),
      ),
    );

    // 77 DAY CHALLENGE reveal
    challengeOpacity.value = withDelay(3000, withTiming(1, { duration: 500, easing: EASE_OUT }));
    challengeScale.value = withDelay(3000, withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.2)) }));
    challengeSubOpacity.value = withDelay(3300, withTiming(1, { duration: 400, easing: EASE_OUT }));

    // CTA
    ctaOpacity.value = withDelay(3400, withTiming(1, { duration: 500, easing: EASE_OUT }));

    return () => {
      clearTimeout(curveTimer);
      cancelAnimationFrame(curveRaf);
    };
  }, []);

  // ─── Responsive graph dimensions ───
  const availH = height - topPad - bottomPad;
  const graphH = Math.round(availH * (isNarrowHeight ? 0.32 : 0.36));
  const graphW = Math.min(pageWidth - 48, 380);
  const padX = 28;
  const padTop = 20;
  const padBottom = 26;
  const graphTotalH = graphH + 20;

  // Build the full SVG path for the curve
  const fullPath = useMemo(() => {
    const steps = 100;
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const { x, y } = curvePoint(t, graphW, graphH, padX, padTop, padBottom);
      d += i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : ` L${x.toFixed(1)},${y.toFixed(1)}`;
    }
    return d;
  }, [graphW, graphH]);

  // Milestone positions
  const milestonePos = useMemo(
    () =>
      MILESTONES.map(m => {
        const t = (m.day - 1) / 76;
        return { ...m, ...curvePoint(t, graphW, graphH, padX, padTop, padBottom), t };
      }),
    [graphW, graphH],
  );

  // Clip width for curve draw animation
  const clipW = padX + curveProgress * (graphW - 2 * padX) + 6;

  // ─── Annotation positions (contextual to curve) ───
  // "This is where most people quit." — ABOVE the early flat portion, between Day 1 and Day 20
  const midEarlyX = (milestonePos[0].x + milestonePos[1].x) / 2;
  const quitTop = Math.max(milestonePos[0].y - 42, 2);
  const quitLeft = midEarlyX - 50;
  // "Keep going." — near Day 40–50 where curve begins bending
  const bendX = milestonePos[2].x + (milestonePos[3].x - milestonePos[2].x) * 0.15;
  const bendY = milestonePos[2].y - (milestonePos[2].y - milestonePos[3].y) * 0.08;
  const keepTop = Math.max(bendY - 40, 2);
  const keepLeft = bendX - 52;
  // "GREATNESS COMPOUNDS." — slightly LEFT and ABOVE the final steep section
  const greatnessTop = Math.max(milestonePos[3].y - 62, 2);
  const greatnessRight = graphW - milestonePos[3].x + 50;

  const headlineStyle = useAnimatedStyle(() => ({ opacity: headlineOpacity.value }));
  const subStyle = useAnimatedStyle(() => ({ opacity: subOpacity.value }));
  const quitStyle = useAnimatedStyle(() => ({ opacity: quitOpacity.value }));
  const keepGoingStyle = useAnimatedStyle(() => ({ opacity: keepGoingOpacity.value }));
  const greatnessStyle = useAnimatedStyle(() => ({ opacity: greatnessOpacity.value }));
  const challengeStyle = useAnimatedStyle(() => ({
    opacity: challengeOpacity.value,
    transform: [{ scale: interpolate(challengeScale.value, [0, 1], [0.92, 1], Extrapolation.CLAMP) }],
  }));
  const challengeSubStyle = useAnimatedStyle(() => ({ opacity: challengeSubOpacity.value }));
  const ctaAnimatedStyle = useAnimatedStyle(() => ({ opacity: ctaOpacity.value }));

  // Day 77 dot animated style
  const dot77Style = useAnimatedStyle(() => ({
    opacity: dot77Opacity.value,
    transform: [{ scale: interpolate(dot77Scale.value, [0, 1.5, 1], [0, 1.5, 1], Extrapolation.CLAMP) }],
  }));

  const challengeFontSize = isNarrowHeight ? 36 : isSmall ? 38 : 40;

  // Pagination dots — matching InputsConceptScreen style (3 dots, 3rd active)
  const paginationDots = useMemo(() => {
    return Array.from({ length: 3 }, (_, i) => (
      <View
        key={i}
        style={[
          styles.progressDot,
          i === 2 ? styles.progressDotActive : styles.progressDotInactive,
        ]}
      />
    ));
  }, []);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.content,
          { paddingTop: topPad, paddingBottom: bottomPad, maxWidth: maxContentWidth, alignSelf: 'center' },
        ]}>
        {/* ─── HERO (~15%) ─── */}
        <Animated.View style={[styles.heroWrap, headlineStyle]}>
          <Text style={styles.headline}>
            <Text style={styles.textWhite}>SMALL INPUTS.</Text>
            {'\n'}
            <Text style={styles.textLime}>EXPONENTIAL LIFE.</Text>
          </Text>
        </Animated.View>
        <Animated.View style={subStyle}>
          <Text style={styles.subText}>Do your Success Stack. Every day.</Text>
        </Animated.View>

        {/* ─── GRAPH (~40%) — the hero visual ─── */}
        <View style={styles.graphSection}>
          <View style={[styles.graphWrap, { width: graphW, height: graphTotalH }]}>
            <Svg width={graphW} height={graphTotalH}>
              <Defs>
                <Filter id="limeGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </Filter>
                <Filter id="limeGlowStrong" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </Filter>
                <ClipPath id="curveClip">
                  <Rect x={0} y={0} width={clipW} height={graphTotalH} />
                </ClipPath>
              </Defs>

              {/* Baseline */}
              <Line
                x1={padX}
                y1={graphH - padBottom}
                x2={graphW - padX}
                y2={graphH - padBottom}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />

              {/* Animated exponential curve (clipped for draw effect) — glow built from
                  stacked translucent strokes instead of an SVG blur filter, since filters
                  render inconsistently (visible box artifacts) across platforms in
                  react-native-svg */}
              <Path d={fullPath} stroke={LIME} strokeWidth={10} strokeOpacity={0.12} fill="none" strokeLinecap="round" strokeLinejoin="round" clipPath="url(#curveClip)" />
              <Path d={fullPath} stroke={LIME} strokeWidth={6} strokeOpacity={0.22} fill="none" strokeLinecap="round" strokeLinejoin="round" clipPath="url(#curveClip)" />
              <Path d={fullPath} stroke={LIME} strokeWidth={3.5} strokeOpacity={0.35} fill="none" strokeLinecap="round" strokeLinejoin="round" clipPath="url(#curveClip)" />
              <Path d={fullPath} stroke={LIME} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" clipPath="url(#curveClip)" />

              {/* Milestone dots 0–2 (standard) */}
              {milestonePos.slice(0, 3).map((m, i) =>
                visibleMilestones > i ? (
                  <Circle
                    key={`dot-${m.day}`}
                    cx={m.x}
                    cy={m.y}
                    r={3.5}
                    fill={WHITE}
                    stroke={LIME}
                    strokeWidth={1.5}
                  />
                ) : null,
              )}

              {/* Day 77 dot — larger, with strong glow, pulses on reveal */}
              {visibleMilestones > 3 &&
                (() => {
                  const m = milestonePos[3];
                  return (
                    <>
                      {/* Outer glow ring */}
                      <Animated.View
                        key="dot77-glow"
                        style={[
                          {
                            position: 'absolute',
                            left: m.x - 16,
                            top: m.y - 16,
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: LIME,
                          },
                          dot77Style,
                        ]}
                        pointerEvents="none"
                      />
                      <Circle
                        key="dot77"
                        cx={m.x}
                        cy={m.y}
                        r={6}
                        fill={LIME}
                        stroke={LIME}
                        strokeWidth={1.5}
                        filter="url(#limeGlowStrong)"
                      />
                    </>
                  );
                })()}

              {/* Day labels along bottom */}
              {milestonePos.map((m, i) =>
                visibleMilestones > i ? (
                  <SvgText
                    key={`label-${m.day}`}
                    x={m.x}
                    y={graphH - padBottom + 16}
                    fontSize={9}
                    fill={MUTED}
                    fontFamily="Inter-Bold"
                    fontWeight="700"
                    textAnchor="middle">
                    {m.label}
                  </SvgText>
                ) : null,
              )}
            </Svg>

            {/* Handwritten annotations — positioned contextually around curve */}
            {/* "This is where most people quit." — ABOVE the flat early portion, arrow points DOWN */}
            <Animated.View
              style={[styles.annotationQuit, { top: quitTop, left: quitLeft }, quitStyle]}
              pointerEvents="none">
              <Text style={styles.handwrittenText}>This is where</Text>
              <Text style={styles.handwrittenText}>most people quit.</Text>
              <Text style={styles.handwrittenArrowDown}>↓</Text>
            </Animated.View>

            {/* "Keep going." — near the Day 40–50 bend, arrow points DOWN toward the curve */}
            <Animated.View
              style={[styles.annotationKeep, { top: keepTop, left: keepLeft }, keepGoingStyle]}
              pointerEvents="none">
              <Text style={styles.handwrittenText}>Keep going.</Text>
              <Text style={styles.handwrittenArrowDown}>↓</Text>
            </Animated.View>

            {/* "GREATNESS COMPOUNDS." — left and above the final steep section, arrow points toward Day 77 */}
            <Animated.View
              style={[styles.annotationGreatness, { top: greatnessTop, right: greatnessRight }, greatnessStyle]}
              pointerEvents="none">
              <Text style={[styles.handwrittenTextLime, { fontSize: 15 }]}>GREATNESS</Text>
              <Text style={[styles.handwrittenTextLime, { fontSize: 15 }]}>COMPOUNDS.</Text>
              <Text style={styles.handwrittenArrowRight}>→</Text>
            </Animated.View>
          </View>
        </View>

        {/* ─── 77 DAY CHALLENGE reveal (~25%) — second major visual moment ─── */}
        <View style={styles.challengeSection}>
          <Animated.View style={[styles.challengeWrap, challengeStyle]}>
            <Text style={styles.theLabel}>THE</Text>
            <Text style={[styles.challengeHeadline, { fontSize: challengeFontSize }]}>
              <Text style={styles.textLime}>77 DAY</Text>
              {'\n'}
              <Text style={[styles.textWhite, { fontSize: challengeFontSize * 0.92 }]}>CHALLENGE</Text>
            </Text>
          </Animated.View>
          <Animated.View style={[styles.challengeSubWrap, challengeSubStyle]}>
            <Text style={styles.challengeSub}>77 days. Your Success Stack. Every day.</Text>
            <Text style={styles.challengeMuted}>Long enough to build proof.</Text>
            <Text style={styles.challengeMuted}>Short enough to start today.</Text>
          </Animated.View>
        </View>

        {/* ─── CTA (~15-20%) — anchored to bottom with intentional breathing room ─── */}
        <View style={styles.ctaSection}>
          {/* Pagination dots — matching Screen 2 style, 3rd dot active */}
          <View style={styles.paginationWrap}>
            {paginationDots}
          </View>
          <Animated.View style={[styles.ctaWrap, ctaAnimatedStyle]}>
            <TouchableOpacity style={styles.primaryButton} onPress={onContinue} activeOpacity={0.85}>
              <Text style={styles.primaryText}>Show me how →</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Hero
  heroWrap: {
    alignItems: 'center',
    marginTop: 2,
  },
  headline: {
    fontFamily: 'Inter-Black',
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 38,
    letterSpacing: 0.3,
  },
  textWhite: {
    color: WHITE,
  },
  textLime: {
    color: LIME,
  },
  subText: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    fontWeight: '700',
    color: MUTED,
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 0.2,
  },
  // Graph section
  graphSection: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 18,
  },
  graphWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  // Annotations
  annotationQuit: {
    position: 'absolute',
    alignItems: 'center',
  },
  annotationKeep: {
    position: 'absolute',
    alignItems: 'center',
  },
  annotationGreatness: {
    position: 'absolute',
    alignItems: 'center',
  },
  handwrittenText: {
    fontFamily: 'Northwell',
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 17,
    textAlign: 'center',
  },
  handwrittenTextLime: {
    fontFamily: 'Northwell',
    color: LIME,
    lineHeight: 18,
    textAlign: 'center',
  },
  handwrittenArrow: {
    fontFamily: 'Northwell',
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    marginLeft: 4,
    marginTop: -2,
  },
  handwrittenArrowDown: {
    fontFamily: 'Northwell',
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    marginTop: -2,
    textAlign: 'center',
  },
  handwrittenArrowRight: {
    fontFamily: 'Northwell',
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    marginTop: -2,
    textAlign: 'center',
  },
  // Challenge section
  challengeSection: {
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 2,
  },
  challengeWrap: {
    alignItems: 'center',
  },
  theLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 3,
    marginBottom: 4,
  },
  challengeHeadline: {
    fontFamily: 'Inter-Black',
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 46,
    letterSpacing: 0.3,
    paddingHorizontal: 28,
  },
  challengeSubWrap: {
    alignItems: 'center',
    marginTop: 14,
  },
  challengeSub: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
    fontWeight: '700',
    color: WHITE,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  challengeMuted: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    fontWeight: '700',
    color: MUTED,
    textAlign: 'center',
    marginTop: 3,
  },
  // CTA section
  ctaSection: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 2,
  },
  paginationWrap: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
    alignItems: 'center',
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  progressDotActive: {
    backgroundColor: LIME,
  },
  progressDotInactive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  ctaWrap: {
    width: '100%',
    paddingHorizontal: 26,
  },
  primaryButton: {
    backgroundColor: LIME,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: 'Inter-Black',
    fontSize: 17,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.3,
  },
});
