import { NavLink, Link } from "react-router-dom";

const Nav = () => {

    const isActiveClass = ({ isActive }) => (isActive ? "active" : "");

    return (
        <header className="header">
            <div className="container headerInner">
                <Link to="/" className="brand">CreatorHub</Link>

                <nav className="nav">
                    <NavLink to="/live" className={isActiveClass}>
                        Live
                    </NavLink>
                    <NavLink to="/creators" className={isActiveClass}>
                        Creators
                    </NavLink>
                    <NavLink to="/market" className={isActiveClass}>
                        Market
                    </NavLink>
                </nav>

                <div className="navRight">
                    <Link to="/creators" className="btn small ghost">Join as a creator</Link>
                </div>
            </div>
        </header>
    );
}

export default Nav