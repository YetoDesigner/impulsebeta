import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Trash2, Edit2, Palette, Save, Upload, Image as ImageIcon } from 'lucide-react';
import { Invoice, InvoiceItem } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface InvoiceFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (invoice: Invoice) => void;
  initialInvoice?: Invoice;
}

const PRESET_GRADIENTS = [
  { from: '#000000', to: '#1a1a1a', text: '#ffffff', accent: '#ffffff' },
  { from: '#1a2a6c', to: '#b21f1f', text: '#ffffff', accent: '#fdbb2d' },
  { from: '#ee0979', to: '#ff6a00', text: '#ffffff', accent: '#ffffff' },
  { from: '#00c6ff', to: '#0072ff', text: '#ffffff', accent: '#ffffff' },
  { from: '#7028e4', to: '#e5b2ca', text: '#ffffff', accent: '#ffffff' },
  { from: '#f8f9fa', to: '#e9ecef', text: '#212529', accent: '#000000' },
];

export default function InvoiceForm({ isOpen, onClose, onSave, initialInvoice }: InvoiceFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<Omit<Invoice, 'id' | 'total' | 'remainingAmount'>>({
    type: 'FACTURA',
    date: new Date().toISOString(),
    companyName: 'ULTRA GRAPHIC',
    nit: '2654254662',
    clientName: '',
    items: [],
    deliveryDate: new Date().toISOString(),
    status: 'ABONO',
    paidAmount: 0,
    logoUrl: undefined,
    gradientFrom: '#000000',
    gradientTo: '#1a1a1a',
    textColor: '#ffffff',
    accentColor: '#ffffff',
  });

  // Local state for the item being added
  const [newItem, setNewItem] = useState<Omit<InvoiceItem, 'id'>>({
    quantity: 1,
    description: '',
    salePrice: 0,
    costPrice: 0,
  });

  useEffect(() => {
    if (initialInvoice) {
      const { id, total, remainingAmount, ...rest } = initialInvoice;
      setFormData(rest);
    } else {
      setFormData(prev => ({
        type: 'FACTURA',
        date: new Date().toISOString(),
        companyName: prev.companyName || 'ULTRA GRAPHIC',
        nit: prev.nit || '2654254662',
        clientName: '',
        items: [],
        deliveryDate: new Date().toISOString(),
        status: 'PENDIENTE',
        paidAmount: 0,
        logoUrl: prev.logoUrl,
        gradientFrom: prev.gradientFrom || '#000000',
        gradientTo: prev.gradientTo || '#1a1a1a',
        textColor: prev.textColor || '#ffffff',
        accentColor: prev.accentColor || '#ffffff',
      }));
      setNewItem({
        quantity: 1,
        description: '',
        salePrice: 0,
        costPrice: 0,
      });
    }
  }, [initialInvoice]);

  const handleAddItem = () => {
    if (!newItem.description) return;
    
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { ...newItem, id: Math.random().toString(36).substr(2, 9) }]
    }));
    
    // Reset new item form
    setNewItem({
      quantity: 1,
      description: '',
      salePrice: 0,
      costPrice: 0,
    });
  };

  const handleRemoveItem = (id: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  const handleEditItem = (item: InvoiceItem) => {
    setNewItem({
      quantity: item.quantity,
      description: item.description,
      salePrice: item.salePrice,
      costPrice: item.costPrice,
    });
    handleRemoveItem(item.id);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const parseNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const normalized = String(val).replace(',', '.');
    return parseFloat(normalized) || 0;
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + (parseNumber(item.quantity) * parseNumber(item.salePrice)), 0);
  };

  const calculateTotalCost = () => {
    return formData.items.reduce((sum, item) => sum + (parseNumber(item.quantity) * parseNumber(item.costPrice)), 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Auto-add current item if it has a description but wasn't added yet
    let finalItems = [...formData.items];
    if (newItem.description && parseNumber(newItem.salePrice) > 0) {
      finalItems.push({ ...newItem, id: Math.random().toString(36).substr(2, 9) });
    }

    if (finalItems.length === 0) {
      alert('Por favor, añade al menos un producto o servicio.');
      return;
    }

    const total = finalItems.reduce((sum, item) => sum + (parseNumber(item.quantity) * parseNumber(item.salePrice)), 0);
    const isPaid = formData.status === 'PAGADO';
    const finalPaidAmount = isPaid ? total : parseNumber(formData.paidAmount);
    
    onSave({
      ...formData,
      items: finalItems,
      id: initialInvoice?.id || Math.random().toString(36).substr(2, 9),
      total,
      paidAmount: finalPaidAmount,
      remainingAmount: isPaid ? 0 : total - finalPaidAmount,
    } as Invoice);
    onClose();
  };

  const currentItemProfit = (parseNumber(newItem.salePrice) - parseNumber(newItem.costPrice)) * parseNumber(newItem.quantity);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="bg-zinc-900 w-full md:max-w-2xl h-[90vh] md:h-auto md:max-h-[90vh] overflow-y-auto rounded-t-[32px] md:rounded-[32px] shadow-2xl p-6 border-t md:border border-zinc-800"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex gap-2">
                {['FACTURA', 'COTIZACIÓN'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: t as any }))}
                    className={cn(
                      "px-4 py-2 rounded-full text-[10px] font-black tracking-widest transition-all border",
                      formData.type === t 
                        ? "bg-white text-black border-white" 
                        : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Logo & Company Section */}
              <div className="flex flex-col gap-6 items-center md:items-start">
                <div className="space-y-2 flex-shrink-0 flex flex-col items-center">
                  <label className="text-[9px] font-black opacity-40 uppercase tracking-widest">Logo Factura</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-2xl bg-zinc-800 border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center cursor-pointer hover:border-white/20 transition-all overflow-hidden"
                  >
                    {formData.logoUrl ? (
                      <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <Upload size={16} className="opacity-30 mb-1" />
                        <span className="text-[7px] font-black opacity-30">SUBIR</span>
                      </>
                    )}
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleLogoUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black opacity-40 uppercase tracking-widest">Empresa</label>
                    <input
                      required
                      type="text"
                      value={formData.companyName}
                      onChange={e => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                      className="w-full bg-zinc-800 border-none rounded-xl p-3 text-xs focus:ring-2 focus:ring-white transition-all outline-none font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black opacity-40 uppercase tracking-widest">NIT</label>
                    <input
                      required
                      type="text"
                      value={formData.nit}
                      onChange={e => setFormData(prev => ({ ...prev, nit: e.target.value }))}
                      className="w-full bg-zinc-800 border-none rounded-xl p-3 text-xs focus:ring-2 focus:ring-white transition-all outline-none font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Client Info */}
              <div className="space-y-2">
                <label className="text-[9px] font-black opacity-40 uppercase tracking-widest">Cliente</label>
                <input
                  required
                  type="text"
                  value={formData.clientName}
                  onChange={e => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                  className="w-full bg-zinc-800 border-none rounded-xl p-3 text-xs focus:ring-2 focus:ring-white transition-all outline-none font-bold"
                  placeholder="Ej: Pedro Quintero"
                />
              </div>

              {/* Items Section */}
              <div className="space-y-3">
                <label className="text-[9px] font-black opacity-40 uppercase tracking-widest">Productos / Servicios</label>
                
                {/* New Item Input Row */}
                <div className="flex flex-col md:flex-row gap-4 bg-zinc-800/30 p-4 rounded-2xl border border-zinc-800/50">
                  <div className="flex gap-2 w-full">
                    <div className="w-16 space-y-1">
                      <label className="text-[8px] opacity-40 font-black">CANT</label>
                      <input
                        type="number"
                        value={newItem.quantity}
                        onChange={e => setNewItem(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                        className="w-full bg-zinc-800 border-none rounded-lg p-2 text-xs outline-none font-bold"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-[8px] opacity-40 font-black">DESCRIPCIÓN</label>
                      <input
                        type="text"
                        value={newItem.description}
                        onChange={e => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full bg-zinc-800 border-none rounded-lg p-2 text-xs outline-none font-bold"
                        placeholder="Ej: Vinilo..."
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 w-full items-end">
                    <div className="flex-1 space-y-1">
                      <label className="text-[8px] opacity-40 font-black uppercase">Precio Venta</label>
                      <input
                        type="number"
                        value={newItem.salePrice || ''}
                        onChange={e => setNewItem(prev => ({ ...prev, salePrice: Number(e.target.value) }))}
                        className="w-full bg-zinc-800 border-none rounded-lg p-2 text-xs outline-none font-bold"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-[8px] opacity-40 font-black uppercase">Precio Real</label>
                      <input
                        type="number"
                        value={newItem.costPrice || ''}
                        onChange={e => setNewItem(prev => ({ ...prev, costPrice: Number(e.target.value) }))}
                        className="w-full bg-zinc-800 border-none rounded-lg p-2 text-xs outline-none font-bold"
                      />
                    </div>
                    <div className="w-20 space-y-1 hidden md:block">
                      <label className="text-[8px] opacity-40 font-black uppercase">Ganancia</label>
                      <div className={cn(
                        "w-full bg-zinc-900/50 rounded-lg p-2 text-[10px] font-black h-[32px] flex items-center justify-center",
                        currentItemProfit >= 0 ? "text-green-500" : "text-red-500"
                      )}>
                        ${currentItemProfit.toLocaleString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="bg-white text-black p-2 rounded-lg hover:scale-105 transition-transform h-[32px] w-[32px] flex items-center justify-center shrink-0"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* Added Items List */}
                <div className="space-y-2 mt-4">
                  {formData.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between bg-zinc-800/50 p-3 rounded-xl border border-zinc-800">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-[10px] font-black opacity-30">{item.quantity}x</span>
                        <span className="text-xs font-bold flex-1">{item.description}</span>
                        <div className="flex gap-4 text-[10px] font-bold">
                          <span className="opacity-40">Venta: ${item.salePrice.toLocaleString()}</span>
                          <span className="text-green-500/60">Ganancia: ${((item.salePrice - item.costPrice) * item.quantity).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditItem(item)}
                          className="ml-4 text-blue-500/50 hover:text-blue-500 transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-red-500/50 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary Row */}
                {formData.items.length > 0 && (
                  <div className="flex justify-end gap-6 px-4 py-2 bg-zinc-900/30 rounded-xl border border-zinc-800/30">
                    <div className="text-right">
                      <p className="text-[7px] font-black opacity-30 uppercase tracking-widest">Costo Total</p>
                      <p className="text-xs font-bold opacity-60">${calculateTotalCost().toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[7px] font-black opacity-30 uppercase tracking-widest">Ganancia Total</p>
                      <p className="text-xs font-black text-green-500">${(calculateTotal() - calculateTotalCost()).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[7px] font-black opacity-30 uppercase tracking-widest">Total Factura</p>
                      <p className="text-sm font-black text-white">${calculateTotal().toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Delivery & Payment */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black opacity-40 uppercase tracking-widest">Entrega</label>
                  <input
                    type="datetime-local"
                    value={formData.deliveryDate ? format(new Date(formData.deliveryDate), "yyyy-MM-dd'T'HH:mm") : ''}
                    onChange={e => {
                      if (e.target.value) {
                        setFormData(prev => ({ ...prev, deliveryDate: new Date(e.target.value).toISOString() }))
                      }
                    }}
                    className="w-full bg-zinc-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-white transition-all outline-none font-bold [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black opacity-40 uppercase tracking-widest">Estado</label>
                  <select
                    value={formData.status}
                    onChange={e => {
                      const newStatus = e.target.value as any;
                      setFormData(prev => ({ 
                        ...prev, 
                        status: newStatus,
                        // If switching to PAGADO, we might want to clear paidAmount or handle it in submit
                      }));
                    }}
                    className="w-full bg-zinc-800 border-none rounded-xl p-3 text-xs focus:ring-2 focus:ring-white transition-all outline-none font-bold appearance-none"
                  >
                    <option value="ABONO">ABONO</option>
                    <option value="PAGADO">PAGADO</option>
                    <option value="PENDIENTE">PENDIENTE</option>
                  </select>
                </div>
                {formData.status !== 'PAGADO' && (
                  <div className="space-y-2">
                    <label className="text-[9px] font-black opacity-40 uppercase tracking-widest">
                      {formData.status === 'ABONO' ? 'Abono (Obligatorio)' : 'Abono'}
                    </label>
                    <input
                      required={formData.status === 'ABONO'}
                      type="number"
                      min={formData.status === 'ABONO' ? 1 : 0}
                      value={formData.paidAmount}
                      onChange={e => setFormData(prev => ({ ...prev, paidAmount: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-zinc-800 border-none rounded-xl p-3 text-xs focus:ring-2 focus:ring-white transition-all outline-none font-bold"
                    />
                  </div>
                )}
              </div>

              {/* Customization Section */}
              <div className="space-y-3 p-4 bg-zinc-800/50 rounded-2xl border border-zinc-800">
                <div className="flex items-center gap-2 mb-1">
                  <Palette size={12} className="opacity-40" />
                  <label className="text-[9px] font-black opacity-40 uppercase tracking-widest">Diseño</label>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {PRESET_GRADIENTS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        gradientFrom: preset.from,
                        gradientTo: preset.to,
                        textColor: preset.text,
                        accentColor: preset.accent
                      }))}
                      className="w-7 h-7 rounded-full border-2 border-white/10 hover:scale-110 transition-transform"
                      style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[7px] font-black opacity-40 uppercase tracking-widest">Inicio</label>
                    <input
                      type="color"
                      value={formData.gradientFrom}
                      onChange={e => setFormData(prev => ({ ...prev, gradientFrom: e.target.value }))}
                      className="w-full h-7 bg-transparent border-none cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[7px] font-black opacity-40 uppercase tracking-widest">Fin</label>
                    <input
                      type="color"
                      value={formData.gradientTo}
                      onChange={e => setFormData(prev => ({ ...prev, gradientTo: e.target.value }))}
                      className="w-full h-7 bg-transparent border-none cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[7px] font-black opacity-40 uppercase tracking-widest">Texto</label>
                    <input
                      type="color"
                      value={formData.textColor}
                      onChange={e => setFormData(prev => ({ ...prev, textColor: e.target.value }))}
                      className="w-full h-7 bg-transparent border-none cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[7px] font-black opacity-40 uppercase tracking-widest">Acento</label>
                    <input
                      type="color"
                      value={formData.accentColor}
                      onChange={e => setFormData(prev => ({ ...prev, accentColor: e.target.value }))}
                      className="w-full h-7 bg-transparent border-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-center pt-2">
                <button
                  type="submit"
                  className="w-full max-w-xs bg-white text-black font-black py-3 rounded-2xl text-sm flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-xl shadow-white/5"
                >
                  <Save size={16} />
                  {initialInvoice ? 'ACTUALIZAR' : 'CREAR DOCUMENTO'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
