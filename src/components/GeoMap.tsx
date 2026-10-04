"use client";

import { useEffect, useRef, useState } from "react";
import type { LayerGroup } from "leaflet";

export interface MapDeposit {
  name: string;
  lat: number;
  lon: number;
  metal?: string;
  fault?: string;
}

interface GeoMapProps {
  /** Every known deposit, shown as context */
  deposits?: MapDeposit[];
  /** Deposits matched by the latest query, highlighted and zoomed to */
  highlighted?: MapDeposit[];
  /** Target area as GeoJSON-style [lon, lat] ring */
  target?: number[][];
}

type MapLayer = "satellite" | "topo";

const TILE_LAYERS = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: 'Imagery &copy; <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics',
    maxZoom: 18,
    label: "卫星影像",
    labelEn: "Satellite",
  },
  topo: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: 'Map data &copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 15,
    label: "地形图",
    labelEn: "Topo",
  },
};

export default function GeoMap({ deposits = [], highlighted = [], target = [] }: GeoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const labelsLayerRef = useRef<any>(null);
  const depositLayerRef = useRef<LayerGroup | null>(null);
  const [activeLayer, setActiveLayer] = useState<MapLayer>("satellite");
  const [mapReady, setMapReady] = useState(false);

  const switchLayer = (layer: MapLayer) => {
    if (!mapInstanceRef.current) return;
    setActiveLayer(layer);

    import("leaflet").then((L) => {
      const map = mapInstanceRef.current;
      if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
      if (labelsLayerRef.current) map.removeLayer(labelsLayerRef.current);

      const config = TILE_LAYERS[layer];
      tileLayerRef.current = L.tileLayer(config.url, {
        attribution: config.attribution,
        maxZoom: config.maxZoom,
        subdomains: layer === "topo" ? "abc" : undefined,
      }).addTo(map);

      // For satellite, add a label overlay so place names are visible
      if (layer === "satellite") {
        labelsLayerRef.current = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
          { attribution: "", maxZoom: 18, opacity: 0.9 }
        ).addTo(map);
      }
    });
  };

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    // Leaflet loads async; if this effect is cleaned up first (React Strict Mode re-runs effects in dev),
    // skip init so the re-run is the only one that creates the map
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      const map = L.map(mapRef.current!, {
        center: [23.8, 108.8],
        zoom: 7,
        zoomControl: false,
        attributionControl: true,
      });
      mapInstanceRef.current = map;

      // Start with satellite
      const satConfig = TILE_LAYERS.satellite;
      tileLayerRef.current = L.tileLayer(satConfig.url, {
        attribution: satConfig.attribution,
        maxZoom: satConfig.maxZoom,
      }).addTo(map);

      // Satellite label overlay
      labelsLayerRef.current = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { attribution: "", maxZoom: 18, opacity: 0.9 }
      ).addTo(map);

      // Custom zoom control
      L.control.zoom({ position: "bottomright" }).addTo(map);

      setMapReady(true);
    });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
        labelsLayerRef.current = null;
        depositLayerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!mapReady || !map) return;

    import("leaflet").then((L) => {
      if (depositLayerRef.current) map.removeLayer(depositLayerRef.current);
      const group = L.layerGroup().addTo(map);
      depositLayerRef.current = group;

      const icon = (active: boolean) => L.divIcon({
        className: "",
        html: active
          ? `<div style="width:14px;height:14px;background:#f59e0b;border-radius:50%;border:3px solid white;
              box-shadow:0 0 0 4px rgba(245,158,11,0.35), 0 2px 10px rgba(0,0,0,0.4);"></div>`
          : `<div style="width:10px;height:10px;background:#fcd34d;border-radius:50%;border:2px solid #78350f;
              box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
        iconSize: active ? [20, 20] : [14, 14],
        iconAnchor: active ? [10, 10] : [7, 7],
      });

      if (target.length > 0) {
        L.polygon(target.map(([lon, lat]) => [lat, lon] as [number, number]), {
          color: "#f59e0b",
          fillColor: "#fbbf24",
          fillOpacity: 0.15,
          weight: 2,
          dashArray: "7 5",
        }).addTo(group);
      }

      const highlightedNames = new Set(highlighted.map((d) => d.name));
      const others = deposits.filter((d) => !highlightedNames.has(d.name));
      // Highlighted last so they sit on top
      for (const [d, active] of [...others.map((d) => [d, false] as const), ...highlighted.map((d) => [d, true] as const)]) {
        L.marker([d.lat, d.lon], { icon: icon(active), zIndexOffset: active ? 1000 : 0 })
          .bindPopup(`
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-width:200px;padding:11px 15px;display:flex;flex-direction:column;gap:6px;">
              <span style="color:#1c1917;font-size:13px;font-weight:700;">${d.name}</span>
              ${d.metal ? `<span style="color:#b45309;font-size:12px;font-weight:700;">${d.metal}</span>` : ""}
              ${d.fault ? `<span style="color:#57534e;font-size:12px;">${d.fault}</span>` : ""}
              <span style="color:#a8a29e;font-size:11px;">≈ ${d.lat.toFixed(2)}°N, ${d.lon.toFixed(2)}°E</span>
            </div>
          `, { maxWidth: 280, offset: [0, -10], className: "geo-popup" })
          .addTo(group);
      }

      const focus = highlighted.length > 0 ? highlighted : deposits;
      if (focus.length > 0) {
        map.fitBounds(
          L.latLngBounds(focus.map((d) => [d.lat, d.lon] as [number, number])),
          { padding: [60, 60], maxZoom: 10 }
        );
      }
    });
  }, [mapReady, deposits, highlighted, target]);

  return (
    <>
      <style>{`
        .geo-popup .leaflet-popup-content-wrapper {
          padding: 0;
          border-radius: 14px;
          border: 1px solid #e7e5e4;
          overflow: hidden;
          box-shadow: 0 12px 40px rgba(0,0,0,0.15);
        }
        .geo-popup .leaflet-popup-content { margin: 0; }
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.15) !important;
        }
        .leaflet-control-zoom a {
          background: rgba(255,255,255,0.92) !important;
          backdrop-filter: blur(8px) !important;
          color: #44403c !important;
          border: 1px solid rgba(255,255,255,0.5) !important;
          font-size: 16px !important;
          border-radius: 8px !important;
          margin-bottom: 4px !important;
          width: 32px !important;
          height: 32px !important;
          line-height: 32px !important;
        }
        .leaflet-control-zoom a:hover { background: white !important; }
        .leaflet-control-attribution {
          background: rgba(0,0,0,0.45) !important;
          backdrop-filter: blur(4px) !important;
          color: rgba(255,255,255,0.7) !important;
          font-size: 9px !important;
          border-radius: 6px 0 0 0 !important;
          padding: 2px 6px !important;
        }
        .leaflet-control-attribution a { color: rgba(255,255,255,0.8) !important; }
      `}</style>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossOrigin="" />

      {/* Layer Toggle — floating top-right of the map */}
      <div style={{
        position: "absolute", top: "14px", right: "14px", zIndex: 1000,
        display: "flex", borderRadius: "24px", overflow: "hidden",
        boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        border: "1px solid rgba(255,255,255,0.3)",
        backdropFilter: "blur(8px)",
      }}>
        {(["satellite", "topo"] as MapLayer[]).map((layer) => (
          <button
            key={layer}
            onClick={() => switchLayer(layer)}
            style={{
              padding: "6px 14px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              cursor: "pointer",
              border: "none",
              outline: "none",
              transition: "all 0.2s",
              background: activeLayer === layer
                ? "rgba(245,158,11,0.95)"
                : "rgba(0,0,0,0.55)",
              color: activeLayer === layer ? "#fff" : "rgba(255,255,255,0.7)",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
          >
            {TILE_LAYERS[layer].labelEn}
          </button>
        ))}
      </div>

      <div ref={mapRef} style={{ width: "100%", height: "100%", borderRadius: "inherit" }} />
    </>
  );
}
