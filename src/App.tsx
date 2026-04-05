import { useState, useEffect, useRef } from 'react';
import { Play, Square, Settings, Activity, Terminal, Lock, LogOut } from 'lucide-react';

function ShopPanel({ shopId, title, status, logs, onToggle, onSaveConfig }) {
  const [showSettings, setShowSettings] = useState(false);
  const [configForm, setConfigForm] = useState({ clientId: '', apiKey: '', intervalSec: 30 });
  const logsEndRef = useRef(null);
  const isConfigInitialized = useRef(false);
  const [autoScroll, setAutoScroll] = useState(true);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  useEffect(() => {
    if (status?.config && !isConfigInitialized.current) {
      setConfigForm({
        clientId: status.config.clientId || '',
        apiKey: status.config.apiKey || '',
        intervalSec: status.config.intervalSec || 30
      });
      isConfigInitialized.current = true;
    }
  }, [status?.config]);

  const handleSave = (e) => {
    e.preventDefault();
    onSaveConfig(shopId, configForm);
    setShowSettings(false);
  };

  const isRunning = status?.isRunning || false;

  return (
    <div className="flex flex-col space-y-4 bg-gray-800/50 p-4 rounded-2xl border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-full ${isRunning ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
            <Activity size={24} className={isRunning ? 'animate-pulse' : ''} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">{title}</h2>
            <p className="text-xs text-gray-400 flex items-center mt-1">
              Status: 
              <span className={`ml-2 px-2 py-0.5 rounded font-medium ${isRunning ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-700 text-gray-300 border border-gray-600'}`}>
                {isRunning ? 'ACTIVE' : 'STOPPED'}
              </span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors border border-gray-600"
            title="Settings"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={() => onToggle(shopId, isRunning)}
            className={`flex items-center space-x-1 px-4 py-2 rounded-lg font-bold transition-all text-sm ${
              isRunning 
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.3)]' 
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.3)]'
            }`}
          >
            {isRunning ? <><Square size={16} /> <span>СТОП</span></> : <><Play size={16} /> <span>СТАРТ</span></>}
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-inner animate-in fade-in slide-in-from-top-2 duration-200">
          <h3 className="text-sm font-semibold mb-3 flex items-center border-b border-gray-700 pb-2">
            <Settings size={14} className="mr-2" /> Настройки {title}
          </h3>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Client ID</label>
              <input 
                type="text" 
                value={configForm.clientId}
                onChange={e => setConfigForm({...configForm, clientId: e.target.value})}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">API Key</label>
              <input 
                type="password" 
                value={configForm.apiKey}
                onChange={e => setConfigForm({...configForm, apiKey: e.target.value})}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Интервал (сек)</label>
              <input 
                type="number" 
                min="10"
                value={configForm.intervalSec}
                onChange={e => setConfigForm({...configForm, intervalSec: parseInt(e.target.value)})}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <div className="flex justify-end pt-1">
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
                Сохранить
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Terminal / Logs */}
      <div className="bg-black rounded-xl border border-gray-700 shadow-inner overflow-hidden flex flex-col h-[400px]">
        <div className="bg-gray-800 px-3 py-1.5 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-gray-400 text-xs">
            <Terminal size={14} />
            <span>Логи</span>
          </div>
        </div>
        <div 
          className="p-3 overflow-y-auto flex-1 font-mono text-xs space-y-1"
          onScroll={handleScroll}
        >
          {!logs || logs.length === 0 ? (
            <div className="text-gray-600 italic">Нет логов. Запустите бота.</div>
          ) : (
            logs.map((log, i) => {
              const isError = log.includes('❌') || log.includes('Ошибка');
              const isSuccess = log.includes('✅');
              return (
                <div key={i} className={`
                  ${isError ? 'text-red-400' : ''}
                  ${isSuccess ? 'text-green-400' : ''}
                  ${!isError && !isSuccess ? 'text-gray-300' : ''}
                `}>
                  {log}
                </div>
              )
            })
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('ozon_bot_token') || null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  
  const [status, setStatus] = useState({ shop1: {}, shop2: {} });
  const [logs, setLogs] = useState({ shop1: [], shop2: [] });

  useEffect(() => {
    if (!token) return;
    
    fetchStatus();
    fetchLogs();
    const interval = setInterval(() => {
      fetchStatus();
      fetchLogs();
    }, 2000);
    return () => clearInterval(interval);
  }, [token]);

  const authFetch = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': token,
      ...(options.headers || {})
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      handleLogout();
      throw new Error('Unauthorized');
    }
    return res;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.token);
        localStorage.setItem('ozon_bot_token', data.token);
      } else {
        setLoginError(data.error || 'Ошибка входа');
      }
    } catch (e) {
      setLoginError('Ошибка соединения');
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('ozon_bot_token');
  };

  const fetchStatus = async () => {
    try {
      const res = await authFetch('/api/bot/status');
      const data = await res.json();
      setStatus(data);
    } catch (e) { /* ignored */ }
  };

  const fetchLogs = async () => {
    try {
      const res = await authFetch('/api/bot/logs');
      const data = await res.json();
      setLogs(data);
    } catch (e) { /* ignored */ }
  };

  const toggleBot = async (shopId, isCurrentlyRunning) => {
    try {
      await authFetch(`/api/bot/${shopId}/${isCurrentlyRunning ? 'stop' : 'start'}`, { method: 'POST' });
      fetchStatus();
    } catch (e) { console.error(e); }
  };

  const saveConfig = async (shopId, config) => {
    try {
      await authFetch(`/api/bot/${shopId}/config`, {
        method: 'POST',
        body: JSON.stringify(config)
      });
      fetchStatus();
    } catch (e) { console.error(e); }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 font-mono">
        <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-md">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-500/20 rounded-full text-blue-400">
              <Lock size={32} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-8">Ozon Bot Panel</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Логин</label>
              <input 
                type="text" 
                value={loginForm.username}
                onChange={e => setLoginForm({...loginForm, username: e.target.value})}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Пароль</label>
              <input 
                type="password" 
                value={loginForm.password}
                onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all"
                required
              />
            </div>
            {loginError && <div className="text-red-400 text-sm text-center">{loginError}</div>}
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors mt-4">
              Войти
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-6 font-mono">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Top Bar */}
        <div className="flex items-center justify-between bg-gray-800 px-6 py-4 rounded-xl border border-gray-700 shadow-lg">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center">
            <Activity className="mr-3 text-blue-400" size={20} />
            Ozon Auto-Accept Multi-Bot
          </h1>
          <button 
            onClick={handleLogout}
            className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <LogOut size={16} />
            <span>Выйти</span>
          </button>
        </div>

        {/* Two Columns for Shops */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ShopPanel 
            shopId="shop1" 
            title="Магазин 1" 
            status={status.shop1} 
            logs={logs.shop1} 
            onToggle={toggleBot}
            onSaveConfig={saveConfig}
          />
          <ShopPanel 
            shopId="shop2" 
            title="Магазин 2" 
            status={status.shop2} 
            logs={logs.shop2} 
            onToggle={toggleBot}
            onSaveConfig={saveConfig}
          />
        </div>

      </div>
    </div>
  );
}
