'use client';

import React, { useState } from 'react';
import { Layers, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MAP_TYPES = [
  { id: 'dark', label: 'Modo Oscuro', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
  { id: 'light', label: 'Modo Claro', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
  { id: 'satellite', label: 'Satélite', url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}' },
  { id: 'street', label: 'Calles', url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}' },
  { id: 'terrain', label: 'Terreno', url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}' },
];

export const MapTypeSwitcher = ({ activeType, onTypeChange }: { activeType: string, onTypeChange: (type: any) => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md text-white shadow-xl hover:bg-[var(--card)]"
      >
        <Layers size={18} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            className="absolute right-12 top-0 z-[600] w-48 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl backdrop-blur-xl"
          >
            <div className="p-2 space-y-1">
              {MAP_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => { onTypeChange(type); setIsOpen(false); }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                    activeType === type.id 
                      ? 'bg-[var(--accent)] text-white' 
                      : 'text-[var(--text-muted)] hover:bg-[var(--card)] hover:text-white'
                  }`}
                >
                  {type.label}
                  {activeType === type.id && <Check size={14} />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
