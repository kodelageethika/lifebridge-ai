import React, { useState, useEffect } from 'react';
import { useAuth, AuthModalTab } from '../../context/AuthContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { OrganType, UserRole, Hospital } from '../../types/index.ts';
import { apiRequest } from '../../services/api.ts';
import {
  X,
  Lock,
  Mail,
  User,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  HeartHandshake,
} from 'lucide-react';

const DEMO_ACCOUNTS: {
  role: UserRole;
  label: string;
  badge: string;
  email: string;
  redirectView: 'dashboard' | 'patient-portal';
}[] = [
  { role: 'coordinator', label: 'Transplant Coordinator', badge: 'Ops', email: 'coordinator@lifebridge.demo', redirectView: 'dashboard' },
  { role: 'medical', label: 'Transplant Surgeon', badge: 'Clinical', email: 'surgeon@lifebridge.demo', redirectView: 'dashboard' },
  { role: 'hospital', label: 'Hospital Authority', badge: 'Hospital', email: 'hospital@lifebridge.demo', redirectView: 'dashboard' },
  { role: 'admin', label: 'Platform Admin', badge: 'Admin', email: 'admin@lifebridge.demo', redirectView: 'dashboard' },
  { role: 'donor', label: 'Organ Donor Account', badge: 'Patient', email: 'donor@lifebridge.demo', redirectView: 'patient-portal' },
  { role: 'recipient', label: 'Recipient Account', badge: 'Patient', email: 'recipient@lifebridge.demo', redirectView: 'patient-portal' },
];

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    authModalTab,
    closeAuthModal,
    login,
    register,
    loginWithGoogle,
    requestPasswordReset,
    confirmPasswordReset,
  } = useAuth();
  const { setActiveView, addToast } = useApp();

  const [tab, setTab] = useState<AuthModalTab>(authModalTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [regRole, setRegRole] = useState<'donor' | 'recipient' | 'hospital'>('donor');
  const [bloodGroup, setBloodGroup] = useState<'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-'>('O+');
  const [organType, setOrganType] = useState<OrganType>('kidney');
  const [age, setAge] = useState('28');
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalCity, setHospitalCity] = useState('');
  const [hospitalState, setHospitalState] = useState('');
  const [hospitalLicense, setHospitalLicense] = useState('');

  // Reset password flow
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetRequested, setResetRequested] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setTab(authModalTab);
    setErrorMsg(null);
  }, [authModalTab, authModalOpen]);

  if (!authModalOpen) return null;

  const routeAfterLogin = (role: UserRole) => {
    if (role === 'donor' || role === 'recipient') {
      setActiveView('patient-portal');
    } else {
      setActiveView('dashboard');
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const loggedUser = await login(email, password);
      addToast('success', 'Signed In', `Authenticated cleanly as ${loggedUser.displayName} (${loggedUser.role}).`);
      routeAfterLogin(loggedUser.role);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoQuickSignIn = async (demoEmail: string) => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const loggedUser = await login(demoEmail, 'LifeBridge@2026');
      addToast('success', 'Demo Session Authenticated', `Verified server session issued for ${loggedUser.displayName}.`);
      routeAfterLogin(loggedUser.role);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Demo login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      if (regRole === 'hospital') {
        await apiRequest<{ hospital: Hospital }>('/api/v1/hospitals/register', {
          method: 'POST',
          body: {
            name: hospitalName.trim(),
            city: hospitalCity.trim(),
            state: hospitalState.trim(),
            tier: 'TRANSPLANT_CENTER',
            licenseNumber: hospitalLicense.trim(),
            contactEmail: email.trim(),
            organsSupported: [organType],
            adminDisplayName: displayName.trim(),
            adminPassword: password,
          },
        });
        const loggedHospitalUser = await login(email.trim(), password);
        addToast(
          'info',
          'Hospital Registered (Pending Approval)',
          `${hospitalName.trim()} submitted. Awaiting Platform Administrator approval.`
        );
        routeAfterLogin(loggedHospitalUser.role);
        setActiveView('readiness');
        return;
      }

      const newUser = await register({
        email,
        password,
        displayName,
        role: regRole,
        bloodGroup,
        organType,
        age: parseInt(age, 10) || 28,
      });
      addToast('success', 'Account Created', `Registered ${newUser.role} account for ${newUser.displayName}.`);
      routeAfterLogin(newUser.role);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const loggedUser = await loginWithGoogle();
      addToast('success', 'Google Identity Verified', `Signed in as ${loggedUser.displayName}.`);
      routeAfterLogin(loggedUser.role);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Google Sign-In could not complete');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await requestPasswordReset(email);
      setResetRequested(true);
      if (res.previewResetToken) {
        setResetToken(res.previewResetToken);
      }
      addToast('info', 'Reset Token Issued', 'If the email is registered, a one-time reset token is ready.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Reset request failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await confirmPasswordReset(resetToken, newPassword);
      addToast('success', 'Password Updated', 'Your password was rotated. Sign in with your new password.');
      setResetRequested(false);
      setResetToken('');
      setNewPassword('');
      setTab('signin');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Reset confirmation failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-[#152232] rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E98F83] text-white flex items-center justify-center">
              <HeartHandshake size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#243B55] dark:text-white leading-tight">
                LifeBridge AI Portal Sign In
              </h2>
              <p className="text-[11px] text-[#788394] dark:text-[#94A3B8]">
                Verified server authentication & role-based clinical governance
              </p>
            </div>
          </div>
          <button
            onClick={closeAuthModal}
            className="p-1.5 rounded-xl text-[#788394] hover:bg-[#F8F5EF] dark:hover:bg-[#1E2E40] cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F8F5EF] dark:bg-[#0E1722] rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] text-xs">
          {[
            { id: 'signin', label: 'Sign In' },
            { id: 'register', label: 'Create Account' },
            { id: 'reset', label: 'Reset Password' },
          ].map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id as AuthModalTab);
                setErrorMsg(null);
              }}
              className={`flex-1 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer ${
                tab === item.id
                  ? 'bg-white dark:bg-[#152232] text-[#243B55] dark:text-white shadow-xs font-bold'
                  : 'text-[#788394] hover:text-[#243B55] dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* TAB: SIGN IN */}
        {tab === 'signin' && (
          <div className="space-y-4">
            <form onSubmit={handleSignIn} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#243B55] dark:text-white mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-3 text-[#788394]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="coordinator@lifebridge.demo"
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#E98F83]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#243B55] dark:text-white mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-3 text-[#788394]" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#E98F83]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 text-xs font-bold bg-[#E98F83] hover:bg-[#D87B6F] text-white rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Authenticating...' : 'Sign In Securely'}
              </button>
            </form>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="w-full py-2 text-xs font-semibold bg-[#F8F5EF] dark:bg-[#1E2E40] hover:bg-[#EFE7DE] text-[#243B55] dark:text-white rounded-xl border border-[#EFE7DE] dark:border-[#273A52] transition-colors cursor-pointer"
            >
              Continue with Google Identity (Donor Portal)
            </button>

            {/* Quick Academic Demo Persona Login (Real Backend Authentication) */}
            <div className="pt-3 border-t border-[#EFE7DE] dark:border-[#273A52] space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-[#788394] uppercase tracking-wider">
                  Academic Demo Sign-In (Real Auth)
                </span>
                <span className="font-mono text-[#788394]">pw: LifeBridge@2026</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {DEMO_ACCOUNTS.map(acc => (
                  <button
                    key={acc.role}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleDemoQuickSignIn(acc.email)}
                    className="px-2.5 py-2 text-left text-[11px] rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#FAF6F0] dark:bg-[#111A26] hover:border-[#E98F83] transition-colors flex items-center justify-between gap-1 cursor-pointer"
                  >
                    <span className="font-semibold text-[#243B55] dark:text-white truncate">
                      {acc.label}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#F8E8E3] dark:bg-[#2C1C1A] text-[#E98F83] shrink-0">
                      {acc.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: REGISTER */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-[#243B55] dark:text-white mb-1">
                Full Name
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-3 text-[#788394]" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="e.g. Ananya Rao"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className={regRole === 'hospital' ? 'col-span-2' : ''}>
                <label className="block font-semibold text-[#243B55] dark:text-white mb-1">
                  Account Type
                </label>
                <select
                  value={regRole}
                  onChange={e => setRegRole(e.target.value as 'donor' | 'recipient' | 'hospital')}
                  className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white"
                >
                  <option value="donor">Organ Donor</option>
                  <option value="recipient">Recipient Candidate</option>
                  <option value="hospital">Hospital Facility (Pending Admin Approval)</option>
                </select>
              </div>
              {regRole !== 'hospital' && (
                <div>
                  <label className="block font-semibold text-[#243B55] dark:text-white mb-1">
                    Blood Group
                  </label>
                  <select
                    value={bloodGroup}
                    onChange={e => setBloodGroup(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white"
                  >
                    {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {regRole === 'hospital' ? (
              <div className="space-y-3">
                <div>
                  <label className="block font-semibold text-[#243B55] dark:text-white mb-1">
                    Hospital Facility Name
                  </label>
                  <input
                    type="text"
                    required
                    value={hospitalName}
                    onChange={e => setHospitalName(e.target.value)}
                    placeholder="e.g. Rainbow Transplant Institute"
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-semibold text-[#243B55] dark:text-white mb-1">City</label>
                    <input
                      type="text"
                      required
                      value={hospitalCity}
                      onChange={e => setHospitalCity(e.target.value)}
                      placeholder="Hyderabad"
                      className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#243B55] dark:text-white mb-1">State</label>
                    <input
                      type="text"
                      required
                      value={hospitalState}
                      onChange={e => setHospitalState(e.target.value)}
                      placeholder="Telangana"
                      className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#243B55] dark:text-white mb-1">License ID</label>
                    <input
                      type="text"
                      required
                      value={hospitalLicense}
                      onChange={e => setHospitalLicense(e.target.value)}
                      placeholder="TS-THOTA-26"
                      className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#243B55] dark:text-white mb-1">
                    Primary Organ
                  </label>
                  <select
                    value={organType}
                    onChange={e => setOrganType(e.target.value as OrganType)}
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white capitalize"
                  >
                    {['kidney', 'liver', 'heart', 'lung', 'pancreas', 'intestine'].map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#243B55] dark:text-white mb-1">
                    Age
                  </label>
                  <input
                    type="number"
                    min={18}
                    max={100}
                    value={age}
                    onChange={e => setAge(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block font-semibold text-[#243B55] dark:text-white mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.org"
                className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#243B55] dark:text-white mb-1">
                Password (min 8 chars)
              </label>
              <input
                type="password"
                minLength={8}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Create a strong password"
                className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 text-xs font-bold bg-[#E98F83] hover:bg-[#D87B6F] text-white rounded-xl transition-all shadow-xs cursor-pointer"
            >
              {submitting ? 'Creating Account...' : 'Register Account'}
            </button>
          </form>
        )}

        {/* TAB: RESET PASSWORD */}
        {tab === 'reset' && (
          <div className="space-y-4 text-xs">
            {!resetRequested ? (
              <form onSubmit={handleRequestReset} className="space-y-3">
                <p className="text-[#788394]">
                  Enter your registered account email to issue a single-use password reset token.
                </p>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="account@lifebridge.demo"
                  className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 font-bold bg-[#243B55] hover:bg-[#1B2D42] text-white rounded-xl cursor-pointer"
                >
                  Request Reset Token
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirmReset} className="space-y-3">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 size={15} />
                  <span>Reset token generated for demo verification.</span>
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[#243B55] dark:text-white">
                    Reset Token
                  </label>
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={e => setResetToken(e.target.value)}
                    className="w-full font-mono p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[#243B55] dark:text-white">
                    New Password (min 8 chars)
                  </label>
                  <input
                    type="password"
                    minLength={8}
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 font-bold bg-[#E98F83] hover:bg-[#D87B6F] text-white rounded-xl cursor-pointer"
                >
                  Confirm New Password
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
