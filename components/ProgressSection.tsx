import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  Image,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Modal,
} from 'react-native';
import { X, Camera, ArrowRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Goal, DailyCompletion, DailyActivity, EvidenceLog, ProgressPhoto } from '@/types/database';
import { toLocalDateString } from '@/lib/dateHelpers';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ComparisonModal } from './JourneyComparisonBanner';
import { isMilestoneDay } from '@/constants/milestones';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LIME = '#CCFF00';
const CARD_BG = '#191919';
const INNER_BG = '#111111';
const MUTED_35 = 'rgba(255,255,255,0.35)';
const MUTED_28 = 'rgba(255,255,255,0.28)';
const MUTED_25 = 'rgba(255,255,255,0.25)';
const MUTED_40 = 'rgba(255,255,255,0.40)';
const MUTED_65 = 'rgba(255,255,255,0.65)';
const RED = 'rgba(255,68,68,0.8)';
const MUTED_06 = 'rgba(255,255,255,0.06)';
const MUTED_10 = 'rgba(255,255,255,0.10)';

interface ProgressSectionProps {
  goal: Goal;
  completions: DailyCompletion[];
  activities: DailyActivity[];
}

interface ActivityStat {
  id: string;
  name: string;
  daysCompleted: number;
  totalDays: number;
  percentage: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProgressSection({ goal, completions, activities }: ProgressSectionProps) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [evidenceLogs, setEvidenceLogs] = useState<EvidenceLog[]>([]);
  const [showAllConsistency, setShowAllConsistency] = useState(false);
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [comparisonModalVisible, setComparisonModalVisible] = useState(false);
  const [fullPhotoUri, setFullPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    loadEvidenceLogs();
  }, [goal.id]);

  useEffect(() => {
    loadProgressPhotos();
  }, [goal.id]);

  const loadEvidenceLogs = async () => {
    const { data } = await supabase
      .from('evidence_logs')
      .select('*')
      .eq('goal_id', goal.id)
      .order('completion_date', { ascending: false })
      .limit(20);
    if (data) setEvidenceLogs(data);
  };

  const loadProgressPhotos = async () => {
    if (!user) return;
    setPhotosLoading(true);
    const { data } = await supabase
      .from('progress_photos')
      .select('*')
      .eq('goal_id', goal.id)
      .eq('user_id', user.id)
      .order('challenge_day', { ascending: true });
    setPhotos(data || []);
    setPhotosLoading(false);
  };

  const getActivityConsistency = useCallback((): ActivityStat[] => {
    const totalDays = goal.current_challenge_day || 0;
    if (totalDays === 0 || activities.length === 0) return [];

    const completedWithDate = completions.filter((c) => c.completed_at !== null);

    return activities.map((activity) => {
      const daysCompleted = completedWithDate.filter(
        (c) => c.activities_completed && c.activities_completed.includes(activity.id)
      ).length;
      const pct = totalDays > 0 ? Math.round((daysCompleted / totalDays) * 100) : 0;
      return {
        id: activity.id,
        name: activity.activity_name,
        daysCompleted,
        totalDays,
        percentage: pct,
      };
    });
  }, [goal.current_challenge_day, activities, completions]);

  const activityStats = getActivityConsistency();
  const overallConsistency =
    activityStats.length > 0
      ? Math.round(activityStats.reduce((sum, s) => sum + s.percentage, 0) / activityStats.length)
      : 0;

  const sortedStats = [...activityStats].sort((a, b) => b.percentage - a.percentage);
  const strongestStat = sortedStats[0];
  const lowestStat = sortedStats[sortedStats.length - 1];

  const formatLogDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getChallengeDay = (completion_date: string): number => {
    if (!goal.challenge_start_date) return 1;
    const start = new Date(goal.challenge_start_date);
    const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const target = new Date(completion_date + 'T00:00:00');
    const diff = Math.floor((target.getTime() - startMidnight.getTime()) / (1000 * 60 * 60 * 24));
    return diff + 1;
  };

  // Journey photos
  const earliestPhoto = photos.length > 0 ? photos[0] : null;
  const latestPhoto = photos.length > 0 ? photos[photos.length - 1] : null;
  const hasComparisonPhotos = photos.length >= 2;

  // Evidence logs visible
  const visibleLogs = showAllEvidence ? evidenceLogs : evidenceLogs.slice(0, 3);

  return (
    <View style={styles.root}>
      {/* CONSISTENCY */}
      {activityStats.length > 0 && (
        <View style={styles.section}>
          <View style={styles.eyebrowPill}>
            <Text style={styles.eyebrowPillText}>CONSISTENCY</Text>
          </View>
          <Text style={styles.headline}>HOW YOU'RE SHOWING UP</Text>

          <View style={styles.consistencyCard}>
            <View style={styles.consistencyHeroRow}>
              <View style={styles.consistencyHeroLeft}>
                <Text style={styles.consistencyHeroNumber}>{overallConsistency}%</Text>
              </View>
              <View style={styles.consistencyHeroRight}>
                <Text style={styles.consistencyHeroLabel}>OVERALL CONSISTENCY</Text>
                <Text style={styles.consistencyHeroSub}>Across your daily commitments.</Text>
              </View>
            </View>

            <View style={styles.consistencyDivider} />

            {/* Two insights */}
            {strongestStat && (
              <View style={styles.insightRow}>
                <View style={styles.insightLabelCol}>
                  <Text style={styles.insightEyebrow}>STRONGEST</Text>
                  <Text style={styles.insightName} numberOfLines={1}>{strongestStat.name}</Text>
                </View>
                <Text style={[styles.insightPct, { color: LIME }]}>{strongestStat.percentage}%</Text>
              </View>
            )}

            {lowestStat && lowestStat.id !== strongestStat?.id && (
              <View style={styles.insightRow}>
                <View style={styles.insightLabelCol}>
                  <Text style={styles.insightEyebrow}>NEEDS ATTENTION</Text>
                  <Text style={styles.insightName} numberOfLines={1}>{lowestStat.name}</Text>
                </View>
                <Text style={[styles.insightPct, { color: MUTED_40 }]}>{lowestStat.percentage}%</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.viewAllBtn}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setShowAllConsistency(!showAllConsistency);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.viewAllText}>
                {showAllConsistency ? 'COLLAPSE ↑' : 'VIEW ALL INPUTS →'}
              </Text>
            </TouchableOpacity>

            {showAllConsistency && (
              <View style={styles.allInputsList}>
                {activityStats.map((stat) => (
                  <View key={stat.id} style={styles.inputRow}>
                    <Text style={styles.inputName} numberOfLines={1}>{stat.name}</Text>
                    <Text style={styles.inputDays}>{stat.daysCompleted}/{stat.totalDays}</Text>
                    <Text style={[styles.inputPct, { color: stat.percentage >= 90 ? LIME : MUTED_40 }]}>
                      {stat.percentage}%
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {/* YOUR JOURNEY — Progress Photos / Transformation */}
      <View style={styles.section}>
        <View style={styles.eyebrowPill}>
          <Text style={styles.eyebrowPillText}>YOUR JOURNEY</Text>
        </View>
        <Text style={styles.headline}>SEE WHO YOU'RE BECOMING.</Text>

        {photosLoading ? (
          <View style={styles.journeyLoading}>
            <ActivityIndicator size="small" color={LIME} />
          </View>
        ) : hasComparisonPhotos && earliestPhoto && latestPhoto ? (
          <View style={styles.journeyCard}>
            <View style={styles.journeyPhotoRow}>
              <View style={styles.journeyPhotoPanel}>
                <Image source={{ uri: earliestPhoto.storage_url }} style={styles.journeyPhoto} resizeMode="cover" />
                <View style={styles.journeyDayBadge}>
                  <Text style={styles.journeyDayBadgeText}>DAY {earliestPhoto.challenge_day}</Text>
                </View>
              </View>
              <View style={styles.journeyArrowCircle}>
                <ArrowRight size={14} color="#1A1A1A" strokeWidth={2.5} />
              </View>
              <View style={styles.journeyPhotoPanel}>
                <Image source={{ uri: latestPhoto.storage_url }} style={styles.journeyPhoto} resizeMode="cover" />
                <View style={styles.journeyDayBadge}>
                  <Text style={styles.journeyDayBadgeText}>DAY {latestPhoto.challenge_day}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.journeyCta}
              onPress={() => setComparisonModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.journeyCtaText}>SEE YOUR JOURNEY →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.journeyEmptyCard}>
            <View style={styles.journeyEmptyIcon}>
              <Camera size={28} color={LIME} strokeWidth={1.5} />
            </View>
            <Text style={styles.journeyEmptyTitle}>Document your transformation</Text>
            <Text style={styles.journeyEmptySub}>
              Add progress photos from any completed day to see how far you've come.
            </Text>
          </View>
        )}
      </View>

      {/* EVIDENCE LOG */}
      <View style={styles.section}>
        <View style={styles.eyebrowPill}>
          <Text style={styles.eyebrowPillText}>EVIDENCE LOG</Text>
        </View>
        <Text style={styles.headline}>YOUR JOURNEY IN YOUR OWN WORDS</Text>

        {evidenceLogs.length === 0 ? (
          <View style={styles.evidenceEmptyCard}>
            <Text style={styles.evidenceEmptyText}>
              Your evidence log entries will appear here as you write them.
            </Text>
          </View>
        ) : (
          <View style={styles.evidenceList}>
            {visibleLogs.map((log) => (
              <View key={log.id} style={styles.evidenceCard}>
                <View style={styles.evidenceCardHeader}>
                  <Text style={styles.evidenceDay}>DAY {getChallengeDay(log.completion_date)}</Text>
                  <Text style={styles.evidenceDate}>{formatLogDate(log.completion_date)}</Text>
                </View>
                <Text style={styles.evidenceContent} numberOfLines={showAllEvidence ? undefined : 3}>
                  {log.content}
                </Text>
              </View>
            ))}

            {evidenceLogs.length > 3 && !showAllEvidence && (
              <TouchableOpacity
                style={styles.viewAllBtn}
                onPress={() => setShowAllEvidence(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.viewAllText}>VIEW ALL ENTRIES →</Text>
              </TouchableOpacity>
            )}
            {showAllEvidence && evidenceLogs.length > 3 && (
              <TouchableOpacity
                style={styles.viewAllBtn}
                onPress={() => setShowAllEvidence(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.viewAllText}>COLLAPSE ↑</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* THE STAKES */}
      <View style={styles.section}>
        <View style={styles.eyebrowPill}>
          <Text style={styles.eyebrowPillText}>THE STAKES</Text>
        </View>
        <Text style={styles.headline}>THERE'S NO STANDING STILL.</Text>

        <View style={styles.stakesCard}>
          <View style={styles.stakesRow}>
            <View style={[styles.stakesIcon, { borderColor: LIME }]}>
              <Text style={[styles.stakesArrow, { color: LIME }]}>↑</Text>
            </View>
            <View style={styles.stakesText}>
              <Text style={styles.stakesRowTitle}>1% better every day</Text>
              <Text style={styles.stakesRowSub}>Show up. Do the inputs. Compound.</Text>
            </View>
            <Text style={[styles.stakesValue, { color: LIME }]}>3,678%</Text>
          </View>
          <View style={styles.stakesDivider} />
          <View style={styles.stakesRow}>
            <View style={[styles.stakesIcon, { borderColor: 'rgba(255,68,68,0.5)' }]}>
              <Text style={[styles.stakesArrow, { color: RED }]}>↓</Text>
            </View>
            <View style={styles.stakesText}>
              <Text style={styles.stakesRowTitle}>1% worse every day</Text>
              <Text style={styles.stakesRowSub}>Skip inputs. Make excuses. Decline.</Text>
            </View>
            <Text style={[styles.stakesValue, { color: RED }]}>-97%</Text>
          </View>
          <Text style={styles.stakesTruth}>
            There is no neutral. Every day you either compound forward or compound backward.
          </Text>
        </View>
      </View>

      <View style={{ height: 40 }} />

      {/* Comparison Modal */}
      <ComparisonModal
        visible={comparisonModalVisible}
        onClose={() => setComparisonModalVisible(false)}
        earliestPhoto={earliestPhoto as any}
        latestPhoto={latestPhoto as any}
      />

      {/* Full photo viewer for single photos */}
      <Modal
        visible={fullPhotoUri !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setFullPhotoUri(null)}
      >
        <TouchableOpacity
          style={styles.fullPhotoOverlay}
          activeOpacity={1}
          onPress={() => setFullPhotoUri(null)}
        >
          <Image source={{ uri: fullPhotoUri ?? '' }} style={styles.fullPhotoImage} resizeMode="contain" />
          <TouchableOpacity style={styles.fullPhotoClose} onPress={() => setFullPhotoUri(null)}>
            <X size={22} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 24,
  },
  section: {
    marginTop: 36,
  },
  eyebrowPill: {
    alignSelf: 'flex-start',
    backgroundColor: INNER_BG,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  eyebrowPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: LIME,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.3,
    fontFamily: 'Inter-Black',
  },

  /* Consistency */
  consistencyCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 20,
  },
  consistencyHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  consistencyHeroLeft: {},
  consistencyHeroNumber: {
    fontSize: 52,
    fontWeight: '900',
    color: LIME,
    lineHeight: 56,
    fontFamily: 'Inter-Black',
    letterSpacing: -1,
  },
  consistencyHeroRight: {
    flex: 1,
  },
  consistencyHeroLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: MUTED_35,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  consistencyHeroSub: {
    fontSize: 13,
    color: MUTED_65,
    lineHeight: 18,
  },
  consistencyDivider: {
    height: 1,
    backgroundColor: MUTED_06,
    marginBottom: 16,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  insightLabelCol: {
    flex: 1,
    marginRight: 12,
  },
  insightEyebrow: {
    fontSize: 9,
    fontWeight: '700',
    color: MUTED_35,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  insightName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  insightPct: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
  },
  viewAllBtn: {
    marginTop: 14,
    paddingVertical: 4,
  },
  viewAllText: {
    fontSize: 12,
    color: LIME,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  allInputsList: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: MUTED_06,
    gap: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  inputName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
  inputDays: {
    fontSize: 11,
    color: MUTED_35,
    marginRight: 12,
  },
  inputPct: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
  },

  /* Journey */
  journeyLoading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  journeyCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
  },
  journeyPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  journeyPhotoPanel: {
    flex: 1,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  journeyPhoto: {
    width: '100%',
    height: '100%',
  },
  journeyDayBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  journeyDayBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: LIME,
    letterSpacing: 0.5,
  },
  journeyArrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: LIME,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  journeyCta: {
    backgroundColor: LIME,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  journeyCtaText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1A1A1A',
    letterSpacing: 0.5,
  },
  journeyEmptyCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
  },
  journeyEmptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: INNER_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  journeyEmptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  journeyEmptySub: {
    fontSize: 13,
    color: MUTED_40,
    textAlign: 'center',
    lineHeight: 19,
  },

  /* Evidence */
  evidenceList: {},
  evidenceCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  evidenceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  evidenceDay: {
    fontSize: 10,
    color: LIME,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  evidenceDate: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
  },
  evidenceContent: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 20,
    color: MUTED_65,
  },
  evidenceEmptyCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  evidenceEmptyText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: MUTED_25,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* Stakes */
  stakesCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 20,
  },
  stakesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  stakesIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  stakesArrow: {
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
  },
  stakesText: {
    flex: 1,
  },
  stakesRowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stakesRowSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 1,
  },
  stakesValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  stakesDivider: {
    height: 1,
    backgroundColor: MUTED_06,
    marginVertical: 2,
  },
  stakesTruth: {
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 16,
    color: MUTED_25,
  },

  /* Full photo viewer */
  fullPhotoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullPhotoImage: {
    width: '100%',
    height: '80%',
  },
  fullPhotoClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
