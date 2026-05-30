import Link from 'next/link';
import type { Establishment } from '@/types';

interface EstablishmentListProps {
  establishments: Establishment[];
  citySlug: string;
}

export function EstablishmentList({ establishments, citySlug }: EstablishmentListProps) {
  if (establishments.length === 0) {
    return <p className="text-gray-500">No establishments found.</p>;
  }

  return (
    <div className="space-y-4">
      {establishments.map((est) => (
        <Link
          key={est.id}
          href={`/${citySlug}/${est.slug}`}
          className="block p-4 border rounded-lg hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold">{est.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{est.address}</p>
              {est.description && (
                <p className="text-sm text-gray-600 mt-2 line-clamp-2">{est.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-yellow-500">★</span>
              <span className="text-sm font-medium">{est.rating.toFixed(1)}</span>
              <span className="text-sm text-gray-400">({est.reviewCount})</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default EstablishmentList;
