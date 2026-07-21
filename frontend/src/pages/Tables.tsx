import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Table2, Trash2, Settings, Copy, FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { tablesAPI } from '../services/api';
import type { Table } from '../types';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ui/ConfirmModal';

export default function Tables() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const { data: tables, isLoading, refetch } = useQuery<Table[]>({
    queryKey: ['tables', search],
    queryFn: async () => {
      const res = await tablesAPI.list({ search: search || undefined });
      return res.data;
    },
  });

  const handleDelete = async (id: string, name: string) => {
    setConfirmDelete({ id, name });
  };

  const confirmDeleteTable = async () => {
    if (!confirmDelete) return;
    try {
      await tablesAPI.delete(confirmDelete.id);
      toast.success('Tableau supprimé');
      setConfirmDelete(null);
      refetch();
    } catch {
      toast.error('Échec de la suppression');
    }
  };

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => tablesAPI.duplicate(id),
    onSuccess: (res) => {
      toast.success('Tableau dupliqué');
      refetch();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const seedMutation = useMutation({
    mutationFn: () => tablesAPI.seedAccessTemplate(),
    onSuccess: (res) => {
      toast.success('Template "Demande d\'accès" créé !');
      navigate(`/tables/${res.data.id}`);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Tableaux</h2>
          <p className="text-zinc-500 text-sm mt-1">{tables?.length ?? 0} tableau(x)</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}
            className="btn-ghost btn-sm">
            {seedMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
            Modèle accès
          </button>
          <Link to="/tables/new" className="btn-primary">
            <Plus className="size-4" />
            Nouveau tableau
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
        <input
          className="input pl-10"
          placeholder="Rechercher un tableau..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="size-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tables?.length === 0 ? (
        <div className="card p-12 text-center">
          <Table2 className="size-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Aucun tableau</h3>
          <p className="text-zinc-500 mt-1 mb-4">Créez votre premier tableau pour commencer</p>
          <Link to="/tables/new" className="btn-primary">
            <Plus className="size-4" />
            Créer un tableau
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tables?.map((table) => (
            <div key={table.id} className="card group overflow-hidden">
              <Link to={`/tables/${table.id}`} className="block p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="size-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: table.color + '20' }}>
                    <Table2 className="size-5" style={{ color: table.color }} />
                  </div>
                </div>
                <h3 className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {table.name}
                </h3>
                {table.description && (
                  <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{table.description}</p>
                )}
                <div className="flex items-center gap-4 mt-4 text-xs text-zinc-500">
                  <span>{table._count?.columns ?? 0} colonnes</span>
                  <span>{table._count?.rows ?? 0} lignes</span>
                </div>
                {table.creator && (
                  <p className="text-xs text-zinc-500 mt-2">
                    par {table.creator.firstName} {table.creator.lastName}
                  </p>
                )}
              </Link>
              <div className="px-5 py-2 border-t flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex items-center gap-2">
                  <Link to={`/tables/${table.id}/settings`} className="text-xs text-zinc-500 hover:text-accent-blue flex items-center gap-1">
                    <Settings className="size-3" />
                    Paramètres
                  </Link>
                  <button onClick={() => duplicateMutation.mutate(table.id)} disabled={duplicateMutation.isPending}
                    className="text-xs text-zinc-500 hover:text-accent-green flex items-center gap-1">
                    <Copy className="size-3" />
                    Dupliquer
                  </button>
                </div>
                <button onClick={() => handleDelete(table.id, table.name)} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                  <Trash2 className="size-3" />
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        title="Supprimer le tableau"
        message={`Supprimer le tableau "${confirmDelete?.name}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        onConfirm={confirmDeleteTable}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
