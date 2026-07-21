import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  HardDrive, Download, Trash2, Plus, Loader2, Upload, Calendar, Database, Rows3,
  Settings, Clock, Save,
} from 'lucide-react';
import { useState, useRef } from 'react';
import { backupAPI } from '../services/api';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ui/ConfirmModal';

interface Backup {
  id: string; name: string; tableCount: number; rowCount: number;
  fileSize: number; createdBy: string; createdAt: string;
}

interface BackupSettings {
  id: string; enabled: boolean; frequency: string;
  frequencyValue: number; frequencyUnit: string; retention: number;
  lastBackupAt: string | null; nextBackupAt: string | null;
}

const FREQUENCIES = [
  { value: 'manual', label: 'Manuelle uniquement' },
  { value: 'daily', label: 'Toutes les 24h', val: 24, unit: 'hours' },
  { value: 'twice', label: 'Toutes les 12h', val: 12, unit: 'hours' },
  { value: 'every6', label: 'Toutes les 6h', val: 6, unit: 'hours' },
  { value: 'every48', label: 'Toutes les 48h', val: 48, unit: 'hours' },
  { value: 'weekly', label: 'Toutes les semaines', val: 1, unit: 'weeks' },
];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 o';
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} à ${pad(d.getHours())}h${pad(d.getMinutes())}`;
}

export default function Backups() {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: backups, isLoading } = useQuery<Backup[]>({
    queryKey: ['backups'],
    queryFn: async () => (await backupAPI.list()).data,
  });

  const { data: settings } = useQuery<BackupSettings>({
    queryKey: ['backupSettings'],
    queryFn: async () => (await backupAPI.getSettings()).data,
  });

  const [form, setForm] = useState<BackupSettings | null>(null);

  const createMutation = useMutation({
    mutationFn: () => backupAPI.create(),
    onSuccess: () => {
      toast.success('Sauvegarde créée');
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => backupAPI.delete(id),
    onSuccess: () => {
      toast.success('Sauvegarde supprimée');
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      setConfirmDelete(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const importMutation = useMutation({
    mutationFn: (data: any) => backupAPI.import(data),
    onSuccess: (res) => {
      toast.success(`Sauvegarde restaurée : ${res.data.tablesCreated} tableaux, ${res.data.rowsCreated} lignes`);
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors de l\'import'),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: (data: any) => backupAPI.updateSettings(data),
    onSuccess: () => {
      toast.success('Paramètres sauvegardés');
      queryClient.invalidateQueries({ queryKey: ['backupSettings'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        importMutation.mutate(data);
      } catch {
        toast.error('Fichier JSON invalide');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const openSettings = () => {
    if (settings) {
      setForm({ ...settings });
      setShowSettings(true);
    }
  };

  const getFrequencyMeta = (freq: string) => {
    const found = FREQUENCIES.find((f) => f.value === freq);
    if (found) return found;
    if (freq === 'manual') return FREQUENCIES[0];
    return FREQUENCIES[1];
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Sauvegardes</h2>
          <p className="text-zinc-500 text-sm mt-1">
            {backups?.length ?? 0} sauvegarde(s)
            {settings?.enabled && settings.frequency !== 'manual' && (
              <span>
                {' '}— prochaine : {settings.nextBackupAt ? formatDate(settings.nextBackupAt) : '...'}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileImport} />
          <button onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending} className="btn-ghost btn-sm">
            {importMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Restaurer
          </button>
          <button onClick={openSettings} className="btn-ghost btn-sm">
            <Clock className="size-4" />
            Planification
          </button>
          <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="btn-primary">
            {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Sauvegarder
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="size-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : backups?.length === 0 ? (
        <div className="card p-12 text-center">
          <HardDrive className="size-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Aucune sauvegarde</h3>
          <p className="text-zinc-500 mt-1 mb-4">Créez votre première sauvegarde ou importez-en une.</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="btn-primary">
              <Plus className="size-4" /> Créer une sauvegarde
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
              <Upload className="size-4" /> Restaurer
            </button>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-widest text-zinc-500" style={{ borderColor: 'var(--border-color)' }}>
                  <th className="text-left px-5 py-3 font-semibold">Nom</th>
                  <th className="text-left px-5 py-3 font-semibold">Date</th>
                  <th className="text-center px-5 py-3 font-semibold">Tableaux</th>
                  <th className="text-center px-5 py-3 font-semibold">Lignes</th>
                  <th className="text-center px-5 py-3 font-semibold">Taille</th>
                  <th className="text-right px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups?.map((backup) => (
                  <tr key={backup.id} className="border-t transition-colors hover:bg-white/5" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <HardDrive className="size-4 text-accent-blue flex-shrink-0" />
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{backup.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-zinc-400">
                      <div className="flex items-center gap-1.5"><Calendar className="size-3.5" />{formatDate(backup.createdAt)}</div>
                    </td>
                    <td className="px-5 py-4 text-center text-zinc-400"><Database className="size-3.5 inline mr-1" />{backup.tableCount}</td>
                    <td className="px-5 py-4 text-center text-zinc-400"><Rows3 className="size-3.5 inline mr-1" />{backup.rowCount}</td>
                    <td className="px-5 py-4 text-center text-zinc-400">{formatFileSize(Number(backup.fileSize))}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => backupAPI.download(backup.id, backup.name)}
                          className="p-2 text-zinc-500 hover:text-accent-blue hover:bg-accent-blue/10 rounded-lg transition-colors" title="Télécharger">
                          <Download className="size-4" />
                        </button>
                        <button onClick={() => setConfirmDelete(backup.id)}
                          className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Supprimer">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && form && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="card w-full max-w-md shadow-xl" style={{ backgroundColor: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <div>
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Planification</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Configurer les sauvegardes automatiques</p>
              </div>
              <button onClick={() => setShowSettings(false)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                <HardDrive className="size-5 text-zinc-500" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-3">
                <label className="relative inline-flex h-6 w-11 items-center rounded-full cursor-pointer transition-colors"
                  style={{ backgroundColor: form.enabled ? 'var(--accent-blue, #3B82F6)' : 'var(--bg-tertiary, #555)' }}>
                  <input type="checkbox" className="sr-only" checked={form.enabled}
                    onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
                  <span className={`inline-block size-4 rounded-full bg-white transition-transform ${form.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </label>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Sauvegardes automatiques</span>
              </div>

              {form.enabled && (
                <>
                  <div>
                    <label className="label">Fréquence</label>
                    <select className="input" value={form.frequency}
                      onChange={(e) => {
                        const found = FREQUENCIES.find((f) => f.value === e.target.value);
                        setForm({
                          ...form,
                          frequency: e.target.value,
                          frequencyValue: found?.val ?? 24,
                          frequencyUnit: found?.unit ?? 'hours',
                        });
                      }}>
                      {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="label">Conserver les {form.retention} dernières sauvegardes</label>
                    <input type="range" min="2" max="90" value={form.retention}
                      onChange={(e) => setForm({ ...form, retention: Number(e.target.value) })}
                      className="w-full accent-blue-500" />
                    <div className="flex justify-between text-xs text-zinc-500 mt-1">
                      <span>2</span>
                      <span className="font-medium text-accent-blue">{form.retention}</span>
                      <span>90</span>
                    </div>
                  </div>
                </>
              )}

              {form.lastBackupAt && (
                <div className="text-xs text-zinc-500 space-y-1">
                  <p>Dernière sauvegarde : {formatDate(form.lastBackupAt)}</p>
                  {form.nextBackupAt && <p>Prochaine : {formatDate(form.nextBackupAt)}</p>}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <button onClick={() => setShowSettings(false)} className="btn-secondary btn-sm">Annuler</button>
              <button onClick={() => saveSettingsMutation.mutate(form)} disabled={saveSettingsMutation.isPending} className="btn-primary btn-sm">
                {saveSettingsMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        title="Supprimer la sauvegarde"
        message="Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
