import { Link } from "react-router-dom";
import {
  ArrowRight,
  UserPlus,
  Mouse,
  Store,
  Warehouse,
  Truck,
  Package,
} from "lucide-react";
import { useAppSelector } from "../store/hooks";

const stats = [
  { value: "5,000+", label: "Active Retail Partners", icon: Store },
  { value: "5 RDCs", label: "Regional Distribution Centres", icon: Warehouse },
  { value: "24–48h", label: "Island-Wide Delivery", icon: Truck },
  { value: "4 Categories", label: "FMCG Product Lines", icon: Package },
];

const Hero = () => {

  // Get the entire auth state
  const auth = useAppSelector((state) => state.auth);


  return (
    <section
      id="home"
      className="relative min-h-screen bg-site-bg text-white flex flex-col items-center overflow-hidden"
    >
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] rounded-full bg-brand-subtle blur-3xl" />
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-subtle blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-brand-subtle blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center pt-36 pb-24 px-6 max-w-6xl mx-auto w-full">
        {/* Badge */}
        <div className="inline-flex items-center gap-2.5 border border-brand-border bg-brand-subtle backdrop-blur px-4 py-2 rounded-full mb-8">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-brand opacity-60 animate-ping" />
            <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
          </span>
          <span className="text-xs font-medium text-white/80 tracking-wide">
            Island-Wide FMCG Distribution Platform
          </span>
          <span className="text-[10px] border border-brand-border text-brand px-2 py-0.5 rounded-full font-semibold">
            v2.0
          </span>
        </div>

        {/* Heading */}
        <h1 className="text-5xl md:text-[68px]/[80px] font-extrabold tracking-tight max-w-4xl mb-6">
          <span className="text-white">Smarter Ordering.</span>
          <br className="hidden md:block" />
          <span className="text-white">Faster Delivery.</span>
          <br className="hidden md:block" />
          <span className="relative inline-block px-4 py-1 rounded-2xl bg-linear-to-r from-brand/60 to-brand-dark/80 text-white">
            Better Distribution.
          </span>
        </h1>

        {/* Subtext */}
        <p className="text-base md:text-lg text-white/50 max-w-2xl leading-relaxed mb-10">
          IslandLink Sales Distribution Network (ISDN) connects retailers,
          regional distribution centres, and Head Office through one modern
          digital platform — from ordering to delivery, invoicing to reporting.
        </p>

        {/* CTAs — navigate to dedicated pages */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-20">
          {auth.uid ? (
            <Link
              to={auth.role === 'retail-customer' ? "/customer-history" : auth.role === 'rdc-staff' ? "/delivery-boy" : "/dashboard"}
              className="group flex items-center gap-2 bg-brand text-brand-on px-7 py-3.5 rounded-xl text-sm font-bold shadow-lg shadow-brand-glow hover:shadow-brand hover:bg-brand-dark hover:-translate-y-0.5 transition-all duration-300"
            >
              {auth.role === 'retail-customer' ? "Go to Order History" : auth.role === 'rdc-staff' ? "Go to Deliveries" : "Go to Dashboard"}
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                id="hero-register-btn"
                className="group flex items-center gap-2 border border-white/10 hover:border-brand-border bg-white/5 hover:bg-brand-subtle text-white px-7 py-3.5 rounded-xl text-sm font-semibold transition-all duration-300"
              >
                Register Account
                <UserPlus size={16} className="text-white/40 group-hover:text-brand transition" />
              </Link>
            </>
          )}
        </div>

        {/* Platform at a Glance divider */}
        <div className="flex items-center gap-4 w-full max-w-3xl mb-10">
          <div className="flex-1 h-px bg-linear-to-r from-transparent to-white/10" />
          <span className="text-xs text-white/25 font-medium uppercase tracking-widest whitespace-nowrap">
            Platform at a Glance
          </span>
          <div className="flex-1 h-px bg-linear-to-l from-transparent to-white/10" />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="group bg-white/3 hover:bg-white/6 border border-white/8 hover:border-brand-border rounded-2xl p-5 text-center transition-all duration-300 cursor-default"
            >
              <div className="flex justify-center mb-3">
                <stat.icon
                  size={26}
                  className="text-white group-hover:scale-110 transition-transform duration-300"
                />
              </div>
              <div className="text-2xl font-extrabold text-brand mb-1">{stat.value}</div>
              <div className="text-[11px] text-white/40 leading-snug font-medium">{stat.label}</div>
            </div>
          ))}
        </div>



        {/* Scroll indicator */}
        <div className="flex flex-col items-center gap-2 mt-16 animate-bounce cursor-pointer opacity-40 hover:opacity-70 transition-opacity">
          <Mouse size={22} className="text-white/60" />
          <p className="text-[11px] text-white/40 font-medium tracking-widest uppercase">Scroll</p>
        </div>
      </div>
    </section>
  );
};

export default Hero;