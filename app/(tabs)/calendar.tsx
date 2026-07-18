import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useGoalBundle } from '@/hooks/useGoalBundle';
import CalendarView from '@/components/CalendarView';
import MonthCalendarView from '@/components/MonthCalendarView';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function CalendarScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();

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
});
