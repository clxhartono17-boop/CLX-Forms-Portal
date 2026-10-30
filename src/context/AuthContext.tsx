import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, Division } from '../types/index.ts';
import { syncUserRegistrationToGoogleSheets } from '../utils/googleIntegration.ts';
import { 
  initGoogleAuth, 
  signInWithGoogle, 
  signOutGoogle, 
  appendUserToMasterLogin,
  getGoogleAccessToken 
} from '../utils/googleWorkspace.ts';
import { User as FirebaseUser } from 'firebase/auth';

interface AuthContextType {
  currentUser: User | null;
  currentRole: UserRole | null;
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
    signatureUrl?: string;
  }) => Promise<{ success: boolean; message: string; user: User }>;
  loginUser: (email: string, password?: string) => { success: boolean; message: string };
  logout: () => void;
  switchRegisteredUser: (userId: string) => void;
  isCLevel: boolean;
  canApprove: boolean;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  authModalMode: 'login' | 'register';
  setAuthModalMode: (mode: 'login' | 'register') => void;
  // Google Workspace OAuth State
  googleUser: FirebaseUser | null;
  googleToken: string | null;
  isGoogleConnected: boolean;
  connectGoogle: () => Promise<string | null>;
  disconnectGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const REGISTERED_USERS_KEY = 'clx_registered_users_v4';
const ACTIVE_USER_KEY = 'clx_active_user_v4';

// Pre-registered official C-Level approval officers in Master Login
// Staff/Maker accounts MUST be registered by the user
const INITIAL_OFFICERS: User[] = [
  {
    id: 'usr_dimas_cso',
    name: 'Dimas Wicaksono, M.M.',
    email: 'dimas.wicaksono@clx.co.id',
    password: 'password123',
    role: 'CSO',
    division: 'General',
    title: 'Chief Strategy Officer',
    phone: '0811902123',
    registeredAt: '2026-10-28T08:05:00Z',
  },
  {
    id: 'usr_hendrik_coo',
    name: 'Hendrik Pratama, S.T.',
    email: 'hendrik.pratama@clx.co.id',
    password: 'password123',
    role: 'COO',
    division: 'Operation',
    title: 'Chief Operating Officer',
    phone: '0812990011',
    registeredAt: '2026-10-28T08:10:00Z',
  },
  {
    id: 'usr_siti_cfo',
    name: 'Siti Rahmawati, S.E., Ak., CA',
    email: 'siti.rahmawati@clx.co.id',
    password: 'password123',
    role: 'CFO',
    division: 'Finance',
    title: 'Chief Financial Officer',
    phone: '0813998822',
    registeredAt: '2026-10-28T08:15:00Z',
  },
  {
    id: 'usr_hartono_ceo',
    name: 'Hartono Wijaya, M.B.A.',
    email: 'hartono.wijaya@clx.co.id',
    password: 'password123',
    role: 'CEO',
    division: 'General',
    title: 'Chief Executive Officer',
    phone: '0818001122',
    registeredAt: '2026-10-28T08:20:00Z',
  },
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [registeredUsers, setRegisteredUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem(REGISTERED_USERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse registered users:', e);
    }
    return INITIAL_OFFICERS;
  });

  // CRITICAL: Default to null! No unauthenticated user gets automatically logged in.
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_USER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse active user:', e);
    }
    return null;
  });

  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('register');

  // Google Workspace Auth State
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(registeredUsers));
    } catch (e) {
      console.warn('Failed to save registered users:', e);
    }
  }, [registeredUsers]);

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(ACTIVE_USER_KEY);
      }
    } catch (e) {
      console.warn('Failed to save active user:', e);
    }
  }, [currentUser]);

  const connectGoogle = async (): Promise<string | null> => {
    try {
      const res = await signInWithGoogle();
      setGoogleUser(res.user);
      setGoogleToken(res.accessToken);
      return res.accessToken;
    } catch (err: any) {
      console.error('Google Connect Error:', err);
      throw err;
    }
  };

  const disconnectGoogle = async () => {
    await signOutGoogle();
    setGoogleUser(null);
    setGoogleToken(null);
  };

  const switchRegisteredUser = (userId: string) => {
    const target = registeredUsers.find(u => u.id === userId);
    if (target) {
      setCurrentUser(target);
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
    signatureUrl?: string;
  }): Promise<{ success: boolean; message: string; user: User }> => {
    const cleanEmail = userData.email.trim().toLowerCase();
    
    // Check if email already registered
    const existing = registeredUsers.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      throw new Error(`Email ${cleanEmail} sudah terdaftar! Silakan langsung login menggunakan kata sandi Anda.`);
    }

    const defaultTitle = userData.title || `${userData.role} (${userData.division})`;
    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: userData.name.trim(),
      email: cleanEmail,
      password: userData.password?.trim() || 'clx2026',
      role: userData.role,
      division: userData.division,
      phone: userData.phone || '-',
      title: defaultTitle,
      registeredAt: new Date().toISOString(),
      signatureUrl: userData.signatureUrl,
    };

    // Save to local registered list
    setRegisteredUsers(prev => [...prev, newUser]);
    setCurrentUser(newUser);

    // Sync to Google Sheet tab "Master Login"
    let sheetsSyncSuccess = false;
    const token = googleToken || getGoogleAccessToken();
    if (token) {
      sheetsSyncSuccess = await appendUserToMasterLogin(newUser, token);
    }

    // Always run backend sync fallback as well
    try {
      await syncUserRegistrationToGoogleSheets(newUser);
    } catch (err) {
      console.warn('Backend sync warning:', err);
    }

    const syncStatusMsg = sheetsSyncSuccess
      ? ' dan berhasil ditambahkan langsung ke Google Sheet "Master Login"!'
      : ' dan tersimpan di database sistem CLX!';

    return {
      success: true,
      message: `Akun ${newUser.name} (${newUser.email}) berhasil terdaftar${syncStatusMsg}`,
      user: newUser,
    };
  };

  const loginUser = (email: string, password?: string): { success: boolean; message: string } => {
    const cleanEmail = email.trim().toLowerCase();
    
    if (!cleanEmail) {
      return { success: false, message: 'Harap masukkan alamat email perusahaan Anda.' };
    }

    // STRICT CHECK: User MUST exist in registered users
    const found = registeredUsers.find(u => u.email.toLowerCase() === cleanEmail);
    if (!found) {
      return { 
        success: false, 
        message: `Email "${cleanEmail}" belum terdaftar di sistem CLX! Anda harus melakukan registrasi akun baru terlebih dahulu.` 
      };
    }

    // STRICT CHECK: Validate password
    if (found.password && found.password.trim()) {
      if (!password || password.trim() !== found.password.trim()) {
        return { 
          success: false, 
          message: 'Kata sandi tidak sesuai! Harap periksa kembali kata sandi Anda.' 
        };
      }
    }

    setCurrentUser(found);
    return { success: true, message: `Selamat datang kembali, ${found.name}!` };
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const isLoggedIn = currentUser !== null;
  const currentRole = currentUser?.role || null;
  const isCLevel = !!currentRole && ['CSO', 'COO', 'CFO', 'CEO'].includes(currentRole);
  const canApprove = isCLevel;
  const isGoogleConnected = googleToken !== null || googleUser !== null;

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
        switchRegisteredUser,
        isCLevel,
        canApprove,
        showAuthModal,
        setShowAuthModal,
        authModalMode,
        setAuthModalMode,
        googleUser,
        googleToken,
        isGoogleConnected,
        connectGoogle,
        disconnectGoogle,
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
