import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import ScrollToTop from "./components/ScrollToTop";
import ProfileSetupRedirect from "./components/ProfileSetupRedirect";
import RequireAuth from "./components/RequireAuth";
import RequireAdminAccess from "./components/RequireAdminAccess";

import Home from "./pages/Home";
import Live from "./pages/Live";
import Creators from "./pages/creator/Creators";
import CreatorProfile from "./pages/creator/CreatorProfile";
import Market from "./pages/Market";
import Listing from "./pages/listings/Listing";
import NotFound from "./pages/NotFound";
import About from "./pages/About";
import SignIn from "./pages/SignIn";
import ProfileSettings from "./pages/ProfileSettings";
import ApplyCreator from "./pages/creator/ApplyCreator";
import AdminCreatorApplications from "./pages/admin/AdminCreatorApplications";
import RequireCreatorAccess from './components/RequireCreatorAccess';
import CreatorDashboard from './pages/creator/CreatorDashboard';
import Legal from './pages/legal/Legal';
import Terms from './pages/legal/Terms';
import Privacy from './pages/legal/Privacy';
import CreatorTerms from './pages/legal/CreatorTerms';
import CreateListing from './pages/listings/CreateListing';
import CreatorListings from './pages/listings/CreatorListings';
import EditListing from './pages/listings/EditListing';
import CreatorListingDetails from './pages/listings/CreatorListingDetails';
import CreatorListingRevisions from './pages/listings/CreatorListingRevisions';
import AdminListingRevisions from './pages/admin/AdminListingRevisions';
import AdminListings from './pages/admin/AdminListings';
import AdminDashboard from './pages/admin/AdminDashboard';
import RequestListing from './pages/listings/RequestListing';
import CreatorRequestDetails from './pages/creator/CreatorRequestDetails';
import CreatorRequests from './pages/creator/CreatorRequests';

const App = () => {
  return (
    <>
      <ScrollToTop />
      <ProfileSetupRedirect />

      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/about" element={<About />} />
          <Route path="/live" element={<Live />} />
          <Route path="/market" element={<Market />} />
          <Route path="/creators" element={<Creators />} />
          <Route path="/listing/:id" element={<Listing />} />
          <Route path="/creator/:handle" element={<CreatorProfile />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms/creator" element={<CreatorTerms />} />

          <Route element={<RequireAuth />}>
            <Route path="/settings/profile" element={<ProfileSettings />} />
            <Route path="/apply/creator" element={<ApplyCreator />} />
            <Route path="/listing/:id/request" element={<RequestListing />} />
          </Route>

          <Route element={<RequireAdminAccess />}>
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route
              path="/admin/creator-applications"
              element={<AdminCreatorApplications />}
            />
            <Route path="/admin/listings" element={<AdminListings />} />
            <Route
              path="/admin/listing-revisions/:id"
              element={<AdminListingRevisions />}
            />
          </Route>

          <Route element={<RequireCreatorAccess />}>
            <Route path="/creator/dashboard" element={<CreatorDashboard />} />
            <Route path="/creator/listings" element={<CreatorListings />} />
            <Route path="/creator/listings/new" element={<CreateListing />} />
            <Route path="/creator/listings/:id" element={<CreatorListingDetails />} />
            <Route
              path="/creator/listings/:id/revisions"
              element={<CreatorListingRevisions />}
            />
            <Route path="/creator/listings/:id/edit" element={<EditListing />} />
            <Route path="/creator/requests" element={<CreatorRequests />} />
            <Route path="/creator/requests/:id" element={<CreatorRequestDetails />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
};

export default App;