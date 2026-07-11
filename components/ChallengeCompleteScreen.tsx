import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Text as SvgText, Defs, Filter, FeGaussianBlur } from 'react-native-svg';
import { Share2, ChevronRight } from 'lucide-react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { Goal } from '@/types/database';
import { useTheme } from '@/contexts/ThemeContext';
import Confetti from './Confetti';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const LIME = '#CCFF00';
const LIME_DARK = '#aed900';

interface ChallengeCompleteScreenProps {
  goal: Goal;
  totalDaysLogged: number;
  bestStreak: number;
  onKeepGoing: () => void;
}

export default function ChallengeCompleteScreen({
  goal,
  totalDaysLogged,
  bestStreak,
  onKeepGoing,
}: ChallengeCompleteScreenProps) {
  const { colors } = useTheme();
  const shareCardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);

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

  const handleKeepGoing = async () => {
    try {
      await supabase
        .from('goals')
        .update({ celebration_seen: true })
        .eq('id', goal.id);
    } catch (error) {
      console.error('Error marking celebration seen:', error);
    }
    onKeepGoing();
  };

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

  const identityLines: string[] = [];
  if (goal.identity_dimensions && goal.identity_dimensions.length > 0) {
    goal.identity_dimensions.forEach((dim: Record<string, any>) => {
      if (dim.specific) identityLines.push(dim.specific);
      else if (dim.label) identityLines.push(dim.label);
    });
  } else if (goal.identity_statement) {
    identityLines.push(goal.identity_statement);
  }

  const showRestarts = (goal.total_restarts ?? 0) > 0;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#000000', '#0A0A0A', '#000000']}
        style={styles.gradient}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
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
              colors={['#0A0A0A', '#111111']}
              style={styles.shareCardInner}
            >
              <Text style={styles.shareCardBrand}>COMPOUND TO GREATNESS</Text>
              <Text style={styles.shareCardTagline}>77-DAY CHALLENGE COMPLETE</Text>

              <View style={styles.shareCardDivider} />

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

              <View style={styles.shareCardStats}>
                <View style={styles.shareCardStat}>
                  <Text style={styles.shareCardStatValue}>77</Text>
                  <Text style={styles.shareCardStatLabel}>DAYS{'\n'}COMPLETED</Text>
                </View>
                <View style={styles.shareCardStatDivider} />
                <View style={styles.shareCardStat}>
                  <Text style={styles.shareCardStatValue}>{bestStreak}</Text>
                  <Text style={styles.shareCardStatLabel}>BEST{'\n'}STREAK</Text>
                </View>
                {showRestarts && (
                  <>
                    <View style={styles.shareCardStatDivider} />
                    <View style={styles.shareCardStat}>
                      <Text style={styles.shareCardStatValue}>{goal.total_restarts}</Text>
                      <Text style={styles.shareCardStatLabel}>TOTAL{'\n'}RESTARTS</Text>
                    </View>
                  </>
                )}
              </View>

              <View style={styles.shareCardDivider} />
              <Text style={styles.shareCardFooter}>Keep going.</Text>
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

          {/* KEEP GOING */}
          <TouchableOpacity style={styles.keepGoingButton} onPress={handleKeepGoing}>
            <LinearGradient
              colors={[LIME, LIME_DARK]}
              style={styles.keepGoingGradient}
            >
              <Text style={styles.keepGoingText}>Keep Going</Text>
              <ChevronRight size={24} color="#000000" strokeWidth={3} />
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>

      {showConfetti && (
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

/* ─── Day Shield (matches the app's day-badge motif) ─── */

function DayShield({ day, size }: { day: number; size: number }) {
  const shieldPath = 'M55 4 L100 20 L100 58 C100 80 80 97 55 108 C30 97 10 80 10 58 L10 20 Z';
  const innerRing1 = 'M55 12 L92 26 L92 58 C92 76 74 91 55 101 C36 91 18 76 18 58 L18 26 Z';
  const innerRing2 = 'M55 20 L84 32 L84 58 C84 73 68 86 55 95 C42 86 26 73 26 58 L26 32 Z';
  const viewBox = '0 0 110 115';
  const scale = size / 110;

  return (
    <View style={styles.shieldWrapper}>
      {/* Glow */}
      <Svg
        width={size * 1.6}
        height={size * 1.6}
        viewBox={viewBox}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <Filter id="shield-glow" x="-50%" y="-50%" width="200%" height="200%">
            <FeGaussianBlur stdDeviation={6} />
          </Filter>
        </Defs>
        <Path d={shieldPath} fill={LIME} filter="url(#shield-glow)" opacity={0.35} />
      </Svg>
      {/* Shield */}
      <Svg width={size} height={size * 1.05} viewBox={viewBox}>
        <Path d={shieldPath} fill="#161616" stroke={LIME} strokeWidth={2.5} />
        <Path d={innerRing1} fill="none" stroke={LIME} strokeWidth={1} opacity={0.4} />
        <Path d={innerRing2} fill="none" stroke={LIME} strokeWidth={1} opacity={0.2} />
        <SvgText x="55" y="44" textAnchor="middle" fontSize={9} fontWeight="700" fill={LIME} letterSpacing={2} fontFamily="Inter-Black">
          DAY
        </SvgText>
        <SvgText x="55" y="74" textAnchor="middle" fontSize={30} fontWeight="900" fill="#ffffff" fontFamily="Inter-Black">
          {day}
        </SvgText>
      </Svg>
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
  shareCard: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.2)',
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
  identityContainer: {
    width: '100%',
    gap: 6,
  },
  identityLine: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
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
  shareCardFooter: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter-Black',
  },
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
    marginBottom: 12,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter-Black',
  },
  keepGoingButton: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
  },
  keepGoingGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  keepGoingText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
    fontFamily: 'Inter-Black',
    letterSpacing: -0.5,
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
