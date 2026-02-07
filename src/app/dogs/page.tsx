import React from 'react';
import { DogList } from 'A/components/dogs/DogList';

export default function DogsPage() {
  return (
    <div className="p-4">
      <h1>Dogs Near You</h1>
      <DogList />
    </div>
  