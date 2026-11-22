import { useEffect, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  Package,
  Pencil,
  Plus,
  Settings2,
  ShoppingBag,
  UserCircle2,
  UserPlus,
  Wallet,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  formatBuyerAccountLabel,
  formatPhp,
  type DeliveryVaultItem,
  type StoreOrder,
  type TopUpRequest,
  type UserProfile,
} from '../types/store';
import { getDeliveryVaultUnitsForOrder } from '../lib/storeService';

interface AccountAuthModalProps {
  isOpen: boolean;
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  initialTab?: 'overview' | 'topups' | 'orders';
  topUpRequests: TopUpRequest[];
  orders: StoreOrder[];
  onClose: () => void;
  onSignInGoogle: () => Promise<void>;
  onSignInUsername: (username: string, password: string) => Promise<void>;
  onRegisterUsername: (
    username: string,
    password: string,
    optionalEmail?: string
  ) => Promise<void>;
  onSignOut: () => Promise<void>;
  onUpdateDisplayName: (nextName: string) => Promise<void>;
  onUpdateContactEmail: (nextEmail: string) => Promise<void>;
  onOpenTopUp: () => void;
  onOpenOwnerStudio: () => void;
}

function formatTs(ts?: { toMillis?: () => number } | null): string {
  if (!ts || typeof ts.toMillis !== 'function') return 'Just now';
  try {
    return new Date(ts.toMillis()).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'Recent';
  }
}

export function AccountAuthModal({
  isOpen,
  user,
  profile,
  isAdmin,
  initialTab = 'overview',
  topUpRequests,
  orders,
  onClose,
  onSignInGoogle,
  onSignInUsername,
  onRegisterUsername,
  onSignOut,
  onUpdateDisplayName,
  onUpdateContactEmail,
  onOpenTopUp,
  onOpenOwnerStudio,
}: AccountAuthModalProps) {
  const [tab, setTab] = useState<'overview' | 'topups' | 'orders'>(initialTab);
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [optionalEmailInput, setOptionalEmailInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [signInBusy, setSignInBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [zoomProof, setZoomProof] = useState<string | null>(null);
  const [vaultCache, setVaultCache] = useState<
    Record<string, DeliveryVaultItem[] | 'loading'>
  >({});
  const [copiedOrderSlot, setCopiedOrderSlot] = useState<string | null>(null);

  const [copiedNoteOrderId, setCopiedNoteOrderId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setAuthError(null);
      setEmailError(null);
      setEditingName(false);
      setEditingEmail(false);
      setPasswordInput('');
      setShowPassword(false);
      setCopiedOrderSlot(null);
      setCopiedNoteOrderId(null);
      setNameInput(profile?.displayName || user?.displayName || '');
      setEmailInput(profile?.contactEmail || '');
    }
  }, [
    isOpen,
    initialTab,
    profile?.displayName,
    profile?.contactEmail,
    user?.displayName,
  ]);

  useEffect(() => {
    if (!isOpen || !user || tab !== 'orders') return;
    let cancelled = false;
    const deliveredOrders = orders.filter(
      (o) => o.deliveryStatus === 'Delivered' && o.stockId && !vaultCache[o.id]
    );
    if (deliveredOrders.length === 0) return;

    setVaultCache((prev) => {
      const next = { ...prev };
      deliveredOrders.forEach((ord) => {
        if (!next[ord.id]) {
          next[ord.id] = 'loading';
        }
      });
      return next;
    });

    deliveredOrders.forEach((ord) => {
      getDeliveryVaultUnitsForOrder({
        stockId: ord.stockId,
        quantity: ord.quantity,
        startUnitIndex: ord.startUnitIndex,
      }).then((items) => {
        if (!cancelled) {
          setVaultCache((curr) => ({ ...curr, [ord.id]: items }));
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, user, tab, orders, vaultCache]);

  if (!isOpen) return null;

  const accountLabel = user
    ? formatBuyerAccountLabel(
        profile?.email || user.email,
        profile?.username,
        profile?.contactEmail
      )
    : '';

  const handleUsernameAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSignInBusy(true);
    try {
      if (authMode === 'register') {
        await onRegisterUsername(
          usernameInput,
          passwordInput,
          optionalEmailInput
        );
      } else {
        await onSignInUsername(usernameInput, passwordInput);
      }
      setPasswordInput('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : String(err));
    } finally {
      setSignInBusy(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setGoogleBusy(true);
    try {
      await onSignInGoogle();
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes('auth/unauthorized-domain')) {
        setAuthError(
          `Domain "${window.location.hostname}" is not authorized yet in Firebase Authentication. Add it in Firebase Console -> Authentication -> Settings -> Authorized domains.`
        );
      } else if (raw.includes('auth/popup-blocked')) {
        setAuthError(
          'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.'
        );
      } else if (raw.includes('auth/popup-closed-by-user')) {
        setAuthError('Sign-in popup was closed before completing.');
      } else {
        setAuthError(raw);
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleSaveName = async (e: FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setSavingName(true);
    try {
      await onUpdateDisplayName(nameInput.trim());
      setEditingName(false);
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveContactEmail = async (e: FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setSavingEmail(true);
    try {
      await onUpdateContactEmail(emailInput.trim());
      setEditingEmail(false);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingEmail(false);
    }
  };

  const pendingTopUps = topUpRequests.filter((r) => r.status === 'Pending').length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Customer Account & Wallet"
    >
      <div
        className="w-full max-w-2xl bg-[#12141C] border border-white/10 rounded-xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/20 text-[#60A5FA] flex items-center justify-center shrink-0">
              {user ? (
                <Wallet className="w-4 h-4" />
              ) : (
                <UserCircle2 className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-base sm:text-lg text-white truncate">
                {user ? 'My Account & PHP Wallet' : 'Customer Login & Wallet'}
              </h2>
              <p className="text-xs text-[#9CA3AF] truncate">
                {user
                  ? accountLabel
                  : 'Sign in with your username & password — no Gmail required.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close account modal"
            className="p-2 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {!user ? (
          <div className="p-6 sm:p-8 space-y-5 max-w-md mx-auto">
            {/* Sign In vs Create Account Toggle */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-[#0C0E14] border border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setAuthError(null);
                }}
                className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  authMode === 'signin'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setAuthError(null);
                }}
                className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            <div className="space-y-1 text-center">
              <h3 className="font-display font-bold text-lg text-white">
                {authMode === 'signin'
                  ? 'Welcome Back to Kozuo Store'
                  : 'Create Your Member Account'}
              </h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                {authMode === 'signin'
                  ? 'Enter your saved username and password to restore your PHP wallet balance and order history.'
                  : 'Pick a unique username and password so your PHP balance is permanently saved with no duplicate accounts.'}
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 text-left leading-relaxed">
                {authError}
              </div>
            )}

            <form onSubmit={handleUsernameAuthSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#D1D5DB]">
                  Username
                </label>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  minLength={BLUEPRINT_LIMITS.USER.USERNAME_MIN}
                  maxLength={BLUEPRINT_LIMITS.USER.USERNAME_MAX}
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="e.g. kozuo_buyer01"
                  className="w-full h-10 px-3.5 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                />
                <p className="text-[11px] text-[#6B7280]">
                  3–24 characters: letters, numbers, and underscore (_) only.
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#D1D5DB]">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={
                      authMode === 'register'
                        ? 'new-password'
                        : 'current-password'
                    }
                    minLength={6}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full h-10 pl-3.5 pr-10 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#9CA3AF] hover:text-white cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {authMode === 'register' && (
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-[#D1D5DB]">
                    Gmail / Email{' '}
                    <span className="text-[#6B7280] font-normal">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    maxLength={BLUEPRINT_LIMITS.USER.EMAIL_MAX}
                    value={optionalEmailInput}
                    onChange={(e) => setOptionalEmailInput(e.target.value)}
                    placeholder="Leave blank if you don't use Gmail"
                    className="w-full h-10 px-3.5 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={signInBusy || googleBusy}
                className="w-full h-10 inline-flex items-center justify-center gap-2 px-5 rounded-lg text-sm font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white transition-colors cursor-pointer"
              >
                {signInBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : authMode === 'register' ? (
                  <UserPlus className="w-4 h-4" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                <span>
                  {signInBusy
                    ? authMode === 'register'
                      ? 'Creating account...'
                      : 'Signing in...'
                    : authMode === 'register'
                    ? 'Create Account'
                    : 'Sign In'}
                </span>
              </button>
            </form>

            <div className="relative flex items-center py-1">
              <div className="flex-1 border-t border-white/[0.08]" />
              <span className="px-3 text-[11px] uppercase tracking-wider text-[#6B7280]">
                or optional
              </span>
              <div className="flex-1 border-t border-white/[0.08]" />
            </div>

            <button
              type="button"
              disabled={signInBusy || googleBusy}
              onClick={handleGoogleLogin}
              className="w-full h-10 inline-flex items-center justify-center gap-2 px-5 rounded-lg text-xs sm:text-sm font-semibold bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] disabled:opacity-60 text-white transition-colors cursor-pointer"
            >
              {googleBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 text-[#60A5FA]" />
              )}
              <span>
                {googleBusy ? 'Connecting Google...' : 'Continue with Google (Optional)'}
              </span>
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
            {/* Wallet Balance Hero Card */}
            <div className="p-5 rounded-xl bg-[#0C0E14] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#60A5FA]">
                  Available PHP Wallet Balance
                </p>
                <p className="font-mono-tabular font-bold text-3xl text-white">
                  {formatPhp(profile?.balance ?? 0)}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1 text-xs text-[#9CA3AF]">
                  {editingName ? (
                    <form
                      onSubmit={handleSaveName}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        required
                        maxLength={BLUEPRINT_LIMITS.USER.DISPLAY_NAME_MAX}
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="px-2.5 py-1 rounded bg-[#12141C] border border-white/15 text-xs text-white focus:outline-none focus:border-[#3B82F6]"
                      />
                      <button
                        type="submit"
                        disabled={savingName}
                        className="px-2.5 py-1 rounded bg-[#2563EB] text-white text-xs font-semibold cursor-pointer"
                      >
                        {savingName ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingName(false)}
                        className="px-2 py-1 rounded bg-white/[0.06] text-[#9CA3AF] text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="text-white font-medium">
                        {profile?.displayName || user.displayName || 'Member'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setNameInput(
                            profile?.displayName || user.displayName || ''
                          );
                          setEditingName(true);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-[#60A5FA] hover:text-white cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Edit name</span>
                      </button>
                    </>
                  )}
                </div>

                {/* Optional Contact Email */}
                {!profile?.email?.includes('@gmail.com') && (
                  <div className="pt-0.5 text-xs text-[#9CA3AF]">
                    {editingEmail ? (
                      <form
                        onSubmit={handleSaveContactEmail}
                        className="space-y-1"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <input
                            type="email"
                            maxLength={BLUEPRINT_LIMITS.USER.EMAIL_MAX}
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            placeholder="Optional Gmail / email"
                            className="px-2.5 py-1 rounded bg-[#12141C] border border-white/15 text-xs text-white focus:outline-none focus:border-[#3B82F6]"
                          />
                          <button
                            type="submit"
                            disabled={savingEmail}
                            className="px-2.5 py-1 rounded bg-[#2563EB] text-white text-xs font-semibold cursor-pointer"
                          >
                            {savingEmail ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEmail(false);
                              setEmailError(null);
                            }}
                            className="px-2 py-1 rounded bg-white/[0.06] text-[#9CA3AF] text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                        {emailError && (
                          <p className="text-[11px] text-rose-400">
                            {emailError}
                          </p>
                        )}
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEmailInput(profile?.contactEmail || '');
                          setEditingEmail(true);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-[#9CA3AF] hover:text-white cursor-pointer"
                      >
                        <Mail className="w-3 h-3 text-[#60A5FA]" />
                        <span>
                          {profile?.contactEmail
                            ? `Gmail: ${profile.contactEmail} (Edit)`
                            : 'Add optional Gmail / email'}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenTopUp();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Top Up (GCash)</span>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenOwnerStudio();
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.12] text-[#93C5FD] transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    <span>Owner Dashboard</span>
                  </button>
                )}
              </div>
            </div>

            {/* Sub-navigation Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex p-1 rounded-lg bg-[#090A0F] border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setTab('overview')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    tab === 'overview'
                      ? 'bg-[#2563EB] text-white'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setTab('topups')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    tab === 'topups'
                      ? 'bg-[#2563EB] text-white'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  My Top-Ups ({topUpRequests.length}
                  {pendingTopUps > 0 ? ` · ${pendingTopUps} pending` : ''})
                </button>
                <button
                  type="button"
                  onClick={() => setTab('orders')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    tab === 'orders'
                      ? 'bg-[#2563EB] text-white'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  My Orders ({orders.length})
                </button>
              </div>

              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] hover:bg-rose-500/15 text-[#9CA3AF] hover:text-rose-300 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>

            {/* Tab 1: Overview */}
            {tab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-[#0C0E14] border border-white/[0.08]">
                    <p className="text-[11px] uppercase tracking-wider text-[#6B7280] font-semibold">
                      Wallet Balance
                    </p>
                    <p className="mt-1 font-mono-tabular font-bold text-lg text-white">
                      {formatPhp(profile?.balance ?? 0)}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#0C0E14] border border-white/[0.08]">
                    <p className="text-[11px] uppercase tracking-wider text-[#6B7280] font-semibold">
                      Pending Top-Ups
                    </p>
                    <p className="mt-1 font-mono-tabular font-bold text-lg text-amber-400">
                      {pendingTopUps}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#0C0E14] border border-white/[0.08]">
                    <p className="text-[11px] uppercase tracking-wider text-[#6B7280] font-semibold">
                      Orders Placed
                    </p>
                    <p className="mt-1 font-mono-tabular font-bold text-lg text-emerald-400">
                      {orders.length}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#0C0E14] border border-white/[0.08] space-y-2">
                  <p className="text-xs font-semibold text-white">
                    Saved Account &amp; Wallet Guarantee
                  </p>
                  <p className="text-xs text-[#9CA3AF] leading-relaxed">
                    1. Always sign back in using the same <strong className="text-white">username and password</strong> so your saved PHP balance and orders stay intact without creating duplicate accounts.
                    <br />
                    2. Click <strong className="text-white">Top Up (GCash)</strong> and transfer your chosen PHP amount to Kozuo&apos;s GCash account, then upload your receipt.
                    <br />
                    3. Once the owner approves your payment, your wallet balance updates live for instant checkout.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: Top-Up Requests */}
            {tab === 'topups' && (
              <div className="space-y-3">
                {topUpRequests.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[#0C0E14] border border-white/[0.08] text-center space-y-3">
                    <Wallet className="w-6 h-6 text-[#60A5FA] mx-auto" />
                    <p className="text-sm text-[#9CA3AF]">
                      You have not submitted any GCash top-up requests yet.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenTopUp();
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Submit First GCash Top-Up</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {topUpRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 rounded-xl bg-[#0C0E14] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          {req.proofImageUrl && (
                            <button
                              type="button"
                              onClick={() => setZoomProof(req.proofImageUrl)}
                              className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 shrink-0 cursor-pointer"
                              title="View uploaded GCash receipt"
                            >
                              <img
                                src={req.proofImageUrl}
                                alt={`Receipt for ${req.requestCode}`}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            </button>
                          )}
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-mono-tabular font-semibold text-[#60A5FA]">
                                #{req.requestCode}
                              </span>
                              <span className="font-mono-tabular font-bold text-white">
                                {formatPhp(req.amountPhp)}
                              </span>
                              <span className="text-[#6B7280]">· GCash</span>
                            </div>
                            <p className="text-[11px] text-[#9CA3AF]">
                              Submitted {formatTs(req.createdAt)}
                              {req.referenceNo ? ` · Ref: ${req.referenceNo}` : ''}
                            </p>
                            {req.adminNote && (
                              <p className="text-xs text-[#D1D5DB] pt-0.5">
                                Owner note: {req.adminNote}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          {req.status === 'Approved' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Approved
                            </span>
                          ) : req.status === 'Rejected' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400">
                              <XCircle className="w-3.5 h-3.5" />
                              Rejected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400">
                              <Clock className="w-3.5 h-3.5" />
                              Pending Verification
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Orders */}
            {tab === 'orders' && (
              <div className="space-y-3">
                {orders.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[#0C0E14] border border-white/[0.08] text-center space-y-2">
                    <ShoppingBag className="w-6 h-6 text-[#60A5FA] mx-auto" />
                    <p className="text-sm text-[#9CA3AF]">
                      No wallet orders yet. Browse stocks and click View More Details to purchase with your balance.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {orders.map((ord) => {
                      const vaultEntry = vaultCache[ord.id];
                      const vaultItems = Array.isArray(vaultEntry)
                        ? vaultEntry
                        : [];
                      const hasVaultItems = vaultItems.length > 0;
                      const firstVault = vaultItems[0];
                      return (
                        <div
                          key={ord.id}
                          className="p-4 rounded-xl bg-[#0C0E14] border border-white/[0.08] space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-mono-tabular font-semibold text-[#60A5FA]">
                                #{ord.orderCode}
                              </span>
                              <span className="text-[#6B7280]">·</span>
                              <span className="text-white font-semibold">
                                [{ord.stockCode}] {ord.stockTitle}
                              </span>
                            </div>
                            <span
                              className={`text-xs font-semibold ${
                                ord.deliveryStatus === 'Delivered'
                                  ? 'text-emerald-400'
                                  : ord.deliveryStatus === 'Refunded'
                                  ? 'text-rose-400'
                                  : 'text-amber-400'
                              }`}
                            >
                              {ord.deliveryStatus}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#9CA3AF]">
                            <span>
                              Qty: {ord.quantity} · Paid{' '}
                              <span className="font-mono-tabular text-white font-semibold">
                                {formatPhp(ord.totalPhp)}
                              </span>
                              {ord.voucherCode ? (
                                <span className="text-emerald-400">
                                  {' '}
                                  · Voucher {ord.voucherCode} (-
                                  {formatPhp(ord.discountPhp ?? 0)})
                                </span>
                              ) : null}
                            </span>
                            <span>{formatTs(ord.createdAt)}</span>
                          </div>

                          {ord.deliveryStatus === 'Delivered' &&
                            vaultEntry === 'loading' && (
                              <div className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Loading instant delivery details...</span>
                              </div>
                            )}

                          {hasVaultItems && (
                            <div className="p-3 rounded-lg bg-[#12141C] border border-emerald-500/25 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                                  <Zap className="w-3.5 h-3.5 shrink-0" />
                                  <span>
                                    Instant Delivery ·{' '}
                                    {vaultItems.length > 1
                                      ? `${vaultItems.length} Items`
                                      : firstVault.deliveryType === 'credentials'
                                      ? 'Account Credentials'
                                      : 'Download Link / File Key'}
                                  </span>
                                </span>
                                {vaultItems.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const combined = vaultItems
                                          .map(
                                            (v, i) =>
                                              `Item #${i + 1}: ${v.payload}`
                                          )
                                          .join('\n');
                                        await navigator.clipboard.writeText(
                                          combined
                                        );
                                        setCopiedOrderSlot(`${ord.id}__all`);
                                        setTimeout(
                                          () => setCopiedOrderSlot(null),
                                          2000
                                        );
                                      } catch {
                                        // ignore
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.08] hover:bg-white/[0.15] text-[11px] font-semibold text-white cursor-pointer"
                                  >
                                    {copiedOrderSlot === `${ord.id}__all` ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-400" />
                                        <span className="text-emerald-400">
                                          Copied All
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" />
                                        <span>Copy All</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>

                              <div className="space-y-2">
                                {vaultItems.map((vItem, idx) => {
                                  const slotKey = `${ord.id}__${idx}`;
                                  const isUrl = /^https?:\/\//i.test(
                                    vItem.payload.trim()
                                  );
                                  return (
                                    <div
                                      key={slotKey}
                                      className="p-2 rounded bg-[#090A0F] border border-white/[0.06] space-y-1.5"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] text-[#9CA3AF] font-medium">
                                          {vaultItems.length > 1
                                            ? `Item #${idx + 1}`
                                            : vItem.deliveryType ===
                                              'credentials'
                                            ? 'Login / Account'
                                            : 'Link / File Key'}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          {isUrl && (
                                            <a
                                              href={vItem.payload.trim()}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#60A5FA] hover:underline"
                                            >
                                              <ExternalLink className="w-3 h-3" />
                                              <span>Open Link</span>
                                            </a>
                                          )}
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              try {
                                                await navigator.clipboard.writeText(
                                                  vItem.payload
                                                );
                                                setCopiedOrderSlot(slotKey);
                                                setTimeout(
                                                  () =>
                                                    setCopiedOrderSlot(null),
                                                  2000
                                                );
                                              } catch {
                                                // ignore
                                              }
                                            }}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.08] hover:bg-white/[0.15] text-[11px] font-semibold text-white cursor-pointer"
                                          >
                                            {copiedOrderSlot === slotKey ? (
                                              <>
                                                <Check className="w-3 h-3 text-emerald-400" />
                                                <span className="text-emerald-400">
                                                  Copied
                                                </span>
                                              </>
                                            ) : (
                                              <>
                                                <Copy className="w-3 h-3" />
                                                <span>Copy</span>
                                              </>
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                      <div className="text-xs font-mono-tabular text-white whitespace-pre-wrap break-all select-all">
                                        {vItem.payload}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {firstVault.instructions && (
                                <p className="text-[11px] text-[#9CA3AF]">
                                  {firstVault.instructions}
                                </p>
                              )}
                            </div>
                          )}

                          {ord.deliveryNote ? (
                            <div className="p-3 rounded-lg bg-[#12141C] border border-emerald-500/20 text-xs text-[#D1D5DB] space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" />
                                  Delivery Details from Kozuo
                                </p>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(
                                        ord.deliveryNote
                                      );
                                      setCopiedNoteOrderId(ord.id);
                                      setTimeout(
                                        () => setCopiedNoteOrderId(null),
                                        2000
                                      );
                                    } catch {
                                      // ignore
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.08] hover:bg-white/[0.15] text-[11px] font-semibold text-white cursor-pointer"
                                >
                                  {copiedNoteOrderId === ord.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      <span className="text-emerald-400">
                                        Copied
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <div className="p-2 rounded bg-[#090A0F] border border-white/[0.06] text-xs font-mono-tabular text-white whitespace-pre-wrap break-all select-all">
                                {ord.deliveryNote}
                              </div>
                              {(() => {
                                const match = ord.deliveryNote.match(
                                  /https?:\/\/[^\s]+/i
                                );
                                if (!match) return null;
                                return (
                                  <a
                                    href={match[0]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#60A5FA] hover:underline"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>Open Link</span>
                                  </a>
                                );
                              })()}
                            </div>
                          ) : !hasVaultItems &&
                            vaultEntry !== 'loading' &&
                            ord.deliveryStatus === 'Delivered' ? (
                            <p className="text-[11px] text-emerald-400/90 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Order marked Delivered — check Telegram/Facebook or owner note.
                            </p>
                          ) : !hasVaultItems && ord.deliveryStatus !== 'Delivered' ? (
                            <p className="text-[11px] text-[#9CA3AF] flex items-start gap-1.5 leading-relaxed">
                              <Package className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                              <span>
                                <strong className="text-amber-300">
                                  Pending Owner Delivery:
                                </strong>{' '}
                                This item uses manual delivery. Once the owner pastes your account credentials or download link in Owner Dashboard &rarr; Orders, it will appear right here (or via Facebook/Telegram).
                              </span>
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Proof Zoom Modal */}
      {zoomProof && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setZoomProof(null)}
        >
          <div
            className="relative max-w-lg w-full bg-[#12141C] border border-white/15 rounded-xl p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomProof(null)}
              aria-label="Close proof preview"
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-black/75 text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={zoomProof}
              alt="GCash payment receipt"
              referrerPolicy="no-referrer"
              className="w-full max-h-[75vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
