const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = payload.code;
    this.details = payload.details;
  }
}

type TokenGetter = () => { accessToken: string | null; refreshToken: string | null };
type TokenSetter = (tokens: { accessToken: string; refreshToken: string }) => void;
type LogoutHandler = () => void;

let getTokens: TokenGetter = () => ({ accessToken: null, refreshToken: null });
let setTokens: TokenSetter = () => undefined;
let onLogout: LogoutHandler = () => undefined;

/** Conecta o cliente HTTP ao store de autenticação (evita import circular). */
export function configureApi(handlers: {
  getTokens: TokenGetter;
  setTokens: TokenSetter;
  onLogout: LogoutHandler;
}) {
  getTokens = handlers.getTokens;
  setTokens = handlers.setTokens;
  onLogout = handlers.onLogout;
}

let refreshPromise: Promise<string | null> | null = null;

/** Renova o access token uma única vez, mesmo com várias requisições em paralelo. */
async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const { refreshToken } = getTokens();
    if (!refreshToken) return null;

    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      onLogout();
      return null;
    }

    const data = await res.json();
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data.accessToken as string;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, unknown>;
  skipAuth?: boolean;
  retry?: boolean;
}

function buildUrl(path: string, params?: Record<string, unknown>): string {
  const url = `${BASE_URL}${path}`;
  if (!params) return url;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      value.forEach((v) => search.append(key, String(v)));
    } else if (value instanceof Date) {
      search.append(key, value.toISOString());
    } else {
      search.append(key, String(value));
    }
  }

  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, skipAuth, retry = true } = options;
  const { accessToken } = getTokens();

  const res = await fetch(buildUrl(path, params), {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(!skipAuth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401 && !skipAuth && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(path, { ...options, retry: false });
    }
  }

  if (res.status === 204) return undefined as T;

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    // A sessão aponta para uma empresa que não existe mais ou foi bloqueada:
    // não adianta repetir a requisição, é preciso entrar novamente.
    const code = payload?.error?.code;
    if (res.status === 403 && (code === 'COMPANY_NOT_FOUND' || code === 'COMPANY_BLOCKED')) {
      onLogout();
    }
    throw new ApiError(
      res.status,
      payload?.error ?? { code: 'UNKNOWN', message: 'Erro inesperado ao comunicar com o servidor' },
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, params?: Record<string, unknown>) => request<T>(path, { params }),
  post: <T>(path: string, body?: unknown, params?: Record<string, unknown>) =>
    request<T>(path, { method: 'POST', body, params }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  public: {
    post: <T>(path: string, body?: unknown) =>
      request<T>(path, { method: 'POST', body, skipAuth: true }),
  },
};
