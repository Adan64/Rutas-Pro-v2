import L from 'leaflet';

/**
 * Checks if a point is inside a polygon or rectangle layer.
 */
export function isPointInLayer(lat: number, lng: number, layer: any): boolean {
  if (layer instanceof L.Rectangle) {
    return layer.getBounds().contains([lat, lng]);
  }
  
  if (layer instanceof L.Polygon) {
    const latlngs = layer.getLatLngs()[0] as L.LatLng[];
    let inside = false;
    for (let i = 0, j = latlngs.length - 1; i < latlngs.length; j = i++) {
      const xi = latlngs[i].lat, yi = latlngs[i].lng;
      const xj = latlngs[j].lat, yj = latlngs[j].lng;
      
      const intersect = ((yi > lng) !== (yj > lng))
          && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  return false;
}
