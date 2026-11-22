import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { User } from 'firebase/auth';
import {
  Check,
  ChevronDown,
  Clock,
  Copy,
  HelpCircle,
  LogIn,
  MousePointer2,
  Pause,
  Play,
  QrCode,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Upload,
  Wallet,
} from 'lucide-react';
import { formatPhp, type SocialLink, type StoreSettings } from '../types/store';
import { GCASH_LOGO_PHOTO } from '../lib/imageUtils';

interface HelpCenterSectionProps {
  socialLinks: SocialLink[];
  settings: StoreSettings;
  user: User | null;
  onJumpToCatalog: () => void;
  onJumpToContact: () => void;
  onOpenTopUp: () => void;
  onOpenAuth: () => void;
}

type TutorialTrackId = 'topup' | 'auth' | 'buy';

interface TrackStep {
  id: number;
  code: string;
  shortTitle: string;
  description: string;
  durationLabel: string;
}

interface TutorialTrack {
  id: TutorialTrackId;
  badge: string;
  title: string;
  summary: string;
  stepsCountLabel: string;
  steps: TrackStep[];
}

const TUTORIAL_TRACKS: TutorialTrack[] = [
  {
    id: 'topup',
    badge: 'Payment & Wallet',
    title: 'Manual Top-Up (GCash)',
    summary:
      'Pay via GCash, upload your receipt screenshot, and get your PHP wallet credited once the owner approves it.',
    stepsCountLabel: '7 steps',
    steps: [
      {
        id: 0,
        code: '01',
        shortTitle: 'Log in with Username & Password',
        description:
          'Sign in or create an account with your saved username and password (Gmail optional) so your PHP balance stays safe with no duplicates.',
        durationLabel: '0:00 – 0:04',
      },
      {
        id: 1,
        code: '02',
        shortTitle: 'Choose a manual method',
        description:
          'Open Top Up and confirm GCash as your manual PHP transfer method.',
        durationLabel: '0:04 – 0:08',
      },
      {
        id: 2,
        code: '03',
        shortTitle: 'Read the notice',
        description:
          'Review the Manual Payment Notice (owner approval required, exact amount, valid proof) and check "I understand and agree."',
        durationLabel: '0:08 – 0:12',
      },
      {
        id: 3,
        code: '04',
        shortTitle: 'Choose an amount',
        description:
          'Pick a preset amount like ₱300 or type any custom PHP amount (minimum ₱50), then tap Continue.',
        durationLabel: '0:12 – 0:16',
      },
      {
        id: 4,
        code: '05',
        shortTitle: 'Send the payment',
        description:
          'Copy Kozuo’s GCash number and send the exact PHP amount from your GCash app.',
        durationLabel: '0:16 – 0:20',
      },
      {
        id: 5,
        code: '06',
        shortTitle: 'Upload your proof',
        description:
          'Attach your GCash receipt screenshot, enter the reference number, and tap Submit Top-Up Request.',
        durationLabel: '0:20 – 0:24',
      },
      {
        id: 6,
        code: '07',
        shortTitle: 'Wait for approval',
        description:
          'The owner checks your payment and approves it. Your PHP wallet balance updates automatically upon approval.',
        durationLabel: '0:24 – 0:28',
      },
    ],
  },
  {
    id: 'auth',
    badge: 'Getting Started',
    title: 'How to Sign In & Keep Your Balance Safe',
    summary:
      'Create one permanent account using Username & Password (Gmail optional) or Google Sign-In so your wallet balance is always saved.',
    stepsCountLabel: '4 steps',
    steps: [
      {
        id: 0,
        code: '01',
        shortTitle: 'Tap Login in Header',
        description:
          'Click Login in the top navigation bar or mobile bottom bar.',
        durationLabel: '0:00 – 0:04',
      },
      {
        id: 1,
        code: '02',
        shortTitle: 'Enter Username & Password',
        description:
          'Sign in with your existing username & password, or create one once (no Gmail needed). Google Sign-In is also available.',
        durationLabel: '0:04 – 0:08',
      },
      {
        id: 2,
        code: '03',
        shortTitle: 'Customize Display Name',
        description:
          'Update your display name or optional Gmail inside My Account so the owner easily recognizes your orders.',
        durationLabel: '0:08 – 0:12',
      },
      {
        id: 3,
        code: '04',
        shortTitle: 'Saved Balance & Orders',
        description:
          'Every time you log back in with the same username & password, your PHP balance and orders load right back.',
        durationLabel: '0:12 – 0:16',
      },
    ],
  },
  {
    id: 'buy',
    badge: 'Storefront Flow',
    title: 'How to Buy a Product',
    summary:
      'Inspect Clean/Not Clean CODM accounts or file packs, then buy instantly with your wallet balance or contact support.',
    stepsCountLabel: '5 steps',
    steps: [
      {
        id: 0,
        code: '01',
        shortTitle: 'Browse & Filter Stocks',
        description:
          'Select CODM ACCOUNT (Clean or Not Clean) or CODM&MLBB FILES and check the live Stock Status.',
        durationLabel: '0:00 – 0:04',
      },
      {
        id: 1,
        code: '02',
        shortTitle: 'Inspect Details & 7 Photos',
        description:
          'Click View More Details on any card to check all photos, details, and remaining stock quantity.',
        durationLabel: '0:04 – 0:08',
      },
      {
        id: 2,
        code: '03',
        shortTitle: 'Pay with Wallet Balance',
        description:
          'Choose your quantity and click Buy with Wallet Balance—or message Kozuo directly.',
        durationLabel: '0:08 – 0:12',
      },
      {
        id: 3,
        code: '04',
        shortTitle: 'Auto Stock Deduction',
        description:
          'Your order is created, your wallet balance deducts, and stock quantity updates live.',
        durationLabel: '0:12 – 0:16',
      },
      {
        id: 4,
        code: '05',
        shortTitle: 'Receive Account / Files',
        description:
          'Track delivery inside My Orders or connect via Facebook / Telegram QR codes.',
        durationLabel: '0:16 – 0:20',
      },
    ],
  },
];

const BEGINNER_GUIDES = [
  {
    step: '01',
    title: 'Browse Live Stocks Anytime',
    body: 'Visit Kozuo Store to inspect all live CODM Accounts and CODM & MLBB Files right away—no sign-up is required just to browse.',
  },
  {
    step: '02',
    title: 'Sign In & Top Up via GCash',
    body: 'Sign in with Username & Password (no Gmail required) or Google, then upload your GCash receipt for owner approval.',
  },
  {
    step: '03',
    title: 'Compare Clean vs Not Clean Accounts',
    body: 'Clean accounts include full email/Garena surrender. Not Clean accounts have a dead third-party bind and are priced lower with full transparency.',
  },
  {
    step: '04',
    title: 'Buy with Wallet or Message Direct',
    body: 'Purchase instantly using your approved PHP wallet balance inside View More Details, or reach Kozuo directly on Facebook & Telegram.',
  },
];

type FaqTopic = 'ALL' | 'WALLET' | 'ACCOUNTS' | 'BUYING';

interface FaqItem {
  id: string;
  topic: Exclude<FaqTopic, 'ALL'>;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-topup-approval',
    topic: 'WALLET',
    question: 'How long does GCash top-up approval take?',
    answer:
      'Every manual GCash top-up requires owner review before funds are credited. Once Kozuo verifies your receipt screenshot and reference number, your PHP wallet balance updates immediately.',
  },
  {
    id: 'faq-gcash-only',
    topic: 'WALLET',
    question: 'What payment methods are accepted for wallet top-ups?',
    answer:
      'Kozuo Store currently accepts manual GCash transfers only. Always send the exact PHP amount shown in Step 3 of the Top-Up wizard and upload a clear receipt.',
  },
  {
    id: 'faq-clean-diff',
    topic: 'ACCOUNTS',
    question: 'What is the difference between Clean and Not Clean CODM Accounts?',
    answer:
      'Clean Accounts come with full Gmail/Garena surrender and zero dead third-party binds. Not Clean Accounts have a lost or dead third-party bind and are sold at a lower price as-is. All accounts are One-Time Buy (1 unit only).',
  },
  {
    id: 'faq-stock-status',
    topic: 'BUYING',
    question: 'What do In Stock, Low Stock, Out of Stock, and Restocking Soon mean?',
    answer:
      'In Stock means ready to buy (4+ for files, 1/1 for accounts). Low Stock means 1 to 3 file batches remain. Out of Stock / Sold means the item is no longer available. Restocking Soon means a new batch is on the way and open for reservation inquiries.',
  },
  {
    id: 'faq-verify-official',
    topic: 'BUYING',
    question: 'How do I verify I am messaging the official Kozuo seller?',
    answer:
      'Only use the verified links and scannable QR codes in the Contact Support section of this site: facebook.com/vento.kozuo and t.me/Kaixelexzu, or track orders directly inside My Account.',
  },
];

export function HelpCenterSection({
  socialLinks,
  settings,
  user,
  onJumpToCatalog,
  onJumpToContact,
  onOpenTopUp,
  onOpenAuth,
}: HelpCenterSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const [activeTrackId, setActiveTrackId] = useState<TutorialTrackId>('topup');
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(!prefersReducedMotion);
  const [faqTopic, setFaqTopic] = useState<FaqTopic>('ALL');
  const [faqSearch, setFaqSearch] = useState('');
  const [openFaqId, setOpenFaqId] = useState<string>(FAQ_ITEMS[0].id);

  // Accurate cursor tracking via DOM getBoundingClientRect()
  const stageRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const [cursorCoords, setCursorCoords] = useState<{
    x: number;
    y: number;
    visible: boolean;
  }>({ x: 140, y: 120, visible: false });

  const currentTrack =
    TUTORIAL_TRACKS.find((t) => t.id === activeTrackId) || TUTORIAL_TRACKS[0];
  const safeStepIndex = Math.min(activeStep, currentTrack.steps.length - 1);
  const currentStep = currentTrack.steps[safeStepIndex];

  const assignTargetRef = useCallback((el: HTMLElement | null) => {
    targetRef.current = el;
  }, []);

  const measureCursorPosition = useCallback(() => {
    const stageEl = stageRef.current;
    const targetEl = targetRef.current;
    if (!stageEl || !targetEl) {
      setCursorCoords((prev) => ({ ...prev, visible: false }));
      return;
    }
    const stageRect = stageEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    if (stageRect.width === 0 || targetRect.width === 0) return;

    // Position the pointer tip near the center-right of the exact active button/control
    const x =
      targetRect.left - stageRect.left + Math.min(targetRect.width * 0.62, targetRect.width - 14);
    const y = targetRect.top - stageRect.top + targetRect.height * 0.56;

    setCursorCoords({
      x: Math.max(12, Math.min(stageRect.width - 20, x)),
      y: Math.max(12, Math.min(stageRect.height - 20, y)),
      visible: true,
    });
  }, []);

  useLayoutEffect(() => {
    measureCursorPosition();
    const t1 = window.setTimeout(measureCursorPosition, 80);
    const t2 = window.setTimeout(measureCursorPosition, 320);

    const stageEl = stageRef.current;
    let observer: ResizeObserver | null = null;
    if (stageEl && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => measureCursorPosition());
      observer.observe(stageEl);
    }
    window.addEventListener('resize', measureCursorPosition);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      observer?.disconnect();
      window.removeEventListener('resize', measureCursorPosition);
    };
  }, [activeTrackId, safeStepIndex, measureCursorPosition]);

  useEffect(() => {
    if (!isPlaying || prefersReducedMotion) return;
    const timer = window.setInterval(() => {
      setActiveStep((prev) => (prev + 1) % currentTrack.steps.length);
    }, 3800);
    return () => window.clearInterval(timer);
  }, [isPlaying, prefersReducedMotion, currentTrack.steps.length]);

  const handleSelectTrack = (id: TutorialTrackId) => {
    setActiveTrackId(id);
    setActiveStep(0);
    setIsPlaying(!prefersReducedMotion);
  };

  const filteredFaqs = useMemo(() => {
    const q = faqSearch.trim().toLowerCase();
    return FAQ_ITEMS.filter((item) => {
      if (faqTopic !== 'ALL' && item.topic !== faqTopic) return false;
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q)
      );
    });
  }, [faqTopic, faqSearch]);

  const fbLink = socialLinks.find((l) => l.platform === 'Facebook');
  const tgLink = socialLinks.find((l) => l.platform === 'Telegram');

  return (
    <section
      id="tutorials"
      className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-14 border-t border-white/[0.08] space-y-12"
    >
      {/* Part 1: Tutorial Hub & Interactive Screen Recording */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#3B82F6]">
              Kozuo Help Center · Tutorials
            </p>
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-white text-balance">
              {currentTrack.title}
            </h2>
            <p className="text-sm text-[#9CA3AF] max-w-2xl">
              {currentTrack.summary}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={onJumpToCatalog}
              className="h-9 px-3.5 rounded-lg text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.12] text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              Browse Stocks
            </button>
            <button
              type="button"
              onClick={onJumpToContact}
              className="h-9 px-3.5 rounded-lg text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.12] text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              Contact Support
            </button>
            <button
              type="button"
              onClick={user ? onOpenTopUp : onOpenAuth}
              className="col-span-2 sm:col-span-1 h-9 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              {user ? <Wallet className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
              <span>{user ? 'Top Up GCash' : 'Login to Add Balance'}</span>
            </button>
          </div>
        </div>

        {/* Selectable Tutorial Track Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {TUTORIAL_TRACKS.map((track) => {
            const active = track.id === activeTrackId;
            return (
              <button
                key={track.id}
                type="button"
                onClick={() => handleSelectTrack(track.id)}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  active
                    ? 'bg-[#12141C] border-[#3B82F6] ring-1 ring-[#3B82F6]/30'
                    : 'bg-[#12141C]/60 border-white/[0.08] hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold uppercase tracking-wider text-[#60A5FA]">
                    {track.badge}
                  </span>
                  <span className="font-mono-tabular text-[#9CA3AF]">
                    {track.stepsCountLabel}
                  </span>
                </div>
                <div>
                  <p className="font-display font-bold text-sm sm:text-base text-white">
                    {track.title}
                  </p>
                  <p className="mt-1 text-xs text-[#9CA3AF] line-clamp-2">
                    {track.summary}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Interactive Walkthrough Player + Step Checklist */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: Interactive Animated Simulator */}
          <div className="lg:col-span-7 bg-[#12141C] border border-white/[0.08] rounded-xl overflow-hidden flex flex-col">
            {/* Player Chrome */}
            <div className="px-4 py-2.5 bg-[#0C0E14] border-b border-white/[0.07] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex items-center gap-1 shrink-0" aria-hidden="true">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                </div>
                <span className="text-xs font-semibold text-white truncate">
                  STEP {safeStepIndex + 1} OF {currentTrack.steps.length} ·{' '}
                  {currentStep.shortTitle}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="hidden sm:inline text-[11px] font-mono-tabular text-[#9CA3AF] mr-1">
                  {currentStep.durationLabel}
                </span>
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-white transition-colors cursor-pointer"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3 h-3" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      <span>Play</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveStep(0);
                    setIsPlaying(true);
                  }}
                  className="p-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.1] text-[#9CA3AF] hover:text-white transition-colors cursor-pointer"
                  aria-label="Replay walkthrough"
                  title="Replay from Step 1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Step Description Header inside Simulator */}
            <div className="px-4 py-2.5 bg-[#10131D] border-b border-white/[0.06] flex items-center justify-between gap-4">
              <p className="text-xs text-[#D1D5DB] leading-relaxed">
                {currentStep.description}
              </p>
              <div className="hidden sm:flex items-center gap-1 shrink-0">
                {currentTrack.steps.map((st) => (
                  <span
                    key={st.id}
                    className={`h-1.5 rounded-full transition-all ${
                      st.id === safeStepIndex
                        ? 'w-5 bg-[#3B82F6]'
                        : st.id < safeStepIndex
                        ? 'w-2 bg-[#2563EB]/60'
                        : 'w-2 bg-white/15'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Measured Simulator Stage (Exact getBoundingClientRect Target Tracking) */}
            <div
              ref={stageRef}
              className="relative bg-[#08090E] p-4 sm:p-6 flex-1 min-h-[300px] flex flex-col justify-between overflow-hidden select-none"
            >
              {/* Simulated Mini Header */}
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center">
                    K
                  </span>
                  <span className="font-display font-bold text-xs text-white">
                    KOZUO <span className="text-[#3B82F6]">STORE</span>
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#12141C] border border-white/[0.08] font-mono-tabular text-[11px] text-[#D1D5DB]">
                  {activeTrackId === 'topup' && safeStepIndex === 6
                    ? '₱300.00'
                    : '₱0.00'}
                </span>
              </div>

              {/* TRACK 1: MANUAL GCASH TOP-UP (7 STEPS) */}
              {activeTrackId === 'topup' && (
                <div className="flex-1 flex items-center justify-center">
                  {safeStepIndex === 0 && (
                    <motion.div
                      key="topup-0"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm p-4 rounded-xl bg-[#12141C] border border-white/10 space-y-2.5"
                    >
                      <p className="text-xs font-semibold text-white">
                        1 · Sign in with Username &amp; Password
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="px-2.5 py-1.5 rounded bg-[#0C0E14] border border-white/10 text-[#D1D5DB] truncate">
                          @kozuo_buyer
                        </div>
                        <div className="px-2.5 py-1.5 rounded bg-[#0C0E14] border border-white/10 text-[#9CA3AF]">
                          ••••••••
                        </div>
                      </div>
                      <div
                        ref={assignTargetRef}
                        className="w-full py-2.5 px-3 rounded-lg bg-[#2563EB] text-white text-xs font-semibold flex items-center justify-center gap-2 ring-2 ring-[#60A5FA]/50"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Sign In &amp; Keep Balance</span>
                      </div>
                    </motion.div>
                  )}

                  {safeStepIndex === 1 && (
                    <motion.div
                      key="topup-1"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm p-4 rounded-xl bg-[#12141C] border border-white/10 space-y-3"
                    >
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-[#60A5FA]">
                        1 · SELECT MANUAL METHOD
                      </p>
                      <div
                        ref={assignTargetRef}
                        className="p-3.5 rounded-xl bg-[#0C0E14] border border-[#3B82F6] ring-2 ring-[#3B82F6]/30 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={GCASH_LOGO_PHOTO}
                            alt="GCash"
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-lg object-cover shrink-0"
                          />
                          <div>
                            <p className="text-xs font-semibold text-white">
                              GCash
                            </p>
                            <p className="text-[10px] text-[#9CA3AF]">
                              Manual PHP Transfer · Owner Approved
                            </p>
                          </div>
                        </div>
                        <span className="w-4 h-4 rounded-full bg-[#2563EB] text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    </motion.div>
                  )}

                  {safeStepIndex === 2 && (
                    <motion.div
                      key="topup-2"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm p-4 rounded-xl bg-[#12141C] border border-white/10 space-y-3"
                    >
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200 space-y-1">
                        <p className="font-semibold">Manual Payment Notice</p>
                        <p className="text-[10px] text-[#D1D5DB]">
                          Owner approval required · Send exact amount · Upload valid proof
                        </p>
                      </div>
                      <div
                        ref={assignTargetRef}
                        className="p-2.5 rounded-lg bg-[#0C0E14] border border-[#3B82F6]/60 flex items-center gap-2.5 text-xs text-white"
                      >
                        <span className="w-4 h-4 rounded bg-[#2563EB] flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-white" />
                        </span>
                        <span>I understand and agree.</span>
                      </div>
                      <div className="w-full py-2 rounded-lg bg-[#2563EB] text-center text-xs font-semibold text-white">
                        Continue
                      </div>
                    </motion.div>
                  )}

                  {safeStepIndex === 3 && (
                    <motion.div
                      key="topup-3"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm p-4 rounded-xl bg-[#12141C] border border-white/10 space-y-3"
                    >
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-[#60A5FA]">
                        2 · CHOOSE PHP AMOUNT
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono-tabular">
                        <div className="py-2 rounded-lg bg-[#0C0E14] border border-white/[0.08] text-center text-[#9CA3AF]">
                          ₱50
                        </div>
                        <div className="py-2 rounded-lg bg-[#0C0E14] border border-white/[0.08] text-center text-[#9CA3AF]">
                          ₱100
                        </div>
                        <div className="py-2 rounded-lg bg-[#2563EB]/20 border border-[#3B82F6] text-center text-white font-semibold">
                          ₱300
                        </div>
                        <div className="py-2 rounded-lg bg-[#0C0E14] border border-white/[0.08] text-center text-[#9CA3AF]">
                          ₱500
                        </div>
                      </div>
                      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#0C0E14] text-[11px]">
                        <span className="text-[#9CA3AF]">You will pay</span>
                        <span className="font-mono-tabular font-bold text-emerald-400">
                          ₱300.00
                        </span>
                      </div>
                      <div
                        ref={assignTargetRef}
                        className="w-full py-2 rounded-lg bg-[#2563EB] text-center text-xs font-semibold text-white ring-2 ring-[#60A5FA]/40"
                      >
                        Continue
                      </div>
                    </motion.div>
                  )}

                  {safeStepIndex === 4 && (
                    <motion.div
                      key="topup-4"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm p-4 rounded-xl bg-[#12141C] border border-amber-500/35 space-y-2.5"
                    >
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-amber-300">
                        MANUAL PAYMENT · PHP (GCASH)
                      </p>
                      <div className="p-2.5 rounded-lg bg-[#0C0E14] border border-white/[0.07] flex items-center gap-2.5">
                        <img
                          src={GCASH_LOGO_PHOTO}
                          alt="GCash"
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">
                            GCash · {settings.gcashName || 'J.O'}
                          </p>
                          <p className="text-[10px] text-[#9CA3AF]">
                            Send exact amount only
                          </p>
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#0C0E14] border border-white/[0.07] flex items-center justify-between gap-2">
                        <span className="font-mono-tabular text-xs font-semibold text-white">
                          {settings.gcashNumber || '09933119204'}
                        </span>
                        <span
                          ref={assignTargetRef}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold"
                        >
                          <Check className="w-3 h-3" />
                          <span>Copied</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-0.5">
                        <span className="text-[#9CA3AF]">Amount to send</span>
                        <span className="font-mono-tabular font-bold text-white">
                          ₱300.00
                        </span>
                      </div>
                    </motion.div>
                  )}

                  {safeStepIndex === 5 && (
                    <motion.div
                      key="topup-5"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm p-4 rounded-xl bg-[#12141C] border border-white/10 space-y-3"
                    >
                      <div className="p-3 rounded-lg bg-[#0C0E14] border border-emerald-500/30 flex items-center gap-2.5 text-xs">
                        <Upload className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-emerald-300 font-medium">
                          GCash_Receipt_300.jpg attached
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#0C0E14] border border-white/[0.06] flex justify-between text-[11px]">
                        <span className="text-[#9CA3AF]">You will receive</span>
                        <span className="font-mono-tabular font-bold text-emerald-400">
                          ₱300.00
                        </span>
                      </div>
                      <div
                        ref={assignTargetRef}
                        className="w-full py-2.5 rounded-lg bg-[#2563EB] text-center text-xs font-semibold text-white ring-2 ring-[#60A5FA]/50"
                      >
                        Submit Top-Up Request
                      </div>
                    </motion.div>
                  )}

                  {safeStepIndex === 6 && (
                    <motion.div
                      key="topup-6"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm p-4 rounded-xl bg-[#12141C] border border-emerald-500/35 text-center space-y-2.5"
                    >
                      <span
                        ref={assignTargetRef}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold"
                      >
                        <Check className="w-3 h-3" />
                        Approved by Owner
                      </span>
                      <p className="text-[10px] uppercase tracking-widest text-[#9CA3AF]">
                        PHP BALANCE
                      </p>
                      <p className="font-mono-tabular font-extrabold text-2xl text-white">
                        ₱300.00
                      </p>
                      <p className="text-[11px] text-emerald-400 font-medium">
                        +₱300.00 credited to your wallet
                      </p>
                    </motion.div>
                  )}
                </div>
              )}

              {/* TRACK 2: HOW TO SIGN IN (4 STEPS) */}
              {activeTrackId === 'auth' && (
                <div className="flex-1 flex items-center justify-center">
                  {safeStepIndex === 0 && (
                    <motion.div
                      key="auth-0"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm p-4 rounded-xl bg-[#12141C] border border-white/10 space-y-3"
                    >
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0C0E14] border border-white/[0.08]">
                        <span className="text-xs font-semibold text-white">
                          Store Header
                        </span>
                        <span
                          ref={assignTargetRef}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-semibold ring-2 ring-[#60A5FA]/50"
                        >
                          <LogIn className="w-3 h-3" />
                          <span>Login</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-[#9CA3AF]">
                        Visitors can browse anytime. Tap Login when you are ready to top up or buy using balance.
                      </p>
                    </motion.div>
                  )}

                  {safeStepIndex === 1 && (
                    <motion.div
                      key="auth-1"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm p-4 rounded-xl bg-[#12141C] border border-white/10 space-y-2.5"
                    >
                      <p className="text-xs font-semibold text-white">
                        Username &amp; Password Login
                      </p>
                      <div className="space-y-1.5 text-[11px]">
                        <div className="px-2.5 py-1.5 rounded bg-[#0C0E14] border border-white/10 text-white">
                          @kozuo_buyer
                        </div>
                        <div className="px-2.5 py-1.5 rounded bg-[#0C0E14] border border-white/10 text-[#9CA3AF]">
                          •••••••• · Gmail optional
                        </div>
                      </div>
                      <div
                        ref={assignTargetRef}
                        className="w-full py-2 px-3 rounded-lg bg-[#2563EB] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 ring-2 ring-[#60A5FA]/50"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Sign In / Create Account</span>
                      </div>
                    </motion.div>
                  )}

                  {safeStepIndex === 2 && (
                    <motion.div
                      key="auth-2"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm p-4 rounded-xl bg-[#12141C] border border-white/10 space-y-3"
                    >
                      <p className="text-xs font-semibold text-white">
                        Display Name
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 px-3 py-2 rounded-lg bg-[#0C0E14] border border-white/10 text-xs text-white">
                          Kael M.
                        </div>
                        <span
                          ref={assignTargetRef}
                          className="px-3 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-semibold"
                        >
                          Save
                        </span>
                      </div>
                    </motion.div>
                  )}

                  {safeStepIndex === 3 && (
                    <motion.div
                      key="auth-3"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm p-4 rounded-xl bg-[#12141C] border border-white/10 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[#60A5FA] font-semibold">
                          PHP WALLET
                        </p>
                        <p className="font-mono-tabular font-bold text-lg text-white">
                          {formatPhp(0)}
                        </p>
                      </div>
                      <span
                        ref={assignTargetRef}
                        className="px-3 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-semibold"
                      >
                        Top Up (GCash)
                      </span>
                    </motion.div>
                  )}
                </div>
              )}

              {/* TRACK 3: HOW TO BUY A PRODUCT (5 STEPS) */}
              {activeTrackId === 'buy' && (
                <div className="flex-1 flex items-center justify-center">
                  {safeStepIndex === 0 && (
                    <motion.div
                      key="buy-0"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm space-y-2.5"
                    >
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="px-2 py-1 rounded bg-[#2563EB] text-white font-semibold">
                          CODM ACCOUNT
                        </span>
                        <span
                          ref={assignTargetRef}
                          className="px-2 py-1 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold inline-flex items-center gap-1"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          Clean
                        </span>
                        <span className="px-2 py-1 rounded bg-white/[0.05] text-[#9CA3AF]">
                          Not Clean
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-[#12141C] border border-white/10 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-white">
                            500 VALID HITS — Unlooted
                          </p>
                          <p className="text-[11px] font-mono-tabular text-emerald-400">
                            In Stock · ₱100
                          </p>
                        </div>
                        <span className="text-[11px] text-[#60A5FA] font-medium">
                          Details →
                        </span>
                      </div>
                    </motion.div>
                  )}

                  {safeStepIndex === 1 && (
                    <motion.div
                      key="buy-1"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm p-3.5 rounded-xl bg-[#12141C] border border-white/10 space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">
                          Product Gallery (up to 7 photos)
                        </span>
                        <span className="font-mono-tabular text-[#60A5FA]">
                          ₱150
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[1, 2, 3, 4].map((slot) => (
                          <div
                            key={slot}
                            ref={slot === 2 ? assignTargetRef : undefined}
                            className={`h-8 rounded border flex items-center justify-center text-[10px] font-mono-tabular ${
                              slot === 2
                                ? 'border-[#3B82F6] bg-[#2563EB]/25 text-white'
                                : 'border-white/[0.08] bg-[#0C0E14] text-[#6B7280]'
                            }`}
                          >
                            #{slot}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {safeStepIndex === 2 && (
                    <motion.div
                      key="buy-2"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm p-4 rounded-xl bg-[#12141C] border border-white/10 space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#9CA3AF]">Wallet Balance</span>
                        <span className="font-mono-tabular font-bold text-emerald-400">
                          ₱300.00
                        </span>
                      </div>
                      <div
                        ref={assignTargetRef}
                        className="w-full py-2.5 px-3 rounded-lg bg-[#2563EB] text-white text-xs font-semibold flex items-center justify-center gap-1.5 ring-2 ring-[#60A5FA]/50"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Buy with Wallet Balance · ₱150.00</span>
                      </div>
                    </motion.div>
                  )}

                  {safeStepIndex === 3 && (
                    <motion.div
                      key="buy-3"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm p-4 rounded-xl bg-[#12141C] border border-emerald-500/35 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span
                          ref={assignTargetRef}
                          className="inline-flex items-center gap-1 font-semibold text-emerald-400"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Order #ORD-4821 Confirmed
                        </span>
                        <span className="font-mono-tabular text-white">
                          -₱150.00
                        </span>
                      </div>
                      <p className="text-[11px] text-[#9CA3AF]">
                        Stock count &amp; remaining wallet balance updated automatically.
                      </p>
                    </motion.div>
                  )}

                  {safeStepIndex === 4 && (
                    <motion.div
                      key="buy-4"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm grid grid-cols-2 gap-2.5"
                    >
                      <div className="p-3 rounded-xl bg-[#12141C] border border-white/10 space-y-1">
                        <p className="text-[11px] font-semibold text-white">
                          My Orders Tab
                        </p>
                        <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Delivery Ready
                        </p>
                      </div>
                      <div
                        ref={assignTargetRef}
                        className="p-3 rounded-xl bg-[#12141C] border border-[#3B82F6]/50 space-y-1"
                      >
                        <p className="text-[11px] font-semibold text-white flex items-center gap-1">
                          <QrCode className="w-3.5 h-3.5 text-[#60A5FA]" />
                          FB / Telegram
                        </p>
                        <p className="text-[10px] text-[#9CA3AF] truncate">
                          {tgLink?.handle || fbLink?.handle || 't.me/Kaixelexzu'}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* Pixel-Accurate DOM-Measured Animated Cursor */}
              {!prefersReducedMotion && cursorCoords.visible && (
                <motion.div
                  aria-hidden="true"
                  animate={{ left: cursorCoords.x, top: cursorCoords.y }}
                  transition={{ type: 'spring', stiffness: 180, damping: 22 }}
                  className="pointer-events-none absolute z-20 -translate-x-1 -translate-y-1"
                >
                  <div className="relative">
                    <MousePointer2 className="w-5 h-5 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] fill-[#2563EB]" />
                    <motion.span
                      key={`${activeTrackId}-${safeStepIndex}`}
                      initial={{ scale: 0.4, opacity: 0.95 }}
                      animate={{ scale: 2.1, opacity: 0 }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                      className="absolute -inset-1 rounded-full border border-[#60A5FA]"
                    />
                  </div>
                </motion.div>
              )}

              {/* Bottom Status Tip */}
              <div className="mt-4 pt-2.5 border-t border-white/[0.06] flex items-center justify-between gap-2 text-[11px] text-[#9CA3AF]">
                <span>
                  Click any step number on the right to jump straight to that step.
                </span>
                <span className="font-mono-tabular text-[#60A5FA] shrink-0">
                  {safeStepIndex + 1} / {currentTrack.steps.length}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Interactive Step Checklist (01..07 / 01..04 / 01..05) */}
          <div className="lg:col-span-5 bg-[#12141C] border border-white/[0.08] rounded-xl p-5 flex flex-col justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#3B82F6]">
                Step Checklist
              </p>
              <h3 className="font-display font-bold text-lg text-white">
                {currentTrack.title}
              </h3>
            </div>

            <ol className="space-y-2.5 flex-1">
              {currentTrack.steps.map((step) => {
                const isDone = step.id < safeStepIndex;
                const isCurrent = step.id === safeStepIndex;
                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveStep(step.id);
                        setIsPlaying(false);
                      }}
                      className={`w-full p-2.5 rounded-xl flex items-center gap-3 text-left transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-[#2563EB]/15 border border-[#3B82F6]/60'
                          : 'bg-[#0C0E14] border border-white/[0.06] hover:border-white/15'
                      }`}
                    >
                      <span
                        className={`relative w-8 h-8 rounded-lg font-mono-tabular text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${
                          isCurrent
                            ? 'bg-[#2563EB] text-white'
                            : isDone
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-[#12141C] text-[#9CA3AF] border border-white/[0.08]'
                        }`}
                      >
                        {step.code}
                        {isDone && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-semibold truncate ${
                            isCurrent ? 'text-white' : 'text-[#D1D5DB]'
                          }`}
                        >
                          {step.shortTitle}
                        </p>
                        {isCurrent && (
                          <p className="text-[11px] text-[#9CA3AF] line-clamp-2 mt-0.5">
                            {step.description}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>

            <button
              type="button"
              onClick={user ? onOpenTopUp : onOpenAuth}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer"
            >
              {user ? <Wallet className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
              <span>{user ? 'Open GCash Top-Up' : 'Login to Add Balance'}</span>
            </button>
          </div>
        </div>

        {/* Beginner 4-Step Quick Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
          {BEGINNER_GUIDES.map((guide) => (
            <div
              key={guide.step}
              className="h-full p-4 rounded-xl bg-[#12141C] border border-white/[0.08] flex flex-col gap-1.5"
            >
              <span className="font-mono-tabular text-xs font-bold text-[#3B82F6]">
                {guide.step}
              </span>
              <h4 className="text-sm font-semibold text-white">
                {guide.title}
              </h4>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                {guide.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Part 2: FAQ Center */}
      <div id="faq" className="pt-8 border-t border-white/[0.06] space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#3B82F6]">
              FAQ Center
            </p>
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-white">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="grid grid-cols-2 sm:inline-flex gap-1 p-1 rounded-lg bg-[#12141C] border border-white/[0.08]">
              {(
                [
                  { id: 'ALL', label: 'All' },
                  { id: 'WALLET', label: 'GCash & Wallet' },
                  { id: 'ACCOUNTS', label: 'Accounts' },
                  { id: 'BUYING', label: 'Buying & Support' },
                ] as const
              ).map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => setFaqTopic(topic.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    faqTopic === topic.id
                      ? 'bg-[#2563EB] text-white'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  {topic.label}
                </button>
              ))}
            </div>

            <div className="relative sm:w-56">
              <Search className="w-3.5 h-3.5 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                placeholder="Search FAQ..."
                className="w-full h-9 pl-8 pr-3 rounded-lg bg-[#12141C] border border-white/[0.08] text-xs text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>
          </div>
        </div>

        {filteredFaqs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
            {filteredFaqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div
                  key={faq.id}
                  className="bg-[#12141C] border border-white/[0.08] rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqId(isOpen ? '' : faq.id)}
                    className="w-full px-5 py-4 text-left flex items-start justify-between gap-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
                    <span className="text-sm font-semibold text-white leading-snug">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#9CA3AF] shrink-0 mt-0.5 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#60A5FA]' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 pt-1 border-t border-white/[0.05] text-xs sm:text-sm text-[#9CA3AF] leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-[#12141C] border border-white/[0.08] text-center space-y-2">
            <HelpCircle className="w-5 h-5 text-[#60A5FA] mx-auto" />
            <p className="text-sm text-[#9CA3AF]">
              No matching FAQ found. Message Kozuo directly below!
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
