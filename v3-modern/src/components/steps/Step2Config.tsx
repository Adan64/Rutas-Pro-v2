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
  Plus,
  Route
} from 'lucide-react';
import { useRutasStore } from '@/store/useRutasStore';
import { MapWrapper } from '../map/MapWrapper';
import { MapTypeSwitcher } from '../map/MapTypeSwitcher';
import { ZoneModal } from '../ui/ZoneModal';
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
    zones, rawClients, zoneConfigs, updateZoneConfig,
    selectedIndices, setSelectedIndices, isSelectionMode, toggleSelectionMode, assignToZone
  } = useRutasStore();

  const [activeMapType, setActiveMapType] = useState('dark');
  const [mapTileUrl, setMapTileUrl] = useState('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');
  const [showFloatingZones, setShowFloatingZones] = useState(false);
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

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
    setIsZoneModalOpen(true);
  };

  const handleConfirmZone = (name: string) => {
    assignToZone(name.trim());
    setIsZoneModalOpen(false);
    setSelectedIndices(new Set());
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

        {/* ZONE SUMMARY (ENHANCED) */}
        <div className="card-premium flex-[2] overflow-hidden flex flex-col min-h-[300px]">
          <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
             <div className="flex items-center gap-2">
                <Route className="text-[var(--cyan)]" size={18} />
                <h3 className="font-bold text-white">Zonas Asignadas</h3>
             </div>
             <div className="flex items-center gap-2">
                <span className="rounded-full bg-[var(--card)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-hover)] border border-[var(--border)]">
                  {Object.keys(zones).length} ZONAS
                </span>
             </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {Object.entries(zones).length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 rounded-full bg-[var(--card)] p-4 text-[var(--text-faint)]">
                  <Route size={32} />
                </div>
                <p className="text-xs text-[var(--text-faint)] italic">
                  No hay zonas asignadas aún.<br/>Seleccioná clientes en el mapa para empezar.
                </p>
              </div>
            ) : (
              Object.entries(zones).map(([name, clients]) => {
                const config = zoneConfigs[name] || { color: '#6366f1', icon: '📍' };
                const isHovered = hoveredZone === name;
                return (
                  <div
                    key={name}
                    onMouseEnter={() => setHoveredZone(name)}
                    onMouseLeave={() => setHoveredZone(null)}
                    className="group relative flex flex-col gap-3 rounded-xl bg-[var(--card)] p-3 border transition-all cursor-default"
                    style={{
                      borderColor: isHovered ? config.color : 'var(--border)',
                      boxShadow: isHovered ? `0 0 0 1px ${config.color}55, 0 4px 20px ${config.color}22` : 'none',
                      background: isHovered ? `color-mix(in srgb, ${config.color} 8%, var(--card))` : 'var(--card)',
                    }}
                  >
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div 
                            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl shadow-inner transition-transform group-hover:scale-110"
                            style={{ backgroundColor: `${config.color}15`, color: config.color, border: `1px solid ${config.color}30` }}
                           >
                             {config.icon}
                           </div>
                           <div className="flex flex-col">
                              <span className="text-sm font-bold text-white leading-tight">{name}</span>
                              <span className="text-[10px] font-medium text-[var(--text-faint)] uppercase tracking-wider">{clients.length} paradas</span>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            value={config.color}
                            onChange={(e) => updateZoneConfig(name, { color: e.target.value })}
                            className="h-6 w-6 cursor-pointer overflow-hidden rounded-md border-none bg-transparent"
                            title="Cambiar color"
                          />
                        </div>
                     </div>
                     <div className="flex items-center gap-1.5 rounded-lg bg-[var(--background)]/50 p-1">
                        {['📍', '🚚', '🏠', '📦', '⭐'].map(icon => (
                          <button
                            key={icon}
                            onClick={() => updateZoneConfig(name, { icon })}
                            className={`flex h-7 flex-1 items-center justify-center rounded-md text-sm transition-all ${config.icon === icon ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-faint)] hover:bg-[var(--surface)] hover:text-white'}`}
                          >
                            {icon}
                          </button>
                        ))}
                     </div>
                  </div>
                );
              })
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
          tileUrl={mapTileUrl}
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
            const isHoveredZone = hoveredZone !== null && client.ZONA === hoveredZone;
            const config = zoneConfigs[client.ZONA || ''] || { color: '#94a3b8' };
            const baseColor = client.ZONA ? config.color : '#64748b';

            // Sizes: normal=10, selected=16, hovered-zone=14
            const size = isSelected ? 16 : isHoveredZone ? 14 : 10;
            const half = size / 2;

            let html: string;
            if (isSelected) {
              // White ring + zone color fill so it's clearly selected but keeps its color
              html = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${baseColor};border:3px solid white;box-shadow:0 0 0 2px ${baseColor},0 0 12px ${baseColor}99;"></div>`;
            } else if (isHoveredZone) {
              // Pulsing glow ring in zone color
              html = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${baseColor};border:2px solid white;box-shadow:0 0 0 3px ${baseColor}88,0 0 16px ${baseColor}cc;"></div>`;
            } else {
              html = `<div style="background:${baseColor};width:${size}px;height:${size}px;border-radius:50%;border:2px solid white;box-shadow:0 0 8px rgba(0,0,0,0.5)"></div>`;
            }

            return (
              <Marker 
                key={i} 
                position={[client.lat, client.lng]}
                eventHandlers={{
                  click: () => handlePointClick(i)
                }}
                icon={L.divIcon({
                  className: '',
                  html,
                  iconSize: [size, size],
                  iconAnchor: [half, half]
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
            title="Pantalla Completa"
          >
            <Maximize2 size={18} />
          </button>
          <button 
            onClick={() => setShowFloatingZones(!showFloatingZones)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] transition-colors bg-[var(--surface)]/90 backdrop-blur-md text-white shadow-xl ${showFloatingZones ? 'bg-[var(--accent)]' : 'hover:bg-[var(--card)]'}`}
            title="Resumen de Zonas"
          >
            <Route size={18} />
          </button>
        </div>

        {/* FLOATING RIGHT TOOLS */}
        <div className="absolute right-4 top-4 z-[500]">
          <MapTypeSwitcher 
            activeType={activeMapType} 
            onTypeChange={(type) => { setActiveMapType(type.id); setMapTileUrl(type.url); }} 
          />
        </div>

        {/* FLOATING ZONE OVERLAY (FULLSCREEN FRIENDLY) */}
        <AnimatePresence>
          {showFloatingZones && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute left-16 top-4 z-[500] w-64 max-h-[80vh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-4 shadow-2xl backdrop-blur-xl"
            >
              <div className="mb-3 flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span className="text-xs font-bold text-white uppercase">Zonas</span>
                <button onClick={() => setShowFloatingZones(false)} className="text-[var(--text-faint)]">✕</button>
              </div>
              <div className="space-y-2">
                {Object.entries(zones).map(([name, clients]) => {
                  const config = zoneConfigs[name] || { color: '#6366f1', icon: '📍' };
                  return (
                    <div key={name} className="flex items-center gap-2 text-xs">
                      <span style={{ color: config.color }}>{config.icon}</span>
                      <span className="flex-1 font-bold text-white truncate">{name}</span>
                      <span className="text-[var(--text-faint)]">{clients.length}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                  + Asignar a Nueva Zona
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <ZoneModal 
          isOpen={isZoneModalOpen}
          onClose={() => setIsZoneModalOpen(false)}
          onConfirm={handleConfirmZone}
          count={selectedIndices.size}
        />
      </div>
    </motion.div>
  );
};
