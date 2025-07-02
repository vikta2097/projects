import React, { useState } from "react";
import "../styles/AuthForm.css";

const LoginForm = ({ onSignupClick, onForgotClick, onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const BASE_URL = "https://projects-2-c3ms.onrender.com";

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Login request
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.token) {
        setError(data?.message || "Login failed.");
        return;
      }

      // Save token
      localStorage.setItem("token", data.token);

      // Fetch user profile
      const profileRes = await fetch(`${BASE_URL}/api/profile`, {
        method: "GET",
        headers: { Authorization: `Bearer ${data.token}` },
      });

      const profileData = await profileRes.json();

      if (!profileRes.ok || !profileData.role) {
        setError("Failed to fetch user profile.");
        return;
      }

      // Save user role
      localStorage.setItem("role", profileData.role);

      // Call parent function with token and role
      onLoginSuccess({
        token: data.token,
        role: profileData.role,
      });

      // 🔒 Now check if admin
      if (profileData.role === "admin") {
        // Now safely fetch users
        const usersRes = await fetch(`${BASE_URL}/api/users`, {
          method: "GET",
          headers: { Authorization: `Bearer ${data.token}` },
        });

        if (!usersRes.ok) {
          const errText = await usersRes.text();
          setError(`Failed to fetch users: ${errText}`);
          return;
        }

        const usersData = await usersRes.json();
        console.log("Fetched users:", usersData);
        // 👉 You can now pass usersData to your app state if needed
      } else {
        console.log("Not an admin. Skipping users fetch.");
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
              name="email"
              autoComplete="email"
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
                name="password"
                autoComplete="current-password"
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
