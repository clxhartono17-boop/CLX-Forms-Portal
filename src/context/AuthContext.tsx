import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, Division } from '../types/index.ts';
import { syncUserRegistrationToGoogleSheets } from '../utils/googleIntegration.ts';
import { 
  initGoogleAuth, 
  signInWithGoogle, 
  signOutGoogle, 
  appendUserToMasterLogin,
  getGoogleAccessToken,
  autoSyncUserToGoogleSheet,
  hasServerSyncCapability,
  GoogleAuthUser
} from '../utils/googleWorkspace.ts';
import { 
  ADMIN_EMAIL, 
  isAdminUser, 
  hasMandatoryDigitalSignature,
  canAssignRole,
} from '../utils/adminAuth.ts';

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
  updateUserRole: (userId: string, newRole: UserRole, newTitle?: string) => Promise<User>;
  refreshRegisteredUsers: () => Promise<void>;
  loginUser: (email: string, password?: string) => { success: boolean; message: string };
  logout: () => void;
  switchRegisteredUser: (userId: string) => void;
  isCLevel: boolean;
  canApprove: boolean;
  isAdmin: boolean;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  authModalMode: 'login' | 'register';
  setAuthModalMode: (mode: 'login' | 'register') => void;
  // Google Workspace OAuth State
  googleUser: GoogleAuthUser | null;
  googleToken: string | null;
  isGoogleConnected: boolean;
  connectGoogle: () => Promise<string | null>;
  disconnectGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const REGISTERED_USERS_KEY = 'clx_registered_users_v4';
const ACTIVE_USER_KEY = 'clx_active_user_v4';

// Pre-registered official C-Level approval officers in Master Login
// Staff/Maker & CSO accounts can be freely registered by anyone; CEO/COO/CFO are Admin-only
const INITIAL_OFFICERS: User[] = [
  {
    id: 'usr_hartono_admin',
    name: 'Hartono (Admin CLX)',
    email: ADMIN_EMAIL,
    password: 'password123',
    role: 'CEO',
    division: 'General',
    title: 'Administrator & CEO',
    phone: '0811902123',
    registeredAt: '2026-10-28T08:00:00Z',
  },
  {
    id: 'usr_hartono_cso',
    name: 'Hartono Darmawan',
    email: 'hartono.darmawan@clx.co.id',
    password: 'password123',
    role: 'CSO',
    division: 'Services',
    title: 'Chief Service Officer',
    phone: '0811902123',
    registeredAt: '2026-10-28T08:05:00Z',
  },
  {
    id: 'usr_dimas_cso',
    name: 'Dimas Wicaksono, M.M.',
    email: 'dimas.wicaksono@clx.co.id',
    password: 'password123',
    role: 'CSO',
    division: 'General',
    title: 'Chief Strategy Officer',
    phone: '0811902124',
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

function mergeUsersByEmail(baseUsers: User[], incomingUsers: User[]): User[] {
  const byEmail = new Map<string, User>();
  for (const u of baseUsers) {
    const key = (u.email || '').trim().toLowerCase();
    if (key) byEmail.set(key, u);
  }
  for (const u of incomingUsers) {
    const key = (u.email || '').trim().toLowerCase();
    if (!key) continue;
    const prev = byEmail.get(key);
    byEmail.set(key, prev ? { ...prev, ...u } : u);
  }
  return Array.from(byEmail.values());
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [registeredUsers, setRegisteredUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem(REGISTERED_USERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return mergeUsersByEmail(INITIAL_OFFICERS, parsed);
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
  const [googleUser, setGoogleUser] = useState<GoogleAuthUser | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  const refreshRegisteredUsers = async () => {
    try {
      const res = await fetch('/api/users', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success && Array.isArray(data.users) && data.users.length > 0) {
        setRegisteredUsers(prev => {
          const merged = mergeUsersByEmail(prev, data.users);
          setCurrentUser(curr => {
            if (!curr) return curr;
            const match = merged.find(
              u => u.email.trim().toLowerCase() === curr.email.trim().toLowerCase()
            );
            return match ? { ...curr, role: match.role, title: match.title } : curr;
          });
          return merged;
        });
      }
    } catch {
      // Static deploy without Node API: continue with localStorage users
    }
  };

  useEffect(() => {
    refreshRegisteredUsers();
    const onFocus = () => {
      if (document.visibilityState === 'visible') {
        refreshRegisteredUsers();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setGoogleUser({
          email: user.email,
          displayName: user.displayName,
          uid: user.uid,
          photoURL: user.photoURL,
        });
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
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('clx-google-connected'));
      }
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
    const callerIsAdmin = isAdminUser(currentUser, googleUser);

    // Enforce Admin-only restriction for CEO, COO, and CFO roles
    if (!canAssignRole(userData.role, callerIsAdmin)) {
      throw new Error(
        'Otoritas ditolak: Role COO, CFO, dan CEO hanya dapat ditentukan oleh Admin (clx.hartono17@gmail.com).'
      );
    }

    // STRICT MANDATORY CHECK: Sign digital must be attached
    if (!hasMandatoryDigitalSignature(userData.signatureUrl)) {
      throw new Error(
        'Pendaftaran gagal: Tanda tangan digital (Sign Digital) bersifat mandatori dan wajib dilampirkan.'
      );
    }

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

    // Persist to shared Node server store so Admin & other devices see new registrations immediately
    try {
      const srvRes = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: newUser,
          requesterEmail: currentUser?.email || googleUser?.email || '',
        }),
      });
      if (srvRes.status === 403 || srvRes.status === 409) {
        const errData = await srvRes.json().catch(() => null);
        throw new Error(errData?.error || 'Registrasi ditolak oleh server.');
      }
    } catch (srvErr: any) {
      if (srvErr?.message && (srvErr.message.includes('Otoritas ditolak') || srvErr.message.includes('sudah terdaftar'))) {
        throw srvErr;
      }
      // On static deployment without /api/users, proceed with localStorage + Webhook
    }

    // Save to local registered list
    setRegisteredUsers(prev => mergeUsersByEmail(prev, [newUser]));
    // Keep Admin logged in when Admin registers another user; log public user straight into their new account
    if (!callerIsAdmin || !currentUser) {
      setCurrentUser(newUser);
    }

    // Sync to Google Sheet tab "master Login" via Webhook or OAuth
    let sheetsSyncSuccess = false;
    let masterTabName = 'master Login';
    try {
      const webhookOk = await autoSyncUserToGoogleSheet(newUser);
      if (webhookOk) {
        sheetsSyncSuccess = true;
      } else {
        const token = googleToken || getGoogleAccessToken();
        if (token) {
          const res = await appendUserToMasterLogin(newUser, token);
          sheetsSyncSuccess = res.success;
          if (res.sheetTitle) masterTabName = res.sheetTitle;
        }
      }
    } catch (e) {
      console.warn('Auto-sync user notice:', e);
    }

    // Run backend Service Account fallback only if needed & configured
    if (!sheetsSyncSuccess && hasServerSyncCapability()) {
      try {
        await syncUserRegistrationToGoogleSheets(newUser);
        sheetsSyncSuccess = true;
      } catch (err) {
        console.warn('Backend sync warning:', err);
      }
    }

    const syncStatusMsg = sheetsSyncSuccess
      ? ` dan berhasil ditambahkan langsung ke tab "${masterTabName}" Google Sheet!`
      : ' dan tersimpan di database sistem CLX!';

    return {
      success: true,
      message: `Akun ${newUser.name} (${newUser.email}) berhasil terdaftar${syncStatusMsg}`,
      user: newUser,
    };
  };

  const updateUserRole = async (userId: string, newRole: UserRole, newTitle?: string): Promise<User> => {
    if (!isAdminUser(currentUser, googleUser)) {
      throw new Error(
        'Otoritas ditolak: Hanya Admin (clx.hartono17@gmail.com) yang dapat menetapkan atau mengubah role CEO, COO, dan CFO.'
      );
    }

    const target = registeredUsers.find(u => u.id === userId);
    if (!target) {
      throw new Error('Pengguna tidak ditemukan.');
    }

    const updatedTitle = (newTitle || '').trim() || `${newRole} (${target.division || 'General'})`;
    const updatedUser: User = {
      ...target,
      role: newRole,
      title: updatedTitle,
    };

    try {
      const srvRes = await fetch(`/api/users/${encodeURIComponent(userId)}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: newRole,
          title: updatedTitle,
          requesterEmail: currentUser?.email || googleUser?.email || '',
          userFallback: target,
        }),
      });
      if (srvRes.status === 403 || srvRes.status === 400) {
        const errData = await srvRes.json().catch(() => null);
        throw new Error(errData?.error || 'Gagal memperbarui role pengguna.');
      }
    } catch (err: any) {
      if (err?.message?.includes('Otoritas ditolak') || err?.message?.includes('tidak valid')) {
        throw err;
      }
    }

    setRegisteredUsers(prev => prev.map(u => (u.id === userId ? updatedUser : u)));
    if (currentUser?.id === userId) {
      setCurrentUser(updatedUser);
    }

    autoSyncUserToGoogleSheet(updatedUser).catch(err => {
      console.warn('Background user role sync notice:', err);
    });

    return updatedUser;
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
  const isAdmin = isAdminUser(currentUser, googleUser);
  const isGoogleConnected = googleToken !== null || googleUser !== null;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRole,
        registeredUsers,
        isLoggedIn,
        registerUser,
        updateUserRole,
        refreshRegisteredUsers,
        loginUser,
        logout,
        switchRegisteredUser,
        isCLevel,
        canApprove,
        isAdmin,
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
