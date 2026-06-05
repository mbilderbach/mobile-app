import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

/**
 * Whether this account has cleared the first-run onboarding. Persisted per user
 * in AsyncStorage. Brand-new sign-ups land on onboarding (write → remind →
 * home); returning sign-ins are marked complete so they go straight to Today.
 */
const onboardedKey = (userId: string) => `onboarded:${userId}`;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** null = still resolving the flag for the current user. */
  onboarded: boolean | null;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  onboarded: null,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  completeOnboarding: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Resolve the onboarding flag whenever the signed-in user changes.
  useEffect(() => {
    let active = true;
    if (!user) { setOnboarded(null); return; }
    AsyncStorage.getItem(onboardedKey(user.id)).then((value) => {
      if (active) setOnboarded(value === 'true');
    });
    return () => { active = false; };
  }, [user?.id]);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    // Leave the onboarding flag unset so a new account flows through onboarding.
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    // A successful password sign-in is a returning user — skip onboarding.
    if (!error && data.user) {
      await AsyncStorage.setItem(onboardedKey(data.user.id), 'true');
      setOnboarded(true);
    }
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const completeOnboarding = async () => {
    if (user) await AsyncStorage.setItem(onboardedKey(user.id), 'true');
    setOnboarded(true);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, onboarded, signUp, signIn, signOut, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
