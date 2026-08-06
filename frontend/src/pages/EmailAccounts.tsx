import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Plus, Loader2, Pencil, Trash2, Link2, Mail, ToggleRight, ToggleLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { emailAccountsAPI } from '../services/api';
import toast from 'react-hot-toast';

interface EmailAccount {
  id: string;
  label: string;
  provider: 'OUTLOOK' | 'GMAIL' | 'IMAP_SMTP';
  emailAddress: string;
  clientId?: string;
  tenantId?: string;
  smtpHost?: string;
  smtpPort?: number;
  username?: string;
  useTls: boolean;
  isActive: boolean;
  isDefault: boolean;
  hasRefreshToken?: boolean;
  hasClientSecret?: boolean;
  hasPassword?: boolean;
}

const providerLabels: Record<EmailAccount['provider'], string> = {
  OUTLOOK: 'Outlook / M365',
  GMAIL: 'Gmail',
  IMAP_SMTP: 'SMTP générique',
};

export default function EmailAccounts() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [provider, setProvider] = useState<EmailAccount['provider']>('OUTLOOK');
  const [form, setForm] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<EmailAccount | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState({ notificationEmail: '', frontendUrl: '' });
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const { data: accounts, isLoading } = useQuery<EmailAccount[]>({
    queryKey: ['email-accounts'],
    queryFn: async () => (await emailAccountsAPI.list()).data,
  });

  const { data: settingsData } = useQuery<{ notificationEmail: string; frontendUrl: string }>({
    queryKey: ['email-settings'],
    queryFn: async () => (await emailAccountsAPI.settings.get()).data,
  });

  useEffect(() => {
    if (settingsData && !settingsLoaded) {
      setSettings({ notificationEmail: settingsData.notificationEmail || '', frontendUrl: settingsData.frontendUrl || '' });
      setSettingsLoaded(true);
    }
  }, [settingsData, settingsLoaded]);

  const createMutation = useMutation({
    mutationFn: (data: any) => emailAccountsAPI.create(data),
    onSuccess: () => {
      toast.success('Compte email créé');
      setShowCreate(false);
      setForm({});
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => emailAccountsAPI.update(id, data),
    onSuccess: () => {
      toast.success('Compte mis à jour');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => emailAccountsAPI.delete(id),
    onSuccess: () => {
      toast.success('Compte supprimé');
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const settingsMutation = useMutation({
    mutationFn: () => emailAccountsAPI.settings.update(settings),
    onSuccess: () => toast.success('Réglages enregistrés'),
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const oauthMutation = useMutation({
    mutationFn: (id: string) => emailAccountsAPI.oauthConnect(id),
    onSuccess: (res) => {
      window.open(res.data.url, '_blank', 'noopener');
      toast.success('Ouvrez la fenêtre Microsoft pour autoriser la connexion');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const buildPayload = () => {
    const payload: Record<string, any> = {
      label: form.label,
      provider,
      emailAddress: form.emailAddress,
      isDefault: form.isDefault === 'true',
    };
    if (provider === 'OUTLOOK') {
      payload.clientId = form.clientId;
      payload.tenantId = form.tenantId;
      if (form.clientSecret) payload.clientSecret = form.clientSecret;
    } else {
      payload.smtpHost = form.smtpHost;
      payload.smtpPort = form.smtpPort ? Number(form.smtpPort) : 587;
      payload.username = form.username;
      if (form.password) payload.password = form.password;
      payload.useTls = form.useTls !== 'false';
    }
    return payload;
  };

  const openEdit = (a: EmailAccount) => {
    setEditing(a);
    setEditForm({
      label: a.label,
      emailAddress: a.emailAddress,
      isDefault: String(a.isDefault),
      useTls: String(a.useTls),
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    const data: Record<string, any> = {
      label: editForm.label,
      emailAddress: editForm.emailAddress,
      isDefault: editForm.isDefault === 'true',
    };
    if (editing.provider === 'OUTLOOK') {
      if (editForm.clientId) data.clientId = editForm.clientId;
      if (editForm.tenantId) data.tenantId = editForm.tenantId;
      if (editForm.clientSecret) data.clientSecret = editForm.clientSecret;
    } else {
      if (editForm.smtpHost) data.smtpHost = editForm.smtpHost;
      if (editForm.smtpPort) data.smtpPort = Number(editForm.smtpPort);
      if (editForm.username) data.username = editForm.username;
      if (editForm.password) data.password = editForm.password;
      data.useTls = editForm.useTls !== 'false';
    }
    updateMutation.mutate({ id: editing.id, data });
  };

  const input = (value: string, set: (v: string) => void, placeholder?: string) => (
    <input className="input" value={value} placeholder={placeholder} onChange={(e) => set(e.target.value)} />
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Comptes email</h2>
          <p className="text-zinc-500 text-sm mt-1">Utilisés pour envoyer les emails de validation des demandes (Outlook/M365 via Graph API, ou SMTP).</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
          <Plus className="size-4" /> Ajouter
        </button>
      </div>

      {showCreate && (
        <div className="card p-5">
          <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Nouveau compte email</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Libellé</label>
              {input(form.label || '', (v) => setForm({ ...form, label: v }), 'Support IT')}
            </div>
            <div>
              <label className="label">Adresse email</label>
              {input(form.emailAddress || '', (v) => setForm({ ...form, emailAddress: v }), 'support@entreprise.com')}
            </div>
            <div>
              <label className="label">Fournisseur</label>
              <select className="input" value={provider} onChange={(e) => setProvider(e.target.value as EmailAccount['provider'])}>
                <option value="OUTLOOK">Outlook / Microsoft 365</option>
                <option value="IMAP_SMTP">SMTP générique</option>
              </select>
            </div>
            <div>
              <label className="label">Compte par défaut</label>
              <select className="input" value={form.isDefault || 'false'} onChange={(e) => setForm({ ...form, isDefault: e.target.value })}>
                <option value="false">Non</option>
                <option value="true">Oui</option>
              </select>
            </div>

            {provider === 'OUTLOOK' ? (
              <>
                <div>
                  <label className="label">Client ID (Application Azure)</label>
                  {input(form.clientId || '', (v) => setForm({ ...form, clientId: v }))}
                </div>
                <div>
                  <label className="label">Client Secret</label>
                  {input(form.clientSecret || '', (v) => setForm({ ...form, clientSecret: v }))}
                </div>
                <div>
                  <label className="label">Tenant ID</label>
                  {input(form.tenantId || '', (v) => setForm({ ...form, tenantId: v }))}
                </div>
                <div className="flex items-end">
                  <p className="text-xs text-zinc-500">
                    Après création, cliquez sur <strong>Connecter Microsoft</strong> pour autoriser l'envoi via Graph API.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="label">Serveur SMTP</label>
                  {input(form.smtpHost || '', (v) => setForm({ ...form, smtpHost: v }), 'smtp.office365.com')}
                </div>
                <div>
                  <label className="label">Port SMTP</label>
                  {input(form.smtpPort || '587', (v) => setForm({ ...form, smtpPort: v }))}
                </div>
                <div>
                  <label className="label">Utilisateur</label>
                  {input(form.username || '', (v) => setForm({ ...form, username: v }))}
                </div>
                <div>
                  <label className="label">Mot de passe</label>
                  <input type="password" className="input" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
                <div>
                  <label className="label">TLS</label>
                  <select className="input" value={form.useTls || 'true'} onChange={(e) => setForm({ ...form, useTls: e.target.value })}>
                    <option value="true">Activé</option>
                    <option value="false">Désactivé</option>
                  </select>
                </div>
              </>
            )}

            <div className="flex items-end gap-2 md:col-span-2">
              <button
                onClick={() => createMutation.mutate(buildPayload())}
                disabled={!form.label || !form.emailAddress || createMutation.isPending}
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
                  <th className="px-5 py-3 text-left">Compte</th>
                  <th className="px-5 py-3 text-left">Fournisseur</th>
                  <th className="px-5 py-3 text-left">Connexion</th>
                  <th className="px-5 py-3 text-left">Défaut</th>
                  <th className="px-5 py-3 text-left">Actif</th>
                  <th className="w-40 px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                {accounts?.map((a) => (
                  <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-accent-blue/10 text-accent-blue flex items-center justify-center">
                          <Mail className="size-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{a.label}</p>
                          <p className="text-xs text-zinc-500">{a.emailAddress}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-zinc-500">{providerLabels[a.provider]}</td>
                    <td className="px-5 py-4">
                      {a.provider === 'OUTLOOK' ? (
                        a.hasRefreshToken ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                            <CheckCircle2 className="size-3.5" /> Graph connecté
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                            <AlertCircle className="size-3.5" /> Non connecté
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                          {a.smtpHost || '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-zinc-500">{a.isDefault ? '✓' : ''}</td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => updateMutation.mutate({ id: a.id, data: { isActive: !a.isActive } })}
                        className={a.isActive ? 'text-emerald-500 hover:text-emerald-400' : 'text-[color:var(--text-muted)] hover:text-zinc-300'}
                      >
                        {a.isActive ? <ToggleRight className="size-5" /> : <ToggleLeft className="size-5" />}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        {a.provider === 'OUTLOOK' && (
                          <button
                            onClick={() => oauthMutation.mutate(a.id)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-accent-blue hover:bg-white/5"
                            title="Connecter à Microsoft"
                          >
                            {oauthMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(a)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-accent-blue hover:bg-white/5"
                          title="Modifier"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(a.id)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
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
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="card relative w-full max-w-lg p-6">
            <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Modifier {editing.label}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Libellé</label>
                {input(editForm.label || '', (v) => setEditForm({ ...editForm, label: v }))}
              </div>
              <div>
                <label className="label">Email</label>
                {input(editForm.emailAddress || '', (v) => setEditForm({ ...editForm, emailAddress: v }))}
              </div>
              <div>
                <label className="label">Défaut</label>
                <select className="input" value={editForm.isDefault || 'false'} onChange={(e) => setEditForm({ ...editForm, isDefault: e.target.value })}>
                  <option value="false">Non</option>
                  <option value="true">Oui</option>
                </select>
              </div>
              {editing.provider === 'OUTLOOK' ? (
                <>
                  <div>
                    <label className="label">Client ID</label>
                    {input(editForm.clientId || '', (v) => setEditForm({ ...editForm, clientId: v }), editing.clientId || 'Inchangé')}
                  </div>
                  <div>
                    <label className="label">Tenant ID</label>
                    {input(editForm.tenantId || '', (v) => setEditForm({ ...editForm, tenantId: v }), editing.tenantId || 'Inchangé')}
                  </div>
                  <div className="col-span-2">
                    <label className="label">Client Secret (laisser vide pour ne pas changer)</label>
                    <input type="password" className="input" value={editForm.clientSecret || ''} onChange={(e) => setEditForm({ ...editForm, clientSecret: e.target.value })} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="label">Hôte SMTP</label>
                    {input(editForm.smtpHost || '', (v) => setEditForm({ ...editForm, smtpHost: v }), editing.smtpHost || 'Inchangé')}
                  </div>
                  <div>
                    <label className="label">Port</label>
                    {input(editForm.smtpPort ? String(editForm.smtpPort) : '', (v) => setEditForm({ ...editForm, smtpPort: v }), String(editing.smtpPort || 587))}
                  </div>
                  <div>
                    <label className="label">Utilisateur</label>
                    {input(editForm.username || '', (v) => setEditForm({ ...editForm, username: v }), editing.username || 'Inchangé')}
                  </div>
                  <div>
                    <label className="label">Mot de passe (laisser vide)</label>
                    <input type="password" className="input" value={editForm.password || ''} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveEdit} disabled={updateMutation.isPending} className="btn-primary">
                {updateMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Enregistrer
              </button>
              <button onClick={() => setEditing(null)} className="btn-secondary">Annuler</button>
            </div>
          </div>
        </div>
      )}

      <div className="card p-5">
        <h3 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Réglages email</h3>
        <p className="text-xs text-zinc-500 mb-4">Adresse qui reçoit les décisions, et URL publique de l'application (liens de validation).</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Email de notification (équipe)</label>
            <input className="input" value={settings.notificationEmail} onChange={(e) => setSettings({ ...settings, notificationEmail: e.target.value })} placeholder={settingsData?.notificationEmail || 'admin@example.com'} />
          </div>
          <div>
            <label className="label">URL publique du frontend</label>
            <input className="input" value={settings.frontendUrl} onChange={(e) => setSettings({ ...settings, frontendUrl: e.target.value })} placeholder={settingsData?.frontendUrl || 'http://localhost:8888'} />
          </div>
        </div>
        <button onClick={() => settingsMutation.mutate()} disabled={settingsMutation.isPending} className="btn-primary mt-4">
          {settingsMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Enregistrer les réglages
        </button>
      </div>
    </div>
  );
}
