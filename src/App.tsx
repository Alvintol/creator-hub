import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ScrollToTop from "./components/ScrollToTop";
import ProfileSetupRedirect from "./components/ProfileSetupRedirect";
import RequireAuth from "./components/RequireAuth";
import RequireAdminAccess from "./components/RequireAdminAccess";

import Home from "./pages/Home";
import Live from "./pages/Live";
import Creators from "./pages/Creators";
import CreatorProfile from "./pages/CreatorProfile";
import Market from "./pages/Market";
import Listing from "./pages/Listing";
import NotFound from "./pages/NotFound";
import About from "./pages/About";
import SignIn from "./pages/SignIn";
import ProfileSettings from "./pages/ProfileSettings";
import ApplyCreator from "./pages/ApplyCreator";
import AdminCreatorApplications from "./pages/AdminCreatorApplications";
import RequireCreatorAccess from './components/RequireCreatorAccess';
import CreatorDashboard from './pages/CreatorDashboard';
import Legal from './pages/Legal';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import CreatorTerms from './pages/CreatorTerms';
import CreateListing from './pages/CreateListing';
import CreatorListings from './pages/CreatorLIstings';

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
          </Route>

          <Route element={<RequireAdminAccess />}>
            <Route
              path="/admin/creator-applications"
              element={<AdminCreatorApplications />}
            />
          </Route>

          <Route element={<RequireCreatorAccess />}>
            <Route path="/creator/dashboard" element={<CreatorDashboard />} />
            <Route path="/creator/listings" element={<CreatorListings />} />
            <Route path="/creator/listings/new" element={<CreateListing />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
};

export default App;