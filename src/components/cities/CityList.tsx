import Link from 'next/link';
import { CITIES } from '@/lib/cities-config';

interface CityListProps {
  limit?: number;
}

export default function CityList({ limit }: CityListProps) {
  const cities = Object.values(CITIES);
  const displayed = limit ? cities.slice(0, limit) : cities;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {displayed.map((city) => (
        <Link
          key={city.slug}
          href={`/${city.slug}`}
          className="group relative h-72 rounded-2xl overflow-hidden shadow-lg"
        >
          <img
            src={city.heroImage}
            alt={city.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{city.country}</span>
            </div>
            <h3 className="font-display text-2xl font-bold mb-1">{city.name}</h3>
            <p className="text-sm opacity-90">Explore dog-friendly places</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
