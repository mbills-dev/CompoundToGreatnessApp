import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useGoalBundle } from '@/hooks/useGoalBundle';
import CalendarView from '@/components/CalendarView';
import MonthCalendarView from '@/components/MonthCalendarView';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Zap } from 'lucide-react-native';
import { parseLocalDate, getTodayDateString } from '@/lib/dateHelpers';

export default function CalendarScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const { goal, isLoading, invalidate: refreshGoal } = useGoalBundle(user?.id);

  if (isLoading || !user) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!goal) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Set up your goal first to view your progress
        </Text>
      </View>
    );
  }

  const isPreStart = !!goal.scheduled_start_date && goal.scheduled_start_date > getTodayDateString();

  if (isPreStart) {
    const startDate = parseLocalDate(goal.scheduled_start_date!);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntil = Math.round((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const countdownLabel = daysUntil === 1 ? 'DAY 1 STARTS TOMORROW' : `DAY 1 IN ${daysUntil} DAYS`;
    const formattedDate = startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
      <View style={[styles.preStartContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.preStartContent, { paddingTop: insets.top + 48 }]}>
          <View style={[styles.preStartBadge, { backgroundColor: isDark ? 'rgba(204,255,0,0.12)' : '#1A1A1A' }]}>
            <Zap size={16} color="#CCFF00" strokeWidth={2.5} fill="#CCFF00" />
            <Text style={styles.preStartBadgeText}>COUNTDOWN</Text>
          </View>
          <Text style={[styles.preStartHeadline, { color: colors.text }]}>{countdownLabel}</Text>
          <Text style={[styles.preStartDate, { color: colors.textSecondary }]}>{formattedDate}</Text>
          <Text style={[styles.preStartSub, { color: colors.textTertiary }]}>
            Your wall unlocks when the challenge begins.
          </Text>
        </View>
      </View>
    );
  }

  if (goal.challenge_phase === 'keep_going') {
    return <MonthCalendarView goal={goal} onRefresh={refreshGoal} />;
  }

  return <CalendarView goal={goal} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  preStartContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  preStartContent: {
    alignItems: 'center',
    gap: 16,
  },
  preStartBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  preStartBadgeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#CCFF00',
  },
  preStartHeadline: {
    fontFamily: 'Inter-Black',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'center',
    lineHeight: 42,
  },
  preStartDate: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  preStartSub: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
});
