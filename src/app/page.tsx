import React from 'react';
import { CityList } from '@/components/cities/CityList';

export default function Home() {
  return (
    <div className="p-4">
      <h1>Browse Cities</h1>
      <CityList />
    </div>
  );
}
