import axios from 'axios';

// Axios defaults to no timeout, so a request that stalls at the network level
// (e.g. a resumed mobile tab/PWA firing over a dead keep-alive connection)
// hangs indefinitely and pins loading spinners until a manual refresh. The
// timeout converts a hang into a catchable error while staying generous
// enough for slow mobile networks.
export const REQUEST_TIMEOUT_MS = 15_000;

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: REQUEST_TIMEOUT_MS,
});

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest?.url || '';

    // Don't attempt refresh for auth endpoints — let callers handle the error
    const isAuthEndpoint = url.includes('/auth/');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      try {
        const { data } = await axios.post(
          '/api/auth/refresh',
          {},
          { withCredentials: true, timeout: REQUEST_TIMEOUT_MS },
        );
        setAccessToken(data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch {
        setAccessToken(null);
      }
    }

    return Promise.reject(error);
  },
);
