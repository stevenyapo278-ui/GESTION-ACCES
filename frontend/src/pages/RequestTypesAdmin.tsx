import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Loader2, Pencil, Trash2, ToggleRight, ToggleLeft, X, ListPlus, Settings2, Search } from 'lucide-react';
import { requestsAPI } from '../services/api';
import type { RequestField } from '../types';
import toast from 'react-hot-toast';

interface RequestType {
  id: string;
  name: string;
  description?: string;
  fields?: RequestField[];
  isActive: boolean;
  createdAt: string;
  _count?: { requests: number };
}

const FIELD_TYPES: { value: RequestField['type']; label: string }[] = [
  { value: 'text', label: 'Texte' },
  { value: 'textarea', label: 'Texte long' },
  { value: 'number', label: 'Nombre' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Liste de choix' },
];

function emptyField(): RequestField {
  return { key: '', label: '', type: 'text', required: false, options: [] };
}

function slugify(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function normalizeFields(fields: RequestField[]): RequestField[] {
  const used = new Set<string>();
  return fields.map((f, i) => {
    let key = f.key && !used.has(f.key) ? f.key : slugify(f.label) || `champ_${i + 1}`;
    if (used.has(key)) key = `${key}_${i + 1}`;
    used.add(key);
    return {
      ...f,
      key,
      options: f.type === 'select' ? (f.options || []).filter((o) => o.trim() !== '') : undefined,
    };
  });
}

function FieldEditor({ fields, onChange }: { fields: RequestField[]; onChange: (fields: RequestField[]) => void }) {
  const updateField = (index: number, patch: Partial<RequestField>) => {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border-color)' }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Settings2 className="size-4 text-accent-blue" /> Champs du formulaire en ligne
        </span>
        <button
          type="button"
          onClick={() => onChange([...fields, emptyField()])}
          className="text-sm flex items-center gap-1.5 text-accent-blue hover:underline"
        >
          <ListPlus className="size-4" /> Ajouter un champ
        </button>
      </div>
      <p className="text-xs text-zinc-500">Ces champs seront affichés sur la page d'accueil quand ce type est choisi.</p>

      {fields.length === 0 && (
        <div className="text-sm text-zinc-500 text-center py-4 border border-dashed rounded-lg" style={{ borderColor: 'var(--border-color)' }}>
          Aucun champ personnalisé — seuls les champs par défaut (nom, email, supérieur, détails) seront demandés.
        </div>
      )}

      {fields.map((field, index) => (
        <div key={index} className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--border-color)' }}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="md:col-span-5">
              <label className="label">Libellé</label>
              <input
                className="input"
                placeholder="Ex : Matricule, Service, Motif..."
                value={field.label}
                onChange={(e) => updateField(index, { label: e.target.value })}
              />
            </div>
            <div className="md:col-span-4">
              <label className="label">Type de champ</label>
              <select
                className="input"
                value={field.type}
                onChange={(e) => updateField(index, { type: e.target.value as RequestField['type'] })}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer pb-2.5" style={{ color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => updateField(index, { required: e.target.checked })}
                  className="accent-accent-blue"
                />
                Requis
              </label>
            </div>
            <div className="md:col-span-1 flex items-end justify-end">
              <button
                type="button"
                onClick={() => onChange(fields.filter((_, i) => i !== index))}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
                title="Supprimer ce champ"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
          {field.type === 'select' && (
            <div>
              <label className="label">Choix (séparés par des virgules)</label>
              <input
                className="input"
                placeholder="Ex : Comptabilité, RH, Direction"
                value={(field.options || []).join(', ')}
                onChange={(e) => updateField(index, { options: e.target.value.split(',').map((o) => o.trim()) })}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function RequestTypesAdmin() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [createFields, setCreateFields] = useState<RequestField[]>([]);
  const [editing, setEditing] = useState<RequestType | null>(null);
  const [search, setSearch] = useState('');

  const { data: types, isLoading } = useQuery<RequestType[]>({
    queryKey: ['request-types-all'],
    queryFn: async () => (await requestsAPI.types.listAll()).data,
  });

  const createMutation = useMutation({
    mutationFn: () => requestsAPI.types.create({ ...form, fields: normalizeFields(createFields) }),
    onSuccess: () => {
      toast.success('Type de demande créé');
      setShowCreate(false);
      setForm({ name: '', description: '' });
      setCreateFields([]);
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
    updateMutation.mutate({
      id: editing.id,
      data: {
        name: editing.name,
        description: editing.description,
        fields: normalizeFields(editing.fields || []),
      },
    });
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
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Nouveau type de demande</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Nom</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <FieldEditor fields={createFields} onChange={setCreateFields} />
          <div className="flex items-center gap-2">
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
      )}

      <div className="card overflow-hidden">
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div className="relative max-w-sm">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              className="input pl-9"
              placeholder="Rechercher un type, une description, un champ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
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
                  <th className="px-5 py-3 text-left">Champs</th>
                  <th className="px-5 py-3 text-left">Demandes</th>
                  <th className="px-5 py-3 text-left">Actif</th>
                  <th className="w-28 px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                {types?.filter((t) => {
                  const q = search.trim().toLowerCase();
                  if (!q) return true;
                  const fieldLabels = (t.fields || []).map((f) => f.label).join(' ');
                  return [t.name, t.description, fieldLabels].some((v) => v?.toLowerCase().includes(q));
                }).map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4 font-medium" style={{ color: 'var(--text-primary)' }}>{t.name}</td>
                    <td className="px-5 py-4 text-sm text-zinc-500">{t.description || '—'}</td>
                    <td className="px-5 py-4 text-sm text-zinc-500">
                      {t.fields && t.fields.length > 0
                        ? t.fields.map((f) => f.label).join(', ')
                        : <span className="text-[color:var(--text-muted)]">par défaut</span>}
                    </td>
                    <td className="px-5 py-4 text-sm text-zinc-500">{t._count?.requests ?? 0}</td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => updateMutation.mutate({ id: t.id, data: { isActive: !t.isActive } })}
                        className={t.isActive ? 'text-emerald-500 hover:text-emerald-400' : 'text-[color:var(--text-muted)] hover:text-zinc-300'}
                        title={t.isActive ? 'Désactiver' : 'Activer'}
                      >
                        {t.isActive ? <ToggleRight className="size-5" /> : <ToggleLeft className="size-5" />}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditing({ ...t, fields: JSON.parse(JSON.stringify(t.fields || [])) })}
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
                ))}
                {types && search.trim() && types.filter((t) => {
                  const q = search.trim().toLowerCase();
                  const fieldLabels = (t.fields || []).map((f) => f.label).join(' ');
                  return [t.name, t.description, fieldLabels].some((v) => v?.toLowerCase().includes(q));
                }).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-zinc-500">
                      Aucun type ne correspond à « {search} »
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto card p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Modifier le type</h3>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-zinc-400 hover:text-white">
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Nom</label>
                <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
            </div>
            <FieldEditor fields={editing.fields || []} onChange={(fields) => setEditing({ ...editing, fields })} />
            <div className="flex items-center gap-2 pt-2">
              <button onClick={saveEdit} disabled={updateMutation.isPending} className="btn-primary">
                {updateMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Enregistrer
              </button>
              <button onClick={() => setEditing(null)} className="btn-secondary">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
