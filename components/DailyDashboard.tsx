import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { completionsKey } from '@/hooks/useCompletions';
import { useStreakSummary } from '@/hooks/useStreakSummary';
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
  AppState,
  ImageBackground,
  Image,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withSpring,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { CircleCheck as CheckCircle, Circle, Flame, Award, TrendingUp, Check, Plus, Lock, Eye, X, Zap, Bell, ChevronRight, Compass } from 'lucide-react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Goal, DailyActivity, DailyCompletion } from '@/types/database';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DayBadge } from './DayBadge';
import EvidenceLogSection from './EvidenceLog';
import CompassCard from './CompassCard';
import GracePeriodModal from './GracePeriodModal';
import ChallengeCompleteScreen from './ChallengeCompleteScreen';
import { isDateLocked, toLocalDateString, parseLocalDate, getDayNumberFromChallengeStart, toLocalMidnight } from '@/lib/dateHelpers';
import { archiveCurrentChallenge } from '@/lib/archiveHelpers';
import { resetChallenge } from '@/lib/resetHelpers';
import { checkAndAwardBadges } from '@/lib/badgeHelpers';
import { useBadgeCelebration } from '@/contexts/BadgeCelebrationContext';
import { useAuth } from '@/contexts/AuthContext';
import CoachCardCarousel from './CoachCardCarousel';
import { useRacingBorder } from '@/contexts/RacingBorderContext';
import WhenPickerModal, { WhenPickerValue } from './identity/WhenPickerModal';
import InviteWatcherModal from './InviteWatcherModal';
import { resyncAllReminders } from '@/lib/notifications';
import { focusState } from '@/lib/focusState';
import { useCelebration } from '@/contexts/CelebrationContext';
import { checkForNewReactions, markReactionsRead, ReactionGroup } from '@/lib/reactionHelpers';
import ReactionBurst from './ReactionBurst';
import EncouragementToast from './EncouragementToast';
import BrandedLoadingScreen from '@/components/BrandedLoadingScreen';
import DayView from './DayView';

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
  onPress: (id: string) => void;
  onDelete: (id: string) => void;
  onEditSchedule: (activity: DailyActivity) => void;
}

const ActivityItem = React.memo(function ActivityItem({
  activity,
  isCompleted,
  editMode,
  isDayLocked,
  onPress,
  onDelete,
  onEditSchedule,
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
          onPress={!editMode && !isDayLocked ? () => onPress(activity.id) : undefined}
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
            <View style={styles.editControlsRow}>
              <TouchableOpacity style={styles.scheduleButton} onPress={() => onEditSchedule(activity)}>
                <Bell size={16} color={colors.textTertiary} strokeWidth={2.5} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(activity.id)}>
                <View style={styles.deleteButtonInner}>
                  <X size={12} color="#FFFFFF" strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
});


export default function DailyDashboard({
  goal,
  activities,
  onRefresh,
  onLockedInteraction,
}: DailyDashboardProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { triggerRacingBorder } = useRacingBorder();
  const { user } = useAuth();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const celebrationSuppressed = useRef(false);
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [completedActivities, setCompletedActivities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [badgeAnimationReady, setBadgeAnimationReady] = useState(false);
  const [reactionBursts, setReactionBursts] = useState<ReactionGroup[]>([]);
  const isFocusedRef = useRef(true);
  const playedCountRef = useRef(0);
  const { celebrationOpen, openCelebration, closeCelebration } = useCelebration();
  const { celebrateBadge } = useBadgeCelebration();
  const [watcherCount, setWatcherCount] = useState(0);
  const [bestStreak, setBestStreak] = useState(goal.best_streak || 0);
  const [showGracePeriodModal, setShowGracePeriodModal] = useState(false);
  const [editingScheduleFor, setEditingScheduleFor] = useState<DailyActivity | null>(null);
  const [gracePeriodDaysMissed, setGracePeriodDaysMissed] = useState(0);
  const [gracePeriodMode, setGracePeriodMode] = useState<'grace' | 'reset'>('grace');
  const [realtimeGen, setRealtimeGen] = useState(0);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [showDayView, setShowDayView] = useState(false);

  const [showWatcherSheet, setShowWatcherSheet] = useState(false);
  const [watcherProfiles, setWatcherProfiles] = useState<{ id: string; display_name: string; username: string; photo_url: string | null; created_at: string }[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const prevAppStateRef = useRef<string>('active');
  const completionRef = useRef<DailyCompletion | null>(null);
  const refetchIfDayChangedRef = useRef<(() => void) | null>(null);
  const toggleActivityRef = useRef<(id: string) => void>(() => {});
  const deleteActivityRef = useRef<(id: string) => void>(() => {});

  const { streak, perfectDays, phase2ThisMonth, invalidate: refreshStreakSummary } = useStreakSummary(goal.id);
  const queryClient = useQueryClient();
  const refreshCompletions = () => queryClient.invalidateQueries({ queryKey: completionsKey(goal.id) });

  useEffect(() => {
    if (streak > bestStreak) {
      setBestStreak(streak);
      supabase
        .from('goals')
        .update({ best_streak: streak })
        .eq('id', goal.id)
        .then(({ error }) => {
          if (error) console.error('Error updating best streak:', error);
        });
    }
  }, [streak]);

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
  const dayAnim = useSharedValue(0);
  const [hasAnimatedDay, setHasAnimatedDay] = useState(false);
  const [dayDisplayText, setDayDisplayText] = useState('0');
  useEffect(() => {
    if (hasAnimatedDay) return;
    dayAnim.value = 0;
    dayAnim.value = withTiming(displayDay, { duration: 900, easing: Easing.out(Easing.cubic) });
    const interval = setInterval(() => {
      setDayDisplayText(String(Math.round(dayAnim.value)));
    }, 16);
    let hapticInterval: ReturnType<typeof setInterval> | null = null;
    if (Haptics) {
      hapticInterval = setInterval(() => {
        try { Haptics.selectionAsync(); } catch {}
      }, 90);
    }
    const stopTimer = setTimeout(() => {
      clearInterval(interval);
      if (hapticInterval) clearInterval(hapticInterval);
      setDayDisplayText(String(displayDay));
      setHasAnimatedDay(true);
    }, 950);
    return () => {
      clearInterval(interval);
      if (hapticInterval) clearInterval(hapticInterval);
      clearTimeout(stopTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalActivities([...activities].sort((a, b) => a.order_position - b.order_position));
  }, [activities]);

  useEffect(() => {
    loadTodayCompletion();
    loadWatcherCount();
    if (!goal.celebration_seen && isKeepGoing) {
      openCelebration();
    }
  }, [goal.id]);

  // Re-present the celebration when returning to the Today tab
  // while it's still pending (not yet seen). Tab screens stay mounted,
  // so the mount effect above won't re-run on tab focus.
  useFocusEffect(useCallback(() => {
    isFocusedRef.current = true;
    focusState.isTodayFocused = true;

    const celebrationPending =
      goal.challenge_phase === 'challenge' &&
      goal.current_challenge_day >= 77 &&
      !goal.celebration_seen;
    if (celebrationPending && !celebrationOpen && !celebrationSuppressed.current) {
      openCelebration();
    }

    if (user?.id) {
      checkForNewReactions(user.id).then((groups) => {
        if (groups.length > 0) {
          setReactionBursts(groups);
        }
      }).catch((err) => {
        console.error('checkForNewReactions failed:', err);
      });
    }

    loadWatcherCount();

    refetchIfDayChangedRef.current?.();

    return () => {
      isFocusedRef.current = false;
      focusState.isTodayFocused = false;
    };
  }, [goal.challenge_phase, goal.current_challenge_day, goal.celebration_seen, user?.id, celebrationOpen, openCelebration]));

  // Real-time subscription for new reactions while the app is open
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('reaction-bursts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'encouragements',
          filter: `to_user_id=eq.${user.id}`,
        },
        async (payload) => {
          const row = payload.new as any;
          if (row.message !== null) return;
          const emoji = row.emoji;
          if (!emoji) return;
          if (!isFocusedRef.current) return;

          let senderName: string | undefined;
          let senderPhotoUrl: string | undefined;
          if (row.from_user_id) {
            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('display_name, photo_url')
              .eq('id', row.from_user_id)
              .maybeSingle();
            senderName = senderProfile?.display_name ?? undefined;
            senderPhotoUrl = senderProfile?.photo_url ?? undefined;
          }

          setReactionBursts((prev) => {
            const last = prev[prev.length - 1];
            if (
              last &&
              last.emoji === emoji &&
              last.senderName === senderName &&
              prev.length > 1
            ) {
              return [...prev.slice(0, -1), { ...last, count: last.count + 1 }];
            }
            return [...prev, { emoji, count: 1, senderName, senderPhotoUrl }];
          });
        }
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          console.warn('[reaction-bursts] subscription status:', status);
        }
      });

    const watcherChannel = supabase
      .channel('watcher-count')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'watchers',
          filter: `watched_id=eq.${user.id}`,
        },
        () => loadWatcherCount()
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'watchers',
          filter: `watched_id=eq.${user.id}`,
        },
        () => loadWatcherCount()
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          console.warn('[watcher-count] subscription status:', status);
        }
      });

    // Polling safety net: if the realtime socket silently misses an INSERT
    // while the app stays continuously foregrounded (no AppState transition
    // to trigger a rebuild), this guarantees delivery within ~20 seconds.
    const pollInterval = setInterval(() => {
      checkForNewReactions(user.id).then((groups) => {
        if (groups.length > 0) {
          setReactionBursts(groups);
        }
      }).catch((err) => {
        console.error('checkForNewReactions failed:', err);
      });
    }, 20000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
      supabase.removeChannel(watcherChannel);
    };
  }, [user?.id, realtimeGen]);

  // Force a clean rebuild of realtime channels on every foreground transition.
  // iOS suspends websockets when the app is backgrounded; on resume the
  // channels can report SUBSCRIBED but deliver nothing (zombie state).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const prev = prevAppStateRef.current;
      prevAppStateRef.current = nextAppState;
      if (nextAppState === 'active' && (prev === 'background' || prev === 'inactive')) {
        setRealtimeGen(g => g + 1);
        loadWatcherCount();
        if (user?.id) {
          checkForNewReactions(user.id).then((groups) => {
            if (groups.length > 0) {
              setReactionBursts(groups);
            }
          }).catch((err) => {
            console.error('checkForNewReactions failed:', err);
          });
        }
        refetchIfDayChangedRef.current?.();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user?.id]);

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
      setBadgeAnimationReady(false);
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

  const loadWatcherProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('watchers')
        .select('watcher_id, created_at')
        .eq('watched_id', goal.user_id || '');
      if (error) throw error;
      if (!data || data.length === 0) {
        setWatcherProfiles([]);
        return;
      }
      const watcherIds = data.map(w => w.watcher_id);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, username, photo_url')
        .in('id', watcherIds);
      if (profileError) throw profileError;
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      setWatcherProfiles(data.map(w => {
        const p = profileMap.get(w.watcher_id);
        return {
          id: w.watcher_id,
          display_name: p?.display_name || 'Unknown',
          username: p?.username || '',
          photo_url: p?.photo_url || null,
          created_at: w.created_at,
        };
      }));
    } catch (error) {
      console.error('Error loading watcher profiles:', error);
      setWatcherProfiles([]);
    }
  };

  const checkForMissedDays = async () => {
    if (onLockedInteraction) return;
    if (isKeepGoing) return;
    if (!goal.last_completion_date) {
      if (!goal.challenge_start_date) return;
      const startDate = toLocalMidnight(goal.challenge_start_date);
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const daysSinceStart = Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceStart <= 0) return;
      const todayStr = toLocalDateString(todayDate);
      if (goal.grace_period_prompted_date === todayStr) return;
      if (daysSinceStart === 1) {
        setGracePeriodMode('grace');
        setGracePeriodDaysMissed(1);
        setShowGracePeriodModal(true);
        return;
      }
      await performReset();
      setGracePeriodMode('reset');
      setGracePeriodDaysMissed(daysSinceStart);
      setShowGracePeriodModal(true);
      return;
    }

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

    const updates: any = { last_completion_date: yesterdayStr };
    if (!existing) {
      updates.current_challenge_day = (goal.current_challenge_day || 0) + 1;
    }
    await supabase
      .from('goals')
      .update(updates)
      .eq('id', goal.id);

    refreshCompletions();
    if (user) {
      try {
        const updatedGoal = { ...goal, ...updates };
        const newBadges = await checkAndAwardBadges(user.id, updatedGoal);
        newBadges.forEach((key) => celebrateBadge(key));
      } catch (err) {
        console.error('Badge check failed (grace path):', err);
      }
    }
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
      const freshToday = toLocalDateString(new Date());
      await checkForMissedDays();

      const { data, error } = await supabase
        .from('daily_completions')
        .select('*')
        .eq('goal_id', goal.id)
        .eq('completion_date', freshToday)
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
            completion_date: freshToday,
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

  useEffect(() => {
    completionRef.current = completion;
  }, [completion]);

  refetchIfDayChangedRef.current = () => {
    const freshToday = toLocalDateString(new Date());
    if (
      completionRef.current?.completion_date &&
      completionRef.current.completion_date !== freshToday
    ) {
      setCompletion(null);
      setCompletedActivities([]);
      setConfettiCompleted(false);
      setBadgeAnimationReady(false);
      setEditMode(false);
      setLoading(true);
      loadTodayCompletion();
    }
  };

  const triggerHaptics = () => {
    if (!Haptics) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => {
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      }, 150);
      setTimeout(() => {
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      }, 260);
      setTimeout(() => {
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
      }, 380);
      setTimeout(() => {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      }, 550);
    } catch {}
  };

  const triggerCheckHaptic = () => {
    if (!Haptics) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  };

  const triggerUncheckHaptic = () => {
    if (!Haptics) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const toggleActivity = async (activityId: string) => {
    if (onLockedInteraction) { onLockedInteraction(); return; }
    if (editMode || isDayLocked) return;

    const wasComplete = completedActivities.length === activities.length;
    const isAdding = !completedActivities.includes(activityId);
    const newCompleted = isAdding
      ? [...completedActivities, activityId]
      : completedActivities.filter((id) => id !== activityId);

    setCompletedActivities(newCompleted);
    if (isAdding) {
      triggerCheckHaptic();
    } else {
      triggerUncheckHaptic();
    }

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

        refreshCompletions();
        refreshStreakSummary();
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

        refreshCompletions();
        refreshStreakSummary();
        if (user) {
          try {
            const updatedGoal = { ...goal, ...updates };
            const newBadges = await checkAndAwardBadges(user.id, updatedGoal);
            newBadges.forEach((key) => celebrateBadge(key));
          } catch (err) {
            console.error('Badge check failed:', err);
          }
        }

        triggerHaptics();
        triggerRacingBorder(() => {
          setConfettiCompleted(true);
          requestAnimationFrame(() => {
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
              setTimeout(() => {
                setBadgeAnimationReady(true);
              }, 450);
            }, 50);
          });
          const newDay = updates.current_challenge_day ?? goal.current_challenge_day;
          if (newDay >= 77 && !goal.celebration_seen && goal.challenge_phase === 'challenge') {
            setTimeout(() => {
              celebrationSuppressed.current = false;
              openCelebration();
            }, 2400);
          }
        });
      }
      refreshCompletions();
      refreshStreakSummary();
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

      refreshCompletions();
      onRefresh();
    } catch (error) {
      console.error('Error deleting activity:', error);
      Alert.alert('Error', 'Failed to delete activity');
    }
  };

  toggleActivityRef.current = toggleActivity;
  deleteActivityRef.current = deleteActivity;

  const handleToggleActivity = useCallback((id: string) => {
    toggleActivityRef.current(id);
  }, []);

  const handleDeleteActivity = useCallback((id: string) => {
    deleteActivityRef.current(id);
  }, []);

  const handleEditSchedule = useCallback((activity: DailyActivity) => {
    setEditingScheduleFor(activity);
  }, []);

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

      await Promise.all(
        updates.map((update) =>
          supabase
            .from('daily_activities')
            .update({ order_position: update.order_position })
            .eq('id', update.id)
        )
      );

      onRefresh();
    } catch (error) {
      console.error('Error saving order:', error);
      Alert.alert('Error', 'Failed to save order');
    }
  };

  if (loading) {
    return <BrandedLoadingScreen />;
  }

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={isDark ? ['#000000', '#111111', '#000000'] : ['#F5F5F0', '#F0F0EB', '#F5F5F0']}
        style={StyleSheet.absoluteFillObject}
      />
      <ScrollView
        ref={scrollViewRef}
        style={[styles.container, { backgroundColor: 'transparent' }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
      >
        <View style={styles.gradient}>
          <View style={[styles.heroSection, { paddingTop: insets.top + 12 }]}>
            {isDayLocked && (
              <View style={[styles.lockedBanner, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Lock size={18} color={colors.textSecondary} strokeWidth={2.5} />
                <Text style={[styles.lockedBannerText, { color: colors.textSecondary }]}>
                  This day is locked. You can only view past days.
                </Text>
              </View>
            )}
            {isKeepGoing ? (
              <View style={styles.dateContainer}>
                <View style={styles.streakHeroRow}>
                  <Zap size={40} color="#CCFF00" fill="#CCFF00" strokeWidth={2} />
                  <Text style={[styles.date, { color: colors.text }]}>
                    {streak}
                  </Text>
                </View>
                <View style={styles.streakSubRow}>
                  <Text style={[styles.dateLabel, { color: colors.textTertiary }]}>
                    DAY STREAK
                  </Text>
                  {streak > 0 && streak >= bestStreak && (
                    <View style={styles.recordPill}>
                      <Text style={styles.recordPillText}>RECORD</Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.dateContainer}
                onPress={() => setShowDayView(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.date, { color: colors.text }]}>
                  DAY {hasAnimatedDay ? displayDay : dayDisplayText}
                </Text>
                <Text style={[styles.dateLabel, { color: colors.textTertiary }]}>
                  77-DAY CHALLENGE
                </Text>
              </TouchableOpacity>
            )}

            {isKeepGoing ? (
              <View style={styles.metricsGrid}>
                <View style={styles.metricsRow}>
                  <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: isDark ? colors.border : colors.primary }]}>
                    <Text style={[styles.metricValue, { color: colors.primary }]}>{bestStreak}</Text>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Best Streak</Text>
                  </View>
                  <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: isDark ? colors.border : colors.primary }]}>
                    <Text style={[styles.metricValue, { color: colors.primary }]}>{perfectDays}</Text>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Lifetime Days</Text>
                  </View>
                </View>
              </View>
            ) : (
              <CoachCardCarousel
                goalId={goal.id}
                challengeDay={displayDay}
                firstName={user?.user_metadata?.first_name}
                streak={streak}
                perfectDays={perfectDays}
                totalChallengeDays={currentDay}
                activitiesCount={activities.length}
              />
            )}

            {goal.identity_statement && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowIdentityModal(true)}
                style={[styles.identityChip, {
                  backgroundColor: isDark ? colors.backgroundSecondary : '#1A1A1A',
                  borderColor: isDark ? colors.border : '#1A1A1A',
                }]}
              >
                <View style={styles.identityChipRow}>
                  <View style={styles.identityChipTextCol}>
                    <Text style={styles.identityChipLabel}>MY IDENTITY</Text>
                    <Text style={styles.identityChipHeadline}>
                      THIS IS WHO I AM <Text style={styles.identityChipHeadlineAccent}>BECOMING.</Text>
                    </Text>
                    <Text style={styles.identityChipSubtext}>Read it. Believe it. Become it.</Text>
                  </View>
                  <ChevronRight size={18} color="rgba(255,255,255,0.3)" strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
            )}

            <View style={styles.utilityRow}>
              <TouchableOpacity
                style={[styles.utilityCard, { flex: 43 }, {
                  backgroundColor: isDark ? '#1A1A1A' : colors.card,
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
                }]}
                onPress={() => {
                  loadWatcherProfiles();
                  setShowWatcherSheet(true);
                }}
                activeOpacity={0.7}
              >
                <Eye size={20} color="#CCFF00" strokeWidth={2.5} />
                <Text style={styles.utilityCardInline} numberOfLines={1}>
                  <Text style={styles.utilityCardCount}>{watcherCount}</Text>
                  <Text style={styles.utilityCardLabel}> watching</Text>
                </Text>
                <ChevronRight size={16} color="rgba(255,255,255,0.3)" strokeWidth={2.5} />
              </TouchableOpacity>

              {goal.compass_filter_question ? (
                <View style={{ flex: 57 }}>
                  <CompassCard
                    declaration={goal.compass_declaration ?? ''}
                    filterQuestion={goal.compass_filter_question}
                    onLockedInteraction={onLockedInteraction}
                    compact
                  />
                </View>
              ) : (
                <View style={[styles.utilityCard, styles.utilityCardPlaceholder, { flex: 57 }, {
                  backgroundColor: isDark ? '#1A1A1A' : colors.card,
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
                }]} />
              )}
            </View>

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
                  style={[styles.editButton, { backgroundColor: isDark ? '#1A1A1A' : colors.backgroundSecondary }, editMode && styles.editButtonActive]}
                  onPress={() => {
                    if (onLockedInteraction) { onLockedInteraction(); return; }
                    const wasEditing = editMode;
                    setEditMode(!editMode);
                    if (wasEditing) {
                      saveActivityOrder().catch((err) => console.error('saveActivityOrder failed:', err));
                    }
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
                  style={[styles.addActivityInput, { backgroundColor: isDark ? '#1A1A1A' : colors.backgroundSecondary }]}
                  placeholder="Add a new input"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
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
                    onPress={handleToggleActivity}
                    onDelete={handleDeleteActivity}
                    onEditSchedule={handleEditSchedule}
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
                onInputFocus={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
              />
            )}

            {confettiCompleted && progress === 100 && (
              <DayBadge
                day={displayDay}
                isMilestone={MILESTONE_DAYS.includes(displayDay)}
                variant={isKeepGoing ? 'keepGoing' : 'challenge'}
                streak={streak}
                animate={badgeAnimationReady}
              />
            )}
          </View>
        </View>
      </ScrollView>

      {reactionBursts.length > 0 && (
        <>
          <ReactionBurst
            key={`burst-${playedCountRef.current}`}
            emoji={reactionBursts[0].emoji}
            count={reactionBursts[0].count}
            onComplete={() => {
              playedCountRef.current += 1;
              setReactionBursts((prev) => {
                const next = prev.slice(1);
                if (next.length === 0 && user?.id) {
                  markReactionsRead(user.id).catch((err) =>
                    console.error('markReactionsRead failed:', err)
                  );
                }
                return next;
              });
            }}
          />
          <EncouragementToast
            key={`toast-${playedCountRef.current}`}
            senderName={reactionBursts[0].senderName}
            senderPhotoUrl={reactionBursts[0].senderPhotoUrl}
            emoji={reactionBursts[0].emoji}
            onComplete={() => {} }
          />
        </>
      )}


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

      <WhenPickerModal
        visible={editingScheduleFor !== null}
        onClose={() => setEditingScheduleFor(null)}
        onConfirm={async (value) => {
          const target = editingScheduleFor;
          setEditingScheduleFor(null);
          if (!target) return;
          const { error } = await supabase
            .from('daily_activities')
            .update({ schedule: value })
            .eq('id', target.id);
          if (error) {
            console.error('Error updating schedule:', error);
            return;
          }
          setLocalActivities(prev => prev.map(a => a.id === target.id ? { ...a, schedule: value } : a));
          if (goal.user_id) {
            resyncAllReminders(goal.user_id).catch(err => console.error('resyncAllReminders failed:', err));
          }
        }}
        initialValue={editingScheduleFor?.schedule
          ? {
              hour: editingScheduleFor.schedule.hour ?? 9,
              minute: editingScheduleFor.schedule.minute ?? 0,
              period: editingScheduleFor.schedule.period ?? 'AM',
              days: editingScheduleFor.schedule.days ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
              reminder: editingScheduleFor.schedule.reminder ?? false,
              reminderOffset: editingScheduleFor.schedule.reminderOffset ?? 0,
              allDay: editingScheduleFor.schedule.allDay ?? false,
            }
          : {
              hour: 9,
              minute: 0,
              period: 'AM',
              days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
              reminder: false,
              reminderOffset: 0,
            }
        }
      />

      <Modal
        visible={showIdentityModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowIdentityModal(false)}
      >
        <View style={styles.identityModalOverlay}>
          <View style={styles.identityModalCard}>
            <ImageBackground
              source={require('@/assets/images/identity-modal-bg.png')}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            >
              <LinearGradient
                colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0.95)']}
                style={StyleSheet.absoluteFillObject}
              />
            </ImageBackground>
            <View style={styles.identityModalHeader}>
              <Text style={styles.identityModalEyebrow}>MY IDENTITY</Text>
              <TouchableOpacity
                onPress={() => setShowIdentityModal(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={20} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
            <Text style={styles.identityModalTagline}>A BETTER ME EVERYDAY</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.identityModalScroll}>
              <Text style={styles.identityModalHeadline}>
                THIS IS WHO{'\n'}I AM <Text style={styles.identityModalHeadlineAccent}>BECOMING.</Text>
              </Text>

              <View style={styles.identityModalList}>
                {(goal.identity_statement || '')
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, index) => (
                    <View key={index}>
                      <View style={styles.identityModalRow}>
                        <Text style={styles.identityModalIndex}>
                          {String(index + 1).padStart(2, '0')}
                        </Text>
                        <Text style={styles.identityModalRowText}>{line}</Text>
                      </View>
                      <View style={styles.identityModalDivider} />
                    </View>
                  ))}
              </View>

              <View style={styles.identityModalFooter}>
                <Text style={styles.identityModalFooterLeft}>IDENTITY  →  ACTION  →  EVIDENCE</Text>
                <Text style={styles.identityModalFooterScript}>Keep Going.</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showWatcherSheet}
        animationType="slide"
        transparent
        onRequestClose={() => setShowWatcherSheet(false)}
      >
        <View style={styles.watcherSheetOverlay}>
          <View style={[styles.watcherSheet, { backgroundColor: isDark ? '#0A0A0A' : '#F5F5F0' }]}>
            <View style={styles.watcherSheetHeader}>
              <Text style={[styles.watcherSheetTitle, { color: colors.text }]}>YOUR WATCHERS</Text>
              <TouchableOpacity onPress={() => setShowWatcherSheet(false)} style={styles.watcherSheetCloseButton}>
                <X size={20} color={colors.textTertiary} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.watcherSheetSubtitle, { color: colors.textSecondary }]}>
              {watcherCount === 1 ? '1 person is watching you show up.' : `${watcherCount} people are watching you show up.`}
            </Text>
            <View style={styles.watcherSheetList}>
              {watcherProfiles.length === 0 ? (
                <Text style={[styles.watcherSheetEmpty, { color: colors.textTertiary }]}>
                  No one is watching yet. Invite someone to follow your journey.
                </Text>
              ) : watcherProfiles.map((w) => (
                <View key={w.id} style={[styles.watcherSheetRow, { borderColor: isDark ? 'rgba(255,255,255,0.06)' : colors.border }]}>
                  {w.photo_url ? (
                    <Image source={{ uri: w.photo_url }} style={styles.watcherSheetAvatar} />
                  ) : (
                    <View style={[styles.watcherSheetAvatar, styles.watcherSheetAvatarPlaceholder, { backgroundColor: isDark ? '#1A1A1A' : '#E0E0E0' }]}>
                      <Text style={styles.watcherSheetAvatarText}>
                        {(w.display_name || w.username || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.watcherSheetRowInfo}>
                    <Text style={[styles.watcherSheetRowName, { color: colors.text }]} numberOfLines={1}>
                      {w.display_name}
                    </Text>
                    {w.username ? (
                      <Text style={[styles.watcherSheetRowUsername, { color: colors.textTertiary }]} numberOfLines={1}>
                        @{w.username}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.watcherSheetInviteButton}
              onPress={() => {
                setShowWatcherSheet(false);
                setShowInviteModal(true);
              }}
              activeOpacity={0.8}
            >
              <Eye size={18} color="#000000" strokeWidth={2.5} />
              <Text style={styles.watcherSheetInviteButtonText}>INVITE A WATCHER →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {user ? (
        <InviteWatcherModal
          visible={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          userId={user.id}
        />
      ) : null}

      <DayView
        visible={showDayView}
        onClose={() => setShowDayView(false)}
        goal={goal}
        activities={localActivities}
        completedActivities={completedActivities}
        onToggle={handleToggleActivity}
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
  streakHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  streakSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
    marginBottom: 4,
  },
  recordPill: {
    backgroundColor: '#CCFF00',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recordPillText: {
    color: '#000000',
    fontFamily: 'Inter-Black',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
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
  utilityRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  utilityCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 58,
  },
  utilityCardInline: {
    flex: 1,
    flexWrap: 'nowrap',
  },
  utilityCardCount: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  utilityCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  utilityCardPlaceholder: {
    opacity: 0.3,
  },
  watcherSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  watcherSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 28,
    paddingBottom: 48,
  },
  watcherSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  watcherSheetTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  watcherSheetCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(128,128,128,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  watcherSheetSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 24,
  },
  watcherSheetList: {
    gap: 0,
  },
  watcherSheetEmpty: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 32,
    lineHeight: 20,
  },
  watcherSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  watcherSheetAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  watcherSheetAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  watcherSheetAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  watcherSheetRowInfo: {
    flex: 1,
    gap: 2,
  },
  watcherSheetRowName: {
    fontSize: 15,
    fontWeight: '700',
  },
  watcherSheetRowUsername: {
    fontSize: 12,
    fontWeight: '500',
  },
  watcherSheetInviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#CCFF00',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 24,
  },
  watcherSheetInviteButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
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
  editControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
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
    paddingTop: 10,
    paddingBottom: 12,
    marginBottom: 16,
  },
  identityChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  identityChipTextCol: {
    flex: 1,
    marginRight: 8,
  },
  identityChipLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#ccff00',
  },
  identityChipHeadline: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    color: '#FFFFFF',
    lineHeight: 26,
    marginTop: 2,
  },
  identityChipHeadlineAccent: {
    color: '#ccff00',
  },
  identityChipSubtext: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  identityModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  identityModalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 28,
    paddingBottom: 48,
    maxHeight: '85%',
  },
  identityModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  identityModalEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
    letterSpacing: 2,
    color: '#ccff00',
  },
  identityModalTagline: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 20,
  },
  identityModalScroll: {
    maxHeight: 500,
  },
  identityModalHeadline: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    color: '#FFFFFF',
    lineHeight: 32,
    marginBottom: 24,
  },
  identityModalHeadlineAccent: {
    color: '#ccff00',
  },
  identityModalList: {
    marginBottom: 24,
  },
  identityModalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingVertical: 14,
  },
  identityModalIndex: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    color: '#ccff00',
    width: 24,
  },
  identityModalRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    lineHeight: 21,
  },
  identityModalDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  identityModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 12,
  },
  identityModalFooterLeft: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.4)',
  },
  identityModalFooterScript: {
    fontSize: 22,
    fontFamily: 'Northwell',
    color: '#ccff00',
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
