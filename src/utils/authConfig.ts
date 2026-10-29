import { User, UserRole } from '../types/index.ts';

export const SYSTEM_ROLES: {
  role: UserRole;
  label: string;
  badgeColor: string;
  description: string;
  canCreateForms: boolean;
  canApprove: boolean;
  approvalStage: number; // 0 for Maker, 1 for CSO, 2 for COO, 3 for CFO, 4 for CEO
}[] = [
  {
    role: 'Staff',
    label: 'Staff (Maker)',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
    description: 'Creates new FPU, FPP, and FPPB requests with attachments',
    canCreateForms: true,
    canApprove: false,
    approvalStage: 0,
  },
  {
    role: 'CSO',
    label: 'CSO (Chief Service Officer)',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'Initial operational & strategic review (First level approval)',
    canCreateForms: true,
    canApprove: true,
    approvalStage: 1,
  },
  {
    role: 'COO',
    label: 'COO (Chief Operating Officer)',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    description: 'Operational validation & fleet logistics verification',
    canCreateForms: true,
    canApprove: true,
    approvalStage: 2,
  },
  {
    role: 'CFO',
    label: 'CFO (Chief Financial Officer)',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'Financial budget, tax compliance, and treasury disbursement clearance',
    canCreateForms: true,
    canApprove: true,
    approvalStage: 3,
  },
  {
    role: 'CEO',
    label: 'CEO (Chief Executive Officer)',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    description: 'Final executive authorization & company seal sign-off',
    canCreateForms: true,
    canApprove: true,
    approvalStage: 4,
  },
];

export const MOCK_USERS: Record<UserRole, User> = {
  Staff: {
    id: 'user_staff_01',
    name: 'Christine Natalia',
    email: 'Christine@clx.co.id',
    role: 'Staff',
    title: 'Finance & Project Administration Staff',
    division: 'Finance',
    phone: '08129881234',
    registeredAt: '2026-10-28T10:00:00Z',
  },
  CSO: {
    id: 'user_cso_01',
    name: 'Hartono Darmawan',
    email: 'hartono.darmawan@clx.co.id',
    role: 'CSO',
    title: 'Chief Service Officer',
    division: 'General',
  },
  COO: {
    id: 'user_coo_01',
    name: 'Hendrik Pratama, S.T.',
    email: 'hendrik.pratama@clx.co.id',
    role: 'COO',
    title: 'Chief Operating Officer',
    division: 'Operation',
  },
  CFO: {
    id: 'user_cfo_01',
    name: 'Siti Rahmawati, S.E., Ak., CA',
    email: 'siti.rahmawati@clx.co.id',
    role: 'CFO',
    title: 'Chief Financial Officer',
    division: 'Finance',
  },
  CEO: {
    id: 'user_ceo_01',
    name: 'Hartono Wijaya, M.B.A.',
    email: 'hartono.wijaya@clx.co.id',
    role: 'CEO',
    title: 'Chief Executive Officer',
    division: 'General',
  },
};

/**
 * NextAuth Configuration Code (For Next.js App Router / Pages Router)
 * Place in: /src/app/api/auth/[...nextauth]/route.ts
 */
export const NEXT_AUTH_CONFIG_SNIPPET = `import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "CLX Internal Corporate Sign-In",
      credentials: {
        email: { label: "Corporate Email", type: "email", placeholder: "user@clx.co.id" },
        password: { label: "Password", type: "password" },
        role: { label: "Role", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        // In production: verify hash against secure database
        const role = credentials.role || "Staff";
        return {
          id: credentials.email,
          name: credentials.email.split("@")[0].replace(".", " "),
          email: credentials.email,
          role: role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
`;
