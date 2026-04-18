import { privacySections, privacyVersion } from "../domain/legal/privacyPolicy";

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",

  card: "card p-6",
  meta: "text-xs text-zinc-500",
  sectionList: "space-y-5",
  section: "rounded-2xl border border-zinc-200 bg-white p-5",
  sectionTitle: "text-base font-extrabold tracking-tight",
  sectionBody: "mt-3 space-y-3 text-sm text-zinc-700",
} as const;

const Privacy = () => {
  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.h1}>Privacy Policy</h1>
        <p className={classes.sub}>How CreatorHub handles personal information.</p>
      </div>

      <div className={classes.card}>

        <div className={classes.sectionList}>
          {privacySections.map((section) => (
            <section key={section.title} className={classes.section}>
              <h2 className={classes.sectionTitle}>{section.title}</h2>

              <div className={classes.sectionBody}>
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className={classes.meta}>Version: {privacyVersion}</div>
      </div>
    </div>
  );
};

export default Privacy;