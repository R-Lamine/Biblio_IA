import api from './client';
import { Loan } from '../types';

export const loansApi = {
  create: async (book_id: string) => {
    const res = await api.post<Loan>(`/loans/?book_id=${book_id}`);
    return res.data;
  },
  getMyLoans: async () => {
    const res = await api.get<Loan[]>('/loans/my');
    return res.data;
  },
  getAll: async (params?: any) => {
    const res = await api.get<Loan[]>('/loans/', { params });
    return res.data;
  },
  returnBook: async (id: string) => {
    const res = await api.put<Loan>(`/loans/${id}/return`);
    return res.data;
  }
};