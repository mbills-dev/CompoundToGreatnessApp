import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock, Eye, EyeOff, ArrowRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';

export default function ResetPasswordScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Supabase exchanges the recovery token from the URL hash automatically.
    // We just need to check that a recovery session was established.
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
    });
  }, []);

  const canSubmit = password.length >= 6 && password === confirm;

  const handleReset = async () => {
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess(true);
        setTimeout(() => router.replace('/'), 2000);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const bg = isDark ? '#000000' : '#FFFFFF';
  const inputBg = isDark ? colors.backgroundSecondary : 'rgba(245, 245, 245, 0.8)';
  const inputBorder = isDark ? colors.border : '#E0E0E0';
  const iconBg = isDark ? 'rgba(189, 253, 0, 0.08)' : 'rgba(189, 253, 0, 0.12)';

  if (hasSession === null) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!hasSession) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <Text style={[styles.expiredTitle, { color: colors.text }]}>Link expired</Text>
        <Text style={[styles.expiredBody, { color: colors.textSecondary }]}>
          This reset link is no longer valid. Request a new one from the sign-in screen.
        </Text>
        <TouchableOpacity onPress={() => router.replace('/')} activeOpacity={0.8}>
          <Text style={[styles.link, { color: colors.primary }]}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (success) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <Text style={[styles.successTitle, { color: colors.primary }]}>Password updated!</Text>
        <Text style={[styles.expiredBody, { color: colors.textSecondary }]}>
          Signing you in…
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: bg }]}
    >
      <LinearGradient
        colors={isDark ? ['#000000', '#111111', '#000000'] : ['#FFFFFF', '#F5F5F5', '#FFFFFF']}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoBadge}
            >
              <Text style={styles.logoText}>CTG</Text>
            </LinearGradient>
            <Text style={[styles.title, { color: colors.text }]}>Set new password</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Choose something strong and memorable.
            </Text>
          </View>

          {error && (
            <View style={[styles.errorBanner, { backgroundColor: colors.error + '15' }]}>
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          )}

          <View style={styles.inputWrapper}>
            <View style={[styles.inputIconContainer, { backgroundColor: iconBg }]}>
              <Lock size={18} color={colors.primary} strokeWidth={2} />
            </View>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: inputBorder, backgroundColor: inputBg, paddingRight: 52 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="New password"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(v => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {showPassword
                ? <EyeOff size={18} color={colors.textTertiary} strokeWidth={2} />
                : <Eye size={18} color={colors.textTertiary} strokeWidth={2} />}
            </TouchableOpacity>
          </View>

          <View style={styles.inputWrapper}>
            <View style={[styles.inputIconContainer, { backgroundColor: iconBg }]}>
              <Lock size={18} color={colors.primary} strokeWidth={2} />
            </View>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: inputBorder, backgroundColor: inputBg, paddingRight: 52 }]}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Confirm password"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowConfirm(v => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {showConfirm
                ? <EyeOff size={18} color={colors.textTertiary} strokeWidth={2} />
                : <Eye size={18} color={colors.textTertiary} strokeWidth={2} />}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleReset}
            disabled={!canSubmit || loading}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={canSubmit ? [colors.primary, colors.primaryDark] : [isDark ? colors.backgroundSecondary : '#D0D0D0', isDark ? colors.backgroundTertiary : '#B0B0B0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitGradient}
            >
              {loading ? (
                <ActivityIndicator size="small" color={canSubmit ? '#000000' : colors.textTertiary} />
              ) : (
                <View style={styles.submitContent}>
                  <Text style={[styles.submitText, { color: canSubmit ? '#000000' : colors.textTertiary }]}>
                    Update password
                  </Text>
                  <ArrowRight size={20} color={canSubmit ? '#000000' : colors.textTertiary} strokeWidth={2.5} />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
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
  submitButtonDisabled: { opacity: 0.5 },
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
  expiredTitle: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  expiredBody: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  link: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
});
