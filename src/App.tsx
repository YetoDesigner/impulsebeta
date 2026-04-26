import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Filter, Settings, LogOut, ChevronRight, User as UserIcon, LayoutGrid, List as ListIcon, TrendingUp, Mail, Moon, Sun, Clock, Wallet, Calendar, CheckCircle2 } from 'lucide-react';
import { Invoice, AppView } from './types';
import InvoiceCard from './components/InvoiceCard';
import InvoiceForm from './components/InvoiceForm';
import ClientsView from './components/ClientsView';
import PendientesView from './components/PendientesView';
import GastosView from './components/GastosView';
import TasksView from './components/TasksView';
import ChatView from './components/ChatView';
import { cn } from './lib/utils';
import { auth, db, signInWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, writeBatch, serverTimestamp, getDocFromServer } from 'firebase/firestore';



const STORAGE_KEY = 'impulse_negocios_invoices';
const APP_LOGO_URL = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgn2on7GUzVrK26XTBTK9SMAElmdSsJ_jHIXHAZn7rIGtbDhYqfr4Q-5oTVo7zlfCLSSu37wZ7Fu7Dj7bOP35NthPBZH1gWtlPGRpddxNBj8Vbb9htG3tPn1uEXtMfkrrKVd5CngTzk7YfWfqoZ23d3NZRoexwit1RxhyhqfBorCR6FtGO_9mIpzHoSYKsu/s1758/SDFAFD12E21223R23223.png";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]); // Track expenses for stats
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ABONO' | 'PAGADO' | 'COTIZACIÓN'>('ALL');
  const [activeTab, setActiveTab] = useState<AppView>(window.innerWidth < 768 ? 'chat' : 'dashboard');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem('impulse_guest') === 'true');

  // Load initial theme
  useEffect(() => {
    const saved = localStorage.getItem('impulse_theme') as 'light' | 'dark';
    if (saved) {
      setTheme(saved);
      document.documentElement.classList.toggle('dark', saved === 'dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('impulse_theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  // Connection Test
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    };
    testConnection();
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthLoading(false);
      if (user) {
        migrateLocalData(user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore Sync
  useEffect(() => {
    // Load from localStorage first to prevent empty screen if offline or slow
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) setInvoices(parsed);
      } catch (e) {
        console.error('Error loading invoices', e);
      }
    }

    if (!user) {
      return;
    }

    const path = `users/${user.uid}/invoices`;
    const q = query(collection(db, path));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ ...doc.data() } as Invoice));
      setInvoices(docs);
      // Keep local backup
      localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    // Listen to expenses as well
    const expQ = query(collection(db, `users/${user.uid}/expenses`));
    const unsubExp = onSnapshot(expQ, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ ...doc.data() }));
      setExpenses(docs);
      localStorage.setItem('impulse_expenses', JSON.stringify(docs));
    });

    return () => {
      unsubscribe();
      unsubExp();
    };
  }, [user]);

  const migrateLocalData = async (userId: string) => {
    const invoicesSaved = localStorage.getItem(STORAGE_KEY);
    const tasksSaved = localStorage.getItem('impulse_tasks');
    const appointmentsSaved = localStorage.getItem('impulse_appointments');
    
    // Prevent double migration if previously successful
    if (localStorage.getItem(STORAGE_KEY + '_migrated') === 'true') return;

    try {
      const batch = writeBatch(db);
      
      // Migrate Invoices
      if (invoicesSaved) {
        const localInvoices: Invoice[] = JSON.parse(invoicesSaved);
        localInvoices.forEach(inv => {
          const docRef = doc(db, `users/${userId}/invoices`, inv.id);
          batch.set(docRef, {
            ...inv,
            updatedAt: serverTimestamp()
          }, { merge: true });
        });
      }

      // Migrate Tasks
      if (tasksSaved) {
        const localTasks = JSON.parse(tasksSaved);
        localTasks.forEach((task: any) => {
          const docRef = doc(db, `users/${userId}/tasks`, task.id);
          batch.set(docRef, task, { merge: true });
        });
      }

      // Migrate Appointments
      if (appointmentsSaved) {
        const localAppointments = JSON.parse(appointmentsSaved);
        localAppointments.forEach((app: any) => {
          const docRef = doc(db, `users/${userId}/appointments`, app.id);
          batch.set(docRef, app, { merge: true });
        });
      }

      await batch.commit();
      localStorage.setItem(STORAGE_KEY + '_migrated', 'true');
      console.log('Data migrated to Firebase');
    } catch (e) {
      console.error('Error migrating data', e);
    }
  };

  const handleSaveInvoice = async (invoice: Invoice) => {
    if (user) {
      const path = `users/${user.uid}/invoices`;
      try {
        const docRef = doc(db, path, invoice.id);
        await setDoc(docRef, {
          ...invoice,
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, path);
      }
    } else {
      if (editingInvoice) {
        setInvoices(prev => {
          const updated = prev.map(inv => inv.id === invoice.id ? invoice : inv);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
      } else {
        setInvoices(prev => {
          const updated = [invoice, ...prev];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
      }
    }
    setEditingInvoice(undefined);
    setIsFormOpen(false);
  };

  const handleUpdateInvoice = async (id: string, updates: Partial<Invoice>) => {
    if (user) {
      const path = `users/${user.uid}/invoices`;
      try {
        await setDoc(doc(db, path, id), { ...updates, updatedAt: serverTimestamp() }, { merge: true });
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, path);
      }
    } else {
      setInvoices(prev => {
        const updated = prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (user) {
      const path = `users/${user.uid}/invoices`;
      try {
        await deleteDoc(doc(db, path, id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, path);
      }
    } else {
      setInvoices(prev => {
        const updated = prev.filter(inv => inv.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    }
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setIsFormOpen(true);
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const clientName = inv.clientName || '';
      const id = inv.id || '';
      const matchesSearch = clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = activeFilter === 'ALL' 
        ? true 
        : activeFilter === 'COTIZACIÓN' 
          ? inv.type === 'COTIZACIÓN' 
          : inv.status === activeFilter && inv.type === 'FACTURA';

      return matchesSearch && matchesFilter;
    });
  }, [invoices, searchQuery, activeFilter]);

  const stats = useMemo(() => {
    const invoicesStats = invoices.reduce((acc, inv) => {
      const items = inv.items || [];
      const total = items.reduce((sum, item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.salePrice) || 0;
        return sum + (qty * price);
      }, 0);

      if (inv.type === 'COTIZACIÓN') {
        acc.totalQuotations += total;
        return acc;
      }
      
      const remaining = Number(inv.remainingAmount) || 0;
      const status = inv.status;
      
      const invoiceProfit = items.reduce((sum, item) => {
        const sale = Number(item.salePrice) || 0;
        const cost = Number(item.costPrice) || 0;
        const qty = Number(item.quantity) || 0;
        return sum + (qty * (sale - cost));
      }, 0);

      const invoiceCost = items.reduce((sum, item) => {
        const cost = Number(item.costPrice) || 0;
        const qty = Number(item.quantity) || 0;
        return sum + (qty * cost);
      }, 0);

      acc.totalBilled += total;
      const isPaid = status === 'PAGADO';
      const advanceValue = isPaid ? total : (total - remaining);
      acc.totalAdvances += advanceValue;

      if (isPaid) {
        acc.totalProfit += invoiceProfit;
      }
      acc.totalCost += invoiceCost;
      if (!isPaid) {
        acc.totalPending += remaining;
      }
      
      return acc;
    }, { totalBilled: 0, totalProfit: 0, totalPending: 0, totalCost: 0, totalQuotations: 0, totalAdvances: 0 });

    const totalExpenses = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

    // Generar datos para el gráfico de evolución (combinando ingresos y gastos por fecha)
    const evolutionData: any[] = [];
    const datesMap = new Map<string, { income: number, expense: number }>();

    // Procesar ingresos (facturas pagadas o abonos)
    invoices.forEach(inv => {
      if (inv.type === 'FACTURA' && (inv.status === 'PAGADO' || inv.status === 'ABONO')) {
        const date = new Date(inv.date).toISOString().split('T')[0]; // YYYY-MM-DD
        const amount = inv.status === 'PAGADO' 
          ? inv.items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.salePrice) || 0)), 0)
          : (inv.items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.salePrice) || 0)), 0) - (Number(inv.remainingAmount) || 0));
        
        if (amount > 0) {
          const current = datesMap.get(date) || { income: 0, expense: 0 };
          datesMap.set(date, { ...current, income: current.income + amount });
        }
      }
    });

    // Procesar gastos
    expenses.forEach(exp => {
      if (exp.date) {
        const date = new Date(exp.date).toISOString().split('T')[0];
        const amount = Number(exp.amount) || 0;
        if (amount > 0) {
          const current = datesMap.get(date) || { income: 0, expense: 0 };
          datesMap.set(date, { ...current, expense: current.expense + amount });
        }
      }
    });

    // Convertir el mapa a un array ordenado por fecha
    Array.from(datesMap.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .forEach(([date, values]) => {
        // Formatear la fecha para mostrar (ej: "03 Abr")
        const dateObj = new Date(date);
        const formattedDate = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        
        evolutionData.push({
          date: formattedDate,
          fullDate: date,
          Ingresos: values.income,
          Gastos: values.expense
        });
      });

    // Si no hay suficientes datos, rellenar con algunos días vacíos
    if (evolutionData.length === 0) {
      const today = new Date();
      for (let i = 4; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        evolutionData.push({
          date: d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
          Ingresos: 0,
          Gastos: 0
        });
      }
    } else if (evolutionData.length === 1) {
      // Agregar un día anterior vacío para que se vea una línea
      const firstDate = new Date(evolutionData[0].fullDate);
      firstDate.setDate(firstDate.getDate() - 1);
      evolutionData.unshift({
        date: firstDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        Ingresos: 0,
        Gastos: 0
      });
    }

    return { ...invoicesStats, totalExpenses, evolutionData };
  }, [invoices, expenses]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full"
        />
      </div>
    );
  }

  if (!user && !isGuest) {
    return (
      <div className="min-h-screen bg-zinc-950 relative flex items-center justify-center overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=1920" 
            alt="Background" 
            className="w-full h-full object-cover opacity-20"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-xs px-6 flex flex-col items-center"
        >
          <div className="mb-8 flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-white rounded-[28px] flex items-center justify-center overflow-hidden shadow-2xl shadow-white/10">
              <img src={APP_LOGO_URL} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-white">
              Impulse <span className="text-orange-500">Ultra</span>
            </h1>
          </div>

          <button 
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-4 py-4 bg-white text-black rounded-[24px] text-sm font-black transition-all hover:bg-zinc-200 active:scale-95 shadow-xl shadow-white/5"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Continuar con Google
          </button>

          <button 
            onClick={() => {
              setIsGuest(true);
              localStorage.setItem('impulse_guest', 'true');
            }}
            className="w-full mt-4 flex items-center justify-center gap-4 py-4 bg-zinc-900 text-white rounded-[24px] text-sm font-black transition-all hover:bg-zinc-800 active:scale-95 shadow-xl shadow-black/20 border border-zinc-800"
          >
            Continuar sin cuenta
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row">
      {/* Sidebar - Desktop Only */}
      <aside className="hidden md:flex w-56 bg-zinc-900 border-r border-zinc-800 flex-col p-5 fixed h-full z-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center overflow-hidden">
            <img src={APP_LOGO_URL} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <h1 className="text-lg font-black tracking-tighter text-white">
            Impulse <span className="text-orange-500">Ultra</span>
          </h1>
        </div>

        <nav className="flex-1 space-y-4">
          <div className="space-y-1">
            <p className="text-[8px] font-black opacity-30 tracking-widest uppercase mb-3 px-3">Principal</p>
            <button 
              onClick={() => setActiveTab('chat')}
              className={cn(
                "w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-black transition-all",
                activeTab === 'chat' 
                  ? "bg-white text-black shadow-lg shadow-white/5" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              <LayoutGrid size={16} /> Chat Bot
            </button>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-black transition-all",
                activeTab === 'dashboard' 
                  ? "bg-white text-black shadow-lg shadow-white/5" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              <LayoutGrid size={16} /> Panel
            </button>
            <button 
              onClick={() => {
                setEditingInvoice(undefined);
                setIsFormOpen(true);
              }}
              className="w-full flex items-center gap-3 p-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl text-xs font-black transition-all"
            >
              <Plus size={16} /> Nuevo Pedido
            </button>
            <button 
              onClick={() => setActiveTab('clients')}
              className={cn(
                "w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-black transition-all",
                activeTab === 'clients' 
                  ? "bg-white text-black shadow-lg shadow-white/5" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              <UserIcon size={16} /> Clientes
            </button>
            <button 
              onClick={() => setActiveTab('pendientes')}
              className={cn(
                "w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-black transition-all",
                activeTab === 'pendientes' 
                  ? "bg-white text-black shadow-lg shadow-white/5" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              <Clock size={16} /> Pendientes
            </button>
            <button 
              onClick={() => setActiveTab('gastos')}
              className={cn(
                "w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-black transition-all",
                activeTab === 'gastos' 
                  ? "bg-white text-black shadow-lg shadow-white/5" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              <Wallet size={16} /> Gastos
            </button>
            <button 
              onClick={() => setActiveTab('tareas')}
              className={cn(
                "w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-black transition-all",
                activeTab === 'tareas' 
                  ? "bg-white text-black shadow-lg shadow-white/5" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              <CheckCircle2 size={16} /> Tareas
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className={cn(
                "w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-black transition-all",
                showSettings ? "bg-white text-black shadow-lg shadow-white/5" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              <Settings size={16} /> Ajustes
            </button>
          </div>
        </nav>

        <div className="pt-6 border-t border-zinc-800">
          {!user ? (
            <button 
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 p-3 bg-white text-black rounded-xl text-xs font-black transition-all hover:bg-zinc-200"
            >
              Iniciar con Google
            </button>
          ) : (
            <div className="space-y-2">
              <button 
                onClick={() => setShowLogoutConfirm(!showLogoutConfirm)}
                className="w-full flex items-center gap-3 p-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl text-xs font-black transition-all overflow-hidden"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="User" className="w-5 h-5 rounded-[6px] shrink-0 object-cover" />
                ) : (
                  <Mail size={16} className="shrink-0" />
                )}
                <span className="truncate">{user.email}</span>
              </button>
              
              <AnimatePresence>
                {showLogoutConfirm && (
                  <motion.button
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    onClick={logout}
                    className="w-full flex items-center gap-3 p-2.5 text-red-500 bg-red-500/5 hover:bg-red-500/10 rounded-xl text-xs font-black transition-all"
                  >
                    <LogOut size={16} /> Salir
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 md:ml-56 p-5 md:p-8 md:pb-10",
        activeTab === 'chat' ? "pb-5 h-screen overflow-hidden" : "pb-32"
      )}>
        {/* Header Mobile */}
        <header className="md:hidden flex justify-between items-center mb-6 relative z-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center overflow-hidden">
              <img src={APP_LOGO_URL} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <h1 className="text-lg font-black tracking-tighter">
              Impulse <span className="text-orange-500">Ultra</span>
            </h1>
          </div>
          
          {user && (
            <div className="relative">
              <button 
                onClick={() => setShowLogoutConfirm(!showLogoutConfirm)}
                className="w-10 h-10 rounded-full border-2 border-zinc-800 flex items-center justify-center bg-zinc-900 overflow-hidden active:scale-95 transition-transform"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <Mail size={16} className="text-zinc-400" />
                )}
              </button>
              
              <AnimatePresence>
                {showLogoutConfirm && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowLogoutConfirm(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute right-0 top-12 bg-zinc-900 border border-zinc-800 rounded-3xl p-2 min-w-[220px] shadow-2xl z-50 origin-top-right overflow-hidden"
                    >
                      <div className="px-4 py-3 mb-1 border-b border-zinc-800/50 bg-zinc-950/30 rounded-2xl">
                        <p className="font-bold text-xs truncate text-white mb-0.5">{user.displayName || 'Usuario Actual'}</p>
                        <p className="text-[10px] text-zinc-500 font-bold truncate">{user.email}</p>
                      </div>
                      <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 p-3 text-red-500 bg-red-500/5 hover:bg-red-500/10 rounded-2xl text-xs font-black transition-all"
                      >
                        <LogOut size={16} /> Salir y cerrar cuenta
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
        </header>

        {activeTab === 'dashboard' ? (
          <>
            {/* Desktop Title & Stats */}
            <div className="hidden md:flex justify-between items-end mb-8">
              <div>
                <h2 className="text-3xl font-black tracking-tight mb-1">Facturas</h2>
                <p className="text-zinc-500 font-bold text-xs">Gestiona tus ingresos y abonos de forma eficiente.</p>
              </div>
              <div className="flex gap-3">
                <div className="bg-zinc-900 p-3 rounded-2xl border border-zinc-800 min-w-[120px]">
                  <p className="text-[8px] font-black opacity-30 tracking-widest uppercase mb-1">Total Facturado</p>
                  <p className="text-lg font-black">${stats.totalBilled.toLocaleString()}</p>
                </div>
                <div className="bg-zinc-900 p-3 rounded-2xl border border-zinc-800 min-w-[120px]">
                  <p className="text-[8px] font-black opacity-30 tracking-widest uppercase mb-1">Costo Total</p>
                  <p className="text-lg font-black text-zinc-400">${stats.totalCost.toLocaleString()}</p>
                </div>
                <div className="bg-zinc-900 p-3 rounded-2xl border border-zinc-800 min-w-[120px]">
                  <p className="text-[8px] font-black opacity-30 tracking-widest uppercase mb-1">Abonos</p>
                  <p className="text-lg font-black text-orange-500">${stats.totalAdvances.toLocaleString()}</p>
                </div>
                <div className="bg-zinc-900 p-3 rounded-2xl border border-zinc-800 min-w-[120px]">
                  <p className="text-[8px] font-black opacity-30 tracking-widest uppercase mb-1">Gastos</p>
                  <p className="text-lg font-black text-red-500">${stats.totalExpenses.toLocaleString()}</p>
                </div>
                <div className="bg-zinc-900 p-3 rounded-2xl border border-zinc-800 min-w-[120px]">
                  <p className="text-[8px] font-black opacity-30 tracking-widest uppercase mb-1">Ganancias</p>
                  <p className="text-lg font-black text-green-500">${stats.totalProfit.toLocaleString()}</p>
                </div>
                <div className="bg-zinc-900 p-3 rounded-2xl border border-zinc-800 min-w-[120px]">
                  <p className="text-[8px] font-black opacity-30 tracking-widest uppercase mb-1">Cotizaciones</p>
                  <p className="text-lg font-black text-blue-500">${stats.totalQuotations.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-3 mb-6">
              <div className="flex-1 relative hidden md:block">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={16} />
                <input
                  type="text"
                  placeholder="Buscar por cliente o ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-3 pl-11 pr-5 text-xs focus:ring-2 focus:ring-white transition-all outline-none font-bold"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide hidden md:flex">
                {['TODO', 'ABONO', 'PAGADO', 'COTIZACIONES'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      if (filter === 'TODO') setActiveFilter('ALL');
                      else if (filter === 'COTIZACIONES') setActiveFilter('COTIZACIÓN');
                      else setActiveFilter(filter as any);
                    }}
                    className={cn(
                      "px-4 py-2.5 rounded-xl font-black text-[9px] tracking-widest transition-all whitespace-nowrap border",
                      (activeFilter === 'ALL' ? 'TODO' : activeFilter === 'COTIZACIÓN' ? 'COTIZACIONES' : activeFilter) === filter 
                        ? "bg-white text-black border-white shadow-lg shadow-white/5" 
                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                    )}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid / List */}
            <div className={cn(
              "gap-5",
              viewMode === 'grid' ? "columns-1 lg:columns-2 xl:columns-3" : "grid grid-cols-1"
            )}>
              <AnimatePresence mode="popLayout">
                {filteredInvoices.map((invoice) => (
                  <div key={invoice.id} className={cn("break-inside-avoid", viewMode === 'grid' ? "mb-5" : "")}>
                    <InvoiceCard
                      invoice={invoice}
                      onClick={() => handleEdit(invoice)}
                      onDelete={() => handleDeleteInvoice(invoice.id)}
                    />
                  </div>
                ))}
              </AnimatePresence>

              {filteredInvoices.length === 0 && (
                <div className="col-span-full py-16 text-center">
                  <div className="w-14 h-14 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-800">
                    <Search size={20} className="opacity-20" />
                  </div>
                  <h3 className="text-base font-black opacity-40">No se encontraron facturas</h3>
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'clients' ? (
          <ClientsView 
            invoices={invoices} 
            onEditInvoice={handleEdit} 
            onDeleteInvoice={handleDeleteInvoice}
          />
        ) : activeTab === 'pendientes' ? (
          <PendientesView 
            invoices={invoices} 
            onEditInvoice={handleEdit} 
            onUpdateInvoice={handleUpdateInvoice}
            onDeleteInvoice={handleDeleteInvoice}
          />
        ) : activeTab === 'gastos' ? (
          <GastosView />
        ) : activeTab === 'tareas' ? (
          <TasksView />
        ) : activeTab === 'chat' ? (
          <ChatView onNavigate={(view) => setActiveTab(view)} />
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-end mb-2">
              <div>
                <h2 className="text-xl font-black tracking-tight">Estadísticas</h2>
                <p className="text-zinc-500 font-bold text-[9px] uppercase tracking-widest">Resumen de Negocio</p>
              </div>
              <div className="bg-white/5 px-3 py-1 rounded-full border border-white/10">
                <p className="text-[9px] font-black text-white/50 uppercase tracking-tighter">En tiempo real</p>
              </div>
            </div>

            {/* Main Balance Card */}
            <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 p-5 rounded-[32px] border border-zinc-700/50 shadow-2xl relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all" />
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Balance Total</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black tracking-tighter">${stats.totalBilled.toLocaleString()}</span>
                <span className="text-xs font-bold text-white/30">COP</span>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  <p className="text-[9px] font-black text-white/60 uppercase tracking-widest">Activo</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full" />
                  <p className="text-[9px] font-black text-white/60 uppercase tracking-widest">{invoices.length} Facturas</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-900/50 backdrop-blur-sm p-4 rounded-[28px] border border-zinc-800/50 flex flex-col justify-between min-h-[100px]">
                <div className="flex justify-between items-start">
                  <div className="w-7 h-7 bg-green-500/10 rounded-xl flex items-center justify-center">
                    <TrendingUp size={14} className="text-green-500" />
                  </div>
                </div>
                <div>
                  <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">Ganancias</p>
                  <p className="text-lg font-black text-green-500 tracking-tight">${stats.totalProfit.toLocaleString()}</p>
                </div>
              </div>

              <div className="bg-zinc-900/50 backdrop-blur-sm p-4 rounded-[28px] border border-zinc-800/50 flex flex-col justify-between min-h-[100px]">
                <div className="flex justify-between items-start">
                  <div className="w-7 h-7 bg-red-500/10 rounded-xl flex items-center justify-center">
                    <TrendingUp size={14} className="text-red-500" />
                  </div>
                </div>
                <div>
                  <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">Pendiente</p>
                  <p className="text-lg font-black text-red-500 tracking-tight">${stats.totalPending.toLocaleString()}</p>
                </div>
              </div>

              <div className="bg-zinc-900/50 backdrop-blur-sm p-4 rounded-[28px] border border-zinc-800/50 flex flex-col justify-between min-h-[100px]">
                <div className="flex justify-between items-start">
                  <div className="w-7 h-7 bg-zinc-800 rounded-xl flex items-center justify-center">
                    <TrendingUp size={14} className="text-zinc-400 rotate-180" />
                  </div>
                </div>
                <div>
                  <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">Costos</p>
                  <p className="text-lg font-black text-zinc-400 tracking-tight">${stats.totalCost.toLocaleString()}</p>
                </div>
              </div>

              <div className="bg-zinc-900/50 backdrop-blur-sm p-4 rounded-[28px] border border-zinc-800/50 flex flex-col justify-between min-h-[100px]">
                <div className="flex justify-between items-start">
                  <div className={cn(
                    "w-7 h-7 rounded-xl flex items-center justify-center",
                    stats.totalExpenses > stats.totalProfit ? "bg-red-500/10" : "bg-orange-500/10"
                  )}>
                    <TrendingUp size={14} className={cn(
                      "rotate-180",
                      stats.totalExpenses > stats.totalProfit ? "text-red-500" : "text-orange-500"
                    )} />
                  </div>
                </div>
                <div>
                  <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">Gastos</p>
                  <p className={cn(
                    "text-lg font-black tracking-tight",
                    stats.totalExpenses > stats.totalProfit ? "text-red-500 animate-pulse" : "text-orange-500"
                  )}>${stats.totalExpenses.toLocaleString()}</p>
                </div>
              </div>

              <div className="bg-zinc-900/50 backdrop-blur-sm p-4 rounded-[28px] border border-zinc-800/50 flex flex-col justify-between min-h-[100px]">
                <div className="flex justify-between items-start">
                  <div className="w-7 h-7 bg-white/5 rounded-xl flex items-center justify-center">
                    <TrendingUp size={14} className="text-white/40" />
                  </div>
                </div>
                <div>
                  <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">Margen Libre</p>
                  <p className={cn(
                    "text-lg font-black tracking-tight",
                    (stats.totalProfit - stats.totalExpenses) < 0 ? "text-red-500" : "text-white"
                  )}>
                    ${(stats.totalProfit - stats.totalExpenses).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>



            {/* Performance Bar */}
            <div className="bg-zinc-900/30 p-4 rounded-[28px] border border-zinc-800/30">
              <div className="flex justify-between items-center mb-3">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Eficiencia de Cobro</p>
                <p className="text-[10px] font-black text-white">
                  {stats.totalBilled > 0 ? Math.round(((stats.totalBilled - stats.totalPending) / stats.totalBilled) * 100) : 0}%
                </p>
              </div>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.totalBilled > 0 ? ((stats.totalBilled - stats.totalPending) / stats.totalBilled) * 100 : 0}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Navigation - Mobile Only */}
      {activeTab !== 'chat' && (
        <nav id="mobile-bottom-nav" className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-zinc-900/60 backdrop-blur-3xl border border-white/5 rounded-[40px] p-1.5 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={cn(
            "flex-1 flex items-center justify-center py-3.5 rounded-full transition-all relative",
            activeTab === 'dashboard' ? "text-white" : "text-zinc-600"
          )}
        >
          <LayoutGrid size={20} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
          {activeTab === 'dashboard' && (
            <motion.div 
              layoutId="nav-glow" 
              className="absolute inset-0 bg-white/5 rounded-full -z-10" 
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
        </button>
        
        <button 
          onClick={() => setActiveTab('clients')}
          className={cn(
            "flex-1 flex items-center justify-center py-3.5 rounded-full transition-all relative",
            activeTab === 'clients' ? "text-white" : "text-zinc-600"
          )}
        >
          <UserIcon size={20} strokeWidth={activeTab === 'clients' ? 2.5 : 2} />
          {activeTab === 'clients' && (
            <motion.div 
              layoutId="nav-glow" 
              className="absolute inset-0 bg-white/5 rounded-full -z-10" 
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
        </button>

        <button 
          onClick={() => setActiveTab('pendientes')}
          className={cn(
            "flex-1 flex items-center justify-center py-3.5 rounded-full transition-all relative",
            activeTab === 'pendientes' ? "text-white" : "text-zinc-600"
          )}
        >
          <Calendar size={20} strokeWidth={activeTab === 'pendientes' ? 2.5 : 2} />
          {activeTab === 'pendientes' && (
            <motion.div 
              layoutId="nav-glow" 
              className="absolute inset-0 bg-white/5 rounded-full -z-10" 
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
        </button>

        <button 
          onClick={() => {
            setEditingInvoice(undefined);
            setIsFormOpen(true);
          }}
          className="flex-1 flex items-center justify-center -translate-y-4"
        >
          <div className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.3)] border-[4px] border-zinc-900 active:scale-95 transition-transform">
            <Plus size={24} strokeWidth={3} />
          </div>
        </button>

        <button 
          onClick={() => setActiveTab('tareas')}
          className={cn(
            "flex-1 flex flex-col items-center justify-center py-2 transition-all relative",
            activeTab === 'tareas' ? "text-white" : "text-zinc-600 hover:text-zinc-400"
          )}
        >
          <CheckCircle2 size={20} strokeWidth={activeTab === 'tareas' ? 2.5 : 2} />
          {activeTab === 'tareas' && (
            <motion.div 
              layoutId="nav-glow" 
              className="absolute inset-0 bg-white/5 rounded-full -z-10" 
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
        </button>

        <button 
          onClick={() => setActiveTab('stats')}
          className={cn(
            "flex-1 flex items-center justify-center py-3.5 rounded-full transition-all relative",
            activeTab === 'stats' ? "text-white" : "text-zinc-600"
          )}
        >
          <TrendingUp size={20} strokeWidth={activeTab === 'stats' ? 2.5 : 2} />
          {activeTab === 'stats' && (
            <motion.div 
              layoutId="nav-glow" 
              className="absolute inset-0 bg-white/5 rounded-full -z-10" 
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
        </button>

        <button 
          onClick={() => setActiveTab('gastos')}
          className={cn(
            "flex-1 flex items-center justify-center py-3.5 rounded-full transition-all relative",
            activeTab === 'gastos' ? "text-white" : "text-zinc-600"
          )}
        >
          <Wallet size={20} strokeWidth={activeTab === 'gastos' ? 2.5 : 2} />
          {activeTab === 'gastos' && (
            <motion.div 
              layoutId="nav-glow" 
              className="absolute inset-0 bg-white/5 rounded-full -z-10" 
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
        </button>

        <button 
          onClick={() => setShowSettings(true)}
          className={cn(
            "flex-1 flex items-center justify-center py-3.5 rounded-full transition-all relative",
            showSettings ? "text-white" : "text-zinc-600"
          )}
        >
          {user?.photoURL ? (
            <img 
              src={user.photoURL} 
              alt="Perfil" 
              className={cn("w-[22px] h-[22px] rounded-full object-cover transition-all border-2", showSettings ? "border-white" : "border-transparent opacity-60")} 
              referrerPolicy="no-referrer"
            />
          ) : (
            <Settings size={20} strokeWidth={showSettings ? 2.5 : 2} />
          )}
          {showSettings && (
            <motion.div 
              layoutId="nav-glow" 
              className="absolute inset-0 bg-white/5 rounded-full -z-10" 
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
        </button>
      </nav>
      )}

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center p-0 md:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md bg-zinc-900 border-none md:border border-zinc-800 rounded-t-[40px] md:rounded-[40px] p-8 pb-12 md:pb-8 shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center">
                  <Settings size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight">Configuración</h3>
                  <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Información de Registro</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-zinc-950/50 p-5 rounded-[24px] border border-zinc-800/50">
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">Usuario Actual</p>
                  {user ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-full overflow-hidden border-2 border-zinc-800">
                          <img src={user.photoURL || ''} alt="Avatar" className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-sm font-black">{user.displayName}</p>
                          <p className="text-[10px] font-bold text-zinc-500">{user.email}</p>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-zinc-800/50">
                        <div className="flex justify-between items-center">
                          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">ID de Registro</p>
                          <p className="text-[9px] font-mono text-zinc-400">{user.uid.substring(0, 12)}...</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center">
                      <p className="text-xs font-bold text-zinc-500 mb-4">No has iniciado sesión</p>
                      <button 
                        onClick={() => {
                          signInWithGoogle();
                          setShowSettings(false);
                        }}
                        className="px-6 py-2.5 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest"
                      >
                        Conectar Google
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-zinc-950/50 p-5 rounded-[24px] border border-zinc-800/50">
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">Apariencia</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
                        {theme === 'light' ? <Sun size={14} className="text-zinc-500" /> : <Moon size={14} className="text-zinc-500" />}
                      </div>
                      <div>
                        <p className="text-xs font-black">Tema de la app</p>
                        <p className="text-[9px] font-bold text-zinc-500">
                          {theme === 'light' ? 'Modo Claro activado' : 'Modo Oscuro activado'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={toggleTheme}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5"
                    >
                      {theme === 'light' ? <Moon size={10} /> : <Sun size={10} />}
                      Cambiar
                    </button>
                  </div>
                </div>

                <div className="bg-zinc-950/50 p-5 rounded-[24px] border border-zinc-800/50">
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">Plan de Suscripción</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
                        <TrendingUp size={14} className="text-zinc-500" />
                      </div>
                      <div>
                        <p className="text-xs font-black">Versión Gratis</p>
                        <p className="text-[9px] font-bold text-zinc-500">Funciones básicas activas</p>
                      </div>
                    </div>
                    <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors">
                      Mejorar
                    </button>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowSettings(false)}
                className="w-full mt-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-[24px] text-xs font-black transition-all"
              >
                Cerrar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Form Modal */}
      <InvoiceForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingInvoice(undefined);
        }}
        onSave={handleSaveInvoice}
        initialInvoice={editingInvoice}
      />
    </div>
  );
}
