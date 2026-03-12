import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, LogOut, Search, Library, LayoutDashboard, Users, BookMarked, Home } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const Navbar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

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
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
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
