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
