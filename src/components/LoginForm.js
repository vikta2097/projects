import React, { useState } from "react";
import "../styles/AuthForm.css";

const LoginForm = ({ onSignupClick, onForgotClick, onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:5100/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.message || `Login failed with status ${response.status}`);
        return;
      }

      // ✅ Store the token in localStorage for session persistence
      if (data.token) {
        localStorage.setItem("token", data.token);
        onLoginSuccess && onLoginSuccess(); // Trigger login success
      } else {
        setError("Login failed: No token received.");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <div className="form-header">
        <h2>Welcome Back</h2>
        <p>Sign in to your account</p>
      </div>

      <div className="auth-form">
        {error && (
          <div className="error-message">
            <span role="img" aria-label="Error">⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="form-links">
          <button type="button" className="link-btn" onClick={onForgotClick}>
            Forgot your password?
          </button>
        </div>

        <div className="form-footer">
          <span>Don't have an account? </span>
          <button type="button" className="link-btn primary" onClick={onSignupClick}>
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
