import React, { useState } from 'react';
import { 
  BarChart3, 
  Brain, 
  History, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Loader2,
  Calendar,
  BookOpen,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import Navbar from '../components/Navbar/Navbar';
import api from '../api';
import { ManualAnalysisResponse, BookAnalysisInfo } from '../types';

const AnalysisPage: React.FC = () => {
  const [period, setPeriod] = useState<number>(6);
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<ManualAnalysisResponse | null>(null);

  const handleManualAnalysis = async () => {
    setLoading(true);
    try {
      const response = await api.get<ManualAnalysisResponse>('/analysis/manual', {
        params: { period }
      });
      setResults(response.data);
    } catch (err) {
      console.error("Error fetching analysis:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <BarChart3 className="text-primary" size={32} />
            Analyse du stock
          </h1>
        </div>

        {/* Analysis Modes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Manual Analysis Card */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 flex flex-col hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <History size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Analyse Manuelle</h2>
                <p className="text-sm text-slate-500">Statistiques basées sur l'historique réel</p>
              </div>
            </div>

            <div className="space-y-6 mt-auto">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Période d'analyse</label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 3, 6, 12].map((m) => (
                    <button
                      key={m}
                      onClick={() => setPeriod(m)}
                      className={`py-2 px-3 rounded-xl text-sm font-bold transition-all border ${
                        period === m 
                          ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                          : 'bg-white text-slate-600 border-slate-200 hover:border-primary/50'
                      }`}
                    >
                      {m} mois
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleManualAnalysis}
                disabled={loading}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <TrendingUp size={20} />}
                Lancer l'analyse
              </button>
            </div>
          </div>

          {/* AI Analysis Card (Placeholder) */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 flex flex-col opacity-75 relative overflow-hidden">
            <div className="absolute top-4 right-4 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-200">
              Bientôt disponible
            </div>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                <Brain size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Analyse IA</h2>
                <p className="text-sm text-slate-500">Prédictions et recommandations intelligentes</p>
              </div>
            </div>

            <div className="mt-auto pt-12 text-center">
              <p className="text-slate-400 text-sm italic mb-6">
                L'intelligence artificielle analysera bientôt vos tendances pour suggérer des achats et optimiser votre stock.
              </p>
              <button
                disabled
                className="w-full py-4 bg-slate-100 text-slate-400 rounded-2xl font-bold cursor-not-allowed border border-slate-200"
              >
                Indisponible
              </button>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {results && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <Calendar size={18} />
              <span className="text-sm font-medium">Résultats pour les {results.period_months} derniers mois</span>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <KpiCard 
                title="Total Livres" 
                value={results.total_books} 
                icon={<BookOpen size={20} />} 
                color="text-blue-600"
                bgColor="bg-blue-50"
              />
              <KpiCard 
                title="Emprunts (période)" 
                value={results.total_loans_in_period} 
                icon={<TrendingUp size={20} />} 
                color="text-indigo-600"
                bgColor="bg-indigo-50"
              />
              <KpiCard 
                title="Moy. Emprunts / Livre" 
                value={results.average_borrows} 
                icon={<BarChart3 size={20} />} 
                color="text-emerald-600"
                bgColor="bg-emerald-50"
              />
              <KpiCard 
                title="Ruptures de stock" 
                value={results.out_of_stock.length} 
                icon={<AlertTriangle size={20} />} 
                color="text-red-600"
                bgColor="bg-red-50"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top 5 Borrowed */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="text-emerald-500" size={20} />
                    Top 5 des livres empruntés
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Titre</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Emprunts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {results.top_borrowed.length > 0 ? (
                        results.top_borrowed.map((book) => (
                          <tr key={book.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4">
                              <p className="text-sm font-bold text-slate-900">{book.title}</p>
                              <p className="text-xs text-slate-500">{book.author}</p>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="inline-flex items-center justify-center bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold border border-emerald-100">
                                {book.borrow_count}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={2} className="px-6 py-8 text-center text-slate-400 italic">Aucun emprunt sur cette période</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Out of Stock */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="text-red-500" size={20} />
                    Ruptures de stock
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Titre</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {results.out_of_stock.length > 0 ? (
                        results.out_of_stock.map((book) => (
                          <tr key={book.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4">
                              <p className="text-sm font-bold text-slate-900">{book.title}</p>
                              <p className="text-xs text-slate-500">{book.author}</p>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-100 uppercase tracking-tighter">
                                Épuisé
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={2} className="px-6 py-8 text-center text-slate-400 italic">Aucune rupture de stock</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Rarely Borrowed */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <TrendingDown className="text-amber-500" size={20} />
                    Livres peu empruntés
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Titre</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Emprunts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {results.rarely_borrowed.length > 0 ? (
                        results.rarely_borrowed.slice(0, 5).map((book) => (
                          <tr key={book.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4">
                              <p className="text-sm font-bold text-slate-900">{book.title}</p>
                              <p className="text-xs text-slate-500">{book.author}</p>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="inline-flex items-center justify-center bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-sm font-bold border border-amber-100">
                                {book.borrow_count}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={2} className="px-6 py-8 text-center text-slate-400 italic">Aucun livre peu emprunté</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Never Borrowed */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <TrendingDown className="text-slate-400" size={20} />
                    Livres jamais empruntés
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Titre</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {results.never_borrowed.length > 0 ? (
                        results.never_borrowed.slice(0, 5).map((book) => (
                          <tr key={book.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4">
                              <p className="text-sm font-bold text-slate-900">{book.title}</p>
                              <p className="text-xs text-slate-500">{book.author}</p>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-slate-200">
                                Zéro intérêt
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={2} className="px-6 py-8 text-center text-slate-400 italic">Tous les livres ont été empruntés</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const KpiCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string; bgColor: string }> = ({ 
  title, value, icon, color, bgColor 
}) => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 transition-all hover:border-primary/20">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <p className={`text-3xl font-black text-slate-900`}>{value}</p>
      </div>
      <div className={`p-3 rounded-xl ${bgColor} ${color}`}>
        {icon}
      </div>
    </div>
  </div>
);

export default AnalysisPage;
