'use client';

import dynamic from 'next/dynamic';

export const MapWrapper = dynamic(
  () => import('./DynamicMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[var(--bg2)] text-[var(--text-faint)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border2)] border-t-[var(--accent)]" />
          <span className="text-sm font-medium">Cargando mapa interactivo...</span>
        </div>
      </div>
    )
  }
);
