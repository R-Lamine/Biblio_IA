import React from 'react';
import { Link } from 'react-router-dom';
import { Search, Library, BookMarked, ArrowRight } from 'lucide-react';
import Navbar from '../components/Navbar/Navbar';
import { useAuthStore } from '../store/authStore';

const ActionCard: React.FC<{
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}> = ({ to, title, description, icon }) => (
  <Link
    to={to}
    className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
  >
    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
      {icon}
    </div>
    <h2 className="text-xl font-bold text-slate-900">{title}</h2>
    <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    <div className="mt-6 flex items-center gap-2 text-sm font-bold text-primary">
      Ouvrir
      <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
    </div>
  </Link>
);

const AdherentHomePage: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="min-h-screen bg-light-bg">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Espace Client</p>
          <h1 className="mt-3 text-4xl font-black text-slate-900">Bonjour {user?.username}</h1>
          <p className="mt-3 max-w-2xl text-slate-500">
            Retrouvez votre espace client, recherchez un livre, parcourez le catalogue et suivez vos emprunts.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <ActionCard
            to="/recherche"
            title="Recherche IA"
            description="Décrivez ce que vous voulez lire et laissez l'assistant proposer des livres pertinents."
            icon={<Search size={22} />}
          />
          <ActionCard
            to="/catalogue"
            title="Catalogue"
            description="Parcourez tous les ouvrages disponibles et consultez leurs résumés IA."
            icon={<Library size={22} />}
          />
          <ActionCard
            to="/mes-lectures"
            title="Mes Lectures"
            description="Suivez vos prêts en cours, vos retards éventuels et vos dates de retour."
            icon={<BookMarked size={22} />}
          />
        </div>
      </main>
    </div>
  );
};

export default AdherentHomePage;