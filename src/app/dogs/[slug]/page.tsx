import { Metadata } from 'next';
import { getServiceClient } from '@/lib/community';
import { DogPublicProfileClient } from './DogPublicProfileClient';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://pawcities.com';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  try {
    const admin = getServiceClient();
    const { data: dog } = await admin
      .from('dog_profiles')
      .select('name, breed, photo, photos, bio, personality, users!inner(home_city)')
      .eq('slug', params.slug)
      .eq('is_public', true)
      .maybeSingle();

    if (dog) {
      const d = dog as any;
      let cityName = '';
      if (d.users?.home_city) {
        const { data: city } = await admin
          .from('cities')
          .select('name')
          .eq('id', d.users.home_city)
          .maybeSingle();
        cityName = city?.name || '';
      }
      const title = `${d.name}${d.breed ? ` the ${d.breed}` : ''}${cityName ? ` in ${cityName}` : ''} | Paw Cities`;
      const description =
        (d.bio || d.personality || '').slice(0, 155) ||
        `Meet ${d.name} on Paw Cities — the dog-friendly city community.`;
      const image = d.photo || (Array.isArray(d.photos) ? d.photos[0] : null);
      return {
        title,
        description,
        openGraph: {
          title,
          description,
          type: 'profile',
          url: `${BASE_URL}/dogs/${params.slug}`,
          images: [image || `${BASE_URL}/images/og-default.png`],
        },
        twitter: { card: 'summary_large_image', title, description },
      };
    }
  } catch {
    // fall through to generic metadata
  }
  return {
    title: 'Dog Profile | Paw Cities Community',
    description: 'Meet the dogs of Paw Cities — the dog-friendly city community.',
  };
}

export default function DogPublicProfilePage({
  params,
}: {
  params: { slug: string };
}) {
  return <DogPublicProfileClient slug={params.slug} />;
}
