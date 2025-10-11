// Estimate Types Management - localStorage based
// Similar to contractor management for cross-page persistence

const STORAGE_KEY = 'buildflow_estimate_types';

// Predefined estimate types
const DEFAULT_ESTIMATE_TYPES = [
  'Framing Labor',
  'Electrical',
  'Plumbing',
  'HVAC',
  'Roofing',
  'Drywall',
  'Painting',
  'Flooring',
  'Cabinets',
  'Countertops',
  'Windows & Doors',
  'Foundation',
  'Demolition',
  'Site Work',
  'Concrete',
  'Masonry',
  'Insulation',
  'Tile Work',
  'Landscaping',
  'General Labor',
];

// Browser environment guard
const isBrowser = typeof window !== 'undefined';

// Get all estimate types from localStorage
export function getAllEstimateTypes(): string[] {
  if (!isBrowser) return DEFAULT_ESTIMATE_TYPES;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const types = JSON.parse(stored);
      // Merge with defaults to ensure we always have the base types
      return Array.from(new Set([...DEFAULT_ESTIMATE_TYPES, ...types]));
    }
  } catch (error) {
    console.error('Error loading estimate types:', error);
  }
  
  return DEFAULT_ESTIMATE_TYPES;
}

// Add a new estimate type
export function addEstimateType(newType: string): void {
  if (!isBrowser) return;
  
  const trimmedType = newType.trim();
  if (!trimmedType) return;
  
  const currentTypes = getAllEstimateTypes();
  
  // Check if type already exists (case-insensitive)
  const exists = currentTypes.some(
    type => type.toLowerCase() === trimmedType.toLowerCase()
  );
  
  if (!exists) {
    const updatedTypes = [...currentTypes, trimmedType];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTypes));
      
      // Dispatch event for cross-page updates
      if (isBrowser) {
        window.dispatchEvent(new CustomEvent('estimate-types-updated'));
      }
    } catch (error) {
      console.error('Error saving estimate type:', error);
    }
  }
}

// Remove an estimate type (only custom ones, not defaults)
export function removeEstimateType(typeToRemove: string): void {
  if (!isBrowser) return;
  
  // Don't allow removing default types
  if (DEFAULT_ESTIMATE_TYPES.includes(typeToRemove)) {
    console.warn('Cannot remove default estimate type');
    return;
  }
  
  const currentTypes = getAllEstimateTypes();
  const updatedTypes = currentTypes.filter(type => type !== typeToRemove);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTypes));
    
    // Dispatch event for cross-page updates
    if (isBrowser) {
      window.dispatchEvent(new CustomEvent('estimate-types-updated'));
    }
  } catch (error) {
    console.error('Error removing estimate type:', error);
  }
}

// Check if a type is a default type
export function isDefaultType(type: string): boolean {
  return DEFAULT_ESTIMATE_TYPES.includes(type);
}
