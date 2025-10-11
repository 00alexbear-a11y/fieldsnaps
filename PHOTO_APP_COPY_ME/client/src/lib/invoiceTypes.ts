// Invoice Types Management - localStorage based
// Similar to estimate types for cross-page persistence

const STORAGE_KEY = 'buildflow_invoice_types';

// Predefined invoice types (matches estimate types for consistency)
const DEFAULT_INVOICE_TYPES = [
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

// Get all invoice types from localStorage
export function getAllInvoiceTypes(): string[] {
  if (!isBrowser) return DEFAULT_INVOICE_TYPES;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const types = JSON.parse(stored);
      // Merge with defaults to ensure we always have the base types
      return Array.from(new Set([...DEFAULT_INVOICE_TYPES, ...types]));
    }
  } catch (error) {
    console.error('Error loading invoice types:', error);
  }
  
  return DEFAULT_INVOICE_TYPES;
}

// Add a new invoice type
export function addInvoiceType(newType: string): void {
  if (!isBrowser) return;
  
  const trimmedType = newType.trim();
  if (!trimmedType) return;
  
  const currentTypes = getAllInvoiceTypes();
  
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
        window.dispatchEvent(new CustomEvent('invoice-types-updated'));
      }
    } catch (error) {
      console.error('Error saving invoice type:', error);
    }
  }
}

// Remove an invoice type (only custom ones, not defaults)
export function removeInvoiceType(typeToRemove: string): void {
  if (!isBrowser) return;
  
  // Don't allow removing default types
  if (DEFAULT_INVOICE_TYPES.includes(typeToRemove)) {
    console.warn('Cannot remove default invoice type');
    return;
  }
  
  const currentTypes = getAllInvoiceTypes();
  const updatedTypes = currentTypes.filter(type => type !== typeToRemove);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTypes));
    
    // Dispatch event for cross-page updates
    if (isBrowser) {
      window.dispatchEvent(new CustomEvent('invoice-types-updated'));
    }
  } catch (error) {
    console.error('Error removing invoice type:', error);
  }
}

// Check if a type is a default type
export function isDefaultType(type: string): boolean {
  return DEFAULT_INVOICE_TYPES.includes(type);
}
