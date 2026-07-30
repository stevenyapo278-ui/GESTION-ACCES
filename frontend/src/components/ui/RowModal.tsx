import { useEffect, useState, useRef } from 'react';
import {
  X, Loader2, Check, Trash2, History, FileText, Upload, Image,
} from 'lucide-react';
import { rowsAPI, uploadAPI } from '../../services/api';
import type { Column, Row, AuditLog } from '../../types';
import toast from 'react-hot-toast';

interface RowModalProps {
  open: boolean;
  mode: 'create' | 'edit' | null;
  tableId: string;
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
  open, mode, tableId: id, columns, row, values,
  onValuesChange, onSave, onDelete, onClose, isPending, isDeleting,
}: RowModalProps) {
  const [tab, setTab] = useState<'form' | 'history'>('form');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [uploadingCol, setUploadingCol] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadCol = useRef<string | null>(null);

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

  const computeFileName = (colId: string): string | null => {
    const col = columns.find((c) => c.id === colId);
    const nameColIds: string[] = col?.settings?.nameColumns;
    if (!nameColIds || nameColIds.length === 0) return null;
    const parts = nameColIds.map((ncId) => {
      const v = values[ncId];
      return v != null && v !== '' ? String(v).trim() : '';
    }).filter(Boolean);
    return parts.length > 0 ? parts.join('_') : null;
  };

  const handleFileUpload = async () => {
    const colId = pendingUploadCol.current;
    const fileInput = fileInputRef.current;
    const file = fileInput?.files?.[0];
    if (!file || !id || !colId) return;
    setUploadingCol(colId);
    try {
      const desiredName = computeFileName(colId);
      const res = await uploadAPI.column(file, id, colId, row?.id, desiredName || undefined);
      onValuesChange({ ...values, [colId]: res.data.fileUrl });
      if (fileInput) fileInput.value = '';
    } catch {
      toast.error("Échec de l'upload");
    } finally {
      setUploadingCol(null);
      pendingUploadCol.current = null;
    }
  };

  const triggerFilePicker = (colId: string) => {
    pendingUploadCol.current = colId;
    fileInputRef.current?.click();
  };

  useEffect(() => {
    if (pendingUploadCol.current && fileInputRef.current?.files?.length) {
      handleFileUpload();
    }
  });

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
      case 'IMAGE':
        return (
          <div className="space-y-2">
            {val ? (
              <div className="relative inline-block">
                <img src={String(val)} alt="" className="h-24 rounded-lg object-cover border" style={{ borderColor: 'var(--border-color)' }} />
                <button onClick={() => onValuesChange({ ...values, [col.id]: '' })}
                  className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs">×</button>
              </div>
            ) : (
              <button type="button" onClick={() => triggerFilePicker(col.id)} disabled={uploadingCol === col.id}
                className="btn-secondary btn-sm">
                {uploadingCol === col.id ? <Loader2 className="size-4 animate-spin" /> : <Image className="size-4" />}
                Choisir une image
              </button>
            )}
          </div>
        );
      case 'FILE':
        return (
          <div className="space-y-2">
            {val ? (
              <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <FileText className="size-5 text-accent-blue shrink-0" />
                <a href={String(val)} target="_blank" rel="noopener noreferrer" className="text-sm text-accent-blue hover:underline truncate flex-1">
                  {String(val).split('/').pop()}
                </a>
                <button onClick={() => onValuesChange({ ...values, [col.id]: '' })}
                  className="size-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs shrink-0">×</button>
              </div>
            ) : (
              <button type="button" onClick={() => triggerFilePicker(col.id)} disabled={uploadingCol === col.id}
                className="btn-secondary btn-sm">
                {uploadingCol === col.id ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                Uploader un fichier
              </button>
            )}
          </div>
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

        <input ref={fileInputRef} type="file" className="hidden" onChange={() => {
          if (pendingUploadCol.current) handleFileUpload();
        }} />
      </div>
    </div>
  );
}
