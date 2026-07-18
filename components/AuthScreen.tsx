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
import { Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

type AuthMode = 'login' | 'signup' | 'forgot';

export default function AuthScreen() {
  const { colors, isDark } = useTheme();
  const { signIn, signUp } = useAuth();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<AuthMode>('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!firstName.trim()) {
          setError('Please enter your first name');
          setLoading(false);
          return;
        }
        if (!email.trim()) {
          setError('Please enter your email');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        const { error: signUpError } = await signUp(email.trim(), password, firstName.trim(), lastName.trim());
        if (signUpError) {
          setError(signUpError);
        }
      } else {
        if (!email.trim() || !password) {
          setError('Please enter your email and password');
          setLoading(false);
          return;
        }
        const { error: signInError } = await signIn(email.trim(), password);
        if (signInError) {
          setError(signInError);
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Enter your email address above first.');
      return;
    }
    setLoading(true);
    try {
      const origin = Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : 'https://app.compoundtogreatness.com';
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/reset-password`,
      });
      if (resetError) {
        setError(resetError.message);
      } else {
        setResetSent(true);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError(null);
    setResetSent(false);
  };

  const canSubmit = () => {
    if (mode === 'signup') {
      return firstName.trim() && email.trim() && password.length >= 6;
    }
    return email.trim() && password;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <LinearGradient
        colors={isDark ? ['#000000', '#111111', '#000000'] : ['#FFFFFF', '#F5F5F5', '#FFFFFF']}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.contentColumn}>
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

          <View style={styles.form}>
            <Text style={[styles.formTitle, { color: colors.text }]}>
              {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset password'}
            </Text>
            <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>
              {mode === 'login'
                ? 'Sign in to continue your journey'
                : mode === 'signup'
                ? 'Start your transformation today'
                : 'We\'ll send a reset link to your email.'}
            </Text>

            {error && (
              <View style={[styles.errorBanner, { backgroundColor: colors.error + '15' }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            )}

            {mode === 'forgot' && resetSent ? (
              <View style={styles.resetSentContainer}>
                <Text style={[styles.resetSentText, { color: colors.text }]}>
                  Check your email for a reset link.
                </Text>
                <TouchableOpacity style={styles.backToLogin} onPress={() => { setMode('login'); setResetSent(false); setError(null); }}>
                  <Text style={[styles.switchTextBold, { color: colors.primary }]}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            ) : mode === 'forgot' ? (
              <>
                <View style={styles.inputWrapper}>
                  <View style={[styles.inputIconContainer, { backgroundColor: isDark ? 'rgba(189, 253, 0, 0.08)' : 'rgba(189, 253, 0, 0.12)' }]}>
                    <Mail size={18} color={colors.primary} strokeWidth={2} />
                  </View>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: isDark ? colors.border : '#E0E0E0', backgroundColor: isDark ? colors.backgroundSecondary : 'rgba(245, 245, 245, 0.8)' }]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email address"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.submitButton, !email.trim() && styles.submitButtonDisabled]}
                  onPress={handleForgotPassword}
                  disabled={!email.trim() || loading}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={email.trim() ? [colors.primary, colors.primaryDark] : [isDark ? colors.backgroundSecondary : '#D0D0D0', isDark ? colors.backgroundTertiary : '#B0B0B0']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.submitGradient}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={email.trim() ? '#000000' : colors.textTertiary} />
                    ) : (
                      <Text style={[styles.submitText, { color: email.trim() ? '#000000' : colors.textTertiary }]}>
                        Send reset link
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={styles.switchMode} onPress={() => { setMode('login'); setError(null); }}>
                  <Text style={[styles.switchText, { color: colors.textSecondary }]}>
                    {'Back to '}
                    <Text style={[styles.switchTextBold, { color: colors.primary }]}>Sign In</Text>
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}

            {(mode === 'login' || mode === 'signup') && (
              <>
                {mode === 'signup' && (
                  <View style={styles.nameRow}>
                    <View style={[styles.inputWrapper, styles.nameInput]}>
                      <View style={[styles.inputIconContainer, { backgroundColor: isDark ? 'rgba(189, 253, 0, 0.08)' : 'rgba(189, 253, 0, 0.12)' }]}>
                        <User size={18} color={colors.primary} strokeWidth={2} />
                      </View>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: isDark ? colors.border : '#E0E0E0', backgroundColor: isDark ? colors.backgroundSecondary : 'rgba(245, 245, 245, 0.8)' }]}
                        value={firstName}
                        onChangeText={setFirstName}
                        placeholder="First name"
                        placeholderTextColor={colors.textTertiary}
                        autoCapitalize="words"
                      />
                    </View>
                    <View style={[styles.inputWrapper, styles.nameInput]}>
                      <TextInput
                        style={[styles.input, styles.inputNoIcon, { color: colors.text, borderColor: isDark ? colors.border : '#E0E0E0', backgroundColor: isDark ? colors.backgroundSecondary : 'rgba(245, 245, 245, 0.8)' }]}
                        value={lastName}
                        onChangeText={setLastName}
                        placeholder="Last name"
                        placeholderTextColor={colors.textTertiary}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>
                )}

                <View style={styles.inputWrapper}>
                  <View style={[styles.inputIconContainer, { backgroundColor: isDark ? 'rgba(189, 253, 0, 0.08)' : 'rgba(189, 253, 0, 0.12)' }]}>
                    <Mail size={18} color={colors.primary} strokeWidth={2} />
                  </View>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: isDark ? colors.border : '#E0E0E0', backgroundColor: isDark ? colors.backgroundSecondary : 'rgba(245, 245, 245, 0.8)' }]}
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
                  <View style={[styles.inputIconContainer, { backgroundColor: isDark ? 'rgba(189, 253, 0, 0.08)' : 'rgba(189, 253, 0, 0.12)' }]}>
                    <Lock size={18} color={colors.primary} strokeWidth={2} />
                  </View>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: isDark ? colors.border : '#E0E0E0', backgroundColor: isDark ? colors.backgroundSecondary : 'rgba(245, 245, 245, 0.8)', paddingRight: 52 }]}
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

                {mode === 'login' && (
                  <TouchableOpacity
                    style={styles.forgotPassword}
                    onPress={() => { setMode('forgot'); setError(null); setResetSent(false); }}
                  >
                    <Text style={[styles.forgotPasswordText, { color: colors.textSecondary }]}>
                      Forgot password?
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.submitButton, !canSubmit() && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={!canSubmit() || loading}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={canSubmit() ? [colors.primary, colors.primaryDark] : [isDark ? colors.backgroundSecondary : '#D0D0D0', isDark ? colors.backgroundTertiary : '#B0B0B0']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.submitGradient}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={canSubmit() ? '#000000' : colors.textTertiary} />
                    ) : (
                      <View style={styles.submitContent}>
                        <Text style={[styles.submitText, { color: canSubmit() ? '#000000' : colors.textTertiary }]}>
                          {mode === 'login' ? 'Sign In' : 'Create Account'}
                        </Text>
                        <ArrowRight size={20} color={canSubmit() ? '#000000' : colors.textTertiary} strokeWidth={2.5} />
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.switchMode} onPress={switchMode}>
                  <Text style={[styles.switchText, { color: colors.textSecondary }]}>
                    {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                    <Text style={[styles.switchTextBold, { color: colors.primary }]}>
                      {mode === 'login' ? 'Sign Up' : 'Sign In'}
                    </Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
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
    maxWidth: 480,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
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
  form: {
    gap: 0,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 24,
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
  nameRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  nameInput: {
    flex: 1,
  },
  inputWrapper: {
    marginBottom: 14,
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
  inputNoIcon: {
    paddingLeft: 16,
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
  submitButtonDisabled: {
    opacity: 0.5,
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
  switchMode: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 15,
    fontWeight: '500',
  },
  switchTextBold: {
    fontWeight: '700',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 8,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
  },
  resetSentContainer: {
    gap: 20,
    alignItems: 'center',
    paddingVertical: 24,
  },
  resetSentText: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 26,
  },
  backToLogin: {
    paddingVertical: 4,
  },
});
