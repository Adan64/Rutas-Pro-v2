import { rd } from '../routing/RouteEngine';

export interface OSRMRouteResult {
  distance: number;
  duration: number;
  geometry: [number, number][]; // lat, lng
  legs: { distance: number; duration: number }[];
}

const BLOCK_SIZE = 10; // Chunk size for OSRM requests

/**
 * Fetches real road data for a sequence of points from OSRM.
 */
export async function fetchOSRMRoute(points: [number, number][]): Promise<OSRMRouteResult | null> {
  const legs: { distance: number; duration: number }[] = [];
  const fullGeometry: [number, number][] = [];
  let totalDistance = 0;
  let totalDuration = 0;

  try {
    for (let i = 0; i < points.length - 1; i += BLOCK_SIZE - 1) {
      const block = points.slice(i, i + BLOCK_SIZE);
      if (block.length < 2) break;

      const coordStr = block.map(([la, lo]) => `${lo},${la}`).join(';');
      const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=false`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes?.[0]) {
        console.error('OSRM Error:', data);
        return null;
      }

      const route = data.routes[0];
      totalDistance += route.distance;
      totalDuration += route.duration;
      
      // Process legs
      if (route.legs) {
        legs.push(...route.legs.map((l: any) => ({ distance: l.distance, duration: l.duration })));
      }

      // Process geometry
      const coords = route.geometry.coordinates.map(([lo, la]: [number, number]) => [la, lo] as [number, number]);
      if (fullGeometry.length === 0) {
        fullGeometry.push(...coords);
      } else {
        fullGeometry.push(...coords.slice(1)); // Avoid duplicating the connecting point
      }

      // Small delay to respect community server rate limits
      if (points.length > BLOCK_SIZE) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return {
      distance: totalDistance,
      duration: totalDuration,
      geometry: fullGeometry,
      legs
    };
  } catch (error) {
    console.error('OSRM Fetch failed:', error);
    return null;
  }
}
