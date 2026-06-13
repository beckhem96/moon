"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { HeritageSite } from "./acl";

/** AC-F5-1: 연고지 지도 — Leaflet + OSM (API 키 불필요, 04-plan §2) */

// 번들러 환경에서 기본 마커 아이콘 경로가 깨지는 leaflet 알려진 이슈 보정
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

export default function SiteMap({ site }: { site: HeritageSite }) {
  return (
    <MapContainer
      center={[site.coords.lat, site.coords.lng]}
      zoom={15}
      scrollWheelZoom={false}
      className="z-0 h-64 w-full rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[site.coords.lat, site.coords.lng]} icon={markerIcon}>
        <Popup>
          {site.name} ({site.relation})
        </Popup>
      </Marker>
    </MapContainer>
  );
}
