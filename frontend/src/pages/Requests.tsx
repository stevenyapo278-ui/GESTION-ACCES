import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Send, Loader2, Clock, CheckCircle2, XCircle, Inbox, ClipboardList, ShieldCheck, Users, Filter } from 'lucide-react';
import { requestsAPI, publicRequestsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { RequestField } from '../types';
import toast from 'react-hot-toast';

interface RequestType {
  id: string;
  name: string;
  description?: string;
  fields?: RequestField[];
}

interface RequestItem {
  id: string;
  typeId: string;
  superiorEmail: string;
  requesterName?: string;
  requesterEmail?: string;
  requester?: { firstName: string; lastName: string; email: string };
  details?: string;
  data?: Record<string, string>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decisionComment?: string;
  decidedAt?: string;
  createdAt: string;
  type: { name: string; fields?: RequestField[] };
}

const statusConfig: Record<RequestItem['status'], { label: string; icon: React.ElementType; color: string }> = {
  PENDING: { label: 'En attente', icon: Clock, color: 'text-amber-500 bg-amber-500/10' },
  APPROVED: { label: 'Validée', icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-500/10' },
  REJECTED: { label: 'Refusée', icon: XCircle, color: 'text-red-500 bg-red-500/10' },
};

function answerSummary(r: RequestItem): string {
  const answers = (r.type.fields || [])
    .map((f) => r.data?.[f.key])
    .filter((v) => v && v.trim() !== '')
    .join(' · ');
  return [answers, r.details].filter(Boolean).join(' · ') || '—';
}

function requesterDisplay(r: RequestItem): string {
  if (r.requesterName) return r.requesterName;
  if (r.requester) return `${r.requester.firstName} ${r.requester.lastName}`;
  return '—';
}

function requesterEmail(r: RequestItem): string {
  return r.requesterEmail || r.requester?.email || '—';
}

export default function Requests() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'new' | 'mine' | 'review' | 'all'>('new');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [form, setForm] = useState({ typeId: '', superiorEmail: '', details: '' });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [reviewBusy, setReviewBusy] = useState<Record<string, string | null>>({});
  const [superiorEmails, setSuperiorEmails] = useState<string[]>([]);

  useEffect(() => {
    publicRequestsAPI.superiors()
      .then((res) => setSuperiorEmails(res.data.emails || []))
      .catch(() => {});
  }, []);

  const { data: types, isLoading: typesLoading } = useQuery<RequestType[]>({
    queryKey: ['request-types'],
    queryFn: async () => (await requestsAPI.types.list()).data,
  });

  const selectedType = types?.find((t) => t.id === form.typeId);

  const { data: myRequests, isLoading: requestsLoading } = useQuery<RequestItem[]>({
    queryKey: ['my-requests'],
    queryFn: async () => (await requestsAPI.mine()).data,
    enabled: tab === 'mine',
  });

  const { data: reviewRequests, isLoading: reviewLoading } = useQuery<RequestItem[]>({
    queryKey: ['to-review'],
    queryFn: async () => (await requestsAPI.toReview()).data,
    enabled: tab === 'review',
  });

  const { data: allRequests, isLoading: allLoading } = useQuery<RequestItem[]>({
    queryKey: ['all-requests', statusFilter],
    queryFn: async () => (await requestsAPI.list({ status: statusFilter === 'ALL' ? undefined : statusFilter })).data,
    enabled: tab === 'all' && isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: () => requestsAPI.create({ ...form, data: answers }),
    onSuccess: () => {
      toast.success('Demande envoyée. Un email de validation a été adressé à votre supérieur.');
      setForm({ typeId: '', superiorEmail: '', details: '' });
      setAnswers({});
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      setTab('mine');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors de la création'),
  });

  const submit = () => {
    if (!form.typeId) return toast.error('Veuillez choisir un type de demande');
    if (!form.superiorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.superiorEmail)) {
      return toast.error('Adresse email du supérieur invalide');
    }
    for (const field of selectedType?.fields || []) {
      const value = (answers[field.key] || '').trim();
      if (field.required && value === '') {
        return toast.error(`Le champ « ${field.label} » est requis`);
      }
    }
    createMutation.mutate();
  };

  const decideById = (requestId: string, action: 'APPROVE' | 'REJECT') => {
    setReviewBusy((prev) => ({ ...prev, [requestId]: action }));
    requestsAPI
      .decideById(requestId, { action, comment: (reviewComments[requestId] || '').trim() || undefined })
      .then(() => {
        toast.success(action === 'APPROVE' ? 'Demande validée' : 'Demande refusée');
        queryClient.invalidateQueries({ queryKey: ['to-review'] });
      })
      .catch((err) => toast.error(err.response?.data?.error || 'Erreur lors de la décision'))
      .finally(() => setReviewBusy((prev) => ({ ...prev, [requestId]: null })));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Demandes</h2>
        <p className="text-zinc-500 text-sm mt-1">Soumettez une demande qui sera validée par votre supérieur hiérarchique par email.</p>
      </div>

      <div className="flex gap-2 border-b pb-3" style={{ borderColor: 'var(--border-color)' }}>
        <button
          onClick={() => setTab('new')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'new' ? 'bg-accent-blue/15 text-accent-blue' : 'text-zinc-500 hover:bg-white/5'
          }`}
        >
          <Send className="size-4" /> Nouvelle demande
        </button>
        <button
          onClick={() => setTab('mine')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'mine' ? 'bg-accent-blue/15 text-accent-blue' : 'text-zinc-500 hover:bg-white/5'
          }`}
        >
          <ClipboardList className="size-4" /> Mes demandes
        </button>
        <button
          onClick={() => setTab('review')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'review' ? 'bg-accent-blue/15 text-accent-blue' : 'text-zinc-500 hover:bg-white/5'
          }`}
        >
          <ShieldCheck className="size-4" /> À valider
          {reviewRequests && reviewRequests.length > 0 && tab !== 'review' && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400">
              {reviewRequests.length}
            </span>
          )}
        </button>
        {isAdmin && (
          <button
            onClick={() => setTab('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'all' ? 'bg-accent-blue/15 text-accent-blue' : 'text-zinc-500 hover:bg-white/5'
            }`}
          >
            <Users className="size-4" /> Toutes les demandes
          </button>
        )}
      </div>

      {tab === 'new' && (
        <div className="card p-5 max-w-xl">
          <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Nouvelle demande</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Type de demande</label>
              {typesLoading ? (
                <div className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 className="size-4 animate-spin" /> Chargement...</div>
              ) : (
                <select className="input" value={form.typeId} onChange={(e) => { setForm({ ...form, typeId: e.target.value }); setAnswers({}); }}>
                  <option value="">— Choisir —</option>
                  {types?.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
              {form.typeId && (
                <p className="text-xs text-zinc-500 mt-1">{types?.find((t) => t.id === form.typeId)?.description}</p>
              )}
            </div>
            <div>
              <label className="label">Email du supérieur hiérarchique</label>
              <input
                type="email"
                list="superior-emails"
                className="input"
                placeholder="superieur@entreprise.com"
                value={form.superiorEmail}
                onChange={(e) => setForm({ ...form, superiorEmail: e.target.value })}
              />
              <datalist id="superior-emails">
                {superiorEmails.map((email) => (
                  <option key={email} value={email} />
                ))}
              </datalist>
              <p className="text-xs text-zinc-500 mt-1">Un email avec les boutons Valider / Refuser sera envoyé à cette adresse.</p>
            </div>
            <div>
              <label className="label">Détails (optionnel)</label>
              <textarea
                className="input min-h-24 resize-y"
                placeholder="Précisez le contexte de votre demande..."
                value={form.details}
                onChange={(e) => setForm({ ...form, details: e.target.value })}
              />
            </div>
            {selectedType?.fields?.map((field) => (
              <div key={field.key}>
                <label className="label">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    className="input min-h-20 resize-y"
                    placeholder={field.label}
                    value={answers[field.key] || ''}
                    onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })}
                  />
                ) : field.type === 'select' ? (
                  <select
                    className="input"
                    value={answers[field.key] || ''}
                    onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })}
                  >
                    <option value="">— Choisir —</option>
                    {(field.options || []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    className="input"
                    placeholder={field.label}
                    value={answers[field.key] || ''}
                    onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })}
                  />
                )}
              </div>
            ))}
            <button onClick={submit} disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Envoyer la demande
            </button>
          </div>
        </div>
      )}

      {tab === 'mine' && (
        <div className="card overflow-hidden">
          {requestsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="size-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
            </div>
          ) : myRequests && myRequests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table-wrap w-full">
                <thead>
                  <tr>
                    <th className="px-5 py-3 text-left">Type</th>
                    <th className="px-5 py-3 text-left">Supérieur</th>
                    <th className="px-5 py-3 text-left">Détails</th>
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-5 py-3 text-left">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                  {myRequests.map((r) => {
                    const s = statusConfig[r.status];
                    const Icon = s.icon;
                    return (
                      <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-4 font-medium" style={{ color: 'var(--text-primary)' }}>{r.type.name}</td>
                        <td className="px-5 py-4 text-sm text-zinc-500">{r.superiorEmail}</td>
                        <td className="px-5 py-4 text-sm text-zinc-400 max-w-xs truncate">{answerSummary(r)}</td>
                        <td className="px-5 py-4 text-sm text-zinc-500">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.color}`}>
                            <Icon className="size-3.5" /> {s.label}
                          </span>
                          {r.decisionComment && (
                            <p className="text-xs text-zinc-500 mt-1">« {r.decisionComment} »</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-zinc-500">
              <Inbox className="size-8 mb-2 opacity-50" />
              <p className="text-sm">Aucune demande pour le moment.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'review' && (
        <div className="card overflow-hidden">
          {reviewLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="size-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
            </div>
          ) : reviewRequests && reviewRequests.length > 0 ? (
            <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
              {reviewRequests.map((r) => (
                <div key={r.id} className="p-5 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{r.type.name}</h4>
                      <p className="text-sm text-zinc-500 mt-0.5">
                        <span className="font-medium text-zinc-300">{r.requesterName || '—'}</span>
                        {r.requesterEmail ? ` (${r.requesterEmail})` : ''} ·{' '}
                        {new Date(r.createdAt).toLocaleString('fr-FR')}
                      </p>
                      {r.data && (
                        <p className="text-sm text-zinc-400 mt-1 max-w-xl">
                          {answerSummary(r)}
                        </p>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500">
                      <Clock className="size-3.5" /> En attente
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className="input flex-1 min-w-40"
                      placeholder="Commentaire (optionnel)"
                      value={reviewComments[r.id] || ''}
                      onChange={(e) => setReviewComments({ ...reviewComments, [r.id]: e.target.value })}
                    />
                    <button
                      onClick={() => decideById(r.id, 'APPROVE')}
                      disabled={!!reviewBusy[r.id]}
                      className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 disabled:opacity-50"
                    >
                      {reviewBusy[r.id] === 'APPROVE' ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                      Valider
                    </button>
                    <button
                      onClick={() => decideById(r.id, 'REJECT')}
                      disabled={!!reviewBusy[r.id]}
                      className="btn-primary !bg-red-600 hover:!bg-red-700 disabled:opacity-50"
                    >
                      {reviewBusy[r.id] === 'REJECT' ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                      Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-zinc-500">
              <ShieldCheck className="size-8 mb-2 opacity-50" />
              <p className="text-sm">Aucune demande à valider pour le moment.</p>
            </div>
          )}
        </div>
      )}

      {isAdmin && tab === 'all' && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-zinc-500" />
              <select
                className="input !w-auto"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Tous les statuts</option>
                <option value="PENDING">En attente</option>
                <option value="APPROVED">Validées</option>
                <option value="REJECTED">Refusées</option>
              </select>
            </div>
            <p className="text-xs text-zinc-500">{allRequests?.length ?? 0} demande(s)</p>
          </div>
          {allLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="size-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
            </div>
          ) : allRequests && allRequests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table-wrap w-full">
                <thead>
                  <tr>
                    <th className="px-5 py-3 text-left">Type</th>
                    <th className="px-5 py-3 text-left">Demandeur</th>
                    <th className="px-5 py-3 text-left">Supérieur</th>
                    <th className="px-5 py-3 text-left">Détails</th>
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-5 py-3 text-left">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                  {allRequests.map((r) => {
                    const s = statusConfig[r.status];
                    const Icon = s.icon;
                    return (
                      <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-4 font-medium" style={{ color: 'var(--text-primary)' }}>{r.type.name}</td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{requesterDisplay(r)}</p>
                          <p className="text-xs text-zinc-500">{requesterEmail(r)}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-zinc-500">{r.superiorEmail}</td>
                        <td className="px-5 py-4 text-sm text-zinc-400 max-w-xs truncate">{answerSummary(r)}</td>
                        <td className="px-5 py-4 text-sm text-zinc-500">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.color}`}>
                            <Icon className="size-3.5" /> {s.label}
                          </span>
                          {r.decisionComment && (
                            <p className="text-xs text-zinc-500 mt-1 max-w-40 truncate" title={r.decisionComment}>« {r.decisionComment} »</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-zinc-500">
              <Inbox className="size-8 mb-2 opacity-50" />
              <p className="text-sm">Aucune demande.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
