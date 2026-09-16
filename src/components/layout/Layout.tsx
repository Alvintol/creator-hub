import { Outlet, useLocation } from 'react-router-dom';
import Nav from './Nav';
import Footer from './Footer';
import { PageTransition } from '../../lib/motion';

const classes = {
  shell: 'appShell',
  main: 'container',
} as const;

const Layout = () => {
  const { pathname } = useLocation();

  return (
    <div className={classes.shell}>
      <Nav />
      <main className={classes.main}>
        <PageTransition transitionKey={pathname}>
          <Outlet />
        </PageTransition>
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
