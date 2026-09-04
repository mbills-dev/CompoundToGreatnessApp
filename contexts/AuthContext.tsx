import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import Purchases from 'react-native-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { logBreadcrumb } from '@/lib/crashBreadcrumbs';

async function generateNonce(): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = await Crypto.getRandomBytesAsync(32);
  let nonce = '';
  for (let i = 0; i < bytes.length; i++) {
    nonce += chars[bytes[i] % chars.length];
  }
  return nonce;
}

async function sha256Hex(input: string): Promise<string> {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}

const ONBOARDING_KEY = '@onboarding_completed';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isSubscribed: boolean;
  onboardingCompleted: boolean;
  isNewSignup: boolean;
  isWatcher: boolean;
  watchedUserId: string | null;
  needsUsername: boolean;
  clearNewSignup: () => void;
  clearNeedsUsername: () => void;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  convertAnonymousAccount: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: string | null }>;
  convertWithGoogle: () => Promise<{ error: string | null }>;
  convertWithApple: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);
  const [isNewSignup, setIsNewSignup] = useState(false);
  const [isWatcher, setIsWatcher] = useState(false);
  const [watchedUserId, setWatchedUserId] = useState<string | null>(null);
  const [needsUsername, setNeedsUsername] = useState(false);

  useEffect(() => {
    logBreadcrumb('auth_bootstrap_start');
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        logBreadcrumb('existing_session_found', {
          userId: session.user.id,
          isAnonymous: session.user.is_anonymous ?? false,
        });
        checkSubscription(session.user.id);
        loadOnboardingState(session.user.id);
        checkWatcherStatus(session.user.id);
        checkUsernameStatus(session.user.id, session.user.is_anonymous ?? false);
      } else {
        try {
          logBreadcrumb('anon_signin_start');
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          logBreadcrumb('anon_signin_success', {
            hasSession: !!data.session,
            hasUser: !!data.session?.user,
            userId: data.session?.user?.id ?? null,
          });
          if (data.session) {
            setSession(data.session);
          }
        } catch (e) {
          logBreadcrumb('anon_signin_failed', { error: String(e).slice(0, 200) });
          console.error('anonymous_signin_failed', String(e).slice(0, 200));
        }
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      logBreadcrumb('auth_state_change', { event: _event, hasSession: !!session });
      setSession(session);
      if (session?.user) {
        (async () => {
          await checkSubscription(session.user.id);
          await loadOnboardingState(session.user.id);
          await checkWatcherStatus(session.user.id);
          await checkUsernameStatus(session.user.id, session.user.is_anonymous ?? false);
        })();
      } else {
        setIsSubscribed(false);
        setOnboardingCompleted(true);
        setIsWatcher(false);
        setWatchedUserId(null);
        setNeedsUsername(false);
        try {
          await supabase.auth.signInAnonymously();
        } catch (e) {
          console.error('anonymous_signin_failed', String(e).slice(0, 200));
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadOnboardingState = async (userId: string) => {
    try {
      const value = await AsyncStorage.getItem(`${ONBOARDING_KEY}_${userId}`);
      setOnboardingCompleted(value === 'true');
    } catch {
      setOnboardingCompleted(false);
    }
  };

  const completeOnboarding = async () => {
    if (session?.user) {
      try {
        await AsyncStorage.setItem(`${ONBOARDING_KEY}_${session.user.id}`, 'true');
        setOnboardingCompleted(true);
      } catch {
        setOnboardingCompleted(true);
      }
    }
  };

  const checkWatcherStatus = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_watcher, invited_by')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.is_watcher && profile?.invited_by) {
        setIsWatcher(true);
        setWatchedUserId(profile.invited_by);
      } else {
        setIsWatcher(false);
        setWatchedUserId(null);
      }
    } catch {
      setIsWatcher(false);
      setWatchedUserId(null);
    }
  };

  const checkUsernameStatus = async (userId: string, isAnonymous: boolean) => {
    if (isAnonymous) {
      setNeedsUsername(false);
      return;
    }
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username_set')
        .eq('id', userId)
        .maybeSingle();

      if (!profile || !profile.username_set) {
        setNeedsUsername(true);
      } else {
        setNeedsUsername(false);
      }
    } catch {
      setNeedsUsername(false);
    }
  };

  const clearNeedsUsername = () => {
    setNeedsUsername(false);
  };

  const checkSubscription = async (userId: string) => {
    try {
      if (Platform.OS === 'ios') {
        const customerInfo = await Purchases.getCustomerInfo();
        setIsSubscribed(!!customerInfo.entitlements.active['premium']);
        return;
      }

      const { data } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      setIsSubscribed(!!data);
    } catch {
      setIsSubscribed(false);
    }
  };

  const refreshSubscription = async () => {
    if (session?.user) {
      await checkSubscription(session.user.id);
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    setIsNewSignup(true);
    setOnboardingCompleted(false);
    return { error: null };
  };

  const clearNewSignup = () => {
    setIsNewSignup(false);
    setOnboardingCompleted(true);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  };

  const convertAnonymousAccount = async (email: string, password: string, firstName: string, lastName: string) => {
    const { error } = await supabase.auth.updateUser({
      email,
      password,
      data: { first_name: firstName, last_name: lastName },
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  };

  const convertWithGoogle = async () => {
    try {
      const redirectTo = makeRedirectUri({ scheme: 'myapp' });
      const { data, error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (!data?.url) {
        return { error: 'No OAuth URL returned from Supabase.' };
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'cancel' || result.type === 'dismiss') {
        return { error: null };
      }

      if (result.type !== 'success') {
        return { error: 'Google sign-in did not complete. Please try again.' };
      }

      return { error: null };
    } catch (e) {
      return { error: String(e).slice(0, 200) };
    }
  };

  const convertWithApple = async () => {
    if (Platform.OS !== 'ios') {
      return { error: 'Apple Sign-In is only available on iOS devices.' };
    }

    try {
      const rawNonce = await generateNonce();
      const hashedNonce = await sha256Hex(rawNonce);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        return { error: 'Apple Sign-In did not return an identity token.' };
      }

      const { error } = await supabase.auth.linkIdentity({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (e) {
      const errStr = String(e);
      if (
        errStr.includes('ERR_CANCELED') ||
        errStr.includes('AppleAuthentication.CanceledError') ||
        errStr.includes('canceled')
      ) {
        return { error: null };
      }
      return { error: errStr.slice(0, 200) };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setIsSubscribed(false);
    setOnboardingCompleted(true);
    setIsWatcher(false);
    setWatchedUserId(null);
    setNeedsUsername(false);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        isSubscribed,
        onboardingCompleted,
        isNewSignup,
        isWatcher,
        watchedUserId,
        needsUsername,
        clearNewSignup,
        clearNeedsUsername,
        signUp,
        signIn,
        convertAnonymousAccount,
        convertWithGoogle,
        convertWithApple,
        signOut,
        refreshSubscription,
        completeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

const AUTH_DEFAULTS: AuthContextType = {
  session: null,
  user: null,
  loading: true,
  isSubscribed: false,
  onboardingCompleted: false,
  isNewSignup: false,
  isWatcher: false,
  watchedUserId: null,
  needsUsername: false,
  clearNewSignup: () => {},
  clearNeedsUsername: () => {},
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  convertAnonymousAccount: async () => ({ error: null }),
  convertWithGoogle: async () => ({ error: null }),
  convertWithApple: async () => ({ error: null }),
  signOut: async () => {},
  refreshSubscription: async () => {},
  completeOnboarding: async () => {},
};

export function useAuth() {
  const context = useContext(AuthContext);
  return context ?? AUTH_DEFAULTS;
}
