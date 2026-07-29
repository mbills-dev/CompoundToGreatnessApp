import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function GoalReviewScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ goals?: string }>();

  let goals: string[] = [];
  try {
    goals = params.goals ? JSON.parse(params.goals) : [];
  } catch {
    goals = [];
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.6}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Review Goals</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>
          EXTRACTED FROM YOUR PHOTO
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>
          Here's what we found.
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Review the goals below. In the next step you'll confirm and break each one down.
        </Text>

        <View style={styles.goalList}>
          {goals.map((goal, i) => (
            <View
              key={i}
              style={[
                styles.goalCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.goalNumber, { color: colors.primary }]}>
                {i + 1}
              </Text>
              <Text style={[styles.goalText, { color: colors.text }]}>
                {goal}
              </Text>
            </View>
          ))}
          {goals.length === 0 && (
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              No goals were extracted. Try uploading another photo or entering them manually.
            </Text>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Continue with these goals</Text>
          <ArrowRight size={20} color="#000" strokeWidth={3} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 36,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: 24,
  },
  goalList: {
    gap: 10,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
  },
  goalNumber: {
    fontSize: 16,
    fontWeight: '900',
    minWidth: 20,
  },
  goalText: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 23,
    flex: 1,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    textAlign: 'center',
    paddingTop: 40,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.2,
  },
});
