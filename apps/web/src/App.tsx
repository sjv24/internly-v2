import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Spinner } from "./components/States";
import Home from "./pages/Home";
import Listings from "./pages/Listings";
import Login from "./pages/Login";

// Code splitting: these pages are only downloaded when somebody actually visits them,
// so the first load (home / listings / login) stays small and fast.
const ListingDetail = lazy(() => import("./pages/ListingDetail"));
const Signup = lazy(() => import("./pages/Signup"));
const Account = lazy(() => import("./pages/Account"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MyApplications = lazy(() => import("./pages/student/MyApplications"));
const AiMatch = lazy(() => import("./pages/student/AiMatch"));
const MyListings = lazy(() => import("./pages/company/MyListings"));
const ListingEditor = lazy(() => import("./pages/company/ListingEditor"));
const Applicants = lazy(() => import("./pages/company/Applicants"));

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<Layout />}>
          {/* public */}
          <Route index element={<Home />} />
          <Route path="listings" element={<Listings />} />
          <Route path="listings/:id" element={<ListingDetail />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />

          {/* any logged-in user */}
          <Route element={<ProtectedRoute />}>
            <Route path="account" element={<Account />} />
          </Route>

          {/* students only */}
          <Route path="student" element={<ProtectedRoute role="student" />}>
            <Route path="applications" element={<MyApplications />} />
            <Route path="ai-match" element={<AiMatch />} />
          </Route>

          {/* companies only */}
          <Route path="company" element={<ProtectedRoute role="company" />}>
            <Route path="listings" element={<MyListings />} />
            <Route path="listings/new" element={<ListingEditor />} />
            <Route path="listings/:id/edit" element={<ListingEditor />} />
            <Route path="applicants" element={<Applicants />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
