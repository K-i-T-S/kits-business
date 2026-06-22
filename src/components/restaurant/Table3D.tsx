import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Float } from '@react-three/drei';
import type { MeshStandardMaterial } from 'three';

import { RESTAURANT_COLORS } from '@/constants/restaurantColors';
import type { RestaurantTable } from '@/types/restaurant';

export interface OrderInfo {
  table_id: string;
  total: number;
  covers: number;
  minutesSince: number;
}

interface Table3DProps {
  table: RestaurantTable;
  orderInfo?: OrderInfo;
  onSelect: (tableId: string) => void;
  isSelected: boolean;
}

const PULSE_PERIOD = 0.8;

export function Table3D({ table, orderInfo, onSelect, isSelected }: Table3DProps) {
  const matRef = useRef<MeshStandardMaterial>(null);

  const isAlert = orderInfo !== undefined && orderInfo.minutesSince > 15;
  const colorKey: keyof typeof RESTAURANT_COLORS = isAlert ? 'alert' : table.status;

  // eslint-disable-next-line security/detect-object-injection
  const colorEntry = RESTAURANT_COLORS[colorKey] as { fill: string; emissive: string; glow: string };
  const fillColor = colorEntry.fill;
  const emissiveColor = colorEntry.emissive;

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    if (isAlert) {
      const t = clock.getElapsedTime();
      matRef.current.emissiveIntensity = 0.5 + 0.3 * Math.sin((2 * Math.PI * t) / PULSE_PERIOD);
    } else {
      matRef.current.emissiveIntensity = isSelected ? 0.5 : 0.3;
    }
  });

  const posX = (table.x / 100) * 20 - 10;
  const posZ = (table.y / 100) * 20 - 10;

  return (
    <group position={[posX, 0, posZ]} onClick={() => onSelect(table.id)}>
      {/* Table surface */}
      <mesh castShadow>
        <boxGeometry args={[2.5, 0.15, 1.8]} />
        <meshStandardMaterial
          ref={matRef}
          color={fillColor}
          emissive={emissiveColor}
          emissiveIntensity={0.3}
          roughness={0.3}
          metalness={0.5}
        />
      </mesh>

      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.09, 0]}>
          <planeGeometry args={[3, 2.4]} />
          <meshBasicMaterial color="#6366f1" opacity={0.5} transparent />
        </mesh>
      )}

 {/* Table number — HTML overlay, no font worker needed */}
      <Html
        position={[0, 0.15, 0]}
        center

        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          fontWeight: 700,
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}>
          T{table.number}
        </div>
      </Html>

      {/* Order badge */}
      {orderInfo && (
        <Float speed={1.5} rotationIntensity={0} floatIntensity={0.3}>
          <group position={[0, 0.9, 0]}>
            <mesh>
              <planeGeometry args={[1.2, 0.35]} />
              <meshBasicMaterial color="#111827" opacity={0.9} transparent />
            </mesh>
            <Html
              position={[0, 0, 0.01]}
              center

              style={{ pointerEvents: 'none' }}
            >
              <div style={{
                color: '#f59e0b',
                fontFamily: 'system-ui, sans-serif',
                fontSize: '10px',
                fontWeight: 600,
                textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                userSelect: 'none',
                whiteSpace: 'nowrap',
              }}>
                ${orderInfo.total.toFixed(0)} · {orderInfo.covers}pp · {orderInfo.minutesSince}min
              </div>
            </Html>
          </group>
        </Float>
      )}
    </group>
  );
}

export default Table3D;