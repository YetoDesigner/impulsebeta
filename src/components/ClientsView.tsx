import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, ShoppingBag, AlertCircle, CheckCircle2, ChevronRight, Search, TrendingUp, TrendingDown, Clock, X } from 'lucide-react';
import { Invoice } from '../types';
import { cn } from '../lib/utils';
import InvoiceCard from './InvoiceCard';

interface ClientsViewProps {
  invoices: Invoice[];
  onEditInvoice: (invoice: Invoice) => void;
  onDeleteInvoice?: (id: string) => void;
}

interface ClientStats {
  name: string;
  totalBilled: number;
  totalPending: number;
  invoiceCount: number;
  lastPurchase: string;
  reliability: 'Excelente' | 'Bueno' | 'Regular' | 'Riesgoso';
  invoices: Invoice[];
}

export default function ClientsView({ invoices, onEditInvoice, onDeleteInvoice }: ClientsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  const clientStats = useMemo(() => {
    const groups: Record<string, ClientStats> = {};

    invoices.forEach(inv => {
      let rawName = inv.clientName || 'Sin Nombre';
      const name = rawName.trim().toUpperCase();

      if (!groups[name]) {
        groups[name] = {
          name,
          totalBilled: 0,
          totalPending: 0,
          invoiceCount: 0,
          lastPurchase: inv.date,
          reliability: 'Excelente',
          invoices: [],
        };
      }

      const stats = groups[name];
      const total = Number(inv.total) || 0;
      const pending = Number(inv.remainingAmount) || 0;

      stats.totalBilled += total;
      stats.totalPending += pending;
      stats.invoiceCount += 1;
      stats.invoices.push(inv);
      
      if (new Date(inv.date) > new Date(stats.lastPurchase)) {
        stats.lastPurchase = inv.date;
      }
    });

    // Calculate reliability
    const now = new Date();
    Object.values(groups).forEach(stats => {
      const pendingRatio = stats.totalPending / stats.totalBilled;
      const hasOverdue = stats.invoices.some(inv => 
        inv.status !== 'PAGADO' && new Date(inv.deliveryDate) < now
      );

      if (stats.totalPending === 0) {
        stats.reliability = 'Excelente';
      } else if (pendingRatio < 0.15 && !hasOverdue) {
        stats.reliability = 'Bueno';
      } else if (pendingRatio < 0.4 || hasOverdue) {
        stats.reliability = 'Regular';
      } else {
        stats.reliability = 'Riesgoso';
      }
    });

    return Object.values(groups).sort((a, b) => b.totalBilled - a.totalBilled);
  }, [invoices]);

  const filteredClients = clientStats.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeClient = clientStats.find(c => c.name === selectedClient);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight mb-1">Clientes</h2>
          <p className="text-zinc-500 font-bold text-xs">Análisis de comportamiento y compras de tus clientes.</p>
        </div>
        <div className="w-full md:w-72 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={16} />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-11 pr-5 text-xs focus:ring-2 focus:ring-white transition-all outline-none font-bold"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clients List */}
        <div className={cn(
          "space-y-3",
          selectedClient ? "hidden lg:block lg:col-span-1" : "col-span-full lg:col-span-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 space-y-0"
        )}>
          {filteredClients.map((client) => (
            <motion.button
              layout
              key={client.name}
              onClick={() => setSelectedClient(client.name)}
              className={cn(
                "w-full text-left p-5 rounded-[32px] border transition-all group relative overflow-hidden",
                selectedClient === client.name 
                  ? "bg-white text-black border-white shadow-xl shadow-white/5" 
                  : "bg-zinc-900 text-zinc-100 border-zinc-800 hover:border-zinc-700"
              )}
            >
              <div className="flex justify-between items-start mb-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                  selectedClient === client.name ? "bg-black/5" : "bg-zinc-800"
                )}>
                  <User size={24} className={selectedClient === client.name ? "text-black" : "text-white"} />
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[8px] font-black tracking-widest uppercase",
                  client.reliability === 'Excelente' ? "bg-green-500/20 text-green-500" :
                  client.reliability === 'Bueno' ? "bg-blue-500/20 text-blue-500" :
                  client.reliability === 'Regular' ? "bg-orange-500/20 text-orange-500" :
                  "bg-red-500/20 text-red-500"
                )}>
                  {client.reliability}
                </div>
              </div>

              <h3 className="text-xl font-black tracking-tight mb-1 truncate">{client.name}</h3>
              <p className={cn(
                "text-[10px] font-bold mb-4",
                selectedClient === client.name ? "text-black/60" : "text-zinc-500"
              )}>
                {client.invoiceCount} {client.invoiceCount === 1 ? 'Compra' : 'Compras'} realizadas
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className={cn(
                  "p-3 rounded-2xl",
                  selectedClient === client.name ? "bg-black/5" : "bg-zinc-950/50"
                )}>
                  <p className="text-[7px] font-black opacity-40 uppercase tracking-widest mb-1">Total Compras</p>
                  <p className="text-sm font-black">${client.totalBilled.toLocaleString()}</p>
                </div>
                <div className={cn(
                  "p-3 rounded-2xl",
                  selectedClient === client.name ? "bg-black/5" : "bg-zinc-950/50"
                )}>
                  <p className="text-[7px] font-black opacity-40 uppercase tracking-widest mb-1">Deuda Actual</p>
                  <p className={cn(
                    "text-sm font-black",
                    client.totalPending > 0 ? "text-red-500" : (selectedClient === client.name ? "text-black/40" : "text-zinc-500")
                  )}>
                    ${client.totalPending.toLocaleString()}
                  </p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Client Detail View */}
        <AnimatePresence>
          {selectedClient && activeClient && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="lg:col-span-2 space-y-6"
            >
              <div className="bg-zinc-900 rounded-[40px] p-8 border border-zinc-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6">
                  <button 
                    onClick={() => setSelectedClient(null)}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="flex items-center gap-6 mb-8">
                  <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-2xl">
                    <User size={40} className="text-black" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-3xl font-black tracking-tight">{activeClient.name}</h2>
                      <div className={cn(
                        "px-3 py-1 rounded-full text-[8px] font-black tracking-widest uppercase",
                        activeClient.reliability === 'Excelente' ? "bg-green-500/20 text-green-500" :
                        activeClient.reliability === 'Bueno' ? "bg-blue-500/20 text-blue-500" :
                        activeClient.reliability === 'Regular' ? "bg-orange-500/20 text-orange-500" :
                        "bg-red-500/20 text-red-500"
                      )}>
                        {activeClient.reliability}
                      </div>
                    </div>
                    <p className="text-zinc-500 font-bold text-sm flex items-center gap-2">
                      <Clock size={14} className="opacity-40" />
                      Última compra: {new Date(activeClient.lastPurchase).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <div className="bg-zinc-950/50 p-5 rounded-[32px] border border-zinc-800/50">
                    <div className="flex items-center gap-2 mb-2 opacity-40">
                      <ShoppingBag size={14} />
                      <p className="text-[8px] font-black uppercase tracking-widest">Total Facturado</p>
                    </div>
                    <p className="text-2xl font-black">${activeClient.totalBilled.toLocaleString()}</p>
                  </div>
                  <div className="bg-zinc-950/50 p-5 rounded-[32px] border border-zinc-800/50">
                    <div className="flex items-center gap-2 mb-2 opacity-40">
                      <AlertCircle size={14} />
                      <p className="text-[8px] font-black uppercase tracking-widest">Saldo Pendiente</p>
                    </div>
                    <p className={cn(
                      "text-2xl font-black",
                      activeClient.totalPending > 0 ? "text-red-500" : "text-zinc-500"
                    )}>
                      ${activeClient.totalPending.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-zinc-950/50 p-5 rounded-[32px] border border-zinc-800/50">
                    <div className="flex items-center gap-2 mb-2 opacity-40">
                      <Clock size={14} />
                      <p className="text-[8px] font-black uppercase tracking-widest">Puntualidad</p>
                    </div>
                    <p className={cn(
                      "text-2xl font-black",
                      activeClient.invoices.some(inv => inv.status !== 'PAGADO' && new Date(inv.deliveryDate) < new Date()) 
                        ? "text-orange-500" 
                        : "text-green-500"
                    )}>
                      {activeClient.invoices.some(inv => inv.status !== 'PAGADO' && new Date(inv.deliveryDate) < new Date()) 
                        ? 'Con Retrasos' 
                        : 'Puntual'}
                    </p>
                  </div>
                  <div className="bg-zinc-950/50 p-5 rounded-[32px] border border-zinc-800/50">
                    <div className="flex items-center gap-2 mb-2 opacity-40">
                      <CheckCircle2 size={14} />
                      <p className="text-[8px] font-black uppercase tracking-widest">Estado de Pago</p>
                    </div>
                    <p className={cn(
                      "text-2xl font-black",
                      activeClient.reliability === 'Excelente' ? "text-green-500" : "text-zinc-100"
                    )}>
                      {activeClient.reliability === 'Excelente' ? 'Al Día' : 'Con Pendientes'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest opacity-40 px-2">Historial de Documentos</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeClient.invoices.map(inv => (
                      <InvoiceCard 
                        key={inv.id} 
                        invoice={inv} 
                        onClick={() => onEditInvoice(inv)}
                        onDelete={() => onDeleteInvoice && onDeleteInvoice(inv.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

