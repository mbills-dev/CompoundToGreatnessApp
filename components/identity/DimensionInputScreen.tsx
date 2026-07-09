import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Briefcase,
  Dumbbell,
  Heart,
  Star,
  Zap,
  Target,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

const ICON_MAP: Record<string, any> = {
  Briefcase,
  Dumbbell,
  Heart,
  Star,
  Zap,
  Target,
};

interface Props {
  category: string;
  label: string;
  icon: string;
  prompt: string;
  onSubmit: (vagueGoal: string) => void;
}

export default function DimensionInputScreen({ category, label, icon, prompt, onSubmit }: Props) {
  const { colors, isDark } = useTheme();
  const [text, setText] = useState('');

  const Icon = ICON_MAP[icon] || Target;

  const handleChangeText = (value: string) => {
    setText(value);
    onSubmit(value.trim());
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconBadge}
        >
          <Icon size={24} color="#000000" strokeWidth={2.5} />
        </LinearGradient>
        <View style={styles.headerText}>
          <Text style={[styles.dimCategory, { color: colors.text }]}>
            {label}
          </Text>
        </View>
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        What Do You{'\n'}Want Here?
      </Text>

      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        In your own words, what do you want to achieve in this area?
      </Text>

      <TextInput
        style={[styles.input, {
          color: colors.text,
          borderColor: text.trim().length > 0 ? colors.primary : (isDark ? colors.border : '#E0E0E0'),
          backgroundColor: isDark ? colors.backgroundSecondary : 'rgba(245, 245, 245, 0.8)',
        }]}
        value={text}
        onChangeText={handleChangeText}
        placeholder={prompt}
        placeholderTextColor={colors.textTertiary}
        multiline
        autoFocus
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  dimCategory: {
    fontSize: 18,
    fontWeight: '800',
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
    marginBottom: 24,
  },
  input: {
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    fontSize: 16,
    fontWeight: '600',
    minHeight: 80,
    lineHeight: 24,
  },
});
