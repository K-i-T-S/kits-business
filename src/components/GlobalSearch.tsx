import { Package, Users, UserCircle, Search, X, Clock } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useApp } from '@/context/AppContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type ProductResult = {
  type: 'product';
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
};

type CustomerResult = {
  type: 'customer';
  id: string;
  name: string;
  email: string | null;
};

type EmployeeResult = {
  type: 'employee';
  id: string;
  name: string;
  role: string;
  email: string | null;
};

export type SearchResult = ProductResult | CustomerResult | EmployeeResult;

const MAX_PER_CATEGORY = 5;
const RECENT_KEY = 'kits_recent_searches';
const MAX_RECENT = 8;

function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string): void {
  const trimmed = query.trim();
  if (!trimmed) return;
  try {
    const existing = getRecentSearches().filter((s) => s !== trimmed);
    localStorage.setItem(RECENT_KEY, JSON.stringify([trimmed, ...existing].slice(0, MAX_RECENT)));
  } catch {
    // localStorage full — ignore
  }
}

function fuzzyMatch(value: string | null | undefined, query: string): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  const q = query.toLowerCase();
  if (v.includes(q)) return true;
  // All query chars appear in order
  let qi = 0;
  for (let i = 0; i < v.length && qi < q.length; i++) {
    if (v[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

// ── Result item component ────────────────────────────────────────────────────

interface ResultItemProps {
  result: SearchResult;
  isHighlighted: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

function ResultItem({ result, isHighlighted, onClick, onMouseEnter }: ResultItemProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isHighlighted && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isHighlighted]);

  if (result.type === 'product') {
    return (
      <button
        ref={ref}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-start transition-colors ${
          isHighlighted ? 'bg-white/10' : 'hover:bg-white/10'
        }`}
        role="option"
        aria-selected={isHighlighted}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 flex-shrink-0">
          <Package className="h-4 w-4 text-indigo-400" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{result.name}</p>
          <p className="text-xs text-white/50">
            ${result.price.toFixed(2)} &middot; {result.stock_quantity} in stock
          </p>
        </div>
      </button>
    );
  }

  if (result.type === 'customer') {
    return (
      <button
        ref={ref}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-start transition-colors ${
          isHighlighted ? 'bg-white/10' : 'hover:bg-white/10'
        }`}
        role="option"
        aria-selected={isHighlighted}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 flex-shrink-0">
          <Users className="h-4 w-4 text-sky-400" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{result.name}</p>
          <p className="text-xs text-white/50 truncate">{result.email ?? 'No email'}</p>
        </div>
      </button>
    );
  }

  // employee
  return (
    <button
      ref={ref}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-start transition-colors ${
        isHighlighted ? 'bg-white/10' : 'hover:bg-white/10'
      }`}
      role="option"
      aria-selected={isHighlighted}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 flex-shrink-0">
        <UserCircle className="h-4 w-4 text-purple-400" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{result.name}</p>
        <p className="text-xs text-white/50 truncate capitalize">{result.role}</p>
      </div>
    </button>
  );
}

// ── Category header ──────────────────────────────────────────────────────────

interface CategoryHeaderProps {
  label: string;
}

function CategoryHeader({ label }: CategoryHeaderProps) {
  return (
    <div className="px-4 pt-3 pb-1">
      <span className="text-white/40 text-xs uppercase tracking-wider font-semibold">{label}</span>
    </div>
  );
}

// ── Main GlobalSearch component ───────────────────────────────────────────────

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const { products, customers, employees } = useApp();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state and load recent searches when dialog opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setDebouncedQuery('');
      setHighlightedIndex(-1);
      setRecentSearches(getRecentSearches());
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Debounce query → debouncedQuery (200ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setHighlightedIndex(-1);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Build results from in-memory data
  const results: SearchResult[] = (() => {
    if (!debouncedQuery.trim()) return [];

    const q = debouncedQuery.trim();

    const productResults: ProductResult[] = products
      .filter(
        (p) =>
          fuzzyMatch(p.name, q) ||
          fuzzyMatch(p.sku, q) ||
          fuzzyMatch(p.barcode, q) ||
          fuzzyMatch(p.category, q),
      )
      .slice(0, MAX_PER_CATEGORY)
      .map((p) => ({
        type: 'product' as const,
        id: p.id ?? '',
        name: p.name,
        price: p.variants[0]?.price ?? 0,
        stock_quantity: p.variants[0]?.stock ?? 0,
      }));

    const customerResults: CustomerResult[] = customers
      .filter(
        (c) =>
          fuzzyMatch(c.name, q) ||
          fuzzyMatch(c.email, q) ||
          fuzzyMatch(c.phone, q),
      )
      .slice(0, MAX_PER_CATEGORY)
      .map((c) => ({
        type: 'customer' as const,
        id: c.id,
        name: c.name,
        email: c.email ?? null,
      }));

    const employeeResults: EmployeeResult[] = employees
      .filter(
        (e) =>
          fuzzyMatch(e.name, q) ||
          fuzzyMatch(e.email, q) ||
          fuzzyMatch(e.role, q),
      )
      .slice(0, MAX_PER_CATEGORY)
      .map((e) => ({
        type: 'employee' as const,
        id: e.id,
        name: e.name,
        role: e.role,
        email: e.email || null,
      }));

    return [...productResults, ...customerResults, ...employeeResults];
  })();

  const handleSelect = useCallback(
    (result: SearchResult) => {
      if (debouncedQuery.trim()) {
        saveRecentSearch(debouncedQuery.trim());
      }
      onClose();
      const destinations: Record<SearchResult['type'], string> = {
        product: '/inventory',
        customer: '/customers',
        employee: '/employees',
      };
      void navigate(destinations[result.type]);
    },
    [navigate, onClose, debouncedQuery],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!results.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        // Use find to avoid object-injection-sink lint warning on variable index access
        const idx = highlightedIndex >= 0 ? highlightedIndex : 0;
        const target = results.find((_, i) => i === idx) ?? results.find(() => true);
        if (target) handleSelect(target);
      }
    },
    [results, highlightedIndex, handleSelect],
  );

  // Close on Escape key (document level)
  useEffect(() => {
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keyup', onKeyUp);
    return () => document.removeEventListener('keyup', onKeyUp);
  }, [open, onClose]);

  if (!open) return null;

  // Derive group arrays for display (order: products, customers, employees)
  const productResults = results.filter((r): r is ProductResult => r.type === 'product');
  const customerResults = results.filter((r): r is CustomerResult => r.type === 'customer');
  const employeeResults = results.filter((r): r is EmployeeResult => r.type === 'employee');

  // Flat ordered list matching the rendered order — used for keyboard index mapping
  const flatOrder = [...productResults, ...customerResults, ...employeeResults];

  const isEmpty = debouncedQuery.trim().length > 0 && results.length === 0;
  const isIdle = debouncedQuery.trim().length === 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4"
      aria-modal="true"
      role="dialog"
      aria-label="Global search"
    >
      {/* Backdrop */}
      <button
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
        onClick={onClose}
        aria-label="Close search"
        tabIndex={-1}
      />

      {/* Modal panel */}
      <div className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden flex flex-col max-h-[70vh]">
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Search className="h-5 w-5 text-white/40 flex-shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search products, customers, employees..."
            className="flex-1 bg-transparent text-white placeholder:text-white/40 text-sm focus:outline-none"
            dir="auto"
            aria-label="Search"
            aria-autocomplete="list"
            aria-controls="search-results"
            aria-activedescendant={
              highlightedIndex >= 0 ? `search-result-${highlightedIndex}` : undefined
            }
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-white/40 hover:text-white/70 transition-colors flex-shrink-0"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center text-xs bg-white/10 px-1.5 py-0.5 rounded text-white/30 font-mono flex-shrink-0">
            Esc
          </kbd>
        </div>

        {/* Results / empty states */}
        <div
          id="search-results"
          role="listbox"
          aria-label="Search results"
          className="overflow-y-auto flex-1"
        >
          {isIdle && recentSearches.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-white/40">
              <Search className="h-8 w-8 opacity-40" aria-hidden="true" />
              <p className="text-sm">Start typing to search&hellip;</p>
              <p className="text-xs text-white/25">Products, customers, employees</p>
            </div>
          )}

          {isIdle && recentSearches.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                <span className="text-white/40 text-xs uppercase tracking-wider font-semibold">Recent</span>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem(RECENT_KEY);
                    setRecentSearches([]);
                  }}
                  className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((recent) => (
                <button
                  key={recent}
                  type="button"
                  onClick={() => setQuery(recent)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-start hover:bg-white/10 transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 flex-shrink-0">
                    <Clock className="h-4 w-4 text-white/30" aria-hidden="true" />
                  </div>
                  <span className="text-sm text-white/60 truncate">{recent}</span>
                </button>
              ))}
            </div>
          )}

          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-white/40">
              <p className="text-sm">No results for &ldquo;{debouncedQuery}&rdquo;</p>
              <p className="text-xs text-white/25">Try a different keyword</p>
            </div>
          )}

          {productResults.length > 0 && (
            <div>
              <CategoryHeader label="Products" />
              {productResults.map((result) => {
                const index = flatOrder.indexOf(result);
                return (
                  <ResultItem
                    key={result.id}
                    result={result}
                    isHighlighted={highlightedIndex === index}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  />
                );
              })}
            </div>
          )}

          {customerResults.length > 0 && (
            <div>
              <CategoryHeader label="Customers" />
              {customerResults.map((result) => {
                const index = flatOrder.indexOf(result);
                return (
                  <ResultItem
                    key={result.id}
                    result={result}
                    isHighlighted={highlightedIndex === index}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  />
                );
              })}
            </div>
          )}

          {employeeResults.length > 0 && (
            <div>
              <CategoryHeader label="Employees" />
              {employeeResults.map((result) => {
                const index = flatOrder.indexOf(result);
                return (
                  <ResultItem
                    key={result.id}
                    result={result}
                    isHighlighted={highlightedIndex === index}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  />
                );
              })}
            </div>
          )}

          {/* Keyboard hint footer */}
          {results.length > 0 && (
            <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/10 mt-1">
              <span className="flex items-center gap-1.5 text-xs text-white/30">
                <kbd className="bg-white/10 px-1 rounded font-mono text-white/30">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1.5 text-xs text-white/30">
                <kbd className="bg-white/10 px-1 rounded font-mono text-white/30">↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1.5 text-xs text-white/30">
                <kbd className="bg-white/10 px-1 rounded font-mono text-white/30">Esc</kbd>
                close
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
