import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, Zap, Calendar, Target, LogOut, Star, Shield, Layers } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { computeCurrentStreak } from '@/lib/streakHelpers';
import { getTodayDateString, toLocalDateString } from '@/lib/dateHelpers';

interface WatchedUser {
  displayName: string;
  currentDay: number;
  identityStatement: string;
  goalTitle: string;
  streak: number;
  lastActive: string | null;
  completionDates: string[];
  compassVision: string;
  shareFullJourney: boolean;
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
  onSignOut: () => void;
  onStartOwn: () => void;
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

export default function WatcherHomeScreen({ watcherId, watchedId, onSignOut, onStartOwn }: Props) {
  const { isDark } = useTheme();
  const [watched, setWatched] = useState<WatchedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [watcherName, setWatcherName] = useState('');
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);

  useEffect(() => {
    loadData();
  }, [watchedId, watcherId]);

  const loadData = async () => {
    try {
      const [settingsRes, goalRes, watcherRes] = await Promise.all([
        supabase
          .from('user_settings')
          .select('first_name, last_name')
          .eq('user_id', watchedId)
          .maybeSingle(),
        supabase
          .from('goals')
          .select('id, title, identity_statement, current_challenge_day, last_completion_date, compass_vision, share_full_journey')
          .eq('user_id', watchedId)
          .eq('is_active', true)
          .maybeSingle(),
        supabase
          .from('user_settings')
          .select('first_name')
          .eq('user_id', watcherId)
          .maybeSingle(),
      ]);

      const goalId = goalRes.data?.id || '';

      const [completionsRes, badgeRes] = await Promise.all([
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
      ]);

      const displayName = settingsRes.data
        ? `${settingsRes.data.first_name || ''} ${settingsRes.data.last_name || ''}`.trim()
        : 'Your person';

      const realStreak = goalId ? await computeCurrentStreak(goalId) : 0;

      setWatched({
        displayName: displayName || 'Your person',
        currentDay: goalRes.data?.current_challenge_day || 0,
        identityStatement: goalRes.data?.identity_statement || '',
        goalTitle: goalRes.data?.title || 'their journey',
        streak: realStreak,
        lastActive: goalRes.data?.last_completion_date || null,
        compassVision: goalRes.data?.compass_vision || '',
        completionDates: completionsRes.data?.map((c) => c.completion_date) || [],
        shareFullJourney: goalRes.data?.share_full_journey ?? true,
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ccff00" />
      </View>
    );
  }


  return (
    <LinearGradient colors={['#000000', '#050505', '#000000']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>WATCHER MODE</Text>
            <Text style={styles.headerTitle}>You're Watching</Text>
          </View>
          <TouchableOpacity style={styles.signOutButton} onPress={onSignOut}>
            <LogOut size={18} color="#555" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <LinearGradient
            colors={['rgba(204, 255, 0, 0.08)', 'rgba(204, 255, 0, 0.02)']}
            style={styles.heroCardInner}
          >
            <View style={styles.heroTop}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarLargeText}>
                  {watched?.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.heroInfo}>
                <Text style={styles.heroName}>{watched?.displayName}</Text>
                <Text style={styles.heroGoal} numberOfLines={2}>{watched?.goalTitle}</Text>
                <Text style={styles.heroActive}>{getLastActiveLabel()}</Text>
              </View>
              <View style={styles.dayCountBadge}>
                <Text style={styles.dayCountNumber}>{watched?.currentDay}</Text>
                <Text style={styles.dayCountLabel}>DAYS</Text>
              </View>
            </View>

            {watched?.shareFullJourney && watched?.identityStatement ? (
              <View style={styles.identityCard}>
                <Text style={styles.identityCardLabel}>THEIR IDENTITY</Text>
                <Text style={styles.identityCardText}>"{watched.identityStatement}"</Text>
              </View>
            ) : null}

            <View style={styles.streakHeroRow}>
              <Zap size={40} color="#CCFF00" fill="#CCFF00" strokeWidth={2} />
              <Text style={styles.streakNumber}>{watched?.streak ?? 0}</Text>
            </View>
            <Text style={styles.streakLabel}>DAY STREAK</Text>
          </LinearGradient>
        </View>

        <View style={styles.badgesSection}>
          <Text style={styles.sectionTitle}>Badges</Text>
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
                    <Text style={styles.badgeCaption} numberOfLines={2}>{badge.badges?.[0]?.title || badge.badge_key}</Text>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.badgesEmpty}>No badges earned yet</Text>
          )}
        </View>

        {watched?.compassVision ? (
          <View style={styles.visionSection}>
            <View style={styles.visionCard}>
              <Text style={styles.visionLabel}>THEIR VISION</Text>
              <Text style={styles.visionText}>{watched.compassVision}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Calendar size={20} color="#ccff00" strokeWidth={2} />
            <Text style={styles.statNumber}>{watched?.completionDates.length || 0}</Text>
            <Text style={styles.statLabel}>Days Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Target size={20} color="#ccff00" strokeWidth={2} />
            <Text style={styles.statNumber}>{77 - (watched?.currentDay || 0)}</Text>
            <Text style={styles.statLabel}>Days Remaining</Text>
          </View>
          <View style={styles.statCard}>
            <Eye size={20} color="#ccff00" strokeWidth={2} />
            <Text style={styles.statNumber}>1</Text>
            <Text style={styles.statLabel}>Watching</Text>
          </View>
        </View>

        <View style={styles.convertBanner}>
          <LinearGradient
            colors={['rgba(204, 255, 0, 0.12)', 'rgba(204, 255, 0, 0.04)']}
            style={styles.convertBannerInner}
          >
            <Zap size={28} color="#ccff00" strokeWidth={2} />
            <Text style={styles.convertTitle}>
              {watched?.displayName.split(' ')[0]} is not stopping.{'\n'}Are you ready to start?
            </Text>
            <TouchableOpacity style={styles.convertButton} onPress={onStartOwn}>
              <LinearGradient colors={isDark ? ['#ccff00', '#aed900'] : ['#ccff00', '#ccff00']} style={styles.convertButtonGradient}>
                <Text style={styles.convertButtonText}>Start My 77-Day Journey</Text>
                <Zap size={18} color="#000000" strokeWidth={2.5} />
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.convertSub}>Join thousands building the life they actually want.</Text>
          </LinearGradient>
        </View>
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
  dayCountBadge: {
    alignItems: 'center',
    backgroundColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dayCountNumber: { fontSize: 28, fontWeight: '900', color: '#FFFFFF' },
  dayCountLabel: { fontSize: 10, fontWeight: '800', color: '#ccff00', letterSpacing: 1 },
  identityCard: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#ccff00',
    marginBottom: 20,
  },
  identityCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#ccff00',
    marginBottom: 8,
  },
  identityCardText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 22,
    fontStyle: 'italic',
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
  visionSection: { marginBottom: 24 },
  visionCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  visionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: '#555', marginBottom: 10 },
  visionText: { fontSize: 15, fontWeight: '600', color: '#B0B0B0', lineHeight: 22 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
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
