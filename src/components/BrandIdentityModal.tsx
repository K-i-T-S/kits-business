import { Building2, Palette, Upload, X, Check, Image, ExternalLink, Sparkles } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useApp } from '../context/AppContext';
import { BRAND } from '../constants/branding';
import { supabase } from '../utils/supabaseClient';

interface Props {
  open: boolean;
  onClose: () => void;
}

const COLOR_PRESETS = [
  { label: 'Indigo', primary: '#6366f1', secondary: '#0ea5e9' },
  { label: 'Emerald', primary: '#10b981', secondary: '#06b6d4' },
  { label: 'Rose', primary: '#f43f5e', secondary: '#f97316' },
  { label: 'Violet', primary: '#8b5cf6', secondary: '#ec4899' },
  { label: 'Amber', primary: '#f59e0b', secondary: '#ef4444' },
  { label: 'Teal', primary: '#14b8a6', secondary: '#6366f1' },
];

export default function BrandIdentityModal({ open, onClose }: Props) {
  const { currentTenant } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [logoPreview, setLogoPreview] = useState<string | null>(currentTenant?.brand_logo_url ?? null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [primary, setPrimary] = useState(currentTenant?.brand_primary ?? '#6366f1');
  const [secondary, setSecondary] = useState(currentTenant?.brand_secondary ?? '#0ea5e9');
  const [tagline, setTagline] = useState(currentTenant?.brand_tagline ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2 MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('File must be an image (PNG, SVG, JPEG)');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const changeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleLogoSelect(changeEvent);
    }
  }, [handleLogoSelect]);

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !currentTenant) return logoPreview;
    setUploadingLogo(true);
    try {
      const ext = logoFile.name.split('.').pop() ?? 'png';
      const path = `${currentTenant.id}/logo.${ext}`;
      const { error } = await supabase.storage
        .from('brand-assets')
        .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
      if (error) throw error;
      const { data } = supabase.storage.from('brand-assets').getPublicUrl(path);
      return data.publicUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Logo upload failed';
      toast.error(msg);
      return logoPreview;
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!currentTenant) return;
    setSaving(true);
    try {
      const logoUrl = await uploadLogo();
      const { error } = await supabase
        .from('tenants')
        .update({
          brand_logo_url: logoUrl,
          brand_primary: primary,
          brand_secondary: secondary,
          brand_tagline: tagline.trim() || null,
        })
        .eq('id', currentTenant.id);
      if (error) throw error;

      // Apply brand colours immediately without page reload
      document.documentElement.style.setProperty('--brand-primary', primary);
      document.documentElement.style.setProperty('--brand-secondary', secondary);

      toast.success('Brand identity saved');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setLogoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!open) return null;

  const previewPrimary = primary;
  const previewSecondary = secondary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-slate-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 border border-indigo-500/30">
              <Palette className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Brand Identity</h2>
              <p className="text-xs text-white/50">Customise your business look and feel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Live Preview */}
          <div>
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Preview</h3>
            <div
              className="rounded-2xl border border-white/10 p-4 flex items-center gap-3"
              style={{ background: `linear-gradient(135deg, ${previewPrimary}30, ${previewSecondary}15, transparent)` }}
            >
              <div
                className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-white/20"
                style={{ background: `${previewPrimary}20` }}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="h-10 w-10 object-contain rounded-lg" />
                ) : (
                  <Building2 className="h-6 w-6 text-white/40" />
                )}
                <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-slate-900" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs uppercase tracking-[0.3em] text-white/50 font-medium">Your Business</div>
                <div className="text-base font-bold text-white truncate">{currentTenant?.name ?? 'Business Name'}</div>
                <div className="text-xs text-white/50 mt-0.5">{tagline || BRAND.tagline}</div>
              </div>
            </div>
            {/* Always-visible KiTS watermark */}
            <div className="mt-2 rounded-xl border border-white/5 bg-white/3 px-3 py-2 flex items-center gap-2">
              <img src="/logo.png" alt="KiTS" className="h-4 w-4 object-contain opacity-60" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <span className="text-xs text-white/40">Powered by <strong className="text-white/60">KiTS</strong> — Khoder's IT Solutions</span>
              <a
                href="https://kits.solutions"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-indigo-400 hover:text-indigo-300 transition-colors"
                aria-label="Visit KiTS"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Logo Upload */}
          <div>
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
              <span className="flex items-center gap-2"><Image className="h-3.5 w-3.5" /> Business Logo</span>
            </h3>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="relative border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-white/20 transition-colors cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="sr-only"
                onChange={handleLogoSelect}
              />
              {logoPreview ? (
                <div className="flex flex-col items-center gap-3">
                  <img src={logoPreview} alt="Logo" className="h-16 w-16 object-contain rounded-xl" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRemoveLogo(); }}
                    className="text-xs text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Remove logo
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-white/40 group-hover:text-white/60 transition-colors">
                  <Upload className="h-8 w-8" />
                  <div>
                    <p className="text-sm font-medium text-white/70">Drop your logo here</p>
                    <p className="text-xs mt-1">PNG, SVG, JPEG · Max 2 MB · Recommended: 200×200px</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Colour Scheme */}
          <div>
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
              <span className="flex items-center gap-2"><Palette className="h-3.5 w-3.5" /> Colour Scheme</span>
            </h3>

            {/* Presets */}
            <div className="flex gap-2 flex-wrap mb-4">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => { setPrimary(preset.primary); setSecondary(preset.secondary); }}
                  title={preset.label}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors text-xs text-white/60 hover:text-white"
                >
                  <span className="flex gap-1">
                    <span className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ backgroundColor: preset.primary }} />
                    <span className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ backgroundColor: preset.secondary }} />
                  </span>
                  {preset.label}
                  {primary === preset.primary && secondary === preset.secondary && (
                    <Check className="h-3 w-3 text-emerald-400" />
                  )}
                </button>
              ))}
            </div>

            {/* Custom pickers */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">Primary Colour</label>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <input
                    type="color"
                    value={primary}
                    onChange={(e) => setPrimary(e.target.value)}
                    className="h-6 w-6 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                  <input
                    type="text"
                    value={primary}
                    onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setPrimary(e.target.value); }}
                    className="flex-1 bg-transparent text-sm text-white/80 focus:outline-none font-mono"
                    maxLength={7}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">Accent Colour</label>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <input
                    type="color"
                    value={secondary}
                    onChange={(e) => setSecondary(e.target.value)}
                    className="h-6 w-6 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                  <input
                    type="text"
                    value={secondary}
                    onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setSecondary(e.target.value); }}
                    className="flex-1 bg-transparent text-sm text-white/80 focus:outline-none font-mono"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Custom Tagline */}
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Custom Tagline</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder={BRAND.tagline}
              maxLength={80}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
            <p className="mt-1 text-xs text-white/30">{tagline.length}/80 characters</p>
          </div>

          {/* KiTS notice */}
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
            <div className="flex gap-3">
              <Sparkles className="h-4 w-4 text-indigo-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-white/60 leading-relaxed">
                <p className="font-medium text-white/80 mb-1">Powered by KiTS — always visible</p>
                The "Powered by KiTS" watermark is always displayed in your sidebar. This is a platform requirement
                and cannot be removed. Upgrade to a Business plan for custom domain + white-label removal.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors rounded-xl hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || uploadingLogo}
            className="px-5 py-2 text-sm font-semibold text-white rounded-xl btn-brand hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {(saving || uploadingLogo) && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {saving || uploadingLogo ? 'Saving…' : 'Save Brand Identity'}
          </button>
        </div>
      </div>
    </div>
  );
}
