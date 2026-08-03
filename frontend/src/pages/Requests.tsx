import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Send, Loader2, Clock, CheckCircle2, XCircle, Inbox, ClipboardList } from 'lucide-react';
import { requestsAPI } from '../services/api';
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

export default function Requests() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'new' | 'mine'>('new');
  const [form, setForm] = useState({ typeId: '', superiorEmail: '', details: '' });
  const [answers, setAnswers] = useState<Record<string, string>>({});

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
                className="input"
                placeholder="superieur@entreprise.com"
                value={form.superiorEmail}
                onChange={(e) => setForm({ ...form, superiorEmail: e.target.value })}
              />
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
    </div>
  );
}
