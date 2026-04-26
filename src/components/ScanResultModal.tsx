import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, ShoppingCart, Tag, CreditCard, Receipt, Store, Loader2, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { Expense } from '../types';

interface ScanResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Expense) => void;
  scannedData: Partial<Expense> | null;
}

export default function ScanResultModal({ isOpen, onClose, onSave, scannedData }: ScanResultModalProps) {
  const [editedData, setEditedData] = useState<Partial<Expense>>({
    description: '',
    amount: 0,
    category: 'GASTO_OPERATIVO',
    tax: 0,
    products: '',
    vendor: '',
    date: new Date().toISOString()
  });

  useEffect(() => {
    if (scannedData) {
      setEditedData({
        ...editedData,
        ...scannedData,
        date: scannedData.date || new Date().toISOString()
      });
    }
  }, [scannedData]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!editedData.description || !editedData.amount) {
      alert("Por favor completa la descripción y el monto.");
      return;
    }
    
    onSave({
      id: Date.now().toString(),
      date: editedData.date || new Date().toISOString(),
      description: editedData.description || '',
      amount: Number(editedData.amount) || 0,
      category: editedData.category || 'GASTO_OPERATIVO',
      tax: Number(editedData.tax) || 0,
      products: editedData.products || '',
      vendor: editedData.vendor || ''
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Documento Escaneado</h3>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Verifica los datos extraídos por la IA</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
              <X size={20} className="text-zinc-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto scrollbar-hide">
            {/* Vendor / Description */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                <Store size={12} /> Proveedor / Establecimiento
              </label>
              <input
                type="text"
                value={editedData.description}
                onChange={e => setEditedData({ ...editedData, description: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                placeholder="Ej: Amazon, Supermercado..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Amount */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  <CreditCard size={12} /> Monto Total ($)
                </label>
                <input
                  type="number"
                  value={editedData.amount || ''}
                  onChange={e => setEditedData({ ...editedData, amount: Number(e.target.value) })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm font-black text-white focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                />
              </div>

              {/* Tax */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  <Receipt size={12} /> Impuestos / IVA ($)
                </label>
                <input
                  type="number"
                  value={editedData.tax || ''}
                  onChange={e => setEditedData({ ...editedData, tax: Number(e.target.value) })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm font-black text-white focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                <Tag size={12} /> Categoría de Compra
              </label>
              <select
                value={editedData.category}
                onChange={e => setEditedData({ ...editedData, category: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:ring-2 focus:ring-orange-500 transition-all outline-none appearance-none"
              >
                <option value="GASTO_OPERATIVO">Gasto Operativo</option>
                <option value="INVERSION_OPERATIVA">Inversión Operativa</option>
                <option value="NOMINA">Nómina</option>
                <option value="MANTENIMIENTO">Mantenimiento</option>
                <option value="SERVICIOS">Servicios</option>
                <option value="OTROS">Otros</option>
              </select>
            </div>

            {/* Products */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                <ShoppingCart size={12} /> Productos Detallados
              </label>
              <textarea
                value={editedData.products}
                onChange={e => setEditedData({ ...editedData, products: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm font-medium text-zinc-300 focus:ring-2 focus:ring-orange-500 transition-all outline-none min-h-[100px] resize-none scrollbar-hide"
                placeholder="Lista de productos..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-zinc-900/80 border-t border-zinc-800 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-4 rounded-2xl bg-zinc-800 text-white text-xs font-black hover:bg-zinc-700 transition-colors"
            >
              CANCELAR
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-6 py-4 rounded-2xl bg-white text-black text-xs font-black flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors shadow-xl shadow-white/5"
            >
              <Check size={16} />
              GUARDAR GASTO
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
