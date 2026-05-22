import { useQuery } from '@tanstack/react-query';
import * as authApi from '../api/auth.js';

// /auth/me carries server-side feature flags alongside the user profile.
// We cache it under a dedicated key so it's stable across re-renders without
// being invalidated by routine profile updates elsewhere in the app.
export interface ServerConfig {
  e2eeEnabled: boolean;
}

export function useServerConfig(): ServerConfig {
  const { data } = useQuery({
    queryKey: ['server-config'],
    queryFn: async () => {
      const me = await authApi.getMe();
      return { e2eeEnabled: Boolean(me.e2eeEnabled) } satisfies ServerConfig;
    },
    staleTime: Infinity,
    // E2EE flag doesn't change during a session. Skip retries — we'd
    // rather degrade to plaintext-permissive mode than spam /me.
    retry: false,
  });
  return data ?? { e2eeEnabled: false };
}
