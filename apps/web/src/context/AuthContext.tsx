import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CompanySignupInput, LoginInput, PublicUser, StudentSignupInput } from "@internly/shared";
import { api } from "../lib/api";

/*
 * "Who is logged in?" is needed by almost every component (nav bar, protected routes, forms).
 * Passing it down through props at every level ("prop drilling") would be painful, so it lives in a
 * React Context: any component can read it with useAuth(). Context is the right tool here because
 * the value changes rarely (login/logout); for fast-changing state it would re-render too much.
 */

interface AuthState {
  user: PublicUser | null;
  loading: boolean; // true until the first /api/auth/me answer arrives
  login: (input: LoginInput) => Promise<PublicUser>;
  signupStudent: (input: StudentSignupInput) => Promise<PublicUser>;
  signupCompany: (input: CompanySignupInput) => Promise<PublicUser>;
  logout: () => Promise<void>;
  setUser: (user: PublicUser | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On first load, ask the server who we are (the session cookie travels automatically).
  useEffect(() => {
    const controller = new AbortController();
    api
      .get<{ user: PublicUser | null }>("/api/auth/me", controller.signal)
      .then((r) => setUser(r.user))
      .catch(() => {}) // aborted or server down: stay logged out
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort(); // cleanup if the component unmounts mid-request
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const r = await api.post<{ user: PublicUser }>("/api/auth/login", input);
    setUser(r.user);
    return r.user;
  }, []);
  const signupStudent = useCallback(async (input: StudentSignupInput) => {
    const r = await api.post<{ user: PublicUser }>("/api/auth/signup/student", input);
    setUser(r.user);
    return r.user;
  }, []);
  const signupCompany = useCallback(async (input: CompanySignupInput) => {
    const r = await api.post<{ user: PublicUser }>("/api/auth/signup/company", input);
    setUser(r.user);
    return r.user;
  }, []);
  const logout = useCallback(async () => {
    await api.post("/api/auth/logout");
    setUser(null);
  }, []);

  // useMemo: keep the SAME object between renders unless something changed, so components that
  // consume the context do not re-render for no reason.
  const value = useMemo(
    () => ({ user, loading, login, signupStudent, signupCompany, logout, setUser }),
    [user, loading, login, signupStudent, signupCompany, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
