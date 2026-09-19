import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import ExamplePanel from './ExamplePanel';
import type { ExampleConfig } from './ExamplePanel';

const LIME = '#CCFF00';
const WHITE = '#FFFFFF';
const MUTED = '#8D8D8D';
const BG = '#050505';

const EASE_OUT = Easing.out(Easing.cubic);

const EXAMPLES: ExampleConfig[] = [
  {
    id: 'health',
    category: 'GOAL',
    goal: 'LOSE 20 LBS.',
    inputs: [
      { num: '01', text: '145g protein/day' },
      { num: '02', text: '10,000 steps/day' },
      { num: '03', text: '45 min strength training' },
      { num: '04', text: 'Whole foods. No sugar.' },
    ],
  },
  {
    id: 'business',
    category: 'GOAL',
    goal: 'MAKE $100K/MONTH',
    mathSteps: [
      '$20K PROFIT / DEAL',
      '5 DEALS / MONTH',
      '1 DEAL / 10 OFFERS',
      '≈ 3 OFFERS / BUSINESS DAY',
    ],
    inputs: [
      { num: '01', text: '3 offers/day' },
    ],
  },
  {
    id: 'french',
    category: 'GOAL',
    goal: 'BECOME FLUENT IN FRENCH',
    inputs: [
      { num: '01', text: '30 min French app' },
      { num: '02', text: '30 min French podcast' },
      { num: '03', text: '15 min speaking practice' },
      { num: '04', text: '10 new words/day' },
    ],
  },
];

type Props = {
  onContinue: () => void;
  onBack: () => void;
};

export default function InputsConceptScreen({ onContinue }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const [completedExamples, setCompletedExamples] = useState<Set<number>>(new Set());
  const [hasSwiped, setHasSwiped] = useState(false);

  const isSmall = width <= 375;
  const isNarrowHeight = height < 700;

  // Swipe transition
  const translateX = useSharedValue(0);
  const isAnimating = useRef(false);

  // Swipe cue
  const swipeCueOpacity = useSharedValue(0);
  const swipeCuePulse = useSharedValue(1);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const threshold = width * 0.2;
      if (e.translationX < -threshold && activeIndex < EXAMPLES.length - 1) {
        // Swipe left → next
        isAnimating.current = true;
        translateX.value = withTiming(-width, { duration: 350, easing: EASE_OUT }, () => {
          setActiveIndex(activeIndex + 1);
          translateX.value = width;
          translateX.value = withTiming(0, { duration: 0 });
          isAnimating.current = false;
        });
      } else if (e.translationX > threshold && activeIndex > 0) {
        // Swipe right → previous
        isAnimating.current = true;
        translateX.value = withTiming(width, { duration: 350, easing: EASE_OUT }, () => {
          setActiveIndex(activeIndex - 1);
          translateX.value = -width;
          translateX.value = withTiming(0, { duration: 0 });
          isAnimating.current = false;
        });
      } else {
        translateX.value = withTiming(0, { duration: 250, easing: EASE_OUT });
      }
    });

  const handleSequenceComplete = useCallback(() => {
    setCompletedExamples((prev) => {
      const next = new Set(prev);
      next.add(activeIndex);
      return next;
    });
  }, [activeIndex]);

  // Show swipe cue after example 1 completes (and only once)
  React.useEffect(() => {
    if (completedExamples.has(0) && !hasSwiped && activeIndex === 0) {
      const t = setTimeout(() => {
        swipeCueOpacity.value = withTiming(1, { duration: 400, easing: EASE_OUT });
        swipeCuePulse.value = withRepeat(
          withSequence(
            withTiming(0.4, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        );
      }, 900);
      return () => clearTimeout(t);
    }
  }, [completedExamples, hasSwiped, activeIndex]);

  // Hide swipe cue when user swipes
  React.useEffect(() => {
    if (hasSwiped) {
      swipeCueOpacity.value = withTiming(0, { duration: 300, easing: EASE_OUT });
    }
  }, [hasSwiped]);

  // Track if user has swiped at all
  React.useEffect(() => {
    if (activeIndex > 0) setHasSwiped(true);
  }, [activeIndex]);

  const allComplete = completedExamples.size === EXAMPLES.length;

  const carouselStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const swipeCueStyle = useAnimatedStyle(() => ({
    opacity: swipeCueOpacity.value,
  }));

  const swipeCueArrowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(swipeCuePulse.value, [0.4, 1], [0.5, 1], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(swipeCuePulse.value, [0.4, 1], [-6, 0], Extrapolation.CLAMP) }],
  }));

  const topPad = insets.top + (isNarrowHeight ? 14 : 20);
  const bottomPad = insets.bottom + 12;

  // CTA opacity — only show after all examples complete
  const ctaOpacity = useSharedValue(0);
  React.useEffect(() => {
    if (allComplete) {
      ctaOpacity.value = withTiming(1, { duration: 500, easing: EASE_OUT });
    }
  }, [allComplete]);

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        <View style={[styles.content, { paddingTop: topPad, paddingBottom: bottomPad }]}>
          {/* Carousel — render all panels, translate horizontally */}
          <View style={styles.carouselContainer}>
            <Animated.View style={[styles.carouselTrack, carouselStyle]}>
              {EXAMPLES.map((config, i) => (
                <View key={config.id} style={styles.panelSlot}>
                  <ExamplePanel
                    config={config}
                    isActive={i === activeIndex}
                    isSmall={isSmall}
                    isNarrowHeight={isNarrowHeight}
                    onSequenceComplete={handleSequenceComplete}
                  />
                </View>
              ))}
            </Animated.View>
          </View>

          {/* Swipe cue — appears after example 1 completes */}
          {activeIndex === 0 && !hasSwiped && (
            <Animated.View style={[styles.swipeCueWrap, swipeCueStyle]} pointerEvents="none">
              <Animated.View style={swipeCueArrowStyle}>
                <Text style={styles.swipeCueArrow}>←</Text>
              </Animated.View>
              <Text style={styles.swipeCueLabel}>SWIPE FOR ANOTHER EXAMPLE</Text>
            </Animated.View>
          )}

          {/* Bottom area */}
          <View style={styles.bottomArea}>
            {/* Pagination dots */}
            <View style={styles.progressWrap}>
              {EXAMPLES.map((_, i) => (
                <View
                  key={i}
                  style={[styles.progressDot, i === activeIndex && styles.progressDotActive]}
                />
              ))}
            </View>

            {/* CTA — appears after all examples complete */}
            <Animated.View style={[styles.ctaWrap, ctaStyle]}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={onContinue}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryText}>Show me how →</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 26,
  },
  carouselContainer: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  carouselTrack: {
    flex: 1,
    flexDirection: 'row',
  },
  panelSlot: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeCueWrap: {
    position: 'absolute',
    bottom: 140,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swipeCueArrow: {
    fontFamily: 'Inter-Black',
    fontSize: 16,
    color: LIME,
  },
  swipeCueLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 2,
  },
  bottomArea: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    paddingTop: 8,
  },
  progressWrap: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 10,
    alignItems: 'center',
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  progressDotActive: {
    backgroundColor: LIME,
  },
  ctaWrap: {
    width: '100%',
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
