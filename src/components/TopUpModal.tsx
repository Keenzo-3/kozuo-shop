import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  LogIn,
  Mail,
  ShoppingBag,
  Upload,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  formatBuyerAccountLabel,
  formatPhp,
  type StoreSettings,
  type TopUpRequestInput,
  type UserProfile,
} from '../types/store';
import { compressImageToDataUrl, GCASH_LOGO_PHOTO } from '../lib/imageUtils';

interface TopUpModalProps {
  isOpen: boolean;
  user: User | null;
  profile: UserProfile | null;
  settings: StoreSettings;
  onClose: () => void;
  onSignInGoogle: () => Promise<void>;
  onSignInUsername: (username: string, password: string) => Promise<void>;
  onRegisterUsername: (
    username: string,
    password: string,
    optionalEmail?: string
  ) => Promise<void>;
  onSubmitTopUp: (input: TopUpRequestInput) => Promise<string>;
  onViewTopUps: () => void;
}

const PRESET_AMOUNTS = [50, 100, 300, 500, 1000, 2000, 5000];

export function TopUpModal({
  isOpen,
  user,
  profile,
  settings,
  onClose,
  onSignInGoogle,
  onSignInUsername,
  onRegisterUsername,
  onSubmitTopUp,
  onViewTopUps,
}: TopUpModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [agreed, setAgreed] = useState(false);
  const [amountPhp, setAmountPhp] = useState<number>(300);
  const [customInput, setCustomInput] = useState<string>('300');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const customAmountInputRef = useRef<HTMLInputElement | null>(null);
  const [referenceNo, setReferenceNo] = useState('');
  const [proofImageUrl, setProofImageUrl] = useState('');
  const [copiedNum, setCopiedNum] = useState(false);

  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [optionalEmailInput, setOptionalEmailInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [signInBusy, setSignInBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  const minTopUp = Math.max(50, settings.minTopUpPhp || 50);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setAgreed(false);
      setAmountPhp(300);
      setCustomInput('300');
      setIsCustomMode(false);
      setReferenceNo('');
      setProofImageUrl('');
      setCopiedNum(false);
      setPasswordInput('');
      setShowPassword(false);
      setError(null);
      setSubmittedCode(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const accountLabel = user
    ? formatBuyerAccountLabel(
        profile?.email || user.email,
        profile?.username,
        profile?.contactEmail
      )
    : '';

  const handleCopyNumber = async () => {
    try {
      await navigator.clipboard.writeText(settings.gcashNumber || '');
      setCopiedNum(true);
      setTimeout(() => setCopiedNum(false), 1800);
    } catch {
      // ignore clipboard fallback
    }
  };

  const handleProofFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProof(true);
    setError(null);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setProofImageUrl(dataUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to process receipt image.'
      );
    } finally {
      setUploadingProof(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (amountPhp < minTopUp) {
      setError(`Minimum top-up amount is ${formatPhp(minTopUp)}.`);
      return;
    }
    if (!proofImageUrl.trim()) {
      setError('Please upload your GCash payment screenshot or receipt.');
      return;
    }

    setSubmitting(true);
    try {
      const code = await onSubmitTopUp({
        amountPhp,
        referenceNo,
        proofImageUrl,
      });
      setSubmittedCode(code);
      setStep(5);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to submit top-up request. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUsernameAuth = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
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
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSignInBusy(false);
    }
  };

  const handleGoogleFirst = async () => {
    setError(null);
    setGoogleBusy(true);
    try {
      await onSignInGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGoogleBusy(false);
    }
  };

  const wizardSteps = [
    { num: 1, label: 'Method' },
    { num: 2, label: 'Amount' },
    { num: 3, label: 'Payment' },
    { num: 4, label: 'Upload' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Top Up Wallet via GCash"
    >
      <div
        className="w-full max-w-xl bg-[#12141C] border border-white/10 rounded-xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#3B82F6]">
              Manual Payment · GCash Only
            </p>
            <h2 className="font-display font-bold text-lg text-white">
              Add Balance to Your PHP Wallet
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0C0E14] border border-white/[0.08] text-xs font-mono-tabular text-[#D1D5DB]">
                <Wallet className="w-3.5 h-3.5 text-[#60A5FA]" />
                {formatPhp(profile?.balance ?? 0)}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close top-up modal"
              className="p-2 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* If user is not signed in */}
        {!user ? (
          <div className="p-6 sm:p-8 space-y-4 max-w-md mx-auto">
            <div className="text-center space-y-1">
              <h3 className="font-display font-bold text-xl text-white">
                Sign In to Top Up
              </h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Log in with your saved username and password so Kozuo can credit approved GCash transfers to your permanent PHP wallet.
              </p>
            </div>

            <div className="grid grid-cols-2 p-1 rounded-xl bg-[#0C0E14] border border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setError(null);
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
                  setError(null);
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

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 text-left">
                {error}
              </div>
            )}

            <form onSubmit={handleUsernameAuth} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#D1D5DB]">
                  Username
                </label>
                <input
                  type="text"
                  required
                  minLength={BLUEPRINT_LIMITS.USER.USERNAME_MIN}
                  maxLength={BLUEPRINT_LIMITS.USER.USERNAME_MAX}
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="e.g. kozuo_buyer01"
                  className="w-full h-10 px-3.5 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#D1D5DB]">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
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
                    maxLength={BLUEPRINT_LIMITS.USER.EMAIL_MAX}
                    value={optionalEmailInput}
                    onChange={(e) => setOptionalEmailInput(e.target.value)}
                    placeholder="Optional contact email"
                    className="w-full h-10 px-3.5 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={signInBusy || googleBusy}
                className="w-full h-10 inline-flex items-center justify-center gap-2 px-5 rounded-lg text-sm font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white cursor-pointer"
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
                    ? 'Please wait...'
                    : authMode === 'register'
                    ? 'Create Account & Continue'
                    : 'Sign In & Continue'}
                </span>
              </button>
            </form>

            <div className="relative flex items-center py-0.5">
              <div className="flex-1 border-t border-white/[0.08]" />
              <span className="px-3 text-[11px] uppercase tracking-wider text-[#6B7280]">
                or optional
              </span>
              <div className="flex-1 border-t border-white/[0.08]" />
            </div>

            <button
              type="button"
              disabled={signInBusy || googleBusy}
              onClick={handleGoogleFirst}
              className="w-full h-10 inline-flex items-center justify-center gap-2 px-5 rounded-lg text-xs sm:text-sm font-semibold bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white cursor-pointer"
            >
              {googleBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 text-[#60A5FA]" />
              )}
              <span>
                {googleBusy
                  ? 'Connecting Google...'
                  : 'Continue with Google (Optional)'}
              </span>
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
            {/* 4-Step Indicator */}
            {step <= 4 && (
              <div className="grid grid-cols-4 gap-2">
                {wizardSteps.map((s) => {
                  const done = step > s.num;
                  const active = step === s.num;
                  return (
                    <div
                      key={s.num}
                      className="flex flex-col items-center gap-1.5 text-center"
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                          done
                            ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-400'
                            : active
                            ? 'bg-[#2563EB] border-[#3B82F6] text-white'
                            : 'bg-[#0C0E14] border-white/[0.08] text-[#6B7280]'
                        }`}
                      >
                        {done ? <Check className="w-3.5 h-3.5" /> : s.num}
                      </div>
                      <span
                        className={`text-[11px] font-medium ${
                          active
                            ? 'text-white'
                            : done
                            ? 'text-emerald-400'
                            : 'text-[#6B7280]'
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                {error}
              </div>
            )}

            {/* STEP 1: Method & Manual Payment Notice */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                    1 · Payment Method
                  </p>
                  <div className="p-4 rounded-xl bg-[#0C0E14] border border-[#3B82F6]/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={GCASH_LOGO_PHOTO}
                        alt="GCash"
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-lg object-cover shrink-0 bg-white/5"
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">
                          GCash (Manual Transfer)
                        </p>
                        <p className="text-xs text-[#9CA3AF]">
                          PHP Wallet · Owner approval required
                        </p>
                      </div>
                    </div>
                    <span className="w-5 h-5 rounded-full bg-[#2563EB] text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </span>
                  </div>
                </div>

                {/* Manual Payment Notice */}
                <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/25 space-y-2">
                  <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Manual Payment Notice</span>
                  </p>
                  <ul className="text-xs text-[#D1D5DB] space-y-1.5 leading-relaxed">
                    <li>
                      • <strong className="text-white">Owner approval required:</strong> Balance is added only after the owner reviews and approves your receipt.
                    </li>
                    <li>
                      • <strong className="text-white">Send the exact amount:</strong> Make sure the GCash transfer matches your selected PHP amount.
                    </li>
                    <li>
                      • <strong className="text-white">Upload valid proof:</strong> Do not submit edited, blurred, or duplicate receipts.
                    </li>
                  </ul>
                </div>

                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#0C0E14] border border-white/[0.08] cursor-pointer hover:border-white/20 transition-colors">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-[#12141C] text-[#2563EB] accent-[#2563EB]"
                  />
                  <span className="text-xs font-medium text-white">
                    I understand and agree.
                  </span>
                </label>

                <button
                  type="button"
                  disabled={!agreed}
                  onClick={() => setStep(2)}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors cursor-pointer"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* STEP 2: Choose PHP Amount */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                      2 · Choose PHP Amount
                    </p>
                    <span className="text-xs font-medium text-[#60A5FA]">
                      Minimum {formatPhp(minTopUp)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PRESET_AMOUNTS.map((amt) => {
                      const active = !isCustomMode && amountPhp === amt;
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            setIsCustomMode(false);
                            setAmountPhp(amt);
                            setCustomInput(String(amt));
                            setError(null);
                          }}
                          className={`py-2.5 px-3 rounded-xl text-sm font-mono-tabular font-semibold border transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#2563EB]/20 border-[#3B82F6] text-white'
                              : 'bg-[#0C0E14] border-white/[0.08] text-[#9CA3AF] hover:text-white hover:border-white/20'
                          }`}
                        >
                          ₱{amt.toLocaleString('en-PH')}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomMode(true);
                        setError(null);
                        setTimeout(() => {
                          customAmountInputRef.current?.focus();
                          customAmountInputRef.current?.select();
                        }, 10);
                      }}
                      className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold border inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        isCustomMode
                          ? 'bg-[#2563EB]/20 border-[#3B82F6] text-white'
                          : 'bg-[#0C0E14] border-white/[0.08] text-[#60A5FA] hover:text-white hover:border-[#3B82F6]/50'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5 shrink-0" />
                      <span>Custom</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs text-[#9CA3AF]">
                      Custom Top-Up Amount (Minimum {formatPhp(minTopUp)})
                    </label>
                    {amountPhp > 0 && amountPhp < minTopUp && (
                      <span className="text-[11px] font-semibold text-rose-400">
                        Below ₱50 minimum
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono-tabular text-[#9CA3AF]">
                      ₱
                    </span>
                    <input
                      ref={customAmountInputRef}
                      type="number"
                      min={minTopUp}
                      max={BLUEPRINT_LIMITS.TOPUP.MAX_PHP}
                      step="1"
                      placeholder={`Enter custom amount (min ${minTopUp})`}
                      value={customInput}
                      onFocus={() => setIsCustomMode(true)}
                      onChange={(e) => {
                        setIsCustomMode(true);
                        setCustomInput(e.target.value);
                        const num =
                          Math.round((Number(e.target.value) || 0) * 100) / 100;
                        setAmountPhp(num);
                        setError(null);
                      }}
                      className={`w-full pl-8 pr-4 py-2.5 rounded-xl bg-[#0C0E14] border text-sm font-mono-tabular text-white focus:outline-none ${
                        amountPhp > 0 && amountPhp < minTopUp
                          ? 'border-rose-500/60 focus:border-rose-500'
                          : isCustomMode
                          ? 'border-[#3B82F6] focus:border-[#3B82F6]'
                          : 'border-white/[0.1] focus:border-[#3B82F6]'
                      }`}
                    />
                  </div>
                  <p className="text-[11px] text-[#6B7280]">
                    Enter any exact amount from ₱{minTopUp.toLocaleString('en-PH')} up to ₱{BLUEPRINT_LIMITS.TOPUP.MAX_PHP.toLocaleString('en-PH')}.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0C0E14] border border-white/[0.08] flex items-center justify-between text-sm">
                  <span className="text-[#9CA3AF]">You will pay</span>
                  <span
                    className={`font-mono-tabular font-bold text-lg ${
                      amountPhp >= minTopUp ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {formatPhp(amountPhp)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/[0.05] hover:bg-white/[0.1] text-[#D1D5DB] cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!Number.isFinite(amountPhp) || amountPhp < minTopUp) {
                        setError(
                          `Minimum top-up amount is ${formatPhp(minTopUp)}. Please enter ₱${minTopUp} or higher.`
                        );
                        return;
                      }
                      if (amountPhp > BLUEPRINT_LIMITS.TOPUP.MAX_PHP) {
                        setError(
                          `Maximum single top-up amount is ${formatPhp(
                            BLUEPRINT_LIMITS.TOPUP.MAX_PHP
                          )}.`
                        );
                        return;
                      }
                      setError(null);
                      setStep(3);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer"
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: GCash Payment Details */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#0C0E14] border border-amber-500/30 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-300">
                    Manual Payment · PHP (GCash)
                  </p>

                  <div className="p-3.5 rounded-xl bg-[#12141C] border border-white/[0.08] flex items-center gap-3">
                    <img
                      src={GCASH_LOGO_PHOTO}
                      alt="GCash"
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-lg object-cover shrink-0 bg-white/5"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">
                        GCash Account
                      </p>
                      <p className="text-xs text-[#9CA3AF] truncate">
                        Recipient:{' '}
                        <span className="text-white font-medium">
                          {settings.gcashName || 'J.O'}
                        </span>{' '}
                        · Send exact amount only
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#12141C] border border-white/[0.08] flex items-center justify-between gap-3">
                    <span className="font-mono-tabular font-bold text-base sm:text-lg text-white tracking-wide">
                      {settings.gcashNumber || '09933119204'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyNumber}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        copiedNum
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white'
                      }`}
                    >
                      {copiedNum ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-sm">
                    <span className="text-[#9CA3AF]">Amount to send</span>
                    <span className="font-mono-tabular font-bold text-lg text-white">
                      {formatPhp(amountPhp)}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#9CA3AF] leading-relaxed">
                  Open your GCash app, transfer{' '}
                  <strong className="text-white">{formatPhp(amountPhp)}</strong>{' '}
                  to the number above, and save a screenshot of your receipt
                  before continuing.
                </p>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/[0.05] hover:bg-white/[0.1] text-[#D1D5DB] cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer"
                  >
                    <span>I Sent the Payment — Upload Proof</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: Upload Proof & Submit */}
            {step === 4 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                    4 · Upload GCash Payment Screenshot
                  </label>

                  {proofImageUrl ? (
                    <div className="p-3 rounded-xl bg-[#0C0E14] border border-emerald-500/35 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={proofImageUrl}
                          alt="Uploaded payment proof"
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-lg object-cover border border-white/10 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Receipt image ready</span>
                          </p>
                          <p className="text-[11px] text-[#9CA3AF] truncate">
                            Compressed and attached for owner verification
                          </p>
                        </div>
                      </div>
                      <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-white cursor-pointer shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Replace</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProofFileChange}
                          className="sr-only"
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl bg-[#0C0E14] border border-dashed border-white/20 hover:border-[#3B82F6] transition-colors cursor-pointer text-center">
                      {uploadingProof ? (
                        <Loader2 className="w-7 h-7 text-[#60A5FA] animate-spin" />
                      ) : (
                        <ImagePlus className="w-7 h-7 text-[#60A5FA]" />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {uploadingProof
                            ? 'Compressing screenshot...'
                            : 'Tap to upload your GCash receipt'}
                        </p>
                        <p className="text-xs text-[#6B7280] mt-0.5">
                          PNG, JPG or screenshot showing reference &amp; amount
                        </p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProofFileChange}
                        className="sr-only"
                      />
                    </label>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-[#9CA3AF]">
                    GCash Reference No. (optional, recommended)
                  </label>
                  <input
                    type="text"
                    maxLength={BLUEPRINT_LIMITS.TOPUP.REF_NO_MAX}
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="e.g. 9012 3456 7890"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0E14] border border-white/[0.1] text-sm font-mono-tabular text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>

                {/* Summary Box */}
                <div className="p-4 rounded-xl bg-[#0C0E14] border border-white/[0.08] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#9CA3AF]">You will receive</span>
                    <span className="font-mono-tabular font-bold text-emerald-400">
                      {formatPhp(amountPhp)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#9CA3AF]">Amount to pay</span>
                    <span className="font-mono-tabular font-semibold text-white">
                      {formatPhp(amountPhp)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#9CA3AF]">Wallet</span>
                    <span className="text-white">PHP Balance</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#9CA3AF]">Credited to</span>
                    <span className="text-white truncate max-w-[230px]">
                      {profile?.displayName || user.displayName || 'Member'} (
                      {accountLabel})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/[0.05] hover:bg-white/[0.1] text-[#D1D5DB] cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || uploadingProof || !proofImageUrl}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white transition-colors cursor-pointer"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Submit Top-Up Request</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 5: Submitted Confirmation */}
            {step === 5 && (
              <div className="py-4 text-center space-y-5">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-display font-bold text-2xl text-white">
                    Top-Up Request Submitted
                  </h3>
                  <p className="text-sm text-[#9CA3AF]">
                    Your top-up request{' '}
                    <span className="font-mono-tabular font-semibold text-white">
                      #{submittedCode}
                    </span>{' '}
                    ({formatPhp(amountPhp)}) and payment proof were submitted
                    successfully.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/25 text-xs text-emerald-300 leading-relaxed flex items-start gap-2.5 text-left">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Request #{submittedCode} is Pending. Do not submit the same
                    receipt again. Please wait for owner verification to add the
                    funds to your wallet.
                  </span>
                </div>

                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Browse Products</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onViewTopUps();
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-white/[0.06] hover:bg-white/[0.12] text-white transition-colors cursor-pointer"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>View My Top-Up History</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
