'use client';

import React, { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { parseClientsExcel, downloadTemplate, REQUIRED_COLS } from '@/lib/services/ExcelService';
import { useRutasStore } from '@/store/useRutasStore';
import { motion, AnimatePresence } from 'framer-motion';

export const Step1Upload = () => {
  const { setRawClients, setStep, zones, rawClients, filename } = useRutasStore();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFileAction = useCallback(async (file: File) => {
    try {
      setError(null);
      const result = await parseClientsExcel(file);
      setRawClients(result);
    } catch (err: any) {
      setError(err.message);
    }
  }, [setRawClients]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileAction(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileAction(file);
  };

  const hasData = rawClients.length > 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-4xl space-y-8"
    >
      <div className="space-y-2 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          Cargar archivo de clientes
        </h1>
        <p className="text-lg text-[var(--text-muted)]">
          Subí tu planilla Excel y el sistema organizará las rutas automáticamente.
        </p>
      </div>

      {!hasData ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input')?.click()}
          className={`relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed p-16 text-center transition-all duration-500 ${
            isDragging 
              ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-[0_0_60px_var(--accent-glow)] scale-[1.02]' 
              : 'border-[var(--border2)] bg-[var(--surface)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5'
          }`}
        >
          <input 
            id="file-input" 
            type="file" 
            className="hidden" 
            accept=".xlsx,.xls" 
            onChange={handleFileInput}
          />
          
          <div className="relative z-10 flex flex-col items-center gap-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--card)] text-[var(--accent)] shadow-xl transition-transform group-hover:scale-110">
              <Upload size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white">Arrastrá tu Excel aquí</h3>
              <p className="text-[var(--text-muted)]">o hacé clic para buscar el archivo (.xlsx, .xls)</p>
            </div>
          </div>
        </div>
      ) : (
        <AnimatePresence>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-premium space-y-6"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-white">{filename}</h4>
                  <p className="text-xs text-[var(--text-faint)]">Archivo cargado correctamente</p>
                </div>
              </div>
              <div className="flex gap-8">
                <div className="text-center">
                  <div className="text-2xl font-black text-[var(--cyan)]">{rawClients.length}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Clientes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-black text-[var(--purple)]">{Object.keys(zones).length}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Zonas</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(zones).slice(0, 8).map(([name, clients], i) => (
                <div key={name} className="flex flex-col gap-1 rounded-lg bg-[var(--card)] p-3 border border-[var(--border)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase truncate">{name}</span>
                  <span className="text-sm font-bold text-white">{clients.length} pts</span>
                </div>
              ))}
              {Object.keys(zones).length > 8 && (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-[var(--border2)] text-xs text-[var(--text-faint)]">
                  + {Object.keys(zones).length - 8} zonas más
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <button 
                onClick={() => setStep(2)}
                className="btn-primary"
              >
                Siguiente: Configurar →
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {error && (
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3 rounded-xl border border-red-500/50 bg-red-500/10 p-4 text-red-400"
        >
          <AlertCircle size={20} />
          <span className="text-sm font-medium">{error}</span>
        </motion.div>
      )}

      <div className="card-premium">
        <h4 className="mb-4 text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider">
          Columnas requeridas
        </h4>
        <div className="flex flex-wrap gap-2">
          {REQUIRED_COLS.map((col) => (
            <span 
              key={col} 
              className={`rounded-md px-3 py-1 text-[11px] font-mono font-bold ${
                col === 'LATITUDE' || col === 'LONGITUDE' 
                  ? 'border border-[var(--accent)] text-[var(--accent-hover)] bg-[var(--accent)]/5' 
                  : 'bg-[var(--card)] text-[var(--text-faint)]'
              }`}
            >
              {col}
            </span>
          ))}
        </div>
        <button 
          onClick={downloadTemplate}
          className="mt-6 text-sm font-semibold text-[var(--accent-hover)] hover:underline"
        >
          📥 Descargar Planilla Base (.xlsx)
        </button>
      </div>
    </motion.div>
  );
};
