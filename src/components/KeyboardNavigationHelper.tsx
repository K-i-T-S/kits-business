import { Keyboard, Info } from 'lucide-react';
import React, { useEffect, useState } from 'react';

export default function KeyboardNavigationHelper() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentFocus, setCurrentFocus] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show helper on Alt+K
      if (e.altKey && e.key === 'k') {
        e.preventDefault();
        setIsVisible(!isVisible);
      }

      // Track current focus element
      if (document.activeElement) {
        const tagName = document.activeElement.tagName.toLowerCase();
        const id = document.activeElement.id;
        const className = document.activeElement.className;
        setCurrentFocus(`${tagName}${id ? '#' + id : ''}${className ? '.' + className.split(' ')[0] : ''}`);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  const keyboardShortcuts = [
    { key: 'Tab', description: 'Navigate between focusable elements' },
    { key: 'Shift + Tab', description: 'Navigate backwards' },
    { key: 'Enter / Space', description: 'Activate buttons and links' },
    { key: 'Escape', description: 'Close modals and dropdowns' },
    { key: 'Arrow Keys', description: 'Navigate within lists and menus' },
    { key: 'Home / End', description: 'Jump to start/end of lists' },
    { key: 'Alt + K', description: 'Toggle this keyboard helper' },
    { key: 'Alt + H', description: 'Toggle high contrast mode' },
  ];

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 left-4 z-40">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-gray-700 text-white p-1.5 rounded-full shadow-lg hover:bg-gray-600 transition-colors"
          aria-label="Show keyboard shortcuts"
        >
          <Keyboard className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 bg-slate-900 rounded-lg shadow-xl p-3 w-64 border border-white/10">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-white flex items-center gap-1 text-sm">
          <Keyboard className="w-3 h-3" />
          Keyboard Shortcuts
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-white/40 hover:text-white"
          aria-label="Close keyboard helper"
        >
          ×
        </button>
      </div>

      <div className="space-y-1 mb-2">
        {keyboardShortcuts.map((shortcut, index) => (
          <div key={index} className="flex justify-between items-center text-xs">
            <kbd className="px-1 py-0.5 bg-white/10 border border-white/20 rounded text-xs font-mono text-white/80">
              {shortcut.key}
            </kbd>
            <span className="text-white/60 text-xs">{shortcut.description}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 pt-2">
        <div className="flex items-center gap-1 text-xs text-white/50">
          <Info className="w-3 h-3" />
          <div>
            Focus: <code className="bg-white/10 px-1 rounded text-xs text-white/80">{currentFocus || 'None'}</code>
          </div>
        </div>
      </div>
    </div>
  );
}
