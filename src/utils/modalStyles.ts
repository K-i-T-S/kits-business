export const modalStyles = {
  backdrop: {
    backgroundColor: 'rgba(10, 14, 26, 0.85)',
    backdropFilter: 'blur(8px)' as const,
  },
  content: {
    backgroundColor: 'rgba(11, 15, 36, 0.98)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '1.5rem',
    color: '#f8faff',
    boxShadow: '0 35px 85px rgba(2, 3, 12, 0.6)',
    backdropFilter: 'blur(28px)' as const,
  },
  backdropClass: 'fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto',
  contentClass: 'w-full p-6',
};

export const getModalStyles = (maxWidth?: string, customStyles?: React.CSSProperties) => ({
  backdrop: modalStyles.backdrop,
  backdropClass: modalStyles.backdropClass,
  content: {
    ...modalStyles.content,
    maxWidth: maxWidth || 'md',
    ...customStyles,
  },
  contentClass: modalStyles.contentClass,
});
