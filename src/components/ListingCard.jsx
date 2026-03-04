import { Link } from 'react-router-dom';
import FavoriteButton from './FavoriteButton';

const priceText = (listing) => {
  if (listing.priceType === 'fixed') return `$${listing.priceMin}`;
  if (listing.priceType === 'starting_at') return `From $${listing.priceMin}`;
  if (listing.priceType === 'range')
    return `$${listing.priceMin}–$${listing.priceMax}`;
  return '';
};

const ListingCard = ({ listing, creatorName }) => {
  return (
    <Link
      to={`/listing/${listing.id}`}
      className='group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50'
    >
      <div className='absolute right-3 top-3 z-10'>
        <FavoriteButton kind='listing' idOrHandle={listing.id} />
      </div>

      <img
        src={listing.preview}
        alt=''
        className='h-40 w-full object-cover'
        loading='lazy'
      />

      <div className='p-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <h3 className='text-base font-extrabold tracking-tight'>
            {listing.title}
          </h3>
          <span className='rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold'>
            {listing.type}
          </span>
        </div>

        <p className='mt-2 text-sm text-zinc-600'>{listing.short}</p>

        <div className='mt-3 flex items-center justify-between gap-3'>
          <span className='text-sm font-extrabold'>{priceText(listing)}</span>
          <span className='text-sm text-zinc-600'>{creatorName}</span>
        </div>
      </div>
    </Link>
  );
};

export default ListingCard;
