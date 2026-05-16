import { createContext, useContext, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [company, setCompany] = useState(() => {
    const stored = localStorage.getItem("company");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  async function login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    const { access_token, user } = res.data;
    localStorage.setItem("token", access_token);
    localStorage.setItem("user", JSON.stringify(user));
    setUser(user);
    // Fetch company details including logo if applicable
    if (user.company_id) {
      try {
        const cRes = await api.get(`/companies/${user.company_id}`, {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        localStorage.setItem("company", JSON.stringify(cRes.data));
        setCompany(cRes.data);
      } catch {}
    }
    return user;
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("company");
    setUser(null);
    setCompany(null);
  }

  function refreshCompany(updated) {
    localStorage.setItem("company", JSON.stringify(updated));
    setCompany(updated);
  }

  return (
    <AuthContext.Provider value={{ user, company, login, logout, loading, refreshCompany }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
