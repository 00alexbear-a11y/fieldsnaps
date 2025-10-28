import { QueryClient, QueryFunction, QueryCache, MutationCache } from "@tanstack/react-query";
import { tokenManager } from "./tokenManager";
import { getApiUrl } from "./apiUrl";
import { toast } from "@/hooks/use-toast";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  
  // Add JWT token if available (for native apps)
  const token = await tokenManager.getValidAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const res = await fetch(getApiUrl(url), {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // Still include for web session-based auth fallback
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    
    // Add JWT token if available (for native apps)
    const token = await tokenManager.getValidAccessToken();
    
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const res = await fetch(getApiUrl(url), {
      headers,
      credentials: "include", // Still include for web session-based auth fallback
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      // Show toast for query errors (except 401 auth errors handled elsewhere)
      if (error instanceof Error && !error.message.includes('401')) {
        toast({
          title: 'Network Error',
          description: error.message || 'Failed to load data. Please check your connection.',
          variant: 'destructive',
          duration: 4000,
        });
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      // Show toast for mutation errors (except 401 auth errors handled elsewhere)
      if (error instanceof Error && !error.message.includes('401')) {
        toast({
          title: 'Operation Failed',
          description: error.message || 'Something went wrong. Please try again.',
          variant: 'destructive',
          duration: 4000,
        });
      }
    },
  }),
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 0, // Allow queries to refetch after invalidation
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
