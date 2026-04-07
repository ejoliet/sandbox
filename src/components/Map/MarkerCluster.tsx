import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import { createMarkerIcon, createClusterIcon } from './MovieMarker';
import { useMapStore } from '@/store/mapStore';
import { seedRecordsToMovies } from '@/services/wikidata';
import type { MarkerData } from '@/types';

interface MarkerClusterProps {
  markers: MarkerData[];
}

export default function MarkerCluster({ markers }: MarkerClusterProps) {
  const map          = useMap();
  const groupRef     = useRef<L.MarkerClusterGroup | null>(null);
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());

  const { selectedMovie, setSelectedMovie, setSearchResults, setSidebarOpen } = useMapStore();

  useEffect(() => {
    // Build cluster group
    const group = L.markerClusterGroup({
      chunkedLoading:     true,
      maxClusterRadius:   60,
      spiderfyOnMaxZoom:  true,
      showCoverageOnHover: false,
      iconCreateFunction: createClusterIcon,
      animate:            true,
    } as L.MarkerClusterGroupOptions);

    const markerMap = new Map<string, L.Marker>();

    for (const m of markers) {
      const marker = L.marker([m.lat, m.lng], {
        icon:  createMarkerIcon(false, false),
        title: m.title,
      });

      marker.on('click', () => {
        // Build a minimal MovieLocation from this marker and select it
        setSelectedMovie({
          wikidataId: m.id,
          title:      m.title,
          year:       m.year,
          imdbId:     null,
          locations:  [{ label: m.locationLabel, lat: m.lat, lng: m.lng }],
        });
      });

      marker.on('mouseover', () => {
        marker.setIcon(createMarkerIcon(false, true));
        marker.bindTooltip(
          `<div style="font-size:12px;font-weight:600;color:#e8e8f0">${m.title}${m.year ? ` (${m.year})` : ''}</div>
           <div style="font-size:10px;color:#8888aa">${m.locationLabel}</div>`,
          { direction: 'top', offset: [0, -8], className: '' }
        ).openTooltip();
      });

      marker.on('mouseout', () => {
        const isSelected = selectedMovie?.wikidataId === m.id;
        marker.setIcon(createMarkerIcon(isSelected, false));
        marker.closeTooltip();
      });

      group.addLayer(marker);
      markerMap.set(m.id, marker);
    }

    // Handle cluster click → show list of movies in cluster
    group.on('clusterclick', (e: L.LeafletEvent) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cluster = (e as any).layer as L.MarkerCluster;
      const childMarkers = cluster.getAllChildMarkers();

      const seenIds = new Set<string>();
      const movies: ReturnType<typeof seedRecordsToMovies> = [];

      for (const cm of childMarkers) {
        const id = (cm.options as { title?: string }).title;
        // Find matching markerData
        const md = markers.find((mk) => {
          const m = markerMap.get(mk.id);
          return m === cm;
        });
        if (md && !seenIds.has(md.id)) {
          seenIds.add(md.id);
          movies.push({
            wikidataId: md.id,
            title:      md.title,
            year:       md.year,
            imdbId:     null,
            locations:  [{ label: md.locationLabel, lat: md.lat, lng: md.lng }],
          });
        }
      }

      if (movies.length > 0) {
        setSearchResults(movies.slice(0, 30));
        setSidebarOpen(true);
      }
    });

    map.addLayer(group);
    groupRef.current     = group;
    markerMapRef.current = markerMap;

    return () => {
      map.removeLayer(group);
    };
  }, [markers, map]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update selected marker icon when selection changes
  useEffect(() => {
    const markerMap = markerMapRef.current;
    for (const [id, marker] of markerMap) {
      const isSelected = selectedMovie?.wikidataId === id;
      marker.setIcon(createMarkerIcon(isSelected, false));
      if (isSelected) marker.setZIndexOffset(1000);
      else            marker.setZIndexOffset(0);
    }
  }, [selectedMovie]);

  return null;
}
