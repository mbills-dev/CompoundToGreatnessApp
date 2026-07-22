import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Crown, Check, Zap, Shield, ChartBar as BarChart3, Users } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Confetti from '@/components/Confetti';

interface PaywallGateProps {
  onDismiss: () => void;
  onSubscribeSuccess?: () => void;
  celebrate?: boolean;
}

const FEATURES = [
  {
    icon: Zap,
    title: 'Full 77-Day Challenge',
    description: 'Track every day with detailed progress monitoring',
  },
  {
    icon: BarChart3,
    title: 'Progress Analytics',
    description: 'Streak tracking, calendar view, and completion stats',
  },
  {
    icon: Shield,
    title: 'Accountability Features',
    description: 'Evidence logs, watchers, and friend encouragements',
  },
  {
    icon: Users,
    title: 'Skool Community',
    description: 'Hours of free training, accountability, and a community that keeps you locked in',
  },
];

export default function PaywallGate({ onDismiss, onSubscribeSuccess, celebrate = false }: PaywallGateProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [showConfetti, setShowConfetti] = useState(celebrate);

  useEffect(() => {
    if (!celebrate || Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const t1 = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 150);
    const t2 = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [celebrate]);

  const { refreshSubscription } = useAuth();

  const handleSubscribe = async () => {
    // TODO(PRE-LAUNCH BLOCKER): move this call inside the RevenueCat
    // purchase-success callback. As written, Start My Challenge activates
    // WITHOUT payment — acceptable for TestFlight only.
    await supabase.functions.invoke('activate-beta-subscription');
    await refreshSubscription();
    onSubscribeSuccess?.();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {showConfetti && (
        <View style={styles.confettiOverlay} pointerEvents="none">
          <Confetti count={90} onDone={() => setShowConfetti(false)} />
        </View>
      )}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.crownBadge}
          >
            <Crown size={32} color="#000000" strokeWidth={2.5} />
          </LinearGradient>
          <Text style={[styles.title, { color: colors.text }]}>
            Ready to Start{'\n'}Your Challenge?
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            You've set up your identity and daily inputs. Unlock the full 77-day challenge to start tracking your progress.
          </Text>
        </View>

        <View style={styles.features}>
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <View
                key={index}
                style={[styles.featureRow, { backgroundColor: colors.background, borderColor: colors.primary }]}
              >
                <View style={[styles.featureIcon, { backgroundColor: isDark ? 'rgba(189, 253, 0, 0.08)' : 'rgba(189, 253, 0, 0.12)' }]}>
                  <Icon size={22} color={colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.featureText}>
                  <Text style={[styles.featureTitle, { color: colors.text }]}>{feature.title}</Text>
                  <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>{feature.description}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.plansContainer}>
          <TouchableOpacity
            onPress={() => setSelectedPlan('monthly')}
            activeOpacity={0.85}
            style={[
              styles.planCard,
              {
                backgroundColor: colors.background,
                borderColor: selectedPlan === 'monthly' ? colors.primary : isDark ? colors.border : '#D0D0D0',
                borderWidth: selectedPlan === 'monthly' ? 2 : 1.5,
              },
            ]}
          >
            <View style={styles.planHeader}>
              <Text style={[styles.planLabel, { color: colors.text }]}>Monthly</Text>
              {selectedPlan === 'monthly' && (
                <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.selectedBadgeText}>Selected</Text>
                </View>
              )}
            </View>
            <View style={styles.priceRow}>
              <Text style={[styles.priceDollar, { color: colors.text }]}>$7</Text>
              <Text style={[styles.priceCents, { color: colors.text }]}>.99</Text>
              <Text style={[styles.pricePeriod, { color: colors.textSecondary }]}>/month</Text>
            </View>
            <Text style={[styles.priceNote, { color: colors.textTertiary }]}>
              Cancel anytime. Less than a coffee a week.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelectedPlan('yearly')}
            activeOpacity={0.85}
            style={[
              styles.planCard,
              {
                backgroundColor: colors.background,
                borderColor: selectedPlan === 'yearly' ? colors.primary : isDark ? colors.border : '#D0D0D0',
                borderWidth: selectedPlan === 'yearly' ? 2 : 1.5,
              },
            ]}
          >
            <View style={styles.planHeader}>
              <Text style={[styles.planLabel, { color: colors.text }]}>Yearly</Text>
              <View style={[styles.savingsBadge, { borderColor: colors.primary }]}>
                <Text style={[styles.savingsBadgeText, { color: colors.primary }]}>Save 25%</Text>
              </View>
            </View>
            <View style={styles.priceRow}>
              <Text style={[styles.priceDollar, { color: colors.text }]}>$77</Text>
              <Text style={[styles.priceCents, { color: colors.text }]}>.99</Text>
              <Text style={[styles.pricePeriod, { color: colors.textSecondary }]}>/year</Text>
            </View>
            <Text style={[styles.priceNote, { color: colors.textTertiary }]}>
              Billed once a year. Best value.
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.checksContainer, { borderColor: isDark ? '#222' : '#E0E0E0' }]}>
          {['Unlimited challenge restarts', 'Full progress history', 'Social accountability'].map((item, i) => (
            <View key={i} style={styles.priceCheckRow}>
              <Check size={16} color={colors.primary} strokeWidth={3} />
              <Text style={[styles.priceCheckText, { color: colors.textSecondary }]}>{item}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.subscribeButton, { backgroundColor: colors.primary }]}
          onPress={handleSubscribe}
          activeOpacity={0.9}
        >
          <Text style={styles.subscribeText}>Start My Challenge</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <Text style={[styles.dismissText, { color: colors.textTertiary }]}>
            Not yet, I'll keep exploring
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  confettiOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    pointerEvents: 'none',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 80,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  crownBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  features: {
    gap: 12,
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 14,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  plansContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  planCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  planLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  selectedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  selectedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
  },
  savingsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  savingsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  priceDollar: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
  },
  priceCents: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  pricePeriod: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 2,
  },
  priceNote: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  checksContainer: {
    gap: 10,
    marginBottom: 24,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  priceCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priceCheckText: {
    fontSize: 14,
    fontWeight: '500',
  },
  subscribeButton: {
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  subscribeText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.3,
  },
  dismissButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 32,
  },
  dismissText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
