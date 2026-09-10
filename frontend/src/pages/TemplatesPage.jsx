import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { FileText, Search, Plus, Trash2, Edit2, Copy, X, Sparkles } from 'lucide-react';

export default function TemplatesPage({ setActiveTab }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

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
    if (!confirm(`Are you sure you want to delete template "${templateName}"?`)) return;
    try {
      await apiClient.delete(`/templates/${id}`);
      fetchTemplates();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete template');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Message Templates</h1>
          <p className="text-sm text-slate-400">Create reusable message templates with dynamic variables</p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-sm shadow-lg shadow-emerald-500/20 transition w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>Add Template</span>
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by template name or content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-12 text-center text-slate-500 text-sm">
            Loading templates...
          </div>
        ) : templates.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-500 text-sm bg-slate-900 border border-slate-800 rounded-2xl">
            No templates found. Click "Add Template" to create one.
          </div>
        ) : (
          templates.map((t) => (
            <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-slate-700 transition">
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-slate-100 text-sm">{t.name}</h3>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => openEditModal(t)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id, t.name)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-300 whitespace-pre-wrap bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 mb-4 line-clamp-4 font-mono">
                  {t.content}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-[11px] text-slate-500">
                <span>{new Date(t.updated_at).toLocaleDateString()}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(t.content);
                    alert('Template copied to clipboard!');
                  }}
                  className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 font-semibold"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-slate-100">
                {editId ? 'Edit Template' : 'Add New Template'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 mb-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-medium text-rose-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Welcome Message"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Template Content *
                  </label>
                  <div className="flex space-x-1">
                    <button
                      type="button"
                      onClick={() => handleInsertVariable('name')}
                      className="text-[11px] bg-slate-800 hover:bg-slate-700 text-emerald-400 px-2 py-0.5 rounded-md font-mono"
                    >
                      + name
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertVariable('phone')}
                      className="text-[11px] bg-slate-800 hover:bg-slate-700 text-emerald-400 px-2 py-0.5 rounded-md font-mono"
                    >
                      + phone
                    </button>
                  </div>
                </div>
                <textarea
                  rows={5}
                  required
                  placeholder="Halo {{name}}, terima kasih telah menghubungi kami!"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
                >
                  {formLoading ? 'Saving...' : editId ? 'Update Template' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
