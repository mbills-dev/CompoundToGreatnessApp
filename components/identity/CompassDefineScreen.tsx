import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Target, CircleCheck as CheckCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Dimension } from './types';

interface Props {
  vision: string;
  onChangeVision: (text: string) => void;
  dimensions: Dimension[];
  identityStatement: string;
}

function parseGoalsFromIdentity(identityStatement: string, dimensions: Dimension[]): string[] {
  if (identityStatement && identityStatement.trim().length > 3) {
    const cleaned = identityStatement.trim().replace(/\.$/, '');
    const parts = cleaned
      .split(/\.\s+|,\s+and\s+/i)
      .map(s => s.trim().replace(/\.$/, '').trim())
      .filter(s => s.length > 3);
    if (parts.length > 0) return parts;
  }
  return dimensions
    .map(d => {
      let s = (d.specific || d.vague || '').trim();
      if (s.endsWith('.')) s = s.slice(0, -1).trim();
      return s;
    })
    .filter(s => s.length > 3);
}

export default function CompassDefineScreen({ vision, onChangeVision, dimensions, identityStatement }: Props) {
  const { colors, isDark } = useTheme();

  const labelOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const listOpacity = useSharedValue(0);

  useEffect(() => {
    labelOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) });
    titleOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
    listOpacity.value = withDelay(500, withTiming(1, { duration: 600 }));
  }, []);

  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOpacity.value }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value }));
  const listStyle = useAnimatedStyle(() => ({ opacity: listOpacity.value }));

  const goals = parseGoalsFromIdentity(identityStatement, dimensions);

  return (
    <View style={styles.container}>
      <Animated.View style={labelStyle}>
        <View style={styles.labelRow}>
          <Target size={16} color={colors.primary} strokeWidth={2.5} />
          <Text style={[styles.label, { color: colors.primary }]}>THE FOCUSING QUESTION</Text>
        </View>
      </Animated.View>

      <Animated.View style={titleStyle}>
        <Text style={[styles.title, { color: colors.text }]}>
          Out of everything you just built...what's the one goal that if you hit it...changes everything?
        </Text>
      </Animated.View>

      <Animated.View style={listStyle}>
        <View style={styles.goalList}>
          {goals.map((goal, i) => {
            const isSelected = vision === goal;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => onChangeVision(goal)}
                activeOpacity={0.75}
                style={[
                  styles.goalCard,
                  {
                    backgroundColor: isDark ? '#111111' : '#F5F5F5',
                    borderColor: isSelected ? colors.primary : (isDark ? '#2A2A2A' : '#E0E0E0'),
                    borderWidth: isSelected ? 2 : 1,
                    outlineStyle: 'none',
                    boxShadow: 'none',
                  } as any,
                ]}
              >
                <View style={styles.goalRow}>
                  <Text style={[styles.goalText, { color: isSelected ? colors.primary : colors.text }]}>
                    {goal}
                  </Text>
                  {isSelected && (
                    <View style={[styles.checkDot, { backgroundColor: colors.primary }]}>
                      <CheckCircle size={14} color="#000" strokeWidth={2.5} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 24,
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
  title: {
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  goalList: {
    gap: 12,
  },
  goalCard: {
    borderRadius: 16,
    padding: 20,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  goalText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
  },
  checkDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
});
