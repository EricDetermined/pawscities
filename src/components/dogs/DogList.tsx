interface Dog {
  id: string;
  name: string;
  breed?: string;
  imageUrl?: string;
}

interface DogListProps {
  dogs: Dog[];
}

export function DogList({ dogs }: DogListProps) {
  if (dogs.length === 0) {
    return <p className="text-gray-500">No dogs found.</p>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {dogs.map((dog) => (
        <div key={dog.id} className="border rounded-lg p-4 text-center">
          {dog.imageUrl && (
            <img
              src={dog.imageUrl}
              alt={dog.name}
              className="w-20 h-20 rounded-full mx-auto mb-2 object-cover"
            />
          )}
          <h3 className="font-medium">{dog.name}</h3>
          {dog.breed && <p className="text-sm text-gray-500">{dog.breed}</p>}
        </div>
      ))}
    </div>
  );
}

export default DogList;
