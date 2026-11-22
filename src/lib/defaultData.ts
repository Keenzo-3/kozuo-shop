import type {
  ReviewInput,
  ReviewItem,
  SocialLink,
  SocialLinkInput,
  StockFormInput,
  StockItem,
  StoreSettings,
} from '../types/store';
import { CODM_FILES_PHOTO, MLBB_FILES_PHOTO } from './imageUtils';

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: 'KOZUO',
  accentWord: 'STORE',
  announcementText:
    'Kozuo Store · Live Stock Showcase · Top up via GCash or contact Facebook & Telegram',
  heroKicker: 'LIVE STOCK CATALOG',
  heroTitle: 'Available Stocks & Files',
  heroSubtitle:
    'Browse live Clean or Not Clean CODM accounts and stock-based CODM & MLBB files. Sign in to top up via GCash and buy directly with your wallet balance, or contact Kozuo.',
  contactHeading: 'Contact Kozuo Support',
  contactNote:
    'Top up your PHP wallet via GCash (owner approval required), or scan a QR code and message Facebook / Telegram directly.',
  cleanGuide:
    'Clean Account (One-Time Buy): Full email/Garena surrender with no lost or active third-party binds. Safe for main use.',
  notCleanGuide:
    'Not Clean Account (One-Time Buy): Has a lost or dead third-party bind. Priced lower as-is with full transparency.',
  gcashName: 'J.O',
  gcashNumber: '09933119204',
  minTopUpPhp: 50,
};

export const STARTER_SOCIAL_LINKS: SocialLinkInput[] = [
  {
    platform: 'Facebook',
    label: 'Facebook / Messenger Direct',
    handle: 'facebook.com/vento.kozuo',
    url: 'https://www.facebook.com/vento.kozuo',
    sortOrder: 1,
  },
  {
    platform: 'Telegram',
    label: 'Telegram Direct',
    handle: 't.me/Kaixelexzu',
    url: 'https://t.me/Kaixelexzu',
    sortOrder: 2,
  },
];

export const STARTER_STOCK_TEMPLATES: StockFormInput[] = [
  {
    title: '500 VALID HITS — Unlooted & Untouched',
    code: 'CODM-500',
    category: 'CODM&MLBB FILES',
    accountGroup: 'N/A',
    fileType: 'CODM Files',
    priceLabel: '₱100',
    pricePhp: 100,
    status: 'In Stock',
    stockCount: 10,
    bindSummary: 'CODM Files · 500 Valid Hits · Unlooted',
    description:
      'Fresh CODM valid hits batch (500 Valid Hits), unlooted and untouched. Stock-based release—buy with your wallet balance or message Facebook / Telegram for instant delivery.',
    specifications: [],
    highlights: [],
    imageUrl: CODM_FILES_PHOTO,
    galleryImages: [CODM_FILES_PHOTO],
    featured: true,
  },
  {
    title: '1,500 VALID HITS — Unlooted & Untouched',
    code: 'CODM-1500',
    category: 'CODM&MLBB FILES',
    accountGroup: 'N/A',
    fileType: 'CODM Files',
    priceLabel: '₱150',
    pricePhp: 150,
    status: 'In Stock',
    stockCount: 10,
    bindSummary: 'CODM Files · 1,500 Valid Hits · Unlooted',
    description:
      'Mid-pack CODM valid hits batch (1,500 Valid Hits), unlooted and untouched. Ideal for bulk checking with live stock availability and fast delivery.',
    specifications: [],
    highlights: [],
    imageUrl: CODM_FILES_PHOTO,
    galleryImages: [CODM_FILES_PHOTO],
    featured: true,
  },
  {
    title: '2,500 VALID HITS — Unlooted & Untouched',
    code: 'CODM-2500',
    category: 'CODM&MLBB FILES',
    accountGroup: 'N/A',
    fileType: 'CODM Files',
    priceLabel: '₱200',
    pricePhp: 200,
    status: 'In Stock',
    stockCount: 10,
    bindSummary: 'CODM Files · 2,500 Valid Hits · Unlooted',
    description:
      'Heavy-volume CODM valid hits pack (2,500 Valid Hits), unlooted and untouched. Best-value CODM pack from limited daily batches.',
    specifications: [],
    highlights: [],
    imageUrl: CODM_FILES_PHOTO,
    galleryImages: [CODM_FILES_PHOTO],
    featured: false,
  },
  {
    title: '200K COMBO — MLBB Upass Combo',
    code: 'MLBB-200K',
    category: 'CODM&MLBB FILES',
    accountGroup: 'N/A',
    fileType: 'MLBB Upass Combo',
    priceLabel: '₱150',
    pricePhp: 150,
    status: 'In Stock',
    stockCount: 10,
    bindSummary: 'MLBB Upass Combo · 200K Lines',
    description:
      'Fresh MLBB Upass 200K combo pack, cleanly formatted and ready. Stock-based digital file delivery upon purchase confirmation.',
    specifications: [],
    highlights: [],
    imageUrl: MLBB_FILES_PHOTO,
    galleryImages: [MLBB_FILES_PHOTO],
    featured: true,
  },
  {
    title: '350K COMBO — MLBB Upass Combo',
    code: 'MLBB-350K',
    category: 'CODM&MLBB FILES',
    accountGroup: 'N/A',
    fileType: 'MLBB Upass Combo',
    priceLabel: '₱200',
    pricePhp: 200,
    status: 'In Stock',
    stockCount: 10,
    bindSummary: 'MLBB Upass Combo · 350K Lines',
    description:
      'MLBB Upass 350K combo pack for higher volume runs. Check live stock count and purchase with wallet balance or message directly.',
    specifications: [],
    highlights: [],
    imageUrl: MLBB_FILES_PHOTO,
    galleryImages: [MLBB_FILES_PHOTO],
    featured: false,
  },
  {
    title: '500K COMBO — MLBB Upass Combo',
    code: 'MLBB-500K',
    category: 'CODM&MLBB FILES',
    accountGroup: 'N/A',
    fileType: 'MLBB Upass Combo',
    priceLabel: '₱300',
    pricePhp: 300,
    status: 'In Stock',
    stockCount: 10,
    bindSummary: 'MLBB Upass Combo · 500K Lines',
    description:
      'Top-tier MLBB Upass 500K combo pack for maximum volume runs. Stock-based inventory updated live by Kozuo.',
    specifications: [],
    highlights: [],
    imageUrl: MLBB_FILES_PHOTO,
    galleryImages: [MLBB_FILES_PHOTO],
    featured: false,
  },
];

export const STARTER_REVIEW_TEMPLATES: ReviewInput[] = [
  {
    buyerName: 'Jeric V.',
    itemLabel: '1,500 VALID HITS · CODM Files',
    rating: 5,
    comment:
      'Fast transaction on Telegram! The batch was genuinely unlooted and untouched, smooth deal in under 5 minutes.',
    dealChannel: 'Telegram',
    proofImageUrl: '',
  },
  {
    buyerName: 'Kael M.',
    itemLabel: 'CODM Clean Account (Surrender Gmail)',
    rating: 5,
    comment:
      '100% legit seller. Full surrender email with zero hidden binds, and Kozuo assisted smoothly on Facebook.',
    dealChannel: 'Facebook',
    proofImageUrl: '',
  },
  {
    buyerName: 'Renz D.',
    itemLabel: '350K COMBO · MLBB Upass Combo',
    rating: 5,
    comment:
      'Second time buying an MLBB combo pack here. Live stock count updated right away and instant file delivery.',
    dealChannel: 'Telegram',
    proofImageUrl: '',
  },
];

export const DEFAULT_PREVIEW_STOCKS: StockItem[] = STARTER_STOCK_TEMPLATES.map(
  (tpl, idx) => ({
    ...tpl,
    hasPersistedPricePhp: true,
    id: `preview-${idx}`,
    ownerId: 'kozuo-default',
    createdAt: null,
    updatedAt: null,
  })
);

export const DEFAULT_PREVIEW_LINKS: SocialLink[] = STARTER_SOCIAL_LINKS.map(
  (link, idx) => ({
    ...link,
    id: `preview-link-${idx}`,
    ownerId: 'kozuo-default',
    createdAt: null,
    updatedAt: null,
  })
);

export const DEFAULT_PREVIEW_REVIEWS: ReviewItem[] =
  STARTER_REVIEW_TEMPLATES.map((rev, idx) => ({
    ...rev,
    id: `preview-rev-${idx}`,
    ownerId: 'kozuo-default',
    createdAt: null,
    updatedAt: null,
  }));
