import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ShoppingCart,
  X,
  Send,
  ChevronRight,
  Search,
  Loader2,
  Package,
} from "lucide-react";
import { useAppSelector } from "../store/hooks";
import { toast } from "react-toastify";
import { collection, addDoc, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { useNavigate } from "react-router-dom";

export interface Product {
  id: string | number;
  name: string;
  sku: string;
  category: string;
  image: string;
  price: string;
  unit: string;
  badge?: string;
  stock?: number;
}

interface OrderItem extends Product {
  qty: number;
}

interface Props {
  title: string;
  subtitle: string;
  description: string;
  accentColor: string; // e.g. "violet"
  accentHex: string; // e.g. "#8B5CF6"
  products: Product[];
  heroImage: string;
  backPath?: string;
}

const ACCENT_CLASSES: Record<
  string,
  {
    text: string;
    bg: string;
    border: string;
    badge: string;
    btn: string;
    shadow: string;
  }
> = {
  violet: {
    text: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/25",
    badge: "bg-violet-500/20 text-violet-300",
    btn: "bg-violet-600 hover:bg-violet-500",
    shadow: "shadow-violet-500/20",
  },
  pink: {
    text: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/25",
    badge: "bg-pink-500/20 text-pink-300",
    btn: "bg-pink-600 hover:bg-pink-500",
    shadow: "shadow-pink-500/20",
  },
  orange: {
    text: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/25",
    badge: "bg-orange-500/20 text-orange-300",
    btn: "bg-orange-600 hover:bg-orange-500",
    shadow: "shadow-orange-500/20",
  },
  blue: {
    text: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/25",
    badge: "bg-blue-500/20 text-blue-300",
    btn: "bg-blue-600 hover:bg-blue-500",
    shadow: "shadow-blue-500/20",
  },
};

export default function CategoryPageLayout({
  title,
  subtitle,
  description,
  accentColor,
  products,
  heroImage,
  backPath = "/",
}: Props) {
  const ac = ACCENT_CLASSES[accentColor] ?? ACCENT_CLASSES.violet;
  const auth = useAppSelector((state) => state.auth);
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orderOpen, setOrderOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
  });
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [sent, setSent] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [localProducts, setLocalProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch dynamic products from Firestore
  useEffect(() => {
    const productsRef = collection(db, "products");
    const q = query(productsRef, where("category", "==", title));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Product[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      
      // If we have dynamic products, use them, otherwise fallback to static prop
      if (fetched.length > 0) {
        setLocalProducts(fetched);
      } else {
        setLocalProducts(products);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching products:", error);
      setLocalProducts(products); // fallback
      setLoading(false);
    });

    return () => unsubscribe();
  }, [title, products]);

  useEffect(() => {
    if (auth.name || auth.phone || auth.email || auth.businessName) {
      setForm((prev) => ({
        ...prev,
        name: auth.businessName || auth.name || prev.name,
        phone: auth.phone || prev.phone,
        email: auth.email || prev.email,
      }));
    }
  }, [auth.name, auth.phone, auth.email, auth.businessName]);

  const categories = [
    "All",
    ...Array.from(new Set(localProducts.map((p) => p.category))),
  ];

  const filtered = localProducts.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchCat =
      selectedCategory === "All" || p.category === selectedCategory;
    return matchSearch && matchCat;
  });

  function addToCart(p: Product) {
    if (!auth.uid) {
      toast.error("First login or register to add items.");
      return;
    }
    const currentStock = p.stock ?? 20;
    setCart((prev) => {
      const existing = prev.find((i) => i.id === p.id);
      if (existing) {
        if (existing.qty + 1 > currentStock) {
          toast.warning(`Cannot add more. Only ${currentStock} in stock.`);
          return prev;
        }
        return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { ...p, qty: 1 }];
    });
  }

  function removeFromCart(id: string | number) {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }

  function updateQty(id: string | number, qty: number) {
    if (qty < 1) return removeFromCart(id);
    setCart((prev) =>
      prev.map((i) => {
        if (i.id === id) {
          const currentStock = i.stock ?? 20;
          if (qty > currentStock) {
            toast.warning(`Only ${currentStock} available in stock.`);
            return i;
          }
          return { ...i, qty };
        }
        return i;
      })
    );
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!auth.uid) return;
    try {
      const orderData = {
        customerId: auth.uid,
        customerName: form.name,
        customerPhone: form.phone,
        customerEmail: form.email,
        customerBusiness: auth.businessName || null,
        notes: form.notes,
        items: cart,
        subTotal,
        paymentMethod,
        status: paymentMethod === "cash" ? "pending_delivery" : "pending_payment",
        createdAt: new Date().toISOString(),
        deliveryLat: auth.lat || null,
        deliveryLng: auth.lng || null
      };

      const docRef = await addDoc(collection(db, "orders"), orderData);

      if (paymentMethod === "card") {
        setOrderOpen(false);
        navigate(`/payment?orderId=${docRef.id}&amount=${subTotal}`);
      } else {
        setSent(true);
        setTimeout(() => {
          setSent(false);
          setShowForm(false);
          setOrderOpen(false);
          setCart([]);
          setForm({ name: "", phone: "", email: "", notes: "" });
        }, 2800);
      }
    } catch (err) {
      toast.error("Failed to place order. Try again.");
    }
  }

  function parsePrice(priceStr: string): number {
    const numericStr = priceStr.replace(/[^0-9.]/g, "");
    const val = parseFloat(numericStr);
    return isNaN(val) ? 0 : val;
  }

  const totalItems = cart.reduce((s, i) => s + i.qty, 0);
  const totalPrice = cart.reduce((s, i) => s + parsePrice(i.price) * i.qty, 0);
  const subTotal = totalPrice;

  return (
    <div className="min-h-screen bg-[#08080C] font-sans">
      {/* ── HERO BANNER ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden h-72 md:h-80">
        <img
          src={heroImage}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#08080C]/60 to-[#08080C]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#08080C]/80 via-transparent to-transparent" />

        {/* Nav */}
        <div className="relative z-10 flex items-center justify-between px-6 md:px-14 pt-6">
          <Link
            to={backPath}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium group"
          >
            <ArrowLeft
              size={16}
              className="group-hover:-translate-x-1 transition-transform"
            />
            Back to Home
          </Link>

          {/* Floating cart pill */}
          <button
            id="open-order-btn"
            onClick={() => {
              if (!auth.uid) {
                toast.error("First login or register to view your order enquiry.");
                return;
              }
              setShowForm(false);
              setOrderOpen(true);
            }}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-full ${ac.btn} text-white text-sm font-semibold shadow-lg ${ac.shadow} transition-all duration-300 hover:-translate-y-0.5`}
          >
            <ShoppingCart size={16} />
            Order Enquiry
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white text-[#08080C] text-[10px] font-black flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </button>
        </div>

        {/* Title */}
        <div className="relative z-10 px-6 md:px-14 pt-8">
          <p
            className={`text-xs font-bold uppercase tracking-widest ${ac.text} mb-2`}
          >
            {subtitle}
          </p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
            {title}
          </h1>
          <p className="text-white/45 text-sm md:text-base mt-3 max-w-xl leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      {/* ── FILTERS ─────────────────────────────────────────────── */}
      <div className="px-6 md:px-14 py-8">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
            />
            <input
              id="product-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products or SKU…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/25 transition-colors"
            />
          </div>

          {/* Category pills */}
          <div className="flex gap-2 flex-wrap">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${selectedCategory === c
                  ? `${ac.btn} text-white shadow-sm`
                  : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                  }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <p className="text-white/30 text-xs mt-4">
          {filtered.length} product{filtered.length !== 1 ? "s" : ""} found
        </p>
      </div>

      {/* ── PRODUCT GRID ────────────────────────────────────────── */}
      <div className="px-6 md:px-14 pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <Loader2 className={`w-12 h-12 ${ac.text} animate-spin`} />
            <p className="text-white/40 font-medium animate-pulse">Loading catalogue...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-white/30 text-sm italic bg-white/2 rounded-3xl border border-dashed border-white/10">
            <Package size={32} className="mx-auto mb-4 opacity-20" />
            No products match your selection.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((p) => {
              const inCart = cart.find((i) => i.id === p.id);
              return (
                <div
                  key={p.id}
                  className={`group relative flex flex-col rounded-2xl border ${ac.border} bg-[#0E1015] overflow-hidden hover:-translate-y-1 hover:shadow-xl ${ac.shadow} transition-all duration-300`}
                >
                  {/* Badge */}
                  {p.badge && (
                    <span
                      className={`absolute top-2 left-2 z-10 text-[10px] font-bold px-2 py-0.5 rounded-full ${ac.badge}`}
                    >
                      {p.badge}
                    </span>
                  )}

                  {/* Image */}
                  <div className="w-full aspect-square bg-white/5 overflow-hidden">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>

                  {/* Info */}
                  <div className="p-3 flex flex-col flex-1">
                    <p className="text-white/35 text-[10px] font-mono mb-1">
                      {p.sku}
                    </p>
                    <h3 className="text-white text-sm font-semibold leading-snug mb-1 line-clamp-2">
                      {p.name}
                    </h3>
                    <p className={`text-xs ${ac.text} font-bold mb-3`}>
                      {p.price}{" "}
                      <span className="text-white/30 font-normal">
                        / {p.unit}
                      </span>
                      <span className="ml-1.5 text-white/40 font-medium">
                        ({Math.max(0, (p.stock ?? 20) - (inCart?.qty ?? 0))} available)
                      </span>
                    </p>

                    <button
                      id={`add-to-cart-${p.id}`}
                      onClick={() => addToCart(p)}
                      className={`mt-auto w-full py-2 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-all duration-200 ${inCart
                        ? "bg-white/10 border border-white/15"
                        : `${ac.btn}`
                        }`}
                    >
                      {inCart ? (
                        <>
                          <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                            {inCart.qty}
                          </span>
                          Added
                        </>
                      ) : (
                        <>
                          <ShoppingCart size={12} />
                          Add to Enquiry
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ORDER MODAL ─────────────────────────────────────────── */}
      {orderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOrderOpen(false)}
          />

          <div className="relative z-10 w-full max-w-lg bg-[#0E1015] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
              <div>
                <h2 className="text-white font-bold text-lg">Order Enquiry</h2>
                <p className="text-white/40 text-xs mt-0.5">
                  We'll contact you within 24 hours
                </p>
              </div>
              <button
                onClick={() => setOrderOpen(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {sent ? (
                <div className="text-center py-10">
                  <div
                    className={`w-16 h-16 rounded-full ${ac.bg} border ${ac.border} flex items-center justify-center mx-auto mb-4`}
                  >
                    <Send size={28} className={ac.text} />
                  </div>
                  <p className="text-white font-bold text-lg mb-1">
                    Enquiry Sent!
                  </p>
                  <p className="text-white/40 text-sm">
                    Our sales team will reach you shortly.
                  </p>
                </div>
              ) : showForm ? (
                <form
                  onSubmit={handleSend}
                  id="order-enquiry-form"
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">
                      Your Contact Details
                    </p>
                    <button type="button" onClick={() => setShowForm(false)} className="text-xs text-white/40 hover:text-white flex items-center gap-1 transition-colors">
                      <ArrowLeft size={12} /> Back
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white/40 text-xs mb-1 block">
                        Full Name *
                      </label>
                      <input
                        id="order-name"
                        required
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                        placeholder="John Silva"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-white/40 text-xs mb-1 block">
                        Phone *
                      </label>
                      <input
                        id="order-phone"
                        required
                        value={form.phone}
                        onChange={(e) =>
                          setForm({ ...form, phone: e.target.value })
                        }
                        placeholder="+94 77 000 0000"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-white/40 text-xs mb-1 block">
                      Email
                    </label>
                    <input
                      id="order-email"
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      placeholder="you@example.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-colors"
                    />
                  </div>


                  {/* Payment Method Selection */}
                  <div>
                    <label className="text-white/40 text-xs mb-2 block uppercase tracking-wider font-semibold">
                      Payment Method
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label
                        className={`cursor-pointer flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${paymentMethod === "cash"
                          ? "bg-white/10 border-white/30 text-white"
                          : "bg-white/5 border-white/5 text-white/50 hover:bg-white/10"
                          }`}
                      >
                        <input
                          type="radio"
                          name="payment"
                          value="cash"
                          checked={paymentMethod === "cash"}
                          onChange={() => setPaymentMethod("cash")}
                          className="accent-brand"
                        />
                        <span className="text-sm font-medium">Cash on Delivery</span>
                      </label>
                      <label
                        className={`cursor-pointer flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${paymentMethod === "card"
                          ? "bg-white/10 border-white/30 text-white"
                          : "bg-white/5 border-white/5 text-white/50 hover:bg-white/10"
                          }`}
                      >
                        <input
                          type="radio"
                          name="payment"
                          value="card"
                          checked={paymentMethod === "card"}
                          onChange={() => setPaymentMethod("card")}
                          className="accent-brand"
                        />
                        <span className="text-sm font-medium">Card / PayPal</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-white/40 text-xs mb-1 block">
                      Additional Notes
                    </label>
                    <textarea
                      id="order-notes"
                      rows={2}
                      value={form.notes}
                      onChange={(e) =>
                        setForm({ ...form, notes: e.target.value })
                      }
                      placeholder="Special instructions, quantity preferences, etc."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-colors resize-none"
                    />
                  </div>

                  <button
                    id="submit-order-btn"
                    type="submit"
                    disabled={cart.length === 0}
                    className={`w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 ${cart.length === 0
                      ? "opacity-40 cursor-not-allowed bg-white/10"
                      : `${ac.btn} shadow-lg ${ac.shadow} hover:-translate-y-0.5`
                      }`}
                  >
                    <Send size={15} />
                    {paymentMethod === "card" ? "Proceed to PayPal" : "Send Enquiry"}
                  </button>
                </form>
              ) : (
                <>
                  {cart.length === 0 ? (
                    <div className="text-center py-10 text-white/30 text-sm">
                      <ShoppingCart size={32} className="mx-auto mb-3 opacity-30" />
                      No products added yet.
                      <br />
                      <span className="text-xs">
                        Go back and click "Add to Enquiry" on products.
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">
                        Selected Products
                      </p>
                      {cart.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 bg-white/4 rounded-xl p-3 border border-white/7"
                        >
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-12 h-12 rounded-lg object-cover bg-white/10 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">
                              {item.name}
                            </p>
                            <p className={`text-xs ${ac.text}`}>
                              {item.price} / {item.unit}
                            </p>
                            <p className="text-xs text-white/50 mt-0.5">
                              Subtotal: Rs. {(item.qty * parsePrice(item.price)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => updateQty(item.id, item.qty - 1)}
                              className="w-6 h-6 rounded-full bg-white/10 text-white text-sm flex items-center justify-center hover:bg-white/20 transition-colors"
                            >
                              −
                            </button>
                            <span className="text-white text-sm w-5 text-center font-semibold">
                              {item.qty}
                            </span>
                            <button
                              onClick={() => updateQty(item.id, item.qty + 1)}
                              className="w-6 h-6 rounded-full bg-white/10 text-white text-sm flex items-center justify-center hover:bg-white/20 transition-colors"
                            >
                              +
                            </button>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="ml-1 text-white/30 hover:text-red-400 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {cart.length > 0 && <div className="border-t border-white/8" />}

                  {cart.length > 0 && (
                    <div className="space-y-4 pt-2">
                      <div className="flex justify-between items-center text-white bg-white/5 p-4 rounded-xl border border-white/10">
                        <span className="font-semibold text-sm">Estimated Total:</span>
                        <span className={`font-bold text-lg ${ac.text}`}>
                          Rs. {totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <button
                        onClick={() => setShowForm(true)}
                        className={`w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 shadow-lg ${ac.shadow} hover:-translate-y-0.5 ${ac.btn}`}
                      >
                        Continue <ChevronRight size={15} />
                      </button>
                      <div className="pt-4 border-t border-white/8 border-dashed">
                        <p className="text-white/40 text-xs mb-3 text-center">Want to add more? Browse other categories:</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
