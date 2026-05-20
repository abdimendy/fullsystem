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

function isRetryablePdfError(err) {
  if (!err) return false;
  if (!err.response) return true;
  const status = err.response.status;
  return status === 502 || status === 503 || status === 504 || status === 429;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPdfOnce(path, filename) {
  let response;
  try {
    response = await api.get(path, {
      responseType: 'blob',
      timeout: 90000,
      skipDemoFallback: true,
    });
  } catch (err) {
    const blob = err.response?.data;
    const message =
      blob instanceof Blob
        ? await blobErrorMessage(blob, 'Could not generate PDF')
        : err.friendlyMessage || 'Could not generate PDF';
    const wrapped = { friendlyMessage: message, response: err.response, code: err.code };
    throw wrapped;
  }

  const { data, headers, status } = response;
  if (!(await isPdfPayload(data, headers, status))) {
    const message = await blobErrorMessage(data, 'Could not generate PDF');
    throw { friendlyMessage: message, response };
  }
  downloadBlob(data, filename);
}

async function fetchPdf(path, filename, maxAttempts = 3) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await fetchPdfOnce(path, filename);
      return;
    } catch (err) {
      lastErr = err;
      if (!isRetryablePdfError(err) || attempt === maxAttempts - 1) throw err;
      await sleep(1200 * (attempt + 1));
    }
  }
  throw lastErr;
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
