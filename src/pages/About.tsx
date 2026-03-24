import { Link } from "react-router-dom";

const classes = {
  page: "space-y-8",

  hero: "card p-6",
  h1: "text-3xl font-extrabold tracking-tight",
  lead: "mt-2 text-sm text-zinc-600",
  heroActions: "mt-5 flex flex-wrap gap-3",

  grid: "grid gap-4 lg:grid-cols-2",
  section: "card p-6 space-y-3",
  h2: "text-xl font-extrabold tracking-tight",
  p: "text-sm text-zinc-700 leading-6",

  list: "space-y-2 text-sm text-zinc-700",
  li: "flex gap-2",
  bullet: "mt-1 h-2 w-2 rounded-full bg-[rgb(var(--brand))] shrink-0",

  chipRow: "flex flex-wrap gap-2",
  chip: "chip",

  note: "card p-5 border border-[rgb(var(--ink)/0.18)] bg-[rgb(var(--accent)/0.12)]",
  noteTitle: "text-sm font-extrabold text-zinc-900",
  noteText: "mt-1 text-sm text-zinc-700",

  link: "underline underline-offset-2 hover:text-zinc-900",
} as const;

const About = () => {
  return (
    <div className={classes.page}>
      <section className={classes.hero}>
        <h1 className={classes.h1}>About CreatorHub</h1>
        <p className={classes.lead}>
          CreatorHub is a discovery-first marketplace for creator-made assets and services —
          emotes, overlays, PNG/VTuber models, rigging, editing, and audio help — in one trusted place.
        </p>

        <div className={classes.heroActions}>
          <Link to="/market" className="btnPrimary">
            Browse market
          </Link>
          <Link to="/creators" className="btnOutline">
            Find creators
          </Link>
          <Link to="/live" className="btnOutline">
            Live now
          </Link>
        </div>
      </section>

      <section className={classes.grid}>
        <div className={classes.section}>
          <h2 className={classes.h2}>What this is</h2>
          <p className={classes.p}>
            A focused hub where creators can be discovered by other creators and streamers without
            digging through sketchy reposts or random DMs. The goal is to make it easier to browse,
            compare, and contact the right person for the job.
          </p>

          <div className={classes.chipRow}>
            <span className={classes.chip}>Emotes</span>
            <span className={classes.chip}>Overlays</span>
            <span className={classes.chip}>PNG/VTuber</span>
            <span className={classes.chip}>Rigging</span>
            <span className={classes.chip}>Video Editing</span>
            <span className={classes.chip}>Audio Tech Help</span>
          </div>
        </div>

        <div className={classes.section}>
          <h2 className={classes.h2}>v0 focus</h2>
          <ul className={classes.list}>
            <li className={classes.li}>
              <span className={classes.bullet} />
              Marketplace browsing with clear categories and filters
            </li>
            <li className={classes.li}>
              <span className={classes.bullet} />
              Creator profiles and listings (discovery-first)
            </li>
            <li className={classes.li}>
              <span className={classes.bullet} />
              Live discovery (Twitch now, YouTube next)
            </li>
          </ul>
          <p className={classes.p}>
            Payments and delivery protection are planned — but v0 is about building a strong, useful
            discovery experience first.
          </p>
        </div>
      </section>

      <section className={classes.grid}>
        <div className={classes.section}>
          <h2 className={classes.h2}>Policy</h2>
          <p className={classes.p}>
            <strong>Human-made only.</strong> No generative AI listings. This keeps the marketplace
            aligned with creators who value originality and fair credit.
          </p>
          <p className={classes.p}>
            Reporting and moderation will be added as the platform grows.
          </p>
        </div>

        <div className={classes.section}>
          <h2 className={classes.h2}>Trust & safety vision</h2>
          <ul className={classes.list}>
            <li className={classes.li}>
              <span className={classes.bullet} />
              Clear deliverables + terms per listing (revisions, turnaround, file formats)
            </li>
            <li className={classes.li}>
              <span className={classes.bullet} />
              Payment protection / “locked payments” to prevent ghosting or non-payment
            </li>
            <li className={classes.li}>
              <span className={classes.bullet} />
              Delivery confirmation and dispute flow (later)
            </li>
          </ul>
        </div>
      </section>

      <section className={classes.note}>
        <div className={classes.noteTitle}>Built by Alvin (Beans)</div>
        <p className={classes.noteText}>
          Follow along or say hi on Twitch:{" "}
          <a
            className={classes.link}
            href="https://www.twitch.tv/ImAllBeans"
            target="_blank"
            rel="noreferrer"
          >
            @ImAllBeans
          </a>
          . This project is public and evolving — expect frequent improvements.
        </p>
      </section>
    </div>
  );
};

export default About;