import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Loader2, ShieldAlert, ShieldCheck, Shield, ToggleRight, ToggleLeft } from 'lucide-react';
import { usersAPI } from '../services/api';
import type { User, Role } from '../types';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const roleConfig: Record<Role, { label: string; icon: React.ElementType; color: string }> = {
  ADMIN: { label: 'Administrateur', icon: ShieldAlert, color: 'text-gold-400 bg-gold-400/10' },
  EDITOR: { label: 'Éditeur', icon: ShieldCheck, color: 'text-accent-blue bg-accent-blue/10' },
  READER: { label: 'Lecteur', icon: Shield, color: 'text-zinc-500 bg-zinc-500/10' },
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', role: 'EDITOR' as Role });

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => { const res = await usersAPI.list(); return res.data; },
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => usersAPI.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('Utilisateur créé'); setShowCreateForm(false); setForm({ email: '', password: '', firstName: '', lastName: '', role: 'EDITOR' }); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => usersAPI.update(id, { isActive: !isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="size-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Utilisateurs</h2>
          <p className="text-zinc-500 text-sm mt-1">{users?.length ?? 0} utilisateur(s)</p>
        </div>
        <button onClick={() => setShowCreateForm(!showCreateForm)} className="btn-primary">
          <Plus className="size-4" />
          Ajouter
        </button>
      </div>

      {showCreateForm && (
        <div className="card p-5">
          <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Nouvel utilisateur</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Prénom</label>
              <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label className="label">Nom</label>
              <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="label">Rôle</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                <option value="ADMIN">Administrateur</option>
                <option value="EDITOR">Éditeur</option>
                <option value="READER">Lecteur</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Créer
              </button>
              <button onClick={() => setShowCreateForm(false)} className="btn-secondary">Annuler</button>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-wrap w-full">
            <thead>
              <tr>
                <th className="px-5 py-3 text-left">Utilisateur</th>
                <th className="px-5 py-3 text-left">Email</th>
                <th className="px-5 py-3 text-left">Rôle</th>
                <th className="px-5 py-3 text-left">Statut</th>
                <th className="px-5 py-3 text-left">Tableaux</th>
                <th className="w-16 px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
              {users?.map((user) => {
                const role = roleConfig[user.role];
                const RoleIcon = role.icon;
                return (
                  <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-accent-blue/10 text-accent-blue flex items-center justify-center text-sm font-semibold">
                          {user.firstName[0]}{user.lastName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {user.firstName} {user.lastName}
                            {user.id === currentUser?.id && <span className="ml-2 text-xs text-zinc-500">(vous)</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{user.email}</td>
                    <td className="px-5 py-4">
                      <span className={`badge ${role.color}`}>
                        <RoleIcon className="size-3 mr-1" />
                        {role.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`badge ${user.isActive !== false ? 'badge-success' : 'badge-danger'}`}>
                        {user.isActive !== false ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-zinc-500">{(user as any)._count?.createdTables ?? 0}</td>
                    <td className="px-5 py-4">
                      {user.id !== currentUser?.id && (
                        <button
                          onClick={() => toggleActiveMutation.mutate({ id: user.id, isActive: user.isActive ?? true })}
                          className={`p-1.5 rounded transition-colors ${
                            user.isActive !== false ? 'text-zinc-500 hover:text-red-400 hover:bg-red-500/10' : 'text-zinc-500 hover:text-accent-green hover:bg-green-500/10'
                          }`}
                        >
                          {user.isActive !== false ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
