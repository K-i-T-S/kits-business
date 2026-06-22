import { Copy, Loader2, Wand2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { useAIContentGenerator, type AIMenuDescription } from '@/hooks/useAIContentGenerator';

interface AIContentGeneratorModalProps {
  itemName: string;
  onGenerate: (descriptions: AIMenuDescription) => void;
  onClose: () => void;
}

/**
 * Modal for generating bilingual menu descriptions via AI
 * Allows user to input ingredients, generate EN/AR descriptions, preview, and apply
 */
export function AIContentGeneratorModal({ itemName, onGenerate, onClose }: AIContentGeneratorModalProps) {
  const [ingredients, setIngredients] = useState('');
  const [cuisine, setCuisine] = useState('Lebanese');
  const [generated, setGenerated] = useState<AIMenuDescription | null>(null);
  const [editEn, setEditEn] = useState('');
  const [editAr, setEditAr] = useState('');

  const { mutate: generate, isPending } = useAIContentGenerator();

  const handleGenerate = async () => {
    if (!ingredients.trim()) {
      toast.error('Please enter at least one ingredient');
      return;
    }

    const ingredientList = ingredients
      .split(',')
      .map(i => i.trim())
      .filter(i => i.length > 0);

    if (ingredientList.length === 0) {
      toast.error('Please enter at least one ingredient');
      return;
    }

    generate(
      { itemName, ingredients: ingredientList, cuisine },
      {
        onSuccess: (data) => {
          setGenerated(data);
          setEditEn(data.en);
          setEditAr(data.ar);
          toast.success('Descriptions generated successfully');
        },
        onError: (error) => {
          console.error('Generation error:', error);
          toast.error(error instanceof Error ? error.message : 'Failed to generate descriptions');
        },
      },
    );
  };

  const handleApply = () => {
    if (!editEn.trim() || !editAr.trim()) {
      toast.error('Both descriptions are required');
      return;
    }
    onGenerate({ en: editEn.trim(), ar: editAr.trim() });
    onClose();
  };

  const handleCopyEn = async () => {
    await navigator.clipboard.writeText(editEn);
    toast.success('English description copied');
  };

  const handleCopyAr = async () => {
    await navigator.clipboard.writeText(editAr);
    toast.success('Arabic description copied');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10 bg-slate-900 shadow-2xl max-h-[90dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 flex-shrink-0">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-indigo-400" />
            Generate Menu Description
          </h2>
          <button onClick={() => void onClose()} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Item name display */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/60">Menu Item</label>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white font-medium">
              {itemName}
            </div>
          </div>

          {!generated ? (
            <>
              {/* Ingredients input */}
              <div>
                <label htmlFor="ingredients" className="mb-1.5 block text-xs font-medium text-white/60">
                  Main Ingredients (comma-separated) *
                </label>
                <textarea
                  id="ingredients"
                  rows={3}
                  value={ingredients}
                  onChange={e => setIngredients(e.target.value)}
                  placeholder="e.g. grilled sea bass, lemon butter, fresh herbs, potatoes"
                  className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none resize-none"
                />
              </div>

              {/* Cuisine type */}
              <div>
                <label htmlFor="cuisine" className="mb-1.5 block text-xs font-medium text-white/60">
                  Cuisine Type
                </label>
                <input
                  id="cuisine"
                  type="text"
                  value={cuisine}
                  onChange={e => setCuisine(e.target.value)}
                  placeholder="e.g. Lebanese, Italian, American"
                  className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none"
                />
              </div>

              {/* Info */}
              <p className="text-xs text-white/50 bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-2.5">
                AI will generate appetizing English and Arabic descriptions based on the ingredients and cuisine type you provide.
              </p>
            </>
          ) : (
            <>
              {/* Generated descriptions */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">English Description</label>
                <div className="relative">
                  <textarea
                    rows={3}
                    value={editEn}
                    onChange={e => setEditEn(e.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none resize-none"
                  />
                  <button
                    onClick={() => { void handleCopyEn(); }}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors"
                    aria-label="Copy English"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">Arabic Description</label>
                <div className="relative">
                  <textarea
                    dir="rtl"
                    rows={3}
                    value={editAr}
                    onChange={e => setEditAr(e.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none resize-none"
                  />
                  <button
                    onClick={() => { void handleCopyAr(); }}
                    className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors"
                    aria-label="Copy Arabic"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Edit note */}
              <p className="text-xs text-white/50 bg-white/5 border border-white/10 rounded-lg p-2.5">
                You can edit both descriptions above. Click "Apply & Save" when satisfied.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-5 py-4 flex-shrink-0 space-y-2">
          {!generated ? (
            <>
              <button
                onClick={() => { void handleGenerate(); }}
                disabled={isPending || !ingredients.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-3 text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Generate with AI
                  </>
                )}
              </button>
              <button
                onClick={() => { void onClose(); }}
                className="w-full rounded-xl border border-white/20 bg-white/5 py-3 text-sm font-semibold text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { void handleApply(); }}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Apply & Save
              </button>
              <button
                onClick={() => { setGenerated(null); setEditEn(''); setEditAr(''); }}
                className="w-full rounded-xl border border-white/20 bg-white/5 py-3 text-sm font-semibold text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              >
                Generate Again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
