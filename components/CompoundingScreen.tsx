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
import Svg, { Path, Circle, Line, Defs, Text as SvgText, Rect, ClipPath } from 'react-native-svg';

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

// One smooth continuous exponential curve — no piecewise segments, no elbows.
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

  // Normalized continuous exponential — flat for a long time, then dramatic rise
  const k = 5.0;
  const yNorm = (Math.exp(k * progress) - 1) / (Math.exp(k) - 1);

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
  const graphH = Math.round(availH * (isNarrowHeight ? 0.34 : 0.38));
  const graphW = Math.min(pageWidth - 32, 410);
  const padX = 28;
  const padTop = 20;
  const padBottom = 26;
  const graphTotalH = graphH + 24;

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
  const quitTop = Math.max(milestonePos[0].y - 52, 2);
  const quitLeft = midEarlyX - 55;
  // "Keep going." — near Day 40–50 where curve begins bending
  const bendX = milestonePos[2].x + (milestonePos[3].x - milestonePos[2].x) * 0.15;
  const bendY = milestonePos[2].y - (milestonePos[2].y - milestonePos[3].y) * 0.08;
  const keepTop = Math.max(bendY - 46, 2);
  const keepLeft = bendX - 52;
  // "GREATNESS COMPOUNDS." — to the LEFT and ABOVE the Day 77 endpoint
  const greatnessTop = Math.max(milestonePos[3].y - 72, 2);
  const greatnessRight = graphW - milestonePos[3].x + 56;

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

  const headlineFontSize = isNarrowHeight ? 32 : isSmall ? 34 : 36;
  const challenge77FontSize = isNarrowHeight ? 42 : isSmall ? 44 : 48;
  const challengeWordFontSize = isNarrowHeight ? 38 : isSmall ? 40 : 44;

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
          <Text style={[styles.headline, { fontSize: headlineFontSize, lineHeight: headlineFontSize * 1.02 }]}>
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

              {/* Soft atmospheric lime glow — broad translucent halos below one crisp line */}
              <Path d={fullPath} stroke={LIME} strokeWidth={18} strokeOpacity={0.035} fill="none" strokeLinecap="round" strokeLinejoin="round" clipPath="url(#curveClip)" />
              <Path d={fullPath} stroke={LIME} strokeWidth={12} strokeOpacity={0.06} fill="none" strokeLinecap="round" strokeLinejoin="round" clipPath="url(#curveClip)" />
              <Path d={fullPath} stroke={LIME} strokeWidth={7} strokeOpacity={0.12} fill="none" strokeLinecap="round" strokeLinejoin="round" clipPath="url(#curveClip)" />
              <Path d={fullPath} stroke={LIME} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" clipPath="url(#curveClip)" />

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

              {/* Day 77 dot — luminous endpoint with soft layered glow */}
              {visibleMilestones > 3 &&
                (() => {
                  const m = milestonePos[3];
                  return (
                    <>
                      {/* Large faint halo */}
                      <Circle cx={m.x} cy={m.y} r={24} fill={LIME} opacity={0.04} />
                      {/* Medium halo */}
                      <Circle cx={m.x} cy={m.y} r={16} fill={LIME} opacity={0.08} />
                      {/* Pulsing glow ring */}
                      <Animated.View
                        key="dot77-glow"
                        style={[
                          {
                            position: 'absolute',
                            left: m.x - 14,
                            top: m.y - 14,
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: LIME,
                          },
                          dot77Style,
                        ]}
                        pointerEvents="none"
                      />
                      {/* Bright center dot */}
                      <Circle cx={m.x} cy={m.y} r={7} fill={LIME} stroke={WHITE} strokeWidth={1.5} />
                    </>
                  );
                })()}

              {/* Day labels along bottom */}
              {milestonePos.map((m, i) =>
                visibleMilestones > i ? (
                  <SvgText
                    key={`label-${m.day}`}
                    x={m.x}
                    y={graphH - padBottom + 18}
                    fontSize={11}
                    fill={i === 3 ? LIME : MUTED}
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
              <Text style={[styles.handwrittenTextLime, { fontSize: 17 }]}>GREATNESS</Text>
              <Text style={[styles.handwrittenTextLime, { fontSize: 17 }]}>COMPOUNDS.</Text>
              <Text style={styles.handwrittenArrowRight}>→</Text>
            </Animated.View>
          </View>
        </View>

        {/* ─── 77 DAY CHALLENGE reveal (~25%) — second major visual moment ─── */}
        <View style={styles.challengeSection}>
          <Animated.View style={[styles.challengeWrap, challengeStyle]}>
            <Text style={styles.theLabel}>THE</Text>
            <Text style={[styles.challengeHeadline, { fontSize: challenge77FontSize, lineHeight: challenge77FontSize * 1.02 }]}>
              <Text style={styles.textLime}>77 DAY</Text>
              {'\n'}
              <Text style={[styles.textWhite, { fontSize: challengeWordFontSize, lineHeight: challengeWordFontSize * 1.02 }]}>CHALLENGE</Text>
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
          <Animated.View style={[styles.ctaWrap, ctaAnimatedStyle]}>
            <TouchableOpacity style={styles.primaryButton} onPress={onContinue} activeOpacity={0.85}>
              <Text style={styles.primaryText}>Show me how →</Text>
            </TouchableOpacity>
          </Animated.View>
          {/* Pagination dots — below CTA, matching Screen 2 style, 3rd dot active */}
          <View style={styles.paginationWrap}>
            {paginationDots}
          </View>
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
  },
  // Hero
  heroWrap: {
    alignItems: 'center',
    marginTop: 2,
  },
  headline: {
    fontFamily: 'Inter-Black',
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0,
  },
  textWhite: {
    color: WHITE,
  },
  textLime: {
    color: LIME,
  },
  subText: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    fontWeight: '700',
    color: MUTED,
    textAlign: 'center',
    marginTop: 10,
    letterSpacing: 0.2,
  },
  // Graph section
  graphSection: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 36,
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
    fontSize: 16,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 19,
    textAlign: 'center',
  },
  handwrittenTextLime: {
    fontFamily: 'Northwell',
    color: LIME,
    lineHeight: 20,
    textAlign: 'center',
  },
  handwrittenArrow: {
    fontFamily: 'Northwell',
    fontSize: 18,
    color: 'rgba(255,255,255,0.5)',
    marginLeft: 4,
    marginTop: -2,
  },
  handwrittenArrowDown: {
    fontFamily: 'Northwell',
    fontSize: 18,
    color: 'rgba(255,255,255,0.5)',
    marginTop: -2,
    textAlign: 'center',
  },
  handwrittenArrowRight: {
    fontFamily: 'Northwell',
    fontSize: 18,
    color: 'rgba(255,255,255,0.5)',
    marginTop: -2,
    textAlign: 'center',
  },
  // Challenge section
  challengeSection: {
    alignItems: 'center',
    marginTop: 48,
  },
  challengeWrap: {
    alignItems: 'center',
  },
  theLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 3,
    marginBottom: 4,
  },
  challengeHeadline: {
    fontFamily: 'Inter-Black',
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0,
    paddingHorizontal: 28,
  },
  challengeSubWrap: {
    alignItems: 'center',
    marginTop: 16,
  },
  challengeSub: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
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
    marginTop: 4,
  },
  // CTA section
  ctaSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 24,
  },
  paginationWrap: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
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
