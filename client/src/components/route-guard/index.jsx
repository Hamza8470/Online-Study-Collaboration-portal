import { Navigate, useLocation } from "react-router-dom";
import { Fragment } from "react";

function RouteGuard({ authenticated, user, element }) {
  const location = useLocation();

  console.log(authenticated, user, "useruser");

  // Redirect unauthenticated users to auth page (except if already on auth page)
  if (!authenticated && !location.pathname.includes("/auth")) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect authenticated non-instructors away from instructor routes and auth page
  if (
    authenticated &&
    user?.role !== "instructor" &&
    (location.pathname.includes("instructor") ||
      location.pathname.includes("/auth"))
  ) {
    return <Navigate to="/home" replace />;
  }

  // Redirect authenticated instructors to instructor dashboard if on student routes
  if (
    authenticated &&
    user?.role === "instructor" &&
    !location.pathname.includes("instructor") &&
    location.pathname.includes("/auth")
  ) {
    return <Navigate to="/instructor" replace />;
  }

  return <Fragment>{element}</Fragment>;
}

export default RouteGuard;
