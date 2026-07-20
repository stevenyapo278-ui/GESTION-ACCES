import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ConfirmModal from '../components/ui/ConfirmModal';
import {
  Plus, GripVertical, ArrowLeft, Loader2, Check, X, PenLine,
  Type, AlignLeft, Hash, Divide, DollarSign, Percent,
  Calendar, Clock, CalendarClock, CheckSquare, ToggleLeft,
  ChevronDown, Tags, User, Mail, Phone, Link,
  Image, File, PenTool, MapPin, FunctionSquare, Calculator,
} from 'lucide-react';
import { tablesAPI, columnsAPI } from '../services/api';
import { COLUMN_TYPES, type ColumnType, type ColumnTypeMeta, type Table, type Column } from '../types';
import toast from 'react-hot-toast';

// Map string icon names to actual Lucide components
const iconMap: Record<string, React.ElementType> = {
  Type, AlignLeft, Hash, Divide, DollarSign, Percent,
  Calendar, Clock, CalendarClock, CheckSquare, ToggleLeft,
  ChevronDown, Tags, User, Mail, Phone, Link,
  Image, File, PenTool, MapPin, FunctionSquare, Calculator,
};

interface ColumnForm {
  name: string;
  type: ColumnType;
  required: boolean;
  options: string[];
  existingId?: string;
}

const emptyColumnForm = (): ColumnForm => ({
  name: '', type: 'TEXT' as ColumnType, required: false, options: [],
});

export default function TableBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [isLoadingTable, setIsLoadingTable] = useState(isEditing);
  const [tableName, setTableName] = useState('');
  const [tableDescription, setTableDescription] = useState('');
  const [tableColor, setTableColor] = useState('#d29922');
  const [tableCategory, setTableCategory] = useState('');
  const [columns, setColumns] = useState<ColumnForm[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newColumn, setNewColumn] = useState<ColumnForm>(emptyColumnForm());
  const initialColumnRef = useRef<ColumnForm>(emptyColumnForm());
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmRemoveCol, setConfirmRemoveCol] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!isEditing || !id) return;
    setIsLoadingTable(true);
    tablesAPI.get(id)
      .then((res) => {
        const table: Table = res.data;
        setTableName(table.name);
        setTableDescription(table.description || '');
        setTableColor(table.color || '#d29922');
        setTableCategory(table.category || '');
        if (table.columns) {
          setColumns(
            table.columns.sort((a, b) => a.order - b.order).map((col: Column) => ({
              name: col.name, type: col.type, required: col.required,
              options: (col.options as string[]) || [], existingId: col.id,
            }))
          );
        }
      })
      .catch(() => { toast.error('Erreur de chargement'); navigate('/tables'); })
      .finally(() => setIsLoadingTable(false));
  }, [id, isEditing, navigate]);

  const isColumnFormDirty = (): boolean => {
    const initial = initialColumnRef.current;
    if (newColumn.name !== initial.name) return true;
    if (newColumn.type !== initial.type) return true;
    if (newColumn.required !== initial.required) return true;
    if (newColumn.options.join(',') !== initial.options.join(',')) return true;
    return false;
  };

  const closeModalIfAllowed = (force?: boolean) => {
    if (force || !isColumnFormDirty()) {
      setShowModal(false);
    } else {
      setConfirmClose(true);
    }
  };

  const openAddModal = () => {
    const empty = emptyColumnForm();
    initialColumnRef.current = empty;
    setEditingIndex(null);
    setNewColumn(empty);
    setShowModal(true);
  };

  const openEditModal = (index: number) => {
    const col = { ...columns[index] };
    initialColumnRef.current = col;
    setEditingIndex(index);
    setNewColumn(col);
    setShowModal(true);
  };

  const confirmAddColumn = () => {
    if (!newColumn.name.trim()) {
      toast.error('Le nom de la colonne est requis');
      return;
    }
    const updated = { ...newColumn, name: newColumn.name.trim() };
    if (editingIndex !== null) {
      setColumns(columns.map((col, i) => (i === editingIndex ? updated : col)));
    } else {
      setColumns([...columns, updated]);
    }
    setShowModal(false);
  };

  const updateColumn = (index: number, data: Partial<ColumnForm>) =>
    setColumns(columns.map((col, i) => (i === index ? { ...col, ...data } : col)));

  const removeColumn = (index: number) => {
    const col = columns[index];
    if (col.existingId) {
      setConfirmRemoveCol(index);
    } else {
      setColumns(columns.filter((_, i) => i !== index));
    }
  };

  const confirmRemoveColumn = () => {
    if (confirmRemoveCol !== null) {
      setColumns(columns.filter((_, i) => i !== confirmRemoveCol));
      setConfirmRemoveCol(null);
    }
  };

  const handleSave = async () => {
    if (!tableName.trim()) { toast.error('Le nom du tableau est requis'); return; }
    setIsSaving(true);
    try {
      if (isEditing) {
        await tablesAPI.update(id!, { name: tableName, description: tableDescription, color: tableColor, category: tableCategory || undefined });

        const currentIds = columns.filter((c) => c.existingId).map((c) => c.existingId!);
        const freshTable = await tablesAPI.get(id!);
        const dbColumnIds: string[] = freshTable.data.columns?.map((c: any) => c.id) || [];
        await Promise.all(dbColumnIds.filter((dbId) => !currentIds.includes(dbId)).map((colId) => columnsAPI.delete(colId)));

        for (let i = 0; i < columns.length; i++) {
          const col = columns[i];
          if (!col.name.trim()) continue;
          if (col.existingId) {
            await columnsAPI.update(col.existingId, { name: col.name, type: col.type, required: col.required, options: col.options.length > 0 ? col.options : undefined, order: i });
          } else {
            await columnsAPI.create({ tableId: id!, name: col.name, type: col.type, required: col.required, options: col.options.length > 0 ? col.options : undefined });
          }
        }
        toast.success('Tableau mis à jour');
        navigate(`/tables/${id}`);
      } else {
        const res = await tablesAPI.create({ name: tableName, description: tableDescription, color: tableColor, category: tableCategory || undefined });
        const tableId = res.data.id;
        for (let i = 0; i < columns.length; i++) {
          const col = columns[i];
          if (col.name.trim()) {
            await columnsAPI.create({ tableId, name: col.name, type: col.type, required: col.required, options: col.options.length > 0 ? col.options : undefined });
          }
        }
        toast.success('Tableau créé avec succès');
        navigate(`/tables/${tableId}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally { setIsSaving(false); }
  };

  const handleDragStart = (index: number) => setDragIndex(index);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const reordered = [...columns];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    setColumns(reordered);
    setDragIndex(index);
  };

  const handleDragEnd = () => setDragIndex(null);

  const getTypeMeta = (type: ColumnType): ColumnTypeMeta =>
    COLUMN_TYPES.find((t) => t.type === type) ?? COLUMN_TYPES[0];

  if (isLoadingTable) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="size-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <button onClick={() => navigate(-1)} className="btn-ghost btn-sm">
        <ArrowLeft className="size-4" /> Retour
      </button>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {isEditing ? 'Paramètres du tableau' : 'Nouveau tableau'}
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            {isEditing ? 'Modifiez les propriétés et les colonnes' : 'Créez un tableau et ajoutez vos colonnes'}
          </p>
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nom du tableau *</label>
              <input className="input" placeholder="Ex: Gestion des employés" value={tableName} onChange={(e) => setTableName(e.target.value)} autoFocus />
            </div>
            <div className="col-span-2">
              <label className="label">Description</label>
              <textarea className="input" rows={2} placeholder="Description optionnelle..." value={tableDescription} onChange={(e) => setTableDescription(e.target.value)} />
            </div>
            <div>
              <label className="label">Catégorie</label>
              <input className="input" placeholder="Ex: RH, Inventaire..." value={tableCategory} onChange={(e) => setTableCategory(e.target.value)} />
            </div>
            <div>
              <label className="label">Couleur</label>
              <input type="color" className="input h-10 p-1" value={tableColor} onChange={(e) => setTableColor(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Colonnes</h3>
            <p className="text-sm text-zinc-500 mt-1">{columns.length} colonne(s)</p>
          </div>
          <button onClick={openAddModal} className="btn-primary btn-sm">
            <Plus className="size-4" /> Ajouter
          </button>
        </div>
        <div className="card-body space-y-3">
          {columns.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">
              Aucune colonne pour le moment. Cliquez sur « Ajouter » pour créer votre première colonne.
            </div>
          ) : (
            columns.map((col, index) => {
              const meta = getTypeMeta(col.type);
              const IconComponent = iconMap[meta.icon];
              return (
                <div
                  key={index}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors group ${dragIndex === index ? 'opacity-50' : ''}`}
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}
                >
                  <GripVertical className="size-4 text-zinc-600 cursor-grab active:cursor-grabbing flex-shrink-0" />
                  <div className="size-9 rounded-full bg-space-800 border border-space-700 flex items-center justify-center flex-shrink-0">
                    {IconComponent && <IconComponent className="size-4 text-zinc-400" />}
                  </div>
                  <input className="input flex-1" placeholder="Nom de la colonne" value={col.name} onChange={(e) => updateColumn(index, { name: e.target.value })} />
                  <select className="input w-44" value={col.type} onChange={(e) => updateColumn(index, { type: e.target.value as ColumnType })}>
                    {COLUMN_TYPES.map((ct) => (<option key={ct.type} value={ct.type}>{ct.label}</option>))}
                  </select>
                  {(col.type === 'DROPDOWN' || col.type === 'MULTI_SELECT') && (
                    <input className="input w-36" placeholder="Opt1,Opt2..." value={col.options.join(',')} onChange={(e) => updateColumn(index, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                  )}
                  <button onClick={() => updateColumn(index, { required: !col.required })}
                    className={`text-xs px-2 py-1 rounded-lg border transition-colors whitespace-nowrap ${col.required ? 'bg-accent-orange/10 border-accent-orange/30 text-accent-orange' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                  >Req.</button>
                  <button onClick={() => openEditModal(index)} className="p-1.5 text-zinc-500 hover:text-accent-blue hover:bg-accent-blue/10 rounded-lg transition-colors" title="Modifier">
                    <PenLine className="size-4" />
                  </button>
                  <button onClick={() => removeColumn(index)} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Supprimer">
                    <X className="size-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary">Annuler</button>
        <button onClick={handleSave} disabled={isSaving} className="btn-primary">
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {isEditing ? 'Enregistrer' : 'Créer le tableau'}
        </button>
      </div>

      {/* ── Modal d'ajout de colonne ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={() => closeModalIfAllowed()}>
          <div className="card w-full max-w-lg shadow-xl" style={{ backgroundColor: 'var(--bg-card)' }} onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <div>
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {editingIndex !== null ? 'Modifier la colonne' : 'Ajouter une colonne'}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {editingIndex !== null ? 'Modifiez les propriétés de la colonne' : 'Définissez les propriétés de la nouvelle colonne'}
                </p>
              </div>
              <button onClick={() => closeModalIfAllowed()} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                <X className="size-5 text-zinc-500" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Nom de la colonne *</label>
                <input className="input" placeholder="Ex: Prénom, Email, Date de naissance..."
                  value={newColumn.name} onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
                  autoFocus />
              </div>

              <div>
                <label className="label">Type de champ</label>
                <select className="input" value={newColumn.type}
                  onChange={(e) => setNewColumn({ ...newColumn, type: e.target.value as ColumnType })}>
                  {COLUMN_TYPES.map((ct) => (
                    <option key={ct.type} value={ct.type}>{ct.label}</option>
                  ))}
                </select>
              </div>

              {(newColumn.type === 'DROPDOWN' || newColumn.type === 'MULTI_SELECT') && (
                <div>
                  <label className="label">Options (séparées par des virgules)</label>
                  <input className="input" placeholder="Option 1, Option 2, Option 3..."
                    value={newColumn.options.join(', ')}
                    onChange={(e) => setNewColumn({ ...newColumn, options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Champ obligatoire</span>
                <button
                  onClick={() => setNewColumn({ ...newColumn, required: !newColumn.required })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${newColumn.required ? 'bg-accent-orange' : 'bg-zinc-600'}`}
                >
                  <span className={`inline-block size-4 rounded-full bg-white transition-transform duration-200 ${newColumn.required ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <button onClick={() => closeModalIfAllowed()} className="btn-secondary btn-sm">Annuler</button>
              <button onClick={confirmAddColumn} className="btn-primary btn-sm">
                {editingIndex !== null ? <Check className="size-4" /> : <Plus className="size-4" />}
                {editingIndex !== null ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmClose}
        title="Modifications non enregistrées"
        message="Des modifications non enregistrées vont être perdues. Fermer ?"
        confirmLabel="Fermer"
        variant="warning"
        onConfirm={() => { setConfirmClose(false); setShowModal(false); }}
        onCancel={() => setConfirmClose(false)}
      />

      <ConfirmModal
        open={confirmRemoveCol !== null}
        title="Supprimer la colonne"
        message={`Supprimer la colonne "${confirmRemoveCol !== null ? columns[confirmRemoveCol]?.name || 'sans nom' : ''}" ? Les données seront perdues.`}
        confirmLabel="Supprimer"
        onConfirm={confirmRemoveColumn}
        onCancel={() => setConfirmRemoveCol(null)}
      />
    </div>
  );
}
