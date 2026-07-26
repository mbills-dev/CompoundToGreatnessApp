import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Award } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, type ThemeColors } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBadgeCelebration } from '@/contexts/BadgeCelebrationContext';
import { supabase } from '@/lib/supabase';
import { ICON_MAP } from '@/lib/badgeIcons';

interface BadgeRow {
  key: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  image_url: string | null;
  category: string;
}

const CATEGORY_ORDER = ['milestone', 'streak', 'lifetime', 'consistency', 'social', 'resilience'];

const CATEGORY_LABELS: Record<string, string> = {
  milestone: 'MILESTONES',
  streak: 'STREAKS',
  lifetime: 'LIFETIME',
  consistency: 'CONSISTENCY',
  social: 'SOCIAL',
  resilience: 'RESILIENCE',
};

export default function BadgesScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { celebrateBadge } = useBadgeCelebration();

  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [earnedKeys, setEarnedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadBadges = useCallback(async () => {
    if (!user) return;
    try {
      const [badgesRes, earnedRes] = await Promise.all([
        supabase
          .from('badges')
          .select('key, title, description, icon, color, image_url, category')
          .order('key', { ascending: true }),
        supabase
          .from('user_badges')
          .select('badge_key')
          .eq('user_id', user.id),
      ]);

      if (badgesRes.error) throw badgesRes.error;
      if (earnedRes.error) throw earnedRes.error;

      setBadges((badgesRes.data || []) as BadgeRow[]);
      setEarnedKeys(new Set((earnedRes.data || []).map((b) => b.badge_key)));
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadBadges();
  }, [loadBadges]);

  const APP_MAX_WIDTH = 480;
  const effectiveWidth = Math.min(windowWidth, APP_MAX_WIDTH);
  const GRID_COLS = 4;
  const GRID_GAP = 12;
  const HORIZONTAL_PADDING = 16;
  const containerWidth = effectiveWidth - HORIZONTAL_PADDING * 2;
  const tileSize = Math.floor((containerWidth - (GRID_COLS - 1) * GRID_GAP) / GRID_COLS);

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: badges.filter((b) => b.category === category),
  })).filter((g) => g.items.length > 0);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <ChevronLeft size={24} color={colors.text} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Badges</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Badges</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {grouped.map((group) => (
          <View key={group.category} style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
              {CATEGORY_LABELS[group.category] || group.category.toUpperCase()}
            </Text>
            <View style={styles.grid}>
              {group.items.map((badge) => {
                const earned = earnedKeys.has(badge.key);
                return (
                  <BadgeTile
                    key={badge.key}
                    badge={badge}
                    earned={earned}
                    tileSize={tileSize}
                    colors={colors}
                    onPress={earned ? () => celebrateBadge(badge.key) : undefined}
                  />
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

interface BadgeTileProps {
  badge: BadgeRow;
  earned: boolean;
  tileSize: number;
  colors: ThemeColors;
  onPress?: () => void;
}

function BadgeTile({ badge, earned, tileSize, colors, onPress }: BadgeTileProps) {
  const IconComp = ICON_MAP[badge.icon] || Award;
  const accentColor = badge.color || colors.primary;
  const tileContent = (
    <>
      {badge.image_url ? (
        <Image
          source={{ uri: badge.image_url }}
          style={[
            styles.tileImage,
            {
              width: tileSize * 0.55,
              height: tileSize * 0.55,
            },
            !earned && styles.tileImageLocked,
          ]}
          resizeMode="contain"
        />
      ) : (
        <IconComp
          size={tileSize * 0.42}
          color={earned ? accentColor : colors.textTertiary}
          strokeWidth={2}
        />
      )}
      <Text
        style={[
          styles.tileTitle,
          { color: earned ? colors.text : colors.textTertiary },
        ]}
        numberOfLines={2}
      >
        {badge.title}
      </Text>
      {!earned && (
        <Text
          style={[
            styles.tileHint,
            { color: colors.textTertiary },
          ]}
          numberOfLines={3}
        >
          {badge.description}
        </Text>
      )}
    </>
  );

  if (earned && onPress) {
    return (
      <TouchableOpacity
        style={[
          styles.tile,
          {
            width: tileSize,
            backgroundColor: colors.backgroundSecondary,
            borderColor: earned ? accentColor : colors.border,
          },
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {tileContent}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        styles.tile,
        {
          width: tileSize,
          backgroundColor: colors.backgroundSecondary,
          borderColor: colors.border,
        },
        !earned && styles.tileLocked,
      ]}
    >
      {tileContent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: 'Inter-Black',
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 140,
  },
  tileImage: {
    marginBottom: 8,
  },
  tileImageLocked: {
    tintColor: 'gray',
  },
  tileLocked: {
    opacity: 0.5,
  },
  tileTitle: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
    textAlign: 'center',
    lineHeight: 13,
    marginTop: 8,
  },
  tileHint: {
    fontSize: 10,
    fontWeight: '400',
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    lineHeight: 12,
    marginTop: 4,
  },
});
