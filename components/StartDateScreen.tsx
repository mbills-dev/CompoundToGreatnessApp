import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Calendar, ArrowRight, Zap } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toLocalDateString, getTodayDateString, parseLocalDate } from '@/lib/dateHelpers';

interface StartDateScreenProps {
  onSelect: (dateString: string) => void;
}

const LIME = '#CCFF00';

export default function StartDateScreen({ onSelect }: StartDateScreenProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const confirmAnim = useRef(new Animated.Value(0)).current;

  const today = new Date();
  const pills = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + (i + 1));
    const dateStr = toLocalDateString(d);
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = d.getDate();
    return { dateStr, weekday, dayNum, label: `${weekday} ${dayNum}` };
  });

  const selectedPill = pills.find((p) => p.dateStr === selectedDate) ?? null;
  const confirmLabel = selectedPill
    ? parseLocalDate(selectedPill.dateStr).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : '';

  useEffect(() => {
    Animated.spring(confirmAnim, {
      toValue: selectedDate ? 1 : 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
  }, [selectedDate]);

  const tap = (style: typeof Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(style);
  };

  const handleStartToday = () => {
    tap(Haptics.ImpactFeedbackStyle.Heavy);
    onSelect(getTodayDateString());
  };

  const handlePickPill = (dateStr: string) => {
    tap(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate((prev) => (prev === dateStr ? null : dateStr));
  };

  const handleConfirm = () => {
    if (!selectedDate) return;
    tap(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(selectedDate);
  };

  const cardBg = isDark ? '#0A0A0A' : colors.backgroundSecondary;
  const pillBg = isDark ? '#111111' : colors.card;
  const pillBorder = isDark ? '#222222' : colors.border;
  const mutedText = isDark ? 'rgba(255,255,255,0.5)' : colors.textTertiary;
  const secondaryText = isDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={isDark ? ['#000000', '#0A0A0A', '#000000'] : ['#F5F5F0', '#EBEBE6', '#F5F5F0']}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.iconCircle, { borderColor: 'rgba(204,255,0,0.3)' }]}>
            <Calendar size={32} color={LIME} strokeWidth={2} />
          </View>

          <Text style={[styles.eyebrow, { color: LIME }]}>SCHEDULE YOUR START</Text>
          <Text style={[styles.headline, { color: colors.text }]}>WHEN DOES DAY 1 BEGIN?</Text>
          <Text style={[styles.subtitle, { color: secondaryText }]}>
            Momentum loves now. But if you need time to set up, pick your date.
          </Text>

          <View
            style={[
              styles.card,
              { backgroundColor: cardBg, borderColor: isDark ? '#1F1F1F' : colors.border },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.cardBadge, { backgroundColor: 'rgba(204,255,0,0.12)' }]}>
                <Zap size={16} color={LIME} strokeWidth={2.5} />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Start right now</Text>
                <Text style={[styles.cardSub, { color: mutedText }]}>
                  Day 1 begins today. No prep needed.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.startTodayButton}
              onPress={handleStartToday}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={[LIME, '#aed900']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.startTodayGradient}
              >
                <Text style={styles.startTodayText}>START TODAY</Text>
                <ArrowRight size={20} color="#000000" strokeWidth={2.5} />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.orRow}>
            <View style={[styles.orLine, { backgroundColor: isDark ? '#1A1A1A' : colors.border }]} />
            <Text style={[styles.orText, { color: mutedText }]}>OR PICK A DAY</Text>
            <View style={[styles.orLine, { backgroundColor: isDark ? '#1A1A1A' : colors.border }]} />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsRow}
          >
            {pills.map((pill) => {
              const selected = pill.dateStr === selectedDate;
              return (
                <TouchableOpacity
                  key={pill.dateStr}
                  onPress={() => handlePickPill(pill.dateStr)}
                  activeOpacity={0.8}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: selected ? 'rgba(204,255,0,0.08)' : pillBg,
                      borderColor: selected ? LIME : pillBorder,
                    },
                  ]}
                >
                  <Text style={[styles.pillWeekday, { color: selected ? LIME : secondaryText }]}>
                    {pill.weekday}
                  </Text>
                  <Text style={[styles.pillDay, { color: selected ? LIME : colors.text }]}>
                    {pill.dayNum}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Animated.View
            style={[
              styles.confirmWrap,
              {
                opacity: confirmAnim,
                transform: [
                  {
                    translateY: confirmAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
            pointerEvents={selectedDate ? 'auto' : 'none'}
          >
            <TouchableOpacity onPress={handleConfirm} activeOpacity={0.88} disabled={!selectedDate}>
              <LinearGradient
                colors={[LIME, '#aed900']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.confirmGradient}
              >
                <Text style={styles.confirmText}>LOCK IN {confirmLabel}</Text>
                <ArrowRight size={20} color="#000000" strokeWidth={2.5} />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 28, paddingTop: 80, paddingBottom: 60 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(204,255,0,0.12)',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 28,
  },
  eyebrow: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 10,
  },
  headline: {
    fontFamily: 'Inter-Black',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 12,
    letterSpacing: -1,
  },
  subtitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    marginBottom: 28,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  cardBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: { flex: 1 },
  cardTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardSub: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  startTodayButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  startTodayGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  startTodayText: {
    fontFamily: 'Inter-Black',
    fontSize: 17,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  orLine: { flex: 1, height: 1 },
  orText: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  pillsRow: { gap: 10, paddingHorizontal: 2, paddingBottom: 4 },
  pill: {
    width: 64,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pillWeekday: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  pillDay: {
    fontFamily: 'Inter-Black',
    fontSize: 22,
    fontWeight: '900',
  },
  confirmWrap: {
    marginTop: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  confirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  confirmText: {
    fontFamily: 'Inter-Black',
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
});
