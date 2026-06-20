import { useEffect, useRef, useState } from 'react';

export function useCountUp(target: number, duration = 1400): number {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let startTime: number | null = null;

    const animate = (timestamp: number): void => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo curve
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCurrent(target * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return current;
}
