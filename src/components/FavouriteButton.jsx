import { useHubState, useHubActions } from "../providers/HubProvider";

const Heart = ({ filled }) => {
  return (
    <svg viewBox='0 0 24 24' className='h-5 w-5' aria-hidden='true'>
      <path
        d='M12 21s-7.2-4.7-9.6-9.2C.7 8.4 2.4 5.6 5.5 5.1c1.7-.3 3.3.4 4.4 1.6 1.1-1.2 2.7-1.9 4.4-1.6 3.1.5 4.8 3.3 3.1 6.7C19.2 16.3 12 21 12 21z'
        fill={filled ? 'currentColor' : 'none'}
        stroke='currentColor'
        strokeWidth='1.6'
      />
    </svg>
  );
};

const FavouriteButton = ({ kind, idOrHandle, className = '' }) => {
  const { favorites } = useHubState();
  const { toggleFavoriteCreator, toggleFavoriteListing } = useHubActions();

  const isFav =
    kind === 'creator'
      ? !!favorites.creators[idOrHandle]
      : !!favorites.listings[idOrHandle];

  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (kind === 'creator') toggleFavoriteCreator(idOrHandle);
    else toggleFavoriteListing(idOrHandle);
  };

  return (
    <button
      onClick={onClick}
      className={
        'inline-flex items-center justify-center rounded-xl border px-2 py-2 ' +
        (isFav
          ? 'border-rose-200 bg-rose-50 text-rose-600'
          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50') +
        ' ' +
        className
      }
      aria-label={isFav ? 'Remove favorite' : 'Add favorite'}
      title={isFav ? 'Favorited' : 'Favorite'}
      type='button'
    >
      <Heart filled={isFav} />
    </button>
  );
};

export default FavouriteButton;
