import { useState } from 'react';
import { Settings, Image, Barcode, QrCode, Plus, Trash2, Eye } from 'lucide-react';
import type { ReceiptTemplate, ReceiptField } from '../types/pos';

interface ReceiptCustomizationModalProps {
  isOpen: boolean;
  templates: ReceiptTemplate[];
  currentTemplate?: ReceiptTemplate;
  onSelectTemplate: (template: ReceiptTemplate) => void;
  onSaveTemplate: (template: ReceiptTemplate) => void;
  onCancel: () => void;
}

export default function ReceiptCustomizationModal({ 
  isOpen, 
  templates, 
  currentTemplate,
  onSelectTemplate,
  onSaveTemplate,
  onCancel 
}: ReceiptCustomizationModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(currentTemplate?.id || '');
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReceiptTemplate>(
    currentTemplate || {
      id: '',
      name: 'Default Receipt',
      header: 'Thank you for your purchase!',
      footer: 'Please come again!',
      includeLogo: true,
      includeBarcode: true,
      includeQrCode: false,
      customFields: [],
      isActive: true
    }
  );

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || editingTemplate;

  const addCustomField = () => {
    const newField: ReceiptField = {
      id: Date.now().toString(),
      label: 'Custom Field',
      type: 'text',
      value: '',
      position: 'footer'
    };
    
    setEditingTemplate({
      ...editingTemplate,
      customFields: [...editingTemplate.customFields, newField]
    });
  };

  const updateCustomField = (fieldId: string, updates: Partial<ReceiptField>) => {
    setEditingTemplate({
      ...editingTemplate,
      customFields: editingTemplate.customFields.map(field =>
        field.id === fieldId ? { ...field, ...updates } : field
      )
    });
  };

  const removeCustomField = (fieldId: string) => {
    setEditingTemplate({
      ...editingTemplate,
      customFields: editingTemplate.customFields.filter(field => field.id !== fieldId)
    });
  };

  const handleSaveTemplate = () => {
    const templateToSave = {
      ...editingTemplate,
      id: editingTemplate.id || Date.now().toString()
    };
    onSaveTemplate(templateToSave);
    setIsEditing(false);
  };

  const handleSelectTemplate = () => {
    if (selectedTemplateId) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        onSelectTemplate(template);
      }
    }
  };

  const previewReceipt = () => {
    // This would generate a preview of the receipt
    console.log('Preview receipt with template:', selectedTemplate);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="glass-panel w-full max-w-2xl overflow-y-auto p-6">
        <h2 className="text-xl font-semibold text-white mb-6">Receipt Customization</h2>
        
        <div className="space-y-6">
          {/* Template Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white/80">Select Template</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    setSelectedTemplateId(template.id);
                    setEditingTemplate(template);
                    setIsEditing(false);
                  }}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    selectedTemplateId === template.id
                      ? 'border-emerald-400 bg-emerald-500/20'
                      : 'border-white/30 bg-white/10 hover:border-white/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">{template.name}</div>
                      <div className="text-xs text-white/60">
                        {template.customFields.length} custom fields
                      </div>
                    </div>
                    {template.isActive && (
                      <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Template Editor */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white/80">Template Settings</h3>
              <div className="flex gap-2">
                <button
                  onClick={previewReceipt}
                  className="p-2 rounded-lg border border-white/30 bg-white/20 text-white/80 hover:bg-white/30"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="p-2 rounded-lg border border-emerald-400 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isEditing ? (
              <div className="space-y-4">
                {/* Basic Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Template Name</label>
                    <input
                      type="text"
                      value={editingTemplate.name}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                      className="w-full rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-white text-sm focus:border-white/50 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-white/80">
                      <input
                        type="checkbox"
                        checked={editingTemplate.includeLogo}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, includeLogo: e.target.checked })}
                        className="rounded border-white/30 bg-white/20"
                      />
                      <Image className="w-4 h-4" />
                      Include Logo
                    </label>
                    <label className="flex items-center gap-2 text-sm text-white/80">
                      <input
                        type="checkbox"
                        checked={editingTemplate.includeBarcode}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, includeBarcode: e.target.checked })}
                        className="rounded border-white/30 bg-white/20"
                      />
                      <Barcode className="w-4 h-4" />
                      Include Barcode
                    </label>
                    <label className="flex items-center gap-2 text-sm text-white/80">
                      <input
                        type="checkbox"
                        checked={editingTemplate.includeQrCode}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, includeQrCode: e.target.checked })}
                        className="rounded border-white/30 bg-white/20"
                      />
                      <QrCode className="w-4 h-4" />
                      Include QR Code
                    </label>
                  </div>
                </div>

                {/* Header and Footer */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Header Text</label>
                    <textarea
                      value={editingTemplate.header}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, header: e.target.value })}
                      className="w-full rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-white text-sm focus:border-white/50 focus:outline-none"
                      rows={2}
                      placeholder="Header text for receipt"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Footer Text</label>
                    <textarea
                      value={editingTemplate.footer}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, footer: e.target.value })}
                      className="w-full rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-white text-sm focus:border-white/50 focus:outline-none"
                      rows={2}
                      placeholder="Footer text for receipt"
                    />
                  </div>
                </div>

                {/* Custom Fields */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-white/60">Custom Fields</h4>
                    <button
                      onClick={addCustomField}
                      className="p-1 rounded border border-emerald-400 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {editingTemplate.customFields.map((field) => (
                      <div key={field.id} className="flex items-center gap-2 p-2 rounded-lg border border-white/30 bg-white/10">
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateCustomField(field.id, { label: e.target.value })}
                          placeholder="Label"
                          className="flex-1 rounded border border-white/30 bg-white/20 px-2 py-1 text-white text-xs focus:border-white/50 focus:outline-none"
                        />
                        <select
                          value={field.type}
                          onChange={(e) => updateCustomField(field.id, { type: e.target.value as ReceiptField['type'] })}
                          className="rounded border border-white/30 bg-white/20 px-2 py-1 text-white text-xs focus:border-white/50 focus:outline-none"
                        >
                          <option value="text">Text</option>
                          <option value="date">Date</option>
                          <option value="amount">Amount</option>
                          <option value="custom">Custom</option>
                        </select>
                        <select
                          value={field.position}
                          onChange={(e) => updateCustomField(field.id, { position: e.target.value as ReceiptField['position'] })}
                          className="rounded border border-white/30 bg-white/20 px-2 py-1 text-white text-xs focus:border-white/50 focus:outline-none"
                        >
                          <option value="header">Header</option>
                          <option value="body">Body</option>
                          <option value="footer">Footer</option>
                        </select>
                        <button
                          onClick={() => removeCustomField(field.id)}
                          className="p-1 rounded border border-rose-200/50 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    className="flex-1 rounded-lg bg-gradient-to-r from-emerald-500 to-lime-400 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/40"
                  >
                    Save Template
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-white/30 bg-white/10">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-white">{selectedTemplate.name}</h4>
                    <div className="text-sm text-white/80 mt-1">
                      {selectedTemplate.header}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.includeLogo && (
                      <span className="px-2 py-1 rounded bg-white/20 text-xs text-white">Logo</span>
                    )}
                    {selectedTemplate.includeBarcode && (
                      <span className="px-2 py-1 rounded bg-white/20 text-xs text-white">Barcode</span>
                    )}
                    {selectedTemplate.includeQrCode && (
                      <span className="px-2 py-1 rounded bg-white/20 text-xs text-white">QR Code</span>
                    )}
                  </div>

                  {selectedTemplate.customFields.length > 0 && (
                    <div>
                      <div className="text-xs text-white/60 mb-1">Custom Fields:</div>
                      <div className="space-y-1">
                        {selectedTemplate.customFields.map((field) => (
                          <div key={field.id} className="text-xs text-white/80">
                            {field.label} ({field.type}) - {field.position}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-sm text-white/80">
                    {selectedTemplate.footer}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 rounded-lg border border-white/30 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20"
            >
              Cancel
            </button>
            <button
              onClick={handleSelectTemplate}
              disabled={!selectedTemplateId}
              className="flex-1 rounded-lg bg-gradient-to-r from-emerald-500 to-lime-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Use Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
