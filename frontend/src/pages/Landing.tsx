import { useEffect, useState } from 'react';
import { FileText, Download, Database, ArrowRight, LogIn, ClipboardList, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { documentsAPI, publicRequestsAPI } from '../services/api';
import type { Document } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

interface RequestType {
  id: string;
  name: string;
  description?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Landing() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState<RequestType[]>([]);
  const [requestForm, setRequestForm] = useState({ typeId: '', requesterName: '', requesterEmail: '', superiorEmail: '', details: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    documentsAPI.list()
      .then((res) => setDocuments(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    publicRequestsAPI.types()
      .then((res) => setTypes(res.data))
      .catch(() => {});
  }, []);

  const submitRequest = () => {
    if (!requestForm.typeId) return toast.error('Veuillez choisir un type de demande');
    if (!requestForm.requesterName.trim()) return toast.error('Veuillez saisir votre nom');
    if (!EMAIL_REGEX.test(requestForm.requesterEmail)) return toast.error('Votre adresse email est invalide');
    if (!EMAIL_REGEX.test(requestForm.superiorEmail)) return toast.error('Adresse email du supérieur invalide');

    setSubmitting(true);
    publicRequestsAPI.create(requestForm)
      .then(() => {
        setSubmitted(true);
        toast.success('Demande envoyée. Votre supérieur va recevoir un email de validation.');
      })
      .catch((err) => toast.error(err.response?.data?.error || 'Erreur lors de l\'envoi'))
      .finally(() => setSubmitting(false));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-space-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-space-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-space-950/80 border-b border-space-800/50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-gradient-to-br from-gold-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-gold-400/20">
              <Database className="size-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">Gestions Access</span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={() => navigate('/')}
                className="btn btn-primary text-sm"
              >
                <ArrowRight className="size-4" />
                Accéder à l'application
              </button>
            ) : (
              <Link
                to="/login"
                className="btn btn-ghost text-sm"
              >
                <LogIn className="size-4" />
                Connexion
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Formulaires et documents
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Téléchargez les formulaires et documents nécessaires à vos démarches administratives,
            ou soumettez une demande en ligne : elle sera transmise à votre supérieur pour validation.
          </p>
          <div className="flex items-center justify-center gap-4 mt-8">
            <a
              href="#demande"
              className="btn btn-primary text-sm"
            >
              <ClipboardList className="size-4" />
              Faire une demande
            </a>
            <a
              href="#documents"
              className="btn btn-ghost text-sm"
            >
              <FileText className="size-4" />
              Voir les documents
            </a>
          </div>
        </div>
      </section>

      {/* Request form (no login required) */}
      <section id="demande" className="py-16 px-4 bg-space-900/30 border-y border-space-800/50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <div className="size-14 rounded-2xl bg-gold-400/10 flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="size-7 text-gold-400" />
            </div>
            <h2 className="text-3xl font-bold text-white">Faire une demande</h2>
            <p className="text-zinc-400 mt-2 max-w-xl mx-auto">
              Remplissez ce formulaire sans avoir de compte. Votre supérieur hiérarchique recevra un
              email avec les boutons Valider / Refuser, et l'équipe sera notifiée de la décision.
            </p>
          </div>

          {submitted ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
              <CheckCircle2 className="size-12 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Demande envoyée !</h3>
              <p className="text-zinc-300">
                Votre demande a bien été transmise à <strong>{requestForm.superiorEmail}</strong>.
                Vous serez informé de la décision par votre supérieur.
              </p>
              <button
                onClick={() => { setSubmitted(false); setRequestForm({ typeId: '', requesterName: '', requesterEmail: '', superiorEmail: '', details: '' }); }}
                className="btn btn-primary text-sm mt-6"
              >
                Faire une autre demande
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-space-800/60 bg-space-900/60 p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1.5">Votre nom complet *</label>
                  <input
                    className="w-full rounded-lg bg-space-950/80 border border-space-700/60 px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/30"
                    placeholder="Jean Dupont"
                    value={requestForm.requesterName}
                    onChange={(e) => setRequestForm({ ...requestForm, requesterName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1.5">Votre adresse email *</label>
                  <input
                    type="email"
                    className="w-full rounded-lg bg-space-950/80 border border-space-700/60 px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/30"
                    placeholder="jean.dupont@entreprise.com"
                    value={requestForm.requesterEmail}
                    onChange={(e) => setRequestForm({ ...requestForm, requesterEmail: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1.5">Type de demande *</label>
                  <select
                    className="w-full rounded-lg bg-space-950/80 border border-space-700/60 px-4 py-2.5 text-white focus:outline-none focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/30"
                    value={requestForm.typeId}
                    onChange={(e) => setRequestForm({ ...requestForm, typeId: e.target.value })}
                  >
                    <option value="">— Choisir —</option>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1.5">Email du supérieur hiérarchique *</label>
                  <input
                    type="email"
                    className="w-full rounded-lg bg-space-950/80 border border-space-700/60 px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/30"
                    placeholder="chef@entreprise.com"
                    value={requestForm.superiorEmail}
                    onChange={(e) => setRequestForm({ ...requestForm, superiorEmail: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-zinc-400 mb-1.5">Détails (optionnel)</label>
                  <textarea
                    className="w-full rounded-lg bg-space-950/80 border border-space-700/60 px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/30 resize-y min-h-20"
                    placeholder="Précisez le contexte de votre demande..."
                    value={requestForm.details}
                    onChange={(e) => setRequestForm({ ...requestForm, details: e.target.value })}
                  />
                </div>
              </div>
              <button
                onClick={submitRequest}
                disabled={submitting}
                className="btn btn-primary w-full mt-6"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Envoyer la demande
              </button>
              <p className="text-xs text-zinc-600 text-center mt-3">
                Une seule demande par envoi. Votre supérieur recevra un lien de validation à usage unique.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Document list */}
      <section id="documents" className="pb-20 px-4">
        <div className="max-w-4xl mx-auto">
          {documents.length === 0 ? (
            <div className="text-center py-20">
              <FileText className="size-16 text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-500">Aucun document disponible pour le moment.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {documents.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-4 p-5 rounded-xl bg-space-900/50 border border-space-800/50 hover:border-gold-400/30 hover:bg-space-900/80 transition-all duration-200"
                >
                  <div className="size-12 rounded-lg bg-gold-400/10 flex items-center justify-center flex-shrink-0 group-hover:bg-gold-400/20 transition-colors">
                    <FileText className="size-6 text-gold-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate group-hover:text-gold-400 transition-colors">
                      {doc.title}
                    </h3>
                    {doc.description && (
                      <p className="text-sm text-zinc-500 mt-1 line-clamp-2">
                        {doc.description}
                      </p>
                    )}
                    <p className="text-xs text-zinc-600 mt-1">
                      {doc.fileName} &middot; {formatSize(doc.fileSize)}
                    </p>
                  </div>
                  <div className="size-10 rounded-lg bg-gold-400/10 flex items-center justify-center flex-shrink-0 group-hover:bg-gold-400/20 group-hover:scale-110 transition-all">
                    <Download className="size-5 text-gold-400" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-space-800/50">
        <div className="max-w-6xl mx-auto text-center text-sm text-zinc-600">
          Gestions Access - Gestion des accès et formulaires
        </div>
      </footer>
    </div>
  );
}
