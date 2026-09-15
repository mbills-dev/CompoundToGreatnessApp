import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { ArrowRight, X, ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { responsiveStyle } from '@/components/ResponsiveContainer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isMilestoneDay } from '@/constants/milestones';
import { useJourneyComparison, JourneyPhoto } from '@/hooks/useJourneyComparison';
import { supabase } from '@/lib/supabase';
import { EvidenceLog } from '@/types/database';

interface JourneyComparisonBannerProps {
  goalId: string;
  currentChallengeDay: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function JourneyComparisonBanner({ goalId, currentChallengeDay }: JourneyComparisonBannerProps) {
  const { colors, isDark } = useTheme();
  const cardBg = isDark ? '#000000' : colors.card;
  const cardBorder = isDark ? '#222222' : colors.border;
  const headerBg = '#1A1A1A';
  const textPrimary = isDark ? '#FFFFFF' : colors.text;
  const textMuted = isDark ? 'rgba(255,255,255,0.4)' : colors.textTertiary;
  const statTileBg = isDark ? '#1A1A1A' : colors.backgroundSecondary;
  const dayBadgeBg = isDark ? '#1A1A1A' : colors.backgroundSecondary;
  const dayBadgeTextColor = isDark ? '#FFFFFF' : colors.text;
  const ctaTextColor = isDark ? '#1A1A1A' : '#000000';
  const { stats, loading } = useJourneyComparison(goalId, currentChallengeDay);
  const [modalVisible, setModalVisible] = useState(false);

  if (loading || !stats) return null;

  const { earliestPhoto, latestPhoto, photoCount, perfectDays, daysCompleted } = stats;
  if (!earliestPhoto || !latestPhoto) return null;

  const isEarliestMilestone = isMilestoneDay(earliestPhoto.challenge_day) || earliestPhoto.is_milestone;
  const isLatestMilestone = isMilestoneDay(latestPhoto.challenge_day) || latestPhoto.is_milestone;

  return (
    <>
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={[styles.header, { backgroundColor: headerBg }]}>
          <Text style={styles.title}>
            <Text style={[styles.titleWhite, { color: textPrimary }]}>See Your </Text>
            <Text style={styles.titleLime}>Journey.</Text>
          </Text>
          <Text style={[styles.subtitle, { color: textMuted }]}>
            Day {earliestPhoto.challenge_day} → Day {latestPhoto.challenge_day} · {photoCount} photos captured
          </Text>
        </View>

        <View style={styles.photoSection}>
          <View style={styles.photoPanel}>
            <Image source={{ uri: earliestPhoto.storage_url }} style={styles.photo} resizeMode="cover" />
            <View style={[styles.dayBadge, { backgroundColor: dayBadgeBg }, isEarliestMilestone && styles.dayBadgeMilestone]}>
              <Text style={[styles.dayBadgeText, { color: dayBadgeTextColor }, isEarliestMilestone && styles.dayBadgeTextMilestone]}>
                DAY {earliestPhoto.challenge_day}
              </Text>
            </View>
          </View>

          <View style={styles.arrowCircle}>
            <ArrowRight size={14} color="#1A1A1A" strokeWidth={2.5} />
          </View>

          <View style={styles.photoPanel}>
            <Image source={{ uri: latestPhoto.storage_url }} style={styles.photo} resizeMode="cover" />
            <View style={[styles.dayBadge, { backgroundColor: dayBadgeBg }, isLatestMilestone && styles.dayBadgeMilestone]}>
              <Text style={[styles.dayBadgeText, { color: dayBadgeTextColor }, isLatestMilestone && styles.dayBadgeTextMilestone]}>
                DAY {latestPhoto.challenge_day}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statTile, { backgroundColor: statTileBg }]}>
            <Text style={styles.statValue}>{daysCompleted}</Text>
            <Text style={[styles.statLabel, { color: textMuted }]}>DAYS IN</Text>
          </View>
          <View style={[styles.statTile, { backgroundColor: statTileBg }]}>
            <Text style={styles.statValue}>{perfectDays}</Text>
            <Text style={[styles.statLabel, { color: textMuted }]}>PERFECT DAYS</Text>
          </View>
          <View style={[styles.statTile, { backgroundColor: statTileBg }]}>
            <Text style={styles.statValue}>{photoCount}</Text>
            <Text style={[styles.statLabel, { color: textMuted }]}>PHOTOS</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.ctaButton} onPress={() => setModalVisible(true)} activeOpacity={0.8}>
          <Text style={[styles.ctaText, { color: ctaTextColor }]}>View Full Comparison →</Text>
        </TouchableOpacity>
      </View>

      <ComparisonModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        earliestPhoto={earliestPhoto}
        latestPhoto={latestPhoto}
        goalId={goalId}
      />
    </>
  );
}

export interface ComparisonModalProps {
  visible: boolean;
  onClose: () => void;
  earliestPhoto: JourneyPhoto | null;
  latestPhoto: JourneyPhoto | null;
  goalId?: string;
}

interface EvidenceEntry {
  challengeDay: number;
  content: string;
}

export function ComparisonModal({ visible, onClose, earliestPhoto, latestPhoto, goalId }: ComparisonModalProps) {
  const insets = useSafeAreaInsets();
  const [fullPhotoIndex, setFullPhotoIndex] = useState<number | null>(null);
  const [allPhotos, setAllPhotos] = useState<JourneyPhoto[]>([]);
  const [evidenceMap, setEvidenceMap] = useState<Map<number, string>>(new Map());
  const [loadingData, setLoadingData] = useState(true);
  const [selectedA, setSelectedA] = useState<JourneyPhoto | null>(null);
  const [selectedB, setSelectedB] = useState<JourneyPhoto | null>(null);

  useEffect(() => {
    if (!visible || !goalId) return;
    setLoadingData(true);
    Promise.all([
      supabase
        .from('progress_photos')
        .select('id, challenge_day, storage_url, is_milestone')
        .eq('goal_id', goalId)
        .order('challenge_day', { ascending: true }),
      supabase
        .from('evidence_logs')
        .select('completion_date, content')
        .eq('goal_id', goalId),
    ]).then(([photosRes, evidenceRes]) => {
      const photos: JourneyPhoto[] = photosRes.data || [];
      setAllPhotos(photos);
      if (earliestPhoto) setSelectedA(photos[0] || earliestPhoto);
      if (latestPhoto) setSelectedB(photos[photos.length - 1] || latestPhoto);

      if (evidenceRes.data && goalId) {
        const goalStartRes = supabase
          .from('goals')
          .select('challenge_start_date')
          .eq('id', goalId)
          .maybeSingle();

        goalStartRes.then(({ data: goalData }) => {
          const startDate = goalData?.challenge_start_date;
          const map = new Map<number, string>();
          (evidenceRes.data as EvidenceLog[]).forEach((log) => {
            if (startDate) {
              const start = new Date(startDate);
              const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
              const target = new Date(log.completion_date + 'T00:00:00');
              const diff = Math.floor((target.getTime() - startMidnight.getTime()) / (1000 * 60 * 60 * 24));
              const day = diff + 1;
              if (day >= 1 && log.content.trim()) {
                map.set(day, log.content);
              }
            }
          });
          setEvidenceMap(map);
          setLoadingData(false);
        });
      } else {
        setLoadingData(false);
      }
    });
  }, [visible, goalId]);

  const photoA = selectedA || earliestPhoto;
  const photoB = selectedB || latestPhoto;

  const daysApart = photoA && photoB ? Math.abs(photoB.challenge_day - photoA.challenge_day) : 0;

  const handleTimelineTap = useCallback((photo: JourneyPhoto) => {
    if (!selectedA || (selectedA.id === photo.id && selectedB?.id === photo.id)) {
      setSelectedA(photo);
      if (!selectedB || selectedB.id === photo.id) setSelectedB(null);
      return;
    }
    if (!selectedB) {
      if (photo.challenge_day < selectedA.challenge_day) {
        setSelectedA(photo);
        setSelectedB(selectedA);
      } else {
        setSelectedB(photo);
      }
      return;
    }
    if (photo.id === selectedA.id) {
      setSelectedA(selectedB);
      setSelectedB(null);
      return;
    }
    if (photo.id === selectedB.id) {
      setSelectedB(null);
      return;
    }
    if (photo.challenge_day < selectedA.challenge_day) {
      setSelectedA(photo);
    } else if (photo.challenge_day > selectedB.challenge_day) {
      setSelectedB(photo);
    } else {
      setSelectedB(photo);
    }
  }, [selectedA, selectedB]);

  const evidenceContent = useMemo(() => {
    if (!photoB) return null;
    return evidenceMap.get(photoB.challenge_day) || (photoA ? evidenceMap.get(photoA.challenge_day) : null);
  }, [photoA, photoB, evidenceMap]);

  const evidenceDay = useMemo(() => {
    if (!photoB) return null;
    if (evidenceMap.has(photoB.challenge_day)) return photoB.challenge_day;
    if (photoA && evidenceMap.has(photoA.challenge_day)) return photoA.challenge_day;
    return null;
  }, [photoA, photoB, evidenceMap]);

  const fullPhoto = fullPhotoIndex !== null ? allPhotos[fullPhotoIndex] : null;

  const sortedPhotos = useMemo(() => {
    return [...allPhotos].sort((a, b) => a.challenge_day - b.challenge_day);
  }, [allPhotos]);

  if (!earliestPhoto || !latestPhoto) return null;

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent>
        <View style={modalStyles.container}>
          {/* Fixed header */}
          <View style={[modalStyles.topBar, { paddingTop: insets.top + 12 }]}>
            <View style={modalStyles.topBarLeft}>
              <Text style={modalStyles.topBarTitle}>YOUR JOURNEY</Text>
              <Text style={modalStyles.topBarSubtitle}>Your progress. One day at a time.</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <X size={20} color="rgba(255,255,255,0.6)" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {loadingData ? (
            <View style={modalStyles.loadingContainer}>
              <ActivityIndicator size="large" color="#CCFF00" />
            </View>
          ) : (
            <ScrollView
              style={modalStyles.scroll}
              contentContainerStyle={[modalStyles.content, { paddingBottom: insets.bottom + 48 }]}
              showsVerticalScrollIndicator={false}
            >
              {/* HERO COMPARISON */}
              <Text style={modalStyles.sectionLabel}>THEN → NOW</Text>

              <View style={modalStyles.heroComparison}>
                <TouchableOpacity
                  style={modalStyles.heroPhotoPanel}
                  activeOpacity={0.9}
                  onPress={() => {
                    const idx = sortedPhotos.findIndex(p => p.id === photoA?.id);
                    if (idx >= 0) setFullPhotoIndex(idx);
                  }}
                >
                  <Image source={{ uri: photoA?.storage_url ?? '' }} style={modalStyles.heroPhoto} resizeMode="cover" />
                  <View style={modalStyles.heroDayBadge}>
                    <Text style={modalStyles.heroDayBadgeText}>DAY {photoA?.challenge_day}</Text>
                  </View>
                </TouchableOpacity>

                <View style={modalStyles.heroArrowCircle}>
                  <ArrowRight size={18} color="#050505" strokeWidth={2.5} />
                </View>

                <TouchableOpacity
                  style={modalStyles.heroPhotoPanel}
                  activeOpacity={0.9}
                  onPress={() => {
                    const idx = sortedPhotos.findIndex(p => p.id === photoB?.id);
                    if (idx >= 0) setFullPhotoIndex(idx);
                  }}
                >
                  <Image source={{ uri: photoB?.storage_url ?? '' }} style={modalStyles.heroPhoto} resizeMode="cover" />
                  <View style={modalStyles.heroDayBadge}>
                    <Text style={modalStyles.heroDayBadgeText}>DAY {photoB?.challenge_day}</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <Text style={modalStyles.daysApart}>{daysApart} DAYS APART</Text>
              <Text style={modalStyles.daysApartSub}>Proof looks different when you put it side by side.</Text>

              {/* EVIDENCE ENTRY */}
              {evidenceContent && evidenceDay !== null && (
                <View style={modalStyles.evidenceBlock}>
                  <Text style={modalStyles.evidenceLabel}>FROM DAY {evidenceDay}</Text>
                  <Text style={modalStyles.evidenceText}>"{evidenceContent}"</Text>
                </View>
              )}

              {/* TRANSFORMATION TIMELINE */}
              <View style={modalStyles.timelineSection}>
                <Text style={modalStyles.sectionLabel}>YOUR TIMELINE</Text>
                <Text style={modalStyles.timelineSub}>See the moments you documented along the way.</Text>

                <FlatList
                  horizontal
                  data={sortedPhotos}
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={modalStyles.timelineList}
                  renderItem={({ item }) => {
                    const isSelectedA = photoA?.id === item.id;
                    const isSelectedB = photoB?.id === item.id;
                    const isLatest = item.id === sortedPhotos[sortedPhotos.length - 1].id;
                    const isSelected = isSelectedA || isSelectedB;

                    return (
                      <TouchableOpacity
                        style={[
                          modalStyles.timelineTile,
                          isSelected && modalStyles.timelineTileSelected,
                          isLatest && !isSelected && modalStyles.timelineTileLatest,
                        ]}
                        activeOpacity={0.85}
                        onPress={() => handleTimelineTap(item)}
                      >
                        <Image source={{ uri: item.storage_url }} style={modalStyles.timelinePhoto} resizeMode="cover" />
                        <View style={modalStyles.timelineDayBadge}>
                          <Text style={[modalStyles.timelineDayText, isSelected && modalStyles.timelineDayTextSelected]}>
                            DAY {item.challenge_day}
                          </Text>
                        </View>
                        {isLatest && (
                          <View style={modalStyles.latestDot} />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* FULL-SCREEN PHOTO VIEWER */}
      <Modal
        visible={fullPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setFullPhotoIndex(null)}
      >
        <View style={modalStyles.fullPhotoOverlay}>
          {fullPhoto && (
            <>
              <Image source={{ uri: fullPhoto.storage_url }} style={modalStyles.fullPhotoImage} resizeMode="contain" />
              <View style={[modalStyles.fullPhotoHeader, { top: insets.top + 16 }]}>
                <TouchableOpacity
                  style={modalStyles.fullPhotoNavBtn}
                  onPress={() => {
                    if (fullPhotoIndex! > 0) setFullPhotoIndex(fullPhotoIndex! - 1);
                  }}
                  disabled={fullPhotoIndex === 0}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <ArrowLeft size={22} color={fullPhotoIndex === 0 ? 'rgba(255,255,255,0.2)' : '#FFFFFF'} strokeWidth={2.5} />
                </TouchableOpacity>
                <Text style={modalStyles.fullPhotoDayLabel}>DAY {fullPhoto.challenge_day}</Text>
                <TouchableOpacity
                  style={modalStyles.fullPhotoNavBtn}
                  onPress={() => {
                    if (fullPhotoIndex! < sortedPhotos.length - 1) setFullPhotoIndex(fullPhotoIndex! + 1);
                  }}
                  disabled={fullPhotoIndex === sortedPhotos.length - 1}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <ArrowRight size={22} color={fullPhotoIndex === sortedPhotos.length - 1 ? 'rgba(255,255,255,0.2)' : '#FFFFFF'} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[modalStyles.fullPhotoClose, { top: insets.top + 16 }]}
                onPress={() => setFullPhotoIndex(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={22} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 24,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#1A1A1A',
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  titleWhite: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  titleLime: {
    color: '#CCFF00',
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  photoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  photoPanel: {
    flex: 1,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  dayBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  dayBadgeMilestone: {
    backgroundColor: '#CCFF00',
    borderColor: '#CCFF00',
  },
  dayBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dayBadgeTextMilestone: {
    color: '#1A1A1A',
  },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#CCFF00',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
  },
  statTile: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#CCFF00',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  ctaButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#CCFF00',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1A1A1A',
  },
});

const modalStyles = StyleSheet.create({
  container: {
    ...responsiveStyle.container,
    backgroundColor: '#050505',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    zIndex: 10,
  },
  topBarLeft: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    fontFamily: 'Inter-Black',
  },
  topBarSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#CCFF00',
    letterSpacing: 2,
    marginBottom: 16,
  },

  // Hero comparison
  heroComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroPhotoPanel: {
    flex: 1,
    height: 240,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  heroPhoto: {
    width: '100%',
    height: '100%',
  },
  heroDayBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 7,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  heroDayBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroArrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#CCFF00',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  daysApart: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 20,
    letterSpacing: 0.5,
    fontFamily: 'Inter-Black',
  },
  daysApartSub: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    marginTop: 6,
    fontStyle: 'italic',
  },

  // Evidence entry
  evidenceBlock: {
    marginTop: 28,
    backgroundColor: '#191919',
    borderRadius: 12,
    padding: 18,
  },
  evidenceLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#CCFF00',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  evidenceText: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 22,
    color: 'rgba(255,255,255,0.6)',
  },

  // Timeline
  timelineSection: {
    marginTop: 36,
  },
  timelineSub: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 20,
  },
  timelineList: {
    paddingRight: 24,
    gap: 12,
  },
  timelineTile: {
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  timelineTileSelected: {
    borderColor: '#CCFF00',
  },
  timelineTileLatest: {
    borderColor: 'rgba(204,255,0,0.25)',
  },
  timelinePhoto: {
    width: '100%',
    height: '100%',
  },
  timelineDayBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingVertical: 6,
    alignItems: 'center',
  },
  timelineDayText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  timelineDayTextSelected: {
    color: '#CCFF00',
  },
  latestDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CCFF00',
  },

  // Full-screen photo viewer
  fullPhotoOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullPhotoImage: {
    width: '92%',
    height: '72%',
  },
  fullPhotoHeader: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    left: 0,
    right: 0,
    gap: 24,
  },
  fullPhotoDayLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  fullPhotoNavBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullPhotoClose: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
