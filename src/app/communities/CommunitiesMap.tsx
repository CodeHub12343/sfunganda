"use client";

// Real map using Leaflet + OpenStreetMap tiles (the free, no-key provider).
// We import leaflet lazily on the client only — see CommunitiesView.
import { useEffect, useRef } from "react";
import styled from "styled-components";

type Marker = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  businesses: number;
};

const Wrap = styled.div`
  position: relative;
  min-height: 420px;
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const MapHost = styled.div`
  min-height: 420px;
  height: 100%;
  width: 100%;
`;

const EmptyNote = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: ${({ theme }) => theme.colors.inkMuted};
  background: ${({ theme }) => theme.colors.bgSoft};
`;

export function CommunitiesMap({ markers }: { markers: Marker[] }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    if (markers.length === 0) return;

    let mounted = true;

    (async () => {
      // Load CSS and the library on the client only.
      await import("leaflet/dist/leaflet.css");
      const L = (await import("leaflet")).default;
      if (!mounted || !hostRef.current) return;

      // Center on the first marker; a bounds fit covers the rest.
      const first = markers[0]!;
      const map = L.map(hostRef.current, {
        center: [first.lat, first.lng],
        zoom: 7,
        scrollWheelZoom: false,
      });
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 11, // cap so a visitor can't zoom in on precise coords
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const bounds = L.latLngBounds([]);
      for (const m of markers) {
        const marker = L.circleMarker([m.lat, m.lng], {
          radius: 10,
          color: "#103D7A",
          weight: 2,
          fillColor: "#F28C28",
          fillOpacity: 0.85,
        }).addTo(map);
        marker.bindPopup(
          `<strong>${escapeHtml(m.name)}</strong><br/>${m.businesses} business${m.businesses === 1 ? "" : "es"}<br/><em>coarse location (±~11 km)</em>`
        );
        bounds.extend([m.lat, m.lng]);
      }
      if (markers.length > 1) {
        map.fitBounds(bounds.pad(0.4), { maxZoom: 8 });
      }
    })();

    return () => {
      mounted = false;
      const existing = mapRef.current as { remove?: () => void } | null;
      existing?.remove?.();
      mapRef.current = null;
    };
  }, [markers]);

  return (
    <Wrap>
      <MapHost ref={hostRef} aria-hidden={markers.length === 0} />
      {markers.length === 0 ? (
        <EmptyNote>No published coordinates yet — see the list on the right.</EmptyNote>
      ) : null}
    </Wrap>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
}
