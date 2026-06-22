/**
 * Table3D — Individual restaurant table rendered as a 3D mesh.
 *
 * Uses react-three-fiber + drei. Pulsing animation is driven by useFrame
 * (avoids the @react-spring/three peer-dep which is not installed; behaviour
 * is identical — sinusoidal emissive intensity loop at 800 ms period).
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Float } from '@react-three/drei';
import type { MeshStandardMaterial } from 'three';

import { RESTAURANT_COLORS } from '@/constants/restaurantColors';
import type { RestaurantTable } from '@/types/restaurant';

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Constants ─────────────────────────────────────────────────────────────────

/** Period of the alert pulse in seconds. */
const PULSE_PERIOD = 0.8;

// ── Component ─────────────────────────────────────────────────────────────────

export function Table3D({ table, orderInfo, onSelect, isSelected }: Table3DProps) {
  const matRef = useRef<MeshStandardMaterial>(null);

  // Determine effective status. A table with a very slow order (>15 min) gets
  // the 'alert' colour even if the DB status is still 'occupied'.
  const isAlert = orderInfo !== undefined && orderInfo.minutesSince > 15;
  const colorKey: keyof typeof RESTAURANT_COLORS =
    isAlert ? 'alert' : table.status;

  // Narrowed colour values (only status keys have fill / emissive / glow)
  // eslint-disable-next-line security/detect-object-injection
  const colorEntry = RESTAURANT_COLORS[colorKey] as { fill: string; emissive: string; glow: string };
  const fillColor = colorEntry.fill;
  const emissiveColor = colorEntry.emissive;

  // Pulsing emissive animation — sine wave between 0.2 and 0.8 for alerts,
  // static 0.3 for all other statuses. Runs entirely on the render loop without
  // a spring library.
  useFrame(({ clock }) => {
    if (!matRef.current) return;
    if (isAlert) {
      const t = clock.getElapsedTime();
      // sin oscillates -1 → 1; map to 0.2 → 0.8
      matRef.current.emissiveIntensity =
        0.5 + 0.3 * Math.sin((2 * Math.PI * t) / PULSE_PERIOD);
    } else {
      matRef.current.emissiveIntensity = isSelected ? 0.5 : 0.3;
    }
  });

  // Map table position (0–100 percentage space) to Three.js world coordinates
  // centred on origin, spanning ±10 units.
  const posX = (table.x / 100) * 20 - 10;
  const posZ = (table.y / 100) * 20 - 10;

  return (
    <group
      position={[posX, 0, posZ]}
      onClick={() => onSelect(table.id)}
    >
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

      {/* Selection ring — slightly larger plane below the table surface */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.09, 0]}>
          <planeGeometry args={[3, 2.4]} />
          <meshBasicMaterial color="#6366f1" opacity={0.5} transparent />
        </mesh>
      )}

      {/* Table number label */}
      <Text
        position={[0, 0.2, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.4}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {table.number.toString()}
      </Text>

      {/* Order badge — floats above the table when an active order exists */}
      {orderInfo && (
        <Float speed={1.5} rotationIntensity={0} floatIntensity={0.3}>
          <group position={[0, 1.5, 0]}>
            {/* Badge backing plane */}
            <mesh>
              <planeGeometry args={[2.4, 0.7]} />
              <meshBasicMaterial color="#111827" opacity={0.9} transparent />
            </mesh>
            {/* Badge text: $total · covers · minutes */}
            <Text
              position={[0, 0, 0.02]}
              fontSize={0.22}
              color="#f59e0b"
              anchorX="center"
              anchorY="middle"
            >
              {`$${orderInfo.total.toFixed(0)} · ${orderInfo.covers}pp · ${orderInfo.minutesSince}min`}
            </Text>
          </group>
        </Float>
      )}
    </group>
  );
}

export default Table3D;
