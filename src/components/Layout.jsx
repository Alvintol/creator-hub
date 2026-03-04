import { Outlet } from "react-router-dom";
import Nav from "./Nav";
import Footer from "./Footer";

const Layout = () => {
    return (
        <div className="appShell">
            <Nav />
            <main className="container">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
}
export default Layout