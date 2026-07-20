import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const confirmBtnClass =
    variant === 'danger'
      ? 'bg-red-500 hover:bg-red-600 text-white'
      : 'bg-accent-orange hover:bg-gold-500 text-white';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] animate-fade-in" onClick={onCancel}>
      <div
        className="card w-full max-w-sm shadow-xl p-0 overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 flex items-start gap-4">
          <div className={`size-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            variant === 'danger' ? 'bg-red-500/10' : 'bg-accent-orange/10'
          }`}>
            <AlertTriangle className={`size-5 ${
              variant === 'danger' ? 'text-red-400' : 'text-accent-orange'
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
            <p className="text-sm text-zinc-500 mt-1 leading-relaxed">{message}</p>
          </div>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0">
            <X className="size-4 text-zinc-500" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
          <button onClick={onCancel} className="btn-secondary btn-sm" disabled={loading}>{cancelLabel}</button>
          <button onClick={onConfirm} disabled={loading}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${confirmBtnClass}`}>
            {loading && <Loader2 className="size-3 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
