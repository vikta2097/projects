const SignupForm = ({ onLoginClick }) => {
  // ... your state hooks

  const BASE_URL = "https://projects-2-c3ms.onrender.com";

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    // validation...

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullname: name, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Signup failed");
        return;
      }

      alert("Signup successful! Please login.");
      setTimeout(() => onLoginClick(), 1500);
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      {/* ...header */}
      <div className="auth-form">
        {error && <div className="error-message">⚠️ {error}</div>}

        <form onSubmit={handleSignup}>
          {/* Full Name, Email, Password, Confirm Password inputs */}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        {/* footer with login link */}
      </div>
    </div>
  );
};
