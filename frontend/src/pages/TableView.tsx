import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Plus, Search, Download, Upload, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown,
  Trash2, Loader2, Check, X, FileText, Columns3, Eye,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Table2,
} from 'lucide-react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getPaginationRowModel,
  getFilteredRowModel, ColumnDef, SortingState, ColumnFiltersState,
  flexRender, type FilterFn,
} from '@tanstack/react-table';
import { tablesAPI, rowsAPI, columnsAPI, viewsAPI, searchAPI, exportAPI, importAPI, formsAPI } from '../services/api';
import CardsView from '../components/CardsView';
import KanbanView from '../components/KanbanView';
import { COLUMN_TYPES, type ColumnType, type Table, type Column, type Row } from '../types';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ui/ConfirmModal';
import RowModal from '../components/ui/RowModal';

// Simple text filter for columns
const textFilter: FilterFn<Row> = (row, columnId, value) => {
  const item = row.getValue(columnId);
  return String(item ?? '').toLowerCase().includes(String(value).toLowerCase());
};

export default function TableView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [showImportModal, setShowImportModal] = useState(false);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [columnSizing, setColumnSizing] = useState({});
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [modalRow, setModalRow] = useState<Row | null>(null);
  const [modalValues, setModalValues] = useState<Record<string, any>>({});
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<ColumnType>('TEXT');
  const [newColOptions, setNewColOptions] = useState('');
  const [newColRequired, setNewColRequired] = useState(false);
  const [confirmDeleteRow, setConfirmDeleteRow] = useState<string | null>(null);
  const [confirmDeleteRowModal, setConfirmDeleteRowModal] = useState(false);
  const [togglingColId, setTogglingColId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const formsMenuRef = useRef<HTMLDivElement>(null);
  const [showFormsMenu, setShowFormsMenu] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(0);

  // Server-side pagination
  const [serverPage, setServerPage] = useState(1);
  const SERVER_PAGE_SIZE = 100;

  // Measure sidebar width to center modals correctly within content area
  useEffect(() => {
    const measure = () => {
      // The desktop sidebar is a fixed element with classes hidden lg:fixed lg:inset-y-0
      const sidebar = document.querySelector('.lg\\:fixed.lg\\:inset-y-0');
      if (sidebar) {
        setSidebarWidth(sidebar.getBoundingClientRect().width);
      } else {
        setSidebarWidth(0);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    // Also re-measure when sidebar collapse state changes (every 300ms)
    const interval = setInterval(measure, 500);
    return () => {
      window.removeEventListener('resize', measure);
      clearInterval(interval);
    };
  }, []);

  // Fetch table data with server-side pagination
  const { data: tableData, isLoading, refetch } = useQuery<Table & { pagination?: { page: number; pageSize: number; total: number; totalPages: number } }>({
    queryKey: ['table', id, serverPage],
    queryFn: async () => {
      const res = await tablesAPI.get(id!, { page: serverPage, pageSize: SERVER_PAGE_SIZE });
      return res.data;
    },
    enabled: !!id,
    placeholderData: (prev) => prev,
  });
  const table = tableData;

  // Mutations
  const createRowMutation = useMutation({
    mutationFn: (values: Record<string, any>) => rowsAPI.create({ tableId: id!, values }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['table', id], exact: false }); toast.success('Ligne ajoutée'); closeModal(); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const updateRowMutation = useMutation({
    mutationFn: ({ rowId, values }: { rowId: string; values: Record<string, any> }) => rowsAPI.update(rowId, { values }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['table', id], exact: false }); toast.success('Ligne mise à jour'); closeModal(); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const deleteRowMutation = useMutation({
    mutationFn: (rowId: string) => rowsAPI.delete(rowId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['table', id], exact: false }); toast.success('Ligne supprimée'); closeModal(); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const createColumnMutation = useMutation({
    mutationFn: (data: { name: string; type: ColumnType; required: boolean; options?: string[] }) =>
      columnsAPI.create({ tableId: id!, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['table', id], exact: false });
      toast.success('Colonne ajoutée');
      setShowColumnModal(false);
      setNewColName('');
      setNewColType('TEXT');
      setNewColOptions('');
      setNewColRequired(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  // Derived data
  const activeView = useMemo(() => table?.views?.[0] ?? null, [table?.views]);

  const visibleColumns = useMemo(() => {
    const cols = table?.columns ?? [];
    if (!activeView?.viewColumns) return cols;
    const viewColMap = new Map(
      activeView.viewColumns.filter((vc) => vc.visible).sort((a, b) => a.order - b.order).map((vc) => [vc.columnId, vc])
    );
    return cols.filter((c) => viewColMap.has(c.id));
  }, [table?.columns, activeView]);

  // Close column menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setShowColumnMenu(false);
      }
    };
    if (showColumnMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColumnMenu]);

  // Close forms menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (formsMenuRef.current && !formsMenuRef.current.contains(e.target as Node)) {
        setShowFormsMenu(false);
      }
    };
    if (showFormsMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFormsMenu]);

  // Fetch forms list for this table
  const { data: tableForms } = useQuery({
    queryKey: ['forms', id],
    queryFn: async () => { const res = await formsAPI.list(id!); return res.data as any[]; },
    enabled: !!id && showFormsMenu,
    staleTime: 30_000,
  });

  // Modal handlers
  const openCreateModal = () => {
    const initial: Record<string, any> = {};
    table?.columns?.forEach((col) => { initial[col.id] = ''; });
    setModalValues(initial);
    setModalRow(null);
    setModalMode('create');
  };

  const openEditModal = (row: Row) => {
    const values: Record<string, any> = {};
    row.cellValues.forEach((cv) => { values[cv.columnId] = cv.value; });
    setModalValues(values);
    setModalRow(row);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setModalRow(null);
    setModalValues({});
  };

  const handleSave = () => {
    // Validate values against column types
    if (!table) return;
    for (const col of table.columns ?? []) {
      const val = modalValues[col.id];
      if (val === '' || val === null || val === undefined) continue; // empty is OK

      switch (col.type) {
        case 'NUMBER':
        case 'DECIMAL':
        case 'CURRENCY':
        case 'PERCENTAGE': {
          const num = Number(val);
          if (isNaN(num)) {
            toast.error(`« ${col.name} » doit être un nombre valide`);
            return;
          }
          break;
        }
        case 'DATE': {
          if (typeof val === 'string' && val.trim()) {
            const d = new Date(val);
            if (isNaN(d.getTime())) {
              toast.error(`« ${col.name} » doit être une date valide`);
              return;
            }
          }
          break;
        }
        case 'DATE_TIME': {
          if (typeof val === 'string' && val.trim()) {
            const d = new Date(val);
            if (isNaN(d.getTime())) {
              toast.error(`« ${col.name} » doit être une date/heure valide`);
              return;
            }
          }
          break;
        }
        case 'EMAIL': {
          if (typeof val === 'string' && val.trim()) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
              toast.error(`« ${col.name} » doit être un email valide`);
              return;
            }
          }
          break;
        }
        case 'URL': {
          if (typeof val === 'string' && val.trim()) {
            try { new URL(val); } catch {
              toast.error(`« ${col.name} » doit être une URL valide`);
              return;
            }
          }
          break;
        }
        case 'CHECKBOX':
        case 'YES_NO': {
          if (val !== true && val !== false && val !== 'true' && val !== 'false' && val !== '') {
            toast.error(`« ${col.name} » doit être Oui ou Non`);
            return;
          }
          break;
        }
      }
    }

    if (modalMode === 'create') {
      createRowMutation.mutate(modalValues);
    } else if (modalMode === 'edit' && modalRow) {
      updateRowMutation.mutate({ rowId: modalRow.id, values: modalValues });
    }
  };

  const handleDelete = () => {
    if (!modalRow) return;
    setConfirmDeleteRowModal(true);
  };

  const confirmDeleteRowFromModal = () => {
    if (modalRow) {
      deleteRowMutation.mutate(modalRow.id);
    }
    setConfirmDeleteRowModal(false);
  };

  const handleAddColumn = () => {
    if (!newColName.trim()) {
      toast.error('Le nom de la colonne est requis');
      return;
    }
    createColumnMutation.mutate({
      name: newColName.trim(),
      type: newColType,
      required: newColRequired,
      options: (newColType === 'DROPDOWN' || newColType === 'MULTI_SELECT') && newColOptions.trim()
        ? newColOptions.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
    });
  };

  // Column definitions
  const columnDefs = useMemo<ColumnDef<Row>[]>(() => {
    return visibleColumns.map((col) => ({
      id: col.id,
      header: col.name,
      accessorFn: (row) => row.cellValues.find((v) => v.columnId === col.id)?.value,
      filterFn: textFilter,
      sortingFn: ['NUMBER', 'DECIMAL', 'CURRENCY'].includes(col.type)
        ? (a, b, colId) => (Number(a.getValue(colId as string)) || 0) - (Number(b.getValue(colId as string)) || 0)
        : 'alphanumeric',
      cell: ({ row: tableRow, getValue }) => (
        <div className="min-h-[24px]">
          <CellRenderer column={col} value={getValue()} />
        </div>
      ),
      size: ['CHECKBOX', 'YES_NO'].includes(col.type) ? 100 :
            ['NUMBER', 'DECIMAL'].includes(col.type) ? 120 : 180,
      enableResizing: true,
    }));
  }, [visibleColumns]);

  // TanStack Table instance
  const tableInstance = useReactTable({
    data: table?.rows ?? [],
    columns: columnDefs,
    filterFns: { text: textFilter },
    state: { sorting, columnFilters, pagination, columnSizing },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableSorting: true,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
  });

  // Search effect (server-side)
  useEffect(() => {
    if (!searchQuery.trim()) { refetch(); return; }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchAPI.search(id!, searchQuery);
        queryClient.setQueryData(['table', id], (old: any) => old ? { ...old, rows: res.data.rows } : old);
      } catch {}
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, id, queryClient, refetch]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await importAPI.csv(id!, file);
      toast.success(`${res.data.imported} ligne(s) importée(s)`);
      refetch(); setShowImportModal(false);
    } catch { toast.error("Échec de l'import. Vérifiez les en-têtes CSV."); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Get all columns for visibility toggle
  const allColumns = table?.columns ?? [];
  const isPending = createRowMutation.isPending || updateRowMutation.isPending;

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="size-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!table) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500">Tableau introuvable</p>
        <Link to="/tables" className="text-accent-blue hover:underline mt-2 inline-block">Retour aux tableaux</Link>
      </div>
    );
  }

  const { pageSize, pageIndex } = tableInstance.getState().pagination;
  // Use server pagination total when available, fall back to client filtered count
  const serverTotal = tableData?.pagination?.total;
  const totalRows = serverTotal ?? tableInstance.getFilteredRowModel().rows.length;
  const serverTotalPages = tableData?.pagination?.totalPages ?? 1;
  const pageCount = tableInstance.getPageCount();
  const fromRow = serverTotal
    ? (serverPage - 1) * SERVER_PAGE_SIZE + pageIndex * pageSize + 1
    : pageIndex * pageSize + 1;
  const toRow = serverTotal
    ? Math.min(fromRow + pageSize - 1, serverTotal)
    : Math.min((pageIndex + 1) * pageSize, totalRows);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Toolbar ── */}
      <div className="card relative z-10">
        <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-semibold mr-auto flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            {table.name}
            <span className="text-xs font-normal px-2 py-0.5 rounded-md bg-accent-blue/10 text-accent-blue">
              {totalRows} ligne{totalRows > 1 ? 's' : ''}
            </span>
          </h2>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
            <input className="input pl-9 py-1.5 text-sm w-48 lg:w-56" placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-3 animate-spin text-zinc-500" />}
          </div>

          <div className="w-px h-6 bg-space-700" />

          {/* Add row */}
          <button onClick={openCreateModal} className="btn-primary btn-sm">
            <Plus className="size-4" /> Ajouter
          </button>

          {/* Add column */}
          <button onClick={() => { setNewColName(''); setNewColType('TEXT'); setNewColOptions(''); setNewColRequired(false); setShowColumnModal(true); }} className="btn-secondary btn-sm">
            <Columns3 className="size-4" /> Colonne +
          </button>

          {/* Export */}
          <div className="relative group">
            <button className="btn-secondary btn-sm"><Download className="size-4" /> Exporter <ChevronDown className="size-3" /></button>
            <div className="absolute right-0 top-full mt-1 w-36 rounded-xl border shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-color)' }}>
              <button onClick={() => exportAPI.csv(id!, table?.name ?? 'export')} className="flex items-center gap-2 w-full px-4 py-2.5 text-sm hover:bg-white/5 rounded-t-xl" style={{ color: 'var(--text-secondary)' }}><FileText className="size-4" /> CSV</button>
              <button onClick={() => exportAPI.excel(id!, table?.name ?? 'export')} className="flex items-center gap-2 w-full px-4 py-2.5 text-sm hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}><FileText className="size-4" /> Excel</button>
              <button onClick={() => exportAPI.pdf(id!, table?.name ?? 'export')} className="flex items-center gap-2 w-full px-4 py-2.5 text-sm hover:bg-white/5 rounded-b-xl" style={{ color: 'var(--text-secondary)' }}><FileText className="size-4" /> PDF</button>
            </div>
          </div>

          {/* Import */}
          <button onClick={() => setShowImportModal(!showImportModal)} className="btn-secondary btn-sm"><Upload className="size-4" /> Importer</button>

          <div className="w-px h-6 bg-space-700" />

          {/* Column visibility toggle */}
          <div className="relative" ref={columnMenuRef}>
            <button onClick={() => setShowColumnMenu(!showColumnMenu)} className="btn-secondary btn-sm">
              <Eye className="size-4" /> Colonnes
            </button>
            {showColumnMenu && activeView && (
              <div className="absolute right-0 top-full mt-1 w-60 rounded-xl border shadow-xl z-10 p-2" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-color)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest px-2 py-1.5" style={{ color: 'var(--text-muted)' }}>
                  Afficher / Masquer
                </p>
                <div className="space-y-0.5 max-h-64 overflow-y-auto">
                  {allColumns.map((col) => {
                    const isVisible = !!visibleColumns.find((vc) => vc.id === col.id);
                    const isToggling = togglingColId === col.id;
                    return (
                      <label key={col.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                        <input
                          type="checkbox"
                          checked={isVisible}
                          disabled={isToggling}
                          onChange={async () => {
                            if (!activeView) return;
                            setTogglingColId(col.id);
                            try {
                              // Build new columns array toggling this column
                              const allCols = allColumns.map((c, idx) => ({
                                columnId: c.id,
                                visible: c.id === col.id ? !isVisible : !!visibleColumns.find((vc) => vc.id === c.id),
                                order: idx,
                              }));
                              await viewsAPI.updateColumns(activeView.id, allCols);
                              queryClient.invalidateQueries({ queryKey: ['table', id], exact: false });
                            } catch {
                              toast.error('Impossible de modifier la visibilité');
                            } finally {
                              setTogglingColId(null);
                            }
                          }}
                          className="rounded border-zinc-600 text-accent-blue focus:ring-accent-blue/30 bg-space-800"
                        />
                        <span className="text-sm flex-1" style={{ color: 'var(--text-secondary)' }}>{col.name}</span>
                        {isToggling && <Loader2 className="size-3 animate-spin text-zinc-500" />}
                      </label>
                    );
                  })}
                </div>
                <button onClick={() => navigate(`/tables/${id}/settings`)} className="flex items-center gap-2 w-full mt-2 px-2 py-1.5 rounded-lg text-xs font-medium text-accent-blue hover:bg-accent-blue/5 transition-colors">
                  <Columns3 className="size-3.5" /> Gérer les colonnes
                </button>
              </div>
            )}
          </div>

          <button onClick={() => navigate(`/tables/${id}/settings`)} className="btn-ghost btn-sm">
            <Columns3 className="size-4" />
          </button>

          {/* View switcher */}
          <div className="flex items-center border-l pl-2 ml-1" style={{ borderColor: 'var(--border-color)' }}>
            {(['TABLE', 'CARDS', 'KANBAN'] as const).map((viewType) => (
              <button key={viewType}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${activeView?.type === viewType ? 'bg-accent-blue/10 text-accent-blue' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
                onClick={async () => { if (activeView) { await viewsAPI.update(activeView.id, { type: viewType }); refetch(); }}}>
                {viewType === 'TABLE' ? 'Tableau' : viewType === 'CARDS' ? 'Cartes' : 'Kanban'}
              </button>
            ))}
          </div>

          {/* Forms dropdown */}
          <div className="relative" ref={formsMenuRef}>
            <button
              onClick={() => setShowFormsMenu(!showFormsMenu)}
              className="btn-secondary btn-sm"
              title="Gérer les formulaires publics"
            >
              📋 Formulaires <ChevronDown className="size-3" />
            </button>
            {showFormsMenu && (
              <div
                className="absolute right-0 top-full mt-1 w-72 rounded-xl border shadow-xl z-20 overflow-hidden"
                style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-color)' }}
              >
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Formulaires publics</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {!tableForms ? (
                    <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-zinc-500" /></div>
                  ) : tableForms.length === 0 ? (
                    <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>Aucun formulaire pour ce tableau</p>
                  ) : (
                    tableForms.map((form: any) => (
                      <button
                        key={form.id}
                        onClick={() => { setShowFormsMenu(false); navigate(`/tables/${id}/forms/${form.id}`); }}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{form.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {form._count?.submissions ?? 0} soumission{(form._count?.submissions ?? 0) !== 1 ? 's' : ''}
                            {' · '}{form.isActive ? <span className="text-emerald-400">Actif</span> : <span className="text-zinc-500">Inactif</span>}
                          </p>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-zinc-500" />
                      </button>
                    ))
                  )}
                </div>
                <div className="border-t p-2" style={{ borderColor: 'var(--border-color)' }}>
                  <button
                    onClick={() => { setShowFormsMenu(false); navigate(`/tables/${id}/forms/new`); }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-accent-blue hover:bg-accent-blue/10 transition-colors"
                  >
                    <Plus className="size-4" /> Créer un nouveau formulaire
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Data view ── */}
      <div className={`card ${activeView?.type === 'CARDS' || activeView?.type === 'KANBAN' ? '' : 'overflow-hidden'}`}>
        {activeView?.type === 'CARDS' ? (
          <CardsView
            rows={tableInstance.getRowModel().rows.map((r) => r.original)}
            columns={visibleColumns}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onEditRow={openEditModal}
            onDeleteRow={(rowId) => setConfirmDeleteRow(rowId)}
          />
        ) : activeView?.type === 'KANBAN' ? (
          <KanbanView
            rows={table?.rows ?? []}
            columns={visibleColumns}
            onEditRow={openEditModal}
            onDeleteRow={(rowId) => setConfirmDeleteRow(rowId)}
          />
        ) : (
          <div className="overflow-x-auto">
          <table className="table-wrap w-full" style={{ minWidth: visibleColumns.length * 120 }}>
            <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-card)' }}>
              {tableInstance.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  <th className="w-10 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider sticky left-0 z-10" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-tertiary)' }}>#</th>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="relative px-4 py-3 text-left cursor-pointer hover:opacity-80 select-none group"
                      style={{ width: header.getSize(), color: 'var(--text-muted)', minWidth: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}>
                      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap overflow-hidden">
                        <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                        {header.column.getCanSort() && (
                          <span className="text-zinc-600 shrink-0">
                            {header.column.getIsSorted() === 'asc' ? <ArrowUp className="size-3" /> :
                             header.column.getIsSorted() === 'desc' ? <ArrowDown className="size-3" /> :
                             <ArrowUpDown className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                          </span>
                        )}
                      </div>
                      {/* Filter input */}
                      <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          className="w-full px-2 py-1 text-[11px] rounded-md border outline-none transition-colors"
                          placeholder="Filtrer..."
                          value={(header.column.getFilterValue() as string) ?? ''}
                          onChange={(e) => header.column.setFilterValue(e.target.value)}
                          style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                        />
                      </div>
                      {/* Resize handle */}
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent-blue/50 transition-colors opacity-0 group-hover:opacity-100"
                        style={{ touchAction: 'none' }}
                      />
                    </th>
                  ))}
                  <th className="w-16 px-4 py-3" style={{ backgroundColor: 'var(--bg-tertiary)' }} />
                </tr>
              ))}
            </thead>
            <tbody>
              {tableInstance.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 2} className="px-6 py-16 text-center">
                    <div className="max-w-sm mx-auto">
                      <div className="size-16 rounded-2xl bg-accent-blue/5 flex items-center justify-center mx-auto mb-4">
                        <Table2 className="size-8 text-zinc-600" />
                      </div>
                      {searchQuery || columnFilters.length > 0 ? (
                        <>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Aucun résultat</p>
                          <p className="text-xs text-zinc-500 mt-1">Essayez de modifier vos filtres de recherche</p>
                          <button onClick={() => { setSearchQuery(''); setColumnFilters([]); }}
                            className="text-xs text-accent-blue hover:underline mt-3">Réinitialiser les filtres</button>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Aucun enregistrement</p>
                          <p className="text-xs text-zinc-500 mt-1">Ajoutez votre première ligne de données</p>
                          <button onClick={openCreateModal}
                            className="btn-primary btn-sm mt-4"><Plus className="size-4" /> Ajouter une ligne</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                tableInstance.getRowModel().rows.map((row, idx) => (
                  <tr key={row.id}
                    className="border-b transition-colors cursor-pointer hover:bg-white/[0.03]"
                    style={{ borderColor: 'var(--border-color)' }}
                    onClick={() => openEditModal(row.original)}>
                    <td className="px-4 py-2.5 text-xs sticky left-0 z-[1]" style={{ color: 'var(--text-muted)', backgroundColor: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-card-hover)' }}>{pageIndex * pageSize + idx + 1}</td>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2.5 text-sm" style={{ width: cell.column.getSize(), color: 'var(--text-secondary)' }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                    <td className="px-4 py-2.5">
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteRow(row.original.id); }}
                        className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors" title="Supprimer">
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}

        {/* ── Pagination ── */}
        {totalRows > 0 && activeView?.type !== 'KANBAN' && (
          <div className="flex items-center justify-between px-5 py-3 border-t text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
            <div className="flex items-center gap-4">
              <span>{fromRow}–{toRow} sur {totalRows} ligne{totalRows > 1 ? 's' : ''}</span>
              <div className="flex items-center gap-1.5">
                <span>Lignes/page :</span>
                <select
                  className="rounded-md border px-2 py-1 text-xs outline-none"
                  value={pageSize}
                  onChange={(e) => { setPagination({ pageIndex: 0, pageSize: Number(e.target.value) }); }}
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                >
                  {[10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
              {/* Server page indicator */}
              {serverTotalPages > 1 && (
                <div className="flex items-center gap-2 border-l pl-4" style={{ borderColor: 'var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Lot :</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setServerPage(Math.max(1, serverPage - 1)); setPagination(p => ({ ...p, pageIndex: 0 })); }}
                      disabled={serverPage <= 1}
                      className="p-1 rounded hover:bg-white/5 transition-colors disabled:opacity-30"
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>
                    <span className="px-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {serverPage}/{serverTotalPages}
                    </span>
                    <button
                      onClick={() => { setServerPage(Math.min(serverTotalPages, serverPage + 1)); setPagination(p => ({ ...p, pageIndex: 0 })); }}
                      disabled={serverPage >= serverTotalPages}
                      className="p-1 rounded hover:bg-white/5 transition-colors disabled:opacity-30"
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => tableInstance.setPageIndex(0)} disabled={pageIndex === 0}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-30" title="Première page">
                <ChevronsLeft className="size-4" />
              </button>
              <button onClick={() => tableInstance.previousPage()} disabled={!tableInstance.getCanPreviousPage()}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-30" title="Page précédente">
                <ChevronLeft className="size-4" />
              </button>
              <div className="flex items-center gap-1 px-2">
                {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => {
                  let pageNum: number;
                  if (pageCount <= 5) {
                    pageNum = i;
                  } else if (pageIndex < 3) {
                    pageNum = i;
                  } else if (pageIndex > pageCount - 4) {
                    pageNum = pageCount - 5 + i;
                  } else {
                    pageNum = pageIndex - 2 + i;
                  }
                  return (
                    <button key={pageNum}
                      onClick={() => tableInstance.setPageIndex(pageNum)}
                      className={`size-7 rounded-lg text-xs font-medium transition-colors ${pageNum === pageIndex ? 'bg-accent-blue/10 text-accent-blue' : 'hover:bg-white/5'}`}
                      style={{ color: pageNum === pageIndex ? undefined : 'var(--text-secondary)' }}>
                      {pageNum + 1}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => tableInstance.nextPage()} disabled={!tableInstance.getCanNextPage()}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-30" title="Page suivante">
                <ChevronRight className="size-4" />
              </button>
              <button onClick={() => tableInstance.setPageIndex(pageCount - 1)} disabled={pageIndex === pageCount - 1}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-30" title="Dernière page">
                <ChevronsRight className="size-4" />
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        {totalRows === 0 && !searchQuery && columnFilters.length === 0 && activeView?.type !== 'KANBAN' && (
          <div className="px-5 py-2.5 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
            <span>{table?.rows?.length ?? 0} enregistrement(s)</span>
            <span>{visibleColumns.length} colonne(s)</span>
          </div>
        )}
      </div>

      {/* ── Import modal ── */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          style={{ left: sidebarWidth }} onClick={() => setShowImportModal(false)}>
          <div className="card p-6 w-full max-w-md shadow-xl" style={{ backgroundColor: 'var(--bg-card)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Importer des données</h3>
            <p className="text-sm text-zinc-500 mt-1">Fichier CSV dont les en-têtes correspondent aux noms des colonnes.</p>
            <div className="mt-4">
              <input ref={fileInputRef} type="file" accept=".csv,.xls,.xlsx" onChange={handleImport}
                className="block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-accent-blue/10 file:text-accent-blue hover:file:bg-accent-blue/20" />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowImportModal(false)} className="btn-secondary btn-sm">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Column Modal ── */}
      {showColumnModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          style={{ left: sidebarWidth }} onClick={() => setShowColumnModal(false)}>
          <div className="card w-full max-w-lg shadow-xl" style={{ backgroundColor: 'var(--bg-card)' }} onClick={(e) => e.stopPropagation()}>

            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <div>
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Ajouter une colonne</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Définissez les propriétés de la nouvelle colonne</p>
              </div>
              <button onClick={() => setShowColumnModal(false)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                <X className="size-5 text-zinc-500" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Nom de la colonne *</label>
                <input className="input" placeholder="Ex: Prénom, Email, Date..."
                  value={newColName} onChange={(e) => setNewColName(e.target.value)} autoFocus />
              </div>

              <div>
                <label className="label">Type de champ</label>
                <select className="input" value={newColType}
                  onChange={(e) => setNewColType(e.target.value as ColumnType)}>
                  {COLUMN_TYPES.map((ct) => (
                    <option key={ct.type} value={ct.type}>{ct.label}</option>
                  ))}
                </select>
              </div>

              {(newColType === 'DROPDOWN' || newColType === 'MULTI_SELECT') && (
                <div>
                  <label className="label">Options (séparées par des virgules)</label>
                  <input className="input" placeholder="Option 1, Option 2, Option 3..."
                    value={newColOptions}
                    onChange={(e) => setNewColOptions(e.target.value)} />
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Champ obligatoire</span>
                <button
                  onClick={() => setNewColRequired(!newColRequired)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${newColRequired ? 'bg-accent-orange' : 'bg-zinc-600'}`}
                >
                  <span className={`inline-block size-4 rounded-full bg-white transition-transform duration-200 ${newColRequired ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <button onClick={() => setShowColumnModal(false)} className="btn-secondary btn-sm">Annuler</button>
              <button onClick={handleAddColumn} disabled={createColumnMutation.isPending}
                className="btn-primary btn-sm">
                {createColumnMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Row Modal ── */}
      <RowModal
        open={!!modalMode}
        mode={modalMode}
        columns={table.columns ?? []}
        row={modalRow}
        values={modalValues}
        onValuesChange={setModalValues}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={closeModal}
        isPending={isPending}
        isDeleting={deleteRowMutation.isPending}
      />

      <ConfirmModal
        open={confirmDeleteRowModal}
        title="Supprimer la ligne"
        message="Supprimer cette ligne définitivement ?"
        confirmLabel="Supprimer"
        onConfirm={confirmDeleteRowFromModal}
        onCancel={() => setConfirmDeleteRowModal(false)}
      />

      <ConfirmModal
        open={!!confirmDeleteRow}
        title="Supprimer la ligne"
        message="Supprimer cette ligne ?"
        confirmLabel="Supprimer"
        onConfirm={() => { if (confirmDeleteRow) { deleteRowMutation.mutate(confirmDeleteRow); setConfirmDeleteRow(null); } }}
        onCancel={() => setConfirmDeleteRow(null)}
      />
    </div>
  );
}

// === Cell Renderer (display only) ===
function CellRenderer({ column, value }: { column: Column; value: any }) {
  if (value === null || value === undefined || value === '') return <span className="text-zinc-600">—</span>;

  switch (column.type) {
    case 'CHECKBOX':
      return (
        <span className={`inline-flex items-center gap-1.5 ${value ? 'text-accent-green' : 'text-zinc-600'}`}>
          <div className={`size-4 rounded border-2 ${value ? 'bg-accent-green border-accent-green' : 'border-zinc-600'}`}>
            {value && <Check className="size-3 text-white" />}
          </div>
          <span className="text-xs">{value ? 'Oui' : 'Non'}</span>
        </span>
      );
    case 'YES_NO':
      return <span className={`badge ${value === true || value === 'true' ? 'badge-success' : 'badge-danger'}`}>{value === true || value === 'true' ? 'Oui' : 'Non'}</span>;
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
      return <a href={String(value)} target="_blank" rel="noopener noreferrer"
        className="text-accent-blue hover:underline truncate block max-w-[200px]" onClick={(e) => e.stopPropagation()}>{String(value)}</a>;
    case 'EMAIL':
      return <a href={`mailto:${value}`}
        className="text-accent-blue hover:underline truncate block max-w-[200px]" onClick={(e) => e.stopPropagation()}>{String(value)}</a>;
    case 'DROPDOWN':
    case 'MULTI_SELECT': {
      const options = Array.isArray(value) ? value : [value];
      return <div className="flex flex-wrap gap-1">{options.filter(Boolean).map((opt: string, i: number) =>
        <span key={i} className="badge bg-zinc-700/50 text-zinc-300">{opt}</span>
      )}</div>;
    }
    case 'IMAGE':
      return value ? <img src={String(value)} alt="" className="size-10 rounded-lg object-cover border border-space-700" /> : null;
    case 'USER':
      return value ? <span className="badge bg-accent-blue/10 text-accent-blue">{String(value)}</span> : null;
    default:
      return <span className="truncate block max-w-[250px]">{String(value)}</span>;
  }
}


