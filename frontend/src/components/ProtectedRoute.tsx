import { Navigate } from "react-router-dom";
import { useAuth, roleHomePath, type Role } from "../lib/auth";

export function ProtectedRoute({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={roleHomePath(user.role)} replace />;

  return <>{children}</>;
}
