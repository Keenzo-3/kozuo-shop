import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  Archive,
  ArrowUpDown,
  Clock,
  HelpCircle,
  Inbox,
  Layers,
  LogIn,
  MessageSquare,
  Plus,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import { AccountAuthModal } from './components/AccountAuthModal';
import { ContactSection } from './components/ContactSection';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { HelpCenterSection } from './components/HelpCenterSection';
import { OwnerStudioModal, type StudioTab } from './components/OwnerStudioModal';
import { ReviewsSection } from './components/ReviewsSection';
import { StockCard } from './components/StockCard';
import { StockDetailModal } from './components/StockDetailModal';
import { StockEditorModal } from './components/StockEditorModal';
import { TopUpModal } from './components/TopUpModal';
import {
  DEFAULT_PREVIEW_LINKS,
  DEFAULT_PREVIEW_REVIEWS,
  DEFAULT_PREVIEW_STOCKS,
  DEFAULT_STORE_SETTINGS,
} from './lib/defaultData';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  registerWithUsernamePassword,
  signInWithGoogle,
  signInWithUsernamePassword,
  signOutOwner,
  testConnection,
} from './lib/firebase';
import {
  approveTopUpRequest,
  backfillMissingStockPrices,
  createInquiry,
  createReview,
  createSocialLink,
  createStock,
  createVoucher,
  deleteVoucher,
  ensureUserProfile,
  lookupVoucher,
  purchaseStockWithBalance,
  rejectTopUpRequest,
  removeDuplicateStocks,
  removeInquiry,
  removeReview,
  removeSocialLink,
  removeStock,
  resetAllStocks,
  saveStoreSettings,
  seedStarterCatalog,
  submitTopUpRequest,
  updateInquiryStatus,
  updateOrderDelivery,
  updateReview,
  updateSocialLink,
  updateStock,
  updateStockStatusAndCount,
  updateUserContactEmail,
  updateUserDisplayName,
  updateVoucher,
  type PurchaseOrderResult,
} from './lib/storeService';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  getStatusToneClass,
  isItemSold,
  isRestockingStatus,
  isSoldStatus,
  parsePricePhp,
  type CustomerInquiry,
  type CustomerInquiryInput,
  type DeliveryVaultInput,
  type InquiryStatus,
  type OrderDeliveryStatus,
  type ReviewInput,
  type ReviewItem,
  type SocialLink,
  type SocialLinkInput,
  type StockCategory,
  type StockFormInput,
  type StockItem,
  type StockSpec,
  type StoreOrder,
  type StoreSettings,
  type TopUpRequest,
  type TopUpRequestInput,
  type UserProfile,
  type VoucherCode,
  type VoucherInput,
} from './types/store';

type CategoryFilter = 'ALL' | 'SOLD' | StockCategory;
type AccountGroupFilter = 'ALL' | 'Clean' | 'Not Clean';
type FileSubFilter = 'ALL' | 'CODM' | 'MLBB';
type StatusFilter =
  | 'ALL'
  | 'IN_STOCK'
  | 'LOW_STOCK'
  | 'RESTOCKING'
  | 'OUT_OF_STOCK';

type SortOption = 'featured' | 'newest' | 'price-asc' | 'price-desc';

interface SoldToast {
  item: StockItem;
  prevStatus: string;
  prevCount: number;
}

function StorefrontApp() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [rawStocks, setRawStocks] = useState<StockItem[]>([]);
  const [rawInquiries, setRawInquiries] = useState<CustomerInquiry[]>([]);
  const [rawReviews, setRawReviews] = useState<ReviewItem[]>([]);
  const [rawSocialLinks, setRawSocialLinks] = useState<SocialLink[]>([]);
  const [rawTopUps, setRawTopUps] = useState<TopUpRequest[]>([]);
  const [rawOrders, setRawOrders] = useState<StoreOrder[]>([]);
  const [rawVouchers, setRawVouchers] = useState<VoucherCode[]>([]);
  const [rawUserProfiles, setRawUserProfiles] = useState<UserProfile[]>([]);

  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [settingsDocExists, setSettingsDocExists] = useState<boolean | null>(null);
  const [stocksLoaded, setStocksLoaded] = useState(false);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [linksLoaded, setLinksLoaded] = useState(false);
  const autoSeededRef = useRef(false);
  const autoDedupedRef = useRef(false);
  const priceBackfilledRef = useRef(false);
  const gcashMigratedRef = useRef(false);
  const ensuredProfileUidsRef = useRef<Set<string>>(new Set());

  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [accountGroupFilter, setAccountGroupFilter] =
    useState<AccountGroupFilter>('ALL');
  const [fileSubFilter, setFileSubFilter] = useState<FileSubFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('featured');

  // Modals & owner toast
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<StockItem | null>(null);
  const [duplicateDraft, setDuplicateDraft] = useState<StockFormInput | null>(
    null
  );
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioTab, setStudioTab] = useState<StudioTab>('stocks');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<
    'overview' | 'topups' | 'orders'
  >('overview');
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [prefillReviewLabel, setPrefillReviewLabel] = useState('');
  const [editingReview, setEditingReview] = useState<ReviewItem | null>(null);
  const [soldToast, setSoldToast] = useState<SoldToast | null>(null);

  const footerTapCountRef = useRef(0);
  const footerTapTimerRef = useRef<number | null>(null);

  // Discreet owner access via #owner URL hash or Ctrl+Shift+O shortcut
  useEffect(() => {
    const checkHash = () => {
      if (
        window.location.hash === '#owner' ||
        window.location.search.includes('owner=1')
      ) {
        setStudioTab('stocks');
        setStudioOpen(true);
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === 'o'
      ) {
        e.preventDefault();
        setStudioTab('stocks');
        setStudioOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('hashchange', checkHash);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleFooterSecretTap = () => {
    footerTapCountRef.current += 1;
    if (footerTapTimerRef.current) {
      window.clearTimeout(footerTapTimerRef.current);
    }
    if (footerTapCountRef.current >= 5) {
      footerTapCountRef.current = 0;
      setStudioTab('stocks');
      setStudioOpen(true);
      return;
    }
    footerTapTimerRef.current = window.setTimeout(() => {
      footerTapCountRef.current = 0;
    }, 1500);
  };

  // Boot connection probe & auth state
  useEffect(() => {
    testConnection();

    const unsubAuth = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setIsAdmin(false);
        setUserProfile(null);
        return;
      }

      // Ensure buyer profile exists for both username+password and Google users
      ensureUserProfile(nextUser).catch(() => {});

      // Admin access strictly requires verified Google email
      if (!nextUser.emailVerified) {
        setIsAdmin(false);
        return;
      }

      if (nextUser.email === BOOTSTRAPPED_ADMIN_EMAIL) {
        setIsAdmin(true);
        return;
      }
      try {
        const adminSnap = await getDoc(doc(db, 'admins', nextUser.uid));
        setIsAdmin(adminSnap.exists());
      } catch {
        setIsAdmin(false);
      }
    });

    return () => unsubAuth();
  }, []);

  // Subscribe to signed-in user's own wallet profile
  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      return;
    }

    const unsubProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          ensuredProfileUidsRef.current.add(user.uid);
          const data = snap.data();
          setUserProfile({
            uid: String(data.uid ?? user.uid),
            email: String(data.email ?? user.email ?? ''),
            username: data.username ? String(data.username) : undefined,
            contactEmail: data.contactEmail
              ? String(data.contactEmail)
              : undefined,
            displayName: String(
              data.displayName ?? user.displayName ?? 'Member'
            ),
            role: data.role === 'admin' ? 'admin' : 'buyer',
            balance: Number(data.balance ?? 0),
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          });
        } else {
          if (!snap.metadata.fromCache && !ensuredProfileUidsRef.current.has(user.uid)) {
            ensuredProfileUidsRef.current.add(user.uid);
            ensureUserProfile(user).catch(() => {
              ensuredProfileUidsRef.current.delete(user.uid);
            });
          }
          setUserProfile({
            uid: user.uid,
            email: user.email ?? '',
            displayName: user.displayName ?? 'Member',
            role: isAdmin ? 'admin' : 'buyer',
            balance: 0,
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }
    );

    return () => unsubProfile();
  }, [user, isAdmin]);

  // Real-time public Firestore subscriptions (no buyer sign-up needed)
  useEffect(() => {
    const unsubStocks = onSnapshot(
      collection(db, 'stocks'),
      (snap) => {
        const list: StockItem[] = snap.docs.map((d) => {
          const data = d.data();
          const category: StockCategory =
            data.category === 'CODM&MLBB FILES'
              ? 'CODM&MLBB FILES'
              : 'CODM ACCOUNT';
          const imageUrl = String(data.imageUrl ?? '');
          const galleryImages = Array.isArray(data.galleryImages)
            ? data.galleryImages.map(String).filter(Boolean)
            : imageUrl
            ? [imageUrl]
            : [];
          const status = String(data.status ?? 'In Stock');
          const defaultCount =
            category === 'CODM ACCOUNT'
              ? isSoldStatus(status)
                ? 0
                : 1
              : 10;

          const specifications: StockSpec[] = Array.isArray(data.specifications)
            ? data.specifications
                .filter(
                  (s: unknown): s is { label?: unknown; value?: unknown } =>
                    Boolean(s && typeof s === 'object')
                )
                .map((s) => ({
                  label: String(s.label ?? '').trim(),
                  value: String(s.value ?? '').trim(),
                }))
                .filter((s) => s.label.length > 0 && s.value.length > 0)
            : [];

          const priceLabel = String(data.priceLabel ?? '');
          const hasPersistedPricePhp = typeof data.pricePhp === 'number';
          const pricePhp = hasPersistedPricePhp
            ? Number(data.pricePhp)
            : parsePricePhp(priceLabel);

          return {
            id: d.id,
            title: String(data.title ?? ''),
            code: String(data.code ?? ''),
            category,
            accountGroup:
              data.accountGroup === 'Clean' || data.accountGroup === 'Not Clean'
                ? data.accountGroup
                : 'N/A',
            fileType: String(data.fileType ?? ''),
            priceLabel,
            pricePhp,
            hasPersistedPricePhp,
            status,
            stockCount:
              typeof data.stockCount === 'number'
                ? data.stockCount
                : defaultCount,
            bindSummary: String(data.bindSummary ?? ''),
            description: String(data.description ?? ''),
            specifications,
            highlights: Array.isArray(data.highlights)
              ? data.highlights.map(String)
              : [],
            imageUrl: imageUrl || galleryImages[0] || '',
            galleryImages,
            featured: Boolean(data.featured),
            autoDelivery: Boolean(data.autoDelivery),
            nextDeliveryIndex:
              typeof data.nextDeliveryIndex === 'number'
                ? data.nextDeliveryIndex
                : undefined,
            lastOrderId: data.lastOrderId ? String(data.lastOrderId) : undefined,
            ownerId: String(data.ownerId ?? ''),
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });

        list.sort((a, b) => {
          if (a.featured !== b.featured) return a.featured ? -1 : 1;
          const aTime = a.updatedAt?.toMillis?.() ?? 0;
          const bTime = b.updatedAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });

        setRawStocks(list);
        setStocksLoaded(true);
      },
      (error) => {
        setStocksLoaded(true);
        handleFirestoreError(error, OperationType.LIST, 'stocks');
      }
    );

    const unsubReviews = onSnapshot(
      collection(db, 'reviews'),
      (snap) => {
        const list: ReviewItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            buyerName: String(data.buyerName ?? ''),
            itemLabel: String(data.itemLabel ?? ''),
            rating: Number(data.rating ?? 5),
            comment: String(data.comment ?? ''),
            dealChannel:
              data.dealChannel === 'Telegram' || data.dealChannel === 'Direct'
                ? data.dealChannel
                : 'Facebook',
            proofImageUrl: String(data.proofImageUrl ?? ''),
            ownerId: String(data.ownerId ?? ''),
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });
        list.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });
        setRawReviews(list);
        setReviewsLoaded(true);
      },
      (error) => {
        setReviewsLoaded(true);
        handleFirestoreError(error, OperationType.LIST, 'reviews');
      }
    );

    const unsubSocial = onSnapshot(
      collection(db, 'socialLinks'),
      (snap) => {
        const list: SocialLink[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            platform: data.platform ?? 'Custom',
            label: String(data.label ?? ''),
            handle: String(data.handle ?? ''),
            url: String(data.url ?? ''),
            sortOrder: Number(data.sortOrder ?? 0),
            ownerId: String(data.ownerId ?? ''),
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });
        list.sort((a, b) => a.sortOrder - b.sortOrder);
        setRawSocialLinks(list);
        setLinksLoaded(true);
      },
      (error) => {
        setLinksLoaded(true);
        handleFirestoreError(error, OperationType.LIST, 'socialLinks');
      }
    );

    const unsubSettings = onSnapshot(
      doc(db, 'storeSettings', 'main'),
      (snap) => {
        setSettingsDocExists(snap.exists());
        if (snap.exists()) {
          const data = snap.data();
          const rawGcashName = String(
            data.gcashName ?? DEFAULT_STORE_SETTINGS.gcashName
          );
          const rawGcashNumber = String(
            data.gcashNumber ?? DEFAULT_STORE_SETTINGS.gcashNumber
          );
          const migratedGcashName =
            !rawGcashName || rawGcashName === 'Kozuo Store Owner'
              ? DEFAULT_STORE_SETTINGS.gcashName
              : rawGcashName;
          const migratedGcashNumber =
            !rawGcashNumber || rawGcashNumber === '09XX XXX XXXX'
              ? DEFAULT_STORE_SETTINGS.gcashNumber
              : rawGcashNumber;

          setSettings({
            ...DEFAULT_STORE_SETTINGS,
            storeName: String(data.storeName ?? DEFAULT_STORE_SETTINGS.storeName),
            accentWord: String(
              data.accentWord ?? DEFAULT_STORE_SETTINGS.accentWord
            ),
            announcementText: String(
              data.announcementText ?? DEFAULT_STORE_SETTINGS.announcementText
            ),
            heroKicker: String(
              data.heroKicker ?? DEFAULT_STORE_SETTINGS.heroKicker
            ),
            heroTitle: String(data.heroTitle ?? DEFAULT_STORE_SETTINGS.heroTitle),
            heroSubtitle: String(
              data.heroSubtitle ?? DEFAULT_STORE_SETTINGS.heroSubtitle
            ),
            contactHeading: String(
              data.contactHeading ?? DEFAULT_STORE_SETTINGS.contactHeading
            ),
            contactNote: String(
              data.contactNote ?? DEFAULT_STORE_SETTINGS.contactNote
            ),
            cleanGuide: String(
              data.cleanGuide ?? DEFAULT_STORE_SETTINGS.cleanGuide
            ),
            notCleanGuide: String(
              data.notCleanGuide ?? DEFAULT_STORE_SETTINGS.notCleanGuide
            ),
            gcashName: migratedGcashName,
            gcashNumber: migratedGcashNumber,
            minTopUpPhp:
              typeof data.minTopUpPhp === 'number'
                ? data.minTopUpPhp
                : DEFAULT_STORE_SETTINGS.minTopUpPhp,
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'storeSettings/main');
      }
    );

    return () => {
      unsubStocks();
      unsubReviews();
      unsubSocial();
      unsubSettings();
    };
  }, []);

  // Top-up Requests & Orders listeners (Admin sees all; Buyer sees only their own via filtered query)
  useEffect(() => {
    if (!user) {
      setRawTopUps([]);
      setRawOrders([]);
      return;
    }

    const topUpQuery = isAdmin
      ? collection(db, 'topupRequests')
      : query(collection(db, 'topupRequests'), where('userId', '==', user.uid));

    const orderQuery = isAdmin
      ? collection(db, 'orders')
      : query(collection(db, 'orders'), where('userId', '==', user.uid));

    const unsubTopUps = onSnapshot(
      topUpQuery,
      (snap) => {
        const list: TopUpRequest[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            requestCode: String(data.requestCode ?? ''),
            userId: String(data.userId ?? ''),
            userEmail: String(data.userEmail ?? ''),
            userName: String(data.userName ?? ''),
            method: 'GCash',
            amountPhp: Number(data.amountPhp ?? 0),
            referenceNo: String(data.referenceNo ?? ''),
            proofImageUrl: String(data.proofImageUrl ?? ''),
            status:
              data.status === 'Approved' || data.status === 'Rejected'
                ? data.status
                : 'Pending',
            adminNote: String(data.adminNote ?? ''),
            reviewedBy: String(data.reviewedBy ?? ''),
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });
        list.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });
        setRawTopUps(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'topupRequests');
      }
    );

    const unsubOrders = onSnapshot(
      orderQuery,
      (snap) => {
        const list: StoreOrder[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            orderCode: String(data.orderCode ?? ''),
            userId: String(data.userId ?? ''),
            userEmail: String(data.userEmail ?? ''),
            userName: String(data.userName ?? ''),
            stockId: String(data.stockId ?? ''),
            stockCode: String(data.stockCode ?? ''),
            stockTitle: String(data.stockTitle ?? ''),
            category:
              data.category === 'CODM&MLBB FILES'
                ? 'CODM&MLBB FILES'
                : 'CODM ACCOUNT',
            quantity: Number(data.quantity ?? 1),
            startUnitIndex:
              typeof data.startUnitIndex === 'number'
                ? data.startUnitIndex
                : undefined,
            unitPricePhp: Number(data.unitPricePhp ?? 0),
            subtotalPhp:
              typeof data.subtotalPhp === 'number'
                ? Number(data.subtotalPhp)
                : undefined,
            voucherCode: data.voucherCode ? String(data.voucherCode) : '',
            discountPhp:
              typeof data.discountPhp === 'number'
                ? Number(data.discountPhp)
                : 0,
            totalPhp: Number(data.totalPhp ?? 0),
            paymentMethod: 'Wallet Balance',
            deliveryStatus:
              data.deliveryStatus === 'Delivered' ||
              data.deliveryStatus === 'Refunded'
                ? data.deliveryStatus
                : 'Processing',
            deliveryNote: String(data.deliveryNote ?? ''),
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });
        list.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });
        setRawOrders(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      }
    );

    return () => {
      unsubTopUps();
      unsubOrders();
    };
  }, [user, isAdmin]);

  // Admin-only listeners for Customer Inquiries, Vouchers & All Member Balances
  useEffect(() => {
    if (!isAdmin) {
      setRawInquiries([]);
      setRawUserProfiles([]);
      setRawVouchers([]);
      return;
    }

    const unsubInquiries = onSnapshot(
      collection(db, 'inquiries'),
      (snap) => {
        const list: CustomerInquiry[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            buyerName: String(data.buyerName ?? ''),
            contactHandle: String(data.contactHandle ?? ''),
            preferredChannel:
              data.preferredChannel === 'Telegram' ||
              data.preferredChannel === 'Messenger'
                ? data.preferredChannel
                : 'Facebook',
            stockCode: String(data.stockCode ?? ''),
            stockTitle: String(data.stockTitle ?? ''),
            message: String(data.message ?? ''),
            status:
              data.status === 'Replied' || data.status === 'Closed'
                ? data.status
                : 'New',
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });
        list.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });
        setRawInquiries(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'inquiries');
      }
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list: UserProfile[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: String(data.uid ?? d.id),
            email: String(data.email ?? ''),
            username: data.username ? String(data.username) : undefined,
            contactEmail: data.contactEmail
              ? String(data.contactEmail)
              : undefined,
            displayName: String(data.displayName ?? 'Member'),
            role: data.role === 'admin' ? 'admin' : 'buyer',
            balance: Number(data.balance ?? 0),
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });
        setRawUserProfiles(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    );

    const unsubVouchers = onSnapshot(
      collection(db, 'vouchers'),
      (snap) => {
        const list: VoucherCode[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            code: String(data.code ?? d.id),
            discountType:
              data.discountType === 'percent' ? 'percent' : 'fixed',
            discountValue: Number(data.discountValue ?? 0),
            minOrderPhp: Number(data.minOrderPhp ?? 0),
            maxUses: Number(data.maxUses ?? 1),
            usedCount: Number(data.usedCount ?? 0),
            active: Boolean(data.active),
            hasExpiry: Boolean(data.hasExpiry),
            expiresAt: data.expiresAt ?? null,
            note: String(data.note ?? ''),
            ownerId: String(data.ownerId ?? ''),
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });
        list.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });
        setRawVouchers(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'vouchers');
      }
    );

    return () => {
      unsubInquiries();
      unsubUsers();
      unsubVouchers();
    };
  }, [isAdmin]);

  // Backfill numeric pricePhp on older stock documents once admin signs in
  useEffect(() => {
    if (isAdmin && stocksLoaded && rawStocks.length > 0 && !priceBackfilledRef.current) {
      const needsBackfill = rawStocks.some(
        (s) => !s.hasPersistedPricePhp && parsePricePhp(s.priceLabel) > 0
      );
      if (needsBackfill) {
        priceBackfilledRef.current = true;
        backfillMissingStockPrices(rawStocks).catch(() => {
          priceBackfilledRef.current = false;
        });
      }
    }
  }, [isAdmin, stocksLoaded, rawStocks]);

  // Upgrade legacy placeholder GCash settings in Firestore once admin signs in
  useEffect(() => {
    if (!isAdmin || !user || settingsDocExists !== true || gcashMigratedRef.current) {
      return;
    }
    gcashMigratedRef.current = true;
    getDoc(doc(db, 'storeSettings', 'main'))
      .then((snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const needsUpdate =
          data.gcashName === 'Kozuo Store Owner' ||
          data.gcashNumber === '09XX XXX XXXX' ||
          !data.gcashName ||
          !data.gcashNumber;
        if (needsUpdate) {
          saveStoreSettings(
            {
              ...settings,
              gcashName:
                !data.gcashName || data.gcashName === 'Kozuo Store Owner'
                  ? DEFAULT_STORE_SETTINGS.gcashName
                  : String(data.gcashName),
              gcashNumber:
                !data.gcashNumber || data.gcashNumber === '09XX XXX XXXX'
                  ? DEFAULT_STORE_SETTINGS.gcashNumber
                  : String(data.gcashNumber),
            },
            user.uid
          ).catch(() => {
            gcashMigratedRef.current = false;
          });
        }
      })
      .catch(() => {
        gcashMigratedRef.current = false;
      });
  }, [isAdmin, user, settingsDocExists, settings]);

  // Auto-initialize Firestore once when the owner signs in for the first time
  useEffect(() => {
    if (
      isAdmin &&
      user &&
      stocksLoaded &&
      linksLoaded &&
      reviewsLoaded &&
      settingsDocExists === false &&
      rawStocks.length === 0 &&
      rawSocialLinks.length === 0 &&
      !autoSeededRef.current
    ) {
      autoSeededRef.current = true;
      seedStarterCatalog(user.uid, {
        seedStocks: true,
        seedLinks: true,
        seedReviews: true,
        existingStockCodes: rawStocks.map((s) => s.code),
        settings: DEFAULT_STORE_SETTINGS,
      }).catch(() => {
        autoSeededRef.current = false;
      });
    }
  }, [
    isAdmin,
    user,
    stocksLoaded,
    linksLoaded,
    reviewsLoaded,
    settingsDocExists,
    rawStocks,
    rawSocialLinks.length,
  ]);

  const duplicateStockCount = useMemo(() => {
    const groups = new Map<string, number>();
    for (const s of rawStocks) {
      const key = `${s.code.trim().toLowerCase()}|${s.title
        .trim()
        .toLowerCase()}|${s.category}`;
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
    let dupes = 0;
    for (const count of groups.values()) {
      if (count > 1) dupes += count - 1;
    }
    return dupes;
  }, [rawStocks]);

  useEffect(() => {
    if (
      isAdmin &&
      stocksLoaded &&
      duplicateStockCount > 0 &&
      !autoDedupedRef.current
    ) {
      autoDedupedRef.current = true;
      removeDuplicateStocks(rawStocks).catch(() => {
        autoDedupedRef.current = false;
      });
    }
  }, [isAdmin, stocksLoaded, duplicateStockCount, rawStocks]);

  const isUsingDefaults =
    stocksLoaded &&
    linksLoaded &&
    settingsDocExists === false &&
    rawStocks.length === 0 &&
    rawSocialLinks.length === 0;

  const stocks = isUsingDefaults ? DEFAULT_PREVIEW_STOCKS : rawStocks;
  const socialLinks = isUsingDefaults ? DEFAULT_PREVIEW_LINKS : rawSocialLinks;
  const reviews =
    reviewsLoaded && rawReviews.length > 0
      ? rawReviews
      : isUsingDefaults || (reviewsLoaded && rawReviews.length === 0 && !isAdmin)
      ? DEFAULT_PREVIEW_REVIEWS
      : rawReviews;

  const loadingCatalog = !stocksLoaded || !linksLoaded;

  const selectedStock = useMemo(
    () => stocks.find((s) => s.id === selectedStockId) ?? null,
    [stocks, selectedStockId]
  );

  const newInquiryCount = rawInquiries.filter((i) => i.status === 'New').length;
  const pendingTopUpCount = rawTopUps.filter(
    (r) => r.status === 'Pending'
  ).length;
  const processingOrderCount = rawOrders.filter(
    (o) => o.deliveryStatus === 'Processing'
  ).length;
  const userOrderCount = useMemo(
    () =>
      user ? rawOrders.filter((o) => o.userId === user.uid).length : 0,
    [rawOrders, user]
  );

  const recentlyAddedStocks = useMemo(() => {
    return [...stocks]
      .filter((s) => !isItemSold(s))
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      })
      .slice(0, 3);
  }, [stocks]);

  const counts = useMemo(() => {
    const active = stocks.filter((s) => !isItemSold(s));
    const sold = stocks.filter((s) => isItemSold(s));
    const codmAll = active.filter((s) => s.category === 'CODM ACCOUNT');
    const codmClean = codmAll.filter((s) => s.accountGroup === 'Clean').length;
    const codmNotClean = codmAll.filter(
      (s) => s.accountGroup === 'Not Clean'
    ).length;
    const filesAll = active.filter((s) => s.category === 'CODM&MLBB FILES').length;
    const inStockCount = active.filter(
      (s) =>
        !isRestockingStatus(s.status) &&
        !s.status.toLowerCase().includes('low')
    ).length;
    const lowStockCount = active.filter((s) =>
      s.status.toLowerCase().includes('low')
    ).length;
    const restockingCount = active.filter((s) =>
      isRestockingStatus(s.status)
    ).length;
    return {
      all: active.length,
      codmAll: codmAll.length,
      codmClean,
      codmNotClean,
      filesAll,
      sold: sold.length,
      inStockCount,
      lowStockCount,
      restockingCount,
    };
  }, [stocks]);

  const filteredStocks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = stocks.filter((item) => {
      const sold = isItemSold(item);
      const restocking = isRestockingStatus(item.status);
      const isLow = item.status.toLowerCase().includes('low');

      // Status filter override when viewing Out of Stock specifically
      if (statusFilter === 'OUT_OF_STOCK') {
        if (!sold) return false;
      } else if (activeCategory === 'SOLD') {
        if (!sold) return false;
      } else {
        if (sold) return false;
      }

      if (activeCategory !== 'ALL' && activeCategory !== 'SOLD') {
        if (item.category !== activeCategory) return false;
      }

      if (statusFilter === 'IN_STOCK' && (restocking || isLow || sold)) {
        return false;
      }
      if (statusFilter === 'LOW_STOCK' && (!isLow || sold)) {
        return false;
      }
      if (statusFilter === 'RESTOCKING' && !restocking) {
        return false;
      }

      if (
        activeCategory === 'CODM ACCOUNT' &&
        accountGroupFilter !== 'ALL' &&
        item.accountGroup !== accountGroupFilter
      ) {
        return false;
      }
      if (activeCategory === 'CODM&MLBB FILES' && fileSubFilter !== 'ALL') {
        const hay = `${item.fileType} ${item.title} ${item.description}`.toLowerCase();
        if (fileSubFilter === 'CODM' && !hay.includes('codm')) return false;
        if (fileSubFilter === 'MLBB' && !hay.includes('mlbb')) return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q) ||
        item.bindSummary.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.accountGroup.toLowerCase().includes(q) ||
        item.fileType.toLowerCase().includes(q)
      );
    });

    if (sortBy === 'newest') {
      return [...list].sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      });
    }
    if (sortBy === 'price-asc') {
      return [...list].sort((a, b) => (a.pricePhp || 0) - (b.pricePhp || 0));
    }
    if (sortBy === 'price-desc') {
      return [...list].sort((a, b) => (b.pricePhp || 0) - (a.pricePhp || 0));
    }
    return list;
  }, [
    stocks,
    activeCategory,
    statusFilter,
    accountGroupFilter,
    fileSubFilter,
    searchQuery,
    sortBy,
  ]);

  const handleSelectCategory = (cat: CategoryFilter) => {
    setActiveCategory(cat);
    if (cat === 'SOLD') {
      setStatusFilter('ALL');
    } else if (statusFilter === 'OUT_OF_STOCK') {
      setStatusFilter('ALL');
    }
    if (cat !== 'CODM ACCOUNT') {
      setAccountGroupFilter('ALL');
    }
    if (cat !== 'CODM&MLBB FILES') {
      setFileSubFilter('ALL');
    }
  };

  const handleOpenAddStock = () => {
    setEditingStock(null);
    setDuplicateDraft(null);
    setEditorOpen(true);
  };

  const handleOpenEditStock = (item: StockItem) => {
    setEditingStock(item);
    setDuplicateDraft(null);
    setEditorOpen(true);
  };

  const handleSaveStock = async (
    input: StockFormInput,
    existingId?: string,
    deliveryVault?: DeliveryVaultInput
  ) => {
    if (!user) return;
    if (existingId && !existingId.startsWith('preview-')) {
      await updateStock(
        existingId,
        input,
        user.uid,
        deliveryVault,
        editingStock?.nextDeliveryIndex ?? 0
      );
    } else {
      await createStock(input, user.uid, deliveryVault);
    }
  };

  const handleQuickUpdate = async (
    item: StockItem,
    nextStatus: string,
    nextCount: number
  ) => {
    if (item.id.startsWith('preview-')) return;
    const prevStatus = item.status;
    const prevCount = item.stockCount;
    await updateStockStatusAndCount(item.id, nextStatus, nextCount);
    if (isSoldStatus(nextStatus) || (nextCount <= 0 && !isRestockingStatus(nextStatus))) {
      setSoldToast({ item, prevStatus, prevCount });
    }
  };

  const handleMarkSold = async (item: StockItem) => {
    if (item.id.startsWith('preview-')) return;
    const prevStatus = item.status;
    const prevCount = item.stockCount;
    await updateStockStatusAndCount(item.id, 'Sold', 0);
    setSoldToast({ item, prevStatus, prevCount });
  };

  const handleRestoreAvailable = async (item: StockItem) => {
    if (item.id.startsWith('preview-')) return;
    const restoreCount = item.category === 'CODM ACCOUNT' ? 1 : 10;
    await updateStockStatusAndCount(item.id, 'In Stock', restoreCount);
    setSoldToast(null);
  };

  const handleDeleteStock = async (item: StockItem) => {
    if (item.id.startsWith('preview-')) return;
    await removeStock(item.id);
    if (selectedStockId === item.id) {
      setSelectedStockId(null);
    }
  };

  const handleSubmitInquiry = async (input: CustomerInquiryInput) => {
    await createInquiry(input);
  };

  const handleSubmitTopUp = async (input: TopUpRequestInput): Promise<string> => {
    if (!user) {
      throw new Error('Please sign in first.');
    }
    const profilePayload: Pick<UserProfile, 'uid' | 'email' | 'displayName'> = {
      uid: user.uid,
      email: userProfile?.email || user.email || '',
      displayName:
        userProfile?.displayName || user.displayName || 'Member',
    };
    return await submitTopUpRequest(input, profilePayload);
  };

  const handlePurchaseWithBalance = async (
    item: StockItem,
    quantity: number,
    voucher?: VoucherCode | null
  ): Promise<PurchaseOrderResult> => {
    if (!user || !userProfile) {
      throw new Error('Please sign in first to buy with wallet balance.');
    }
    return await purchaseStockWithBalance(
      item,
      quantity,
      userProfile,
      voucher
    );
  };

  const handleUpdateInquiryStatus = async (
    inquiryId: string,
    nextStatus: InquiryStatus
  ) => {
    await updateInquiryStatus(inquiryId, nextStatus);
  };

  const handleSaveReview = async (input: ReviewInput, existingId?: string) => {
    if (!user) return;
    if (existingId && !existingId.startsWith('preview-')) {
      await updateReview(existingId, input);
    } else {
      await createReview(input, user.uid);
    }
  };

  const handleSaveSocialLink = async (
    input: SocialLinkInput,
    existingId?: string
  ) => {
    if (!user) return;
    if (existingId && !existingId.startsWith('preview-')) {
      await updateSocialLink(existingId, input);
    } else {
      await createSocialLink(input, user.uid);
    }
  };

  const handleSeedTemplates = async () => {
    if (!user) return;
    await seedStarterCatalog(user.uid, {
      seedStocks: true,
      seedLinks: rawSocialLinks.length === 0,
      seedReviews: rawReviews.length === 0,
      existingStockCodes: rawStocks.map((s) => s.code),
      settings,
    });
  };

  const handleClearAllStocks = async () => {
    await resetAllStocks(rawStocks.map((s) => s.id));
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#090A0F] text-[#F3F4F6] flex flex-col pb-16 md:pb-0">
      <Header
        settings={settings}
        showAnnouncement={showAnnouncement}
        onDismissAnnouncement={() => setShowAnnouncement(false)}
        activeCategory={activeCategory}
        onSelectCategory={handleSelectCategory}
        onOpenOwnerStudio={() => {
          setPrefillReviewLabel('');
          setStudioTab('stocks');
          setStudioOpen(true);
        }}
        onOpenAuth={() => {
          setAuthModalTab('overview');
          setAuthModalOpen(true);
        }}
        onOpenOrders={() => {
          setAuthModalTab('orders');
          setAuthModalOpen(true);
        }}
        onOpenTopUp={() => setTopUpModalOpen(true)}
        user={user}
        profile={userProfile}
        orderCount={userOrderCount}
        isAdmin={isAdmin}
      />

      <main className="flex-1">
        {/* Catalog Header, Recently Added & Filter Controls */}
        <section
          id="catalog"
          className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-8 space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#3B82F6]">
                {settings.heroKicker}
              </p>
              <h1 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight text-balance">
                {settings.heroTitle}
              </h1>
              <p className="text-sm sm:text-base text-[#9CA3AF] leading-relaxed">
                {settings.heroSubtitle}
              </p>
            </div>

            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenAddStock}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrefillReviewLabel('');
                    setStudioTab('topups');
                    setStudioOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium bg-[#12141C] hover:bg-white/[0.08] border border-white/[0.1] text-[#E5E7EB] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Wallet className="w-4 h-4 text-[#60A5FA]" />
                  <span>
                    Top-Ups
                    {pendingTopUpCount > 0 ? ` (${pendingTopUpCount})` : ''}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrefillReviewLabel('');
                    setStudioTab('orders');
                    setStudioOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium bg-[#12141C] hover:bg-white/[0.08] border border-white/[0.1] text-[#E5E7EB] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4 text-[#60A5FA]" />
                  <span>
                    Orders
                    {processingOrderCount > 0
                      ? ` (${processingOrderCount})`
                      : ''}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrefillReviewLabel('');
                    setStudioTab('inquiries');
                    setStudioOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium bg-[#12141C] hover:bg-white/[0.08] border border-white/[0.1] text-[#E5E7EB] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Inbox className="w-4 h-4 text-[#60A5FA]" />
                  <span>
                    Inquiries{newInquiryCount > 0 ? ` (${newInquiryCount})` : ''}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrefillReviewLabel('');
                    setStudioTab('stocks');
                    setStudioOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium bg-[#12141C] hover:bg-white/[0.08] border border-white/[0.1] text-[#E5E7EB] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Settings2 className="w-4 h-4" />
                  <span>Admin Dashboard</span>
                </button>
              </div>
            )}
          </div>

          {/* Recently Added Showcase Strip */}
          {!loadingCatalog && recentlyAddedStocks.length > 0 && (
            <div className="pt-2 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span>Recently Added Stocks</span>
                </p>
                <span className="text-[11px] text-[#6B7280] hidden sm:inline">
                  Click any new drop to inspect photos &amp; details
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {recentlyAddedStocks.map((item) => (
                  <button
                    key={`recent-${item.id}`}
                    type="button"
                    onClick={() => setSelectedStockId(item.id)}
                    className="h-full p-3 rounded-xl bg-[#12141C] border border-white/[0.08] hover:border-[#3B82F6]/50 flex items-center gap-3 text-left transition-colors cursor-pointer"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-16 h-12 rounded-lg object-cover bg-[#0C0E14] shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-mono-tabular text-[#60A5FA] font-semibold truncate">
                          {item.code}
                        </span>
                        <span
                          className={`font-semibold shrink-0 ${getStatusToneClass(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-white truncate mt-0.5">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-[#9CA3AF] font-mono-tabular mt-0.5">
                        {item.priceLabel} ·{' '}
                        {item.category === 'CODM ACCOUNT'
                          ? `${item.accountGroup} (1/1)`
                          : `${item.stockCount} stocks`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Primary Category Filter, Stock Status Filter, Search & Sort Row */}
          <div className="pt-2 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="grid grid-cols-2 sm:inline-flex sm:flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#12141C] border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => handleSelectCategory('ALL')}
                  className={`h-9 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer text-center ${
                    activeCategory === 'ALL'
                      ? 'bg-[#2563EB] text-white'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  All ({counts.all})
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectCategory('CODM ACCOUNT')}
                  className={`h-9 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer text-center ${
                    activeCategory === 'CODM ACCOUNT'
                      ? 'bg-[#2563EB] text-white'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  CODM ACCOUNT ({counts.codmAll})
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectCategory('CODM&MLBB FILES')}
                  className={`h-9 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer text-center ${
                    activeCategory === 'CODM&MLBB FILES'
                      ? 'bg-[#2563EB] text-white'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  FILES ({counts.filesAll})
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectCategory('SOLD')}
                  className={`h-9 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    activeCategory === 'SOLD'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  <Archive className="w-3.5 h-3.5 shrink-0" />
                  <span>Sold ({counts.sold})</span>
                </button>
              </div>

              <div className="flex items-center gap-2 flex-1 lg:max-w-md">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search title, code, clean, hits..."
                    className="w-full h-10 pl-10 pr-3 rounded-xl bg-[#12141C] border border-white/[0.08] text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div className="relative shrink-0">
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    aria-label="Sort products"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="h-10 pl-8 pr-3 rounded-xl bg-[#12141C] border border-white/[0.08] text-xs font-semibold text-white focus:outline-none focus:border-[#3B82F6] cursor-pointer"
                  >
                    <option value="featured">Sort: Featured</option>
                    <option value="newest">Sort: Newest</option>
                    <option value="price-asc">Price: Low–High</option>
                    <option value="price-desc">Price: High–Low</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Stock Status Filter Bar (In Stock · Low Stock · Restocking Soon · Out of Stock) */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="text-xs font-medium text-[#6B7280] mr-1">
                Stock Status:
              </span>
              {(
                [
                  { id: 'ALL', label: 'All Statuses', tone: 'text-white' },
                  {
                    id: 'IN_STOCK',
                    label: `In Stock (${counts.inStockCount})`,
                    tone: 'text-emerald-300',
                  },
                  {
                    id: 'LOW_STOCK',
                    label: `Low Stock (${counts.lowStockCount})`,
                    tone: 'text-amber-300',
                  },
                  {
                    id: 'RESTOCKING',
                    label: `Restocking Soon (${counts.restockingCount})`,
                    tone: 'text-sky-300',
                  },
                  {
                    id: 'OUT_OF_STOCK',
                    label: `Out of Stock (${counts.sold})`,
                    tone: 'text-[#9CA3AF]',
                  },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                    statusFilter === st.id
                      ? `bg-white/[0.1] border-white/20 ${st.tone}`
                      : 'bg-[#12141C] border-white/[0.07] text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {activeCategory === 'CODM ACCOUNT' && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-medium text-[#6B7280] mr-1">
                  Account Group (One-Time Buy):
                </span>
                <button
                  type="button"
                  onClick={() => setAccountGroupFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                    accountGroupFilter === 'ALL'
                      ? 'bg-white/[0.1] border-white/20 text-white'
                      : 'bg-[#12141C] border-white/[0.07] text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  All Accounts ({counts.codmAll})
                </button>
                <button
                  type="button"
                  onClick={() => setAccountGroupFilter('Clean')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                    accountGroupFilter === 'Clean'
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                      : 'bg-[#12141C] border-white/[0.07] text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Clean ({counts.codmClean})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAccountGroupFilter('Not Clean')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                    accountGroupFilter === 'Not Clean'
                      ? 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                      : 'bg-[#12141C] border-white/[0.07] text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Not Clean ({counts.codmNotClean})</span>
                </button>
              </div>
            )}

            {activeCategory === 'CODM&MLBB FILES' && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-medium text-[#6B7280] mr-1">
                  File Packs (Stock-Based):
                </span>
                {(
                  [
                    { id: 'ALL', label: 'All Files' },
                    { id: 'CODM', label: 'CODM Files' },
                    { id: 'MLBB', label: 'MLBB Upass Combo' },
                  ] as const
                ).map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setFileSubFilter(sub.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                      fileSubFilter === sub.id
                        ? 'bg-[#2563EB]/20 border-[#3B82F6]/60 text-[#93C5FD]'
                        : 'bg-[#12141C] border-white/[0.07] text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Stocks Grid */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
          {loadingCatalog ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[0, 1, 2].map((n) => (
                <div
                  key={n}
                  className="bg-[#12141C] border border-white/[0.06] rounded-xl overflow-hidden animate-pulse"
                >
                  <div className="aspect-[4/3] bg-[#181B26]" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 w-1/2 bg-[#1F2330] rounded" />
                    <div className="h-5 w-3/4 bg-[#1F2330] rounded" />
                    <div className="h-4 w-full bg-[#1F2330] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredStocks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStocks.map((item) => (
                <StockCard
                  key={item.id}
                  item={item}
                  isAdmin={isAdmin}
                  onSelect={(item) => setSelectedStockId(item.id)}
                  onEdit={handleOpenEditStock}
                  onQuickUpdate={handleQuickUpdate}
                  onMarkSold={handleMarkSold}
                  onRestoreAvailable={handleRestoreAvailable}
                  onDelete={handleDeleteStock}
                />
              ))}
            </div>
          ) : (
            <div className="p-10 rounded-xl bg-[#12141C] border border-white/[0.08] text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-white/[0.04] text-[#60A5FA] flex items-center justify-center mx-auto">
                <Layers className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h2 className="font-display font-bold text-lg text-white">
                  {activeCategory === 'SOLD' || statusFilter === 'OUT_OF_STOCK'
                    ? 'No sold or out-of-stock items'
                    : activeCategory === 'CODM ACCOUNT' && counts.codmAll === 0
                    ? 'No CODM accounts listed right now'
                    : 'No matching stocks found'}
                </h2>
                <p className="text-sm text-[#9CA3AF]">
                  {activeCategory === 'SOLD' || statusFilter === 'OUT_OF_STOCK'
                    ? 'Items marked as Sold or Out of Stock automatically move here.'
                    : activeCategory === 'CODM ACCOUNT' && counts.codmAll === 0
                    ? 'No CODM accounts are listed at the moment. Send an inquiry or message Facebook / Telegram for upcoming drops.'
                    : 'Try clearing your search or switching category/status filters.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveCategory('ALL');
                    setStatusFilter('ALL');
                    setAccountGroupFilter('ALL');
                    setFileSubFilter('ALL');
                    setSearchQuery('');
                    setSortBy('featured');
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.12] text-white transition-colors cursor-pointer"
                >
                  Reset Filters
                </button>
                {isAdmin && activeCategory !== 'SOLD' && (
                  <button
                    type="button"
                    onClick={handleOpenAddStock}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Product</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Animated Video Tutorial, Beginner Step-by-Step Guide & FAQ Center */}
        <HelpCenterSection
          socialLinks={socialLinks}
          settings={settings}
          user={user}
          onJumpToCatalog={() => scrollTo('catalog')}
          onJumpToContact={() => scrollTo('contact')}
          onOpenTopUp={() => setTopUpModalOpen(true)}
          onOpenAuth={() => {
            setAuthModalTab('overview');
            setAuthModalOpen(true);
          }}
        />

        {/* Buyer Reviews & Vouches Section */}
        <ReviewsSection
          reviews={reviews}
          isAdmin={isAdmin}
          onAddReview={() => {
            setEditingReview(null);
            setPrefillReviewLabel('');
            setStudioTab('reviews');
            setStudioOpen(true);
          }}
          onEditReview={(review) => {
            setPrefillReviewLabel('');
            setEditingReview(review);
            setStudioTab('reviews');
            setStudioOpen(true);
          }}
          onDeleteReview={removeReview}
        />

        {/* Contact Support, QR Codes & Direct Inquiry Section */}
        <ContactSection
          settings={settings}
          socialLinks={socialLinks}
          stocks={stocks}
          isAdmin={isAdmin}
          onManageLinks={() => {
            setPrefillReviewLabel('');
            setStudioTab('social');
            setStudioOpen(true);
          }}
          onSubmitInquiry={handleSubmitInquiry}
        />
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-white/[0.08] bg-[#07080C]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p
              onClick={handleFooterSecretTap}
              className="font-display font-bold text-sm text-white select-none"
            >
              {settings.storeName}
              {settings.accentWord && (
                <span className="text-[#3B82F6] ml-1">{settings.accentWord}</span>
              )}
            </p>
            <p className="text-xs text-[#6B7280]">
              Live stock showcase · Direct contact via Facebook, Messenger &amp; Telegram
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs text-[#9CA3AF]">
            <button
              type="button"
              onClick={() => handleSelectCategory('CODM ACCOUNT')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              CODM Accounts
            </button>
            <button
              type="button"
              onClick={() => handleSelectCategory('CODM&MLBB FILES')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              CODM&amp;MLBB Files
            </button>
            <a href="#tutorials" className="hover:text-white transition-colors">
              Tutorials &amp; FAQ
            </a>
            <a href="#reviews" className="hover:text-white transition-colors">
              Reviews
            </a>
            <a href="#contact" className="hover:text-white transition-colors">
              Contact Support
            </a>
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setPrefillReviewLabel('');
                  setStudioTab('stocks');
                  setStudioOpen(true);
                }}
                className="text-[#60A5FA] hover:text-white transition-colors cursor-pointer"
              >
                Admin Dashboard
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Owner Sold Toast (quick Undo or Add Buyer Review) */}
      {isAdmin && soldToast && (
        <div className="fixed bottom-16 md:bottom-5 right-4 z-50 max-w-sm bg-[#12141C] border border-white/15 rounded-xl p-4 shadow-xl space-y-2.5">
          <p className="text-xs text-white font-semibold">
            Marked Unavailable: <span className="text-[#60A5FA]">{soldToast.item.code}</span>
          </p>
          <p className="text-xs text-[#9CA3AF]">
            Removed from active categories and moved to Sold / Out of Stock.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setPrefillReviewLabel(soldToast.item.title);
                setStudioTab('reviews');
                setStudioOpen(true);
                setSoldToast(null);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white cursor-pointer"
            >
              + Add Buyer Review
            </button>
            <button
              type="button"
              onClick={async () => {
                await updateStockStatusAndCount(
                  soldToast.item.id,
                  soldToast.prevStatus,
                  soldToast.prevCount
                );
                setSoldToast(null);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-[#E5E7EB] cursor-pointer"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => setSoldToast(null)}
              className="ml-auto text-xs text-[#6B7280] hover:text-white cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 h-14 bg-[#090A0F]/95 backdrop-blur-md border-t border-white/[0.08] grid grid-cols-5"
      >
        <button
          type="button"
          onClick={() => {
            handleSelectCategory('ALL');
            scrollTo('catalog');
          }}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            activeCategory === 'ALL' ? 'text-[#60A5FA]' : 'text-[#9CA3AF]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Stocks</span>
        </button>
        <button
          type="button"
          onClick={() => setTopUpModalOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-[#9CA3AF]"
        >
          <Plus className="w-4 h-4 text-[#60A5FA]" />
          <span>Top Up</span>
        </button>
        <a
          href="#tutorials"
          className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-[#9CA3AF]"
        >
          <HelpCircle className="w-4 h-4" />
          <span>Tutorials</span>
        </a>
        <a
          href="#contact"
          className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-[#9CA3AF]"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Support</span>
        </a>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => {
              setPrefillReviewLabel('');
              setStudioTab('stocks');
              setStudioOpen(true);
            }}
            className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-[#60A5FA]"
          >
            <Settings2 className="w-4 h-4" />
            <span>Admin</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAuthModalTab('overview');
              setAuthModalOpen(true);
            }}
            className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-[#9CA3AF]"
          >
            {user ? (
              <Wallet className="w-4 h-4 text-[#60A5FA]" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            <span>{user ? 'Wallet' : 'Login'}</span>
          </button>
        )}
      </nav>

      {/* Modals */}
      <StockDetailModal
        item={selectedStock}
        socialLinks={socialLinks}
        settings={settings}
        user={user}
        profile={userProfile}
        isAdmin={isAdmin}
        onClose={() => setSelectedStockId(null)}
        onEdit={handleOpenEditStock}
        onMarkSold={handleMarkSold}
        onRestoreAvailable={handleRestoreAvailable}
        onSubmitInquiry={handleSubmitInquiry}
        onPurchaseWithBalance={handlePurchaseWithBalance}
        onLookupVoucher={lookupVoucher}
        onOpenAuth={() => {
          setAuthModalTab('overview');
          setAuthModalOpen(true);
        }}
        onOpenTopUp={() => setTopUpModalOpen(true)}
        onOpenOrders={() => {
          setAuthModalTab('orders');
          setAuthModalOpen(true);
        }}
      />

      <StockEditorModal
        isOpen={editorOpen}
        editingStock={editingStock}
        initialDraft={duplicateDraft}
        onClose={() => {
          setEditorOpen(false);
          setEditingStock(null);
          setDuplicateDraft(null);
        }}
        onSave={handleSaveStock}
      />

      <AccountAuthModal
        isOpen={authModalOpen}
        user={user}
        profile={userProfile}
        isAdmin={isAdmin}
        initialTab={authModalTab}
        topUpRequests={
          user ? rawTopUps.filter((r) => r.userId === user.uid) : []
        }
        orders={user ? rawOrders.filter((o) => o.userId === user.uid) : []}
        onClose={() => setAuthModalOpen(false)}
        onSignInGoogle={async () => {
          await signInWithGoogle();
        }}
        onSignInUsername={async (uname, pwd) => {
          await signInWithUsernamePassword(uname, pwd);
        }}
        onRegisterUsername={async (uname, pwd, email) => {
          await registerWithUsernamePassword(uname, pwd, email);
        }}
        onSignOut={signOutOwner}
        onUpdateDisplayName={async (nextName) => {
          if (user) await updateUserDisplayName(user.uid, nextName);
        }}
        onUpdateContactEmail={async (nextEmail) => {
          if (user) await updateUserContactEmail(user.uid, nextEmail);
        }}
        onOpenTopUp={() => setTopUpModalOpen(true)}
        onOpenOwnerStudio={() => {
          setStudioTab('stocks');
          setStudioOpen(true);
        }}
      />

      <TopUpModal
        isOpen={topUpModalOpen}
        user={user}
        profile={userProfile}
        settings={settings}
        onClose={() => setTopUpModalOpen(false)}
        onSignInGoogle={async () => {
          await signInWithGoogle();
        }}
        onSignInUsername={async (uname, pwd) => {
          await signInWithUsernamePassword(uname, pwd);
        }}
        onRegisterUsername={async (uname, pwd, email) => {
          await registerWithUsernamePassword(uname, pwd, email);
        }}
        onSubmitTopUp={handleSubmitTopUp}
        onViewTopUps={() => {
          setAuthModalTab('topups');
          setAuthModalOpen(true);
        }}
      />

      <OwnerStudioModal
        isOpen={studioOpen}
        initialTab={studioTab}
        prefillReviewItemLabel={prefillReviewLabel}
        initialEditingReview={editingReview}
        user={user}
        isAdmin={isAdmin}
        stocks={stocks}
        topUpRequests={rawTopUps}
        orders={rawOrders}
        vouchers={rawVouchers}
        userProfiles={rawUserProfiles}
        inquiries={rawInquiries}
        reviews={reviews}
        socialLinks={socialLinks}
        settings={settings}
        onClose={() => {
          setStudioOpen(false);
          setEditingReview(null);
        }}
        onSignIn={async () => {
          await signInWithGoogle();
        }}
        onSignOut={signOutOwner}
        onAddNewStock={handleOpenAddStock}
        onEditStock={handleOpenEditStock}
        onDuplicateStock={(draft) => {
          setEditingStock(null);
          setDuplicateDraft(draft);
          setEditorOpen(true);
        }}
        onQuickUpdate={handleQuickUpdate}
        onMarkSold={handleMarkSold}
        onRestoreAvailable={handleRestoreAvailable}
        onDeleteStock={handleDeleteStock}
        onApproveTopUp={async (req) => {
          if (user) await approveTopUpRequest(req, user.uid);
        }}
        onRejectTopUp={async (requestId, reason) => {
          if (user) await rejectTopUpRequest(requestId, user.uid, reason);
        }}
        onUpdateOrderDelivery={async (
          orderId: string,
          status: OrderDeliveryStatus,
          note: string
        ) => {
          await updateOrderDelivery(orderId, status, note);
        }}
        onCreateVoucher={async (input: VoucherInput) => {
          if (!user) throw new Error('Owner sign-in required.');
          return await createVoucher(input, user.uid);
        }}
        onToggleVoucherActive={async (code: string, nextActive: boolean) => {
          await updateVoucher(code, { active: nextActive });
        }}
        onDeleteVoucher={async (code: string) => {
          await deleteVoucher(code);
        }}
        onUpdateInquiryStatus={handleUpdateInquiryStatus}
        onDeleteInquiry={removeInquiry}
        onSaveReview={handleSaveReview}
        onDeleteReview={removeReview}
        onSaveSocialLink={handleSaveSocialLink}
        onDeleteSocialLink={removeSocialLink}
        onSaveSettings={async (next) => {
          if (user) await saveStoreSettings(next, user.uid);
        }}
        onSeedTemplates={handleSeedTemplates}
        onClearAllStocks={handleClearAllStocks}
        duplicateCount={duplicateStockCount}
        onRemoveDuplicates={() => removeDuplicateStocks(rawStocks)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StorefrontApp />
    </ErrorBoundary>
  );
}
