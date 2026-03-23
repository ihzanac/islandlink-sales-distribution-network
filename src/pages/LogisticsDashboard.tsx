import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Truck, 
  MapPin, 
  Clock, 
  CheckCircle, 
  Search, 
  LogOut, 
  Navigation,
  Globe,
  Bell,
  Box,
  TrendingUp,
  Activity
} from "lucide-react";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { useAppDispatch } from "../store/hooks";
import { clearUser } from "../store/slices/authSlice";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar
} from "recharts";
interface LogisticsOrder {
  id: string;
  status: string;
  customer: {
    name: string;
    district: string;
  };
  total: number;
  assignedToName?: string;
  createdAt: string;
}

const LogisticsDashboard = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  const [orders, setOrders] = useState<LogisticsOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSegment, setActiveSegment] = useState("all");
  const [activeTab, setActiveTab] = useState("fleet");

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: LogisticsOrder[] = snapshot.docs.map(docSnap => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          status: d.status || "pending_delivery",
          customer: {
            name: d.customerName || d.customer?.name || "Unknown",
            district: d.district || d.customer?.district || "N/A",
          },
          total: d.subTotal || d.total || 0,
          assignedToName: d.assignedToName || null,
          createdAt: d.createdAt || new Date().toISOString()
        } as LogisticsOrder;
      });
      setOrders(fetched);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    dispatch(clearUser());
    navigate("/login");
  };

  const filteredOrders = orders.filter(o => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = (o.customer?.name || "").toLowerCase().includes(q) || (o.id || "").toLowerCase().includes(q);
    if (activeTab === "fleet") {
      // For fleet tab, only show shipped or pending for the main table
      return matchesSearch && (o.status === "shipped" || o.status === "pending_delivery" || o.status === "payment_complete");
    } else if (activeTab === "shipments") {
      // For shipments tab, filter by activeSegment
      if (activeSegment === "all") return matchesSearch;
      return matchesSearch && o.status === activeSegment;
    }
    return matchesSearch; // Default for other tabs if needed
  });

  // ── Chart Data Preparation ─────────────────────────────────────────────────

  // 1. Delivery Velocity (Last 7 Days Volume)
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split("T")[0];
  }).reverse();

  const velocityData = last7Days.map(date => {
    const dayOrders = orders.filter(o => o.createdAt.split("T")[0] === date);
    const volume = dayOrders.length;
    const success = dayOrders.filter(o => o.status === "delivered").length;
    return { date: date.slice(5), volume, success };
  });

  // 2. SLA Success Rate (Pie Chart)
  const deliveredCount = orders.filter(o => o.status === "delivered").length;
  const exceptionCount = orders.filter(o => o.status === "cancelled" || o.status === "pending_delivery").length;
  
  const slaData = [
    { name: "On-Time", value: deliveredCount || 1 }, // Fallback to 1 for visuals if empty
    { name: "Exceptions", value: exceptionCount || 0 }
  ];
  const SLA_COLORS = ["#10b981", "#ef4444"];

  // 3. Hub Operations (Bar Chart)
  const hubData = [
    { name: "North Hub", incoming: Math.floor(Math.random() * 20 + 5), outgoing: Math.floor(Math.random() * 15 + 2) },
    { name: "Central Hub", incoming: Math.floor(Math.random() * 30 + 10), outgoing: Math.floor(Math.random() * 25 + 5) },
    { name: "South Hub", incoming: Math.floor(Math.random() * 15 + 5), outgoing: Math.floor(Math.random() * 10 + 2) },
    { name: "East Hub", incoming: Math.floor(Math.random() * 10 + 2), outgoing: Math.floor(Math.random() * 5 + 1) },
    { name: "West Hub", incoming: Math.floor(Math.random() * 12 + 3), outgoing: Math.floor(Math.random() * 8 + 2) },
  ];

  return (
    <div className="h-screen bg-site-bg font-sans flex text-white overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-64 border-r border-site-border bg-site-card flex flex-col shrink-0">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-3 mb-10 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Truck size={16} className="text-white" />
            </div>
            <div>
              <span className="text-site-text font-bold text-sm tracking-tight group-hover:text-blue-500 transition-colors">ISDN Logistics</span>
              <span className="block text-[9px] text-site-text-subtle uppercase tracking-widest font-bold font-mono">Operations</span>
            </div>
          </Link>

          <nav className="space-y-1.5">
            {[
              { id: "fleet", label: "Fleet Monitor", icon: Navigation },
              { id: "shipments", label: "Shipments", icon: Box },
              { id: "rdcs", label: "Cross-RDC", icon: Globe },
              { id: "efficiency", label: "Efficiency", icon: TrendingUp },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSearchQuery(""); // Clear search when changing tabs
                  setActiveSegment("all"); // Reset segment when changing tabs
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTab === item.id
                    ? "bg-blue-600/10 text-blue-500 border border-blue-500/20"
                    : "text-site-text-subtle hover:text-site-text hover:bg-site-surface border border-transparent"
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 space-y-4">
          <div className="rounded-2xl bg-blue-600/10 border border-blue-500/10 p-4">
            <p className="text-[10px] text-site-text-subtle font-bold uppercase mb-2">Fleet Status</p>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              85% Fleet Active
            </div>
          </div>

          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400/60 hover:text-red-400 hover:bg-red-400/5 transition-all">
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-site-bg">
        <header className="px-8 py-6 border-b border-site-border flex items-center justify-between sticky top-0 bg-site-bg/80 backdrop-blur-md z-30 transition-colors duration-300">
          <div>
            <h2 className="text-xl font-bold capitalize text-site-text">{activeTab.replace("-", " ")}</h2>
            <p className="text-site-text-subtle text-[10px] uppercase tracking-widest font-bold mt-0.5">Monitoring RDC Distribution Network</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-site-text-subtle group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder="Search shipment..."
                className="bg-site-surface border border-site-border rounded-xl pl-9 pr-4 py-2 text-xs text-site-text focus:outline-none focus:border-blue-500/40 w-64 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <button className="p-2.5 rounded-xl bg-site-surface border border-site-border text-site-text-subtle hover:text-blue-500 transition-all relative group">
              <Bell size={18} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-site-bg" />
            </button>
          </div>
        </header>

        <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Dashboard Modules */}
          {activeTab === "fleet" && (
            <>
              {/* Quick Stats Block */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: "Active Shipments", value: orders.filter(o => o.status === "shipped").length, icon: Truck, color: "text-blue-400", bg: "bg-blue-500/10" },
                  { label: "Pending Pickup", value: orders.filter(o => o.status === "payment_complete" || o.status === "pending_delivery").length, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
                  { label: "Transit Exceptions", value: "2", icon: Activity, color: "text-red-400", bg: "bg-red-500/10" },
                  { label: "Delivered Today", value: orders.filter(o => o.status === "delivered").length, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-site-card border border-site-border rounded-2xl p-5 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center shrink-0`}>
                      <stat.icon size={20} className={stat.color} />
                    </div>
                    <div>
                      <p className="text-site-text-subtle text-[10px] font-bold uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                      <p className="text-xl font-black text-white">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Transit List */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wider">
                      <Activity size={18} className="text-blue-400" />
                      Live Fleet Activity
                    </h3>
                  </div>

                  <div className="bg-site-card border border-site-border rounded-3xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-white/2 border-b border-site-border">
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-site-text-subtle">Shipment ID</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-site-text-subtle">Destination</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-site-text-subtle">Status</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-site-text-subtle">ETA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs font-medium">
                        {filteredOrders.slice(0, 6).map((order) => (
                          <tr key={order.id} className="hover:bg-white/2 transition-all">
                            <td className="px-6 py-4">
                              <p className="text-white/80 font-mono tracking-tighter uppercase">{order.id.slice(0, 10)}</p>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <MapPin size={12} className="text-site-text-subtle" />
                                <span>{order.customer?.district || "N/A"}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-md capitalize ${
                                order.status === "shipped" ? "bg-blue-500/10 text-blue-400" :
                                order.status === "delivered" ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-site-text-subtle"
                              }`}>
                                {order.status.replace("_", " ")}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-site-text-subtle">
                              {order.status === "shipped" ? "Calculating..." : "---"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tracking View */}
                <div className="space-y-6">
                  <div className="bg-linear-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 shadow-xl shadow-blue-900/20">
                    <h4 className="text-white font-black text-lg mb-2">Live Tracking</h4>
                    <p className="text-white/70 text-xs leading-relaxed mb-6 italic">Monitor real-time vehicle movement across provinces.</p>
                    <Link to="/delivery-tracking" className="w-full py-3 bg-white text-blue-700 rounded-xl text-xs font-black block text-center uppercase tracking-tighter hover:bg-white/90 transition-all">
                      Launch Tracking Map
                    </Link>
                  </div>

                  <div className="bg-site-card border border-site-border rounded-3xl p-6">
                    <h3 className="font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                      <Navigation size={18} className="text-blue-400" />
                      Active Hubs
                    </h3>
                    <div className="space-y-3">
                      {["Colombo Central", "Kandy East", "Galle Port"].map(rdc => (
                        <div key={rdc} className="p-3 rounded-2xl bg-white/2 border border-site-border flex items-center justify-between">
                          <span className="text-[11px] font-medium">{rdc}</span>
                          <span className="text-[10px] font-bold text-emerald-400 uppercase">Operational</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "shipments" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
               <div className="flex items-center justify-between">
                <div className="flex bg-white/5 p-1 rounded-xl border border-site-border">
                  {["all", "shipped", "delivered", "pending_delivery", "cancelled"].map(seg => (
                    <button 
                      key={seg}
                      onClick={() => setActiveSegment(seg)}
                      className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${activeSegment === seg ? "bg-blue-600 text-white shadow-lg" : "text-site-text-subtle hover:text-white/60"}`}
                    >
                      {seg.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-site-card border border-site-border rounded-3xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-white/2 border-b border-site-border">
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-site-text-subtle">Order ID</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-site-text-subtle">Recipient</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-site-text-subtle">Destination</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-site-text-subtle">Total Value</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-site-text-subtle">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {filteredOrders.map(order => (
                      <tr key={order.id} className="hover:bg-white/2">
                        <td className="px-6 py-4 font-mono uppercase text-white/60">{order.id.slice(0, 12)}</td>
                        <td className="px-6 py-4 font-bold">{order.customer?.name || "N/A"}</td>
                        <td className="px-6 py-4 text-site-text-subtle">{order.customer?.district || "N/A"}</td>
                        <td className="px-6 py-4 font-bold text-blue-400">LKR {order.total.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                            order.status === "delivered" ? "bg-emerald-500/10 text-emerald-400" :
                            order.status === "shipped" ? "bg-blue-500/10 text-blue-400" : "bg-white/5 text-site-text-subtle"
                          }`}>
                            {order.status.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "rdcs" && (
            <div className="space-y-6 animate-in zoom-in-95 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {hubData.slice(0, 3).map(hub => (
                  <div key={hub.name} className="bg-site-card border border-site-border rounded-3xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold">{hub.name}</h3>
                        <p className="text-[10px] text-site-text-subtle tracking-tight">Main Distribution Terminal</p>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-500/20 shadow-brand-glow animate-pulse" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-white/3 rounded-2xl p-3 border border-site-border">
                        <p className="text-[10px] text-site-text-subtle font-bold uppercase mb-1">Incoming</p>
                        <p className="text-lg font-black text-blue-400">{hub.incoming}</p>
                      </div>
                      <div className="bg-white/3 rounded-2xl p-3 border border-site-border">
                        <p className="text-[10px] text-site-text-subtle font-bold uppercase mb-1">Outgoing</p>
                        <p className="text-lg font-black text-indigo-400">{hub.outgoing}</p>
                      </div>
                    </div>
                    <div className="bg-white/3 rounded-2xl p-3 border border-site-border">
                       <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] text-site-text-subtle uppercase font-bold">Storage Capacity</span>
                          <span className="text-[9px] text-white/60 font-bold">65%</span>
                       </div>
                       <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="w-[65%] h-full bg-blue-500" />
                       </div>
                    </div>
                    <button className="w-full py-2.5 rounded-xl border border-white/10 text-[10px] font-black uppercase hover:bg-white/10 transition-all tracking-wider text-white/60">
                      Manage Hub Operations
                    </button>
                  </div>
                ))}
              </div>

              {/* Hub Operations Bar Chart */}
              <div className="bg-site-card border border-site-border rounded-3xl p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="font-bold text-lg">Hub Traffic Analysis</h3>
                    <p className="text-xs text-site-text-subtle italic">Incoming vs Outgoing shipments per RDC</p>
                  </div>
                </div>
                <div className="h-72 w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hubData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis dataKey="name" stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "#0E1015", border: "1px solid #ffffff10", borderRadius: "12px", fontSize: "10px" }}
                        cursor={{ fill: "#ffffff05" }}
                      />
                      <Legend iconType="circle" />
                      <Bar dataKey="incoming" name="Incoming Shipments" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
                      <Bar dataKey="outgoing" name="Outgoing Shipments" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === "efficiency" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-linear-to-br from-[#0E1015] to-[#0A0C10] border border-site-border rounded-3xl p-8 flex flex-col items-center text-center">
                   <div className="w-24 h-24 rounded-full border-8 border-emerald-500/20 border-t-emerald-500 flex items-center justify-center mb-4 relative">
                      <span className="text-2xl font-black text-white">98%</span>
                      {/* Sub-label inside circle */}
                      <TrendingUp size={12} className="absolute -top-1 -right-1 text-emerald-400" />
                   </div>
                   <h3 className="text-sm font-bold uppercase tracking-widest text-site-text-subtle mb-2">Service Accuracy</h3>
                   <p className="text-[11px] text-white/20 italic">On-time delivery success rate</p>
                </div>

                <div className="bg-linear-to-br from-[#0E1015] to-[#0A0C10] border border-site-border rounded-3xl p-8 flex flex-col items-center text-center">
                   <div className="w-24 h-24 rounded-full border-8 border-blue-500/20 border-t-blue-500 flex items-center justify-center mb-4 relative">
                      <span className="text-2xl font-black text-white">2.4</span>
                      <Clock size={12} className="absolute -top-1 -right-1 text-blue-400" />
                   </div>
                   <h3 className="text-sm font-bold uppercase tracking-widest text-site-text-subtle mb-2">Avg Cycles</h3>
                   <p className="text-[11px] text-white/20 italic">Days from order to customer</p>
                </div>

                <div className="bg-linear-to-br from-[#0E1015] to-[#0A0C10] border border-site-border rounded-3xl p-8 flex flex-col items-center text-center">
                   <div className="w-24 h-24 rounded-full border-8 border-indigo-500/20 border-t-indigo-500 flex items-center justify-center mb-4 relative">
                      <span className="text-2xl font-black text-white">$0.85</span>
                      <Activity size={12} className="absolute -top-1 -right-1 text-indigo-400" />
                   </div>
                   <h3 className="text-sm font-bold uppercase tracking-widest text-site-text-subtle mb-2">Cost per Mile</h3>
                   <p className="text-[11px] text-white/20 italic">Global logistics efficiency index</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Performance Chart */}
                <div className="bg-site-card border border-site-border rounded-3xl p-8 lg:col-span-2">
                   <div className="flex items-center justify-between mb-8">
                      <div>
                         <h3 className="font-bold text-lg">Delivery Velocity</h3>
                         <p className="text-xs text-site-text-subtle italic">Network performance over the last 7 days</p>
                      </div>
                   </div>
                   
                   <div className="h-64 w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={velocityData}>
                          <defs>
                            <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorSucc" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                          <XAxis dataKey="date" stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#0E1015", border: "1px solid #ffffff10", borderRadius: "12px", fontSize: "10px" }}
                          />
                          <Legend iconType="circle" />
                          <Area type="monotone" dataKey="volume" name="Total Volume" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVol)" />
                          <Area type="monotone" dataKey="success" name="Successful Deliveries" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSucc)" />
                        </AreaChart>
                     </ResponsiveContainer>
                   </div>
                </div>

                {/* SLA Pie Chart */}
                <div className="bg-site-card border border-site-border rounded-3xl p-8">
                   <h3 className="font-bold text-lg mb-2">SLA Compliance</h3>
                   <p className="text-xs text-site-text-subtle italic mb-8">Delivery success vs exceptions</p>
                   
                   <div className="h-64 w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={slaData}
                            innerRadius={70}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            {slaData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={SLA_COLORS[index % SLA_COLORS.length]} />
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
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default LogisticsDashboard;
