import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { requestsAPI } from '../services/api';
import type { RequestField } from '../types';
import { Loader2, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';

interface ReviewData {
  id: string;
  typeName: string;
  typeDescription?: string;
  requesterName: string;
  requesterEmail: string;
  details?: string;
  data?: Record<string, string>;
  typeFields?: RequestField[];
  createdAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decidedAt?: string;
  decisionComment?: string;
}

export default function ReviewRequest() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [decided, setDecided] = useState<{ status: string; message: string } | null>(null);
  const [decideError, setDecideError] = useState<string | null>(null);

  const prefillAction = searchParams.get('action');

  useEffect(() => {
    if (!token) return;
    requestsAPI
      .getReview(token)
      .then((res) => {
        setData(res.data);
        if (res.data.status !== 'PENDING') {
          setDecided({
            status: res.data.status,
            message:
              res.data.status === 'APPROVED'
                ? 'Cette demande a déjà été validée par le supérieur hiérarchique.'
                : 'Cette demande a déjà été refusée par le supérieur hiérarchique.',
          });
        }
      })
      .catch((err) => setError(err.response?.data?.error || 'Erreur lors du chargement'))
      .finally(() => setLoading(false));
  }, [token]);

  const decide = (action: 'APPROVE' | 'REJECT') => {
    if (!token) return;
    setDeciding(true);
    setDecideError(null);
    requestsAPI
      .decide(token, { action, comment: comment.trim() || undefined })
      .then((res) => setDecided({ status: action, message: res.data.message }))
      .catch((err) => {
        const serverStatus = err.response?.data?.status;
        if (serverStatus === 'APPROVED') setDecided({ status: serverStatus, message: 'Cette demande a déjà été validée.' });
        else if (serverStatus === 'REJECTED') setDecided({ status: serverStatus, message: 'Cette demande a déjà été refusée.' });
        else setDecideError(err.response?.data?.error || 'Erreur lors de l\'envoi');
      })
      .finally(() => setDeciding(false));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-space-950 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="size-10 bg-gradient-to-br from-gold-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-gold-400/20">
            <ShieldCheck className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Validation de demande</h1>
            <p className="text-xs text-zinc-500">Gestions Access</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="size-8 animate-spin text-zinc-400" />
              <p className="text-sm text-zinc-500">Chargement de la demande...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <XCircle className="size-10 text-red-500 mx-auto mb-3" />
              <p className="text-sm text-zinc-700 font-medium">Demande introuvable</p>
              <p className="text-xs text-zinc-500 mt-1">{error}</p>
            </div>
          ) : decided ? (
            <div className="text-center py-8">
              <div
                className={`size-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  decided.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                }`}
              >
                {decided.status === 'APPROVED' ? <CheckCircle2 className="size-8" /> : <XCircle className="size-8" />}
              </div>
              <h2 className="text-lg font-bold text-zinc-900">
                {decided.status === 'APPROVED' ? 'Demande validée' : decided.status === 'REJECTED' ? 'Demande refusée' : 'Réponse déjà enregistrée'}
              </h2>
              <p className="text-sm text-zinc-500 mt-2">{decided.message}</p>
              {data?.decidedAt && (
                <p className="text-xs text-zinc-400 mt-2">
                  Enregistrée le {new Date(data.decidedAt).toLocaleString('fr-FR')}
                </p>
              )}
              {data?.decisionComment && (
                <div className="mt-3 rounded-lg bg-zinc-50 p-3 text-left text-sm text-zinc-700">
                  <span className="font-medium text-zinc-900">Commentaire du supérieur :</span>
                  <span className="whitespace-pre-wrap"> {data.decisionComment}</span>
                </div>
              )}
              <p className="text-xs text-zinc-400 mt-4">Vous pouvez fermer cette page.</p>
            </div>
          ) : data ? (
            <div>
              <h2 className="text-lg font-bold text-zinc-900">{data.typeName}</h2>
              {data.typeDescription && <p className="text-xs text-zinc-500 mt-1">{data.typeDescription}</p>}

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4 py-2 border-b border-zinc-100">
                  <span className="text-zinc-500">Demandeur</span>
                  <span className="font-semibold text-zinc-800 text-right">{data.requesterName}</span>
                </div>
                <div className="flex justify-between gap-4 py-2 border-b border-zinc-100">
                  <span className="text-zinc-500">Email</span>
                  <span className="font-medium text-zinc-700 text-right">{data.requesterEmail}</span>
                </div>
                <div className="flex justify-between gap-4 py-2 border-b border-zinc-100">
                  <span className="text-zinc-500">Date</span>
                  <span className="font-medium text-zinc-700">{new Date(data.createdAt).toLocaleString('fr-FR')}</span>
                </div>
                {data.typeFields?.map((field) => {
                  const value = data.data?.[field.key];
                  if (!value || value.trim() === '') return null;
                  return (
                    <div key={field.key} className="py-2 border-b border-zinc-100">
                      <span className="text-zinc-500 block mb-1">{field.label}</span>
                      <span className="text-zinc-700 whitespace-pre-wrap">{value}</span>
                    </div>
                  );
                })}
                {data.details && (
                  <div className="py-2 border-b border-zinc-100">
                    <span className="text-zinc-500 block mb-1">Détails</span>
                    <span className="text-zinc-700 whitespace-pre-wrap">{data.details}</span>
                  </div>
                )}
              </div>

              <div className="mt-5">
                <label className="block text-xs font-medium text-zinc-500 mb-1">Commentaire (optionnel)</label>
                <textarea
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-16"
                  placeholder="Justifiez votre décision..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={deciding}
                />
              </div>

              {decideError && <p className="text-xs text-red-500 mt-2">{decideError}</p>}

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => decide('APPROVE')}
                  disabled={deciding}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
                >
                  {deciding && prefillAction === 'approve' ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Valider
                </button>
                <button
                  onClick={() => decide('REJECT')}
                  disabled={deciding}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
                >
                  {deciding && prefillAction === 'reject' ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                  Refuser
                </button>
              </div>

              {prefillAction && (
                <p className="text-xs text-zinc-400 text-center mt-3">
                  Vous pouvez confirmer la réponse pré-sélectionnée ou choisir l'autre option.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <p className="text-center text-xs text-zinc-500 mt-6">
          <Link to="/login" className="hover:text-zinc-400">Accéder à l'application</Link>
        </p>
      </div>
    </div>
  );
}
