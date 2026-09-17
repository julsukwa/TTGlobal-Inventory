// ─── Protected Route ─────────────────────────────────────────────────────────
//
// Route guard for authenticated-only sections of the app (the dashboard and
// everything under it). Redirects to the login page when there is no active
// session; otherwise renders the matched child routes via <Outlet />.
//
// Renders nothing while the session is still being restored from
// localStorage (isLoading) — otherwise a hard reload on a deep route would
// momentarily see isAuthenticated: false, bounce to "/", and then get
// redirected again to "/dashboard" once the session loads, losing the
// original URL.

import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
