import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Share2, Lock, ArrowUpFromLine } from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Goal, DailyCompletion, DailyActivity } from '@/types/database';
import { useTheme } from '@/contexts/ThemeContext';
import { useCelebration } from '@/contexts/CelebrationContext';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { isDateLocked, getDateForChallengeDay, toLocalDateString, parseLocalDate, getDayNumberFromChallengeStart, getTodayDateString } from '@/lib/dateHelpers';
import { resetChallenge as doResetChallenge } from '@/lib/resetHelpers';
import EvidenceLogSection from './EvidenceLog';
import GracePeriodModal from './GracePeriodModal';
import DayCardModal, { TileLayout } from './DayCardModal';
import { isMilestoneDay, TOTAL_CHALLENGE_DAYS } from '@/constants/milestones';
import CompoundScoreSection from './CompoundScoreSection';
import ChallengeWall from './ChallengeWall';

interface CalendarViewProps {
  goal: Goal;
}

const LIME = '#CCFF00';

export default function CalendarView({ goal: initialGoal }: CalendarViewProps) {
  const { colors, isDark } = useTheme();
  const { openCelebration } = useCelebration();
  const [goal, setGoal] = useState(initialGoal);
  const [completions, setCompletions] = useState<DailyCompletion[]>([]);
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dayCardDay, setDayCardDay] = useState<number | null>(null);
  const [dayCardTileLayout, setDayCardTileLayout] = useState<TileLayout | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [showGracePeriodModal, setShowGracePeriodModal] = useState(false);
  const [gracePeriodDaysMissed, setGracePeriodDaysMissed] = useState(0);
  const [gracePeriodMode, setGracePeriodMode] = useState<'grace' | 'reset'>('grace');
  const isFocused = useIsFocused();
  const shareViewRef = useRef<View>(null);
  const rootWrapperRef = useRef<View>(null);
  const containerOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    initializeChallenge();
  }, [goal.id, isFocused]);

  useEffect(() => {
    loadCompletions();
    loadActivities();
  }, [goal.id, isFocused]);

  useEffect(() => {
    checkForMissedDays();
  }, [completions, goal]);

  const initializeChallenge = async () => {
    if (!goal.challenge_start_date) {
      try {
        const { data: existingCompletions } = await supabase
          .from('daily_completions')
          .select('*')
          .eq('goal_id', goal.id)
          .not('completed_at', 'is', null)
          .order('completion_date', { ascending: true })
          .limit(1);

        if (existingCompletions && existingCompletions.length > 0) {
          const firstCompletionDate = existingCompletions[0].completion_date;
          const startDate = new Date(firstCompletionDate + 'T00:00:00');

          const { data, error } = await supabase
            .from('goals')
            .update({
              challenge_start_date: startDate.toISOString(),
              challenge_phase: 'challenge',
            })
            .eq('id', goal.id)
            .select()
            .single();

          if (error) {
            console.error('Error updating goal with start date:', error);
          } else if (data) {
            setGoal(data);
          }
        } else {
          const { data, error } = await supabase
            .from('goals')
            .select('*')
            .eq('id', goal.id)
            .single();

          if (error) {
            console.error('Error fetching goal:', error);
          } else if (data) {
            setGoal(data);
          }
        }
      } catch (error) {
        console.error('Error initializing challenge:', error);
      }
    } else {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('id', goal.id)
        .single();

      if (error) {
        console.error('Error fetching goal:', error);
      } else if (data) {
        setGoal(data);
      }
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

  const checkForMissedDays = async () => {
    if (goal.challenge_phase === 'keep_going') return;
    if (!goal.challenge_start_date || !goal.last_completion_date) return;
    if (goal.current_challenge_day >= TOTAL_CHALLENGE_DAYS) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastCompletion = parseLocalDate(goal.last_completion_date);

    const daysDiff = Math.floor((today.getTime() - lastCompletion.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff <= 1) return;

    const todayStr = toLocalDateString(today);
    if (goal.grace_period_prompted_date === todayStr) return;

    if (daysDiff === 2) {
      setGracePeriodMode('grace');
      setGracePeriodDaysMissed(1);
      setShowGracePeriodModal(true);
      return;
    }

    // daysDiff > 2: forced reset with acknowledgment modal
    await resetChallenge();
    setGracePeriodMode('reset');
    setGracePeriodDaysMissed(daysDiff - 1);
    setShowGracePeriodModal(true);
  };

  const resetChallenge = async () => {
    const updated = await doResetChallenge(goal, supabase, 'restarted');
    if (updated) {
      setGoal(updated);
      setSelectedDay(null);
      setCompletions([]);
    }
  };

  const handleGraceKeepGoing = async () => {
    setShowGracePeriodModal(false);

    const todayStr = toLocalDateString(new Date());
    await supabase
      .from('goals')
      .update({ grace_period_prompted_date: todayStr })
      .eq('id', goal.id);

    // Grace is one day only: backfill just yesterday.
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const yesterday = new Date(todayDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toLocalDateString(yesterday);

    const { data: existing } = await supabase
      .from('daily_completions')
      .select('id')
      .eq('goal_id', goal.id)
      .eq('completion_date', yesterdayStr)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('daily_completions')
        .update({
          activities_completed: activities.map((a) => a.id),
          completed_at: new Date(yesterdayStr + 'T23:59:00').toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('daily_completions').insert({
        goal_id: goal.id,
        completion_date: yesterdayStr,
        activities_completed: activities.map((a) => a.id),
        completed_at: new Date(yesterdayStr + 'T23:59:00').toISOString(),
        is_rest_day: false,
      });
    }

    const { data } = await supabase
      .from('goals')
      .update({
        last_completion_date: yesterdayStr,
        current_challenge_day: (goal.current_challenge_day || 0) + 1,
      })
      .eq('id', goal.id)
      .select()
      .single();

    if (data) setGoal(data);
    loadCompletions();
  };

  const handleGraceStartOver = async () => {
    setShowGracePeriodModal(false);
    // In reset mode the challenge was already reset before the modal opened;
    // in grace mode (user chose "I missed it") reset now.
    if (gracePeriodMode === 'grace') {
      await resetChallenge();
    }
    loadCompletions();
  };

  const handleShare = async () => {
    if (!shareViewRef.current) {
      Alert.alert('Error', 'Unable to capture progress image. Please try again.');
      return;
    }

    if (completedDays === 0) {
      Alert.alert('No Progress Yet', 'Complete at least one day before sharing your progress!');
      return;
    }

    try {
      setIsSharing(true);

      const uri = await captureRef(shareViewRef, {
        format: 'png',
        quality: 1,
      });

      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.download = `77-day-challenge-progress.png`;
        link.href = uri;
        link.click();

        setTimeout(() => {
          Alert.alert('Success', 'Your progress image has been downloaded!');
        }, 100);
      } else {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            dialogTitle: 'Share your 77-Day Challenge progress',
          });
        } else {
          Alert.alert('Error', 'Sharing is not available on this device.');
        }
      }
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', `Failed to share your progress: ${error}`);
    } finally {
      setIsSharing(false);
    }
  };

  const getCompletionForDay = (dayNumber: number) => {
    if (!goal.challenge_start_date) return null;

    const startDate = new Date(goal.challenge_start_date);
    startDate.setHours(0, 0, 0, 0);

    const targetDate = new Date(startDate);
    targetDate.setDate(startDate.getDate() + (dayNumber - 1));

    const dateString = toLocalDateString(targetDate);
    return completions.find((c) => c.completion_date === dateString);
  };

  const isDayCompleted = (dayNumber: number): boolean => {
    const completion = getCompletionForDay(dayNumber);
    return !!completion && completion.completed_at !== null;
  };

  const getActivityEmoji = (activityType: string, activityName: string) => {
    const lowerName = activityName.toLowerCase();

    if (activityType === 'reading') return '📚';
    if (activityType === 'diet') return '🥗';
    if (activityType === 'exercise') return '💪';

    if (lowerName.includes('water')) return '💧';
    if (lowerName.includes('meditation') || lowerName.includes('mindful')) return '🧘';
    if (lowerName.includes('sleep')) return '😴';
    if (lowerName.includes('workout') || lowerName.includes('gym')) return '🏋️';
    if (lowerName.includes('run')) return '🏃';
    if (lowerName.includes('walk')) return '🚶';
    if (lowerName.includes('photo')) return '📸';
    if (lowerName.includes('video')) return '🎥';
    if (lowerName.includes('write') || lowerName.includes('journal')) return '✍️';
    if (lowerName.includes('focus') || lowerName.includes('work')) return '🎯';
    if (lowerName.includes('call') || lowerName.includes('phone')) return '📞';
    if (lowerName.includes('distraction')) return '🚫';
    if (lowerName.includes('mission')) return '🎬';

    return '✓';
  };

  const getCompletedActivitiesForDay = (dayNumber: number) => {
    const completion = getCompletionForDay(dayNumber);
    if (!completion || !completion.activities_completed) return [];

    return activities
      .filter(activity => completion.activities_completed.includes(activity.id))
      .map(activity => ({
        name: activity.activity_name,
        emoji: getActivityEmoji(activity.activity_type, activity.activity_name),
      }));
  };

  const getCompletedDaysCount = () => {
    if (!goal.challenge_start_date) return 0;

    const startDateStr = goal.challenge_start_date.split('T')[0];

    return completions.filter(c => {
      if (!c.completed_at) return false;
      return c.completion_date >= startDateStr;
    }).length;
  };

  const completedDays = getCompletedDaysCount();
  const currentDay = goal.current_challenge_day || 1;
  const displayDay = Math.max(1, getDayNumberFromChallengeStart(
    goal.challenge_start_date ?? null,
    getTodayDateString()
  ));
  const isCompleted = goal.challenge_phase === 'keep_going' || currentDay > TOTAL_CHALLENGE_DAYS;
  const isChallengePhase = goal.challenge_phase === 'challenge' && !isCompleted;
  const router = useRouter();
  const isCelebrationPending = goal.challenge_phase === 'challenge'
    && currentDay >= TOTAL_CHALLENGE_DAYS
    && !goal.celebration_seen;

  const getIndividualStats = () => {
    if (activities.length === 0) return [];

    const startDateStr = goal.challenge_start_date?.split('T')[0];
    if (!startDateStr) return [];

    const validCompletions = completions.filter(c =>
      c.completed_at !== null && c.completion_date >= startDateStr
    );
    const totalTrackedDays = validCompletions.length;

    return activities.map(activity => {
      const daysCompleted = validCompletions.filter(c =>
        c.activities_completed && c.activities_completed.includes(activity.id)
      ).length;

      const percentage = totalTrackedDays > 0
        ? Math.round((daysCompleted / totalTrackedDays) * 100)
        : 0;

      return {
        id: activity.id,
        name: activity.activity_name,
        emoji: getActivityEmoji(activity.activity_type, activity.activity_name),
        daysCompleted,
        totalDays: totalTrackedDays,
        percentage: isChallengePhase ? 100 : percentage,
      };
    });
  };

  const individualStats = getIndividualStats();

  const bg = isDark ? colors.background : '#F5F5F0';
  const textPrimary = isDark ? colors.text : '#1A1A1A';
  const textMuted = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#E0E0DB';
  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF';
  const progressTrackBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const challengeSubtitleColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
  const gradientColors: [string, string, string] = isDark
    ? ['#000000', '#0A0A0F', '#000000']
    : ['#F5F5F0', '#F0F0EB', '#F5F5F0'];

  return (
    <View
      ref={rootWrapperRef}
      style={styles.rootWrapper}
      onLayout={() => {
        if (rootWrapperRef.current?.measureInWindow) {
          rootWrapperRef.current.measureInWindow((x, y) => {
            containerOriginRef.current = { x, y };
          });
        }
      }}
    >
      <GracePeriodModal
        visible={showGracePeriodModal}
        daysMissed={gracePeriodDaysMissed}
        mode={gracePeriodMode}
        onKeepGoing={handleGraceKeepGoing}
        onStartOver={handleGraceStartOver}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: bg }]}
        showsVerticalScrollIndicator={false}
      >
      <LinearGradient
        colors={gradientColors}
        style={styles.gradient}
      >
        <View style={styles.header}>
          {isCompleted ? (
            <View style={[styles.completedBadge, { borderColor: colors.error }]}>
              <Text style={[styles.completedText, { color: colors.error }]}>COMPLETED</Text>
            </View>
          ) : null}
          <Text style={[styles.dayTitle, { color: textPrimary }]}>DAY {displayDay}</Text>
          <Text style={[styles.challengeSubtitle, { color: challengeSubtitleColor }]}>77-DAY CHALLENGE</Text>
        </View>

        <View ref={shareViewRef} style={[styles.shareContainer, { backgroundColor: bg }]} collapsable={false}>
          <View style={styles.shareHeader}>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarTrack, { backgroundColor: progressTrackBg }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      backgroundColor: colors.primary,
                      width: `${Math.min((currentDay / TOTAL_CHALLENGE_DAYS) * 100, 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progressBarLabel, { color: textMuted }]}>
                DAY {displayDay} of {TOTAL_CHALLENGE_DAYS}
              </Text>
            </View>
            <View style={[styles.shareStatsRow, !isDark && styles.shareStatsRowBoxed]}>
              <View style={styles.shareStat}>
                <Text style={[styles.shareStatValue, { color: colors.primary }]}>{completedDays}</Text>
                <Text style={[styles.shareStatLabel, { color: isDark ? textMuted : 'rgba(255,255,255,0.4)' }]}>DAYS COMPLETED</Text>
              </View>
              <View style={[styles.shareStatDivider, { backgroundColor: isDark ? borderColor : 'rgba(255,255,255,0.15)' }]} />
              <View style={styles.shareStat}>
                <Text style={[styles.shareStatValue, { color: colors.primary }]}>{Math.round((completedDays / TOTAL_CHALLENGE_DAYS) * 100)}%</Text>
                <Text style={[styles.shareStatLabel, { color: isDark ? textMuted : 'rgba(255,255,255,0.4)' }]}>PROGRESS</Text>
              </View>
            </View>
          </View>
          <ChallengeWall
            currentDay={displayDay}
            isDayCompleted={isDayCompleted}
            isLight={!isDark}
            onTilePress={(day, layout) => {
              if (isDayCompleted(day)) {
                const origin = containerOriginRef.current;
                setDayCardTileLayout(layout
                  ? { ...layout, x: layout.x - origin.x, y: layout.y - origin.y }
                  : null
                );
                setDayCardDay(day);
              } else {
                setSelectedDay(day === selectedDay ? null : day);
              }
            }}
          />
        </View>

        <TouchableOpacity
          style={styles.shareJourneyButton}
          onPress={handleShare}
          disabled={isSharing}
          activeOpacity={0.85}
        >
          <ArrowUpFromLine size={16} color="#1A1A1A" strokeWidth={2.5} />
          <Text style={styles.shareJourneyText}>SHARE YOUR JOURNEY</Text>
        </TouchableOpacity>

        {/* Inline continue button — shown only when celebration is pending.
            Rendered OUTSIDE shareViewRef so it never appears in share images. */}
        {isCelebrationPending && (
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => openCelebration()}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>CONTINUE →</Text>
          </TouchableOpacity>
        )}

        {selectedDay && (() => {
          const completedActivities = getCompletedActivitiesForDay(selectedDay);
          const isPast = selectedDay < currentDay;
          const isLocked = isPast && isDayCompleted(selectedDay);
          const selectedDateStr = getDateForChallengeDay(goal.challenge_start_date, selectedDay);
          const isSelectedToday = selectedDateStr === toLocalDateString(new Date());

          return (
            <View style={styles.activitiesSection}>
              {isMilestoneDay(selectedDay) && (
                <View style={[styles.milestoneDayBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.milestoneDayBadgeText}>MILESTONE DAY</Text>
                </View>
              )}
              {completedActivities.length > 0 && (
                <>
                  <View style={styles.activitiesSectionHeader}>
                    <Text style={[styles.activitiesTitle, { color: textMuted }]}>
                      DAY {selectedDay} ACTIVITIES
                    </Text>
                    {isLocked && (
                      <View style={[styles.lockedBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
                        <Lock size={12} color={textMuted} strokeWidth={2.5} />
                        <Text style={[styles.lockedBadgeText, { color: textMuted }]}>LOCKED</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.activitiesList}>
                    {completedActivities.map((activity, index) => (
                      <View key={index} style={styles.activityItem}>
                        <Text style={styles.activityEmoji}>{activity.emoji}</Text>
                        <Text style={[styles.activityName, { color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)' }]}>
                          {activity.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
              <EvidenceLogSection
                goalId={goal.id}
                date={selectedDateStr}
                readOnly={!isSelectedToday}
                challengeDay={selectedDay}
              />
            </View>
          );
        })()}

        {isCompleted && (
          <View style={styles.completionCard}>
            <Text style={[styles.completionTitle, { color: colors.primary }]}>
              77 DAYS COMPLETE
            </Text>
            <Text style={[styles.completionMessage, { color: textMuted }]}>
              You crushed it. Keep going — the streak continues.
            </Text>
          </View>
        )}

        <CompoundScoreSection
          goal={goal}
          completions={completions}
          activities={activities}
        />
      </LinearGradient>
      </ScrollView>

      <DayCardModal
        visible={dayCardDay !== null}
        day={dayCardDay}
        goal={goal}
        tileLayout={dayCardTileLayout}
        onClose={() => setDayCardDay(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rootWrapper: {
    flex: 1,
  },
  continueButton: {
    backgroundColor: '#FF4400',
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  continueButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'Inter-Black',
    letterSpacing: 1,
  },
  container: {
    flex: 1,
  },
  gradient: {
    minHeight: '100%',
    paddingBottom: 100,
  },
  header: {
    padding: 24,
    paddingTop: 70,
    paddingBottom: 12,
    alignItems: 'center',
    position: 'relative',
  },
  completedBadge: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 24,
  },
  completedText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: 'Inter-Black',
  },
  dayTitle: {
    fontSize: 80,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -2,
    fontFamily: 'Inter-Black',
  },
  challengeSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.14 * 11,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 2,
  },
  shareButtonBottom: {
    flexShrink: 0,
  },
  shareButtonGradient: {
    padding: 12,
    borderRadius: 12,
  },
  shareJourneyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#CCFF00',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 24,
    marginTop: 12,
    marginBottom: 20,
  },
  shareJourneyText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1A1A1A',
    letterSpacing: 13 * 0.06,
  },
  shareContainer: {
    paddingTop: 0,
    paddingBottom: 40,
    marginHorizontal: 24,
  },
  shareHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  shareTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: 'Inter-Black',
    marginBottom: 8,
    textAlign: 'center',
  },
  shareSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
    fontFamily: 'Inter-Bold',
  },
  progressBarContainer: {
    marginTop: 4,
    marginBottom: 2,
    gap: 6,
    alignSelf: 'stretch',
  },
  progressBarTrack: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    fontFamily: 'Inter-Bold',
  },
  shareStatsRow: {
    flexDirection: 'row',
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareStatsRowBoxed: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  shareStat: {
    flex: 1,
    alignItems: 'center',
  },
  shareStatValue: {
    fontSize: 36,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    marginBottom: 4,
  },
  shareStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    fontFamily: 'Inter-Bold',
  },
  shareStatDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 24,
  },
  shareFooter: {
    display: 'none',
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shareFooterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareFooterText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter-Bold',
  },
  shareFooterEmoji: {
    fontSize: 16,
  },
  activitiesSection: {
    marginTop: 48,
    marginHorizontal: 24,
    borderRadius: 0,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  milestoneDayBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  milestoneDayBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 1,
  },
  activitiesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  activitiesTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: 'Inter-Black',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lockedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  activitiesList: {
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityEmoji: {
    fontSize: 18,
  },
  activityName: {
    fontSize: 15,
    fontWeight: '400',
  },
  completionCard: {
    marginTop: 48,
    marginHorizontal: 24,
    borderRadius: 0,
    padding: 40,
    borderWidth: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  completionTitle: {
    fontSize: 48,
    fontWeight: '900',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -2,
    fontFamily: 'Inter-Black',
  },
  completionMessage: {
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
  },
  breakdownSection: {
    marginTop: 48,
    marginHorizontal: 24,
  },
  breakdownTitle: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    marginBottom: 8,
    fontStyle: 'normal',
  },
  breakdownSubtitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
    marginBottom: 20,
    fontStyle: 'normal',
  },
  statsList: {
    gap: 12,
  },
  statCard: {
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statCardLeft: {
    flex: 1,
    marginRight: 16,
  },
  statCardName: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
    fontStyle: 'normal',
  },
  statCardDays: {
    fontSize: 14,
    fontWeight: '500',
  },
  statCardPercentage: {
    fontSize: 32,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
  },
});
