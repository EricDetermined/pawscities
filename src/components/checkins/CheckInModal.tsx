'use client';

import { useState, useEffect } from 'react';
import { PhotoUpload } from '@/components/ui/PhotoUpload';

interface Dog {
  id: string;
  name: string;
  photo: string | null;
}

interface CheckInModalProps {
  establishmentId: string;
  establishmentName: string;
  onClose: () => void;
  onCheckedIn: () => void;
}

export default function CheckInModal({
  establishmentId,
  establishmentName,
  onClose,
  onCheckedIn,
}: CheckInModalProps) {
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [dogId, setDogId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dogs')
      .then(res => res.json())
      .then(data => {
        const list: Dog[] = (data.dogs || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          photo: d.photo || (Array.isArray(d.photos) ? d.photos[0] : null),
        }));
        setDogs(list);
        if (list.length === 1) setDogId(list[0].id);
      })
      .catch(() => {});
  }, []);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          establishmentId,
          dogId: dogId || null,
          note: note.trim() || null,
          rating: rating || null,
          photo: photos[0] || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Check-in failed');
        return;
      }
      onCheckedIn();
      onClose();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-1">
            <h3 className="text-lg font-bold text-gray-900">Check in 📍</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 -mt-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-5">{establishmentName}</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Who's with you */}
          {dogs.length > 0 && (
            <div className="mb-5">
              <p className="text-sm font-medium text-gray-700 mb-2">Who&apos;s with you?</p>
              <div className="flex gap-2 flex-wrap">
                {dogs.map(dog => (
                  <button
                    key={dog.id}
                    type="button"
                    onClick={() => setDogId(dogId === dog.id ? null : dog.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full border-2 text-sm font-medium transition-colors ${
                      dogId === dog.id
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {dog.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={dog.photo} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <span>🐶</span>
                    )}
                    {dog.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Rating */}
          <div className="mb-5">
            <p className="text-sm font-medium text-gray-700 mb-2">How was it? (optional)</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(rating === star ? 0 : star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="text-3xl leading-none transition-transform hover:scale-110"
                >
                  <span className={star <= (hoverRating || rating) ? 'text-amber-400' : 'text-gray-200'}>
                    ★
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="mb-5">
            <p className="text-sm font-medium text-gray-700 mb-2">Leave a note (optional)</p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Water bowls out front, pup-friendly patio..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none text-sm"
            />
          </div>

          {/* Photo */}
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-2">Add a photo (optional)</p>
            <PhotoUpload onPhotosChange={setPhotos} existingPhotos={photos} maxPhotos={1} />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Checking in...' : '📍 Check In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
