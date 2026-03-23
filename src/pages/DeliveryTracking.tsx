/// <reference types="@types/google.maps" />
import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db, GOOGLE_MAPS_API_KEY } from "../firebase/config";
import { useAppSelector } from "../store/hooks";
import {
  ArrowLeft,
  MapPin,
  Truck,
  Users,
  Signal,
  SignalZero,
  RefreshCw,
  Loader2,
  ChevronDown,
  Phone,
  Mail,
  Clock,
  Navigation,
} from "lucide-react";
import { Wrapper, Status } from "@googlemaps/react-wrapper";

// ── Types ────────────────────────────────────────────────────────────────────

interface DeliveryBoyLocation {
  uid: string;
  name: string;
  phone?: string;
  email?: string;
  lat: number;
  lng: number;
  lastUpdated: string;
  activeDeliveries: number;
}

// ── Google Map Component ──────────────────────────────────────────────────────

function GoogleMap({
  locations,
  selectedId,
  onMarkerClick,
}: {
  locations: DeliveryBoyLocation[];
  selectedId: string | null;
  onMarkerClick: (uid: string) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // Initialize the map
  useEffect(() => {
    if (!mapRef.current || googleMapRef.current) return;

    // Center on Sri Lanka
    googleMapRef.current = new google.maps.Map(mapRef.current, {
      center: { lat: 7.8731, lng: 80.7718 },
      zoom: 8,
      mapId: "delivery-tracking-map",
      styles: [
        { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#8a8a9a" }] },
        {
          featureType: "administrative",
          elementType: "geometry.stroke",
          stylers: [{ color: "#2a2a4e" }],
        },
        {
          featureType: "road",
          elementType: "geometry",
          stylers: [{ color: "#2a2a3e" }],
        },
        {
          featureType: "road",
          elementType: "geometry.stroke",
          stylers: [{ color: "#1a1a2e" }],
        },
        {
          featureType: "road.highway",
          elementType: "geometry",
          stylers: [{ color: "#3a3a5e" }],
        },
        {
          featureType: "water",
          elementType: "geometry",
          stylers: [{ color: "#0e0e1a" }],
        },
        {
          featureType: "poi",
          elementType: "geometry",
          stylers: [{ color: "#1e1e32" }],
        },
        {
          featureType: "poi.park",
          elementType: "geometry",
          stylers: [{ color: "#1a2e1a" }],
        },
        {
          featureType: "transit",
          elementType: "geometry",
          stylers: [{ color: "#1a1a2e" }],
        },
      ],
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    infoWindowRef.current = new google.maps.InfoWindow();
  }, []);

  // Update markers
  useEffect(() => {
    if (!googleMapRef.current) return;

    // Clear old markers
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];

    if (locations.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    locations.forEach((loc) => {
      const position = { lat: loc.lat, lng: loc.lng };
      bounds.extend(position);

      // Create custom marker element
      const markerEl = document.createElement("div");
      markerEl.className = "delivery-marker";
      markerEl.innerHTML = `
        <div style="
          position: relative;
          cursor: pointer;
          transition: transform 0.2s ease;
        ">
          <div style="
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: ${selectedId === loc.uid ? "linear-gradient(135deg, #8b5cf6, #6366f1)" : "linear-gradient(135deg, #3b82f6, #2563eb)"};
            border: 3px solid ${selectedId === loc.uid ? "#c4b5fd" : "#93c5fd"};
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 15px rgba(${selectedId === loc.uid ? "139, 92, 246" : "59, 130, 246"}, 0.5);
            animation: markerPulse 2s ease-in-out infinite;
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="1" y="3" width="15" height="13" rx="2" ry="2"/>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <div style="
            position: absolute;
            bottom: -8px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-top: 10px solid ${selectedId === loc.uid ? "#6366f1" : "#2563eb"};
          "></div>
          <div style="
            position: absolute;
            top: -10px;
            right: -10px;
            background: #22c55e;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 800;
            color: white;
            border: 2px solid #1a1a2e;
          ">${loc.activeDeliveries}</div>
        </div>
      `;

      markerEl.addEventListener("mouseenter", () => {
        markerEl.style.transform = "scale(1.15)";
      });
      markerEl.addEventListener("mouseleave", () => {
        markerEl.style.transform = "scale(1)";
      });

      try {
        const marker = new google.maps.marker.AdvancedMarkerElement({
          map: googleMapRef.current!,
          position,
          content: markerEl,
          title: loc.name,
        });

        marker.addListener("click", () => {
          onMarkerClick(loc.uid);

          const timeSince = getTimeSinceUpdate(loc.lastUpdated);

          if (infoWindowRef.current && googleMapRef.current) {
            infoWindowRef.current.setContent(`
              <div style="
                background: #1a1a2e;
                color: white;
                padding: 16px;
                border-radius: 12px;
                min-width: 220px;
                font-family: 'Inter', sans-serif;
              ">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                  <div style="
                    width: 36px; height: 36px; border-radius: 10px;
                    background: linear-gradient(135deg, #8b5cf6, #6366f1);
                    display: flex; align-items: center; justify-content: center;
                  ">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                      <rect x="1" y="3" width="15" height="13" rx="2" ry="2"/>
                      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                      <circle cx="5.5" cy="18.5" r="2.5"/>
                      <circle cx="18.5" cy="18.5" r="2.5"/>
                    </svg>
                  </div>
                  <div>
                    <div style="font-weight: 700; font-size: 14px;">${loc.name}</div>
                    <div style="font-size: 11px; color: #8b5cf6;">${loc.activeDeliveries} active deliveries</div>
                  </div>
                </div>
                ${loc.phone ? `<div style="font-size: 12px; color: #a0a0b0; margin-bottom: 4px;">📞 ${loc.phone}</div>` : ""}
                ${loc.email ? `<div style="font-size: 12px; color: #a0a0b0; margin-bottom: 8px;">📧 ${loc.email}</div>` : ""}
                <div style="
                  display: flex; align-items: center; gap: 6px;
                  font-size: 11px; color: #22c55e;
                  background: rgba(34,197,94,0.1);
                  padding: 6px 10px; border-radius: 8px;
                  border: 1px solid rgba(34,197,94,0.2);
                ">
                  <span style="width: 6px; height: 6px; border-radius: 50%; background: #22c55e;"></span>
                  Updated ${timeSince}
                </div>
              </div>
            `);
            infoWindowRef.current.open(googleMapRef.current, marker);
          }
        });

        markersRef.current.push(marker);
      } catch {
        // AdvancedMarkerElement not available, use basic marker
        const marker = new google.maps.Marker({
          map: googleMapRef.current!,
          position,
          title: loc.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: selectedId === loc.uid ? "#8b5cf6" : "#3b82f6",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });

        marker.addListener("click", () => {
          onMarkerClick(loc.uid);
        });

        // Cast to any since we're mixing marker types
        markersRef.current.push(marker as any);
      }
    });

    if (locations.length > 1) {
      googleMapRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    } else if (locations.length === 1) {
      googleMapRef.current.setCenter({ lat: locations[0].lat, lng: locations[0].lng });
      googleMapRef.current.setZoom(14);
    }
  }, [locations, selectedId, onMarkerClick]);

  return (
    <div
      ref={mapRef}
      style={{ width: "100%", height: "100%", borderRadius: "16px" }}
    />
  );
}

function getTimeSinceUpdate(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Map Wrapper Render ────────────────────────────────────────────────────────

function renderMapStatus(status: Status) {
  if (status === Status.LOADING) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0E1015] rounded-2xl">
        <Loader2 size={32} className="text-violet-400 animate-spin mb-3" />
        <p className="text-white/40 text-sm font-medium">Loading Google Maps…</p>
      </div>
    );
  }
  if (status === Status.FAILURE) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0E1015] rounded-2xl">
        <MapPin size={32} className="text-red-400 mb-3" />
        <p className="text-white/40 text-sm font-medium">Failed to load map</p>
        <p className="text-white/25 text-xs mt-1">Check your API key and internet connection</p>
      </div>
    );
  }
  return <></>;
}

// ── Sidebar Card ──────────────────────────────────────────────────────────────

function DeliveryBoyCard({
  boy,
  isSelected,
  onClick,
}: {
  boy: DeliveryBoyLocation;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const timeSince = getTimeSinceUpdate(boy.lastUpdated);
  const isRecent = Date.now() - new Date(boy.lastUpdated).getTime() < 5 * 60 * 1000; // 5 min

  return (
    <div
      className={`rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
        isSelected
          ? "border-violet-500/40 bg-violet-500/8 shadow-lg shadow-violet-500/10"
          : "border-white/8 bg-[#0E1015] hover:border-white/15"
      }`}
      onClick={onClick}
    >
      <div className="px-4 py-3.5 flex items-center gap-3">
        {/* Avatar */}
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isSelected
              ? "bg-violet-500/20 border border-violet-500/30"
              : "bg-blue-500/15 border border-blue-500/25"
          }`}
        >
          <Truck
            size={18}
            className={isSelected ? "text-violet-400" : "text-blue-400"}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{boy.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={`flex items-center gap-1 text-[10px] font-semibold ${
                isRecent ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {isRecent ? (
                <Signal size={9} />
              ) : (
                <SignalZero size={9} />
              )}
              {timeSince}
            </span>
            <span className="text-white/25 text-[10px]">·</span>
            <span className="text-white/40 text-[10px]">
              {boy.activeDeliveries} active
            </span>
          </div>
        </div>

        {/* Expand */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="text-white/30 hover:text-white/60 transition-colors p-1"
        >
          <ChevronDown
            size={14}
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-white/6 px-4 py-3 space-y-2">
          {boy.phone && (
            <div className="flex items-center gap-2 text-white/50 text-xs">
              <Phone size={10} />
              <span>{boy.phone}</span>
            </div>
          )}
          {boy.email && (
            <div className="flex items-center gap-2 text-white/50 text-xs">
              <Mail size={10} />
              <span>{boy.email}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-white/50 text-xs">
            <Navigation size={10} />
            <span>
              {boy.lat.toFixed(5)}, {boy.lng.toFixed(5)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-white/35 text-xs">
            <Clock size={10} />
            <span>Last update: {new Date(boy.lastUpdated).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────


const DeliveryTracking = () => {
  const authState = useAppSelector((state) => state.auth);
  const navigate = useNavigate();
  const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoyLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBoy, setSelectedBoy] = useState<string | null>(null);

  // Redirect non-admin users
  useEffect(() => {
    if (
      authState.role &&
      authState.role !== "admin" &&
      authState.role !== "head-office"
    ) {
      navigate("/");
    }
  }, [authState.role, navigate]);

  // Listen to delivery boy locations in real-time
  useEffect(() => {
    const locationsRef = collection(db, "delivery_locations");
    const unsubscribe = onSnapshot(
      locationsRef,
      (snapshot) => {
        const boys: DeliveryBoyLocation[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            uid: docSnap.id,
            name: d.name || "Unknown",
            phone: d.phone || "",
            email: d.email || "",
            lat: d.lat || 0,
            lng: d.lng || 0,
            lastUpdated: d.lastUpdated || new Date().toISOString(),
            activeDeliveries: d.activeDeliveries || 0,
          };
        });
        // Only show boys with valid coordinates
        setDeliveryBoys(boys.filter((b) => b.lat !== 0 && b.lng !== 0));
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching delivery locations:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Also listen to orders to get active delivery counts
  useEffect(() => {
    const ordersRef = collection(db, "orders");
    const q = query(ordersRef, where("status", "==", "shipped"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.docs.forEach((docSnap) => {
        const assignedTo = docSnap.data().assignedTo;
        if (assignedTo) {
          counts[assignedTo] = (counts[assignedTo] || 0) + 1;
        }
      });

      setDeliveryBoys((prev) =>
        prev.map((boy) => ({
          ...boy,
          activeDeliveries: counts[boy.uid] || 0,
        }))
      );
    });

    return () => unsubscribe();
  }, []);

  const handleMarkerClick = useCallback((uid: string) => {
    setSelectedBoy((prev) => (prev === uid ? null : uid));
  }, []);

  const onlineCount = deliveryBoys.filter(
    (b) => Date.now() - new Date(b.lastUpdated).getTime() < 5 * 60 * 1000
  ).length;

  return (
    <div className="min-h-screen bg-[#08080C] font-sans">
      {/* CSS animation for marker pulse */}
      <style>{`
        @keyframes markerPulse {
          0%, 100% { box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4); }
          50% { box-shadow: 0 4px 25px rgba(59, 130, 246, 0.7); }
        }
        .gm-style-iw { background: transparent !important; padding: 0 !important; }
        .gm-style-iw-d { overflow: visible !important; }
        .gm-style-iw-c { padding: 0 !important; background: transparent !important; box-shadow: none !important; }
        .gm-ui-hover-effect { display: none !important; }
        .gm-style-iw-tc { display: none !important; }
        .gm-style-iw-chr { display: none !important; }
      `}</style>

      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-10 right-1/4 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 px-6 md:px-14 pt-8 pb-6">
          <div className="flex items-center justify-between mb-6">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm font-medium group"
            >
              <ArrowLeft
                size={15}
                className="group-hover:-translate-x-1 transition-transform"
              />
              Back to Dashboard
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-2">
                Live Tracking
              </p>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
                Delivery{" "}
                <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-violet-400">
                  Tracking
                </span>
              </h1>
              <p className="text-white/40 text-sm mt-2 max-w-lg">
                Track your delivery staff locations in real-time on the map.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 md:px-14 mb-6">
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Total Staff",
              value: deliveryBoys.length,
              icon: Users,
              color: "text-violet-400",
              bg: "bg-violet-500/10",
              border: "border-violet-500/20",
            },
            {
              label: "Online Now",
              value: onlineCount,
              icon: Signal,
              color: "text-emerald-400",
              bg: "bg-emerald-500/10",
              border: "border-emerald-500/20",
            },
            {
              label: "Total Active",
              value: deliveryBoys.reduce((s, b) => s + b.activeDeliveries, 0),
              icon: Truck,
              color: "text-blue-400",
              bg: "bg-blue-500/10",
              border: "border-blue-500/20",
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className={`rounded-2xl border ${stat.border} ${stat.bg} px-4 py-3 flex items-center gap-3`}
              >
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <Icon size={16} className={stat.color} />
                </div>
                <div>
                  <p className={`text-lg font-extrabold ${stat.color}`}>
                    {stat.value}
                  </p>
                  <p className="text-white/40 text-[10px]">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Map + Sidebar */}
      <div className="px-6 md:px-14 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ minHeight: "550px" }}>
          {/* Map */}
          <div className="lg:col-span-3 rounded-2xl overflow-hidden border border-white/8 bg-[#0E1015]">
            {loading ? (
              <div className="w-full h-full min-h-[450px] flex flex-col items-center justify-center">
                <Loader2 size={32} className="text-violet-400 animate-spin mb-3" />
                <p className="text-white/40 text-sm">Loading map data…</p>
              </div>
            ) : (
              <Wrapper
                apiKey={GOOGLE_MAPS_API_KEY}
                render={renderMapStatus}
                libraries={["marker"]}
              >
                <GoogleMap
                  locations={deliveryBoys}
                  selectedId={selectedBoy}
                  onMarkerClick={handleMarkerClick}
                />
              </Wrapper>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-white/50 text-xs font-bold uppercase tracking-widest">
                Delivery Staff
              </p>
              <button
                className="text-white/30 hover:text-white/60 transition-colors p-1"
                title="Auto-refreshing"
              >
                <RefreshCw size={12} className="animate-spin" style={{ animationDuration: "3s" }} />
              </button>
            </div>

            {deliveryBoys.length === 0 && !loading ? (
              <div className="rounded-2xl border border-white/8 bg-[#0E1015] px-4 py-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
                  <MapPin size={24} className="text-violet-400/50" />
                </div>
                <p className="text-white/40 text-sm font-medium">
                  No active delivery staff
                </p>
                <p className="text-white/25 text-xs mt-1">
                  Staff locations will appear here when they share their location.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                {deliveryBoys.map((boy) => (
                  <DeliveryBoyCard
                    key={boy.uid}
                    boy={boy}
                    isSelected={selectedBoy === boy.uid}
                    onClick={() => handleMarkerClick(boy.uid)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryTracking;
