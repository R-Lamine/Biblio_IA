import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  BookOpen, 
  LogOut, 
  Search, 
  Library, 
  LayoutDashboard, 
  Users, 
  BookMarked, 
  Home, 
  BarChart3, 
  Bell, 
  AlertTriangle,
  Info,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import api from '../../api';

interface StockNotification {
  book_id: string;
  title: string;
  quantity_available: number;
  level: 'CRITICAL' | 'WARNING';
}

const Navbar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState<StockNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.role === 'bibliothecaire') {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000); // Rafraîchir toutes les 30s
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await api.get<StockNotification[]>('/notifications/stock');
      setNotifications(response.data);
    } catch (err) {
      console.error("Error fetching notifications", err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="bg-primary p-1.5 rounded-lg group-hover:rotate-12 transition-transform">
                <BookOpen className="text-white w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">Biblio-IA</span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {(!user || user.role === 'adherent') ? (
                <>
                  {user && <NavLink to="/espace-client" icon={<Home size={18} />} active={isActive('/espace-client')}>Espace Client</NavLink>}
                  <NavLink to="/recherche" icon={<Search size={18} />} active={isActive('/recherche')}>Recherche</NavLink>
                  <NavLink to="/catalogue" icon={<Library size={18} />} active={isActive('/catalogue')}>Catalogue</NavLink>
                  {user && <NavLink to="/mes-lectures" icon={<BookMarked size={18} />} active={isActive('/mes-lectures')}>Mes Lectures</NavLink>}
                </>
              ) : (
                <>
                  <NavLink to="/dashboard" icon={<LayoutDashboard size={18} />} active={isActive('/dashboard')}>Dashboard</NavLink>
                  <NavLink to="/catalogue" icon={<Library size={18} />} active={isActive('/catalogue')}>Catalogue</NavLink>
                  <NavLink to="/adherents" icon={<Users size={18} />} active={isActive('/adherents')}>Adhérents</NavLink>
                  <NavLink to="/emprunts" icon={<BookMarked size={18} />} active={isActive('/emprunts')}>Emprunts</NavLink>
                  <NavLink to="/analyse" icon={<BarChart3 size={18} />} active={isActive('/analyse')}>Analyse</NavLink>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                {user.role === 'bibliothecaire' && (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="p-2 text-slate-500 hover:text-primary hover:bg-slate-50 rounded-lg transition-all relative"
                    >
                      <Bell size={20} />
                      {notifications.length > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white animate-pulse">
                          {notifications.length}
                        </span>
                      )}
                    </button>

                    {showNotifications && (
                      <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                          <h3 className="font-bold text-slate-900">Alertes Stock</h3>
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-white border border-slate-200 rounded-md text-slate-500">
                            Temps réel
                          </span>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          {notifications.length > 0 ? (
                            notifications.map((notif) => (
                              <div key={notif.book_id} className="p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                <div className="flex gap-3">
                                  <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                                    notif.level === 'CRITICAL' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                  }`}>
                                    {notif.level === 'CRITICAL' ? <AlertCircle size={16} /> : <AlertTriangle size={16} />}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-900 line-clamp-1">{notif.title}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                        notif.level === 'CRITICAL' 
                                          ? 'bg-red-50 text-red-700 border-red-100' 
                                          : 'bg-amber-50 text-amber-700 border-amber-100'
                                      }`}>
                                        {notif.level === 'CRITICAL' ? 'CRITIQUE' : 'ATTENTION'}
                                      </span>
                                      <span className="text-xs text-slate-500">
                                        Stock: {notif.quantity_available}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-8 text-center">
                              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Info size={24} />
                              </div>
                              <p className="text-sm font-medium text-slate-900">Tout est en ordre</p>
                              <p className="text-xs text-slate-500 mt-1">Aucun livre en rupture de stock.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="hidden sm:flex flex-col items-end mr-2">
                  <span className="text-sm font-semibold text-slate-900">{user?.username}</span>
                  <span className="text-xs text-slate-500 capitalize">{user?.role}</span>
                </div>
                
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                >
                  <LogOut size={18} />
                  <span className="hidden sm:inline">Déconnexion</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 px-6 py-2 bg-primary text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
              >
                Connexion
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

const NavLink: React.FC<{ to: string; children: React.ReactNode; icon: React.ReactNode; active: boolean }> = ({ to, children, icon, active }) => (
  <Link
    to={to}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
      active 
        ? 'bg-primary/10 text-primary' 
        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
    }`}
  >
    {icon}
    {children}
  </Link>
);

export default Navbar;
