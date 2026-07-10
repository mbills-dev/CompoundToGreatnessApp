import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Compass, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface CompassCardProps {
  declaration: string;
  filterQuestion: string;
  onLockedInteraction?: () => void;
}

export default function CompassCard({ declaration, filterQuestion, onLockedInteraction }: CompassCardProps) {
  const { colors, isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const modalOpacity = useSharedValue(0);
  const modalScale = useSharedValue(0.9);

  const openModal = () => {
    if (onLockedInteraction) { onLockedInteraction(); return; }
    setModalVisible(true);
    modalOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
    modalScale.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.2)) });
  };

  const closeModal = () => {
    if (onLockedInteraction) { onLockedInteraction(); return; }
    modalOpacity.value = withTiming(0, { duration: 200 });
    modalScale.value = withTiming(0.9, { duration: 200 });
    setTimeout(() => setModalVisible(false), 220);
  };

  const modalContentStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
    transform: [{ scale: modalScale.value }],
  }));

  return (
    <>
      <TouchableOpacity
        style={[styles.card, {
          borderColor: isDark ? colors.primary : colors.border,
          backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
        }]}
        onPress={openModal}
        activeOpacity={0.8}
      >
        <View style={styles.cardContent}>
          <View style={[styles.iconContainer, {
            backgroundColor: isDark ? colors.primary + '20' : '#000000',
          }]}>
            <Compass size={20} color={isDark ? colors.primary : '#ccff00'} strokeWidth={2.5} />
          </View>
          <View style={styles.textContent}>
            <Text style={[styles.cardLabel, { color: isDark ? colors.primary : '#808080' }]}>MY COMPASS</Text>
            <Text style={[styles.filterText, { color: colors.text }]} numberOfLines={1}>
              {filterQuestion}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, modalContentStyle]}>
            <View style={[styles.modalInner, {
              backgroundColor: isDark ? colors.backgroundTertiary : '#FFFFFF',
              borderColor: isDark ? colors.border : '#E5E5E5',
            }]}>
              <View style={styles.modalHeader}>
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalIcon}
                >
                  <Compass size={28} color="#000000" strokeWidth={2.5} />
                </LinearGradient>
                <TouchableOpacity
                  style={[styles.closeButton, {
                    backgroundColor: isDark ? colors.backgroundSecondary : '#F0F0F0',
                  }]}
                  onPress={closeModal}
                >
                  <X size={20} color={colors.textSecondary} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalTitle, { color: colors.text }]}>Your Compass</Text>

              {!!declaration && (
                <View style={[styles.declarationBox, {
                  borderColor: isDark ? colors.primary : '#1A1A1A',
                  backgroundColor: isDark ? 'transparent' : '#1A1A1A',
                }]}>
                  <Text style={[styles.boxLabel, { color: isDark ? colors.primary : '#ccff00' }]}>MY DECLARATION</Text>
                  <Text style={[styles.declarationText, { color: isDark ? colors.text : '#FFFFFF' }]}>{declaration}</Text>
                </View>
              )}

              <View style={[styles.filterBox, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                borderColor: isDark ? '#2A2A2A' : '#E0E0E0',
              }]}>
                <Text style={[styles.boxLabel, { color: colors.textTertiary }]}>MY FILTER</Text>
                <Text style={[styles.filterQuestion, { color: isDark ? colors.primary : '#000000' }]}>
                  "{filterQuestion}"
                </Text>
              </View>

              <Text style={[styles.reminder, { color: colors.textTertiary }]}>
                When you're unsure, come back here.
              </Text>

              <TouchableOpacity
                style={styles.doneButton}
                onPress={closeModal}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.doneButtonGradient}
                >
                  <Text style={styles.doneButtonText}>Got It</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 24,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContent: {
    flex: 1,
    gap: 2,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  filterText: {
    fontSize: 15,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
  },
  modalInner: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
    gap: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  declarationBox: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 20,
    gap: 8,
  },
  boxLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  declarationText: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 26,
  },
  filterBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 8,
  },
  filterQuestion: {
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 28,
    fontStyle: 'italic',
  },
  reminder: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  doneButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  doneButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
  },
});
