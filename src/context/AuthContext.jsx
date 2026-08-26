import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

const STORAGE_KEY = "sales_manager_user";

const AuthContext = createContext(null);

/** read the saved user (if any) from localStorage, safely */
function readStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * AuthProvider — wraps the app, exposes the logged-in user (read from/
 * persisted to localStorage) plus login()/logout().
 *
 * Wrap <BrowserRouter> around this (or vice versa) once in App.jsx.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStoredUser());

  /* if the user logs out (or in) in another tab, pick that up here too */
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setUser(readStoredUser());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /** call after a successful loginUser() call from supabase/users.js */
  const login = useCallback((userRecord) => {
    // never persist the password itself to localStorage
    const { password, ...safeUser } = userRecord || {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeUser));
    setUser(safeUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, login, logout }),
    [user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** useAuth() — read { user, isAuthenticated, login, logout } anywhere below <AuthProvider> */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an <AuthProvider>");
  return ctx;
}

/** wrap a protected route: no user in localStorage -> bounce to /login */
export function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

/** wrap the /login route: already logged in -> skip straight to home */
export function RequireGuest({ children }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return children;
}