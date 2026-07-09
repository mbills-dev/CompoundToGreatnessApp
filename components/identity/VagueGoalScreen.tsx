import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
  goalText: string;
  onChangeText: (text: string) => void;
}

export default function VagueGoalScreen({ goalText, onChangeText }: Props) {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconBadge}
      >
        <Sparkles size={28} color="#000000" strokeWidth={2.5} />
      </LinearGradient>

      <Text style={[styles.title, { color: colors.text }]}>
        What Do You{'\n'}Want to Achieve?
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Tell us your goals in your own words.{'\n'}
        Separate multiple goals with commas.
      </Text>

      <View style={styles.inputSection}>
        <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>I want to...</Text>
        <TextInput
          style={[styles.input, {
            color: colors.text,
            borderColor: isDark ? colors.border : '#E0E0E0',
            backgroundColor: isDark ? colors.backgroundSecondary : 'rgba(245, 245, 245, 0.8)',
          }]}
          value={goalText}
          onChangeText={onChangeText}
          placeholder='"make more money, get in shape"'
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          autoFocus
        />
      </View>

      <View style={styles.examples}>
        {[
          '"be a better dad, build my business"',
          '"lose weight, be more disciplined"',
          '"earn more, learn how to do a cartwheel"',
        ].map((example, i) => (
          <View key={i} style={[styles.exampleChip, {
            backgroundColor: isDark ? colors.backgroundTertiary : 'rgba(245, 245, 245, 0.6)',
            borderColor: isDark ? colors.border : '#E0E0E0',
          }]}>
            <Text style={[styles.exampleText, { color: colors.textTertiary }]}>{example}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 42,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    marginBottom: 32,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    fontSize: 17,
    fontWeight: '600',
    minHeight: 100,
    lineHeight: 26,
  },
  examples: {
    gap: 8,
  },
  exampleChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  exampleText: {
    fontSize: 14,
    fontWeight: '500',
    fontStyle: 'italic',
  },
});
