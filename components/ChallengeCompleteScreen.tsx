import React, { useRef, useState } from 'react';
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
import { Award, Share2, ChevronRight, Flame, Star, Trophy } from 'lucide-react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { supabase } from '@/lib/supabase';
import { Goal } from '@/types/database';
import { useTheme } from '@/contexts/ThemeContext';
import { ConfettiAnimation } from './ConfettiAnimation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const { colors, isDark } = useTheme();
  const shareCardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);

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

      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.download = `77-day-challenge-complete.png`;
        link.href = uri;
        link.click();
      } else {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            dialogTitle: 'Share your 77-Day Challenge completion!',
          });
        } else {
          Alert.alert('Error', 'Sharing is not available on this device.');
        }
      }
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'Failed to share. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

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
          <View style={styles.heroSection}>
            <View style={styles.trophyRing}>
              <Trophy size={56} color="#ccff00" strokeWidth={1.5} />
            </View>

            <Text style={styles.headline}>77 Days.</Text>
            <Text style={[styles.headline, { color: '#ccff00' }]}>Done.</Text>

            <Text style={[styles.goalTitle, { color: colors.textSecondary }]}>
              {goal.title}
            </Text>
          </View>

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

              <Text style={styles.shareCardGoal} numberOfLines={3}>
                {goal.title}
              </Text>

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
                <View style={styles.shareCardStatDivider} />
                <View style={styles.shareCardStat}>
                  <Text style={styles.shareCardStatValue}>{totalDaysLogged}</Text>
                  <Text style={styles.shareCardStatLabel}>TOTAL{'\n'}LOGGED</Text>
                </View>
              </View>

              <View style={styles.shareCardDivider} />
              <Text style={styles.shareCardFooter}>🔥 Keep going.</Text>
            </LinearGradient>
          </View>

          <View style={styles.statsSection}>
            <View style={[styles.statRow, { borderColor: colors.border }]}>
              <View style={styles.statRowLeft}>
                <Flame size={22} color="#ccff00" strokeWidth={2} />
                <Text style={[styles.statRowLabel, { color: colors.textSecondary }]}>Best Streak</Text>
              </View>
              <Text style={styles.statRowValue}>{bestStreak} days</Text>
            </View>

            <View style={[styles.statRow, { borderColor: colors.border }]}>
              <View style={styles.statRowLeft}>
                <Star size={22} color="#ccff00" strokeWidth={2} />
                <Text style={[styles.statRowLabel, { color: colors.textSecondary }]}>Total Days Logged</Text>
              </View>
              <Text style={styles.statRowValue}>{totalDaysLogged}</Text>
            </View>

            <View style={[styles.statRow, { borderColor: colors.border }]}>
              <View style={styles.statRowLeft}>
                <Award size={22} color="#ccff00" strokeWidth={2} />
                <Text style={[styles.statRowLabel, { color: colors.textSecondary }]}>Days Completed</Text>
              </View>
              <Text style={styles.statRowValue}>77</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            disabled={isSharing}
          >
            <Share2 size={20} color="#000000" strokeWidth={2.5} />
            <Text style={styles.shareButtonText}>Share Your Achievement</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.keepGoingButton} onPress={handleKeepGoing}>
            <LinearGradient
              colors={['#ccff00', '#aed900']}
              style={styles.keepGoingGradient}
            >
              <Text style={styles.keepGoingText}>Keep Going</Text>
              <ChevronRight size={24} color="#000000" strokeWidth={3} />
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>

      {showConfetti && (
        <ConfettiAnimation onComplete={() => setShowConfetti(false)} />
      )}
    </View>
  );
}

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
    paddingTop: 80,
    paddingBottom: 60,
    alignItems: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  trophyRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: '#ccff00',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  headline: {
    fontSize: 72,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -3,
    lineHeight: 76,
    textAlign: 'center',
    fontFamily: 'Inter-Black',
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  shareCard: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.2)',
  },
  shareCardInner: {
    padding: 32,
    alignItems: 'center',
  },
  shareCardBrand: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.5,
    color: '#ccff00',
    marginBottom: 6,
    fontFamily: 'Inter-Black',
  },
  shareCardTagline: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 20,
  },
  shareCardDivider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 20,
  },
  shareCardGoal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 28,
    fontFamily: 'Inter-Bold',
  },
  shareCardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    width: '100%',
    marginTop: 8,
  },
  shareCardStat: {
    flex: 1,
    alignItems: 'center',
  },
  shareCardStatValue: {
    fontSize: 40,
    fontWeight: '900',
    color: '#ccff00',
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
  },
  shareCardStatDivider: {
    width: 1,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  shareCardFooter: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
  },
  statsSection: {
    width: '100%',
    marginBottom: 32,
    gap: 2,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  statRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statRowLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  statRowValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
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
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 16,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
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
    paddingVertical: 20,
    gap: 8,
  },
  keepGoingText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
    fontFamily: 'Inter-Black',
    letterSpacing: -0.5,
  },
});
