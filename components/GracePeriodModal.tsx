import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface GracePeriodModalProps {
  visible: boolean;
  daysMissed: number;
  /** 'grace' = one-day choice modal; 'reset' = forced restart acknowledgment */
  mode?: 'grace' | 'reset';
  onKeepGoing: () => void;
  onStartOver: () => void;
}

export default function GracePeriodModal({
  visible,
  daysMissed,
  mode = 'grace',
  onKeepGoing,
  onStartOver,
}: GracePeriodModalProps) {
  const { colors, isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 20,
          stiffness: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.92);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const isReset = mode === 'reset';

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#111111' : '#FFFFFF',
              borderColor: isDark ? '#2A2A2A' : '#E5E5E5',
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>
            {isReset ? 'Day 1.' : 'Did yesterday happen?'}
          </Text>

          <Text style={[styles.body, { color: isDark ? '#B0B0B0' : '#404040' }]}>
            {isReset
              ? "You missed more than a day. That's okay — the challenge only works because missing it costs something. Start again."
              : "You didn't log your inputs yesterday. If you did the work and just forgot to log it, say so — it counts. If you missed it, the rule is the rule."}
          </Text>

          {isReset ? (
            <TouchableOpacity
              style={[styles.keepGoingButton, { backgroundColor: colors.primary }]}
              onPress={onStartOver}
              activeOpacity={0.8}
            >
              <Text style={styles.keepGoingText}>Start Day 1</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[
                  styles.startOverButton,
                  {
                    borderColor: isDark ? '#3A3A3A' : '#E0E0DB',
                    backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
                  },
                ]}
                onPress={onStartOver}
                activeOpacity={0.75}
              >
                <Text style={[styles.startOverText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                  I missed it — restart me
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.keepGoingButton, { backgroundColor: colors.primary }]}
                onPress={onKeepGoing}
                activeOpacity={0.8}
              >
                <Text style={styles.keepGoingText}>I did the work — log it</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 16,
    lineHeight: 34,
  },
  body: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 26,
    marginBottom: 32,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  startOverButton: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startOverText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  keepGoingButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepGoingText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.2,
  },
});
