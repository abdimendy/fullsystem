import {
  demoBusinessList,
  demoCategories,
  demoReviews,
  demoStats,
} from '../data/demoData';

function parseUrl(config) {
  const raw = config?.url || '';
  const [path, query = ''] = raw.split('?');
  const params = new URLSearchParams(query);
  return { path, params };
}

function filterBusinesses({ name, categoryId, city }) {
  let list = [...demoBusinessList];
  const n = name?.trim().toLowerCase();
  if (n) {
    list = list.filter(
      (b) =>
        b.name.toLowerCase().includes(n) ||
        b.description?.toLowerCase().includes(n) ||
        b.address?.toLowerCase().includes(n)
    );
  }
  if (categoryId) {
    const cid = Number(categoryId);
    list = list.filter((b) => b.categoryId === cid);
  }
  if (city?.trim()) {
    const c = city.trim().toLowerCase();
    list = list.filter((b) => b.city?.toLowerCase().includes(c));
  }
  return list;
}

function paginate(list, page = 1, pageSize = 12) {
  const p = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Number(pageSize) || 12);
  const totalCount = list.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / size));
  const start = (p - 1) * size;
  return {
    items: list.slice(start, start + size),
    totalCount,
    page: p,
    pageSize: size,
    totalPages,
  };
}

/** Returns demo payload for a failed public GET, or null if not handled. */
export function getDemoResponse(config) {
  const method = (config?.method || 'get').toLowerCase();
  if (method !== 'get') return null;

  const { path, params } = parseUrl(config);

  if (path === '/categories') return demoCategories;

  if (path === '/businesses') return demoBusinessList;

  if (path === '/businesses/featured') {
    const count = Number(params.get('count')) || 6;
    return demoBusinessList.slice(0, count);
  }

  if (path === '/businesses/search') {
    return paginate(
      filterBusinesses({
        name: params.get('name') || undefined,
        categoryId: params.get('categoryId') || undefined,
        city: params.get('city') || undefined,
      }),
      params.get('page'),
      params.get('pageSize')
    );
  }

  const bizMatch = path.match(/^\/businesses\/(\d+)$/);
  if (bizMatch) {
    const id = Number(bizMatch[1]);
    return demoBusinessList.find((b) => b.id === id) ?? null;
  }

  const revMatch = path.match(/^\/reviews\/business\/(\d+)$/);
  if (revMatch) {
    const businessId = Number(revMatch[1]);
    return demoReviews.filter((r) => r.businessId === businessId);
  }

  if (path === '/dashboard/stats' || path === '/dashboard') return demoStats;

  if (path === '/payments') return [];

  if (path === '/businesses/pending') return [];

  if (path === '/analytics/summary') {
    return {
      totalPageViews: 0,
      totalBusinessViews: 0,
      totalSearches: 0,
      unreadMessages: 0,
      pendingBusinesses: 0,
      popularBusinesses: [],
    };
  }

  return null;
}

function isPublicGetUrl(url) {
  const path = (url || '').split('?')[0];
  return (
    path === '/categories' ||
    path === '/businesses' ||
    path === '/businesses/featured' ||
    path === '/businesses/search' ||
    path.startsWith('/businesses/') ||
    path.startsWith('/reviews/business/') ||
    path === '/dashboard/stats' ||
    path === '/dashboard' ||
    path === '/health' ||
    path === '/payments' ||
    path === '/businesses/pending' ||
    path === '/analytics/summary' ||
    /^\/businesses\/\d+$/.test(path)
  );
}

export function shouldUseDemoFallback(error) {
  if (!error.config) return false;
  const method = (error.config.method || 'get').toLowerCase();
  if (method !== 'get') return false;

  const url = error.config?.url || '';
  if (!isPublicGetUrl(url)) return false;

  if (!error.response) return true;

  const status = error.response.status;
  const contentType = error.response.headers?.['content-type'] || '';

  if (status === 404 || status >= 500) return true;
  if (status === 401 || status === 403) return true;
  if (error.friendlyMessage?.includes('invalid response')) return true;
  if (!contentType.includes('json')) return true;

  return false;
}
