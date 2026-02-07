import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { DogForm } from '@/components/dogs/DogForm';

export default async function NewDogPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/profile/dogs/new');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <Link
            href="/profile/dogs"
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 mb-2"
          >
            ← Back to My Dogs
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">🐕 Add a New Dog</h1>
          <p className="text-gray-600 mt-1">
            Tell us about your furry friend!
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <DogForm />
        </div>
      </div>
    </div>
  );
}
