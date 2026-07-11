import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Text as SvgText, Defs, RadialGradient, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { Share2, ChevronRight } from 'lucide-react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { Goal, DailyActivity } from '@/types/database';
import { resetChallenge } from '@/lib/resetHelpers';
import { archiveCurrentChallenge } from '@/lib/archiveHelpers';
import { useTheme } from '@/contexts/ThemeContext';
import Confetti from './Confetti';

const LIME = '#CCFF00';
const LIME_DARK = '#aed900';

// In-memory flag: once the user has seen the wall via the celebration
// flow, re-openings start on the 'choose' step. Resets on app restart.
let wallPeeked = false;

type CelebrationStep = 'celebration' | 'choose';

interface ChallengeCompleteScreenProps {
  goal: Goal;
  activities: DailyActivity[];
  onKeepGoing: () => void;
  onRunItAgain: () => void;
  onStartFresh: () => void;
  onSeeWall: () => void;
}

export default function ChallengeCompleteScreen({
  goal,
  activities,
  onKeepGoing,
  onRunItAgain,
  onStartFresh,
  onSeeWall,
}: ChallengeCompleteScreenProps) {
  const { colors } = useTheme();
  const shareCardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<CelebrationStep>(
    wallPeeked ? 'choose' : 'celebration',
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const fireHaptics = async () => {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 400);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 800);
      } catch {}
    };
    fireHaptics();
  }, []);

  // ── Keep Going ──
  // This is the ONLY path that sets celebration_seen = true.
  const handleKeepGoing = async () => {
    try {
      await supabase
        .from('goals')
        .update({ celebration_seen: true })
        .eq('id', goal.id);
    } catch (error) {
      console.error('Error marking celebration seen:', error);
    }
    wallPeeked = false;
    onKeepGoing();
  };

  // ── Share ──
  const handleShare = async () => {
    if (!shareCardRef.current) return;
    try {
      setIsSharing(true);
      const uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
      });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          dialogTitle: 'Share your 77-Day Challenge completion!',
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device.');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'Failed to share. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  // ── Run It Again ──
  // Does NOT set celebration_seen.
  const handleRunItAgain = () => {
    Alert.alert(
      'Run It Again?',
      'Same inputs. Same identity. Day 1 starts now.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run It Again',
          style: 'default',
          onPress: async () => {
            setBusy(true);
            try {
              await resetChallenge(goal, supabase, 'completed');
              wallPeeked = false;
              onRunItAgain();
            } catch (error) {
              console.error('Error running it again:', error);
              Alert.alert('Error', 'Something went wrong. Please try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  // ── Start Fresh ──
  // Does NOT set celebration_seen.
  const handleStartFresh = () => {
    Alert.alert(
      'Start Fresh?',
      'This archives your challenge and starts onboarding over.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Fresh',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await archiveCurrentChallenge(goal, supabase, 'completed');
              await supabase
                .from('daily_activities')
                .delete()
                .eq('goal_id', goal.id);
              await supabase
                .from('goals')
                .update({ is_active: false })
                .eq('id', goal.id);
              wallPeeked = false;
              onStartFresh();
            } catch (error) {
              console.error('Error starting fresh:', error);
              Alert.alert('Error', 'Something went wrong. Please try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  // ── See Wall ──
  // Dismisses WITHOUT setting celebration_seen.
  const handleSeeWall = () => {
    wallPeeked = true;
    onSeeWall();
  };

  // Identity statements
  const identityLines: string[] = [];
  if (goal.identity_statement) {
    goal.identity_statement
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .forEach((l) => identityLines.push(l));
  }

  const activityCount = activities.length;
  const promisesKept = activityCount * 77;

  // ── STEP: CELEBRATION ──
  const renderCelebration = () => (
    <>
      {/* HERO: Day shield */}
      <View style={styles.heroSection}>
        <DayShield day={77} size={140} />
        <Text style={styles.headline}>77 Days.</Text>
        <Text style={[styles.headline, { color: LIME }]}>Done.</Text>
      </View>

      {/* SHARE CARD */}
      <View
        ref={shareCardRef}
        style={styles.shareCard}
        collapsable={false}
      >
        <LinearGradient
          colors={[colors.backgroundSecondary, colors.backgroundSecondary]}
          style={styles.shareCardInner}
        >
          <Text style={styles.shareCardBrand}>COMPOUND TO GREATNESS</Text>
          <Text style={styles.shareCardTagline}>77-DAY CHALLENGE COMPLETE</Text>

          <View style={styles.shareCardDivider} />

          <Text style={styles.eyebrow}>THE IDENTITY</Text>
          {identityLines.length > 0 && (
            <View style={styles.identityContainer}>
              {identityLines.map((line, i) => (
                <Text key={i} style={styles.identityLine}>
                  {line}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.shareCardDivider} />

          <Text style={styles.eyebrow}>THE RECEIPTS</Text>
          <View style={styles.shareCardStats}>
            <View style={styles.shareCardStat}>
              <Text style={styles.shareCardStatValue}>77</Text>
              <Text style={styles.shareCardStatLabel}>DAYS{'\n'}COMPLETED</Text>
            </View>
            <View style={styles.shareCardStatDivider} />
            <View style={styles.shareCardStat}>
              <Text style={styles.shareCardStatValue}>{activityCount}</Text>
              <Text style={styles.shareCardStatLabel}>DAILY{'\n'}INPUTS</Text>
            </View>
            <View style={styles.shareCardStatDivider} />
            <View style={styles.shareCardStat}>
              <Text style={styles.shareCardStatValue}>{promisesKept}</Text>
              <Text style={styles.shareCardStatLabel}>PROMISES{'\n'}KEPT</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* SHARE BUTTON — native only */}
      {Platform.OS !== 'web' && (
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShare}
          disabled={isSharing}
        >
          <Share2 size={20} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.shareButtonText}>Share Your Achievement</Text>
        </TouchableOpacity>
      )}

      {/* PRIMARY CTA: SEE YOUR WALL */}
      <TouchableOpacity
        style={styles.seeWallButton}
        onPress={handleSeeWall}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[LIME, LIME_DARK]}
          style={styles.seeWallGradient}
        >
          <Text style={styles.seeWallButtonText}>SEE YOUR WALL →</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* QUIET LINK: Choose what's next */}
      <TouchableOpacity
        style={styles.chooseNextLink}
        onPress={() => setStep('choose')}
        activeOpacity={0.6}
      >
        <Text style={styles.chooseNextText}>Choose what's next</Text>
      </TouchableOpacity>
    </>
  );

  // ── STEP: CHOOSE ──
  const renderChoose = () => (
    <>
      {/* COMPACT HEADER */}
      <View style={styles.chooseHeader}>
        <Text style={styles.eyebrow}>77 DAYS COMPLETE</Text>
        <Text style={styles.chooseTitle}>What's next?</Text>
      </View>

      {/* THREE EQUAL-WEIGHT OPTION CARDS */}
      <View style={styles.optionCardsContainer}>
        {/* 1. Keep Going */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={handleKeepGoing}
          disabled={busy}
          activeOpacity={0.7}
        >
          <View style={styles.optionCardHeader}>
            <Text style={styles.optionCardTitle}>Keep Going</Text>
            <ChevronRight size={20} color={LIME} strokeWidth={2.5} />
          </View>
          <Text style={styles.optionCardDescription}>
            The challenge ends. The inputs don't. Stack days past 77 — no restart rule.
          </Text>
        </TouchableOpacity>

        {/* 2. Run It Again */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={handleRunItAgain}
          disabled={busy}
          activeOpacity={0.7}
        >
          <View style={styles.optionCardHeader}>
            <Text style={styles.optionCardTitle}>Run It Again</Text>
            <ChevronRight size={20} color={LIME} strokeWidth={2.5} />
          </View>
          <Text style={styles.optionCardDescription}>
            Another 77. Same inputs, same covenant — miss a day, start over.
          </Text>
        </TouchableOpacity>

        {/* 3. Start Fresh */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={handleStartFresh}
          disabled={busy}
          activeOpacity={0.7}
        >
          <View style={styles.optionCardHeader}>
            <Text style={styles.optionCardTitle}>Start Fresh</Text>
            <ChevronRight size={20} color={LIME} strokeWidth={2.5} />
          </View>
          <Text style={styles.optionCardDescription}>
            New goals. Back through the full build, from vague target to daily number.
          </Text>
        </TouchableOpacity>
      </View>

      {/* SEE WALL AGAIN LINK */}
      <TouchableOpacity
        style={styles.chooseNextLink}
        onPress={handleSeeWall}
        activeOpacity={0.6}
      >
        <Text style={styles.chooseNextText}>See your wall again →</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#000000', '#0A0A0A', '#000000']}
        style={styles.gradient}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            step === 'choose' && { paddingTop: 100 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {step === 'celebration' ? renderCelebration() : renderChoose()}
        </ScrollView>
      </LinearGradient>

      {showConfetti && step === 'celebration' && (
        <View style={styles.confettiOverlay} pointerEvents="none">
          <Confetti
            count={120}
            fallDurationMin={10000}
            fallDurationMax={12000}
            onDone={() => setShowConfetti(false)}
          />
        </View>
      )}
    </View>
  );
}

/* ─── Day Shield ─── */

function DayShield({ day, size }: { day: number; size: number }) {
  const shieldPath = 'M55 4 L100 20 L100 58 C100 80 80 97 55 108 C30 97 10 80 10 58 L10 20 Z';
  const innerRing1 = 'M55 12 L92 26 L92 58 C92 76 74 91 55 101 C36 91 18 76 18 58 L18 26 Z';
  const innerRing2 = 'M55 20 L84 32 L84 58 C84 73 68 86 55 95 C42 86 26 73 26 58 L26 32 Z';
  const viewBox = '0 0 110 115';
  const glowSize = size * 1.6;

  const sway = useRef(new Animated.Value(-1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const swayLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sway, {
          toValue: -1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    swayLoop.start();
    glowLoop.start();
    return () => {
      swayLoop.stop();
      glowLoop.stop();
    };
  }, [sway, glow]);

  const rotateY = sway.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-15deg', '15deg'],
  });
  const rotateZ = sway.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-2deg', '2deg'],
  });
  const edgeShift = sway.interpolate({
    inputRange: [-1, 1],
    outputRange: [7, -7],
  });
  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });
  const glowScale = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });

  return (
    <View style={styles.shieldWrapper}>
      <Animated.View
        style={[StyleSheet.absoluteFill, {
          opacity: glowOpacity,
          transform: [{ scale: glowScale }],
        }]}
        pointerEvents="none"
      >
        <Svg
          width={glowSize}
          height={glowSize}
          viewBox="0 0 110 115"
          style={{
            position: 'absolute',
            top: (size - glowSize) / 2,
            left: (size - glowSize) / 2,
          }}
        >
          <Defs>
            <RadialGradient id="shield-radial" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={LIME} stopOpacity={0.55} />
              <Stop offset="35%" stopColor={LIME} stopOpacity={0.32} />
              <Stop offset="70%" stopColor={LIME} stopOpacity={0.12} />
              <Stop offset="100%" stopColor={LIME} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="110" height="115" fill="url(#shield-radial)" />
        </Svg>
      </Animated.View>
      <Animated.View
        style={{
          transform: [
            { perspective: 800 },
            { rotateY },
            { rotateZ },
          ],
        }}
      >
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            transform: [{ translateX: edgeShift }],
          }}
        >
          <Svg width={size} height={size * 1.05} viewBox={viewBox}>
            <Path d={shieldPath} fill="#080808" stroke={LIME} strokeWidth={2.5} strokeOpacity={0.5} />
          </Svg>
        </Animated.View>
        <Svg width={size} height={size * 1.05} viewBox={viewBox}>
          <Defs>
            <SvgLinearGradient id="shield-face" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#222222" />
              <Stop offset="100%" stopColor="#0D0D0D" />
            </SvgLinearGradient>
          </Defs>
          <Path d={shieldPath} fill="url(#shield-face)" stroke={LIME} strokeWidth={2.5} />
          <Path d={innerRing1} fill="none" stroke={LIME} strokeWidth={1} opacity={0.4} />
          <Path d={innerRing2} fill="none" stroke={LIME} strokeWidth={1} opacity={0.2} />
          <SvgText x="55" y="44" textAnchor="middle" fontSize={9} fontWeight="700" fill={LIME} letterSpacing={2} fontFamily="Inter-Black">
            DAY
          </SvgText>
          <SvgText x="55" y="74" textAnchor="middle" fontSize={30} fontWeight="900" fill="#ffffff" fontFamily="Inter-Black">
            {day}
          </SvgText>
        </Svg>
      </Animated.View>
    </View>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  gradient: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  // ── Celebration step ──
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  shieldWrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  headline: {
    fontSize: 64,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -2.5,
    lineHeight: 68,
    textAlign: 'center',
    fontFamily: 'Inter-Black',
  },
  // ── Share card ──
  shareCard: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.15)',
  },
  shareCardInner: {
    padding: 28,
    alignItems: 'center',
  },
  shareCardBrand: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.5,
    color: LIME,
    marginBottom: 6,
    fontFamily: 'Inter-Black',
  },
  shareCardTagline: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 16,
    fontFamily: 'Inter-Black',
  },
  shareCardDivider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 16,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: LIME,
    marginBottom: 12,
    marginTop: 4,
    fontFamily: 'Inter-Black',
  },
  identityContainer: {
    width: '100%',
    gap: 6,
  },
  identityLine: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Inter-Black',
  },
  shareCardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  shareCardStat: {
    flex: 1,
    alignItems: 'center',
  },
  shareCardStatValue: {
    fontSize: 36,
    fontWeight: '900',
    color: LIME,
    fontFamily: 'Inter-Black',
    marginBottom: 4,
  },
  shareCardStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
    textAlign: 'center',
    lineHeight: 14,
    fontFamily: 'Inter-Black',
  },
  shareCardStatDivider: {
    width: 1,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  // ── Share button ──
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 20,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter-Black',
  },
  // ── See Wall button (primary CTA) ──
  seeWallButton: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
  },
  seeWallGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  seeWallButtonText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
    fontFamily: 'Inter-Black',
    letterSpacing: 0.5,
  },
  // ── Quiet links ──
  chooseNextLink: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  chooseNextText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter-Black',
  },
  // ── Choose step ──
  chooseHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  chooseTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'Inter-Black',
    letterSpacing: -1,
    textAlign: 'center',
  },
  // ── Option cards ──
  optionCardsContainer: {
    width: '100%',
    gap: 12,
  },
  optionCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(204,255,0,0.35)',
    borderRadius: 16,
    padding: 18,
  },
  optionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  optionCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter-Black',
    letterSpacing: -0.3,
  },
  optionCardDescription: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 19,
    fontFamily: 'Inter-Black',
  },
  confettiOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
});
