import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  AppState,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, Zap, Calendar, LogOut, Star, Shield, Layers, Flame, Check, Heart, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { computeCurrentStreak } from '@/lib/streakHelpers';
import { getTodayDateString, toLocalDateString, parseLocalDate } from '@/lib/dateHelpers';
import { awardEncouragementBadge } from '@/lib/badgeHelpers';
import { useBadgeCelebration } from '@/contexts/BadgeCelebrationContext';
import EncourageModal from '@/components/EncourageModal';
import ReactionBurst from '@/components/ReactionBurst';

interface Activity {
  id: string;
  activity_name: string;
  order_position: number;
}

interface WatchedUser {
  displayName: string;
  currentDay: number;
  identityStatement: string;
  goalTitle: string;
  streak: number;
  bestStreak: number;
  lifetimeDays: number;
  lastActive: string | null;
  completionDates: string[];
  shareFullJourney: boolean;
  photoUrl: string | null;
  watcherCount: number;
  activities: Activity[];
  todayCompletedIds: string[];
  scheduledStartDate: string | null;
}

interface EarnedBadge {
  badge_key: string;
  earned_at: string;
  badges: {
    title: string;
    description: string;
    icon: string;
    color: string;
  }[] | null;
}

interface Props {
  watcherId: string;
  watchedId: string;
  onSignOut?: () => void;
  onStartOwn?: () => void;
  hideAccountActions?: boolean;
}

const badgeIconMap: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  star: Star,
  shield: Shield,
  layers: Layers,
  zap: Zap,
};

const QUICK_EMOJIS = ['🔥', '💪', '👏', '🚀'];

function hexWithOpacity(hex: string, opacity: number): string {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export default function WatcherHomeScreen({ watcherId, watchedId, onSignOut, onStartOwn, hideAccountActions = false }: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { celebrateBadge } = useBadgeCelebration();
  const rootGradient: [string, string, string] = isDark ? ['#000000', '#050505', '#000000'] : [colors.background, colors.background, colors.background];
  const cardBg = isDark ? '#0A0A0A' : colors.card;
  const secondaryBg = isDark ? '#1A1A1A' : colors.backgroundSecondary;
  const textPrimary = isDark ? '#FFFFFF' : colors.text;
  const textTertiary = isDark ? '#555' : colors.textTertiary;
  const textMuted = isDark ? '#808080' : colors.textSecondary;
  const borderColor = isDark ? '#1A1A1A' : colors.border;
  const [watched, setWatched] = useState<WatchedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [watcherName, setWatcherName] = useState('');
  const [watcherDisplayName, setWatcherDisplayName] = useState('');
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [watcherCount, setWatcherCount] = useState(0);
  const prevAppStateRef = useRef<string>('active');
  const [encourageVisible, setEncourageVisible] = useState(false);
  const [encourageMessage, setEncourageMessage] = useState('');
  const [burstPreview, setBurstPreview] = useState<{ emoji: string; count: number } | null>(null);

  useEffect(() => {
    loadData();
  }, [watchedId, watcherId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const prev = prevAppStateRef.current;
      prevAppStateRef.current = nextAppState;
      if (nextAppState === 'active' && (prev === 'background' || prev === 'inactive')) {
        loadData();
      }
    });
    return () => subscription.remove();
  }, [watchedId, watcherId]);

  const loadData = async () => {
    try {
      const [settingsRes, goalRes, watcherRes, profileRes] = await Promise.all([
        supabase
          .from('user_settings')
          .select('first_name, last_name')
          .eq('user_id', watchedId)
          .maybeSingle(),
        supabase
          .from('goals')
          .select('id, title, identity_statement, current_challenge_day, last_completion_date, share_full_journey, best_streak, scheduled_start_date')
          .eq('user_id', watchedId)
          .eq('is_active', true)
          .maybeSingle(),
        supabase
          .from('user_settings')
          .select('first_name')
          .eq('user_id', watcherId)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('display_name, photo_url')
          .eq('id', watchedId)
          .maybeSingle(),
      ]);

      const [watchersCountRes] = await Promise.all([
        supabase
          .from('watchers')
          .select('*', { count: 'exact', head: true })
          .eq('watched_id', watchedId),
      ]);
      setWatcherCount(watchersCountRes.count || 0);

      const goalId = goalRes.data?.id || '';

      let activities: Activity[] = [];
      let todayCompletedIds: string[] = [];
      if (goalId) {
        const today = getTodayDateString();
        const [actsRes, todayCompletionRes] = await Promise.all([
          supabase
            .from('daily_activities')
            .select('id, activity_name, order_position')
            .eq('goal_id', goalId)
            .order('order_position', { ascending: true }),
          supabase
            .from('daily_completions')
            .select('activities_completed')
            .eq('goal_id', goalId)
            .eq('completion_date', today)
            .maybeSingle(),
        ]);
        activities = actsRes.data || [];
        if (todayCompletionRes.data?.activities_completed) {
          todayCompletedIds = Array.isArray(todayCompletionRes.data.activities_completed)
            ? todayCompletionRes.data.activities_completed
            : [];
        }
      }

      const [completionsRes, badgeRes, lifetimeRes] = await Promise.all([
        supabase
          .from('daily_completions')
          .select('completion_date')
          .eq('goal_id', goalId)
          .order('completion_date', { ascending: false })
          .limit(77),
        supabase
          .from('user_badges')
          .select('badge_key, earned_at, badges(title, description, icon, color)')
          .eq('user_id', watchedId)
          .order('earned_at', { ascending: true }),
        supabase
          .from('daily_completions')
          .select('*', { count: 'exact', head: true })
          .eq('goal_id', goalId)
          .not('completed_at', 'is', null),
      ]);

      const displayName = profileRes.data?.display_name
        || (settingsRes.data ? `${settingsRes.data.first_name || ''} ${settingsRes.data.last_name || ''}`.trim() : null)
        || 'Your person';

      const realStreak = goalId ? await computeCurrentStreak(goalId) : 0;

      setWatched({
        displayName: displayName || 'Your person',
        currentDay: goalRes.data?.current_challenge_day || 0,
        identityStatement: goalRes.data?.identity_statement || '',
        goalTitle: goalRes.data?.title || 'their journey',
        streak: realStreak,
        bestStreak: goalRes.data?.best_streak || 0,
        lifetimeDays: lifetimeRes.count || 0,
        lastActive: goalRes.data?.last_completion_date || null,
        completionDates: completionsRes.data?.map((c) => c.completion_date) || [],
        shareFullJourney: goalRes.data?.share_full_journey ?? true,
        photoUrl: profileRes.data?.photo_url || null,
        watcherCount: watchersCountRes.count || 0,
        activities,
        todayCompletedIds,
        scheduledStartDate: goalRes.data?.scheduled_start_date || null,
      });

      setEarnedBadges((badgeRes.data as unknown as EarnedBadge[]) || []);
      setWatcherName(watcherRes.data?.first_name || 'You');

      const { data: watcherProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', watcherId)
        .maybeSingle();
      setWatcherDisplayName(watcherProfile?.display_name || watcherRes.data?.first_name || 'Someone');
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const getLastActiveLabel = () => {
    if (!watched?.lastActive) return 'Not yet started';
    const today = getTodayDateString();
    const yesterday = toLocalDateString(new Date(Date.now() - 86400000));
    if (watched.lastActive === today) return 'Active today';
    if (watched.lastActive === yesterday) return 'Active yesterday';
    return `Last active ${watched.lastActive}`;
  };

  const firstName = watched?.displayName.split(' ')[0] || watched?.displayName || 'them';

  const sendQuickBurst = async (emoji: string) => {
    setBurstPreview({ emoji, count: 1 });
    try {
      const { error: insErr } = await supabase
        .from('encouragements')
        .insert({
          from_user_id: watcherId,
          to_user_id: watchedId,
          emoji,
          message: null,
        });
      if (insErr) throw insErr;
      awardEncouragementBadge(watcherId).then((keys) => keys.forEach((key) => celebrateBadge(key))).catch(() => {});
      const senderName = watcherDisplayName || 'Someone';
      supabase.functions.invoke('send-push', {
        body: {
          recipientUserId: watchedId,
          title: `${senderName} sent you ${emoji}`,
          body: `Tap to see it in the app.`,
          data: { type: 'reaction' },
        },
      }).catch(() => {});
    } catch {
    }
  };

  const sendEncouragement = async () => {
    try {
      const { error: insErr } = await supabase
        .from('encouragements')
        .insert({
          from_user_id: watcherId,
          to_user_id: watchedId,
          emoji: null,
          message: encourageMessage.trim() || null,
        });
      if (insErr) throw insErr;
      awardEncouragementBadge(watcherId).then((keys) => keys.forEach((key) => celebrateBadge(key))).catch(() => {});
      const senderName = watcherDisplayName || 'Someone';
      const hasMessage = !!encourageMessage.trim();
      const trimmedMessage = encourageMessage.trim();
      const pushBody = hasMessage
        ? trimmedMessage.length > 40
          ? `"${trimmedMessage.slice(0, 40)}..."`
          : `"${trimmedMessage}"`
        : `Tap to see it in the app.`;
      supabase.functions.invoke('send-push', {
        body: {
          recipientUserId: watchedId,
          title: hasMessage
            ? `${senderName} sent you a message`
            : `${senderName} sent you encouragement`,
          body: pushBody,
          data: { type: 'reaction' },
        },
      }).catch(() => {});
      setEncourageVisible(false);
      setEncourageMessage('');
    } catch {
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: isDark ? '#000' : colors.background }]}>
        <ActivityIndicator size="large" color="#ccff00" />
      </View>
    );
  }

  const isPreStart = !!watched?.scheduledStartDate && watched.scheduledStartDate > getTodayDateString();
  const preStartDaysUntil = (() => {
    if (!watched?.scheduledStartDate) return 0;
    const startDate = parseLocalDate(watched.scheduledStartDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  })();

  const todayCompletedCount = watched?.todayCompletedIds.length ?? 0;
  const totalActivities = watched?.activities.length ?? 0;

  const clampedDay = Math.max(0, Math.min(watched?.currentDay ?? 0, 77));
  const journeyPct = Math.round((clampedDay / 77) * 100);
  const completionDateSet = new Set(watched?.completionDates || []);

  const watcherLabel = watcherCount === 1 ? '1 watching' : `${watcherCount} watching`;

  return (
    <LinearGradient colors={rootGradient} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingTop: hideAccountActions ? 8 : insets.top + 8 }]}>
        {/* COMPACT HEADER — centered */}
        <View style={styles.header}>
          {!hideAccountActions && (
            <TouchableOpacity style={[styles.signOutButton, { backgroundColor: cardBg, borderColor }]} onPress={onSignOut}>
              <LogOut size={16} color={textTertiary} strokeWidth={2} />
            </TouchableOpacity>
          )}
          {hideAccountActions && <View style={styles.headerSpacer} />}
          <View style={styles.headerCenter}>
            <Text style={styles.headerLabel}>WATCHER MODE</Text>
            <Text style={[styles.headerSub, { color: textTertiary }]}>You're Watching</Text>
          </View>
          {!hideAccountActions ? (
            <View style={styles.signOutButton} />
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        {/* HERO — horizontal compact */}
        <View style={[styles.heroCard, { borderColor: 'rgba(204,255,0,0.12)' }]}>
          <LinearGradient
            colors={['rgba(204, 255, 0, 0.06)', 'rgba(204, 255, 0, 0.01)']}
            style={styles.heroCardInner}
          >
            <View style={styles.heroMainRow}>
              {/* Left: avatar + name + identity */}
              <View style={styles.heroLeft}>
                <View style={styles.heroTopRow}>
                  {watched?.photoUrl ? (
                    <Image source={{ uri: watched.photoUrl }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {watched?.displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.heroInfo}>
                    <Text style={[styles.heroName, { color: textPrimary }]} numberOfLines={1}>{watched?.displayName}</Text>
                    <Text style={styles.heroActive}>{getLastActiveLabel()}</Text>
                  </View>
                </View>

                {watched?.shareFullJourney && watched?.identityStatement ? (
                  <View style={styles.identityWrap}>
                    <Text style={styles.identityLabel}>THEIR IDENTITY</Text>
                    <Text style={[styles.identityText, { color: textPrimary }]} numberOfLines={4}>
                      {watched.identityStatement}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Right: streak */}
              {!isPreStart && (
                <View style={[styles.heroRight, { borderLeftColor: isDark ? '#1A1A1A' : colors.border }]}>
                  {isPreStart ? null : (
                    <>
                      <View style={styles.streakRow}>
                        <Zap size={18} color="#CCFF00" fill="#CCFF00" strokeWidth={2} />
                        <Text style={[styles.streakNumber, { color: textPrimary }]}>{watched?.streak ?? 0}</Text>
                      </View>
                      <Text style={[styles.streakLabel, { color: textTertiary }]}>DAY{'\n'}STREAK</Text>
                    </>
                  )}
                </View>
              )}
            </View>

            {isPreStart ? (
              <View style={styles.preStartPill}>
                <Text style={styles.preStartPillText}>STARTS IN {preStartDaysUntil} {preStartDaysUntil === 1 ? 'DAY' : 'DAYS'}</Text>
              </View>
            ) : null}
          </LinearGradient>
        </View>

        {/* SUPPORT — one horizontal card */}
        {!isPreStart && (
          <View style={[styles.supportCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.supportLeft}>
              <Text style={styles.supportLabel}>SEND A BURST</Text>
              <View style={styles.burstRow}>
                {QUICK_EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.burstButton}
                    onPress={() => sendQuickBurst(emoji)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.burstEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={[styles.supportDivider, { backgroundColor: isDark ? '#1A1A1A' : colors.border }]} />
            <TouchableOpacity
              style={styles.supportRight}
              onPress={() => setEncourageVisible(true)}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#CCFF00', '#aed900']} style={styles.encourageButton}>
                <Heart size={16} color="#000000" strokeWidth={2.5} fill="#000000" />
                <Text style={styles.encourageBtnText}>ENCOURAGE</Text>
                <Text style={styles.encourageBtnName} numberOfLines={1}>{firstName.toUpperCase()}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* TODAY'S SUCCESS STACK — compact */}
        {!isPreStart && watched?.shareFullJourney && watched && watched.activities.length > 0 ? (
          <View style={[styles.stackCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.stackHeader}>
              <Text style={styles.stackLabel}>TODAY'S SUCCESS STACK</Text>
              <Text style={[styles.stackCount, { color: todayCompletedCount > 0 ? '#CCFF00' : textTertiary }]}>
                {todayCompletedCount} / {totalActivities}
              </Text>
            </View>
            {watched.activities.map((activity, idx) => {
              const completed = watched.todayCompletedIds.includes(activity.id);
              const isLast = idx === watched.activities.length - 1;
              return (
                <View key={activity.id} style={[styles.stackRow, !isLast && styles.stackRowBorder, { borderBottomColor: isDark ? '#151515' : 'rgba(0,0,0,0.05)' }]}>
                  <View style={styles.stackCircleContainer}>
                    {completed ? (
                      <View style={styles.stackCheckCircle}>
                        <Check size={14} color="#000000" strokeWidth={3} />
                      </View>
                    ) : (
                      <View style={[styles.stackEmptyCircle, { borderColor: isDark ? '#333' : 'rgba(0,0,0,0.12)' }]} />
                    )}
                  </View>
                  <Text style={[styles.stackActivityName, { color: completed ? textPrimary : textMuted }]} numberOfLines={1}>
                    {activity.activity_name}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* THEIR 77-DAY JOURNEY — visual */}
        {!isPreStart && (
          <View style={[styles.journeyCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.journeyHeaderRow}>
              <Text style={styles.journeyLabel}>THEIR 77-DAY JOURNEY</Text>
              <Text style={[styles.journeyDayText, { color: textPrimary }]}>DAY {clampedDay} OF 77</Text>
            </View>
            <Text style={styles.journeyPctText}>{journeyPct}% COMPLETE</Text>

            <View style={styles.dayStripWrap}>
              <Text style={styles.dayEndpoint}>1</Text>
              <View style={styles.dayStrip}>
                {Array.from({ length: 77 }, (_, i) => {
                  const dayNum = i + 1;
                  const isCompleted = dayNum < clampedDay;
                  const isCurrent = dayNum === clampedDay;
                  const isFinal = dayNum === 77;
                  return (
                    <View
                      key={dayNum}
                      style={[
                        styles.dayDot,
                        isCompleted && styles.dayDotCompleted,
                        isCurrent && styles.dayDotCurrent,
                        !isCompleted && !isCurrent && styles.dayDotFuture,
                        isFinal && styles.dayDotFinal,
                      ]}
                    />
                  );
                })}
              </View>
              <Text style={styles.dayEndpoint}>77</Text>
            </View>
          </View>
        )}

        {/* BADGES — compact, hidden when empty */}
        {earnedBadges.length > 0 && (
        <View style={styles.badgesSection}>
          <Text style={[styles.sectionTitle, { color: textPrimary }]}>Badges</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeScroll}>
            {earnedBadges.map((badge, index) => {
              const Icon = (badge.badges?.[0]?.icon && badgeIconMap[badge.badges[0].icon]) || Star;
              const badgeColor = badge.badges?.[0]?.color || '#ccff00';
              return (
                <View key={`${badge.badge_key}-${index}`} style={styles.badgeItem}>
                  <View style={[styles.badgeCircle, { backgroundColor: hexWithOpacity(badgeColor, 0.12), borderColor: hexWithOpacity(badgeColor, 0.25) }]}>
                    <Icon size={18} color={badgeColor} strokeWidth={2} />
                  </View>
                  <Text style={[styles.badgeCaption, { color: textMuted }]} numberOfLines={1}>{badge.badges?.[0]?.title || badge.badge_key}</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
        )}

        {/* THREE-COLUMN STATS */}
        {!isPreStart && (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[styles.statNumber, { color: textPrimary }]}>{watched?.bestStreak ?? 0}</Text>
              <Text style={[styles.statLabel, { color: textTertiary }]}>Best Streak</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[styles.statNumber, { color: textPrimary }]}>{watched?.lifetimeDays ?? 0}</Text>
              <Text style={[styles.statLabel, { color: textTertiary }]}>Lifetime Days</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
              <View style={styles.statWatcherRow}>
                <Eye size={14} color="#ccff00" strokeWidth={2.5} />
                <Text style={[styles.statNumber, { color: textPrimary, fontSize: 18 }]}>{watcherCount}</Text>
              </View>
              <Text style={[styles.statLabel, { color: textTertiary }]}>Watching</Text>
            </View>
          </View>
        )}

        {!hideAccountActions && (
        <View style={styles.convertBanner}>
          <LinearGradient
            colors={['rgba(204, 255, 0, 0.12)', 'rgba(204, 255, 0, 0.04)']}
            style={styles.convertBannerInner}
          >
            <Zap size={28} color="#ccff00" strokeWidth={2} />
            <Text style={[styles.convertTitle, { color: textPrimary }]}>
              {watched?.displayName.split(' ')[0]} is not stopping.{'\n'}Are you ready to start?
            </Text>
          {!hideAccountActions && (
            <TouchableOpacity style={styles.convertButton} onPress={onStartOwn}>
              <LinearGradient colors={['#ccff00', '#aed900']} style={styles.convertButtonGradient}>
                <Text style={styles.convertButtonText}>Start My 77-Day Journey</Text>
                <Zap size={18} color="#000000" strokeWidth={2.5} />
              </LinearGradient>
            </TouchableOpacity>
          )}
            <Text style={[styles.convertSub, { color: textTertiary }]}>Join thousands building the life they actually want.</Text>
          </LinearGradient>
        </View>
        )}
      </ScrollView>

      {/* ENCOURAGE MODAL */}
      <EncourageModal
        visible={encourageVisible}
        friendName={watched?.displayName || ''}
        friendPhotoUrl={watched?.photoUrl}
        friendStreak={watched?.streak ?? 0}
        message={encourageMessage}
        onMessageChange={setEncourageMessage}
        onSend={sendEncouragement}
        onClose={() => {
          setEncourageVisible(false);
          setEncourageMessage('');
        }}
      />

      {/* BURST PREVIEW */}
      {burstPreview && (
        <ReactionBurst
          emoji={burstPreview.emoji}
          count={burstPreview.count}
          onComplete={() => setBurstPreview(null)}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },

  // Compact header — centered
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerSpacer: {
    width: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerLabel: {
    fontSize: 17,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  headerSub: {
    fontSize: 13,
    fontWeight: '600',
  },
  signOutButton: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero — horizontal
  heroCard: { borderRadius: 18, overflow: 'hidden', marginBottom: 14, borderWidth: 1 },
  heroCardInner: { padding: 16 },
  heroMainRow: { flexDirection: 'row' },
  heroLeft: { flex: 1, paddingRight: 12 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111',
    borderWidth: 2,
    borderColor: '#ccff00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '900', color: '#ccff00' },
  heroInfo: { flex: 1 },
  heroName: { fontSize: 17, fontWeight: '900', fontFamily: 'Inter-Black', marginBottom: 2 },
  heroActive: { fontSize: 11, fontWeight: '600', color: '#ccff00' },
  identityWrap: { gap: 4 },
  identityLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#ccff00',
  },
  identityText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter-Bold',
    lineHeight: 17,
  },
  heroRight: {
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    paddingLeft: 14,
    minWidth: 80,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakNumber: {
    fontSize: 44,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    letterSpacing: -1.5,
  },
  streakLabel: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 11,
  },
  preStartPill: {
    backgroundColor: '#0A0A0A',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(204, 255, 0, 0.3)',
    alignSelf: 'center',
    marginTop: 12,
  },
  preStartPillText: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    color: '#CCFF00',
    letterSpacing: 1,
    textAlign: 'center',
  },

  // Support — one horizontal card
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    minHeight: 110,
    overflow: 'hidden',
  },
  supportLeft: {
    flex: 1,
    padding: 16,
  },
  supportLabel: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
    letterSpacing: 1.5,
    color: '#ccff00',
    marginBottom: 10,
  },
  burstRow: {
    flexDirection: 'row',
    gap: 8,
  },
  burstButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(204, 255, 0, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.12)',
  },
  burstEmoji: { fontSize: 18 },
  supportDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 16,
  },
  supportRight: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  encourageButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 2,
    minWidth: 80,
  },
  encourageBtnText: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    color: '#000000',
    letterSpacing: 0.8,
  },
  encourageBtnName: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    color: '#000000',
  },

  // Success stack — compact
  stackCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  stackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  stackLabel: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
    letterSpacing: 1.5,
    color: '#ccff00',
  },
  stackCount: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
  },
  stackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 46,
  },
  stackRowBorder: {
    borderBottomWidth: 1,
  },
  stackCircleContainer: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stackCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#CCFF00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackEmptyCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  stackActivityName: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
    flex: 1,
    marginLeft: 10,
  },

  // 77-day journey — visual
  journeyCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  journeyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  journeyLabel: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
    letterSpacing: 1.5,
    color: '#ccff00',
  },
  journeyDayText: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    letterSpacing: 0.3,
  },
  journeyPctText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
    color: '#ccff00',
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  dayStripWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayEndpoint: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
    color: '#555',
  },
  dayStrip: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  dayDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dayDotCompleted: {
    backgroundColor: '#CCFF00',
  },
  dayDotCurrent: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#CCFF00',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dayDotFuture: {
    backgroundColor: '#1A1A1A',
  },
  dayDotFinal: {
    borderWidth: 1.5,
    borderColor: 'rgba(204,255,0,0.4)',
  },

  // Badges — compact
  badgesSection: { marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '900', fontFamily: 'Inter-Black', color: '#FFFFFF', marginBottom: 10 },
  badgeScroll: { gap: 12, paddingRight: 8 },
  badgeItem: { alignItems: 'center', width: 60, gap: 6 },
  badgeCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  badgeCaption: { fontSize: 10, fontWeight: '700', fontFamily: 'Inter-Bold', textAlign: 'center', lineHeight: 13 },
  badgesEmpty: { fontSize: 12, fontWeight: '600', fontStyle: 'italic', display: 'none' },

  // Three-column stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
  },
  statNumber: { fontSize: 20, fontWeight: '900', fontFamily: 'Inter-Black', color: '#FFFFFF' },
  statLabel: { fontSize: 10, fontWeight: '700', fontFamily: 'Inter-Bold', textAlign: 'center' },
  statWatcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // Convert banner
  convertBanner: { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(204, 255, 0, 0.2)' },
  convertBannerInner: { padding: 24, alignItems: 'center', gap: 14 },
  convertTitle: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 26,
  },
  convertButton: { width: '100%', borderRadius: 14, overflow: 'hidden' },
  convertButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
  },
  convertButtonText: { fontSize: 15, fontWeight: '900', fontFamily: 'Inter-Black', color: '#000000' },
  convertSub: { fontSize: 12, fontWeight: '600', color: '#555', textAlign: 'center' },
});
