import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // On mount, check if we have a saved token and validate it
  useEffect(() => {
    if (token) {
      // Decode JWT to get user info (without verifying - server verifies)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Check if token is expired
        if (payload.exp * 1000 > Date.now()) {
          setUser({ id: payload.id, name: payload.name, email: payload.email });
        } else {
          // Token expired - clear it
          logout();
        }
      } catch {
        logout();
      }
    }
    setLoading(false);
  }, []);

  function login(userData, newToken) {
    setUser(userData);
    setToken(newToken);
    localStorage.setItem('token', newToken);
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
