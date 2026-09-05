import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WelcomePathChooser({
  onStartNew,
  onSignIn,
}: {
  onStartNew: () => void;
  onSignIn: () => void;
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={isDark ? ['#000000', '#0D0D0D', '#000000'] : ['#FFFFFF', '#F5F5F0', '#FFFFFF']}
        style={styles.gradient}
      >
        <View style={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Image
                source={require('@/assets/images/logo-mark.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.appName, { color: colors.text }]}>
              COMPOUND TO{'\n'}GREATNESS
            </Text>
            <Text style={[styles.tagline, { color: colors.textSecondary }]}>
              Small inputs. Exponential life.
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onStartNew}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#CCFF00', '#BDFD00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryGradient}
              >
                <Text style={styles.primaryText}>Start My 77 Days</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onSignIn}
              activeOpacity={0.7}
            >
              <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>
                Already building your streak?{' '}
                <Text style={[styles.secondaryTextBold, { color: colors.primary }]}>
                  Sign in
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: '#000000',
  },
  logoImage: {
    width: 48,
    height: 48,
  },
  appName: {
    fontSize: 36,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    textAlign: 'center',
    lineHeight: 42,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    maxWidth: 420,
    gap: 24,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  primaryGradient: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '500',
  },
  secondaryTextBold: {
    fontWeight: '700',
  },
});
