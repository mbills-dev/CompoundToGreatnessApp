import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { getTodayDateString } from '@/lib/dateHelpers';

interface MonthWallProps {
  goalId: string;
  isLight?: boolean;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function MonthWall({ goalId, isLight = false }: MonthWallProps) {
  const today = getTodayDateString();
  const isDark = !isLight;

  const [completionDates, setCompletionDates] = useState<string[]>([]);
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('daily_completions')
        .select('completion_date')
        .eq('goal_id', goalId)
        .not('completed_at', 'is', null)
        .order('completion_date', { ascending: true });
      if (!error && data) {
        setCompletionDates(data.map((c) => c.completion_date));
      }
    };
    load();
  }, [goalId]);

  const isDayCompleted = (dateStr: string) => completionDates.includes(dateStr);

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
  };

  const canGoNext = () => {
    const now = new Date();
    return !(currentYear === now.getFullYear() && currentMonth >= now.getMonth());
  };

  const { firstDay, daysInMonth } = getMonthDays();

  const textMuted = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';

  return (
    <View style={styles.container}>
      <Text style={[styles.cardTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
        MONTHLY PROGRESS
      </Text>

      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.navArrow} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ChevronLeft size={28} color={isDark ? '#FFFFFF' : '#000000'} strokeWidth={2.5} />
        </TouchableOpacity>

        <View style={styles.monthTitleBlock}>
          <Text style={[styles.monthName, { color: isDark ? '#FFFFFF' : '#000000' }]}>
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
          <ChevronRight size={28} color={canGoNext() ? (isDark ? '#FFFFFF' : '#000000') : textMuted} strokeWidth={2.5} />
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

            return (
              <View
                key={day}
                style={[
                  styles.dayCell,
                  completed && { backgroundColor: '#ccff00' },
                  isToday && !completed && { borderWidth: 2, borderColor: '#ccff00' },
                  isFuture && styles.dayCellFuture,
                ]}
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
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 16,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
