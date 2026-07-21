import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Upload, Trash2, Loader2, Eye, EyeOff } from 'lucide-react';
import { useState, useRef } from 'react';
import { documentsAPI } from '../services/api';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ui/ConfirmModal';
import type { Document } from '../types';

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

export default function Documents() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents-admin'],
    queryFn: () => documentsAPI.listAdmin().then((r) => r.data as Document[]),
  });

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => documentsAPI.create(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents-admin'] });
      setTitle('');
      setDescription('');
      setFile(null);
      toast.success('Document ajouté');
    },
    onError: () => toast.error('Erreur lors de l\'ajout'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      documentsAPI.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents-admin'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents-admin'] });
      setDeleteId(null);
      toast.success('Document supprimé');
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Sélectionnez un fichier');
      return;
    }
    if (!title.trim()) {
      toast.error('Donnez un titre au document');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('description', description);
    uploadMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Documents téléchargeables</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Gérez les formulaires PDF disponibles en téléchargement public
          </p>
        </div>
      </div>

      {/* Upload form */}
      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gold-400 uppercase tracking-wider flex items-center gap-2">
          <Upload className="size-4" />
          Ajouter un document
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Titre</label>
            <input
              className="input"
              placeholder="Ex: Formulaire de demande d'accès"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Description (optionnelle)</label>
            <input
              className="input"
              placeholder="Description du document"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Fichier PDF</label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-secondary flex-1"
              >
                {file ? file.name : 'Choisir un fichier'}
              </button>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={uploadMutation.isPending}
            className="btn btn-primary"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Publier
          </button>
        </div>
      </form>

      {/* Document list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-zinc-400" />
        </div>
      ) : (
        <div className="space-y-2">
          {documents?.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <FileText className="size-12 mx-auto mb-3 text-zinc-700" />
              <p>Aucun document. Publiez-en un ci-dessus.</p>
            </div>
          ) : (
            documents?.map((doc) => (
              <div
                key={doc.id}
                className="card p-4 flex items-center gap-4"
              >
                <div className="size-10 rounded-lg bg-gold-400/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="size-5 text-gold-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-white truncate">{doc.title}</h3>
                    {!doc.isActive && (
                      <span className="badge bg-zinc-700 text-zinc-400 text-[10px]">
                        Inactif
                      </span>
                    )}
                  </div>
                  {doc.description && (
                    <p className="text-sm text-zinc-500 truncate">{doc.description}</p>
                  )}
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {doc.fileName} &middot; {formatSize(doc.fileSize)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      toggleMutation.mutate({ id: doc.id, isActive: !doc.isActive })
                    }
                    className="btn btn-ghost size-9 p-0"
                    title={doc.isActive ? 'Désactiver' : 'Activer'}
                  >
                    {doc.isActive ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                  <button
                    onClick={() => setDeleteId(doc.id)}
                    className="btn btn-ghost size-9 p-0 text-red-400 hover:text-red-300"
                    title="Supprimer"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <ConfirmModal
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId!)}
        title="Supprimer le document"
        message="Cette action est irréversible."
        confirmLabel="Supprimer"
        variant="danger"
      />
    </div>
  );
}
