import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  BookCopy, 
  AlertTriangle, 
  UserPlus, 
  Bot, 
  Loader2, 
  CheckCircle2, 
  ArrowRight,
  Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar/Navbar';
import api from '../api';
import { Loan, User, Book } from '../types';

interface DashboardStats {
  activeLoans: number;
  overdueLoans: number;
  newMembers: number;
}

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({ activeLoans: 0, overdueLoans: 0, newMembers: 0 });
  const [recentLoans, setRecentLoans] = useState<any[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [loansRes, membersRes] = await Promise.all([
        api.get<Loan[]>('/loans/'),
        api.get<User[]>('/members/')
      ]);

      const loans = loansRes.data;
      const members = membersRes.data;

      setStats({
        activeLoans: loans.filter(l => l.status === 'active').length,
        overdueLoans: loans.filter(l => l.status === 'overdue').length,
        newMembers: members.length // Simplified for MVP
      });

      setRecentLoans(loans.slice(0, 5)); // Get last 5
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunAiAnalysis = async () => {
    setIsAiLoading(true);
    try {
      const response = await api.get<{ analysis: string }>('/ai/stock-analysis');
      setAiAnalysis(response.data.analysis);
    } catch (err) {
      console.error(err);
      setAiAnalysis("Erreur lors de l'analyse. Vérifiez que le service AI est disponible.");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-light-bg">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <LayoutDashboard className="text-primary" size={32} />
            Tableau de bord
          </h1>
          <div className="text-right">
            <p className="text-sm text-slate-500 italic">Connecté en tant que Bibliothécaire</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <KpiCard 
            title="Livres sortis" 
            value={stats.activeLoans} 
            icon={<BookCopy size={24} />} 
            color="border-blue-500" 
            textColor="text-blue-600"
          />
          <KpiCard 
            title="Retards critiques" 
            value={stats.overdueLoans} 
            icon={<AlertTriangle size={24} />} 
            color="border-red-500" 
            textColor="text-red-600"
          />
          <KpiCard 
            title="Nouveaux adhérents" 
            value={stats.newMembers} 
            icon={<UserPlus size={24} />} 
            color="border-green-500" 
            textColor="text-green-600"
          />
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* Recent Activity - Now full width since AI is removed */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden h-full">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Emprunts récents</h2>
                <button 
                  onClick={() => navigate('/emprunts')}
                  className="text-primary text-sm font-bold flex items-center gap-1 hover:underline"
                >
                  Voir tout <ArrowRight size={16} />
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Adhérent</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Livre</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentLoans.length > 0 ? (
                      recentLoans.map((loan) => (
                        <tr key={loan.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm font-semibold text-slate-900">Utilisateur {loan.user_id.slice(0, 5)}</td>
                          <td className="px-6 py-4 text-sm text-slate-600 line-clamp-1">Livre {loan.book_id.slice(0, 5)}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {new Date(loan.loan_date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={loan.status} />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                          Aucun emprunt enregistré récemment.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const KpiCard: React.FC<{ title: string; value: number; icon: React.ReactNode; color: string; textColor: string }> = ({ 
  title, value, icon, color, textColor 
}) => (
  <div className={`bg-white rounded-2xl p-6 shadow-sm border-l-4 ${color} border border-slate-200 transition-transform hover:scale-[1.02]`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">{title}</p>
        <p className={`text-4xl font-black ${textColor}`}>{value}</p>
      </div>
      <div className={`p-3 rounded-2xl bg-slate-50 ${textColor}`}>
        {icon}
      </div>
    </div>
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const configs: Record<string, { label: string, classes: string, icon: any }> = {
    active: { label: 'En cours', classes: 'bg-blue-50 text-blue-700 border-blue-100', icon: Clock },
    returned: { label: 'Retourné', classes: 'bg-green-50 text-green-700 border-green-100', icon: CheckCircle2 },
    overdue: { label: 'En retard', classes: 'bg-red-50 text-red-700 border-red-100', icon: AlertTriangle },
  };

  const config = configs[status] || configs.active;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${config.classes}`}>
      <Icon size={12} />
      {config.label}
    </span>
  );
};

export default DashboardPage;
