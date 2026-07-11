import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { CircleCheck as CheckCircle, Circle, Flame, Award, TrendingUp, Check, Plus, Lock, Eye, X } from 'lucide-react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Goal, DailyActivity, DailyCompletion } from '@/types/database';
import { useTheme } from '@/contexts/ThemeContext';
import { DayBadge } from './DayBadge';
import EvidenceLogSection from './EvidenceLog';
import CompassCard from './CompassCard';
import GracePeriodModal from './GracePeriodModal';
import ChallengeCompleteScreen from './ChallengeCompleteScreen';
import { isDateLocked, toLocalDateString, parseLocalDate, getDayNumberFromChallengeStart } from '@/lib/dateHelpers';
import { archiveCurrentChallenge } from '@/lib/archiveHelpers';
import { resetChallenge } from '@/lib/resetHelpers';
import CoachCard from './CoachCard';
import { useRacingBorder } from '@/contexts/RacingBorderContext';
import { useCelebration } from '@/contexts/CelebrationContext';

let Haptics: any = null;
if (Platform.OS !== 'web') {
  try {
    Haptics = require('expo-haptics');
  } catch {}
}


const MILESTONE_DAYS = [7, 21, 40, 77];

interface DailyDashboardProps {
  goal: Goal;
  activities: DailyActivity[];
  onRefresh: () => void;
  onLockedInteraction?: () => void;
}

interface ActivityItemProps {
  activity: DailyActivity;
  isCompleted: boolean;
  editMode: boolean;
  isDayLocked: boolean;
  onPress: () => void;
  onDelete: () => void;
}

function ActivityItem({
  activity,
  isCompleted,
  editMode,
  isDayLocked,
  onPress,
  onDelete,
}: ActivityItemProps) {
  const { colors } = useTheme();
  const checkScale = useSharedValue(isCompleted ? 1 : 0);
  const cardScale = useSharedValue(1);
  const borderWidth = useSharedValue(isCompleted ? 2 : 0);

  useEffect(() => {
    if (isCompleted) {
      checkScale.value = withSequence(
        withSpring(1.15, { damping: 15, stiffness: 180 }),
        withSpring(1, { damping: 12, stiffness: 160 })
      );
      cardScale.value = withSequence(
        withSpring(0.99, { damping: 20, stiffness: 250 }),
        withSpring(1, { damping: 18, stiffness: 220 })
      );
      borderWidth.value = withSequence(
        withTiming(2, { duration: 1200 }),
        withTiming(0, { duration: 300 })
      );
    } else {
      checkScale.value = withTiming(0, { duration: 200 });
      cardScale.value = withSpring(1, { damping: 15, stiffness: 300 });
      borderWidth.value = withTiming(0, { duration: 200 });
    }
  }, [isCompleted]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const borderAnimatedStyle = useAnimatedStyle(() => ({
    borderWidth: borderWidth.value,
    borderColor: '#ccff00',
  }));

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }));

  const uncheckedAnimatedStyle = useAnimatedStyle(() => ({
    opacity: isCompleted ? 0 : 1,
    transform: [{ scale: isCompleted ? 0 : 1 }],
  }));

  return (
    <Animated.View style={[styles.activityItemWrapper, animatedStyle]}>
      <Animated.View style={[borderAnimatedStyle, styles.activityCardBorderWrapper]}>
        <TouchableOpacity
          style={[
            styles.activityCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: isCompleted && !editMode ? 0 : 2,
            },
            isDayLocked && styles.activityCardLocked,
          ]}
          onPress={!editMode && !isDayLocked ? onPress : undefined}
          disabled={editMode || isDayLocked}
          activeOpacity={isDayLocked ? 1 : 0.7}
        >
          <View style={styles.activityTextContainer}>
            <Text
              style={[styles.activityText, { color: colors.text }]}
              numberOfLines={2}
            >
              {activity.activity_name}
            </Text>
          </View>

          {!editMode && (
            <View style={styles.checkmarkContainer}>
              {isDayLocked ? (
                <View style={[styles.lockIconContainer, { backgroundColor: colors.backgroundSecondary }]}>
                  <Lock size={20} color={colors.textTertiary} strokeWidth={2.5} />
                </View>
              ) : (
                <>
                  <Animated.View style={[styles.checkmarkCircle, checkAnimatedStyle]}>
                    <View style={[styles.checkmarkCircleInner, { backgroundColor: colors.primary }]}>
                      <Check size={22} color="#000000" strokeWidth={3} />
                    </View>
                  </Animated.View>
                  <Animated.View style={[styles.uncheckedCircle, uncheckedAnimatedStyle]}>
                    <View style={[styles.uncheckedCircleInner, { borderColor: colors.border }]} />
                  </Animated.View>
                </>
              )}
            </View>
          )}

          {editMode && (
            <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
              <View style={styles.deleteButtonInner}>
                <X size={12} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}


export default function DailyDashboard({
  goal,
  activities,
  onRefresh,
  onLockedInteraction,
}: DailyDashboardProps) {
  const { colors, isDark } = useTheme();
  const { triggerRacingBorder } = useRacingBorder();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const celebrationSuppressed = useRef(false);
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [completedActivities, setCompletedActivities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [newActivityName, setNewActivityName] = useState('');
  const [addingActivity, setAddingActivity] = useState(false);
  const [localActivities, setLocalActivities] = useState<DailyActivity[]>([]);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    draggedIndex: number | null;
    targetIndex: number | null;
  }>({
    isDragging: false,
    draggedIndex: null,
    targetIndex: null,
  });
  const [confettiCompleted, setConfettiCompleted] = useState(false);
  const { celebrationOpen, openCelebration, closeCelebration } = useCelebration();
  const [watcherCount, setWatcherCount] = useState(0);
  const [perfectDays, setPerfectDays] = useState(0);
  const [phase2ThisMonth, setPhase2ThisMonth] = useState(0);
  const [bestStreak, setBestStreak] = useState(goal.best_streak || 0);
  const [showGracePeriodModal, setShowGracePeriodModal] = useState(false);
  const [gracePeriodDaysMissed, setGracePeriodDaysMissed] = useState(0);
  const [gracePeriodMode, setGracePeriodMode] = useState<'grace' | 'reset'>('grace');

  const progressWidth = useSharedValue(0);
  const progressTextColor = useSharedValue(0);
  const today = toLocalDateString(new Date());
  const isKeepGoing = goal.challenge_phase === 'keep_going';
  const isDayLocked = isKeepGoing
    ? false
    : isDateLocked(today, goal.challenge_start_date, goal.last_completion_date);

  const currentDay = goal.current_challenge_day || 1;
  const displayDay = goal.challenge_start_date
    ? getDayNumberFromChallengeStart(goal.challenge_start_date, today)
    : 1;

  useEffect(() => {
    setLocalActivities([...activities].sort((a, b) => a.order_position - b.order_position));
  }, [activities]);

  useEffect(() => {
    loadTodayCompletion();
    loadStreak();
    loadWatcherCount();
    loadPerfectDays();
    if (isKeepGoing) {
      loadPhase2ThisMonth();
    }
    if (!goal.celebration_seen && isKeepGoing) {
      openCelebration();
    }
  }, [goal.id]);

  // Re-present the celebration when returning to the Today tab
  // while it's still pending (not yet seen). Tab screens stay mounted,
  // so the mount effect above won't re-run on tab focus.
  useFocusEffect(
    useCallback(() => {
      const celebrationPending =
        goal.challenge_phase === 'challenge' &&
        goal.current_challenge_day >= 77 &&
        !goal.celebration_seen;
      if (celebrationPending && !celebrationOpen && !celebrationSuppressed.current) {
        openCelebration();
      }
    }, [goal.challenge_phase, goal.current_challenge_day, goal.celebration_seen])
  );

  const progress = activities.length > 0
    ? (completedActivities.length / activities.length) * 100
    : 0;

  useEffect(() => {
    progressWidth.value = withSpring(progress, { damping: 20, stiffness: 100 });
    progressTextColor.value = withTiming(progress >= 50 ? 1 : 0, {
      duration: 300,
    });
  }, [progress]);

  useEffect(() => {
    if (progress < 100) {
      setConfettiCompleted(false);
    }
  }, [progress]);

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const progressTextAnimatedStyle = useAnimatedStyle(() => {
    if (!isDark) {
      return { color: '#000000' };
    }
    const red = Math.round(255 - (255 * progressTextColor.value));
    const green = Math.round(255 - (255 * progressTextColor.value));
    const blue = Math.round(255 - (255 * progressTextColor.value));
    return {
      color: `rgb(${red}, ${green}, ${blue})`,
    };
  });

  const loadStreak = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_completions')
        .select('*')
        .eq('goal_id', goal.id)
        .not('completed_at', 'is', null)
        .order('completion_date', { ascending: false })
        .limit(30);

      if (error) throw error;

      let streakCount = 0;
      const sortedDates = (data || []).map((d) => d.completion_date).sort().reverse();
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      for (const dateString of sortedDates) {
        const date = parseLocalDate(dateString);
        const expectedDate = new Date(currentDate);
        expectedDate.setDate(expectedDate.getDate() - streakCount);

        if (toLocalDateString(date) === toLocalDateString(expectedDate)) {
          streakCount++;
        } else {
          break;
        }
      }

      setStreak(streakCount);

      if (streakCount > (goal.best_streak || 0)) {
        setBestStreak(streakCount);
        await supabase
          .from('goals')
          .update({ best_streak: streakCount })
          .eq('id', goal.id);
      }
    } catch (error) {
      console.error('Error loading streak:', error);
    }
  };

  const loadPhase2ThisMonth = async () => {
    try {
      const now = new Date();
      const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const { count, error } = await supabase
        .from('daily_completions')
        .select('*', { count: 'exact', head: true })
        .eq('goal_id', goal.id)
        .like('completion_date', `${monthPrefix}%`)
        .not('completed_at', 'is', null);
      if (error) throw error;
      setPhase2ThisMonth(count || 0);
    } catch (error) {
      console.error('Error loading this month count:', error);
    }
  };

  const loadWatcherCount = async () => {
    try {
      const { count, error } = await supabase
        .from('watchers')
        .select('*', { count: 'exact', head: true })
        .eq('watched_id', goal.user_id || 'demo-user');

      if (error) throw error;
      setWatcherCount(count || 0);
    } catch (error) {
      console.error('Error loading watcher count:', error);
    }
  };

  const loadPerfectDays = async () => {
    try {
      const { count, error } = await supabase
        .from('daily_completions')
        .select('*', { count: 'exact', head: true })
        .eq('goal_id', goal.id)
        .not('completed_at', 'is', null);

      if (error) throw error;
      setPerfectDays(count || 0);
    } catch (error) {
      console.error('Error loading perfect days:', error);
    }
  };

  const checkForMissedDays = async () => {
    if (onLockedInteraction) return;
    if (isKeepGoing) return;
    if (!goal.last_completion_date) return;

    const lastDate = parseLocalDate(goal.last_completion_date);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff <= 1) return;

    const todayStr = toLocalDateString(todayDate);
    if (goal.grace_period_prompted_date === todayStr) return;

    if (daysDiff === 2) {
      setGracePeriodMode('grace');
      setGracePeriodDaysMissed(1);
      setShowGracePeriodModal(true);
      return;
    }

    // daysDiff > 2: forced reset with acknowledgment
    await performReset();
    setGracePeriodMode('reset');
    setGracePeriodDaysMissed(daysDiff - 1);
    setShowGracePeriodModal(true);
  };

  const markGracePromptSeen = async () => {
    const todayStr = toLocalDateString(new Date());
    await supabase
      .from('goals')
      .update({ grace_period_prompted_date: todayStr })
      .eq('id', goal.id);
  };

  const performReset = async () => {
    await resetChallenge(goal, supabase, 'restarted');
    onRefresh();
  };

  const handleGraceKeepGoing = async () => {
    setShowGracePeriodModal(false);
    await markGracePromptSeen();

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

    await supabase
      .from('goals')
      .update({
        last_completion_date: yesterdayStr,
        current_challenge_day: (goal.current_challenge_day || 0) + 1,
      })
      .eq('id', goal.id);

    onRefresh();
  };

  const handleGraceStartOver = async () => {
    setShowGracePeriodModal(false);
    // In reset mode the challenge was already reset before the modal opened;
    // in grace mode (user chose "I missed it") reset now.
    if (gracePeriodMode === 'grace') {
      await performReset();
    }
    onRefresh();
  };

  const loadTodayCompletion = async () => {
    if (onLockedInteraction) { setLoading(false); return; }
    try {
      await checkForMissedDays();

      const { data, error } = await supabase
        .from('daily_completions')
        .select('*')
        .eq('goal_id', goal.id)
        .eq('completion_date', today)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setCompletion(data);
        setCompletedActivities(data.activities_completed || []);
      } else {
        const { data: newCompletion, error: insertError } = await supabase
          .from('daily_completions')
          .insert({
            goal_id: goal.id,
            completion_date: today,
            is_rest_day: false,
            activities_completed: [],
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setCompletion(newCompletion);
        setCompletedActivities([]);
      }
    } catch (error) {
      console.error('Error loading completion:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerHaptics = () => {
    if (!Haptics) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => {
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
      }, 400);
    } catch {}
  };

  const toggleActivity = async (activityId: string) => {
    if (onLockedInteraction) { onLockedInteraction(); return; }
    if (editMode || isDayLocked) return;

    const wasComplete = completedActivities.length === activities.length;
    const newCompleted = completedActivities.includes(activityId)
      ? completedActivities.filter((id) => id !== activityId)
      : [...completedActivities, activityId];

    setCompletedActivities(newCompleted);

    const allComplete = newCompleted.length === activities.length;
    const becameIncomplete = wasComplete && !allComplete;

    try {
      const { error } = await supabase
        .from('daily_completions')
        .update({
          activities_completed: newCompleted,
          completed_at: allComplete ? new Date().toISOString() : null,
        })
        .eq('id', completion!.id);

      if (error) throw error;

      if (becameIncomplete && goal.last_completion_date === today) {
        // Revert the day advance: find the most recent prior completion date.
        const { data: prior } = await supabase
          .from('daily_completions')
          .select('completion_date')
          .eq('goal_id', goal.id)
          .not('completed_at', 'is', null)
          .neq('completion_date', today)
          .order('completion_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        await supabase
          .from('goals')
          .update({
            current_challenge_day: Math.max(1, (goal.current_challenge_day || 1) - 1),
            last_completion_date: prior?.completion_date ?? null,
          })
          .eq('id', goal.id);

        loadStreak();
        loadPerfectDays();
        onRefresh();
        return;
      }

      if (allComplete) {
        const shouldIncrementDay = goal.last_completion_date !== today;
        const isFirstDay = !goal.challenge_start_date;

        const updates: any = {
          last_completion_date: today,
        };

        if (shouldIncrementDay || isFirstDay) {
          const newDay = (goal.current_challenge_day || 0) + 1;
          updates.current_challenge_day = newDay;

          if (isFirstDay) {
            const startDate = new Date();
            startDate.setHours(0, 0, 0, 0);
            updates.challenge_start_date = startDate.toISOString();
          }

          // Day-77 side effects (archive + phase flip) are deferred to the
          // celebration modal so an accidental tap can be un-checked.
          // We only advance the day here; the modal fires separately.
        }

        await supabase
          .from('goals')
          .update(updates)
          .eq('id', goal.id);

        loadStreak();
        loadPerfectDays();

        triggerHaptics();
        triggerRacingBorder(() => {
          setConfettiCompleted(true);
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 600);
        });

        const newDay = updates.current_challenge_day ?? goal.current_challenge_day;
        if (newDay >= 77 && !goal.celebration_seen && goal.challenge_phase === 'challenge') {
          setTimeout(() => {
            celebrationSuppressed.current = false;
            openCelebration();
          }, 3500);
        }
      }
      onRefresh();
    } catch (error) {
      console.error('Error updating completion:', error);
    }
  };

  const addActivity = async () => {
    if (onLockedInteraction) { onLockedInteraction(); return; }
    if (!newActivityName.trim()) return;

    setAddingActivity(true);
    try {
      const maxOrder = activities.length > 0
        ? Math.max(...activities.map((a) => a.order_position))
        : 0;

      const { error } = await supabase.from('daily_activities').insert({
        goal_id: goal.id,
        activity_name: newActivityName.trim(),
        activity_type: 'custom',
        order_position: maxOrder + 1,
      });

      if (error) throw error;

      setNewActivityName('');
      onRefresh();
    } catch (error) {
      console.error('Error adding activity:', error);
      Alert.alert('Error', 'Failed to add activity');
    } finally {
      setAddingActivity(false);
    }
  };

  const deleteActivity = async (activityId: string) => {
    try {
      const { error } = await supabase
        .from('daily_activities')
        .delete()
        .eq('id', activityId);

      if (error) throw error;

      const newCompleted = completedActivities.filter((id) => id !== activityId);
      setCompletedActivities(newCompleted);

      if (completion) {
        await supabase
          .from('daily_completions')
          .update({
            activities_completed: newCompleted,
            completed_at: null,
          })
          .eq('id', completion.id);
      }

      onRefresh();
    } catch (error) {
      console.error('Error deleting activity:', error);
      Alert.alert('Error', 'Failed to delete activity');
    }
  };

  const handleDragStart = (index: number) => {
    setDragState({
      isDragging: true,
      draggedIndex: index,
      targetIndex: index,
    });
  };

  const handleDragUpdate = (draggedIndex: number, targetIndex: number) => {
    setDragState({
      isDragging: true,
      draggedIndex,
      targetIndex,
    });
  };

  const handleDragEnd = () => {
    setDragState({
      isDragging: false,
      draggedIndex: null,
      targetIndex: null,
    });
  };

  const reorderActivities = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    const newActivities = [...localActivities];
    const [movedItem] = newActivities.splice(fromIndex, 1);
    newActivities.splice(toIndex, 0, movedItem);

    setLocalActivities(newActivities);
  };

  const saveActivityOrder = async () => {
    try {
      const updates = localActivities.map((activity, index) => ({
        id: activity.id,
        order_position: index + 1,
      }));

      for (const update of updates) {
        await supabase
          .from('daily_activities')
          .update({ order_position: update.order_position })
          .eq('id', update.id);
      }

      onRefresh();
    } catch (error) {
      console.error('Error saving order:', error);
      Alert.alert('Error', 'Failed to save order');
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollViewRef}
        style={[styles.container, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={isDark ? ['#000000', '#111111', '#000000'] : ['#F5F5F0', '#F0F0EB', '#F5F5F0']}
          style={styles.gradient}
        >
          <View style={styles.heroSection}>
            {isDayLocked && (
              <View style={[styles.lockedBanner, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Lock size={18} color={colors.textSecondary} strokeWidth={2.5} />
                <Text style={[styles.lockedBannerText, { color: colors.textSecondary }]}>
                  This day is locked. You can only view past days.
                </Text>
              </View>
            )}
            <View style={styles.dateContainer}>
              <Text style={[styles.date, { color: colors.text }]}>
                DAY {displayDay}
              </Text>
              <Text style={[styles.dateLabel, { color: colors.textTertiary }]}>
                {isKeepGoing ? goal.title?.toUpperCase() : '77-DAY CHALLENGE'}
              </Text>
            </View>

            {isKeepGoing ? (
              <View style={styles.metricsGrid}>
                <View style={styles.metricsRow}>
                  <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: isDark ? colors.border : colors.primary }]}>
                    <Text style={[styles.metricValue, { color: colors.primary }]}>{streak}</Text>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Current Streak</Text>
                  </View>
                  <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: isDark ? colors.border : colors.primary }]}>
                    <Text style={[styles.metricValue, { color: colors.primary }]}>{phase2ThisMonth}</Text>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>This Month</Text>
                  </View>
                </View>
              </View>
            ) : (
              <CoachCard challengeDay={displayDay} />
            )}

            {goal.identity_statement && (
              <View style={[styles.identityChip, {
                backgroundColor: isDark ? colors.backgroundSecondary : '#1A1A1A',
                borderColor: isDark ? colors.border : '#1A1A1A',
              }]}>
                <Text style={styles.identityChipLabel}>MY IDENTITY</Text>
                <Text style={styles.identityChipText} numberOfLines={6}>
                  {goal.identity_statement}
                </Text>
              </View>
            )}

            <View style={[styles.watcherBadge, {
              backgroundColor: isDark ? colors.backgroundSecondary : colors.card,
              borderColor: isDark ? colors.border : colors.border,
            }]}>
              <Eye size={20} color={isDark ? colors.primary : '#000000'} strokeWidth={2.5} />
              <Text style={[styles.watcherCount, { color: isDark ? colors.text : '#000000' }]}>
                {watcherCount}
              </Text>
              <Text style={[styles.watcherLabel, { color: isDark ? colors.textSecondary : '#404040' }]}>
                {watcherCount === 1 ? 'person watching' : 'people watching'}
              </Text>
            </View>

            {goal.compass_filter_question && (
              <CompassCard
                declaration={goal.compass_declaration ?? ''}
                filterQuestion={goal.compass_filter_question}
                onLockedInteraction={onLockedInteraction}
              />
            )}

            <View style={styles.progressSection}>
              <View style={[styles.progressBarContainer, { backgroundColor: colors.backgroundSecondary }]}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    { backgroundColor: colors.primary },
                    progressAnimatedStyle,
                  ]}
                />
                <View style={styles.progressPercentContainer}>
                  <Animated.Text style={[styles.progressPercent, progressTextAnimatedStyle]}>
                    {Math.round(progress)}%
                  </Animated.Text>
                </View>
              </View>
              <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                {completedActivities.length} of {activities.length} complete
              </Text>
            </View>
          </View>

          <View style={styles.content}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Success Stack</Text>
                <Text style={styles.sectionSubtitle}>your daily inputs</Text>
              </View>
              {!isDayLocked && (
                <TouchableOpacity
                  style={[styles.editButton, editMode && styles.editButtonActive]}
                  onPress={async () => {
                    if (onLockedInteraction) { onLockedInteraction(); return; }
                    if (editMode) {
                      await saveActivityOrder();
                    }
                    setEditMode(!editMode);
                  }}
                >
                  <Text style={[styles.editButtonText, editMode && styles.editButtonTextActive]}>
                    {editMode ? 'DONE' : 'EDIT'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {editMode && (
              <View style={styles.addActivitySection}>
                <TextInput
                  style={styles.addActivityInput}
                  placeholder="Add a new input"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={newActivityName}
                  onChangeText={setNewActivityName}
                  onSubmitEditing={addActivity}
                  returnKeyType="done"
                  editable={true}
                />
                <TouchableOpacity
                  style={[styles.addActivityButton, (!newActivityName.trim() || addingActivity) && styles.addActivityButtonDisabled]}
                  onPress={addActivity}
                  disabled={addingActivity || !newActivityName.trim()}
                >
                  {addingActivity ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <Text style={styles.addActivityButtonText}>ADD</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.activitiesList}>
              {localActivities.map((activity) => {
                const isCompleted = completedActivities.includes(activity.id);

                return (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    isCompleted={isCompleted}
                    editMode={editMode}
                    isDayLocked={isDayLocked}
                    onPress={() => toggleActivity(activity.id)}
                    onDelete={() => deleteActivity(activity.id)}
                  />
                );
              })}
            </View>

            {!editMode && (
              <EvidenceLogSection
                goalId={goal.id}
                date={today}
                readOnly={isDayLocked}
                challengeDay={displayDay}
                onLockedInteraction={onLockedInteraction}
              />
            )}

            {confettiCompleted && progress === 100 && (
              <DayBadge
                day={displayDay}
                isMilestone={MILESTONE_DAYS.includes(displayDay)}
              />
            )}
          </View>
        </LinearGradient>
      </ScrollView>


      {celebrationOpen && (
        <Modal visible={celebrationOpen} animationType="fade" statusBarTranslucent>
          <ChallengeCompleteScreen
            goal={goal}
            activities={activities}
            onKeepGoing={async () => {
              // Deferred from toggleActivity: now safe to flip phase and archive.
              if (goal.challenge_phase === 'challenge') {
                await supabase
                  .from('goals')
                  .update({ challenge_phase: 'keep_going' })
                  .eq('id', goal.id);
                archiveCurrentChallenge(goal, supabase, 'completed').catch(() => {});
              }
              closeCelebration();
              onRefresh();
            }}
            onRunItAgain={() => {
              closeCelebration();
              onRefresh();
            }}
            onStartFresh={() => {
              closeCelebration();
              onRefresh();
            }}
            onSeeWall={() => {
              // Dismiss WITHOUT setting celebration_seen —
              // the celebration will reappear when the user
              // returns to the Today tab.
              closeCelebration();
              router.push('/(tabs)/calendar');
            }}
            onDismiss={() => {
              celebrationSuppressed.current = true;
              closeCelebration();
            }}
          />
        </Modal>
      )}
      <GracePeriodModal
        visible={showGracePeriodModal}
        daysMissed={gracePeriodDaysMissed}
        mode={gracePeriodMode}
        onKeepGoing={handleGraceKeepGoing}
        onStartOver={handleGraceStartOver}
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
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSection: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 32,
  },
  dateContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 2,
    marginBottom: 4,
  },
  date: {
    fontSize: 80,
    fontWeight: '900',
    letterSpacing: -2,
    textAlign: 'center',
    fontFamily: 'Inter-Black',
  },
  watcherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 2,
    marginBottom: 24,
    alignSelf: 'center',
  },
  watcherCount: {
    fontSize: 18,
    fontWeight: '900',
  },
  watcherLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  metricsGrid: {
    gap: 12,
    marginBottom: 24,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    padding: 20,
  },
  metricCardHero: {
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  metricValueHero: {
    fontSize: 72,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: -2,
    fontFamily: 'Inter-Black',
  },
  metricLabelHero: {
    fontSize: 16,
    fontWeight: '700',
  },
  metricValue: {
    fontSize: 36,
    fontWeight: '900',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
  },
  statBadgeText: {
    fontSize: 14,
    fontWeight: '800',
  },
  goalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    lineHeight: 28,
  },
  progressSection: {
    gap: 8,
  },
  progressBarContainer: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 28,
  },
  progressPercentContainer: {
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressPercent: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 16,
  },
  sectionHeaderLeft: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.35)',
  },
  editButton: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'center',
  },
  editButtonActive: {
    backgroundColor: '#CCFF00',
  },
  editButtonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#CCFF00',
    letterSpacing: 0.1 * 10,
  },
  editButtonTextActive: {
    color: '#1A1A1A',
  },
  addActivitySection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  addActivityInput: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addActivityButton: {
    backgroundColor: '#CCFF00',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
  },
  addActivityButtonDisabled: {
    opacity: 0.4,
  },
  addActivityButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 0.8,
  },
  activitiesList: {
    gap: 12,
  },
  activityItemWrapper: {
    marginBottom: 0,
  },
  activityCardBorderWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    minHeight: 72,
    position: 'relative',
    overflow: 'hidden',
  },
  activityTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  activityText: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  checkmarkContainer: {
    width: 48,
    height: 48,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkCircle: {
    position: 'absolute',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkCircleInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uncheckedCircle: {
    position: 'absolute',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uncheckedCircleInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
  },
  deleteButton: {
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 20,
  },
  lockedBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  identityChip: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginBottom: 16,
    gap: 4,
  },
  identityChipLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#ccff00',
  },
  identityChipText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  activityCardLocked: {
    opacity: 0.6,
  },
  lockIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
