'use client';

import React, { useEffect, useRef } from 'react';
import { 
  MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, 
  FeatureGroup, ZoomControl
} from 'react-leaflet';
import L from 'leaflet';
import { EditControl } from 'react-leaflet-draw';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

// Fix Leaflet marker icon issue
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapProps {
  center: [number, number];
  zoom: number;
  tileUrl?: string;
  onMapClick?: (lat: number, lng: number) => void;
  onSelectionCreated?: (layer: any) => void;
  isSelectionMode?: boolean;
  children?: React.ReactNode;
}

const MapEvents = ({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click: (e) => {
      if (onMapClick) onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const ChangeView = ({ center, zoom }: { center: [number, number]; zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

export const DynamicMap = ({ center, zoom, tileUrl, onMapClick, onSelectionCreated, isSelectionMode, children }: MapProps) => {
  const mapRef = useRef<L.Map>(null);

  const onCreated = (e: any) => {
    if (onSelectionCreated) onSelectionCreated(e.layer);
  };

  return (
    <div className="relative h-full w-full group">
      <MapContainer 
        center={center} 
        zoom={zoom} 
        className="h-full w-full outline-none"
        scrollWheelZoom={true}
        zoomControl={false}
        ref={mapRef}
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          url={tileUrl || "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"}
          attribution='&copy; OpenStreetMap'
        />
        
        <FeatureGroup>
          <EditControl
            position="topright"
            onCreated={onCreated}
            draw={{
              rectangle: { shapeOptions: { color: '#6366f1' } },
              polygon: { shapeOptions: { color: '#6366f1' } },
              circle: false,
              circlemarker: false,
              marker: false,
              polyline: false,
            }}
            edit={{
               remove: true,
               edit: false
            }}
          />
        </FeatureGroup>

        <ChangeView center={center} zoom={zoom} />
        <MapEvents onMapClick={onMapClick} />
        {children}
      </MapContainer>
    </div>
  );
};

export default DynamicMap;
