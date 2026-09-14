// ─── Protected Route ─────────────────────────────────────────────────────────
//
// Route guard for authenticated-only sections of the app (the dashboard and
// everything under it). Redirects to the login page when there is no active
// session; otherwise renders the matched child routes via <Outlet />.

import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
