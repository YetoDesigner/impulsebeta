import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Filter, Settings, LogOut, ChevronRight, User as UserIcon, LayoutGrid, List as ListIcon, TrendingUp, Mail, Moon, Sun, Clock, Wallet, Calendar, CheckCircle2, MessageSquare, Scan, Loader2, Sparkles, Receipt, Building2, Upload, Save, X, ArrowLeft } from 'lucide-react';
import { Invoice, Expense, AppView } from './types';
import InvoiceCard, { InvoiceCardRef } from './components/InvoiceCard';
import InvoiceForm from './components/InvoiceForm';
import ClientsView from './components/ClientsView';
import PendientesView from './components/PendientesView';
import GastosView from './components/GastosView';
import TasksView from './components/TasksView';
import ChatView from './components/ChatView';
import ScanResultModal from './components/ScanResultModal';
import PremiumModal from './components/PremiumModal';
import { cn } from './lib/utils';
import { scanDocumentWithAI } from './lib/openai';
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
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]); // Track expenses for stats
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ABONO' | 'PAGADO' | 'COTIZACIÓN'>('ALL');
  const [activeTab, setActiveTab] = useState<AppView>('chat');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sharingInvoiceId, setSharingInvoiceId] = useState<string | null>(null);
  const sharingInvoiceRef = useRef<InvoiceCardRef>(null);

  useEffect(() => {
    if (sharingInvoiceId && sharingInvoiceRef.current) {
      sharingInvoiceRef.current.share().then(() => {
        setSharingInvoiceId(null);
      }).catch((e) => {
        console.error('Error auto-sharing:', e);
        setSharingInvoiceId(null);
      });
    }
  }, [sharingInvoiceId]);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCompanySettings, setShowCompanySettings] = useState(false);
  const [companySettings, setCompanySettings] = useState({
    name: 'MI EMPRESA',
    nit: '123456789',
    phone: '',
    address: '',
    logoUrl: ''
  });
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [globalDesignType, setGlobalDesignType] = useState<'MODERN' | 'TICKET'>('MODERN');
  const [isScanning, setIsScanning] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scannedExpense, setScannedExpense] = useState<Partial<Expense> | null>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  // (removed freeInvoicesUsed state since we use currentInvoiceCount)
  const [dailyChatCount, setDailyChatCount] = useState<number>(0);
  const [dailyScanCount, setDailyScanCount] = useState<number>(0);
  const scanInputRef = React.useRef<HTMLInputElement>(null);

  // Premium Check Logic
  const isPremium = useMemo(() => {
    if (!user) return false;
    // Premium flag should be loaded from Firebase profile
    return false; // Force false for trial logic testing
  }, [user]);

  // Paid plan type: null = free, 'basic' = $8,000, 'unlimited' = $30,000
  const paidPlan = useMemo(() => {
    if (!user) return null;
    // Load from Firebase profile when payment is implemented
    return null as null | 'basic' | 'unlimited';
  }, [user]);

  // FREE TIER LIMITS
  const FREE_INVOICE_LIMIT = 50;
  const FREE_DAILY_CHAT_LIMIT = 3;
  const FREE_DAILY_SCAN_LIMIT = 3;

  // BASIC PLAN LIMITS ($8,000)
  const BASIC_INVOICE_LIMIT = 50;
  const BASIC_DAILY_CHAT_LIMIT = 3;
  const BASIC_DAILY_SCAN_LIMIT = 5;

  const currentInvoiceCount = invoices.length;
  const freeInvoicesRemaining = Math.max(0, FREE_INVOICE_LIMIT - currentInvoiceCount);
  const freeChatRemaining = Math.max(0, FREE_DAILY_CHAT_LIMIT - dailyChatCount);
  const freeScanRemaining = Math.max(0, FREE_DAILY_SCAN_LIMIT - dailyScanCount);

  // Helper to get today's date key for daily limit tracking
  const getTodayKey = useCallback(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  // Load and reset daily counters
  useEffect(() => {
    if (!user) return;
    const todayKey = getTodayKey();
    
    // Remove old localStorage logic for invoices
    // We now count actual invoices from the database

    // Load daily chat count (reset if new day)
    const savedChatDay = localStorage.getItem(`impulse_chat_day_${user.uid}`);
    const savedChatCount = localStorage.getItem(`impulse_chat_count_${user.uid}`);
    if (savedChatDay === todayKey && savedChatCount) {
      setDailyChatCount(parseInt(savedChatCount, 10) || 0);
    } else {
      setDailyChatCount(0);
      localStorage.setItem(`impulse_chat_day_${user.uid}`, todayKey);
      localStorage.setItem(`impulse_chat_count_${user.uid}`, '0');
    }

    // Load daily scan count (reset if new day)
    const savedScanDay = localStorage.getItem(`impulse_scan_day_${user.uid}`);
    const savedScanCount = localStorage.getItem(`impulse_scan_count_${user.uid}`);
    if (savedScanDay === todayKey && savedScanCount) {
      setDailyScanCount(parseInt(savedScanCount, 10) || 0);
    } else {
      setDailyScanCount(0);
      localStorage.setItem(`impulse_scan_day_${user.uid}`, todayKey);
      localStorage.setItem(`impulse_scan_count_${user.uid}`, '0');
    }
  }, [user, getTodayKey]);

  // Increment invoice usage
  const incrementInvoiceUsage = useCallback(() => {
    // No longer needed, as we count actual invoices
  }, []);

  // Increment chat usage
  const incrementChatUsage = useCallback(() => {
    if (!user || isPremium || paidPlan === 'unlimited') return;
    const todayKey = getTodayKey();
    const newCount = dailyChatCount + 1;
    setDailyChatCount(newCount);
    localStorage.setItem(`impulse_chat_day_${user.uid}`, todayKey);
    localStorage.setItem(`impulse_chat_count_${user.uid}`, String(newCount));
  }, [user, isPremium, paidPlan, dailyChatCount, getTodayKey]);

  // Increment scan usage
  const incrementScanUsage = useCallback(() => {
    if (!user || isPremium || paidPlan === 'unlimited') return;
    const todayKey = getTodayKey();
    const newCount = dailyScanCount + 1;
    setDailyScanCount(newCount);
    localStorage.setItem(`impulse_scan_day_${user.uid}`, todayKey);
    localStorage.setItem(`impulse_scan_count_${user.uid}`, String(newCount));
  }, [user, isPremium, paidPlan, dailyScanCount, getTodayKey]);

  // Check if user can use chat (without side effects)
  const isChatLimitReached = useMemo(() => {
    if (isPremium || paidPlan === 'unlimited') return false;
    const limit = paidPlan === 'basic' ? BASIC_DAILY_CHAT_LIMIT : FREE_DAILY_CHAT_LIMIT;
    return dailyChatCount >= limit;
  }, [isPremium, paidPlan, dailyChatCount]);

  // Action: Attempt to use chat
  const canUseChat = useCallback(() => {
    if (isChatLimitReached) {
      setShowPremiumModal(true);
      return false;
    }
    return true;
  }, [isChatLimitReached]);

  // Check if user can use scanner (without side effects)
  const isScanLimitReached = useMemo(() => {
    if (isPremium || paidPlan === 'unlimited') return false;
    const limit = paidPlan === 'basic' ? BASIC_DAILY_SCAN_LIMIT : FREE_DAILY_SCAN_LIMIT;
    return dailyScanCount >= limit;
  }, [isPremium, paidPlan, dailyScanCount]);

  // Action: Attempt to use scan
  const canUseScan = useCallback(() => {
    if (isScanLimitReached) {
      setShowPremiumModal(true);
      return false;
    }
    return true;
  }, [isScanLimitReached]);

  const isInvoiceLimitReached = useMemo(() => {
    if (isPremium || paidPlan === 'unlimited') return false;
    const limit = paidPlan === 'basic' ? BASIC_INVOICE_LIMIT : FREE_INVOICE_LIMIT;
    return currentInvoiceCount >= limit;
  }, [isPremium, paidPlan, currentInvoiceCount]);

  const checkInvoiceLimit = () => {
    if (isInvoiceLimitReached) {
      setShowPremiumModal(true);
      return false;
    }
    return true;
  };

  const handleNavigateFromChat = (target: string) => {
    if (target === 'new_invoice') {
      if (checkInvoiceLimit()) {
        setEditingInvoice(undefined);
        setIsFormOpen(true);
      }
    } else if (target === 'scan') {
      if (canUseScan()) {
        scanInputRef.current?.click();
      }
    } else if (target === 'settings') {
      setShowSettings(true);
    } else {
      setActiveTab(target as AppView);
    }
  };

  // Global Scanner Handler
  const handleGlobalScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canUseScan()) return;
    
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsScanning(true);
    
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const base64 = await base64Promise;
      const result = await scanDocumentWithAI(base64);

      setScannedExpense(result);
      setIsScanModalOpen(true);
      incrementScanUsage();
    } catch (error) {
      console.error("Scanning error:", error);
      alert("No se pudo escanear la factura. Intenta con una foto más clara.");
    } finally {
      setIsScanning(false);
      if (scanInputRef.current) scanInputRef.current.value = '';
    }
  };

  const handleSaveScannedExpense = async (expense: Expense) => {
    if (!user) return;
    
    try {
      if (user.uid !== 'local-user') {
        await setDoc(doc(db, `users/${user.uid}/expenses`, expense.id), {
          ...expense,
          createdAt: serverTimestamp()
        });
      } else {
        setExpenses(prev => {
          const updated = [expense, ...prev];
          localStorage.setItem('impulse_expenses', JSON.stringify(updated));
          return updated;
        });
      }
      
      setIsScanModalOpen(false);
      setScannedExpense(null);
      setActiveTab('gastos');
    } catch (error) {
      console.error("Error saving scanned expense:", error);
      alert("Error al guardar el gasto.");
    }
  };

  const handleGlobalDesignChange = (type: 'MODERN' | 'TICKET') => {
    setGlobalDesignType(type);
    // Optional: persist to local storage or user profile
    localStorage.setItem('impulse_global_design', type);
  };

  // Load saved design type
  useEffect(() => {
    const saved = localStorage.getItem('impulse_global_design') as 'MODERN' | 'TICKET';
    if (saved) setGlobalDesignType(saved);
  }, []);

  // Load initial theme and company settings
  useEffect(() => {
    const savedTheme = localStorage.getItem('impulse_theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    }

    const savedCompany = localStorage.getItem('impulse_company_settings');
    if (savedCompany) {
      try {
        setCompanySettings(JSON.parse(savedCompany));
      } catch (e) {}
    } else {
      // Si no hay configuración guardada (usuario nuevo)
      setShowCompanySettings(true);
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
      // Temporalmente desactivado el auth automático para forzar local
      // setUser(user);
      setIsAuthLoading(false);
      // if (user) {
      //   migrateLocalData(user.uid);
      // }
    });
    return () => unsubscribe();
  }, []);

  const handleFakeLogin = () => {
    setUser({
      uid: 'local-user',
      displayName: 'Usuario Local',
      email: 'local@impulse.com',
      photoURL: '',
    } as any);
  };

  // Firestore Sync
  useEffect(() => {
    // Load from localStorage first to prevent empty screen if offline or slow
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setInvoices(parsed);
      } catch (e) {
        console.error('Error loading invoices', e);
      }
    }

    if (!user || user.uid === 'local-user') {
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
      console.error('Firestore invoices listener error:', error);
    });

    // Listen to expenses as well
    const expQ = query(collection(db, `users/${user.uid}/expenses`));
    const unsubExp = onSnapshot(expQ, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ ...doc.data() }));
      setExpenses(docs);
      localStorage.setItem('impulse_expenses', JSON.stringify(docs));
    }, (error) => {
      console.error('Firestore expenses listener error:', error);
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
    const isNew = !editingInvoice;
    if (isNew && !checkInvoiceLimit()) return;

    // Inject current company settings
    const finalInvoice = {
      ...invoice,
      companyName: companySettings.name,
      nit: companySettings.nit,
      companyPhone: companySettings.phone,
      companyAddress: companySettings.address,
      logoUrl: companySettings.logoUrl
    };

    if (user && user.uid !== 'local-user') {
      const path = `users/${user.uid}/invoices`;
      try {
        const docRef = doc(db, path, finalInvoice.id);
        await setDoc(docRef, {
          ...finalInvoice,
          updatedAt: serverTimestamp()
        });
        if (isNew) incrementInvoiceUsage();
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, path);
      }
    } else {
      if (editingInvoice) {
        setInvoices(prev => {
          const updated = prev.map(inv => inv.id === finalInvoice.id ? finalInvoice : inv);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
      } else {
        setInvoices(prev => {
          const updated = [finalInvoice, ...prev];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
        incrementInvoiceUsage();
      }
    }
    setEditingInvoice(undefined);
    setIsFormOpen(false);
  };

  const handleUpdateInvoice = async (id: string, updates: Partial<Invoice>) => {
    if (user && user.uid !== 'local-user') {
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
    if (user && user.uid !== 'local-user') {
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
    if (!checkInvoiceLimit()) return;
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
        let date = new Date().toISOString().split('T')[0];
        try {
          const d = new Date(inv.date);
          if (!isNaN(d.getTime())) date = d.toISOString().split('T')[0];
        } catch(e) {}
        
        const items = inv.items || [];
        const amount = inv.status === 'PAGADO' 
          ? items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.salePrice) || 0)), 0)
          : (items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.salePrice) || 0)), 0) - (Number(inv.remainingAmount) || 0));
        
        if (amount > 0) {
          const current = datesMap.get(date) || { income: 0, expense: 0 };
          datesMap.set(date, { ...current, income: current.income + amount });
        }
      }
    });

    // Procesar gastos
    expenses.forEach(exp => {
      if (exp.date) {
        let date = new Date().toISOString().split('T')[0];
        try {
          const d = new Date(exp.date);
          if (!isNaN(d.getTime())) date = d.toISOString().split('T')[0];
        } catch(e) {}
        
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
        let formattedDate = '—';
        if (!isNaN(dateObj.getTime())) {
          formattedDate = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        }
        
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
          date: !isNaN(d.getTime()) ? d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '—',
          Ingresos: 0,
          Gastos: 0
        });
      }
    } else if (evolutionData.length === 1) {
      // Agregar un día anterior vacío para que se vea una línea
      const firstDate = new Date(evolutionData[0].fullDate);
      firstDate.setDate(firstDate.getDate() - 1);
      evolutionData.unshift({
        date: !isNaN(firstDate.getTime()) ? firstDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '—',
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

  if (!user) {
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
            onClick={handleFakeLogin}
            className="w-full flex items-center justify-center gap-4 py-4 bg-white text-black rounded-[24px] text-sm font-black transition-all hover:bg-zinc-200 active:scale-95 shadow-xl shadow-white/5"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Continuar con Google (Acceso Local)
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row overflow-x-hidden">
      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Desktop & Mobile */}
      <aside className={cn(
        "w-64 md:w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col p-5 fixed h-full z-[110] transition-transform duration-300",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center overflow-hidden">
              <img src={APP_LOGO_URL} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <h1 className="text-lg font-black tracking-tighter text-white">
              Impulse <span className="text-orange-500">Ultra</span>
            </h1>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-2 text-zinc-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto scrollbar-hide">
          <div className="space-y-1">
            <p className="text-[8px] font-black opacity-30 tracking-widest uppercase mb-3 px-3">Principal</p>
            <button 
              onClick={() => { setActiveTab('chat'); setIsMobileMenuOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-black transition-all",
                activeTab === 'chat' 
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              <MessageSquare size={16} /> Impulse AI
            </button>
            <button 
              onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
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
                if (checkInvoiceLimit()) {
                  setEditingInvoice(undefined);
                  setIsFormOpen(true);
                  setIsMobileMenuOpen(false);
                }
              }}
              className="w-full flex items-center gap-3 p-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl text-xs font-black transition-all"
            >
              <Plus size={16} /> Nuevo Pedido
            </button>
            <button 
              onClick={() => {
                if (canUseScan()) {
                  scanInputRef.current?.click();
                  setIsMobileMenuOpen(false);
                }
              }}
              className="w-full flex items-center gap-3 p-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl text-xs font-black transition-all"
            >
              <Scan size={16} /> Escanear Factura
            </button>
            <button 
              onClick={() => { setActiveTab('clients'); setIsMobileMenuOpen(false); }}
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
              onClick={() => { setActiveTab('pendientes'); setIsMobileMenuOpen(false); }}
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
              onClick={() => { setActiveTab('gastos'); setIsMobileMenuOpen(false); }}
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
              onClick={() => { setActiveTab('tareas'); setIsMobileMenuOpen(false); }}
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
              onClick={() => { setActiveTab('stats'); setIsMobileMenuOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-black transition-all",
                activeTab === 'stats' 
                  ? "bg-white text-black shadow-lg shadow-white/5" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              <TrendingUp size={16} /> Estadísticas
            </button>
            <button 
              onClick={() => { setShowSettings(true); setIsMobileMenuOpen(false); }}
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
              onClick={handleFakeLogin}
              className="w-full flex items-center justify-center gap-3 p-3 bg-white text-black rounded-xl text-xs font-black transition-all hover:bg-zinc-200"
            >
              Iniciar con Google (Local)
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
      <main className="flex-1 md:ml-56 p-5 md:p-8 pb-32 md:pb-10">
        {/* Header Mobile — oculto en chat, botón de regreso en otras vistas */}
        <header className={cn("md:hidden flex justify-between items-center mb-6 relative z-50", activeTab === 'chat' && "hidden")}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('chat')}
              className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-white active:scale-95 transition-transform"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-sm font-black tracking-tighter">
                {({ dashboard: 'Panel', clients: 'Clientes', pendientes: 'Pendientes', gastos: 'Gastos', tareas: 'Tareas', stats: 'Estadísticas' } as Record<string, string>)[activeTab] || 'Panel'}
              </h1>
              <p className="text-[9px] font-black text-orange-500 uppercase tracking-[0.2em]">Impulse Ultra</p>
            </div>
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
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-3xl font-black tracking-tight mb-1">Cuentas de Cobro</h2>
                    <p className="text-zinc-500 font-bold text-xs mb-3">Gestiona tus ingresos y abonos de forma eficiente.</p>
                  </div>
                  
                  {/* Global Design Toggle Desktop - Small White Buttons */}
                  <div className="flex bg-white/5 backdrop-blur-md p-1 rounded-xl gap-1 border border-white/5">
                    {[
                      { id: 'MODERN', icon: LayoutGrid },
                      { id: 'TICKET', icon: Receipt }
                    ].map((d) => (
                      <button
                        key={d.id}
                        onClick={() => handleGlobalDesignChange(d.id as any)}
                        className={cn(
                          "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                          globalDesignType === d.id ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white/60"
                        )}
                        title={d.id === 'MODERN' ? 'Vista Moderna' : 'Vista Ticket'}
                      >
                        <d.icon size={14} />
                      </button>
                    ))}
                  </div>
                </div>

                {user && !isPremium && !paidPlan && (
                  <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles size={10} /> Te quedan {freeInvoicesRemaining} comprobantes gratis · {freeChatRemaining} chats hoy · {freeScanRemaining} escaneos hoy
                  </p>
                )}
              </div>
              <div className="flex gap-3 ml-8">
                <div className="bg-zinc-900 p-3 rounded-2xl border border-zinc-800 min-w-[120px]">
                    <p className="text-[8px] font-black opacity-30 tracking-widest uppercase mb-1">Total Cobrado</p>
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

            {/* Mobile Header Dashboard - Small White Toggle */}
            <div className="md:hidden mb-6 px-1 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black tracking-tight">Cuentas de Cobro</h2>
                
                <div className="flex bg-white/5 backdrop-blur-md p-1 rounded-xl gap-1 border border-white/5">
                  {[
                    { id: 'MODERN', icon: LayoutGrid },
                    { id: 'TICKET', icon: Receipt }
                  ].map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleGlobalDesignChange(d.id as any)}
                      className={cn(
                        "w-7 h-7 flex items-center justify-center rounded-lg transition-all",
                        globalDesignType === d.id ? "bg-white text-black shadow-lg" : "text-white/40"
                      )}
                    >
                      <d.icon size={12} />
                    </button>
                  ))}
                </div>
              </div>

              {user && !isPremium && !paidPlan && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex flex-col gap-1">
                  <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles size={12} /> Plan Gratis
                  </p>
                  <p className="text-[9px] font-bold text-orange-400">
                    Te quedan {freeInvoicesRemaining} comprobantes · {freeChatRemaining} chats hoy · {freeScanRemaining} escaneos hoy
                  </p>
                </div>
              )}
            </div>

            {/* Mobile Search and Filters (Visible on Mobile) */}
            <div className="md:hidden space-y-3 mb-6 px-1">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={16} />
                <input
                  type="text"
                  placeholder="Buscar por cliente o ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-3 pl-11 pr-5 text-xs focus:ring-2 focus:ring-white transition-all outline-none font-bold text-white"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {['TODO', 'ABONO', 'PAGADO', 'COTIZACIONES'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      if (filter === 'TODO') setActiveFilter('ALL');
                      else if (filter === 'COTIZACIONES') setActiveFilter('COTIZACIÓN');
                      else setActiveFilter(filter as any);
                    }}
                    className={cn(
                      "px-4 py-2 rounded-xl font-black text-[9px] tracking-widest transition-all whitespace-nowrap border",
                      (activeFilter === 'ALL' ? 'TODO' : activeFilter === 'COTIZACIÓN' ? 'COTIZACIONES' : activeFilter) === filter 
                        ? "bg-white text-black border-white shadow-lg" 
                        : "bg-zinc-900 text-zinc-400 border-zinc-800"
                    )}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop Controls (Hidden on Mobile) */}
            <div className="hidden md:flex flex-col md:flex-row gap-3 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={16} />
                <input
                  type="text"
                  placeholder="Buscar por cliente o ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-3 pl-11 pr-5 text-xs focus:ring-2 focus:ring-white transition-all outline-none font-bold"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
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
              viewMode === 'grid'
                ? "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5"
                : "grid grid-cols-1 gap-5"
            )}>
              <AnimatePresence mode="popLayout">
                {filteredInvoices.map((invoice) => (
                  <div key={invoice.id}>
                    <InvoiceCard
                      invoice={{ ...invoice, designType: globalDesignType }}
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
                  <h3 className="text-base font-black opacity-40">No se encontraron cuentas de cobro</h3>
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
        ) : activeTab === 'chat' || activeTab === 'stats' ? (
          <ChatView
            stats={stats}
            invoices={invoices}
            expenses={expenses}
            onChatSend={incrementChatUsage}
            chatRemaining={freeChatRemaining}
            chatLimitReached={isChatLimitReached}
            onLimitReached={() => setShowPremiumModal(true)}
            onUpdateInvoice={handleUpdateInvoice}
            onShareInvoice={(id) => setSharingInvoiceId(id)}
            onNavigate={handleNavigateFromChat}
          />
        ) : null}
      </main>

      {/* Global Scanning Overlay */}
      <AnimatePresence>
        {isScanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center"
          >
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-24 h-24 border-4 border-orange-500/20 border-t-orange-500 rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles size={32} className="text-orange-500 animate-pulse" />
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 text-center"
            >
              <h3 className="text-2xl font-black text-white mb-2">Impulse AI está analizando...</h3>
              <p className="text-zinc-500 font-bold uppercase tracking-[0.2em] text-[10px]">Extrayendo datos de tu factura</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scan Result Modal */}
      <ScanResultModal
        isOpen={isScanModalOpen}
        onClose={() => {
          setIsScanModalOpen(false);
          setScannedExpense(null);
        }}
        onSave={handleSaveScannedExpense}
        scannedData={scannedExpense}
      />

      {/* Premium Upgrade Modal */}
      <PremiumModal 
        isOpen={showPremiumModal} 
        onClose={() => setShowPremiumModal(false)} 
      />

      {/* Company Settings Modal */}
      <AnimatePresence>
        {showCompanySettings && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center p-0 md:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCompanySettings(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md md:max-w-2xl bg-zinc-900 border-none md:border border-zinc-800 rounded-t-[40px] md:rounded-[40px] p-8 pb-12 md:pb-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center">
                    <Building2 size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight">Mi Empresa</h3>
                    <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Datos para Facturas</p>
                  </div>
                </div>
                <button onClick={() => setShowCompanySettings(false)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col items-center mb-6">
                  <label className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-3">Logo Documento</label>
                  <div 
                    onClick={() => document.getElementById('companyLogoUpload')?.click()}
                    className="w-24 h-24 rounded-3xl bg-zinc-800 border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center cursor-pointer hover:border-white/20 transition-all overflow-hidden group relative"
                  >
                    {companySettings.logoUrl ? (
                      <>
                        <img src={companySettings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                          <Upload size={20} className="text-white mb-1" />
                        </div>
                      </>
                    ) : (
                      <>
                        <Upload size={20} className="opacity-30 mb-2" />
                        <span className="text-[9px] font-black opacity-30 uppercase tracking-widest">Subir</span>
                      </>
                    )}
                  </div>
                  <input 
                    id="companyLogoUpload"
                    type="file" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setCompanySettings(prev => ({ ...prev, logoUrl: reader.result as string }));
                        };
                        reader.readAsDataURL(file);
                      }
                    }} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black opacity-40 uppercase tracking-widest">Nombre de la Empresa</label>
                    <input
                      type="text"
                      value={companySettings.name}
                      onChange={e => setCompanySettings(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-white transition-colors outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black opacity-40 uppercase tracking-widest">NIT / ID</label>
                    <input
                      type="text"
                      value={companySettings.nit}
                      onChange={e => setCompanySettings(prev => ({ ...prev, nit: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-white transition-colors outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black opacity-40 uppercase tracking-widest">WhatsApp</label>
                    <input
                      type="tel"
                      value={companySettings.phone}
                      onChange={e => setCompanySettings(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-white transition-colors outline-none"
                      placeholder="+57..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black opacity-40 uppercase tracking-widest">Dirección</label>
                    <input
                      type="text"
                      value={companySettings.address}
                      onChange={e => setCompanySettings(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-white transition-colors outline-none"
                      placeholder="Dirección..."
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={() => {
                  if (!companySettings.name || !companySettings.nit) {
                    alert('Por favor completa el Nombre y NIT de tu empresa para continuar.');
                    return;
                  }
                  localStorage.setItem('impulse_company_settings', JSON.stringify(companySettings));
                  setShowCompanySettings(false);
                }}
                className="w-full mt-8 py-4 bg-white hover:bg-zinc-200 text-black rounded-[24px] text-xs font-black transition-all flex items-center justify-center gap-2"
              >
                <Save size={16} />
                Guardar Configuración
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              className="relative w-full max-w-md md:max-w-2xl bg-zinc-900 border-none md:border border-zinc-800 rounded-t-[40px] md:rounded-[40px] p-8 pb-12 md:pb-8 shadow-2xl"
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
                          handleFakeLogin();
                          setShowSettings(false);
                        }}
                        className="px-6 py-2.5 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest"
                      >
                        Conectar Google (Local)
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-zinc-950/50 p-5 rounded-[24px] border border-zinc-800/50">
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">Información de la Empresa</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
                        <Building2 size={14} className="text-zinc-500" />
                      </div>
                      <div>
                        <p className="text-xs font-black">{companySettings.name}</p>
                        <p className="text-[9px] font-bold text-zinc-500">
                          NIT: {companySettings.nit}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setShowSettings(false);
                        setShowCompanySettings(true);
                      }}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors"
                    >
                      Configurar
                    </button>
                  </div>
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
                        <p className="text-xs font-black">{isPremium || paidPlan === 'unlimited' ? 'Plan Ilimitado' : paidPlan === 'basic' ? 'Plan Básico' : 'Versión Gratis'}</p>
                        <p className="text-[9px] font-bold text-zinc-500">
                          {isPremium || paidPlan === 'unlimited' ? 'Acceso ilimitado activo' : paidPlan === 'basic' ? `${BASIC_INVOICE_LIMIT - currentInvoiceCount} comprobantes restantes` : `${freeInvoicesRemaining} comprobantes gratis restantes`}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setShowSettings(false);
                        setShowPremiumModal(true);
                      }}
                      className="px-3 py-1.5 bg-orange-500 text-white border border-orange-600 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors"
                    >
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

      {/* Global Scanner Input */}
      <input 
        type="file" 
        ref={scanInputRef} 
        onChange={handleGlobalScan} 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
      />
      {/* Hidden InvoiceCard for Auto-sharing */}
      {sharingInvoiceId && (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', opacity: 0, pointerEvents: 'none' }}>
          {invoices.filter(i => i.id === sharingInvoiceId).map(invoice => (
            <InvoiceCard
              key={invoice.id}
              ref={sharingInvoiceRef}
              invoice={{ ...invoice, designType: globalDesignType }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
