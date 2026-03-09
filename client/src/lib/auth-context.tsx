import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";

type AuthStatus = "idle" | "authenticated" | "unauthenticated" | "expired";

interface AuthProfile {
  kyc_status: string;
  kyb_status: string;
  kyc_completed_at: string | null;
  company_name: string | null;
  role: string | null;
}

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  profile: AuthProfile | null;
  sessionExpired: boolean;
  refreshSession: () => Promise<void>;
  clearSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const loadProfile = useCallback(async (email?: string) => {
    const supabase = getSupabaseClient();
    if (!supabase || !email) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("exchange_accounts")
      .select("kyc_status, kyb_status, kyc_completed_at, org_name, account_type")
      .eq("email", email)
      .maybeSingle();

    if (error || !data) {
      setProfile(null);
      return;
    }

    setProfile({
      kyc_status: data.kyc_status || "not_started",
      kyb_status: data.kyb_status || "not_started",
      kyc_completed_at: data.kyc_completed_at || null,
      company_name: data.org_name || null,
      role: data.account_type || null,
    });
  }, []);

  const refreshSession = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus("unauthenticated");
      setSession(null);
      setProfile(null);
      return;
    }

    const {
      data: { session: nextSession },
    } = await supabase.auth.getSession();

    if (!nextSession) {
      let wasAuthenticated = false;
      setStatus((prev) => {
        wasAuthenticated = prev === "authenticated";
        return wasAuthenticated ? "expired" : "unauthenticated";
      });
      setSessionExpired(wasAuthenticated);
      setSession(null);
      setProfile(null);
      return;
    }

    setSessionExpired(false);
    setStatus("authenticated");
    setSession(nextSession);
    await loadProfile(nextSession.user.email);
  }, [loadProfile]);

  useEffect(() => {
    void refreshSession();

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) {
        setStatus("expired");
        setSessionExpired(true);
        setSession(null);
        setProfile(null);
        return;
      }

      setStatus("authenticated");
      setSessionExpired(false);
      setSession(nextSession);
      void loadProfile(nextSession.user.email);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadProfile, refreshSession]);

  const value = useMemo(
    () => ({
      status,
      session,
      profile,
      sessionExpired,
      refreshSession,
      clearSessionExpired: () => setSessionExpired(false),
    }),
    [status, session, profile, sessionExpired, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
