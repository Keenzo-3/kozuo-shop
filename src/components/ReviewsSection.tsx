import { useState } from 'react';
import { Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import type { ReviewItem } from '../types/store';

interface ReviewsSectionProps {
  reviews: ReviewItem[];
  isAdmin: boolean;
  onAddReview: () => void;
  onEditReview: (review: ReviewItem) => void;
  onDeleteReview: (reviewId: string) => void;
}

export function ReviewsSection({
  reviews,
  isAdmin,
  onAddReview,
  onEditReview,
  onDeleteReview,
}: ReviewsSectionProps) {
  const [zoomedProof, setZoomedProof] = useState<string | null>(null);

  const avgRating =
    reviews.length > 0
      ? (
          reviews.reduce((sum, r) => sum + (r.rating || 5), 0) / reviews.length
        ).toFixed(1)
      : '5.0';

  return (
    <section
      id="reviews"
      className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-14 border-t border-white/[0.08] space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#3B82F6]">
            Buyer Reviews &amp; Vouches
          </p>
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-white">
              Verified Deal Feedback
            </h2>
            <span className="inline-flex items-center gap-1.5 text-sm font-mono-tabular text-amber-400">
              <Star className="w-4 h-4 fill-amber-400" />
              <span>{avgRating}</span>
              <span className="text-[#9CA3AF] font-sans text-xs">
                · {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
              </span>
            </span>
          </div>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={onAddReview}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white/[0.06] hover:bg-[#2563EB] text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Review</span>
          </button>
        )}
      </div>

      {reviews.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {reviews.map((rev) => (
            <article
              key={rev.id}
              className="h-full p-5 rounded-xl bg-[#12141C] border border-white/[0.08] flex flex-col gap-3.5"
            >
              {/* Rating + Channel Metadata */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-0.5 text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${
                        i < rev.rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-[#374151]'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[11px] font-medium text-[#9CA3AF]">
                  Via {rev.dealChannel}
                </span>
              </div>

              {/* Quote */}
              <p className="text-sm text-[#D1D5DB] leading-relaxed flex-1">
                &ldquo;{rev.comment}&rdquo;
              </p>

              {/* Optional Proof Screenshot */}
              {rev.proofImageUrl && (
                <button
                  type="button"
                  onClick={() => setZoomedProof(rev.proofImageUrl)}
                  className="aspect-[16/9] w-full rounded-lg overflow-hidden bg-[#0A0B10] border border-white/[0.06] cursor-pointer"
                  title="View deal proof screenshot"
                >
                  <img
                    src={rev.proofImageUrl}
                    alt={`${rev.buyerName} deal proof`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover hover:scale-[1.03] transition-transform"
                  />
                </button>
              )}

              {/* Buyer & Item Bought */}
              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {rev.buyerName}
                  </p>
                  <p className="text-[11px] text-[#9CA3AF] truncate">
                    {rev.itemLabel}
                  </p>
                </div>

                {isAdmin && !rev.id.startsWith('preview-') && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditReview(rev)}
                      className="p-1.5 rounded bg-white/[0.04] hover:bg-[#2563EB]/25 text-[#93C5FD] cursor-pointer"
                      aria-label="Edit review"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteReview(rev.id)}
                      className="p-1.5 rounded bg-white/[0.04] hover:bg-rose-500/20 text-[#9CA3AF] hover:text-rose-400 cursor-pointer"
                      aria-label="Delete review"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="p-8 rounded-xl bg-[#12141C] border border-white/[0.08] text-center text-sm text-[#9CA3AF]">
          No buyer reviews posted yet.
        </div>
      )}

      {zoomedProof && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setZoomedProof(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Deal proof preview"
        >
          <div
            className="relative max-w-2xl w-full bg-[#12141C] border border-white/10 rounded-xl p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomedProof(null)}
              aria-label="Close proof preview"
              className="absolute top-4 right-4 p-2 rounded-lg bg-black/70 text-white hover:bg-black cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={zoomedProof}
              alt="Deal proof"
              referrerPolicy="no-referrer"
              className="w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </section>
  );
}
