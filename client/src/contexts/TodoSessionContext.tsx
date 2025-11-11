import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { PhotoAnnotation } from "@shared/schema";

export interface TodoSessionItem {
  localId: string;
  photoBlob: Blob;
  photoUrl: string;
  thumbnailUrl?: string;
  transcript: string;
  assignedTo?: string;
  annotations: Omit<PhotoAnnotation, 'id' | 'photoId' | 'createdAt'>[];
  serverId?: string; // Track backend ID for already-saved todos
  photoServerId?: string; // Track backend photo ID for already-saved photos
  isSaved?: boolean; // Track whether this todo has been saved to backend
}

interface TodoSessionContextType {
  items: TodoSessionItem[];
  projectId: string | null;
  isActive: boolean;
  startSession: (projectId: string) => void;
  addItem: (item: Omit<TodoSessionItem, 'localId'>) => string;
  updateItem: (localId: string, updates: Partial<Omit<TodoSessionItem, 'localId'>>) => void;
  removeItem: (localId: string) => void;
  clearSession: () => void;
  getItem: (localId: string) => TodoSessionItem | undefined;
}

const TodoSessionContext = createContext<TodoSessionContextType | undefined>(undefined);

export function TodoSessionProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<TodoSessionItem[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);

  const startSession = useCallback((newProjectId: string) => {
    setProjectId(newProjectId);
    setItems([]);
  }, []);

  const addItem = useCallback((item: Omit<TodoSessionItem, 'localId'>) => {
    const localId = `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newItem: TodoSessionItem = {
      localId,
      ...item,
      annotations: item.annotations || [],
    };
    setItems(prev => [...prev, newItem]);
    return localId;
  }, []);

  const updateItem = useCallback((localId: string, updates: Partial<Omit<TodoSessionItem, 'localId'>>) => {
    setItems(prev => prev.map(item => 
      item.localId === localId 
        ? { ...item, ...updates }
        : item
    ));
  }, []);

  const removeItem = useCallback((localId: string) => {
    setItems(prev => {
      const item = prev.find(i => i.localId === localId);
      if (item) {
        URL.revokeObjectURL(item.photoUrl);
        if (item.thumbnailUrl) {
          URL.revokeObjectURL(item.thumbnailUrl);
        }
      }
      return prev.filter(i => i.localId !== localId);
    });
  }, []);

  const clearSession = useCallback(() => {
    items.forEach(item => {
      URL.revokeObjectURL(item.photoUrl);
      if (item.thumbnailUrl) {
        URL.revokeObjectURL(item.thumbnailUrl);
      }
    });
    setItems([]);
    setProjectId(null);
  }, [items]);

  const getItem = useCallback((localId: string) => {
    return items.find(item => item.localId === localId);
  }, [items]);

  const isActive = projectId !== null && items.length > 0;

  return (
    <TodoSessionContext.Provider
      value={{
        items,
        projectId,
        isActive,
        startSession,
        addItem,
        updateItem,
        removeItem,
        clearSession,
        getItem,
      }}
    >
      {children}
    </TodoSessionContext.Provider>
  );
}

export function useTodoSession() {
  const context = useContext(TodoSessionContext);
  if (!context) {
    throw new Error("useTodoSession must be used within TodoSessionProvider");
  }
  return context;
}
