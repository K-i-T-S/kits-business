import { motion } from 'framer-motion';
import { CheckCircle, ChefHat } from 'lucide-react';

interface QROrderSuccessProps {
  orderNumber: string;
  onDone: () => void;
}

export default function QROrderSuccess({ orderNumber, onDone }: QROrderSuccessProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 p-8 text-center"
      style={{ background: 'var(--qr-bg)' }}
    >
      {/* Animated checkmark */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        className="relative"
      >
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full"
          style={{ background: 'rgba(var(--qr-accent-rgb), 0.15)', border: '2px solid var(--qr-accent)' }}
        >
          <CheckCircle className="h-12 w-12" style={{ color: 'var(--qr-accent)' }} />
        </div>
        {/* Burst rings */}
        {[0, 1].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full"
            style={{ border: '1px solid var(--qr-accent)' }}
            initial={{ scale: 1, opacity: 0.7 }}
            animate={{ scale: 2.5 + i, opacity: 0 }}
            transition={{ duration: 0.8, delay: 0.2 + i * 0.15, ease: 'easeOut' }}
          />
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-2"
      >
        <h2
          className="text-3xl font-bold"
          style={{ fontFamily: 'var(--qr-heading-font)', color: 'var(--qr-text)' }}
        >
          Order Submitted! 🎉
        </h2>
        <p style={{ color: 'var(--qr-text-muted)' }} className="text-sm">
          Your waiter will confirm shortly
        </p>
        <div
          className="mt-2 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
          style={{ background: 'rgba(var(--qr-accent-rgb), 0.15)', color: 'var(--qr-accent)' }}
        >
          <ChefHat className="h-4 w-4" />
          Order #{orderNumber}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="space-y-2 text-center"
      >
        <p className="text-xs" style={{ color: 'var(--qr-text-muted)' }}>
          Our team has received your order and is preparing it with care.
        </p>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        onClick={onDone}
        className="mt-4 w-full max-w-xs rounded-2xl py-4 text-base font-bold transition-all active:scale-95"
        style={{
          background: 'var(--qr-accent)',
          color: 'var(--qr-bg)',
        }}
        whileTap={{ scale: 0.97 }}
      >
        Back to Menu
      </motion.button>
    </motion.div>
  );
}
