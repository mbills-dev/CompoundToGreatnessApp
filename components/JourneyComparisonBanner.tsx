import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { ArrowRight, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isMilestoneDay } from '@/constants/milestones';
import { useJourneyComparison, JourneyPhoto } from '@/hooks/useJourneyComparison';

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
      />
    </>
  );
}

export interface ComparisonModalProps {
  visible: boolean;
  onClose: () => void;
  earliestPhoto: JourneyPhoto | null;
  latestPhoto: JourneyPhoto | null;
}

export function ComparisonModal({ visible, onClose, earliestPhoto, latestPhoto }: ComparisonModalProps) {
  if (!earliestPhoto || !latestPhoto) return null;
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const modalBg = isDark ? '#000000' : colors.background;
  const modalBorderColor = isDark ? '#1A1A1A' : colors.border;
  const modalTextPrimary = isDark ? '#FFFFFF' : colors.text;
  const modalTextMuted = isDark ? 'rgba(255,255,255,0.35)' : colors.textTertiary;
  const modalDayBadgeBg = isDark ? '#1A1A1A' : colors.backgroundSecondary;
  const modalDayBadgeTextColor = isDark ? '#FFFFFF' : colors.text;

  const isEarliestMilestone = isMilestoneDay(earliestPhoto.challenge_day) || earliestPhoto.is_milestone;
  const isLatestMilestone = isMilestoneDay(latestPhoto.challenge_day) || latestPhoto.is_milestone;

  const panelWidth = (SCREEN_WIDTH - 48 - 8) / 2;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent>
      <View style={[modalStyles.container, { backgroundColor: modalBg }]}>
        <View style={[modalStyles.topBar, { borderBottomColor: modalBorderColor, paddingTop: insets.top + 12 }]}>
          <Text style={[modalStyles.topBarTitle, { color: modalTextPrimary }]}>Your Journey</Text>
          <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn} activeOpacity={0.7}>
            <X size={18} color="rgba(255,255,255,0.6)" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={modalStyles.content} showsVerticalScrollIndicator={false}>
          <Text style={[modalStyles.sectionLabel, { color: modalTextMuted }]}>SIDE BY SIDE</Text>

          <View style={modalStyles.sideBySide}>
            <View style={[modalStyles.modalPhotoPanel, { width: panelWidth }]}>
              <Image
                source={{ uri: earliestPhoto.storage_url }}
                style={modalStyles.modalPhoto}
                resizeMode="cover"
              />
              <View style={modalStyles.modalOverlay}>
                <View style={[modalStyles.modalDayBadge, { backgroundColor: modalDayBadgeBg }, isEarliestMilestone && modalStyles.modalDayBadgeMilestone]}>
                  <Text style={[modalStyles.modalDayBadgeText, { color: modalDayBadgeTextColor }, isEarliestMilestone && modalStyles.modalDayBadgeTextMilestone]}>
                    DAY {earliestPhoto.challenge_day}
                  </Text>
                </View>
              </View>
            </View>

            <View style={[modalStyles.modalPhotoPanel, { width: panelWidth }]}>
              <Image
                source={{ uri: latestPhoto.storage_url }}
                style={modalStyles.modalPhoto}
                resizeMode="cover"
              />
              <View style={modalStyles.modalOverlay}>
                <View style={[modalStyles.modalDayBadge, { backgroundColor: modalDayBadgeBg }, isLatestMilestone && modalStyles.modalDayBadgeMilestone]}>
                  <Text style={[modalStyles.modalDayBadgeText, { color: modalDayBadgeTextColor }, isLatestMilestone && modalStyles.modalDayBadgeTextMilestone]}>
                    DAY {latestPhoto.challenge_day}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={[modalStyles.sectionLabel, { color: modalTextMuted }]}>EARLIEST</Text>
          <View style={modalStyles.fullPhotoPanel}>
            <Image
              source={{ uri: earliestPhoto.storage_url }}
              style={modalStyles.fullPhoto}
              resizeMode="cover"
            />
            <View style={modalStyles.fullOverlay}>
              <View style={[modalStyles.modalDayBadge, { backgroundColor: modalDayBadgeBg }, isEarliestMilestone && modalStyles.modalDayBadgeMilestone]}>
                <Text style={[modalStyles.modalDayBadgeText, { color: modalDayBadgeTextColor }, isEarliestMilestone && modalStyles.modalDayBadgeTextMilestone]}>
                  DAY {earliestPhoto.challenge_day}
                </Text>
              </View>
            </View>
          </View>

          <Text style={[modalStyles.sectionLabel, { color: modalTextMuted }]}>MOST RECENT</Text>
          <View style={modalStyles.fullPhotoPanel}>
            <Image
              source={{ uri: latestPhoto.storage_url }}
              style={modalStyles.fullPhoto}
              resizeMode="cover"
            />
            <View style={modalStyles.fullOverlay}>
              <View style={[modalStyles.modalDayBadge, { backgroundColor: modalDayBadgeBg }, isLatestMilestone && modalStyles.modalDayBadgeMilestone]}>
                <Text style={[modalStyles.modalDayBadgeText, { color: modalDayBadgeTextColor }, isLatestMilestone && modalStyles.modalDayBadgeTextMilestone]}>
                  DAY {latestPhoto.challenge_day}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
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
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 4,
  },
  sideBySide: {
    flexDirection: 'row',
    gap: 8,
  },
  modalPhotoPanel: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  modalPhoto: {
    width: '100%',
    height: '100%',
  },
  modalOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
  },
  fullPhotoPanel: {
    width: '100%',
    height: 320,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  fullPhoto: {
    width: '100%',
    height: '100%',
  },
  fullOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  modalDayBadge: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  modalDayBadgeMilestone: {
    backgroundColor: '#CCFF00',
    borderColor: '#CCFF00',
  },
  modalDayBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalDayBadgeTextMilestone: {
    color: '#1A1A1A',
  },
});
