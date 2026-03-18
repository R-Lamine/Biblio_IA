import React, { useState, useEffect, useRef } from 'react';
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
  Sparkles,
  MessageSquare,
  Send,
  User as UserIcon,
  Bot
} from 'lucide-react';
import Navbar from '../components/Navbar/Navbar';
import api from '../api';
import { ManualAnalysisResponse } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

const AnalysisPage: React.FC = () => {
  const [activeMode, setActiveMode] = useState<'manual' | 'ai'>('manual');
  const [period, setPeriod] = useState<number>(6);
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<ManualAnalysisResponse | null>(null);
  
  // AI Specific states
  const [prefetchedData, setPrefetchedData] = useState<ManualAnalysisResponse | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const questionsIA = [
    "Quels livres racheter en priorité ?",
    "Quels livres retirer du catalogue ?",
    "Quel est l'état général du stock ?",
    "Quels livres sont en danger de rupture ?"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    prefetchStockData();
  }, []);

  const prefetchStockData = async () => {
    try {
      const response = await api.get<ManualAnalysisResponse>('/analysis/manual', {
        params: { period: 6 }
      });
      setPrefetchedData(response.data);
    } catch (err) {
      console.error("Error prefetching data:", err);
    }
  };

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

  const handleSendMessage = async (content: string) => {
    console.log("Tentative d'envoi:", content);
    if (!prefetchedData) {
      console.warn("Données non encore chargées");
      return;
    }
    if (isStreaming || !content.trim()) return;

    const historyPayload = messages.slice(-8).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    
    const userMessage: Message = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsStreaming(true);
    
    const assistantMessage: Message = { role: 'assistant', content: '', isStreaming: true };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const token = localStorage.getItem('token');
      console.log("Fetching AI response...");
      const response = await fetch('/api/analysis/ai/stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          stock_data: prefetchedData,
          question: content,
          history: historyPayload
        })
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      if (!response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let accumulatedResponse = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulatedResponse += chunk;
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.content = accumulatedResponse;
          }
          return newMessages;
        });
      }
    } catch (err: any) {
      console.error("AI Streaming error:", err);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          lastMessage.content = `Erreur: Impossible de contacter l'IA (${err.message}). Vérifiez que le service Ollama est actif sur ${window.location.hostname}.`;
          lastMessage.isStreaming = false;
        }
        return newMessages;
      });
    } finally {
      setIsStreaming(false);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          lastMessage.isStreaming = false;
        }
        return newMessages;
      });
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
          <div 
            onClick={() => setActiveMode('manual')}
            className={`bg-white rounded-3xl shadow-sm border p-8 flex flex-col cursor-pointer transition-all ${
              activeMode === 'manual' ? 'border-primary ring-2 ring-primary/10' : 'border-slate-200 hover:border-primary/50'
            }`}
          >
            <div className="flex items-center gap-4 mb-6">
              <div className={`p-3 rounded-2xl ${activeMode === 'manual' ? 'bg-primary text-white' : 'bg-blue-50 text-blue-600'}`}>
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
                      onClick={(e) => { e.stopPropagation(); setPeriod(m); }}
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
                onClick={(e) => { e.stopPropagation(); handleManualAnalysis(); }}
                disabled={loading}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <TrendingUp size={20} />}
                Lancer l'analyse
              </button>
            </div>
          </div>

          {/* AI Analysis Card */}
          <div 
            onClick={() => setActiveMode('ai')}
            className={`bg-white rounded-3xl shadow-sm border p-8 flex flex-col cursor-pointer transition-all relative overflow-hidden ${
              activeMode === 'ai' ? 'border-purple-600 ring-2 ring-purple-600/10' : 'border-slate-200 hover:border-purple-600/50'
            }`}
          >
            <div className="absolute top-4 right-4 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-purple-200">
              Assistant IA
            </div>
            
            <div className="flex items-center gap-4 mb-6">
              <div className={`p-3 rounded-2xl ${activeMode === 'ai' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-600'}`}>
                <Brain size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Analyse IA</h2>
                <p className="text-sm text-slate-500">Assistant intelligent pour vos décisions</p>
              </div>
            </div>

            <div className="mt-auto flex items-center gap-2 text-purple-600 font-bold text-sm">
              <Sparkles size={16} />
              {prefetchedData ? "Données synchronisées" : "Chargement des données..."}
            </div>
          </div>
        </div>

        {/* Manual Analysis Results */}
        {activeMode === 'manual' && results && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <Calendar size={18} />
              <span className="text-sm font-medium">Résultats pour les {results.period_months} derniers mois</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              <KpiCard title="Total Livres" value={results.total_books} icon={<BookOpen size={20} />} color="text-blue-600" bgColor="bg-blue-50" />
              <KpiCard title="Emprunts (période)" value={results.total_loans_in_period} icon={<TrendingUp size={20} />} color="text-indigo-600" bgColor="bg-indigo-50" />
              <KpiCard title="Moy. Emprunts / Livre" value={results.average_borrows} icon={<BarChart3 size={20} />} color="text-emerald-600" bgColor="bg-emerald-50" />
              <KpiCard title="Ruptures de stock" value={results.out_of_stock.length} icon={<AlertTriangle size={20} />} color="text-red-600" bgColor="bg-red-50" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top 5, Out of stock, Rarely borrowed, Never borrowed sections */}
              <AnalysisSection title="Top 5 des livres empruntés" icon={<TrendingUp className="text-emerald-500" size={20} />} data={results.top_borrowed} type="borrow_count" />
              <AnalysisSection title="Ruptures de stock" icon={<AlertTriangle className="text-red-500" size={20} />} data={results.out_of_stock} type="stock" />
              <AnalysisSection title="Livres peu empruntés" icon={<TrendingDown className="text-amber-500" size={20} />} data={results.rarely_borrowed} type="borrow_count" />
              <AnalysisSection title="Livres jamais empruntés" icon={<TrendingDown className="text-slate-400" size={20} />} data={results.never_borrowed} type="action" />
            </div>
          </div>
        )}

        {/* AI Chat Interface */}
        {activeMode === 'ai' && (
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Chat Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-600/20">
                  <Bot size={20} />
                </div>
                <div>
                  <p className="font-bold text-slate-900">Assistant Bibliothécaire IA</p>
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-tighter">Données réelles synchronisées</p>
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                  <Sparkles size={48} className="text-purple-600" />
                  <div>
                    <p className="text-xl font-bold text-slate-900">Comment puis-je vous aider ?</p>
                    <p className="text-sm">Posez une question sur l'état de votre stock.</p>
                  </div>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-purple-100 text-purple-600'
                      }`}>
                        {msg.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
                      </div>
                      <div className={`p-4 rounded-2xl shadow-sm ${
                        msg.role === 'user' 
                          ? 'bg-primary text-white rounded-tr-none' 
                          : 'bg-white border border-slate-100 rounded-tl-none text-slate-700'
                      }`}>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                          {msg.isStreaming && (
                            <span className="inline-block w-1.5 h-4 ml-1 bg-purple-600 animate-pulse align-middle" />
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input & Suggestions */}
            <div className="p-6 bg-white border-t border-slate-100 space-y-4">
              <div className="flex flex-wrap gap-2">
                {questionsIA.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    disabled={isStreaming}
                    className="px-4 py-2 bg-slate-50 hover:bg-purple-50 hover:text-purple-700 border border-slate-100 hover:border-purple-200 rounded-full text-xs font-bold text-slate-600 transition-all disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <form 
                onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputMessage); }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Posez votre question ici..."
                  disabled={isStreaming}
                  className="flex-1 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 transition-all disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isStreaming || !inputMessage.trim()}
                  className="p-4 bg-purple-600 text-white rounded-2xl shadow-lg shadow-purple-600/20 hover:bg-purple-700 transition-all disabled:opacity-50"
                >
                  {isStreaming ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const AnalysisSection: React.FC<{ title: string, icon: React.ReactNode, data: any[], type: 'borrow_count' | 'stock' | 'action' }> = ({ 
  title, icon, data, type 
}) => (
  <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">{icon}{title}</h3>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left min-w-[500px]">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Titre</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">
              {type === 'stock' ? 'Statut' : type === 'borrow_count' ? 'Emprunts' : 'Action'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.length > 0 ? data.slice(0, 5).map((book) => (
            <tr key={book.id} className="hover:bg-slate-50/50">
              <td className="px-6 py-4">
                <p className="text-sm font-bold text-slate-900">{book.title}</p>
                <p className="text-xs text-slate-500">{book.author}</p>
              </td>
              <td className="px-6 py-4 text-center">
                {type === 'stock' ? (
                  <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-100 uppercase tracking-tighter">Épuisé</span>
                ) : type === 'borrow_count' ? (
                  <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold border ${
                    book.borrow_count > 2 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                  }`}>
                    {book.borrow_count}
                  </span>
                ) : (
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-slate-200">Zéro intérêt</span>
                )}
              </td>
            </tr>
          )) : (
            <tr><td colSpan={2} className="px-6 py-8 text-center text-slate-400 italic">Aucune donnée</td></tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

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
