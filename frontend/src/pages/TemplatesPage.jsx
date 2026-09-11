import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { FileText, Search, Plus, Trash2, Edit2, Copy, X, Check } from 'lucide-react';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/templates?search=${encodeURIComponent(search)}&limit=100`);
      setTemplates(res.data.data.templates || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [search]);

  const openAddModal = () => {
    setEditId(null);
    setName('');
    setContent('');
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (t) => {
    setEditId(t.id);
    setName(t.name);
    setContent(t.content);
    setFormError('');
    setShowModal(true);
  };

  const handleInsertVariable = (varName) => {
    setContent((prev) => prev + ` {{${varName}}}`);
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      if (editId) {
        await apiClient.put(`/templates/${editId}`, { name, content });
      } else {
        await apiClient.post('/templates', { name, content });
      }
      setShowModal(false);
      fetchTemplates();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save template');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id, templateName) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus template "${templateName}"?`)) return;
    try {
      await apiClient.delete(`/templates/${id}`);
      fetchTemplates();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete template');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Template Pesan</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Buat format pesan respon cepat dan broadcast yang dapat disisipi variabel dinamis.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-xs shadow-blue-500/20 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Template Baru</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Cari template berdasarkan nama atau isi kalimat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-16 text-center text-slate-400 text-sm">
            Memuat daftar template...
          </div>
        ) : templates.length === 0 ? (
          <div className="col-span-full p-16 text-center text-slate-400 text-sm bg-white border border-slate-200 rounded-3xl">
            Belum ada template pesan tersimpan. Klik "Tambah Template Baru" untuk membuat.
          </div>
        ) : (
          templates.map((t) => (
            <div key={t.id} className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition">
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm">{t.name}</h3>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => openEditModal(t)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id, t.name)}
                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded-2xl border border-slate-200 mb-4 line-clamp-4 font-mono leading-relaxed">
                  {t.content}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                <span>{new Date(t.updated_at).toLocaleDateString('id-ID')}</span>
                <button
                  onClick={() => handleCopy(t.id, t.content)}
                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-bold"
                >
                  {copiedId === t.id ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-600">Disalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Salin Teks</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                {editId ? 'Edit Template' : 'Tambah Template Baru'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 mb-4 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-600">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Template *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Ucapan Selamat Datang"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Isi Template Pesan *
                  </label>
                  <div className="flex space-x-1.5">
                    <button
                      type="button"
                      onClick={() => handleInsertVariable('name')}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-blue-600 px-2 py-0.5 rounded-md font-mono font-semibold"
                    >
                      + name
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertVariable('phone')}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-blue-600 px-2 py-0.5 rounded-md font-mono font-semibold"
                    >
                      + phone
                    </button>
                  </div>
                </div>
                <textarea
                  rows={5}
                  required
                  placeholder="Halo {{name}}, terima kasih telah menghubungi kami! Ada yang bisa kami bantu hari ini?"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl text-xs sm:text-sm shadow-xs shadow-blue-500/20 transition disabled:opacity-50"
                >
                  {formLoading ? 'Menyimpan...' : editId ? 'Perbarui Template' : 'Simpan Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
