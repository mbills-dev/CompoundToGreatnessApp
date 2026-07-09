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
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Trophy, RefreshCw, Sparkles, Archive } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ChallengeArchive, ArchiveReason } from '@/types/database';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function reasonLabel(reason: ArchiveReason): string {
  if (reason === 'completed') return 'Completed';
  if (reason === 'restarted') return 'Restarted';
  return 'Started Fresh';
}

function reasonColor(reason: ArchiveReason): string {
  if (reason === 'completed') return '#ccff00';
  if (reason === 'restarted') return '#60a5fa';
  return '#f97316';
}

function ReasonIcon({ reason, size }: { reason: ArchiveReason; size: number }) {
  const color = reasonColor(reason);
  if (reason === 'completed') return <Trophy size={size} color={color} strokeWidth={2} />;
  if (reason === 'restarted') return <RefreshCw size={size} color={color} strokeWidth={2} />;
  return <Sparkles size={size} color={color} strokeWidth={2} />;
}

export default function ArchivedChallengesScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [archives, setArchives] = useState<ChallengeArchive[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArchives();
  }, []);

  const loadArchives = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('challenge_archives')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setArchives(data ?? []);
    } catch {}
    setLoading(false);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={isDark ? ['#000000', '#111111', '#000000'] : ['#F2F2F7', '#EFEFF4', '#F2F2F7']}
        style={styles.gradient}
      >
        <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.6}>
            <ChevronLeft size={24} color={colors.text} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Archived Challenges</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : archives.length === 0 ? (
            <View style={styles.centerState}>
              <View style={[styles.emptyIcon, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
                <Archive size={36} color={colors.textTertiary} strokeWidth={1.5} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No archives yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                Completed or restarted challenges will appear here.
              </Text>
            </View>
          ) : (
            archives.map((archive) => (
              <TouchableOpacity
                key={archive.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  },
                ]}
                onPress={() => router.push({ pathname: '/archived-challenge-detail', params: { id: archive.id } })}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.reasonBadge, { backgroundColor: `${reasonColor(archive.reason)}20` }]}>
                    <ReasonIcon reason={archive.reason} size={13} />
                    <Text style={[styles.reasonText, { color: reasonColor(archive.reason) }]}>
                      {reasonLabel(archive.reason)}
                    </Text>
                  </View>
                  <Text style={[styles.cardDate, { color: colors.textTertiary }]}>
                    {formatDate(archive.end_date)}
                  </Text>
                </View>

                <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                  {archive.goal_title}
                </Text>

                <View style={styles.cardStats}>
                  <View style={styles.cardStat}>
                    <Text style={[styles.cardStatValue, { color: colors.primary }]}>
                      {archive.days_completed}
                    </Text>
                    <Text style={[styles.cardStatLabel, { color: colors.textTertiary }]}>
                      / 77 days
                    </Text>
                  </View>
                  <View style={[styles.cardStatDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
                  <View style={styles.cardStat}>
                    <Text style={[styles.cardStatValue, { color: colors.text }]}>
                      {archive.best_streak}
                    </Text>
                    <Text style={[styles.cardStatLabel, { color: colors.textTertiary }]}>
                      best streak
                    </Text>
                  </View>
                  <View style={[styles.cardStatDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
                  <View style={styles.cardStat}>
                    <Text style={[styles.cardStatValue, { color: colors.text }]}>
                      {archive.total_restarts}
                    </Text>
                    <Text style={[styles.cardStatLabel, { color: colors.textTertiary }]}>
                      restarts
                    </Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={[styles.cardDateRange, { color: colors.textTertiary }]}>
                    {formatDate(archive.start_date)} — {formatDate(archive.end_date)}
                  </Text>
                  <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 60,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60,
    gap: 12,
  },
  centerState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  reasonText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cardDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  cardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  cardStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  cardStatValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  cardStatLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardStatDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  cardDateRange: {
    fontSize: 12,
    fontWeight: '400',
  },
});
