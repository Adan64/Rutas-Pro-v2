'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, 
  Users, 
  Fuel, 
  Clock, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  Settings2,
  Trash2,
  Maximize2,
  Minus,
  Plus
} from 'lucide-react';
import { useRutasStore } from '@/store/useRutasStore';
import { MapWrapper } from '../map/MapWrapper';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { isPointInLayer } from '@/lib/utils/geo';

export const Step2Config = () => {
  const { 
    startLat, startLon, setStartPoint, 
    numDrivers, setNumDrivers,
    fuelL100, fuelPrice,
    startTime, workHours, serviceTime, lunchMin,
    updateConfig, setStep, calculate, isCalculating,
    zones, rawClients,
    selectedIndices, setSelectedIndices, isSelectionMode, toggleSelectionMode, assignToZone
  } = useRutasStore();

  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleMapClick = (lat: number, lng: number) => {
    if (isSelectionMode) return; // Don't move start point in selection mode
    setStartPoint(lat, lng);
  };

  const handleSelectionCreated = (layer: any) => {
    const newSelection = new Set(selectedIndices);
    rawClients.forEach((client, idx) => {
      if (isPointInLayer(client.lat, client.lng, layer)) {
        newSelection.add(idx);
      }
    });
    setSelectedIndices(newSelection);
  };

  const handlePointClick = (idx: number) => {
    if (!isSelectionMode) return;
    const newSelection = new Set(selectedIndices);
    if (newSelection.has(idx)) newSelection.delete(idx);
    else newSelection.add(idx);
    setSelectedIndices(newSelection);
  };

  const handleAssignToNewZone = () => {
    const name = prompt('Nombre de la nueva zona:', `Zona ${Object.keys(zones).length + 1}`);
    if (name) assignToZone(name.trim());
  };

  const handleClearSelection = () => {
    setSelectedIndices(new Set());
  };

  const toggleFullscreen = () => {
    const mapDiv = document.getElementById('map-container');
    if (!document.fullscreenElement) {
      mapDiv?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const startIcon = L.divIcon({
    className: '',
    html: `<div style="background:#f59e0b;color:#000;border:2px solid rgba(255,255,255,0.9);border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 12px rgba(245,158,11,0.6);">🏁</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-[calc(100vh-180px)] flex-col gap-6 lg:flex-row"
    >
      {/* SIDEBAR */}
      <div className="flex w-full flex-col gap-4 overflow-y-auto pr-2 lg:w-[400px]">
        
        {/* START POINT */}
        <div className="card-premium">
          <div className="mb-4 flex items-center gap-2 border-b border-[var(--border)] pb-3">
            <MapPin className="text-[var(--amber)]" size={18} />
            <h3 className="font-bold text-white">Punto de partida</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-[var(--text-faint)]">Latitud</label>
              <input 
                type="number" step="any"
                value={startLat}
                onChange={(e) => setStartPoint(parseFloat(e.target.value), startLon)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-white focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-[var(--text-faint)]">Longitud</label>
              <input 
                type="number" step="any"
                value={startLon}
                onChange={(e) => setStartPoint(startLat, parseFloat(e.target.value))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-white focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
          </div>
          <p className="mt-3 text-[11px] text-[var(--text-faint)] italic">
            💡 Podés hacer clic en el mapa para mover el marcador de inicio.
          </p>
        </div>

        {/* DRIVERS */}
        <div className="card-premium">
          <div className="mb-4 flex items-center gap-2 border-b border-[var(--border)] pb-3">
            <Users className="text-[var(--accent-hover)]" size={18} />
            <h3 className="font-bold text-white">Repartidores</h3>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setNumDrivers(Math.max(1, numDrivers - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border2)] bg-[var(--card)] text-white hover:border-[var(--accent)]"
              >
                <Minus size={18} />
              </button>
              <span className="text-3xl font-black text-[var(--accent-hover)]">{numDrivers}</span>
              <button 
                onClick={() => setNumDrivers(numDrivers + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border2)] bg-[var(--card)] text-white hover:border-[var(--accent)]"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-[var(--text-faint)]">
            Las zonas se distribuirán automáticamente entre los {numDrivers} repartidores.
          </p>
        </div>

        {/* ADVANCED TOGGLE */}
        <button 
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition-colors hover:bg-[var(--card)]"
        >
          <div className="flex items-center gap-2 font-bold text-white text-sm">
            <Settings2 size={16} className="text-[var(--text-muted)]" />
            Ajustes Avanzados
          </div>
          <ChevronDown size={18} className={`text-[var(--text-faint)] transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        {showAdvanced && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="space-y-4"
          >
            {/* FUEL */}
            <div className="card-premium">
              <div className="mb-4 flex items-center gap-2 border-b border-[var(--border)] pb-3">
                <Fuel className="text-[var(--green)]" size={18} />
                <h3 className="font-bold text-white text-sm">Combustible</h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-[var(--text-faint)]">Consumo (L/100km)</label>
                  <input 
                    type="number" step="0.1" value={fuelL100}
                    onChange={(e) => updateConfig({ fuelL100: parseFloat(e.target.value) })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-[var(--text-faint)]">Precio por litro (Gs.)</label>
                  <input 
                    type="number" value={fuelPrice}
                    onChange={(e) => updateConfig({ fuelPrice: parseInt(e.target.value) })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* SCHEDULING */}
            <div className="card-premium">
              <div className="mb-4 flex items-center gap-2 border-b border-[var(--border)] pb-3">
                <Clock className="text-[var(--purple)]" size={18} />
                <h3 className="font-bold text-white text-sm">Programación</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-[var(--text-faint)]">Inicio Jornada</label>
                  <input 
                    type="time" value={startTime}
                    onChange={(e) => updateConfig({ startTime: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-[var(--text-faint)]">Horas máx/día</label>
                  <input 
                    type="number" value={workHours}
                    onChange={(e) => updateConfig({ workHours: parseFloat(e.target.value) })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-[var(--text-faint)]">Parada (min)</label>
                  <input 
                    type="number" value={serviceTime}
                    onChange={(e) => updateConfig({ serviceTime: parseInt(e.target.value) })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-[var(--text-faint)]">Almuerzo (min)</label>
                  <input 
                    type="number" value={lunchMin}
                    onChange={(e) => updateConfig({ lunchMin: parseInt(e.target.value) })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ZONE SUMMARY (NEW) */}
        <div className="card-premium flex-1 overflow-y-auto">
          <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
             <div className="flex items-center gap-2">
                <Route className="text-[var(--cyan)]" size={18} />
                <h3 className="font-bold text-white">Resumen de Zonas</h3>
             </div>
             <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase">{Object.keys(zones).length} Zonas</span>
          </div>
          <div className="space-y-2">
            {Object.entries(zones).length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-faint)] italic">
                No hay zonas asignadas aún.<br/>Usá las herramientas del mapa.
              </div>
            ) : (
              Object.entries(zones).map(([name, clients]) => (
                <div key={name} className="flex items-center justify-between rounded-lg bg-[var(--card)] p-2 border border-[var(--border)]">
                   <div className="flex flex-col">
                      <span className="text-xs font-bold text-white">{name}</span>
                      <span className="text-[10px] text-[var(--text-faint)]">{clients.length} clientes</span>
                   </div>
                   <button 
                    onClick={() => {/* TODO: Focus zone on map */}}
                    className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-[var(--surface)] text-[var(--text-faint)] hover:text-white"
                   >
                     <ChevronRight size={14} />
                   </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-auto flex gap-3 pt-4">
          <button 
            onClick={() => setStep(1)}
            className="btn-secondary flex-1"
          >
            ← Volver
          </button>
          <button 
            onClick={calculate}
            disabled={isCalculating}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCalculating ? 'Calculando...' : 'Calcular rutas ⚡'}
          </button>
        </div>
      </div>

      {/* MAP AREA */}
      <div 
        id="map-container"
        className="relative flex-1 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
      >
        <MapWrapper 
          center={[startLat, startLon]} 
          zoom={13} 
          onMapClick={handleMapClick}
          onSelectionCreated={handleSelectionCreated}
          isSelectionMode={isSelectionMode}
        >
          <Marker position={[startLat, startLon]} icon={startIcon}>
            <Popup>
              <div className="text-xs font-bold">Punto de partida</div>
            </Popup>
          </Marker>

          {rawClients.map((client, i) => {
            const isSelected = selectedIndices.has(i);
            const color = isSelected ? '#6366f1' : (client.ZONA ? '#3b82f6' : '#94a3b8');
            return (
              <Marker 
                key={i} 
                position={[client.lat, client.lng]}
                eventHandlers={{
                  click: () => handlePointClick(i)
                }}
                icon={L.divIcon({
                  className: `transition-all duration-300 ${isSelected ? 'scale-150' : ''}`,
                  html: `<div style="background:${color};width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 0 8px rgba(0,0,0,0.5)"></div>`,
                  iconSize: [10, 10],
                  iconAnchor: [5, 5]
                })}
              >
                {!isSelectionMode && (
                  <Popup>
                    <div className="space-y-1">
                      <div className="font-bold">{client.CLIENTE}</div>
                      <div className="text-[10px] text-[var(--text-faint)]">{client.NOMBRE_CLIENTE}</div>
                      <div className="text-[10px] font-bold text-[var(--accent)]">Zona: {client.ZONA}</div>
                    </div>
                  </Popup>
                )}
              </Marker>
            );
          })}
        </MapWrapper>

        {/* FLOATING TOOLS */}
        <div className="absolute left-4 top-4 z-[500] flex flex-col gap-2">
          <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md shadow-xl">
             <button 
              onClick={toggleSelectionMode}
              className={`flex h-10 w-10 items-center justify-center text-white transition-colors border-b border-[var(--border)] ${isSelectionMode ? 'bg-[var(--accent)]' : 'hover:bg-[var(--card)]'}`} 
              title="Selección manual"
            >
              <MapPin size={18} />
            </button>
             <button 
              onClick={handleClearSelection}
              className="flex h-10 w-10 items-center justify-center text-white hover:bg-red-500/20" 
              title="Borrar selección"
            >
              <Trash2 size={18} />
            </button>
          </div>
          <button 
            onClick={toggleFullscreen}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md text-white shadow-xl hover:bg-[var(--card)]"
          >
            <Maximize2 size={18} />
          </button>
        </div>

        {/* SELECTION PILL */}
        <AnimatePresence>
          {selectedIndices.size > 0 && (
            <div className="absolute bottom-8 left-1/2 z-[500] -translate-x-1/2 transform">
              <motion.div 
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="flex items-center gap-4 rounded-full border border-[var(--accent)] bg-[var(--surface)]/90 px-6 py-3 shadow-2xl backdrop-blur-xl"
              >
                <span className="text-sm font-bold text-white whitespace-nowrap">
                  {selectedIndices.size} seleccionados
                </span>
                <div className="h-4 w-px bg-[var(--border)]" />
                <button 
                  onClick={handleAssignToNewZone}
                  className="text-sm font-bold text-[var(--accent-hover)] hover:underline whitespace-nowrap"
                >
                  + Nueva Zona
                </button>
                <button 
                  onClick={() => {/* TODO: Open Modal with existing zones */}}
                  className="text-sm font-bold text-[var(--text-muted)] hover:underline whitespace-nowrap"
                >
                  Añadir a...
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
