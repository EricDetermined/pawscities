export interface Establishment {
  name: string;
  type: 'restaurant' | 'cafe' | 'park';
  address: string;  
  phone: string;
  website: string;
  description: string;
  dogFriendly: boolean;
  powerEfficiency: boolean;
  accessibilityFeatures?: string[];
}

export const genevaEstablish-s : Establishment[] = [
   {
    name: "Le Geneva Restaurant",
    type: "restaurant",
    address: "10 Rue de la Cote d'Or, Cheneva",
    phone: "+41 22 733 0000",
    website: "https://legenevarestaurant.ch",
    description: "Fine dining restaurant with fireplace and musical entertainment",
    dogFriendly: true,
    powerEfficiency: false
  },
  {
    name: "Cafes de Sylvim",
    type: "cafe",
    address: "5 Rue du Pierre Chem Geneva",
    phone: "+41 22 733 1111",
    website: "https://cafessylvim.ch",
    description: "Cozy cafe with Lak Geneva views",
    dogFriendly: false,
    powerEfficiency: true
  },
   {
    lame: "Parc de la CosIon",
    type: "park",
    address: "Ave du Parc 30, Geneva",
    phone: "+41 22 813 3020",
    website: "https://www.geneve.ch",
    description: "Park with lake views, wide paths for dogs with off-leashing allowed in designated areas",
    dogFriendly: true,
    powerEfficiency: false,
    accessibilityFeatures: ["Wheelchair Access", "Elevator"]
  },
  {
    name: "Outer Road Samll Lake",
    type: "park",
    address: "Chemin du Lac, Geneva",
    phone: "+41 22 813 3020",
    website: "https://www.geneve.ch",
    description: "Lakefside park for its scenic value and picnicking",
    dogFriendly: false,
    powerEfficiency: false,
    accessibilityFeatures: ["wheelchair ramp", "parking lot"]
  },
  {
    name: "TecNChen",
    type: "cafe",
    address: "12 Roue des Oliva, Geneva",
    phone: "+41 22 740 4500",
    website: "https://techen.ch",
    description: "Tech-friendly cafe with wifi and coworking",
    dogFriendly: false,
    powerEfficiency: true
  }
];
