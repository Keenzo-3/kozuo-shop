import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ClipboardPaste,
  Copy,
  ImagePlus,
  Loader2,
  Lock,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  deriveAutoStockStatus,
  isRestockingStatus,
  isSoldStatus,
  parsePricePhp,
  STATUS_PRESETS,
  type AccountGroup,
  type DeliveryType,
  type DeliveryVaultInput,
  type StockCategory,
  type StockFormInput,
  type StockItem,
} from '../types/store';
import {
  CODM_FILES_PHOTO,
  compressImageToDataUrl,
  MLBB_FILES_PHOTO,
  PRESET_THUMBNAILS,
} from '../lib/imageUtils';
import { getDeliveryVaultUnitsForAdmin } from '../lib/storeService';

interface StockEditorModalProps {
  isOpen: boolean;
  editingStock: StockItem | null;
  initialDraft?: StockFormInput | null;
  onClose: () => void;
  onSave: (
    input: StockFormInput,
    existingId?: string,
    deliveryVault?: DeliveryVaultInput
  ) => Promise<void>;
}

const EMPTY_FORM: StockFormInput = {
  title: '',
  code: '',
  category: 'CODM ACCOUNT',
  accountGroup: 'Clean',
  fileType: '',
  priceLabel: '₱',
  pricePhp: 0,
  status: 'In Stock',
  stockCount: 1,
  bindSummary: '',
  description: '',
  specifications: [],
  highlights: [],
  imageUrl: PRESET_THUMBNAILS[2].url,
  galleryImages: [PRESET_THUMBNAILS[2].url],
  featured: false,
};

const EMPTY_DELIVERY: DeliveryVaultInput = {
  enabled: true,
  deliveryType: 'credentials',
  payload: '',
  items: [''],
  instructions: '',
};

function computeEffectiveStockUnits(
  category: StockCategory,
  status: string,
  stockCount: number
): number {
  if (isSoldStatus(status) || isRestockingStatus(status)) return 0;
  if (category === 'CODM ACCOUNT') return 1;
  return Math.min(
    BLUEPRINT_LIMITS.DELIVERY.MAX_UNITS,
    Math.max(0, Math.round(Number(stockCount) || 0))
  );
}

function resizeItemsArray(current: string[], targetCount: number): string[] {
  const safeCount = Math.max(
    0,
    Math.min(BLUEPRINT_LIMITS.DELIVERY.MAX_UNITS, targetCount)
  );
  if (safeCount === 0) return [];
  const next: string[] = [];
  for (let i = 0; i < safeCount; i += 1) {
    next.push(current[i] ?? '');
  }
  return next;
}

export function StockEditorModal({
  isOpen,
  editingStock,
  initialDraft,
  onClose,
  onSave,
}: StockEditorModalProps) {
  const [form, setForm] = useState<StockFormInput>(EMPTY_FORM);
  const [delivery, setDelivery] = useState<DeliveryVaultInput>(EMPTY_DELIVERY);
  const [loadingVault, setLoadingVault] = useState(false);
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveUnitCount = computeEffectiveStockUnits(
    form.category,
    form.status,
    form.stockCount
  );

  useEffect(() => {
    setDelivery((prev) => {
      if (prev.items.length === effectiveUnitCount) return prev;
      return {
        ...prev,
        enabled: effectiveUnitCount > 0,
        items: resizeItemsArray(prev.items, effectiveUnitCount),
      };
    });
  }, [effectiveUnitCount]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setUrlInput('');
    setShowBulkPaste(false);
    setBulkPasteText('');
    let cancelled = false;

    if (editingStock) {
      const existingGallery =
        editingStock.galleryImages && editingStock.galleryImages.length > 0
          ? editingStock.galleryImages
          : editingStock.imageUrl
          ? [editingStock.imageUrl]
          : [];
      const clampedCount =
        editingStock.category === 'CODM ACCOUNT'
          ? isSoldStatus(editingStock.status) ||
            isRestockingStatus(editingStock.status)
            ? 0
            : 1
          : Math.min(
              BLUEPRINT_LIMITS.DELIVERY.MAX_UNITS,
              Math.max(0, editingStock.stockCount)
            );
      const targetUnits = computeEffectiveStockUnits(
        editingStock.category,
        editingStock.status,
        clampedCount
      );
      const defaultType: DeliveryType =
        editingStock.category === 'CODM ACCOUNT' ? 'credentials' : 'link';

      setForm({
        title: editingStock.title,
        code: editingStock.code,
        category: editingStock.category,
        accountGroup: editingStock.accountGroup,
        fileType: editingStock.fileType,
        priceLabel: editingStock.priceLabel,
        pricePhp:
          editingStock.pricePhp > 0
            ? editingStock.pricePhp
            : parsePricePhp(editingStock.priceLabel),
        status: editingStock.status,
        stockCount: clampedCount,
        bindSummary: editingStock.bindSummary,
        description: editingStock.description,
        specifications: [],
        highlights: [],
        imageUrl:
          editingStock.imageUrl ||
          existingGallery[0] ||
          PRESET_THUMBNAILS[0].url,
        galleryImages: existingGallery.slice(
          0,
          BLUEPRINT_LIMITS.STOCK.GALLERY_MAX_COUNT
        ),
        featured: editingStock.featured,
        autoDelivery: targetUnits > 0,
      });

      setDelivery({
        enabled: targetUnits > 0,
        deliveryType: defaultType,
        payload: '',
        items: resizeItemsArray([], targetUnits),
        instructions: '',
      });

      if (targetUnits > 0 && !editingStock.id.startsWith('preview-')) {
        setLoadingVault(true);
        getDeliveryVaultUnitsForAdmin(
          editingStock.id,
          editingStock.nextDeliveryIndex ?? 0,
          targetUnits
        )
          .then((vault) => {
            if (!cancelled) {
              const items = resizeItemsArray(vault.items, targetUnits);
              setDelivery({
                enabled: targetUnits > 0,
                deliveryType:
                  vault.items.some((x) => x.trim().length > 0)
                    ? vault.deliveryType
                    : defaultType,
                payload: items[0] || '',
                items,
                instructions: vault.instructions,
              });
            }
          })
          .finally(() => {
            if (!cancelled) setLoadingVault(false);
          });
      }
    } else if (initialDraft) {
      const clampedCount = Math.min(
        BLUEPRINT_LIMITS.DELIVERY.MAX_UNITS,
        Math.max(0, initialDraft.stockCount || 1)
      );
      const targetUnits = computeEffectiveStockUnits(
        initialDraft.category,
        initialDraft.status,
        clampedCount
      );
      setForm({
        ...initialDraft,
        stockCount: clampedCount,
        pricePhp:
          initialDraft.pricePhp > 0
            ? initialDraft.pricePhp
            : parsePricePhp(initialDraft.priceLabel),
        specifications: [],
        highlights: [],
      });
      setDelivery({
        enabled: targetUnits > 0,
        deliveryType:
          initialDraft.category === 'CODM ACCOUNT' ? 'credentials' : 'link',
        payload: '',
        items: resizeItemsArray([], targetUnits),
        instructions: '',
      });
    } else {
      const randomNum = Math.floor(100 + Math.random() * 899);
      setForm({
        ...EMPTY_FORM,
        code: `STK-${randomNum}`,
      });
      setDelivery({
        ...EMPTY_DELIVERY,
        enabled: true,
        deliveryType: 'credentials',
        items: [''],
      });
    }

    return () => {
      cancelled = true;
    };
  }, [isOpen, editingStock, initialDraft]);

  if (!isOpen) return null;

  const handleCategoryChange = (cat: StockCategory) => {
    setForm((prev) => {
      const nextCount =
        cat === 'CODM ACCOUNT'
          ? 1
          : Math.min(
              BLUEPRINT_LIMITS.DELIVERY.MAX_UNITS,
              Math.max(1, prev.stockCount || 5)
            );
      return {
        ...prev,
        category: cat,
        accountGroup:
          cat === 'CODM ACCOUNT'
            ? prev.accountGroup === 'Not Clean'
              ? 'Not Clean'
              : 'Clean'
            : 'N/A',
        fileType:
          cat === 'CODM&MLBB FILES' ? prev.fileType || 'CODM Files' : '',
        stockCount: nextCount,
        status: deriveAutoStockStatus(cat, prev.status, nextCount),
        imageUrl:
          cat === 'CODM&MLBB FILES' &&
          prev.imageUrl === PRESET_THUMBNAILS[2].url
            ? CODM_FILES_PHOTO
            : prev.imageUrl,
        galleryImages:
          cat === 'CODM&MLBB FILES' &&
          prev.galleryImages.length === 1 &&
          prev.galleryImages[0] === PRESET_THUMBNAILS[2].url
            ? [CODM_FILES_PHOTO]
            : prev.galleryImages,
      };
    });
    if (!editingStock) {
      setDelivery((prev) => ({
        ...prev,
        deliveryType: cat === 'CODM ACCOUNT' ? 'credentials' : 'link',
      }));
    }
  };

  const addPhotoToGallery = (newUrl: string) => {
    const trimmed = newUrl.trim();
    if (!trimmed) return;
    setForm((prev) => {
      if (prev.galleryImages.includes(trimmed)) {
        return { ...prev, imageUrl: trimmed };
      }
      if (
        prev.galleryImages.length >= BLUEPRINT_LIMITS.STOCK.GALLERY_MAX_COUNT
      ) {
        setError(
          `Maximum of ${BLUEPRINT_LIMITS.STOCK.GALLERY_MAX_COUNT} photos allowed per stock.`
        );
        return prev;
      }
      const nextGallery = [...prev.galleryImages, trimmed];
      return {
        ...prev,
        imageUrl: prev.imageUrl || trimmed,
        galleryImages: nextGallery,
      };
    });
  };

  const handleMultiFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const remainingSlots =
      BLUEPRINT_LIMITS.STOCK.GALLERY_MAX_COUNT - form.galleryImages.length;
    if (remainingSlots <= 0) {
      setError(
        `Maximum of ${BLUEPRINT_LIMITS.STOCK.GALLERY_MAX_COUNT} photos reached. Remove one before adding more.`
      );
      e.target.value = '';
      return;
    }

    setUploadingImg(true);
    setError(null);
    try {
      const selected = files.slice(0, remainingSlots);
      const uploadedUrls: string[] = [];
      for (const file of selected) {
        const dataUrl = await compressImageToDataUrl(file);
        uploadedUrls.push(dataUrl);
      }
      setForm((prev) => {
        const merged = [...prev.galleryImages, ...uploadedUrls].slice(
          0,
          BLUEPRINT_LIMITS.STOCK.GALLERY_MAX_COUNT
        );
        return {
          ...prev,
          imageUrl: prev.imageUrl || merged[0] || '',
          galleryImages: merged,
        };
      });
      if (files.length > remainingSlots) {
        setError(
          `Only ${remainingSlots} more photo(s) could be added (max 7 photos).`
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to process selected image(s).'
      );
    } finally {
      setUploadingImg(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setForm((prev) => {
      const nextGallery = prev.galleryImages.filter((_, i) => i !== index);
      const removed = prev.galleryImages[index];
      const nextCover =
        prev.imageUrl === removed ? nextGallery[0] || '' : prev.imageUrl;
      return {
        ...prev,
        galleryImages: nextGallery,
        imageUrl: nextCover,
      };
    });
  };

  const handleSetCover = (url: string) => {
    setForm((prev) => ({
      ...prev,
      imageUrl: url,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) {
      setError('Please enter a product name / title.');
      return;
    }
    if (!form.priceLabel.trim()) {
      setError('Please enter a price label (e.g. ₱150).');
      return;
    }
    if (!form.status.trim()) {
      setError('Please select or enter a stock status.');
      return;
    }

    const resolvedPricePhp =
      form.pricePhp > 0 ? form.pricePhp : parsePricePhp(form.priceLabel);
    if (effectiveUnitCount > 0 && resolvedPricePhp <= 0) {
      setError(
        'Please enter a valid PHP Wallet Price greater than ₱0 so buyers can purchase automatically.'
      );
      return;
    }

    const trimmedItems = resizeItemsArray(delivery.items, effectiveUnitCount).map(
      (item) => item.trim()
    );
    if (effectiveUnitCount > 0) {
      const missingSlots: number[] = [];
      trimmedItems.forEach((val, idx) => {
        if (!val) missingSlots.push(idx + 1);
      });
      if (missingSlots.length > 0) {
        const preview = missingSlots.slice(0, 5).map((n) => `#${n}`).join(', ');
        const suffix =
          missingSlots.length > 5
            ? ` (+${missingSlots.length - 5} more)`
            : '';
        setError(
          `Automated delivery item required: Fill in all ${effectiveUnitCount} stock slot(s) (${preview}${suffix}) with login:pass credentials or a download link before saving.`
        );
        return;
      }
    }

    setSaving(true);
    try {
      await onSave(
        {
          ...form,
          pricePhp: resolvedPricePhp,
          stockCount: effectiveUnitCount,
          autoDelivery: effectiveUnitCount > 0,
          specifications: [],
          highlights: [],
        },
        editingStock?.id,
        {
          enabled: effectiveUnitCount > 0,
          deliveryType: delivery.deliveryType,
          payload: trimmedItems[0] || '',
          items: trimmedItems,
          instructions: delivery.instructions,
        }
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save stock item.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={editingStock ? 'Edit Product' : 'Add New Product'}
    >
      <div
        className="w-full max-w-2xl bg-[#12141C] border border-white/10 rounded-xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-white">
            {editingStock
              ? `Edit Product · ${editingStock.code}`
              : 'Add New Product'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close editor"
            className="p-2 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-5 max-h-[82vh] overflow-y-auto"
        >
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Category Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
              Category
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {(['CODM ACCOUNT', 'CODM&MLBB FILES'] as StockCategory[]).map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategoryChange(cat)}
                    className={`px-4 py-2.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      form.category === cat
                        ? 'bg-[#2563EB] border-[#2563EB] text-white'
                        : 'bg-[#0C0E14] border-white/[0.08] text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Conditional Sub-Group + Stock Quantity */}
          {form.category === 'CODM ACCOUNT' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                  CODM Account Group
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Clean', 'Not Clean'] as AccountGroup[]).map((grp) => {
                    const active = form.accountGroup === grp;
                    const isClean = grp === 'Clean';
                    return (
                      <button
                        key={grp}
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, accountGroup: grp }))
                        }
                        className={`px-3 py-2.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          active
                            ? isClean
                              ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300'
                              : 'bg-rose-500/15 border-rose-500/60 text-rose-300'
                            : 'bg-[#0C0E14] border-white/[0.08] text-[#9CA3AF] hover:text-white'
                        }`}
                      >
                        {isClean ? (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        ) : (
                          <ShieldAlert className="w-3.5 h-3.5" />
                        )}
                        <span>{grp}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                  Stock Mode
                </label>
                <div className="px-3.5 py-2.5 rounded-lg bg-[#0C0E14] border border-white/[0.08] text-xs text-[#D1D5DB]">
                  One-Time Buy (1 unique account)
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                  File Type Label
                </label>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {[
                    { label: 'CODM Files', img: CODM_FILES_PHOTO },
                    { label: 'MLBB Upass Combo', img: MLBB_FILES_PHOTO },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          fileType: preset.label,
                          imageUrl: preset.img,
                          galleryImages: prev.galleryImages.includes(preset.img)
                            ? prev.galleryImages
                            : [preset.img, ...prev.galleryImages].slice(0, 7),
                        }))
                      }
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                        form.fileType === preset.label
                          ? 'bg-[#2563EB]/20 border-[#3B82F6] text-[#93C5FD]'
                          : 'bg-[#0C0E14] border-white/[0.08] text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  maxLength={BLUEPRINT_LIMITS.STOCK.FILE_TYPE_MAX}
                  value={form.fileType}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, fileType: e.target.value }))
                  }
                  placeholder="e.g. CODM Files or MLBB Upass Combo"
                  className="w-full px-3.5 py-2 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                  Stock Quantity (Max {BLUEPRINT_LIMITS.DELIVERY.MAX_UNITS})
                </label>
                <input
                  type="number"
                  min={0}
                  max={BLUEPRINT_LIMITS.DELIVERY.MAX_UNITS}
                  value={form.stockCount}
                  onChange={(e) => {
                    const nextCount = Math.min(
                      BLUEPRINT_LIMITS.DELIVERY.MAX_UNITS,
                      Math.max(0, Number(e.target.value) || 0)
                    );
                    setForm((prev) => ({
                      ...prev,
                      stockCount: nextCount,
                      status: deriveAutoStockStatus(
                        prev.category,
                        prev.status,
                        nextCount
                      ),
                    }));
                  }}
                  className="w-full px-3.5 py-2 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm font-mono-tabular text-white focus:outline-none focus:border-[#3B82F6]"
                />
                <p className="text-[11px] text-[#6B7280]">
                  Creates {effectiveUnitCount} required delivery item field(s) below.
                </p>
              </div>
            </div>
          )}

          {/* Product Name & Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                Product Name
              </label>
              <input
                type="text"
                required
                maxLength={BLUEPRINT_LIMITS.STOCK.TITLE_MAX}
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="e.g. Mythic Grau + 6 Legendaries"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                Stock Code
              </label>
              <input
                type="text"
                required
                maxLength={BLUEPRINT_LIMITS.STOCK.CODE_MAX}
                value={form.code}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, code: e.target.value }))
                }
                placeholder="STK-101"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm font-mono-tabular text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>
          </div>

          {/* Price, Numeric PHP Wallet Price & Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                Price Label
              </label>
              <input
                type="text"
                required
                maxLength={BLUEPRINT_LIMITS.STOCK.PRICE_LABEL_MAX}
                value={form.priceLabel}
                onChange={(e) => {
                  const nextLabel = e.target.value;
                  const parsed = parsePricePhp(nextLabel);
                  setForm((prev) => ({
                    ...prev,
                    priceLabel: nextLabel,
                    pricePhp: parsed > 0 ? parsed : prev.pricePhp,
                  }));
                }}
                placeholder="₱150 or PM for Price"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm font-mono-tabular text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                Wallet Price (PHP)
              </label>
              <input
                type="number"
                min={0}
                max={1000000}
                step="1"
                value={form.pricePhp}
                onChange={(e) => {
                  const num = Math.max(0, Number(e.target.value) || 0);
                  setForm((prev) => ({
                    ...prev,
                    pricePhp: num,
                    priceLabel:
                      num > 0 && (!prev.priceLabel || prev.priceLabel === '₱')
                        ? `₱${num.toLocaleString('en-PH')}`
                        : prev.priceLabel,
                  }));
                }}
                placeholder="150"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm font-mono-tabular text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                Short Summary Line
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.STOCK.BIND_SUMMARY_MAX}
                value={form.bindSummary}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, bindSummary: e.target.value }))
                }
                placeholder="Garena Only · Surrender Gmail"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>
          </div>

          {/* Stock Status Presets + Customizable Status */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
              Stock Status (In Stock · Low Stock · Out of Stock · Restocking Soon or custom)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      status: preset,
                      stockCount:
                        preset === 'Out of Stock' ||
                        preset === 'Sold' ||
                        preset === 'Restocking Soon'
                          ? 0
                          : prev.stockCount === 0
                          ? prev.category === 'CODM ACCOUNT'
                            ? 1
                            : preset === 'Low Stock'
                            ? 2
                            : 10
                          : prev.stockCount,
                    }))
                  }
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                    form.status === preset
                      ? 'bg-[#2563EB] border-[#2563EB] text-white'
                      : 'bg-[#0C0E14] border-white/[0.08] text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              type="text"
              required
              maxLength={BLUEPRINT_LIMITS.STOCK.STATUS_MAX}
              value={form.status}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, status: e.target.value }))
              }
              placeholder="In Stock, Low Stock, Out of Stock, Restocking Soon..."
              className="w-full px-3.5 py-2 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
            />
          </div>

          {/* Product Details */}
          <div className="space-y-1.5 pt-2 border-t border-white/[0.08]">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
              Product Details
            </label>
            <textarea
              rows={4}
              maxLength={BLUEPRINT_LIMITS.STOCK.DESCRIPTION_MAX}
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Write full details here (skins, rank, bind info, file pack details, delivery notes)..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
            />
          </div>

          {/* Mandatory Per-Stock Automatic Delivery Vault */}
          <div className="p-4 rounded-xl bg-[#0C0E14] border border-emerald-500/25 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-white">
                <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  Automated Instant Delivery (Required · {effectiveUnitCount}{' '}
                  {effectiveUnitCount === 1 ? 'Item' : 'Items'})
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] text-[#9CA3AF]">
                <Lock className="w-3 h-3 text-[#60A5FA]" />
                Encrypted · Revealed only upon purchase
              </span>
            </div>

            {effectiveUnitCount === 0 ? (
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Stock is currently set to 0 units (Out of Stock / Restocking). Increase stock quantity above 0 or set status to In Stock to enter automated delivery items.
              </p>
            ) : loadingVault ? (
              <div className="flex items-center gap-2 text-xs text-[#9CA3AF] py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Loading saved delivery items...</span>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'credentials', label: 'Account Credentials (login:pass)' },
                      { id: 'link', label: 'Download Link / File Key' },
                    ] as { id: DeliveryType; label: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setDelivery((prev) => ({
                          ...prev,
                          deliveryType: opt.id,
                        }))
                      }
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        delivery.deliveryType === opt.id
                          ? 'bg-[#2563EB]/20 border-[#3B82F6] text-white'
                          : 'bg-[#12141C] border-white/[0.08] text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {effectiveUnitCount > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-[#12141C] border border-white/[0.08]">
                    <span className="text-[11px] text-[#9CA3AF]">
                      Enter a unique login:pass or link for each of the{' '}
                      <strong className="text-white">{effectiveUnitCount}</strong>{' '}
                      stock slots:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowBulkPaste((s) => !s)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/[0.06] hover:bg-white/[0.12] text-[11px] font-medium text-[#D1D5DB] cursor-pointer"
                      >
                        <ClipboardPaste className="w-3 h-3 text-[#60A5FA]" />
                        <span>{showBulkPaste ? 'Hide Bulk Paste' : 'Bulk Paste Lines'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={!delivery.items[0]?.trim()}
                        onClick={() => {
                          const first = delivery.items[0] || '';
                          if (!first.trim()) return;
                          setDelivery((prev) => ({
                            ...prev,
                            items: prev.items.map(() => first),
                          }));
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-40 text-[11px] font-medium text-[#D1D5DB] cursor-pointer"
                      >
                        <Copy className="w-3 h-3 text-emerald-400" />
                        <span>Copy #1 to All</span>
                      </button>
                    </div>
                  </div>
                )}

                {showBulkPaste && effectiveUnitCount > 1 && (
                  <div className="p-3 rounded-lg bg-[#12141C] border border-[#3B82F6]/30 space-y-2">
                    <label className="block text-[11px] text-[#D1D5DB]">
                      Paste up to {effectiveUnitCount} lines (1 line per stock slot):
                    </label>
                    <textarea
                      rows={4}
                      value={bulkPasteText}
                      onChange={(e) => setBulkPasteText(e.target.value)}
                      placeholder={
                        delivery.deliveryType === 'credentials'
                          ? 'user1:pass1\nuser2:pass2\nuser3:pass3'
                          : 'https://link-1\nhttps://link-2\nhttps://link-3'
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#090A0F] border border-white/[0.1] text-xs font-mono-tabular text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowBulkPaste(false);
                          setBulkPasteText('');
                        }}
                        className="px-2.5 py-1 rounded text-[11px] text-[#9CA3AF] hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const lines = bulkPasteText
                            .split(/\r?\n/)
                            .map((l) => l.trim())
                            .filter(Boolean);
                          setDelivery((prev) => ({
                            ...prev,
                            items: prev.items.map(
                              (existing, idx) => lines[idx] ?? existing
                            ),
                          }));
                          setShowBulkPaste(false);
                          setBulkPasteText('');
                        }}
                        className="px-3 py-1 rounded text-[11px] font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white cursor-pointer"
                      >
                        Apply Lines to Slots
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {delivery.items.map((slotVal, idx) => {
                    const filled = slotVal.trim().length > 0;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <label className="font-semibold text-[#D1D5DB]">
                            {effectiveUnitCount === 1
                              ? delivery.deliveryType === 'credentials'
                                ? 'Required Account Item (login:pass / details)'
                                : 'Required Delivery Item (Download Link / File Key)'
                              : `Stock Slot #${idx + 1} (Required)`}
                          </label>
                          <span
                            className={
                              filled
                                ? 'text-emerald-400 font-medium'
                                : 'text-amber-400 font-medium'
                            }
                          >
                            {filled ? 'Ready' : 'Required'}
                          </span>
                        </div>
                        <textarea
                          rows={delivery.deliveryType === 'credentials' ? 2 : 1}
                          maxLength={BLUEPRINT_LIMITS.DELIVERY.PAYLOAD_MAX}
                          value={slotVal}
                          onChange={(e) => {
                            const nextVal = e.target.value;
                            setDelivery((prev) => {
                              const nextItems = [...prev.items];
                              nextItems[idx] = nextVal;
                              return {
                                ...prev,
                                payload: nextItems[0] || '',
                                items: nextItems,
                              };
                            });
                          }}
                          placeholder={
                            delivery.deliveryType === 'credentials'
                              ? `Slot #${idx + 1}: username:password or Garena + Gmail surrender details`
                              : `Slot #${idx + 1}: https://drive.google.com/... or Mega link + archive key`
                          }
                          className={`w-full px-3 py-2 rounded-lg bg-[#12141C] border text-xs font-mono-tabular text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6] ${
                            filled ? 'border-emerald-500/35' : 'border-white/[0.12]'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1">
                  <label className="block text-xs text-[#9CA3AF]">
                    Buyer Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={BLUEPRINT_LIMITS.DELIVERY.INSTRUCTIONS_MAX}
                    value={delivery.instructions}
                    onChange={(e) =>
                      setDelivery((prev) => ({
                        ...prev,
                        instructions: e.target.value,
                      }))
                    }
                    placeholder="e.g. Change password immediately after logging in, or extract with WinRAR."
                    className="w-full px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.1] text-xs text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Multi-Photo Gallery Picker (Max 7 Photos) */}
          <div className="space-y-3 pt-2 border-t border-white/[0.08]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                Product Images ({form.galleryImages.length} / {BLUEPRINT_LIMITS.STOCK.GALLERY_MAX_COUNT} max)
              </label>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2563EB]/20 hover:bg-[#2563EB]/30 border border-[#3B82F6]/40 text-[#93C5FD] transition-colors cursor-pointer">
                {uploadingImg ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="w-3.5 h-3.5" />
                )}
                <span>
                  {uploadingImg ? 'Processing...' : 'Upload Multiple Images'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleMultiFileUpload}
                  className="sr-only"
                />
              </label>
            </div>

            {form.galleryImages.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {form.galleryImages.map((url, idx) => {
                  const isCover = form.imageUrl === url;
                  return (
                    <div
                      key={`${url.slice(0, 24)}-${idx}`}
                      className={`relative aspect-square rounded-lg overflow-hidden border bg-[#0C0E14] ${
                        isCover
                          ? 'border-[#3B82F6] ring-2 ring-[#3B82F6]/40'
                          : 'border-white/[0.1]'
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Gallery ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleSetCover(url)}
                        title={isCover ? 'Cover photo' : 'Set as cover photo'}
                        className={`absolute bottom-1 left-1 p-1 rounded bg-black/70 transition-colors cursor-pointer ${
                          isCover
                            ? 'text-amber-400'
                            : 'text-white/70 hover:text-white'
                        }`}
                      >
                        <Star
                          className="w-3 h-3"
                          fill={isCover ? 'currentColor' : 'none'}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        title="Remove photo"
                        className="absolute top-1 right-1 p-1 rounded bg-black/70 text-white/80 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-1.5">
              <span className="block text-[11px] text-[#6B7280]">
                Quick presets (click to add to gallery):
              </span>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_THUMBNAILS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => addPhotoToGallery(preset.url)}
                    className="relative aspect-[4/3] rounded-lg overflow-hidden border border-white/[0.08] hover:border-[#3B82F6] transition-all cursor-pointer"
                    title={`Add ${preset.label}`}
                  >
                    <img
                      src={preset.url}
                      alt={preset.label}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Or paste an image URL (https://...)"
                className="flex-1 px-3.5 py-2 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-xs text-[#D1D5DB] placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
              />
              <button
                type="button"
                onClick={() => {
                  addPhotoToGallery(urlInput);
                  setUrlInput('');
                }}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.12] text-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add URL</span>
              </button>
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-[#D1D5DB] cursor-pointer">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, featured: e.target.checked }))
                }
                className="rounded border-white/20 bg-[#0C0E14] text-[#2563EB]"
              />
              <span>Pin / Feature at top of catalog</span>
            </label>
          </div>

          <div className="pt-4 border-t border-white/[0.08] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[#9CA3AF] hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploadingImg}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white transition-colors cursor-pointer"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{editingStock ? 'Save Changes' : 'Publish Product'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
