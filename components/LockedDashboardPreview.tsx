import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Goal, DailyActivity } from '@/types/database';
import DailyDashboard from '@/components/DailyDashboard';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
  goal: Goal;
  activities: DailyActivity[];
  onUnlock: () => void;
}

export default function LockedDashboardPreview({ goal, activities, onUnlock }: Props) {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.root}>
      <View style={styles.preview} pointerEvents="none">
        <DailyDashboard
          goal={goal}
          activities={activities}
          onRefresh={() => {}}
        />
      </View>

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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  preview: {
    flex: 1,
  },
  banner: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 36,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
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
});
