import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Loader2, Pencil, Trash2, ToggleRight, ToggleLeft } from 'lucide-react';
import { requestsAPI } from '../services/api';
import toast from 'react-hot-toast';

interface RequestType {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  _count?: { requests: number };
}

export default function RequestTypesAdmin() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [editing, setEditing] = useState<RequestType | null>(null);

  const { data: types, isLoading } = useQuery<RequestType[]>({
    queryKey: ['request-types-all'],
    queryFn: async () => (await requestsAPI.types.listAll()).data,
  });

  const createMutation = useMutation({
    mutationFn: () => requestsAPI.types.create(form),
    onSuccess: () => {
      toast.success('Type de demande créé');
      setShowCreate(false);
      setForm({ name: '', description: '' });
      queryClient.invalidateQueries({ queryKey: ['request-types-all'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => requestsAPI.types.update(id, data),
    onSuccess: () => {
      toast.success('Type mis à jour');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['request-types-all'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => requestsAPI.types.delete(id),
    onSuccess: () => {
      toast.success('Type supprimé');
      queryClient.invalidateQueries({ queryKey: ['request-types-all'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Impossible de supprimer ce type (demandes existantes)'),
  });

  const saveEdit = () => {
    if (!editing) return;
    updateMutation.mutate({ id: editing.id, data: { name: editing.name, description: editing.description } });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Types de demande</h2>
          <p className="text-zinc-500 text-sm mt-1">Les types proposés aux utilisateurs lors d'une nouvelle demande.</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
          <Plus className="size-4" /> Ajouter
        </button>
      </div>

      {showCreate && (
        <div className="card p-5">
          <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Nouveau type de demande</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Nom</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={() => createMutation.mutate()}
                disabled={!form.name || createMutation.isPending}
                className="btn-primary"
              >
                {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Créer
              </button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Annuler</button>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="size-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-wrap w-full">
              <thead>
                <tr>
                  <th className="px-5 py-3 text-left">Nom</th>
                  <th className="px-5 py-3 text-left">Description</th>
                  <th className="px-5 py-3 text-left">Demandes</th>
                  <th className="px-5 py-3 text-left">Actif</th>
                  <th className="w-28 px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                {types?.map((t) =>
                  editing?.id === t.id ? (
                    <tr key={t.id}>
                      <td className="px-5 py-3">
                        <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                      </td>
                      <td className="px-5 py-3">
                        <input className="input" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                      </td>
                      <td className="px-5 py-3 text-sm text-zinc-500">{t._count?.requests ?? 0}</td>
                      <td className="px-5 py-3" />
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <button onClick={saveEdit} className="btn-primary !px-3 !py-1.5 text-xs">Enregistrer</button>
                          <button onClick={() => setEditing(null)} className="btn-secondary !px-3 !py-1.5 text-xs">Annuler</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4 font-medium" style={{ color: 'var(--text-primary)' }}>{t.name}</td>
                      <td className="px-5 py-4 text-sm text-zinc-500">{t.description || '—'}</td>
                      <td className="px-5 py-4 text-sm text-zinc-500">{t._count?.requests ?? 0}</td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => updateMutation.mutate({ id: t.id, data: { isActive: !t.isActive } })}
                          className={t.isActive ? 'text-emerald-500 hover:text-emerald-400' : 'text-zinc-600 hover:text-zinc-400'}
                          title={t.isActive ? 'Désactiver' : 'Activer'}
                        >
                          {t.isActive ? <ToggleRight className="size-5" /> : <ToggleLeft className="size-5" />}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditing({ ...t })}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-accent-blue hover:bg-white/5"
                            title="Modifier"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(t.id)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
                            title="Supprimer"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
