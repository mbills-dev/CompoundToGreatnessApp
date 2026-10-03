import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useGoalBundle } from '@/hooks/useGoalBundle';
import { useAllProofPhotos } from '@/hooks/useProofPhotos';
import { getChallengeRunId } from '@/lib/challengeRun';
import { getDayNumberFromChallengeStart, toLocalDateString } from '@/lib/dateHelpers';
import JourneyStory from '@/components/journey/JourneyStory';
import ProofCaptureFlow from '@/components/ProofCaptureFlow';
import ProofIconButton from '@/components/proof/ProofIconButton';

/**
 * YOUR JOURNEY — the canonical proof viewer for the ACTIVE challenge run.
 * Every Journey entry point (Today, Progress, day cards, keep-going banner)
 * navigates here. Later phases add modes (Then → Now) to this same screen.
 */
export default function JourneyScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Arriving from YOUR PROOF uses no push animation (see app/_layout.tsx);
  // once here, back/close uses the standard transition for every entry point.
  useEffect(() => {
    navigation.setOptions({ animation: 'default' });
  }, [navigation]);
  const { user } = useAuth();
  const { goal, activities, isLoading: goalLoading } = useGoalBundle(user?.id);

  const challengeRunId = goal ? getChallengeRunId(goal) : null;
  const { photos, loading: photosLoading, refresh } = useAllProofPhotos(challengeRunId);
  const [showCapture, setShowCapture] = useState(false);
  // Measured so the Story's top scrim always covers the header, whatever it
  // contains (e.g. a future STORY | THEN → NOW selector).
  const [headerHeight, setHeaderHeight] = useState(0);

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
      <JourneyStory
        photos={photos}
        loading={loading}
        headerHeight={headerHeight}
        onTakeFirstProof={canCapture ? () => setShowCapture(true) : undefined}
      />

      {/* Journey identity, overlaid on the photographic canvas. A future
          STORY | THEN → NOW selector belongs below the title row, inside this
          header; the measured height keeps the scrim under it. */}
      <View
        style={[styles.header, { paddingTop: insets.top + 12 }]}
        pointerEvents="box-none"
        onLayout={(e) => setHeaderHeight(Math.ceil(e.nativeEvent.layout.height))}
      >
        <View style={styles.headerRow} pointerEvents="box-none">
          <View style={styles.headerText} pointerEvents="none">
            <Text style={styles.title}>YOUR JOURNEY</Text>
            <Text style={styles.subtitle}>The proof of who you're becoming.</Text>
          </View>
          <ProofIconButton onPress={handleClose} activeOpacity={0.6} accessibilityLabel="Close Journey">
            <X size={20} color="#FFFFFF" strokeWidth={2.5} />
          </ProofIconButton>
        </View>
      </View>

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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'Inter-Black',
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Inter-Regular',
  },
});
