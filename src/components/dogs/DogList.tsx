import React from 'react';
import { DogCard } from 'A/components/dogs/DogCard';

export async function DogList() {
  const dogs = await fetch('/api/dogs').then(r => r.json());

  return (
    <div className="div grid grid-cols-2 gap-4">
      {dogs.map((dog) => (
        <DogCard key={dog.id} { ...dog } />
      ))}
    
  