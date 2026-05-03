'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  clearSelectionTrigger?: number;
  children?: React.ReactNode;
}

const MapEvents = ({ onMapClick, isDrawingRef }: { onMapClick?: (lat: number, lng: number) => void, isDrawingRef: React.RefObject<boolean> }) => {
  useMapEvents({
    click: (e) => {
      if (!isDrawingRef.current && onMapClick) onMapClick(e.latlng.lat, e.latlng.lng);
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

export const DynamicMap = ({ 
  center, zoom, tileUrl, onMapClick, onSelectionCreated, isSelectionMode, clearSelectionTrigger, children 
}: MapProps) => {
  const mapRef = useRef<L.Map>(null);

  const onCreated = (e: any) => {
    if (onSelectionCreated) onSelectionCreated(e.layer);
  };

  const isDrawingRef = useRef(false);
  const featureGroupRef = useRef<L.FeatureGroup>(null);

  useEffect(() => {
    if (clearSelectionTrigger && clearSelectionTrigger > 0 && featureGroupRef.current) {
      featureGroupRef.current.clearLayers();
    }
  }, [clearSelectionTrigger]);

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
        
        <FeatureGroup ref={featureGroupRef}>
          <EditControl
            position="bottomleft"
            onCreated={(e) => {
              isDrawingRef.current = false;
              onCreated(e);
            }}
            onDrawStart={() => { isDrawingRef.current = true; }}
            onDrawStop={() => { isDrawingRef.current = false; }}
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
        <MapEvents onMapClick={onMapClick} isDrawingRef={isDrawingRef} />
        {children}
      </MapContainer>
    </div>
  );
};

export default DynamicMap;
