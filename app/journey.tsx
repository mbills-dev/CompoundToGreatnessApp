import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useGoalBundle } from '@/hooks/useGoalBundle';
import { useAllProofPhotos } from '@/hooks/useProofPhotos';
import { getChallengeRunId } from '@/lib/challengeRun';
import { getDayNumberFromChallengeStart, toLocalDateString } from '@/lib/dateHelpers';
import JourneyStory from '@/components/journey/JourneyStory';
import ProofCaptureFlow from '@/components/ProofCaptureFlow';

/**
 * YOUR JOURNEY — the canonical proof viewer for the ACTIVE challenge run.
 * Every Journey entry point (Today, Progress, day cards, keep-going banner)
 * navigates here. Later phases add modes (Then → Now) to this same screen.
 */
export default function JourneyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { goal, activities, isLoading: goalLoading } = useGoalBundle(user?.id);

  const challengeRunId = goal ? getChallengeRunId(goal) : null;
  const { photos, loading: photosLoading, refresh } = useAllProofPhotos(challengeRunId);
  const [showCapture, setShowCapture] = useState(false);

  const loading = goalLoading || (!!goal && photosLoading);
  // Same day computation as Today (DailyDashboard), so first proof lands on
  // the right Challenge Day.
  const challengeDay = goal?.challenge_start_date
    ? getDayNumberFromChallengeStart(goal.challenge_start_date, toLocalDateString(new Date()))
    : 1;
  const inputs = [...activities].sort((a, b) => a.order_position - b.order_position);
  const canCapture = !!goal?.challenge_start_date;

  const handleClose = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleClose}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={26} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>YOUR JOURNEY</Text>
          <Text style={styles.subtitle}>The proof of who you're becoming.</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <JourneyStory
        photos={photos}
        loading={loading}
        onTakeFirstProof={canCapture ? () => setShowCapture(true) : undefined}
      />

      {goal && (
        <ProofCaptureFlow
          visible={showCapture}
          onClose={() => setShowCapture(false)}
          challengeDay={challengeDay}
          goalId={goal.id}
          inputs={inputs}
          challengeRunId={challengeRunId}
          onSaved={refresh}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 14,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'Inter-Black',
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter-Regular',
  },
});
