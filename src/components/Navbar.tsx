import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, Layers, LogOut } from "lucide-react";
import { useAppSelector } from "../store/hooks";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth);

  const handleLogout = async () => {
    await signOut(auth);
    setMobileOpen(false);
    navigate("/login");
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Home", href: "#" },
    { label: "About", href: "#about" },
    { label: "Categories", href: "#categories" },
    { label: "Features", href: "#features" },
    { label: "Contact", href: "#contact" },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${scrolled
          ? "bg-site-bg/95 backdrop-blur-xl border-b border-site-border shadow-2xl shadow-black/30"
          : "bg-transparent"
          }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 md:px-10 lg:px-16 py-4">
          {/* Logo */}
          <a href="#" className="flex items-center gap-3 group">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-linear-to-br from-brand to-brand-dark shadow-lg shadow-brand-glow group-hover:shadow-brand transition-shadow duration-300">
              <Layers size={17} strokeWidth={2} className="text-site-text" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-site-text font-bold text-[15px] tracking-wide">
                ISDN
              </span>
              <span className="text-[10px] text-site-text/40 font-medium tracking-wider uppercase">
                IslandLink Network
              </span>
            </div>
          </a>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="relative px-4 py-2 text-sm text-site-text/60 hover:text-site-text font-medium transition-colors duration-200 group"
              >
                {link.label}
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-px bg-brand group-hover:w-4 transition-all duration-300 rounded-full" />
              </a>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            {user.uid ? (
              <div className="flex items-center gap-4">
                <Link
                  to={user.role === 'retail-customer' ? "/customer-history" : user.role === 'rdc-staff' ? "/delivery-boy" : "/dashboard"}
                  className="text-sm text-site-text/80 hover:text-site-text font-medium transition-colors duration-200"
                >
                  Dashboard
                </Link>
                <div className="w-9 h-9 flex items-center justify-center rounded-full bg-brand text-brand-on font-bold uppercase shadow-md shadow-brand-glow">
                  {(user.name && user.name[0]) || (user.email && user.email[0]) || "U"}
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 bg-white/5 hover:bg-red-500/10 text-site-text/70 hover:text-red-400 border border-white/10 hover:border-red-500/30 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                  title="Logout"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="bg-brand text-brand-on px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-dark transition-all duration-200 shadow-lg shadow-brand-glow hover:shadow-brand hover:-translate-y-0.5"             >
                  Sign In
                </Link>
              </>
            )}
          </div>

          {/* Hamburger */}
          <button
            id="mobile-menu-toggle"
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 rounded-lg hover:bg-white/5 transition text-site-text/70 hover:text-site-text"
          >
            <Menu size={22} />
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      <div
        className={`md:hidden fixed inset-0 z-100 transition-all duration-400 ${mobileOpen
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
          }`}
      >
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={`absolute right-0 top-0 h-full w-72 bg-[#0d1117] border-l border-white/10 flex flex-col pt-20 px-6 pb-10 gap-2 transition-transform duration-400 ${mobileOpen ? "translate-x-0" : "translate-x-full"
            }`}
        >
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-5 right-5 text-site-text/50 hover:text-site-text w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition"
          >
            <X size={18} />
          </button>

          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-linear-to-br from-brand to-brand-dark flex items-center justify-center">
                <Layers size={14} strokeWidth={2} className="text-white" />
              </div>
              <span className="text-site-text font-bold">ISDN</span>
            </div>
          </div>

          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="text-site-text/70 hover:text-site-text text-base font-medium py-3 border-b border-white/5 hover:border-brand/30 transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}

          <div className="mt-6 flex flex-col gap-3">
            {user.uid ? (
              <>
                <Link
                  to={user.role === 'retail-customer' ? "/customer-history" : user.role === 'rdc-staff' ? "/delivery-boy" : "/dashboard"}
                  onClick={() => setMobileOpen(false)}
                  className="text-center py-3 rounded-xl bg-brand/20 border border-brand/50 text-site-text hover:bg-brand/30 text-sm font-medium transition"
                >
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 text-site-text/70 hover:text-red-400 hover:border-red-500/30 text-sm font-medium transition"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="text-center py-3 rounded-xl border border-white/10 text-site-text/70 hover:text-site-text hover:border-white/20 text-sm font-medium transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileOpen(false)}
                  className="text-center py-3 rounded-xl bg-brand text-brand-on text-sm font-semibold hover:bg-brand-dark transition"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
