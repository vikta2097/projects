import React from "react";

const NonEmployeeMessage = ({ message, onLogout }) => {
  const handleLogout = () => {
    if (onLogout) {
      onLogout(); // clear localStorage and reset auth state
    }

    // Hard redirect to login in case navigate is not available
    window.location.href = "/login";
  };

  return (
    <div
      style={{
        maxWidth: 600,
        margin: "100px auto",
        padding: 20,
        textAlign: "center",
        border: "1px solid #ddd",
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        backgroundColor: "#fafafa",
      }}
    >
      <h2 style={{ color: "#c0392b" }}>
        NO EMPLOYEE Records FOR THIS USER. Please Contact ADMIN,{" "}
        <span style={{ color: "red" }}>THANKS</span>
      </h2>
      <p style={{ fontSize: 18 }}>{message}</p>

      <button
        onClick={handleLogout}
        style={{
          marginTop: 30,
          padding: "10px 20px",
          backgroundColor: "#dc3545",
          color: "#fff",
          border: "none",
          borderRadius: 5,
          cursor: "pointer",
        }}
      >
        Logout and Go to Login
      </button>
    </div>
  );
};

export default NonEmployeeMessage;
