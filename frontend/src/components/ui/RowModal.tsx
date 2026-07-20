import { useEffect } from 'react';
import {
  X, Loader2, Check, Trash2,
} from 'lucide-react';
import type { Column, Row } from '../../types';

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
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

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
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X className="size-5" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {columns.map((col) => (
            <div key={col.id}>
              <label className="label">
                {col.name}
                {col.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              {renderField(col)}
            </div>
          ))}
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
