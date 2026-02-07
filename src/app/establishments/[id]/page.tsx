import React from 'react';

interface EstablishmentId { 
	 params: {id: string}
}

export default async function EstablishmentDetail({ params }: EstablishmentId) {
  return (
    <div className="p-4">
      <h1>Establishment {params.id}</h1>
    </div>
  );
}