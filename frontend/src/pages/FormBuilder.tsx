import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { KeyboardSensor } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { formsAPI, tablesAPI } from '../services/api';

interface Column {
  id: string;
  name: string;
  type: string;
  required: boolean;
  options?: string[];
}

interface FormField {
  columnId: string;
  label: string;
  required: boolean;
  hidden: boolean;
  order: number;
  helpText?: string;
}

interface Form {
  id: string;
  name: string;
  description?: string;
  publicToken: string;
  isActive: boolean;
  submitLabel: string;
  successMessage: string;
  fields: FormField[];
  settings?: {
    bgColor?: string;
    accentColor?: string;
  };
  _count?: { submissions: number };
}

// Draggable field row
function SortableFieldRow({
  field,
  column,
  onChange,
}: {
  field: FormField;
  column: Column | undefined;
  onChange: (updated: FormField) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.columnId,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const typeLabels: Record<string, string> = {
    TEXT: 'Texte', LONG_TEXT: 'Texte long', NUMBER: 'Nombre', DECIMAL: 'Décimal',
    CURRENCY: 'Devise', PERCENTAGE: '%', DATE: 'Date', TIME: 'Heure',
    DATE_TIME: 'Date & heure', CHECKBOX: 'Case à cocher', YES_NO: 'Oui/Non',
    DROPDOWN: 'Liste', MULTI_SELECT: 'Multi-sélection', EMAIL: 'Email',
    PHONE: 'Téléphone', URL: 'URL', IMAGE: 'Image', FILE: 'Fichier',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-xl border transition-all ${
        field.hidden
          ? 'border-slate-200 opacity-60'
          : 'border-slate-200 hover:border-indigo-300'
      } ${isDragging ? 'shadow-2xl z-50' : 'shadow-sm'}`}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-1 text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing"
          type="button"
          aria-label="Déplacer"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6-12a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">
              {typeLabels[column?.type || ''] || column?.type || '?'}
            </span>
            {column?.required && (
              <span className="text-xs font-medium px-2 py-0.5 bg-rose-50 text-rose-500 rounded-full">
                Requis dans la table
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Label du champ</label>
              <input
                value={field.label}
                onChange={(e) => onChange({ ...field, label: e.target.value })}
                className="w-full text-sm px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                placeholder="Nom affiché"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Texte d'aide (optionnel)</label>
              <input
                value={field.helpText || ''}
                onChange={(e) => onChange({ ...field, helpText: e.target.value })}
                className="w-full text-sm px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                placeholder="Ex: Entrez votre email professionnel"
              />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mt-1">
          <label className="flex items-center gap-1.5 cursor-pointer" title="Requis">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => onChange({ ...field, required: e.target.checked })}
              className="w-4 h-4 rounded accent-indigo-500"
            />
            <span className="text-xs text-slate-500">Requis</span>
          </label>

          <button
            type="button"
            onClick={() => onChange({ ...field, hidden: !field.hidden })}
            title={field.hidden ? 'Afficher' : 'Masquer'}
            className={`p-1.5 rounded-lg transition-colors ${
              field.hidden
                ? 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                : 'bg-green-50 text-green-600 hover:bg-green-100'
            }`}
          >
            {field.hidden ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FormBuilder() {
  const { tableId, formId } = useParams<{ tableId: string; formId?: string }>();
  const navigate = useNavigate();

  const [columns, setColumns] = useState<Column[]>([]);
  const [form, setForm] = useState<Partial<Form>>({
    name: 'Nouveau formulaire',
    description: '',
    submitLabel: 'Soumettre',
    successMessage: 'Votre réponse a bien été enregistrée. Merci !',
    isActive: true,
    fields: [],
    settings: { bgColor: '#f8fafc', accentColor: '#6366f1' },
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [tab, setTab] = useState<'fields' | 'settings' | 'preview'>('fields');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const publicUrl = form.publicToken
    ? `${window.location.origin}/forms/${form.publicToken}`
    : '';

  useEffect(() => {
    if (!tableId) return;

    tablesAPI.get(tableId).then((res) => {
      setColumns(res.data.columns || []);

      if (!formId) {
        // New form — default all columns as fields
        const fields: FormField[] = (res.data.columns || []).map(
          (col: Column, i: number) => ({
            columnId: col.id,
            label: col.name,
            required: col.required,
            hidden: false,
            order: i,
            helpText: '',
          })
        );
        setForm((f) => ({ ...f, fields }));
      }
    });

    if (formId) {
      formsAPI.get(formId).then((res) => {
        setForm(res.data);
      });
    }
  }, [tableId, formId]);

  const handleFieldChange = (idx: number, updated: FormField) => {
    setForm((f) => {
      const fields = [...(f.fields || [])];
      fields[idx] = updated;
      return { ...f, fields };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setForm((f) => {
      const fields = f.fields || [];
      const oldIdx = fields.findIndex((x) => x.columnId === active.id);
      const newIdx = fields.findIndex((x) => x.columnId === over.id);
      const reordered = arrayMove(fields, oldIdx, newIdx).map((x, i) => ({
        ...x,
        order: i,
      }));
      return { ...f, fields: reordered };
    });
  };

  const handleSave = async () => {
    if (!tableId || !form.name) return;
    setSaving(true);
    try {
      if (formId) {
        const res = await formsAPI.update(formId, form);
        setForm(res.data);
      } else {
        const res = await formsAPI.create({
          tableId,
          name: form.name!,
          description: form.description,
          fields: form.fields,
          settings: form.settings,
          submitLabel: form.submitLabel,
          successMessage: form.successMessage,
        });
        setForm(res.data);
        navigate(`/tables/${tableId}/forms/${res.data.id}`, { replace: true });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const visibleFields = (form.fields || []).sort((a, b) => a.order - b.order);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/tables/${tableId}`)}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Retour au tableau
          </button>
          <div className="w-px h-5 bg-slate-200" />
          <input
            value={form.name || ''}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="text-base font-semibold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-400 focus:outline-none px-1 py-0.5 transition-all"
            placeholder="Nom du formulaire"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Active toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-sm text-slate-600">
              {form.isActive ? 'Actif' : 'Inactif'}
            </span>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
              className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 ${
                form.isActive ? 'bg-indigo-500' : 'bg-slate-300'
              }`}
              style={{ height: '1.375rem', width: '2.25rem' }}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                  form.isActive ? 'translate-x-4' : ''
                }`}
              />
            </button>
          </label>

          {formId && form.id && (
            <button
              onClick={() => navigate(`/tables/${tableId}/forms/${formId}/submissions`)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
              <span className="font-semibold" style={{ color: form._count?.submissions ? undefined : 'inherit' }}>
                {form._count?.submissions ?? 0}
              </span>
              &nbsp;soumission{(form._count?.submissions ?? 0) !== 1 ? 's' : ''}
            </button>
          )}

          {publicUrl && (
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {copySuccess ? (
                <>✅ Copié !</>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                  Copier le lien
                </>
              )}
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Sauvegarde…
              </>
            ) : saved ? (
              <>✅ Sauvegardé</>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Sauvegarder
              </>
            )}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6">
        <div className="flex gap-0">
          {[
            { key: 'fields', label: '📝 Champs' },
            { key: 'settings', label: '⚙️ Paramètres' },
            { key: 'preview', label: '👁 Aperçu' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
        {/* ─── FIELDS TAB ─── */}
        {tab === 'fields' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500 mb-4">
              Faites glisser pour réorganiser. Masquez les champs que vous ne voulez pas afficher dans le formulaire public.
            </p>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={visibleFields.map((f) => f.columnId)}
                strategy={verticalListSortingStrategy}
              >
                {visibleFields.map((field, idx) => (
                  <SortableFieldRow
                    key={field.columnId}
                    field={field}
                    column={columns.find((c) => c.id === field.columnId)}
                    onChange={(updated) => {
                      // Find real index in form.fields
                      const realIdx = (form.fields || []).findIndex(
                        (x) => x.columnId === field.columnId
                      );
                      handleFieldChange(realIdx >= 0 ? realIdx : idx, updated);
                    }}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}

        {/* ─── SETTINGS TAB ─── */}
        {tab === 'settings' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Contenu du formulaire</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1.5">Description</label>
                  <textarea
                    value={form.description || ''}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                    placeholder="Description affichée en haut du formulaire"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-600 mb-1.5">Texte du bouton d'envoi</label>
                  <input
                    value={form.submitLabel || ''}
                    onChange={(e) => setForm((f) => ({ ...f, submitLabel: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="Soumettre"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-600 mb-1.5">Message de confirmation</label>
                  <textarea
                    value={form.successMessage || ''}
                    onChange={(e) => setForm((f) => ({ ...f, successMessage: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                    placeholder="Votre réponse a bien été enregistrée. Merci !"
                  />
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Apparence</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1.5">Couleur de fond</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.settings?.bgColor || '#f8fafc'}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          settings: { ...f.settings, bgColor: e.target.value },
                        }))
                      }
                      className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                    />
                    <span className="text-sm text-slate-500">
                      {form.settings?.bgColor || '#f8fafc'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-600 mb-1.5">Couleur d'accent</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.settings?.accentColor || '#6366f1'}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          settings: { ...f.settings, accentColor: e.target.value },
                        }))
                      }
                      className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                    />
                    <span className="text-sm text-slate-500">
                      {form.settings?.accentColor || '#6366f1'}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {publicUrl && (
              <>
                <hr className="border-slate-100" />
                <section>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Lien public</h3>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-600 break-all">
                      {publicUrl}
                    </code>
                    <button
                      onClick={handleCopyLink}
                      className="shrink-0 px-3 py-2 text-sm rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                    >
                      {copySuccess ? '✅' : '📋'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Ce lien permet à n'importe qui (sans compte) de soumettre une réponse.
                  </p>
                </section>
              </>
            )}
          </div>
        )}

        {/* ─── PREVIEW TAB ─── */}
        {tab === 'preview' && (
          <div
            className="rounded-2xl overflow-hidden shadow-xl"
            style={{ backgroundColor: form.settings?.bgColor || '#f8fafc' }}
          >
            <div
              className="p-8"
              style={{ backgroundColor: form.settings?.accentColor || '#6366f1' }}
            >
              <h1 className="text-2xl font-bold text-white">{form.name || 'Formulaire sans titre'}</h1>
              {form.description && (
                <p className="text-white/80 mt-2 text-sm">{form.description}</p>
              )}
            </div>

            <div className="bg-white p-8 space-y-5">
              {visibleFields
                .filter((f) => !f.hidden)
                .map((field) => {
                  const col = columns.find((c) => c.id === field.columnId);
                  return (
                    <div key={field.columnId} className="space-y-1.5">
                      <label className="block text-sm font-semibold text-slate-700">
                        {field.label}
                        {field.required && <span className="ml-1 text-rose-500">*</span>}
                      </label>
                      {col?.type === 'LONG_TEXT' ? (
                        <textarea
                          rows={3}
                          disabled
                          placeholder={field.helpText || ''}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm bg-slate-50 resize-none"
                        />
                      ) : col?.type === 'DROPDOWN' ? (
                        <select
                          disabled
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm bg-slate-50"
                        >
                          <option>— Sélectionner —</option>
                          {(col.options as string[] || []).map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      ) : col?.type === 'CHECKBOX' || col?.type === 'YES_NO' ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-9 h-5 rounded-full flex items-center px-0.5"
                            style={{ backgroundColor: `${form.settings?.accentColor || '#6366f1'}40` }}
                          >
                            <div className="w-4 h-4 rounded-full bg-white shadow" />
                          </div>
                          <span className="text-sm text-slate-500">Non</span>
                        </div>
                      ) : (
                        <input
                          disabled
                          placeholder={field.helpText || ''}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm bg-slate-50"
                          type={col?.type === 'EMAIL' ? 'email' : col?.type === 'NUMBER' ? 'number' : 'text'}
                        />
                      )}
                      {field.helpText && (
                        <p className="text-xs text-slate-400">{field.helpText}</p>
                      )}
                    </div>
                  );
                })}

              <button
                disabled
                className="w-full py-3 rounded-xl font-semibold text-white text-sm opacity-90"
                style={{ backgroundColor: form.settings?.accentColor || '#6366f1' }}
              >
                {form.submitLabel || 'Soumettre'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
