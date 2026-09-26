import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
  Share as RNShare,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { Plus, Camera, Check, X, Share2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressPhoto, Goal } from '@/types/database';
import { useProofPhotos } from '@/hooks/useProofPhotos';
import ProofCaptureFlow from './ProofCaptureFlow';

const LIME = '#CCFF00';

interface ProofTodayModuleProps {
  challengeDay: number;
  goals: Goal[];
}

export default function ProofTodayModule({ challengeDay, goals }: ProofTodayModuleProps) {
  const insets = useSafeAreaInsets();
  const { photos, loading, refresh } = useProofPhotos(challengeDay);
  const [showFlow, setShowFlow] = useState(false);
  const [showTodaySheet, setShowTodaySheet] = useState(false);

  const defaultGoalId = goals.length === 1 ? goals[0].id : (goals[0]?.id ?? null);

  const handleSaved = () => {
    refresh();
  };

  const goalTitleFor = (goalId: string | null): string => {
    if (!goalId) return 'General progress';
    const g = goals.find((goal) => goal.id === goalId);
    return g?.title ?? 'General progress';
  };

  const handleSharePhoto = async (photo: ProgressPhoto) => {
    try {
      if (Platform.OS === 'web') {
        return;
      }
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(photo.storage_url, {
          mimeType: 'image/jpeg',
          dialogTitle: 'Share your proof',
        });
      } else {
        await RNShare.share({ url: photo.storage_url });
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={LIME} />
        </View>
      </View>
    );
  }

  const todaysPhotos = photos.filter((p) => p.challenge_day === challengeDay);
  const hasProofToday = todaysPhotos.length > 0;

  if (!hasProofToday) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.emptyModule}
          onPress={() => setShowFlow(true)}
          activeOpacity={0.8}
        >
          <View style={styles.emptyLeft}>
            <View style={styles.emptyIcon}>
              <Camera size={18} color={LIME} strokeWidth={2} />
            </View>
            <View>
              <Text style={styles.emptyTitle}>CAPTURE THE PROOF</Text>
              <Text style={styles.emptySub}>Document today's progress.</Text>
            </View>
          </View>
          <View style={styles.addBtn}>
            <Plus size={18} color="#000000" strokeWidth={2.5} />
            <Text style={styles.addBtnText}>ADD</Text>
          </View>
        </TouchableOpacity>

        <ProofCaptureFlow
          visible={showFlow}
          onClose={() => setShowFlow(false)}
          challengeDay={challengeDay}
          goals={goals}
          defaultGoalId={defaultGoalId}
          onSaved={handleSaved}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.capturedModule}
        onPress={() => setShowTodaySheet(true)}
        activeOpacity={0.8}
      >
        <View style={styles.capturedHeader}>
          <View style={styles.capturedHeaderLeft}>
            <View style={styles.capturedCheckIcon}>
              <Check size={12} color="#000000" strokeWidth={3} />
            </View>
            <Text style={styles.capturedTitle}>PROOF CAPTURED TODAY</Text>
          </View>
          <Text style={styles.capturedCount}>
            {todaysPhotos.length} {todaysPhotos.length === 1 ? 'item' : 'items'}
          </Text>
        </View>

        <View style={styles.capturedRow}>
          <View style={styles.thumbnailStack}>
            {todaysPhotos.slice(0, 4).map((photo, i) => (
              <View
                key={photo.id}
                style={[
                  styles.thumbnail,
                  { marginLeft: i > 0 ? -8 : 0, zIndex: 10 - i },
                ]}
              >
                <Image
                  source={{ uri: photo.storage_url }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                />
              </View>
            ))}
            {todaysPhotos.length > 4 && (
              <View style={[styles.thumbnail, { marginLeft: -8, zIndex: 5 }]}>
                <View style={styles.thumbnailOverflow}>
                  <Text style={styles.thumbnailOverflowText}>+{todaysPhotos.length - 4}</Text>
                </View>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.addMoreBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              setShowFlow(true);
            }}
            activeOpacity={0.8}
          >
            <Plus size={16} color={LIME} strokeWidth={2.5} />
            <Text style={styles.addMoreText}>ADD MORE</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Today's Proof bottom sheet */}
      <Modal
        visible={showTodaySheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTodaySheet(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setShowTodaySheet(false)}
            activeOpacity={1}
          />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>TODAY'S PROOF</Text>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setShowTodaySheet(false)}
                activeOpacity={0.6}
              >
                <X size={20} color="rgba(255,255,255,0.5)" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetSub}>DAY {challengeDay} · {todaysPhotos.length} {todaysPhotos.length === 1 ? 'item' : 'items'}</Text>

            <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
              {todaysPhotos.map((photo) => (
                <View key={photo.id} style={styles.sheetItem}>
                  <Image
                    source={{ uri: photo.storage_url }}
                    style={styles.sheetItemImage}
                    resizeMode="cover"
                  />
                  <View style={styles.sheetItemInfo}>
                    <Text style={styles.sheetItemGoal}>{goalTitleFor(photo.goal_id)}</Text>
                    {photo.note ? (
                      <Text style={styles.sheetItemNote}>{photo.note}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={styles.sheetItemShare}
                    onPress={() => handleSharePhoto(photo)}
                    activeOpacity={0.7}
                  >
                    <Share2 size={16} color="rgba(255,255,255,0.4)" strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.sheetAddBtn}
              onPress={() => {
                setShowTodaySheet(false);
                setShowFlow(true);
              }}
              activeOpacity={0.85}
            >
              <Plus size={18} color="#000000" strokeWidth={2.5} />
              <Text style={styles.sheetAddBtnText}>ADD MORE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ProofCaptureFlow
        visible={showFlow}
        onClose={() => setShowFlow(false)}
        challengeDay={challengeDay}
        goals={goals}
        defaultGoalId={defaultGoalId}
        onSaved={handleSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
  },
  loadingRow: {
    paddingVertical: 16,
    alignItems: 'center',
  },

  // Empty state
  emptyModule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#191919',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  emptyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(204,255,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    fontFamily: 'Inter-Bold',
  },
  emptySub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LIME,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
    fontFamily: 'Inter-Bold',
  },

  // Captured state
  capturedModule: {
    backgroundColor: '#191919',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(204,255,0,0.15)',
  },
  capturedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  capturedHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  capturedCheckIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: LIME,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capturedTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    fontFamily: 'Inter-Bold',
  },
  capturedCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter-Regular',
  },
  capturedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  thumbnailStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#191919',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailOverflow: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailOverflowText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  addMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: LIME,
    fontFamily: 'Inter-Bold',
  },

  // Today's Proof sheet
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    maxHeight: '85%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    fontFamily: 'Inter-Black',
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSub: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.5,
    fontFamily: 'Inter-Bold',
    marginBottom: 20,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#191919',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  sheetItemImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  sheetItemInfo: {
    flex: 1,
  },
  sheetItemGoal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 2,
  },
  sheetItemNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter-Regular',
  },
  sheetItemShare: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LIME,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 16,
  },
  sheetAddBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
    fontFamily: 'Inter-Black',
  },
});
