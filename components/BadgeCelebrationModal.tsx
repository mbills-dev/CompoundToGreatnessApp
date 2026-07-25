import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import {
  Flag,
  Zap,
  TrendingUp,
  Star,
  Shield,
  Layers,
  Trophy,
  Flame,
  Target,
  Heart,
  Users,
  Camera,
  Sunrise,
  Calendar,
  ClipboardCheck,
  BookOpen,
  CalendarCheck,
  Eye,
  Megaphone,
  UserPlus,
  PenTool,
  Award,
  type LucideIcon,
} from 'lucide-react-native';
import Confetti from '@/components/Confetti';

const ICON_MAP: Record<string, LucideIcon> = {
  flag: Flag,
  zap: Zap,
  'trending-up': TrendingUp,
  star: Star,
  shield: Shield,
  layers: Layers,
  trophy: Trophy,
  flame: Flame,
  target: Target,
  heart: Heart,
  users: Users,
  camera: Camera,
  sunrise: Sunrise,
  calendar: Calendar,
  'clipboard-check': ClipboardCheck,
  'book-open': BookOpen,
  'calendar-check': CalendarCheck,
  eye: Eye,
  megaphone: Megaphone,
  'user-plus': UserPlus,
  'pen-tool': PenTool,
  award: Award,
};

function getReadableTextColor(hex: string): string {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? '#0A0A0A' : '#FFFFFF';
}

interface BadgeCelebrationModalProps {
  badge: {
    key: string;
    title: string;
    description: string;
    icon: string;
    color: string;
  };
  onDone: () => void;
}

export default function BadgeCelebrationModal({ badge, onDone }: BadgeCelebrationModalProps) {
  const cardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);
  const { width, height } = useWindowDimensions();

  const textColor = getReadableTextColor(badge.color);
  const IconComponent = ICON_MAP[badge.icon] || Award;
  const iconSize = Math.min(width, height) * 0.28;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }, 0)
    );
    timers.push(
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }, 150)
    );
    timers.push(
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }, 300)
    );
    timers.push(
      setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }, 450)
    );
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  const handleShare = async () => {
    if (!cardRef.current) return;
    try {
      setIsSharing(true);
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
      });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          dialogTitle: 'Share your badge!',
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device.');
      }
    } catch (error) {
      console.error('Error sharing badge:', error);
      Alert.alert('Error', 'Failed to share. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      <View ref={cardRef} collapsable={false} style={[StyleSheet.absoluteFill, { backgroundColor: badge.color }]}>
        <Confetti count={60} />

        <View style={styles.content}>
          <View style={styles.badgeWrap}>
            <IconComponent
              size={iconSize}
              color={textColor}
              strokeWidth={1.75}
              absoluteStrokeWidth={false}
            />
          </View>

          <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
            {badge.title}
          </Text>
          <Text style={[styles.description, { color: textColor }]} numberOfLines={3}>
            {badge.description}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onDone}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={[styles.closeButton, { borderColor: textColor }]}
          activeOpacity={0.6}
        >
          <Text style={[styles.closeText, { color: textColor }]}>Close</Text>
        </TouchableOpacity>

        {Platform.OS !== 'web' && (
          <TouchableOpacity
            style={[styles.shareButton, { borderColor: textColor }]}
            onPress={handleShare}
            disabled={isSharing}
            activeOpacity={0.6}
          >
            <Text style={[styles.shareText, { color: textColor }]}>
              {isSharing ? 'Sharing…' : 'Share'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  badgeWrap: {
    marginBottom: 24,
  },
  title: {
    fontFamily: 'Inter-Black',
    fontSize: 38,
    lineHeight: 46,
    textAlign: 'center',
  },
  description: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
    marginTop: 12,
    opacity: 0.85,
  },
  closeButton: {
    position: 'absolute',
    bottom: 64,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderWidth: 1.5,
    borderRadius: 999,
    alignSelf: 'center',
  },
  closeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
  shareButton: {
    position: 'absolute',
    bottom: 64,
    right: 32,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1.5,
    borderRadius: 999,
  },
  shareText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
});
