import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { publicFormAPI } from '../services/api';

interface FormField {
  columnId: string;
  label: string;
  required: boolean;
  hidden: boolean;
  order: number;
  helpText?: string;
}

interface ColumnMeta {
  name: string;
  type: string;
  options?: string[];
}

interface FormData {
  id: string;
  name: string;
  description?: string;
  submitLabel: string;
  successMessage: string;
  fields: FormField[];
  settings?: {
    bgColor?: string;
    accentColor?: string;
    logoUrl?: string;
  };
  columns: Record<string, ColumnMeta>;
}

export default function PublicForm() {
  const { token } = useParams<{ token: string }>();
  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});

  const accent = form?.settings?.accentColor || '#6366f1';
  const bg = form?.settings?.bgColor || '#f8fafc';

  useEffect(() => {
    if (!token) return;
    publicFormAPI
      .get(token)
      .then((res) => {
        setForm(res.data);
        // Init values
        const init: Record<string, any> = {};
        (res.data.fields as FormField[]).forEach((f) => {
          if (!f.hidden) init[f.columnId] = '';
        });
        setValues(init);
      })
      .catch(() => setError('Ce formulaire est introuvable ou n\'est plus actif.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await publicFormAPI.submit(token, values);
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err?.response?.data?.error || 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    if (field.hidden) return null;
    const col = form?.columns[field.columnId];
    if (!col) return null;

    const inputBase =
      'w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm ' +
      'focus:outline-none focus:ring-2 transition-all placeholder-slate-400';

    const focusColor = `focus:ring-[${accent}]/30 focus:border-[${accent}]`;

    const commonProps = {
      id: `field-${field.columnId}`,
      required: field.required,
      value: values[field.columnId] ?? '',
      onChange: (e: any) => setValues((v) => ({ ...v, [field.columnId]: e.target.value })),
      className: `${inputBase} ${focusColor}`,
      placeholder: field.helpText || '',
    };

    switch (col.type) {
      case 'LONG_TEXT':
        return (
          <textarea
            {...commonProps}
            rows={4}
            className={`${inputBase} ${focusColor} resize-none`}
          />
        );

      case 'NUMBER':
      case 'DECIMAL':
      case 'CURRENCY':
      case 'PERCENTAGE':
        return <input {...commonProps} type="number" step={col.type === 'DECIMAL' || col.type === 'PERCENTAGE' ? '0.01' : '1'} />;

      case 'DATE':
        return <input {...commonProps} type="date" />;
      case 'TIME':
        return <input {...commonProps} type="time" />;
      case 'DATE_TIME':
        return <input {...commonProps} type="datetime-local" />;

      case 'EMAIL':
        return <input {...commonProps} type="email" />;
      case 'URL':
        return <input {...commonProps} type="url" />;
      case 'PHONE':
        return <input {...commonProps} type="tel" />;

      case 'CHECKBOX':
      case 'YES_NO':
        return (
          <div className="flex items-center gap-3 mt-1">
            <button
              type="button"
              onClick={() =>
                setValues((v) => ({ ...v, [field.columnId]: !v[field.columnId] }))
              }
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                values[field.columnId] ? `bg-[${accent}]` : 'bg-slate-300'
              }`}
              style={{ backgroundColor: values[field.columnId] ? accent : undefined }}
              aria-checked={!!values[field.columnId]}
              role="switch"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  values[field.columnId] ? 'translate-x-5' : ''
                }`}
              />
            </button>
            <span className="text-sm text-slate-600">
              {values[field.columnId] ? 'Oui' : 'Non'}
            </span>
          </div>
        );

      case 'DROPDOWN':
        return (
          <select {...commonProps} className={`${inputBase} ${focusColor} cursor-pointer`}>
            <option value="">— Sélectionner —</option>
            {(col.options as string[] || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case 'MULTI_SELECT':
        return (
          <div className="flex flex-wrap gap-2 mt-1">
            {(col.options as string[] || []).map((opt) => {
              const selected = Array.isArray(values[field.columnId])
                ? values[field.columnId].includes(opt)
                : false;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    const curr = Array.isArray(values[field.columnId])
                      ? values[field.columnId]
                      : [];
                    const next = selected
                      ? curr.filter((x: string) => x !== opt)
                      : [...curr, opt];
                    setValues((v) => ({ ...v, [field.columnId]: next }));
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                    selected
                      ? 'text-white border-transparent'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                  }`}
                  style={selected ? { backgroundColor: accent, borderColor: accent } : {}}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        );

      default:
        return <input {...commonProps} type="text" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="w-10 h-10 border-4 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-sm">Chargement du formulaire…</span>
        </div>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Formulaire introuvable</h1>
          <p className="text-slate-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 py-12"
        style={{ backgroundColor: bg }}
      >
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-lg w-full text-center animate-fade-in">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl"
            style={{ backgroundColor: `${accent}20` }}
          >
            ✅
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-3">Réponse enregistrée !</h1>
          <p className="text-slate-600 leading-relaxed">{form.successMessage}</p>
          <button
            onClick={() => {
              setSubmitted(false);
              const init: Record<string, any> = {};
              form.fields.forEach((f) => { if (!f.hidden) init[f.columnId] = ''; });
              setValues(init);
            }}
            className="mt-8 px-6 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            Soumettre une nouvelle réponse
          </button>
        </div>
      </div>
    );
  }

  const visibleFields = [...form.fields]
    .filter((f) => !f.hidden)
    .sort((a, b) => a.order - b.order);

  return (
    <div
      className="min-h-screen py-12 px-4"
      style={{ backgroundColor: bg }}
    >
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        {form.settings?.logoUrl && (
          <div className="text-center mb-6">
            <img
              src={form.settings.logoUrl}
              alt="Logo"
              className="h-16 mx-auto object-contain"
            />
          </div>
        )}

        <div
          className="rounded-t-3xl p-8 mb-0.5"
          style={{ backgroundColor: accent }}
        >
          <h1 className="text-2xl font-bold text-white">{form.name}</h1>
          {form.description && (
            <p className="text-white/80 mt-2 text-sm leading-relaxed">{form.description}</p>
          )}
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-b-3xl shadow-2xl p-8 space-y-6"
        >
          {visibleFields.map((field) => (
            <div key={field.columnId} className="space-y-1.5">
              <label
                htmlFor={`field-${field.columnId}`}
                className="block text-sm font-semibold text-slate-700"
              >
                {field.label}
                {field.required && (
                  <span className="ml-1 text-rose-500">*</span>
                )}
              </label>

              {renderField(field)}

              {field.helpText && (
                <p className="text-xs text-slate-400">{field.helpText}</p>
              )}
            </div>
          ))}

          {submitError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm">
              ⚠️ {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: accent }}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Envoi en cours…
              </span>
            ) : (
              form.submitLabel
            )}
          </button>

          <p className="text-center text-xs text-slate-400 pt-2">
            Propulsé par{' '}
            <span className="font-semibold text-slate-600">GestionAccess</span>
          </p>
        </form>
      </div>
    </div>
  );
}
