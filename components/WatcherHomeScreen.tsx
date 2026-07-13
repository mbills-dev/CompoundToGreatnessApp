import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, Zap, Calendar, Target, LogOut, Star, Shield, Layers, Flame, Check } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { computeCurrentStreak } from '@/lib/streakHelpers';
import { getTodayDateString, toLocalDateString } from '@/lib/dateHelpers';

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

function hexWithOpacity(hex: string, opacity: number): string {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export default function WatcherHomeScreen({ watcherId, watchedId, onSignOut, onStartOwn, hideAccountActions = false }: Props) {
  const { colors, isDark } = useTheme();
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
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [watcherCount, setWatcherCount] = useState(0);

  useEffect(() => {
    loadData();
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
          .select('id, title, identity_statement, current_challenge_day, last_completion_date, share_full_journey, best_streak')
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
      });

      setEarnedBadges((badgeRes.data as unknown as EarnedBadge[]) || []);

      setWatcherName(watcherRes.data?.first_name || 'You');
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

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: isDark ? '#000' : colors.background }]}>
        <ActivityIndicator size="large" color="#ccff00" />
      </View>
    );
  }

  return (
    <LinearGradient colors={rootGradient} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>WATCHER MODE</Text>
            <Text style={[styles.headerTitle, { color: textPrimary }]}>You're Watching</Text>
          </View>
          {!hideAccountActions && (
            <TouchableOpacity style={[styles.signOutButton, { backgroundColor: cardBg, borderColor }]} onPress={onSignOut}>
              <LogOut size={18} color={textTertiary} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.heroCard}>
          <LinearGradient
            colors={['rgba(204, 255, 0, 0.08)', 'rgba(204, 255, 0, 0.02)']}
            style={styles.heroCardInner}
          >
            <View style={styles.heroTop}>
              {watched?.photoUrl ? (
                <Image source={{ uri: watched.photoUrl }} style={styles.avatarLarge} />
              ) : (
                <View style={styles.avatarLarge}>
                  <Text style={styles.avatarLargeText}>
                    {watched?.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.heroInfo}>
                <Text style={[styles.heroName, { color: textPrimary }]}>{watched?.displayName}</Text>
                <Text style={[styles.heroGoal, { color: textMuted }]} numberOfLines={2}>{watched?.goalTitle}</Text>
                <Text style={styles.heroActive}>{getLastActiveLabel()}</Text>
              </View>
            </View>

            {watched?.shareFullJourney && watched?.identityStatement ? (
              <View style={[styles.identityChip, { backgroundColor: secondaryBg, borderColor }]}>
                <Text style={styles.identityChipLabel}>THEIR IDENTITY</Text>
                <Text style={[styles.identityChipText, { color: textPrimary }]} numberOfLines={6}>
                  {watched.identityStatement}
                </Text>
              </View>
            ) : null}

            <View style={styles.streakHeroRow}>
              <Zap size={40} color="#CCFF00" fill="#CCFF00" strokeWidth={2} />
              <Text style={[styles.streakNumber, { color: textPrimary }]}>{watched?.streak ?? 0}</Text>
            </View>
            <Text style={[styles.streakLabel, { color: textTertiary }]}>DAY STREAK</Text>
          </LinearGradient>
        </View>

        {watched?.shareFullJourney && watched && watched.activities.length > 0 ? (
          <View style={[styles.stackCard, { backgroundColor: cardBg, borderColor }]}>
            <Text style={styles.stackLabel}>TODAY'S SUCCESS STACK</Text>
            {watched.activities.map((activity) => {
              const completed = watched.todayCompletedIds.includes(activity.id);
              return (
                <View key={activity.id} style={styles.stackRow}>
                  <Text style={[styles.stackActivityName, { color: textTertiary }, completed && { color: textPrimary }]}>
                    {activity.activity_name}
                  </Text>
                  <View style={styles.checkmarkContainer}>
                    {completed ? (
                      <View style={styles.checkmarkCircleInner}>
                        <Check size={24} color="#000000" strokeWidth={3} />
                      </View>
                    ) : (
                      <View style={[styles.uncheckedCircleInner, { borderColor }]} />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.badgesSection}>
          <Text style={[styles.sectionTitle, { color: textPrimary }]}>Badges</Text>
          {earnedBadges.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeScroll}>
              {earnedBadges.map((badge, index) => {
                const Icon = (badge.badges?.[0]?.icon && badgeIconMap[badge.badges[0].icon]) || Star;
                const badgeColor = badge.badges?.[0]?.color || '#ccff00';
                return (
                  <View key={`${badge.badge_key}-${index}`} style={styles.badgeItem}>
                    <View style={[styles.badgeCircle, { backgroundColor: hexWithOpacity(badgeColor, 0.15), borderColor: hexWithOpacity(badgeColor, 0.3) }]}>
                      <Icon size={22} color={badgeColor} strokeWidth={2} />
                    </View>
                    <Text style={[styles.badgeCaption, { color: textMuted }]} numberOfLines={2}>{badge.badges?.[0]?.title || badge.badge_key}</Text>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={[styles.badgesEmpty, { color: textTertiary }]}>No badges earned yet</Text>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
            <Flame size={20} color="#ccff00" strokeWidth={2} />
            <Text style={[styles.statNumber, { color: textPrimary }]}>{watched?.bestStreak ?? 0}</Text>
            <Text style={[styles.statLabel, { color: textTertiary }]}>Best Streak</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
            <Calendar size={20} color="#ccff00" strokeWidth={2} />
            <Text style={[styles.statNumber, { color: textPrimary }]}>{watched?.lifetimeDays ?? 0}</Text>
            <Text style={[styles.statLabel, { color: textTertiary }]}>Lifetime Days</Text>
          </View>
        </View>

        <View style={[styles.watcherPill, { backgroundColor: cardBg, borderColor }]}>
          <Eye size={16} color="#ccff00" strokeWidth={2.5} />
          <Text style={[styles.watcherPillText, { color: textMuted }]}>
            {watcherCount} {watcherCount === 1 ? 'person watching' : 'people watching'}
          </Text>
        </View>

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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  scroll: { padding: 24, paddingTop: 64, paddingBottom: 60 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#ccff00',
    marginBottom: 6,
  },
  headerTitle: { fontSize: 38, fontWeight: '900', color: '#FFFFFF' },
  signOutButton: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  heroCard: { borderRadius: 24, overflow: 'hidden', marginBottom: 28, borderWidth: 1, borderColor: 'rgba(204, 255, 0, 0.15)' },
  heroCardInner: { padding: 24 },
  heroTop: { flexDirection: 'row', gap: 16, alignItems: 'flex-start', marginBottom: 20 },
  avatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#111',
    borderWidth: 2,
    borderColor: '#ccff00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeText: { fontSize: 24, fontWeight: '900', color: '#ccff00' },
  heroInfo: { flex: 1 },
  heroName: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', marginBottom: 4 },
  heroGoal: { fontSize: 13, fontWeight: '600', color: '#808080', lineHeight: 18, marginBottom: 6 },
  heroActive: { fontSize: 12, fontWeight: '600', color: '#ccff00' },

  identityChip: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginBottom: 20,
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
    lineHeight: 22,
  },
  stackCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  stackLabel: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
    letterSpacing: 2,
    color: '#ccff00',
    marginBottom: 16,
  },
  stackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    minHeight: 72,
  },
  checkmarkContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkmarkCircleInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ccff00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uncheckedCircleInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
  },
  stackActivityName: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
    flex: 1,
    paddingRight: 12,
  },
  streakHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  streakNumber: {
    fontSize: 80,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    letterSpacing: -2,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  streakLabel: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
    letterSpacing: 1.5,
    color: '#555',
    marginTop: 2,
    marginBottom: 4,
  },
  badgesSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', marginBottom: 16 },
  badgeScroll: { gap: 14, paddingRight: 8 },
  badgeItem: { alignItems: 'center', width: 76, gap: 8 },
  badgeCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  badgeCaption: { fontSize: 11, fontWeight: '700', color: '#808080', textAlign: 'center', lineHeight: 14 },
  badgesEmpty: { fontSize: 14, fontWeight: '600', color: '#555', fontStyle: 'italic' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  watcherPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    marginBottom: 28,
  },
  watcherPillText: { fontSize: 13, fontWeight: '700', color: '#808080' },
  statCard: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  statNumber: { fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  statLabel: { fontSize: 11, fontWeight: '600', color: '#555', textAlign: 'center' },
  convertBanner: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(204, 255, 0, 0.2)' },
  convertBannerInner: { padding: 28, alignItems: 'center', gap: 16 },
  convertTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 28,
  },
  convertButton: { width: '100%', borderRadius: 14, overflow: 'hidden' },
  convertButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
  },
  convertButtonText: { fontSize: 16, fontWeight: '900', color: '#000000' },
  convertSub: { fontSize: 13, fontWeight: '600', color: '#555', textAlign: 'center' },
});
