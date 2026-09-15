// ─── Login Page ─────────────────────────────────────────────────────────────
//
// Entry point for the app — collects username/password and authenticates
// against the real backend via AuthContext.login. On success, starts a
// session and navigates to the dashboard. A visitor who is already
// authenticated (e.g. hit "/" directly with a session still active) is
// bounced straight to the dashboard instead of seeing the form again.

import { useEffect, useState } from "react";
import "./LoginPage.css";
import TTglobal from "../../assets/TTglobal.jpg";
import { useNavigate } from "react-router-dom";
import { User, Lock, Eye, EyeOff } from "lucide-react";

import { useAuth } from "../../context/AuthContext";

function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      await login(username, password);
      navigate("/dashboard");
    } catch {
      setError("Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-overlay" />

      <div className="login-card">
        <img src={TTglobal} alt="TT Global" className="logo" />

        <h2 className="subtitle">INVENTORY SYSTEM</h2>

        <div className="divider" />

        {/* ERROR MESSAGE */}
        {error && (
          <p className="field-error">
            {error}
          </p>
        )}

        {/* Username */}
        <label>Username</label>
        <div className="input-group">
          <User className="icon" size={16} />
          <input
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        {/* Password */}
        <label>Password</label>
        <div className="input-group">
          <Lock className="icon" size={16} />

          <input
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {showPassword ? (
            <EyeOff
              className="eye"
              size={16}
              onClick={() => setShowPassword(!showPassword)}
            />
          ) : (
            <Eye
              className="eye"
              size={16}
              onClick={() => setShowPassword(!showPassword)}
            />
          )}
        </div>

        {/* LOGIN BUTTON */}
        <button className="login-btn" onClick={handleLogin} disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>
    </div>
  );
}

export default LoginPage;