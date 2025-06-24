import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

const PrivateRoute = ({ children }) => {
  const [isValid, setIsValid] = useState(null); // null = loading

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsValid(false);
      return;
    }

    fetch("http://localhost:3300/api/validate-token", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Invalid token");
        return res.json();
      })
      .then(() => setIsValid(true))
      .catch(() => {
        localStorage.removeItem("token");
        setIsValid(false);
      });
  }, []);

  if (isValid === null) return <div>Loading...</div>;

  return isValid ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;
