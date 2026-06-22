/**
 * FloorPlan3D — isometric 3D restaurant floor plan canvas.
 *
 * Scene contents:
 *   - OrthographicCamera locked to isometric angle, pan + zoom only
 *   - Atmospheric fog for depth
 *   - Dark floor plane + grid helper
 *   - Hemisphere light (atmosphere) + directional light (shadows)
 *   - One Table3D per RestaurantTable
 *   - Empty-state overlay when tables array is empty
 */

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera, OrbitControls } from '@react-three/drei';
import { PCFShadowMap, MOUSE, TOUCH } from 'three';
import { useNavigate } from 'react-router-dom';

import type { RestaurantTable } from '@/types/restaurant';
import { Table3D } from './Table3D';
import type { OrderInfo } from './Table3D';

// ── Re-export so RestaurantHub can import from this file ───────────────────────
export type { OrderInfo };

// ── Props ──────────────────────────────────────────────────────────────────────

interface FloorPlan3DProps {
  tables: RestaurantTable[];
  orders: OrderInfo[];
  selectedTableId?: string;
  onTableSelect: (tableId: string) => void;
  isLoading?: boolean;
}

// ── Loading overlay ────────────────────────────────────────────────────────────

function LoadingOverlay() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0a0f1e]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-indigo-500" />
        <span className="text-sm text-white/40">Loading floor plan…</span>
      </div>
    </div>
  );
}

// ── Empty state (no tables configured yet) ─────────────────────────────────────

function EmptyFloor({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 pointer-events-none z-10">
      <div
        className="flex flex-col items-center gap-4 rounded-2xl border px-8 py-8 pointer-events-auto"
        style={{ background: 'rgba(10,15,30,0.85)', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <div className="h-12 w-12 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-white/80">No tables set up yet</p>
          <p className="mt-1 text-xs text-white/40">Go to Table Management to add your floor plan</p>
        </div>
        <button
          onClick={onNavigate}
          className="mt-1 rounded-xl px-5 py-2 text-xs font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)' }}
        >
          Set Up Tables
        </button>
      </div>
    </div>
  );
}

// ── Scene content (must live inside Canvas) ────────────────────────────────────

interface SceneProps {
  tables: RestaurantTable[];
  orders: OrderInfo[];
  selectedTableId?: string;
  onTableSelect: (tableId: string) => void;
}

function Scene({ tables, orders, selectedTableId, onTableSelect }: SceneProps) {
  return (
    <>
      {/* Atmospheric fog for depth */}
      <fog attach="fog" args={['#0a0f1e', 40, 80]} />

      {/* Camera — isometric, locked rotation, pan + zoom only */}
      <OrthographicCamera
        makeDefault
        position={[15, 25, 15]}
        zoom={28}
        near={0.1}
        far={1000}
      />
      <OrbitControls
        target={[0, 0, 0]}
        makeDefault
        enableRotate={false}
        enablePan={true}
        screenSpacePanning={true}
        minZoom={15}
        maxZoom={60}
        mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
        touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
      />

      {/* Atmosphere: hemisphere light — indigo sky, navy ground */}
      <hemisphereLight args={['#4f46e5', '#0a0f1e', 0.15]} />

      {/* Base ambient — very dark */}
      <ambientLight intensity={0.2} />

      {/* Primary directional light — casts shadows, top-right angle */}
      <directionalLight
        position={[12, 20, 8]}
        intensity={0.6}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />

      {/* Dark polished floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#080d1a" roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Grid overlay — subtle depth cue */}
      <gridHelper args={[40, 40, '#1e2a3a', '#111827']} position={[0, -0.07, 0]} />

      {/* Tables */}
      <Suspense fallback={null}>
        {tables.map((table) => (
          <Table3D
            key={table.id}
            table={table}
            orderInfo={orders.find((o) => o.table_id === table.id)}
            onSelect={onTableSelect}
            isSelected={selectedTableId === table.id}
          />
        ))}
      </Suspense>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function FloorPlan3D({
  tables,
  orders,
  selectedTableId,
  onTableSelect,
  isLoading = false,
}: FloorPlan3DProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="h-full w-full" style={{ minHeight: 500 }}>
        <LoadingOverlay />
      </div>
    );
  }

  return (
    <div
      className="relative h-full w-full flex-1"
      style={{ background: '#0a0f1e', minHeight: 500 }}
    >
      {/* Empty state overlay — shown before Canvas so 3D still renders beneath */}
      {tables.length === 0 && (
        <EmptyFloor onNavigate={() => void navigate('/restaurant/tables')} />
      )}

      <Canvas shadows={{ type: PCFShadowMap }}>
        <Scene
          tables={tables}
          orders={orders}
          selectedTableId={selectedTableId}
          onTableSelect={onTableSelect}
        />
      </Canvas>
    </div>
  );
}

export default FloorPlan3D;
