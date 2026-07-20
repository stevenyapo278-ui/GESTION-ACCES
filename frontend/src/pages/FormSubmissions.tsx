import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formsAPI } from '../services/api';
import {
  ArrowLeft, Download, RefreshCw, Search, Inbox,
  ChevronDown, ChevronUp, ExternalLink, FileText,
} from 'lucide-react';

function formatValue(value: any): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object' && 'raw' in value) return String(value.raw);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p
        className="text-3xl font-bold mt-2"
        style={{ color: accent ?? 'var(--text-primary)' }}
      >
        {value}
      </p>
    </div>
  );
}

export default function FormSubmissions() {
  const { tableId, formId } = useParams<{ tableId: string; formId: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: form, isLoading: formLoading } = useQuery({
    queryKey: ['form', formId],
    queryFn: async () => {
      const res = await formsAPI.get(formId!);
      return res.data as any;
    },
    enabled: !!formId,
  });

  const { data: submissions = [], isLoading: subLoading, refetch, isFetching } = useQuery({
    queryKey: ['form-submissions', formId],
    queryFn: async () => {
      const res = await formsAPI.submissions(formId!);
      return res.data as any[];
    },
    enabled: !!formId,
    staleTime: 30_000,
  });

  const fields: any[] = form?.fields ?? [];
  const columns: any[] = form?.table?.columns ?? [];

  const getFieldLabel = (columnId: string) => {
    const field = fields.find((f: any) => f.columnId === columnId);
    if (field?.label) return field.label;
    const col = columns.find((c: any) => c.id === columnId);
    return col?.name ?? columnId.slice(0, 8) + '…';
  };

  // All unique column IDs from submissions data, ordered by field order
  const allColumnIds: string[] = (() => {
    const fromFields = fields.filter((f) => !f.hidden).map((f) => f.columnId);
    const fromSubs = Array.from(new Set(submissions.flatMap((s) => Object.keys(s.data ?? {}))));
    // Merge: fields order first, then any extras
    const ordered = [...fromFields];
    fromSubs.forEach((id) => { if (!ordered.includes(id)) ordered.push(id); });
    return ordered;
  })();

  const filtered = submissions.filter((sub) => {
    if (!search.trim()) return true;
    return JSON.stringify(sub.data ?? '').toLowerCase().includes(search.toLowerCase());
  });

  const today = submissions.filter((s) => {
    const d = new Date(s.createdAt);
    return d.toDateString() === new Date().toDateString();
  }).length;

  const thisWeek = submissions.filter((s) => {
    const d = new Date(s.createdAt);
    return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
  }).length;

  const handleExport = () => {
    if (!submissions.length) return;
    const headers = ['#', 'Date', 'IP soumetteur', ...allColumnIds.map(getFieldLabel)];
    const rows = submissions.map((sub, idx) => [
      String(submissions.length - idx),
      formatDate(sub.createdAt),
      sub.submitterIp ?? '',
      ...allColumnIds.map((colId) => formatValue(sub.data?.[colId])),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form?.name ?? 'soumissions'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = formLoading || subLoading;
  const accent = form?.settings?.accentColor ?? '#6366f1';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Header ── */}
      <div className="card px-5 py-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => navigate(`/tables/${tableId}/forms/${formId}`)}
            className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft className="size-4" />
            Retour au formulaire
          </button>

          <div className="w-px h-5 bg-space-700" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="size-4 shrink-0" style={{ color: accent }} />
              <h2 className="text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {formLoading ? 'Chargement…' : form?.name ?? 'Formulaire'}
              </h2>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: `${accent}20`, color: accent }}
              >
                {submissions.length} soumission{submissions.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="btn-ghost btn-sm"
              title="Rafraîchir"
            >
              <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleExport}
              disabled={!submissions.length}
              className="btn-secondary btn-sm"
            >
              <Download className="size-4" />
              Export CSV
            </button>
            <Link
              to={`/tables/${tableId}/forms/${formId}`}
              className="btn-primary btn-sm"
            >
              <ExternalLink className="size-4" />
              Modifier
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total" value={submissions.length} accent={accent} />
          <StatCard label="Aujourd'hui" value={today} />
          <StatCard label="Cette semaine" value={thisWeek} />
        </div>
      )}

      {/* ── Filters ── */}
      <div className="card px-4 py-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4" style={{ color: 'var(--text-muted)' }} />
          <input
            className="input pl-9 py-1.5 text-sm w-full"
            placeholder="Filtrer les soumissions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* ── Table ── */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="size-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${accent}40`, borderTopColor: accent }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Inbox className="size-14" style={{ color: 'var(--text-muted)' }} />
            <div className="text-center">
              <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                {search ? 'Aucun résultat pour cette recherche' : 'Aucune soumission reçue'}
              </p>
              {!search && (
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  Partagez le lien public du formulaire pour recevoir des réponses
                </p>
              )}
            </div>
            {!search && (
              <Link
                to={`/tables/${tableId}/forms/${formId}`}
                className="btn-primary btn-sm mt-2"
              >
                <ExternalLink className="size-4" />
                Aller au formulaire
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: 'var(--bg-elevated)' }}>
                <tr>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-10"
                    style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}
                  >
                    #
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}
                  >
                    Date
                  </th>
                  {allColumnIds.map((colId) => (
                    <th
                      key={colId}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                      style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}
                    >
                      {getFieldLabel(colId)}
                    </th>
                  ))}
                  <th
                    className="w-8"
                    style={{ borderBottom: '1px solid var(--border-color)' }}
                  />
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub, idx) => {
                  const isExpanded = expandedRow === sub.id;
                  return (
                    <>
                      <tr
                        key={sub.id}
                        onClick={() => setExpandedRow(isExpanded ? null : sub.id)}
                        className="cursor-pointer transition-colors hover:bg-white/[0.03]"
                        style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-color)' }}
                      >
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                          {filtered.length - idx}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {formatDate(sub.createdAt)}
                        </td>
                        {allColumnIds.map((colId) => (
                          <td
                            key={colId}
                            className="px-4 py-3 max-w-[200px] truncate"
                            style={{ color: 'var(--text-primary)' }}
                            title={formatValue(sub.data?.[colId])}
                          >
                            {formatValue(sub.data?.[colId])}
                          </td>
                        ))}
                        <td className="px-3 py-3">
                          {isExpanded
                            ? <ChevronUp className="size-4" style={{ color: 'var(--text-muted)' }} />
                            : <ChevronDown className="size-4" style={{ color: 'var(--text-muted)' }} />
                          }
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${sub.id}-detail`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td
                            colSpan={allColumnIds.length + 3}
                            style={{ backgroundColor: 'var(--bg-elevated)' }}
                            className="px-6 py-5"
                          >
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                              {allColumnIds.map((colId) => (
                                <div key={colId}>
                                  <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                    {getFieldLabel(colId)}
                                  </p>
                                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                    {formatValue(sub.data?.[colId])}
                                  </p>
                                </div>
                              ))}
                              <div>
                                <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>IP</p>
                                <p className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                                  {sub.submitterIp ?? '—'}
                                </p>
                              </div>
                              <div className="col-span-full">
                                <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                                  ID: {sub.id}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
