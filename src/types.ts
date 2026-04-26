export interface InvoiceItem {
  id: string;
  quantity: number;
  description: string;
  salePrice: number;
  costPrice: number;
}

export interface Invoice {
  id: string;
  type: 'FACTURA' | 'COTIZACIÓN';
  date: string;
  companyName: string;
  nit: string;
  companyPhone?: string;
  companyAddress?: string;
  clientName: string;
  clientPhone?: string;
  clientNit?: string;
  clientAddress?: string;
  items: InvoiceItem[];
  deliveryDate: string;
  status: 'ABONO' | 'PAGADO' | 'PENDIENTE';
  total: number;
  paidAmount: number;
  remainingAmount: number;
  // Customization
  logoUrl?: string;
  gradientFrom: string;
  gradientTo: string;
  textColor: string;
  accentColor: string;
  designType?: 'MODERN' | 'TICKET';
  // Delay Tracking
  delayReason?: 'INTERNO' | 'CLIENTE' | 'PROVEEDOR' | null;
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  tax?: number;
  products?: string;
  vendor?: string;
}

export interface Appointment {
  id: string;
  date: string; // ISO string for the date and time
  clientName: string;
  description: string;
  type: 'VISITA' | 'REUNIÓN' | 'LLAMADA';
}

export type AppView = 'dashboard' | 'clients' | 'stats' | 'pendientes' | 'gastos' | 'tareas' | 'chat';

export interface Task {
  id: string;
  text: string;
  completed: boolean; // Keep for backwards compatibility
  status?: string; // 'POR HACER', 'EN PROCESO', 'COMPLETADO'
  order?: number;
}
