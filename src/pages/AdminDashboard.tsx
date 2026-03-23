import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject 
} from "firebase/storage";
import { storage } from "../firebase/config";

import { toast } from "react-toastify";

import { db } from "../firebase/config";
import { useAppSelector } from "../store/hooks";
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  ChevronDown,
  ChevronUp,
  Search,
  ShoppingBag,
  Phone,
  Mail,
  MapPin,
  Receipt,
  Star,
  UserCheck,
  Users,
  CreditCard,
  LogOut,
  ShieldCheck,
  User,
  Layers,
  FileText,
  Calendar,
  Download,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Camera,
  X,
  RefreshCw,
} from "lucide-react";

import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { useAppDispatch } from "../store/hooks";
import { clearUser } from "../store/slices/authSlice";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── Types ────────────────────────────────────────────────────────────────────

type OrderStatus =
  | "pending_delivery"
  | "pending_payment"
  | "payment_complete"
  | "shipped"
  | "delivered"
  | "cancelled";

type AdminTab = "overview" | "orders" | "users" | "inventory" | "reports" | "reviews" | "returns" | "settings";


interface OrderProduct {
  id: number;
  name: string;
  sku: string;
  qty: number;
  price: string;
  category: string;
}

interface Order {
  id: string;
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
  assignedTo?: string | null;
  assignedToName?: string | null;
}

interface DeliveryStaff {
  uid: string;
  name: string;
  phone?: string;
  email?: string;
}

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: string;
  status: string;
  isActive: boolean;
  createdAt: string;
  businessName?: string;
  phone?: string;
}

interface Review {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: any;
}

interface ReturnRequest {
  id: string;
  orderId: string;
  reason: string;
  imageUrl?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: any;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  image: string;
  price: string;
  unit: string;
  badge?: string;
  stock: number;
  createdAt?: any;
}



// ── Status Config ─────────────────────────────────────────────────────────────

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
    icon: CreditCard,
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

function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending_delivery;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cfg.color} ${cfg.bg} ${cfg.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse`} />
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function parsePrice(priceStr: string): number {
  const numericStr = priceStr.replace(/[^0-9.]/g, "");
  const val = parseFloat(numericStr);
  return isNaN(val) ? 0 : val;
}

// ── Order Card ─────────────────────────────────────────────────────────────────

function AdminOrderCard({
  order,
  deliveryStaff,
  onAssign,
}: {
  order: Order;
  deliveryStaff: DeliveryStaff[];
  onAssign: (orderId: string, staffUid: string, staffName: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState("");

  const formattedDate = new Date(order.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedTime = new Date(order.createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalItems = order.products.reduce((s, p) => s + p.qty, 0);

  return (
    <div
      className={`rounded-2xl border border-white/8 bg-site-card overflow-hidden transition-all duration-300 hover:border-violet-500/20 hover:shadow-xl hover:shadow-violet-500/5`}
    >
      {/* Card Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
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
              <p className="text-site-text-subtle text-xs">
                {formattedDate} · {formattedTime}
              </p>
            </div>
          </div>
        </div>

        {/* Customer name */}
        <div className="hidden md:block text-center">
          <p className="text-white/80 text-sm font-medium">
            {order.customer.name}
          </p>
          <p className="text-white/35 text-xs mt-0.5">
            {totalItems} item{totalItems !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4 sm:gap-5">
          {order.assignedToName && (
            <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/25 px-2.5 py-1 rounded-full">
              <UserCheck size={11} className="text-blue-400" />
              <span className="text-blue-400 text-[10px] font-semibold">
                {order.assignedToName}
              </span>
            </div>
          )}
          <div className="text-right">
            <p className="text-violet-400 font-bold text-sm">
              LKR {order.total.toLocaleString()}
            </p>
            <p className="text-white/35 text-[10px] mt-0.5">Total</p>
          </div>
          <StatusBadge status={order.status} />
          <button className="text-site-text-subtle hover:text-white/70 transition-colors ml-1">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-white/6 px-5 py-5 space-y-5">
          {/* Products table */}
          <div>
            <p className="text-white/45 text-[10px] font-bold uppercase tracking-widest mb-3">
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
                      className={`border-b border-white/4 last:border-0 hover:bg-white/2 ${idx % 2 === 0 ? "" : "bg-white/1"}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
                            <Package size={12} className="text-violet-400" />
                          </div>
                          <span className="text-white text-xs font-medium">
                            {product.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-white/35 text-[11px] font-mono">
                          {product.sku}
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
                          {(
                            parsePrice(product.price) * product.qty
                          ).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-violet-500/5 border-t border-violet-500/15">
                    <td
                      colSpan={4}
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

          {/* Customer + Assign row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Details */}
            <div className="rounded-xl bg-white/3 border border-white/7 p-4 space-y-3">
              <p className="text-white/45 text-[10px] font-bold uppercase tracking-widest">
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

              {order.notes && (
                <div className="rounded-lg bg-white/4 border border-white/6 px-3 py-2.5 mt-2">
                  <p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider mb-1">
                    Note
                  </p>
                  <p className="text-white/55 text-xs leading-relaxed italic">
                    "{order.notes}"
                  </p>
                </div>
              )}
            </div>

            {/* Assign Delivery Boy */}
            <div className="rounded-xl bg-white/3 border border-white/7 p-4 space-y-3">
              <p className="text-white/45 text-[10px] font-bold uppercase tracking-widest">
                Assign Delivery Staff
              </p>

              {order.assignedToName ? (
                <div className="rounded-xl bg-blue-500/10 border border-blue-500/25 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <UserCheck size={16} className="text-blue-400" />
                    <span className="text-blue-300 font-bold text-sm">
                      Assigned
                    </span>
                  </div>
                  <p className="text-white font-semibold text-sm">
                    {order.assignedToName}
                  </p>
                  <p className="text-site-text-subtle text-xs">
                    This order has been assigned for delivery.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-white/50 text-xs">
                    Select a delivery staff member to handle this order:
                  </p>
                  {deliveryStaff.length === 0 ? (
                    <p className="text-site-text-subtle text-xs italic">
                      No delivery staff available.
                    </p>
                  ) : (
                    <>
                      <select
                        value={selectedStaff}
                        onChange={(e) => setSelectedStaff(e.target.value)}
                        className="w-full bg-site-bg border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/40 transition-colors appearance-none cursor-pointer"
                      >
                        <option value="">-- Select Staff --</option>
                        {deliveryStaff.map((staff) => (
                          <option key={staff.uid} value={staff.uid}>
                            {staff.name}{" "}
                            {staff.phone ? `(${staff.phone})` : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          if (!selectedStaff) return;
                          const staff = deliveryStaff.find(
                            (s) => s.uid === selectedStaff
                          );
                          if (staff) {
                            onAssign(order.id, staff.uid, staff.name);
                            setSelectedStaff("");
                          }
                        }}
                        disabled={!selectedStaff}
                        className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 ${selectedStaff
                            ? "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20 hover:-translate-y-0.5"
                            : "bg-white/5 text-white/25 cursor-not-allowed"
                          }`}
                      >
                        <Truck size={14} />
                        Assign to Delivery
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Payment info */}
              <div className="border-t border-white/6 pt-3 mt-2">
                <div className="flex items-center gap-2">
                  <CreditCard size={12} className="text-site-text-subtle" />
                  <p className="text-site-text-subtle text-xs">Payment Method:</p>
                  <span className="text-white/70 text-xs font-semibold capitalize">
                    {order.paymentMethod === "card"
                      ? "Card Payment"
                      : "Cash on Delivery"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Admin Dashboard ───────────────────────────────────────────────────────

const AdminDashboard = () => {
  const authState = useAppSelector((state) => state.auth);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryStaff, setDeliveryStaff] = useState<DeliveryStaff[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");



  // Fetch ALL orders from Firestore
  useEffect(() => {
    const ordersRef = collection(db, "orders");
    const unsubscribe = onSnapshot(
      ordersRef,
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
            })),
            notes: d.notes || "",
            total: d.subTotal || 0,
            paymentMethod: d.paymentMethod || "cash",
            assignedTo: d.assignedTo || null,
            assignedToName: d.assignedToName || null,
          };
        });
        fetched.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setOrders(fetched);
      },
      (error) => {
        console.error("Error fetching orders:", error);
      }
    );


    return () => unsubscribe();
  }, []);

  // Fetch RDC staff (delivery boys)
  useEffect(() => {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("role", "==", "rdc-staff"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const staff: DeliveryStaff[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          uid: docSnap.id,
          name: d.name || d.firstName
            ? `${d.firstName || ""} ${d.lastName || ""}`.trim()
            : d.email || "Unknown",
          phone: d.phone || d.staffPhone || "",
          email: d.email || d.staffEmail || "",
        };
      });
      setDeliveryStaff(staff);
    });

    return () => unsubscribe();
  }, []);

  // Fetch ALL users for management
  useEffect(() => {
    const usersRef = collection(db, "users");
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const fetched: UserProfile[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          uid: docSnap.id,
          name: d.name || d.businessName || "Unknown",
          email: d.email || "",
          role: d.role || "unknown",
          status: d.status || "active",
          isActive: d.isActive !== undefined ? d.isActive : true,
          createdAt: d.createdAt || new Date().toISOString(),
          businessName: d.businessName,
          phone: d.phone || d.staffPhone,
        };
      });
      setUsers(fetched);
    });
    return () => unsubscribe();
  }, []);
  // Fetch Reviews
  useEffect(() => {
    const reviewsRef = collection(db, "reviews");
    const unsubscribe = onSnapshot(reviewsRef, (snapshot) => {
      const fetched: Review[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Review[];
      setReviews(fetched.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });
    return () => unsubscribe();
  }, []);

  // Fetch Returns
  useEffect(() => {
    const returnsRef = collection(db, "returns");
    const unsubscribe = onSnapshot(returnsRef, (snapshot) => {
      const fetched: ReturnRequest[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as ReturnRequest[];
      setReturns(fetched.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });
    return () => unsubscribe();
  }, []);

  // Fetch Products
  useEffect(() => {
    const productsRef = collection(db, "products");
    const unsubscribe = onSnapshot(productsRef, (snapshot) => {
      const fetched: Product[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Product[];
      setProducts(fetched);
    });
    return () => unsubscribe();
  }, []);

  // Assign order to delivery staff
  const handleAssign = async (
    orderId: string,
    staffUid: string,
    staffName: string
  ) => {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        assignedTo: staffUid,
        assignedToName: staffName,
        status: "shipped",
      });
    } catch (err) {
      console.error("Failed to assign order:", err);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    await signOut(auth);
    dispatch(clearUser());
    navigate("/login");
  };

  // Toggle User Status (Activate/Deactivate)
  const handleToggleUserStatus = async (uid: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "users", uid), {
        isActive: !currentStatus,
        status: !currentStatus ? "active" : "disabled",
      });
      toast.success(`User ${!currentStatus ? "activated" : "disabled"} successfully`);
    } catch (err) {
      console.error("Failed to update user status:", err);
      toast.error("Failed to update user status");
    }
  };

  // Handle Return Approval/Rejection
  const handleReturnAction = async (requestId: string, orderId: string, status: "approved" | "rejected") => {
    try {
      await updateDoc(doc(db, "returns", requestId), { status });
      await updateDoc(doc(db, "orders", orderId), { status: status === "approved" ? "returned" : "delivered" }); 
      toast.success(`Return request ${status} successfully`);
    } catch (err) {
      console.error("Failed to update return request:", err);
      toast.error("Failed to update return request");
    }
  };


  // Handle Delete Product
  const handleDeleteProduct = async (productId: string, imageUrl: string) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      await deleteDoc(doc(db, "products", productId));
      if (imageUrl && imageUrl.includes("firebasestorage")) {
        try {
          const imageRef = ref(storage, imageUrl);
          await deleteObject(imageRef);
        } catch (e) {
          console.warn("Storage image skip:", e);
        }
      }
      toast.success("Product deleted successfully");
    } catch (err) {
      console.error("Failed to delete product:", err);
      toast.error("Failed to delete product");
    }
  };

  // Seed Initial Products from Static Lists (One-time use)
  const seedProducts = async () => {
    if (!window.confirm("This will import default products to Firestore. Continue?")) return;
    setIsSeeding(true);
    try {
      // Sample product set for seeding
      const sampleProducts = [
        { name: "Kravings Mixed Nuts", sku: "PF-NUT-001", category: "Packaged Foods", price: "LKR 1,450", unit: "pack", stock: 18, image: "" },
        { name: "Gourmet Pasta Pack", sku: "PF-PST-002", category: "Packaged Foods", price: "LKR 890", unit: "box", stock: 25, image: "" },
        { name: "Fanta Orange 500ml", sku: "BV-SFT-002", category: "Beverages", price: "LKR 280", unit: "bottle", stock: 45, image: "" },
        { name: "Apple Juice Fresh Press", sku: "BV-APJ-001", category: "Beverages", price: "LKR 650", unit: "bottle", stock: 24, image: "" },
        { name: "Ajax Multi-Purpose", sku: "CL-AJX-001", category: "Home Cleaning", price: "LKR 720", unit: "bottle", stock: 12, image: "" },
        { name: "Harpic Toilet Cleaner", sku: "CL-HRP-002", category: "Home Cleaning", price: "LKR 480", unit: "bottle", stock: 20, image: "" },
        { name: "Dettol Liquid Handwash", sku: "PC-HW-002", category: "Personal Care", price: "LKR 680", unit: "bottle", stock: 25, image: "" },
        { name: "Colgate Toothbrush 6-Pack", sku: "PC-TBR-001", category: "Personal Care", price: "LKR 1,250", unit: "pack", stock: 40, image: "" }
      ];

      for (const p of sampleProducts) {
        // Only add if SKU doesn't exist in current state to avoid duplicates
        if (!products.some(existing => existing.sku === p.sku)) {
          await addDoc(collection(db, "products"), {
            ...p,
            createdAt: serverTimestamp(),
          });
        }
      }
      
      toast.success("Initial inventory seeded!");
    } catch (err) {
      console.error("Seeding failed:", err);
      toast.error("Failed to seed products");
    } finally {
      setIsSeeding(false);
    }
  };


  // Generate Monthly PDF Report
  const downloadMonthlyReport = (monthYear: string) => {
    const [year, month] = monthYear.split("-").map(Number);
    const reportOrders = orders.filter(o => {
      const d = new Date(o.createdAt);
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });

    if (reportOrders.length === 0) {
      toast.info("No orders found for this month.");
      return;
    }

    const doc = new jsPDF();
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });

    // Header
    doc.setFontSize(20);
    doc.setTextColor(40);
    doc.text(`IslandLink Monthly Sales Report`, 14, 22);

    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text(`${monthName} ${year}`, 14, 30);

    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 38);
    doc.text(`Total Orders: ${reportOrders.length}`, 14, 43);
    doc.text(`Total Revenue: LKR ${reportOrders.reduce((s, o) => s + o.total, 0).toLocaleString()}`, 14, 48);

    // Table
    const tableData = reportOrders.map(o => [
      o.id.slice(0, 8).toUpperCase(),
      new Date(o.createdAt).toLocaleDateString(),
      o.customer.name,
      o.status.replace("_", " ").toUpperCase(),
      `LKR ${o.total.toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['Order ID', 'Date', 'Customer', 'Status', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [139, 92, 246] }, // Violet-600
      alternateRowStyles: { fillColor: [245, 245, 245] },
      styles: { fontSize: 9 }
    });

    doc.save(`IslandLink_Report_${monthYear}.pdf`);
    toast.success(`Report for ${monthName} ${year} downloaded successfully.`);
  };

  // Search filter
  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    return (
      o.id.toLowerCase().includes(q) ||
      o.customer.name.toLowerCase().includes(q) ||
      o.customer.phone.includes(q) ||
      o.customer.email.toLowerCase().includes(q) ||
      o.products.some((p) => p.name.toLowerCase().includes(q))
    );
  });

  // Stats
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const pendingCount = orders.filter(
    (o) =>
      o.status === "pending_delivery" ||
      o.status === "pending_payment" ||
      o.status === "payment_complete"
  ).length;
  const shippedCount = orders.filter((o) => o.status === "shipped").length;
  const lowStockCount = products.filter((p) => p.stock < 10).length;

  // ── Low Stock Notification ────────────────────────────────────────────────
  useEffect(() => {
    const lowStockItems = products.filter(p => p.stock < 10);
    if (lowStockItems.length > 0) {
      toast.warning(`Attention: ${lowStockItems.length} items are running low on stock!`, {
        toastId: "low-stock-alert", // Prevent duplicate toasts
        autoClose: 5000,
      });
    }
  }, [products]);

  // ── Chart Data Preparation ─────────────────────────────────────────────────
  
  // 1. Revenue Over Time (Last 7 Days)
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split("T")[0];
  }).reverse();

  const revenueData = last7Days.map(date => {
    const dailyTotal = orders
      .filter(o => o.createdAt.split("T")[0] === date)
      .reduce((sum, o) => sum + o.total, 0);
    return { date: date.slice(5), revenue: dailyTotal };
  });

  // 2. Order Status Distribution
  const statusCounts = orders.reduce((acc: any, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.keys(statusCounts).map(status => ({
    name: STATUS_CONFIG[status as OrderStatus]?.label || status,
    value: statusCounts[status]
  }));

  const COLORS = ["#8b5cf6", "#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#6b7280"];

  // 3. Category Performance
  const categoryDataRaw = orders.reduce((acc: any, o) => {
    o.products.forEach(p => {
      const cat = p.category || "General";
      acc[cat] = (acc[cat] || 0) + (parsePrice(p.price) * p.qty);
    });
    return acc;
  }, {});

  const barData = Object.keys(categoryDataRaw).map(cat => ({
    name: cat,
    sales: categoryDataRaw[cat]
  })).sort((a, b) => b.sales - a.sales).slice(0, 5);


  return (
    <div className="h-screen bg-site-bg font-sans flex text-site-text overflow-hidden transition-colors duration-300">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-64 border-r border-site-border bg-site-card flex flex-col shrink-0 h-screen sticky top-0 overflow-y-auto custom-scrollbar transition-colors duration-300 shadow-xl shadow-black/5">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-3 mb-8 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:scale-105 transition-transform">
              <Package size={16} className="text-white" />
            </div>
            <div>
              <span className="text-site-text font-bold text-sm tracking-tight group-hover:text-violet-500 transition-colors">ISDN Admin</span>
              <span className="block text-[9px] text-site-text-subtle uppercase tracking-widest font-bold">Control Panel</span>
            </div>
          </Link>

          <nav className="space-y-1">
            {[
              { id: "overview", label: "Overview", icon: ShoppingBag },
              { id: "orders", label: "Orders", icon: Receipt },
              { id: "users", label: "Users & Staff", icon: Users },
              { id: "inventory", label: "Inventory", icon: Layers },
              { id: "reports", label: "Reports", icon: FileText },
              { id: "reviews", label: "Reviews", icon: Star },
              { id: "returns", label: "Returns", icon: AlertTriangle },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as AdminTab)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive
                      ? "bg-violet-600/10 text-violet-500 border border-violet-500/20"
                      : "text-site-text-subtle hover:text-site-text hover:bg-site-surface border border-transparent"
                    }`}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-6 space-y-4">
          <div className="rounded-2xl bg-violet-600/10 border border-violet-500/10 p-4">
            <p className="text-[10px] text-site-text-subtle font-bold uppercase mb-2">System Health</p>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              All Systems Operational
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400/60 hover:text-red-400 hover:bg-red-400/5 transition-all"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-site-bg">
        {/* Top Header */}
        <header className="px-8 py-6 border-b border-site-border flex items-center justify-between sticky top-0 bg-site-bg/80 backdrop-blur-md z-30 transition-colors duration-300">
          <div>
            <h2 className="text-xl font-bold capitalize text-site-text">{activeTab}</h2>
            <p className="text-site-text-subtle text-[10px] uppercase tracking-widest font-bold mt-0.5">
              Welcome back, {authState.name || "Admin"}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-site-text-subtle group-focus-within:text-violet-500 transition-colors" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Quick search..."
                className="bg-site-surface border border-site-border rounded-xl pl-9 pr-4 py-2 text-xs text-site-text focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/40 w-64 transition-all"
              />
            </div>

            <Link to="/delivery-tracking" className="p-2 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400 hover:bg-violet-600/20 transition-all" title="Live Tracking">
              <MapPin size={18} />
            </Link>
          </div>
        </header>

        {/* Tab Content */}
        <div className="p-8">
          {activeTab === "overview" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Stats Cards in Grid */}
                {[
                  { label: "Total Revenue", value: `LKR ${totalRevenue.toLocaleString()}`, icon: Receipt, color: "text-violet-500", bg: "bg-violet-500/10" },
                  { label: "Pending Orders", value: pendingCount, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
                  { label: "Active Deliveries", value: shippedCount, icon: Truck, color: "text-blue-500", bg: "bg-blue-500/10" },
                  { label: "Pending Users", value: users.filter(u => u.status === "pending").length, icon: Users, color: "text-orange-500", bg: "bg-orange-500/10" },
                  { label: "Low Stock Items", value: lowStockCount, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
                ].map((stat) => (
                  <div key={stat.label} className={`rounded-2xl border border-site-border bg-site-card p-5 flex items-center gap-4 hover:border-violet-500/20 transition-all duration-300 group shadow-lg shadow-black/5`}>
                    <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                      <stat.icon size={20} className={stat.color} />
                    </div>
                    <div>
                      <p className="text-site-text-subtle text-[10px] font-bold uppercase tracking-widest">{stat.label}</p>
                      <p className="text-xl font-black text-site-text mt-0.5">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Revenue Line Chart */}
                <div className="rounded-3xl border border-site-border bg-site-card p-6 lg:col-span-2">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="font-bold text-lg">Revenue Forecast</h3>
                      <p className="text-xs text-site-text-subtle italic">Daily revenue trends for the last 7 days</p>
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400 text-xs font-bold font-mono">
                      LKR {totalRevenue.toLocaleString()} Total
                    </div>
                  </div>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueData}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#ffffff30" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <YAxis 
                          stroke="#ffffff30" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(value) => `LKR ${value}`}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#0E1015", border: "1px solid #ffffff10", borderRadius: "12px", fontSize: "10px" }}
                          itemStyle={{ color: "#8b5cf6" }}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Status Pie Chart */}
                <div className="rounded-3xl border border-site-border bg-site-card p-6">
                  <h3 className="font-bold mb-6">Order Status</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#0E1015", border: "1px solid #ffffff10", borderRadius: "12px", fontSize: "10px" }}
                        />
                        <Legend iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Category Bar Chart */}
                <div className="rounded-3xl border border-site-border bg-site-card p-6">
                  <h3 className="font-bold mb-6">Top Categories (Revenue)</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          stroke="#ffffff60" 
                          fontSize={10} 
                          width={80}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip 
                          cursor={{ fill: "#ffffff05" }}
                          contentStyle={{ backgroundColor: "#0E1015", border: "1px solid #ffffff10", borderRadius: "12px", fontSize: "10px" }}
                        />
                        <Bar dataKey="sales" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Recent Activity Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Orders Overview */}
                <div className="rounded-3xl border border-site-border bg-site-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold">Recent Orders</h3>
                    <button onClick={() => setActiveTab("orders")} className="text-[10px] text-violet-400 font-bold uppercase hover:underline">View All</button>
                  </div>
                  <div className="space-y-4">
                    {orders.slice(0, 5).map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-3 rounded-xl bg-white/2 border border-site-border">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center">
                            <Package size={14} className="text-violet-400" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white/80">{order.customer.name}</p>
                            <p className="text-[10px] text-white/35 font-mono uppercase">{order.id.slice(0, 8)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-violet-400">LKR {order.total.toLocaleString()}</p>
                          <p className="text-[9px] text-white/20">{new Date(order.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* User Status Overview */}
                <div className="rounded-3xl border border-site-border bg-site-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold">New Registrations</h3>
                    <button onClick={() => setActiveTab("users")} className="text-[10px] text-violet-400 font-bold uppercase hover:underline">Monitor Users</button>
                  </div>
                  <div className="space-y-4">
                    {users.filter(u => u.status === "pending").slice(0, 5).map((u) => (
                      <div key={u.uid} className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                            <Users size={14} className="text-amber-400" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white/80">{u.name}</p>
                            <p className="text-[10px] text-white/35 capitalize">{u.role}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setActiveTab("users")}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-[10px] font-black uppercase tracking-tighter"
                        >
                          Review
                        </button>
                      </div>
                    ))}
                    {users.filter(u => u.status === "pending").length === 0 && (
                      <div className="py-8 text-center bg-white/2 rounded-2xl border border-dashed border-white/10">
                        <p className="text-white/20 text-xs italic">No pending registrations</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "orders" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Order Management</h3>
                  <p className="text-site-text-subtle text-xs">Total {orders.length} orders processed</p>
                </div>
              </div>
              <div className="space-y-3">
                {filtered.map((order) => (
                  <AdminOrderCard
                    key={order.id}
                    order={order}
                    deliveryStaff={deliveryStaff}
                    onAssign={handleAssign}
                  />
                ))}
                {filtered.length === 0 && (
                  <div className="py-20 text-center bg-white/2 rounded-3xl border border-dashed border-white/10">
                    <ShoppingBag size={40} className="mx-auto text-white/10 mb-4" />
                    <p className="text-site-text-subtle italic">No orders found matching your criteria</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "users" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">User Monitoring</h3>
                  <p className="text-site-text-subtle text-xs">Manage system access and account approvals</p>
                </div>
              </div>

              <div className="rounded-3xl border border-site-border bg-site-card overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/3 border-b border-site-border">
                      <th className="text-left py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-white/35 min-w-[200px]">User / Business</th>
                      <th className="text-left py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-white/35 min-w-[120px]">Role</th>
                      <th className="text-left py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-white/35 min-w-[120px]">Status</th>
                      <th className="text-left py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-white/35 min-w-[120px]">Joined</th>
                      <th className="text-right py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-white/35 min-w-[150px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map((u) => (
                      <tr key={u.uid} className="hover:bg-white/2 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-site-border">
                              {u.role === "admin" ? <ShieldCheck size={16} className="text-red-400" /> : <User size={16} className="text-site-text-subtle" />}
                            </div>
                            <div>
                              <p className="font-bold text-white/90 truncate max-w-[150px]">{u.name}</p>
                              <p className="text-[10px] text-white/35 truncate max-w-[150px]">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${u.role === "admin" ? "bg-red-500/10 text-red-400" :
                              u.role === "rdc-staff" ? "bg-blue-500/10 text-blue-400" : "bg-violet-500/10 text-violet-400"
                            }`}>
                            {u.role.replace("-", " ")}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-emerald-400" : "bg-amber-400"}`} />
                            <span className={`text-xs font-medium capitalize ${u.isActive ? "text-emerald-400" : "text-amber-400"}`}>{u.status}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-site-text-subtle text-xs">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-6 text-right">
                          {u.uid !== authState.uid && (
                            <button
                              onClick={() => handleToggleUserStatus(u.uid, u.isActive)}
                              className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all ${u.isActive
                                  ? "bg-red-500/5 hover:bg-red-500/10 text-red-400 border border-red-500/10"
                                  : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20"
                                }`}
                            >
                              {u.isActive ? "Disable" : "Approve Account"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "inventory" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold">Inventory Management</h3>
                  <p className="text-site-text-subtle text-xs">Manage product catalog, stock levels and pricing</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={seedProducts}
                    disabled={isSeeding}
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs font-bold hover:bg-white/10 transition-all flex items-center gap-2"
                  >
                    <RefreshCw size={14} className={isSeeding ? "animate-spin" : ""} />
                    {isSeeding ? "Seeding..." : "Seed Default Data"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingProduct(null);
                      setIsProductModalOpen(true);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-violet-600 text-white font-bold text-xs uppercase hover:bg-violet-500 transition-all shadow-lg shadow-violet-500/20 flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Add New Product
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="md:col-span-2 p-1 rounded-2xl bg-white/3 border border-site-border flex">
                  <div className="px-3 flex items-center text-white/20">
                    <Search size={16} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by name or SKU..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full h-11 bg-transparent border-none focus:ring-0 text-sm text-white placeholder:text-white/20"
                  />
                </div>
                <div className="p-4 rounded-2xl bg-site-card border border-site-border flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Package size={16} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-site-text-subtle text-[10px] font-bold uppercase">Total Items</p>
                    <p className="text-lg font-black text-white">{products.length}</p>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-site-card border border-site-border flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle size={16} className="text-red-400" />
                  </div>
                  <div>
                    <p className="text-site-text-subtle text-[10px] font-bold uppercase">Low Stock</p>
                    <p className="text-lg font-black text-white">{products.filter(p => p.stock < 10).length}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 py-4 border-y border-site-border">
                {["All", "Packaged Foods", "Beverages", "Home Cleaning", "Personal Care"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all border ${
                      selectedCategory === cat
                        ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20 border-violet-500"
                        : "bg-white/5 text-site-text-subtle hover:bg-white/10 hover:text-white/60 border-site-border"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {products
                  .filter(p => {
                    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                                          p.sku.toLowerCase().includes(search.toLowerCase());
                    const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
                    return matchesSearch && matchesCategory;
                  })
                  .map((product) => (
                  <div key={product.id} className="group relative rounded-2xl border border-site-border bg-site-card overflow-hidden hover:border-violet-500/30 transition-all duration-300">
                    <div className="aspect-square bg-white/2 relative">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/10">
                          <Package size={48} />
                        </div>
                      )}
                      <div className="absolute top-2 right-2 flex gap-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                        <button
                          onClick={() => {
                            setEditingProduct(product);
                            setIsProductModalOpen(true);
                          }}
                          className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:bg-violet-600 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id, product.image)}
                          className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {product.badge && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-violet-600/80 backdrop-blur-sm text-[10px] font-bold text-white uppercase tracking-wider">
                          {product.badge}
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-mono text-site-text-subtle">{product.sku}</p>
                        <p className={`text-[10px] font-bold uppercase ${product.stock < 10 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {product.stock} in stock
                        </p>
                      </div>
                      <h4 className="text-sm font-bold text-white mb-2 line-clamp-1">{product.name}</h4>
                      <div className="flex items-center justify-between">
                        <p className="text-violet-400 font-black">{product.price}</p>
                        <span className="text-[10px] text-white/20 uppercase font-black tracking-widest bg-white/5 px-2 py-1 rounded-md">
                          {product.category}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {products.length === 0 && !isSeeding && (
                  <div className="col-span-full py-32 text-center bg-white/2 rounded-[3rem] border border-dashed border-white/10">
                    <ShoppingBag size={48} className="mx-auto text-white/10 mb-4" />
                    <h4 className="text-white/60 font-bold mb-2">No Products Found</h4>
                    <p className="text-site-text-subtle text-sm mb-8">Start by adding your first product or seed default data.</p>
                    <button 
                      onClick={() => setIsProductModalOpen(true)}
                      className="px-6 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold"
                    >
                      Add Product
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "reports" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Monthly Sales Reports</h3>
                  <p className="text-site-text-subtle text-xs">Generate and download detailed order performance summaries</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Generate months from orders */}
                {Array.from(new Set(orders.map(o => {
                  const d = new Date(o.createdAt);
                  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                }))).sort().reverse().map(monthYear => {
                  const [year, month] = monthYear.split("-").map(Number);
                  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
                  const monthOrders = orders.filter(o => {
                    const d = new Date(o.createdAt);
                    return d.getFullYear() === year && (d.getMonth() + 1) === month;
                  });
                  const monthRevenue = monthOrders.reduce((s, o) => s + o.total, 0);

                  return (
                    <div key={monthYear} className="p-6 rounded-[2rem] bg-site-card border border-site-border space-y-4 hover:border-violet-500/30 transition-all group">
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded-2xl bg-violet-600/10 flex items-center justify-center border border-violet-500/10 text-violet-400">
                          <Calendar size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{year}</span>
                      </div>

                      <div>
                        <h4 className="text-xl font-black text-white">{monthName}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-site-text-subtle">{monthOrders.length} Orders</span>
                          <span className="w-1 h-1 rounded-full bg-white/10" />
                          <span className="text-xs text-violet-400 font-bold">LKR {monthRevenue.toLocaleString()}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => downloadMonthlyReport(monthYear)}
                        className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/80 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-violet-600 hover:text-white hover:border-transparent transition-all shadow-lg group-hover:shadow-violet-500/10"
                      >
                        <Download size={14} />
                        Download PDF Report
                      </button>
                    </div>
                  );
                })}

                {orders.length === 0 && (
                  <div className="col-span-full py-20 text-center bg-white/2 rounded-[2.5rem] border border-dashed border-white/10">
                    <FileText size={48} className="mx-auto text-white/10 mb-4" />
                    <p className="text-site-text-subtle italic">No orders available to generate reports</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "reviews" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Customer Reviews</h3>
                  <p className="text-site-text-subtle text-xs">Feedback and ratings from delivered orders</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reviews.map((review) => (
                  <div key={review.id} className="p-6 rounded-3xl bg-site-card border border-site-border space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-600/10 flex items-center justify-center text-violet-400">
                          <User size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{review.customerName}</p>
                          <p className="text-[10px] text-site-text-subtle uppercase tracking-widest">Order: {review.orderId.slice(0, 8)}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 text-violet-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={12} className={i < review.rating ? "fill-violet-400" : "text-white/5"} />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed italic">"{review.comment}"</p>
                    <p className="text-[10px] text-white/20 text-right italic">
                      {review.createdAt?.seconds 
                        ? new Date(review.createdAt.seconds * 1000).toLocaleDateString()
                        : "Just now"}
                    </p>
                  </div>
                ))}
                {reviews.length === 0 && (
                  <div className="col-span-full py-20 text-center bg-white/2 rounded-[2.5rem] border border-dashed border-white/10">
                    <Star size={48} className="mx-auto text-white/10 mb-4" />
                    <p className="text-site-text-subtle italic">No reviews received yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "returns" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Return Requests</h3>
                  <p className="text-site-text-subtle text-xs">Manage product returns and damage claims</p>
                </div>
              </div>

              <div className="space-y-4">
                {returns.map((request) => (
                  <div key={request.id} className="p-6 rounded-3xl bg-site-card border border-site-border flex flex-col md:flex-row gap-6">
                    <div className="w-full md:w-32 h-32 rounded-2xl bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
                      {request.imageUrl ? (
                        <img src={request.imageUrl} alt="Damage evidence" className="w-full h-full object-cover" />
                      ) : (
                        <Package size={32} className="text-white/10" />
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-site-text-subtle uppercase tracking-widest font-bold">Order ID</p>
                          <p className="text-sm font-black text-white">{request.orderId.toUpperCase()}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          request.status === "pending" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                          request.status === "approved" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                          "bg-red-500/10 text-red-500 border border-red-500/20"
                        }`}>
                          {request.status}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-site-text-subtle uppercase tracking-widest font-bold mb-1">Reason</p>
                        <p className="text-sm text-white/70 capitalize">{request.reason.replace("_", " ")}</p>
                      </div>
                    </div>
                    {request.status === "pending" && (
                      <div className="flex md:flex-col gap-3 justify-center">
                        <button
                          onClick={() => handleReturnAction(request.id, request.orderId, "approved")}
                          className="px-6 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReturnAction(request.id, request.orderId, "rejected")}
                          className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-site-text-subtle text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {returns.length === 0 && (
                  <div className="py-20 text-center bg-white/2 rounded-[2.5rem] border border-dashed border-white/10">
                    <AlertTriangle size={48} className="mx-auto text-white/10 mb-4" />
                    <p className="text-site-text-subtle italic">No return requests found</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── PRODUCT MODAL ─────────────────────────────────────────── */}
      {isProductModalOpen && (
        <ProductModal
          isOpen={isProductModalOpen}
          onClose={() => setIsProductModalOpen(false)}
          editingProduct={editingProduct}
        />
      )}
    </div>
  );
};

// ── Product Modal Component ───────────────────────────────────────────────────
interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: Product | null;
}

const ProductModal = ({ onClose, editingProduct }: ProductModalProps) => {
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(editingProduct?.image || "");
  const [form, setForm] = useState({
    name: editingProduct?.name || "",
    sku: editingProduct?.sku || "",
    category: editingProduct?.category || "Packaged Foods",
    price: editingProduct?.price || "LKR ",
    unit: editingProduct?.unit || "",
    badge: editingProduct?.badge || "",
    stock: editingProduct?.stock || 20,
  });

  const CATEGORIES = ["Packaged Foods", "Beverages", "Home Cleaning", "Personal Care"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let imageUrl = editingProduct?.image || "";

      // Upload image if changed
      if (imageFile) {
        const storageRef = ref(storage, `products/${Date.now()}_${imageFile.name}`);
        const snapshot = await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(snapshot.ref);
      }

      const productData = {
        ...form,
        image: imageUrl,
        updatedAt: serverTimestamp(),
      };

      if (editingProduct) {
        await updateDoc(doc(db, "products", editingProduct.id), productData);
        toast.success("Product updated successfully");
      } else {
        await addDoc(collection(db, "products"), {
          ...productData,
          createdAt: serverTimestamp(),
        });
        toast.success("Product added successfully");
      }
      onClose();
    } catch (err) {
      console.error("Save failed:", err);
      toast.error("Failed to save product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative z-[101] w-full max-w-2xl bg-site-card border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
        <div className="flex items-center justify-between px-8 py-6 border-b border-site-border bg-white/2">
          <div>
            <h3 className="text-xl font-bold text-white">{editingProduct ? "Edit Product" : "Add New Product"}</h3>
            <p className="text-site-text-subtle text-xs">Fill in the details below to update the catalog</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-site-text-subtle hover:text-white transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Image Upload */}
            <div className="md:col-span-2">
              <p className="text-xs font-bold text-white/20 uppercase tracking-widest mb-3">Product Image</p>
              <div className="flex items-center gap-6">
                <div className="w-32 h-32 rounded-2xl bg-white/5 border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden group relative">
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <Camera size={24} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <Camera size={32} className="text-white/10" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setImageFile(file);
                        setImagePreview(URL.createObjectURL(file));
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-white/60">Upload a clear product image.</p>
                  <p className="text-xs text-white/20">Supports JPG, PNG, WebP (Max 2MB)</p>
                  <label className="inline-block px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs font-bold cursor-pointer hover:bg-white/10">
                    Choose File
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setImageFile(file);
                          setImagePreview(URL.createObjectURL(file));
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Basic Info */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/20 uppercase tracking-widest pl-1">Product Name</label>
              <input
                required
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white text-sm focus:border-violet-500/50 transition-all outline-none"
                placeholder="e.g. Premium Basmati Rice"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/20 uppercase tracking-widest pl-1">SKU / Code</label>
              <input
                required
                type="text"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white text-sm focus:border-violet-500/50 transition-all outline-none"
                placeholder="e.g. PF-RIC-001"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/20 uppercase tracking-widest pl-1">Category</label>
              <div className="relative">
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white text-sm focus:border-violet-500/50 transition-all outline-none appearance-none"
                >
                  {CATEGORIES.map(c => <option key={c} value={c} className="bg-site-card">{c}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/20 uppercase tracking-widest pl-1">Unit</label>
              <input
                required
                type="text"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white text-sm focus:border-violet-500/50 transition-all outline-none"
                placeholder="e.g. pack, bottle, kg"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/20 uppercase tracking-widest pl-1">Price (LKR)</label>
              <input
                required
                type="text"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white text-sm focus:border-violet-500/50 transition-all outline-none font-mono"
                placeholder="LKR 000.00"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/20 uppercase tracking-widest pl-1">Initial Stock</label>
              <input
                required
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })}
                className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white text-sm focus:border-violet-500/50 transition-all outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/20 uppercase tracking-widest pl-1">Badge (Optional)</label>
              <input
                type="text"
                value={form.badge}
                onChange={(e) => setForm({ ...form, badge: e.target.value })}
                className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white text-sm focus:border-violet-500/50 transition-all outline-none"
                placeholder="e.g. New, Bestseller"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl bg-white/5 border border-white/10 text-site-text-subtle font-bold hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-2 h-12 rounded-xl bg-violet-600 text-white font-bold shadow-lg shadow-violet-500/20 hover:bg-violet-500 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle size={18} />}
              {editingProduct ? "Update Product" : "Save Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminDashboard;
