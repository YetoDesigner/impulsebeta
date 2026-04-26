import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Menu, LayoutGrid, User, Calendar, Wallet, CheckCircle2, TrendingUp, X } from 'lucide-react';
import { AppView } from '../types';
import { cn } from '../lib/utils';

interface ChatViewProps {
  onNavigate: (view: AppView) => void;
}

export default function ChatView({ onNavigate }: ChatViewProps) {
  const [messages, setMessages] = useState<{ id: string; text: string; sender: 'user' | 'bot' }[]>([
    { id: '1', text: '¡Hola! Soy tu asistente de Impulse Ultra. ¿En qué te puedo ayudar hoy?', sender: 'bot' }
  ]);
  const [input, setInput] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { id: Date.now().toString(), text: input, sender: 'user' as const };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Simulate bot response
    setTimeout(() => {
      const botMsg = { 
        id: (Date.now() + 1).toString(), 
        text: 'He recibido tu mensaje. Pronto podré ayudarte con más funciones.', 
        sender: 'bot' as const 
      };
      setMessages(prev => [...prev, botMsg]);
    }, 1000);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Panel Principal', icon: LayoutGrid },
    { id: 'clients', label: 'Clientes', icon: User },
    { id: 'pendientes', label: 'Pendientes', icon: Calendar },
    { id: 'gastos', label: 'Gastos', icon: Wallet },
    { id: 'tareas', label: 'Tareas', icon: CheckCircle2 },
    { id: 'stats', label: 'Estadísticas', icon: TrendingUp },
  ] as const;

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] md:h-full relative overflow-hidden bg-zinc-950 rounded-[32px] border border-zinc-800">
      {/* Header */}
      <header className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-orange-500 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20">
            <span className="font-black text-white text-lg">I</span>
          </div>
          <div>
            <h2 className="font-black text-white text-lg leading-tight">Impulse Bot</h2>
            <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse"></span>
              En línea
            </p>
          </div>
        </div>
        <button 
          onClick={() => setShowMenu(true)}
          className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center transition-colors text-white"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar relative z-0">
        {messages.map(msg => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={msg.id}
            className={cn(
              "max-w-[80%] rounded-2xl p-4 text-sm font-medium",
              msg.sender === 'user' 
                ? "ml-auto bg-white text-black rounded-tr-sm" 
                : "mr-auto bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-tl-sm"
            )}
          >
            {msg.text}
          </motion.div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-zinc-900/80 backdrop-blur-xl border-t border-zinc-800 z-10">
        <form onSubmit={handleSend} className="flex gap-2 relative">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Escribe tu mensaje..."
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-full px-5 py-3.5 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
          />
          <button 
            type="submit"
            disabled={!input.trim()}
            className="w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-600 transition-colors shrink-0"
          >
            <Send size={18} className="ml-1" />
          </button>
        </form>
      </div>

      {/* Functions Menu Modal */}
      <AnimatePresence>
        {showMenu && (
          <div className="absolute inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="bg-zinc-900 w-full max-w-sm rounded-[32px] border border-zinc-800 p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-xl text-white">Herramientas</h3>
                <button 
                  onClick={() => setShowMenu(false)}
                  className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {menuItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setShowMenu(false);
                      onNavigate(item.id);
                    }}
                    className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl flex flex-col items-center gap-3 hover:bg-zinc-800 transition-colors group"
                  >
                    <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <item.icon size={20} className="text-zinc-400 group-hover:text-white transition-colors" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-white transition-colors">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
