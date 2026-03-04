import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ScrollToTop from "./components/ScrollToTop";

import Home from "./pages/Home";
import Live from "./pages/Live";
import Creators from "./pages/Creators";
import CreatorProfile from "./pages/CreatorProfile";
import Market from "./pages/Market";
import Listing from "./pages/Listing";
import NotFound from "./pages/NotFound";
import "./styles/App.css";

const App = () => {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/live" element={<Live />} />
          <Route path="/creators" element={<Creators />} />
          <Route path="/creator/:handle" element={<CreatorProfile />} />
          <Route path="/market" element={<Market />} />
          <Route path="/listing/:id" element={<Listing />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}

export default App