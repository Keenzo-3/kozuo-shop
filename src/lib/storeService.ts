import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  BLUEPRINT_LIMITS,
  computeVoucherDiscount,
  deriveAutoStockStatus,
  extractUsernameFromEmail,
  isRestockingStatus,
  isSoldStatus,
  isVoucherCurrentlyValid,
  normalizeVoucherCode,
  parsePricePhp,
  type CustomerInquiryInput,
  type DeliveryVaultInput,
  type DeliveryVaultItem,
  type InquiryStatus,
  type OrderDeliveryStatus,
  type ReviewInput,
  type SocialLinkInput,
  type StockFormInput,
  type StockItem,
  type StoreSettings,
  type TopUpRequest,
  type TopUpRequestInput,
  type UserProfile,
  type VoucherCode,
  type VoucherInput,
} from '../types/store';
import {
  STARTER_REVIEW_TEMPLATES,
  STARTER_SOCIAL_LINKS,
  STARTER_STOCK_TEMPLATES,
} from './defaultData';
import {
  db,
  handleFirestoreError,
  isOfflineFirestoreError,
  OperationType,
} from './firebase';

function makeSafeId(prefix: string): string {
  const raw = `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  return raw.replace(/[^a-zA-Z0-9_-]/g, '');
}

function makeShortCode(prefix: string): string {
  const num = Math.floor(1000 + Math.random() * 8999);
  return `${prefix}-${num}`;
}

function clampStr(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function sanitizeStockPayload(input: StockFormInput) {
  const category = input.category;
  const accountGroup =
    category === 'CODM ACCOUNT'
      ? input.accountGroup === 'Not Clean'
        ? 'Not Clean'
        : 'Clean'
      : 'N/A';
  const fileType =
    category === 'CODM&MLBB FILES'
      ? clampStr(
          input.fileType || 'CODM & MLBB Files',
          BLUEPRINT_LIMITS.STOCK.FILE_TYPE_MAX
        )
      : '';
  const rawStatus =
    clampStr(input.status, BLUEPRINT_LIMITS.STOCK.STATUS_MAX) || 'In Stock';

  // CODM ACCOUNT is always one-time buy (1 account if not sold/restocking, 0 if sold/out of stock)
  const stockCount =
    category === 'CODM ACCOUNT'
      ? isSoldStatus(rawStatus) || isRestockingStatus(rawStatus)
        ? 0
        : 1
      : isSoldStatus(rawStatus) || isRestockingStatus(rawStatus)
      ? 0
      : Math.max(0, Math.min(99999, Math.round(Number(input.stockCount) || 0)));

  const status = deriveAutoStockStatus(category, rawStatus, stockCount);

  const parsedPrice =
    Number(input.pricePhp) > 0
      ? Number(input.pricePhp)
      : parsePricePhp(input.priceLabel);
  const pricePhp = Math.max(
    0,
    Math.min(1000000, Math.round(parsedPrice * 100) / 100)
  );

  const specifications = (input.specifications || [])
    .map((spec) => ({
      label: clampStr(spec.label, BLUEPRINT_LIMITS.STOCK.SPEC_LABEL_MAX),
      value: clampStr(spec.value, BLUEPRINT_LIMITS.STOCK.SPEC_VALUE_MAX),
    }))
    .filter((spec) => spec.label.length > 0 && spec.value.length > 0)
    .slice(0, BLUEPRINT_LIMITS.STOCK.SPECS_MAX_COUNT);

  const highlights = input.highlights
    .map((h) => clampStr(h, BLUEPRINT_LIMITS.STOCK.HIGHLIGHT_ITEM_MAX))
    .filter(Boolean)
    .slice(0, BLUEPRINT_LIMITS.STOCK.HIGHLIGHTS_MAX_COUNT);

  const rawGallery = (input.galleryImages || [])
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url) => url.slice(0, BLUEPRINT_LIMITS.STOCK.IMAGE_URL_MAX));

  const primaryImg = (input.imageUrl || rawGallery[0] || '').slice(
    0,
    BLUEPRINT_LIMITS.STOCK.IMAGE_URL_MAX
  );

  const dedupedGallery: string[] = [];
  if (primaryImg) dedupedGallery.push(primaryImg);
  for (const img of rawGallery) {
    if (
      !dedupedGallery.includes(img) &&
      dedupedGallery.length < BLUEPRINT_LIMITS.STOCK.GALLERY_MAX_COUNT
    ) {
      dedupedGallery.push(img);
    }
  }

  return {
    title:
      clampStr(input.title, BLUEPRINT_LIMITS.STOCK.TITLE_MAX) ||
      'Untitled Stock',
    code:
      clampStr(input.code, BLUEPRINT_LIMITS.STOCK.CODE_MAX) ||
      `STK-${Math.floor(100 + Math.random() * 900)}`,
    category,
    accountGroup,
    fileType,
    priceLabel:
      clampStr(input.priceLabel, BLUEPRINT_LIMITS.STOCK.PRICE_LABEL_MAX) ||
      (pricePhp > 0 ? `₱${pricePhp}` : 'PM for Price'),
    pricePhp,
    status,
    stockCount,
    bindSummary: clampStr(
      input.bindSummary,
      BLUEPRINT_LIMITS.STOCK.BIND_SUMMARY_MAX
    ),
    description: clampStr(
      input.description,
      BLUEPRINT_LIMITS.STOCK.DESCRIPTION_MAX
    ),
    specifications,
    highlights,
    imageUrl: primaryImg,
    galleryImages: dedupedGallery,
    featured: Boolean(input.featured),
    autoDelivery: Boolean(input.autoDelivery),
  };
}

export async function createStock(
  input: StockFormInput,
  ownerId: string,
  deliveryVaultInput?: DeliveryVaultInput
): Promise<string> {
  const id = makeSafeId('stk');
  const path = `stocks/${id}`;
  const sanitized = sanitizeStockPayload(input);
  const unitCount = Math.min(
    BLUEPRINT_LIMITS.DELIVERY.MAX_UNITS,
    sanitized.stockCount
  );

  const rawItems = (deliveryVaultInput?.items || [])
    .slice(0, unitCount)
    .map((item) => clampStr(item, BLUEPRINT_LIMITS.DELIVERY.PAYLOAD_MAX));
  const filledItems = rawItems.filter((item) => item.trim().length > 0);

  if (unitCount > 0 && filledItems.length < unitCount) {
    throw new Error(
      `Please fill in all ${unitCount} delivery item field(s) (login:pass or download link) before saving.`
    );
  }

  const hasAuto = unitCount > 0 && filledItems.length === unitCount;
  const payload = {
    ...sanitized,
    stockCount: unitCount,
    autoDelivery: hasAuto,
    nextDeliveryIndex: 0,
    ownerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'stocks', id), payload);
    if (hasAuto && deliveryVaultInput) {
      const dtype =
        deliveryVaultInput.deliveryType === 'credentials'
          ? 'credentials'
          : 'link';
      const cleanInstr = clampStr(
        deliveryVaultInput.instructions,
        BLUEPRINT_LIMITS.DELIVERY.INSTRUCTIONS_MAX
      );
      for (let i = 0; i < unitCount; i += 1) {
        const vaultId = `${id}__${i}`;
        batch.set(doc(db, 'deliveryVault', vaultId), {
          stockId: id,
          unitIndex: i,
          deliveryType: dtype,
          payload: rawItems[i],
          instructions: cleanInstr,
          ownerId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateStock(
  stockId: string,
  input: StockFormInput,
  ownerId?: string,
  deliveryVaultInput?: DeliveryVaultInput,
  currentNextDeliveryIndex = 0
): Promise<void> {
  const path = `stocks/${stockId}`;
  const sanitized = sanitizeStockPayload(input);
  const unitCount = Math.min(
    BLUEPRINT_LIMITS.DELIVERY.MAX_UNITS,
    sanitized.stockCount
  );
  const baseIndex = Math.max(0, Math.round(currentNextDeliveryIndex || 0));

  const rawItems = (deliveryVaultInput?.items || [])
    .slice(0, unitCount)
    .map((item) => clampStr(item, BLUEPRINT_LIMITS.DELIVERY.PAYLOAD_MAX));
  const filledItems = rawItems.filter((item) => item.trim().length > 0);

  if (deliveryVaultInput !== undefined && unitCount > 0 && filledItems.length < unitCount) {
    throw new Error(
      `Please fill in all ${unitCount} delivery item field(s) (login:pass or download link) before saving.`
    );
  }

  const hasAuto =
    deliveryVaultInput !== undefined
      ? unitCount > 0 && filledItems.length === unitCount
      : Boolean(input.autoDelivery);

  const payload = {
    ...sanitized,
    stockCount: unitCount,
    autoDelivery: hasAuto,
    nextDeliveryIndex: baseIndex,
    updatedAt: serverTimestamp(),
  };

  try {
    if (deliveryVaultInput !== undefined && ownerId) {
      const existingSnap = await getDocs(
        query(collection(db, 'deliveryVault'), where('stockId', '==', stockId))
      );
      const existingById = new Map(
        existingSnap.docs.map((d) => [d.id, d.data()])
      );

      const batch = writeBatch(db);
      batch.update(doc(db, 'stocks', stockId), payload);

      if (hasAuto) {
        const cleanInstr = clampStr(
          deliveryVaultInput.instructions,
          BLUEPRINT_LIMITS.DELIVERY.INSTRUCTIONS_MAX
        );
        const dtype =
          deliveryVaultInput.deliveryType === 'credentials'
            ? 'credentials'
            : 'link';

        for (let i = 0; i < unitCount; i += 1) {
          const unitIdx = baseIndex + i;
          const vaultId = `${stockId}__${unitIdx}`;
          const vaultRef = doc(db, 'deliveryVault', vaultId);
          if (existingById.has(vaultId)) {
            batch.update(vaultRef, {
              unitIndex: unitIdx,
              deliveryType: dtype,
              payload: rawItems[i],
              instructions: cleanInstr,
              updatedAt: serverTimestamp(),
            });
          } else {
            batch.set(vaultRef, {
              stockId,
              unitIndex: unitIdx,
              deliveryType: dtype,
              payload: rawItems[i],
              instructions: cleanInstr,
              ownerId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }
      }

      // Clean up unused future slots beyond baseIndex + unitCount
      existingSnap.docs.forEach((d) => {
        const data = d.data();
        if (typeof data.unitIndex === 'number') {
          if (data.unitIndex >= baseIndex + unitCount) {
            batch.delete(d.ref);
          }
        } else if (d.id === stockId && baseIndex === 0 && hasAuto) {
          batch.delete(d.ref);
        }
      });

      await batch.commit();
    } else {
      await updateDoc(doc(db, 'stocks', stockId), payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function getDeliveryVaultForStock(
  vaultId: string
): Promise<DeliveryVaultItem | null> {
  if (!vaultId || vaultId.startsWith('preview-')) return null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const snap = await getDoc(doc(db, 'deliveryVault', vaultId));
      if (!snap.exists()) return null;
      const data = snap.data();
      return {
        stockId: String(data.stockId ?? vaultId),
        unitIndex:
          typeof data.unitIndex === 'number' ? data.unitIndex : undefined,
        deliveryType:
          data.deliveryType === 'credentials' ? 'credentials' : 'link',
        payload: String(data.payload ?? ''),
        instructions: String(data.instructions ?? ''),
        ownerId: String(data.ownerId ?? ''),
        createdAt: data.createdAt ?? null,
        updatedAt: data.updatedAt ?? null,
      };
    } catch {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }
      return null;
    }
  }
  return null;
}

export async function getDeliveryVaultUnitsForAdmin(
  stockId: string,
  nextDeliveryIndex = 0,
  stockCount = 1
): Promise<{
  deliveryType: 'link' | 'credentials';
  instructions: string;
  items: string[];
}> {
  if (!stockId || stockId.startsWith('preview-')) {
    return { deliveryType: 'credentials', instructions: '', items: [] };
  }
  try {
    const snap = await getDocs(
      query(collection(db, 'deliveryVault'), where('stockId', '==', stockId))
    );
    if (snap.empty) {
      return { deliveryType: 'credentials', instructions: '', items: [] };
    }
    const unitMap = new Map<number, string>();
    let legacyPayload = '';
    let deliveryType: 'link' | 'credentials' = 'credentials';
    let instructions = '';

    snap.docs.forEach((d) => {
      const data = d.data();
      deliveryType =
        data.deliveryType === 'link' ? 'link' : 'credentials';
      if (data.instructions && !instructions) {
        instructions = String(data.instructions);
      }
      if (typeof data.unitIndex === 'number') {
        unitMap.set(data.unitIndex, String(data.payload ?? ''));
      } else if (data.payload) {
        legacyPayload = String(data.payload);
      }
    });

    const items: string[] = [];
    const total = Math.max(0, stockCount);
    for (let i = 0; i < total; i += 1) {
      const idx = nextDeliveryIndex + i;
      const val = unitMap.get(idx);
      if (val !== undefined) {
        items.push(val);
      } else if (i === 0 && legacyPayload) {
        items.push(legacyPayload);
      } else {
        items.push('');
      }
    }
    return { deliveryType, instructions, items };
  } catch {
    return { deliveryType: 'credentials', instructions: '', items: [] };
  }
}

export async function getDeliveryVaultUnitsForOrder(ord: {
  stockId: string;
  quantity: number;
  startUnitIndex?: number;
}): Promise<DeliveryVaultItem[]> {
  if (!ord.stockId || ord.stockId.startsWith('preview-')) return [];
  if (typeof ord.startUnitIndex === 'number') {
    const count = Math.max(1, Math.min(100, ord.quantity));
    const promises: Promise<DeliveryVaultItem | null>[] = [];
    for (let i = 0; i < count; i += 1) {
      promises.push(
        getDeliveryVaultForStock(`${ord.stockId}__${ord.startUnitIndex + i}`)
      );
    }
    const results = await Promise.all(promises);
    const valid = results.filter((x): x is DeliveryVaultItem => Boolean(x));
    if (valid.length > 0) return valid;
  }
  const single = await getDeliveryVaultForStock(ord.stockId);
  return single ? [single] : [];
}

export async function updateStockStatusAndCount(
  stockId: string,
  status: string,
  stockCount: number
): Promise<void> {
  const path = `stocks/${stockId}`;
  try {
    await updateDoc(doc(db, 'stocks', stockId), {
      status: clampStr(status, BLUEPRINT_LIMITS.STOCK.STATUS_MAX) || 'In Stock',
      stockCount: Math.max(
        0,
        Math.min(BLUEPRINT_LIMITS.DELIVERY.MAX_UNITS, Math.round(stockCount))
      ),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function backfillMissingStockPrices(
  stocks: StockItem[]
): Promise<void> {
  const missing = stocks.filter(
    (s) =>
      !s.id.startsWith('preview-') &&
      !s.hasPersistedPricePhp &&
      parsePricePhp(s.priceLabel) > 0
  );
  if (missing.length === 0) return;
  const batch = writeBatch(db);
  missing.forEach((s) => {
    const numeric = parsePricePhp(s.priceLabel);
    batch.update(doc(db, 'stocks', s.id), {
      pricePhp: numeric,
      updatedAt: serverTimestamp(),
    });
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'stocks/backfillPrices');
  }
}

export async function removeStock(stockId: string): Promise<void> {
  const path = `stocks/${stockId}`;
  try {
    const vaultSnap = await getDocs(
      query(collection(db, 'deliveryVault'), where('stockId', '==', stockId))
    ).catch(() => null);
    const legacySnap = await getDoc(doc(db, 'deliveryVault', stockId)).catch(
      () => null
    );
    const batch = writeBatch(db);
    batch.delete(doc(db, 'stocks', stockId));
    vaultSnap?.docs.forEach((d) => batch.delete(d.ref));
    if (legacySnap?.exists()) {
      batch.delete(legacySnap.ref);
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function removeDuplicateStocks(
  stocks: StockItem[]
): Promise<number> {
  const realStocks = stocks.filter((s) => !s.id.startsWith('preview-'));
  const groups = new Map<string, StockItem[]>();
  for (const s of realStocks) {
    const key = `${s.code.trim().toLowerCase()}|${s.title
      .trim()
      .toLowerCase()}|${s.category}`;
    const arr = groups.get(key) || [];
    arr.push(s);
    groups.set(key, arr);
  }

  const idsToDelete: string[] = [];
  for (const [, group] of groups) {
    if (group.length <= 1) continue;
    const sorted = [...group].sort((a, b) => {
      if (Boolean(a.autoDelivery) !== Boolean(b.autoDelivery)) {
        return a.autoDelivery ? -1 : 1;
      }
      const aTime = a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
      const bTime = b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
      return bTime - aTime;
    });
    for (let i = 1; i < sorted.length; i += 1) {
      idsToDelete.push(sorted[i].id);
    }
  }

  if (idsToDelete.length === 0) return 0;

  try {
    const chunkSize = 200;
    for (let i = 0; i < idsToDelete.length; i += chunkSize) {
      const chunk = idsToDelete.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const stockId of chunk) {
        batch.delete(doc(db, 'stocks', stockId));
      }
      await batch.commit();
    }
    return idsToDelete.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'stocks/deduplicate');
  }
}

// ============================================================================
// Customer Login Profile & Wallet Balance
// ============================================================================

export async function ensureUserProfile(user: User): Promise<void> {
  if (!user.uid || !user.email) return;
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const derivedUsername = extractUsernameFromEmail(user.email);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const displayName =
          clampStr(
            user.displayName ||
              derivedUsername ||
              user.email.split('@')[0] ||
              'Member',
            BLUEPRINT_LIMITS.USER.DISPLAY_NAME_MAX
          ) || 'Member';
        await setDoc(ref, {
          uid: user.uid,
          email: clampStr(user.email, BLUEPRINT_LIMITS.USER.EMAIL_MAX),
          ...(derivedUsername ? { username: derivedUsername } : {}),
          displayName,
          role: 'buyer',
          balance: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      return;
    } catch (error) {
      if (isOfflineFirestoreError(error) && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function updateUserDisplayName(
  userId: string,
  displayName: string
): Promise<void> {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      displayName:
        clampStr(displayName, BLUEPRINT_LIMITS.USER.DISPLAY_NAME_MAX) ||
        'Member',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserContactEmail(
  userId: string,
  contactEmail: string
): Promise<void> {
  const clean = clampStr(contactEmail, BLUEPRINT_LIMITS.USER.EMAIL_MAX);
  if (clean && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    throw new Error('Please enter a valid Gmail/email address or leave it blank.');
  }
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      contactEmail: clean,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adjustUserBalance(
  userId: string,
  nextBalance: number
): Promise<void> {
  const path = `users/${userId}`;
  const safeBal = Math.max(
    0,
    Math.min(10000000, Math.round(nextBalance * 100) / 100)
  );
  try {
    await updateDoc(doc(db, 'users', userId), {
      balance: safeBal,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ============================================================================
// Manual GCash Top-Up System (Owner Approval Required)
// ============================================================================

export async function submitTopUpRequest(
  input: TopUpRequestInput,
  profile: Pick<UserProfile, 'uid' | 'email' | 'displayName'>
): Promise<string> {
  const id = makeSafeId('top');
  const requestCode = makeShortCode('TOP');
  const path = `topupRequests/${id}`;
  const safeAmount = Math.max(
    BLUEPRINT_LIMITS.TOPUP.MIN_PHP,
    Math.min(
      BLUEPRINT_LIMITS.TOPUP.MAX_PHP,
      Math.round(Number(input.amountPhp) * 100) / 100
    )
  );

  try {
    await setDoc(doc(db, 'topupRequests', id), {
      requestCode,
      userId: profile.uid,
      userEmail: clampStr(profile.email, BLUEPRINT_LIMITS.USER.EMAIL_MAX),
      userName:
        clampStr(profile.displayName, BLUEPRINT_LIMITS.TOPUP.USER_NAME_MAX) ||
        'Member',
      method: 'GCash',
      amountPhp: safeAmount,
      referenceNo: clampStr(input.referenceNo, BLUEPRINT_LIMITS.TOPUP.REF_NO_MAX),
      proofImageUrl: input.proofImageUrl
        .trim()
        .slice(0, BLUEPRINT_LIMITS.TOPUP.PROOF_IMAGE_MAX),
      status: 'Pending',
      adminNote: '',
      reviewedBy: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return requestCode;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function approveTopUpRequest(
  req: TopUpRequest,
  adminUid: string,
  note = 'Payment verified and credited to PHP wallet.'
): Promise<void> {
  if (req.status !== 'Pending') return;
  const userRef = doc(db, 'users', req.userId);
  const reqRef = doc(db, 'topupRequests', req.id);

  try {
    const userSnap = await getDoc(userRef);
    const currentBalance = userSnap.exists()
      ? Number(userSnap.data().balance ?? 0)
      : 0;
    const nextBalance = Math.round((currentBalance + req.amountPhp) * 100) / 100;

    const batch = writeBatch(db);
    if (userSnap.exists()) {
      batch.update(userRef, {
        balance: nextBalance,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(userRef, {
        uid: req.userId,
        email: clampStr(req.userEmail, BLUEPRINT_LIMITS.USER.EMAIL_MAX),
        displayName:
          clampStr(req.userName, BLUEPRINT_LIMITS.USER.DISPLAY_NAME_MAX) ||
          'Member',
        role: 'buyer',
        balance: req.amountPhp,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.update(reqRef, {
      status: 'Approved',
      adminNote: clampStr(note, BLUEPRINT_LIMITS.TOPUP.ADMIN_NOTE_MAX),
      reviewedBy: adminUid,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `topupRequests/${req.id}`);
  }
}

export async function rejectTopUpRequest(
  requestId: string,
  adminUid: string,
  reason = 'Payment proof could not be verified.'
): Promise<void> {
  const path = `topupRequests/${requestId}`;
  try {
    await updateDoc(doc(db, 'topupRequests', requestId), {
      status: 'Rejected',
      adminNote: clampStr(reason, BLUEPRINT_LIMITS.TOPUP.ADMIN_NOTE_MAX),
      reviewedBy: adminUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ============================================================================
// Promo Voucher Codes (Owner Create / Manage; Buyer Redeem at Checkout)
// ============================================================================

function parseExpiresAtTimestamp(expiresDate?: string): {
  hasExpiry: boolean;
  expiresAt: Timestamp;
} {
  const trimmed = (expiresDate || '').trim();
  if (!trimmed) {
    return {
      hasExpiry: false,
      expiresAt: Timestamp.fromDate(new Date('2099-12-31T23:59:59Z')),
    };
  }
  const parsed = new Date(`${trimmed}T23:59:59`);
  if (Number.isNaN(parsed.getTime())) {
    return {
      hasExpiry: false,
      expiresAt: Timestamp.fromDate(new Date('2099-12-31T23:59:59Z')),
    };
  }
  return {
    hasExpiry: true,
    expiresAt: Timestamp.fromDate(parsed),
  };
}

export async function createVoucher(
  input: VoucherInput,
  ownerId: string
): Promise<string> {
  const code = normalizeVoucherCode(input.code);
  if (!BLUEPRINT_LIMITS.VOUCHER.CODE_PATTERN.test(code)) {
    throw new Error(
      'Voucher code must be 3–24 characters using A–Z, 0–9, underscore (_), or hyphen (-).'
    );
  }

  const discountType = input.discountType === 'percent' ? 'percent' : 'fixed';
  const rawVal = Number(input.discountValue) || 0;
  const discountValue =
    discountType === 'percent'
      ? Math.max(1, Math.min(100, Math.round(rawVal * 100) / 100))
      : Math.max(
          1,
          Math.min(
            BLUEPRINT_LIMITS.VOUCHER.MAX_FIXED_PHP,
            Math.round(rawVal * 100) / 100
          )
        );
  const minOrderPhp = Math.max(
    0,
    Math.min(1000000, Math.round((Number(input.minOrderPhp) || 0) * 100) / 100)
  );
  const maxUses = Math.max(
    1,
    Math.min(
      BLUEPRINT_LIMITS.VOUCHER.MAX_USES,
      Math.round(Number(input.maxUses) || 1)
    )
  );
  const { hasExpiry, expiresAt } = parseExpiresAtTimestamp(input.expiresDate);

  const ref = doc(db, 'vouchers', code);

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      throw new Error(`Voucher "${code}" already exists. Delete or edit it instead.`);
    }

    await setDoc(ref, {
      code,
      discountType,
      discountValue,
      minOrderPhp,
      maxUses,
      usedCount: 0,
      active: Boolean(input.active),
      hasExpiry,
      expiresAt,
      note: clampStr(input.note || '', BLUEPRINT_LIMITS.VOUCHER.NOTE_MAX),
      ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return code;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('already exists')
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, `vouchers/${code}`);
  }
}

export async function updateVoucher(
  voucherCode: string,
  updates: {
    active?: boolean;
    discountType?: 'fixed' | 'percent';
    discountValue?: number;
    minOrderPhp?: number;
    maxUses?: number;
    expiresDate?: string;
    note?: string;
  }
): Promise<void> {
  const code = normalizeVoucherCode(voucherCode);
  const path = `vouchers/${code}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (typeof updates.active === 'boolean') {
    payload.active = updates.active;
  }
  if (updates.discountType) {
    payload.discountType = updates.discountType;
  }
  if (typeof updates.discountValue === 'number') {
    payload.discountValue = Math.max(1, Math.round(updates.discountValue * 100) / 100);
  }
  if (typeof updates.minOrderPhp === 'number') {
    payload.minOrderPhp = Math.max(0, Math.round(updates.minOrderPhp * 100) / 100);
  }
  if (typeof updates.maxUses === 'number') {
    payload.maxUses = Math.max(1, Math.round(updates.maxUses));
  }
  if (updates.expiresDate !== undefined) {
    const { hasExpiry, expiresAt } = parseExpiresAtTimestamp(updates.expiresDate);
    payload.hasExpiry = hasExpiry;
    payload.expiresAt = expiresAt;
  }
  if (updates.note !== undefined) {
    payload.note = clampStr(updates.note, BLUEPRINT_LIMITS.VOUCHER.NOTE_MAX);
  }

  try {
    await updateDoc(doc(db, 'vouchers', code), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteVoucher(voucherCode: string): Promise<void> {
  const code = normalizeVoucherCode(voucherCode);
  const path = `vouchers/${code}`;
  try {
    await deleteDoc(doc(db, 'vouchers', code));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function lookupVoucher(rawCode: string): Promise<VoucherCode | null> {
  const code = normalizeVoucherCode(rawCode);
  if (!BLUEPRINT_LIMITS.VOUCHER.CODE_PATTERN.test(code)) {
    throw new Error('Enter a valid voucher code (3–24 letters/numbers).');
  }
  try {
    const snap = await getDoc(doc(db, 'vouchers', code));
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data();
    return {
      id: snap.id,
      code: String(data.code ?? snap.id),
      discountType: data.discountType === 'percent' ? 'percent' : 'fixed',
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
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `vouchers/${code}`);
  }
}

// ============================================================================
// Wallet Balance Purchase Orders (Atomic Batch + Vouchers + Auto-Delivery)
// ============================================================================

export interface PurchaseOrderResult {
  orderCode: string;
  totalPaidPhp: number;
  discountPhp: number;
  voucherCode: string;
  deliveredItem: DeliveryVaultItem | null;
  deliveredItems: DeliveryVaultItem[];
}

export async function purchaseStockWithBalance(
  stock: StockItem,
  quantity: number,
  profile: UserProfile,
  appliedVoucher?: VoucherCode | null
): Promise<PurchaseOrderResult> {
  const safeQty =
    stock.category === 'CODM ACCOUNT'
      ? 1
      : Math.max(1, Math.min(stock.stockCount, Math.round(quantity)));
  const unitPricePhp = Math.round(stock.pricePhp * 100) / 100;
  const subtotalPhp = Math.round(unitPricePhp * safeQty * 100) / 100;

  if (unitPricePhp <= 0) {
    throw new Error('This product requires direct seller pricing.');
  }
  if (stock.stockCount < safeQty) {
    throw new Error('Not enough stock available for the selected quantity.');
  }

  let verifiedVoucher: VoucherCode | null = null;
  let discountPhp = 0;
  if (appliedVoucher) {
    const freshVoucher = await lookupVoucher(appliedVoucher.code);
    if (!freshVoucher) {
      throw new Error('This voucher code no longer exists.');
    }
    const check = isVoucherCurrentlyValid(freshVoucher, subtotalPhp);
    if (!check.valid) {
      throw new Error(check.reason || 'Voucher code cannot be applied.');
    }
    verifiedVoucher = freshVoucher;
    discountPhp = computeVoucherDiscount(subtotalPhp, freshVoucher);
  }

  const totalPhp = Math.max(
    0,
    Math.round((subtotalPhp - discountPhp) * 100) / 100
  );

  if (profile.balance < totalPhp) {
    throw new Error('Insufficient wallet balance. Please top up via GCash.');
  }

  const orderId = makeSafeId('ord');
  const orderCode = makeShortCode('ORD');
  const nextBalance = Math.round((profile.balance - totalPhp) * 100) / 100;
  const nextCount = Math.max(0, stock.stockCount - safeQty);
  const nextStatus =
    stock.category === 'CODM ACCOUNT'
      ? 'Sold'
      : deriveAutoStockStatus(stock.category, stock.status, nextCount);

  const isAutoDelivery = Boolean(stock.autoDelivery);
  const usesUnitVault =
    isAutoDelivery && typeof stock.nextDeliveryIndex === 'number';
  const startUnitIndex = usesUnitVault
    ? Math.max(0, Math.round(stock.nextDeliveryIndex || 0))
    : 0;
  const nextDeliveryIndex = usesUnitVault ? startUnitIndex + safeQty : undefined;

  let hasExistingLegacyEntitlement = false;
  const legacyEntitlementId = `${profile.uid}_${stock.id}`;
  if (isAutoDelivery && !usesUnitVault) {
    try {
      const entSnap = await getDoc(doc(db, 'entitlements', legacyEntitlementId));
      hasExistingLegacyEntitlement = entSnap.exists();
    } catch {
      hasExistingLegacyEntitlement = false;
    }
  }

  const batch = writeBatch(db);
  if (totalPhp > 0) {
    batch.update(doc(db, 'users', profile.uid), {
      balance: nextBalance,
      updatedAt: serverTimestamp(),
    });
  }
  batch.update(doc(db, 'stocks', stock.id), {
    stockCount: nextCount,
    ...(usesUnitVault && nextDeliveryIndex !== undefined
      ? { nextDeliveryIndex }
      : {}),
    status: nextStatus,
    lastOrderId: orderId,
    updatedAt: serverTimestamp(),
  });
  if (verifiedVoucher) {
    batch.update(doc(db, 'vouchers', verifiedVoucher.code), {
      usedCount: verifiedVoucher.usedCount + 1,
      updatedAt: serverTimestamp(),
    });
  }
  if (usesUnitVault) {
    for (let i = 0; i < safeQty; i += 1) {
      const unitIdx = startUnitIndex + i;
      const entId = `${profile.uid}_${stock.id}__${unitIdx}`;
      batch.set(doc(db, 'entitlements', entId), {
        uid: profile.uid,
        stockId: stock.id,
        unitIndex: unitIdx,
        orderId,
        createdAt: serverTimestamp(),
      });
    }
  } else if (isAutoDelivery && !hasExistingLegacyEntitlement) {
    batch.set(doc(db, 'entitlements', legacyEntitlementId), {
      uid: profile.uid,
      stockId: stock.id,
      orderId,
      createdAt: serverTimestamp(),
    });
  }
  batch.set(doc(db, 'orders', orderId), {
    orderCode,
    userId: profile.uid,
    userEmail: clampStr(profile.email, BLUEPRINT_LIMITS.USER.EMAIL_MAX),
    userName:
      clampStr(profile.displayName, BLUEPRINT_LIMITS.USER.DISPLAY_NAME_MAX) ||
      'Member',
    stockId: stock.id,
    stockCode: clampStr(stock.code, BLUEPRINT_LIMITS.STOCK.CODE_MAX),
    stockTitle: clampStr(stock.title, BLUEPRINT_LIMITS.STOCK.TITLE_MAX),
    category: stock.category,
    quantity: safeQty,
    ...(usesUnitVault ? { startUnitIndex } : {}),
    unitPricePhp,
    subtotalPhp,
    voucherCode: verifiedVoucher ? verifiedVoucher.code : '',
    discountPhp,
    totalPhp,
    paymentMethod: 'Wallet Balance',
    deliveryStatus: isAutoDelivery ? 'Delivered' : 'Processing',
    deliveryNote: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `orders/${orderId}`);
  }

  let deliveredItems: DeliveryVaultItem[] = [];
  if (isAutoDelivery) {
    deliveredItems = await getDeliveryVaultUnitsForOrder({
      stockId: stock.id,
      quantity: safeQty,
      startUnitIndex: usesUnitVault ? startUnitIndex : undefined,
    });
  }

  return {
    orderCode,
    totalPaidPhp: totalPhp,
    discountPhp,
    voucherCode: verifiedVoucher ? verifiedVoucher.code : '',
    deliveredItem: deliveredItems[0] || null,
    deliveredItems,
  };
}

export async function updateOrderDelivery(
  orderId: string,
  deliveryStatus: OrderDeliveryStatus,
  deliveryNote: string
): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      deliveryStatus,
      deliveryNote: clampStr(
        deliveryNote,
        BLUEPRINT_LIMITS.ORDER.DELIVERY_NOTE_MAX
      ),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ============================================================================
// Inquiries, Reviews, Social Links & Settings
// ============================================================================

export async function createInquiry(
  input: CustomerInquiryInput
): Promise<string> {
  const id = makeSafeId('inq');
  const path = `inquiries/${id}`;
  try {
    await setDoc(doc(db, 'inquiries', id), {
      buyerName:
        clampStr(input.buyerName, BLUEPRINT_LIMITS.INQUIRY.BUYER_NAME_MAX) ||
        'Visitor',
      contactHandle:
        clampStr(input.contactHandle, BLUEPRINT_LIMITS.INQUIRY.HANDLE_MAX) ||
        'Not provided',
      preferredChannel: input.preferredChannel,
      stockCode: clampStr(input.stockCode, BLUEPRINT_LIMITS.INQUIRY.STOCK_CODE_MAX),
      stockTitle: clampStr(
        input.stockTitle,
        BLUEPRINT_LIMITS.INQUIRY.STOCK_TITLE_MAX
      ),
      message:
        clampStr(input.message, BLUEPRINT_LIMITS.INQUIRY.MESSAGE_MAX) ||
        'Inquiring about available stock.',
      status: 'New' as InquiryStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateInquiryStatus(
  inquiryId: string,
  status: InquiryStatus
): Promise<void> {
  const path = `inquiries/${inquiryId}`;
  try {
    await updateDoc(doc(db, 'inquiries', inquiryId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeInquiry(inquiryId: string): Promise<void> {
  const path = `inquiries/${inquiryId}`;
  try {
    await deleteDoc(doc(db, 'inquiries', inquiryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function sanitizeReviewPayload(input: ReviewInput) {
  return {
    buyerName:
      clampStr(input.buyerName, BLUEPRINT_LIMITS.REVIEW.BUYER_NAME_MAX) ||
      'Verified Buyer',
    itemLabel:
      clampStr(input.itemLabel, BLUEPRINT_LIMITS.REVIEW.ITEM_LABEL_MAX) ||
      'Kozuo Store Order',
    rating: Math.max(1, Math.min(5, Math.round(Number(input.rating) || 5))),
    comment:
      clampStr(input.comment, BLUEPRINT_LIMITS.REVIEW.COMMENT_MAX) ||
      'Smooth and legit transaction.',
    dealChannel: input.dealChannel,
    proofImageUrl: (input.proofImageUrl || '')
      .trim()
      .slice(0, BLUEPRINT_LIMITS.REVIEW.PROOF_IMAGE_MAX),
  };
}

export async function createReview(
  input: ReviewInput,
  ownerId: string
): Promise<string> {
  const id = makeSafeId('rev');
  const path = `reviews/${id}`;
  try {
    await setDoc(doc(db, 'reviews', id), {
      ...sanitizeReviewPayload(input),
      ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateReview(
  reviewId: string,
  input: ReviewInput
): Promise<void> {
  const path = `reviews/${reviewId}`;
  try {
    await updateDoc(doc(db, 'reviews', reviewId), {
      ...sanitizeReviewPayload(input),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeReview(reviewId: string): Promise<void> {
  const path = `reviews/${reviewId}`;
  try {
    await deleteDoc(doc(db, 'reviews', reviewId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function sanitizeSocialPayload(input: SocialLinkInput) {
  let url = clampStr(input.url, BLUEPRINT_LIMITS.SOCIAL.URL_MAX) || 'https://';
  if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) {
    url = `https://${url}`;
  }
  return {
    platform: input.platform,
    label:
      clampStr(input.label, BLUEPRINT_LIMITS.SOCIAL.LABEL_MAX) ||
      input.platform,
    handle: clampStr(input.handle, BLUEPRINT_LIMITS.SOCIAL.HANDLE_MAX),
    url,
    sortOrder: Math.max(
      0,
      Math.min(9999, Math.round(Number(input.sortOrder) || 0))
    ),
  };
}

export async function createSocialLink(
  input: SocialLinkInput,
  ownerId: string
): Promise<string> {
  const id = makeSafeId('soc');
  const path = `socialLinks/${id}`;
  const payload = {
    ...sanitizeSocialPayload(input),
    ownerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'socialLinks', id), payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSocialLink(
  linkId: string,
  input: SocialLinkInput
): Promise<void> {
  const path = `socialLinks/${linkId}`;
  try {
    await updateDoc(doc(db, 'socialLinks', linkId), {
      ...sanitizeSocialPayload(input),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeSocialLink(linkId: string): Promise<void> {
  const path = `socialLinks/${linkId}`;
  try {
    await deleteDoc(doc(db, 'socialLinks', linkId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function buildSettingsPayload(settings: StoreSettings, ownerId: string) {
  return {
    storeName:
      clampStr(settings.storeName, BLUEPRINT_LIMITS.SETTINGS.STORE_NAME_MAX) ||
      'KOZUO',
    accentWord: clampStr(
      settings.accentWord,
      BLUEPRINT_LIMITS.SETTINGS.ACCENT_WORD_MAX
    ),
    announcementText: clampStr(
      settings.announcementText,
      BLUEPRINT_LIMITS.SETTINGS.ANNOUNCEMENT_MAX
    ),
    heroKicker: clampStr(
      settings.heroKicker,
      BLUEPRINT_LIMITS.SETTINGS.HERO_KICKER_MAX
    ),
    heroTitle:
      clampStr(settings.heroTitle, BLUEPRINT_LIMITS.SETTINGS.HERO_TITLE_MAX) ||
      'Available Stocks & Files',
    heroSubtitle: clampStr(
      settings.heroSubtitle,
      BLUEPRINT_LIMITS.SETTINGS.HERO_SUBTITLE_MAX
    ),
    contactHeading: clampStr(
      settings.contactHeading,
      BLUEPRINT_LIMITS.SETTINGS.CONTACT_HEADING_MAX
    ),
    contactNote: clampStr(
      settings.contactNote,
      BLUEPRINT_LIMITS.SETTINGS.CONTACT_NOTE_MAX
    ),
    cleanGuide: clampStr(
      settings.cleanGuide,
      BLUEPRINT_LIMITS.SETTINGS.GUIDE_MAX
    ),
    notCleanGuide: clampStr(
      settings.notCleanGuide,
      BLUEPRINT_LIMITS.SETTINGS.GUIDE_MAX
    ),
    gcashName: clampStr(
      settings.gcashName || 'J.O',
      BLUEPRINT_LIMITS.SETTINGS.GCASH_NAME_MAX
    ),
    gcashNumber: clampStr(
      settings.gcashNumber || '09933119204',
      BLUEPRINT_LIMITS.SETTINGS.GCASH_NUMBER_MAX
    ),
    minTopUpPhp: Math.max(
      50,
      Math.min(10000, Math.round(Number(settings.minTopUpPhp) || 50))
    ),
    updatedBy: ownerId,
    updatedAt: serverTimestamp(),
  };
}

export async function saveStoreSettings(
  settings: StoreSettings,
  ownerId: string
): Promise<void> {
  const path = 'storeSettings/main';
  try {
    await setDoc(
      doc(db, 'storeSettings', 'main'),
      buildSettingsPayload(settings, ownerId)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function seedStarterCatalog(
  ownerId: string,
  options: {
    seedStocks: boolean;
    seedLinks: boolean;
    seedReviews?: boolean;
    existingStockCodes?: string[];
    settings: StoreSettings;
  }
): Promise<void> {
  const batch = writeBatch(db);
  const existingSet = new Set(
    (options.existingStockCodes || []).map((c) => c.trim().toLowerCase())
  );

  if (options.seedStocks) {
    STARTER_STOCK_TEMPLATES.forEach((item, idx) => {
      if (existingSet.has(item.code.trim().toLowerCase())) {
        return;
      }
      const id = `starter-stk-${idx}`;
      batch.set(doc(db, 'stocks', id), {
        ...sanitizeStockPayload(item),
        ownerId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }

  if (options.seedLinks) {
    STARTER_SOCIAL_LINKS.forEach((link, idx) => {
      const id = `starter-soc-${idx}`;
      batch.set(doc(db, 'socialLinks', id), {
        ...sanitizeSocialPayload(link),
        ownerId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }

  if (options.seedReviews) {
    STARTER_REVIEW_TEMPLATES.forEach((rev, idx) => {
      const id = `starter-rev-${idx}`;
      batch.set(doc(db, 'reviews', id), {
        ...sanitizeReviewPayload(rev),
        ownerId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }

  batch.set(
    doc(db, 'storeSettings', 'main'),
    buildSettingsPayload(options.settings, ownerId)
  );

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch/seed');
  }
}

export async function resetAllStocks(stockIds: string[]): Promise<void> {
  if (stockIds.length === 0) return;
  const batch = writeBatch(db);
  stockIds.forEach((id) => {
    batch.delete(doc(db, 'stocks', id));
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'stocks/batch');
  }
}
