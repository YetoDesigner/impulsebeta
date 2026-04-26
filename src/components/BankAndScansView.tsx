import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, onSnapshot, deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Trash2, Wallet, Building2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '../lib/utils';

export default function BankAndScansView() {
  const [activeTab, setActiveTab] = useState<'scanned_expenses' | 'scanned_incomes' | 'accounts'>('scanned_incomes');
  const [aiExpenses, setAiExpenses] = useState<any[]>([]);
  const [aiIncomes, setAiIncomes] = useState<any[]>([]);
  const [editCash, setEditCash] = useState<string>('');
  const [editBank, setEditBank] = useState<string>('');

  useEffect(() => {
    if (!auth.currentUser) return;
    const qExp = query(collection(db, `users/${auth.currentUser.uid}/ai_expenses`));
    const unsubExp = onSnapshot(qExp, (snap) => setAiExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qInc = query(collection(db, `users/${auth.currentUser.uid}/ai_incomes`));
    const unsubInc = onSnapshot(qInc, (snap) => setAiIncomes(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qAcc = query(collection(db, `users/${auth.currentUser.uid}/settings`));
    const unsubAcc = onSnapshot(qAcc, (snap) => {
      const data = snap.docs.find(d => d.id === 'accounts')?.data();
      if (data) {
        setEditCash(data.cash || '');
        setEditBank(data.bank || '');
      }
    });

    return () => { unsubExp(); unsubInc(); unsubAcc(); };
  }, []);

  const saveAccounts = async () => {
    if (!auth.currentUser) return;
    await setDoc(doc(db, `users/${auth.currentUser.uid}/settings`, 'accounts'), {
      cash: Number(editCash) || 0,
      bank: Number(editBank) || 0,
      updatedAt: serverTimestamp()
    }, { merge: true });
    alert("Saldos actualizados guardados.");
  };

  const deleteExpense = async (id: string) => {
    if(!window.confirm("¿Eliminar este gasto escaneado?")) return;
    await deleteDoc(doc(db, `users/${auth.currentUser!.uid}/ai_expenses`, id));
  };

  const deleteIncome = async (id: string) => {
    if(!window.confirm("¿Eliminar este ingreso escaneado?")) return;
    await deleteDoc(doc(db, `users/${auth.currentUser!.uid}/ai_incomes`, id));
  };

  return (
    <div className="bg-white dark:bg-zinc-950 min-h-[80vh] rounded-3xl p-4 md:p-8 text-black dark:text-white pb-24">
      <div className="mb-8">
        <h2 className="text-3xl font-black tracking-tight">Finanzas Inteligentes</h2>
        <p className="text-zinc-500 font-bold text-xs mt-1">Registros de escáner AI y saldos manuales.</p>
      </div>

      <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hide pb-2">
        <button onClick={() => setActiveTab('scanned_incomes')} className={cn("px-5 py-3 rounded-xl text-xs font-black tracking-widest uppercase whitespace-nowrap transition-colors", activeTab === 'scanned_incomes' ? "bg-black text-white dark:bg-white dark:text-black" : "bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800")}>
          Transferencias IA
        </button>
        <button onClick={() => setActiveTab('scanned_expenses')} className={cn("px-5 py-3 rounded-xl text-xs font-black tracking-widest uppercase whitespace-nowrap transition-colors", activeTab === 'scanned_expenses' ? "bg-black text-white dark:bg-white dark:text-black" : "bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800")}>
          Facturas Escaneadas
        </button>
        <button onClick={() => setActiveTab('accounts')} className={cn("px-5 py-3 rounded-xl text-xs font-black tracking-widest uppercase whitespace-nowrap transition-colors", activeTab === 'accounts' ? "bg-black text-white dark:bg-white dark:text-black" : "bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800")}>
          Cuentas y Efectivo
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'scanned_incomes' && (
          <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="space-y-4">
            {aiIncomes.length === 0 && <p className="text-center opacity-40 font-bold py-10">No hay transferencias escaneadas.</p>}
            {aiIncomes.map(inc => (
              <div key={inc.id} className="p-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex justify-between items-center group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center shrink-0"><ArrowUpRight size={20}/></div>
                  <div>
                    <h4 className="font-black text-sm">{inc.vendor}</h4>
                    <p className="text-[10px] font-bold text-zinc-500">{new Date(inc.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-lg font-black text-green-500">+${Number(inc.amount).toLocaleString()}</p>
                  <button onClick={() => deleteIncome(inc.id)} className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === 'scanned_expenses' && (
          <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="space-y-4">
            {aiExpenses.length === 0 && <p className="text-center opacity-40 font-bold py-10">No hay facturas escaneadas.</p>}
            {aiExpenses.map(exp => (
              <div key={exp.id} className="p-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex justify-between items-center group">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center shrink-0"><ArrowDownRight size={20}/></div>
                    <div>
                      <h4 className="font-black text-sm">{exp.vendor}</h4>
                      <p className="text-[10px] font-bold text-zinc-500">{new Date(exp.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {exp.products && <p className="text-[11px] font-bold text-zinc-400 max-w-[200px] border-l-2 pl-2 border-zinc-300 dark:border-zinc-700 ml-14 truncate">{exp.products}</p>}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-lg font-black text-red-500">-${Number(exp.amount).toLocaleString()}</p>
                    {exp.taxCalculated > 0 && <p className="text-[9px] font-bold text-orange-500">IVA: ${exp.taxCalculated}</p>}
                  </div>
                  <button onClick={() => deleteExpense(exp.id)} className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === 'accounts' && (
          <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <Wallet className="text-green-500" size={24}/>
                <h3 className="text-lg font-black tracking-tight">Efectivo Disponible</h3>
              </div>
              <input type="number" step="any" value={editCash} onChange={e => setEditCash(e.target.value)} placeholder="0.00" className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-3 rounded-xl text-xl font-black mb-4 outline-none focus:border-green-500" />
            </div>

            <div className="p-6 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <Building2 className="text-blue-500" size={24}/>
                <h3 className="text-lg font-black tracking-tight">Cuentas (Bancos)</h3>
              </div>
              <input type="number" step="any" value={editBank} onChange={e => setEditBank(e.target.value)} placeholder="0.00" className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-3 rounded-xl text-xl font-black mb-4 outline-none focus:border-blue-500" />
            </div>

            <div className="col-span-full">
              <button onClick={saveAccounts} className="w-full py-4 rounded-2xl bg-black text-white dark:bg-white dark:text-black font-black uppercase tracking-widest text-xs active:scale-95 transition-transform shadow-lg">
                Actualizar Saldos
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
