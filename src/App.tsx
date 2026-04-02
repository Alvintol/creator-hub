import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import ProfileSetupRedirect from './components/ProfileSetupRedirect';

import Home from './pages/Home';
import Live from './pages/Live';
import Creators from './pages/Creators';
import CreatorProfile from './pages/CreatorProfile';
import Market from './pages/Market';
import Listing from './pages/Listing';
import NotFound from './pages/NotFound';
import About from "./pages/About";
import SignIn from "./pages/SignIn";
import ProfileSettings from "./pages/ProfileSettings";


const App = () => {
  return (
    <>
      <ScrollToTop />
      <ProfileSetupRedirect />
      <Routes>
        <Route element={<Layout />}>
          <Route path='/' element={<Home />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path='/about' element={<About />} />
          <Route path='/live' element={<Live />} />
          <Route path='/market' element={<Market />} />
          <Route path='/creators' element={<Creators />} />
          <Route path='/listing/:id' element={<Listing />} />
          <Route path='/creator/:handle' element={<CreatorProfile />} />
          <Route path="/settings/profile" element={<ProfileSettings />} />
          <Route path='*' element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
};

export default App;
