import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Check } from 'lucide-react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SaveProgressScreen({ onComplete }: { onComplete: () => void }) {
  const { colors, isDark } = useTheme();
  const { convertAnonymousAccount, convertWithGoogle, convertWithApple } = useAuth();
  const insets = useSafeAreaInsets();

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [agreeToTerms, setAgreeToTerms] = useState(true);
  const [marketingConsent, setMarketingConsent] = useState(true);

  const [loadingApple, setLoadingApple] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApple = async () => {
    setError(null);
    setLoadingApple(true);
    try {
      const { error: appleError } = await convertWithApple();
      if (appleError) {
        setError(appleError);
      } else {
        onComplete();
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoadingApple(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setLoadingGoogle(true);
    try {
      const { error: googleError } = await convertWithGoogle();
      if (googleError) {
        setError(googleError);
      } else {
        onComplete();
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleEmailSubmit = async () => {
    setError(null);
    if (!firstName.trim()) {
      setError('Please enter your first name');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoadingEmail(true);
    try {
      const { error: convertError } = await convertAnonymousAccount(
        email.trim(),
        password,
        firstName.trim(),
        lastName.trim(),
      );
      if (convertError) {
        setError(convertError);
      } else {
        onComplete();
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoadingEmail(false);
    }
  };

  const emailFormValid =
    firstName.trim() && email.trim() && password.length >= 6 && agreeToTerms;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <LinearGradient
        colors={isDark ? ['#000000', '#0D0D0D', '#000000'] : ['#FFFFFF', '#F5F5F0', '#FFFFFF']}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View style={styles.contentColumn}>
            <View style={styles.header}>
              <View style={[styles.logoBadge, { backgroundColor: '#000000' }]}>
                <Image
                  source={require('@/assets/images/logo-mark.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.headline, { color: colors.text }]}>
                Save your progress
              </Text>
              <Text style={[styles.subheadline, { color: colors.textSecondary }]}>
                Create an account to keep your goals, streaks, and badges safe.
              </Text>
            </View>

            {error && (
              <View style={[styles.errorBanner, { backgroundColor: colors.error + '15' }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            )}

            {/* Apple Sign-In */}
            <TouchableOpacity
              style={[styles.socialButton, { backgroundColor: '#000000' }]}
              onPress={handleApple}
              disabled={loadingApple}
              activeOpacity={0.85}
            >
              {loadingApple ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <AppleLogo />
                  <Text style={styles.appleButtonText}>Sign in with Apple</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Google Sign-In */}
            <TouchableOpacity
              style={[
                styles.socialButton,
                {
                  backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
                  borderColor: isDark ? colors.border : '#E0E0E0',
                },
              ]}
              onPress={handleGoogle}
              disabled={loadingGoogle}
              activeOpacity={0.85}
            >
              {loadingGoogle ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <>
                  <GoogleLogo />
                  <Text style={[styles.googleButtonText, { color: colors.text }]}>
                    Sign in with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Continue with Email */}
            <TouchableOpacity
              style={[
                styles.socialButton,
                {
                  backgroundColor: 'transparent',
                  borderColor: colors.primary + '60',
                },
              ]}
              onPress={() => {
                setError(null);
                setShowEmailForm(!showEmailForm);
              }}
              activeOpacity={0.85}
            >
              <Mail size={20} color={colors.primary} strokeWidth={2} />
              <Text style={[styles.emailButtonText, { color: colors.primary }]}>
                Continue with email
              </Text>
            </TouchableOpacity>

            {/* Email Form */}
            {showEmailForm && (
              <View style={styles.emailForm}>
                <View style={styles.nameRow}>
                  <View style={[styles.inputWrapper, styles.nameInput]}>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          color: colors.text,
                          borderColor: isDark ? colors.border : '#E0E0E0',
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.05)'
                            : 'rgba(0,0,0,0.03)',
                        },
                      ]}
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="First name"
                      placeholderTextColor={colors.textTertiary}
                      autoCapitalize="words"
                    />
                  </View>
                  <View style={[styles.inputWrapper, styles.nameInput]}>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          color: colors.text,
                          borderColor: isDark ? colors.border : '#E0E0E0',
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.05)'
                            : 'rgba(0,0,0,0.03)',
                        },
                      ]}
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Last name"
                      placeholderTextColor={colors.textTertiary}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                <View style={styles.inputWrapper}>
                  <View
                    style={[
                      styles.inputIconContainer,
                      {
                        backgroundColor: isDark
                          ? 'rgba(204,255,0,0.08)'
                          : 'rgba(204,255,0,0.12)',
                      },
                    ]}
                  >
                    <Mail size={18} color={colors.primary} strokeWidth={2} />
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: colors.text,
                        borderColor: isDark ? colors.border : '#E0E0E0',
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.05)'
                          : 'rgba(0,0,0,0.03)',
                      },
                    ]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email address"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <View
                    style={[
                      styles.inputIconContainer,
                      {
                        backgroundColor: isDark
                          ? 'rgba(204,255,0,0.08)'
                          : 'rgba(204,255,0,0.12)',
                      },
                    ]}
                  >
                    <Lock size={18} color={colors.primary} strokeWidth={2} />
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: colors.text,
                        borderColor: isDark ? colors.border : '#E0E0E0',
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.05)'
                          : 'rgba(0,0,0,0.03)',
                        paddingRight: 52,
                      },
                    ]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color={colors.textTertiary} strokeWidth={2} />
                    ) : (
                      <Eye size={18} color={colors.textTertiary} strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    !emailFormValid && { opacity: 0.45 },
                  ]}
                  onPress={handleEmailSubmit}
                  disabled={!emailFormValid || loadingEmail}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={
                      emailFormValid
                        ? [colors.primary, colors.primaryDark]
                        : [isDark ? colors.backgroundSecondary : '#D0D0D0', isDark ? colors.backgroundTertiary : '#B0B0B0']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.submitGradient}
                  >
                    {loadingEmail ? (
                      <ActivityIndicator size="small" color={emailFormValid ? '#000000' : colors.textTertiary} />
                    ) : (
                      <View style={styles.submitContent}>
                        <Text
                          style={[
                            styles.submitText,
                            { color: emailFormValid ? '#000000' : colors.textTertiary },
                          ]}
                        >
                          Create Account
                        </Text>
                        <ArrowRight size={20} color={emailFormValid ? '#000000' : colors.textTertiary} strokeWidth={2.5} />
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {/* Checkboxes */}
            <View style={styles.checkboxes}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setAgreeToTerms(!agreeToTerms)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: agreeToTerms ? colors.primary : 'transparent',
                      borderColor: agreeToTerms ? colors.primary : colors.textTertiary,
                    },
                  ]}
                >
                  {agreeToTerms && <Check size={14} color="#000000" strokeWidth={3} />}
                </View>
                <Text style={[styles.checkboxText, { color: colors.textSecondary }]}>
                  I agree to the{' '}
                  <Text style={[styles.checkboxLink, { color: colors.primary }]}>
                    Terms and Conditions
                  </Text>{' '}
                  and{' '}
                  <Text style={[styles.checkboxLink, { color: colors.primary }]}>
                    Privacy Policy
                  </Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setMarketingConsent(!marketingConsent)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: marketingConsent ? colors.primary : 'transparent',
                      borderColor: marketingConsent ? colors.primary : colors.textTertiary,
                    },
                  ]}
                >
                  {marketingConsent && <Check size={14} color="#000000" strokeWidth={3} />}
                </View>
                <Text style={[styles.checkboxText, { color: colors.textSecondary }]}>
                  Send me tips, new features, and personalized offers
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

function AppleLogo() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <SvgPath
        d="M17.05 12.04c-.03-2.78 2.27-3.68 2.37-3.73-1.29-1.88-3.29-2.14-4-2.16-1.69-.17-3.33.99-4.19.99-.88 0-2.21-.97-3.64-.94-1.86.03-3.6 1.1-4.56 2.78-1.96 3.39-.5 8.4 1.39 11.16.94 1.35 2.04 2.86 3.49 2.81 1.41-.06 1.94-.9 3.64-.9 1.69 0 2.18.9 3.65.87 1.51-.03 2.46-1.36 3.37-2.72 1.07-1.56 1.51-3.07 1.53-3.15-.03-.01-2.93-1.12-2.96-4.45M14.25 4.6c.77-.93 1.29-2.22 1.15-3.51-1.11.04-2.45.74-3.25 1.66-.71.82-1.33 2.14-1.16 3.4 1.24.1 2.49-.63 3.26-1.55"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

function GoogleLogo() {
  return (
    <View style={styles.googleLogo}>
      <Text style={styles.googleLogoG}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  contentColumn: {
    width: '100%',
    maxWidth: 440,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: 42,
    height: 42,
  },
  headline: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subheadline: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorBanner: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  appleButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  emailButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  googleLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLogoG: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  emailForm: {
    marginTop: 8,
    marginBottom: 8,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  nameInput: {
    flex: 1,
  },
  inputWrapper: {
    marginBottom: 12,
    position: 'relative',
  },
  inputIconContainer: {
    position: 'absolute',
    left: 14,
    top: 14,
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 16,
    paddingLeft: 56,
    paddingRight: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  submitButton: {
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  submitGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  checkboxes: {
    marginTop: 24,
    gap: 14,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    flex: 1,
  },
  checkboxLink: {
    fontWeight: '700',
  },
});
