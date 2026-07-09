import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Lock } from 'lucide-react-native';
import { Goal, DailyActivity } from '@/types/database';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  goal: Goal;
  activities: DailyActivity[];
  onUnlock: () => void;
}

export default function LockedDashboardPreview({ goal, activities, onUnlock }: Props) {
  const { colors, isDark } = useTheme();
  const { signOut } = useAuth();

  const identityLines = (goal.identity_statement ?? '').split('\n').filter(Boolean);

  const cardBg = isDark ? colors.backgroundSecondary : '#FAFAFA';
  const cardBorder = isDark ? colors.border : '#E8E8E8';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>77-DAY CHALLENGE</Text>
          <Text style={[styles.dayLabel, { color: colors.text }]}>DAY 1</Text>
        </View>

        {/* Identity card */}
        {identityLines.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>MY IDENTITY</Text>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.primary }]}>
              {identityLines.map((line, i) => (
                <Text
                  key={i}
                  style={[
                    styles.identityLine,
                    {
                      color: line.startsWith('"') ? colors.primary : colors.text,
                      fontStyle: line.startsWith('"') ? 'italic' : 'normal',
                      marginTop: i > 0 ? 8 : 0,
                    },
                  ]}
                >
                  {line}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Daily inputs */}
        {activities.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>YOUR DAILY INPUTS</Text>
            <View style={{ gap: 10 }}>
              {activities.map(activity => {
                const meta = [activity.when_time, activity.where_location]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <View
                    key={activity.id}
                    style={[styles.card, styles.activityCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
                  >
                    <View style={styles.activityLeft}>
                      <Text style={[styles.activityName, { color: colors.text }]}>
                        {activity.activity_name}
                      </Text>
                      {meta ? (
                        <Text style={[styles.activityMeta, { color: colors.textTertiary }]}>{meta}</Text>
                      ) : null}
                    </View>
                    <Lock size={18} color={colors.textTertiary} strokeWidth={2} />
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Bottom banner — outside ScrollView so it stays pinned */}
      <View style={[styles.banner, {
        backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
        borderTopColor: isDark ? '#2A2A2A' : '#E0E0E0',
        borderTopWidth: 1,
      }]}>
        <Text style={[styles.bannerTitle, { color: colors.text }]}>
          Your 77-day challenge is built and waiting.
        </Text>
        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
          onPress={onUnlock}
          activeOpacity={0.88}
        >
          <Text style={styles.ctaBtnText}>Start My Challenge</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={signOut} activeOpacity={0.7} style={styles.signOutBtn}>
          <Text style={[styles.signOutText, { color: colors.textTertiary }]}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 16,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  dayLabel: {
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 68,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
  },
  identityLine: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  activityLeft: {
    flex: 1,
    gap: 3,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  activityMeta: {
    fontSize: 13,
    fontWeight: '500',
  },
  banner: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 36,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
  },
  bannerTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
  },
  ctaBtn: {
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.2,
  },
  signOutBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  signOutText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
