import { useEffect, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  FolderCode,
  Gamepad2,
  Loader2,
  LogIn,
  MessageSquarePlus,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  computeVoucherDiscount,
  formatPhp,
  getStatusToneClass,
  isItemSold,
  isRestockingStatus,
  isVoucherCurrentlyValid,
  normalizeVoucherCode,
  type CustomerInquiryInput,
  type InquiryChannel,
  type SocialLink,
  type StockItem,
  type StoreSettings,
  type UserProfile,
  type VoucherCode,
} from '../types/store';
import type { PurchaseOrderResult } from '../lib/storeService';
import { SocialIcon } from './SocialIcon';

interface StockDetailModalProps {
  item: StockItem | null;
  socialLinks: SocialLink[];
  settings: StoreSettings;
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: (item: StockItem) => void;
  onMarkSold: (item: StockItem) => void;
  onRestoreAvailable: (item: StockItem) => void;
  onSubmitInquiry: (input: CustomerInquiryInput) => Promise<void>;
  onPurchaseWithBalance: (
    item: StockItem,
    quantity: number,
    voucher?: VoucherCode | null
  ) => Promise<PurchaseOrderResult>;
  onLookupVoucher: (code: string) => Promise<VoucherCode | null>;
  onOpenAuth: () => void;
  onOpenTopUp: () => void;
  onOpenOrders: () => void;
}

export function StockDetailModal({
  item,
  socialLinks,
  settings,
  user,
  profile,
  isAdmin,
  onClose,
  onEdit,
  onMarkSold,
  onRestoreAvailable,
  onSubmitInquiry,
  onPurchaseWithBalance,
  onLookupVoucher,
  onOpenAuth,
  onOpenTopUp,
  onOpenOrders,
}: StockDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showInquiryForm, setShowInquiryForm] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [contactHandle, setContactHandle] = useState('');
  const [preferredChannel, setPreferredChannel] =
    useState<InquiryChannel>('Facebook');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [sendingInquiry, setSendingInquiry] = useState(false);
  const [inquirySent, setInquirySent] = useState(false);

  // Wallet balance purchase, voucher & auto-delivery state
  const [buyQty, setBuyQty] = useState(1);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<PurchaseOrderResult | null>(
    null
  );
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<VoucherCode | null>(
    null
  );
  const [voucherBusy, setVoucherBusy] = useState(false);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [copiedSlotKey, setCopiedSlotKey] = useState<string | null>(null);

  useEffect(() => {
    setActivePhotoIndex(0);
    setImgError(false);
    setCopied(false);
    setShowInquiryForm(false);
    setInquirySent(false);
    setBuyQty(1);
    setBuyError(null);
    setOrderResult(null);
    setVoucherInput('');
    setAppliedVoucher(null);
    setVoucherError(null);
    setCopiedSlotKey(null);
    if (item) {
      setInquiryMessage(
        `Hi Kozuo! Is [${item.code}] ${item.title} (${item.priceLabel}) still available?`
      );
    }
  }, [item?.id]);

  if (!item) return null;

  const isCodmAccount = item.category === 'CODM ACCOUNT';
  const isClean = item.accountGroup === 'Clean';
  const sold = isItemSold(item);
  const restocking = isRestockingStatus(item.status);
  const isPreview = item.id.startsWith('preview-');

  const photos =
    item.galleryImages && item.galleryImages.length > 0
      ? item.galleryImages
      : item.imageUrl
      ? [item.imageUrl]
      : [];
  const safeIndex = Math.min(activePhotoIndex, Math.max(0, photos.length - 1));
  const currentPhoto = photos[safeIndex] || '';

  const inquiryTemplate = `Hi Kozuo! Is [${item.code}] ${item.title} (${item.priceLabel}) still available?`;

  const maxBuyQty = isCodmAccount ? 1 : Math.max(1, item.stockCount);
  const effectiveQty = Math.min(buyQty, maxBuyQty);
  const unitPricePhp = item.pricePhp > 0 ? item.pricePhp : 0;
  const subtotalPhp = Math.round(unitPricePhp * effectiveQty * 100) / 100;

  const voucherValidation = appliedVoucher
    ? isVoucherCurrentlyValid(appliedVoucher, subtotalPhp)
    : null;
  const activeDiscountPhp =
    appliedVoucher && voucherValidation?.valid
      ? computeVoucherDiscount(subtotalPhp, appliedVoucher)
      : 0;
  const totalPhp = Math.max(
    0,
    Math.round((subtotalPhp - activeDiscountPhp) * 100) / 100
  );

  const userBalance = profile?.balance ?? 0;
  const canInstantBuy =
    !sold &&
    !restocking &&
    !isPreview &&
    Boolean(item.hasPersistedPricePhp) &&
    unitPricePhp > 0 &&
    item.stockCount >= effectiveQty;
  const hasEnoughBalance = userBalance >= totalPhp;

  const handleCopyInquiry = async () => {
    try {
      await navigator.clipboard.writeText(inquiryTemplate);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const handleApplyVoucher = async () => {
    setVoucherError(null);
    const code = normalizeVoucherCode(voucherInput);
    if (!code) {
      setVoucherError('Enter a voucher code first.');
      return;
    }
    setVoucherBusy(true);
    try {
      const found = await onLookupVoucher(code);
      if (!found) {
        setAppliedVoucher(null);
        setVoucherError(`Voucher "${code}" was not found.`);
        return;
      }
      const check = isVoucherCurrentlyValid(found, subtotalPhp);
      if (!check.valid) {
        setAppliedVoucher(null);
        setVoucherError(check.reason || 'Voucher cannot be used on this order.');
        return;
      }
      setAppliedVoucher(found);
      setVoucherInput(found.code);
    } catch (err) {
      setAppliedVoucher(null);
      setVoucherError(
        err instanceof Error ? err.message : 'Unable to verify voucher code.'
      );
    } finally {
      setVoucherBusy(false);
    }
  };

  const handleSendDirectInquiry = async (e: FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim() || !contactHandle.trim() || !inquiryMessage.trim()) {
      return;
    }
    setSendingInquiry(true);
    try {
      await onSubmitInquiry({
        buyerName,
        contactHandle,
        preferredChannel,
        stockCode: item.code,
        stockTitle: item.title,
        message: inquiryMessage,
      });
      setInquirySent(true);
      setBuyerName('');
      setContactHandle('');
    } finally {
      setSendingInquiry(false);
    }
  };

  const handleBuyNow = async () => {
    setBuyError(null);
    if (appliedVoucher && voucherValidation && !voucherValidation.valid) {
      setBuyError(
        voucherValidation.reason ||
          'Remove or fix the applied voucher code before buying.'
      );
      return;
    }
    setBuying(true);
    try {
      const result = await onPurchaseWithBalance(
        item,
        effectiveQty,
        appliedVoucher && voucherValidation?.valid ? appliedVoucher : null
      );
      setOrderResult(result);
    } catch (err) {
      setBuyError(
        err instanceof Error ? err.message : 'Unable to complete purchase.'
      );
    } finally {
      setBuying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
    >
      <div
        className="w-full max-w-3xl bg-[#12141C] border border-white/10 rounded-xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs min-w-0 truncate">
            <span className="font-mono-tabular text-[#60A5FA] font-semibold">
              {item.code}
            </span>
            <span aria-hidden="true" className="text-[#4B5563]">
              ·
            </span>
            <span className="uppercase tracking-wider text-[#9CA3AF] font-semibold">
              {item.category}
            </span>
            <span aria-hidden="true" className="text-[#4B5563]">
              ·
            </span>
            {isCodmAccount ? (
              <span
                className={`inline-flex items-center gap-1 font-semibold ${
                  isClean ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isClean ? (
                  <ShieldCheck className="w-3.5 h-3.5" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5" />
                )}
                {item.accountGroup}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-[#60A5FA]">
                <FolderCode className="w-3.5 h-3.5" />
                {item.fileType || 'Files'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <>
                {sold || restocking ? (
                  <button
                    type="button"
                    onClick={() => {
                      onRestoreAvailable(item);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Available
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onMarkSold(item);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Mark Sold
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit(item);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-white transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close stock details"
              className="p-2 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 max-h-[82vh] overflow-y-auto">
          {/* Left Multi-Photo Showcase Column (Up to 7 Photos) */}
          <div className="md:col-span-5 space-y-3">
            <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden bg-[#0A0B10] border border-white/[0.06]">
              {!imgError && currentPhoto ? (
                <img
                  src={currentPhoto}
                  alt={`${item.title} photo ${safeIndex + 1}`}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#6B7280]">
                  <Gamepad2 className="w-10 h-10 text-[#3B82F6]/60" />
                  <span className="font-mono-tabular text-xs">{item.code}</span>
                </div>
              )}

              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setImgError(false);
                      setActivePhotoIndex((i) =>
                        i === 0 ? photos.length - 1 : i - 1
                      );
                    }}
                    aria-label="Previous photo"
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/65 hover:bg-black/85 text-white transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImgError(false);
                      setActivePhotoIndex((i) =>
                        i === photos.length - 1 ? 0 : i + 1
                      );
                    }}
                    aria-label="Next photo"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/65 hover:bg-black/85 text-white transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-[11px] font-mono-tabular text-white">
                    {safeIndex + 1} / {photos.length}
                  </span>
                </>
              )}
            </div>

            {photos.length > 1 && (
              <div className="grid grid-cols-7 gap-1.5">
                {photos.slice(0, 7).map((url, idx) => (
                  <button
                    key={`${url.slice(0, 32)}-${idx}`}
                    type="button"
                    onClick={() => {
                      setImgError(false);
                      setActivePhotoIndex(idx);
                    }}
                    className={`aspect-square rounded overflow-hidden border transition-all cursor-pointer ${
                      idx === safeIndex
                        ? 'border-[#3B82F6] ring-1 ring-[#3B82F6]'
                        : 'border-white/[0.08] opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Thumbnail ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {isCodmAccount && (
              <div className="p-3.5 rounded-lg bg-[#0C0E14] border border-white/[0.07] space-y-1">
                <p
                  className={`text-xs font-semibold flex items-center gap-1.5 ${
                    isClean ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isClean ? (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5" />
                  )}
                  {item.accountGroup} Account · One-Time Buy
                </p>
                <p className="text-xs text-[#9CA3AF] leading-relaxed">
                  {isClean ? settings.cleanGuide : settings.notCleanGuide}
                </p>
              </div>
            )}
          </div>

          {/* Right Info, Specifications, Wallet Buy & Direct Contact Column */}
          <div className="md:col-span-7 flex flex-col gap-4">
            <div>
              <h2 className="font-display font-bold text-2xl text-white leading-tight text-balance">
                {item.title}
              </h2>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <span
                  className={`font-mono-tabular text-2xl font-semibold ${
                    sold ? 'line-through text-[#6B7280]' : 'text-white'
                  }`}
                >
                  {item.priceLabel}
                </span>
                <span
                  className={`text-xs font-semibold ${getStatusToneClass(
                    item.status
                  )}`}
                >
                  {item.status}
                </span>
                <span className="text-xs font-mono-tabular text-[#9CA3AF]">
                  {isCodmAccount
                    ? sold
                      ? 'Stock Qty: 0 (Sold)'
                      : restocking
                      ? 'Stock Qty: 0 (Restocking)'
                      : 'Stock Qty: 1 (One-Time Buy)'
                    : `Stock Qty: ${item.stockCount} available`}
                </span>
                {item.autoDelivery && !sold && !restocking && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Instant Auto-Delivery</span>
                  </span>
                )}
              </div>
              {item.bindSummary && (
                <p className="mt-2 text-sm text-[#D1D5DB] font-medium">
                  {item.bindSummary}
                </p>
              )}
            </div>

            {/* Product Details */}
            {item.description && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                  Product Details
                </p>
                <div className="p-3.5 rounded-lg bg-[#0C0E14] border border-white/[0.06] text-sm text-[#D1D5DB] leading-relaxed whitespace-pre-line">
                  {item.description}
                </div>
              </div>
            )}

            {/* Instant Buy with Wallet Balance */}
            {(!sold && !restocking) || orderResult ? (
              <div className="p-4 rounded-xl bg-[#0C0E14] border border-white/[0.09] space-y-3">
                {orderResult ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Order #{orderResult.orderCode} Confirmed!</span>
                    </div>
                    <p className="text-xs text-[#9CA3AF] leading-relaxed">
                      Paid{' '}
                      <strong className="text-white font-mono-tabular">
                        {formatPhp(orderResult.totalPaidPhp)}
                      </strong>
                      {orderResult.voucherCode ? (
                        <span className="text-emerald-400">
                          {' '}
                          (Saved {formatPhp(orderResult.discountPhp)} with{' '}
                          {orderResult.voucherCode})
                        </span>
                      ) : null}{' '}
                      from your PHP wallet.
                    </p>

                    {(() => {
                      const deliveredList =
                        orderResult.deliveredItems &&
                        orderResult.deliveredItems.length > 0
                          ? orderResult.deliveredItems
                          : orderResult.deliveredItem
                          ? [orderResult.deliveredItem]
                          : [];

                      if (deliveredList.length === 0) {
                        return (
                          <p className="text-xs text-[#9CA3AF]">
                            Check <strong className="text-white">My Orders</strong>{' '}
                            for delivery updates or message Kozuo below for fast handoff.
                          </p>
                        );
                      }

                      const firstItem = deliveredList[0];
                      return (
                        <div className="p-3.5 rounded-lg bg-[#12141C] border border-emerald-500/30 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                              <Zap className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                Instant Auto-Delivery Unlocked ·{' '}
                                {deliveredList.length > 1
                                  ? `${deliveredList.length} Items`
                                  : firstItem.deliveryType === 'credentials'
                                  ? 'Account Credentials'
                                  : 'Download Link / File Key'}
                              </span>
                            </span>
                            {deliveredList.length > 1 && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const combined = deliveredList
                                      .map((d, idx) =>
                                        deliveredList.length > 1
                                          ? `Item #${idx + 1}: ${d.payload}`
                                          : d.payload
                                      )
                                      .join('\n');
                                    await navigator.clipboard.writeText(combined);
                                    setCopiedSlotKey('all');
                                    setTimeout(() => setCopiedSlotKey(null), 2000);
                                  } catch {
                                    // ignore clipboard restrictions
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/[0.08] hover:bg-white/[0.15] text-[11px] font-semibold text-white cursor-pointer"
                              >
                                {copiedSlotKey === 'all' ? (
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
                            {deliveredList.map((dItem, idx) => {
                              const slotKey = `slot-${idx}`;
                              const isUrl = /^https?:\/\//i.test(
                                dItem.payload.trim()
                              );
                              return (
                                <div
                                  key={`${idx}-${dItem.unitIndex ?? idx}`}
                                  className="p-2.5 rounded bg-[#090A0F] border border-white/[0.08] space-y-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-semibold text-[#9CA3AF]">
                                      {deliveredList.length > 1
                                        ? `Delivered Item #${idx + 1}`
                                        : dItem.deliveryType === 'credentials'
                                        ? 'Account Credentials'
                                        : 'Download Link / File Key'}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      {isUrl && (
                                        <a
                                          href={dItem.payload.trim()}
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
                                              dItem.payload
                                            );
                                            setCopiedSlotKey(slotKey);
                                            setTimeout(
                                              () => setCopiedSlotKey(null),
                                              2000
                                            );
                                          } catch {
                                            // ignore
                                          }
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.08] hover:bg-white/[0.15] text-[11px] font-semibold text-white cursor-pointer"
                                      >
                                        {copiedSlotKey === slotKey ? (
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
                                    {dItem.payload}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {firstItem.instructions && (
                            <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                              Instructions: {firstItem.instructions}
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenOrders();
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>View My Orders</span>
                    </button>
                  </div>
                ) : !user ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-[#60A5FA]" />
                        <span>
                          {item.autoDelivery
                            ? 'Buy Now · Instant Auto-Delivery'
                            : 'Buy Instantly with PHP Wallet'}
                        </span>
                      </p>
                      <p className="text-[11px] text-[#9CA3AF]">
                        {item.autoDelivery
                          ? 'Sign in and pay with wallet balance to unlock your link or credentials immediately.'
                          : 'Sign in and top up via GCash to pay directly using wallet balance.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAuth();
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Login to Buy</span>
                    </button>
                  </div>
                ) : !canInstantBuy ? (
                  <div className="text-xs text-[#9CA3AF]">
                    This item uses direct seller pricing. Copy the inquiry template or contact Kozuo below.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-[#60A5FA]" />
                        <span>
                          {item.autoDelivery
                            ? 'Wallet Checkout (Instant Delivery)'
                            : 'Buy with Wallet Balance'}
                        </span>
                      </span>
                      <span className="font-mono-tabular text-[#9CA3AF]">
                        Wallet:{' '}
                        <strong
                          className={
                            hasEnoughBalance ? 'text-emerald-400' : 'text-amber-400'
                          }
                        >
                          {formatPhp(userBalance)}
                        </strong>
                      </span>
                    </div>

                    {!isCodmAccount && item.stockCount > 1 && (
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-[#9CA3AF]">Quantity</span>
                        <div className="inline-flex items-center gap-2 bg-[#12141C] border border-white/[0.1] rounded-lg px-2 py-1">
                          <button
                            type="button"
                            onClick={() => setBuyQty((q) => Math.max(1, q - 1))}
                            className="p-1 text-[#9CA3AF] hover:text-white cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-mono-tabular font-semibold text-white min-w-[20px] text-center">
                            {effectiveQty}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setBuyQty((q) => Math.min(maxBuyQty, q + 1))
                            }
                            className="p-1 text-[#9CA3AF] hover:text-white cursor-pointer"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Promo Voucher Code Row */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Tag className="w-3.5 h-3.5 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            maxLength={BLUEPRINT_LIMITS.VOUCHER.CODE_MAX}
                            value={voucherInput}
                            disabled={Boolean(appliedVoucher)}
                            onChange={(e) => {
                              setVoucherInput(
                                e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '')
                              );
                              setVoucherError(null);
                            }}
                            placeholder="Voucher code (optional)"
                            className="w-full h-9 pl-8 pr-3 rounded-lg bg-[#12141C] border border-white/[0.1] text-xs font-mono-tabular text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6] disabled:opacity-65"
                          />
                        </div>
                        {appliedVoucher ? (
                          <button
                            type="button"
                            onClick={() => {
                              setAppliedVoucher(null);
                              setVoucherInput('');
                              setVoucherError(null);
                            }}
                            className="h-9 px-3 rounded-lg text-xs font-semibold bg-white/[0.06] hover:bg-rose-500/20 text-[#D1D5DB] hover:text-rose-300 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={voucherBusy || !voucherInput.trim()}
                            onClick={handleApplyVoucher}
                            className="h-9 px-3.5 rounded-lg text-xs font-semibold bg-white/[0.08] hover:bg-[#2563EB] disabled:opacity-50 text-white transition-colors whitespace-nowrap cursor-pointer"
                          >
                            {voucherBusy ? 'Checking...' : 'Apply'}
                          </button>
                        )}
                      </div>

                      {voucherError && (
                        <p className="text-[11px] text-rose-400">{voucherError}</p>
                      )}

                      {appliedVoucher && voucherValidation && !voucherValidation.valid && (
                        <p className="text-[11px] text-amber-400">
                          {appliedVoucher.code}: {voucherValidation.reason}
                        </p>
                      )}

                      {appliedVoucher && voucherValidation?.valid && (
                        <div className="flex items-center justify-between text-[11px] text-emerald-400 font-medium">
                          <span>
                            Voucher {appliedVoucher.code} applied (
                            {appliedVoucher.discountType === 'percent'
                              ? `${appliedVoucher.discountValue}% OFF`
                              : `${formatPhp(appliedVoucher.discountValue)} OFF`}
                            )
                          </span>
                          <span className="font-mono-tabular">
                            -{formatPhp(activeDiscountPhp)}
                          </span>
                        </div>
                      )}
                    </div>

                    {activeDiscountPhp > 0 && (
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.06]">
                        <span className="text-[#9CA3AF]">
                          Subtotal {formatPhp(subtotalPhp)} · Total Due
                        </span>
                        <span className="font-mono-tabular font-bold text-white">
                          {formatPhp(totalPhp)}
                        </span>
                      </div>
                    )}

                    {buyError && (
                      <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                        {buyError}
                      </div>
                    )}

                    {hasEnoughBalance ? (
                      <button
                        type="button"
                        disabled={buying}
                        onClick={handleBuyNow}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white transition-colors cursor-pointer"
                      >
                        {buying ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : item.autoDelivery ? (
                          <Zap className="w-4 h-4" />
                        ) : (
                          <ShoppingBag className="w-4 h-4" />
                        )}
                        <span>
                          {buying
                            ? 'Processing Order...'
                            : item.autoDelivery
                            ? `Buy & Unlock Instant Delivery · ${formatPhp(
                                totalPhp
                              )}`
                            : `Buy Now · ${formatPhp(totalPhp)}`}
                        </span>
                      </button>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                        <p className="text-xs text-amber-300">
                          Need {formatPhp(totalPhp - userBalance)} more in your wallet.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenTopUp();
                          }}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Top Up via GCash</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            {/* Direct Social Inquiry & Quick Inquiry Dropbox */}
            <div className="mt-auto pt-4 border-t border-white/[0.08] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                  {sold
                    ? 'Item Unavailable — Ask for Similar Stocks'
                    : restocking
                    ? 'Restocking Soon — Send Reserve Inquiry'
                    : 'Or Contact Seller Directly'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInquiryForm((s) => !s);
                      setInquirySent(false);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#2563EB]/20 hover:bg-[#2563EB]/30 text-[#93C5FD] transition-colors cursor-pointer"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                    <span>{showInquiryForm ? 'Hide Form' : 'Quick Inquiry'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyInquiry}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-[#E5E7EB] transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy text</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {showInquiryForm && (
                <form
                  onSubmit={handleSendDirectInquiry}
                  className="p-3.5 rounded-lg bg-[#0C0E14] border border-white/[0.08] space-y-2.5"
                >
                  {inquirySent ? (
                    <div className="text-xs text-emerald-400 font-medium flex items-center gap-2 py-1">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>
                        Inquiry sent! Kozuo can now view it in the store inbox. You can also message Facebook / Telegram below for faster reply.
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          required
                          maxLength={BLUEPRINT_LIMITS.INQUIRY.BUYER_NAME_MAX}
                          value={buyerName}
                          onChange={(e) => setBuyerName(e.target.value)}
                          placeholder="Your Name"
                          className="px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-xs text-white placeholder-[#6B7280]"
                        />
                        <input
                          type="text"
                          required
                          maxLength={BLUEPRINT_LIMITS.INQUIRY.HANDLE_MAX}
                          value={contactHandle}
                          onChange={(e) => setContactHandle(e.target.value)}
                          placeholder="FB Name or @Telegram"
                          className="px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-xs text-white placeholder-[#6B7280]"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <select
                          value={preferredChannel}
                          onChange={(e) =>
                            setPreferredChannel(
                              e.target.value as InquiryChannel
                            )
                          }
                          className="px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-xs text-white"
                        >
                          <option value="Facebook">Reply via Facebook</option>
                          <option value="Messenger">Reply via Messenger</option>
                          <option value="Telegram">Reply via Telegram</option>
                        </select>
                        <input
                          type="text"
                          required
                          maxLength={BLUEPRINT_LIMITS.INQUIRY.MESSAGE_MAX}
                          value={inquiryMessage}
                          onChange={(e) => setInquiryMessage(e.target.value)}
                          placeholder="Message or question..."
                          className="sm:col-span-2 px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-xs text-white placeholder-[#6B7280]"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={sendingInquiry}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white cursor-pointer"
                        >
                          {sendingInquiry ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span>Submit Inquiry</span>
                        </button>
                      </div>
                    </>
                  )}
                </form>
              )}

              <div className="p-2.5 rounded-lg bg-[#0C0E14] border border-white/[0.06] text-xs font-mono-tabular text-[#9CA3AF] select-all">
                {inquiryTemplate}
              </div>

              {socialLinks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {socialLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-white/[0.06] hover:bg-[#2563EB] text-white text-sm font-semibold transition-colors"
                    >
                      <span className="flex items-center gap-2 min-w-0 truncate">
                        <SocialIcon
                          platform={link.platform}
                          className="w-4 h-4 shrink-0"
                        />
                        <span className="truncate">{link.label}</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#6B7280]">
                  Seller social contact links have not been configured yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
