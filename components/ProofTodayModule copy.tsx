import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Plus, Camera, Check } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { DailyActivity } from '@/types/database';
import { useProofPhotos } from '@/hooks/useProofPhotos';
import ProofCaptureFlow from './ProofCaptureFlow';
import TodayProofViewer from './TodayProofViewer';

const LIME = '#CCFF00';

interface ProofTodayModuleProps {
  challengeDay: number;
  /** The active challenge goal (persisted as progress_photos.goal_id). */
  goalId: string;
  /** The active Success Stack inputs. */
  inputs: DailyActivity[];
  challengeRunId: string | null;
}

export default function ProofTodayModule({
  challengeDay,
  goalId,
  inputs,
  challengeRunId,
}: ProofTodayModuleProps) {
  const router = useRouter();
  const { photos, loading, refresh } = useProofPhotos(challengeDay, challengeRunId);
  const [showFlow, setShowFlow] = useState(false);
  const [showViewer, setShowViewer] = useState(false);

  const handleSaved = () => {
    refresh();
  };

  const todaysPhotos = photos.filter((p) => p.challenge_day === challengeDay);
  const hasProofToday = todaysPhotos.length > 0;

  // The capture flow and viewer are mounted once, outside the loading /
  // empty / captured branches, so a refresh after saving never unmounts the
  // flow mid-confirmation.
  return (
    <View style={styles.container}>
      {loading && photos.length === 0 ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={LIME} />
        </View>
      ) : !hasProofToday ? (
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
      ) : (
        <TouchableOpacity
          style={styles.capturedModule}
          onPress={() => setShowViewer(true)}
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
      )}

      <ProofCaptureFlow
        visible={showFlow}
        onClose={() => setShowFlow(false)}
        challengeDay={challengeDay}
        goalId={goalId}
        inputs={inputs}
        challengeRunId={challengeRunId}
        onSaved={handleSaved}
      />

      <TodayProofViewer
        visible={showViewer}
        onClose={() => setShowViewer(false)}
        challengeDay={challengeDay}
        photos={todaysPhotos}
        onAddAnother={() => setShowFlow(true)}
        onViewJourney={() => router.push('/(tabs)/calendar')}
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
});
