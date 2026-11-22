import { useState, type FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Maximize2,
  Pencil,
  Send,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  isItemSold,
  type CustomerInquiryInput,
  type InquiryChannel,
  type SocialLink,
  type StockItem,
  type StoreSettings,
} from '../types/store';
import { SocialIcon } from './SocialIcon';

interface ContactSectionProps {
  settings: StoreSettings;
  socialLinks: SocialLink[];
  stocks: StockItem[];
  isAdmin: boolean;
  onManageLinks: () => void;
  onSubmitInquiry: (input: CustomerInquiryInput) => Promise<void>;
}

export function ContactSection({
  settings,
  socialLinks,
  stocks,
  isAdmin,
  onManageLinks,
  onSubmitInquiry,
}: ContactSectionProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [zoomedLink, setZoomedLink] = useState<SocialLink | null>(null);

  // Direct Support / Inquiry Form state
  const [buyerName, setBuyerName] = useState('');
  const [contactHandle, setContactHandle] = useState('');
  const [preferredChannel, setPreferredChannel] =
    useState<InquiryChannel>('Messenger');
  const [selectedStockCode, setSelectedStockCode] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedOk, setSubmittedOk] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleCopyHandle = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore clipboard block
    }
  };

  const handleInquirySubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!buyerName.trim() || !contactHandle.trim() || !message.trim()) {
      setSubmitError('Please fill in your name, FB/TG handle, and message.');
      return;
    }

    const chosenStock = stocks.find((s) => s.code === selectedStockCode);
    setSubmitting(true);
    try {
      await onSubmitInquiry({
        buyerName,
        contactHandle,
        preferredChannel,
        stockCode: chosenStock ? chosenStock.code : 'GENERAL',
        stockTitle: chosenStock ? chosenStock.title : 'General Support Inquiry',
        message,
      });
      setSubmittedOk(true);
      setBuyerName('');
      setContactHandle('');
      setSelectedStockCode('');
      setMessage('');
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Unable to send inquiry right now.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const activeChoices = stocks.filter((s) => !isItemSold(s));

  return (
    <section
      id="contact"
      className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 border-t border-white/[0.08] space-y-10"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Contact Support Heading & Clean/Not Clean Guide */}
        <div className="lg:col-span-5 space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#3B82F6]">
              Contact Support · Direct Messenger &amp; Telegram
            </p>
            <h2 className="mt-2 font-display font-bold text-2xl sm:text-3xl text-white text-balance">
              {settings.contactHeading}
            </h2>
            <p className="mt-2.5 text-sm text-[#9CA3AF] leading-relaxed">
              {settings.contactNote}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="p-4 rounded-xl bg-[#12141C] border border-white/[0.08]">
              <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                CODM Account · Clean (One-Time Buy)
              </p>
              <p className="mt-1.5 text-xs text-[#9CA3AF] leading-relaxed">
                {settings.cleanGuide}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#12141C] border border-white/[0.08]">
              <p className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                CODM Account · Not Clean (One-Time Buy)
              </p>
              <p className="mt-1.5 text-xs text-[#9CA3AF] leading-relaxed">
                {settings.notCleanGuide}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Official Channels + Scannable QR Codes */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#9CA3AF]">
              Official Contact Channels &amp; QR Codes
            </h3>
            {isAdmin && (
              <button
                type="button"
                onClick={onManageLinks}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-white transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Social Links
              </button>
            )}
          </div>

          {socialLinks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {socialLinks.map((link) => (
                <div
                  key={link.id}
                  className="h-full p-5 rounded-xl bg-[#12141C] border border-white/[0.08] flex flex-col justify-between gap-4 hover:border-white/[0.16] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-[#2563EB]/15 text-[#60A5FA] flex items-center justify-center shrink-0">
                        <SocialIcon platform={link.platform} className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {link.label}
                        </p>
                        <p className="text-xs text-[#9CA3AF] truncate">
                          {link.handle || link.platform}
                        </p>
                      </div>
                    </div>
                    {link.handle && (
                      <button
                        type="button"
                        onClick={() => handleCopyHandle(link.id, link.handle)}
                        className="p-1.5 rounded-md text-[#6B7280] hover:text-white hover:bg-white/[0.06] transition-colors shrink-0 cursor-pointer"
                        aria-label={`Copy ${link.handle}`}
                        title="Copy handle"
                      >
                        {copiedId === link.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Scannable QR Code Block */}
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-[#0C0E14] border border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => setZoomedLink(link)}
                      className="bg-white p-2 rounded-lg shrink-0 relative group/qr cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB]"
                      title="Click to enlarge QR code"
                      aria-label={`Enlarge ${link.platform} QR code`}
                    >
                      <QRCodeSVG
                        value={link.url}
                        size={84}
                        level="M"
                        bgColor="#FFFFFF"
                        fgColor="#090A0F"
                      />
                    </button>
                    <div className="min-w-0 space-y-1.5">
                      <p className="text-xs font-semibold text-white">
                        Scan to message
                      </p>
                      <p className="text-[11px] text-[#9CA3AF] leading-snug">
                        Point your phone camera here to open {link.platform} directly.
                      </p>
                      <button
                        type="button"
                        onClick={() => setZoomedLink(link)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#60A5FA] hover:text-white transition-colors cursor-pointer"
                      >
                        <Maximize2 className="w-3 h-3" />
                        <span>Enlarge QR</span>
                      </button>
                    </div>
                  </div>

                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full px-3.5 py-2.5 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors"
                  >
                    <span>Open {link.platform}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-[#12141C] border border-white/[0.08] text-center space-y-2">
              <p className="text-sm text-[#9CA3AF]">
                No social contact links added yet.
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={onManageLinks}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer"
                >
                  Add Social Link
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Direct Store Inquiry Form (Delivers straight to Owner Studio Inbox) */}
      <div className="p-6 rounded-xl bg-[#12141C] border border-white/[0.08] grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#3B82F6]">
            Direct Store Inquiry
          </p>
          <h3 className="font-display font-bold text-xl text-white">
            Send a Question or Reserve Request
          </h3>
          <p className="text-xs text-[#9CA3AF] leading-relaxed">
            Not sure if an item is available or want to reserve Restocking Soon drops? Leave a direct message here and the store owner will see it right away.
          </p>
        </div>

        <form
          onSubmit={handleInquirySubmit}
          className="lg:col-span-8 space-y-3"
        >
          {submitError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {submitError}
            </div>
          )}
          {submittedOk && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>
                Inquiry received! Kozuo will reply on your preferred Messenger / Facebook / Telegram account.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              maxLength={BLUEPRINT_LIMITS.INQUIRY.BUYER_NAME_MAX}
              value={buyerName}
              onChange={(e) => {
                setBuyerName(e.target.value);
                setSubmittedOk(false);
              }}
              placeholder="Your Name"
              className="h-10 px-3.5 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
            />
            <input
              type="text"
              required
              maxLength={BLUEPRINT_LIMITS.INQUIRY.HANDLE_MAX}
              value={contactHandle}
              onChange={(e) => setContactHandle(e.target.value)}
              placeholder="Your FB Name or @Telegram"
              className="h-10 px-3.5 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
            />
            <select
              value={preferredChannel}
              onChange={(e) =>
                setPreferredChannel(e.target.value as InquiryChannel)
              }
              className="h-10 px-3.5 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white focus:outline-none focus:border-[#3B82F6]"
            >
              <option value="Messenger">Reply via Messenger</option>
              <option value="Facebook">Reply via Facebook</option>
              <option value="Telegram">Reply via Telegram</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={selectedStockCode}
              onChange={(e) => setSelectedStockCode(e.target.value)}
              className="h-10 px-3.5 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white focus:outline-none focus:border-[#3B82F6]"
            >
              <option value="">General Inquiry / Support</option>
              {activeChoices.map((s) => (
                <option key={s.id} value={s.code}>
                  [{s.code}] {s.title} ({s.status})
                </option>
              ))}
            </select>

            <input
              type="text"
              required
              maxLength={BLUEPRINT_LIMITS.INQUIRY.MESSAGE_MAX}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your question, stock code, or restock request..."
              className="h-10 sm:col-span-2 px-3.5 rounded-lg bg-[#0C0E14] border border-white/[0.1] text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto h-10 inline-flex items-center justify-center gap-2 px-5 rounded-lg text-xs sm:text-sm font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white transition-colors cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Send Inquiry</span>
            </button>
          </div>
        </form>
      </div>

      {/* Enlarged QR Code Modal */}
      {zoomedLink && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setZoomedLink(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${zoomedLink.platform} QR Code`}
        >
          <div
            className="w-full max-w-xs bg-[#12141C] border border-white/10 rounded-xl p-6 text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">
                {zoomedLink.label}
              </span>
              <button
                type="button"
                onClick={() => setZoomedLink(null)}
                aria-label="Close QR modal"
                className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-white/[0.06] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-white p-4 rounded-xl inline-block mx-auto">
              <QRCodeSVG
                value={zoomedLink.url}
                size={210}
                level="M"
                bgColor="#FFFFFF"
                fgColor="#090A0F"
              />
            </div>
            <p className="text-xs text-[#9CA3AF] break-all">
              {zoomedLink.handle || zoomedLink.url}
            </p>
            <a
              href={zoomedLink.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors"
            >
              <span>Open {zoomedLink.platform}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
