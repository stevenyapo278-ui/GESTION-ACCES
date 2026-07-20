import { Check, Trash2, Pencil } from 'lucide-react';
import type { Row, Column } from '../types';

interface CardsViewProps {
  rows: Row[];
  columns: Column[];
  pageIndex: number;
  pageSize: number;
  onEditRow: (row: Row) => void;
  onDeleteRow: (rowId: string) => void;
}

export default function CardsView({ rows, columns, pageIndex, pageSize, onEditRow, onDeleteRow }: CardsViewProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="size-16 rounded-2xl bg-accent-blue/5 flex items-center justify-center mb-4">
          <svg className="size-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Aucun enregistrement</p>
        <p className="text-xs text-zinc-500 mt-1">Ajoutez votre première ligne de données</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-5">
      {rows.map((row, idx) => (
        <CardItem
          key={row.id}
          row={row}
          columns={columns}
          index={pageIndex * pageSize + idx + 1}
          onEdit={() => onEditRow(row)}
          onDelete={() => onDeleteRow(row.id)}
        />
      ))}
    </div>
  );
}

function CardItem({ row, columns, index, onEdit, onDelete }: {
  row: Row;
  columns: Column[];
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Find the first non-empty value to use as the card title
  const firstCol = columns[0];
  const titleValue = firstCol
    ? row.cellValues.find((cv) => cv.columnId === firstCol.id)?.value
    : null;
  const title = titleValue && String(titleValue).trim()
    ? String(titleValue)
    : `#${index}`;

  // Get a colour from the index for a subtle accent bar
  const accentColors = [
    'bg-blue-500/20 border-blue-500/40',
    'bg-emerald-500/20 border-emerald-500/40',
    'bg-amber-500/20 border-amber-500/40',
    'bg-violet-500/20 border-violet-500/40',
    'bg-rose-500/20 border-rose-500/40',
    'bg-cyan-500/20 border-cyan-500/40',
  ];
  const accent = accentColors[index % accentColors.length];

  return (
    <div
      className="group relative rounded-xl border transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      onClick={onEdit}
    >
      {/* Coloured accent bar at the top */}
      <div className={`h-1.5 ${accent.split(' ')[0]}`} />

      <div className="p-4 space-y-2.5">
        {/* Header with index + actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 size-6 rounded-md bg-zinc-700/40 flex items-center justify-center text-[11px] font-semibold text-zinc-400">
              {index}
            </span>
            <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h3>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1.5 rounded-lg hover:bg-accent-blue/10 text-zinc-500 hover:text-accent-blue transition-colors"
              title="Modifier"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
              title="Supprimer"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-1.5">
          {columns.slice(0, 5).map((col) => {
            const cv = row.cellValues.find((v) => v.columnId === col.id);
            const val = cv?.value;
            if (val === null || val === undefined || val === '') return null;

            return (
              <div key={col.id} className="flex items-start gap-2 text-xs">
                <span className="shrink-0 font-medium text-zinc-500 min-w-[80px] truncate">
                  {col.name}
                </span>
                <span className="text-zinc-300 truncate" style={{ color: 'var(--text-secondary)' }}>
                  <CardValueRenderer column={col} value={val} />
                </span>
              </div>
            );
          })}
          {/* Show remaining count if more than 5 non-empty fields */}
          {columns.slice(5).filter((col) => {
            const cv = row.cellValues.find((v) => v.columnId === col.id);
            return cv?.value !== null && cv?.value !== undefined && cv?.value !== '';
          }).length > 0 && (
            <div className="text-[11px] text-zinc-500 italic pt-0.5">
              +{columns.slice(5).filter((col) => {
                const cv = row.cellValues.find((v) => v.columnId === col.id);
                return cv?.value !== null && cv?.value !== undefined && cv?.value !== '';
              }).length} champ(s) supplémentaire(s)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CardValueRenderer({ column, value }: { column: Column; value: any }) {
  if (value === null || value === undefined || value === '') return null;

  switch (column.type) {
    case 'CHECKBOX':
    case 'YES_NO':
      return (
        <span className={`inline-flex items-center gap-1 ${value === true || value === 'true' ? 'text-accent-green' : 'text-zinc-500'}`}>
          <div className={`size-3 rounded border ${value === true || value === 'true' ? 'bg-accent-green border-accent-green' : 'border-zinc-600'}`}>
            {(value === true || value === 'true') && <Check className="size-2.5 text-white" />}
          </div>
          {value === true || value === 'true' ? 'Oui' : 'Non'}
        </span>
      );
    case 'CURRENCY':
      return <span className="font-medium tabular-nums">{Number(value).toLocaleString('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 })}</span>;
    case 'PERCENTAGE':
      return <span className="tabular-nums">{Number(value).toFixed(1)}%</span>;
    case 'NUMBER':
      return <span className="font-medium tabular-nums">{Number(value).toLocaleString('fr-FR')}</span>;
    case 'DECIMAL':
      return <span className="font-medium tabular-nums">{Number(value).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</span>;
    case 'DATE': {
      try { return <span className="tabular-nums">{new Date(value).toLocaleDateString('fr-FR')}</span>; }
      catch { return <span>{String(value)}</span>; }
    }
    case 'URL':
      return <span className="text-accent-blue truncate block max-w-[120px]">{String(value)}</span>;
    case 'EMAIL':
      return <span className="text-accent-blue truncate block max-w-[120px]">{String(value)}</span>;
    case 'DROPDOWN':
    case 'MULTI_SELECT': {
      const options = Array.isArray(value) ? value : [value];
      return <span>{options.filter(Boolean).join(', ')}</span>;
    }
    default:
      return <span className="truncate block max-w-[160px]">{String(value)}</span>;
  }
}
