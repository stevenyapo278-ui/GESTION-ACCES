import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HardDrive, Download, Trash2, Plus, Loader2, Calendar, Database, Rows3 } from 'lucide-react';
import { useState } from 'react';
import { backupAPI } from '../services/api';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ui/ConfirmModal';

interface Backup {
  id: string;
  name: string;
  tableCount: number;
  rowCount: number;
  fileSize: number;
  createdBy: string;
  createdAt: string;
}

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

  const { data: backups, isLoading } = useQuery<Backup[]>({
    queryKey: ['backups'],
    queryFn: async () => {
      const res = await backupAPI.list();
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => backupAPI.create(),
    onSuccess: () => {
      toast.success('Sauvegarde créée avec succès');
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors de la création'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => backupAPI.delete(id),
    onSuccess: () => {
      toast.success('Sauvegarde supprimée');
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      setConfirmDelete(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors de la suppression'),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Sauvegardes</h2>
          <p className="text-zinc-500 text-sm mt-1">
            {backups?.length ?? 0} sauvegarde(s) — une sauvegarde automatique est effectuée toutes les 24h
          </p>
        </div>
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="btn-primary"
        >
          {createMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Créer une sauvegarde
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="size-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : backups?.length === 0 ? (
        <div className="card p-12 text-center">
          <HardDrive className="size-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Aucune sauvegarde</h3>
          <p className="text-zinc-500 mt-1 mb-4">
            Créez votre première sauvegarde manuellement ou attendez la sauvegarde automatique quotidienne.
          </p>
          <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="btn-primary">
            {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Créer une sauvegarde
          </button>
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
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3.5" />
                        {formatDate(backup.createdAt)}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-zinc-400">
                        <Database className="size-3.5" />
                        {backup.tableCount}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-zinc-400">
                        <Rows3 className="size-3.5" />
                        {backup.rowCount}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center text-zinc-400">
                      {formatFileSize(Number(backup.fileSize))}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => backupAPI.download(backup.id, backup.name)}
                          className="p-2 text-zinc-500 hover:text-accent-blue hover:bg-accent-blue/10 rounded-lg transition-colors"
                          title="Télécharger"
                        >
                          <Download className="size-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(backup.id)}
                          className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Supprimer"
                        >
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

      <ConfirmModal
        open={!!confirmDelete}
        title="Supprimer la sauvegarde"
        message="Cette action est irréversible. Voulez-vous vraiment supprimer cette sauvegarde ?"
        confirmLabel="Supprimer"
        onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
