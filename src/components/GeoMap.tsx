"use client";

import { useEffect, useRef, useState } from "react";
import type { LayerGroup } from "leaflet";

export interface MapDeposit {
  name: string;
  lat: number;
  lon: number;
  metal?: string;
}

interface GeoMapProps {
  confidence?: number;
  deposits?: MapDeposit[];
}

type MapLayer = "satellite" | "topo";

const FAULT_LINE: [number, number][] = [
  [23.490, 109.188],
  [23.478, 109.197],
  [23.465, 109.205],
  [23.455, 109.210],
  [23.440, 109.215],
  [23.425, 109.222],
  [23.410, 109.228],
];

const TARGET_POLYGON: [number, number][] = [
  [23.456, 109.213],
  [23.450, 109.220],
  [23.440, 109.218],
  [23.441, 109.208],
  [23.450, 109.205],
  [23.456, 109.213],
];

const DRILL_POINT: [number, number] = [23.448, 109.214];

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

export default function GeoMap({ confidence = 89.4, deposits = [] }: GeoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const labelsLayerRef = useRef<any>(null);
  const demoLayerRef = useRef<LayerGroup | null>(null);
  const depositLayerRef = useRef<LayerGroup | null>(null);
  const [activeLayer, setActiveLayer] = useState<MapLayer>("satellite");

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

    import("leaflet").then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      const map = L.map(mapRef.current!, {
        center: [23.455, 109.210],
        zoom: 13,
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

      // Static demo overlays, replaced by real deposits after the first query
      const demo = L.layerGroup().addTo(map);
      demoLayerRef.current = demo;

      // ── F3 Fault Line ──
      L.polyline(FAULT_LINE, {
        color: "#fbbf24",
        weight: 3,
        dashArray: "12 7",
        opacity: 0.95,
      }).addTo(demo);

      // Fault label
      L.marker([23.478, 109.193], {
        icon: L.divIcon({
          className: "",
          html: `<div style="
            background:rgba(0,0,0,0.65);
            backdrop-filter:blur(4px);
            color:#fbbf24;
            font-size:11px;
            font-weight:700;
            padding:4px 10px;
            border-radius:20px;
            white-space:nowrap;
            border:1px solid rgba(251,191,36,0.4);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            letter-spacing:0.02em;
          ">F3 构造断裂带</div>`,
          iconAnchor: [70, 12],
        }),
      }).addTo(demo);

      // ── Target Polygon ──
      L.polygon(TARGET_POLYGON, {
        color: "#f59e0b",
        fillColor: "#fbbf24",
        fillOpacity: 0.25,
        weight: 2.5,
        dashArray: "7 5",
      }).addTo(demo);

      // ── Drill Point ──
      const drillIcon = L.divIcon({
        className: "",
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;">
          <div style="
            width:16px;height:16px;
            background:#f59e0b;
            border-radius:50%;
            border:3px solid white;
            box-shadow:0 0 0 4px rgba(245,158,11,0.35), 0 2px 10px rgba(0,0,0,0.4);
          "></div>
        </div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const drillMarker = L.marker(DRILL_POINT, { icon: drillIcon }).addTo(demo);

      const popupHtml = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-width:230px;padding:0;">
          <div style="padding:11px 15px;border-bottom:1px solid #f5f5f4;display:flex;justify-content:space-between;align-items:center;">
            <span style="color:#b45309;font-size:10px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;">隐伏矿预测靶区</span>
            <span style="color:#065f46;background:#d1fae5;border:1px solid #a7f3d0;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;">${confidence.toFixed(1)}%</span>
          </div>
          <div style="padding:11px 15px;display:flex;flex-direction:column;gap:7px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;">
              <span style="color:#a8a29e;">建议勘探钻孔</span><span style="color:#1c1917;font-weight:600;">ZK-01</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;">
              <span style="color:#a8a29e;">推测靶区深度</span><span style="color:#1c1917;font-weight:600;">350–420m</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;">
              <span style="color:#a8a29e;">矿种</span><span style="color:#b45309;font-weight:700;">Au · REE</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#a8a29e;padding-top:4px;border-top:1px solid #f5f5f4;">
              <span>23.448°N</span><span>109.214°E</span>
            </div>
          </div>
        </div>
      `;

      drillMarker.bindPopup(popupHtml, {
        maxWidth: 280,
        closeButton: true,
        offset: [0, -12],
        className: "geo-popup",
      }).openPopup();
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
        labelsLayerRef.current = null;
        demoLayerRef.current = null;
        depositLayerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || deposits.length === 0) return;

    import("leaflet").then((L) => {
      if (demoLayerRef.current) {
        map.removeLayer(demoLayerRef.current);
        demoLayerRef.current = null;
      }
      if (depositLayerRef.current) map.removeLayer(depositLayerRef.current);
      const group = L.layerGroup().addTo(map);
      depositLayerRef.current = group;

      const depositIcon = L.divIcon({
        className: "",
        html: `<div style="
          width:14px;height:14px;
          background:#f59e0b;
          border-radius:50%;
          border:3px solid white;
          box-shadow:0 0 0 4px rgba(245,158,11,0.35), 0 2px 10px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      for (const d of deposits) {
        L.marker([d.lat, d.lon], { icon: depositIcon })
          .bindPopup(`
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-width:200px;padding:11px 15px;display:flex;flex-direction:column;gap:6px;">
              <span style="color:#1c1917;font-size:13px;font-weight:700;">${d.name}</span>
              ${d.metal ? `<span style="color:#b45309;font-size:12px;font-weight:700;">${d.metal}</span>` : ""}
              <span style="color:#a8a29e;font-size:11px;">≈ ${d.lat.toFixed(2)}°N, ${d.lon.toFixed(2)}°E</span>
            </div>
          `, { maxWidth: 280, offset: [0, -10], className: "geo-popup" })
          .addTo(group);
      }

      map.fitBounds(
        L.latLngBounds(deposits.map((d) => [d.lat, d.lon] as [number, number])),
        { padding: [60, 60], maxZoom: 10 }
      );
    });
  }, [deposits]);

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
