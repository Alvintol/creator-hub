const Footer = () => {
  return (
    <footer className='container pt-0'>
      <div className='border-t border-zinc-200 py-6 text-xs text-zinc-500'>
        © {new Date().getFullYear()} CreatorHub • Marketplace for creator assets
        & services
      </div>
    </footer>
  );
};

export default Footer;
