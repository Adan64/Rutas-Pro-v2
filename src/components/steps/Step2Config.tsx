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
  Route,
  Download,
  AlertTriangle,
  Pencil
} from 'lucide-react';
import { useRutasStore } from '@/store/useRutasStore';
import { MapWrapper } from '../map/MapWrapper';
import { MapTypeSwitcher } from '../map/MapTypeSwitcher';
import { ZoneModal } from '../ui/ZoneModal';
import { exportAssignmentsToExcel } from '@/lib/services/ExcelService';
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
    selectedIndices, setSelectedIndices, isSelectionMode, toggleSelectionMode, assignToZone,
    renameZone, clearSelection, clearSelectionTrigger
  } = useRutasStore();

  const [activeMapType, setActiveMapType] = useState('dark');
  const [mapTileUrl, setMapTileUrl] = useState('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [isLegendMinimized, setIsLegendMinimized] = useState(false);

  const handleMapClick = (lat: number, lng: number) => {
    if (isSelectionMode) {
      clearSelection(); // Click map to clear selection in selection mode
      return;
    }
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
    clearSelection();
  };

  const handleRenameZone = (oldName: string) => {
    const newName = window.prompt(`Cambiar nombre de la zona "${oldName}":`, oldName);
    if (newName) {
      renameZone(oldName, newName);
    }
  };

  const handleExportExcel = () => {
    exportAssignmentsToExcel(rawClients);
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
          {numDrivers > Object.keys(zones).length && Object.keys(zones).length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex items-start gap-2 rounded-lg bg-[var(--amber)]/10 p-3 text-[var(--amber)] border border-[var(--amber)]/20"
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p className="text-[11px] leading-snug">
                <strong>Atención:</strong> Hay más repartidores ({numDrivers}) que zonas asignadas ({Object.keys(zones).length}). 
                Algunos repartidores quedarán sin ruta. Reducí repartidores o creá más zonas.
              </p>
            </motion.div>
          )}
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
                           <div className="flex flex-col group/name cursor-pointer" onClick={() => handleRenameZone(name)} title="Clic para renombrar">
                              <span className="text-sm font-bold text-white leading-tight flex items-center gap-1">
                                {name}
                                <Pencil size={12} className="opacity-50 transition-opacity hover:opacity-100" />
                              </span>
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
          {Object.keys(zones).length > 0 && (
            <div className="mt-3 border-t border-[var(--border)] pt-3">
              <button 
                onClick={handleExportExcel}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--surface)] py-2 text-xs font-bold text-[var(--text-muted)] transition-colors hover:bg-[var(--card)] hover:text-white border border-[var(--border)]"
              >
                <Download size={14} />
                Descargar Asignaciones (Excel)
              </button>
            </div>
          )}
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
          clearSelectionTrigger={clearSelectionTrigger}
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
            const isDimmed = hoveredZone !== null && !isHoveredZone && !isSelected;
            const opacity = isDimmed ? 0.2 : 1;

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
                key={`client-${i}-${isSelected}-${isHoveredZone}`} 
                position={[client.lat, client.lng]}
                opacity={opacity}
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
        </div>

        {/* FLOATING RIGHT TOOLS */}
        <div className="absolute right-4 top-4 z-[500] flex flex-col gap-4 items-end">
          <MapTypeSwitcher 
            activeType={activeMapType} 
            onTypeChange={(type) => { setActiveMapType(type.id); setMapTileUrl(type.url); }} 
          />

          {/* FLOATING ZONE OVERLAY (FULLSCREEN FRIENDLY) */}
          {Object.keys(zones).length > 0 && (
            <div className="w-48 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]/90 shadow-xl backdrop-blur-md pointer-events-auto transition-all">
              <div 
                className="flex cursor-pointer items-center justify-between p-2 hover:bg-[var(--card)]"
                onClick={() => setIsLegendMinimized(!isLegendMinimized)}
              >
                <h4 className="px-1 text-[10px] font-bold uppercase text-[var(--text-faint)]">Zonas</h4>
                <ChevronDown size={14} className={`text-[var(--text-faint)] transition-transform ${isLegendMinimized ? 'rotate-180' : ''}`} />
              </div>
              
              {!isLegendMinimized && (
                <div className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto p-2 pt-0 custom-scrollbar">
                  {Object.entries(zones).map(([name, clients]) => {
                    const config = zoneConfigs[name] || { color: '#6366f1', icon: '📍' };
                    return (
                      <div 
                        key={name}
                        onMouseEnter={() => setHoveredZone(name)}
                        onMouseLeave={() => setHoveredZone(null)}
                        className={`group/item flex items-center gap-2 rounded-lg p-2 transition-colors ${hoveredZone === name ? 'bg-[var(--card)] border border-[var(--accent)]' : 'hover:bg-[var(--card)] border border-transparent'}`}
                      >
                        <div className="h-3 w-3 shrink-0 rounded-full flex items-center justify-center text-[8px]" style={{ backgroundColor: config.color, color: 'white' }}></div>
                        <span 
                          className="flex-1 truncate text-xs font-bold text-white cursor-pointer hover:underline"
                          onClick={() => handleRenameZone(name)}
                          title="Clic para editar nombre"
                        >
                          {name}
                        </span>
                        <Pencil 
                          size={10} 
                          className="opacity-0 cursor-pointer transition-opacity group-hover/item:opacity-50 hover:!opacity-100 text-white" 
                          onClick={() => handleRenameZone(name)}
                        />
                        <span className="text-[10px] text-[var(--text-faint)]">{clients.length}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
                  + Asignar a Zona
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
          existingZones={Object.keys(zones)}
        />
      </div>
    </motion.div>
  );
};
