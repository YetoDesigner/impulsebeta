import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { Clock, AlertTriangle, CheckCircle2, User, Factory, Building2, Calendar, Plus, Trash2, Check, GripVertical, Edit2, X, CalendarPlus, MapPin, Phone, Users, Mic, Send } from 'lucide-react';
import { Invoice, Appointment } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { auth, db } from '../firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, writeBatch, orderBy } from 'firebase/firestore';

interface PendientesViewProps {
  invoices: Invoice[];
  onEditInvoice: (invoice: Invoice) => void;
  onUpdateInvoice: (id: string, updates: Partial<Invoice>) => void;
  onDeleteInvoice?: (id: string) => void;
}
export default function PendientesView({ invoices, onEditInvoice, onUpdateInvoice, onDeleteInvoice }: PendientesViewProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [newAppointment, setNewAppointment] = useState<{date: string, time: string, clientName: string, description: string, type: 'VISITA' | 'REUNIÓN' | 'LLAMADA'}>({ date: '', time: '', clientName: '', description: '', type: 'REUNIÓN' });
  const [selectedDayInfo, setSelectedDayInfo] = useState<{ day: number, invoices: Invoice[], appointments: Appointment[] } | null>(null);

  useEffect(() => {
    if (!auth.currentUser) {
      const saved = localStorage.getItem('impulse_appointments');
      if (saved) {
        try { setAppointments(JSON.parse(saved)); } catch (e) {}
      }
      return;
    }

    const qAppointments = query(collection(db, `users/${auth.currentUser.uid}/appointments`));
    const unsubAppointments = onSnapshot(qAppointments, (snapshot) => {
      const fetchedAppointments = snapshot.docs.map(doc => ({ ...doc.data() } as Appointment));
      setAppointments(fetchedAppointments);
    }, (error) => {
      console.error('PendientesView: Firestore appointments error:', error);
    });

    return () => unsubAppointments();
  }, []);

  useEffect(() => {
    localStorage.setItem('impulse_appointments', JSON.stringify(appointments));
  }, [appointments]);

  useEffect(() => {
    const nav = document.getElementById('mobile-bottom-nav');
    if (nav) {
      if (isAppointmentModalOpen) {
        nav.style.display = 'none';
      } else {
        nav.style.display = '';
      }
    }
    return () => {
      if (nav) nav.style.display = '';
    }
  }, [isAppointmentModalOpen]);

  const pendingInvoices = useMemo(() => {
    return invoices
      .filter(inv => inv.status !== 'PAGADO' && inv.type === 'FACTURA')
      .map(inv => {
        const rawDate = inv.deliveryDate ? new Date(inv.deliveryDate) : new Date();
        const deliveryDateObj = isNaN(rawDate.getTime()) ? new Date() : rawDate;
        const deliveryTimer = deliveryDateObj.getTime();
        const now = new Date().getTime();
        const isOverdue = deliveryTimer < now;
        const diffHours = Math.abs((deliveryTimer - now) / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        
        let timeString = '';
        if (diffDays > 0) {
          timeString = `${diffDays} día(s)`;
        } else {
          timeString = `${Math.floor(diffHours)} hora(s)`;
        }

        return { ...inv, isOverdue, timeString, deliveryTimer, diffDays, diffHours, deliveryDateObj };
      })
      .sort((a, b) => a.deliveryTimer - b.deliveryTimer);
  }, [invoices]);

  // Calendar Logic
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday
  
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay === 0 ? 6 : firstDay - 1 }, (_, i) => i); // Adjust if Monday is first

  const getDayStatus = (day: number) => {
    const dayInvoices = pendingInvoices.filter(inv => 
      inv.deliveryDateObj.getDate() === day &&
      inv.deliveryDateObj.getMonth() === currentMonth &&
      inv.deliveryDateObj.getFullYear() === currentYear
    );
    
    const dayAppointments = appointments.filter(app => {
      const d = new Date(app.date);
      return d.getDate() === day && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    return { 
      hasDelivery: dayInvoices.length > 0, 
      hasAppointment: dayAppointments.length > 0,
      invoices: dayInvoices,
      appointments: dayAppointments
    };
  };

  const handleDayClick = (day: number) => {
    const status = getDayStatus(day);
    if (status.hasDelivery || status.hasAppointment) {
      setSelectedDayInfo({ day, invoices: status.invoices, appointments: status.appointments });
    } else {
      setSelectedDayInfo(null);
    }
  };

  const saveAppointmentToFirebase = async (appointment: Appointment) => {
    if (auth.currentUser && auth.currentUser.uid !== 'local-user') {
      try {
        await setDoc(doc(db, `users/${auth.currentUser.uid}/appointments`, appointment.id), appointment);
      } catch (e) {
        console.error("Error saving appointment:", e);
      }
    } else {
      setAppointments([...appointments, appointment]);
    }
  };

  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppointment.date || !newAppointment.clientName) return;

    const dateObj = new Date(`${newAppointment.date}T${newAppointment.time || '12:00'}`);
    const appointment: Appointment = {
      id: Date.now().toString(),
      date: dateObj.toISOString(),
      clientName: newAppointment.clientName,
      description: newAppointment.description,
      type: newAppointment.type,
    };

    await saveAppointmentToFirebase(appointment);
    setIsAppointmentModalOpen(false);
    setNewAppointment({ date: '', time: '', clientName: '', description: '', type: 'REUNIÓN' });
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight mb-1">Entregas Pendientes</h2>
          <p className="text-zinc-500 font-bold text-xs">Prioriza pedidos y organiza tus recordatorios diarios.</p>
        </div>
      </div>

      <div className="flex flex-col xl:grid xl:grid-cols-3 gap-6">
        
        {/* Calendar Widget (Moves to top on mobile) */}
        <div className="order-1 xl:order-2 xl:col-span-1">
          <div className="bg-zinc-900 rounded-[32px] p-6 border border-zinc-800 shadow-xl h-fit mb-4">
            <button
              onClick={() => setIsAppointmentModalOpen(true)}
              className="w-full mb-4 bg-cyan-500 hover:bg-cyan-600 text-black rounded-full py-2.5 px-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
            >
              <CalendarPlus size={16} /> Agendar Cita con Cliente
            </button>
            <h3 className="text-sm font-black mb-4 uppercase tracking-widest flex items-center gap-2">
              <Calendar size={16} className="text-zinc-500" />
              {monthNames[currentMonth]} {currentYear}
            </h3>
            <div className="grid grid-cols-7 gap-1 mb-2 text-center">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => (
                <div key={d} className="text-[10px] font-black text-zinc-500">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {blanks.map(b => (
                <div key={`blank-${b}`} className="aspect-square rounded-lg bg-zinc-950/30" />
              ))}
              {days.map(day => {
                const isToday = day === today.getDate();
                const status = getDayStatus(day);
                const hasEvent = status.hasDelivery || status.hasAppointment;
                
                return (
                  <div 
                    key={day} 
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      "aspect-square rounded-lg flex items-center justify-center text-xs font-bold relative transition-all",
                      isToday ? "bg-white text-black shadow-lg shadow-white/20" : "bg-zinc-950 text-zinc-400",
                      hasEvent ? "cursor-pointer hover:bg-zinc-800" : ""
                    )}
                  >
                    {day}
                    {hasEvent && (
                      <div className="absolute top-1 right-1 flex gap-0.5">
                        {status.hasDelivery && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />}
                        {status.hasAppointment && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Upcoming Appointments */}
            <div className="mt-6 border-t border-zinc-800 pt-4">
              <h3 className="text-sm font-black mb-3 uppercase tracking-widest flex items-center gap-2 text-cyan-500">
                <Users size={16} /> Próximas Citas
              </h3>
              <div className="space-y-2 max-h-[150px] overflow-y-auto scrollbar-hide">
                {appointments.filter(app => new Date(app.date).getTime() >= new Date().setHours(0,0,0,0))
                  .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .slice(0, 5)
                  .map(app => (
                    <div key={app.id} className="bg-zinc-950 rounded-xl p-3 border border-zinc-800 flex justify-between items-center group cursor-pointer hover:border-zinc-700 transition" onClick={() => {
                        const date = new Date(app.date);
                        handleDayClick(date.getDate());
                    }}>
                       <div>
                          <h4 className="text-xs font-bold truncate max-w-[120px]">{app.clientName}</h4>
                          <p className="text-[10px] text-zinc-500 truncate">{app.type} - {new Date(app.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                       </div>
                       <div className="text-right">
                          <span className="text-[10px] font-black text-cyan-500 bg-cyan-500/10 px-2 py-1 rounded-lg uppercase">{new Date(app.date).toLocaleDateString([], {day:'2-digit', month:'short'})}</span>
                       </div>
                    </div>
                ))}
                {appointments.filter(app => new Date(app.date).getTime() >= new Date().setHours(0,0,0,0)).length === 0 && (
                  <p className="text-[10px] font-bold text-zinc-600 uppercase text-center py-2">Sin citas próximas</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Left Side: Orders (Middle on mobile, Left on Desktop) */}
        <div className="order-2 xl:order-1 xl:col-span-2 xl:row-span-2 space-y-6">
          {pendingInvoices.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center bg-zinc-900/50 rounded-[32px] border border-zinc-800">
               <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4 border border-zinc-800">
                 <CheckCircle2 size={24} className="opacity-20" />
               </div>
               <h3 className="text-xl font-black opacity-40">¡Todo al día!</h3>
               <p className="text-xs font-bold text-zinc-500 mt-2">No hay entregas pendientes en este momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AnimatePresence mode="popLayout">
                {pendingInvoices.map((item) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key={item.id}
                    className={cn(
                      "p-5 rounded-[32px] border transition-all flex flex-col",
                      item.isOverdue 
                        ? "bg-red-500/5 border-red-500/20" 
                        : item.diffDays <= 1 
                          ? "bg-orange-500/5 border-orange-500/20"
                          : "bg-zinc-900 border-zinc-800"
                    )}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex gap-3">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center",
                          item.isOverdue ? "bg-red-500/10" : item.diffDays <= 1 ? "bg-orange-500/10" : "bg-black/5 dark:bg-white/5"
                        )}>
                          {item.isOverdue ? (
                            <AlertTriangle size={20} className="text-red-500" />
                          ) : (
                            <Clock size={20} className={item.diffDays <= 1 ? "text-orange-500" : "text-zinc-500"} />
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-black opacity-50 uppercase tracking-widest">{item.id}</p>
                          <h3 className="text-lg font-black truncate max-w-[150px]">{item.clientName}</h3>
                        </div>
                      </div>
                      
                      <div className="text-right">
                         <p className="text-[8px] font-black opacity-50 uppercase tracking-widest mb-0.5">
                           {item.isOverdue ? 'Atrasado por' : 'Entregar en'}
                         </p>
                         <p className={cn(
                           "text-sm font-black",
                           item.isOverdue ? "text-red-500" : item.diffDays <= 1 ? "text-orange-500" : "text-zinc-400"
                         )}>
                           {item.timeString}
                         </p>
                      </div>
                    </div>

                    <div className="bg-black/5 dark:bg-zinc-950/50 p-4 rounded-2xl mb-4 flex-1">
                       <div className="flex justify-between items-center mb-2">
                         <p className="text-[10px] font-bold text-zinc-500 flex items-center gap-1.5"><Calendar size={12} /> {item.deliveryDateObj instanceof Date && !isNaN(item.deliveryDateObj.getTime()) ? format(item.deliveryDateObj, "dd/MM/yyyy h:mm a", { locale: es }) : '—'}</p>
                         <p className="text-xs font-black">${(Number(item.remainingAmount) || 0).toLocaleString()}</p>
                       </div>
                       <div className="flex gap-2 flex-wrap mt-3">
                         {(item.items || []).slice(0, 2).map((prod, i) => (
                           <span key={i} className="text-[9px] font-bold px-2 py-1 bg-white/10 dark:bg-white/5 rounded-lg truncate max-w-[120px]">
                             {prod.quantity}x {prod.description}
                           </span>
                         ))}
                       </div>
                    </div>

                    {item.isOverdue && (
                      <div className="mt-auto space-y-2">
                        <p className="text-[9px] font-black opacity-50 uppercase tracking-widest px-2">Causa del Atraso:</p>
                        <div className="grid grid-cols-3 gap-2">
                          <button 
                            onClick={() => onUpdateInvoice(item.id, { delayReason: 'INTERNO' })}
                            className={cn("py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex flex-col items-center gap-1 transition-all", item.delayReason === 'INTERNO' ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "bg-black/5 dark:bg-zinc-950 hover:bg-black/10 dark:hover:bg-zinc-900 border border-white/5")}
                          >
                            <Building2 size={12} /> Empresa
                          </button>
                          <button 
                            onClick={() => onUpdateInvoice(item.id, { delayReason: 'CLIENTE' })}
                            className={cn("py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex flex-col items-center gap-1 transition-all", item.delayReason === 'CLIENTE' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-black/5 dark:bg-zinc-950 hover:bg-black/10 dark:hover:bg-zinc-900 border border-white/5")}
                          >
                            <User size={12} /> Cliente
                          </button>
                          <button 
                            onClick={() => onUpdateInvoice(item.id, { delayReason: 'PROVEEDOR' })}
                            className={cn("py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex flex-col items-center gap-1 transition-all", item.delayReason === 'PROVEEDOR' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "bg-black/5 dark:bg-zinc-950 hover:bg-black/10 dark:hover:bg-zinc-900 border border-white/5")}
                          >
                            <Factory size={12} /> Proveedor
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-4 flex gap-2">
                      <button 
                        onClick={() => onEditInvoice(item)}
                        className="flex-1 py-3 bg-white text-black dark:bg-white dark:text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-colors"
                      >
                        Ver Detalles
                      </button>
                      {onDeleteInvoice && (
                        <button 
                          onClick={() => {
                            if (window.confirm("¿Estás seguro de eliminar esta factura?")) {
                              onDeleteInvoice(item.id);
                            }
                          }}
                          className="py-3 px-4 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl transition-colors"
                          title="Eliminar factura"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

      </div>

      {/* Modal Nueva Cita */}
      <AnimatePresence>
        {isAppointmentModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 w-full max-w-md shadow-2xl relative"
            >
              <button 
                onClick={() => setIsAppointmentModalOpen(false)}
                className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>

              <h2 className="text-2xl font-black mb-6">Agendar Cita</h2>

              <form onSubmit={handleSaveAppointment} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Tipo de Cita</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['VISITA', 'REUNIÓN', 'LLAMADA'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewAppointment({...newAppointment, type: t})}
                        className={cn(
                          "py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex flex-col items-center gap-1",
                          newAppointment.type === t ? "bg-cyan-500 text-black border-cyan-500 shadow-lg shadow-cyan-500/20" : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-600"
                        )}
                      >
                        {t === 'VISITA' ? <MapPin size={14} /> : t === 'LLAMADA' ? <Phone size={14} /> : <Users size={14} />}
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Fecha y Hora</label>
                  <div className="grid grid-cols-2 gap-4">
                    <input 
                      type="date"
                      required
                      value={newAppointment.date}
                      onChange={e => setNewAppointment({...newAppointment, date: e.target.value})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-white transition-colors"
                    />
                    <input 
                      type="time"
                      value={newAppointment.time}
                      onChange={e => setNewAppointment({...newAppointment, time: e.target.value})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-white transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Nombre del Cliente</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ej. Juan Pérez"
                    value={newAppointment.clientName}
                    onChange={e => setNewAppointment({...newAppointment, clientName: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Descripción o Motivo</label>
                  <textarea 
                    placeholder="Ej. Revisión de cotización..."
                    value={newAppointment.description}
                    onChange={e => setNewAppointment({...newAppointment, description: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-white transition-colors min-h-[100px] resize-none"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-white text-black rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-zinc-200 transition-colors mt-6"
                >
                  Guardar Cita
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Detalle del Día */}
      <AnimatePresence>
        {selectedDayInfo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 w-full max-w-md shadow-2xl relative max-h-[80vh] overflow-y-auto scrollbar-hide"
            >
              <button 
                onClick={() => setSelectedDayInfo(null)}
                className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>

              <h2 className="text-2xl font-black mb-6">Día {selectedDayInfo.day}</h2>

              {selectedDayInfo.appointments.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-cyan-500 mb-4 flex items-center gap-2">
                    <User size={14} /> Citas Programadas
                  </h3>
                  <div className="space-y-3">
                    {selectedDayInfo.appointments.map(app => (
                      <div key={app.id} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-500 flex items-center justify-center">
                              {app.type === 'VISITA' ? <MapPin size={12} /> : app.type === 'LLAMADA' ? <Phone size={12} /> : <Users size={12} />}
                            </div>
                            <h4 className="font-bold text-sm">{app.clientName}</h4>
                          </div>
                          <span className="text-[10px] font-black text-zinc-500 uppercase">
                            {new Date(app.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        {app.description && (
                          <p className="text-xs text-zinc-400 mt-2">{app.description}</p>
                        )}
                        <button 
                          onClick={async () => {
                            if (auth.currentUser) {
                              await deleteDoc(doc(db, `users/${auth.currentUser.uid}/appointments`, app.id));
                            } else {
                              setAppointments(appointments.filter(a => a.id !== app.id));
                            }
                            setSelectedDayInfo({
                              ...selectedDayInfo,
                              appointments: selectedDayInfo.appointments.filter(a => a.id !== app.id)
                            });
                          }}
                          className="mt-3 text-[10px] font-black uppercase text-red-500 hover:text-red-400 transition-colors"
                        >
                          Eliminar Cita
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedDayInfo.invoices.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-4 flex items-center gap-2">
                    <Factory size={14} /> Entregas Pendientes
                  </h3>
                  <div className="space-y-3">
                    {selectedDayInfo.invoices.map(inv => (
                      <div key={inv.id} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-sm">{inv.clientName}</h4>
                          <span className="text-[10px] font-black text-zinc-500 uppercase">
                            {inv.type}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mb-3">ID: {inv.id}</p>
                        <button 
                          onClick={() => {
                            setSelectedDayInfo(null);
                            onEditInvoice(inv);
                          }}
                          className="w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                        >
                          Ver Detalles de Entrega
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedDayInfo.appointments.length === 0 && selectedDayInfo.invoices.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-xs font-bold text-zinc-500">No hay eventos para este día.</p>
                </div>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
