import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { 
  QrCode, 
  Smartphone, 
  RefreshCw, 
  PowerOff, 
  CheckCircle2, 
  AlertCircle, 
  Send,
  HelpCircle
} from 'lucide-react';

export default function WhatsappConnectionPage({ waStatus, onRefreshStatus }) {
  const [loading, setLoading] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Halo! Ini adalah tes koneksi dari WaChat AI.');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState('');

  const isConnected = waStatus?.status === 'CONNECTED';
  const isScan = waStatus?.status === 'SCAN_QR';
  const isConnecting = waStatus?.status === 'CONNECTING' || waStatus?.status === 'RECONNECTING';

  const handleStartSession = async (forceRestart = false) => {
    setLoading(true);
    try {
      await apiClient.post('/whatsapp/connect', { forceRestart });
      await onRefreshStatus();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start WhatsApp session');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect WhatsApp session?')) return;
    setLoading(true);
    try {
      await apiClient.post('/whatsapp/disconnect');
      await onRefreshStatus();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async (e) => {
    e.preventDefault();
    setTestSending(true);
    setTestResult(null);
    setTestError('');

    try {
      const res = await apiClient.post('/whatsapp/send-test', {
        toPhone: testPhone,
        messageText: testMessage
      });
      setTestResult(res.data.message || 'Test message sent successfully!');
    } catch (err) {
      setTestError(err.response?.data?.message || 'Failed to send test message');
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">WhatsApp Personal Connection</h1>
        <p className="text-sm text-slate-400">Link your personal WhatsApp number using QR code authentication</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col items-center text-center">
          <div className="mb-4">
            {isConnected ? (
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>CONNECTED & ACTIVE</span>
              </div>
            ) : isScan ? (
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                <QrCode className="w-3.5 h-3.5" />
                <span>READY TO SCAN</span>
              </div>
            ) : isConnecting ? (
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>CONNECTING...</span>
              </div>
            ) : (
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>DISCONNECTED</span>
              </div>
            )}
          </div>

          <div className="w-72 h-72 bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-center mb-6 shadow-inner relative">
            {isConnected ? (
              <div className="text-center p-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                  <Smartphone className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-slate-100 text-base">WhatsApp Linked</h3>
                <p className="text-sm text-emerald-400 font-mono mt-1">+{waStatus?.phoneNumber || 'Active'}</p>
                <p className="text-xs text-slate-500 mt-2">Ready to send and receive messages</p>
              </div>
            ) : isScan && waStatus?.qrCode ? (
              <div className="bg-white p-3 rounded-xl shadow-lg">
                <img 
                  src={waStatus.qrCode} 
                  alt="WhatsApp QR Code" 
                  className="w-56 h-56 object-contain"
                />
              </div>
            ) : isConnecting ? (
              <div className="text-center p-4 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-400" />
                <p className="text-xs">Preparing WhatsApp socket & QR code...</p>
              </div>
            ) : (
              <div className="text-center p-4 text-slate-500">
                <QrCode className="w-12 h-12 mx-auto mb-2 opacity-40" />
                <p className="text-xs">Click start session to generate a QR code</p>
              </div>
            )}
          </div>

          <div className="flex space-x-3 w-full max-w-xs">
            <button
              onClick={() => handleStartSession(true)}
              disabled={loading}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center space-x-1.5 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{isConnected ? 'Refresh' : 'Get QR Code'}</span>
            </button>

            {isConnected && (
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold px-4 py-2.5 rounded-xl text-sm transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                <PowerOff className="w-4 h-4" />
                <span>Disconnect</span>
              </button>
            )}
          </div>
        </div>

        <div className="md:col-span-6 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center space-x-2 text-slate-100 font-bold text-base mb-3">
              <HelpCircle className="w-5 h-5 text-emerald-400" />
              <h3>How to Link WhatsApp</h3>
            </div>
            <ol className="space-y-2.5 text-xs text-slate-300 list-decimal list-inside leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <li>Open <strong>WhatsApp</strong> on your mobile phone.</li>
              <li>Tap <strong>Settings</strong> or <strong>Menu (Three Dots)</strong> at the top right.</li>
              <li>Select <strong>Linked Devices (Perangkat Tertaut)</strong>.</li>
              <li>Tap <strong>Link a Device (Tautkan Perangkat)</strong>.</li>
              <li>Point your phone's camera at the QR code on the left screen.</li>
            </ol>
          </div>

          {isConnected && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-100 text-base mb-2">Test Live Connection</h3>
              <p className="text-xs text-slate-400 mb-4">Send a quick WhatsApp test message to verify outbound delivery.</p>

              {testResult && (
                <div className="p-3 mb-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-medium text-emerald-400">
                  {testResult}
                </div>
              )}

              {testError && (
                <div className="p-3 mb-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-medium text-rose-400">
                  {testError}
                </div>
              )}

              <form onSubmit={handleSendTest} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Destination Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="08123456789 or 628123456789"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Test Message
                  </label>
                  <input
                    type="text"
                    required
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={testSending}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{testSending ? 'Sending Test...' : 'Send Test WhatsApp'}</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
