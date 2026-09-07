import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

interface EncouragementToastProps {
  senderName?: string;
  senderPhotoUrl?: string;
  emoji: string;
  onComplete: () => void;
}

const SPRING_CONFIG = { damping: 18, stiffness: 200, mass: 0.8 };
const HOLD_MS = 2500;
const EXIT_MS = 400;

export default function EncouragementToast({
  senderName,
  senderPhotoUrl,
  emoji,
  onComplete,
}: EncouragementToastProps) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const translateX = useSharedValue(-400);
  const doneCalledRef = useRef(false);

  const displayName = senderName?.trim() || 'A friend';

  useEffect(() => {
    doneCalledRef.current = false;
    translateX.value = withSpring(0, SPRING_CONFIG);
    translateX.value = withDelay(
      HOLD_MS,
      withTiming(-400, { duration: EXIT_MS }, (finished) => {
        if (finished && !doneCalledRef.current) {
          doneCalledRef.current = true;
          runOnJS(onComplete)();
        }
      }),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const avatarFallback = displayName.charAt(0).toUpperCase();

  return (
    <Animated.View
      style={[
        styles.container,
        { bottom: insets.bottom + 80 },
        animatedStyle,
      ]}
      pointerEvents="none"
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? 'rgba(26,26,26,0.96)' : 'rgba(255,255,255,0.96)',
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
          },
        ]}
      >
        {senderPhotoUrl ? (
          <Image source={{ uri: senderPhotoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: '#FF4400' }]}>
            <Text style={styles.avatarFallbackText}>{avatarFallback}</Text>
          </View>
        )}
        <View style={styles.textContainer}>
          <Text
            style={[styles.name, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <Text
            style={[styles.message, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }]}
            numberOfLines={1}
          >
            cheered you on {emoji}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    zIndex: 9999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: 260,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  textContainer: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
  },
  message: {
    fontSize: 12,
    fontWeight: '500',
  },
});
