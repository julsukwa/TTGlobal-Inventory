// ─── Auth Context ────────────────────────────────────────────────────────────
//
// Holds the current authenticated user for the whole app and exposes
// login/logout. The session is persisted to localStorage (key:
// "ttglobal_user") so a page refresh doesn't log the user out. This is a
// client-only mock — there is no real token or server-side session yet; see
// LoginPage.tsx for the current hardcoded admin/admin check that calls login().

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

export interface AuthUser {
  username: string;
  role: "admin" | "sales" | "warehouse" | "warranty";
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, role: "admin" | "sales" | "warehouse" | "warranty") => void;
  logout: () => void;
}

const STORAGE_KEY = "ttglobal_user";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);

  // Restore a previous session on mount so a page refresh doesn't log the
  // user out.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    try {
      setUser(JSON.parse(stored) as AuthUser);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const login = (username: string, role: "admin" | "sales" | "warehouse" | "warranty") => {
    const nextUser: AuthUser = { username, role };
    setUser(nextUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    navigate("/");
  };

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
