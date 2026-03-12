import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, List, Book as BookIcon, Bot, MapPin, Loader2, LogIn, X } from 'lucide-react';
import Navbar from '../components/Navbar/Navbar';
import api from '../api';
import { Book } from '../types';
import { useAuthStore } from '../store/authStore';

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

const AddBookModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: '', author: '', isbn: '', publication_year: 2024, category: 'Classique', 
    shelf_row: 'R. 1', shelf_number: 'A', quantity_total: 1, resume_ia: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateSummary = async () => {
    if (!formData.title || !formData.author) {
      alert("Veuillez remplir le titre et l'auteur d'abord.");
      return;
    }
    setIsGenerating(true);
    try {
      const response = await api.post('/ai/chat', { 
        message: `Génère un résumé très court (2 lignes) pour le livre "${formData.title}" de ${formData.author}.`,
        history: []
      });
      setFormData({ ...formData, resume_ia: response.data.response });
    } catch (err) {
      alert("Erreur lors de la génération du résumé.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/books/', formData);
      onSuccess();
      onClose();
    } catch (err) {
      alert("Erreur lors de l'ajout. Vérifiez les données.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
        <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
          <BookIcon className="text-primary" /> Ajouter un ouvrage
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input required className="w-full px-4 py-3 bg-slate-50 border rounded-xl" placeholder="Titre" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
          <input required className="w-full px-4 py-3 bg-slate-50 border rounded-xl" placeholder="Auteur" value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} />
          
          <div className="flex gap-2">
            <textarea 
              className="flex-1 px-4 py-3 bg-slate-50 border rounded-xl text-sm h-24 resize-none" 
              placeholder="Résumé IA (généré ou manuel)" 
              value={formData.resume_ia} 
              onChange={e => setFormData({...formData, resume_ia: e.target.value})}
            />
            <button 
              type="button"
              onClick={generateSummary}
              disabled={isGenerating}
              className="px-4 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all flex flex-col items-center justify-center gap-1"
            >
              {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Bot size={20} />}
              <span className="text-[8px] font-bold uppercase">Générer</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input className="w-full px-4 py-3 bg-slate-50 border rounded-xl" placeholder="ISBN" value={formData.isbn} onChange={e => setFormData({...formData, isbn: e.target.value})} />
            <select className="w-full px-4 py-3 bg-slate-50 border rounded-xl" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
              {Object.keys(CATEGORY_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button disabled={isSubmitting} className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2">
            {isSubmitting ? <Loader2 className="animate-spin" /> : "Confirmer l'ajout"}
          </button>
          <button type="button" onClick={onClose} className="w-full py-3 text-slate-400 font-bold">Annuler</button>
        </form>
      </div>
    </div>
  );
};

const CatalogPage: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Toutes');

  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchBooks();
  }, [selectedCategory]);

  const fetchBooks = async () => {
    setIsLoading(true);
    try {
      const params = selectedCategory !== 'Toutes' ? { category: selectedCategory } : {};
      const response = await api.get<Book[]>('/books/', { params });
      setBooks(response.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBorrow = async (bookId: string) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      await api.post(`/loans/?book_id=${bookId}`);
      // Refresh list
      fetchBooks();
      alert('Livre emprunté avec succès !');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erreur lors de l\'emprunt');
    }
  };

  return (
    <div className="min-h-screen bg-light-bg">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Nos Ouvrages</h1>
            <p className="text-slate-500 mt-1">Découvrez notre collection complète ({books.length} titres)</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {['Toutes', ...Object.keys(CATEGORY_COLORS)].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  selectedCategory === cat 
                    ? 'bg-primary text-white border-primary shadow-md' 
                    : 'bg-white text-slate-500 border-slate-200 hover:border-primary/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {user?.role === 'bibliothecaire' && (
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2"
              >
                <BookIcon size={20} /> Ajouter un ouvrage
              </button>
            )}

            <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-fit">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <LayoutGrid size={20} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <List size={20} />
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="animate-spin text-primary w-12 h-12" />
            <p className="text-slate-500 font-medium italic">Chargement du catalogue...</p>
          </div>
        ) : (
          <>
            {books.length === 0 ? (
              <div className="text-center py-24">
                <p className="text-slate-500 italic">Aucun livre trouvé dans cette catégorie.</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {books.map((book) => (
                  <BookCard 
                    key={book.id} 
                    book={book} 
                    onBorrow={() => handleBorrow(book.id)} 
                    onViewDetails={() => setSelectedBook(book)}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ISBN</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Titre</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Auteur</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Catégorie</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {books.map((book) => (
                      <tr key={book.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => setSelectedBook(book)}>
                        <td className="px-6 py-4 text-sm text-slate-500 font-mono">{book.isbn || 'N/A'}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900">{book.title}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{book.author}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                            {book.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {book.quantity_available > 0 ? (
                            <span className="text-green-600 text-xs font-bold flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" />
                              Disponible
                            </span>
                          ) : (
                            <span className="text-red-500 text-xs font-bold">Emprunté</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleBorrow(book.id); }}
                            disabled={book.quantity_available === 0}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                              book.quantity_available > 0 
                                ? 'bg-primary/10 text-primary hover:bg-primary hover:text-white' 
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            Emprunter
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {selectedBook && (
          <BookDetailModal 
            book={selectedBook} 
            onClose={() => setSelectedBook(null)} 
            onBorrow={() => handleBorrow(selectedBook.id)} 
          />
        )}

        {isAddModalOpen && (
          <AddBookModal 
            onClose={() => setIsAddModalOpen(false)} 
            onSuccess={fetchBooks} 
          />
        )}
      </main>
    </div>
  );
};

const BookCard: React.FC<{ book: Book; onBorrow: () => void; onViewDetails: () => void }> = ({ book, onBorrow, onViewDetails }) => {
  const gradient = CATEGORY_COLORS[book.category || ''] || 'from-slate-400 to-slate-500';
  
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden flex flex-col">
      <div 
        className={`aspect-[3/2] bg-gradient-to-br ${gradient} relative flex items-center justify-center p-8 overflow-hidden cursor-pointer`}
        onClick={onViewDetails}
      >
        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        <BookIcon className="text-white/40 w-16 h-16 transform group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500" />
        <span className="absolute top-3 right-3 bg-white/20 backdrop-blur-md text-[10px] font-black px-2.5 py-1 rounded-lg text-white uppercase tracking-wider border border-white/30">
          {book.category}
        </span>
      </div>
      
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="font-bold text-slate-900 text-lg leading-tight mb-1 line-clamp-2 cursor-pointer" onClick={onViewDetails}>{book.title}</h3>
        <p className="text-sm text-slate-500 mb-4 font-medium">Par {book.author}</p>
        
        <div className="bg-indigo-50 border border-indigo-100/50 rounded-xl p-3 mb-6 relative cursor-pointer" onClick={onViewDetails}>
          <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-tighter mb-1.5">
            <Bot size={14} className="animate-bounce" />
            Résumé IA
          </div>
          <p className="text-[11px] text-slate-600 line-clamp-3 leading-relaxed italic">
            "{book.resume_ia || "L'assistant IA prépare un résumé pour cet ouvrage..."}"
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            onClick={onViewDetails}
            className="text-xs font-bold text-slate-400 hover:text-primary transition-colors"
          >
            Voir détails
          </button>

          <button
            onClick={onBorrow}
            disabled={book.quantity_available === 0}
            className={`px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all ${
              book.quantity_available > 0
                ? 'bg-primary hover:bg-primary/90 text-white hover:shadow-indigo-200 hover:shadow-lg active:scale-95'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {book.quantity_available > 0 ? 'Emprunter' : 'Épuisé'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CatalogPage;
