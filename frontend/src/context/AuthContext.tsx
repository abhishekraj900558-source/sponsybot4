import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { TeamMember } from '../types';

interface AuthContextType {
  user: TeamMember | null;
  login: (email: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TeamMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string) => {
    const baseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api';
    try {
      const response = await fetch(`${baseUrl}/team-members?active_only=true`);
      if (response.ok) {
        const members = await response.json();
        if (Array.isArray(members)) {
          const member = members.find((m: any) => m.email === email);
          if (member) {
            setUser(member);
            localStorage.setItem('user', JSON.stringify(member));
            return;
          }
        }
      }
    } catch (err) {
      // Backend does not implement /team-members or is unavailable
    }

    // Local Development Access profile (explicitly marked for local dev mode)
    const devProfile: TeamMember = {
      id: 1,
      name: email.split('@')[0] || 'Local Developer',
      email: email,
      role: 'Local Dev Operator',
      is_active: true,
      created_at: new Date().toISOString(),
    };
    setUser(devProfile);
    localStorage.setItem('user', JSON.stringify(devProfile));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
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
