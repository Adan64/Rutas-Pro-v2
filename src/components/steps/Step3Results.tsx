'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, Reorder } from 'framer-motion';
import { 
  Map as MapIcon, 
  Users, 
  LayoutDashboard, 
  Table, 
  Download, 
  FileText, 
  Route, 
  Printer,
  ChevronRight,
  ChevronDown,
  TrendingDown,
  Maximize2,
  MessageCircle,
  Pencil,
  GripVertical
} from 'lucide-react';
import { useRutasStore } from '@/store/useRutasStore';
import { MapWrapper } from '../map/MapWrapper';
import { Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { rd } from '@/lib/routing/RouteEngine';
import { exportResultsToExcel } from '@/lib/services/ExcelService';
import { exportResultsToPdf } from '@/lib/services/PdfService';
import { ResultsDashboard } from '../results/ResultsDashboard';

const TABS = [
  { id: 'map', label: 'Mapa', icon: MapIcon },
  { id: 'drivers', label: 'Repartidores', icon: Users },
  { id: 'zones', label: 'Zonas', icon: Route },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

export const Step3Results = () => {
  const { 
    zoneResults, drivers, startLat, startLon, 
    fuelL100, fuelPrice,
    setStep, calculateOSRM, isCalculating,
    renameDriver, reorderRoute
  } = useRutasStore();
  const [activeTab, setActiveTab] = useState('map');
  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const toggleFullscreen = () => {
    const mapDiv = document.getElementById('results-map-container');
    if (!document.fullscreenElement) {
      mapDiv?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const stats = useMemo(() => {
    let totKm = 0;
    let totUnoptimized = 0;
    Object.values(zoneResults).forEach(r => {
      totKm += r.totalKmReal || (r.totalKm + r.returnKm);
      totUnoptimized += r.unoptimizedKm;
    });
    
    const liters = (totKm * fuelL100) / 100;
    const cost = liters * fuelPrice;
    const savedKm = Math.max(0, totUnoptimized - totKm);
    const savedCost = (savedKm * fuelL100 / 100) * fuelPrice;

    return { totKm, liters, cost, savedKm, savedCost };
  }, [zoneResults, fuelL100, fuelPrice]);

  const handleRenameDriver = (index: number, oldName: string) => {
    const newName = window.prompt(`Renombrar a ${oldName}:`, oldName);
    if (newName) {
      renameDriver(index, newName);
    }
  };

  const handleCopyWhatsApp = (driver: any) => {
    let text = `🚚 *Ruta: ${driver.name}*\n\n`;
    
    driver.zones.forEach((zoneName: string) => {
      text += `📍 *Zona: ${zoneName}*\n`;
      const result = zoneResults[zoneName];
      if (result) {
        result.ordered.forEach((c) => {
          const time = c.ARRIVAL_TIME_STR ? `${c.ARRIVAL_TIME_STR} - ` : '';
          text += `  ${c.ORDER}️⃣ ${time}${c.NOMBRE_CLIENTE}\n`;
          text += `      🗺️ ${c.DESCRIPCION || 'Sin dirección'}\n`;
        });
      }
      text += `\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(driver.name);
      setTimeout(() => setCopyFeedback(null), 2000);
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard 
          label="KM totales" 
          value={`${rd(stats.totKm, 1)} km`} 
          icon={<Route className="text-[var(--accent)]" />} 
        />
        <SummaryCard 
          label="Combustible est." 
          value={`${rd(stats.liters, 1)} L`} 
          subValue={`${stats.cost.toLocaleString()} Gs.`}
          icon={<TrendingDown className="text-[var(--green)]" />} 
        />
        <SummaryCard 
          label="Repartidores" 
          value={drivers.length.toString()} 
          icon={<Users className="text-[var(--purple)]" />} 
        />
        <SummaryCard 
          label="Ahorro estimado" 
          value={`${rd(stats.savedKm, 1)} km`}
          subValue={`${stats.savedCost.toLocaleString()} Gs.`}
          highlight
          icon={<TrendingDown className="text-[var(--amber)]" />} 
        />
      </div>

      {/* ACTIONS */}
      <div className="flex flex-wrap gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <button 
          onClick={calculateOSRM}
          disabled={isCalculating}
          className="btn-primary btn-sm flex items-center gap-2 disabled:opacity-50"
        >
          {isCalculating ? 'Calculando...' : <><Route size={16} /> Rutas Reales (OSRM)</>}
        </button>
        <button 
          onClick={() => exportResultsToExcel(drivers, zoneResults)}
          className="btn-success btn-sm flex items-center gap-2"
        >
          <Download size={16} /> Excel
        </button>
        <button 
          onClick={() => exportResultsToPdf(drivers, zoneResults, stats)}
          className="btn-secondary btn-sm flex items-center gap-2"
        >
          <FileText size={16} /> PDF
        </button>
        <button className="btn-secondary btn-sm flex items-center gap-2">
          <Printer size={16} /> Imprimir
        </button>
        <div className="flex-1" />
        <button onClick={() => setStep(2)} className="btn-ghost btn-sm">
          ← Reconfigurar
        </button>
      </div>

      {/* TABS */}
      <div className="flex border-b border-[var(--border)]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all ${
              activeTab === tab.id 
                ? 'border-b-2 border-[var(--accent)] text-[var(--accent-hover)]' 
                : 'text-[var(--text-faint)] hover:text-[var(--text-muted)]'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div className="h-[600px]">
        {activeTab === 'map' && (
          <div 
            id="results-map-container"
            className="relative h-full overflow-hidden rounded-3xl border border-[var(--border)] shadow-2xl bg-[var(--surface)]"
          >
            <MapWrapper center={[startLat, startLon]} zoom={12}>
               {Object.entries(zoneResults).map(([name, result], idx) => {
                 const color = getColor(idx);
                 const hasRoad = !!result.roadGeometry;
                 const latlngs = hasRoad ? result.roadGeometry : [[startLat, startLon], ...result.ordered.map(c => [c.lat, c.lng])];
                 
                 return (
                   <React.Fragment key={name}>
                     <Polyline 
                      positions={latlngs as any} 
                      color={color} 
                      weight={hasRoad ? 5 : 3} 
                      opacity={hasRoad ? 0.9 : 0.7} 
                      dashArray={hasRoad ? undefined : '5, 10'}
                     />
                     {result.ordered.map((c, i) => (
                       <Marker 
                        key={i} 
                        position={[c.lat, c.lng]}
                        icon={L.divIcon({
                          className: '',
                          html: `<div style="background:${color};color:white;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid white;box-shadow:0 0 10px rgba(0,0,0,0.5)">${c.ORDER}</div>`,
                          iconSize: [22, 22],
                          iconAnchor: [11, 11]
                        })}
                       />
                     ))}
                   </React.Fragment>
                 );
               })}
            </MapWrapper>

            {/* FULLSCREEN BUTTON */}
            <div className="absolute left-4 top-4 z-[500]">
              <button 
                onClick={toggleFullscreen}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md text-white shadow-xl hover:bg-[var(--card)]"
              >
                <Maximize2 size={18} />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'drivers' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
             {drivers.map((d, i) => (
               <div key={i} className="card-premium flex flex-col max-h-[80vh]">
                 <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
                   <h3 className="font-bold text-white group/name cursor-pointer flex items-center gap-2" onClick={() => handleRenameDriver(i, d.name)} title="Renombrar">
                      {d.name} <Pencil size={12} className="opacity-50 hover:opacity-100 transition-opacity" />
                   </h3>
                   <div className="flex items-center gap-3">
                     <span className="rounded-full bg-[var(--accent-glow)] px-2 py-1 text-[10px] font-bold text-[var(--accent-hover)]">
                      {d.totalClients} clientes
                     </span>
                     {copyFeedback === d.name ? (
                        <span className="text-xs text-green-400 font-bold">¡Copiado!</span>
                     ) : (
                       <button onClick={() => handleCopyWhatsApp(d)} className="text-[var(--green)] hover:scale-110 transition-transform" title="Copiar ruta a WhatsApp">
                         <MessageCircle size={16} />
                       </button>
                     )}
                   </div>
                 </div>
                 <div className="flex justify-between text-sm mb-3">
                   <span className="text-[var(--text-faint)]">KM Totales:</span>
                   <span className="font-bold text-[var(--cyan)]">{rd(d.totalKm, 1)} km</span>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                   {d.zones.map(z => {
                     const res = zoneResults[z];
                     if (!res) return null;
                     return (
                       <div key={z} className="bg-[var(--background)]/30 rounded-xl p-2 border border-[var(--border)]">
                         <h4 className="text-xs font-bold text-[var(--accent)] mb-2 uppercase tracking-wider">{z}</h4>
                         <Reorder.Group 
                           axis="y" 
                           values={res.ordered} 
                           onReorder={(newOrder) => updateZoneOrder(z, newOrder)}
                           className="flex flex-col gap-1"
                         >
                           {res.ordered.map((c) => (
                             <Reorder.Item 
                               key={c.CLIENTE} 
                               value={c}
                               className="flex items-center gap-2 bg-[var(--card)] p-2 rounded-lg border border-[var(--border)] cursor-grab active:cursor-grabbing hover:border-[var(--accent)] transition-colors"
                             >
                               <GripVertical size={14} className="text-[var(--text-muted)]" />
                               <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--surface)] text-[10px] font-bold text-[var(--text-muted)] shrink-0">
                                 {c.ORDER}
                               </div>
                               <div className="flex flex-col flex-1 min-w-0">
                                 <span className="text-xs font-bold text-white truncate">{c.NOMBRE_CLIENTE}</span>
                                 <span className="text-[9px] text-[var(--text-faint)] truncate">{c.DESCRIPCION || 'Sin dirección'}</span>
                               </div>
                               <div className="flex flex-col items-end shrink-0">
                                 <span className="text-[10px] font-bold text-[var(--text-muted)]">Día {c.SCHEDULE_DAY}</span>
                                 <span className="text-[10px] text-[var(--text-faint)]">{c.ARRIVAL_TIME_STR}</span>
                               </div>
                             </Reorder.Item>
                           ))}
                         </Reorder.Group>
                       </div>
                     );
                   })}
                 </div>
               </div>
             ))}
          </div>
        )}

        {activeTab === 'zones' && (
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--card)] text-[var(--text-faint)] uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Zona</th>
                  <th className="px-6 py-4">Repartidor</th>
                  <th className="px-6 py-4">Clientes</th>
                  <th className="px-6 py-4">KM (Opt)</th>
                  <th className="px-6 py-4">Ahorro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {Object.entries(zoneResults).map(([name, res], i) => {
                  const driver = drivers.find(d => d.zones.includes(name));
                  const currentKm = res.totalKmReal || (res.totalKm + res.returnKm);
                  const saving = Math.max(0, res.unoptimizedKm - currentKm);
                  const isExpanded = expandedZone === name;

                  return (
                    <React.Fragment key={name}>
                      <tr 
                        onClick={() => setExpandedZone(isExpanded ? null : name)}
                        className={`cursor-pointer transition-colors ${isExpanded ? 'bg-[var(--card)]' : 'hover:bg-[var(--card)]'}`}
                      >
                        <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          {name}
                        </td>
                        <td className="px-6 py-4 text-[var(--text-muted)]">{driver?.name}</td>
                        <td className="px-6 py-4 text-[var(--text-muted)]">{res.ordered.length}</td>
                        <td className="px-6 py-4 font-bold text-[var(--cyan)]">
                          {rd(currentKm, 1)} km {res.totalKmReal && '🛣️'}
                        </td>
                        <td className="px-6 py-4 text-[var(--green)] font-bold">+{rd(saving, 1)} km</td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-[var(--background)]">
                          <td colSpan={5} className="p-4">
                            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2">
                              <table className="w-full text-xs">
                                <thead className="text-[var(--text-faint)] uppercase">
                                  <tr>
                                    <th className="pb-2 text-left">Orden</th>
                                    <th className="pb-2 text-left">Cliente</th>
                                    <th className="pb-2 text-center">Día</th>
                                    <th className="pb-2 text-center">Llegada</th>
                                    <th className="pb-2 text-center">Salida</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {res.ordered.map((c) => (
                                    <tr key={c.CLIENTE} className="border-t border-[var(--border)] hover:bg-[var(--card)]">
                                      <td className="py-2 text-[var(--accent)] font-bold">{c.ORDER}</td>
                                      <td className="py-2 text-white font-medium">{c.NOMBRE_CLIENTE}</td>
                                      <td className="py-2 text-center text-[var(--text-muted)] font-bold">Día {c.SCHEDULE_DAY}</td>
                                      <td className="py-2 text-center text-[var(--text-muted)]">{c.ARRIVAL_TIME_STR}</td>
                                      <td className="py-2 text-center text-[var(--text-muted)]">{c.DEPARTURE_TIME_STR}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'dashboard' && (
           <ResultsDashboard drivers={drivers} zoneResults={zoneResults} />
        )}
      </div>
    </motion.div>
  );
};

const SummaryCard = ({ label, value, subValue, icon, highlight }: any) => (
  <div className={`card-premium flex flex-col items-center justify-center text-center ${highlight ? 'border-[var(--amber)] bg-[var(--amber)]/5 shadow-[0_0_20px_rgba(245,158,11,0.1)]' : ''}`}>
    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--card)] shadow-md">
      {icon}
    </div>
    <div className="text-2xl font-black text-white">{value}</div>
    {subValue && <div className="text-xs font-bold text-[var(--text-faint)]">{subValue}</div>}
    <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">{label}</div>
  </div>
);

const ZONE_COLORS = [
  '#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', 
  '#a855f7', '#ec4899', '#f97316', '#14b8a6', '#84cc16'
];
const getColor = (idx: number) => ZONE_COLORS[idx % ZONE_COLORS.length];
