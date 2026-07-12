import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        checkSubscription(session.user.id);
        loadOnboardingState(session.user.id);
        checkWatcherStatus(session.user.id);
        checkUsernameStatus(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        (async () => {
          await checkSubscription(session.user.id);
          await loadOnboardingState(session.user.id);
          await checkWatcherStatus(session.user.id);
          await checkUsernameStatus(session.user.id);
        })();
      } else {
        setIsSubscribed(false);
        setOnboardingCompleted(true);
        setIsWatcher(false);
        setWatchedUserId(null);
        setNeedsUsername(false);
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

  const checkUsernameStatus = async (userId: string) => {
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
  signOut: async () => {},
  refreshSubscription: async () => {},
  completeOnboarding: async () => {},
};

export function useAuth() {
  const context = useContext(AuthContext);
  return context ?? AUTH_DEFAULTS;
}
