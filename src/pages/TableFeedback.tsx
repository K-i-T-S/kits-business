import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { supabase } from '@/utils/supabaseClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TenantPublic {
  id: string;
  name: string;
  brand_logo_url: string | null;
}

type PageState = 'loading' | 'error' | 'form' | 'submitted';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUICK_TAGS = [
  'Great food',
  'Fast service',
  'Friendly staff',
  'Good value',
  'Will return',
  'Needs improvement',
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TableFeedback() {
  const { tenantSlug = '', tableId } = useParams<{ tenantSlug: string; tableId?: string }>();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [tenant, setTenant] = useState<TenantPublic | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [overallRating, setOverallRating] = useState<number>(0);
  const [foodRating, setFoodRating] = useState<number>(0);
  const [serviceRating, setServiceRating] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load tenant by slug
  useEffect(() => {
    if (!tenantSlug) {
      setErrorMsg('Invalid feedback link.');
      setPageState('error');
      return;
    }

    const fetchTenant = async () => {
      try {
        const { data, error } = await supabase
          .from('tenants')
          .select('id, name, brand_logo_url')
          .eq('tenant_slug', tenantSlug)
          .single();

        if (error || !data) {
          setErrorMsg('Restaurant not found. Please check your link.');
          setPageState('error');
          return;
        }
        setTenant(data as TenantPublic);
        setPageState('form');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load restaurant info.');
        setPageState('error');
      }
    };

    void fetchTenant();
  }, [tenantSlug]);

  // Toggle a quick tag
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  // Build the full comment: tags appended to free text
  const buildComment = (): string | null => {
    const parts: string[] = [];
    if (selectedTags.length > 0) {
      parts.push(selectedTags.join(', '));
    }
    if (comment.trim()) {
      parts.push(comment.trim());
    }
    return parts.length > 0 ? parts.join(' | ') : null;
  };

  const handleSubmit = async () => {
    if (!tenant) return;
    if (overallRating === 0) {
      setSubmitError('Please select an overall rating.');
      return;
    }

    setSubmitError(null);
    setSubmitting(true);

    try {
      const effectiveTableId =
        tableId && tableId !== 'general' ? tableId : null;

      const { error } = await supabase.from('restaurant_table_feedback').insert({
        tenant_id: tenant.id,
        table_id: effectiveTableId,
        overall_rating: overallRating,
        food_rating: foodRating > 0 ? foodRating : null,
        service_rating: serviceRating > 0 ? serviceRating : null,
        comment: buildComment(),
      });

      if (error) {
        setSubmitError(error.message);
        return;
      }

      setPageState('submitted');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render: Loading ──────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-indigo-500" />
      </div>
    );
  }

  // ── Render: Error ────────────────────────────────────────────────────────
  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-sm w-full rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-2xl mb-3">😕</p>
          <h1 className="text-white text-lg font-semibold mb-2">Page Not Found</h1>
          <p className="text-white/50 text-sm">{errorMsg}</p>
        </div>
      </div>
    );
  }

  // ── Render: Thank-you ────────────────────────────────────────────────────
  if (pageState === 'submitted') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center py-12 animate-fade-in">
          <div className="text-5xl mb-4">🙏</div>
          <h2 className="text-white text-xl font-semibold">Thank you!</h2>
          <p className="text-white/50 mt-2">Your feedback helps us improve</p>
        </div>
      </div>
    );
  }

  // ── Render: Form ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center px-4 py-10">
      {/* Brand header */}
      <header className="mb-8 flex flex-col items-center gap-3">
        {tenant?.brand_logo_url ? (
          <img
            src={tenant.brand_logo_url}
            alt={tenant?.name ?? 'Restaurant logo'}
            className="h-14 w-14 rounded-2xl object-contain shadow-lg"
          />
        ) : (
          <div className="h-14 w-14 rounded-2xl bg-indigo-600/30 flex items-center justify-center text-2xl">
            🍽️
          </div>
        )}
        <h1 className="text-white text-xl font-bold">{tenant?.name}</h1>
        {tableId && tableId !== 'general' && (
          <p className="text-white/40 text-xs">Table {tableId}</p>
        )}
      </header>

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl p-6 space-y-6">
        {/* Overall rating */}
        <div>
          <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3 text-center">
            Overall Experience
          </p>
          <div className="flex gap-3 justify-center">
            {([1, 2, 3, 4, 5] as const).map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setOverallRating(star)}
                className={`text-3xl transition-transform ${
                  star <= overallRating ? 'text-amber-400 scale-110' : 'text-white/20'
                }`}
                aria-label={`${star} star${star > 1 ? 's' : ''}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        {/* Secondary ratings */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-white/50 text-xs text-center mb-2">Food</p>
            <div className="flex gap-1 justify-center">
              {([1, 2, 3, 4, 5] as const).map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFoodRating(foodRating === star ? 0 : star)}
                  className={`text-lg transition-colors ${
                    star <= foodRating ? 'text-amber-400' : 'text-white/20'
                  }`}
                  aria-label={`Food ${star} star${star > 1 ? 's' : ''}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-white/50 text-xs text-center mb-2">Service</p>
            <div className="flex gap-1 justify-center">
              {([1, 2, 3, 4, 5] as const).map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setServiceRating(serviceRating === star ? 0 : star)}
                  className={`text-lg transition-colors ${
                    star <= serviceRating ? 'text-amber-400' : 'text-white/20'
                  }`}
                  aria-label={`Service ${star} star${star > 1 ? 's' : ''}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick tags */}
        <div>
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">
            What stood out?
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  selectedTags.includes(tag)
                    ? 'border-indigo-400/60 bg-indigo-500/25 text-indigo-300'
                    : 'border-white/15 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Free text comment */}
        <div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us more... (optional)"
            rows={3}
            className="bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 w-full text-sm placeholder:text-white/30 resize-none focus:outline-none focus:border-indigo-400/50"
          />
        </div>

        {/* Error */}
        {submitError && (
          <p className="text-red-400 text-xs text-center">{submitError}</p>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={() => { void handleSubmit(); }}
          disabled={submitting}
          className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-3 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 shadow-lg shadow-indigo-500/20"
        >
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </div>

      {/* Footer */}
      <p className="mt-6 text-white/20 text-xs">Powered by KiTS</p>
    </div>
  );
}
