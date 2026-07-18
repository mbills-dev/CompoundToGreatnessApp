import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import DayCardModal from './DayCardModal';
import { supabase } from '@/lib/supabase';
import { Goal, DailyCompletion, DailyActivity } from '@/types/database';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTodayDateString, isPhase2DayLocked, parseLocalDate, toLocalMidnight } from '@/lib/dateHelpers';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useStreakSummary } from '@/hooks/useStreakSummary';
import { fetchCompletions, completionsKey } from '@/hooks/useCompletions';
import JourneyComparisonBanner from './JourneyComparisonBanner';

interface MonthCalendarViewProps {
  goal: Goal;
  onRefresh?: () => void;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function challengeDayForDate(challengeStartDate: string | null, dateStr: string): number {
  if (!challengeStartDate) return 1;
  const start = toLocalMidnight(challengeStartDate);
  const target = parseLocalDate(dateStr);
  const diffDays = Math.round((target.getTime() - start.getTime()) / 86400000);
  return diffDays + 1;
}

export default function MonthCalendarView({ goal, onRefresh }: MonthCalendarViewProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const today = getTodayDateString();

  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const { streak } = useStreakSummary(goal.id);
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayCardDay, setDayCardDay] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const [completions, setCompletions] = useState<DailyCompletion[]>(
    () => (queryClient.getQueryData(completionsKey(goal.id)) as DailyCompletion[] | undefined) ?? []
  );
  const { data: completionsData } = useQuery({
    queryKey: completionsKey(goal.id),
    queryFn: () => fetchCompletions(goal.id),
  });

  useEffect(() => {
    if (completionsData) setCompletions(completionsData);
  }, [completionsData]);

  useEffect(() => {
    loadData();
  }, [goal.id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [goal.id])
  );

  const loadData = async () => {
    await Promise.all([loadCompletions(), loadActivities()]);
  };

  const loadCompletions = () => {
    return queryClient.invalidateQueries({ queryKey: completionsKey(goal.id) });
  };

  const loadActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_activities')
        .select('*')
        .eq('goal_id', goal.id)
        .order('order_position');
      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const getCompletionForDate = (dateStr: string) =>
    completions.find((c) => c.completion_date === dateStr) ?? null;

  const isDayCompleted = (dateStr: string) => {
    const c = getCompletionForDate(dateStr);
    return !!(c && c.completed_at);
  };

  const getMonthDays = () => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setSelectedDate(null);
    setDayCardDay(null);
  };

  const nextMonth = () => {
    const now = new Date();
    if (currentYear > now.getFullYear() || (currentYear === now.getFullYear() && currentMonth >= now.getMonth())) {
      return;
    }
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
    setSelectedDate(null);
    setDayCardDay(null);
  };

  const canGoNext = () => {
    const now = new Date();
    return !(currentYear === now.getFullYear() && currentMonth >= now.getMonth());
  };

  const handleDayPress = (dateStr: string) => {
    if (isPhase2DayLocked(dateStr)) return;
    if (dateStr > today) return;
    setSelectedDate(dateStr);
    setDayCardDay(challengeDayForDate(goal.challenge_start_date, dateStr));
  };

  const { firstDay, daysInMonth } = getMonthDays();

  const textMuted = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#E0E0DB';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
      >
      <LinearGradient
        colors={isDark ? ['#000000', '#111111', '#000000'] : ['#F5F5F0', '#F0F0EB', '#F5F5F0']}
        style={styles.gradient}
      >
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={[styles.keepGoingBadge, { borderColor: colors.primary }]}>
            <Zap size={22} fill={colors.primary} color={colors.primary} />
            <Text style={[styles.keepGoingBadgeNumber, { color: colors.primary }]}>
              {streak}
            </Text>
            <Text style={[styles.keepGoingBadgeText, { color: colors.primary }]}>
              DAY STREAK
            </Text>
          </View>
        </View>

        <JourneyComparisonBanner goalId={goal.id} currentChallengeDay={goal.current_challenge_day || 0} />
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.navArrow} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <ChevronLeft size={28} color={colors.text} strokeWidth={2.5} />
          </TouchableOpacity>

          <View style={styles.monthTitleBlock}>
            <Text style={[styles.monthName, { color: colors.text }]}>
              {MONTH_NAMES[currentMonth]}
            </Text>
            <Text style={[styles.monthYear, { color: textMuted }]}>{currentYear}</Text>
          </View>

          <TouchableOpacity
            onPress={nextMonth}
            style={[styles.navArrow, !canGoNext() && styles.navArrowDisabled]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            disabled={!canGoNext()}
          >
            <ChevronRight size={28} color={canGoNext() ? colors.text : textMuted} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <View style={styles.calendarGrid}>
          <View style={styles.weekDaysRow}>
            {DAYS_OF_WEEK.map((d) => (
              <Text key={d} style={[styles.weekDayLabel, { color: textMuted }]}>{d}</Text>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {Array.from({ length: firstDay }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.dayCell} />
            ))}

            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const completed = isDayCompleted(dateStr);
              const isFuture = dateStr > today;
              const isToday = dateStr === today;
              const isSelected = selectedDate === dateStr;

              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayCell,
                    completed && { backgroundColor: colors.primary },
                    isToday && !completed && { borderWidth: 2, borderColor: colors.primary },
                    isSelected && !completed && { borderWidth: 2, borderColor: colors.primary },
                    isFuture && styles.dayCellFuture,
                  ]}
                  onPress={() => handleDayPress(dateStr)}
                  disabled={isFuture}
                  activeOpacity={isFuture ? 1 : 0.7}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      { color: isDark ? '#FFFFFF' : '#000000' },
                      completed && { color: '#000000' },
                      isFuture && { color: textMuted },
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

      </LinearGradient>
      </ScrollView>
      <DayCardModal
        visible={dayCardDay !== null}
        day={dayCardDay}
        goal={goal}
        tileLayout={null}
        onClose={() => setDayCardDay(null)}
        editable
        headerMode="date"
        onSaved={() => {
          loadCompletions();
          if (onRefresh) onRefresh();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    minHeight: '100%',
    paddingBottom: 80,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 24,
    alignItems: 'center',
  },
  keepGoingBadge: {
    borderWidth: 1.5,
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  keepGoingBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
    fontFamily: 'Inter-Black',
  },
  keepGoingBadgeNumber: {
    fontSize: 24,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
  },
  goalTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 30,
    fontFamily: 'Inter-Bold',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  navArrow: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrowDisabled: {
    opacity: 0.3,
  },
  monthTitleBlock: {
    alignItems: 'center',
  },
  monthName: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    fontFamily: 'Inter-Black',
  },
  monthYear: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
    fontFamily: 'Inter-Bold',
  },
  calendarGrid: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: 'Inter-Bold',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    position: 'relative',
  },
  dayCellFuture: {
    opacity: 0.25,
  },
  dayNumber: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
  },
});
