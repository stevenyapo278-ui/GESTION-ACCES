import { useEffect, useState } from 'react';
import {
  Database,
  ArrowRight,
  LogIn,
  FileText,
  Download,
  Mail,
  Sun,
  Moon,
  ShieldCheck,
  BellRing,
  PenLine,
} from 'lucide-react';
import { publicRequestsAPI, documentsAPI } from '../services/api';
import type { Document } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate, Link } from 'react-router-dom';

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

const GRID_PATTERN = `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2394a3b8' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`;

const STEPS = [
  { icon: PenLine, title: 'Remplissez la demande', desc: 'Connectez-vous puis complétez le formulaire en ligne en quelques minutes.' },
  { icon: ShieldCheck, title: 'Validation par email', desc: 'Votre supérieur reçoit un email avec les boutons Valider / Refuser.' },
  { icon: BellRing, title: 'Équipe notifiée', desc: 'L\'équipe est informée automatiquement de la décision, où qu\'elle soit.' },
];

export default function Landing() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [contactEmail, setContactEmail] = useState('');
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    documentsAPI.list()
      .then((res) => setDocuments(res.data))
      .catch(() => {});
    publicRequestsAPI.contact()
      .then((res) => setContactEmail(res.data.notificationEmail || ''))
      .catch(() => {});
  }, []);

  // ─── Theme-aware class helpers ───────────────────────────────
  const heading = isDark ? 'text-white' : 'text-zinc-900';
  const body = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const muted = 'text-zinc-500';
  const card = isDark
    ? 'bg-space-900/60 border-space-800/60'
    : 'bg-white border-zinc-200 shadow-sm';
  const softSection = isDark ? 'bg-space-900/30 border-y border-space-800/50' : 'bg-zinc-100/70 border-y border-zinc-200';
  const goldText = isDark ? 'text-gold-400' : 'text-gold-600';

  return (
    <div className={`min-h-screen ${isDark ? 'bg-space-950' : 'bg-slate-50'} transition-colors duration-300`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 backdrop-blur-xl border-b transition-colors duration-300 ${
        isDark ? 'bg-space-950/80 border-space-800/50' : 'bg-white/80 border-zinc-200'
      }`}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-gradient-to-br from-gold-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-gold-400/20">
              <Database className="size-5 text-white" />
            </div>
            <span className={`text-lg font-bold ${heading}`}>Gestions Access</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className={`flex items-center justify-center size-10 rounded-xl transition-colors ${
                isDark ? 'hover:bg-space-800 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-600'
              }`}
              title={isDark ? 'Mode clair' : 'Mode sombre'}
            >
              {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
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
      <section className="relative overflow-hidden py-20 md:py-28 px-4">
        {/* Decorative background */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className={`absolute inset-0 opacity-[0.04] ${isDark ? '' : 'opacity-[0.05]'}`} style={{ backgroundImage: GRID_PATTERN }} />
          <div className={`absolute -top-32 -left-24 size-[28rem] rounded-full blur-3xl ${isDark ? 'bg-blue-500/20' : 'bg-blue-400/15'}`} />
          <div className={`absolute top-1/2 -right-32 size-[26rem] rounded-full blur-3xl ${isDark ? 'bg-gold-400/15' : 'bg-gold-400/20'}`} />
          <div className={`absolute bottom-0 left-1/3 size-72 rounded-full blur-3xl ${isDark ? 'bg-blue-500/10' : 'bg-blue-300/20'}`} />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold mb-6 animate-fade-in ${
            isDark ? 'border-gold-400/30 bg-gold-400/10 text-gold-400' : 'border-gold-600/30 bg-gold-400/10 text-gold-600'
          }`}>
            <span className="size-1.5 rounded-full bg-current animate-pulse" />
            Accès réservé aux utilisateurs · Validation par email
          </div>

          <h1 className={`text-4xl md:text-6xl font-bold ${heading} mb-6 animate-fade-in-up leading-[1.1]`}>
            Faites votre <span className="text-gradient">demande en ligne</span>
          </h1>
          <p className={`text-base md:text-lg ${body} max-w-2xl mx-auto animate-fade-in-up leading-relaxed`} style={{ animationDelay: '0.1s' }}>
            Connectez-vous pour remplir le formulaire en ligne — votre demande sera
            transmise à votre supérieur hiérarchique qui la validera par email — ou téléchargez
            le formulaire, remplissez-le et transmettez-le nous par email.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-10 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
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
                className="btn btn-primary text-sm"
              >
                <LogIn className="size-4" />
                Se connecter pour faire une demande
              </Link>
            )}
            <a
              href="#formulaires"
              className={`btn text-sm ${isDark ? 'btn-ghost' : 'border border-zinc-300 bg-white text-zinc-700 hover:border-gold-500/60 hover:text-gold-600'}`}
            >
              <FileText className="size-4" />
              Télécharger un formulaire
            </a>
          </div>

          {/* How it works */}
          <div className="grid sm:grid-cols-3 gap-4 mt-16 text-left">
            {STEPS.map((step, i) => (
              <div
                key={i}
                className={`rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1 animate-fade-in-up ${
                  card
                } ${isDark ? 'hover:border-gold-400/40 hover:shadow-xl hover:shadow-black/20' : 'hover:border-gold-500/50 hover:shadow-lg hover:shadow-zinc-300/50'}`}
                style={{ animationDelay: `${0.25 + i * 0.1}s` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="size-11 rounded-xl bg-gradient-to-br from-gold-400 to-blue-500 flex items-center justify-center shadow-lg shadow-gold-400/20">
                    <step.icon className="size-5 text-white" />
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${muted}`}>
                    Étape {i + 1}
                  </span>
                </div>
                <p className={`text-sm font-semibold ${heading}`}>{step.title}</p>
                <p className={`text-xs mt-1 leading-relaxed ${body}`}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demande en ligne (connexion requise) */}
      <section id="demande" className={`py-16 md:py-20 px-4 scroll-mt-16 transition-colors duration-300 ${softSection}`}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-5 bg-gold-400/10 border-gold-400/30">
              <span className="size-6 rounded-full bg-gradient-to-br from-gold-400 to-blue-500 text-white text-xs font-bold flex items-center justify-center">1</span>
              <span className={`text-xs font-semibold uppercase tracking-widest ${goldText}`}>Demande en ligne</span>
            </div>
            <h2 className={`text-3xl md:text-4xl font-bold ${heading}`}>
              <span className="text-gradient">Connectez-vous</span> pour faire votre demande
            </h2>
            <p className={`${body} mt-3 max-w-xl mx-auto leading-relaxed`}>
              La création de demande en ligne est réservée aux utilisateurs. Identifiez-vous
              pour accéder au formulaire : votre supérieur hiérarchique recevra un email avec
              les boutons Valider / Refuser, et l'équipe sera notifiée de la décision.
            </p>
          </div>

          <div className={`rounded-2xl border p-10 text-center shadow-2xl transition-colors duration-300 ${
            isDark ? 'bg-space-900/80 border-space-800/60 shadow-black/30' : 'bg-white border-zinc-200 shadow-zinc-200/60'
          }`}>
            {user ? (
              <>
                <div className={`size-16 rounded-full flex items-center justify-center mx-auto mb-5 ${
                  isDark ? 'bg-gold-400/10' : 'bg-gold-50'
                }`}>
                  <ShieldCheck className={`size-8 ${goldText}`} />
                </div>
                <h3 className={`text-xl font-semibold ${heading} mb-2`}>Vous êtes connecté</h3>
                <p className={`${body} max-w-md mx-auto leading-relaxed mb-8`}>
                  Vous pouvez accéder au formulaire de demande depuis l'application.
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="btn btn-primary text-sm"
                >
                  <ArrowRight className="size-4" />
                  Accéder à l'application
                </button>
              </>
            ) : (
              <>
                <div className={`size-16 rounded-full flex items-center justify-center mx-auto mb-5 ${
                  isDark ? 'bg-gold-400/10' : 'bg-gold-50'
                }`}>
                  <LogIn className={`size-8 ${goldText}`} />
                </div>
                <h3 className={`text-xl font-semibold ${heading} mb-2`}>Connexion requise</h3>
                <p className={`${body} max-w-md mx-auto leading-relaxed mb-8`}>
                  Utilisez votre identifiant habituel pour accéder au formulaire de demande en ligne.
                </p>
                <Link
                  to="/login"
                  className="btn btn-primary text-sm"
                >
                  <LogIn className="size-4" />
                  Se connecter
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Downloadable form documents */}
      <section id="formulaires" className="py-16 md:py-20 px-4 scroll-mt-16">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-5 bg-gold-400/10 border-gold-400/30">
              <span className="size-6 rounded-full bg-gradient-to-br from-gold-400 to-blue-500 text-white text-xs font-bold flex items-center justify-center">2</span>
              <span className={`text-xs font-semibold uppercase tracking-widest ${goldText}`}>Formulaire à télécharger</span>
            </div>
            <h2 className={`text-3xl md:text-4xl font-bold ${heading}`}>
              Besoin d'un <span className="text-gradient">formulaire papier</span> ?
            </h2>
            <p className={`${body} mt-3 max-w-xl mx-auto leading-relaxed`}>
              Téléchargez le formulaire correspondant à votre demande, imprimez-le ou remplissez-le,
              puis transmettez-le nous par email.
            </p>
          </div>

          {documents.length === 0 ? (
            <div className={`text-center py-12 rounded-2xl border border-dashed ${isDark ? 'text-zinc-500 border-space-700' : 'text-zinc-400 border-zinc-300'}`}>
              <FileText className="size-12 mx-auto mb-3 opacity-40" />
              <p>Aucun formulaire disponible pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className={`rounded-2xl border p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4 transition-all duration-300 hover:-translate-y-0.5 ${
                    card
                  } ${isDark ? 'hover:border-gold-400/40 hover:shadow-xl hover:shadow-black/20' : 'hover:border-gold-500/50 hover:shadow-lg hover:shadow-zinc-200/60'}`}
                >
                  <div className={`size-12 shrink-0 rounded-xl flex items-center justify-center ${
                    isDark ? 'bg-blue-500/10' : 'bg-blue-50'
                  }`}>
                    <FileText className={`size-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold ${heading}`}>{doc.title}</h3>
                    {doc.description && (
                      <p className={`text-sm mt-0.5 line-clamp-2 ${body}`}>{doc.description}</p>
                    )}
                    <p className={`text-xs mt-1 ${muted}`}>
                      {doc.fileName} · {formatSize(doc.fileSize)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <a
                      href={doc.fileUrl}
                      download={doc.fileName}
                      className={`btn text-sm ${isDark ? 'btn-ghost' : 'border border-zinc-300 bg-white text-zinc-700 hover:border-gold-500/60 hover:text-gold-600'}`}
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
                      <span className={`text-xs ${muted}`}>Email de contact non configuré</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {contactEmail && (
            <p className={`text-sm text-center mt-8 ${body}`}>
              Pour transmettre un formulaire rempli, envoyez-le à{' '}
              <a href={`mailto:${contactEmail}`} className={`${goldText} hover:underline font-medium`}>
                {contactEmail}
              </a>
            </p>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-8 px-4 border-t transition-colors duration-300 ${
        isDark ? 'border-space-800/50' : 'border-zinc-200'
      }`}>
        <div className={`max-w-6xl mx-auto text-center text-sm ${muted}`}>
          Gestions Access - Gestion des accès et formulaires
        </div>
      </footer>
    </div>
  );
}
