import type {
  Achievement,
  Alert,
  AlertListResponse,
  AnalyticsSummary,
  BrowseRecord,
  DiversityItem,
  Favorite,
  FavoriteStatus,
  Genus,
  LoginResult,
  PlantDetailResponse,
  PlantListResponse,
  PlantStats,
  Quiz,
  QuizAttempt,
  QuizResult,
  QuizSubmitPayload,
  RegionalData,
  TaxaFamily,
  TaxonomyNode,
  UserProfile,
  UserStats,
  WeeklyActivity
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001/api';
const DEFAULT_GET_CACHE_TTL_MS = 30 * 1000;
const MAX_RESPONSE_CACHE_ENTRIES = 300;

type RequestOptions = {
  cacheTtlMs?: number;
};

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

const responseCache = new Map<string, { expiresAt: number; data: unknown }>();
const inflightRequests = new Map<string, Promise<unknown>>();

function notifyRedlistAlertStateChanged() {
  window.dispatchEvent(new CustomEvent('redlist-alerts-updated'));
}

function pruneExpiredCacheEntries() {
  const now = Date.now();
  for (const [key, value] of responseCache.entries()) {
    if (value.expiresAt <= now) {
      responseCache.delete(key);
    }
  }
}

function enforceCacheLimit() {
  pruneExpiredCacheEntries();

  while (responseCache.size > MAX_RESPONSE_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (!oldestKey) break;
    responseCache.delete(oldestKey);
  }
}

function buildRequestCacheKey(pathname: string, init?: RequestInit) {
  const method = (init?.method || 'GET').toUpperCase();
  const authHeader = init?.headers instanceof Headers
    ? init.headers.get('Authorization') || ''
    : Array.isArray(init?.headers)
      ? init.headers.find(([key]) => key.toLowerCase() === 'authorization')?.[1] || ''
      : (init?.headers as Record<string, string> | undefined)?.Authorization || '';

  return JSON.stringify({
    method,
    pathname,
    authHeader
  });
}

export function invalidateApiCache(pathPrefix: string) {
  const targets = Array.from(responseCache.keys()).filter((key) => key.includes(`"pathname":"${pathPrefix}`));
  targets.forEach((key) => responseCache.delete(key));
}

async function request<T>(pathname: string, init?: RequestInit, options?: RequestOptions): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase();
  const cacheKey = buildRequestCacheKey(pathname, init);
  const cacheTtlMs = options?.cacheTtlMs ?? DEFAULT_GET_CACHE_TTL_MS;

  if (method === 'GET') {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      responseCache.delete(cacheKey);
      responseCache.set(cacheKey, cached);
      return cached.data as T;
    }

    if (cached) {
      responseCache.delete(cacheKey);
    }

    const inflight = inflightRequests.get(cacheKey);
    if (inflight) {
      return inflight as Promise<T>;
    }
  }

  const requestPromise = fetch(`${API_BASE_URL}${pathname}`, init)
    .then(async (response) => {
      const json = await response.json() as ApiEnvelope<T>;
      if (!response.ok || json.code >= 400) {
        throw new Error(json.message || `Request failed: ${response.status}`);
      }

      if (method === 'GET' && cacheTtlMs > 0) {
        responseCache.set(cacheKey, {
          expiresAt: Date.now() + cacheTtlMs,
          data: json.data
        });
        enforceCacheLimit();
      }

      return json.data;
    })
    .finally(() => {
      inflightRequests.delete(cacheKey);
    });

  if (method === 'GET') {
    inflightRequests.set(cacheKey, requestPromise);
  }

  return requestPromise;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

export function getPlants(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  const keyword = String(params.q || params.keyword || '').trim();
  const pathname = keyword ? '/search/plants' : '/plants';

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      if (keyword && key === 'pageSize') {
        search.set('limit', String(value));
      } else {
        search.set(key, String(value));
      }
    }
  });

  if (keyword && !search.get('sort')) {
    search.set('sort', 'relevance');
  }

  if (keyword) {
    return request<{ list: PlantListResponse['list']; pagination: { total: number; page: number; limit: number } }>(`${pathname}?${search.toString()}`, undefined, { cacheTtlMs: 15 * 1000 })
      .then((data) => ({
        list: data.list,
        total: data.pagination.total,
        page: data.pagination.page,
        pageSize: data.pagination.limit
      }));
  }

  return request<PlantListResponse>(`${pathname}?${search.toString()}`, undefined, { cacheTtlMs: 15 * 1000 });
}

export function getPlantStats() {
  return request<PlantStats>('/plants/stats', undefined, { cacheTtlMs: 60 * 1000 });
}

export function getPlantDetail(id: string) {
  return request<PlantDetailResponse>(`/plants/${id}`, undefined, { cacheTtlMs: 60 * 1000 });
}

export function prefetchPlantDetail(id: string) {
  return getPlantDetail(id).catch(() => null);
}

export function getFamilies() {
  return request<TaxaFamily[]>('/taxa/families', undefined, { cacheTtlMs: 5 * 60 * 1000 });
}

export function getTaxonomyChildren(parentId?: string) {
  const search = new URLSearchParams();
  if (parentId) {
    search.set('parentId', parentId);
  }

  const query = search.toString();
  return request<TaxonomyNode[]>(`/taxa/tree/children${query ? `?${query}` : ''}`, undefined, { cacheTtlMs: 5 * 60 * 1000 });
}

export function getGenera(taxaId: string) {
  return request<{ list: Genus[]; total: number }>(`/taxa/${taxaId}/genera`, undefined, { cacheTtlMs: 5 * 60 * 1000 });
}

export function getAnalyticsSummary() {
  return request<AnalyticsSummary>('/plants/analytics/summary', undefined, { cacheTtlMs: 60 * 1000 });
}

export function recordBrowseEvent(plantId: string, token: string) {
  return request('/browse-events', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ plant_id: Number(plantId) })
  });
}

export function getDiversity(groupBy = 'division') {
  return request<DiversityItem[]>(`/wcvp-analytics/diversity?groupBy=${groupBy}`);
}

export function getHeatmap() {
  return request<RegionalData[]>('/wcvp-analytics/heatmap');
}

export async function getAlerts() {
  const data = await request<{ total?: number; data?: Alert[]; alerts?: Alert[] } | Alert[]>('/redlist/alerts?limit=5', undefined, { cacheTtlMs: 60 * 1000 });
  if (Array.isArray(data)) return data;
  return data.alerts || data.data || [];
}

export function getAlertsFiltered(params?: { limit?: number; page?: number; alertLevel?: string; changeType?: string }) {
  const search = new URLSearchParams();
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.page) search.set('page', String(params.page));
  if (params?.alertLevel && params.alertLevel !== 'all') search.set('alertLevel', params.alertLevel);
  if (params?.changeType && params.changeType !== 'all') search.set('changeType', params.changeType);
  const query = search.toString();

  return request<AlertListResponse>(`/redlist/alerts${query ? `?${query}` : ''}`, undefined, { cacheTtlMs: 30 * 1000 });
}

export function getMyAlerts(token: string, params?: { unreadOnly?: boolean; includeDismissed?: boolean; limit?: number; page?: number; alertLevel?: string; changeType?: string }) {
  const search = new URLSearchParams();
  if (params?.unreadOnly) search.set('unreadOnly', 'true');
  if (params?.includeDismissed) search.set('includeDismissed', 'true');
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.page) search.set('page', String(params.page));
  if (params?.alertLevel && params.alertLevel !== 'all') search.set('alertLevel', params.alertLevel);
  if (params?.changeType && params.changeType !== 'all') search.set('changeType', params.changeType);
  const query = search.toString();

  return request<AlertListResponse>(`/redlist/alerts/me${query ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` }
  }, { cacheTtlMs: 0 });
}

export function getAlertUnreadCount(token: string) {
  return request<{ total: number }>('/redlist/alerts/unread-count', {
    headers: { Authorization: `Bearer ${token}` }
  }, { cacheTtlMs: 0 });
}

export async function markAlertRead(alertId: number, token: string) {
  const result = await request(`/redlist/alerts/${alertId}/read`, {
    method: 'POST',
    headers: authHeaders(token)
  });
  invalidateApiCache('/redlist/alerts/me');
  invalidateApiCache('/redlist/alerts/unread-count');
  notifyRedlistAlertStateChanged();
  return result;
}

export async function dismissAlert(alertId: number, token: string) {
  const result = await request(`/redlist/alerts/${alertId}/dismiss`, {
    method: 'POST',
    headers: authHeaders(token)
  });
  invalidateApiCache('/redlist/alerts/me');
  invalidateApiCache('/redlist/alerts/unread-count');
  notifyRedlistAlertStateChanged();
  return result;
}

export async function restoreAlert(alertId: number, token: string) {
  const result = await request(`/redlist/alerts/${alertId}/restore`, {
    method: 'POST',
    headers: authHeaders(token)
  });
  invalidateApiCache('/redlist/alerts/me');
  invalidateApiCache('/redlist/alerts/unread-count');
  notifyRedlistAlertStateChanged();
  return result;
}

export async function markAllAlertsRead(token: string) {
  const result = await request('/redlist/alerts/read-all', {
    method: 'POST',
    headers: authHeaders(token)
  });
  invalidateApiCache('/redlist/alerts/me');
  invalidateApiCache('/redlist/alerts/unread-count');
  notifyRedlistAlertStateChanged();
  return result;
}

export async function getFavorites(token: string) {
  const data = await request<Array<{ plant_id: string; plant: any; created_at?: string }>>('/favorites', {
    headers: { Authorization: `Bearer ${token}` }
  });

  return data.map((item) => ({
    plant_id: String(item.plant_id),
    chinese_name: item.plant?.chinese_name || item.plant?.scientific_name || '',
    scientific_name: item.plant?.scientific_name || '',
    cover_image: item.plant?.cover_image || null,
    category: item.plant?.category || null,
    saved_at: item.created_at
  })) as Favorite[];
}

export function getFavoriteStatus(plantId: string, token: string) {
  return request<FavoriteStatus>(`/favorites/status/${plantId}`, {
    headers: { Authorization: `Bearer ${token}` }
  }, { cacheTtlMs: 15 * 1000 });
}

export async function createFavorite(plantId: string, token: string) {
  const result = await request('/favorites', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ plant_id: plantId })
  });
  invalidateApiCache('/favorites');
  return result;
}

export async function deleteFavorite(plantId: string, token: string) {
  const result = await request(`/favorites/${plantId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  invalidateApiCache('/favorites');
  return result;
}

export async function getBrowseHistory(token: string) {
  const data = await request<{ data: BrowseRecord[] }>('/browse-events', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data.data || [];
}

export function getWeeklyActivity(token: string) {
  return request<WeeklyActivity[]>('/browse-events/weekly-stats', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function getQuizzes() {
  const data = await request<Array<{ id: number; title: string }>>('/quizzes');
  return data.map((item) => ({
    id: String(item.id),
    title: item.title,
    questions: []
  })) as Quiz[];
}

export function getQuizById(id: string) {
  return request<Quiz>(`/quizzes/${id}`);
}

export function submitQuizAttempt(quizId: string, payload: QuizSubmitPayload, token: string) {
  return request<QuizResult>(`/quizzes/${quizId}/attempts`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload)
  });
}

export function getQuizAttemptHistory(token: string) {
  return request<QuizAttempt[]>('/quizzes/attempts/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export function getUserProfile(token: string) {
  return request<UserProfile>('/user/profile', {
    headers: { Authorization: `Bearer ${token}` }
  }, { cacheTtlMs: 30 * 1000 });
}

export function getUserStats(token: string) {
  return request<UserStats>('/user/stats', {
    headers: { Authorization: `Bearer ${token}` }
  }, { cacheTtlMs: 30 * 1000 });
}

export function getUserAchievements(token: string) {
  return request<Achievement[]>('/user/achievements', {
    headers: { Authorization: `Bearer ${token}` }
  }, { cacheTtlMs: 30 * 1000 });
}

export function login(username: string, password: string) {
  return request<LoginResult>('/user/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
}

export function register(username: string, email: string, password: string) {
  return request<null>('/user/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });
}
