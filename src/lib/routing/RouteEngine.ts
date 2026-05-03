/**
 * Utility for calculating distances and optimizing routes.
 */

export interface Point {
  lat: number;
  lng: number;
}

export interface Client extends Point {
  CLIENTE: string;
  RAZON_SOCIAL: string;
  NOMBRE_CLIENTE: string;
  ZONA: string;
  DESCRIPCION: string;
  ORDER?: number;
  LEG_KM?: number;
  CUM_KM?: number;
  DIST_DIRECT?: number;
  LEG_KM_REAL?: number | null;
  LEG_MIN_REAL?: number | null;
  CUM_KM_REAL?: number | null;
  CUM_MIN_REAL?: number | null;
  SCHEDULE_DAY?: number;
  ARRIVAL_TIME_STR?: string;
  DEPARTURE_TIME_STR?: string;
}

export interface RouteResult {
  ordered: Client[];
  totalKm: number;
  returnKm: number;
  unoptimizedKm: number;
  roadGeometry?: [number, number][];
  totalKmReal?: number;
  totalMinReal?: number;
}

/**
 * Calculates the Haversine distance between two points in km.
 */
export function calculateHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Round a number to a specific precision.
 */
export function rd(n: number, d: number): number {
  const factor = Math.pow(10, d);
  return Math.round(n * factor) / factor;
}

/**
 * Optimizes a list of clients using the Nearest Neighbor algorithm.
 */
export function nearestNeighbor(
  clients: Client[],
  startLat: number,
  startLon: number
): RouteResult {
  const remaining = [...clients];
  const ordered: Client[] = [];
  let cumKm = 0;
  let curLat = startLat;
  let curLon = startLon;

  while (remaining.length > 0) {
    let minDist = Infinity;
    let minIdx = -1;

    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      const d = calculateHaversine(curLat, curLon, c.lat, c.lng);
      if (d < minDist) {
        minDist = d;
        minIdx = i;
      }
    }

    const client = { ...remaining[minIdx] };
    cumKm += minDist;

    client.ORDER = ordered.length + 1;
    client.LEG_KM = rd(minDist, 4);
    client.CUM_KM = rd(cumKm, 4);
    client.DIST_DIRECT = rd(calculateHaversine(startLat, startLon, client.lat, client.lng), 4);

    ordered.push(client);
    curLat = client.lat;
    curLon = client.lng;
    remaining.splice(minIdx, 1);
  }

  const returnKm = calculateHaversine(curLat, curLon, startLat, startLon);

  // Calculate unoptimized distance (original order)
  let uKm = 0;
  let pLat = startLat;
  let pLon = startLon;
  clients.forEach((c) => {
    uKm += calculateHaversine(pLat, pLon, c.lat, c.lng);
    pLat = c.lat;
    pLon = c.lng;
  });

  return {
    ordered,
    totalKm: rd(cumKm, 4),
    returnKm: rd(returnKm, 4),
    unoptimizedKm: rd(uKm, 4),
  };
}

export interface ScheduleConfig {
  startTime: string;
  workHours: number;
  serviceTime: number;
  lunchMin: number;
  avgSpeed?: number;
}

function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = Math.floor(totalMinutes % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Applies time scheduling, lunch breaks, and work hour limits to a calculated route.
 */
export function applySchedules(
  result: RouteResult,
  config: ScheduleConfig,
  startLat: number,
  startLon: number
): RouteResult {
  const avgSpeed = config.avgSpeed || 30; // 30 km/h default
  const [sH, sM] = config.startTime.split(':').map(Number);
  const startMin = sH * 60 + sM;
  const LUNCH_THRESHOLD = 11.5 * 60; // 11:30 AM

  let currentDay = 1;
  let currentMin = startMin;
  let totalKm = 0;

  const newOrdered = result.ordered.map((client) => {
    let travelMin = ((client.LEG_KM || 0) / avgSpeed) * 60;
    let arrival = currentMin + travelMin;

    if (arrival > LUNCH_THRESHOLD && currentMin <= LUNCH_THRESHOLD && config.lunchMin > 0) {
      arrival += config.lunchMin;
    }

    let departure = arrival + config.serviceTime;

    const returnKm = calculateHaversine(client.lat, client.lng, startLat, startLon);
    const returnMin = (returnKm / avgSpeed) * 60;

    // Check if limits exceeded
    if ((departure + returnMin - startMin) > config.workHours * 60) {
      currentDay++;
      currentMin = startMin;

      const fromBaseKm = calculateHaversine(startLat, startLon, client.lat, client.lng);
      const newTravelMin = (fromBaseKm / avgSpeed) * 60;

      client.LEG_KM = rd(fromBaseKm, 4);
      arrival = currentMin + newTravelMin;

      if (arrival > LUNCH_THRESHOLD && currentMin <= LUNCH_THRESHOLD && config.lunchMin > 0) {
        arrival += config.lunchMin;
      }
      departure = arrival + config.serviceTime;
    }

    totalKm += (client.LEG_KM || 0);
    client.CUM_KM = rd(totalKm, 4);

    client.SCHEDULE_DAY = currentDay;
    client.ARRIVAL_TIME_STR = formatTime(arrival);
    client.DEPARTURE_TIME_STR = formatTime(departure);

    currentMin = departure;
    return client;
  });

  const lastClient = newOrdered[newOrdered.length - 1];
  const finalReturnKm = lastClient ? calculateHaversine(lastClient.lat, lastClient.lng, startLat, startLon) : 0;

  return {
    ...result,
    ordered: newOrdered,
    totalKm: rd(totalKm, 4),
    returnKm: rd(finalReturnKm, 4)
  };
}
