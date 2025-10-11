// Shared Category System for Estimates & Invoices
// Single source of truth for all project categories

const STORAGE_KEY = 'buildflow_shared_categories';

// Predefined categories used by both estimates and invoices
const DEFAULT_CATEGORIES = [
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

// Get all categories from localStorage
export function getAllCategories(): string[] {
  if (!isBrowser) return DEFAULT_CATEGORIES;
  
  const customCategories = getCustomCategories();
  // Merge with defaults to ensure we always have the base categories
  return Array.from(new Set([...DEFAULT_CATEGORIES, ...customCategories]));
}

// Get only custom categories (no defaults)
function getCustomCategories(): string[] {
  if (!isBrowser) return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading custom categories:', error);
  }
  
  return [];
}

// Add a new category
export function addCategory(newCategory: string): void {
  if (!isBrowser) return;
  
  const trimmedCategory = newCategory.trim();
  if (!trimmedCategory) return;
  
  // Check if it's already a default category
  if (DEFAULT_CATEGORIES.includes(trimmedCategory)) {
    return; // Don't save defaults
  }
  
  const allCategories = getAllCategories();
  
  // Check if category already exists (case-insensitive)
  const exists = allCategories.some(
    cat => cat.toLowerCase() === trimmedCategory.toLowerCase()
  );
  
  if (!exists) {
    // Only persist custom categories (not defaults)
    const customCategories = getCustomCategories();
    const updatedCustomCategories = [...customCategories, trimmedCategory];
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCustomCategories));
      
      // Dispatch events for cross-page updates
      if (isBrowser) {
        window.dispatchEvent(new CustomEvent('categories-updated'));
        // Also dispatch legacy events for backward compatibility during transition
        window.dispatchEvent(new CustomEvent('estimate-types-updated'));
        window.dispatchEvent(new CustomEvent('invoice-types-updated'));
      }
    } catch (error) {
      console.error('Error saving category:', error);
    }
  }
}

// Remove a category (only custom ones, not defaults)
export function removeCategory(categoryToRemove: string): void {
  if (!isBrowser) return;
  
  // Don't allow removing default categories
  if (DEFAULT_CATEGORIES.includes(categoryToRemove)) {
    console.warn('Cannot remove default category');
    return;
  }
  
  // Only work with custom categories
  const customCategories = getCustomCategories();
  const updatedCustomCategories = customCategories.filter(cat => cat !== categoryToRemove);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCustomCategories));
    
    // Dispatch events for cross-page updates
    if (isBrowser) {
      window.dispatchEvent(new CustomEvent('categories-updated'));
      // Also dispatch legacy events for backward compatibility
      window.dispatchEvent(new CustomEvent('estimate-types-updated'));
      window.dispatchEvent(new CustomEvent('invoice-types-updated'));
    }
  } catch (error) {
    console.error('Error removing category:', error);
  }
}

// Check if a category is a default category
export function isDefaultCategory(category: string): boolean {
  return DEFAULT_CATEGORIES.includes(category);
}

// Migration: Merge old separate estimate/invoice types into shared system
export function migrateOldCategories(): void {
  if (!isBrowser) return;
  
  try {
    const estimateTypes = localStorage.getItem('buildflow_estimate_types');
    const invoiceTypes = localStorage.getItem('buildflow_invoice_types');
    const currentShared = localStorage.getItem(STORAGE_KEY);
    
    // Only migrate if shared doesn't exist yet
    if (!currentShared) {
      const customCategories = new Set<string>();
      
      // Add custom categories from old estimate types (exclude defaults)
      if (estimateTypes) {
        JSON.parse(estimateTypes).forEach((type: string) => {
          if (!DEFAULT_CATEGORIES.includes(type)) {
            customCategories.add(type);
          }
        });
      }
      
      // Add custom categories from old invoice types (exclude defaults)
      if (invoiceTypes) {
        JSON.parse(invoiceTypes).forEach((type: string) => {
          if (!DEFAULT_CATEGORIES.includes(type)) {
            customCategories.add(type);
          }
        });
      }
      
      // Only save custom categories (not defaults)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(customCategories)));
      
      // Optionally clean up old keys
      // localStorage.removeItem('buildflow_estimate_types');
      // localStorage.removeItem('buildflow_invoice_types');
    }
  } catch (error) {
    console.error('Error migrating categories:', error);
  }
}

// Initialize migration on load
if (isBrowser) {
  migrateOldCategories();
}
