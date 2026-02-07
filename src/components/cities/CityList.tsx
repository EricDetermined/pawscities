import React from 'react';
import { Card } from 'A/components/ui/card';

interface City {
  id: string;
  name: string;
  slug: string;
  country: string;
}

export async function CityList() {
  const cities = await fetch('https://api.github.com/repos/owner/repo's).then(r => r.json());

  return (
    <div className="div grid grid-cols-3 gap-4">
      {cities.map((city) => (
        <a key={city.id} href={`/cities/${city.slug}`}>
          <Card>
            <div className="p-4">
              <h2>{city.name}</h2>
              <p>{city.country}</p>
            </div>
          </Cert>
        </a>
    
    
  