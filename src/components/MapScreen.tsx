import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerIconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";
import { supabase } from "@/features/cloud/supabaseClient";
import { CloudFeaturesBanner, type CloudFeaturesBannerKind } from "@/components/CloudFeaturesBanner";
import { useNavigatorOnline } from "@/hooks/use-navigator-online";

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const DEFAULT_CENTER: [number, number] = [-25.27, 133.78]; // Australia
const DEFAULT_ZOOM = 10;

const LOCATION_UPDATE_INTERVAL_MS = 60_000; // 1 minute

const defaultIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

interface MapScreenProps {
  myCallsign: string;
}

function TileErrorWatcher({ onTilesLikelyFailed }: { onTilesLikelyFailed: () => void }) {
  const tileErrors = useRef(0);
  useMapEvents({
    tileerror: () => {
      tileErrors.current += 1;
      if (tileErrors.current >= 2) onTilesLikelyFailed();
    },
  });
  return null;
}

function LocationSync({
  position,
  myCallsign,
  onCloudFailure,
}: {
  position: { lat: number; lng: number } | null;
  myCallsign: string;
  onCloudFailure: () => void;
}) {
  const lastSent = useRef<number>(0);
  const sendToSupabase = useCallback(async () => {
    if (!position || !myCallsign.trim()) return;
    const now = Date.now();
    if (now - lastSent.current < LOCATION_UPDATE_INTERVAL_MS) return;
    lastSent.current = now;
    try {
      const { error } = await supabase.from("user_locations").upsert(
        {
          callsign: myCallsign.trim().toUpperCase(),
          lat: position.lat,
          lng: position.lng,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "callsign" }
      );
      if (error) onCloudFailure();
    } catch {
      onCloudFailure();
    }
  }, [position, myCallsign, onCloudFailure]);

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

function CoordinateFallback({
  position,
  fallbackCenter,
  zoom,
}: {
  position: { lat: number; lng: number } | null;
  fallbackCenter: [number, number];
  zoom: number;
}) {
  const lat = position?.lat ?? fallbackCenter[0];
  const lng = position?.lng ?? fallbackCenter[1];
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 p-6 text-center h-full min-h-[280px] rounded-lg border border-border"
      style={{
        background:
          "linear-gradient(165deg, hsl(220 16% 12%) 0%, hsl(220 14% 8%) 100%)",
      }}
    >
      <div className="font-mono-display text-xs tracking-widest text-muted-foreground">POSITION (NO BASEMAP)</div>
      <div className="font-mono-display text-2xl font-bold tabular-nums text-primary/95">
        {lat.toFixed(5)}°, {lng.toFixed(5)}°
      </div>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
        OpenStreetMap tiles need internet. GPS can still work without them. Zoom level when map loads: {zoom}.
      </p>
      {!position && (
        <p className="text-xs text-amber-200/80">Showing default center until a GPS fix is available.</p>
      )}
    </div>
  );
}

export default function MapScreen({ myCallsign }: MapScreenProps) {
  const online = useNavigatorOnline();
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [locationCloudFailed, setLocationCloudFailed] = useState(false);

  useEffect(() => {
    if (online) {
      setTilesFailed(false);
      setLocationCloudFailed(false);
    }
  }, [online]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by this device.");
      return;
    }
    const onSuccess = (geo: GeolocationPosition) => {
      setGeoError(null);
      setPosition({ lat: geo.coords.latitude, lng: geo.coords.longitude });
    };
    const onFailure = (err: GeolocationPositionError) => {
      setGeoError(
        err.message === "User denied Geolocation" ? "Location permission denied." : "Unable to get location."
      );
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

  const bannerKind = useMemo((): CloudFeaturesBannerKind | null => {
    if (!online) return "offline";
    if (tilesFailed) return "tiles";
    if (locationCloudFailed) return "cloud";
    return null;
  }, [online, tilesFailed, locationCloudFailed]);

  return (
    <div className="tab-panel flex flex-1 flex-col w-full min-h-0">
      <div className="tab-header flex items-center justify-between px-3 py-2.5 flex-shrink-0">
        <span className="tab-section-title">MAP</span>
        <span className="tab-meta">REPEATER MAP</span>
      </div>
      <div className="px-2 pb-2 flex-shrink-0 space-y-2">
        <CloudFeaturesBanner kind={bannerKind} />
        {geoError && (
          <div className="px-3 py-2 text-sm text-amber-200 bg-amber-900/30 rounded-md">{geoError}</div>
        )}
      </div>
      <LocationSync
        position={position}
        myCallsign={myCallsign}
        onCloudFailure={() => setLocationCloudFailed(true)}
      />
      <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-border mx-2 mb-2">
        {tilesFailed ? (
          <CoordinateFallback position={position} fallbackCenter={DEFAULT_CENTER} zoom={zoom} />
        ) : (
          <MapContainer
            center={center}
            zoom={zoom}
            className="h-full w-full"
            style={{ minHeight: "280px" }}
            scrollWheelZoom
          >
            <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_URL} />
            <TileErrorWatcher key={online ? "online" : "offline"} onTilesLikelyFailed={() => setTilesFailed(true)} />
            <MapCenterToPosition position={position} />
            {position && (
              <Marker position={[position.lat, position.lng]} icon={defaultIcon}>
                <Popup>Your location (updated every minute)</Popup>
              </Marker>
            )}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
