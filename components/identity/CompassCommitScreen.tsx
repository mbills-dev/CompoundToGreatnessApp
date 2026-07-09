import React, { useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Zap } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
  goalText: string;
  filterQuestion: string;
  onChangeFilterQuestion?: (text: string) => void;
}

const EXAMPLES = [
  { goal: 'Win Olympic Gold in Rowing', mechanism: '...the boat has to go faster' },
  { goal: 'Lose 20lbs', mechanism: '...I burn more calories than I consume' },
  { goal: 'Write a Book', mechanism: '...write more pages' },
  { goal: 'Make $100K/m In My Business', mechanism: '...close more deals' },
];

export default function CompassCommitScreen({ goalText, filterQuestion, onChangeFilterQuestion }: Props) {
  const { colors, isDark } = useTheme();
  const inputRef = useRef<TextInput>(null);

  const labelOpacity = useSharedValue(0);
  const promptOpacity = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const nudgeOpacity = useSharedValue(0);

  useEffect(() => {
    labelOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) });
    promptOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
    cardOpacity.value = withDelay(450, withTiming(1, { duration: 600 }));
    nudgeOpacity.value = withDelay(750, withTiming(1, { duration: 600 }));
  }, []);

  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOpacity.value }));
  const promptStyle = useAnimatedStyle(() => ({ opacity: promptOpacity.value }));
  const cardStyle = useAnimatedStyle(() => ({ opacity: cardOpacity.value }));
  const nudgeStyle = useAnimatedStyle(() => ({ opacity: nudgeOpacity.value }));

  const displayGoal = goalText.trim();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={[styles.labelRow, labelStyle]}>
        <Zap size={16} color={colors.primary} strokeWidth={2.5} />
        <Text style={[styles.label, { color: colors.primary }]}>FIND THE MECHANISM</Text>
      </Animated.View>


      <Animated.View style={cardStyle}>
        <Text style={[styles.goalContext, { color: colors.text }]}>{displayGoal}</Text>

        <Text style={[styles.cannotHappen, { color: colors.primary }]}>
          Literally cannot happen unless
        </Text>

        <TextInput
          ref={inputRef}
          style={[styles.input, {
            color: colors.text,
            borderColor: filterQuestion.trim() ? colors.primary + '60' : (isDark ? '#333' : '#D8D8D8'),
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          }]}
          value={filterQuestion}
          onChangeText={onChangeFilterQuestion}
          placeholder="...finish the sentence"
          placeholderTextColor={colors.textTertiary}
          multiline
          autoCapitalize="sentences"
          returnKeyType="done"
        />
      </Animated.View>

      <Animated.View style={nudgeStyle}>
        <Text style={[styles.nudgeHeading, { color: colors.textSecondary }]}>Need a nudge?</Text>
        <View style={styles.examplesContainer}>
          {EXAMPLES.map((ex, i) => (
            <View key={i} style={[styles.exampleRow, {
              borderBottomColor: isDark ? '#1E1E1E' : '#EBEBEB',
              borderBottomWidth: i < EXAMPLES.length - 1 ? 1 : 0,
            }]}>
              <Text style={[styles.exampleGoal, { color: colors.text }]}>{ex.goal}</Text>
              <Text style={[styles.exampleMechanism, { color: colors.primary }]}>{ex.mechanism}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    gap: 24,
    paddingBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  promptTitle: {
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 32,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  promptSub: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  goalContext: {
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  cannotHappen: {
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  input: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 52,
    marginTop: 12,
  },
  nudgeHeading: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  examplesContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  exampleRow: {
    paddingVertical: 14,
    gap: 4,
  },
  exampleGoal: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  exampleMechanism: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
