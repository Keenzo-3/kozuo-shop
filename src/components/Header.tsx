import type { User } from 'firebase/auth';
import { LogIn, Plus, ShoppingBag, Wallet, X } from 'lucide-react';
import {
  formatPhp,
  type StockCategory,
  type StoreSettings,
  type UserProfile,
} from '../types/store';

interface HeaderProps {
  settings: StoreSettings;
  showAnnouncement: boolean;
  onDismissAnnouncement: () => void;
  activeCategory: 'ALL' | 'SOLD' | StockCategory;
  onSelectCategory: (cat: 'ALL' | 'SOLD' | StockCategory) => void;
  onOpenOwnerStudio: () => void;
  onOpenAuth: () => void;
  onOpenOrders: () => void;
  onOpenTopUp: () => void;
  user: User | null;
  profile: UserProfile | null;
  orderCount: number;
  isAdmin: boolean;
}

export function Header({
  settings,
  showAnnouncement,
  onDismissAnnouncement,
  activeCategory,
  onSelectCategory,
  onOpenOwnerStudio,
  onOpenAuth,
  onOpenOrders,
  onOpenTopUp,
  user,
  profile,
  orderCount,
  isAdmin,
}: HeaderProps) {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleCategoryNav = (cat: 'ALL' | 'SOLD' | StockCategory) => {
    onSelectCategory(cat);
    scrollToSection('catalog');
  };

  return (
    <div className="sticky top-0 z-40 bg-[#090A0F]/95 backdrop-blur-md border-b border-white/[0.08]">
      {showAnnouncement && settings.announcementText.trim().length > 0 && (
        <div className="h-9 border-b border-white/[0.06] bg-[#10121A] px-4 flex items-center justify-center relative">
          <p className="text-xs text-[#9CA3AF] truncate max-w-4xl pr-8 text-center">
            {settings.announcementText}
          </p>
          <button
            type="button"
            onClick={onDismissAnnouncement}
            aria-label="Dismiss announcement"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#6B7280] hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <header className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-5">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#catalog"
          onClick={(e) => {
            e.preventDefault();
            handleCategoryNav('ALL');
          }}
          className="inline-flex items-center gap-2 sm:gap-2.5 whitespace-nowrap shrink-0 min-w-0 focus-visible:outline-2 focus-visible:outline-[#2563EB] rounded-md"
        >
          <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#2563EB] text-white font-display font-extrabold text-sm sm:text-base flex items-center justify-center shrink-0">
            {settings.storeName.charAt(0).toUpperCase() || 'K'}
          </span>
          <span className="font-display font-extrabold text-sm sm:text-base tracking-tight text-white truncate">
            {settings.storeName}
            {settings.accentWord && (
              <span className="text-[#3B82F6] ml-1">{settings.accentWord}</span>
            )}
          </span>
        </a>

        {/* Zone 2: Single-Line Navigation Links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-5 text-sm font-medium"
        >
          <button
            type="button"
            onClick={() => handleCategoryNav('ALL')}
            className={`whitespace-nowrap shrink-0 py-1 border-b transition-colors cursor-pointer ${
              activeCategory === 'ALL'
                ? 'text-white border-[#3B82F6]'
                : 'text-[#9CA3AF] border-transparent hover:text-white'
            }`}
          >
            All Stocks
          </button>
          <button
            type="button"
            onClick={() => handleCategoryNav('CODM ACCOUNT')}
            className={`whitespace-nowrap shrink-0 py-1 border-b transition-colors cursor-pointer ${
              activeCategory === 'CODM ACCOUNT'
                ? 'text-white border-[#3B82F6]'
                : 'text-[#9CA3AF] border-transparent hover:text-white'
            }`}
          >
            CODM Accounts
          </button>
          <button
            type="button"
            onClick={() => handleCategoryNav('CODM&MLBB FILES')}
            className={`whitespace-nowrap shrink-0 py-1 border-b transition-colors cursor-pointer ${
              activeCategory === 'CODM&MLBB FILES'
                ? 'text-white border-[#3B82F6]'
                : 'text-[#9CA3AF] border-transparent hover:text-white'
            }`}
          >
            Files
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('tutorials')}
            className="whitespace-nowrap shrink-0 py-1 text-[#9CA3AF] border-b border-transparent hover:text-white transition-colors cursor-pointer"
          >
            Tutorials &amp; FAQ
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('contact')}
            className="whitespace-nowrap shrink-0 py-1 text-[#9CA3AF] border-b border-transparent hover:text-white transition-colors cursor-pointer"
          >
            Support
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={onOpenOwnerStudio}
              className="whitespace-nowrap shrink-0 py-1 text-[#60A5FA] border-b border-transparent hover:text-white transition-colors cursor-pointer"
            >
              Manage Store
            </button>
          )}
        </nav>

        {/* Zone 3: Account Login / Wallet Balance & My Orders Shortcut */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {user ? (
            <>
              <button
                type="button"
                onClick={onOpenAuth}
                aria-label="Open wallet balance and account"
                className="inline-flex items-center gap-1 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-[#12141C] hover:bg-white/[0.08] border border-white/[0.1] text-[11px] sm:text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5 text-[#60A5FA] shrink-0" />
                <span className="text-[#9CA3AF] hidden md:inline">Balance:</span>
                <span className="font-mono-tabular font-semibold text-white">
                  {formatPhp(profile?.balance ?? 0)}
                </span>
              </button>
              <button
                type="button"
                onClick={onOpenOrders}
                aria-label="Open My Orders"
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-[#12141C] hover:bg-white/[0.08] border border-white/[0.1] text-[11px] sm:text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-[#60A5FA] shrink-0" />
                <span>My Orders</span>
                {orderCount > 0 && (
                  <span className="font-mono-tabular text-[11px] font-semibold text-[#60A5FA]">
                    ({orderCount})
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={onOpenTopUp}
                aria-label="Top up via GCash"
                className="hidden sm:inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Top Up</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Login</span>
            </button>
          )}
        </div>
      </header>
    </div>
  );
}
