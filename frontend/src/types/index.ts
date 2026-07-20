// === Enums ===
export type Role = 'ADMIN' | 'EDITOR' | 'READER';

export type ColumnType =
  | 'TEXT'
  | 'LONG_TEXT'
  | 'NUMBER'
  | 'DECIMAL'
  | 'CURRENCY'
  | 'PERCENTAGE'
  | 'DATE'
  | 'TIME'
  | 'DATE_TIME'
  | 'CHECKBOX'
  | 'YES_NO'
  | 'DROPDOWN'
  | 'MULTI_SELECT'
  | 'USER'
  | 'EMAIL'
  | 'PHONE'
  | 'URL'
  | 'IMAGE'
  | 'FILE'
  | 'SIGNATURE'
  | 'LOCATION'
  | 'FORMULA'
  | 'AUTO_CALC';

export type ViewType = 'TABLE' | 'CARDS' | 'CALENDAR' | 'KANBAN' | 'GALLERY';

export type PermissionLevel = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'SHARE';

// === User ===
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  avatar?: string;
  isActive?: boolean;
  createdAt?: string;
}

// === Table ===
export interface Table {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  category?: string;
  createdBy: string;
  creator?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
  createdAt: string;
  updatedAt: string;
  _count?: { columns: number; rows: number };
  columns?: Column[];
  rows?: Row[];
  views?: View[];
}

// === Column ===
export interface Column {
  id: string;
  tableId: string;
  name: string;
  type: ColumnType;
  required: boolean;
  unique: boolean;
  order: number;
  options?: string[];
  formula?: string;
  settings?: Record<string, any>;
}

// === Row ===
export interface Row {
  id: string;
  tableId: string;
  order: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  cellValues: CellValue[];
}

// === Cell Value ===
export interface CellValue {
  id: string;
  rowId: string;
  columnId: string;
  value: any;
  userId?: string;
  assigneeId?: string;
  fileUrl?: string;
}

// === View ===
export interface ViewColumn {
  id: string;
  viewId: string;
  columnId: string;
  order: number;
  visible: boolean;
  width?: number;
  column?: Column;
}

export interface Filter {
  id: string;
  viewId: string;
  columnId: string;
  operator: string;
  value?: any;
  order: number;
  column?: Column;
}

export interface View {
  id: string;
  tableId: string;
  name: string;
  type: ViewType;
  settings?: Record<string, any>;
  isDefault: boolean;
  viewColumns?: ViewColumn[];
  filters?: Filter[];
}

// === Permission ===
export interface Permission {
  id: string;
  tableId: string;
  userId: string;
  level: PermissionLevel;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
}

// === Audit Log ===
export interface AuditLog {
  id: string;
  tableId: string;
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  changes?: any;
  createdAt: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName'>;
  table?: Pick<Table, 'id' | 'name'>;
}

// === Column Type Meta ===
export interface ColumnTypeMeta {
  type: ColumnType;
  label: string;
  icon: string;
  category: 'text' | 'number' | 'date' | 'choice' | 'relation' | 'media' | 'advanced';
}

export const COLUMN_TYPES: ColumnTypeMeta[] = [
  { type: 'TEXT', label: 'Texte', icon: 'Type', category: 'text' },
  { type: 'LONG_TEXT', label: 'Texte long', icon: 'AlignLeft', category: 'text' },
  { type: 'NUMBER', label: 'Nombre', icon: 'Hash', category: 'number' },
  { type: 'DECIMAL', label: 'Décimal', icon: 'Divide', category: 'number' },
  { type: 'CURRENCY', label: 'Devise', icon: 'DollarSign', category: 'number' },
  { type: 'PERCENTAGE', label: 'Pourcentage', icon: 'Percent', category: 'number' },
  { type: 'DATE', label: 'Date', icon: 'Calendar', category: 'date' },
  { type: 'TIME', label: 'Heure', icon: 'Clock', category: 'date' },
  { type: 'DATE_TIME', label: 'Date & Heure', icon: 'CalendarClock', category: 'date' },
  { type: 'CHECKBOX', label: 'Case à cocher', icon: 'CheckSquare', category: 'choice' },
  { type: 'YES_NO', label: 'Oui / Non', icon: 'ToggleLeft', category: 'choice' },
  { type: 'DROPDOWN', label: 'Liste déroulante', icon: 'ChevronDown', category: 'choice' },
  { type: 'MULTI_SELECT', label: 'Choix multiple', icon: 'Tags', category: 'choice' },
  { type: 'USER', label: 'Utilisateur', icon: 'User', category: 'relation' },
  { type: 'EMAIL', label: 'Email', icon: 'Mail', category: 'text' },
  { type: 'PHONE', label: 'Téléphone', icon: 'Phone', category: 'text' },
  { type: 'URL', label: 'URL', icon: 'Link', category: 'text' },
  { type: 'IMAGE', label: 'Image', icon: 'Image', category: 'media' },
  { type: 'FILE', label: 'Fichier', icon: 'File', category: 'media' },
  { type: 'SIGNATURE', label: 'Signature', icon: 'PenTool', category: 'media' },
  { type: 'LOCATION', label: 'Localisation', icon: 'MapPin', category: 'advanced' },
  { type: 'FORMULA', label: 'Formule', icon: 'FunctionSquare', category: 'advanced' },
  { type: 'AUTO_CALC', label: 'Calcul automatique', icon: 'Calculator', category: 'advanced' },
];

// === Dashboard Stats ===
export interface DashboardStats {
  totalTables: number;
  totalRows: number;
  totalUsers: number;
  activeUsers: number;
  userTables: number;
  recentChanges: AuditLog[];
  recentTables: (Table & { _count: { columns: number; rows: number } })[];
}

export interface TableAnalytics {
  totalRows: number;
  totalColumns: number;
  totalViews: number;
  historyCount: number;
  recentActivity: AuditLog[];
}
