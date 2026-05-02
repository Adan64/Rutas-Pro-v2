'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Route } from 'lucide-react';
import { useRutasStore } from '@/store/useRutasStore';

export const LoadingOverlay = () => {
  const { isCalculating } = useRutasStore();

  return (
    <AnimatePresence>
      {isCalculating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[var(--background)]/80 backdrop-blur-md"
        >
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="relative flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="h-24 w-24 rounded-full border-b-2 border-t-2 border-[var(--accent)]"
              />
              <div className="absolute flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface)] shadow-2xl">
                <Route className="text-[var(--accent)]" size={32} />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Calculando Rutas</h2>
              <p className="text-[var(--text-muted)]">Estamos optimizando los trayectos y consultando mapas reales...</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent-hover)] uppercase tracking-widest">
              <Loader2 className="animate-spin" size={14} />
              Procesando datos
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
