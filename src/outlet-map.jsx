import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const jakarta = [-6.2088, 106.8456];
const pin = L.divIcon({
  className: 'outlet-pin',
  html: '<span></span>',
  iconSize: [28, 36],
  iconAnchor: [14, 34],
});

export default function OutletMap({ latitude, longitude, radius, onSelect }) {
  const container = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const fence = useRef(null);
  const selection = useRef(onSelect);
  const [tileProblem, setTileProblem] = useState(false);
  const editable = Boolean(onSelect);
  const hasPoint = Number.isFinite(latitude) && Number.isFinite(longitude);
  const opening = useRef({ center: hasPoint ? [latitude, longitude] : jakarta, zoom: hasPoint ? 16 : 12 });

  useEffect(() => { selection.current = onSelect; }, [onSelect]);
  useEffect(() => {
    const { center, zoom } = opening.current;
    const instance = L.map(container.current, {
      scrollWheelZoom: false, dragging: editable, doubleClickZoom: editable, tapHold: false,
    }).setView(center, zoom);
    map.current = instance;
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });
    let loaded = false;
    tiles.on('tileload', () => { loaded = true; setTileProblem(false); });
    tiles.on('tileerror', () => { if (!loaded) setTileProblem(true); });
    tiles.addTo(instance);
    if (editable) instance.on('click', ({ latlng }) => selection.current?.(latlng.lat, latlng.lng));
    const resize = new ResizeObserver(() => instance.invalidateSize({ pan: false }));
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      instance.remove();
      map.current = null;
      marker.current = null;
      fence.current = null;
    };
  }, [editable]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    if (!hasPoint) {
      marker.current?.remove();
      fence.current?.remove();
      marker.current = null;
      fence.current = null;
      return;
    }
    const point = [latitude, longitude];
    if (marker.current) marker.current.setLatLng(point);
    else {
      marker.current = L.marker(point, { icon: pin, draggable: editable, keyboard: editable, title: editable ? 'Pin outlet' : 'Lokasi absensi' }).addTo(instance);
      if (editable) marker.current.on('dragend', event => {
        const location = event.target.getLatLng();
        selection.current?.(location.lat, location.lng);
      });
    }
    if (radius > 0) {
      const border = { color: '#459469', weight: 2, fillColor: '#85c997', fillOpacity: .24, interactive: false };
      if (!fence.current) fence.current = L.circle(point, { ...border, radius }).addTo(instance);
      else fence.current.setLatLng(point).setRadius(radius);
    }
    if (instance.getZoom() < 14) instance.setView(point, 16);
    else if (!instance.getBounds().contains(point)) instance.panTo(point);
  }, [latitude, longitude, radius, hasPoint, editable]);

  return <div className="map-wrap">
    <div ref={container} className={'outlet-map' + (editable ? '' : ' outlet-map-preview')}
      aria-label={editable ? 'Peta untuk menentukan pin outlet' : 'Peta lokasi absensi'}
      tabIndex={editable ? 0 : -1} data-lenis-prevent
      onKeyDown={event => {
        if (!editable || event.key !== 'Enter' || event.target !== container.current) return;
        event.preventDefault();
        const center = map.current?.getCenter();
        if (center) selection.current?.(center.lat, center.lng);
      }} />
    {tileProblem && <p className="field-note" role="status">Peta dasar belum bisa dimuat. {editable ? 'Kamu bisa memakai tombol lokasi perangkat.' : 'Buka lokasi di peta eksternal.'}</p>}
    {editable && <p className="field-note">{hasPoint ? 'Geser pin untuk memperbaiki posisi.' : 'Ketuk peta untuk memasang pin. Dari keyboard, gunakan tombol panah dan Enter.'}</p>}
  </div>;
}
