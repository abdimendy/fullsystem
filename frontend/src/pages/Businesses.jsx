import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { HiSearch } from 'react-icons/hi';
import { businessApi } from '../api/businessApi';
import { categoryApi } from '../api/categoryApi';
import { isUsingBundledPublicApi } from '../api/configureApi';
import BusinessCard from '../components/BusinessCard';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { DownloadDirectoryPdfButton } from '../components/DownloadPdfButton';
import SkeletonCard from '../components/SkeletonCard';
import { demoBusinessList, demoCategories } from '../data/demoData';
import { ensureArray, normalizeSearchResponse } from '../utils/apiHelpers';
import { fadeUp } from '../utils/motion';
import { trackEvent } from '../utils/analytics';
import SeoHead from '../components/SeoHead';
import { useLanguage } from '../context/LanguageContext';

const PAGE_SIZE = 12;

export default function Businesses() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [results, setResults] = useState({
    items: [],
    totalPages: 1,
    page: 1,
    totalCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const name = searchParams.get('name') || searchParams.get('q') || '';
  const categoryId = searchParams.get('categoryId') || '';
  const city = searchParams.get('city') || '';
  const page = Number(searchParams.get('page')) || 1;

  const [filters, setFilters] = useState({ name, categoryId, city });

  useEffect(() => {
    categoryApi
      .getAll()
      .then((r) => setCategories(ensureArray(r.data)))
      .catch(() => setCategories(demoCategories));
  }, []);

  useEffect(() => {
    setFilters({ name, categoryId, city });
  }, [name, categoryId, city]);

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await businessApi.search({
        name: name.trim() || undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
        city: city.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setResults(normalizeSearchResponse(data, page, PAGE_SIZE));
    } catch {
      if (isUsingBundledPublicApi()) {
        const start = (page - 1) * PAGE_SIZE;
        const items = demoBusinessList.slice(start, start + PAGE_SIZE);
        setResults({
          items,
          totalCount: demoBusinessList.length,
          page,
          pageSize: PAGE_SIZE,
          totalPages: Math.max(1, Math.ceil(demoBusinessList.length / PAGE_SIZE)),
        });
      } else {
        toast.error(t('business.loadError'));
        setResults({ items: [], totalCount: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
      }
    } finally {
      setLoading(false);
    }
  }, [name, categoryId, city, page]);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  const applyFilters = (e) => {
    e.preventDefault();
    const next = new URLSearchParams();
    if (filters.name?.trim()) next.set('name', filters.name.trim());
    if (filters.categoryId) next.set('categoryId', filters.categoryId);
    if (filters.city?.trim()) next.set('city', filters.city.trim());
    next.set('page', '1');
    setSearchParams(next);
    trackEvent('search', { path: '/businesses' });
  };

  const clearFilters = () => {
    setFilters({ name: '', categoryId: '', city: '' });
    setSearchParams({});
  };

  const onPageChange = (p) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasActiveFilters = Boolean(name || categoryId || city);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <SeoHead title={t('business.directory')} description={t('business.directoryDesc')} path="/businesses" />
      <motion.div {...fadeUp} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <motion.div>
          <h1 className="section-title">{t('business.directory')}</h1>
          <p className="section-subtitle">
            {results.totalCount > 0
              ? t('business.showing', { shown: results.items.length, total: results.totalCount })
              : hasActiveFilters
                ? t('business.noMatches')
                : t('business.searchHint')}
          </p>
        </motion.div>
        <DownloadDirectoryPdfButton filterParams={{ name: name || undefined, categoryId: categoryId || undefined, city: city || undefined }} />
      </motion.div>

      <form
        onSubmit={applyFilters}
        className="card mt-8 grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-5"
      >
        <input
          type="search"
          placeholder={t('common.namePhoneEmail')}
          value={filters.name}
          onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
          className="input-field sm:col-span-2"
          aria-label="Search businesses"
        />
        <select
          value={filters.categoryId}
          onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
          className="input-field"
          aria-label="Category"
        >
          <option value="">{t('common.allCategories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder={t('common.cityPlaceholder')}
          value={filters.city}
          onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
          className="input-field"
          aria-label="City"
        />
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <button type="submit" className="btn-primary flex-1 justify-center">
            <HiSearch /> {t('common.search')}
          </button>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="btn-secondary px-4">
              {t('common.clear')}
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : results.items?.length ? (
        <>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {results.items.map((b) => (
              <BusinessCard key={b.id} business={b} />
            ))}
          </div>
          <div className="mt-12">
            <Pagination
              page={results.page}
              totalPages={results.totalPages}
              onPageChange={onPageChange}
            />
          </div>
        </>
      ) : (
        <div className="mt-10">
          <EmptyState
            title={t('business.emptyTitle')}
            message={t('business.emptyMessage')}
            actionLabel={hasActiveFilters ? t('business.clearFilters') : undefined}
            onAction={hasActiveFilters ? clearFilters : undefined}
          />
        </div>
      )}
    </div>
  );
}
