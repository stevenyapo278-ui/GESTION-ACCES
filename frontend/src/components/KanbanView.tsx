import { useState, useMemo } from 'react';
import { Pencil, Trash2, Check, Plus } from 'lucide-react';
import type { Row, Column } from '../types';

interface KanbanViewProps {
  rows: Row[];
  columns: Column[];
  onEditRow: (row: Row) => void;
  onDeleteRow: (rowId: string) => void;
}

export default function KanbanView({ rows, columns, onEditRow, onDeleteRow }: KanbanViewProps) {
  const [groupByColId, setGroupByColId] = useState<string>('');

  const groupByColumn = useMemo(() => {
    if (groupByColId) return columns.find((c) => c.id === groupByColId) ?? null;
    const selectCol = columns.find((c) => c.type === 'DROPDOWN' || c.type === 'MULTI_SELECT');
    if (selectCol) return selectCol;
    if (columns.length > 0) return columns[0];
    return null;
  }, [columns, groupByColId]);

  const lanes = useMemo(() => {
    if (!groupByColumn) return [];
    const groups = new Map<string, Row[]>();
    for (const row of rows) {
      const cv = row.cellValues.find((v) => v.columnId === groupByColumn.id);
      let key = cv?.value;
      if (key === null || key === undefined || key === '') key = '(vide)';
      else key = String(key);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    const laneOrder = Array.from(groups.keys());
    const statusOrder = ['À faire', 'To do', 'En cours', 'In progress', 'Fait', 'Done', 'Terminé'];
    laneOrder.sort((a, b) => {
      const ai = statusOrder.indexOf(a);
      const bi = statusOrder.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
    return laneOrder.map((key) => ({ key, rows: groups.get(key)! }));
  }, [rows, groupByColumn]);

  const laneColors = [
    { bar: 'bg-blue-500', dot: 'bg-blue-400' },
    { bar: 'bg-amber-500', dot: 'bg-amber-400' },
    { bar: 'bg-emerald-500', dot: 'bg-emerald-400' },
    { bar: 'bg-violet-500', dot: 'bg-violet-400' },
    { bar: 'bg-rose-500', dot: 'bg-rose-400' },
    { bar: 'bg-cyan-500', dot: 'bg-cyan-400' },
    { bar: 'bg-orange-500', dot: 'bg-orange-400' },
    { bar: 'bg-teal-500', dot: 'bg-teal-400' },
  ];

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="size-16 rounded-2xl bg-accent-blue/5 flex items-center justify-center mb-4">
          <Plus className="size-8 text-zinc-600" />
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Aucun enregistrement</p>
        <p className="text-xs text-zinc-500 mt-1">Ajoutez votre première ligne de données</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Group by selector */}
      {columns.length > 1 && (
        <div className="flex items-center gap-2 px-5 py-3 border-b shrink-0" style={{ borderColor: 'var(--border-color)' }}>
          <span className="text-xs font-medium text-zinc-500">Regrouper par :</span>
          <select
            className="input text-xs py-1 w-auto"
            value={groupByColId || groupByColumn?.id || ''}
            onChange={(e) => setGroupByColId(e.target.value)}
          >
            {columns.map((col) => (
              <option key={col.id} value={col.id}>{col.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Lanes */}
      <div className="flex-1 overflow-x-auto p-5">
        <div className="flex gap-5 h-full min-h-0" style={{ minWidth: lanes.length * 280 }}>
          {lanes.map((lane, i) => {
            const color = laneColors[i % laneColors.length];
            return (
              <div key={lane.key} className="flex flex-col rounded-xl border shrink-0 w-[280px] max-h-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                {/* Lane header */}
                <div className={`shrink-0 h-1.5 rounded-t-xl ${color.bar}`} />
                <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <span className={`size-2 rounded-full ${color.dot}`} />
                  <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{lane.key}</span>
                  <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-zinc-700/50 text-zinc-400">{lane.rows.length}</span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {lane.rows.map((row) => (
                    <KanbanCard
                      key={row.id}
                      row={row}
                      columns={columns}
                      onEdit={() => onEditRow(row)}
                      onDelete={() => onDeleteRow(row.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KanbanCard({ row, columns, onEdit, onDelete }: {
  row: Row;
  columns: Column[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const firstCol = columns[0];
  const titleValue = firstCol
    ? row.cellValues.find((cv) => cv.columnId === firstCol.id)?.value
    : null;
  const title = titleValue && String(titleValue).trim()
    ? String(titleValue)
    : `#${row.order + 1}`;

  const otherFields = columns.slice(0, 4).map((col) => {
    const cv = row.cellValues.find((v) => v.columnId === col.id);
    return { col, val: cv?.value };
  }).filter((f) => f.val !== null && f.val !== undefined && f.val !== '');

  return (
    <div
      className="group rounded-lg border p-3 cursor-pointer hover:shadow-md transition-all"
      style={{ backgroundColor: 'var(--bg-card-hover)', borderColor: 'var(--border-color)' }}
      onClick={onEdit}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h4>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1 rounded hover:bg-accent-blue/10 text-zinc-500 hover:text-accent-blue transition-colors">
            <Pencil className="size-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors">
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>
      <div className="space-y-1">
        {otherFields.map(({ col, val }) => (
          <div key={col.id} className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-500 font-medium min-w-0 shrink-0">{col.name}:</span>
            <span className="text-zinc-300 truncate"><CardValue value={val} column={col} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CardValue({ value, column }: { value: any; column: Column }) {
  if (value === null || value === undefined || value === '') return <span className="text-zinc-600">—</span>;

  switch (column.type) {
    case 'CHECKBOX':
    case 'YES_NO':
      return (
        <span className={value === true || value === 'true' ? 'text-accent-green' : 'text-zinc-500'}>
          {value === true || value === 'true' ? 'Oui' : 'Non'}
        </span>
      );
    case 'CURRENCY':
      return <span>{Number(value).toLocaleString('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 })}</span>;
    case 'PERCENTAGE':
      return <span>{Number(value).toFixed(1)}%</span>;
    case 'NUMBER':
      return <span>{Number(value).toLocaleString('fr-FR')}</span>;
    case 'DECIMAL':
      return <span>{Number(value).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</span>;
    case 'DATE': {
      try { return <span>{new Date(value).toLocaleDateString('fr-FR')}</span>; }
      catch { return <span>{String(value)}</span>; }
    }
    case 'DROPDOWN':
    case 'MULTI_SELECT': {
      const options = Array.isArray(value) ? value : [value];
      return <span>{options.filter(Boolean).join(', ')}</span>;
    }
    default:
      return <span className="truncate block max-w-[140px]">{String(value)}</span>;
  }
}
