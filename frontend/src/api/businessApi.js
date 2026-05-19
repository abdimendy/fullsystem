import api from './axiosInstance';
import { demoBusinessList } from '../data/demoData';
import { normalizeSearchResponse } from '../utils/apiHelpers';

async function resolveLiveBusinessByDemoId(id) {
  const demo = demoBusinessList.find((b) => String(b.id) === String(id));
  if (!demo?.name || api.defaults.useBundledPublicApi) return null;
  try {
    const { data } = await api.get('/businesses/search', {
      params: { name: demo.name, page: 1, pageSize: 5 },
    });
    const { items } = normalizeSearchResponse(data, 1, 5);
    const exact = items.find((b) => b.name?.toLowerCase() === demo.name.toLowerCase());
    return exact || items[0] || null;
  } catch {
    return null;
  }
}

export const businessApi = {
  getAll: (admin = false) => api.get('/businesses', { params: admin ? { admin: true } : {} }),
  getPending: () => api.get('/businesses/pending'),
  getFeatured: (count = 6) => api.get('/businesses/featured', { params: { count } }),
  search: ({ name, categoryId, city, page = 1, pageSize = 12 }) =>
    api.get('/businesses/search', { params: { name, categoryId, city, page, pageSize } }),
  getById: async (id) => {
    try {
      return await api.get(`/businesses/${id}`);
    } catch (err) {
      if (err.response?.status !== 404) throw err;
      const live = await resolveLiveBusinessByDemoId(id);
      if (live) return { data: live };
      throw err;
    }
  },
  create: (data) => api.post('/businesses', data),
  submit: (data) => api.post('/businesses/submit', data),
  approve: (id) => api.post(`/businesses/${id}/approve`),
  update: (id, data) => api.put(`/businesses/${id}`, data),
  delete: (id) => api.delete(`/businesses/${id}`),
  exportCsv: (params = {}) =>
    api.get('/businesses/export.csv', { params, responseType: 'blob' }),
};
