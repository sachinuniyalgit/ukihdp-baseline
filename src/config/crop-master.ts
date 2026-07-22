export type CropCategory = "Fruit" | "Vegetable" | "Spice" | "Cereal" | "Millet" | "Pulse" | "Oilseed" | "Other";
export type CropType = "Annual / Seasonal" | "Perennial / Orchard" | "Other";

export interface CropMasterRecord {
  id: string;
  name: string;
  category: CropCategory;
  cropType: CropType;
  active: boolean;
  status: "Confirmed" | "Pending Confirmation";
}

export interface CropVarietyRecord {
  id: string;
  cropId: string;
  name: string;
  varietyType: "Local / Traditional" | "Improved" | "Hybrid" | "Other" | "Unknown";
  active: boolean;
  approved: boolean;
}

// Crop type classification is explicitly provided in the FieldFlow instruction.
// No non-focus crops or crop varieties are invented here.
export const INITIAL_FOCUS_CROPS: CropMasterRecord[] = [
  { id: "crop-apple", name: "Apple", category: "Fruit", cropType: "Perennial / Orchard", active: true, status: "Confirmed" },
  { id: "crop-peach", name: "Peach", category: "Fruit", cropType: "Perennial / Orchard", active: true, status: "Confirmed" },
  { id: "crop-kiwi", name: "Kiwi", category: "Fruit", cropType: "Perennial / Orchard", active: true, status: "Confirmed" },
  { id: "crop-walnut", name: "Walnut", category: "Fruit", cropType: "Perennial / Orchard", active: true, status: "Confirmed" },
  { id: "crop-citrus", name: "Citrus", category: "Fruit", cropType: "Perennial / Orchard", active: true, status: "Confirmed" },
  { id: "crop-litchi", name: "Litchi", category: "Fruit", cropType: "Perennial / Orchard", active: true, status: "Confirmed" },
  { id: "crop-potato", name: "Potato", category: "Vegetable", cropType: "Annual / Seasonal", active: true, status: "Confirmed" },
  { id: "crop-tomato", name: "Tomato", category: "Vegetable", cropType: "Annual / Seasonal", active: true, status: "Confirmed" },
  { id: "crop-pea", name: "Pea", category: "Vegetable", cropType: "Annual / Seasonal", active: true, status: "Confirmed" },
  { id: "crop-garlic", name: "Garlic", category: "Spice", cropType: "Annual / Seasonal", active: true, status: "Confirmed" },
  { id: "crop-ginger", name: "Ginger", category: "Spice", cropType: "Annual / Seasonal", active: true, status: "Confirmed" },
];

export const CROP_CATEGORIES: CropCategory[] = ["Fruit", "Vegetable", "Spice", "Cereal", "Millet", "Pulse", "Oilseed", "Other"];
export const CROP_TYPES: CropType[] = ["Annual / Seasonal", "Perennial / Orchard", "Other"];
