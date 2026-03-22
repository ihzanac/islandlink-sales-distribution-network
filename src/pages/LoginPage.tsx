import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setUser } from "../store/slices/authSlice";
import { Layers, Mail, Lock, ArrowRight, Store, Building2, UserCog, ShieldCheck } from "lucide-react";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const roles = [
  { value: "retail-customer", label: "Retail Customer", icon: Store },
  { value: "rdc-staff", label: "RDC Staff", icon: Building2 },
  // { value: "head-office", label: "Head Office Manager", icon: UserCog },
  { value: "admin", label: "Admin", icon: ShieldCheck },
];

const LoginPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { role: currentRole, uid } = useAppSelector((state) => state.auth);
  const [role, setRole] = useState("");
  const [errorString, setErrorString] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (uid && currentRole) {
      if (currentRole === 'retail-customer') navigate('/customer-history');
      else if (currentRole === 'rdc-staff') navigate('/delivery-boy');
      else navigate('/dashboard');
    }
  }, [uid, currentRole, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) {
      setErrorString("Please select a role to login as.");
      return;
    }
    setErrorString("");
    setLoading(true);

    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const docRef = doc(db, "users", userCred.user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        if (userData.role !== role && role !== "admin") {
          setErrorString("Role mismatch. You are registered as " + userData.role);
          setLoading(false);
          return;
        }

        dispatch(setUser({
          uid: userCred.user.uid,
          email: userCred.user.email,
          role: userData.role,
          name: userData.name,
          businessName: userData.businessName || null,
          district: userData.district || null,
          phone: userData.phone || null,
          province: userData.province || null
        }));

        if (userData.role === 'retail-customer') {
          navigate('/customer-history');
        } else if (userData.role === 'rdc-staff') {
          navigate('/delivery-boy');
        } else {
          navigate('/dashboard');
        }

      } else {
        setErrorString("User data not found in database.");
      }
    } catch (err: any) {
      setErrorString(err.message || "Failed to login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-site-bg text-white flex flex-col">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-brand-subtle blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-brand-subtle blur-3xl" />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-brand to-brand-dark flex items-center justify-center shadow-lg shadow-brand-glow">
            <Layers size={15} strokeWidth={2} className="text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-white font-bold text-[14px]">ISDN</span>
            <span className="text-[9px] text-white/35 uppercase tracking-wider">IslandLink Network</span>
          </div>
        </Link>
        <p className="text-xs text-white/40">
          No account?{" "}
          <Link to="/register" className="text-brand hover:underline font-medium">Register here</Link>
        </p>
      </nav>

      {/* Form */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-[420px]">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 border border-brand-border bg-brand-subtle px-3 py-1.5 rounded-full mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-brand" />
              <span className="text-[11px] font-medium text-white/70 uppercase tracking-wider">ISDN Portal Login</span>
            </div>
            <h1 className="text-3xl font-extrabold mb-2">Welcome back</h1>
            <p className="text-white/45 text-sm leading-relaxed">
              Sign in to access your role-based ISDN dashboard.
            </p>
          </div>

          <div className="bg-dark-card border border-dark-border rounded-3xl p-8 shadow-2xl shadow-black/30">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Email */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="email" className="text-white/75 text-xs font-semibold uppercase tracking-wider">Email Address</Label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="name@islandlink.com"
                    className="bg-site-bg border-white/8 text-white placeholder:text-white/20 h-11 pl-9 focus-visible:border-brand focus-visible:ring-brand/20"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="password" className="text-white/75 text-xs font-semibold uppercase tracking-wider">Password</Label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    placeholder="••••••••"
                    className="bg-site-bg border-white/8 text-white placeholder:text-white/20 h-11 pl-9 focus-visible:border-brand focus-visible:ring-brand/20"
                  />
                </div>
              </div>

              {/* Role */}
              <div className="flex flex-col gap-2">
                <Label className="text-white/75 text-xs font-semibold uppercase tracking-wider">Login As</Label>
                <Select value={role} onValueChange={(val) => setRole(val ?? "")}>
                  <SelectTrigger className="w-full h-11 bg-site-bg border-white/8 text-white data-placeholder:text-white/30">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent className="bg-dark-card border-dark-border text-white z-200">
                    {roles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <span className="flex items-center gap-2">
                          <r.icon size={14} className="text-brand" />
                          {r.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Remember / Forgot */}
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-white/50 cursor-pointer">
                  <input type="checkbox" className="accent-brand w-3.5 h-3.5" />
                  Remember me
                </label>
                <button type="button" className="text-brand hover:text-brand-dark hover:underline font-medium transition-colors">
                  Forgot Password?
                </button>
              </div>

              {errorString && (
                <div className="p-3 rounded bg-red-500/10 border border-red-500/50 text-red-500 text-xs text-center">
                  {errorString}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="group flex items-center justify-center gap-2 bg-brand text-brand-on h-11 rounded-xl text-sm font-bold shadow-lg shadow-brand-glow hover:bg-brand-dark hover:-translate-y-0.5 hover:shadow-brand transition-all duration-300 mt-1 disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign In to Dashboard"}
                {!loading && <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-white/25 mt-6 leading-5">
            Having trouble logging in? Contact{" "}
            <a href="mailto:support@islandlink.com" className="text-brand hover:underline">support@islandlink.com</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
