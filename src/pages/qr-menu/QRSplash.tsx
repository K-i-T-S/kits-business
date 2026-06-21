import { motion } from 'framer-motion';

interface QRSplashProps {
  palette: string;
}

export default function QRSplash({ palette }: QRSplashProps) {
  return (
    <motion.div
      key="splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      className={`qr-${palette} qr-menu-root fixed inset-0 z-50 flex flex-col items-center justify-center`}
      style={{ background: 'var(--qr-splash-bg)' }}
    >
      {/* Expanding ring animations */}
      <div className="relative flex items-center justify-center">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              border: '1px solid var(--qr-accent)',
              width: 80 + i * 60,
              height: 80 + i * 60,
            }}
            initial={{ opacity: 0.6, scale: 0.6 }}
            animate={{ opacity: 0, scale: 1.8 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.4,
              ease: 'easeOut',
            }}
          />
        ))}

        {/* KiTS wordmark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative z-10 flex flex-col items-center gap-3"
        >
          <motion.div
            className="text-5xl font-black tracking-[0.2em]"
            style={{
              color: 'var(--qr-accent)',
              fontFamily: 'var(--qr-heading-font)',
              textShadow: '0 0 40px rgba(var(--qr-accent-rgb), 0.5)',
            }}
          >
            KiTS
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-xs tracking-[0.3em] uppercase"
            style={{ color: 'var(--qr-text-muted)' }}
          >
            Digital Menu
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
