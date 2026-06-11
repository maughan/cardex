// Navigation param lists. Kept separate so screens can import the types
// without creating an import cycle with the navigator definitions.

export type GarageStackParamList = {
  GarageHome: undefined;
  SetDetail: { slug: string; name: string };
  CarDetail: { carId: number; dexNumber?: number };
};
