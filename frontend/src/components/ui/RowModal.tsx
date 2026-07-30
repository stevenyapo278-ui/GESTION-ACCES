import { useEffect, useState } from 'react';
import {
  X, Loader2, Check, Trash2, History, FileText,
} from 'lucide-react';
import { rowsAPI } from '../../services/api';
import type { Column, Row, AuditLog } from '../../types';

interface RowModalProps {
  open: boolean;
  mode: 'create' | 'edit' | null;
  columns: Column[];
  row: Row | null;
  values: Record<string, any>;
  onValuesChange: (values: Record<string, any>) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
  isPending: boolean;
  isDeleting: boolean;
}

export default function RowModal({
  open, mode, columns, row, values,
  onValuesChange, onSave, onDelete, onClose, isPending, isDeleting,
}: RowModalProps) {
  const [tab, setTab] = useState<'form' | 'history'>('form');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) { setTab('form'); setAuditLogs([]); }
  }, [open]);

  useEffect(() => {
    if (tab === 'history' && mode === 'edit' && row && auditLogs.length === 0 && !loadingLogs) {
      setLoadingLogs(true);
      rowsAPI.auditLogs(row.id)
        .then((res) => setAuditLogs(res.data as AuditLog[]))
        .catch(() => {})
        .finally(() => setLoadingLogs(false));
    }
  }, [tab, mode, row, auditLogs.length, loadingLogs]);

  if (!open) return null;

  const isCreate = mode === 'create';

  const renderField = (col: Column) => {
    const val = values[col.id] ?? '';

    switch (col.type) {
      case 'LONG_TEXT':
        return (
          <textarea
            className="input min-h-[80px] resize-y"
            value={val}
            onChange={(e) => onValuesChange({ ...values, [col.id]: e.target.value })}
          />
        );
      case 'CHECKBOX':
      case 'YES_NO':
        return (
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={val === true || val === 'true'}
                onChange={(e) => onValuesChange({ ...values, [col.id]: e.target.checked })}
                className="rounded border-zinc-600 text-accent-blue focus:ring-accent-blue/30 bg-space-800"
              />
              <span className="text-sm">Oui</span>
            </label>
          </div>
        );
      case 'DATE':
        return (
          <input
            type="date"
            className="input"
            value={val}
            onChange={(e) => onValuesChange({ ...values, [col.id]: e.target.value })}
          />
        );
      case 'DATE_TIME':
        return (
          <input
            type="datetime-local"
            className="input"
            value={val}
            onChange={(e) => onValuesChange({ ...values, [col.id]: e.target.value })}
          />
        );
      case 'NUMBER':
      case 'DECIMAL':
      case 'CURRENCY':
      case 'PERCENTAGE':
        return (
          <input
            type="number"
            className="input"
            value={val}
            onChange={(e) => onValuesChange({ ...values, [col.id]: e.target.value })}
            step={col.type === 'DECIMAL' || col.type === 'CURRENCY' ? '0.01' : '1'}
          />
        );
      case 'DROPDOWN':
        return (
          <select
            className="input"
            value={val}
            onChange={(e) => onValuesChange({ ...values, [col.id]: e.target.value })}
          >
            <option value="">—</option>
            {(col.options as string[] || []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case 'MULTI_SELECT': {
        const selected = Array.isArray(val) ? val : (val ? [val] : []);
        return (
          <div className="flex flex-wrap gap-1.5">
            {(col.options as string[] || []).map((opt) => {
              const isSelected = selected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    const next = isSelected
                      ? selected.filter((s: string) => s !== opt)
                      : [...selected, opt];
                    onValuesChange({ ...values, [col.id]: next });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    isSelected
                      ? 'bg-accent-blue/20 border-accent-blue text-accent-blue'
                      : 'border-zinc-600 text-zinc-400 hover:border-zinc-500'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        );
      }
      case 'EMAIL':
        return (
          <input
            type="email"
            className="input"
            value={val}
            onChange={(e) => onValuesChange({ ...values, [col.id]: e.target.value })}
          />
        );
      case 'URL':
        return (
          <input
            type="url"
            className="input"
            value={val}
            onChange={(e) => onValuesChange({ ...values, [col.id]: e.target.value })}
          />
        );
      default:
        return (
          <input
            type="text"
            className="input"
            value={val}
            onChange={(e) => onValuesChange({ ...values, [col.id]: e.target.value })}
          />
        );
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl"
        style={{ backgroundColor: 'var(--bg-card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${isCreate ? 'bg-accent-blue' : 'bg-accent-green'}`} />
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {isCreate ? 'Nouvelle ligne' : 'Modifier la ligne'}
            </h3>
            {row && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-400">
                #{String(row.order + 1).padStart(4, '0')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {mode === 'edit' && (
              <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
                <button onClick={() => setTab('form')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${tab === 'form' ? 'bg-accent-blue/10 text-accent-blue' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  <FileText className="size-3.5 inline mr-1" />Saisie
                </button>
                <button onClick={() => setTab('history')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${tab === 'history' ? 'bg-accent-blue/10 text-accent-blue' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  <History className="size-3.5 inline mr-1" />Historique
                </button>
              </div>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
              <X className="size-5" style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {tab === 'history' ? (
            loadingLogs ? (
              <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-zinc-500" /></div>
            ) : auditLogs.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucun historique pour cette ligne</p>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <div className="shrink-0 mt-0.5">
                      <span className={`size-2 block rounded-full ${log.action === 'CREATE' ? 'bg-accent-green' : log.action === 'UPDATE' ? 'bg-accent-blue' : 'bg-red-400'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                        <span className="font-medium">{log.user?.firstName} {log.user?.lastName}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium uppercase ${
                          log.action === 'CREATE' ? 'bg-accent-green/10 text-accent-green' :
                          log.action === 'UPDATE' ? 'bg-accent-blue/10 text-accent-blue' :
                          'bg-red-400/10 text-red-400'
                        }`}>
                          {log.action === 'CREATE' ? 'Création' : log.action === 'UPDATE' ? 'Modification' : 'Suppression'}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {new Date(log.createdAt).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            columns.map((col) => (
              <div key={col.id}>
                <label className="label">
                  {col.name}
                  {col.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                {renderField(col)}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t shrink-0" style={{ borderColor: 'var(--border-color)' }}>
          <div>
            {mode === 'edit' && (
              <button
                onClick={onDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors text-red-400 hover:bg-red-500/10"
              >
                {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Supprimer
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary btn-sm">
              Annuler
            </button>
            <button
              onClick={onSave}
              disabled={isPending}
              className="btn-primary btn-sm"
            >
              {isPending
                ? <Loader2 className="size-4 animate-spin" />
                : <Check className="size-4" />}
              {isCreate ? 'Ajouter' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
