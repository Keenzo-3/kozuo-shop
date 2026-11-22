import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ImagePlus,
  Inbox,
  Loader2,
  LogIn,
  LogOut,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Wallet,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  deriveAutoStockStatus,
  formatBuyerAccountLabel,
  formatPhp,
  getStatusToneClass,
  isItemSold,
  isRestockingStatus,
  normalizeVoucherCode,
  type CustomerInquiry,
  type DealChannel,
  type InquiryStatus,
  type OrderDeliveryStatus,
  type ReviewInput,
  type ReviewItem,
  type SocialLink,
  type SocialLinkInput,
  type SocialPlatform,
  type StockFormInput,
  type StockItem,
  type StoreOrder,
  type StoreSettings,
  type TopUpRequest,
  type UserProfile,
  type VoucherCode,
  type VoucherDiscountType,
  type VoucherInput,
} from '../types/store';
import { compressImageToDataUrl } from '../lib/imageUtils';
import { SocialIcon } from './SocialIcon';

export type StudioTab =
  | 'stocks'
  | 'topups'
  | 'orders'
  | 'vouchers'
  | 'updates'
  | 'inquiries'
  | 'reviews'
  | 'social'
  | 'settings';

interface OwnerStudioModalProps {
  isOpen: boolean;
  initialTab?: StudioTab;
  prefillReviewItemLabel?: string;
  initialEditingReview?: ReviewItem | null;
  user: User | null;
  isAdmin: boolean;
  stocks: StockItem[];
  topUpRequests: TopUpRequest[];
  orders: StoreOrder[];
  vouchers: VoucherCode[];
  userProfiles: UserProfile[];
  inquiries: CustomerInquiry[];
  reviews: ReviewItem[];
  socialLinks: SocialLink[];
  settings: StoreSettings;
  onClose: () => void;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onAddNewStock: () => void;
  onEditStock: (item: StockItem) => void;
  onDuplicateStock: (draft: StockFormInput) => void;
  onQuickUpdate: (
    item: StockItem,
    nextStatus: string,
    nextCount: number
  ) => Promise<void>;
  onMarkSold: (item: StockItem) => Promise<void>;
  onRestoreAvailable: (item: StockItem) => Promise<void>;
  onDeleteStock: (item: StockItem) => Promise<void>;
  onApproveTopUp: (req: TopUpRequest) => Promise<void>;
  onRejectTopUp: (requestId: string, reason: string) => Promise<void>;
  onUpdateOrderDelivery: (
    orderId: string,
    status: OrderDeliveryStatus,
    note: string
  ) => Promise<void>;
  onCreateVoucher: (input: VoucherInput) => Promise<string>;
  onToggleVoucherActive: (code: string, nextActive: boolean) => Promise<void>;
  onDeleteVoucher: (code: string) => Promise<void>;
  onUpdateInquiryStatus: (
    inquiryId: string,
    status: InquiryStatus
  ) => Promise<void>;
  onDeleteInquiry: (inquiryId: string) => Promise<void>;
  onSaveReview: (input: ReviewInput, existingId?: string) => Promise<void>;
  onDeleteReview: (reviewId: string) => Promise<void>;
  onSaveSocialLink: (
    input: SocialLinkInput,
    existingId?: string
  ) => Promise<void>;
  onDeleteSocialLink: (linkId: string) => Promise<void>;
  onSaveSettings: (next: StoreSettings) => Promise<void>;
  onSeedTemplates: () => Promise<void>;
  onClearAllStocks: () => Promise<void>;
  duplicateCount: number;
  onRemoveDuplicates: () => Promise<number>;
}

const PLATFORMS: SocialPlatform[] = [
  'Facebook',
  'Telegram',
  'Messenger',
  'Discord',
  'TikTok',
  'WhatsApp',
  'Instagram',
  'Custom',
];

const EMPTY_SOCIAL: SocialLinkInput = {
  platform: 'Facebook',
  label: '',
  handle: '',
  url: '',
  sortOrder: 1,
};

const EMPTY_REVIEW: ReviewInput = {
  buyerName: '',
  itemLabel: '',
  rating: 5,
  comment: '',
  dealChannel: 'Facebook',
  proofImageUrl: '',
};

const EMPTY_VOUCHER: VoucherInput = {
  code: '',
  discountType: 'fixed',
  discountValue: 50,
  minOrderPhp: 0,
  maxUses: 50,
  active: true,
  expiresDate: '',
  note: '',
};

function formatTimestamp(ts?: { toMillis?: () => number } | null): string {
  if (!ts || typeof ts.toMillis !== 'function') return 'Just now';
  try {
    return new Date(ts.toMillis()).toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'Updated';
  }
}

export function OwnerStudioModal({
  isOpen,
  initialTab = 'stocks',
  prefillReviewItemLabel = '',
  initialEditingReview = null,
  user,
  isAdmin,
  stocks,
  topUpRequests,
  orders,
  vouchers,
  userProfiles,
  inquiries,
  reviews,
  socialLinks,
  settings,
  onClose,
  onSignIn,
  onSignOut,
  onAddNewStock,
  onEditStock,
  onDuplicateStock,
  onQuickUpdate,
  onMarkSold,
  onRestoreAvailable,
  onDeleteStock,
  onApproveTopUp,
  onRejectTopUp,
  onUpdateOrderDelivery,
  onCreateVoucher,
  onToggleVoucherActive,
  onDeleteVoucher,
  onUpdateInquiryStatus,
  onDeleteInquiry,
  onSaveReview,
  onDeleteReview,
  onSaveSocialLink,
  onDeleteSocialLink,
  onSaveSettings,
  onSeedTemplates,
  onClearAllStocks,
  duplicateCount,
  onRemoveDuplicates,
}: OwnerStudioModalProps) {
  const [tab, setTab] = useState<StudioTab>(initialTab);
  const [stockSearch, setStockSearch] = useState('');
  const [stockViewFilter, setStockViewFilter] = useState<
    'ALL' | 'ACTIVE' | 'LOW' | 'RESTOCK' | 'SOLD'
  >('ALL');
  const [topUpFilter, setTopUpFilter] = useState<
    'ALL' | 'Pending' | 'Approved' | 'Rejected'
  >('Pending');
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>(
    {}
  );
  const [orderDrafts, setOrderDrafts] = useState<
    Record<string, { status: OrderDeliveryStatus; note: string }>
  >({});
  const [zoomedReceipt, setZoomedReceipt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signInBusy, setSignInBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [exportZipAvailable, setExportZipAvailable] = useState(false);

  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewInput>(EMPTY_REVIEW);

  const [editingSocialId, setEditingSocialId] = useState<string | null>(null);
  const [socialForm, setSocialForm] = useState<SocialLinkInput>(EMPTY_SOCIAL);
  const [settingsForm, setSettingsForm] = useState<StoreSettings>(settings);

  const [voucherForm, setVoucherForm] = useState<VoucherInput>(EMPTY_VOUCHER);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [copiedVoucherCode, setCopiedVoucherCode] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setSettingsForm(settings);
      setNotice(null);
      setAuthError(null);
      setVoucherError(null);
      setCopiedVoucherCode(null);
      setConfirmClearAll(false);
      setZoomedReceipt(null);
      if (initialEditingReview) {
        setEditingReviewId(initialEditingReview.id);
        setReviewForm({
          buyerName: initialEditingReview.buyerName,
          itemLabel: initialEditingReview.itemLabel,
          rating: initialEditingReview.rating,
          comment: initialEditingReview.comment,
          dealChannel: initialEditingReview.dealChannel,
          proofImageUrl: initialEditingReview.proofImageUrl,
        });
      } else if (prefillReviewItemLabel) {
        setEditingReviewId(null);
        setReviewForm({
          ...EMPTY_REVIEW,
          itemLabel: prefillReviewItemLabel,
        });
      } else {
        setEditingReviewId(null);
        setReviewForm(EMPTY_REVIEW);
      }
    }
  }, [isOpen, initialTab, settings, prefillReviewItemLabel, initialEditingReview]);

  useEffect(() => {
    if (!isOpen || !isAdmin) {
      setExportZipAvailable(false);
      return;
    }
    let cancelled = false;
    fetch('/__export/kozuo-store-final.zip', { method: 'HEAD' })
      .then((res) => {
        if (!cancelled) {
          const ct = res.headers.get('content-type') || '';
          setExportZipAvailable(res.ok && ct.includes('zip'));
        }
      })
      .catch(() => {
        if (!cancelled) setExportZipAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, isAdmin]);

  const recentlyUpdatedStocks = useMemo(() => {
    return [...stocks].sort((a, b) => {
      const aTime = a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
      const bTime = b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
      return bTime - aTime;
    });
  }, [stocks]);

  const newInquiryCount = inquiries.filter((inq) => inq.status === 'New').length;
  const pendingTopUpCount = topUpRequests.filter(
    (req) => req.status === 'Pending'
  ).length;
  const processingOrderCount = orders.filter(
    (ord) => ord.deliveryStatus === 'Processing'
  ).length;

  const filteredTopUps = useMemo(() => {
    return topUpRequests.filter((req) =>
      topUpFilter === 'ALL' ? true : req.status === topUpFilter
    );
  }, [topUpRequests, topUpFilter]);

  if (!isOpen) return null;

  const filteredStocks = stocks.filter((item) => {
    const sold = isItemSold(item);
    const restocking = isRestockingStatus(item.status);
    const isLow = item.status.toLowerCase().includes('low');

    if (stockViewFilter === 'ACTIVE' && sold) return false;
    if (stockViewFilter === 'LOW' && !isLow) return false;
    if (stockViewFilter === 'RESTOCK' && !restocking) return false;
    if (stockViewFilter === 'SOLD' && !sold) return false;

    const q = stockSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.accountGroup.toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q)
    );
  });

  const handleProofUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProof(true);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setReviewForm((prev) => ({ ...prev, proofImageUrl: dataUrl }));
    } finally {
      setUploadingProof(false);
      e.target.value = '';
    }
  };

  const handleReviewSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reviewForm.buyerName.trim() || !reviewForm.comment.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      await onSaveReview(reviewForm, editingReviewId ?? undefined);
      setReviewForm(EMPTY_REVIEW);
      setEditingReviewId(null);
      setNotice('Buyer review saved.');
    } finally {
      setBusy(false);
    }
  };

  const handleSocialSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!socialForm.url.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      await onSaveSocialLink(socialForm, editingSocialId ?? undefined);
      setSocialForm({
        ...EMPTY_SOCIAL,
        sortOrder: socialLinks.length + 1,
      });
      setEditingSocialId(null);
      setNotice('Social contact link saved.');
    } finally {
      setBusy(false);
    }
  };

  const handleSettingsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await onSaveSettings(settingsForm);
      setNotice('Storefront branding and texts updated.');
    } finally {
      setBusy(false);
    }
  };

  const handleSeed = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await onSeedTemplates();
      setNotice('Default file packs, reviews, and links loaded.');
    } finally {
      setBusy(false);
    }
  };

  const handleVoucherSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setVoucherError(null);
    setNotice(null);
    const normalized = normalizeVoucherCode(voucherForm.code);
    if (!BLUEPRINT_LIMITS.VOUCHER.CODE_PATTERN.test(normalized)) {
      setVoucherError(
        'Voucher code must be 3–24 characters using A–Z, 0–9, underscore (_), or hyphen (-).'
      );
      return;
    }
    setBusy(true);
    try {
      const createdCode = await onCreateVoucher({
        ...voucherForm,
        code: normalized,
      });
      setVoucherForm(EMPTY_VOUCHER);
      setNotice(`Voucher code ${createdCode} created.`);
    } catch (err) {
      setVoucherError(
        err instanceof Error ? err.message : 'Unable to create voucher.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Owner Studio"
    >
      <div
        className="w-full max-w-5xl bg-[#12141C] border border-white/10 rounded-xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-lg text-white">
              Owner Admin Dashboard
            </h2>
            <p className="text-xs text-[#9CA3AF]">
              Manage products, auto-update stock counts, track recent updates, and reply to customer inquiries.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-[#D1D5DB] transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Owner Studio"
              className="p-2 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!user ? (
          <div className="p-8 text-center space-y-4 max-w-md mx-auto">
            <h3 className="font-display font-bold text-xl text-white">
              Owner Sign-In
            </h3>
            <p className="text-sm text-[#9CA3AF] leading-relaxed">
              Sign in with the authorized store owner Google account to manage
              stocks, customer inquiries, reviews, and storefront settings.
            </p>
            {authError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 text-left leading-relaxed">
                {authError}
              </div>
            )}
            <button
              type="button"
              disabled={signInBusy}
              onClick={async () => {
                setAuthError(null);
                setSignInBusy(true);
                try {
                  await onSignIn();
                } catch (err) {
                  const raw = err instanceof Error ? err.message : String(err);
                  if (raw.includes('auth/unauthorized-domain')) {
                    setAuthError(
                      `Domain "${window.location.hostname}" is not authorized yet in Firebase Authentication. Add it in Firebase Console → Authentication → Settings → Authorized domains.`
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
                  setSignInBusy(false);
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white transition-colors cursor-pointer"
            >
              {signInBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              <span>{signInBusy ? 'Signing in...' : 'Sign in with Google'}</span>
            </button>
          </div>
        ) : !isAdmin ? (
          <div className="p-8 text-center space-y-4 max-w-md mx-auto">
            <h3 className="font-display font-bold text-xl text-white">
              Access Denied
            </h3>
            <p className="text-sm text-[#9CA3AF] leading-relaxed">
              This Google account does not have permission to edit this store.
            </p>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white/[0.08] hover:bg-white/[0.14] text-white transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
              <div className="inline-flex flex-wrap p-1 rounded-lg bg-[#090A0F] border border-white/[0.08]">
                {(
                  [
                    { id: 'stocks', label: `Products (${stocks.length})` },
                    {
                      id: 'topups',
                      label:
                        pendingTopUpCount > 0
                          ? `Top-Ups (${pendingTopUpCount} pending)`
                          : `Top-Ups (${topUpRequests.length})`,
                    },
                    {
                      id: 'orders',
                      label:
                        processingOrderCount > 0
                          ? `Orders (${processingOrderCount} new)`
                          : `Orders (${orders.length})`,
                    },
                    { id: 'vouchers', label: `Vouchers (${vouchers.length})` },
                    { id: 'updates', label: 'Updates' },
                    {
                      id: 'inquiries',
                      label:
                        newInquiryCount > 0
                          ? `Inquiries (${newInquiryCount})`
                          : `Inquiries (${inquiries.length})`,
                    },
                    { id: 'reviews', label: `Reviews (${reviews.length})` },
                    { id: 'social', label: `Links (${socialLinks.length})` },
                    { id: 'settings', label: 'Settings' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      tab === item.id
                        ? 'bg-[#2563EB] text-white'
                        : 'text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {notice && (
                  <span className="text-xs text-emerald-400 font-medium">
                    {notice}
                  </span>
                )}
                {exportZipAvailable && (
                  <a
                    href="/__export/kozuo-store-final.zip"
                    download="kozuo-store-final.zip"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 transition-colors whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Code (.zip)</span>
                  </a>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSeed}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-[#D1D5DB] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#60A5FA]" />
                  <span>Load Default Templates</span>
                </button>
              </div>
            </div>

            {/* TAB 1: PRODUCTS / STOCKS */}
            {tab === 'stocks' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                    <input
                      type="text"
                      value={stockSearch}
                      onChange={(e) => setStockSearch(e.target.value)}
                      placeholder="Filter products..."
                      className="flex-1 min-w-[160px] px-3.5 py-2 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                    />
                    <div className="inline-flex flex-wrap p-0.5 rounded-lg bg-[#0C0E14] border border-white/[0.08]">
                      {(
                        [
                          { id: 'ALL', label: 'All' },
                          { id: 'ACTIVE', label: 'In Stock' },
                          { id: 'LOW', label: 'Low Stock' },
                          { id: 'RESTOCK', label: 'Restocking' },
                          { id: 'SOLD', label: 'Out / Sold' },
                        ] as const
                      ).map((vf) => (
                        <button
                          key={vf.id}
                          type="button"
                          onClick={() => setStockViewFilter(vf.id)}
                          className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                            stockViewFilter === vf.id
                              ? 'bg-white/[0.12] text-white'
                              : 'text-[#9CA3AF] hover:text-white'
                          }`}
                        >
                          {vf.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {stocks.length > 0 &&
                      (confirmClearAll ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await onClearAllStocks();
                              setConfirmClearAll(false);
                              setNotice('All products cleared.');
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="px-3 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                        >
                          Confirm Clear All?
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmClearAll(true)}
                          className="px-3 py-2 rounded-lg text-xs font-medium bg-white/[0.04] hover:bg-rose-500/20 text-[#9CA3AF] hover:text-rose-300 transition-colors cursor-pointer"
                        >
                          Clear All
                        </button>
                      ))}
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onAddNewStock();
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Product</span>
                    </button>
                  </div>
                </div>

                {duplicateCount > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-amber-200 leading-relaxed">
                      Detected{' '}
                      <strong className="font-mono-tabular text-white">
                        {duplicateCount}
                      </strong>{' '}
                      duplicate stock listing(s) (same code &amp; title). Clean them up in one click while keeping one copy of each listing.
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setNotice(null);
                        try {
                          const removed = await onRemoveDuplicates();
                          setNotice(
                            removed > 0
                              ? `Removed ${removed} duplicate stock listing(s).`
                              : 'No duplicate listings remaining.'
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove {duplicateCount} Duplicates</span>
                    </button>
                  </div>
                )}

                {filteredStocks.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[#0C0E14] border border-white/[0.08] text-center space-y-3">
                    <p className="text-sm text-[#9CA3AF]">
                      No matching products found in this filter.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.06] border border-white/[0.08] rounded-xl bg-[#0C0E14] overflow-hidden">
                    {filteredStocks.map((item) => {
                      const isAccount = item.category === 'CODM ACCOUNT';
                      const sold = isItemSold(item);
                      const restocking = isRestockingStatus(item.status);
                      return (
                        <div
                          key={item.id}
                          className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-white/[0.02]"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className={`w-12 h-9 rounded object-cover bg-[#12141C] shrink-0 ${
                                sold ? 'opacity-45 grayscale' : ''
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white truncate">
                                {item.title}
                              </p>
                              <p className="text-xs text-[#9CA3AF] truncate">
                                <span className="font-mono-tabular text-[#60A5FA]">
                                  {item.code}
                                </span>
                                {' · '}
                                {item.category}
                                {isAccount
                                  ? ` · ${item.accountGroup} (One-Time Buy)`
                                  : ` · Qty: ${item.stockCount}`}
                                {' · '}
                                <span className="font-mono-tabular text-white">
                                  {item.priceLabel}
                                </span>
                                {' · '}
                                <span className={getStatusToneClass(item.status)}>
                                  {item.status}
                                </span>
                                {item.autoDelivery ? (
                                  <span className="text-emerald-400">
                                    {' · '}Instant Auto-Delivery
                                  </span>
                                ) : null}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {!isAccount && (
                              <input
                                type="number"
                                min={0}
                                max={BLUEPRINT_LIMITS.DELIVERY.MAX_UNITS}
                                value={item.stockCount}
                                onChange={(e) => {
                                  const val = Math.min(
                                    BLUEPRINT_LIMITS.DELIVERY.MAX_UNITS,
                                    Math.max(0, Number(e.target.value) || 0)
                                  );
                                  const nextStatus = deriveAutoStockStatus(
                                    item.category,
                                    item.status,
                                    val
                                  );
                                  onQuickUpdate(item, nextStatus, val);
                                }}
                                title="Edit quantity (auto-updates In Stock / Low Stock / Out of Stock)"
                                className="w-16 px-2 py-1.5 rounded-md bg-[#12141C] border border-white/[0.1] text-xs font-mono-tabular text-white text-center"
                              />
                            )}

                            {sold || restocking ? (
                              <button
                                type="button"
                                onClick={() => onRestoreAvailable(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-semibold cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Available</span>
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onMarkSold(item)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Mark Sold</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onQuickUpdate(item, 'Restocking Soon', 0)
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-xs font-semibold cursor-pointer"
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>Restock</span>
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onDuplicateStock({
                                  title: `${item.title} (Copy)`,
                                  code: `STK-${Math.floor(
                                    100 + Math.random() * 899
                                  )}`,
                                  category: item.category,
                                  accountGroup: item.accountGroup,
                                  fileType: item.fileType,
                                  priceLabel: item.priceLabel,
                                  pricePhp: item.pricePhp,
                                  status: 'In Stock',
                                  stockCount: isAccount
                                    ? 1
                                    : Math.min(
                                        BLUEPRINT_LIMITS.DELIVERY.MAX_UNITS,
                                        Math.max(1, item.stockCount)
                                      ),
                                  bindSummary: item.bindSummary,
                                  description: item.description,
                                  specifications: [],
                                  highlights: [],
                                  imageUrl: item.imageUrl,
                                  galleryImages: item.galleryImages,
                                  featured: item.featured,
                                  autoDelivery: item.autoDelivery,
                                });
                              }}
                              title="Duplicate product"
                              className="p-2 rounded-md bg-white/[0.04] hover:bg-white/[0.1] text-[#9CA3AF] hover:text-white transition-colors cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onEditStock(item);
                              }}
                              title="Edit product"
                              className="p-2 rounded-md bg-white/[0.04] hover:bg-[#2563EB]/25 text-[#93C5FD] transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onDeleteStock(item)}
                              title="Delete product"
                              className="p-2 rounded-md bg-white/[0.04] hover:bg-rose-500/20 text-[#9CA3AF] hover:text-rose-400 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB: GCASH TOP-UP APPROVALS */}
            {tab === 'topups' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-[#9CA3AF]">
                    Review submitted GCash receipts carefully before approving. Approving atomically credits the buyer&apos;s PHP wallet balance.
                  </p>
                  <div className="inline-flex p-0.5 rounded-lg bg-[#0C0E14] border border-white/[0.08]">
                    {(['Pending', 'Approved', 'Rejected', 'ALL'] as const).map(
                      (st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setTopUpFilter(st)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer ${
                            topUpFilter === st
                              ? 'bg-[#2563EB] text-white'
                              : 'text-[#9CA3AF] hover:text-white'
                          }`}
                        >
                          {st === 'ALL' ? 'All' : st}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {filteredTopUps.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[#0C0E14] border border-white/[0.08] text-center space-y-2">
                    <Wallet className="w-6 h-6 text-[#60A5FA] mx-auto" />
                    <p className="text-sm text-[#9CA3AF]">
                      No GCash top-up requests in this filter.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredTopUps.map((req) => {
                      const buyerProf = userProfiles.find(
                        (u) => u.uid === req.userId
                      );
                      const rejectReason =
                        rejectReasons[req.id] ??
                        'Receipt could not be verified. Please contact support.';
                      return (
                        <div
                          key={req.id}
                          className="p-4 rounded-xl bg-[#0C0E14] border border-white/[0.08] flex flex-col md:flex-row md:items-start justify-between gap-4"
                        >
                          <div className="flex items-start gap-3.5 min-w-0 flex-1">
                            {req.proofImageUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setZoomedReceipt(req.proofImageUrl)
                                }
                                className="w-20 h-20 rounded-lg overflow-hidden border border-white/15 shrink-0 cursor-pointer hover:border-[#3B82F6]"
                                title="Click to inspect receipt screenshot"
                              >
                                <img
                                  src={req.proofImageUrl}
                                  alt={`Receipt ${req.requestCode}`}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            )}
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-mono-tabular font-bold text-[#60A5FA]">
                                  #{req.requestCode}
                                </span>
                                <span className="font-mono-tabular font-bold text-base text-white">
                                  {formatPhp(req.amountPhp)}
                                </span>
                                <span className="text-[#9CA3AF]">
                                  · {req.method}
                                </span>
                                <span
                                  className={`font-semibold ${
                                    req.status === 'Approved'
                                      ? 'text-emerald-400'
                                      : req.status === 'Rejected'
                                      ? 'text-rose-400'
                                      : 'text-amber-400'
                                  }`}
                                >
                                  {req.status}
                                </span>
                              </div>
                              <p className="text-xs text-white font-medium truncate">
                                {req.userName}{' '}
                                <span className="text-[#9CA3AF]">
                                  (
                                  {formatBuyerAccountLabel(
                                    req.userEmail,
                                    buyerProf?.username,
                                    buyerProf?.contactEmail
                                  )}
                                  )
                                </span>
                              </p>
                              <p className="text-xs text-[#9CA3AF]">
                                Submitted {formatTimestamp(req.createdAt)}
                                {req.referenceNo
                                  ? ` · GCash Ref: ${req.referenceNo}`
                                  : ''}
                                {buyerProf
                                  ? ` · Current Wallet: ${formatPhp(
                                      buyerProf.balance
                                    )}`
                                  : ''}
                              </p>
                              {req.adminNote && (
                                <p className="text-xs text-[#D1D5DB]">
                                  Note: {req.adminNote}
                                </p>
                              )}
                            </div>
                          </div>

                          {req.status === 'Pending' && (
                            <div className="flex flex-col gap-2 shrink-0 md:w-64">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                  setBusy(true);
                                  setNotice(null);
                                  try {
                                    await onApproveTopUp(req);
                                    setNotice(
                                      `Approved #${req.requestCode} (+${formatPhp(
                                        req.amountPhp
                                      )}).`
                                    );
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                                className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>
                                  Approve &amp; Credit {formatPhp(req.amountPhp)}
                                </span>
                              </button>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  maxLength={BLUEPRINT_LIMITS.TOPUP.ADMIN_NOTE_MAX}
                                  value={rejectReason}
                                  onChange={(e) =>
                                    setRejectReasons((prev) => ({
                                      ...prev,
                                      [req.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Rejection reason..."
                                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#12141C] border border-white/[0.1] text-xs text-white"
                                />
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={async () => {
                                    setBusy(true);
                                    setNotice(null);
                                    try {
                                      await onRejectTopUp(req.id, rejectReason);
                                      setNotice(
                                        `Rejected #${req.requestCode}.`
                                      );
                                    } finally {
                                      setBusy(false);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 cursor-pointer shrink-0"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB: WALLET PURCHASE ORDERS & DELIVERY */}
            {tab === 'orders' && (
              <div className="space-y-4">
                <p className="text-xs text-[#9CA3AF] leading-relaxed">
                  Wallet orders appear here in real time. Products with{' '}
                  <strong className="text-emerald-400">
                    Instant Auto-Delivery
                  </strong>{' '}
                  unlock automatically right after purchase. For manual orders
                  marked{' '}
                  <strong className="text-amber-400">Processing</strong>, paste
                  the account credentials or file download link below and click{' '}
                  <strong className="text-white">Mark Delivered</strong> so the
                  buyer receives it immediately inside{' '}
                  <strong className="text-white">My Orders</strong>.
                </p>

                {orders.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[#0C0E14] border border-white/[0.08] text-center space-y-2">
                    <ShoppingBag className="w-6 h-6 text-[#60A5FA] mx-auto" />
                    <p className="text-sm text-[#9CA3AF]">
                      No wallet orders placed yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((ord) => {
                      const buyerProf = userProfiles.find(
                        (u) => u.uid === ord.userId
                      );
                      const draft = orderDrafts[ord.id] || {
                        status: ord.deliveryStatus,
                        note: ord.deliveryNote,
                      };
                      const isProcessing = ord.deliveryStatus === 'Processing';
                      return (
                        <div
                          key={ord.id}
                          className="p-4 rounded-xl bg-[#0C0E14] border border-white/[0.08] space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-mono-tabular font-bold text-[#60A5FA]">
                                  #{ord.orderCode}
                                </span>
                                <span className="text-white font-semibold">
                                  [{ord.stockCode}] {ord.stockTitle}
                                </span>
                              </div>
                              <p className="text-xs text-[#9CA3AF]">
                                Buyer:{' '}
                                <strong className="text-white">
                                  {ord.userName}
                                </strong>{' '}
                                (
                                {formatBuyerAccountLabel(
                                  ord.userEmail,
                                  buyerProf?.username,
                                  buyerProf?.contactEmail
                                )}
                                ) · Qty: {ord.quantity} · Paid{' '}
                                <span className="font-mono-tabular text-emerald-400 font-semibold">
                                  {formatPhp(ord.totalPhp)}
                                </span>{' '}
                                {ord.voucherCode ? (
                                  <span className="text-emerald-400">
                                    · Voucher {ord.voucherCode} (-
                                    {formatPhp(ord.discountPhp ?? 0)}){' '}
                                  </span>
                                ) : null}
                                · {formatTimestamp(ord.createdAt)}
                              </p>
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

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                            <select
                              value={draft.status}
                              onChange={(e) =>
                                setOrderDrafts((prev) => ({
                                  ...prev,
                                  [ord.id]: {
                                    ...draft,
                                    status: e.target.value as OrderDeliveryStatus,
                                  },
                                }))
                              }
                              className="sm:col-span-3 px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-xs text-white"
                            >
                              <option value="Processing">Processing</option>
                              <option value="Delivered">Delivered</option>
                              <option value="Refunded">Refunded</option>
                            </select>

                            <input
                              type="text"
                              maxLength={BLUEPRINT_LIMITS.ORDER.DELIVERY_NOTE_MAX}
                              value={draft.note}
                              onChange={(e) =>
                                setOrderDrafts((prev) => ({
                                  ...prev,
                                  [ord.id]: {
                                    ...draft,
                                    note: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Paste download link, account user/pass, or handoff note..."
                              className="sm:col-span-6 px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-xs text-white placeholder-[#6B7280]"
                            />

                            <button
                              type="button"
                              disabled={busy}
                              onClick={async () => {
                                const targetStatus: OrderDeliveryStatus =
                                  isProcessing &&
                                  draft.status === 'Processing' &&
                                  draft.note.trim().length > 0
                                    ? 'Delivered'
                                    : draft.status;
                                setBusy(true);
                                setNotice(null);
                                try {
                                  await onUpdateOrderDelivery(
                                    ord.id,
                                    targetStatus,
                                    draft.note
                                  );
                                  setOrderDrafts((prev) => ({
                                    ...prev,
                                    [ord.id]: {
                                      status: targetStatus,
                                      note: draft.note,
                                    },
                                  }));
                                  setNotice(
                                    `Order #${ord.orderCode} updated (${targetStatus}).`
                                  );
                                } finally {
                                  setBusy(false);
                                }
                              }}
                              className={`sm:col-span-3 px-3.5 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer whitespace-nowrap ${
                                isProcessing &&
                                draft.status === 'Processing' &&
                                draft.note.trim().length > 0
                                  ? 'bg-emerald-600 hover:bg-emerald-500'
                                  : 'bg-[#2563EB] hover:bg-[#1D4ED8]'
                              }`}
                            >
                              {isProcessing &&
                              draft.status === 'Processing' &&
                              draft.note.trim().length > 0
                                ? 'Send & Mark Delivered'
                                : 'Save Delivery'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB: PROMO VOUCHER CODES */}
            {tab === 'vouchers' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <form
                  onSubmit={handleVoucherSubmit}
                  className="lg:col-span-5 p-4 rounded-xl bg-[#0C0E14] border border-white/[0.08] space-y-3.5 h-fit"
                >
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-[#60A5FA]" />
                    <h3 className="text-sm font-semibold text-white">
                      Create Promo Voucher Code
                    </h3>
                  </div>

                  {voucherError && (
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                      {voucherError}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-xs text-[#9CA3AF]">
                      Voucher Code (A–Z, 0–9, _, -)
                    </label>
                    <input
                      type="text"
                      required
                      minLength={BLUEPRINT_LIMITS.VOUCHER.CODE_MIN}
                      maxLength={BLUEPRINT_LIMITS.VOUCHER.CODE_MAX}
                      value={voucherForm.code}
                      onChange={(e) =>
                        setVoucherForm((prev) => ({
                          ...prev,
                          code: e.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9_-]/g, ''),
                        }))
                      }
                      placeholder="e.g. KOZUO50 or VIP10"
                      className="w-full px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-sm font-mono-tabular text-white placeholder-[#6B7280]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs text-[#9CA3AF]">
                        Discount Type
                      </label>
                      <select
                        value={voucherForm.discountType}
                        onChange={(e) =>
                          setVoucherForm((prev) => ({
                            ...prev,
                            discountType: e.target
                              .value as VoucherDiscountType,
                            discountValue:
                              e.target.value === 'percent'
                                ? Math.min(100, prev.discountValue || 10)
                                : prev.discountValue || 50,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-sm text-white"
                      >
                        <option value="fixed">Fixed PHP (₱)</option>
                        <option value="percent">Percentage (%)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs text-[#9CA3AF]">
                        {voucherForm.discountType === 'percent'
                          ? 'Discount (%)'
                          : 'Discount (₱)'}
                      </label>
                      <input
                        type="number"
                        required
                        min={1}
                        max={
                          voucherForm.discountType === 'percent'
                            ? 100
                            : BLUEPRINT_LIMITS.VOUCHER.MAX_FIXED_PHP
                        }
                        step="0.01"
                        value={voucherForm.discountValue}
                        onChange={(e) =>
                          setVoucherForm((prev) => ({
                            ...prev,
                            discountValue: Number(e.target.value) || 0,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-sm font-mono-tabular text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs text-[#9CA3AF]">
                        Min Order Spend (₱)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={1000000}
                        step="1"
                        value={voucherForm.minOrderPhp}
                        onChange={(e) =>
                          setVoucherForm((prev) => ({
                            ...prev,
                            minOrderPhp: Math.max(
                              0,
                              Number(e.target.value) || 0
                            ),
                          }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-sm font-mono-tabular text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs text-[#9CA3AF]">
                        Max Total Uses
                      </label>
                      <input
                        type="number"
                        required
                        min={1}
                        max={BLUEPRINT_LIMITS.VOUCHER.MAX_USES}
                        value={voucherForm.maxUses}
                        onChange={(e) =>
                          setVoucherForm((prev) => ({
                            ...prev,
                            maxUses: Math.max(1, Number(e.target.value) || 1),
                          }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-sm font-mono-tabular text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs text-[#9CA3AF]">
                        Expiry Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={voucherForm.expiresDate || ''}
                        onChange={(e) =>
                          setVoucherForm((prev) => ({
                            ...prev,
                            expiresDate: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs text-[#9CA3AF]">
                        Internal Note (Optional)
                      </label>
                      <input
                        type="text"
                        maxLength={BLUEPRINT_LIMITS.VOUCHER.NOTE_MAX}
                        value={voucherForm.note}
                        onChange={(e) =>
                          setVoucherForm((prev) => ({
                            ...prev,
                            note: e.target.value,
                          }))
                        }
                        placeholder="e.g. Weekend promo"
                        className="w-full px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-xs text-white"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-[#D1D5DB] pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={voucherForm.active}
                      onChange={(e) =>
                        setVoucherForm((prev) => ({
                          ...prev,
                          active: e.target.checked,
                        }))
                      }
                      className="rounded border-white/20 bg-[#12141C]"
                    />
                    <span>Active immediately for buyer wallet checkout</span>
                  </label>

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white cursor-pointer"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>Create Voucher Code</span>
                  </button>
                </form>

                <div className="lg:col-span-7 space-y-2.5">
                  {vouchers.length === 0 ? (
                    <div className="p-8 rounded-xl bg-[#0C0E14] border border-white/[0.08] text-center space-y-2">
                      <Tag className="w-6 h-6 text-[#60A5FA] mx-auto" />
                      <p className="text-sm text-[#9CA3AF]">
                        No promo voucher codes yet. Create one on the left so buyers can apply discounts during wallet checkout.
                      </p>
                    </div>
                  ) : (
                    vouchers.map((v) => {
                      const expired =
                        v.hasExpiry &&
                        v.expiresAt &&
                        typeof v.expiresAt.toMillis === 'function' &&
                        v.expiresAt.toMillis() <= Date.now();
                      const exhausted = v.usedCount >= v.maxUses;
                      return (
                        <div
                          key={v.id}
                          className="p-4 rounded-xl bg-[#0C0E14] border border-white/[0.08] flex flex-wrap items-center justify-between gap-3"
                        >
                          <div className="min-w-0 space-y-1 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-mono-tabular font-bold text-sm text-[#60A5FA]">
                                {v.code}
                              </span>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(v.code);
                                    setCopiedVoucherCode(v.code);
                                    setTimeout(
                                      () => setCopiedVoucherCode(null),
                                      1500
                                    );
                                  } catch {
                                    // ignore
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.12] text-[10px] text-[#D1D5DB] cursor-pointer"
                              >
                                {copiedVoucherCode === v.code ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                                <span>
                                  {copiedVoucherCode === v.code
                                    ? 'Copied'
                                    : 'Copy'}
                                </span>
                              </button>
                              <span className="font-mono-tabular font-semibold text-white">
                                {v.discountType === 'percent'
                                  ? `${v.discountValue}% OFF`
                                  : `${formatPhp(v.discountValue)} OFF`}
                              </span>
                              <span
                                className={`text-[11px] font-semibold ${
                                  expired || exhausted
                                    ? 'text-rose-400'
                                    : v.active
                                    ? 'text-emerald-400'
                                    : 'text-amber-400'
                                }`}
                              >
                                {expired
                                  ? 'Expired'
                                  : exhausted
                                  ? 'Maxed Out'
                                  : v.active
                                  ? 'Active'
                                  : 'Paused'}
                              </span>
                            </div>
                            <p className="text-xs text-[#9CA3AF]">
                              Uses:{' '}
                              <span className="font-mono-tabular text-white">
                                {v.usedCount} / {v.maxUses}
                              </span>
                              {' · '}
                              Min Spend:{' '}
                              <span className="font-mono-tabular text-white">
                                {v.minOrderPhp > 0
                                  ? formatPhp(v.minOrderPhp)
                                  : 'None'}
                              </span>
                              {v.hasExpiry && v.expiresAt
                                ? ` · Expires ${formatTimestamp(v.expiresAt)}`
                                : ' · No expiry'}
                            </p>
                            {v.note && (
                              <p className="text-[11px] text-[#6B7280] truncate">
                                {v.note}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={async () => {
                                setBusy(true);
                                setNotice(null);
                                try {
                                  await onToggleVoucherActive(v.code, !v.active);
                                  setNotice(
                                    `${v.code} ${
                                      !v.active ? 'activated' : 'paused'
                                    }.`
                                  );
                                } finally {
                                  setBusy(false);
                                }
                              }}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                                v.active
                                  ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300'
                                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300'
                              }`}
                            >
                              {v.active ? (
                                <>
                                  <Pause className="w-3 h-3" />
                                  <span>Pause</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3" />
                                  <span>Activate</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={async () => {
                                setBusy(true);
                                setNotice(null);
                                try {
                                  await onDeleteVoucher(v.code);
                                  setNotice(`Voucher ${v.code} deleted.`);
                                } finally {
                                  setBusy(false);
                                }
                              }}
                              title="Delete voucher"
                              className="p-2 rounded-md bg-white/[0.04] hover:bg-rose-500/20 text-[#9CA3AF] hover:text-rose-400 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: TRACK RECENTLY UPDATED PRODUCTS */}
            {tab === 'updates' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#9CA3AF]">
                    Sorted by most recently modified timestamp (`updatedAt`) across stocks, quantities, and statuses.
                  </p>
                </div>

                {recentlyUpdatedStocks.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[#0C0E14] border border-white/[0.08] text-center text-sm text-[#9CA3AF]">
                    No product activity tracked yet.
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.06] border border-white/[0.08] rounded-xl bg-[#0C0E14] overflow-hidden">
                    {recentlyUpdatedStocks.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="w-11 h-8 rounded object-cover bg-[#12141C] shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">
                              {item.title}
                            </p>
                            <p className="text-xs text-[#9CA3AF] truncate">
                              <span className="font-mono-tabular text-[#60A5FA]">
                                {item.code}
                              </span>
                              {' · '}
                              <span className={getStatusToneClass(item.status)}>
                                {item.status}
                              </span>
                              {' · '}
                              <span className="font-mono-tabular">
                                Qty: {item.stockCount}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-mono-tabular text-[#6B7280]">
                            {formatTimestamp(item.updatedAt ?? item.createdAt)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onEditStock(item);
                            }}
                            className="px-2.5 py-1 rounded-md text-xs font-medium bg-white/[0.06] hover:bg-[#2563EB] text-white transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: CUSTOMER INQUIRIES INBOX */}
            {tab === 'inquiries' && (
              <div className="space-y-3">
                <p className="text-xs text-[#9CA3AF]">
                  Inquiries submitted by visitors from product modals or Contact Support appear here automatically.
                </p>

                {inquiries.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[#0C0E14] border border-white/[0.08] text-center space-y-2">
                    <Inbox className="w-6 h-6 text-[#60A5FA] mx-auto" />
                    <p className="text-sm text-[#9CA3AF]">
                      No customer inquiries yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {inquiries.map((inq) => (
                      <div
                        key={inq.id}
                        className="p-4 rounded-xl bg-[#0C0E14] border border-white/[0.08] flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-semibold text-white">
                              {inq.buyerName}
                            </span>
                            <span className="text-[#6B7280]">·</span>
                            <span className="text-[#60A5FA] font-medium">
                              {inq.preferredChannel}: {inq.contactHandle}
                            </span>
                            <span className="text-[#6B7280]">·</span>
                            <span className="font-mono-tabular text-[#9CA3AF]">
                              {formatTimestamp(inq.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs font-mono-tabular text-[#93C5FD]">
                            [{inq.stockCode || 'GENERAL'}] {inq.stockTitle}
                          </p>
                          <p className="text-sm text-[#D1D5DB] leading-relaxed">
                            {inq.message}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={inq.status}
                            onChange={(e) =>
                              onUpdateInquiryStatus(
                                inq.id,
                                e.target.value as InquiryStatus
                              )
                            }
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border bg-[#12141C] cursor-pointer ${
                              inq.status === 'New'
                                ? 'border-[#3B82F6]/60 text-[#60A5FA]'
                                : inq.status === 'Replied'
                                ? 'border-emerald-500/40 text-emerald-400'
                                : 'border-white/[0.1] text-[#9CA3AF]'
                            }`}
                          >
                            <option value="New">New</option>
                            <option value="Replied">Replied</option>
                            <option value="Closed">Closed</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => onDeleteInquiry(inq.id)}
                            title="Delete inquiry"
                            className="p-2 rounded-md bg-white/[0.04] hover:bg-rose-500/20 text-[#9CA3AF] hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: REVIEWS MANAGER */}
            {tab === 'reviews' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <form
                  onSubmit={handleReviewSubmit}
                  className="lg:col-span-5 p-4 rounded-xl bg-[#0C0E14] border border-white/[0.08] space-y-3.5 h-fit"
                >
                  <h3 className="text-sm font-semibold text-white">
                    {editingReviewId
                      ? 'Edit Buyer Review'
                      : 'Add Buyer Review / Vouch'}
                  </h3>

                  <div className="space-y-1">
                    <label className="block text-xs text-[#9CA3AF]">
                      Buyer Name / Handle
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={BLUEPRINT_LIMITS.REVIEW.BUYER_NAME_MAX}
                      value={reviewForm.buyerName}
                      onChange={(e) =>
                        setReviewForm((prev) => ({
                          ...prev,
                          buyerName: e.target.value,
                        }))
                      }
                      placeholder="e.g. Jeric V. or @kyle"
                      className="w-full px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-sm text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs text-[#9CA3AF]">
                      Item Bought
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={BLUEPRINT_LIMITS.REVIEW.ITEM_LABEL_MAX}
                      value={reviewForm.itemLabel}
                      onChange={(e) =>
                        setReviewForm((prev) => ({
                          ...prev,
                          itemLabel: e.target.value,
                        }))
                      }
                      placeholder="e.g. 1,500 VALID HITS or CODM Clean Account"
                      className="w-full px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-sm text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs text-[#9CA3AF]">
                        Channel
                      </label>
                      <select
                        value={reviewForm.dealChannel}
                        onChange={(e) =>
                          setReviewForm((prev) => ({
                            ...prev,
                            dealChannel: e.target.value as DealChannel,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-sm text-white"
                      >
                        <option value="Facebook">Facebook</option>
                        <option value="Telegram">Telegram</option>
                        <option value="Direct">Direct</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs text-[#9CA3AF]">
                        Rating (1–5)
                      </label>
                      <select
                        value={reviewForm.rating}
                        onChange={(e) =>
                          setReviewForm((prev) => ({
                            ...prev,
                            rating: Number(e.target.value) || 5,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-sm text-white"
                      >
                        <option value={5}>5 Stars</option>
                        <option value={4}>4 Stars</option>
                        <option value={3}>3 Stars</option>
                        <option value={2}>2 Stars</option>
                        <option value={1}>1 Star</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs text-[#9CA3AF]">
                      Review / Feedback Comment
                    </label>
                    <textarea
                      rows={3}
                      required
                      maxLength={BLUEPRINT_LIMITS.REVIEW.COMMENT_MAX}
                      value={reviewForm.comment}
                      onChange={(e) =>
                        setReviewForm((prev) => ({
                          ...prev,
                          comment: e.target.value,
                        }))
                      }
                      placeholder="Buyer feedback or deal summary..."
                      className="w-full px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-sm text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-[#9CA3AF]">
                        Proof Screenshot (Optional)
                      </label>
                      <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/[0.06] hover:bg-white/[0.12] text-xs text-white cursor-pointer">
                        {uploadingProof ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <ImagePlus className="w-3 h-3" />
                        )}
                        <span>Upload Proof</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProofUpload}
                          className="sr-only"
                        />
                      </label>
                    </div>
                    {reviewForm.proofImageUrl && (
                      <div className="flex items-center justify-between gap-2 p-2 rounded bg-[#12141C] border border-white/[0.08]">
                        <img
                          src={reviewForm.proofImageUrl}
                          alt="Proof preview"
                          referrerPolicy="no-referrer"
                          className="w-12 h-9 rounded object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setReviewForm((prev) => ({
                              ...prev,
                              proofImageUrl: '',
                            }))
                          }
                          className="text-xs text-rose-400 hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    {editingReviewId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingReviewId(null);
                          setReviewForm(EMPTY_REVIEW);
                        }}
                        className="px-3 py-2 rounded-lg text-xs font-medium bg-white/[0.06] text-[#D1D5DB] cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={busy || uploadingProof}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white cursor-pointer"
                    >
                      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>
                        {editingReviewId ? 'Update Review' : 'Publish Review'}
                      </span>
                    </button>
                  </div>
                </form>

                <div className="lg:col-span-7 space-y-2.5">
                  {reviews.length === 0 ? (
                    <div className="p-6 rounded-xl bg-[#0C0E14] border border-white/[0.08] text-center text-sm text-[#9CA3AF]">
                      No buyer reviews posted yet.
                    </div>
                  ) : (
                    reviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-3.5 rounded-xl bg-[#0C0E14] border border-white/[0.08] flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-white">
                              {rev.buyerName}
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-amber-400">
                              <Star className="w-3 h-3 fill-amber-400" />
                              {rev.rating}
                            </span>
                            <span className="text-[#6B7280]">
                              · {rev.dealChannel}
                            </span>
                          </div>
                          <p className="text-xs text-[#60A5FA] truncate">
                            {rev.itemLabel}
                          </p>
                          <p className="text-xs text-[#9CA3AF] line-clamp-2">
                            {rev.comment}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingReviewId(rev.id);
                              setReviewForm({
                                buyerName: rev.buyerName,
                                itemLabel: rev.itemLabel,
                                rating: rev.rating,
                                comment: rev.comment,
                                dealChannel: rev.dealChannel,
                                proofImageUrl: rev.proofImageUrl,
                              });
                            }}
                            className="p-2 rounded-md bg-white/[0.04] hover:bg-[#2563EB]/25 text-[#93C5FD] cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteReview(rev.id)}
                            className="p-2 rounded-md bg-white/[0.04] hover:bg-rose-500/20 text-[#9CA3AF] hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: SOCIAL LINKS */}
            {tab === 'social' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <form
                  onSubmit={handleSocialSubmit}
                  className="lg:col-span-5 p-4 rounded-xl bg-[#0C0E14] border border-white/[0.08] space-y-3.5 h-fit"
                >
                  <h3 className="text-sm font-semibold text-white">
                    {editingSocialId ? 'Edit Social Link' : 'Add Social Link'}
                  </h3>

                  <div className="space-y-1">
                    <label className="block text-xs text-[#9CA3AF]">
                      Platform
                    </label>
                    <select
                      value={socialForm.platform}
                      onChange={(e) =>
                        setSocialForm((prev) => ({
                          ...prev,
                          platform: e.target.value as SocialPlatform,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-sm text-white"
                    >
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs text-[#9CA3AF]">
                      Button Label
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={BLUEPRINT_LIMITS.SOCIAL.LABEL_MAX}
                      value={socialForm.label}
                      onChange={(e) =>
                        setSocialForm((prev) => ({
                          ...prev,
                          label: e.target.value,
                        }))
                      }
                      placeholder="e.g. Facebook Direct"
                      className="w-full px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-sm text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs text-[#9CA3AF]">
                      Handle / Username
                    </label>
                    <input
                      type="text"
                      maxLength={BLUEPRINT_LIMITS.SOCIAL.HANDLE_MAX}
                      value={socialForm.handle}
                      onChange={(e) =>
                        setSocialForm((prev) => ({
                          ...prev,
                          handle: e.target.value,
                        }))
                      }
                      placeholder="e.g. t.me/Kaixelexzu"
                      className="w-full px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-sm text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs text-[#9CA3AF]">
                      Direct URL (QR code updates automatically)
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={BLUEPRINT_LIMITS.SOCIAL.URL_MAX}
                      value={socialForm.url}
                      onChange={(e) =>
                        setSocialForm((prev) => ({
                          ...prev,
                          url: e.target.value,
                        }))
                      }
                      placeholder="https://www.facebook.com/vento.kozuo"
                      className="w-full px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-sm text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs text-[#9CA3AF]">
                      Display Order
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={9999}
                      value={socialForm.sortOrder}
                      onChange={(e) =>
                        setSocialForm((prev) => ({
                          ...prev,
                          sortOrder: Number(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-sm text-white"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    {editingSocialId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSocialId(null);
                          setSocialForm(EMPTY_SOCIAL);
                        }}
                        className="px-3 py-2 rounded-lg text-xs font-medium bg-white/[0.06] text-[#D1D5DB] cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={busy}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white cursor-pointer"
                    >
                      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>
                        {editingSocialId ? 'Update Link' : 'Add Social Link'}
                      </span>
                    </button>
                  </div>
                </form>

                <div className="lg:col-span-7 space-y-2.5">
                  {socialLinks.length === 0 ? (
                    <div className="p-6 rounded-xl bg-[#0C0E14] border border-white/[0.08] text-center text-sm text-[#9CA3AF]">
                      No social links configured yet.
                    </div>
                  ) : (
                    socialLinks.map((link) => (
                      <div
                        key={link.id}
                        className="p-3.5 rounded-xl bg-[#0C0E14] border border-white/[0.08] flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-[#2563EB]/15 text-[#60A5FA] flex items-center justify-center shrink-0">
                            <SocialIcon platform={link.platform} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">
                              {link.label}
                            </p>
                            <p className="text-xs text-[#9CA3AF] truncate">
                              {link.handle} · {link.url}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSocialId(link.id);
                              setSocialForm({
                                platform: link.platform,
                                label: link.label,
                                handle: link.handle,
                                url: link.url,
                                sortOrder: link.sortOrder,
                              });
                            }}
                            className="p-2 rounded-md bg-white/[0.04] hover:bg-[#2563EB]/25 text-[#93C5FD] cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteSocialLink(link.id)}
                            className="p-2 rounded-md bg-white/[0.04] hover:bg-rose-500/20 text-[#9CA3AF] hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 6: STOREFRONT TEXTS */}
            {tab === 'settings' && (
              <form onSubmit={handleSettingsSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs text-[#9CA3AF]">
                      Store Name
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={BLUEPRINT_LIMITS.SETTINGS.STORE_NAME_MAX}
                      value={settingsForm.storeName}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          storeName: e.target.value,
                        }))
                      }
                      className="w-full px-3.5 py-2 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-[#9CA3AF]">
                      Accent Word
                    </label>
                    <input
                      type="text"
                      maxLength={BLUEPRINT_LIMITS.SETTINGS.ACCENT_WORD_MAX}
                      value={settingsForm.accentWord}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          accentWord: e.target.value,
                        }))
                      }
                      className="w-full px-3.5 py-2 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs text-[#9CA3AF]">
                    Top Announcement Bar
                  </label>
                  <input
                    type="text"
                    maxLength={BLUEPRINT_LIMITS.SETTINGS.ANNOUNCEMENT_MAX}
                    value={settingsForm.announcementText}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        announcementText: e.target.value,
                      }))
                    }
                    className="w-full px-3.5 py-2 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs text-[#9CA3AF]">
                      Hero Kicker
                    </label>
                    <input
                      type="text"
                      maxLength={BLUEPRINT_LIMITS.SETTINGS.HERO_KICKER_MAX}
                      value={settingsForm.heroKicker}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          heroKicker: e.target.value,
                        }))
                      }
                      className="w-full px-3.5 py-2 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-[#9CA3AF]">
                      Hero Title
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={BLUEPRINT_LIMITS.SETTINGS.HERO_TITLE_MAX}
                      value={settingsForm.heroTitle}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          heroTitle: e.target.value,
                        }))
                      }
                      className="w-full px-3.5 py-2 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs text-[#9CA3AF]">
                    Hero Subtitle
                  </label>
                  <textarea
                    rows={2}
                    maxLength={BLUEPRINT_LIMITS.SETTINGS.HERO_SUBTITLE_MAX}
                    value={settingsForm.heroSubtitle}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        heroSubtitle: e.target.value,
                      }))
                    }
                    className="w-full px-3.5 py-2 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs text-[#9CA3AF]">
                      Contact Section Heading
                    </label>
                    <input
                      type="text"
                      maxLength={BLUEPRINT_LIMITS.SETTINGS.CONTACT_HEADING_MAX}
                      value={settingsForm.contactHeading}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          contactHeading: e.target.value,
                        }))
                      }
                      className="w-full px-3.5 py-2 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-[#9CA3AF]">
                      Contact Buying Note
                    </label>
                    <input
                      type="text"
                      maxLength={BLUEPRINT_LIMITS.SETTINGS.CONTACT_NOTE_MAX}
                      value={settingsForm.contactNote}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          contactNote: e.target.value,
                        }))
                      }
                      className="w-full px-3.5 py-2 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs text-[#9CA3AF]">
                      Clean Account Guide Text
                    </label>
                    <textarea
                      rows={2}
                      maxLength={BLUEPRINT_LIMITS.SETTINGS.GUIDE_MAX}
                      value={settingsForm.cleanGuide}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          cleanGuide: e.target.value,
                        }))
                      }
                      className="w-full px-3.5 py-2 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-[#9CA3AF]">
                      Not Clean Account Guide Text
                    </label>
                    <textarea
                      rows={2}
                      maxLength={BLUEPRINT_LIMITS.SETTINGS.GUIDE_MAX}
                      value={settingsForm.notCleanGuide}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          notCleanGuide: e.target.value,
                        }))
                      }
                      className="w-full px-3.5 py-2 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white"
                    />
                  </div>
                </div>

                {/* GCash Manual Top-Up Payment Settings */}
                <div className="p-4 rounded-xl bg-[#0C0E14] border border-[#3B82F6]/30 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#60A5FA]">
                    GCash Manual Payment Settings (Shown in Top-Up Step 3)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs text-[#9CA3AF]">
                        GCash Account Name
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={BLUEPRINT_LIMITS.SETTINGS.GCASH_NAME_MAX}
                        value={settingsForm.gcashName}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            gcashName: e.target.value,
                          }))
                        }
                        placeholder="e.g. J.O"
                        className="w-full px-3.5 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-sm text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs text-[#9CA3AF]">
                        GCash Mobile Number
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={BLUEPRINT_LIMITS.SETTINGS.GCASH_NUMBER_MAX}
                        value={settingsForm.gcashNumber}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            gcashNumber: e.target.value,
                          }))
                        }
                        placeholder="09933119204"
                        className="w-full px-3.5 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-sm font-mono-tabular text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs text-[#9CA3AF]">
                        Minimum Top-Up (PHP)
                      </label>
                      <input
                        type="number"
                        min={50}
                        max={10000}
                        value={settingsForm.minTopUpPhp}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            minTopUpPhp: Math.max(
                              50,
                              Number(e.target.value) || 50
                            ),
                          }))
                        }
                        className="w-full px-3.5 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-sm font-mono-tabular text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer"
                  >
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Save Storefront &amp; GCash Settings</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Receipt Image Lightbox inside Owner Studio */}
      {zoomedReceipt && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setZoomedReceipt(null)}
        >
          <div
            className="relative max-w-lg w-full bg-[#12141C] border border-white/15 rounded-xl p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomedReceipt(null)}
              aria-label="Close receipt preview"
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-black/75 text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={zoomedReceipt}
              alt="GCash proof receipt"
              referrerPolicy="no-referrer"
              className="w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
