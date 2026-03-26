import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  ChevronDown,
  ChevronUp,
  Search,
  ShoppingBag,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Receipt,
  Star,
  Loader2,
} from "lucide-react";
import { useAppSelector } from "../../store/hooks";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db, GOOGLE_MAPS_API_KEY } from "../../firebase/config";
import { Wrapper, Status } from "@googlemaps/react-wrapper";
import { doc as fsDoc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "react-toastify";
import { storage } from "../../firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Star as StarIcon, Camera, X, AlertTriangle } from "lucide-react";


// ── Types ────────────────────────────────────────────────────────────────────

type OrderStatus =
  | "pending_delivery"
  | "pending_payment"
  | "payment_complete"
  | "shipped"
  | "delivered"
  | "cancelled";

interface OrderProduct {
  id: number;
  name: string;
  sku: string;
  qty: number;
  price: string;
  category: string;
  image?: string;
  unit?: string;
}

interface Order {
  id: string; // Firestore doc ID
  createdAt: string;
  status: OrderStatus;
  customer: {
    name: string;
    phone: string;
    email: string;
    business: string | null;
  };
  products: OrderProduct[];
  notes?: string;
  total: number;
  paymentMethod: string;
  assignedStaffId?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  hasReview?: boolean;
  customerId?: string;
}

// ── Status Helpers ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  OrderStatus,
  {
    label: string;
    icon: React.ElementType;
    color: string;
    bg: string;
    border: string;
    dot: string;
  }
> = {
  pending_delivery: {
    label: "Pending Delivery",
    icon: Clock,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/25",
    dot: "bg-amber-400",
  },
  pending_payment: {
    label: "Pending Payment",
    icon: Clock,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/25",
    dot: "bg-orange-400",
  },
  payment_complete: {
    label: "Payment Complete",
    icon: CheckCircle,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/25",
    dot: "bg-emerald-400",
  },
  shipped: {
    label: "Shipped",
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
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/25",
    dot: "bg-red-400",
  },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending_delivery;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cfg.color} ${cfg.bg} ${cfg.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse`} />
      <cfg.icon size={11} />
      {cfg.label}
    </span>
  );
}

// ── Tracking Timeline Component ──────────────────────────────────────────────

const TRACKING_STEPS = [
  { id: "placed", label: "Order Placed", icon: Package },
  { id: "processing", label: "Processing", icon: Clock },
  { id: "shipped", label: "Shipped", icon: Truck },
  { id: "delivery", label: "Out for Delivery", icon: MapPin },
  { id: "delivered", label: "Delivered", icon: CheckCircle },
];

function TrackingTimeline({ status, assignedStaffId }: { status: OrderStatus, assignedStaffId?: string | null }) {
  const getActiveStep = () => {
    switch (status) {
      case "cancelled": return -1;
      case "delivered": return 4;
      case "shipped": return assignedStaffId ? 3 : 2;
      case "payment_complete": return 2;
      case "pending_delivery":
      case "pending_payment": return 1;
      default: return 0;
    }
  };

  const activeStep = getActiveStep();

  return (
    <div className="py-6 px-2">
      <div className="relative flex justify-between items-center w-full">
        {/* Progress Line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-white/5" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-violet-500 transition-all duration-1000"
          style={{ width: `${status === "cancelled" ? 0 : Math.min(100, (activeStep / 4) * 100)}%` }}
        />

        {TRACKING_STEPS.map((step, idx) => {
          const isDone = activeStep >= idx;
          const isActive = activeStep === idx;
          const Icon = step.icon;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2 group">
              <div
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${isDone
                    ? "bg-violet-600 border-violet-500 shadow-lg shadow-violet-500/20"
                    : "bg-site-card border-white/10"
                  } ${isActive ? "scale-110 ring-4 ring-violet-500/10" : ""}`}
              >
                <Icon size={14} className={isDone ? "text-white" : "text-white/20"} />
              </div>
              <p className={`text-[10px] font-bold absolute -bottom-6 whitespace-nowrap transition-colors ${isDone ? "text-white" : "text-white/20"
                }`}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getDeliveryEstimate(createdAt: string, status: OrderStatus) {
  if (status === "delivered") return "Already Delivered";
  if (status === "cancelled") return "Order Cancelled";

  const created = new Date(createdAt);
  const estimate = new Date(created.getTime() + 48 * 60 * 60 * 1000); // Standard 48h

  const today = new Date();
  const diffDays = Math.ceil((estimate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (status === "shipped") return "Expected Today/Tomorrow";
  if (diffDays <= 0) return "Arriving shortly";
  if (diffDays === 1) return "Estimated: Tomorrow";
  return `Estimated: ${estimate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function getLocationDescription(status: OrderStatus, assignedStaffId?: string | null) {
  switch (status) {
    case "pending_payment":
    case "pending_delivery":
      return "Main Distribution Center (Processing)";
    case "payment_complete":
      return "Regional Sorting Facility (Awaiting Dispatch)";
    case "shipped":
      return assignedStaffId ? "In Transit (Out for Delivery)" : "In Transit (Moving between RDCs)";
    case "delivered":
      return "Final Destination (Delivered)";
    case "cancelled":
      return "Logistics Center (Returned to Stock)";
    default:
      return "Processing...";
  }
}

function parsePrice(priceStr: string): number {
  const numericStr = priceStr.replace(/[^0-9.]/g, "");
  const val = parseFloat(numericStr);
  return isNaN(val) ? 0 : val;
}

// ── Review Modal ─────────────────────────────────────────────────────────────

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  customerId: string;
  customerName: string;
}

function ReviewModal({ isOpen, onClose, orderId, customerId, customerName }: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "reviews"), {
        orderId,
        customerId,
        customerName,
        rating,
        comment,
        createdAt: serverTimestamp(),
      });
      await updateDoc(fsDoc(db, "orders", orderId), {
        hasReview: true
      });
      toast.success("Thank you for your review!");
      onClose();
    } catch (error) {
      console.error("Error submitting review:", error);
      toast.error("Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-site-card border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-white">Rate Your Order</h3>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-site-text-subtle hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs text-site-text-subtle uppercase tracking-widest font-bold">How was the product?</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                    className="transition-transform hover:scale-110 active:scale-95"
                  >
                    <StarIcon
                      size={32}
                      className={
                        star <= (hover || rating)
                          ? "fill-violet-400 text-violet-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.3)]"
                          : "text-white/10"
                      }
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-site-text-subtle uppercase tracking-widest px-1">Detailed Feedback</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tell us about your experience..."
                className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-violet-500/40 transition-all resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-violet-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Return Modal ─────────────────────────────────────────────────────────────

interface ReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
}

function ReturnModal({ isOpen, onClose, orderId }: ReturnModalProps) {
  const [reason, setReason] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      toast.error("Please provide a reason for the return");
      return;
    }
    setSubmitting(true);
    try {
      let imageUrl = "";
      if (image) {
        const storageRef = ref(storage, `returns/${orderId}_${Date.now()}`);
        await uploadBytes(storageRef, image);
        imageUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, "returns"), {
        orderId,
        reason,
        imageUrl,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      await updateDoc(fsDoc(db, "orders", orderId), {
        status: "return_initiated"
      });
      toast.success("Return request submitted successfully");
      onClose();
    } catch (error) {
      console.error("Error submitting return:", error);
      toast.error("Failed to submit return request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-site-card border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-white">Return Request</h3>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-site-text-subtle hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-site-text-subtle uppercase tracking-widest px-1">Reason for Return</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm focus:outline-none focus:border-violet-500/40 transition-all appearance-none cursor-pointer"
              >
                <option value="" className="bg-site-card">Select a reason</option>
                <option value="damaged" className="bg-site-card">Product Damaged</option>
                <option value="wrong_item" className="bg-site-card">Wrong Item Received</option>
                <option value="not_satisfied" className="bg-site-card">Not Satisfied with Quality</option>
                <option value="other" className="bg-site-card">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-site-text-subtle uppercase tracking-widest px-1">Evidence (Images)</label>
              <div className="relative group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="return-image-upload"
                />
                <label
                  htmlFor="return-image-upload"
                  className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-white/10 rounded-2xl hover:border-violet-500/40 hover:bg-violet-500/5 transition-all cursor-pointer group-hover:bg-white/2"
                >
                  {preview ? (
                    <img src={preview} alt="Return preview" className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    <>
                      <Camera size={32} className="text-white/20 mb-2 group-hover:text-violet-400 transition-colors" />
                      <p className="text-xs text-site-text-subtle">Click to upload photo evidence</p>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex gap-3">
              <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-500/70 leading-relaxed font-bold uppercase tracking-tight">
                Return requests are subject to approval. Please ensure all evidence is clear.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-violet-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Return Request"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Live Tracking Map ────────────────────────────────────────────────────────

const LiveTrackingMap: React.FC<{
  staffId: string;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
}> = ({ staffId, deliveryLat, deliveryLng }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [courierLoc, setCourierLoc] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!staffId) return;
    const locRef = fsDoc(db, "delivery_locations", staffId);
    const unsubscribe = onSnapshot(locRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.lat && data.lng) {
          setCourierLoc({ lat: data.lat, lng: data.lng });
        }
      }
    });
    return () => unsubscribe();
  }, [staffId]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!courierLoc && (!deliveryLat || !deliveryLng)) return;

    const map = new google.maps.Map(mapRef.current, {
      center: courierLoc || { lat: deliveryLat || 0, lng: deliveryLng || 0 },
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

    // Courier Marker
    if (courierLoc) {
      const courierMarker = new google.maps.Marker({
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
        title: "Courier",
      });

      const courierInfo = new google.maps.InfoWindow({
        content: `<div style="color: #000; padding: 5px;"><strong>Courier</strong><br/>Out for delivery</div>`,
      });

      courierMarker.addListener("click", () => courierInfo.open(map, courierMarker));
      bounds.extend(courierLoc);
    }

    // Destination Marker
    if (deliveryLat && deliveryLng) {
      const destPos = { lat: deliveryLat, lng: deliveryLng };
      const destMarker = new google.maps.Marker({
        position: destPos,
        map,
        icon: {
          url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
          scaledSize: new google.maps.Size(32, 32),
        },
        title: "Your Delivery Point",
      });

      const destInfo = new google.maps.InfoWindow({
        content: `<div style="color: #000; padding: 5px;"><strong>Destination</strong><br/>Your delivery address</div>`,
      });

      destMarker.addListener("click", () => destInfo.open(map, destMarker));
      bounds.extend(destPos);

      // Polyline (Route)
      if (courierLoc) {
        new google.maps.Polyline({
          path: [courierLoc, destPos],
          geodesic: true,
          strokeColor: "#8b5cf6",
          strokeOpacity: 0.6,
          strokeWeight: 4,
          map,
        });
      }
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
    }
  }, [courierLoc, deliveryLat, deliveryLng]);

  if (!courierLoc && (!deliveryLat || !deliveryLng)) {
    return (
      <div className="h-48 w-full bg-white/5 animate-pulse rounded-xl flex items-center justify-center text-white/20 text-xs">
        Preparing live tracking...
      </div>
    );
  }

  return (
    <div className="relative group">
      <div ref={mapRef} className="h-64 w-full rounded-2xl border border-white/10 overflow-hidden shadow-2xl transition-all duration-500 group-hover:border-violet-500/30" />
      <button
        type="button"
        onClick={() => {
          if (mapRef.current && courierLoc) {
            // Recenter logically would happen via fitBounds in useEffect
          }
        }}
        className="absolute bottom-4 right-4 bg-violet-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2"
      >
        <MapPin size={10} />
        Auto-fit View
      </button>
    </div>
  );
};

const renderMapStatus = (status: Status) => {
  if (status === Status.LOADING) return <div className="h-48 w-full bg-white/5 animate-pulse rounded-xl flex items-center justify-center text-white/20 text-xs text-center">Loading live tracking map...</div>;
  if (status === Status.FAILURE) return <div className="h-48 w-full bg-red-500/5 rounded-xl flex items-center justify-center text-red-500/40 text-xs">Failed to load map</div>;
  return <></>;
};

function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const orderTime = new Date(order.createdAt).getTime();
    const expiryTime = orderTime + 60 * 60 * 1000;

    const calculateTimeLeft = () => Math.max(0, expiryTime - new Date().getTime());
    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [order.createdAt]);

  const isWithinOneHour = timeLeft > 0;
  const showCancelButton = order.status === "pending_delivery" || order.status === "pending_payment";

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleCancelOrder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isWithinOneHour) return;

    if (window.confirm("Are you sure you want to cancel this order?")) {
      setCancelling(true);
      try {
        await updateDoc(fsDoc(db, "orders", order.id), {
          status: "cancelled"
        });
        toast.success("Order cancelled successfully");
      } catch (error) {
        console.error("Error cancelling order:", error);
        toast.error("Failed to cancel order");
      } finally {
        setCancelling(false);
      }
    }
  };

  const formattedDate = new Date(order.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const totalItems = order.products.reduce((s, p) => s + p.qty, 0);

  return (
    <div
      className={`rounded-2xl border border-site-border bg-site-card overflow-hidden transition-all duration-300 hover:border-violet-500/20 hover:shadow-xl hover:shadow-violet-500/5`}
    >
      {/* ── Card Header ── */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Left: order ID + date */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0 mt-0.5">
            <Receipt size={16} className="text-violet-400" />
          </div>
          <div>
            <p className="text-white font-bold text-sm font-mono tracking-wide">
              {order.id.slice(0, 12).toUpperCase()}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <Calendar size={11} className="text-white/35" />
              <p className="text-site-text-subtle text-xs">{formattedDate}</p>
            </div>
          </div>
        </div>

        {/* Center: customer name + item count */}
        <div className="hidden md:block text-center">
          <p className="text-white/80 text-sm font-medium">
            {order.customer.name}
          </p>
          <p className="text-white/35 text-xs mt-0.5">
            {totalItems} item{totalItems !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Right: total + status + toggle */}
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="text-right">
            <p className="text-violet-400 font-bold text-sm">
              LKR {order.total.toLocaleString()}
            </p>
            <p className="text-white/35 text-[10px] mt-0.5">Total Value</p>
          </div>
          <StatusBadge status={order.status} />
          <button className="text-site-text-subtle hover:text-white/70 transition-colors ml-1">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* ── Expanded Detail ── */}
      {expanded && (
        <div className="border-t border-white/6 px-5 py-5 space-y-5 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Products table */}
          <div>
            <p className="text-site-text-subtle text-[10px] font-bold uppercase tracking-widest mb-3">
              Order Items
            </p>
            <div className="rounded-xl overflow-hidden border border-white/6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/3 border-b border-white/6">
                    <th className="text-left text-white/35 text-[10px] font-semibold uppercase tracking-wider px-4 py-2.5">
                      Product
                    </th>
                    <th className="text-left text-white/35 text-[10px] font-semibold uppercase tracking-wider px-4 py-2.5 hidden sm:table-cell">
                      SKU
                    </th>
                    <th className="text-left text-white/35 text-[10px] font-semibold uppercase tracking-wider px-4 py-2.5 hidden md:table-cell">
                      Category
                    </th>
                    <th className="text-center text-white/35 text-[10px] font-semibold uppercase tracking-wider px-4 py-2.5">
                      Qty
                    </th>
                    <th className="text-right text-white/35 text-[10px] font-semibold uppercase tracking-wider px-4 py-2.5">
                      Unit Price
                    </th>
                    <th className="text-right text-white/35 text-[10px] font-semibold uppercase tracking-wider px-4 py-2.5">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.products.map((product, idx) => (
                    <tr
                      key={product.id}
                      className={`border-b border-white/4 last:border-0 transition-colors hover:bg-white/2 ${idx % 2 === 0 ? "" : "bg-white/1"
                        }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
                            <Package size={12} className="text-violet-400" />
                          </div>
                          <span className="text-white text-xs font-medium leading-snug">
                            {product.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-white/35 text-[11px] font-mono">
                          {product.sku}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-site-text-subtle text-xs">
                          {product.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/6 text-white text-xs font-bold">
                          {product.qty}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-white/65 text-xs font-medium">
                          {product.price}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-violet-400 text-xs font-bold">
                          LKR{" "}
                          {(parsePrice(product.price) * product.qty).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-violet-500/5 border-t border-violet-500/15">
                    <td
                      colSpan={5}
                      className="px-4 py-3 text-right text-white/60 text-xs font-semibold"
                    >
                      Order Total
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-violet-300 font-extrabold text-sm">
                        LKR {order.total.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* New Tracking Progress Section */}
          <div className="rounded-2xl border border-site-border bg-white/2 p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <p className="text-site-text-subtle text-[10px] font-bold uppercase tracking-widest">
                Live Progress
              </p>
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20">
                <Clock size={12} className="text-violet-400" />
                <span className="text-[10px] text-white font-bold uppercase tracking-wider">
                  {getDeliveryEstimate(order.createdAt, order.status)}
                </span>
              </div>
            </div>
            <TrackingTimeline status={order.status} assignedStaffId={order.assignedStaffId} />
            <div className="mt-10 flex items-center justify-center gap-2 text-site-text-subtle text-[10px] bg-white/3 py-2 rounded-xl border border-site-border">
              <MapPin size={10} className="text-violet-400" />
              <span>Current Location: <span className="text-white/60 font-medium">{getLocationDescription(order.status, order.assignedStaffId)}</span></span>
            </div>
          </div>

          {/* Live Tracking Map Section (Visible for all active orders) */}
          {["pending_delivery", "payment_complete", "shipped"].includes(order.status) && (
            <div className="space-y-3 pb-2">
              <div className="flex items-center justify-between">
                <p className="text-site-text-subtle text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                  Order Tracking
                </p>
                <span className="text-[10px] text-blue-400 font-medium">
                  {order.status === "shipped" ? "Out for delivery" : "Processing your order"}
                </span>
              </div>
              <div className="relative group">
                <Wrapper apiKey={GOOGLE_MAPS_API_KEY} render={(status) => renderMapStatus(status) as any}>
                  <LiveTrackingMap
                    staffId={order.assignedStaffId || ""}
                    deliveryLat={order.deliveryLat}
                    deliveryLng={order.deliveryLng}
                  />
                </Wrapper>
                <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">Live View</span>
                </div>
              </div>
            </div>
          )}

          {/* Customer info + Notes row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Details */}
            <div className="rounded-xl bg-white/3 border border-white/7 p-4 space-y-3">
              <p className="text-site-text-subtle text-[10px] font-bold uppercase tracking-widest">
                Customer Details
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-white/6 flex items-center justify-center shrink-0">
                    <Star size={11} className="text-site-text-subtle" />
                  </div>
                  <span className="text-white text-sm font-semibold">
                    {order.customer.name}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-white/6 flex items-center justify-center shrink-0">
                    <Phone size={11} className="text-site-text-subtle" />
                  </div>
                  <span className="text-white/65 text-xs">
                    {order.customer.phone}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-white/6 flex items-center justify-center shrink-0">
                    <Mail size={11} className="text-site-text-subtle" />
                  </div>
                  <span className="text-white/65 text-xs">
                    {order.customer.email}
                  </span>
                </div>
                {order.customer.business && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-white/6 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin size={11} className="text-site-text-subtle" />
                    </div>
                    <span className="text-white/65 text-xs leading-relaxed">
                      {order.customer.business}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes / Status */}
            <div className="rounded-xl bg-white/3 border border-white/7 p-4 space-y-3">
              <p className="text-site-text-subtle text-[10px] font-bold uppercase tracking-widest">
                Order Notes & Status
              </p>
              <div className="flex items-center gap-2">
                <p className="text-site-text-subtle text-xs">Current Status:</p>
                <StatusBadge status={order.status} />
              </div>

              <div className="flex items-center gap-2 mt-1">
                <p className="text-site-text-subtle text-xs">Payment:</p>
                <span className="text-white/70 text-xs font-semibold capitalize">
                  {order.paymentMethod === "card"
                    ? "Card Payment"
                    : "Cash on Delivery"}
                </span>
              </div>

              {order.notes && (
                <div className="rounded-lg bg-white/4 border border-white/6 px-3 py-2.5 mt-1">
                  <p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider mb-1">
                    Note
                  </p>
                  <p className="text-white/55 text-xs leading-relaxed italic">
                    "{order.notes}"
                  </p>
                </div>
              )}

              {/* Cancel Action */}
              {showCancelButton && order.status !== "cancelled" && (
                <div className="pt-3 border-t border-white/6 mt-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCancelOrder}
                      disabled={!isWithinOneHour || cancelling}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300 ${!isWithinOneHour
                        ? "bg-white/5 text-white/20 cursor-not-allowed"
                        : "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                        }`}
                    >
                      <XCircle size={16} />
                      {cancelling ? "Cancelling..." : "Cancel Order"}
                    </button>
                    {isWithinOneHour && (
                      <div className="px-4 py-1.5 rounded-xl border border-white/10 bg-white/5 flex flex-col items-center justify-center shrink-0 min-w-[90px]">
                        <span className="text-[9px] text-site-text-subtle uppercase tracking-widest font-semibold mb-0.5">Time Left</span>
                        <span className="text-sm font-mono font-bold text-red-400 animate-pulse">
                          {formatTime(timeLeft)}
                        </span>
                      </div>
                    )}
                  </div>
                  {!isWithinOneHour && (
                    <p className="text-[10px] text-site-text-subtle text-center mt-2 italic">
                      Cancellation is only available within 1 hour of placing the order.
                    </p>
                  )}
                </div>
              )}

              {/* Review and Return Actions (Only for delivered) */}
              {order.status === "delivered" && !order.hasReview && (
                <div className="pt-3 border-t border-white/6 mt-3 grid grid-cols-2 gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsReviewModalOpen(true);
                    }}
                    className="py-3 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-violet-600 hover:text-white transition-all shadow-lg group-hover:shadow-violet-500/10"
                  >
                    <StarIcon size={14} />
                    Write Review
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsReturnModalOpen(true);
                    }}
                    className="py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all"
                  >
                    <Package size={14} />
                    Return Order
                  </button>
                </div>
              )}

              {/* Review Placeholder if already reviewed */}
              {order.status === "delivered" && order.hasReview && (
                <p className="text-center text-[10px] text-emerald-400/60 font-medium mt-2">
                  <CheckCircle size={10} className="inline mr-1" />
                  Review submitted
                </p>
              )}

              {/* Modals */}
              <ReviewModal
                isOpen={isReviewModalOpen}
                onClose={() => setIsReviewModalOpen(false)}
                orderId={order.id}
                customerId={order.customerId || ""}
                customerName={order.customer.name}
              />
              <ReturnModal
                isOpen={isReturnModalOpen}
                onClose={() => setIsReturnModalOpen(false)}
                orderId={order.id}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

const CustomerHistory = () => {
  const auth = useAppSelector((state) => state.auth);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");


  // Fetch orders from Firestore filtered by logged-in customer's uid
  useEffect(() => {
    if (!auth.uid) {
      setLoading(false);
      return;
    }

    const ordersRef = collection(db, "orders");
    const q = query(
      ordersRef,
      where("customerId", "==", auth.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: Order[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            createdAt: d.createdAt || new Date().toISOString(),
            status: d.status || "pending_delivery",
            customer: {
              name: d.customerName || "",
              phone: d.customerPhone || "",
              email: d.customerEmail || "",
              business: d.customerBusiness || null,
            },
            products: (d.items || []).map((item: any, idx: number) => ({
              id: item.id ?? idx,
              name: item.name || "Unknown Product",
              sku: item.sku || "",
              qty: item.qty || 1,
              price: item.price || "LKR 0",
              category: item.category || "",
              image: item.image || "",
              unit: item.unit || "",
            })),
            notes: d.notes || "",
            total: d.subTotal || 0,
            paymentMethod: d.paymentMethod || "cash",
            assignedStaffId: d.assignedStaffId || null,
            deliveryLat: d.deliveryLat || d.lat || null,
            deliveryLng: d.deliveryLng || d.lng || null,
            hasReview: d.hasReview || false,
            customerId: d.customerId || "",
          };
        });
        // Sort client-side by createdAt descending (newest first)
        fetched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setOrders(fetched);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching orders:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [auth.uid]);



  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    return (
      o.id.toLowerCase().includes(q) ||
      o.customer.name.toLowerCase().includes(q) ||
      o.customer.phone.includes(q) ||
      o.products.some((p) => p.name.toLowerCase().includes(q))
    );
  });

  // Summary stats
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const deliveredCount = orders.filter(
    (o) => o.status === "delivered" || o.status === "payment_complete"
  ).length;
  const processingCount = orders.filter(
    (o) =>
      o.status === "pending_delivery" ||
      o.status === "pending_payment" ||
      o.status === "shipped"
  ).length;

  return (
    <div className="min-h-screen bg-site-bg font-sans">
      {/* ── Header ── */}
      <div className="relative overflow-hidden">
        {/* Gradient blobs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-10 right-1/4 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 px-6 md:px-14 pt-8 pb-10">
          <div className="flex items-center justify-between mb-8">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-site-text-subtle hover:text-site-text transition-colors text-sm font-medium group"
            >
              <ArrowLeft
                size={15}
                className="group-hover:-translate-x-1 transition-transform"
              />
              Back to Home
            </Link>
          </div>

          {/* Title */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-2">
                Order Management
              </p>
              <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
                My Order{" "}
                <span className="text-transparent bg-clip-text bg-linear-to-r from-violet-400 to-indigo-400">
                  History
                </span>
              </h1>
              <p className="text-site-text-subtle text-sm mt-3 max-w-lg leading-relaxed">
                View and track all your order enquiries and delivery statuses
                from iIslandLink.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-white/4 border border-site-border rounded-xl px-4 py-3 shrink-0">
              <ShoppingBag size={16} className="text-violet-400" />
              <span className="text-white font-bold">{totalOrders}</span>
              <span className="text-site-text-subtle text-sm">Total Orders</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="px-6 md:px-14 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Total Spent",
              value: `LKR ${totalRevenue.toLocaleString()}`,
              icon: Receipt,
              color: "text-violet-400",
              bg: "bg-violet-500/10",
              border: "border-violet-500/20",
            },
            {
              label: "Completed",
              value: deliveredCount,
              icon: CheckCircle,
              color: "text-emerald-400",
              bg: "bg-emerald-500/10",
              border: "border-emerald-500/20",
            },
            {
              label: "In Progress",
              value: processingCount,
              icon: Truck,
              color: "text-blue-400",
              bg: "bg-blue-500/10",
              border: "border-blue-500/20",
            },
            {
              label: "Cancelled",
              value: orders.filter((o) => o.status === "cancelled").length,
              icon: XCircle,
              color: "text-red-400",
              bg: "bg-red-500/10",
              border: "border-red-500/20",
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className={`rounded-2xl border ${stat.border} ${stat.bg} px-5 py-4 flex items-center gap-4`}
              >
                <div
                  className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0`}
                >
                  <Icon size={18} className={stat.color} />
                </div>
                <div>
                  <p className={`text-xl font-extrabold ${stat.color}`}>
                    {stat.value}
                  </p>
                  <p className="text-site-text-subtle text-xs mt-0.5">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="px-6 md:px-14 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-site-text-subtle"
            />
            <input
              id="order-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order ID, customer, product…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-site-text-subtle/25 focus:outline-none focus:border-violet-500/40 focus:bg-white/7 transition-all"
            />
          </div>


        </div>

        <p className="text-site-text-subtle text-xs mt-3">
          {filtered.length} order{filtered.length !== 1 ? "s" : ""} found
        </p>
      </div>

      {/* ── Orders List ── */}
      <div className="px-6 md:px-14 pb-24 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <Loader2
              size={32}
              className="text-violet-400 animate-spin mb-4"
            />
            <p className="text-site-text-subtle font-medium">Loading your orders…</p>
          </div>
        ) : !auth.uid ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
              <ShoppingBag size={28} className="text-violet-400/50" />
            </div>
            <p className="text-site-text-subtle font-medium">
              Please log in to view your orders
            </p>
            <Link
              to="/login"
              className="mt-4 px-6 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all"
            >
              Go to Login
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
              <ShoppingBag size={28} className="text-violet-400/50" />
            </div>
            <p className="text-site-text-subtle font-medium">No orders found</p>
            <p className="text-site-text-subtle/25 text-sm mt-1">
              {orders.length === 0
                ? "You haven't placed any orders yet."
                : "Try adjusting your search or filter criteria."}
            </p>
          </div>
        ) : (
          filtered.map((order) => <OrderCard key={order.id} order={order} />)
        )}
      </div>
    </div>
  );
};

export default CustomerHistory;
