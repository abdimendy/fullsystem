import api from './axiosInstance';
import { blobErrorMessage, downloadBlob } from '../utils/downloadBlob';

function responseContentType(headers) {
  if (!headers) return '';
  if (typeof headers.get === 'function') return headers.get('content-type') || '';
  return headers['content-type'] || headers['Content-Type'] || '';
}

/** Detect PDF even when the browser leaves Blob.type empty (common on some hosts). */
async function isPdfPayload(data, headers, status) {
  if (status >= 400) return false;
  const ct = `${data?.type || ''} ${responseContentType(headers)}`.toLowerCase();
  if (ct.includes('pdf')) return true;
  if (!(data instanceof Blob) || data.size < 4) return false;
  const head = await data.slice(0, 4).text();
  return head === '%PDF';
}

async function fetchPdf(path, filename) {
  let response;
  try {
    response = await api.get(path, {
      responseType: 'blob',
      timeout: 90000,
      // Do not run JSON/demo interceptors that assume structured GET bodies
      skipDemoFallback: true,
    });
  } catch (err) {
    const blob = err.response?.data;
    const message = blob instanceof Blob
      ? await blobErrorMessage(blob, 'Could not generate PDF')
      : err.friendlyMessage || 'Could not generate PDF';
    throw { friendlyMessage: message };
  }

  const { data, headers, status } = response;
  if (!(await isPdfPayload(data, headers, status))) {
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
