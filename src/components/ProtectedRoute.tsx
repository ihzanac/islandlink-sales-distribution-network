import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAppSelector } from "../store/hooks";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { uid, role, isActive } = useAppSelector((state) => state.auth);
  const location = useLocation();

  // 1. Not logged in -> Redirect to login
  if (!uid) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Account de-activated or pending -> Redirect to login (App.tsx will handle the signout)
  if (isActive === false) {
    return <Navigate to="/login" replace />;
  }

  // 3. Role check
  if (allowedRoles) {
    // If user has no role or their role isn't in the allowed list
    if (!role || !allowedRoles.includes(role)) {
      // If user is logged in but has the wrong role, send them to their dedicated home
      if (role === 'retail-customer') return <Navigate to="/customer-history" replace />;
      if (role === 'rdc-staff') return <Navigate to="/delivery-boy" replace />;
      if (role === 'admin' || role === 'head-office') return <Navigate to="/dashboard" replace />;
      if (role === 'logistics') return <Navigate to="/logistics-dashboard" replace />;

      // Default fallback for authorized users with no specific role match
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
