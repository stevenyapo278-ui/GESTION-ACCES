import { useEffect, useState } from 'react';
import { FileText, Download, Database, ArrowRight, LogIn } from 'lucide-react';
import { documentsAPI } from '../services/api';
import type { Document } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

export default function Landing() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    documentsAPI.list()
      .then((res) => setDocuments(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
            Téléchargez les formulaires et documents nécessaires à vos démarches administratives.
          </p>
        </div>
      </section>

      {/* Document list */}
      <section className="pb-20 px-4">
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
