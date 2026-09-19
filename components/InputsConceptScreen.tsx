import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import ExampleCard from './ExampleCard';

const LIME = '#CCFF00';
const WHITE = '#FFFFFF';
const MUTED = '#8D8D8F';
const BG = '#050505';

type Props = {
  onContinue: () => void;
  onBack: () => void;
};

export default function InputsConceptScreen({ onContinue }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [activeIndex, setActiveIndex] = useState(0);
  const [completedExamples, setCompletedExamples] = useState<Set<number>>(new Set());
  const scrollRef = useRef<ScrollView>(null);

  // Shared horizontal swipe progress (0 = page 1, 1 = page 2)
  const swipeProgress = useSharedValue(0);

  // Swipe-left discovery cue — appears after Example 1 completes and before user swipes
  const swipeCueOpacity = useSharedValue(0);
  const swipeCueTranslateX = useSharedValue(0);
  const swipeCuePulse = useSharedValue(0);
  const ctaOpacity = useSharedValue(0);

  const isNarrowHeight = height < 700;
  const topPad = insets.top + (isNarrowHeight ? 14 : 20);
  const bottomPad = insets.bottom + 12;
  const pageWidth = width;

  const handleExampleCompleted = useCallback((idx: number) => {
    setCompletedExamples((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  }, []);

  // When Example 1 (index 0) completes, show the swipe-left discovery cue
  React.useEffect(() => {
    if (completedExamples.has(0) && activeIndex === 0) {
      swipeCueOpacity.value = withDelay(
        600,
        withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
      );
      swipeCuePulse.value = withDelay(
        1000,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        ),
      );
    }
  }, [completedExamples, activeIndex]);

  // Show CTA once the active example is completed
  React.useEffect(() => {
    if (completedExamples.has(activeIndex)) {
      ctaOpacity.value = withDelay(
        500,
        withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
      );
    } else {
      ctaOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [completedExamples, activeIndex]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      swipeProgress.value = x / pageWidth;
    },
    [pageWidth],
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / pageWidth);
      setActiveIndex(idx);
      // Hide the swipe cue once the user has swiped
      if (idx !== 0) {
        swipeCueOpacity.value = withTiming(0, { duration: 250 });
      }
    },
    [pageWidth],
  );

  const swipeCueStyle = useAnimatedStyle(() => ({
    opacity: swipeCueOpacity.value,
    transform: [
      {
        translateX: interpolate(swipeCuePulse.value, [0, 1], [0, 20], Extrapolation.CLAMP),
      },
    ],
  }));

  const ctaAnimatedStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
  }));

  const totalExamples = 2;

  const dots = useMemo(() => {
    return Array.from({ length: 3 }, (_, i) => {
      // 3 dots: Screen 1 (inactive), Screen 2 (the active page within this screen), Screen 3 (inactive)
      // The middle dot should reflect the active example
      if (i === 1) {
        return (
          <View
            key={i}
            style={[styles.progressDot, activeIndex === 0 ? styles.progressDotActive : styles.progressDotInactive]}
          />
        );
      }
      return <View key={i} style={styles.progressDot} />;
    });
  }, [activeIndex]);

  return (
    <View style={styles.container}>
      <View style={[styles.content, { paddingTop: topPad, paddingBottom: bottomPad }]}>
        {/* Example area — horizontal pager */}
        <View style={styles.exampleArea}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={onScroll}
            onMomentumScrollEnd={onMomentumScrollEnd}
            scrollToOverflowEnabled
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            {Array.from({ length: totalExamples }, (_, i) => (
              <ExampleCard
                key={i}
                index={i}
                isActive={activeIndex === i}
                onCompleted={() => handleExampleCompleted(i)}
                swipeProgress={swipeProgress}
                pageWidth={pageWidth}
              />
            ))}
          </ScrollView>

          {/* Swipe-left discovery cue overlay — shown after Example 1 completes */}
          {activeIndex === 0 && completedExamples.has(0) && (
            <Animated.View style={[styles.swipeCueWrap, swipeCueStyle]} pointerEvents="none">
              <Text style={styles.swipeCueText}>SWIPE FOR ANOTHER EXAMPLE →</Text>
            </Animated.View>
          )}
        </View>

        {/* Bottom area */}
        <View style={styles.bottomArea}>
          <View style={styles.progressWrap}>
            {dots}
          </View>

          <Animated.View style={[styles.ctaWrap, ctaAnimatedStyle]}>
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
  exampleArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
  },
  swipeCueWrap: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    alignItems: 'center',
  },
  swipeCueText: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    fontWeight: '700',
    color: LIME,
    letterSpacing: 2.5,
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
  progressDotInactive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
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
