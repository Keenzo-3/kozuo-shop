import type { Timestamp } from 'firebase/firestore';

export type StockCategory = 'CODM ACCOUNT' | 'CODM&MLBB FILES';
export type AccountGroup = 'Clean' | 'Not Clean' | 'N/A';
export type StockStatus = string;
export type DealChannel = 'Facebook' | 'Telegram' | 'Direct';
export type InquiryChannel = 'Facebook' | 'Messenger' | 'Telegram';
export type InquiryStatus = 'New' | 'Replied' | 'Closed';

export type UserRole = 'buyer' | 'admin';
export type TopUpStatus = 'Pending' | 'Approved' | 'Rejected';
export type OrderDeliveryStatus = 'Processing' | 'Delivered' | 'Refunded';
export type VoucherDiscountType = 'fixed' | 'percent';
export type DeliveryType = 'link' | 'credentials';

export type SocialPlatform =
  | 'Facebook'
  | 'Messenger'
  | 'Telegram'
  | 'Discord'
  | 'TikTok'
  | 'WhatsApp'
  | 'Instagram'
  | 'Custom';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'keenzowatashi@gmail.com';

export const CORE_STOCK_STATUSES = [
  'In Stock',
  'Low Stock',
  'Out of Stock',
  'Restocking Soon',
] as const;

export const STATUS_PRESETS = [
  'In Stock',
  'Low Stock',
  'Out of Stock',
  'Restocking Soon',
  'Unlooted & Untouched',
  'Reserved',
  'Sold',
] as const;

export function parsePricePhp(priceLabel: string): number {
  const cleaned = priceLabel.replace(/,/g, '');
  const match = cleaned.match(/\d+(?:\.\d{1,2})?/);
  if (!match) return 0;
  const val = Number(match[0]);
  return Number.isFinite(val) && val > 0 ? Math.round(val * 100) / 100 : 0;
}

export function formatPhp(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `₱${safe.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function isRestockingStatus(status: string): boolean {
  return status.trim().toLowerCase().includes('restock');
}

export function isSoldStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return (
    s.includes('sold') ||
    s.includes('out of stock') ||
    s.includes('unavailable')
  );
}

export function isItemSold(
  item: Pick<StockItem, 'category' | 'status' | 'stockCount'>
): boolean {
  if (isSoldStatus(item.status)) return true;
  if (item.stockCount <= 0 && !isRestockingStatus(item.status)) return true;
  return false;
}

export function deriveAutoStockStatus(
  category: StockCategory,
  currentStatus: string,
  nextCount: number
): string {
  const trimmed = currentStatus.trim();
  const lower = trimmed.toLowerCase();

  if (nextCount <= 0) {
    if (lower.includes('restock')) return 'Restocking Soon';
    if (lower.includes('sold')) return 'Sold';
    if (lower.includes('unavailable')) return 'Unavailable';
    return 'Out of Stock';
  }

  if (category === 'CODM ACCOUNT') {
    if (
      !trimmed ||
      lower.includes('out of stock') ||
      lower.includes('sold') ||
      lower.includes('unavailable') ||
      lower.includes('restock') ||
      lower === 'low stock'
    ) {
      return 'In Stock';
    }
    return trimmed;
  }

  // Stock-based CODM&MLBB FILES: auto switch between Low Stock (1-3) and In Stock (4+)
  const isStandardAutoStatus =
    !trimmed ||
    lower === 'in stock' ||
    lower === 'low stock' ||
    lower === 'available' ||
    lower.includes('out of stock') ||
    lower.includes('sold') ||
    lower.includes('unavailable') ||
    lower.includes('restock');

  if (nextCount <= 3) {
    return isStandardAutoStatus ? 'Low Stock' : trimmed;
  }

  return isStandardAutoStatus ? 'In Stock' : trimmed;
}

export function getStatusToneClass(status: string): string {
  const s = status.trim().toLowerCase();
  if (s.includes('out of stock') || s.includes('sold') || s.includes('unavailable')) {
    return 'text-[#9CA3AF]';
  }
  if (s.includes('restock')) {
    return 'text-sky-400';
  }
  if (s.includes('low') || s.includes('reserved') || s.includes('hold') || s.includes('pending')) {
    return 'text-amber-400';
  }
  if (s.includes('rush') || s.includes('limited') || s.includes('hot')) {
    return 'text-rose-400';
  }
  return 'text-emerald-400';
}

export const BLUEPRINT_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  STOCK: {
    TITLE_MAX: 120,
    CODE_MAX: 32,
    FILE_TYPE_MAX: 60,
    PRICE_LABEL_MAX: 40,
    STATUS_MAX: 32,
    BIND_SUMMARY_MAX: 140,
    DESCRIPTION_MAX: 2000,
    SPECS_MAX_COUNT: 12,
    SPEC_LABEL_MAX: 40,
    SPEC_VALUE_MAX: 100,
    HIGHLIGHTS_MAX_COUNT: 12,
    HIGHLIGHT_ITEM_MAX: 120,
    IMAGE_URL_MAX: 160000,
    GALLERY_MAX_COUNT: 7,
  },
  USER: {
    USERNAME_MIN: 3,
    USERNAME_MAX: 24,
    USERNAME_PATTERN: /^[a-z0-9_]{3,24}$/,
    EMAIL_MAX: 120,
    DISPLAY_NAME_MAX: 60,
  },
  TOPUP: {
    REQUEST_CODE_MAX: 24,
    USER_NAME_MAX: 60,
    REF_NO_MAX: 60,
    PROOF_IMAGE_MAX: 160000,
    ADMIN_NOTE_MAX: 240,
    MIN_PHP: 50,
    MAX_PHP: 100000,
  },
  ORDER: {
    ORDER_CODE_MAX: 24,
    DELIVERY_NOTE_MAX: 1000,
  },
  VOUCHER: {
    CODE_MIN: 3,
    CODE_MAX: 24,
    CODE_PATTERN: /^[A-Z0-9_-]{3,24}$/,
    NOTE_MAX: 120,
    MAX_USES: 100000,
    MAX_FIXED_PHP: 100000,
  },
  DELIVERY: {
    PAYLOAD_MAX: 1500,
    INSTRUCTIONS_MAX: 500,
    MAX_UNITS: 50,
  },
  INQUIRY: {
    BUYER_NAME_MAX: 60,
    HANDLE_MAX: 100,
    STOCK_CODE_MAX: 32,
    STOCK_TITLE_MAX: 120,
    MESSAGE_MAX: 600,
  },
  REVIEW: {
    BUYER_NAME_MAX: 60,
    ITEM_LABEL_MAX: 100,
    COMMENT_MAX: 500,
    PROOF_IMAGE_MAX: 160000,
  },
  SOCIAL: {
    LABEL_MAX: 60,
    HANDLE_MAX: 80,
    URL_MAX: 500,
  },
  SETTINGS: {
    STORE_NAME_MAX: 60,
    ACCENT_WORD_MAX: 30,
    ANNOUNCEMENT_MAX: 200,
    HERO_KICKER_MAX: 60,
    HERO_TITLE_MAX: 120,
    HERO_SUBTITLE_MAX: 300,
    CONTACT_HEADING_MAX: 100,
    CONTACT_NOTE_MAX: 500,
    GUIDE_MAX: 300,
    GCASH_NAME_MAX: 80,
    GCASH_NUMBER_MAX: 30,
  },
} as const;

export function normalizeVoucherCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, BLUEPRINT_LIMITS.VOUCHER.CODE_MAX);
}

export function isVoucherCurrentlyValid(
  voucher: Pick<
    VoucherCode,
    'active' | 'usedCount' | 'maxUses' | 'minOrderPhp' | 'hasExpiry' | 'expiresAt'
  >,
  subtotalPhp: number,
  nowMs = Date.now()
): { valid: boolean; reason?: string } {
  if (!voucher.active) {
    return { valid: false, reason: 'This voucher code is currently paused.' };
  }
  if (voucher.usedCount >= voucher.maxUses) {
    return { valid: false, reason: 'This voucher has reached its usage limit.' };
  }
  if (voucher.hasExpiry && voucher.expiresAt) {
    const expMs =
      typeof voucher.expiresAt.toMillis === 'function'
        ? voucher.expiresAt.toMillis()
        : 0;
    if (expMs > 0 && expMs <= nowMs) {
      return { valid: false, reason: 'This voucher code has expired.' };
    }
  }
  if (subtotalPhp < voucher.minOrderPhp) {
    return {
      valid: false,
      reason: `Minimum spend of ${formatPhp(voucher.minOrderPhp)} required.`,
    };
  }
  return { valid: true };
}

export function computeVoucherDiscount(
  subtotalPhp: number,
  voucher: Pick<VoucherCode, 'discountType' | 'discountValue'> | null
): number {
  if (!voucher || subtotalPhp <= 0) return 0;
  const raw =
    voucher.discountType === 'percent'
      ? (subtotalPhp * Math.min(100, Math.max(0, voucher.discountValue))) / 100
      : Math.max(0, voucher.discountValue);
  const rounded = Math.round(raw * 100) / 100;
  return Math.max(0, Math.min(subtotalPhp, rounded));
}

export function usernameToAuthEmail(username: string): string {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  return `${clean}@kozuo.local`;
}

export function extractUsernameFromEmail(email?: string | null): string {
  if (!email) return '';
  const lower = email.toLowerCase();
  if (lower.endsWith('@kozuo.local')) {
    return lower.slice(0, -'@kozuo.local'.length);
  }
  return '';
}

export function formatBuyerAccountLabel(
  email?: string | null,
  username?: string | null,
  contactEmail?: string | null
): string {
  const uname = username?.trim() || extractUsernameFromEmail(email);
  const cEmail = contactEmail?.trim();
  if (uname) {
    return cEmail ? `@${uname} · ${cEmail}` : `@${uname}`;
  }
  return cEmail || email || 'Member';
}

export interface StockSpec {
  label: string;
  value: string;
}

export interface StockItem {
  id: string;
  title: string;
  code: string;
  category: StockCategory;
  accountGroup: AccountGroup;
  fileType: string;
  priceLabel: string;
  pricePhp: number;
  hasPersistedPricePhp?: boolean;
  status: string;
  stockCount: number;
  bindSummary: string;
  description: string;
  specifications: StockSpec[];
  highlights: string[];
  imageUrl: string;
  galleryImages: string[];
  featured: boolean;
  autoDelivery?: boolean;
  nextDeliveryIndex?: number;
  lastOrderId?: string;
  ownerId: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface StockFormInput {
  title: string;
  code: string;
  category: StockCategory;
  accountGroup: AccountGroup;
  fileType: string;
  priceLabel: string;
  pricePhp: number;
  status: string;
  stockCount: number;
  bindSummary: string;
  description: string;
  specifications: StockSpec[];
  highlights: string[];
  imageUrl: string;
  galleryImages: string[];
  featured: boolean;
  autoDelivery?: boolean;
}

export interface DeliveryVaultItem {
  stockId: string;
  unitIndex?: number;
  deliveryType: DeliveryType;
  payload: string;
  instructions: string;
  ownerId: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface DeliveryVaultInput {
  enabled: boolean;
  deliveryType: DeliveryType;
  payload: string;
  items: string[];
  instructions: string;
}

export interface DeliveryEntitlement {
  id: string;
  uid: string;
  stockId: string;
  unitIndex?: number;
  orderId: string;
  createdAt?: Timestamp | null;
}

export interface VoucherCode {
  id: string;
  code: string;
  discountType: VoucherDiscountType;
  discountValue: number;
  minOrderPhp: number;
  maxUses: number;
  usedCount: number;
  active: boolean;
  hasExpiry: boolean;
  expiresAt?: Timestamp | null;
  note: string;
  ownerId: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface VoucherInput {
  code: string;
  discountType: VoucherDiscountType;
  discountValue: number;
  minOrderPhp: number;
  maxUses: number;
  active: boolean;
  expiresDate?: string;
  note: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  username?: string;
  contactEmail?: string;
  displayName: string;
  role: UserRole;
  balance: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface TopUpRequest {
  id: string;
  requestCode: string;
  userId: string;
  userEmail: string;
  userName: string;
  method: 'GCash';
  amountPhp: number;
  referenceNo: string;
  proofImageUrl: string;
  status: TopUpStatus;
  adminNote: string;
  reviewedBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface TopUpRequestInput {
  amountPhp: number;
  referenceNo: string;
  proofImageUrl: string;
}

export interface StoreOrder {
  id: string;
  orderCode: string;
  userId: string;
  userEmail: string;
  userName: string;
  stockId: string;
  stockCode: string;
  stockTitle: string;
  category: StockCategory;
  quantity: number;
  startUnitIndex?: number;
  unitPricePhp: number;
  subtotalPhp?: number;
  voucherCode?: string;
  discountPhp?: number;
  totalPhp: number;
  paymentMethod: 'Wallet Balance';
  deliveryStatus: OrderDeliveryStatus;
  deliveryNote: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface CustomerInquiry {
  id: string;
  buyerName: string;
  contactHandle: string;
  preferredChannel: InquiryChannel;
  stockCode: string;
  stockTitle: string;
  message: string;
  status: InquiryStatus;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface CustomerInquiryInput {
  buyerName: string;
  contactHandle: string;
  preferredChannel: InquiryChannel;
  stockCode: string;
  stockTitle: string;
  message: string;
}

export interface ReviewItem {
  id: string;
  buyerName: string;
  itemLabel: string;
  rating: number;
  comment: string;
  dealChannel: DealChannel;
  proofImageUrl: string;
  ownerId: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ReviewInput {
  buyerName: string;
  itemLabel: string;
  rating: number;
  comment: string;
  dealChannel: DealChannel;
  proofImageUrl: string;
}

export interface SocialLink {
  id: string;
  platform: SocialPlatform;
  label: string;
  handle: string;
  url: string;
  sortOrder: number;
  ownerId: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface SocialLinkInput {
  platform: SocialPlatform;
  label: string;
  handle: string;
  url: string;
  sortOrder: number;
}

export interface StoreSettings {
  storeName: string;
  accentWord: string;
  announcementText: string;
  heroKicker: string;
  heroTitle: string;
  heroSubtitle: string;
  contactHeading: string;
  contactNote: string;
  cleanGuide: string;
  notCleanGuide: string;
  gcashName: string;
  gcashNumber: string;
  minTopUpPhp: number;
  updatedBy?: string;
  updatedAt?: Timestamp | null;
}
