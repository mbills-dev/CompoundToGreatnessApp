import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Check, Zap } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Goal, DailyCompletion, DailyActivity } from '@/types/database';
import { useTheme } from '@/contexts/ThemeContext';
import { getTodayDateString, isPhase2DayLocked } from '@/lib/dateHelpers';
import { computeCurrentStreak } from '@/lib/streakHelpers';
import EvidenceLogSection from './EvidenceLog';
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

export default function MonthCalendarView({ goal, onRefresh }: MonthCalendarViewProps) {
  const { colors, isDark } = useTheme();
  const today = getTodayDateString();

  const [completions, setCompletions] = useState<DailyCompletion[]>([]);
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [streak, setStreak] = useState(0);
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingCompletion, setEditingCompletion] = useState<DailyCompletion | null>(null);
  const [editingChecked, setEditingChecked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [goal.id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [goal.id])
  );

  const loadData = async () => {
    await Promise.all([loadCompletions(), loadActivities(), loadStreak()]);
  };

  const loadStreak = async () => {
    try {
      const count = await computeCurrentStreak(goal.id);
      setStreak(count);
    } catch (error) {
      console.error('Error loading streak:', error);
    }
  };

  const loadCompletions = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_completions')
        .select('*')
        .eq('goal_id', goal.id)
        .order('completion_date', { ascending: true });
      if (error) throw error;
      setCompletions(data || []);
    } catch (error) {
      console.error('Error loading completions:', error);
    }
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
    setEditingDate(null);
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
    setEditingDate(null);
  };

  const canGoNext = () => {
    const now = new Date();
    return !(currentYear === now.getFullYear() && currentMonth >= now.getMonth());
  };

  const handleDayPress = (dateStr: string) => {
    if (isPhase2DayLocked(dateStr)) return;
    if (dateStr > today) return;

    if (selectedDate === dateStr) {
      setSelectedDate(null);
      setEditingDate(null);
      return;
    }

    setSelectedDate(dateStr);

    const existing = getCompletionForDate(dateStr);
    setEditingDate(dateStr);
    setEditingCompletion(existing);
    setEditingChecked(existing?.activities_completed ?? []);
  };

  const toggleEditActivity = (activityId: string) => {
    setEditingChecked((prev) =>
      prev.includes(activityId)
        ? prev.filter((id) => id !== activityId)
        : [...prev, activityId]
    );
  };

  const saveEdit = async () => {
    if (!editingDate) return;
    setSaving(true);

    try {
      const allComplete = editingChecked.length === activities.length && activities.length > 0;
      const now = new Date().toISOString();

      if (editingCompletion) {
        await supabase
          .from('daily_completions')
          .update({
            activities_completed: editingChecked,
            completed_at: allComplete ? editingCompletion.completed_at || now : null,
            edited_at: now,
          })
          .eq('id', editingCompletion.id);
      } else {
        await supabase.from('daily_completions').insert({
          goal_id: goal.id,
          completion_date: editingDate,
          activities_completed: editingChecked,
          completed_at: allComplete ? now : null,
          is_rest_day: false,
          edited_at: now,
        });
      }

      await loadCompletions();
      setEditingDate(null);
      setSelectedDate(null);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error saving edit:', error);
    } finally {
      setSaving(false);
    }
  };

  const { firstDay, daysInMonth } = getMonthDays();

  const textMuted = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#E0E0DB';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={isDark ? ['#000000', '#111111', '#000000'] : ['#F5F5F0', '#F0F0EB', '#F5F5F0']}
        style={styles.gradient}
      >
        <View style={styles.header}>
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

        {editingDate && (
          <View style={[styles.editSection, { borderTopColor: borderColor }]}>
            <Text style={[styles.editDateLabel, { color: textMuted }]}>
              {new Date(editingDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              }).toUpperCase()}
            </Text>
            <Text style={[styles.editTitle, { color: colors.text }]}>Log Activities</Text>

            <View style={styles.editActivities}>
              {activities.map((activity) => {
                const checked = editingChecked.includes(activity.id);
                return (
                  <TouchableOpacity
                    key={activity.id}
                    style={[
                      styles.editActivityRow,
                      {
                        backgroundColor: checked
                          ? isDark ? 'rgba(204,255,0,0.08)' : 'rgba(204,255,0,0.08)'
                          : colors.card,
                        borderColor: checked ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => toggleEditActivity(activity.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.editActivityName, { color: colors.text }]}>
                      {activity.activity_name}
                    </Text>
                    <View
                      style={[
                        styles.editCheckbox,
                        {
                          backgroundColor: checked ? colors.primary : 'transparent',
                          borderColor: checked ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      {checked && <Check size={14} color="#000000" strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.saveEditButton}
              onPress={saveEdit}
              disabled={saving}
            >
              <LinearGradient
                colors={['#ccff00', '#aed900']}
                style={styles.saveEditGradient}
              >
                <Text style={styles.saveEditText}>{saving ? 'Saving...' : 'Save'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            {editingDate && (
              <EvidenceLogSection
                goalId={goal.id}
                date={editingDate}
                readOnly={false}
                challengeDay={goal.current_challenge_day}
              />
            )}
          </View>
        )}
      </LinearGradient>
    </ScrollView>
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
  editSection: {
    marginTop: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
    borderTopWidth: 1,
  },
  editDateLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  editTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 20,
    fontFamily: 'Inter-Black',
  },
  editActivities: {
    gap: 10,
    marginBottom: 20,
  },
  editActivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
  },
  editActivityName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  editCheckbox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveEditButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 24,
  },
  saveEditGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveEditText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.5,
  },
});
