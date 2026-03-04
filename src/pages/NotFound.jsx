import { Link } from 'react-router-dom';

const classes = {
  wrap: 'space-y-4',
  h1: 'text-2xl font-extrabold tracking-tight',
  p: 'text-sm text-zinc-600',
  btn: 'rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800',
};

const NotFound = () => {
  return (
    <div className={classes.wrap}>
      <h1 className={classes.h1}>404</h1>
      <p className={classes.p}>That page doesn’t exist.</p>
      <Link to='/' className={classes.btn}>
        Go home
      </Link>
    </div>
  );
};

export default NotFound;
