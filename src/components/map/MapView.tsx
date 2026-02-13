'use client';

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { getCategoryColor, getCategoryIcon } from '@/lib/categories';
import type { Establishment, GeoLocation, Language } from '@/types';

interface MapViewProps {
  establishments: Establishment[];
  center: { lat: number; lng: number };
  zoom?: number;
  userLocation?: GeoLocation | null;
  selectedId?: string | null;
  onMarkerClick?: (establishment: Establishment) => void;
  lang: Language;
  className?: string;
}

// Dynamic import for Leaflet to avoid SSR issues
let L: typeof import('leaflet') | null = null;

export function MapView({
  establishments,
  center,
  zoom = 13,
  userLocation,
  selectedId,
  onMarkerClick,
  lang,
  className,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    // Load Leaflet dynamically
    const loadLeaflet = async () => {
      if (typeof window === 'undefined') return;

      const leaflet = await import('leaflet');
      L = leaflet.default;

      // Import CSS
      await import('leaflet/dist/leaflet.css');

      if (!mapRef.current || mapInstanceRef.current) return;

      // Create map
      const map = L.map(mapRef.current).setView([center.lat, center.lng], zoom);

      // Add tile layer (OpenStreetMap)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      mapInstanceRef.current = map;

      // Add establishment markers
      addMarkers(map, establishments);

      // Add user location marker if available
      if (userLocation) {
        addUserLocationMarker(map, userLocation);
      }
    };

    loadLeaflet();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when establishments change
  useEffect(() => {
    if (!mapInstanceRef.current || !L) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add new markers
    addMarkers(mapInstanceRef.current, establishments);
  }, [establishments]);

  // Update map center when it changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([center.lat, center.lng], zoom);
  }, [center, zoom]);

  const addMarkers = (map: L.Map, places: Establishment[]) => {
    if (!L) return;

    places.forEach((place) => {
      const color = getCategoryColor(place.categorySlug);
      const icon = getCategoryIcon(place.categorySlug);
      const isSelected = place.id === selectedId;

      // Create custom icon
      const customIcon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div class="marker-pin ${isSelected ? 'selected' : ''}" style="background-color: ${color}">
            <span class="marker-icon">${icon}</span>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40],
      });

      const marker = L.marker([place.latitude, place.longitude], { icon: customIcon })
        .addTo(map);

      // Create popup content with Get Directions button
      const displayName = lang === 'fr' && place.nameFr ? place.nameFr : place.name;
      const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}&destination_place_id=&travelmode=walking`;
      const appleMapsUrl = `https://maps.apple.com/?daddr=${place.latitude},${place.longitude}&dirflg=w`;

      const popupContent = `
        <div class="map-popup" style="min-width: 220px;">
          <h3 style="font-weight: 600; margin-bottom: 4px;">${displayName}</h3>
          <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #666;">
            <span>\u2605 ${place.rating.toFixed(1)}</span>
            <span>\u2022</span>
            <span>${'\u20AC'.repeat(place.priceLevel)}</span>
          </div>
          <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px;">
            ${place.dogFeatures.waterBowl ? '<span title="Water Bowl">\uD83D\uDCA7</span>' : ''}
            ${place.dogFeatures.treats ? '<span title="Treats">\uD83E\uDDB4</span>' : ''}
            ${place.dogFeatures.outdoorSeating ? '<span title="Outdoor Seating">\u2600\uFE0F</span>' : ''}
            ${place.dogFeatures.indoorAllowed ? '<span title="Dogs Inside">\uD83C\uDFE0</span>' : ''}
          </div>
          <div style="margin-top: 10px; display: flex; gap: 6px;">
            <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer"
               style="flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 10px; background: #3b82f6; color: white; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 500; transition: background 0.2s;"
               onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
              \uD83D\uDCCD Directions
            </a>
            <a href="${appleMapsUrl}" target="_blank" rel="noopener noreferrer"
               style="display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px; background: #f3f4f6; color: #374151; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 500; border: 1px solid #e5e7eb; transition: background 0.2s;"
               onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
              \uD83C\uDF0D Maps
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      // Handle marker click
      marker.on('click', () => {
        if (onMarkerClick) {
          onMarkerClick(place);
        }
      });

      markersRef.current.push(marker);
    });
  };

  const addUserLocationMarker = (map: L.Map, location: GeoLocation) => {
    if (!L) return;

    const userIcon = L.divIcon({
      className: 'user-location-marker',
      html: `
        <div class="user-marker-pin">
          <div class="user-marker-pulse"></div>
          <div class="user-marker-dot"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    L.marker([location.latitude, location.longitude], { icon: userIcon })
      .addTo(map)
      .bindPopup(lang === 'fr' ? 'Votre position' : 'Your location');
  };

  return (
    <div className={cn('relative', className)}>
      <div ref={mapRef} className="w-full h-full rounded-xl" />
      {/* Custom marker styles */}
      <style jsx global>{`
        .custom-marker {
          background: transparent !important;
          border: none !important;
        }

        .marker-pin {
          width: 40px;
          height: 40px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          transition: transform 0.2s ease;
        }

        .marker-pin.selected {
          transform: rotate(-45deg) scale(1.2);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .marker-icon {
          transform: rotate(45deg);
          font-size: 18px;
        }

        .user-location-marker {
          background: transparent !important;
          border: none !important;
        }

        .user-marker-pin {
          position: relative;
          width: 24px;
          height: 24px;
        }

        .user-marker-pulse {
          position: absolute;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(59, 130, 246, 0.3);
          animation: pulse 2s infinite;
        }

        .user-marker-dot {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #3b82f6;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }

        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }

        .map-popup {
          padding: 4px;
        }

        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .leaflet-popup-content {
          margin: 12px;
        }
      `}</style>
    </div>
  );
}
