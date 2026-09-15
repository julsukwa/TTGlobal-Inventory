// ─── Auth Context ────────────────────────────────────────────────────────────
//
// Holds the current authenticated user for the whole app and exposes
// login/logout. Login calls the real backend (POST /auth/login) and persists
// both the JWT ("ttglobal_token") and the user object ("ttglobal_user") to
// localStorage so a page refresh doesn't log the user out — see LoginPage.tsx
// for the calling component.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../services/api";

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: "ADMIN" | "STAFF_SALES" | "STAFF_WAREHOUSE" | "STAFF_WARRANTY";
  status: string;
}

interface LoginResponse {
  access_token: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const USER_STORAGE_KEY = "ttglobal_user";
const TOKEN_STORAGE_KEY = "ttglobal_token";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);

  // Restore a previous session on mount so a page refresh doesn't log the
  // user out.
  useEffect(() => {
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!storedUser || !storedToken) return;

    try {
      setUser(JSON.parse(storedUser) as AuthUser);
    } catch {
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const { access_token, user: loggedInUser } = await apiFetch<LoginResponse>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }
    );

    localStorage.setItem(TOKEN_STORAGE_KEY, access_token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(loggedInUser));
    setUser(loggedInUser);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
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
