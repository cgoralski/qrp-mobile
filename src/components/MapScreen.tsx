import { useEffect, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const DEFAULT_CENTER: [number, number] = [-25.27, 133.78]; // Australia
const DEFAULT_ZOOM = 10;

const LOCATION_UPDATE_INTERVAL_MS = 60_000; // 1 minute

// Fix default marker icons in react-leaflet (webpack/vite path issue)
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

interface MapScreenProps {
  myCallsign: string;
}

function LocationSync({ position, myCallsign }: { position: { lat: number; lng: number } | null; myCallsign: string }) {
  const lastSent = useRef<number>(0);
  const sendToSupabase = useCallback(async () => {
    if (!position || !myCallsign.trim()) return;
    const now = Date.now();
    if (now - lastSent.current < LOCATION_UPDATE_INTERVAL_MS) return;
    lastSent.current = now;
    try {
      await supabase.from("user_locations").upsert(
        {
          callsign: myCallsign.trim().toUpperCase(),
          lat: position.lat,
          lng: position.lng,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "callsign" }
      );
    } catch (e) {
      console.warn("MapScreen: failed to update user location", e);
    }
  }, [position, myCallsign]);

  useEffect(() => {
    sendToSupabase();
    const interval = setInterval(sendToSupabase, LOCATION_UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [sendToSupabase]);

  return null;
}

function MapCenterToPosition({ position }: { position: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView([position.lat, position.lng], map.getZoom(), { animate: true });
  }, [map, position]);
  return null;
}

export default function MapScreen({ myCallsign }: MapScreenProps) {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this device.");
      return;
    }
    const onSuccess = (geo: GeolocationPosition) => {
      setError(null);
      setPosition({ lat: geo.coords.latitude, lng: geo.coords.longitude });
    };
    const onFailure = (err: GeolocationPositionError) => {
      setError(err.message === "User denied Geolocation" ? "Location permission denied." : "Unable to get location.");
      setPosition(null);
    };
    const id = navigator.geolocation.watchPosition(onSuccess, onFailure, {
      enableHighAccuracy: true,
      maximumAge: 30_000,
      timeout: 15_000,
    });
    return () => {
      navigator.geolocation.clearWatch(id);
    };
  }, []);

  const center = position ?? DEFAULT_CENTER;
  const zoom = position ? 12 : DEFAULT_ZOOM;

  return (
    <div className="tab-panel flex flex-1 flex-col w-full min-h-0">
      <div className="tab-header flex items-center justify-between px-3 py-2.5 flex-shrink-0">
        <span className="tab-section-title">MAP</span>
        <span className="tab-meta">REPEATER MAP</span>
      </div>
      {error && (
        <div className="px-3 py-2 flex-shrink-0 text-sm text-amber-200 bg-amber-900/30 rounded-md mx-2">
          {error}
        </div>
      )}
      <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-border">
        <MapContainer
          center={center}
          zoom={zoom}
          className="h-full w-full"
          style={{ minHeight: "280px" }}
          scrollWheelZoom
        >
          <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_URL} />
          <MapCenterToPosition position={position} />
          <LocationSync position={position} myCallsign={myCallsign} />
          {position && (
            <Marker position={[position.lat, position.lng]} icon={defaultIcon}>
              <Popup>Your location (updated every minute)</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
