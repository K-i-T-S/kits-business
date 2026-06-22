import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Float, RoundedBox } from '@react-three/drei';
import { Color } from 'three';
import type { Group, MeshStandardMaterial, MeshBasicMaterial } from 'three';

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
const TABLE_W = 2.4;
const TABLE_D = 1.5;
const TABLE_H = 0.12;
const TABLE_LEGS_H = 0.65;
const CHAIR_R = 0.28;
const CHAIR_H = 0.05;
const CHAIR_OFFSET = CHAIR_R + 0.18;

// Leg positions (x, z) relative to table centre
const LEG_POSITIONS: ReadonlyArray<[number, number]> = [
  [-TABLE_W / 2 + 0.2, -TABLE_D / 2 + 0.2],
  [TABLE_W / 2 - 0.2, -TABLE_D / 2 + 0.2],
  [-TABLE_W / 2 + 0.2, TABLE_D / 2 - 0.2],
  [TABLE_W / 2 - 0.2, TABLE_D / 2 - 0.2],
];

// Distribute chairs evenly along the two long sides.
// Returns (x, z) offsets relative to table centre at table-surface level.
function buildChairPositions(seats: number): ReadonlyArray<[number, number]> {
  const positions: [number, number][] = [];
  const frontCount = Math.ceil(seats / 2);
  const backCount = seats - frontCount;

  const fSpacing = TABLE_W / (frontCount + 1);
  for (let i = 0; i < frontCount; i++) {
    positions.push([-TABLE_W / 2 + fSpacing * (i + 1), TABLE_D / 2 + CHAIR_OFFSET]);
  }

  const bSpacing = TABLE_W / (backCount + 1);
  for (let i = 0; i < backCount; i++) {
    positions.push([-TABLE_W / 2 + bSpacing * (i + 1), -(TABLE_D / 2 + CHAIR_OFFSET)]);
  }

  return positions;
}

export function Table3D({ table, orderInfo, onSelect, isSelected }: Table3DProps) {
  const groupRef = useRef<Group>(null);
  const matRef = useRef<MeshStandardMaterial>(null);
  const ringMatRef = useRef<MeshBasicMaterial>(null);

  const isAlert = orderInfo !== undefined && orderInfo.minutesSince > 15;
  const colorKey: keyof typeof RESTAURANT_COLORS = isAlert ? 'alert' : table.status;
  // eslint-disable-next-line security/detect-object-injection
  const colorEntry = RESTAURANT_COLORS[colorKey] as { fill: string; emissive: string; glow: string };
  const fillColor = colorEntry.fill;
  const emissiveColor = colorEntry.emissive;

  const chairPositions = useMemo(() => buildChairPositions(table.seats), [table.seats]);

  const chairColor = useMemo(
    () => new Color(fillColor).multiplyScalar(0.55).getStyle(),
    [fillColor],
  );

  // Status halo — point light only for occupied / alert tables
  const pointLightColor = useMemo((): string | null => {
    if (isAlert) return '#ef4444';
    if (table.status === 'occupied') return '#f59e0b';
    return null;
  }, [isAlert, table.status]);

  // Map 0-100 percentage coords → world space [-10, 10]
  const posX = (table.x / 100) * 20 - 10;
  const posZ = (table.y / 100) * 20 - 10;

  const targetScale = isSelected ? 1.05 : 1.0;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Smooth scale lerp — selection bounce
    if (groupRef.current) {
      const s = groupRef.current.scale.x;
      groupRef.current.scale.setScalar(s + (targetScale - s) * 0.12);
    }

    if (!matRef.current) return;

    if (isAlert) {
      matRef.current.emissiveIntensity =
        0.4 + 0.35 * Math.sin((2 * Math.PI * t) / PULSE_PERIOD);
    } else {
      const target = isSelected ? 0.55 : 0.22;
      matRef.current.emissiveIntensity += (target - matRef.current.emissiveIntensity) * 0.08;
    }

    // Selection ring opacity pulse
    if (ringMatRef.current) {
      ringMatRef.current.opacity = 0.35 + 0.2 * Math.sin(t * 2.5);
    }
  });

  const surfaceY = TABLE_LEGS_H + TABLE_H / 2;

  return (
    <group ref={groupRef} position={[posX, 0, posZ]} onClick={() => onSelect(table.id)}>

      {/* Ground shadow for visual depth */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.07, 0]}>
        <planeGeometry args={[TABLE_W + 0.7, TABLE_D + 0.6]} />
        <meshBasicMaterial color="#000000" opacity={0.26} transparent depthWrite={false} />
      </mesh>

      {/* Selection ring — indigo glow plane beneath table */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.055, 0]}>
          <planeGeometry args={[TABLE_W + 0.65, TABLE_D + 0.55]} />
          <meshBasicMaterial
            ref={ringMatRef}
            color="#6366f1"
            opacity={0.45}
            transparent
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Table legs */}
      {LEG_POSITIONS.map(([lx, lz], i) => (
        <mesh key={i} position={[lx, TABLE_LEGS_H / 2, lz]} castShadow>
          <cylinderGeometry args={[0.045, 0.055, TABLE_LEGS_H, 8]} />
          <meshStandardMaterial color="#1a1f2e" roughness={0.5} metalness={0.6} />
        </mesh>
      ))}

      {/* Table surface — slightly bevelled via RoundedBox */}
      <RoundedBox
        args={[TABLE_W, TABLE_H, TABLE_D]}
        radius={0.06}
        smoothness={4}
        position={[0, surfaceY, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          ref={matRef}
          color={fillColor}
          emissive={emissiveColor}
          emissiveIntensity={0.22}
          roughness={0.28}
          metalness={0.45}
        />
      </RoundedBox>

      {/* Chair pads — one per seat, arranged along the two long sides */}
      {chairPositions.map(([cx, cz], i) => (
        <mesh key={i} position={[cx, TABLE_LEGS_H - 0.04, cz]} castShadow>
          <cylinderGeometry args={[CHAIR_R, CHAIR_R, CHAIR_H, 16]} />
          <meshStandardMaterial color={chairColor} roughness={0.6} metalness={0.1} />
        </mesh>
      ))}

      {/* Status halo — dim point light above occupied / alert tables */}
      {pointLightColor !== null && (
        <pointLight
          position={[0, surfaceY + 1.5, 0]}
          intensity={0.18}
          color={pointLightColor}
          distance={4}
          decay={2}
        />
      )}

      {/* Table number HTML overlay */}
      <Html
        position={[0, surfaceY + 0.08, 0]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            color: 'white',
            fontFamily: 'system-ui, sans-serif',
            fontSize: '11px',
            fontWeight: 700,
            textShadow: '0 1px 4px rgba(0,0,0,0.95)',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          T{table.number}
          {table.name ? ` · ${table.name}` : ''}
        </div>
      </Html>

      {/* Order info badge — floats above the table surface */}
      {orderInfo && (
        <Float speed={1.5} rotationIntensity={0} floatIntensity={0.25}>
          <group position={[0, surfaceY + 0.92, 0]}>
            <mesh>
              <planeGeometry args={[1.5, 0.4]} />
              <meshBasicMaterial color="#0d1220" opacity={0.92} transparent />
            </mesh>
            <Html
              position={[0, 0, 0.01]}
              center
              style={{ pointerEvents: 'none' }}
            >
              <div
                style={{
                  color: isAlert ? '#ef4444' : '#f59e0b',
                  fontFamily: 'system-ui, sans-serif',
                  fontSize: '10px',
                  fontWeight: 600,
                  textShadow: '0 1px 3px rgba(0,0,0,0.95)',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                ${orderInfo.total.toFixed(0)} · {orderInfo.covers}pp · {orderInfo.minutesSince}m
              </div>
            </Html>
          </group>
        </Float>
      )}
    </group>
  );
}

export default Table3D;
