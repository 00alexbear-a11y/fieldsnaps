import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { tokenManager } from "./tokenManager";

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
  
  const res = await fetch(url, {
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
    console.log('[QueryClient] Fetching:', url);
    
    // Add JWT token if available (for native apps)
    const token = await tokenManager.getValidAccessToken();
    console.log('[QueryClient] Token retrieved:', token ? `${token.substring(0, 30)}...` : 'NULL');
    
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      console.log('[QueryClient] ✅ Authorization header set');
    } else {
      console.log('[QueryClient] ❌ No token - Authorization header NOT set');
    }
    
    const res = await fetch(url, {
      headers,
      credentials: "include", // Still include for web session-based auth fallback
    });
    
    console.log('[QueryClient] Response status:', res.status);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
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
