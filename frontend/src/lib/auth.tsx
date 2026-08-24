import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

export type Role = "PATIENT" | "DOCTOR" | "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export function roleHomePath(role: Role): string {
  return role === "PATIENT" ? "/dashboard" : role === "DOCTOR" ? "/doctor" : "/admin";
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (params: {
    email: string;
    password: string;
    name: string;
    role: Role;
    preferredLanguage?: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("careloop_user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem("careloop_user");
      }
    }
    setLoading(false);
  }, []);

  async function login(email: string, password: string): Promise<AuthUser> {
    const { data } = await api.post("/api/auth/login", { email, password });
    localStorage.setItem("careloop_token", data.token);
    localStorage.setItem("careloop_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  async function register(params: {
    email: string;
    password: string;
    name: string;
    role: Role;
    preferredLanguage?: string;
  }) {
    await api.post("/api/auth/register", params);
    await login(params.email, params.password);
  }

  function logout() {
    localStorage.removeItem("careloop_token");
    localStorage.removeItem("careloop_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
