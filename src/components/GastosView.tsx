import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, Plus, Trash2, Building2, Users, Wrench, Zap, MoreHorizontal, TrendingDown, 
  Car, Coffee, Shield, ShoppingCart, Smartphone, PenTool, Briefcase, Activity, Tag, Bookmark,
  Sparkles, Camera, Loader2
} from 'lucide-react';
import { Expense } from '../types';
import { cn } from '../lib/utils';
import { auth, db } from '../firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

const ICON_MAP: Record<string, any> = {
  Building2, TrendingDown, Users, Wrench, Zap, MoreHorizontal,
  Car, Coffee, Shield, ShoppingCart, Smartphone, PenTool, Briefcase, Activity, Tag, Bookmark
};

const DEFAULT_CATEGORIES = [
  { id: 'GASTO_OPERATIVO', label: 'Gastos Operativos', iconName: 'Building2', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'INVERSION_OPERATIVA', label: 'Inversión Operativa', iconName: 'TrendingDown', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  { id: 'NOMINA', label: 'Pago de Nómina', iconName: 'Users', color: 'text-green-500', bg: 'bg-green-500/10' },
  { id: 'MANTENIMIENTO', label: 'Mantenimiento', iconName: 'Wrench', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { id: 'SERVICIOS', label: 'Servicios', iconName: 'Zap', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { id: 'OTROS', label: 'Otros Gastos', iconName: 'MoreHorizontal', color: 'text-zinc-500', bg: 'bg-zinc-500/10' },
];

const COLORS = [
  { text: 'text-red-500', bg: 'bg-red-500/10' },
  { text: 'text-amber-500', bg: 'bg-amber-500/10' },
  { text: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { text: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  { text: 'text-purple-500', bg: 'bg-purple-500/10' },
  { text: 'text-pink-500', bg: 'bg-pink-500/10' },
];

interface CustomCategory {
  id: string;
  label: string;
  iconName: string;
  color: string;
  bg: string;
}

export default function GastosView() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    description: '',
    amount: 0,
    category: 'GASTO_OPERATIVO',
    tax: 0,
    products: '',
    vendor: ''
  });

  const [newCategory, setNewCategory] = useState({
    label: '',
    iconName: 'Tag',
  });

  useEffect(() => {
    if (!auth.currentUser) {
      const savedExp = localStorage.getItem('impulse_expenses');
      if (savedExp) try { setExpenses(JSON.parse(savedExp)); } catch (e) {}
      
      const savedCat = localStorage.getItem('impulse_categories');
      if (savedCat) try { setCustomCategories(JSON.parse(savedCat)); } catch (e) {}
      return;
    }

    const qExp = query(collection(db, `users/${auth.currentUser.uid}/expenses`));
    const unsubExp = onSnapshot(qExp, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ ...doc.data() } as Expense)));
    }, (error) => {
      console.error('GastosView: Firestore expenses error:', error);
    });

    const qCat = query(collection(db, `users/${auth.currentUser.uid}/categories`));
    const unsubCat = onSnapshot(qCat, (snapshot) => {
      setCustomCategories(snapshot.docs.map(doc => ({ ...doc.data() } as CustomCategory)));
    }, (error) => {
      console.error('GastosView: Firestore categories error:', error);
    });

    return () => { unsubExp(); unsubCat(); };
  }, []);

  const saveExpToLocal = (newExpenses: Expense[]) => localStorage.setItem('impulse_expenses', JSON.stringify(newExpenses));
  const saveCatToLocal = (cats: CustomCategory[]) => localStorage.setItem('impulse_categories', JSON.stringify(cats));

  const ALL_CATEGORIES = [...DEFAULT_CATEGORIES, ...customCategories];

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.description || !newExpense.amount) return;

    const expense: Expense = {
      id: Date.now().toString(),
      date: newExpense.date || new Date().toISOString(),
      description: newExpense.description,
      amount: Number(newExpense.amount),
      category: newExpense.category as string,
      tax: Number(newExpense.tax) || 0,
      products: newExpense.products || '',
      vendor: newExpense.vendor || '',
    };

    if (auth.currentUser && auth.currentUser.uid !== 'local-user') {
      try {
        await setDoc(doc(db, `users/${auth.currentUser.uid}/expenses`, expense.id), {
          ...expense,
          createdAt: serverTimestamp()
        });
      } catch (e: any) {
        console.error("Firebase Error (Expense):", e);
        alert(`Error al guardar en la nube: ${e.message}\nAsegurate de haber actualizado las reglas de Firestore.`);
      }
    } else {
      const updated = [expense, ...expenses];
      setExpenses(updated);
      saveExpToLocal(updated);
    }
    
    setNewExpense({ description: '', amount: 0, category: 'GASTO_OPERATIVO', tax: 0, products: '', vendor: '' });
    setIsFormOpen(false);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.label) return;

    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    const cat: CustomCategory = {
      id: `CAT_${Date.now()}`,
      label: newCategory.label,
      iconName: newCategory.iconName,
      color: randomColor.text,
      bg: randomColor.bg,
    };

    if (auth.currentUser && auth.currentUser.uid !== 'local-user') {
      try {
        await setDoc(doc(db, `users/${auth.currentUser.uid}/categories`, cat.id), {
          ...cat,
          createdAt: serverTimestamp()
        });
      } catch (e: any) {
        console.error("Firebase Error (Category):", e);
        alert(`Error al guardar en la nube: ${e.message}\nAsegurate de haber actualizado las reglas de Firestore.`);
      }
    } else {
      const updated = [...customCategories, cat];
      setCustomCategories(updated);
      saveCatToLocal(updated);
    }
    
    setNewCategory({ label: '', iconName: 'Tag' });
    setIsCategoryFormOpen(false);
    // Auto-select the newly created category
    setNewExpense(prev => ({ ...prev, category: cat.id }));
  };

  const handleDelete = async (id: string) => {
    if (auth.currentUser && auth.currentUser.uid !== 'local-user') {
      try {
        await deleteDoc(doc(db, `users/${auth.currentUser.uid}/expenses`, id));
      } catch (e: any) {
        console.error("Firebase Error (Delete Expense):", e);
        alert(`Error al eliminar en la nube: ${e.message}\nAsegurate de haber actualizado las reglas de Firestore.`);
      }
    } else {
      const updated = expenses.filter(e => e.id !== id);
      setExpenses(updated);
      saveExpToLocal(updated);
    }
  };

  const stats = useMemo(() => {
    const total = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const byCategory = expenses.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + Number(curr.amount);
      return acc;
    }, {} as Record<string, number>);
    return { total, byCategory };
  }, [expenses]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight mb-1">Gastos e Inversiones</h2>
          <p className="text-zinc-500 font-bold text-xs">Registra operaciones, inversiones y nómina.</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="bg-white text-black px-6 py-3 rounded-2xl text-xs font-black flex items-center gap-2 hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5"
        >
          <Plus size={16} />
          Nuevo Registro
        </button>
      </div>

      {/* Stats Cards */}
      <div className="bg-zinc-900 rounded-[32px] p-6 border border-zinc-800 shadow-xl overflow-hidden relative">
         <div className="absolute top-0 right-0 p-8 opacity-5">
           <Wallet size={120} />
         </div>
         <p className="text-[10px] font-black opacity-50 uppercase tracking-[0.2em] mb-2">Total Egresos</p>
         <h3 className="text-4xl font-black text-white">${stats.total.toLocaleString()}</h3>
         
         <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
           {ALL_CATEGORIES.map(cat => {
             const Icon = ICON_MAP[cat.iconName] || Tag;
             return (
               <div key={cat.id} className="bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800/50">
                 <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mb-3", cat.bg, cat.color)}>
                   <Icon size={14} />
                 </div>
                 <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest leading-tight mb-1">{cat.label}</p>
                 <p className="text-sm font-black">${(stats.byCategory[cat.id] || 0).toLocaleString()}</p>
               </div>
             )
           })}
         </div>
      </div>

      {/* List */}
      <div className="bg-zinc-900 rounded-[32px] border border-zinc-800 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
           <h3 className="text-sm font-black uppercase tracking-widest">Historial de Registros</h3>
        </div>
        
        {expenses.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs font-bold">
            No hay gastos registrados aún.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {expenses.sort((a,b) => {
              const dateA = a.date ? new Date(a.date).getTime() : 0;
              const dateB = b.date ? new Date(b.date).getTime() : 0;
              return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
            }).map(exp => {
              const catData = ALL_CATEGORIES.find(c => c.id === exp.category) || ALL_CATEGORIES[ALL_CATEGORIES.length - 1];
              const Icon = ICON_MAP[catData.iconName] || Tag;
              return (
                <div key={exp.id} className="p-5 flex items-center justify-between hover:bg-zinc-800/50 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", catData.bg, catData.color)}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-black mb-0.5">{exp.description}</p>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        <span>{new Date(exp.date).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{catData.label}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-lg font-black">${Number(exp.amount).toLocaleString()}</p>
                    <button 
                      onClick={() => handleDelete(exp.id)}
                      className="w-8 h-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Expense Form Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsFormOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 shadow-2xl overflow-y-auto max-h-[90vh] scrollbar-hide">
              
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black">Registrar Gasto</h3>
              </div>
              
              <form onSubmit={handleAddExpense} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Descripción</label>
                  <input type="text" required value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-white transition-colors outline-none" placeholder="Ej. Pago de Internet" />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Monto ($)</label>
                  <input type="number" required min="0" value={newExpense.amount || ''} onChange={e => setNewExpense({...newExpense, amount: Number(e.target.value)})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-white transition-colors outline-none" placeholder="0" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Impuestos ($)</label>
                    <input type="number" min="0" value={newExpense.tax || ''} onChange={e => setNewExpense({...newExpense, tax: Number(e.target.value)})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-white transition-colors outline-none" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Proveedor</label>
                    <input type="text" value={newExpense.vendor || ''} onChange={e => setNewExpense({...newExpense, vendor: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-white transition-colors outline-none" placeholder="Opcional" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Productos / Detalle</label>
                  <textarea value={newExpense.products || ''} onChange={e => setNewExpense({...newExpense, products: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-white transition-colors outline-none min-h-[80px] resize-none" placeholder="Lista de productos..." />
                </div>

                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Categoría</label>
                    <button type="button" onClick={() => setIsCategoryFormOpen(true)} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest flex items-center gap-1">
                      <Plus size={10} /> Añadir Nueva
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_CATEGORIES.map(cat => {
                      const Icon = ICON_MAP[cat.iconName] || Tag;
                      return (
                        <button key={cat.id} type="button" onClick={() => setNewExpense({...newExpense, category: cat.id})} className={cn("p-3 rounded-xl border text-left flex items-center gap-3 transition-colors", newExpense.category === cat.id ? "bg-white text-black border-white" : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700")}>
                          <Icon size={16} />
                          <span className="text-[9px] font-black uppercase tracking-widest truncate">{cat.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-3 bg-zinc-800 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors hover:bg-zinc-700">Cancelar</button>
                  <button type="submit" className="flex-1 py-3 bg-white text-black rounded-xl text-xs font-black uppercase tracking-widest transition-colors hover:scale-[0.98] active:scale-[0.95]">Guardar</button>
                </div>
              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Category Modal */}
      <AnimatePresence>
        {isCategoryFormOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCategoryFormOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 shadow-2xl">
              
              <h3 className="text-xl font-black mb-6">Nueva Categoría</h3>
              
              <form onSubmit={handleAddCategory} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Nombre de Categoria</label>
                  <input type="text" required value={newCategory.label} onChange={e => setNewCategory({...newCategory, label: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-white transition-colors outline-none" placeholder="Ej. Comida" />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Elige un Icono</label>
                  <div className="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto scrollbar-hide pr-1">
                    {Object.keys(ICON_MAP).map(key => {
                      const Icon = ICON_MAP[key];
                      return (
                        <button key={key} type="button" onClick={() => setNewCategory({...newCategory, iconName: key})} className={cn("aspect-square rounded-xl flex items-center justify-center transition-colors border", newCategory.iconName === key ? "bg-white text-black border-white" : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-700")}>
                          <Icon size={18} />
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsCategoryFormOpen(false)} className="flex-1 py-3 bg-zinc-800 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors hover:bg-zinc-700">Atrás</button>
                  <button type="submit" className="flex-1 py-3 bg-white text-black rounded-xl text-xs font-black uppercase tracking-widest transition-colors hover:scale-[0.98] active:scale-[0.95]">Crear</button>
                </div>
              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
