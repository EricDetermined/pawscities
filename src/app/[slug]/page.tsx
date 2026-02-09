import { notFound } from 'next/navigation';
import { getCityConfig, getAllCitySlugs, CATEGORIES } from '@/lib/cities-config';
import { getCityEstablishments, getCityCategoryCounts } from '@/lib/data';
import { CityPageClient } from './CityPageClient';
import type { Metadata } from 'next';

interface CityPageProps {
  params: { slug: string };
}

export async function generateStaticParams() {
  return getAllCitySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const city = getCityConfig(params.slug);
  if (!city) return {};
  return {
    title: `Dog-Friendly Places in ${city.name} | Paw Cities`,
    description: city.description,
  };
}

export default async function CityPage({ params }: CityPageProps) {
  const city = getCityConfig(params.slug);
  if (!city) notFound();

  const establishments = await getCityEstablishments(params.slug);
  const categoryCounts = await getCityCategoryCounts(params.slug);

  return (
    <CityPageClient
      city={city}
      establishments={establishments}
      categoryCounts={categoryCounts}
      categories={CATEGORIES}
    />
  );
}
