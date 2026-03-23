import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase/config";
import { useAppDispatch } from "./store/hooks";
import { setUser, clearUser } from "./store/slices/authSlice";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useTheme } from "./context/ThemeContext";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Categories from "./components/Categories";
import Features from "./components/Features";
import Testimonials from "./components/Testimonials";
import Footer from "./components/Footer";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

import PersonalCare from "./screen/PersonalCare";
import Cleaning from "./screen/Cleaning";
import PackagedFoods from "./screen/PackagedFoods";
import Beverages from "./screen/Beverages";
import CustomerHistory from "./screen/users/CustomerHistory";
import DeliveryBoy from "./screen/users/DeliveryBoy";
import PaymentPage from "./pages/PaymentPage";
import AdminDashboard from "./pages/AdminDashboard";
import DeliveryTracking from "./pages/DeliveryTracking";
import ProtectedRoute from "./components/ProtectedRoute";
import LogisticsDashboard from "./pages/LogisticsDashboard";

function LandingLayout() {
  return (
    <main className="min-h-screen bg-site-bg flex flex-col font-sans">
      <Navbar />
      <Hero />
      <Categories />
      <Features />
      <Testimonials />
      <Footer />
    </main>
  );
}

function App() {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const userData = docSnap.data();
            
            // ── Account Status Check ─────────────────────────────────────────────
            if (userData.isActive === false) {
              await auth.signOut();
              dispatch(clearUser());
              return;
            }

            dispatch(setUser({
              uid: user.uid,
              email: user.email,
              role: userData.role || null,
              name: userData.name || null,
              businessName: userData.businessName || null,
              district: userData.district || null,
              phone: userData.phone || null,
              province: userData.province || null,
              lat: userData.lat || null,
              lng: userData.lng || null,
              isActive: userData.isActive,
              status: userData.status
            }));
          } else {
            dispatch(setUser({
              uid: user.uid,
              email: user.email,
              role: null,
              name: null,
              isActive: true // Not found in users might be a new login?
            }));
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        dispatch(clearUser());
      }
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, [dispatch]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-site-bg flex items-center justify-center text-white">
        <div className="w-8 h-8 rounded-full border-4 border-brand border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <ToastContainer position="top-right" autoClose={3000} theme={theme} />
      <Routes>
        <Route path="/" element={<LandingLayout />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* Protected Routes */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute allowedRoles={["admin", "head-office"]}>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/delivery-tracking" 
          element={
            <ProtectedRoute allowedRoles={["admin", "head-office", "logistics", "rdc-staff"]}>
              <DeliveryTracking />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/customer-history" 
          element={
            <ProtectedRoute allowedRoles={["retail-customer"]}>
              <CustomerHistory />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/delivery-boy" 
          element={
            <ProtectedRoute allowedRoles={["rdc-staff"]}>
              <DeliveryBoy />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/payment" 
          element={
            <ProtectedRoute allowedRoles={["retail-customer"]}>
              <PaymentPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/logistics-dashboard" 
          element={
            <ProtectedRoute allowedRoles={["logistics"]}>
              <LogisticsDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Public Screens */}
        <Route path="/personal-care" element={<PersonalCare />} />
        <Route path="/cleaning" element={<Cleaning />} />
        <Route path="/packaged-food" element={<PackagedFoods />} />
        <Route path="/beverages" element={<Beverages />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
