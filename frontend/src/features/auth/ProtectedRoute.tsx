import { Navigate, Outlet } from "react-router-dom";
import { authClient } from "../../lib/auth-client";// adjust path

export default function ProtectedRoute() {

  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}