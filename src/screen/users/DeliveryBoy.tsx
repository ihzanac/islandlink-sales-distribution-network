import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Truck,
  CheckCircle,
  Phone,
  Package,
  Loader2,
  Receipt,
  Calendar,
  SignalZero,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAppSelector } from "../../store/hooks";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db, GOOGLE_MAPS_API_KEY } from "../../firebase/config";
import { Wrapper, Status } from "@googlemaps/react-wrapper";

// ── Types ─────────────────────────────────────────────────────────────────────

type DeliveryStatus = "shipped" | "delivered";

interface Delivery {
  id: string;
  customer: string;
  phone: string;
  email: string;
  business: string | null;
  items: number;
  total: number;
  status: DeliveryStatus;
  createdAt: string;
  notes: string;
  paymentMethod: string;
  products: any[];
  deliveryLat?: number | null;
  deliveryLng?: number | null;
}

// ── Status Config ─────────────────────────────────────────────────────────────

const STATUS: Record<
  DeliveryStatus,
  {
    label: string;
    icon: React.ElementType;
    color: string;
    bg: string;
    border: string;
    dot: string;
  }
> = {
  shipped: {
    label: "Assigned",
    icon: Truck,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/25",
    dot: "bg-blue-400",
  },
  delivered: {
    label: "Delivered",
    icon: CheckCircle,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/25",
    dot: "bg-emerald-400",
  },
};

// ── Live Delivery Map ────────────────────────────────────────────────────────

const DeliveryMap: React.FC<{
  deliveryLat: number;
  deliveryLng: number;
  courierId: string;
}> = ({ deliveryLat, deliveryLng, courierId }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [courierLoc, setCourierLoc] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!courierId) return;
    const locRef = doc(db, "delivery_locations", courierId);
    const unsubscribe = onSnapshot(locRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.lat && data.lng) {
          setCourierLoc({ lat: data.lat, lng: data.lng });
        }
      }
    });
    return () => unsubscribe();
  }, [courierId]);

  useEffect(() => {
    if (!mapRef.current || !courierLoc || !deliveryLat || !deliveryLng) return;

    const map = new google.maps.Map(mapRef.current, {
      center: courierLoc,
      zoom: 14,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#8a8a9a" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a3e" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e0e1a" }] },
      ],
      disableDefaultUI: true,
      zoomControl: true,
    });

    const bounds = new google.maps.LatLngBounds();

    // courier marker
    new google.maps.Marker({
      position: courierLoc,
      map,
      icon: {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 7,
        fillColor: "#8b5cf6",
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: "#ffffff",
        rotation: 0,
      },
    });

    // Destination
    const destPos = { lat: deliveryLat, lng: deliveryLng };
    new google.maps.Marker({
      position: destPos,
      map,
      icon: {
        url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
        scaledSize: new google.maps.Size(32, 32),
      },
    });

    new google.maps.Polyline({
      path: [courierLoc, destPos],
      geodesic: true,
      strokeColor: "#8b5cf6",
      strokeOpacity: 0.8,
      strokeWeight: 4,
      map,
    });

    bounds.extend(courierLoc);
    bounds.extend(destPos);
    map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
  }, [courierLoc, deliveryLat, deliveryLng]);

  return <div ref={mapRef} className="h-64 w-full rounded-2xl border border-white/10 overflow-hidden" />;
};

const renderMapStatus = (status: Status) => {
  if (status === Status.LOADING) return <div className="h-48 w-full bg-white/5 animate-pulse rounded-xl flex items-center justify-center text-white/20 text-xs text-center">Loading live tracking map...</div>;
  if (status === Status.FAILURE) return <div className="h-48 w-full bg-red-500/5 rounded-xl flex items-center justify-center text-red-500/40 text-xs">Failed to load map</div>;
  return <></>;
};

// ── Main Component ─────────────────────────────────────────────────────────────

const DeliveryBoy = () => {
  const auth = useAppSelector((state) => state.auth);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"assigned" | "available">("assigned");
  const [availableOrders, setAvailableOrders] = useState<Delivery[]>([]);
  const [locationSharing, setLocationSharing] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Fetch orders assigned to this delivery boy in real-time
  useEffect(() => {
    if (!auth.uid) {
      setLoading(false);
      return;
    }

    const ordersRef = collection(db, "orders");
    const q = query(ordersRef, where("assignedTo", "==", auth.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: Delivery[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const items = d.items || [];
          const totalItems = items.reduce(
            (sum: number, item: any) => sum + (item.qty || 1),
            0
          );

          return {
            id: docSnap.id,
            customer: d.customerName || "",
            phone: d.customerPhone || "",
            email: d.customerEmail || "",
            business: d.customerBusiness || null,
            items: totalItems,
            total: d.subTotal || 0,
            status: d.status === "delivered" ? "delivered" : "shipped",
            createdAt: d.createdAt || new Date().toISOString(),
            notes: d.notes || "",
            paymentMethod: d.paymentMethod || "cash",
            products: d.items || [],
            deliveryLat: d.deliveryLat || null,
            deliveryLng: d.deliveryLng || null,
          };
        });

        // Sort: non-delivered first, then by date
        fetched.sort((a, b) => {
          if (a.status === "delivered" && b.status !== "delivered") return 1;
          if (a.status !== "delivered" && b.status === "delivered") return -1;
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });

        setDeliveries(fetched);
        if (activeTab === "assigned") setLoading(false);
      },
      (error) => {
        console.error("Error fetching deliveries:", error);
      }
    );

    return () => unsubscribe();
  }, [auth.uid, activeTab]);

  // Fetch Available orders (unassigned)
  useEffect(() => {
    if (!auth.uid) return;

    const ordersRef = collection(db, "orders");
    const q = query(
      ordersRef,
      where("status", "in", ["pending_delivery", "pending_payment", "payment_complete"]),
      where("assignedTo", "==", null)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: Delivery[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const totalItems = (d.items || []).reduce(
            (sum: number, item: any) => sum + (item.qty || 1),
            0
          );

          return {
            id: docSnap.id,
            customer: d.customerName || "",
            phone: d.customerPhone || "",
            email: d.customerEmail || "",
            business: d.customerBusiness || null,
            items: totalItems,
            total: d.subTotal || 0,
            status: "shipped", // Using shipped as placeholder for UI consistency
            createdAt: d.createdAt || new Date().toISOString(),
            notes: d.notes || "",
            paymentMethod: d.paymentMethod || "cash",
            products: d.items || [],
            deliveryLat: d.deliveryLat || null,
            deliveryLng: d.deliveryLng || null,
          };
        });

        fetched.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setAvailableOrders(fetched);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching available orders:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [auth.uid]);

  // GPS Location Sharing
  const updateLocation = useCallback(
    async (position: GeolocationPosition) => {
      if (!auth.uid) return;
      try {
        const activeCount = deliveries.filter((d) => d.status === "shipped").length;
        await setDoc(doc(db, "delivery_locations", auth.uid), {
          name: auth.name || auth.email || "Delivery Staff",
          phone: auth.phone || "",
          email: auth.email || "",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          lastUpdated: new Date().toISOString(),
          activeDeliveries: activeCount,
        });
      } catch (err) {
        console.error("Failed to update location:", err);
      }
    },
    [auth.uid, auth.name, auth.email, auth.phone, deliveries]
  );

  const startLocationSharing = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }

    setLocationError(null);
    setLocationSharing(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        updateLocation(position);
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLocationError(
          error.code === 1
            ? "Location permission denied. Please allow location access."
            : error.code === 2
              ? "Location unavailable. Please check your GPS."
              : "Location request timed out."
        );
        setLocationSharing(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );
  }, [updateLocation]);

  const stopLocationSharing = useCallback(async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setLocationSharing(false);

    // Remove location doc from Firestore
    if (auth.uid) {
      try {
        await deleteDoc(doc(db, "delivery_locations", auth.uid));
      } catch (err) {
        console.error("Failed to remove location:", err);
      }
    }
  }, [auth.uid]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Accept an order
  async function acceptOrder(id: string) {
    if (!auth.uid) return;
    try {
      await updateDoc(doc(db, "orders", id), {
        status: "shipped",
        assignedTo: auth.uid,
        assignedStaffId: auth.uid,
      });

      // Auto-start location sharing if not active
      if (!locationSharing) {
        startLocationSharing();
      }
    } catch (err) {
      console.error("Failed to accept order:", err);
    }
  }

  // Mark an order as delivered in Firestore
  async function markDelivered(id: string) {
    try {
      await updateDoc(doc(db, "orders", id), {
        status: "delivered",
      });
    } catch (err) {
      console.error("Failed to mark delivered:", err);
    }
  }

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Tabs ──
  const pending = deliveries.filter((d) => d.status === "shipped").length;
  const delivered = deliveries.filter((d) => d.status === "delivered").length;
  const currentItems = activeTab === "assigned" ? deliveries : availableOrders;

  return (
    <div className="min-h-screen bg-[#08080C] font-sans text-white">
      {/* ── Header ── */}
      <div className="relative px-5 md:px-12 pt-8">
        <div className="absolute top-0 right-1/3 w-72 h-72 bg-violet-600/8 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-white/45 hover:text-white transition-colors text-sm group"
          >
            <ArrowLeft
              size={14}
              className="group-hover:-translate-x-1 transition-transform"
            />
            Back to Home
          </Link>

          {/* Location Sharing Toggle */}
          {auth.uid && (
            <div className="flex flex-col items-end gap-1">
              <button
                id="toggle-location-sharing"
                onClick={() =>
                  locationSharing ? stopLocationSharing() : startLocationSharing()
                }
                className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 ${locationSharing
                  ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
                  : "bg-white/5 border border-white/10 text-white/50 hover:text-white"
                  }`}
              >
                {locationSharing ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>
                    Live Tracking Active
                  </>
                ) : (
                  <>
                    <SignalZero size={13} />
                    Go Online (Share Location)
                  </>
                )}
              </button>
              {locationError && (
                <p className="text-red-500 text-[10px] font-medium mt-1 animate-pulse">
                  {locationError}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-500 mb-2">
              Staff Portal
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight">
              Delivery <span className="text-violet-500">Center</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] p-1 rounded-2xl">
            <button
              onClick={() => setActiveTab("assigned")}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "assigned"
                ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                : "text-white/40 hover:text-white/60"
                }`}
            >
              My Tasks ({deliveries.length})
            </button>
            <button
              id="tab-available"
              onClick={() => setActiveTab("available")}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "available"
                ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                : "text-white/40 hover:text-white/60"
                }`}
            >
              Available ({availableOrders.length})
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      {activeTab === "assigned" && (
        <div className="px-5 md:px-12 mb-8">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Pending", value: pending, color: "text-amber-400", bg: "bg-amber-500/10" },
              { label: "Delivered", value: delivered, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            ].map((s) => (
              <div key={s.label} className={`rounded-3xl border border-white/5 ${s.bg} p-6`}>
                <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-white/30 text-[10px] uppercase font-bold tracking-widest mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Delivery Cards ── */}
      <div className="px-5 md:px-12 pb-20 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <Loader2 size={32} className="text-violet-500 animate-spin mb-4" />
            <p className="text-white/40 text-sm font-medium tracking-wide uppercase">Processing Feed...</p>
          </div>
        ) : !auth.uid ? (
          <div className="flex flex-col items-center justify-center py-28 text-center bg-white/[0.02] border border-white/[0.05] rounded-[2rem]">
            <Truck size={32} className="text-white/10 mb-6" />
            <p className="text-white/40 font-bold mb-6">Staff Authentication Required</p>
            <Link to="/login" className="px-8 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-all shadow-xl shadow-violet-600/20">Sign In</Link>
          </div>
        ) : currentItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center bg-white/[0.02] border border-white/[0.05] rounded-[2rem]">
            <Package size={32} className="text-white/10 mb-6" />
            <p className="text-white/40 font-bold">{activeTab === "assigned" ? "Zero Tasks Assigned" : "No Available Orders"}</p>
            <p className="text-white/20 text-xs mt-2">{activeTab === "assigned" ? "New tasks will show up in the 'Available' tab." : "Check back later for incoming delivery requests."}</p>
          </div>
        ) : (
          currentItems.map((d) => {
            const cfg = STATUS[d.status];
            const Icon = cfg.icon;

            const formattedDate = new Date(d.createdAt).toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric" }
            );
            const formattedTime = new Date(d.createdAt).toLocaleTimeString(
              "en-US",
              { hour: "2-digit", minute: "2-digit" }
            );

            return (
              <div
                key={d.id}
                className="rounded-2xl border border-white/8 bg-[#0E1015] px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-violet-500/20 transition-all duration-300"
              >
                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg} border ${cfg.border}`}
                >
                  <Icon size={17} className={cfg.color} />
                </div>

                {/* Details */}
                <div
                  className="flex-1 min-w-0 space-y-1 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-semibold text-sm">
                      {d.customer}
                    </p>
                    <span className="text-white/25 text-xs font-mono">
                      {d.id.slice(0, 10).toUpperCase()}
                    </span>
                    {expandedId === d.id ? <ChevronUp size={12} className="text-white/20" /> : <ChevronDown size={12} className="text-white/20" />}
                  </div>

                  {d.business && (
                    <div className="flex items-center gap-1.5 text-white/50 text-xs">
                      <Receipt size={10} />
                      <span>{d.business}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-white/40 text-xs flex-wrap">
                    <span className="flex items-center gap-1">
                      <Phone size={10} />
                      {d.phone}
                    </span>
                    <span className="flex items-center gap-1 text-violet-400">
                      <Package size={10} />
                      {d.items} Items
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={10} />
                      {formattedDate} · {formattedTime}
                    </span>
                  </div>

                  {/* Expanded Product List */}
                  {expandedId === d.id && (
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2">Order Line Items</p>
                      {d.products.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-white/[0.02] p-2 rounded-lg border border-white/[0.03]">
                          <div className="flex items-center gap-3">
                            <span className="w-5 h-5 rounded flex items-center justify-center bg-violet-500/10 text-violet-400 font-bold text-[10px]">{p.qty || 1}x</span>
                            <span className="text-white/70">{p.name || "Unknown Product"}</span>
                          </div>
                          <span className="text-white/30 text-[10px] font-mono">{p.sku || ""}</span>
                        </div>
                      ))}
                      {d.notes && (
                        <div className="mt-3 p-2 rounded bg-amber-500/5 border border-amber-500/10">
                          <p className="text-[9px] text-amber-500/50 font-bold uppercase mb-1">Instruction</p>
                          <p className="text-amber-500/70 text-[11px] italic">"{d.notes}"</p>
                        </div>
                      )}

                      {/* Map View */}
                      {d.status === "shipped" && d.deliveryLat && d.deliveryLng && (
                        <div className="mt-4 space-y-2">
                           <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2">Customer Location</p>
                           <Wrapper apiKey={GOOGLE_MAPS_API_KEY} render={renderMapStatus}>
                              <DeliveryMap 
                                deliveryLat={d.deliveryLat} 
                                deliveryLng={d.deliveryLng} 
                                courierId={auth.uid!} 
                              />
                           </Wrapper>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: total + badge + action */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right mr-1">
                    <p className="text-violet-400 font-bold text-sm">
                      LKR {d.total.toLocaleString()}
                    </p>
                    <p className="text-white/30 text-[10px] capitalize">
                      {d.paymentMethod === "card" ? "Card" : "Cash"}
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cfg.color} ${cfg.bg} ${cfg.border}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse`}
                    />
                    {cfg.label}
                  </span>

                  {activeTab === "assigned" ? (
                    d.status !== "delivered" && (
                      <button
                        onClick={() => markDelivered(d.id)}
                        className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-500/10"
                      >
                        Complete
                      </button>
                    )
                  ) : (
                    <button
                      id={`accept-order-${d.id}`}
                      onClick={() => acceptOrder(d.id)}
                      className="px-5 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow-lg shadow-violet-500/10"
                    >
                      Accept Task
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DeliveryBoy;
