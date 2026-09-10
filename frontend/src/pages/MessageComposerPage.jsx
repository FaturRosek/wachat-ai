import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { Send, Users, FileText, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

export default function MessageComposerPage({ waStatus }) {
  const [contacts, setContacts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedContact, setSelectedContact] = useState('');
  const [phone, setPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isConnected = waStatus?.status === 'CONNECTED';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [contactsRes, templatesRes] = await Promise.all([
          apiClient.get('/contacts?limit=100'),
          apiClient.get('/templates?limit=100')
        ]);
        setContacts(contactsRes.data.data.contacts || []);
        setTemplates(templatesRes.data.data.templates || []);
      } catch (err) {
        console.error('Error fetching composer data:', err);
      }
    };

    fetchData();
  }, []);

  const handleContactSelect = (contactId) => {
    setSelectedContact(contactId);
    if (!contactId) {
      setPhone('');
      setContactName('');
      return;
    }
    const c = contacts.find((item) => item.id === contactId);
    if (c) {
      setPhone(c.phone);
      setContactName(c.name);
    }
  };

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId);
    if (!templateId) return;
    const t = templates.find((item) => item.id === templateId);
    if (t) {
      let content = t.content;
      if (contactName) {
        content = content.replace(/\{\{name\}\}/gi, contactName);
      }
      if (phone) {
        content = content.replace(/\{\{phone\}\}/gi, phone);
      }
      setMessage(content);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await apiClient.post('/messages', {
        phone,
        message,
        contactName: contactName || undefined
      });
      setSuccessMsg(`Message successfully sent to ${phone}!`);
      setMessage('');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to send WhatsApp message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Message Composer</h1>
        <p className="text-sm text-slate-400">Send personalized direct WhatsApp messages</p>
      </div>

      {!isConnected && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center space-x-3 text-amber-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>WhatsApp is currently disconnected. Please link your phone on the WhatsApp Connection page before sending.</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center space-x-3 text-emerald-400 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center space-x-3 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
          <form onSubmit={handleSend} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Choose Contact
                </label>
                <select
                  value={selectedContact}
                  onChange={(e) => handleContactSelect(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Or enter phone manually --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Select Template
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Select Template (Optional) --</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Recipient Phone Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="08123456789 or +628123456789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Contact Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Recipient Name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Message Content *
                </label>
                <span className="text-xs text-slate-500">{message.length} characters</span>
              </div>
              <textarea
                rows={5}
                required
                placeholder="Type your WhatsApp message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={loading || !isConnected}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              <span>{loading ? 'Sending...' : 'Send WhatsApp Message'}</span>
            </button>
          </form>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-100 mb-2">Message Preview</h3>
            <p className="text-xs text-slate-400 mb-4">Live simulation of WhatsApp bubble</p>

            <div className="bg-[#0b141a] p-4 rounded-2xl border border-slate-800 min-h-[220px] flex flex-col justify-end">
              {message ? (
                <div className="bg-[#005c4b] text-slate-100 p-3 rounded-2xl rounded-tr-none max-w-[85%] ml-auto text-sm shadow-md">
                  <p className="whitespace-pre-wrap">{message}</p>
                  <p className="text-[10px] text-emerald-200/60 text-right mt-1">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-600 text-center my-auto">
                  Type a message or select a template to preview here
                </p>
              )}
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 mt-4 text-xs text-slate-400">
            <strong>Tips:</strong> You can use variables in templates like <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded">{'{{name}}'}</code> and <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded">{'{{phone}}'}</code>.
          </div>
        </div>
      </div>
    </div>
  );
}
