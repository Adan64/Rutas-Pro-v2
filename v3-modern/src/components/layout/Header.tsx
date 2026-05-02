import React from 'react';
import { Truck } from 'lucide-react';
import { useRutasStore } from '@/store/useRutasStore';

export const Header = () => {
  const { rawClients, zones, numDrivers } = useRutasStore();
  const hasData = rawClients.length > 0;

  return (
    <header className="sticky top-0 z-[100] w-full border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--cyan)] shadow-lg">
            <Truck className="text-white" size={24} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight text-white">
                Rutas<span className="bg-gradient-to-r from-white to-[var(--cyan)] bg-clip-text text-transparent">Pro</span>
              </span>
              <span className="rounded-full border border-[var(--accent)] bg-[var(--accent-glow)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-hover)] uppercase tracking-wider">
                v3.0
              </span>
            </div>
          </div>
        </div>

        {hasData && (
          <div className="hidden items-center gap-2 sm:flex">
            <Pill color="blue">{rawClients.length} clientes</Pill>
            <Pill color="purple">{Object.keys(zones).length} zonas</Pill>
            <Pill color="green">{numDrivers} repartidores</Pill>
          </div>
        )}
      </div>
    </header>
  );
};

const Pill = ({ children, color }: { children: React.ReactNode; color: 'blue' | 'purple' | 'green' | 'amber' }) => {
  const colors = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${colors[color]}`}>
      {children}
    </span>
  );
};
