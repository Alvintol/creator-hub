const Footer = () => {
    return (
        <footer className="footer">
            <div className="container footerInner">
                <div>© {new Date().getFullYear()} CreatorHub</div>
                <div className="footerLinks">
                    <a href="#" onClick={(e) => e.preventDefault()}>Terms</a>
                    <a href="#" onClick={(e) => e.preventDefault()}>Privacy</a>
                </div>
            </div>
        </footer>
    );
}

export default Footer