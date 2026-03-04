import { Outlet } from 'react-router-dom';
import Nav from './Nav';
import Footer from './Footer';

const classes = {
  shell: 'appShell',
  main: 'container',
};

const Layout = () => {
  return (
    <div className={classes.shell}>
      <Nav />
      <main className={classes.main}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
