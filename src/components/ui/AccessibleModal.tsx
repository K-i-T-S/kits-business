import { X } from 'lucide-react';
import React, { useRef, useEffect } from 'react';

import { useModalAccessibility } from '../../hooks/useModalAccessibility';

interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export default function AccessibleModal({
  isOpen,
  onClose,
  title,
  children,
  className = '',
}: AccessibleModalProps) {
  const modalRef = useModalAccessibility(isOpen);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(10, 14, 26, 0.85)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className={`relative w-full max-w-md w-full mx-4 p-6 ${className}`}
        style={{
          backgroundColor: 'rgba(11, 15, 36, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '1.5rem',
          color: '#f8faff',
          boxShadow: '0 35px 85px rgba(2, 3, 12, 0.6)',
          backdropFilter: 'blur(28px)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 id="modal-title" className="text-xl font-semibold text-white">
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white rounded-full hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div id="modal-description" className="text-white/80">
          {children}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-white/80 bg-white/10 rounded-md hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
