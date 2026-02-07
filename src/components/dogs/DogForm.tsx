'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PhotoUpload } from '@/components/ui/PhotoUpload';

interface DogFormProps {
  initialData?: {
    id?: string;
    name: string;
    breed?: string;
    birthDate?: string;
    size: string;
    personality?: string;
    photo?: string;
    photos?: string[];
  };
  onSubmit?: (data: FormData) => Promise<void>;
}

const DOG_SIZES = [
  { value: 'TINY', label: 'Tiny', description: 'Under 5kg / 10lbs', emoji: '🐕' },
  { value: 'SMALL', label: 'Small', description: '5-10kg / 10-22lbs', emoji: '🐕' },
  { value: 'MEDIUM', label: 'Medium', description: '10-25kg / 22-55lbs', emoji: '🦮' },
  { value: 'LARGE', label: 'Large', description: '25-45kg / 55-100lbs', emoji: '🐕‍🦺' },
  { value: 'GIANT', label: 'Giant', description: 'Over 45kg / 100lbs', emoji: '🐕‍🦺' },
];

const POPULAR_BREEDS = [
  'Labrador Retriever',
  'Golden Retriever',
  'German Shepherd',
  'French Bulldog',
  'Bulldog',
  'Poodle',
  'Beagle',
  'Rottweiler',
  'Dachshund',
  'Yorkshire Terrier',
  'Boxer',
  'Shih Tzu',
  'Siberian Husky',
  'Cavalier King Charles Spaniel',
  'Border Collie',
  'Australian Shepherd',
  'Cocker Spaniel',
  'Pomeranian',
  'Chihuahua',
  'Mixed Breed',
];

export function DogForm({ initialData, onSubmit }: DogFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initialData?.name || '');
  const [breed, setBreed] = useState(initialData?.breed || '');
  const [birthDate, setBirthDate] = useState(initialData?.birthDate || '');
  const [size, setSize] = useState(initialData?.size || 'MEDIUM');
  const [personality, setPersonality] = useState(initialData?.personality || '');
  const [photos, setPhotos] = useState<string[]>(initialData?.photos || []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/dogs', {
        method: initialData?.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: initialData?.id,
          name,
          breed: breed || null,
          birthDate: birthDate || null,
          size,
          personality: personality || null,
          photos: photos.length > 0 ? photos : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save dog profile');
      }

      router.push('/profile/dogs');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Dog Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Dog&apos;s Name *
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          placeholder="What's your pup's name?"
        />
      </div>

      {/* Photo Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Photos of Your Dog
        </label>
        <PhotoUpload
          onPhotosChange={setPhotos}
          existingPhotos={photos}
          maxPhotos={5}
        />
      </div>

      {/* Breed */}
      <div>
        <label htmlFor="breed" className="block text-sm font-medium text-gray-700 mb-1">
          Breed
        </label>
        <input
          id="breed"
          type="text"
          value={breed}
          onChange={(e) => setBreed(e.target.value)}
          list="breeds"
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          placeholder="Start typing or select from list"
        />
        <datalist id="breeds">
          {POPULAR_BREEDS.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      </div>

      {/* Birth Date */}
      <div>
        <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700 mb-1">
          Birth Date (approximate is fine!)
        </label>
        <input
          id="birthDate"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
      </div>

      {/* Size */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Size *
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {DOG_SIZES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSize(option.value)}
              className={`p-3 rounded-lg border-2 text-center transition-all ${
                size === option.value
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-2xl block mb-1">{option.emoji}</span>
              <span className="font-medium text-sm">{option.label}</span>
              <span className="block text-xs text-gray-500">{option.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Personality */}
      <div>
        <label htmlFor="personality" className="block text-sm font-medium text-gray-700 mb-1">
          Personality & Notes
        </label>
        <textarea
          id="personality"
          value={personality}
          onChange={(e) => setPersonality(e.target.value)}
          rows={3}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          placeholder="Tell us about your dog! Are they friendly? Shy? Love to play fetch?"
        />
      </div>

      {/* Submit */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 py-3 border border-gray-200 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || !name}
          className="flex-1 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
            </span>
          ) : initialData?.id ? (
            'Update Profile'
          ) : (
            '🐾 Add My Dog'
          )}
        </button>
      </div>
    </form>
  );
}
