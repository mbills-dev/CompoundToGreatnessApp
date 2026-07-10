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
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft,
  Trophy,
  RefreshCw,
  Sparkles,
  Flame,
  CalendarDays,
  Repeat2,
  Compass,
  User,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
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

interface DimensionCardProps {
  dimension: Record<string, any>;
  colors: any;
  isDark: boolean;
}

function DimensionCard({ dimension, colors, isDark }: DimensionCardProps) {
  return (
    <View style={[
      styles.dimensionCard,
      {
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
        borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
      },
    ]}>
      <Text style={[styles.dimensionLabel, { color: colors.textTertiary }]}>
        {dimension.label || dimension.category}
      </Text>
      <Text style={[styles.dimensionSpecific, { color: colors.text }]}>
        {dimension.specific || dimension.vague || '—'}
      </Text>
    </View>
  );
}

export default function ArchivedChallengeDetailScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [archive, setArchive] = useState<ChallengeArchive | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadArchive(id);
  }, [id]);

  const loadArchive = async (archiveId: string) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('challenge_archives')
        .select('*')
        .eq('id', archiveId)
        .maybeSingle();
      setArchive(data);
    } catch {}
    setLoading(false);
  };

  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const panelBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.8)';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={isDark ? ['#000000', '#111111', '#000000'] : ['#F2F2F7', '#EFEFF4', '#F2F2F7']}
        style={styles.gradient}
      >
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.6}>
            <ChevronLeft size={24} color={colors.text} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Challenge Archive</Text>
          <View style={styles.backButton} />
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : !archive ? (
          <View style={styles.centerState}>
            <Text style={[styles.errorText, { color: colors.textTertiary }]}>Archive not found.</Text>
          </View>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.heroSection}>
              <View style={[styles.iconRing, { borderColor: `${reasonColor(archive.reason)}40` }]}>
                <ReasonIcon reason={archive.reason} size={40} />
              </View>
              <View style={[styles.reasonBadge, { backgroundColor: `${reasonColor(archive.reason)}20` }]}>
                <Text style={[styles.reasonBadgeText, { color: reasonColor(archive.reason) }]}>
                  {reasonLabel(archive.reason)}
                </Text>
              </View>
              <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={3}>
                {archive.goal_title}
              </Text>
              <Text style={[styles.heroDateRange, { color: colors.textTertiary }]}>
                {formatDate(archive.start_date)} — {formatDate(archive.end_date)}
              </Text>
            </View>

            <View style={[styles.statsRow, { backgroundColor: panelBg, borderColor }]}>
              <View style={styles.statItem}>
                <CalendarDays size={20} color={colors.primary} strokeWidth={2} />
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {archive.days_completed}<Text style={[styles.statDenom, { color: colors.textTertiary }]}>/77</Text>
                </Text>
                <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Days</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
              <View style={styles.statItem}>
                <Flame size={20} color={colors.primary} strokeWidth={2} />
                <Text style={[styles.statValue, { color: colors.text }]}>{archive.best_streak}</Text>
                <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Best Streak</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
              <View style={styles.statItem}>
                <Repeat2 size={20} color={colors.primary} strokeWidth={2} />
                <Text style={[styles.statValue, { color: colors.text }]}>{archive.total_restarts}</Text>
                <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Restarts</Text>
              </View>
            </View>

            {archive.identity_statement && (
              <View style={[styles.panel, { backgroundColor: panelBg, borderColor }]}>
                <View style={styles.panelHeader}>
                  <User size={16} color={colors.primary} strokeWidth={2} />
                  <Text style={[styles.panelTitle, { color: colors.text }]}>Identity</Text>
                </View>
                <Text style={[styles.identityStatement, { color: colors.text }]}>
                  {archive.identity_statement}
                </Text>
              </View>
            )}

            {archive.identity_dimensions && archive.identity_dimensions.length > 0 && (
              <View style={styles.dimensionsContainer}>
                {archive.identity_dimensions.map((dim, i) => (
                  <DimensionCard key={i} dimension={dim} colors={colors} isDark={isDark} />
                ))}
              </View>
            )}

            {(archive.compass_vision || archive.compass_declaration || archive.compass_filter_question) && (
              <View style={[styles.panel, { backgroundColor: panelBg, borderColor }]}>
                <View style={styles.panelHeader}>
                  <Compass size={16} color={colors.primary} strokeWidth={2} />
                  <Text style={[styles.panelTitle, { color: colors.text }]}>Compass</Text>
                </View>

                {archive.compass_vision && (
                  <>
                    <Text style={[styles.compassFieldLabel, { color: colors.textTertiary }]}>12-Month Vision</Text>
                    <Text style={[styles.compassFieldValue, { color: colors.text }]}>
                      {archive.compass_vision}
                    </Text>
                  </>
                )}

                {archive.compass_declaration && (
                  <>
                    <View style={[styles.compassDivider, { backgroundColor: borderColor }]} />
                    <Text style={[styles.compassFieldLabel, { color: colors.textTertiary }]}>Declaration</Text>
                    <Text style={[styles.compassFieldValue, { color: colors.text }]}>
                      {archive.compass_declaration}
                    </Text>
                  </>
                )}

                {archive.compass_filter_question && (
                  <>
                    <View style={[styles.compassDivider, { backgroundColor: borderColor }]} />
                    <Text style={[styles.compassFieldLabel, { color: colors.textTertiary }]}>Filter Question</Text>
                    <Text style={[styles.compassFilterQuestion, { color: colors.primary }]}>
                      "{archive.compass_filter_question}"
                    </Text>
                  </>
                )}
              </View>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>
        )}
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
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 60,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 28,
    gap: 10,
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  reasonBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  reasonBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 30,
    letterSpacing: -0.5,
    paddingHorizontal: 16,
  },
  heroDateRange: {
    fontSize: 13,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statDenom: {
    fontSize: 16,
    fontWeight: '500',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 8,
  },
  panel: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    marginBottom: 12,
    gap: 10,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  identityStatement: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  dimensionsContainer: {
    gap: 8,
    marginBottom: 12,
  },
  dimensionCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 4,
  },
  dimensionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dimensionSpecific: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  compassFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  compassFieldValue: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
  },
  compassFilterQuestion: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 23,
    fontStyle: 'italic',
    letterSpacing: -0.2,
  },
  compassDivider: {
    height: 1,
    marginVertical: 2,
  },
});
