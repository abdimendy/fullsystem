import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaBuilding, FaCreditCard, FaExclamationTriangle, FaRedo, FaStar, FaTags } from 'react-icons/fa';
import { dashboardApi } from '../../api/dashboardApi';
import { paymentApi } from '../../api/paymentApi';
import { pdfApi } from '../../api/pdfApi';
import { useLanguage } from '../../context/LanguageContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { ensureArray } from '../../utils/apiHelpers';

const emptyStats = {
  totalBusinesses: 0,
  totalCategories: 0,
  totalReviews: 0,
  totalPayments: 0,
  totalPaymentAmount: 0,
  businessesByCategory: [],
  recentBusinesses: [],
};

export default function AdminDashboard() {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const [statsResult, payResult] = await Promise.allSettled([
        dashboardApi.getStats(),
        paymentApi.getAll(),
      ]);

      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value.data);
      } else {
        const msg =
          statsResult.reason?.friendlyMessage ||
          'Cannot reach API. Start backend: cd backend/YellowBook.API && dotnet run';
        setApiError(msg);
        setStats(emptyStats);
        toast.error(msg);
      }

      if (payResult.status === 'fulfilled') {
        setPayments(ensureArray(payResult.value.data).slice(0, 8));
      } else {
        setPayments([]);
      }
    } catch (err) {
      const msg = err.friendlyMessage || 'Cannot reach API. Start the backend on port 5261.';
      setApiError(msg);
      setStats(emptyStats);
      setPayments([]);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleReport = async () => {
    setReportLoading(true);
    try {
      await pdfApi.downloadReport();
      toast.success(t('admin.reportDownloaded'));
    } catch (err) {
      toast.error(err.friendlyMessage || t('admin.reportFailed'));
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const displayStats = stats ?? emptyStats;
  const maxCategoryCount = Math.max(
    ...(ensureArray(displayStats.businessesByCategory).map((c) => c.count) || [1]),
    1
  );

  const statCards = [
    { label: 'Businesses', value: displayStats.totalBusinesses ?? 0, icon: FaBuilding, color: 'text-amber-500' },
    { label: 'Categories', value: displayStats.totalCategories ?? 0, icon: FaTags, color: 'text-blue-500' },
    { label: 'Reviews', value: displayStats.totalReviews ?? 0, icon: FaStar, color: 'text-purple-500' },
    { label: 'Payments', value: displayStats.totalPayments ?? 0, icon: FaCreditCard, color: 'text-green-500' },
  ];

  return (
    <div className="space-y-8">
      {apiError && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-start gap-3">
            <FaExclamationTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">API not connected</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{apiError}</p>
              <p className="mt-2 text-sm text-slate-500">
                Run: <code className="rounded bg-white px-1.5 py-0.5 text-xs dark:bg-slate-800">dotnet run</code> in{' '}
                <code className="rounded bg-white px-1.5 py-0.5 text-xs dark:bg-slate-800">backend/YellowBook.API</code>
              </p>
            </div>
          </div>
          <button type="button" onClick={load} className="btn-primary">
            <FaRedo className="h-4 w-4" /> Retry
          </button>
        </div>
      )}

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-yellow-500 to-orange-500 p-8 shadow-xl shadow-amber-500/20">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-amber-950/70">Admin</p>
            <h2 className="text-3xl font-extrabold text-slate-900">Dashboard</h2>
            <p className="mt-2 text-slate-800/80">Overview of your YellowBook directory</p>
          </div>
          <button
            type="button"
            onClick={handleReport}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-50"
            disabled={reportLoading}
          >
            {reportLoading ? '…' : t('admin.downloadReport')}
          </button>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat-card border-amber-200/50 dark:border-slate-700">
            <div className="inline-flex rounded-2xl bg-gradient-to-br from-amber-100 to-yellow-100 p-3 dark:from-amber-500/20 dark:to-yellow-500/10">
              <Icon className={`h-7 w-7 ${color}`} />
            </div>
            <p className="mt-4 text-3xl font-extrabold text-slate-900 dark:text-white">{value}</p>
            <p className="text-sm font-medium text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="stat-card border-amber-200/50 bg-gradient-to-r from-white to-amber-50/50 dark:border-slate-700 dark:from-slate-800 dark:to-amber-500/5">
        <p className="text-sm font-medium text-slate-500">Total payment amount</p>
        <p className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">
          ${Number(displayStats.totalPaymentAmount ?? 0).toFixed(2)}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="card p-6 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Businesses by Category</h3>
            <Link to="/admin/categories" className="text-sm font-semibold text-amber-600 hover:text-amber-700">
              Manage
            </Link>
          </div>
          {ensureArray(displayStats.businessesByCategory).length === 0 ? (
            <EmptyState title="No category data" className="py-8" />
          ) : (
            <ul className="mt-6 space-y-4">
              {ensureArray(displayStats.businessesByCategory).map((c) => (
                <li key={c.categoryName}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{c.categoryName}</span>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                      {c.count}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 transition-all duration-500"
                      style={{ width: `${(c.count / maxCategoryCount) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-6 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Businesses</h3>
            <Link to="/admin/businesses" className="text-sm font-semibold text-amber-600 hover:text-amber-700">
              Manage
            </Link>
          </div>
          {ensureArray(displayStats.recentBusinesses).length === 0 ? (
            <EmptyState title="No businesses yet" className="py-8" />
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-700">
              {ensureArray(displayStats.recentBusinesses).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{b.name}</p>
                    <p className="text-xs text-slate-500">
                      {b.categoryName} · {b.city}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    New
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card overflow-hidden overflow-x-auto p-6 dark:border-slate-700">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Payments</h3>
        {payments.length === 0 ? (
          <EmptyState title="No payments recorded" className="py-8" />
        ) : (
          <table className="mt-4 w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                <th className="px-3 py-3 font-semibold">Business</th>
                <th className="px-3 py-3 font-semibold">Amount</th>
                <th className="px-3 py-3 font-semibold">Method</th>
                <th className="px-3 py-3 font-semibold">Transaction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-amber-50/30 dark:hover:bg-amber-500/5">
                  <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{p.businessName}</td>
                  <td className="px-3 py-3 font-semibold text-amber-600">${Number(p.amount).toFixed(2)}</td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-400">{p.paymentMethod}</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-500">{p.transactionNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
