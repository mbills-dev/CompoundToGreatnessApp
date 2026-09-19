import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WelcomePathChooser({
  onStartNew,
  onSignIn,
}: {
  onStartNew: () => void;
  onSignIn: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/CTG-Onboarding-Hero-Mountain.png')}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        resizeMode="stretch"
      />

      {/* Cinematic gradient overlay (independent of image sizing) */}
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.82)',
          'rgba(0,0,0,0.35)',
          'rgba(0,0,0,0.15)',
          'rgba(0,0,0,0.55)',
          'rgba(0,0,0,0.92)',
        ]}
        locations={[0, 0.25, 0.45, 0.75, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 52, paddingBottom: insets.bottom + 28 },
        ]}
      >
        {/* Logo + hero copy, grouped and anchored to the top */}
        <View style={styles.topGroup}>
          <View style={styles.logoWrap}>
            <Image
              source={require('@/assets/images/logo-mark.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.hero}>
            <Text style={styles.headline}>
              <Text style={styles.headlineWhite}>YOU ARE CALLED{'\n'}</Text>
              <Text style={styles.headlineLime}>TO MORE.</Text>
            </Text>
            <Text style={styles.subheadline}>Unlock your greatness.</Text>
          </View>
        </View>
        <View style={{ flex: 1 }} />

        {/* CTA area */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onStartNew}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryText}>Let's begin →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onSignIn}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryText}>
              Already have an account?{' '}
              <Text style={styles.secondaryLink}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  topGroup: {
    alignItems: 'center',
  },
  logoWrap: {
    alignItems: 'center',
  },
  logo: {
    width: 64,
    height: 64,
  },
  hero: {
    alignItems: 'center',
    marginTop: 20,
  },
  headline: {
    fontFamily: 'Inter-Black',
    fontSize: 42,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 48,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  headlineWhite: {
    color: '#FFFFFF',
  },
  headlineLime: {
    color: '#CCFF00',
  },
  subheadline: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
    marginTop: 14,
    letterSpacing: 0.3,
  },
  actions: {
    width: '100%',
    maxWidth: 440,
    gap: 20,
  },
  primaryButton: {
    backgroundColor: '#CCFF00',
    height: 62,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: 'Inter-Black',
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  secondaryText: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
  },
  secondaryLink: {
    color: '#CCFF00',
  },
});
