import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Compass, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BEAT_HEIGHT = SCREEN_HEIGHT * 0.78;
const TOTAL_BEATS = 6;

interface Props {
  onComplete: () => void;
}

export default function CompassStoryScreen({ onComplete }: Props) {
  const { colors, isDark } = useTheme();
  const [visibleBeats, setVisibleBeats] = useState<boolean[]>(
    Array(TOTAL_BEATS).fill(false).map((_, i) => i === 0)
  );
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const buttonOpacity = useSharedValue(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollY = e.nativeEvent.contentOffset.y;
    const newVisible = Array(TOTAL_BEATS).fill(false).map((_, i) => {
      if (i === 0) return true;
      const threshold = (i - 0.5) * BEAT_HEIGHT;
      return scrollY >= threshold;
    });
    setVisibleBeats(newVisible);

    const totalContentHeight = BEAT_HEIGHT * TOTAL_BEATS;
    const viewportHeight = e.nativeEvent.layoutMeasurement.height;
    const isAtEnd = scrollY + viewportHeight >= totalContentHeight - 80;
    if (isAtEnd && !hasReachedEnd) {
      setHasReachedEnd(true);
      buttonOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) });
    }
  };

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: (1 - buttonOpacity.value) * 16 }],
  }));

  const BeatView = ({ index, children }: { index: number; children: React.ReactNode }) => {
    const isVisible = visibleBeats[index];
    return (
      <Animated.View
        style={[
          styles.beat,
          {
            opacity: isVisible ? 1 : 0,
            transform: [{ translateY: isVisible ? 0 : 24 }],
          },
        ]}
      >
        {children}
      </Animated.View>
    );
  };

  return (
    <View style={styles.outer}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
      >
        <BeatView index={0}>
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBadge}
          >
            <Compass size={32} color="#000000" strokeWidth={2.5} />
          </LinearGradient>
          <Text style={[styles.title, { color: colors.text }]}>The Compass</Text>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            OLYMPICS · SYDNEY 2000
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            The British Men's Eight rowing team hadn't won Olympic gold in{' '}
            <Text style={[styles.bodyBold, { color: colors.text }]}>88 years.</Text>
          </Text>
          <Text style={[styles.scrollHint, { color: colors.textTertiary }]}>
            Scroll to continue ↓
          </Text>
        </BeatView>

        <BeatView index={1}>
          <Text style={[styles.beatLabel, { color: colors.primary }]}>THE DECISION</Text>
          <Text style={[styles.largeLine, { color: colors.text }]}>
            They made one decision that changed everything.
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Every choice — training, diet, sleep, relationships — got run through a single question:
          </Text>
        </BeatView>

        <BeatView index={2}>
          <View style={[styles.quoteCard, {
            borderColor: colors.primary,
            backgroundColor: 'transparent',
          }]}>
            <Text style={[styles.quoteText, { color: colors.primary }]}>
              "Will it make{'\n'}the boat go faster?"
            </Text>
          </View>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Not "is it fun?" Not "do I feel like it?"{'\n'}One question. Every time.
          </Text>
        </BeatView>

        <BeatView index={3}>
          <Text style={[styles.beatLabel, { color: colors.primary }]}>THE RULE</Text>
          <View style={styles.ruleRow}>
            <View style={[styles.ruleChip, { backgroundColor: colors.primary }]}>
              <Text style={styles.ruleChipText}>YES</Text>
            </View>
            <Text style={[styles.ruleText, { color: colors.text }]}>Do it. Full commitment.</Text>
          </View>
          <View style={styles.ruleRow}>
            <View style={[styles.ruleChip, { backgroundColor: isDark ? colors.backgroundSecondary : '#DDD' }]}>
              <Text style={[styles.ruleChipText, { color: isDark ? '#888' : '#666' }]}>NO</Text>
            </View>
            <Text style={[styles.ruleText, { color: colors.text }]}>Cut it. No exceptions.</Text>
          </View>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Simple enough to use under pressure. Powerful enough to change everything.
          </Text>
        </BeatView>

        <BeatView index={4}>
          <View style={styles.winCard}>
            <Image
              source={require('@/assets/images/maxresdefault_(1).jpg')}
              style={styles.winImage}
              resizeMode="cover"
            />
          </View>
          <View style={styles.winBadge}>
            <Text style={styles.winBadgeText}>SYDNEY 2000</Text>
          </View>
          <Text style={[styles.winTitle, { color: colors.text }]}>They Won Gold.</Text>
          <Text style={[styles.winSub, { color: colors.textSecondary }]}>
            88 years of drought. Ended by one question.
          </Text>
        </BeatView>

        <BeatView index={5}>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            People who win aren't smarter. They just stopped saying yes to things that don't move them forward.
          </Text>
          <Text style={[styles.closerBold, { color: colors.text }]}>
            That simple question became the compass that led them to Gold.
          </Text>

          <Animated.View style={buttonStyle}>
            <TouchableOpacity
              onPress={onComplete}
              activeOpacity={0.9}
              style={styles.button}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Build My Compass</Text>
                <ArrowRight size={20} color="#000" strokeWidth={2.5} />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </BeatView>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  beat: {
    minHeight: BEAT_HEIGHT,
    paddingVertical: 32,
    gap: 20,
    justifyContent: 'center',
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 46,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  body: {
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 28,
  },
  bodyBold: {
    fontWeight: '800',
  },
  scrollHint: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
  },
  beatLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  largeLine: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  quoteCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 28,
  },
  quoteText: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 38,
    fontStyle: 'italic',
    letterSpacing: -0.5,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ruleChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 54,
    alignItems: 'center',
  },
  ruleChipText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  ruleText: {
    fontSize: 17,
    fontWeight: '600',
  },
  winCard: {
    borderRadius: 24,
    overflow: 'hidden',
    height: 300,
  },
  winImage: {
    width: '100%',
    height: '100%',
  },
  winBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(210,255,0,0.9)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  winBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1.5,
  },
  winTitle: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 38,
  },
  winSub: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  closerBold: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000',
    letterSpacing: -0.3,
  },
  bottomSpacer: {
    height: 40,
  },
});
