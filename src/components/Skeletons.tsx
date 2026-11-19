/*
 * Placeholders shown the moment a link is tapped, while the next page comes from the server (the loading.tsx files).
 * The top bar and the phone tab bar stay in place around them. Shapes only, no text, in the page's own layout.
 */

const block = "animate-pulse rounded-2xl bg-sand";

/** A page heading and a column of cards: bookings, offers, account and other simple pages. */
export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:py-12" aria-busy="true" aria-label="Loading">
      <div className={`${block} h-8 w-2/3 max-w-sm`} />
      <div className={`${block} mt-3 h-4 w-1/2 max-w-xs`} />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`${block} h-28`} />
        ))}
      </div>
    </div>
  );
}

/** The restaurants list: search row, filter chips and restaurant cards. */
export function ListSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:py-10" aria-busy="true" aria-label="Loading restaurants">
      <div className={`${block} h-12`} />
      <div className="mt-3 flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={`${block} h-8 w-24 shrink-0 rounded-full`} />
        ))}
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i}>
            <div className={`${block} aspect-[4/3]`} />
            <div className={`${block} mt-3 h-5 w-2/3`} />
            <div className={`${block} mt-2 h-4 w-1/2`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A restaurant's page: photo, name and details, and the booking panel beside them on larger screens. */
export function RestaurantSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading restaurant">
      <div className="animate-pulse h-64 bg-sand md:h-96" />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_380px]">
        <div>
          <div className={`${block} h-9 w-3/4 max-w-md`} />
          <div className={`${block} mt-3 h-4 w-1/2 max-w-xs`} />
          <div className="mt-6 grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className={`${block} h-16`} />
            ))}
          </div>
          <div className={`${block} mt-6 h-24`} />
        </div>
        <div className={`${block} hidden h-96 lg:block`} />
      </div>
    </div>
  );
}
