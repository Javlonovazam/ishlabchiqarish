import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from './lib/supabase';
import {
  Lock, Calendar, Plus, Settings, LogOut, Search, X,
  FileText, Users, Trash2, Save, AlertCircle, CheckCircle, Move, DoorOpen, Factory, Info
} from 'lucide-react';

type UserRole = 'GENERAL' | 'ADMIN' | 'USER';

interface User {
  login: string;
  role: UserRole;
  canView: boolean;
  canAdd: boolean;
  canMove: boolean;
  canDelete: boolean;
  canSettings: boolean;
}

interface Order {
  id: string;
  order_number: string;
  door_count: number;
  scheduled_date: string;
  status: string;
  operator: string;
  notes: string;
  created_at: string;
}

interface DbUser {
  id: string;
  login: string;
  password: string;
  role: UserRole;
}

const DAILY_LIMIT = 45;

const AuthContext = createContext<{
  user: User | null;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
} | null>(null);

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  const login = async (password: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('password', password.trim())
        .maybeSingle();

      if (error || !data) return false;

      const role = (data as DbUser).role.toUpperCase() as UserRole;
      setUser({
        login: (data as DbUser).login,
        role,
        canView: true,
        canAdd: role === 'GENERAL' || role === 'ADMIN',
        canMove: role === 'GENERAL',
        canDelete: role === 'GENERAL',
        canSettings: role === 'GENERAL',
      });
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
    return false;
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!user ? <LoginScreen /> : <Dashboard />}
    </AuthContext.Provider>
  );
}

function LoginScreen() {
  const { login, loading } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setError('');
    const success = await login(password);
    if (!success) setError("Parol noto'g'ri!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm animated-slide-up">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-[0_0_40px_rgba(6,182,212,0.3)]">
            <Factory className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2 tracking-tight">Ishlab chiqarish</h1>
          <p className="text-gray-400 text-sm">Parol bilan tizimga kiring</p>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Parolni kiriting"
                className="w-full pl-11 pr-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2.5 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 animated-slide-up">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Kutilmoqda...</span>
                </>
              ) : (
                <>
                  <span>Kirish</span>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Eshiklar ishlab chiqarish boshqaruvi
        </p>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'calendar' | 'settings'>('calendar');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderModal, setOrderModal] = useState(false);
  const [moveModal, setMoveModal] = useState<{ open: boolean; order: Order | null }>({ open: false, order: null });
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);

  const handleDeleteOrder = async (order: Order) => {
    if (!confirm(`No${order.order_number} zayavkasini o'chirilsinmi?`)) return;
    await supabase.from('orders').delete().eq('id', order.id);
    fetchOrders();
  };

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase.from('orders').select('*').order('scheduled_date');
    if (data) setOrders(data as Order[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const schedule: Record<string, { doors: number; orders: Order[] }> = {};
  orders.forEach((order) => {
    const date = order.scheduled_date;
    if (!schedule[date]) schedule[date] = { doors: 0, orders: [] };
    schedule[date].doors += order.door_count;
    schedule[date].orders.push(order);
  });

  const dates: string[] = [];
  const today = new Date();
  let daysAdded = 0;
  while (dates.length < 60) {
    const d = new Date(today);
    d.setDate(d.getDate() + daysAdded);
    if (d.getDay() !== 0) {
      dates.push(d.toISOString().split('T')[0]);
    }
    daysAdded++;
  }

  Object.keys(schedule).forEach((d) => {
    if (!dates.includes(d)) dates.push(d);
  });
  dates.sort();

  let lastOrderDate: string | null = null;
  dates.forEach((date) => {
    if (schedule[date]?.doors > 0) lastOrderDate = date;
  });

  const filteredDates = searchQuery
    ? dates.filter((date) => schedule[date]?.orders.some((o) => o.order_number.toLowerCase().includes(searchQuery.toLowerCase())))
    : dates;

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col lg:flex-row" style={{overflow:'hidden'}}>
      {/* Mobile Header */}
      <div className="lg:hidden flex justify-between items-center px-4 py-3 bg-slate-900/95 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-lg flex items-center justify-center">
            <Factory className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-sm">Ishlab chiqarish</span>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white p-2 hover:bg-white/10 rounded-lg transition-colors">
          {sidebarOpen ? <X className="w-5 h-5" /> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>}
        </button>
      </div>

      {/* Overlay */}
      {sidebarOpen && <div className="lg:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed lg:relative inset-y-0 left-0 w-[260px] flex-shrink-0 bg-[#0f172a] border-r border-white/10 p-4 flex flex-col z-50 transform transition-transform duration-300 lg:transform-none lg:translate-x-0 lg:h-full ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="hidden lg:flex items-center gap-2.5 mb-5 px-1">
          <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Factory className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-base">Ishlab chiqarish</span>
        </div>

        <nav className="space-y-1">
          <button
            onClick={() => { setActiveTab('calendar'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-sm ${activeTab === 'calendar' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
          >
            <Calendar className="w-4 h-4" />
            <span>Kalendar</span>
          </button>

          {user?.canAdd && (
            <button
              onClick={() => { setOrderModal(true); setSidebarOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Yangi buyurtma</span>
            </button>
          )}

          {user?.canSettings && (
            <button
              onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-sm ${activeTab === 'settings' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            >
              <Settings className="w-4 h-4" />
              <span>Sozlamalar</span>
            </button>
          )}
        </nav>

        <div className="mt-auto pt-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-600 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-cyan-500/20">
              {user?.login?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.login}</p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${user?.role === 'GENERAL' ? 'bg-amber-500/20 text-amber-400' : user?.role === 'ADMIN' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-500/20 text-gray-400'}`}>
                {user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Chiqish</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-3 sm:p-4 lg:p-5 lg:h-full" style={{overflowY:'auto',overflowX:'hidden'}}>
        {activeTab === 'calendar' && (
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col gap-3 mb-5">
              <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3">
                <div>
                  <h1 className="text-lg lg:text-xl font-bold text-white">60 kunlik kalendar</h1>
                  <p className="text-gray-500 text-xs">Limit: {DAILY_LIMIT} ta | Dam olish kunlari hisobga olinmaydi</p>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1 xs:flex-none">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buyurtma qidirish..."
                      className="w-full xs:w-44 pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  {user?.canAdd && (
                    <button
                      onClick={() => setOrderModal(true)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-sm font-medium rounded-lg transition-all whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Yangi</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredDates.map((date, idx) => {
                  const data = schedule[date] || { doors: 0, orders: [] };
                  const parts = date.split('-');
                  const displayDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
                  const uzDays = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
                  const dayName = uzDays[new Date(date).getDay()];
                  const percent = Math.min((data.doors / DAILY_LIMIT) * 100, 100);
                  const hasOrders = data.doors > 0;
                  const isLastOrderDate = date === lastOrderDate && hasOrders;

                  return (
                    <div
                      key={date}
                      className={`day-card card-glow-enter ${
                        isLastOrderDate
                          ? 'day-card-last'
                          : hasOrders
                            ? 'day-card-active'
                            : ''
                      }`}
                      style={{ animationDelay: `${idx * 20}ms` }}
                    >
                      <div className="flex items-start justify-between mb-2.5">
                        <div>
                          <p className={`text-xs font-bold tracking-wide ${isLastOrderDate ? 'last-order-pulse' : hasOrders ? 'text-orange-400' : 'text-gray-300'}`}>
                            {displayDate}
                          </p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{dayName}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-bold leading-none ${hasOrders ? 'text-orange-400' : 'text-gray-600'}`}>{data.doors}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">/{DAILY_LIMIT}</p>
                        </div>
                      </div>

                      <div className="progress-bar mb-2.5">
                        <div
                          className={`progress-bar-fill ${
                            isLastOrderDate
                              ? 'bg-gradient-to-r from-rose-500 to-pink-500'
                              : hasOrders
                                ? 'bg-gradient-to-r from-orange-500 to-amber-500'
                                : 'bg-gray-600'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="space-y-1.5 max-h-24 overflow-y-auto">
                        {data.orders.length > 0 ? data.orders.map((order) => (
                          <div
                            key={order.id}
                            className={`order-item flex items-center justify-between gap-2 text-xs ${
                              searchQuery && order.order_number.toLowerCase().includes(searchQuery.toLowerCase())
                                ? 'order-item-highlight'
                                : ''
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <FileText className="w-3 h-3 text-gray-500 flex-shrink-0" />
                              <span className="text-gray-300 truncate font-medium">No{order.order_number}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-orange-400 font-bold tabular-nums">{order.door_count}</span>
                              {user?.canDelete && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(order); }}
                                  className="p-1 hover:bg-rose-500/20 text-rose-400 rounded transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                              {user?.canMove && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setMoveModal({ open: true, order }); }}
                                  className="p-1 hover:bg-blue-500/20 text-blue-400 rounded transition-colors"
                                >
                                  <Move className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        )) : (
                          <div className="text-center py-2">
                            <DoorOpen className="w-4 h-4 text-gray-600 mx-auto" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && user?.canSettings && (
          <SettingsPanel />
        )}
      </main>

      {orderModal && <OrderModal onClose={() => setOrderModal(false)} onSuccess={fetchOrders} />}
      {moveModal.open && moveModal.order && (
        <MoveModal order={moveModal.order} onClose={() => setMoveModal({ open: false, order: null })} onSuccess={fetchOrders} />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          order={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => { handleDeleteOrder(deleteTarget); setDeleteTarget(null); }}
        />
      )}
    </div>
  );
}

function OrderModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuth();
  const [orderNumber, setOrderNumber] = useState('');
  const [doorCount, setDoorCount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim() || !doorCount) {
      setError('Maydonlarni to\'ldiring!');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const count = parseInt(doorCount);
      const { data: existing } = await supabase.from('orders').select('door_count, scheduled_date');

      const capacities: Record<string, number> = {};
      (existing || []).forEach((o) => {
        const d = (o as { scheduled_date: string; door_count: number }).scheduled_date;
        capacities[d] = (capacities[d] || 0) + (o as { door_count: number }).door_count;
      });

      // Bugundan +30 ish kuni (yakshanbadan tashqari) hisoblaymiz
      const findWorkingStart = (): Date => {
        let d = new Date();
        d.setHours(0, 0, 0, 0);
        let added = 0;
        while (added < 30) {
          d.setDate(d.getDate() + 1);
          if (d.getDay() === 0) continue;
          added++;
        }
        return d;
      };

      // Berilgan sig'im uchun bo'sh ish kuni topadi
      const findAvailableDate = (start: Date, need: number): Date => {
        let d = new Date(start);
        d.setHours(0, 0, 0, 0);
        while (true) {
          if (d.getDay() === 0) {
            d.setDate(d.getDate() + 1);
            continue;
          }
          const dateStr = d.toISOString().split('T')[0];
          if ((capacities[dateStr] || 0) + need <= DAILY_LIMIT) {
            capacities[dateStr] = (capacities[dateStr] || 0) + need;
            return d;
          }
          d.setDate(d.getDate() + 1);
        }
      };

      const startDate = findWorkingStart();

      // 45 tadan oshiq (90 gacha) — 2 kunga bo'lamiz
      if (count > DAILY_LIMIT && count <= DAILY_LIMIT * 2) {
        const firstDate = findAvailableDate(startDate, DAILY_LIMIT);
        const secondDate = findAvailableDate(new Date(firstDate.getTime() + 86400000), count - DAILY_LIMIT);

        const { error: err1 } = await supabase.from('orders').insert({
          order_number: orderNumber.trim(),
          door_count: DAILY_LIMIT,
          scheduled_date: firstDate.toISOString().split('T')[0],
          status: 'planned',
          operator: user?.login || 'unknown',
          notes: `${new Date().toLocaleDateString('uz-UZ')} | 1-kun (${count} ta dan)`,
        });
        if (err1) throw err1;

        const { error: err2 } = await supabase.from('orders').insert({
          order_number: orderNumber.trim(),
          door_count: count - DAILY_LIMIT,
          scheduled_date: secondDate.toISOString().split('T')[0],
          status: 'planned',
          operator: user?.login || 'unknown',
          notes: `${new Date().toLocaleDateString('uz-UZ')} | 2-kun (${count} ta dan)`,
        });
        if (err2) throw err2;

        alert(`No${orderNumber.trim()} — ${count} ta eshik 2 kunga bo'lib joylandi:\n\n1-kun: ${firstDate.toLocaleDateString('uz-UZ')} — ${DAILY_LIMIT} ta\n2-kun: ${secondDate.toLocaleDateString('uz-UZ')} — ${count - DAILY_LIMIT} ta`);

        onSuccess();
        onClose();
      } else if (count > DAILY_LIMIT * 2) {
        setError('Maksimal 90 ta eshik buyurtma qilish mumkin');
        return;
      } else {
        const targetDate = findAvailableDate(startDate, count);

        const { error: insertError } = await supabase.from('orders').insert({
          order_number: orderNumber.trim(),
          door_count: count,
          scheduled_date: targetDate.toISOString().split('T')[0],
          status: 'planned',
          operator: user?.login || 'unknown',
          notes: new Date().toLocaleDateString('uz-UZ'),
        });

        if (insertError) throw insertError;

        onSuccess();
        onClose();
      }
    } catch {
      setError('Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
      <div className="w-full sm:max-w-sm bg-slate-900 border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 animated-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">Yangi buyurtma</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Buyurtma raqami</label>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="Masalan: 2520"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Eshik soni</label>
            <input
              type="number"
              value={doorCount}
              onChange={(e) => setDoorCount(e.target.value)}
              placeholder="Masalan: 12"
              min="1"
              max="90"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
            {doorCount && parseInt(doorCount) > DAILY_LIMIT && parseInt(doorCount) <= DAILY_LIMIT * 2 && (
              <div className="flex items-center gap-2 text-cyan-300 text-xs bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-2.5 mt-2 animated-slide-up">
                <Info className="w-4 h-4 flex-shrink-0" />
                <span>{parseInt(doorCount)} ta — 2 kunga bo'lib joylanadi: {DAILY_LIMIT} + {parseInt(doorCount) - DAILY_LIMIT} ta</span>
              </div>
            )}
            {doorCount && parseInt(doorCount) > DAILY_LIMIT * 2 && (
              <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5 mt-2 animated-slide-up">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Maksimal 90 ta eshik mumkin</span>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5 animated-slide-up">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-cyan-500/20"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saqlanmoqda...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Saqlash</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function MoveModal({ order, onClose, onSuccess }: { order: Order; onClose: () => void; onSuccess: () => void }) {
  const [newDate, setNewDate] = useState(order.scheduled_date);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) return;

    setLoading(true);
    try {
      await supabase
        .from('orders')
        .update({
          scheduled_date: newDate,
          notes: `${order.notes} | O'zgartirildi: ${new Date(newDate).toLocaleDateString('uz-UZ')}`,
        })
        .eq('id', order.id);

      onSuccess();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
      <div className="w-full sm:max-w-sm bg-slate-900 border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 animated-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">Ko'chirish</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-gray-400 mb-4">No{order.order_number} ({order.door_count} ta) ni boshqa sanaga ko'chirish</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Yangi sana</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Ko'chirilmoqda...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Tasdiqlash</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ order, onClose, onConfirm }: { order: Order; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
      <div className="w-full sm:max-w-sm bg-slate-900 border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 animated-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-rose-400">O'chirish</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-3 mb-5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <p className="text-xs text-gray-300">
            No{order.order_number} ({order.door_count} ta) zayavkasini o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium rounded-lg transition-all"
          >
            Bekor qilish
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20"
          >
            <Trash2 className="w-4 h-4" />
            O'chirish
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel() {
  const [users, setUsers] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLogin, setNewLogin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('USER');
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('*').order('created_at');
    if (data) setUsers(data as DbUser[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogin.trim() || !newPassword.trim()) return;

    setSaving(true);
    const existing = users.find((u) => u.login === newLogin.trim());

    if (existing) {
      await supabase
        .from('users')
        .update({ password: newPassword.trim(), role: newRole })
        .eq('id', existing.id);
    } else {
      await supabase.from('users').insert({
        login: newLogin.trim(),
        password: newPassword.trim(),
        role: newRole,
      });
    }

    setNewLogin('');
    setNewPassword('');
    setNewRole('USER');
    fetchUsers();
    setSaving(false);
  };

  const handleDeleteUser = async (login: string) => {
    if (login === 'general') return;
    if (!confirm(`${login} o'chirilsinmi?`)) return;

    await supabase.from('users').delete().eq('login', login);
    fetchUsers();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
        <Settings className="w-5 h-5 text-cyan-400" />
        Sozlamalar
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 bg-white/[0.03] border border-white/10 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            Xodim qo'shish
          </h3>

          <form onSubmit={handleSaveUser} className="space-y-3">
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Login</label>
              <input
                type="text"
                value={newLogin}
                onChange={(e) => setNewLogin(e.target.value)}
                placeholder="login"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Parol</label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="parol"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Rol</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              >
                <option value="USER">USER - Faqat ko'rish</option>
                <option value="ADMIN">ADMIN - Qo'shish</option>
                <option value="GENERAL">GENERAL - To'liq</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>Saqlash</span>
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white/[0.03] border border-white/10 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Xodimlar ro'yxati</h3>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
              <table className="w-full text-sm min-w-[400px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 text-gray-400 text-[11px] font-medium">Login</th>
                    <th className="text-left py-2 text-gray-400 text-[11px] font-medium">Parol</th>
                    <th className="text-left py-2 text-gray-400 text-[11px] font-medium">Rol</th>
                    <th className="text-right py-2 text-gray-400 text-[11px] font-medium">Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-3 text-white font-medium">{u.login}</td>
                      <td className="py-3 text-gray-400">{u.password}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${u.role === 'GENERAL' ? 'bg-amber-500/20 text-amber-400' : u.role === 'ADMIN' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-500/20 text-gray-400'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {u.login !== 'general' && (
                          <button
                            onClick={() => handleDeleteUser(u.login)}
                            className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
