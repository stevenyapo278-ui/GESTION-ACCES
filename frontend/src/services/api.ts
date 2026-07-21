import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// === Auth API ===
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    api.post('/auth/register', data),
  profile: () => api.get('/auth/profile'),
  updateProfile: (data: { firstName?: string; lastName?: string }) =>
    api.put('/auth/profile', data),
};

// === Tables API ===
export const tablesAPI = {
  list: (params?: { search?: string; category?: string }) =>
    api.get('/tables', { params }),
  get: (id: string, params?: { page?: number; pageSize?: number }) =>
    api.get(`/tables/${id}`, { params }),
  create: (data: { name: string; description?: string; icon?: string; color?: string; category?: string }) =>
    api.post('/tables', data),
  update: (id: string, data: any) => api.put(`/tables/${id}`, data),
  delete: (id: string) => api.delete(`/tables/${id}`),
  seedAccessTemplate: () => api.post('/tables/seed-access-template'),
};

// === Columns API ===
export const columnsAPI = {
  create: (data: { tableId: string; name: string; type: string; required?: boolean; options?: string[]; formula?: string }) =>
    api.post('/columns', data),
  update: (id: string, data: any) => api.put(`/columns/${id}`, data),
  delete: (id: string) => api.delete(`/columns/${id}`),
  reorder: (columns: { id: string; order: number }[]) =>
    api.put('/columns/reorder/batch', { columns }),
};

// === Rows API ===
export const rowsAPI = {
  create: (data: { tableId: string; values: Record<string, any> }) =>
    api.post('/rows', data),
  update: (id: string, data: { values: Record<string, any> }) =>
    api.put(`/rows/${id}`, data),
  delete: (id: string) => api.delete(`/rows/${id}`),
  batchCreate: (data: { tableId: string; rows: { values: Record<string, any> }[] }) =>
    api.post('/rows/batch', data),
};

// === Views API ===
export const viewsAPI = {
  create: (data: { tableId: string; name: string; type: string; settings?: any }) =>
    api.post('/views', data),
  update: (id: string, data: any) => api.put(`/views/${id}`, data),
  delete: (id: string) => api.delete(`/views/${id}`),
  updateColumns: (id: string, columns: { columnId: string; order?: number; visible?: boolean; width?: number }[]) =>
    api.put(`/views/${id}/columns`, { columns }),
  updateFilters: (id: string, filters: { columnId: string; operator: string; value?: any; order?: number }[]) =>
    api.put(`/views/${id}/filters`, { filters }),
};

// === Search API ===
export const searchAPI = {
  search: (tableId: string, query: string) =>
    api.get('/search', { params: { tableId, q: query } }),
  advanced: (tableId: string, filters: { columnId: string; operator: string; value?: any }[]) =>
    api.post('/search/advanced', { tableId, filters }),
};

// === Export API ===
function downloadFile(url: string, filename: string) {
  const token = localStorage.getItem('token');
  fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    .then((res) => {
      if (!res.ok) throw new Error('Export failed');
      return res.blob();
    })
    .then((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    })
    .catch(() => {});
}

export const exportAPI = {
  csv: (tableId: string, tableName: string) =>
    downloadFile(`/api/export/${tableId}/csv`, `${tableName}.csv`),
  excel: (tableId: string, tableName: string) =>
    downloadFile(`/api/export/${tableId}/excel`, `${tableName}.xls`),
  pdf: (tableId: string, tableName: string) =>
    downloadFile(`/api/export/${tableId}/pdf`, `${tableName}.pdf`),
};

// === Import API ===
export const importAPI = {
  csv: (tableId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/import/${tableId}/csv`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  createAndImport: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/create-and-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// === Analytics API ===
export const analyticsAPI = {
  dashboard: () => api.get('/analytics/dashboard'),
  table: (tableId: string) => api.get(`/analytics/table/${tableId}`),
};

// === Users API ===
export const usersAPI = {
  list: () => api.get('/users'),
  create: (data: { email: string; password: string; firstName: string; lastName: string; role?: string }) =>
    api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};

// === Upload API ===
export const uploadAPI = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadMultiple: (files: File[]) => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    return api.post('/upload/multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// === Forms API ===
export const formsAPI = {
  list: (tableId: string) => api.get('/forms', { params: { tableId } }),
  get: (id: string) => api.get(`/forms/${id}`),
  create: (data: {
    tableId: string;
    name: string;
    description?: string;
    fields?: any[];
    settings?: any;
    submitLabel?: string;
    successMessage?: string;
  }) => api.post('/forms', data),
  update: (id: string, data: any) => api.put(`/forms/${id}`, data),
  delete: (id: string) => api.delete(`/forms/${id}`),
  regenerateToken: (id: string) => api.post(`/forms/${id}/regenerate-token`),
  submissions: (id: string) => api.get(`/forms/${id}/submissions`),
};

// === Backups API ===
export const backupAPI = {
  list: () => api.get('/backups'),
  get: (id: string) => api.get(`/backups/${id}`),
  create: () => api.post('/backups'),
  download: (id: string, name: string) =>
    downloadFile(`/api/backups/${id}/download`, `${name}.json`),
  delete: (id: string) => api.delete(`/backups/${id}`),
  import: (data: any) => api.post('/backups/import', data),
  getSettings: () => api.get('/backups/settings'),
  updateSettings: (data: any) => api.put('/backups/settings', data),
};

// === Public Form API (no auth) ===
export const publicFormAPI = {
  get: (token: string) => axios.get(`/api/forms/public/${token}`),
  submit: (token: string, data: Record<string, any>) =>
    axios.post(`/api/forms/public/${token}/submit`, { data }),
};

