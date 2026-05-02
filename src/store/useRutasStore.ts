import { create } from 'zustand';
import { Client, RouteResult, nearestNeighbor } from '../lib/routing/RouteEngine';

// Curated palette of 20 visually distinct colors for zone auto-assignment
const ZONE_PALETTE = [
  '#6366f1', // indigo
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#a855f7', // purple
  '#f97316', // orange
  '#14b8a6', // teal
  '#ec4899', // pink
  '#84cc16', // lime
  '#3b82f6', // blue
  '#eab308', // yellow
  '#8b5cf6', // violet
  '#22c55e', // green
  '#fb923c', // orange-400
  '#38bdf8', // sky
  '#f43f5e', // rose
  '#a3e635', // lime-400
  '#c084fc', // purple-400
  '#2dd4bf', // teal-400
];
console.log('hola');
/** Returns a palette color for a given zone index (cycles if > 20 zones) */
const pickZoneColor = (idx: number): string => ZONE_PALETTE[idx % ZONE_PALETTE.length];

interface Driver {
  name: string;
  zones: string[];
  totalClients: number;
  totalKm: number;
  startLat: number;
  startLon: number;
}

interface ZoneConfig {
  color: string;
  icon: string;
}

interface AppState {
  // Data
  rawClients: Client[];
  zones: Record<string, Client[]>;
  zoneConfigs: Record<string, ZoneConfig>;
  filename: string | null;

  // Config
  startLat: number;
  startLon: number;
  numDrivers: number;
  fuelL100: number;
  fuelPrice: number;
  startTime: string;
  serviceTime: number;
  workHours: number;
  lunchMin: number;

  // Results
  drivers: Driver[];
  zoneResults: Record<string, RouteResult>;
  currentStep: number;
  isCalculating: boolean;

  // Selection & Editing
  selectedIndices: Set<number>;
  isSelectionMode: boolean;

  // Actions
  setRawClients: (data: { clients: Client[]; zones: Record<string, Client[]>; filename: string }) => void;
  setStartPoint: (lat: number, lng: number) => void;
  setNumDrivers: (n: number) => void;
  setStep: (n: number) => void;
  updateConfig: (updates: Partial<Omit<AppState, 'actions'>>) => void;
  updateZoneConfig: (name: string, updates: Partial<ZoneConfig>) => void;
  toggleSelectionMode: () => void;
  setSelectedIndices: (indices: Set<number>) => void;
  assignToZone: (zoneName: string) => void;
  calculate: () => Promise<void>;
  calculateOSRM: () => Promise<void>;
  reset: () => void;
}

const DEFAULT_STATE: {
  rawClients: Client[];
  zones: Record<string, Client[]>;
  zoneConfigs: Record<string, ZoneConfig>;
  filename: string | null;
  startLat: number;
  startLon: number;
  numDrivers: number;
  fuelL100: number;
  fuelPrice: number;
  startTime: string;
  serviceTime: number;
  workHours: number;
  lunchMin: number;
  drivers: Driver[];
  zoneResults: Record<string, RouteResult>;
  currentStep: number;
  isCalculating: boolean;
  selectedIndices: Set<number>;
  isSelectionMode: boolean;
} = {
  rawClients: [],
  zones: {},
  zoneConfigs: {},
  filename: null,
  startLat: -25.374708,
  startLon: -55.719584,
  numDrivers: 2,
  fuelL100: 8,
  fuelPrice: 7500,
  startTime: '06:00',
  serviceTime: 20,
  workHours: 8.5,
  lunchMin: 60,
  drivers: [],
  zoneResults: {},
  currentStep: 1,
  isCalculating: false,
  selectedIndices: new Set<number>(),
  isSelectionMode: false,
};

export const useRutasStore = create<AppState>((set, get) => ({
  ...DEFAULT_STATE,

  setRawClients: ({ clients, zones, filename }) =>
    set((state) => {
      // Auto-assign distinct colors to every zone detected in the imported data.
      // Preserve any existing user-overrides for zones that already have a config.
      const existingConfigs = state.zoneConfigs;
      const zoneNames = Object.keys(zones);
      const newConfigs: Record<string, { color: string; icon: string }> = {};
      zoneNames.forEach((name, idx) => {
        newConfigs[name] = existingConfigs[name] ?? { color: pickZoneColor(idx), icon: '📍' };
      });
      return { rawClients: clients, zones, filename, currentStep: 1, zoneConfigs: newConfigs };
    }),

  setStartPoint: (lat, lng) => set({ startLat: lat, startLon: lng }),

  setNumDrivers: (n) => set({ numDrivers: n }),

  setStep: (n) => set({ currentStep: n }),

  updateConfig: (updates) => set((state) => ({ ...state, ...updates })),

  updateZoneConfig: (name, updates) => set((state) => {
    const existingZoneNames = Object.keys(state.zones);
    const idx = existingZoneNames.indexOf(name);
    const fallbackColor = idx >= 0 ? pickZoneColor(idx) : '#6366f1';
    return {
      zoneConfigs: {
        ...state.zoneConfigs,
        [name]: { ...(state.zoneConfigs[name] || { color: fallbackColor, icon: '📍' }), ...updates }
      }
    };
  }),

  toggleSelectionMode: () => set((state) => ({ isSelectionMode: !state.isSelectionMode })),

  setSelectedIndices: (indices) => set({ selectedIndices: indices }),

  assignToZone: (zoneName) => set((state) => {
    const updatedClients = [...state.rawClients];
    state.selectedIndices.forEach(idx => {
      updatedClients[idx] = { ...updatedClients[idx], ZONA: zoneName };
    });

    const newZones: Record<string, Client[]> = {};
    updatedClients.forEach(c => {
      if (c.ZONA && c.ZONA !== 'SIN ZONA') {
        if (!newZones[c.ZONA]) newZones[c.ZONA] = [];
        newZones[c.ZONA].push(c);
      }
    });

    // Auto-assign a distinct color to the new zone if it doesn't have one yet
    const newZoneNames = Object.keys(newZones);
    const updatedConfigs = { ...state.zoneConfigs };
    newZoneNames.forEach((name, idx) => {
      if (!updatedConfigs[name]) {
        updatedConfigs[name] = { color: pickZoneColor(idx), icon: '📍' };
      }
    });

    return { 
      rawClients: updatedClients, 
      zones: newZones, 
      zoneConfigs: updatedConfigs,
      selectedIndices: new Set<number>() 
    };
  }),

  calculate: async () => {
    const { zones, startLat, startLon, numDrivers } = get();
    set({ isCalculating: true });

    // 1. Optimize Each Zone
    const results: Record<string, RouteResult> = {};
    Object.entries(zones).forEach(([name, clients]) => {
      results[name] = nearestNeighbor(clients, startLat, startLon);
    });

    // 2. Assign Zones to Drivers (Load balancing)
    const sortedZones = Object.entries(zones).sort((a, b) => b[1].length - a[1].length);
    const drivers: Driver[] = Array.from({ length: numDrivers }, (_, i) => ({
      name: `Repartidor ${i + 1}`,
      zones: [],
      totalClients: 0,
      totalKm: 0,
      startLat,
      startLon,
    }));

    sortedZones.forEach(([name, clients]) => {
      const d = drivers.reduce((min, cur) => (cur.totalClients < min.totalClients ? cur : min));
      d.zones.push(name);
      d.totalClients += clients.length;
      d.totalKm += results[name].totalKm + results[name].returnKm;
    });

    // Simulate small delay for UI feel
    await new Promise((r) => setTimeout(r, 800));

    set({ zoneResults: results, drivers, currentStep: 3, isCalculating: false });
  },

  calculateOSRM: async () => {
    const { zoneResults, startLat, startLon, drivers } = get();
    const { fetchOSRMRoute } = await import('../lib/services/OSRMService');
    
    set({ isCalculating: true });

    const updatedZoneResults = { ...zoneResults };
    const updatedDrivers = [...drivers];

    for (const [name, result] of Object.entries(zoneResults)) {
      const points: [number, number][] = [
        [startLat, startLon],
        ...result.ordered.map(c => [c.lat, c.lng] as [number, number]),
        [startLat, startLon] // Return to depot
      ];

      const osrmData = await fetchOSRMRoute(points);
      if (osrmData) {
        updatedZoneResults[name] = {
          ...result,
          roadGeometry: osrmData.geometry,
          totalKmReal: osrmData.distance / 1000,
          totalMinReal: osrmData.duration / 60,
        };

        // Update driver stats
        const driverIdx = updatedDrivers.findIndex(d => d.zones.includes(name));
        if (driverIdx !== -1) {
          updatedDrivers[driverIdx] = {
            ...updatedDrivers[driverIdx],
            totalKm: updatedDrivers[driverIdx].totalKm - (result.totalKm + result.returnKm) + (osrmData.distance / 1000)
          };
        }
      }
    }

    set({ zoneResults: updatedZoneResults, drivers: updatedDrivers, isCalculating: false });
  },

  reset: () => set(DEFAULT_STATE),
}));
