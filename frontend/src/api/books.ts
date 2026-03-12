import api from './client';
import { Book } from '../types';

export const booksApi = {
  getAll: async (params?: any) => {
    const res = await api.get<Book[]>('/books/', { params });
    return res.data;
  },
  getById: async (id: string) => {
    const res = await api.get<Book>(`/books/${id}`);
    return res.data;
  },
  create: async (data: any) => {
    const res = await api.post<Book>('/books/', data);
    return res.data;
  },
  update: async (id: string, data: any) => {
    const res = await api.put<Book>(`/books/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/books/${id}`);
    return res.data;
  }
};