import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Download, Pencil, Trash2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { saveAs } from 'file-saver';
import { Invoice } from '../types';
import { cn } from '../lib/utils';

interface InvoiceCardProps {
  invoice: Invoice;
  onClick?: () => void;
  onDelete?: () => void;
}

const InvoiceCard: React.FC<InvoiceCardProps> = ({ invoice, onClick, onDelete }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [showActions, setShowActions] = useState(false);
  const {
    id,
    type,
    date,
    companyName,
    nit,
    clientName,
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
  } = invoice;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cardRef.current === null) return;

    try {
      // Ensure the element is visible and rendered
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 3, // Higher quality
        backgroundColor: null,
        style: {
          transform: 'scale(1)', // Ensure no scaling issues
          borderRadius: '40px',
        }
      });
      saveAs(dataUrl, `${type.toLowerCase()}-${clientName}-${id}.png`);
    } catch (err) {
      console.error('Error al descargar la factura:', err);
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
          // On mobile/tablet, toggle actions instead of opening edit
          if (window.innerWidth < 1024) {
            setShowActions(!showActions);
          } else if (onClick) {
            onClick();
          }
        }}
        className={cn(
          "relative w-full max-w-md mx-auto rounded-[40px] p-7 overflow-hidden cursor-pointer",
          "shadow-2xl transition-all duration-300 border border-white/5 flex flex-col h-full"
        )}
        style={{
          background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
          color: textColor,
        }}
      >
        {/* Date Header */}
        <div className="flex justify-between items-center mb-6">
          <p className="text-[9px] uppercase tracking-[0.2em] font-bold opacity-60">
            {format(new Date(date), "d 'DE' MMMM 'DE' yyyy", { locale: es })}
          </p>
          <div 
            className="px-3 py-1 rounded-full text-[8px] font-black tracking-widest"
            style={{ backgroundColor: accentColor, color: gradientFrom }}
          >
            {type}
          </div>
        </div>

        {/* Company Info */}
        <div className="flex items-center gap-3 mb-6">
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
            <p className="text-[9px] opacity-60 font-bold truncate">NIT: {nit}</p>
          </div>
        </div>

        {/* Client Name */}
        <div className="mb-8">
          <h2 className="text-3xl font-black leading-tight tracking-tight">
            {clientName}
          </h2>
        </div>

        {/* Items List */}
        <div className="space-y-2 mb-6 flex-1">
          {items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <span className="text-[10px] font-black opacity-40 shrink-0 mt-1">{item.quantity}</span>
                <span className="text-base font-bold tracking-tight">{item.description}</span>
              </div>
              <span className="text-xs font-bold opacity-60 shrink-0 mt-1">${(item.quantity * item.salePrice).toLocaleString('es-CO')}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-[1px] w-full bg-current opacity-10 mb-6 shrink-0" />

        {/* Footer Info */}
        <div className="flex justify-between items-end mt-auto shrink-0">
          <div className="space-y-3">
            <div>
              <p className="text-[9px] uppercase font-black opacity-40 tracking-widest mb-0.5">FECHA ENTREGA</p>
              <p className="text-xs font-black uppercase">
                {format(new Date(deliveryDate), "dd/MM/yyyy h:mm a", { locale: es })}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase font-black opacity-40 tracking-widest mb-0.5">ESTADO</p>
              <p className="text-lg font-black tracking-tight uppercase">{status}</p>
            </div>
          </div>

          {/* Totals Box */}
          <div className="bg-black/20 backdrop-blur-md rounded-3xl p-4 min-w-[120px] text-right">
            <div className={cn("mb-3", status === 'PAGADO' ? "mb-0" : "mb-3")}>
              <p className="text-[7px] font-black opacity-40 tracking-widest mb-0.5">TOTAL</p>
              <p className="text-xl font-black leading-none">
                ${total.toLocaleString('es-CO')}
              </p>
            </div>
            {status !== 'PAGADO' && (
              <div>
                <p className="text-[7px] font-black opacity-40 tracking-widest mb-0.5">RESTANTE</p>
                <p className="text-base font-black leading-none opacity-80">
                  ${remainingAmount.toLocaleString('es-CO')}
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Action Buttons - Visible on hover (Desktop) or toggle (Mobile) */}
      <div className={cn(
        "absolute top-12 right-4 flex gap-2 z-10 transition-all duration-300",
        "lg:opacity-0 lg:group-hover:opacity-100",
        showActions ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 lg:translate-y-0"
      )}>
        <button
          onClick={handleEdit}
          className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all"
          title="Editar factura"
        >
          <Pencil size={16} />
        </button>
        {onDelete && (
          <button
            onClick={handleDelete}
            className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-red-500/80 transition-all"
            title="Eliminar factura"
          >
            <Trash2 size={16} />
          </button>
        )}
        <button
          onClick={handleDownload}
          className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-all"
          title="Descargar como imagen"
        >
          <Download size={16} />
        </button>
      </div>
    </div>
  );
};

export default InvoiceCard;
