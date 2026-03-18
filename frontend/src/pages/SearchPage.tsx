import React, { useState, useRef, useEffect } from 'react';
import { Search, Wand2, Loader2, Book as BookIcon, X, Bot, MapPin, Send, MessageSquare, Sparkles } from 'lucide-react';
import Navbar from '../components/Navbar/Navbar';
import api from '../api';
import { Book } from '../types';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

const CATEGORY_COLORS: Record<string, string> = {
  'SF/Fantastique': 'from-indigo-500 to-blue-600',
  'Classique': 'from-purple-500 to-pink-600',
  'Histoire': 'from-amber-500 to-orange-600',
  'Psychologie': 'from-green-500 to-emerald-600',
  'Dystopie': 'from-red-500 to-rose-600',
  'Jeunesse': 'from-pink-400 to-rose-400',
  'Policier': 'from-slate-600 to-slate-800',
  'Romance': 'from-rose-400 to-red-400',
  'Biographie': 'from-teal-500 to-cyan-600',
  'Philosophie': 'from-indigo-600 to-violet-700',
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const BookDetailModal: React.FC<{ book: Book; onClose: () => void; onBorrow: () => void }> = ({ book, onClose, onBorrow }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className={`h-32 bg-gradient-to-r ${CATEGORY_COLORS[book.category || ''] || 'from-slate-400 to-slate-500'} flex items-end p-6 relative`}>
          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full transition-all">
            <X size={20} />
          </button>
          <div className="bg-white p-4 rounded-2xl shadow-xl translate-y-12">
            <BookIcon size={48} className="text-slate-300" />
          </div>
        </div>
        <div className="p-8 pt-16">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-black text-slate-900 leading-tight">{book.title}</h2>
              <p className="text-lg text-slate-500 font-medium">Par {book.author}</p>
            </div>
            <span className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase tracking-widest">
              {book.category}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">ISBN</p>
              <p className="font-mono text-sm font-bold text-slate-700">{book.isbn || 'Non renseigné'}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Année</p>
              <p className="font-bold text-slate-700">{book.publication_year || 'N/A'}</p>
            </div>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl mb-8">
            <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-tighter mb-3">
              <Bot size={18} className="animate-pulse" />
              Analyse de l'Assistant IA
            </div>
            <p className="text-slate-700 leading-relaxed italic">
              "{book.resume_ia || "Aucun résumé n'a encore été généré pour ce titre."}"
            </p>
          </div>

          <div className="flex items-center justify-between pt-6 border-t border-slate-100">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">Disponibilité</p>
              <p className="font-bold text-slate-900">{book.quantity_available} exemplaires en rayon</p>
            </div>
            <button
              onClick={() => { onBorrow(); onClose(); }}
              disabled={book.quantity_available === 0}
              className={`px-8 py-3 rounded-2xl font-black shadow-lg transition-all ${
                book.quantity_available > 0
                  ? 'bg-primary text-white hover:shadow-indigo-200 hover:-translate-y-0.5 active:translate-y-0'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {book.quantity_available > 0 ? 'Emprunter maintenant' : 'Momentanément indisponible'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SearchPage: React.FC = () => {
  const [classicQuery, setClassicQuery] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Message[]>([
    { role: 'assistant', content: 'Bonjour ! Je suis votre bibliothécaire IA. Quel genre de livre recherchez-vous aujourd\'hui ?' }
  ]);
  const [results, setResults] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isAiSearchLoading, setIsAiSearchLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const chatEndRef = useRef<HTMLDivElement>(null);

 // useEffect(() => {
  //  chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
 // }, [chatHistory]);

  const handleClassicSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classicQuery.trim()) return;
    setIsLoading(true);
    setResults([]);
    try {
      const response = await api.get<Book[]>(`/books/?search=${classicQuery}`);
      setResults(response.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || isChatLoading) return;

    const userMessage = chatMessage;
    const newUserMessage: Message = { role: 'user', content: userMessage };
    setChatHistory(prev => [...prev, newUserMessage]);
    setChatMessage('');
    setIsChatLoading(true);

    // Placeholder for the assistant message
    setChatHistory(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage,
          history: chatHistory
        })
      });

      if (!response.ok) throw new Error('Streaming failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          assistantContent += chunk;
          
          setChatHistory(prev => {
            const newHistory = [...prev];
            newHistory[newHistory.length - 1].content = assistantContent;
            return newHistory;
          });
        }
      }
    } catch (err) {
      console.error(err);
      setChatHistory(prev => {
        const newHistory = [...prev];
        newHistory[newHistory.length - 1].content = "Désolé, j'ai rencontré une erreur. Réessayez plus tard.";
        return newHistory;
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleAiSearchTrigger = async () => {
    // Use the last assistant message or a summary of the chat to launch search
    const lastUserMessage = [...chatHistory].reverse().find(m => m.role === 'user')?.content;
    if (!lastUserMessage) return;

    setIsAiSearchLoading(true);
    setResults([]);
    try {
      const response = await api.post<Book[]>('/ai/search', { query: lastUserMessage });
      setResults(response.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiSearchLoading(false);
    }
  };

  const handleBorrow = async (bookId: string) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      await api.post(`/loans/?book_id=${bookId}`);
      alert('Livre emprunté avec succès !');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erreur lors de l\'emprunt');
    }
  };

  return (
    <div className="min-h-screen bg-light-bg">
      <Navbar />
      
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-slate-900 mb-4">
            Trouvez votre prochaine lecture
          </h1>
          <p className="text-lg text-slate-500 italic">
            Discutez avec notre IA ou utilisez la recherche classique.
          </p>
        </div>

        {/* Classic Search */}
        <section className="mb-8">
          <form onSubmit={handleClassicSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-lg"
                placeholder="Titre, auteur, ISBN..."
                value={classicQuery}
                onChange={(e) => setClassicQuery(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-md transition-all flex items-center gap-2"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : 'Rechercher'}
            </button>
          </form>
        </section>

        <div className="flex items-center gap-4 mb-8">
          <div className="h-px bg-slate-200 flex-1"></div>
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest text-center px-4">OU DISCUTER</span>
          <div className="h-px bg-slate-200 flex-1"></div>
        </div>

        {/* AI Chat Section */}
        <section className="bg-white border-2 border-primary/20 rounded-3xl overflow-hidden shadow-xl shadow-primary/5 flex flex-col h-[500px] md:h-[600px]">
          <div className="bg-primary/5 p-4 border-b border-primary/10 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <div className="bg-primary p-1.5 rounded-lg text-white">
                <Bot size={20} />
              </div>
              <h2 className="font-bold text-slate-900">Assistant IA Bibliophile</h2>
            </div>
            <Sparkles className="text-primary/40 animate-pulse" size={18} />
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50/50">
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] md:max-w-[80%] p-3 md:p-4 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-primary text-white rounded-tr-none' 
                    : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none shadow-sm'
                }`}>
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-none shadow-sm">
                  <Loader2 className="animate-spin text-primary" size={18} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 bg-white border-t border-slate-100 sticky bottom-0">
            <form onSubmit={handleSendMessage} className="flex gap-2 mb-3">
              <input
                type="text"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Posez votre question à l'IA..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
              />
              <button
                type="submit"
                disabled={isChatLoading || !chatMessage.trim()}
                className="bg-primary hover:bg-primary/90 text-white p-3 rounded-xl transition-all disabled:opacity-50"
              >
                <Send size={20} />
              </button>
            </form>
            <button
              onClick={handleAiSearchTrigger}
              disabled={isAiSearchLoading || chatHistory.length < 2}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition-all"
            >
              {isAiSearchLoading ? <Loader2 className="animate-spin" size={16} /> : <><Search size={16} /> Lancer la recherche</>}
            </button>
          </div>
        </section>

        {/* Results Section */}
        {(results.length > 0 || isAiSearchLoading || isLoading) && (
          <div className="mt-12 md:mt-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 border-b border-slate-200 pb-4 gap-4">
              <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                Ouvrages trouvés
                <span className="bg-slate-100 text-slate-500 text-sm px-3 py-1 rounded-full font-medium">
                  {results.length} résultat{results.length > 1 ? 's' : ''}
                </span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((book) => (
                <BookCard 
                  key={book.id} 
                  book={book} 
                  onBorrow={() => handleBorrow(book.id)} 
                  onViewDetails={() => setSelectedBook(book)}
                />
              ))}
            </div>
          </div>
        )}

        {selectedBook && (
          <BookDetailModal 
            book={selectedBook} 
            onClose={() => setSelectedBook(null)} 
            onBorrow={() => handleBorrow(selectedBook.id)} 
          />
        )}
      </main>
    </div>
  );
};

const BookCard: React.FC<{ book: Book; onBorrow: () => void; onViewDetails: () => void }> = ({ book, onBorrow, onViewDetails }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group overflow-hidden cursor-pointer flex flex-col h-full" onClick={onViewDetails}>
      <div className={`aspect-[3/2] bg-gradient-to-br ${CATEGORY_COLORS[book.category || ''] || 'from-slate-100 to-slate-200'} relative flex items-center justify-center`}>
        <BookIcon className="text-white/40 w-12 h-12 group-hover:scale-110 transition-transform" />
        <span className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-[10px] font-bold px-2 py-1 rounded-lg text-slate-600 uppercase tracking-wider border border-white/20">
          {book.category}
        </span>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h4 className="font-bold text-slate-900 leading-snug mb-1 line-clamp-2">{book.title}</h4>
        <p className="text-sm text-slate-500 mb-4 font-medium">Par {book.author}</p>
        <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 mb-6 mt-auto">
          <div className="flex items-center gap-2 text-primary font-bold text-[10px] uppercase tracking-tighter mb-1">
            <Wand2 size={12} />
            Résumé IA
          </div>
          <p className="text-[11px] text-slate-600 line-clamp-3 leading-relaxed italic">
            "{book.resume_ia || "Analyse en cours..."}"
          </p>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
          className="w-full py-2 bg-slate-50 hover:bg-primary hover:text-white text-slate-600 text-xs font-bold rounded-lg transition-all border border-slate-100 mt-auto"
        >
          Voir le détail
        </button>
      </div>
    </div>
  );
};

export default SearchPage;
