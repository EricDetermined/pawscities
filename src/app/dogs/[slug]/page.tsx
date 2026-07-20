import { Metadata } from 'next';
import { DogPublicProfileClient } from './DogPublicProfileClient';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const name = params.slug.split('-').slice(0, -1).join(' ') || 'Dog';
  const pretty = name.charAt(0).toUpperCase() + name.slice(1);
  return {
    title: `${pretty} | Paw Cities Community`,
    description: `Meet ${pretty} on Paw Cities — the dog-friendly city community.`,
  };
}

export default function DogPublicProfilePage({
  params,
}: {
  params: { slug: string };
}) {
  return <DogPublicProfileClient slug={params.slug} />;
}
