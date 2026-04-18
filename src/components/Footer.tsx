import { Link } from "react-router-dom";

const classes = {
  footer: "container pt-0",
  inner: "space-y-2 border-t border-zinc-200 py-6 text-xs text-zinc-500",
  copyright: "text-zinc-500",
  nav: "flex flex-wrap items-center gap-x-4 gap-y-1",
  link: "underline underline-offset-2 transition hover:text-zinc-600",
  credit: "text-zinc-400",
} as const;

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className={classes.footer}>
      <div className={classes.inner}>
        <div className={classes.copyright}>
          © {year} CreatorHub • Marketplace for creator assets & services
        </div>

        <nav className={classes.nav} aria-label="Footer legal navigation">
          <Link className={classes.link} to="/terms">
            Terms
          </Link>

          <Link className={classes.link} to="/privacy">
            Privacy
          </Link>

          <Link className={classes.link} to="/terms/creator">
            Creator Terms
          </Link>

          <Link className={classes.link} to="/legal">
            Legal
          </Link>
        </nav>

        <div className={classes.credit}>
          Built by Alvin (Beans) •{" "}
          <a
            className={classes.link}
            href="https://www.twitch.tv/ImAllBeans"
            target="_blank"
            rel="noreferrer"
          >
            @ImAllBeans
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;