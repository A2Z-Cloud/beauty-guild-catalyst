import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Leaflet's default icon path is not resolved by Create React App after the
// assets are bundled. Explicitly point it at the bundled images so the pin is
// visible in Catalyst as well as locally.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const DEFAULT_POSITION = [52.8, -1.6];

export default function MapPicker({ latitude, longitude, onChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const hasPosition = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
    const position = hasPosition ? [Number(latitude), Number(longitude)] : DEFAULT_POSITION;
    const map = L.map(containerRef.current).setView(position, hasPosition ? 16 : 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    const marker = L.marker(position, { draggable: true }).addTo(map);
    marker.on('dragend', () => { const next = marker.getLatLng(); onChange({ latitude: next.lat, longitude: next.lng }); });
    mapRef.current = map; markerRef.current = marker;
    const invalidate = () => map.invalidateSize();
    setTimeout(invalidate, 0);
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(invalidate) : null;
    resizeObserver?.observe(containerRef.current);
    return () => {
      resizeObserver?.disconnect();
      map.remove(); mapRef.current = null; markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const lat = Number(latitude); const lng = Number(longitude);
    if (!mapRef.current || !markerRef.current || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const next = [lat, lng]; markerRef.current.setLatLng(next); mapRef.current.setView(next, Math.max(mapRef.current.getZoom(), 15));
  }, [latitude, longitude]);

  return <div ref={containerRef} style={{ height: 340, width: '100%' }} aria-label="Draggable training centre map" />;
}
