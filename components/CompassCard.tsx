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
import { Compass, X, ChevronRight, Check, Minus, Star } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface CompassCardProps {
  declaration: string;
  filterQuestion: string;
  onLockedInteraction?: () => void;
  compact?: boolean;
}

export default function CompassCard({ declaration, filterQuestion, onLockedInteraction, compact }: CompassCardProps) {
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
        style={[
          styles.card,
          compact && styles.compactCard,
          {
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
            backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
          }
        ]}
        onPress={openModal}
        activeOpacity={0.8}
      >
        <View style={[styles.cardContent, compact && styles.compactCardContent]}>
          <View style={[styles.iconContainer, compact && styles.compactIconContainer, {
            backgroundColor: isDark ? colors.primary + '20' : '#000000',
          }]}>
            <Compass size={compact ? 18 : 20} color={isDark ? colors.primary : '#ccff00'} strokeWidth={2.5} />
          </View>
          <View style={[styles.textContent, compact && styles.compactTextContent]}>
            <Text style={[styles.cardLabel, { color: isDark ? colors.primary : '#808080' }]} numberOfLines={1}>MY COMPASS</Text>
            <Text style={[styles.filterText, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
              {filterQuestion.length > 14 ? filterQuestion.slice(0, 14) + '...' : filterQuestion}
            </Text>
          </View>
          {compact && <ChevronRight size={16} color="rgba(255,255,255,0.3)" strokeWidth={2.5} />}
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
              backgroundColor: isDark ? '#121212' : '#1A1A1A',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.08)',
            }]}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={closeModal}
                activeOpacity={0.7}
              >
                <X size={18} color="rgba(255,255,255,0.4)" strokeWidth={2.5} />
              </TouchableOpacity>

              <View style={styles.modalTopArea}>
                <View style={styles.modalIconWrap}>
                  <Compass size={28} color="#CCFF00" strokeWidth={2.5} />
                </View>
                <Text style={styles.modalEyebrow}>MY COMPASS</Text>
              </View>

              <Text style={styles.heroQuestion}>
                {filterQuestion}
              </Text>

              <View style={styles.rulesContainer}>
                <View style={styles.ruleRow}>
                  <View style={styles.ruleIcon}>
                    <Check size={14} color="#000000" strokeWidth={3} />
                  </View>
                  <View style={styles.ruleTextBlock}>
                    <Text style={styles.rulePrimary}>
                      When the answer is YES
                    </Text>
                    <Text style={styles.ruleSecondary}>
                      {'\u2192'} <Text style={styles.ruleAccent}>Move.</Text>
                    </Text>
                  </View>
                </View>

                <View style={styles.ruleRow}>
                  <View style={styles.ruleIcon}>
                    <Minus size={14} color="#000000" strokeWidth={3} />
                  </View>
                  <View style={styles.ruleTextBlock}>
                    <Text style={styles.rulePrimary}>
                      When the answer is NO
                    </Text>
                    <Text style={styles.ruleSecondary}>
                      {'\u2192'} <Text style={styles.ruleAccent}>Let it go.</Text>
                    </Text>
                  </View>
                </View>

                <View style={styles.ruleRow}>
                  <View style={styles.ruleIcon}>
                    <Star size={14} color="#000000" strokeWidth={2.5} />
                  </View>
                  <View style={styles.ruleTextBlock}>
                    <Text style={styles.rulePrimary}>
                      Protect your attention.
                    </Text>
                    <Text style={styles.ruleSecondary}>
                      Focus on what compounds.
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.signature}>
                Better Inputs.{'\n'}A Greater You.
              </Text>
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
  compactCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 0,
    marginBottom: 0,
    height: 58,
    justifyContent: 'center',
  },
  compactCardContent: {
    gap: 6,
    alignItems: 'center',
  },
  compactIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  compactTextContent: {
    flex: 1,
    gap: 0,
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
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
    fontStyle: 'italic',
    lineHeight: 16,
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
    padding: 24,
    paddingTop: 14,
    paddingBottom: 20,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 0,
  },
  modalTopArea: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  modalIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#CCFF00',
    textTransform: 'uppercase',
  },
  heroQuestion: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 32,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  rulesContainer: {
    gap: 7,
    marginBottom: 14,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ruleIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#CCFF00',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ruleTextBlock: {
    flex: 1,
    gap: 1,
  },
  rulePrimary: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ruleSecondary: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
  },
  ruleAccent: {
    color: '#CCFF00',
    fontWeight: '700',
  },
  signature: {
    fontSize: 20,
    fontFamily: 'Yellowtail',
    color: '#CCFF00',
    textAlign: 'center',
    lineHeight: 26,
  },
});
