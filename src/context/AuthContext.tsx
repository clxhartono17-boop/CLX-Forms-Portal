import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, Division } from '../types/index.ts';
import { MOCK_USERS } from '../utils/authConfig.ts';
import { syncUserRegistrationToGoogleSheets } from '../utils/googleIntegration.ts';

interface AuthContextType {
  currentUser: User;
  currentRole: UserRole;
  registeredUsers: User[];
  isLoggedIn: boolean;
  registerUser: (userData: {
    name: string;
    email: string;
    password?: string;
    role: UserRole;
    division: Division;
    phone?: string;
    title?: string;
  }) => Promise<{ success: boolean; message: string; user: User }>;
  loginUser: (email: string, password?: string) => { success: boolean; message: string };
  logout: () => void;
  switchRole: (role: UserRole) => void;
  isCLevel: boolean;
  canApprove: boolean;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const REGISTERED_USERS_KEY = 'clx_registered_users_v2';
const ACTIVE_USER_KEY = 'clx_active_user_v2';

const DEFAULT_USERS: User[] = [
  MOCK_USERS.Staff,
  MOCK_USERS.CSO,
  MOCK_USERS.COO,
  MOCK_USERS.CFO,
  MOCK_USERS.CEO,
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [registeredUsers, setRegisteredUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem(REGISTERED_USERS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse registered users:', e);
    }
    return DEFAULT_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_USER_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse active user:', e);
    }
    return MOCK_USERS.Staff;
  });

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(true);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(registeredUsers));
    } catch (e) {
      console.warn('Failed to save registered users:', e);
    }
  }, [registeredUsers]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(currentUser));
    } catch (e) {
      console.warn('Failed to save active user:', e);
    }
  }, [currentUser]);

  const switchRole = (role: UserRole) => {
    const existing = registeredUsers.find(u => u.role === role);
    if (existing) {
      setCurrentUser(existing);
    } else if (MOCK_USERS[role]) {
      setCurrentUser(MOCK_USERS[role]);
    }
  };

  const registerUser = async (userData: {
    name: string;
    email: string;
    password?: string;
    role: UserRole;
    division: Division;
    phone?: string;
    title?: string;
  }): Promise<{ success: boolean; message: string; user: User }> => {
    const defaultTitle = userData.title || `${userData.role} (${userData.division})`;
    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: userData.name.trim(),
      email: userData.email.trim().toLowerCase(),
      password: userData.password,
      role: userData.role,
      division: userData.division,
      phone: userData.phone || '-',
      title: defaultTitle,
      registeredAt: new Date().toISOString(),
    };

    // Append to registered users list (update if exists)
    setRegisteredUsers(prev => {
      const filtered = prev.filter(u => u.email.toLowerCase() !== newUser.email.toLowerCase());
      return [...filtered, newUser];
    });

    setCurrentUser(newUser);
    setIsLoggedIn(true);

    // Sync to Google Sheets tab "Master Login"
    try {
      await syncUserRegistrationToGoogleSheets(newUser);
    } catch (err) {
      console.warn('Google Sheets Master Login sync notice:', err);
    }

    return {
      success: true,
      message: `Akun ${newUser.name} berhasil didaftarkan dan disimpan ke Google Sheet "Master Login"!`,
      user: newUser,
    };
  };

  const loginUser = (email: string, _password?: string): { success: boolean; message: string } => {
    const found = registeredUsers.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (found) {
      setCurrentUser(found);
      setIsLoggedIn(true);
      return { success: true, message: `Selamat datang kembali, ${found.name}!` };
    }
    return { success: false, message: 'Email tidak ditemukan. Silakan registrasi terlebih dahulu.' };
  };

  const logout = () => {
    setIsLoggedIn(false);
    setShowAuthModal(true);
  };

  const currentRole = currentUser?.role || 'Staff';
  const isCLevel = ['CSO', 'COO', 'CFO', 'CEO'].includes(currentRole);
  const canApprove = isCLevel;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRole,
        registeredUsers,
        isLoggedIn,
        registerUser,
        loginUser,
        logout,
        switchRole,
        isCLevel,
        canApprove,
        showAuthModal,
        setShowAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
