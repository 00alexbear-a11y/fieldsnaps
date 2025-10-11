import type { Contractor } from "@/components/ContractorSelector";

// Shared mock contractors - will be replaced with API data
// This ensures contractors are consistent across all pages (Estimates, Invoices, Schedule, Budget)
export const mockContractors: Contractor[] = [
  {
    id: "c1",
    name: "John Smith",
    company: "ABC Construction",
    email: "john@abcconstruction.com",
    phone: "(555) 123-4567",
    trade: ["General Contracting", "Framing"],
    qualityTier: "A",
    insuranceOnFile: true,
    w2OnFile: true,
    status: "active",
  },
  {
    id: "c2",
    name: "Maria Garcia",
    company: "Bright Electric",
    email: "maria@brightelectric.com",
    phone: "(555) 234-5678",
    trade: ["Electrical"],
    qualityTier: "A",
    insuranceOnFile: true,
    w2OnFile: false,
    status: "active",
  },
  {
    id: "c3",
    name: "Robert Chen",
    company: "Flow Pro Plumbing",
    email: "robert@flowpro.com",
    phone: "(555) 345-6789",
    trade: ["Plumbing"],
    qualityTier: "B",
    insuranceOnFile: true,
    w2OnFile: true,
    status: "active",
  },
  {
    id: "c4",
    name: "Lisa Johnson",
    company: "Cool Air Systems",
    email: "lisa@coolairsystems.com",
    phone: "(555) 456-7890",
    trade: ["HVAC"],
    qualityTier: "A",
    insuranceOnFile: true,
    w2OnFile: true,
    status: "active",
  },
];

// Store for newly created contractors using localStorage for persistence
const STORAGE_KEY = "buildflow_new_contractors";

function getNewContractorsFromStorage(): Contractor[] {
  // Guard against SSR/non-browser environments
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [];
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("[MockContractors] Error loading from localStorage:", e);
  }
  return [];
}

function saveNewContractorsToStorage(contractors: Contractor[]) {
  // Guard against SSR/non-browser environments
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contractors));
    // Dispatch custom event to notify components in same window
    window.dispatchEvent(new CustomEvent('contractor-updated'));
  } catch (e) {
    console.error("[MockContractors] Error saving to localStorage:", e);
  }
}

export function addContractor(contractor: Contractor) {
  const newContractors = getNewContractorsFromStorage();
  
  // Prevent duplicates - check if contractor with this ID already exists
  const exists = newContractors.some((c) => c.id === contractor.id);
  
  if (!exists) {
    newContractors.push(contractor);
    saveNewContractorsToStorage(newContractors);
  }
}

export function getAllContractors(): Contractor[] {
  const newContractors = getNewContractorsFromStorage();
  return [...mockContractors, ...newContractors];
}

// Hook to subscribe to contractor changes via storage events
export function useContractorStorage(callback: () => void) {
  if (typeof window === 'undefined') return;
  
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      callback();
    }
  };
  
  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}

export function getContractorById(id: string): Contractor | undefined {
  return getAllContractors().find((c) => c.id === id);
}

export function getContractorsByTrade(trade: string): Contractor[] {
  return getAllContractors().filter((c) => 
    c.trade?.some((t) => t.toLowerCase().includes(trade.toLowerCase()))
  );
}
