import React, { useState, useEffect } from 'react';
import { BookMarked, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import Navbar from '../components/Navbar/Navbar';
import api from '../api';
import { Loan } from '../types';

const MyLoansPage: React.FC = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMyLoans();
  }, []);

  const fetchMyLoans = async () => {
    try {
      const response = await api.get<Loan[]>('/loans/my');
      setLoans(response.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-light-bg">
      <Navbar />
      
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <BookMarked className="text-primary" size={32} />
            Mes Lectures
          </h1>
          <p className="text-slate-500 mt-1">Consultez vos emprunts en cours et vos dates de retour.</p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="animate-spin text-primary w-12 h-12" />
            <p className="text-slate-500 font-medium italic">Chargement de vos emprunts...</p>
          </div>
        ) : loans.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {loans.map((loan) => (
              <div key={loan.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-slate-100 p-3 rounded-xl text-slate-400">
                    <BookMarked size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Livre ID: {loan.book_id.slice(0, 8)}...</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Clock size={14} /> Emprunté le {new Date(loan.loan_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">À retourner avant le</p>
                    <p className={`text-lg font-black ${new Date(loan.due_date) < new Date() ? 'text-red-600' : 'text-slate-900'}`}>
                      {new Date(loan.due_date).toLocaleDateString()}
                    </p>
                  </div>
                  
                  {new Date(loan.due_date) < new Date() ? (
                    <div className="bg-red-50 text-red-700 px-4 py-2 rounded-xl border border-red-100 flex items-center gap-2 font-bold text-sm">
                      <AlertTriangle size={18} />
                      En retard
                    </div>
                  ) : (
                    <div className="bg-green-50 text-green-700 px-4 py-2 rounded-xl border border-green-100 flex items-center gap-2 font-bold text-sm">
                      <Clock size={18} />
                      En cours
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-slate-200">
            <BookMarked className="mx-auto text-slate-200 w-16 h-16 mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">Aucun livre en cours</h3>
            <p className="text-slate-500 max-w-xs mx-auto">
              Vous n'avez pas d'emprunts actifs pour le moment. Explorez le catalogue pour trouver votre prochaine lecture !
            </p>
            <button 
              onClick={() => window.location.href = '/catalogue'}
              className="mt-6 px-6 py-2.5 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              Voir le catalogue
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default MyLoansPage;
