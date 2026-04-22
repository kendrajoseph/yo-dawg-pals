import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const ProtectedRoute = ({ children, requireSitter = false }: { children: ReactNode; requireSitter?: boolean }) => {
  const { user, loading, isSitter, isAnneke } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="font-tag text-2xl text-clay">loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  if (requireSitter && (!isSitter || !isAnneke)) return <Navigate to="/account" replace />;
  return <>{children}</>;
};

export default ProtectedRoute;
