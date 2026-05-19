import api from './axiosInstance';
import { blobErrorMessage, downloadBlob } from '../utils/downloadBlob';

async function fetchPdf(path, filename) {
  const { data, headers } = await api.get(path, { responseType: 'blob', timeout: 60000 });
  const type = data?.type || headers?.['content-type'] || '';
  if (!type.includes('pdf')) {
    const message = await blobErrorMessage(data, 'Could not generate PDF');
    throw { friendlyMessage: message };
  }
  downloadBlob(data, filename);
}

export const pdfApi = {
  downloadBusiness: (id) =>
    fetchPdf(`/pdf/business/${id}`, `yellowbook-business-${id}.pdf`),
  downloadDirectory: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.name) qs.set('name', params.name);
    if (params.categoryId) qs.set('categoryId', params.categoryId);
    if (params.city) qs.set('city', params.city);
    const q = qs.toString();
    return fetchPdf(`/pdf/report${q ? `?${q}` : ''}`, 'yellowbook-directory.pdf');
  },
  /** Admin dashboard — full directory report PDF */
  downloadReport: () => fetchPdf('/pdf/report', 'yellowbook-report.pdf'),
};
