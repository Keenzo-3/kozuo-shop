# Security Specification — Kozuo Store Wallet, Top-Ups, Vouchers & Auto-Delivery

## 1. Data Invariants
1. **Public Catalog & Reviews, Controlled Mutations**: Visitors may read `/stocks`, `/reviews`, `/socialLinks`, and `/storeSettings`. Only `isAdmin()` (strictly `email_verified == true` + admin email/registry) may create/delete stocks or edit catalog metadata. Authenticated buyers (`isBuyerSession()`: verified Google user or registered `password` user) may only decrement `stockCount` on `/stocks/{stockId}` as part of an atomic batch linked 1:1 via `lastOrderId` to a newly created `/orders/{orderId}`.
2. **Wallet Balance Integrity (`/users/{userId}` & `/usernames/{username}`)**:
   - PII (`email`, `contactEmail`, `balance`) is readable only by the account owner (`request.auth.uid == userId`) or `isAdmin()`; `list` is restricted strictly to `isAdmin()`.
   - New profiles may only be created by the signed-in buyer with `balance == 0` and `role == 'buyer'`.
   - Non-admin users can NEVER increase their `balance` or escalate `role`; they may only decrease `balance` (remaining `>= 0`) during a valid purchase or update `displayName`/`contactEmail`.
3. **Manual GCash Top-Ups (`/topupRequests/{requestId}`) & Settings**:
   - Authenticated buyers can create a request only for their own `userId` with `method == 'GCash'`, `status == 'Pending'`, `amountPhp >= 50`, non-empty `proofImageUrl`, and empty `adminNote`/`reviewedBy`.
   - `storeSettings.minTopUpPhp` is enforced to be `>= 50`.
4. **Voucher Codes (`/vouchers/{voucherCode}`)**:
   - Only `isAdmin()` may `list`, `create`, `update` definitions/status, or `delete` vouchers (prevents scraping private promo codes).
   - Authenticated buyers may `get` a specific voucher document by typed code and may only increment `usedCount` by `1` while the voucher is `active == true`, `usedCount < maxUses`, and not expired.
5. **Orders (`/orders/{orderId}`)**:
   - Authenticated buyers can create an order only for their own `userId` with `deliveryNote == ''`, exact `unitPricePhp == stock.pricePhp`, validated `subtotalPhp`, server-verified voucher `discountPhp` + `vouchers` increment (if voucher applied), exact wallet `balance` deduction via `getAfter()`, and exact stock decrement via `getAfter()`.
   - `deliveryStatus == 'Delivered'` on creation is permitted ONLY if `stock.autoDelivery == true` AND `/entitlements/{uid}_{stockId}` exists after the batch.
6. **Automatic Delivery Vault (`/deliveryVault/{stockId}` & `/entitlements/{entitlementId}`)**:
   - `/deliveryVault/{stockId}` is NEVER publicly readable or listable (`allow list: if isAdmin()`). Buyers can `get` `/deliveryVault/{stockId}` ONLY when `/entitlements/{request.auth.uid + '_' + stockId}` exists.
   - `/entitlements/{uid}_{stockId}` can only be created atomically alongside a valid order for that exact `uid` and `stockId` on an `autoDelivery == true` stock.

## 2. Attack Payloads Prevented (Expected: PERMISSION_DENIED)
1. Unauthenticated visitor reads `/deliveryVault/stk1` or lists `/deliveryVault` (rejected).
2. Signed-in buyer without purchasing reads `/deliveryVault/stk1` (rejected: missing `/entitlements/{uid}_stk1`).
3. Buyer creates `/entitlements/{uid}_stk1` without a valid atomic `/orders/{orderId}` for `stk1` (rejected).
4. Buyer calls `list` on `/vouchers` to harvest active promo codes (rejected: `isAdmin()` only).
5. Buyer submits `/orders/ord1` with an expired, paused, or maxed-out voucher code, or forged `discountPhp` exceeding voucher rules (rejected).
6. Buyer submits `/orders/ord2` with `deliveryStatus: "Delivered"` for a non-auto-delivery item (rejected).
7. Buyer decrements `/stocks/stk1.stockCount` without linking an atomic `orders/{lastOrderId}` document (rejected).
8. Buyer submits `/topupRequests/top1` with `amountPhp: 25` below ₱50 minimum (rejected).
9. Buyer updates `/users/u1` to raise `balance` or set `role: "admin"` (rejected).
10. Buyer updates `/topupRequests/top1` to self-approve (rejected).
11. Unauthenticated visitor reads `/inquiries` or `/admins` (rejected).
12. Non-admin sets `storeSettings.minTopUpPhp` below 50 or edits `gcashNumber` (rejected).
