import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className='space-y-4'>
      <h1 className='text-2xl font-extrabold tracking-tight'>404</h1>
      <p className='text-sm text-zinc-600'>That page doesn’t exist.</p>
      <Link
        to='/'
        className='rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800'
      >
        Go home
      </Link>
    </div>
  );
};

export default NotFound;
