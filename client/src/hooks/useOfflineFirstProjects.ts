import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { indexedDB as idb } from '@/lib/indexeddb';
import type { Project, Photo } from '../../../shared/schema';

type ProjectWithCounts = Project & { photoCount: number; coverPhoto?: Photo };

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
  
  // Track if we've already saved this session - only save ONCE per component mount
  const hasSavedRef = useRef<boolean>(false);

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
  // Only saves ONCE per component mount to prevent infinite loops
  useEffect(() => {
    // Skip if already saved this session or no projects
    if (hasSavedRef.current || serverProjects.length === 0) {
      return;
    }
    
    // Mark as saved IMMEDIATELY to prevent any race conditions
    hasSavedRef.current = true;
    
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
        
        console.log('[Offline] Saved', serverProjects.length, 'projects to IndexedDB (once per session)');
      } catch (error) {
        console.error('[Offline] Failed to save projects to IndexedDB:', error);
      }
    };

    saveToIndexedDB();
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
