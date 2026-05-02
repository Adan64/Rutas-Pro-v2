import { create } from 'zustand';
import { Client, RouteResult } from '../lib/routing/RouteEngine';

interface Driver {
  name: string;
  zones: string[];
  totalClients: number;
  totalKm: number;
  startLat: number;
  startLon: number;
}

interface AppState {
  // Data
  rawClients: Client[];
  zones: Record<string, Client[]>;
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
  toggleSelectionMode: () => void;
  setSelectedIndices: (indices: Set<number>) => void;
  assignToZone: (zoneName: string) => void;
  calculate: () => Promise<void>;
  calculateOSRM: () => Promise<void>;
  reset: () => void;
}

const DEFAULT_STATE = {
  rawClients: [],
  zones: {},
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
  selectedIndices: new Set(),
  isSelectionMode: false,
};

export const useRutasStore = create<AppState>((set, get) => ({
  ...DEFAULT_STATE,

  setRawClients: ({ clients, zones, filename }) =>
    set({ rawClients: clients, zones, filename, currentStep: 1 }),

  setStartPoint: (lat, lng) => set({ startLat: lat, startLon: lng }),

  setNumDrivers: (n) => set({ numDrivers: n }),

  setStep: (n) => set({ currentStep: n }),

  updateConfig: (updates) => set((state) => ({ ...state, ...updates })),

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

    return { 
      rawClients: updatedClients, 
      zones: newZones, 
      selectedIndices: new Set() 
    };
  }),

  calculate: async () => {
    const { zones, startLat, startLon, numDrivers } = get();
    set({ isCalculating: true });

    // 1. Optimize Each Zone
    const results: Record<string, RouteResult> = {};
    Object.entries(zones).forEach(([name, clients]) => {
      const { nearestNeighbor } = require('../lib/routing/RouteEngine');
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
