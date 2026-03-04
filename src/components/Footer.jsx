const classes = {
  footer: 'container pt-0',
  inner: 'border-t border-zinc-200 py-6 text-xs text-zinc-500 space-y-1',
  credit: 'text-zinc-400',
  link: 'hover:text-zinc-600 underline underline-offset-2',
};

const Footer = () => {
  return (
    <footer className={classes.footer}>
      <div className={classes.inner}>
        <div>
          © {new Date().getFullYear()} CreatorHub • Marketplace for creator
          assets & services
        </div>

        <div className={classes.credit}>
          Built by Alvin (Beans) •{' '}
          <a
            className={classes.link}
            href='https://www.twitch.tv/ImAllBeans'
            target='_blank'
            rel='noreferrer'
          >
            @ImAllBeans
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
