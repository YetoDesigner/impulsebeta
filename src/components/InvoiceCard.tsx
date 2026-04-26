import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Download, Pencil, Trash2, QrCode, Share2, MapPin } from 'lucide-react';

import { toPng } from 'html-to-image';
import { saveAs } from 'file-saver';
import { Invoice } from '../types';
import { cn } from '../lib/utils';

const WhatsappIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5" />
  </svg>
);

// Safe date helpers — prevent crashes when dates are undefined/invalid
const safeDate = (val: any): Date | null => {
  if (!val) return null;
  const d = new Date(val);
  return isValid(d) ? d : null;
};

const safeFormat = (val: any, fmt: string, opts?: any): string => {
  try {
    const d = safeDate(val);
    if (!d) return '—';
    return format(d, fmt, opts);
  } catch {
    return '—';
  }
};

const safeAmount = (qty: any, price: any): number => {
  const q = Number(qty) || 0;
  const p = Number(price) || 0;
  return q * p;
};

interface InvoiceCardProps {
  invoice: Invoice;
  onClick?: () => void;
  onDelete?: () => void;
}

export interface InvoiceCardRef {
  share: () => Promise<void>;
}

const InvoiceCard = React.forwardRef<InvoiceCardRef, InvoiceCardProps>(({ invoice, onClick, onDelete }, ref) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [showActions, setShowActions] = useState(false);

  const {
    id,
    type,
    date,
    companyName,
    nit,
    companyPhone,
    companyAddress,
    clientName,
    clientPhone,
    clientNit,
    clientAddress,
    items,
    deliveryDate,
    status,
    total,
    remainingAmount,
    logoUrl,
    gradientFrom,
    gradientTo,
    textColor,
    accentColor,
    designType,
  } = invoice;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cardRef.current === null) return;

    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: designType === 'TICKET' ? null : undefined,
        style: {
          transform: 'scale(1)',
          borderRadius: designType === 'TICKET' ? '0px' : '40px',
        },
        filter: (node) => {
          // Filtrar botones de acción para que no aparezcan en la imagen
          if (node.tagName === 'BUTTON') return false;
          // Filtrar por clases si es necesario
          if (node.classList && typeof node.classList.contains === 'function') {
            if (node.classList.contains('action-buttons-overlay')) return false;
          }
          return true;
        }
      });
      saveAs(dataUrl, `${type.toLowerCase()}-${clientName}-${id}.png`);
    } catch (err) {
      console.error('Error al descargar la factura:', err);
    }
  };

  React.useImperativeHandle(ref, () => ({
    share: async () => {
      if (cardRef.current) {
        // we can call handleShare logic directly
        // handleShare expects an event, but we can make the event optional
        await handleShare();
      }
    }
  }));

  const handleShare = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (cardRef.current === null) return;

    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: designType === 'TICKET' ? null : undefined,
        style: {
          transform: 'scale(1)',
          borderRadius: designType === 'TICKET' ? '0px' : '40px',
        },
        filter: (node) => {
          if (node.tagName === 'BUTTON') return false;
          if (node.classList && typeof node.classList.contains === 'function') {
            if (node.classList.contains('action-buttons-overlay')) return false;
          }
          return true;
        }
      });

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${type.toLowerCase()}-${clientName}.png`, { type: 'image/png' });

      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: `Cuenta de Cobro - ${clientName}`,
          text: `Aquí tienes la cuenta de cobro de ${companyName}`,
        });
      } else {
        // Fallback for browsers that don't support file sharing
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type.toLowerCase()}-${clientName}.png`;
        a.click();
        alert("Tu navegador no soporta compartir archivos directamente. Se ha descargado la imagen.");
      }
    } catch (err) {
      console.error('Error al compartir:', err);
      alert("Hubo un error al intentar compartir el documento.");
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) onClick();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && window.confirm("¿Estás seguro de eliminar esta factura?")) {
      onDelete();
    }
  };

  if (designType === 'TICKET') {
    return (
      <div className="relative group h-full">
        {/* Action Buttons Overlay - Unified style */}
        <div className={cn(
          "action-buttons-overlay absolute top-4 right-4 flex flex-col gap-2 z-30 transition-all duration-300",
          "lg:opacity-0 lg:group-hover:opacity-100",
          showActions ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 lg:translate-y-0"
        )}>
          <button onClick={handleEdit} className="p-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full text-zinc-600 dark:text-zinc-300 transition-all backdrop-blur-md shadow-sm border border-zinc-200 dark:border-zinc-700">
            <Pencil size={16} />
          </button>
          <button onClick={handleShare} className="p-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full text-zinc-600 dark:text-zinc-300 transition-all backdrop-blur-md shadow-sm border border-zinc-200 dark:border-zinc-700">
            <Share2 size={16} />
          </button>
          <button onClick={handleDownload} className="p-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full text-zinc-600 dark:text-zinc-300 transition-all backdrop-blur-md shadow-sm border border-zinc-200 dark:border-zinc-700">
            <Download size={16} />
          </button>
          <button onClick={handleDelete} className="p-2.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-full text-red-500 dark:text-red-400 transition-all backdrop-blur-md shadow-sm border border-red-200 dark:border-red-500/20">
            <Trash2 size={16} />
          </button>
        </div>

        <motion.div
          ref={cardRef}
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={(e) => {
            if (window.innerWidth < 1024) setShowActions(!showActions);
            else if (onClick) onClick();
          }}
        className={cn(
          "relative w-full max-w-[400px] mx-auto p-6 shadow-xl flex flex-col font-mono overflow-hidden transition-colors duration-300 rounded-lg",
          "bg-white text-black dark:bg-zinc-950 dark:text-white border border-zinc-200 dark:border-zinc-800"
        )}
        style={{ 
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0,0,0,0.03) 1px, transparent 0)',
          backgroundSize: '16px 16px'
        }}
      >
        {/* Shop Info - Centered */}
        <div className="flex flex-col items-center justify-center mb-6 pt-2">
          <div className="w-16 h-16 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-zinc-800 mb-3 shadow-sm">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-2xl font-black italic">U</span>
            )}
          </div>
          <h2 className="text-sm font-black uppercase tracking-widest leading-tight text-center">{companyName}</h2>
          <p className="text-[10px] font-bold opacity-60 tracking-[0.2em] mt-1">NIT: {nit}</p>
          {companyPhone && (
            <p className="text-[10px] font-bold opacity-60 tracking-[0.2em] flex items-center justify-center gap-1 mt-0.5">
              <WhatsappIcon size={12} /> {companyPhone}
            </p>
          )}
          {companyAddress && (
            <p className="text-[10px] font-bold opacity-60 tracking-[0.2em] flex items-center justify-center gap-1 mt-0.5">
              <MapPin size={12} /> {companyAddress}
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-zinc-300 dark:border-zinc-700 my-4" />
        <p className="text-center text-xs font-black uppercase tracking-[0.3em] opacity-90 my-2">
          {type === 'COTIZACIÓN' ? 'COTIZACIÓN' : 'CUENTA DE COBRO'}
        </p>
        <div className="border-t border-dashed border-zinc-300 dark:border-zinc-700 my-4" />

        {/* Client & Date Info */}
        <div className="space-y-3 mb-6 text-xs">
          <div className="flex justify-between items-center">
            <span className="font-bold opacity-50 uppercase tracking-widest text-[10px]">Cliente:</span>
            <span className="font-black uppercase">{clientName}</span>
          </div>
          {clientPhone && (
            <div className="flex justify-between items-center">
              <span className="font-bold opacity-50 uppercase tracking-widest text-[10px] flex items-center gap-1"><WhatsappIcon size={12} /> WhatsApp:</span>
              <span className="font-black uppercase">{clientPhone}</span>
            </div>
          )}
          {clientNit && (
            <div className="flex justify-between items-center">
              <span className="font-bold opacity-50 uppercase tracking-widest text-[10px]">NIT/ID:</span>
              <span className="font-black uppercase">{clientNit}</span>
            </div>
          )}
          {clientAddress && (
            <div className="flex justify-between items-center">
              <span className="font-bold opacity-50 uppercase tracking-widest text-[10px] flex items-center gap-1"><MapPin size={12} /> Dir:</span>
              <span className="font-black uppercase">{clientAddress}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="font-bold opacity-50 uppercase tracking-widest text-[10px]">Fecha:</span>
            <span className="font-black">{safeFormat(date, "dd/MM/yyyy")}</span>
          </div>
        </div>

        {/* Items Header */}
        <div className="grid grid-cols-6 text-[10px] font-black opacity-50 uppercase tracking-widest pb-3 mb-3 border-b border-dashed border-zinc-300 dark:border-zinc-700">
          <span className="col-span-1 text-center">CANT</span>
          <span className="col-span-3">DESCRIPCIÓN</span>
          <span className="col-span-2 text-right">PRECIO</span>
        </div>

        {/* Items */}
        <div className="space-y-3 mb-6">
          {(items || []).map((item) => (
            <div key={item.id} className="grid grid-cols-6 text-xs items-start">
              <span className="col-span-1 text-center font-black">{item.quantity}</span>
              <span className="col-span-3 font-bold pr-2 leading-tight uppercase">{item.description}</span>
              <span className="col-span-2 text-right font-black">${safeAmount(item.quantity, item.salePrice).toLocaleString('es-CO')}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-zinc-300 dark:border-zinc-700 my-4" />

        {/* Totals */}
        <div className="flex justify-between items-center mb-6 mt-2">
          <span className="text-sm font-black uppercase tracking-[0.2em]">Total:</span>
          <span className="text-lg font-black">${(Number(total) || 0).toLocaleString('es-CO')}</span>
        </div>

        {type !== 'COTIZACIÓN' && status !== 'PAGADO' && (
          <div className="flex justify-between items-center mb-6 mt-2 opacity-60">
            <span className="text-xs font-bold uppercase tracking-[0.2em]">Restante:</span>
            <span className="text-sm font-bold">${(Number(remainingAmount) || 0).toLocaleString('es-CO')}</span>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 flex flex-col items-center">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] mb-6">
            {type === 'COTIZACIÓN' ? 'Esperamos trabajar juntos muy pronto.' : '¡GRACIAS POR SU COMPRA!'}
          </p>
          
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="p-2 bg-white rounded-2xl shadow-sm border border-zinc-200">
              <QrCode size={48} strokeWidth={1.5} className="text-black" />
            </div>
            <div className="text-left flex flex-col justify-center">
              <p className="text-[8px] font-black opacity-40 uppercase tracking-widest mb-1">Verificar en</p>
              <p className="text-[10px] font-bold opacity-60">impulseultra.vercel.app</p>
            </div>
          </div>

          {/* Barcode representation */}
          <div className="w-full flex justify-center items-end gap-[2px] h-12 opacity-30 mb-2">
            {Array.from({ length: 50 }).map((_, i) => (
              <div 
                key={i} 
                className="bg-current" 
                style={{ 
                  width: i % 3 === 0 ? '3px' : i % 5 === 0 ? '2px' : '1px', 
                  height: `${60 + Math.random() * 40}%` 
                }} 
              />
            ))}
          </div>
          <p className="text-[8px] tracking-[0.5em] opacity-40 font-black">
            1 0 y h y 9 p y u
          </p>
        </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative group h-full">
      <div className="absolute -inset-1 bg-gradient-to-r from-white/10 to-transparent rounded-[42px] blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
      <motion.div
        ref={cardRef}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -5 }}
        whileTap={{ scale: 0.99 }}
        onClick={(e) => {
          if (window.innerWidth < 1024) setShowActions(!showActions);
          else if (onClick) onClick();
        }}
        className={cn(
          "relative w-full max-w-md mx-auto rounded-[40px] p-7 overflow-hidden cursor-pointer",
          "shadow-2xl transition-all duration-300 border border-white/5 flex flex-col min-h-[450px]"
        )}
        style={{
          background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
          color: textColor,
        }}
      >
        {/* Header Row: Date on left, Badge on right */}
        <div className="flex justify-between items-start mb-6 shrink-0 relative z-20">
          <p className="text-[9px] uppercase tracking-[0.2em] font-bold opacity-60">
            {safeFormat(date, "d 'DE' MMMM 'DE' yyyy", { locale: es })}
          </p>
          
          {/* Header Badge - White capsule, red text, top-right, smaller */}
          <div className="bg-white px-2.5 py-1 rounded-full shadow-lg border border-black/5">
            <span className="text-red-600 text-[6px] font-black tracking-widest uppercase">
              {type === 'COTIZACIÓN' ? 'COTIZACIÓN' : 'CUENTA DE COBRO'}
            </span>
          </div>
        </div>

        {/* Action Buttons Overlay - Top right, absolute */}
        <div className={cn(
          "action-buttons-overlay absolute top-12 right-6 flex flex-col gap-2 z-30 transition-all duration-300",
          "lg:opacity-0 lg:group-hover:opacity-100",
          showActions ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 lg:translate-y-0"
        )}>
          <button onClick={handleEdit} className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-all backdrop-blur-md border border-white/20 shadow-lg">
            <Pencil size={14} />
          </button>
          <button onClick={handleShare} className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-all backdrop-blur-md border border-white/20 shadow-lg">
            <Share2 size={14} />
          </button>
          <button onClick={handleDownload} className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-all backdrop-blur-md border border-white/20 shadow-lg">
            <Download size={14} />
          </button>
          <button onClick={handleDelete} className="p-2 bg-red-500/20 hover:bg-red-500/40 rounded-full text-white hover:text-red-200 transition-all backdrop-blur-md border border-red-500/20 shadow-lg">
            <Trash2 size={14} />
          </button>
        </div>

        {/* Company Info */}
        <div className="flex items-center gap-3 mb-6 relative z-10">
          <div 
            className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white shadow-lg overflow-hidden shrink-0"
            style={{ color: accentColor }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-black italic">U</span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-black uppercase tracking-wider truncate">{companyName}</h3>
            <div className="text-[9px] opacity-60 font-bold flex flex-wrap items-center gap-1.5">
              <span>NIT: {nit}</span>
              {companyPhone && <span className="flex items-center gap-0.5"><WhatsappIcon size={8} /> {companyPhone}</span>}
              {companyAddress && <span className="flex items-center gap-0.5"><MapPin size={8} /> {companyAddress}</span>}
            </div>
          </div>
        </div>

        {/* Client Name */}
        <div className="mb-8 relative z-10">
          <h2 className="text-3xl font-black leading-tight tracking-tight">
            {clientName}
          </h2>
          <div className="flex flex-wrap gap-3 mt-2 text-[10px] font-bold opacity-60 tracking-widest">
            {clientNit && <span>NIT: {clientNit}</span>}
            {clientPhone && <span className="flex items-center gap-1"><WhatsappIcon size={12} /> {clientPhone}</span>}
            {clientAddress && <span className="flex items-center gap-1"><MapPin size={12} /> {clientAddress}</span>}
          </div>
        </div>

        {/* Items List */}
        <div className="space-y-2 mb-6 flex-1 relative z-10">
          {(items || []).map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <span className="text-[10px] font-black opacity-40 shrink-0 mt-1">{item.quantity}</span>
                <span className="text-base font-bold tracking-tight">{item.description}</span>
              </div>
              <span className="text-xs font-bold opacity-60 shrink-0 mt-1">${safeAmount(item.quantity, item.salePrice).toLocaleString('es-CO')}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-[1px] w-full bg-current opacity-10 mb-6 shrink-0 relative z-10" />

        {/* Footer Info */}
        <div className="flex justify-between items-end mt-auto shrink-0 relative z-10">
          <div className="space-y-3">
            <div>
              <p className="text-[9px] uppercase font-black opacity-40 tracking-widest mb-0.5">FECHA ENTREGA</p>
              <p className="text-xs font-black uppercase">
                {safeFormat(deliveryDate, "dd/MM/yyyy h:mm a", { locale: es })}
              </p>
            </div>
            {type !== 'COTIZACIÓN' && (
              <div>
                <p className="text-[9px] uppercase font-black opacity-40 tracking-widest mb-0.5">ESTADO</p>
                <p className="text-lg font-black tracking-tight uppercase">{status}</p>
              </div>
            )}
          </div>

          {/* Totals Box */}
          <div className="bg-black/20 backdrop-blur-md rounded-3xl p-4 min-w-[120px] text-right">
            <div className={cn("mb-3", status === 'PAGADO' || type === 'COTIZACIÓN' ? "mb-0" : "mb-3")}>
              <p className="text-[7px] font-black opacity-40 tracking-widest mb-0.5">TOTAL</p>
              <p className="text-xl font-black leading-none">
                ${(Number(total) || 0).toLocaleString('es-CO')}
              </p>
            </div>
            {type !== 'COTIZACIÓN' && status !== 'PAGADO' && (
              <div>
                <p className="text-[7px] font-black opacity-40 tracking-widest mb-0.5">RESTANTE</p>
                <p className="text-base font-black leading-none opacity-80">
                  ${(Number(remainingAmount) || 0).toLocaleString('es-CO')}
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default InvoiceCard;
