import React, { useState, useEffect } from 'react';
import { BookMarked, Clock, AlertTriangle, CheckCircle2, Loader2, Search } from 'lucide-react';
import Navbar from '../components/Navbar/Navbar';
import api from '../api';
import { Loan } from '../types';

const LoansPage: React.FC = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'overdue' | 'returned'>('active');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLoans();
  }, [activeTab]);

  const fetchLoans = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<Loan[]>(`/loans/?status_filter=${activeTab}`);
      setLoans(response.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReturn = async (loanId: string) => {
    try {
      await api.put(`/loans/${loanId}/return`);
      fetchLoans();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-light-bg">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <BookMarked className="text-primary" size={32} />
            Gestion des Emprunts
          </h1>
          <p className="text-slate-500 mt-1">Suivez les emprunts en cours et gérez les retours d'ouvrages.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white p-1 rounded-2xl border border-slate-200 w-fit">
          <TabButton 
            active={activeTab === 'active'} 
            onClick={() => setActiveTab('active')}
            icon={<Clock size={18} />}
            label="En cours"
          />
          <TabButton 
            active={activeTab === 'overdue'} 
            onClick={() => setActiveTab('overdue')}
            icon={<AlertTriangle size={18} />}
            label="En retard"
          />
          <TabButton 
            active={activeTab === 'returned'} 
            onClick={() => setActiveTab('returned')}
            icon={<CheckCircle2 size={18} />}
            label="Historique"
          />
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="animate-spin text-primary w-12 h-12" />
            <p className="text-slate-500 font-medium italic">Chargement des emprunts...</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Livre ID</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Adhérent ID</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date d'emprunt</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Échéance</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loans.length > 0 ? (
                  loans.map((loan) => (
                    <tr key={loan.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono text-slate-600">{loan.book_id.slice(0, 8)}...</td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-600">{loan.user_id.slice(0, 8)}...</td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(loan.loan_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-medium ${new Date(loan.due_date) < new Date() && loan.status !== 'returned' ? 'text-red-600' : 'text-slate-500'}`}>
                          {new Date(loan.due_date).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {loan.status !== 'returned' && (
                          <button 
                            onClick={() => handleReturn(loan.id)}
                            className="px-4 py-2 bg-primary/10 text-primary text-xs font-bold rounded-xl hover:bg-primary hover:text-white transition-all shadow-sm"
                          >
                            Marquer retourné
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                      Aucun emprunt trouvé dans cette catégorie.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ 
  active, onClick, icon, label 
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
      active 
        ? 'bg-primary text-white shadow-lg shadow-primary/20' 
        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
    }`}
  >
    {icon}
    {label}
  </button>
);

export default LoansPage;
