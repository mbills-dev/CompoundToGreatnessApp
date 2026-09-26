import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Plus, Camera, Check } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ProgressPhoto, Goal } from '@/types/database';
import { useProofPhotos } from '@/hooks/useProofPhotos';
import ProofCaptureFlow from './ProofCaptureFlow';

interface ProofTodayModuleProps {
  challengeDay: number;
  goals: Goal[];
}

export default function ProofTodayModule({ challengeDay, goals }: ProofTodayModuleProps) {
  const { user } = useAuth();
  const { photos, loading, refresh } = useProofPhotos(challengeDay);
  const [showFlow, setShowFlow] = useState(false);

  const defaultGoalId = goals.length === 1 ? goals[0].id : (goals[0]?.id ?? null);

  const handleSaved = () => {
    refresh();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#CCFF00" />
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
              <Camera size={18} color="#CCFF00" strokeWidth={2} />
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
      <View style={styles.capturedModule}>
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
            onPress={() => setShowFlow(true)}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#CCFF00" strokeWidth={2.5} />
            <Text style={styles.addMoreText}>ADD MORE</Text>
          </TouchableOpacity>
        </View>
      </View>

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
    backgroundColor: '#CCFF00',
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
    backgroundColor: '#CCFF00',
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
    color: '#CCFF00',
    fontFamily: 'Inter-Bold',
  },
});
