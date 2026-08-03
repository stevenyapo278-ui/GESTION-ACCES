import { useEffect, useState } from 'react';
import { Database, ArrowRight, LogIn, ClipboardList, Send, Loader2, CheckCircle2, FileText, Download, Mail } from 'lucide-react';
import { publicRequestsAPI, documentsAPI } from '../services/api';
import type { Document } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

interface RequestType {
  id: string;
  name: string;
  description?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

export default function Landing() {
  const [types, setTypes] = useState<RequestType[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [contactEmail, setContactEmail] = useState('');
  const [requestForm, setRequestForm] = useState({ typeId: '', requesterName: '', requesterEmail: '', superiorEmail: '', details: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    publicRequestsAPI.types()
      .then((res) => setTypes(res.data))
      .catch(() => {});
    documentsAPI.list()
      .then((res) => setDocuments(res.data))
      .catch(() => {});
    publicRequestsAPI.contact()
      .then((res) => setContactEmail(res.data.notificationEmail || ''))
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
            Faire une demande en ligne
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Deux façons de faire votre demande : remplissez le formulaire en ligne — elle sera
            transmise à votre supérieur hiérarchique qui la validera par email — ou téléchargez
            le formulaire, remplissez-le et transmettez-le nous par email.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
            <a
              href="#demande"
              className="btn btn-primary text-sm"
            >
              <ClipboardList className="size-4" />
              Faire une demande en ligne
            </a>
            <a
              href="#formulaires"
              className="btn btn-ghost text-sm"
            >
              <FileText className="size-4" />
              Télécharger un formulaire
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
            <h2 className="text-3xl font-bold text-white">1. Demande en ligne</h2>
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

      {/* Downloadable form documents */}
      <section id="formulaires" className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <div className="size-14 rounded-2xl bg-gold-400/10 flex items-center justify-center mx-auto mb-4">
              <FileText className="size-7 text-gold-400" />
            </div>
            <h2 className="text-3xl font-bold text-white">2. Demande par formulaire à télécharger</h2>
            <p className="text-zinc-400 mt-2 max-w-xl mx-auto">
              Téléchargez le formulaire correspondant à votre demande, imprimez-le ou remplissez-le,
              puis transmettez-le nous par email.
            </p>
          </div>

          {documents.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">
              Aucun formulaire disponible pour le moment.
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-2xl border border-space-800/60 bg-space-900/60 p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4"
                >
                  <div className="size-12 shrink-0 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <FileText className="size-6 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white">{doc.title}</h3>
                    {doc.description && (
                      <p className="text-sm text-zinc-400 mt-0.5 line-clamp-2">{doc.description}</p>
                    )}
                    <p className="text-xs text-zinc-600 mt-1">
                      {doc.fileName} · {formatSize(doc.fileSize)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <a
                      href={doc.fileUrl}
                      download={doc.fileName}
                      className="btn btn-ghost text-sm"
                    >
                      <Download className="size-4" />
                      Télécharger
                    </a>
                    {contactEmail ? (
                      <a
                        href={`mailto:${contactEmail}?subject=${encodeURIComponent('Formulaire rempli - ' + doc.title)}`}
                        className="btn btn-primary text-sm"
                      >
                        <Mail className="size-4" />
                        Envoyer par email
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-600">Email de contact non configuré</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {contactEmail && (
            <p className="text-sm text-zinc-500 text-center mt-6">
              Pour transmettre un formulaire rempli, envoyez-le à{' '}
              <a href={`mailto:${contactEmail}`} className="text-gold-400 hover:underline">
                {contactEmail}
              </a>
            </p>
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
