'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, MapPin } from 'lucide-react';

interface ZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  count: number;
}

export const ZoneModal = ({ isOpen, onClose, onConfirm, count }: ZoneModalProps) => {
  const [name, setName] = useState('');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl shadow-black/50"
        >
          <div className="mb-6 flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)] ring-8 ring-[var(--accent)]/5">
              <MapPin size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Nueva Zona</h2>
              <p className="text-sm text-[var(--text-muted)]">Asignar {count} clientes seleccionados</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--text-faint)] uppercase tracking-wider">Nombre de la Zona</label>
              <input 
                autoFocus
                type="text" 
                placeholder="Ej: Zona Norte, Sector A..." 
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if(e.key === 'Enter' && name) onConfirm(name); }}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-white outline-none ring-[var(--accent)]/30 transition-all focus:ring-2 focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex gap-3">
              <button 
                onClick={onClose}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <X size={18} /> Cancelar
              </button>
              <button 
                disabled={!name.trim()}
                onClick={() => onConfirm(name)}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Check size={18} /> Asignar
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
