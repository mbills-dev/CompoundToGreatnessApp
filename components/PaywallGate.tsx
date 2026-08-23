import React, { useEffect, useMemo, useState } from 'react';
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
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { Crown, Check, Zap, Shield, ChartBar as BarChart3, Users } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Confetti from '@/components/Confetti';

interface PaywallGateProps {
  onDismiss: () => void;
  onSubscribeSuccess?: () => void;
  celebrate?: boolean;
}

const FEATURES = [
  { icon: Zap, title: 'Full 77-Day Challenge', description: 'Track every day with detailed progress monitoring' },
  { icon: BarChart3, title: 'Progress Analytics', description: 'Streak tracking, calendar view, and completion stats' },
  { icon: Shield, title: 'Accountability Features', description: 'Evidence logs, watchers, and friend encouragements' },
  { icon: Users, title: 'Skool Community', description: 'Hours of free training, accountability, and a community that keeps you locked in' },
];

interface PurchaseError {
  userCancelled?: boolean;
  message?: string;
}

export default function PaywallGate({ onDismiss, onSubscribeSuccess, celebrate = false }: PaywallGateProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { refreshSubscription } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [showConfetti, setShowConfetti] = useState(celebrate);
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
  const [yearlyPackage, setYearlyPackage] = useState<PurchasesPackage | null>(null);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!celebrate || Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const t1 = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 150);
    const t2 = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [celebrate]);

  useEffect(() => {
    let mounted = true;
    const loadOfferings = async () => {
      if (Platform.OS !== 'ios') {
        if (mounted) {
          setFeedback('Subscriptions are available on iPhone and iPad.');
          setLoadingOfferings(false);
        }
        return;
      }

      try {
        const offerings = await Purchases.getOfferings();
        const offering = offerings.all.default ?? offerings.current;
        if (!offering) throw new Error('No subscription offering is currently available.');

        if (mounted) {
          setMonthlyPackage(offering.monthly ?? null);
          setYearlyPackage(offering.annual ?? null);
          if (!offering.monthly && !offering.annual) {
            setFeedback('No subscription plans are currently available.');
          }
        }
      } catch (error) {
        if (mounted) {
          const purchaseError = error as PurchaseError;
          setFeedback(purchaseError.message || 'Unable to load subscription plans. Please try again.');
        }
      } finally {
        if (mounted) setLoadingOfferings(false);
      }
    };

    loadOfferings();
    return () => { mounted = false; };
  }, []);

  const selectedPackage = useMemo(
    () => selectedPlan === 'monthly' ? monthlyPackage : yearlyPackage,
    [monthlyPackage, selectedPlan, yearlyPackage]
  );

  const handleSubscribe = async () => {
    if (!selectedPackage || processing || Platform.OS !== 'ios') return;
    setFeedback(null);
    setProcessing(true);

    try {
      const { customerInfo } = await Purchases.purchasePackage(selectedPackage);
      if (!customerInfo.entitlements.active['premium']) {
        setFeedback('The purchase completed, but premium access is not active yet. Please restore purchases or contact support.');
        return;
      }

      await refreshSubscription();
      onSubscribeSuccess?.();
    } catch (error) {
      const purchaseError = error as PurchaseError;
      if (!purchaseError.userCancelled) {
        setFeedback(purchaseError.message || 'The purchase could not be completed. Please try again.');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleRestore = async () => {
    if (processing || Platform.OS !== 'ios') return;
    setFeedback(null);
    setProcessing(true);

    try {
      const customerInfo = await Purchases.restorePurchases();
      if (!customerInfo.entitlements.active['premium']) {
        setFeedback('No active purchases were found for this Apple ID.');
        return;
      }

      await refreshSubscription();
      setFeedback('Your premium access has been restored.');
      onSubscribeSuccess?.();
    } catch (error) {
      const purchaseError = error as PurchaseError;
      setFeedback(purchaseError.message || 'Purchases could not be restored. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      {showConfetti && (
        <View style={styles.confettiOverlay} pointerEvents="none">
          <Confetti count={90} onDone={() => setShowConfetti(false)} />
        </View>
      )}
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.crownBadge}>
            <Crown size={32} color="#000000" strokeWidth={2.5} />
          </LinearGradient>
          <Text style={[styles.title, { color: colors.text }]}>Ready to Start{ '\n' }Your Challenge?</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>You've set up your identity and daily inputs. Unlock the full 77-day challenge to start tracking your progress.</Text>
        </View>

        <View style={styles.features}>
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <View key={index} style={[styles.featureRow, { backgroundColor: colors.background, borderColor: colors.primary }]}>
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
          <TouchableOpacity onPress={() => setSelectedPlan('monthly')} activeOpacity={0.85} style={[styles.planCard, { backgroundColor: colors.background, borderColor: selectedPlan === 'monthly' ? colors.primary : isDark ? colors.border : '#D0D0D0', borderWidth: selectedPlan === 'monthly' ? 2 : 1.5 }]}>
            <View style={styles.planHeader}>
              <Text style={[styles.planLabel, { color: colors.text }]}>Monthly</Text>
              {selectedPlan === 'monthly' && <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}><Text style={styles.selectedBadgeText}>Selected</Text></View>}
            </View>
            <Text style={[styles.price, { color: colors.text }]}>{monthlyPackage?.product.priceString ?? '—'}<Text style={[styles.pricePeriod, { color: colors.textSecondary }]}>/month</Text></Text>
            <Text style={[styles.priceNote, { color: colors.textTertiary }]}>Cancel anytime. Less than a coffee a week.</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setSelectedPlan('yearly')} activeOpacity={0.85} style={[styles.planCard, { backgroundColor: colors.background, borderColor: selectedPlan === 'yearly' ? colors.primary : isDark ? colors.border : '#D0D0D0', borderWidth: selectedPlan === 'yearly' ? 2 : 1.5 }]}>
            <View style={styles.planHeader}>
              <Text style={[styles.planLabel, { color: colors.text }]}>Yearly</Text>
              <View style={[styles.savingsBadge, { borderColor: colors.primary }]}><Text style={[styles.savingsBadgeText, { color: colors.primary }]}>Save 25%</Text></View>
            </View>
            <Text style={[styles.price, { color: colors.text }]}>{yearlyPackage?.product.priceString ?? '—'}<Text style={[styles.pricePeriod, { color: colors.textSecondary }]}>/year</Text></Text>
            <Text style={[styles.priceNote, { color: colors.textTertiary }]}>Billed once a year. Best value.</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.checksContainer, { borderColor: isDark ? '#222' : '#E0E0E0' }]}>
          {['Unlimited challenge restarts', 'Full progress history', 'Social accountability'].map((item, i) => (
            <View key={i} style={styles.priceCheckRow}><Check size={16} color={colors.primary} strokeWidth={3} /><Text style={[styles.priceCheckText, { color: colors.textSecondary }]}>{item}</Text></View>
          ))}
        </View>

        {feedback && <Text style={[styles.feedback, { color: feedback.includes('restored') ? colors.primary : colors.error }]}>{feedback}</Text>}

        <TouchableOpacity style={[styles.subscribeButton, { backgroundColor: colors.primary, opacity: loadingOfferings || processing || !selectedPackage ? 0.5 : 1 }]} onPress={handleSubscribe} disabled={loadingOfferings || processing || !selectedPackage} activeOpacity={0.9}>
          <Text style={styles.subscribeText}>{processing ? 'Please wait…' : loadingOfferings ? 'Loading plans…' : 'Start My Challenge'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.restoreButton} onPress={handleRestore} disabled={processing}>
          <Text style={[styles.restoreText, { color: colors.textSecondary }]}>Restore Purchases</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <Text style={[styles.dismissText, { color: colors.textTertiary }]}>Not yet, I'll keep exploring</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  confettiOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 100, pointerEvents: 'none' },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 80 },
  header: { alignItems: 'center', marginBottom: 36 },
  crownBadge: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 32, fontWeight: '900', textAlign: 'center', lineHeight: 38, marginBottom: 12, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, fontWeight: '500', textAlign: 'center', lineHeight: 24, paddingHorizontal: 16 },
  features: { gap: 12, marginBottom: 32 },
  featureRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1.5, gap: 14 },
  featureIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  featureDescription: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  plansContainer: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  planCard: { flex: 1, padding: 16, borderRadius: 16 },
  planHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  planLabel: { fontSize: 15, fontWeight: '700' },
  selectedBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  selectedBadgeText: { fontSize: 11, fontWeight: '700', color: '#000' },
  savingsBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1.5 },
  savingsBadgeText: { fontSize: 11, fontWeight: '700' },
  price: { fontSize: 30, fontWeight: '900', letterSpacing: -1, marginBottom: 4 },
  pricePeriod: { fontSize: 14, fontWeight: '600', letterSpacing: 0, marginLeft: 2 },
  priceNote: { fontSize: 11, fontWeight: '500', lineHeight: 15 },
  checksContainer: { gap: 10, marginBottom: 24, paddingTop: 16, borderTopWidth: 1 },
  priceCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceCheckText: { fontSize: 14, fontWeight: '500' },
  feedback: { fontSize: 13, fontWeight: '600', lineHeight: 19, textAlign: 'center', marginBottom: 16 },
  subscribeButton: { borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginBottom: 8 },
  subscribeText: { fontSize: 17, fontWeight: '800', color: '#000000', letterSpacing: 0.3 },
  restoreButton: { alignItems: 'center', paddingVertical: 12 },
  restoreText: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  dismissButton: { alignItems: 'center', paddingVertical: 12, marginBottom: 32 },
  dismissText: { fontSize: 15, fontWeight: '500' },
});
