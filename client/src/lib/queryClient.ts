import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getSessionId } from "./sessionHelper";

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function withTimeout(timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

function shouldRetry(statusCode: number) {
  return statusCode === 408 || statusCode === 425 || statusCode === 429 || statusCode >= 500;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 2,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const timeout = withTimeout();

    try {
      const res = await fetch(url, { ...init, signal: timeout.signal });
      timeout.clear();

      if (!res.ok && shouldRetry(res.status) && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        continue;
      }

      return res;
    } catch (error) {
      timeout.clear();
      lastError = error;
      if (attempt === retries) {
        throw lastError;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  throw lastError ?? new Error("Failed to fetch");
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const sessionId = getSessionId();
  const headers: Record<string, string> = {};

  if (sessionId) {
    headers.Authorization = `Bearer ${sessionId}`;
  }

  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetchWithRetry(
    url,
    {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    },
    method.toUpperCase() === "GET" ? 2 : 1,
  );

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const sessionId = getSessionId();
    const headers: Record<string, string> = {};

    if (sessionId) {
      headers.Authorization = `Bearer ${sessionId}`;
    }

    const res = await fetchWithRetry(
      queryKey.join("/") as string,
      {
        headers,
        credentials: "include",
      },
      2,
    );

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
      staleTime: 30_000,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    },
    mutations: {
      retry: 1,
      retryDelay: 500,
    },
  },
});
