/**
 * FloorPlan3D — Canvas wrapper for the 3D isometric restaurant floor plan.
 *
 * Renders an OrthographicCamera scene with:
 *   - Ambient light (dim, sets the scene base brightness)
 *   - Two point lights (indigo + sky-blue) for the luxury brand feel
 *   - A dark navy floor plane
 *   - One Table3D mesh per RestaurantTable
 *
 * Falls back to a loading spinner while data is loading.
 * Passes `null` if tables array is empty (parent decides whether to show
 * an empty-state UI).
 */

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
// 1. Import OrbitControls alongside OrthographicCamera
import { OrthographicCamera, OrbitControls } from '@react-three/drei';
import { PCFShadowMap } from 'three';

import type { RestaurantTable } from '@/types/restaurant';
import { Table3D } from './Table3D';
import type { OrderInfo } from './Table3D';

// ── Types ─────────────────────────────────────────────────────────────────────

export type { OrderInfo };

interface FloorPlan3DProps {
  tables: RestaurantTable[];
  orders: OrderInfo[];
  selectedTableId?: string;
  onTableSelect: (tableId: string) => void;
  isLoading?: boolean;
}

// ── Loading state ─────────────────────────────────────────────────────────────

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

// ── Scene fallback (inside Canvas Suspense boundary) ──────────────────────────

function SceneLoader() {
  return null; 
}

// ── Main component ────────────────────────────────────────────────────────────

export function FloorPlan3D({
  tables,
  orders,
  selectedTableId,
  onTableSelect,
  isLoading = false,
}: FloorPlan3DProps) {
  if (isLoading) {
    return (
      <div className="h-full w-full min-h-[500px]">
        <LoadingOverlay />
      </div>
    );
  }

  return (
    // 2. Swapped 'h-screen' to 'h-full flex-1 min-h-[500px]' to prevent flexbox collapsing
    <div className="relative h-full w-full flex-1" style={{ background: '#0a0f1e', minHeight: '500px' }}>
      <Canvas shadows={{ type: PCFShadowMap }}>
        {/* Isometric orthographic camera — top-down angled view */}
        <OrthographicCamera
          makeDefault
          position={[10, 20, 10]}
          zoom={30}
          near={0.1}
          far={1000}
        />
        
        {/* 3. ADD ORBIT CONTROLS: This forces the camera to look at the tables at [0,0,0] */}
        <OrbitControls target={[0, 0, 0]} makeDefault />

        {/* Lighting */}
        <ambientLight intensity={0.3} />
        {/* Primary: indigo point light */}
        <pointLight
          position={[0, 10, 0]}
          intensity={0.8}
          color="#6366f1"
          castShadow
        />
        {/* Secondary: sky-blue fill light */}
        <pointLight
          position={[10, 10, 10]}
          intensity={0.4}
          color="#0ea5e9"
        />

        {/* Floor plane */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.12, 0]}
          receiveShadow
        >
          <planeGeometry args={[25, 25]} />
          <meshStandardMaterial color="#0a0f1e" roughness={0.9} metalness={0.1} />
        </mesh>

        {/* Tables */}
        <Suspense fallback={<SceneLoader />}>
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
      </Canvas>
    </div>
  );
}

export default FloorPlan3D;