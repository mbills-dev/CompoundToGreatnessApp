import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
  ImageSourcePropType,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { X, ArrowRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CINEMATIC_BG: ImageSourcePropType = require('@/assets/images/CleanCinematicMountainSunrise.png');

interface GoalItem {
  id: string;
  title: string;
  compass_vision: string | null;
}

interface GoalsVisualizationModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string | undefined;
}

export default function GoalsVisualizationModal({ visible, onClose, userId }: GoalsVisualizationModalProps) {
  const insets = useSafeAreaInsets();
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [loading, setLoading] = useState(true);

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
      scale.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.1)) });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0.92, { duration: 200 });
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !userId) return;
    setLoading(true);
    supabase
      .from('goals')
      .select('id, title, compass_vision')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching goals for visualization:', error);
          setGoals([]);
        } else {
          setGoals(data ?? []);
        }
        setLoading(false);
      });
  }, [visible, userId]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.sheet, animatedStyle]}>
          <Image
            source={CINEMATIC_BG}
            style={styles.bgImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(10,10,10,0.88)', 'rgba(10,10,10,0.95)']}
            style={styles.bgOverlay}
          />

          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.6}>
            <X size={16} color="rgba(255,255,255,0.5)" strokeWidth={2.5} />
          </TouchableOpacity>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 50 }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.introSection}>
              <Text style={styles.eyebrow}>YOUR GOALS</Text>
              <Text style={styles.headlineLine1}>REMEMBER</Text>
              <Text style={styles.headlineLine2}>WHAT YOU'RE</Text>
              <Text style={styles.headlineLine3}>BUILDING.</Text>
              <Text style={styles.supportingCopy}>
                Take 60 seconds to feel it. Visualize it.{'\n'}Then go win today.
              </Text>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#CCFF00" />
              </View>
            ) : goals.length > 0 ? (
              <View style={styles.goalsContainer}>
                {goals.map((goal, index) => (
                  <View key={goal.id}>
                    <View style={styles.goalRow}>
                      <Text style={styles.goalNumber}>
                        {String(index + 1).padStart(2, '0')}
                      </Text>
                      <View style={styles.goalTextBlock}>
                        <Text style={styles.goalTitle}>
                          {goal.title.toUpperCase()}
                        </Text>
                        {goal.compass_vision ? (
                          <Text style={styles.goalVision}>
                            {goal.compass_vision}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {index < goals.length - 1 && <View style={styles.goalDivider} />}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No goals yet.</Text>
              </View>
            )}

            <Text style={styles.signature}>Bigger than today.</Text>
          </ScrollView>

          <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + 20 }]}>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaText}>NOW GO WIN TODAY.</Text>
              <ArrowRight size={18} color="#000000" strokeWidth={3} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    flex: 1,
    width: '100%',
    backgroundColor: '#0A0A0A',
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  bgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  scroll: {
    flex: 1,
    zIndex: 5,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingBottom: 120,
  },
  introSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.5,
    color: '#CCFF00',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  headlineLine1: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 36,
    letterSpacing: -1,
    textAlign: 'center',
  },
  headlineLine2: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 36,
    letterSpacing: -1,
    textAlign: 'center',
  },
  headlineLine3: {
    fontSize: 34,
    fontWeight: '900',
    color: '#CCFF00',
    lineHeight: 36,
    letterSpacing: -1,
    textAlign: 'center',
    marginBottom: 20,
  },
  supportingCopy: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  goalsContainer: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 32,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 16,
  },
  goalNumber: {
    fontSize: 14,
    fontWeight: '900',
    color: '#CCFF00',
    lineHeight: 20,
    minWidth: 28,
  },
  goalTextBlock: {
    flex: 1,
    gap: 4,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  goalVision: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 19,
  },
  goalDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  signature: {
    fontSize: 26,
    fontFamily: 'Yellowtail',
    color: '#CCFF00',
    textAlign: 'center',
    lineHeight: 34,
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    paddingTop: 16,
    backgroundColor: 'rgba(10,10,10,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    zIndex: 10,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#CCFF00',
    borderRadius: 14,
    paddingVertical: 16,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
});
