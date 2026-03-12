import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, AlertCircle, Loader2 } from 'lucide-react';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import { AuthResponse } from '../types';

const LoginPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [selectedRole, setSelectedRole] = useState<'adherent' | 'bibliothecaire'>('adherent');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const loginStore = useAuthStore((state) => state.login);

  const applyPreset = (role: 'bibliothecaire' | 'adherent') => {
    setIsLogin(true);
    setError('');
    if (role === 'bibliothecaire') {
      setUsername('admin');
      setEmail('bibliothecaire@biblioia.fr');
      setPassword('admin123');
      setSelectedRole('bibliothecaire');
      return;
    }
    setUsername('adherent');
    setEmail('adherent@biblioia.fr');
    setPassword('adherent123');
    setSelectedRole('adherent');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        // FastAPI OAuth2 expects form data
        const formData = new FormData();
        formData.append('username', username || email); // Using username field for either
        formData.append('password', password);

        const response = await api.post<AuthResponse>('/auth/login', formData);
        const { access_token, user } = response.data;
        loginStore(user, access_token);
        
        // Redirect based on role
        if (user.role === 'bibliothecaire') {
          navigate('/dashboard');
        } else {
          navigate('/espace-client');
        }
      } else {
        await api.post('/auth/register', {
          email,
          username,
          password,
          role: selectedRole
        });
        setIsLogin(true);
        setError('Compte créé avec succès ! Connectez-vous.');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Une erreur est survenue.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-light-bg text-slate-900">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-slate-100">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-primary p-3 rounded-2xl mb-4">
            <BookOpen className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Biblio-IA</h1>
          <p className="text-slate-500 mt-2">Gestion de bibliothèque intelligente</p>
        </div>

        <div className="flex border-b border-slate-100 mb-6">
          <button
            className={`flex-1 py-2 font-medium transition-colors ${
              isLogin ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-600'
            }`}
            onClick={() => setIsLogin(true)}
          >
            Connexion
          </button>
          <button
            className={`flex-1 py-2 font-medium transition-colors ${
              !isLogin ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-600'
            }`}
            onClick={() => setIsLogin(false)}
          >
            Inscription
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => applyPreset('adherent')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-all hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Connexion rapide</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">Entrer comme client</div>
          </button>
          <button
            type="button"
            onClick={() => applyPreset('bibliothecaire')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-all hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Connexion rapide</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">Entrer comme bibliothécaire</div>
          </button>
        </div>

        {error && (
          <div className={`p-3 rounded-lg flex items-center gap-2 mb-6 ${
            error.includes('succès') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            <AlertCircle size={18} />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Type de compte</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('adherent')}
                    className={`rounded-lg border px-4 py-3 text-left transition-all ${
                      selectedRole === 'adherent'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-primary/40'
                    }`}
                  >
                    <div className="text-sm font-semibold">Client</div>
                    <div className="mt-1 text-xs text-slate-500">Cherche et emprunte des livres</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole('bibliothecaire')}
                    className={`rounded-lg border px-4 py-3 text-left transition-all ${
                      selectedRole === 'bibliothecaire'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-primary/40'
                    }`}
                  >
                    <div className="text-sm font-semibold">Bibliothécaire</div>
                    <div className="mt-1 text-xs text-slate-500">Gère le catalogue et les emprunts</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="votre@email.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </>
          )}
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              {isLogin ? 'Nom d\'utilisateur ou Email' : 'Nom d\'utilisateur'}
            </label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="ex: jean_dupont"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Mot de passe</label>
            <input
              type="password"
              required
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-lg shadow-md hover:shadow-lg transform active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              isLogin ? 'Se connecter' : 'Créer un compte'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
