'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { CITIES } from '@/lib/cities-config';

interface FormData {
  businessName: string;
  category: string;
  address: string;
  city: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  description: string;
  websiteUrl: string;
}

export default function BusinessListingPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [formData, setFormData] = useState<FormData>({
    businessName: '',
    category: 'restaurants',
    address: '',
    city: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    description: '',
    websiteUrl: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (isLoading) {
    return (<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>);
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <div className="text-5xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Sign In Required</h2>
          <p className="text-gray-600 mb-6">You need to be signed in to request a business listing.</p>
          <div className="flex gap-3">
            <Link href="/login" className="flex-1 px-4 py-3 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-colors">Sign In</Link>
            <Link href="/signup" className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors">Sign Up</Link>
          </div>
        </div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (!formData.businessName || !formData.address || !formData.city || !formData.contactName || !formData.contactEmail) {
        setError('Please fill in all required fields');
        setIsSubmitting(false);
        return;
      }
      const response = await fetch('/api/business/list-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit listing request');
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-md">
          <div className="text-5xl mb-4">\u2705</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Listing Request Submitted!</h2>
          <p className="text-gray-600 mb-6">Your business listing request has been submitted for review. We'll notify you within 48 hours at <strong>{user.email}</strong>.</p>
          <Link href="/" className="inline-block px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors">Back to Home</Link>
        </div>
      </div>
    );
  }

  const cities = Object.values(CITIES);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6"><span className="text-2xl">🐾</span><span className="text-xl font-bold text-orange-600">PawsCities</span></Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">List Your Dog-Friendly Business</h1>
          <p className="text-gray-600">Get your business featured on PawsCities and reach dog-loving customers around the world.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (<div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>)}

            <div><label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-2">Business Name *</label><input id="businessName" type="text" name="businessName" value={formData.businessName} onChange={handleChange} required className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors" placeholder="e.g., Happy Paws Caf\u00e9" /></div>

            <div><label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">Business Category *</label><select id="category" name="category" value={formData.category} onChange={handleChange} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"><option value="restaurants">Restaurants</option><option value="cafes">Cafes</option><option value="parks">Parks</option><option value="hotels">Hotels</option><option value="beaches">Beaches</option><option value="vets">Vets</option><option value="grooming">Grooming</option><option value="stores">Stores</option></select></div>

            <div><label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">City *</label><select id="city" name="city" value={formData.city} onChange={handleChange} required className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"><option value="">Select a city...</option>{cities.map(city => (<option key={city.slug} value={city.slug}>{city.name}, {city.country}</option>))}</select></div>

            <div><label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">Address *</label><input id="address" type="text" name="address" value={formData.address} onChange={handleChange} required className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors" placeholder="e.g., 123 Main Street" /></div>

            <div><label htmlFor="contactName" className="block text-sm font-medium text-gray-700 mb-2">Contact Name *</label><input id="contactName" type="text" name="contactName" value={formData.contactName} onChange={handleChange} required className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors" placeholder="Your full name" /></div>

            <div><label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-2">Contact Email *</label><input id="contactEmail" type="email" name="contactEmail" value={formData.contactEmail} onChange={handleChange} required className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors" placeholder="your@email.com" /></div>

            <div><label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700 mb-2">Contact Phone</label><input id="contactPhone" type="tel" name="contactPhone" value={formData.contactPhone} onChange={handleChange} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors" placeholder="+1 (555) 123-4567" /></div>

            <div><label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">Business Description</label><textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={4} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors" placeholder="Tell us about your dog-friendly business..." /></div>

            <div><label htmlFor="websiteUrl" className="block text-sm font-medium text-gray-700 mb-2">Website URL</label><input id="websiteUrl" type="url" name="websiteUrl" value={formData.websiteUrl} onChange={handleChange} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors" placeholder="https://example.com" /></div>

            <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? 'Submitting...' : 'Submit Listing Request'}</button>
            <p className="text-xs text-gray-500 text-center">Required fields are marked with *</p>
          </form>
        </div>

        <div className="mt-8 bg-blue-50 rounded-xl p-6 border border-blue-100">
          <h3 className="font-semibold text-blue-900 mb-3">What happens next?</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>Our team reviews your submission within 48 hours</li>
            <li>We verify your business information</li>
            <li>Your business gets featured on PawsCities</li>
            <li>You'll have access to business analytics and reviews</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
