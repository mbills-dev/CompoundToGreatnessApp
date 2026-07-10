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
import { Eye, Zap, Calendar, Target, LogOut } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';

interface WatchedUser {
  displayName: string;
  currentDay: number;
  identityStatement: string;
  goalTitle: string;
  streak: number;
  lastActive: string | null;
  completionDates: string[];
  compassVision: string;
}

interface Props {
  watcherId: string;
  watchedId: string;
  onSignOut: () => void;
  onStartOwn: () => void;
}

export default function WatcherHomeScreen({ watcherId, watchedId, onSignOut, onStartOwn }: Props) {
  const { isDark } = useTheme();
  const [watched, setWatched] = useState<WatchedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [watcherName, setWatcherName] = useState('');

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
          .select('title, identity_statement, current_challenge_day, last_completion_date, compass_vision')
          .eq('user_id', watchedId)
          .eq('is_active', true)
          .maybeSingle(),
        supabase
          .from('user_settings')
          .select('first_name')
          .eq('user_id', watcherId)
          .maybeSingle(),
      ]);

      const completionsRes = await supabase
        .from('daily_completions')
        .select('completion_date')
        .eq('goal_id', goalRes.data ? await getGoalId(watchedId) : '')
        .order('completion_date', { ascending: false })
        .limit(77);

      const displayName = settingsRes.data
        ? `${settingsRes.data.first_name || ''} ${settingsRes.data.last_name || ''}`.trim()
        : 'Your person';

      setWatched({
        displayName: displayName || 'Your person',
        currentDay: goalRes.data?.current_challenge_day || 0,
        identityStatement: goalRes.data?.identity_statement || '',
        goalTitle: goalRes.data?.title || 'their journey',
        streak: goalRes.data?.current_challenge_day || 0,
        lastActive: goalRes.data?.last_completion_date || null,
        compassVision: goalRes.data?.compass_vision || '',
        completionDates: completionsRes.data?.map((c) => c.completion_date) || [],
      });

      setWatcherName(watcherRes.data?.first_name || 'You');
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const getGoalId = async (userId: string): Promise<string> => {
    const { data } = await supabase
      .from('goals')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();
    return data?.id || '';
  };

  const getMilestones = () => {
    const milestones = [7, 21, 40, 77];
    return milestones.map((m) => ({
      day: m,
      reached: (watched?.currentDay || 0) >= m,
      current: watched?.currentDay === m,
    }));
  };

  const getStreakDisplay = () => {
    const day = watched?.currentDay || 0;
    if (day === 0) return 'Just getting started';
    if (day < 7) return `${day} days in`;
    if (day < 21) return `${day} days strong`;
    if (day < 40) return `${day} days — on fire`;
    if (day < 77) return `${day} days — unstoppable`;
    return '77 days — COMPLETE';
  };

  const getLastActiveLabel = () => {
    if (!watched?.lastActive) return 'Not yet started';
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
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

  const progressPercent = Math.min(((watched?.currentDay || 0) / 77) * 100, 100);

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

            {watched?.identityStatement ? (
              <View style={styles.identityCard}>
                <Text style={styles.identityCardLabel}>THEIR IDENTITY</Text>
                <Text style={styles.identityCardText}>"{watched.identityStatement}"</Text>
              </View>
            ) : null}

            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>{getStreakDisplay()}</Text>
                <Text style={styles.progressPercent}>{Math.round(progressPercent)}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.milestonesSection}>
          <Text style={styles.sectionTitle}>Milestones</Text>
          <View style={styles.milestoneRow}>
            {getMilestones().map((m) => (
              <View key={m.day} style={[styles.milestoneBadge, m.reached && styles.milestoneBadgeReached]}>
                {m.reached ? (
                  <Text style={styles.milestoneCheck}>✓</Text>
                ) : null}
                <Text style={[styles.milestoneDayNumber, m.reached && styles.milestoneTextReached]}>
                  {m.day}
                </Text>
                <Text style={[styles.milestoneDayLabel, m.reached && styles.milestoneTextReached]}>
                  DAY
                </Text>
              </View>
            ))}
          </View>
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
  progressSection: { gap: 10 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  progressPercent: { fontSize: 14, fontWeight: '700', color: '#ccff00' },
  progressTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#ccff00', borderRadius: 4 },
  milestonesSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', marginBottom: 16 },
  milestoneRow: { flexDirection: 'row', gap: 12 },
  milestoneBadge: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  milestoneBadgeReached: {
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    borderColor: '#ccff00',
  },
  milestoneCheck: { fontSize: 14, color: '#ccff00', fontWeight: '900', marginBottom: 4 },
  milestoneDayNumber: { fontSize: 20, fontWeight: '900', color: '#333' },
  milestoneDayLabel: { fontSize: 9, fontWeight: '800', color: '#333', letterSpacing: 1 },
  milestoneTextReached: { color: '#ccff00' },
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
