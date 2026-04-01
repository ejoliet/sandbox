import L from 'leaflet';
import type { MarkerData } from '@/types';

const GOLD = '#D4AF37';
const WHITE = '#ffffff';
const DARK  = '#0a0a0f';

export function createMarkerIcon(isSelected: boolean, isHovered: boolean) {
  const size   = isSelected ? 22 : isHovered ? 16 : 10;
  const bg     = isSelected ? WHITE : GOLD;
  const border = `1.5px solid ${DARK}`;
  const shadow = isSelected
    ? `0 0 0 3px ${GOLD}, 0 0 16px 6px rgba(212,175,55,0.7)`
    : isHovered
    ? `0 0 8px 3px rgba(212,175,55,0.55)`
    : `0 0 4px 1px rgba(212,175,55,0.3)`;

  return L.divIcon({
    className: 'cinema-marker',
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${bg};
      border-radius:50%;
      border:${border};
      box-shadow:${shadow};
    "></div>`,
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function createClusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount();
  const size  = count < 10 ? 34 : count < 100 ? 42 : 52;
  const fs    = size < 38 ? 11 : size < 46 ? 13 : 15;

  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;
      background:rgba(10,10,15,0.88);
      border:2px solid ${GOLD};
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:${GOLD};font-size:${fs}px;font-weight:700;font-family:Inter,sans-serif;
      box-shadow:0 0 10px rgba(212,175,55,0.35);
      backdrop-filter:blur(4px);
    ">${count}</div>`,
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
