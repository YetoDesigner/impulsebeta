import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Crown, X, Sparkles, Cloud, Camera, MessageSquare, Zap, Infinity, Shield } from 'lucide-react';
import { cn } from '../lib/utils';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PremiumModal({ isOpen, onClose }: PremiumModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/90 md:backdrop-blur-xl"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 40 }}
          className="relative w-full h-full md:h-auto md:max-w-lg lg:max-w-4xl bg-zinc-950 md:border md:border-white/10 md:rounded-[40px] overflow-hidden shadow-[0_0_50px_rgba(255,165,0,0.1)] md:max-h-[90vh] overflow-y-auto"
        >
          {/* Header con Gradiente */}
          <div className="relative h-40 md:h-36 bg-gradient-to-br from-orange-500 to-red-600 p-6 md:p-6 flex flex-col justify-end pb-8 md:pb-6">
            <div className="absolute top-6 right-6 md:top-5 md:right-5 z-10">
              <button onClick={onClose} className="p-2.5 md:p-2 bg-black/20 hover:bg-black/40 rounded-full transition-colors">
                <X size={20} className="text-white" />
              </button>
            </div>
            <div className="absolute top-3 left-6 w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
              <Crown size={20} className="text-white" />
            </div>
            <h2 className="text-xl font-black text-white tracking-tighter leading-tight">Elige tu plan perfecto</h2>
            <p className="text-white/80 font-bold text-[9px] uppercase tracking-widest mt-1">Potencia tu negocio con Impulse Ultra</p>
          </div>

          <div className="p-6 bg-zinc-950 space-y-4">

            {/* ═══════════════ PLAN GRATIS ═══════════════ */}
            <div className="p-4 rounded-3xl bg-zinc-900/50 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Plan Gratis</p>
                <span className="text-[9px] font-black text-zinc-600 bg-zinc-800 px-2.5 py-1 rounded-full uppercase tracking-widest">Actual</span>
              </div>
              <ul className="space-y-2">
                <li className="text-[10px] font-bold text-zinc-400 flex items-center gap-2">
                  <Check size={10} className="text-zinc-600 shrink-0" /> 50 Comprobantes de cobro / cotizaciones
                </li>
                <li className="text-[10px] font-bold text-zinc-400 flex items-center gap-2">
                  <Check size={10} className="text-zinc-600 shrink-0" /> 3 preguntas al día en Chat Bot
                </li>
                <li className="text-[10px] font-bold text-zinc-400 flex items-center gap-2">
                  <Check size={10} className="text-zinc-600 shrink-0" /> 3 escaneos de factura al día
                </li>
              </ul>
            </div>

            {/* ═══════════════ PLAN BÁSICO $8,000 ═══════════════ */}
            <div className="relative p-4 rounded-3xl bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <Zap size={12} className="text-blue-400" />
                    </div>
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Plan Básico</p>
                  </div>
                </div>

                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-2xl font-black text-white">$2 <span className="text-sm font-bold text-zinc-400">USD</span> / $8.000</span>
                  <span className="text-[10px] font-bold text-zinc-500">COP</span>
                </div>

                <ul className="space-y-2.5 mb-5">
                  <li className="text-[10px] font-black text-white flex items-center gap-2">
                    <Sparkles size={10} className="text-blue-400 shrink-0" /> 50 Comprobantes de cobro / cotizaciones
                  </li>
                  <li className="text-[10px] font-black text-white flex items-center gap-2">
                    <MessageSquare size={10} className="text-blue-400 shrink-0" /> 3 preguntas al día en Chat Bot
                  </li>
                  <li className="text-[10px] font-black text-white flex items-center gap-2">
                    <Camera size={10} className="text-blue-400 shrink-0" /> 5 escaneos de factura al día
                  </li>
                  <li className="text-[10px] font-black text-white flex items-center gap-2">
                    <Cloud size={10} className="text-blue-400 shrink-0" /> Sincronización en la Nube
                  </li>
                </ul>

                <button className="w-full bg-blue-500 hover:bg-blue-400 text-white py-3.5 rounded-[18px] font-black text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-blue-500/20 flex flex-col items-center">
                  <span>OBTENER BÁSICO</span>
                  <span className="text-[9px] font-bold text-blue-200/70 mt-0.5">Pago único</span>
                </button>
              </div>
            </div>

            {/* ═══════════════ PLAN ILIMITADO $30,000 ═══════════════ */}
            <div className="relative p-4 rounded-3xl bg-gradient-to-br from-orange-500/15 to-red-500/5 border border-orange-500/30 overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl" />
              <div className="absolute top-3 right-4">
                <span className="text-[8px] font-black text-orange-500 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-full uppercase tracking-widest flex items-center gap-1">
                  <Sparkles size={8} /> Recomendado
                </span>
              </div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <Crown size={12} className="text-orange-400" />
                  </div>
                  <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Plan Ilimitado</p>
                </div>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-2xl font-black text-white">$8 <span className="text-sm font-bold text-zinc-400">USD</span> / $30.000</span>
                  <span className="text-[10px] font-bold text-zinc-500">COP / mes</span>
                </div>
                <p className="text-[9px] font-bold text-zinc-500 mb-4">Sin límites. Control total de tu negocio.</p>

                <ul className="space-y-2.5 mb-5">
                  <li className="text-[10px] font-black text-white flex items-center gap-2">
                    <Infinity size={10} className="text-orange-500 shrink-0" /> Comprobantes de pago ilimitados
                  </li>
                  <li className="text-[10px] font-black text-white flex items-center gap-2">
                    <MessageSquare size={10} className="text-orange-500 shrink-0" /> Consultas ilimitadas en Chat Bot
                  </li>
                  <li className="text-[10px] font-black text-white flex items-center gap-2">
                    <Camera size={10} className="text-orange-500 shrink-0" /> Escáner ilimitado de facturas
                  </li>
                  <li className="text-[10px] font-black text-white flex items-center gap-2">
                    <Cloud size={10} className="text-orange-500 shrink-0" /> Sincronización en la Nube
                  </li>
                  <li className="text-[10px] font-black text-white flex items-center gap-2">
                    <Shield size={10} className="text-orange-500 shrink-0" /> Soporte prioritario
                  </li>
                </ul>

                <button className="w-full bg-white text-black py-4 rounded-[18px] font-black text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-white/10 flex flex-col items-center">
                  <span>OBTENER ILIMITADO</span>
                  <span className="text-[9px] font-bold text-zinc-500 mt-0.5">Pago mensual • Cancela cuando quieras</span>
                </button>
              </div>
            </div>

            <p className="text-center text-[8px] font-bold text-zinc-600 uppercase tracking-widest pt-1 pb-2">
              Pagos seguros • Activa al instante
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
