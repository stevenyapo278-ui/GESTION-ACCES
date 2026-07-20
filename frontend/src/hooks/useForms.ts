import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formsAPI } from '../services/api';
import toast from 'react-hot-toast';

export function useForms(tableId: string | undefined) {
  return useQuery({
    queryKey: ['forms', tableId],
    queryFn: async () => {
      const res = await formsAPI.list(tableId!);
      return res.data as any[];
    },
    enabled: !!tableId,
    staleTime: 30_000,
  });
}

export function useFormSubmissions(formId: string | undefined) {
  return useQuery({
    queryKey: ['form-submissions', formId],
    queryFn: async () => {
      const res = await formsAPI.submissions(formId!);
      return res.data as any[];
    },
    enabled: !!formId,
    staleTime: 60_000,
  });
}

export function useDeleteForm(tableId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formId: string) => formsAPI.delete(formId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['forms', tableId] });
      toast.success('Formulaire supprimé');
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });
}
