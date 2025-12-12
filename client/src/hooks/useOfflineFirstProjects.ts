import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { indexedDB as idb } from '@/lib/indexeddb';
import type { Project, Photo } from '../../../shared/schema';

type ProjectWithCounts = Project & { photoCount: number; coverPhoto?: Photo };

// Create a stable hash of projects to detect actual data changes
function createProjectsHash(projects: ProjectWithCounts[]): string {
  return projects.map(p => `${p.id}:${p.name}:${p.photoCount}`).sort().join('|');
}

/**
 * Offline-first hook for loading projects
 * 1. Loads from IndexedDB immediately (instant display)
 * 2. Fetches from server in background
 * 3. Merges results (server data takes precedence)
 * 4. Saves server data back to IndexedDB for next offline use
 */
export function useOfflineFirstProjects() {
  const [localProjects, setLocalProjects] = useState<ProjectWithCounts[]>([]);
  const [isLoadingLocal, setIsLoadingLocal] = useState(true);
  
  // Track the last saved hash to prevent infinite save loops
  const lastSavedHashRef = useRef<string>('');

  // Load from IndexedDB immediately
  useEffect(() => {
    const loadLocalProjects = async () => {
      try {
        const projects = await idb.getAllProjects();
        // Convert LocalProject to Project format with photo counts
        const projectsWithCounts: ProjectWithCounts[] = await Promise.all(
          projects.map(async (p) => {
            const photos = await idb.getProjectPhotos(p.serverId || p.id);
            return {
              id: p.serverId || p.id, // Use serverId if available
              name: p.name,
              description: p.description || null,
              address: null, // LocalProject doesn't store address
              latitude: null,
              longitude: null,
              coverPhotoId: null,
              companyId: null,
              createdBy: null,
              completed: false, // LocalProject doesn't track completed status
              coverPhotoUrl: null,
              createdAt: new Date(p.createdAt),
              lastActivityAt: new Date(p.updatedAt),
              deletedAt: null,
              userId: null,
              photoCount: photos.length,
              coverPhoto: undefined,
            };
          })
        );

        setLocalProjects(projectsWithCounts);
      } catch (error) {
        console.error('[Offline] Failed to load projects from IndexedDB:', error);
        setLocalProjects([]);
      } finally {
        setIsLoadingLocal(false);
      }
    };

    loadLocalProjects();
  }, []);

  // Fetch from server in background
  const {
    data: serverProjects = [],
    isLoading: isLoadingServer,
    error: serverError,
  } = useQuery<ProjectWithCounts[]>({
    queryKey: ['/api/projects/with-counts'],
    staleTime: 0,
    retry: false, // Don't retry if offline
    meta: {
      // Custom meta to handle offline gracefully
      skipErrorToast: true,
    },
  });

  // Save server data back to IndexedDB when it arrives
  // Uses hash comparison to prevent infinite loops from array reference changes
  useEffect(() => {
    if (serverProjects.length > 0) {
      // Create a hash of the current projects to detect actual data changes
      const currentHash = createProjectsHash(serverProjects);
      
      // Skip if we already saved this exact data
      if (currentHash === lastSavedHashRef.current) {
        return;
      }
      
      const saveToIndexedDB = async () => {
        try {
          // Save each project to IndexedDB
          for (const project of serverProjects) {
            // Check if project already exists in IndexedDB
            const existing = await idb.getAllProjects();
            const existingProject = existing.find(
              p => p.serverId === project.id || p.id === project.id
            );

            if (existingProject) {
              // Update existing project
              await idb.updateProject(existingProject.id, {
                name: project.name,
                description: project.description || undefined,
                serverId: project.id,
                syncStatus: 'synced',
                photoCount: project.photoCount,
              });
            } else {
              // Save new project to IndexedDB
              await idb.saveProject({
                name: project.name,
                description: project.description || undefined,
                serverId: project.id,
                syncStatus: 'synced',
                photoCount: project.photoCount,
              });
            }
          }
          
          // Update the last saved hash to prevent re-saving the same data
          lastSavedHashRef.current = currentHash;
          console.log('[Offline] Saved', serverProjects.length, 'projects to IndexedDB');
        } catch (error) {
          console.error('[Offline] Failed to save projects to IndexedDB:', error);
        }
      };

      saveToIndexedDB();
    }
  }, [serverProjects]);

  // Merge local and server data (server takes precedence)
  const mergedProjects = serverProjects.length > 0 ? serverProjects : localProjects;

  // Overall loading state - only show loading if both are loading
  const isLoading = isLoadingLocal && isLoadingServer;

  return {
    projects: mergedProjects,
    isLoading,
    isOnline: serverProjects.length > 0 || !serverError,
    hasLocalData: localProjects.length > 0,
  };
}
