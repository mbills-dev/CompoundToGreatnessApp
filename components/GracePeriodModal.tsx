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
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 22,
          stiffness: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.94);
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
              backgroundColor: colors.backgroundSecondary,
              borderColor: `${colors.primary}28`,
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>
            {isReset ? 'Day 1.' : 'WHAT HAPPENED?'}
          </Text>

          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {isReset
              ? "More than a day missed. Start again — that's the deal you signed."
              : 'No log yesterday. If you did the work and forgot, it counts.'}
          </Text>

          {isReset ? (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={onStartOver}
              activeOpacity={0.82}
            >
              <Text style={styles.primaryButtonText}>Start Day 1</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.buttonStack}>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={onKeepGoing}
                activeOpacity={0.82}
              >
                <Text style={styles.primaryButtonText}>I Completed Yesterday</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  { backgroundColor: colors.backgroundTertiary },
                ]}
                onPress={onStartOver}
                activeOpacity={0.75}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                  I Failed
                </Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    padding: 28,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 14,
    lineHeight: 36,
  },
  body: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 26,
    marginBottom: 28,
  },
  buttonStack: {
    gap: 12,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.1,
  },
  secondaryButton: {
    width: '100%',
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
