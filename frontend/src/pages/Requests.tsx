import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import {
  Send,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  Inbox,
  ClipboardList,
  ShieldCheck,
  Users,
  Filter,
  FileText,
  KeyRound,
  UserPlus,
  Monitor,
  CreditCard,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Mail,
  Sparkles,
} from 'lucide-react';
import { requestsAPI } from '../services/api';
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

const statusConfig: Record<RequestItem['status'], { label: string; dot: string }> = {
  PENDING: { label: 'En attente', dot: 'bg-amber-400' },
  APPROVED: { label: 'Validée', dot: 'bg-emerald-400' },
  REJECTED: { label: 'Refusée', dot: 'bg-red-400' },
};

const TYPE_ICONS = [FileText, KeyRound, UserPlus, Monitor, CreditCard, ShieldCheck, ClipboardList, Send];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function answerSummary(r: RequestItem): string {
  const answers = (r.type.fields || [])
    .map((f) => r.data?.[f.key])
    .filter((v) => v && v.trim() !== '')
    .join(' · ');
  return [answers, r.details].filter(Boolean).join(' · ') || '—';
}

function answerRows(r: RequestItem): Array<{ label: string; value: string }> {
  const rows = (r.type.fields || [])
    .map((f) => ({ label: f.label, value: r.data?.[f.key] }))
    .filter((row) => row.value && row.value.trim() !== '') as Array<{ label: string; value: string }>;
  if (r.details) rows.push({ label: 'Détails', value: r.details });
  return rows;
}

function requesterDisplay(r: RequestItem): string {
  if (r.requesterName) return r.requesterName;
  if (r.requester) return `${r.requester.firstName} ${r.requester.lastName}`;
  return '—';
}

function requesterEmail(r: RequestItem): string {
  return r.requesterEmail || r.requester?.email || '—';
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

function StatusPill({ status }: { status: RequestItem['status'] }) {
  const s = statusConfig[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{
        borderColor: status === 'PENDING' ? 'rgba(251,191,36,0.3)' : status === 'APPROVED' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)',
        background: status === 'PENDING' ? 'rgba(251,191,36,0.08)' : status === 'APPROVED' ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)',
        color: status === 'PENDING' ? '#fbbf24' : status === 'APPROVED' ? '#34d399' : '#f87171',
      }}
    >
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gold-400 to-blue-500 opacity-15 blur-lg" />
        <div className="relative size-14 rounded-2xl bg-gradient-to-br from-gold-400 to-blue-500/80 flex items-center justify-center shadow-lg shadow-gold-400/10">
          <Icon className="size-6 text-white" />
        </div>
      </div>
      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
      {hint && <p className="text-xs text-zinc-500 mt-1 max-w-xs">{hint}</p>}
    </div>
  );
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: types, isLoading: typesLoading } = useQuery<RequestType[]>({
    queryKey: ['request-types'],
    queryFn: async () => (await requestsAPI.types.list()).data,
  });

  const selectedType = types?.find((t) => t.id === form.typeId);

  const { data: myRequests, isLoading: requestsLoading } = useQuery<RequestItem[]>({
    queryKey: ['my-requests'],
    queryFn: async () => (await requestsAPI.mine()).data,
  });

  const { data: reviewRequests, isLoading: reviewLoading } = useQuery<RequestItem[]>({
    queryKey: ['to-review'],
    queryFn: async () => (await requestsAPI.toReview()).data,
  });

  const { data: allRequests, isLoading: allLoading } = useQuery<RequestItem[]>({
    queryKey: ['all-requests', statusFilter],
    queryFn: async () => (await requestsAPI.list({ status: statusFilter === 'ALL' ? undefined : statusFilter })).data,
    enabled: isAdmin,
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
        queryClient.invalidateQueries({ queryKey: ['my-requests'] });
        queryClient.invalidateQueries({ queryKey: ['all-requests'] });
      })
      .catch((err) => toast.error(err.response?.data?.error || 'Erreur lors de la décision'))
      .finally(() => setReviewBusy((prev) => ({ ...prev, [requestId]: null })));
  };

  const tabs: Array<{ key: typeof tab; label: string; icon: React.ElementType; badge?: number; show: boolean }> = [
    { key: 'new', label: 'Nouvelle demande', icon: Send, show: true },
    { key: 'mine', label: 'Mes demandes', icon: ClipboardList, badge: myRequests?.length, show: true },
    { key: 'review', label: 'À valider', icon: ShieldCheck, badge: reviewRequests?.length, show: true },
    { key: 'all', label: 'Toutes les demandes', icon: Users, badge: allRequests?.length, show: isAdmin },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gold-400 to-blue-500 opacity-25 blur-lg" />
            <div className="relative size-12 rounded-2xl bg-gradient-to-br from-gold-400 to-blue-500 flex items-center justify-center shadow-lg shadow-gold-400/20">
              <ClipboardList className="size-6 text-white" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Demandes</h2>
            <p className="text-sm text-zinc-500 mt-0.5">
              Soumettez une demande qui sera validée par votre supérieur hiérarchique par email.
            </p>
          </div>
        </div>
        {reviewRequests && reviewRequests.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border px-4 py-2.5 animate-fade-in"
            style={{ borderColor: 'rgba(251,191,36,0.25)', background: 'rgba(251,191,36,0.06)' }}
          >
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-amber-400" />
            </span>
            <span className="text-sm font-medium text-amber-400">
              {reviewRequests.length} demande{reviewRequests.length > 1 ? 's' : ''} à valider
            </span>
          </div>
        )}
      </div>

      {/* ─── KPI cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: ShieldCheck,
            label: 'À valider',
            value: reviewRequests ? String(reviewRequests.length) : '…',
            hint: 'en attente de votre décision',
            gradient: 'from-amber-400 to-orange-500',
            shadow: 'shadow-amber-400/20',
          },
          {
            icon: ClipboardList,
            label: 'Mes demandes',
            value: myRequests ? String(myRequests.length) : '…',
            hint: 'demandes soumises',
            gradient: 'from-blue-500 to-indigo-500',
            shadow: 'shadow-blue-400/20',
          },
          {
            icon: CheckCircle2,
            label: 'Décisions',
            value: myRequests ? String(myRequests.filter((r) => r.status !== 'PENDING').length) : '…',
            hint: 'validées ou refusées',
            gradient: 'from-emerald-500 to-teal-500',
            shadow: 'shadow-emerald-400/20',
          },
        ].map((kpi, i) => (
          <div
            key={kpi.label}
            className="card p-4 flex items-center gap-4 animate-fade-in hover:-translate-y-0.5 transition-transform duration-300"
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <div className={`size-11 shrink-0 rounded-xl bg-gradient-to-br ${kpi.gradient} flex items-center justify-center shadow-lg ${kpi.shadow}`}>
              <kpi.icon className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{kpi.value}</p>
              <p className="text-sm font-medium text-zinc-400 mt-1">{kpi.label}</p>
              <p className="text-xs text-zinc-500 truncate">{kpi.hint}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Tabs ───────────────────────────────────────────── */}
      <div className="card p-1.5 flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {tabs.filter((t) => t.show).map((t) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                active
                  ? 'bg-gradient-to-r from-gold-400 to-blue-500 text-white shadow-lg shadow-gold-400/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Icon className="size-4" />
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  active ? 'bg-white/25 text-white' : 'bg-amber-400/20 text-amber-400'
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Nouvelle demande ───────────────────────────────── */}
      {tab === 'new' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--border-color)' }}>
                <div className="size-9 rounded-xl bg-gradient-to-br from-gold-400 to-blue-500/80 flex items-center justify-center">
                  <Send className="size-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Nouvelle demande</h3>
                  <p className="text-xs text-zinc-500">Remplissez le formulaire, votre supérieur validera par email.</p>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <label className="label mb-2">Type de demande</label>
                  {typesLoading ? (
                    <div className="flex items-center gap-2 text-sm text-zinc-500 py-6 justify-center">
                      <Loader2 className="size-4 animate-spin" /> Chargement des types...
                    </div>
                  ) : types && types.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {types.map((t, i) => {
                        const selected = form.typeId === t.id;
                        const Icon = TYPE_ICONS[i % TYPE_ICONS.length];
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => { setForm({ ...form, typeId: t.id }); setAnswers({}); }}
                            className={`text-left rounded-xl border p-4 transition-all duration-200 cursor-pointer group ${
                              selected
                                ? 'border-transparent ring-2 ring-gold-400/70 bg-gradient-to-br from-gold-400/10 to-blue-500/10'
                                : 'hover:bg-white/[0.03]'
                            }`}
                            style={{ borderColor: selected ? undefined : 'var(--border-color)' }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className={`size-9 rounded-lg flex items-center justify-center transition-colors ${
                                selected ? 'bg-gradient-to-br from-gold-400 to-blue-500' : 'bg-white/5 group-hover:bg-white/10'
                              }`}>
                                <Icon className={`size-4 ${selected ? 'text-white' : 'text-zinc-400'}`} />
                              </div>
                              <span className={`size-4 rounded-full border-2 transition-colors ${
                                selected ? 'border-gold-400 bg-gold-400' : 'border-zinc-500'
                              }`}>
                                {selected && <span className="block size-full rounded-full bg-white/70 scale-[0.35]" />}
                              </span>
                            </div>
                            <p className="text-sm font-semibold mt-3" style={{ color: selected ? 'var(--text-primary)' : undefined }}>{t.name}</p>
                            {t.description && (
                              <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{t.description}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState icon={Inbox} title="Aucun type de demande" hint="Contactez un administrateur pour créer un type de demande." />
                  )}
                </div>

                {form.typeId && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                      <div className="sm:col-span-2">
                        <label className="label">Email du supérieur hiérarchique *</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                          <input
                            type="email"
                            className="input !pl-10"
                            placeholder="superieur@entreprise.com"
                            value={form.superiorEmail}
                            onChange={(e) => setForm({ ...form, superiorEmail: e.target.value })}
                          />
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">Un email avec les boutons Valider / Refuser sera envoyé à cette adresse.</p>
                      </div>

                      {selectedType?.fields?.map((field) => (
                        <div key={field.key}>
                          <label className="label">
                            {field.label} {field.required && <span className="text-red-400">*</span>}
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
                              className="input cursor-pointer"
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

                      <div className="sm:col-span-2">
                        <label className="label">Détails (optionnel)</label>
                        <textarea
                          className="input min-h-24 resize-y"
                          placeholder="Précisez le contexte de votre demande..."
                          value={form.details}
                          onChange={(e) => setForm({ ...form, details: e.target.value })}
                        />
                      </div>
                    </div>

                    <button
                      onClick={submit}
                      disabled={createMutation.isPending}
                      className="btn-primary w-full !py-3 text-base cursor-pointer"
                    >
                      {createMutation.isPending ? (
                        <>
                          <Loader2 className="size-4 animate-spin" /> Envoi en cours...
                        </>
                      ) : (
                        <>
                          <Send className="size-4" /> Envoyer la demande
                        </>
                      )}
                    </button>
                    <p className="text-xs text-center text-zinc-500 -mt-2">
                      Une seule demande par envoi. Votre supérieur recevra un lien de validation à usage unique.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Aside : comment ça marche */}
          <div className="lg:col-span-2">
            <div className="card p-6 space-y-5 lg:sticky lg:top-6">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-gold-400" />
                <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Comment ça marche ?</h3>
              </div>
              <ol className="space-y-4">
                {[
                  { icon: FileText, title: 'Choisissez le type', desc: 'Sélectionnez le formulaire correspondant à votre demande.' },
                  { icon: Mail, title: 'Indiquez votre supérieur', desc: 'Il reçoit un email avec les boutons Valider / Refuser.' },
                  { icon: CheckCircle2, title: 'Suivez la décision', desc: 'Votre demande passe en « Validée » ou « Refusée » après sa réponse.' },
                ].map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="size-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                        <step.icon className="size-4 text-zinc-400" />
                      </div>
                      {i < 2 && <div className="w-px flex-1 bg-white/10 my-1" />}
                    </div>
                    <div className="pb-1">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{step.title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* ─── Mes demandes ───────────────────────────────────── */}
      {tab === 'mine' && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500/80 flex items-center justify-center">
                <ClipboardList className="size-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Mes demandes</h3>
                <p className="text-xs text-zinc-500">{myRequests?.length ?? 0} demande{myRequests?.length !== 1 ? 's' : ''} soumise{myRequests?.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>

          {requestsLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="size-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : myRequests && myRequests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table-wrap w-full">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left">Type</th>
                    <th className="px-6 py-3 text-left">Supérieur</th>
                    <th className="px-6 py-3 text-left">Soumis le</th>
                    <th className="px-6 py-3 text-left">Statut</th>
                    <th className="px-6 py-3 text-right">Détails</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                  {myRequests.map((r) => {
                    const expanded = expandedId === r.id;
                    return (
                      <Fragment key={r.id}>
                        <tr
                          key={r.id}
                          onClick={() => setExpandedId(expanded ? null : r.id)}
                          className="cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-4">
                            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.type.name}</p>
                            {r.data && <p className="text-xs text-zinc-500 mt-0.5 max-w-56 truncate">{answerSummary(r)}</p>}
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-400">{r.superiorEmail}</td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 text-sm text-zinc-400">
                              <CalendarDays className="size-3.5 text-zinc-500" />
                              {formatDate(r.createdAt)}
                            </span>
                          </td>
                          <td className="px-6 py-4"><StatusPill status={r.status} /></td>
                          <td className="px-6 py-4 text-right">
                            {expanded ? (
                              <ChevronUp className="size-4 text-zinc-500 inline" />
                            ) : (
                              <ChevronDown className="size-4 text-zinc-500 inline" />
                            )}
                          </td>
                        </tr>
                        {expanded && (
                          <tr key={`${r.id}-details`} className="animate-fade-in">
                            <td colSpan={5} className="px-6 py-5" style={{ background: 'var(--bg-secondary)' }}>
                              {answerRows(r).length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                                  {answerRows(r).map((row) => (
                                    <div key={row.label}>
                                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{row.label}</p>
                                      <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{row.value}</p>
                                    </div>
                                  ))}
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Décision du supérieur</p>
                                    <p className="text-sm mt-0.5 text-zinc-400">
                                      {r.decisionComment ? `« ${r.decisionComment} »` : (r.status === 'PENDING' ? 'En attente de réponse.' : 'Aucun commentaire.')}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-zinc-400">Aucun détail supplémentaire.</p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Inbox} title="Aucune demande pour le moment" hint="Soumettez votre première demande dans l'onglet « Nouvelle demande »." />
          )}
        </div>
      )}

      {/* ─── À valider ──────────────────────────────────────── */}
      {tab === 'review' && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500/80 flex items-center justify-center">
                <ShieldCheck className="size-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>À valider</h3>
                <p className="text-xs text-zinc-500">Demandes envoyées à votre adresse en attente de votre décision.</p>
              </div>
            </div>
          </div>

          {reviewLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="size-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : reviewRequests && reviewRequests.length > 0 ? (
            <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
              {reviewRequests.map((r) => {
                const name = requesterDisplay(r);
                return (
                  <div key={r.id} className="p-6 space-y-4 animate-fade-in hover:bg-white/[0.02] transition-colors">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="size-10 shrink-0 rounded-full bg-gradient-to-br from-gold-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-gold-400/10">
                          {initials(name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{r.type.name}</h4>
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-white/5 text-zinc-400">
                              {formatDateTime(r.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-400 mt-0.5">
                            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{name}</span>
                            {r.requesterEmail ? ` · ${r.requesterEmail}` : ''}
                          </p>
                          {r.data && Object.keys(r.data).length > 0 && (
                            <p className="text-sm text-zinc-400 mt-2 max-w-xl leading-relaxed">{answerSummary(r)}</p>
                          )}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-400">
                        <Clock className="size-3.5" /> En attente
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="relative flex-1">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                        <input
                          className="input !pl-10"
                          placeholder="Commentaire (optionnel)"
                          value={reviewComments[r.id] || ''}
                          onChange={(e) => setReviewComments({ ...reviewComments, [r.id]: e.target.value })}
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => decideById(r.id, 'APPROVE')}
                          disabled={!!reviewBusy[r.id]}
                          className="btn !bg-emerald-600 hover:!bg-emerald-500 text-white cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                        >
                          {reviewBusy[r.id] === 'APPROVE' ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                          Valider
                        </button>
                        <button
                          onClick={() => decideById(r.id, 'REJECT')}
                          disabled={!!reviewBusy[r.id]}
                          className="btn !bg-red-600 hover:!bg-red-500 text-white cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                        >
                          {reviewBusy[r.id] === 'REJECT' ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                          Refuser
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={ShieldCheck} title="Rien à valider" hint="Lorsqu'une demande vous sera adressée, elle apparaîtra ici pour validation." />
          )}
        </div>
      )}

      {/* ─── Toutes les demandes (admin) ────────────────────── */}
      {isAdmin && tab === 'all' && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500/80 flex items-center justify-center">
                <Users className="size-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Toutes les demandes</h3>
                <p className="text-xs text-zinc-500">Vue globale de toutes les demandes de l'application.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-zinc-500" />
              <select
                className="input !w-auto !py-2 cursor-pointer"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Tous les statuts</option>
                <option value="PENDING">En attente</option>
                <option value="APPROVED">Validées</option>
                <option value="REJECTED">Refusées</option>
              </select>
            </div>
          </div>
          {allLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="size-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : allRequests && allRequests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table-wrap w-full">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left">Type</th>
                    <th className="px-6 py-3 text-left">Demandeur</th>
                    <th className="px-6 py-3 text-left">Supérieur</th>
                    <th className="px-6 py-3 text-left">Soumis le</th>
                    <th className="px-6 py-3 text-left">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                  {allRequests.map((r) => {
                    const name = requesterDisplay(r);
                    const expanded = expandedId === r.id;
                    return (
                      <Fragment key={r.id}>
                        <tr
                          key={r.id}
                          onClick={() => setExpandedId(expanded ? null : r.id)}
                          className="cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-4">
                            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.type.name}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="size-8 shrink-0 rounded-full bg-gradient-to-br from-gold-400 to-blue-500/70 flex items-center justify-center text-white text-[10px] font-bold">
                                {initials(name)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{name}</p>
                                <p className="text-xs text-zinc-500 truncate">{requesterEmail(r)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-400">{r.superiorEmail}</td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 text-sm text-zinc-400">
                              <CalendarDays className="size-3.5 text-zinc-500" />
                              {formatDate(r.createdAt)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <StatusPill status={r.status} />
                            {r.decisionComment && (
                              <p className="text-xs text-zinc-500 mt-1 max-w-40 truncate" title={r.decisionComment}>« {r.decisionComment} »</p>
                            )}
                          </td>
                        </tr>
                        {expanded && (
                          <tr key={`${r.id}-details`} className="animate-fade-in">
                            <td colSpan={5} className="px-6 py-5" style={{ background: 'var(--bg-secondary)' }}>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                                {answerRows(r).map((row) => (
                                  <div key={row.label}>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{row.label}</p>
                                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{row.value}</p>
                                  </div>
                                ))}
                                {answerRows(r).length === 0 && (
                                  <p className="text-sm text-zinc-400">Aucun détail supplémentaire.</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Inbox} title="Aucune demande" hint="Aucune demande ne correspond à ce filtre pour le moment." />
          )}
        </div>
      )}
    </div>
  );
}
