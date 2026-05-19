import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FaEdit, FaPlus, FaSearch, FaTrash } from 'react-icons/fa';
import { businessApi } from '../../api/businessApi';
import { categoryApi } from '../../api/categoryApi';
import LoadingSpinner from '../../components/LoadingSpinner';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import ImageUpload from '../../components/ImageUpload';
import { ensureArray } from '../../utils/apiHelpers';
import { resolveImageUrl } from '../../utils/images';

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  description: '',
  categoryId: '',
  logoUrl: '',
  website: '',
  city: 'Mogadishu',
  rating: 4.5,
};

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

export default function AdminBusinesses() {
  const [businesses, setBusinesses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [biz, cats] = await Promise.all([businessApi.getAll(true), categoryApi.getAll()]);
      setBusinesses(ensureArray(biz.data));
      setCategories(ensureArray(cats.data));
    } catch (err) {
      toast.error(err.friendlyMessage || 'Failed to load businesses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      categoryId: categories[0]?.id ? String(categories[0].id) : '',
    });
    setModalOpen(true);
  };

  const openEdit = (b) => {
    setEditing(b);
    setForm({
      name: b.name,
      phone: b.phone,
      email: b.email,
      address: b.address,
      description: b.description || '',
      categoryId: String(b.categoryId),
      logoUrl: b.logoUrl || '',
      website: b.website || '',
      city: b.city || 'Mogadishu',
      rating: b.rating ?? 4.5,
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.categoryId) {
      toast.error('Please select a category');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      description: form.description?.trim() || null,
      categoryId: Number(form.categoryId),
      logoUrl: form.logoUrl?.trim() || null,
      website: form.website?.trim() || null,
      city: form.city.trim() || 'Mogadishu',
      rating: Number(form.rating) || 4.5,
    };
    try {
      if (editing) {
        await businessApi.update(editing.id, payload);
        toast.success('Business updated successfully');
      } else {
        await businessApi.create(payload);
        toast.success('Business added successfully');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.friendlyMessage || 'Could not save business');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await businessApi.delete(id);
      toast.success('Business deleted');
      load();
    } catch (err) {
      toast.error(err.friendlyMessage || 'Delete failed');
    }
  };

  const filtered = businesses.filter(
    (b) =>
      !search.trim() ||
      b.name?.toLowerCase().includes(search.toLowerCase()) ||
      b.categoryName?.toLowerCase().includes(search.toLowerCase()) ||
      b.city?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <motion.div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 shadow-xl">
        <div className="absolute -right-6 -top-6 h-36 w-36 rounded-full bg-amber-500/20 blur-3xl" />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative flex flex-wrap items-center justify-between gap-4"
        >
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-amber-400/90">Directory</p>
            <h2 className="text-3xl font-extrabold text-white">Manage Businesses</h2>
            <p className="mt-2 text-slate-400">{businesses.length} listings in Somalia</p>
          </div>
          <button type="button" onClick={openCreate} className="btn-primary shadow-lg shadow-amber-500/30">
            <FaPlus /> Add Business
          </button>
        </motion.div>
      </div>

      <div className="relative max-w-md">
        <FaSearch className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder="Search businesses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-11"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No businesses found"
          message={search ? 'Try a different search term.' : 'Add your first business listing.'}
          actionLabel="Add Business"
          onAction={openCreate}
        />
      ) : (
        <div className="card overflow-hidden overflow-x-auto dark:border-slate-700">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 text-white dark:border-slate-700">
              <tr>
                <th className="px-4 py-4 font-semibold">Business</th>
                <th className="px-4 py-4 font-semibold">Category</th>
                <th className="px-4 py-4 font-semibold">Phone</th>
                <th className="px-4 py-4 font-semibold">City</th>
                <th className="px-4 py-4 font-semibold">Rating</th>
                <th className="px-4 py-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((b) => (
                <tr key={b.id} className="transition hover:bg-amber-50/40 dark:hover:bg-amber-500/5">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={resolveImageUrl(b.logoUrl, b.name)}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 object-cover shadow-sm dark:border-slate-600"
                      />
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{b.name}</p>
                        <p className="text-xs text-slate-500">{b.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                      {b.categoryName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{b.phone}</td>
                  <td className="px-4 py-3 text-slate-600">{b.city || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-amber-600">
                    {Number(b.rating).toFixed(1)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(b)}
                        className="rounded-lg p-2.5 text-amber-600 transition hover:bg-amber-100"
                        title="Edit"
                      >
                        <FaEdit />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(b.id, b.name)}
                        className="rounded-lg p-2.5 text-red-500 transition hover:bg-red-50"
                        title="Delete"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Business' : 'Add New Business'}
        size="xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Business name" required>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input-field"
              placeholder="e.g. Hormuud Telecom"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" required>
              <input
                required
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="input-field"
                placeholder="+252 61 XXX XXXX"
              />
            </Field>
            <Field label="Email" required>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="input-field"
                placeholder="info@company.so"
              />
            </Field>
          </div>
          <Field label="Address" required>
            <input
              required
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="input-field"
              placeholder="Street, district"
            />
          </Field>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="input-field resize-none"
              rows={3}
              placeholder="Short description of services"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" required>
              <select
                required
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="input-field"
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="City">
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="input-field"
                placeholder="Mogadishu"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rating (0–5)">
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={form.rating}
                onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
                className="input-field"
              />
            </Field>
            <Field label="Website">
              <input
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                className="input-field"
                placeholder="https://"
              />
            </Field>
          </div>
          <Field label="Business photo">
            <ImageUpload
              value={form.logoUrl}
              onChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
              name={form.name || 'Business'}
            />
            <input
              value={form.logoUrl}
              onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
              className="input-field mt-2"
              placeholder="https://image-url.png (optional)"
            />
          </Field>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : editing ? 'Update Business' : 'Create Business'}
            </button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
