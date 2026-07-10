import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Goal } from '@/types/database';
import CalendarView from '@/components/CalendarView';
import MonthCalendarView from '@/components/MonthCalendarView';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function CalendarScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState<Goal | null>(null);

  useEffect(() => {
    if (user) {
      loadGoal();
    }
  }, [user]);

  const loadGoal = async () => {
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('is_active', true)
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      setGoal(data);
    } catch (error) {
      console.error('Error loading goal:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !user) {
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
    return <MonthCalendarView goal={goal} onRefresh={loadGoal} />;
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
    textAlign: 'center',
  },
});
