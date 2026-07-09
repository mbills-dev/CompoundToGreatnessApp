import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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
import { Flame, Compass, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BEAT_HEIGHT = SCREEN_HEIGHT * 0.82;

interface Props {
  identityStatement: string;
  inputs: string[];
  filterQuestion: string;
  onContinue: () => void;
}

export default function CommitScreen({ identityStatement, inputs, filterQuestion, onContinue }: Props) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  const firstName = user?.user_metadata?.first_name || 'You';

  const TOTAL_BEATS = 5;
  const [visibleBeats, setVisibleBeats] = useState<boolean[]>(
    Array(TOTAL_BEATS).fill(false).map((_, i) => i === 0)
  );
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const buttonOpacity = useSharedValue(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollY = e.nativeEvent.contentOffset.y;
    const newVisible = Array(TOTAL_BEATS).fill(false).map((_, i) => {
      if (i === 0) return true;
      const threshold = (i - 0.45) * BEAT_HEIGHT;
      return scrollY >= threshold;
    });
    setVisibleBeats(newVisible);

    const totalContentHeight = BEAT_HEIGHT * TOTAL_BEATS;
    const viewportHeight = e.nativeEvent.layoutMeasurement.height;
    const isAtEnd = scrollY + viewportHeight >= totalContentHeight - 100;
    if (isAtEnd && !hasReachedEnd) {
      setHasReachedEnd(true);
      buttonOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) });
    }
  };

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: (1 - buttonOpacity.value) * 20 }],
  }));

  const BeatView = ({ index, children }: { index: number; children: React.ReactNode }) => {
    const isVisible = visibleBeats[index];
    return (
      <View
        style={[
          styles.beat,
          {
            opacity: isVisible ? 1 : 0,
            transform: [{ translateY: isVisible ? 0 : 28 }],
          },
        ]}
      >
        {children}
      </View>
    );
  };

  const sentences = identityStatement
    .split(/\.\s*/)
    .filter(s => s.trim().length > 0)
    .map(s => s.trim().endsWith('.') ? s.trim() : s.trim() + '.');

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
            <Flame size={32} color="#000000" strokeWidth={2.5} />
          </LinearGradient>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            CONGRATULATIONS!
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            Your Goals Just Became Inevitable.
          </Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            Average people chase outcomes. You just built the system that delivers them.
          </Text>
          <Text style={[styles.goodbyeText, { color: colors.primary }]}>
            SAY GOODBYE TO AVERAGE
          </Text>
          <Text style={[styles.scrollHint, { color: colors.primary }]}>
            Scroll down to see what you built. ↓
          </Text>
        </BeatView>

        <BeatView index={1}>
          <Text style={[styles.sectionLabel, { color: colors.primary }]}>YOUR IDENTITY</Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
            This is who you are now. The 10x version of you.
          </Text>
          <View style={[styles.identityCard, { borderColor: colors.primary }]}>
            <Text style={[styles.identityLabel, { color: colors.primary }]}>MY IDENTITY</Text>
            {sentences.map((s, i) => (
              <Text key={i} style={[styles.identityText, { color: colors.text }]}>{s}</Text>
            ))}
          </View>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
            It's time to act, speak and move from this version.
          </Text>
          <Text style={[styles.scrollHint, { color: colors.textTertiary }]}>↓</Text>
        </BeatView>

        <BeatView index={2}>
          <Text style={[styles.sectionLabel, { color: colors.primary }]}>YOUR COMPASS</Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
            When life gets loud and decisions get hard, this one question cuts through everything.
          </Text>
          <View style={[styles.compassCard, { borderColor: colors.primary }]}>
            <View style={styles.compassCardHeader}>
              <View style={[styles.compassIconSmall, { backgroundColor: colors.primary }]}>
                <Compass size={16} color="#000" strokeWidth={2.5} />
              </View>
              <Text style={[styles.compassCardLabel, { color: colors.primary }]}>MY COMPASS FILTER</Text>
            </View>
            <Text style={[styles.compassFilterText, { color: colors.text }]}>"{filterQuestion}"</Text>
          </View>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
            Simple. Focused. Powerful.
          </Text>
          <Text style={[styles.scrollHint, { color: colors.textTertiary }]}>↓</Text>
        </BeatView>

        <BeatView index={3}>
          <Text style={[styles.sectionLabel, { color: colors.primary }]}>YOUR SUCCESS STACK</Text>
          <Text style={[styles.successStackTitle, { color: colors.text }]}>
            How {firstName} Wins Every Day.
          </Text>
          <View style={styles.inputList}>
            {inputs.map((input, i) => (
              <View
                key={i}
                style={[styles.inputRow, {
                  backgroundColor: isDark ? colors.backgroundSecondary : 'rgba(245,245,245,0.7)',
                  borderColor: isDark ? colors.border : '#E0E0E0',
                }]}
              >
                <View style={[styles.inputNumber, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.inputNumberText, { color: colors.primary }]}>{i + 1}</Text>
                </View>
                <Text style={[styles.inputText, { color: colors.text }]}>{input}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.scrollHint, { color: colors.textTertiary, marginTop: 8 }]}>↓</Text>
        </BeatView>

        <BeatView index={4}>
          <View style={styles.emotionalScreen}>
            <Text style={[styles.emotionalKicker, { color: colors.primary }]}>
              COMPOUND TO GREATNESS
            </Text>

            <Text style={[styles.emotionalHeadline, { color: colors.text }]}>
              This is what it{'\n'}actually looks like.
            </Text>

            <View style={styles.pillRow}>
              <View style={[styles.pill, { borderColor: isDark ? '#2A2A2A' : '#D8D8D8', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                <Text style={[styles.pillText, { color: colors.textSecondary }]}>Not a wish.</Text>
              </View>
              <View style={[styles.pill, { borderColor: isDark ? '#2A2A2A' : '#D8D8D8', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                <Text style={[styles.pillText, { color: colors.textSecondary }]}>Not a pointless task list.</Text>
              </View>
            </View>

            <View style={[styles.emotionalDivider, { backgroundColor: isDark ? '#1E1E1E' : '#EFEFEF' }]} />

            <Text style={[styles.emotionalBody, { color: colors.text }]}>
              A success system — built by{' '}
              <Text style={[styles.emotionalBodyAccent, { color: colors.primary }]}>you</Text>
              {', powered by daily actions '}
              <Text style={[styles.emotionalBodyAccent, { color: colors.primary }]}>you chose</Text>
              {', repeated long enough to create the life you\'ve always wanted.'}
            </Text>

            <View style={[styles.pullQuoteBlock, { borderLeftColor: colors.primary }]}>
              <Text style={[styles.pullQuoteText, { color: colors.text }]}>
                Your life matters.
              </Text>
            </View>

            <View style={styles.closingStinger}>
              <Text style={[styles.stingerSetup, { color: colors.textSecondary }]}>
                The only thing that can stop you now...
              </Text>
              <Text style={[styles.stingerPunch, { color: colors.text }]}>
                is you.
              </Text>
            </View>
          </View>

          <Animated.View style={buttonStyle}>
            <TouchableOpacity
              onPress={onContinue}
              activeOpacity={0.9}
              style={styles.button}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <Flame size={20} color="#000" strokeWidth={2.5} />
                <Text style={styles.buttonText}>Start My 77 Day Challenge</Text>
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
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    lineHeight: 18,
  },
  title: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 44,
  },
  paragraph: {
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 27,
  },
  scrollHint: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  sectionHint: {
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 26,
  },
  identityCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 24,
    gap: 10,
  },
  identityLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  identityText: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
  },
  compassCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 24,
    gap: 14,
  },
  compassCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compassIconSmall: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  compassFilterText: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 28,
    fontStyle: 'italic',
  },
  successStackTitle: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 44,
  },
  inputList: {
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 14,
  },
  inputNumber: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  inputNumberText: {
    fontSize: 13,
    fontWeight: '800',
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  emotionalScreen: {
    gap: 24,
    paddingTop: 8,
  },
  emotionalKicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
  },
  emotionalHeadline: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 48,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 100,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emotionalDivider: {
    height: 1,
    width: '40%',
  },
  emotionalBody: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 32,
  },
  emotionalBodyAccent: {
    fontWeight: '900',
  },
  pullQuoteBlock: {
    borderLeftWidth: 3,
    paddingLeft: 18,
    paddingVertical: 2,
  },
  pullQuoteText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  closingStinger: {
    gap: 4,
  },
  stingerSetup: {
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 26,
  },
  stingerPunch: {
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 58,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 16,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 19,
    gap: 10,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
    letterSpacing: -0.3,
  },
  bottomSpacer: {
    height: 40,
  },
  goodbyeText: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 44,
    textAlign: 'left',
  },
});
