import { useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FolderCode,
  Gamepad2,
  Images,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Zap,
} from 'lucide-react';
import {
  deriveAutoStockStatus,
  getStatusToneClass,
  isItemSold,
  isRestockingStatus,
  type StockItem,
} from '../types/store';

interface StockCardProps {
  item: StockItem;
  isAdmin: boolean;
  onSelect: (item: StockItem) => void;
  onEdit: (item: StockItem) => void;
  onQuickUpdate: (item: StockItem, nextStatus: string, nextCount: number) => void;
  onMarkSold: (item: StockItem) => void;
  onRestoreAvailable: (item: StockItem) => void;
  onDelete: (item: StockItem) => void;
}

export function StockCard({
  item,
  isAdmin,
  onSelect,
  onEdit,
  onQuickUpdate,
  onMarkSold,
  onRestoreAvailable,
  onDelete,
}: StockCardProps) {
  const [imgError, setImgError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isCodmAccount = item.category === 'CODM ACCOUNT';
  const isClean = item.accountGroup === 'Clean';
  const sold = isItemSold(item);
  const restocking = isRestockingStatus(item.status);
  const photoCount = item.galleryImages?.length || (item.imageUrl ? 1 : 0);

  const statusTextColor = getStatusToneClass(item.status);

  return (
    <article className="group h-full bg-[#12141C] border border-white/[0.08] rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.16]">
      {/* 4:3 Image Frame */}
      <button
        type="button"
        onClick={() => onSelect(item)}
        className="relative aspect-[4/3] w-full bg-[#0C0E14] overflow-hidden text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB]"
      >
        {!imgError && item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={`${item.title} showcase`}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${
              sold ? 'opacity-45 grayscale' : ''
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#131622] to-[#0A0C12] px-4 text-center">
            <Gamepad2 className="w-8 h-8 text-[#3B82F6]/60" />
            <span className="font-mono-tabular text-xs text-[#6B7280]">
              {item.code}
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#12141C]/80 via-transparent to-transparent" />
      </button>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col gap-3">
        {/* Clean Unboxed Metadata Line (Zero-Pill Discipline) */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <span className="uppercase tracking-wider font-semibold text-[#9CA3AF]">
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
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{item.accountGroup}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-[#60A5FA] truncate">
                <FolderCode className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{item.fileType || 'Files'}</span>
              </span>
            )}
          </div>
          <span className="font-mono-tabular text-[#6B7280] shrink-0">
            {item.code}
          </span>
        </div>

        {/* Title & Summary */}
        <div>
          <button
            type="button"
            onClick={() => onSelect(item)}
            className="text-left w-full cursor-pointer group/title"
          >
            <h3 className="font-display font-bold text-base text-white leading-snug line-clamp-1 min-h-[1.375rem] group-hover/title:text-[#60A5FA] transition-colors">
              {item.title}
            </h3>
          </button>
          <p className="mt-1 text-sm text-[#9CA3AF] line-clamp-1 min-h-[1.25rem]">
            {item.bindSummary ||
              item.description ||
              'Tap View More Details for full product details'}
          </p>
        </div>

        {/* Quantity / One-Time Buy + Photo Count Line */}
        <div className="flex items-center justify-between gap-2 text-xs text-[#9CA3AF]">
          <span className="font-mono-tabular">
            {isCodmAccount
              ? sold
                ? 'One-Time Buy · 0 left'
                : restocking
                ? 'One-Time Buy · Restocking'
                : 'One-Time Buy · 1 Account'
              : sold
              ? 'Qty: 0 left'
              : `Stock: ${item.stockCount} left`}
          </span>
          <div className="flex items-center gap-2.5 shrink-0">
            {item.autoDelivery && !sold && !restocking && (
              <span
                className="inline-flex items-center gap-1 text-emerald-400 font-medium"
                title="Instant Auto-Delivery upon wallet purchase"
              >
                <Zap className="w-3 h-3" />
                <span>Instant</span>
              </span>
            )}
            {photoCount > 1 && (
              <span className="inline-flex items-center gap-1 text-[#9CA3AF]">
                <Images className="w-3.5 h-3.5" />
                <span>{photoCount} photos</span>
              </span>
            )}
          </div>
        </div>

        {/* Price + Stock Status + View More Details CTA */}
        <div className="mt-auto pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span
              className={`block font-mono-tabular text-base font-semibold ${
                sold ? 'line-through text-[#6B7280]' : 'text-white'
              }`}
            >
              {item.priceLabel}
            </span>
            <span
              className={`block text-[11px] font-semibold truncate ${statusTextColor}`}
            >
              {item.status}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onSelect(item)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.06] hover:bg-[#2563EB] text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>View More Details</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Owner-Only Quick Controls */}
        {isAdmin && (
          <div className="pt-2.5 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              {!isCodmAccount && !sold && (
                <div className="inline-flex items-center gap-1 bg-white/[0.04] rounded-md px-1.5 py-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      const nextCount = Math.max(0, item.stockCount - 1);
                      const nextStatus = deriveAutoStockStatus(
                        item.category,
                        item.status,
                        nextCount
                      );
                      onQuickUpdate(item, nextStatus, nextCount);
                    }}
                    className="p-1 text-[#9CA3AF] hover:text-white cursor-pointer"
                    aria-label="Decrease stock"
                    title="Decrease stock by 1 (auto-updates status)"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-mono-tabular px-1 text-[#E5E7EB]">
                    {item.stockCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const nextCount = item.stockCount + 1;
                      const nextStatus = deriveAutoStockStatus(
                        item.category,
                        item.status,
                        nextCount
                      );
                      onQuickUpdate(item, nextStatus, nextCount);
                    }}
                    className="p-1 text-[#9CA3AF] hover:text-white cursor-pointer"
                    aria-label="Increase stock"
                    title="Increase stock by 1 (auto-updates status)"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              )}

              {sold || restocking ? (
                <button
                  type="button"
                  onClick={() => onRestoreAvailable(item)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Mark as In Stock / Available"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Available</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onMarkSold(item)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    title="Mark Sold / Out of Stock and move to Sold tab"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Mark Sold</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onQuickUpdate(item, 'Restocking Soon', 0)
                    }
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    title="Mark as Restocking Soon"
                  >
                    <Clock className="w-3 h-3" />
                    <span>Restock Soon</span>
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onEdit(item)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-[#2563EB]/25 text-[#93C5FD] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
                <span>Edit</span>
              </button>
              {confirmDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete(false);
                    onDelete(item);
                  }}
                  onMouseLeave={() => setConfirmDelete(false)}
                  className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Confirm?
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="p-1.5 rounded-md bg-white/[0.04] hover:bg-rose-500/20 text-[#9CA3AF] hover:text-rose-400 transition-colors cursor-pointer"
                  aria-label={`Delete ${item.title}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
