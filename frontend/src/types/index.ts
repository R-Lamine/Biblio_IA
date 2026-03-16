export interface User {
  id: string;
  username: string;
  email: string;
  role: 'adherent' | 'bibliothecaire';
  est_bloque: boolean;
  created_at: string;
  active_loans?: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  publication_year?: number;
  category?: string;
  resume_ia?: string;
  cover_image_url?: string;
  shelf_row?: string;
  shelf_number?: string;
  quantity_total: number;
  quantity_available: number;
  created_at: string;
}

export interface Loan {
  id: string;
  book_id: string;
  user_id: string;
  loan_date: string;
  due_date: string;
  return_date?: string;
  status: 'active' | 'returned' | 'overdue';
}

export interface Reservation {
  id: string;
  book_id: string;
  user_id: string;
  reservation_date: string;
  status: 'pending' | 'fulfilled' | 'cancelled';
}

export interface BookAnalysisInfo {
  id: string;
  title: string;
  author: string;
  quantity_available: number;
  quantity_total: number;
  borrow_count: number;
}

export interface ManualAnalysisResponse {
  period_months: number;
  top_borrowed: BookAnalysisInfo[];
  average_borrows: number;
  out_of_stock: BookAnalysisInfo[];
  rarely_borrowed: BookAnalysisInfo[];
  never_borrowed: BookAnalysisInfo[];
  total_books: number;
  total_loans_in_period: number;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}