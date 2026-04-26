import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, Sparkles, Trash2, Loader2, TrendingUp, Users } from 'lucide-react';
import { askImpulseAI } from '../lib/openai';
import { cn } from '../lib/utils';
import { auth } from '../firebase';

const APP_LOGO_URL = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgn2on7GUzVrK26XTBTK9SMAElmdSsJ_jHIXHAZn7rIGtbDhYqfr4Q-5oTVo7zlfCLSSu37wZ7Fu7Dj7bOP35NthPBZH1gWtlPGRpddxNBj8Vbb9htG3tPn1uEXtMfkrrKVd5CngTzk7YfWfqoZ23d3NZRoexwit1RxhyhqfBorCR6FtGO_9mIpzHoSYKsu/s1758/SDFAFD12E21223R23223.png";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isNew?: boolean;
}

interface ChatViewProps {
  stats: any;
  invoices: any[];
  expenses: any[];
  onChatSend?: () => void;
  chatRemaining?: number;
  chatLimitReached?: boolean;
  onLimitReached?: () => void;
  onUpdateInvoice?: (id: string, updates: any) => void;
  onShareInvoice?: (id: string) => void;
}

function TypewriterText({ text, onComplete }: { text: string, onComplete?: () => void }) {
  const [displayedText, setDisplayedText] = useState('');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[index]);
        setIndex(prev => prev + 1);
      }, 15); // Velocidad de escritura
      return () => clearTimeout(timeout);
    } else if (onComplete) {
      onComplete();
    }
  }, [index, text, onComplete]);

  return (
    <>
      {displayedText.split('\n').map((line, i) => (
        <p key={i} className={i > 0 ? "mt-2" : ""}>{line}</p>
      ))}
    </>
  );
}

export default function ChatView({ stats, invoices, expenses, onChatSend, chatRemaining, chatLimitReached, onLimitReached, onUpdateInvoice, onShareInvoice }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showClients, setShowClients] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const uniqueClients = useMemo(() => {
    const clients = invoices.map(i => i.clientName).filter(Boolean);
    return Array.from(new Set(clients));
  }, [invoices]);

  useEffect(() => {
    const saved = localStorage.getItem('impulse_chat_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Mark old messages as not new so they don't animate typewriter again
        setMessages(parsed.map((m: any) => ({ ...m, isNew: false })));
      } catch (e) {
        console.error("Error loading chat history", e);
      }
    } else {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: '¡Hola! Soy Impulse AI. Estoy aquí para ayudarte a analizar tus finanzas, darte consejos sobre tus ventas y ayudarte a optimizar tus gastos. ¿En qué puedo apoyarte hoy?',
        timestamp: Date.now(),
        isNew: true
      }]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('impulse_chat_history', JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (chatLimitReached) {
      onLimitReached?.();
      return;
    }
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
      isNew: false
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await askImpulseAI(userMessage.content, {
        totalBilled: stats.totalBilled,
        totalCost: stats.totalCost,
        invoices,
        expenses
      });

      if (response.action) {
        if (response.action.name === 'update_invoice' && onUpdateInvoice) {
          onUpdateInvoice(response.action.arguments.invoiceId, response.action.arguments.updates);
        } else if (response.action.name === 'share_invoice' && onShareInvoice) {
          onShareInvoice(response.action.arguments.invoiceId);
        }
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text,
        timestamp: Date.now(),
        isNew: true
      };

      setMessages(prev => [...prev, assistantMessage]);
      onChatSend?.();
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    if (window.confirm('¿Estás seguro de que quieres borrar el historial de chat?')) {
      const welcome: Message = {
        id: 'welcome',
        role: 'assistant',
        content: '¡Hola de nuevo! Historial borrado. ¿En qué más puedo ayudarte?',
        timestamp: Date.now(),
        isNew: true
      };
      setMessages([welcome]);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] -mx-4 md:mx-0 px-4 md:px-0">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 px-2 md:px-0">
        <div>
          <h2 className="text-3xl font-black tracking-tight mb-1">Impulse AI</h2>
          <p className="text-zinc-500 font-bold text-xs flex items-center gap-2">
            <Sparkles size={12} className="text-orange-500" />
            Tu asistente financiero inteligente personalizado.
          </p>
        </div>
        <button 
          onClick={clearChat}
          className="p-3 bg-zinc-900 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-2xl border border-zinc-800 transition-all"
          title="Borrar historial"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Chat limit indicator */}
      {chatRemaining !== undefined && chatRemaining <= 3 && (
        <div className={cn(
          "mb-3 px-4 py-2 mx-2 md:mx-0 rounded-2xl text-center text-[10px] font-black uppercase tracking-widest border",
          chatRemaining === 0
            ? "bg-red-500/10 border-red-500/20 text-red-400"
            : "bg-orange-500/10 border-orange-500/20 text-orange-400"
        )}>
          {chatRemaining === 0
            ? "Has alcanzado el límite de consultas de hoy. Mejora tu plan."
            : `Te quedan ${chatRemaining} consulta${chatRemaining > 1 ? 's' : ''} hoy`
          }
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-2 md:pr-2 pb-32 md:pb-4 scrollbar-hide space-y-8">
        
        {/* Quick Stats Integrated in Chat */}
        <div className="grid grid-cols-2 gap-3 mb-6">
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
        </div>

        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <React.Fragment key={msg.id}>
              {/* Divider for new questions (before user messages except the first one) */}
              {msg.role === 'user' && idx > 0 && (
                <div className="flex items-center gap-4 py-4">
                  <div className="h-[1px] flex-1 bg-zinc-800" />
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-600">Nueva Consulta</span>
                  <div className="h-[1px] flex-1 bg-zinc-800" />
                </div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex w-full gap-4",
                  msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}
              >
                {/* Avatar */}
                <div className="shrink-0">
                  {msg.role === 'assistant' ? (
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-transparent flex items-center justify-center p-0 shadow-none">
                      <img src={APP_LOGO_URL} alt="Impulse" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 overflow-hidden shadow-lg">
                      {auth.currentUser?.photoURL ? (
                        <img 
                          src={auth.currentUser.photoURL} 
                          alt="Usuario" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User size={18} className="text-zinc-400" />
                      )}
                    </div>
                  )}
                </div>
                
                {/* Message Content (No container) */}
                <div className={cn(
                  "flex flex-col max-w-[85%] md:max-w-[80%]",
                  msg.role === 'user' ? "items-end text-right" : "items-start text-left"
                )}>
                  <div className={cn(
                    "text-sm leading-relaxed",
                    msg.role === 'user' ? "text-white font-black" : "text-zinc-100 font-medium"
                  )}>
                    {msg.role === 'assistant' && msg.isNew ? (
                      <TypewriterText 
                        text={msg.content} 
                        onComplete={() => {
                          // Mark as no longer new once typed
                          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isNew: false } : m));
                        }} 
                      />
                    ) : (
                      msg.content.split('\n').map((line, i) => (
                        <p key={i} className={i > 0 ? "mt-2" : ""}>{line}</p>
                      ))
                    )}
                  </div>
                  <span className="text-[8px] font-black uppercase tracking-widest mt-2 block opacity-30">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </motion.div>
            </React.Fragment>
          ))}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start gap-4"
            >
              <div className="w-10 h-10 rounded-full overflow-hidden bg-transparent flex items-center justify-center p-0 shadow-none">
                <img src={APP_LOGO_URL} alt="Impulse" className="w-full h-full object-contain" />
              </div>
              <div className="flex items-center gap-1.5 h-10">
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="fixed bottom-[80px] md:bottom-0 left-0 right-0 p-4 md:p-0 md:relative bg-black md:bg-transparent border-t border-zinc-800 md:border-none z-10">
        
        {/* Suggested Questions and Client Button */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3 px-1 w-full max-w-5xl mx-auto items-center">
          <button
            onClick={() => setShowClients(!showClients)}
            className={cn(
              "shrink-0 flex items-center gap-1.5 border text-[10px] font-black px-4 py-2 rounded-full transition-colors whitespace-nowrap",
              showClients 
                ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20" 
                : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-300"
            )}
          >
            <Users size={12} />
            Clientes
          </button>
          <div className="w-[1px] h-4 bg-zinc-800 mx-1 shrink-0" />
          {[
            "¿Cuánto me deben en total?",
            "¿Cuánto he gastado esta semana?",
            "¿Quién es mi mejor cliente?",
            "Resume mis finanzas"
          ].map((q, i) => (
            <button
              key={i}
              onClick={() => setInput(q)}
              className="shrink-0 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-[10px] font-black px-4 py-2 rounded-full transition-colors whitespace-nowrap text-zinc-300"
            >
              {q}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {showClients && (
            <motion.div
              initial={{ opacity: 0, y: 10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 10, height: 0 }}
              className="w-full max-w-5xl mx-auto mb-3 overflow-hidden"
            >
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 max-h-40 overflow-y-auto grid grid-cols-2 md:grid-cols-4 gap-2">
                {uniqueClients.length === 0 ? (
                  <div className="col-span-full text-center py-4 text-xs font-bold text-zinc-500">
                    No hay clientes registrados aún.
                  </div>
                ) : (
                  uniqueClients.map((client, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setInput(`Modifica la cuenta de ${client}: `);
                        setShowClients(false);
                      }}
                      className="p-2 bg-zinc-950 border border-zinc-800 rounded-xl text-left hover:border-orange-500 transition-colors flex items-center gap-2"
                    >
                      <User size={12} className="text-zinc-500" />
                      <span className="text-[10px] font-black truncate">{client}</span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSend} className="relative w-full max-w-5xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onClick={(e) => {
              if (chatLimitReached) {
                e.preventDefault();
                onLimitReached?.();
              }
            }}
            readOnly={chatLimitReached}
            placeholder={chatLimitReached ? "Has alcanzado el límite hoy..." : "Escribe un mensaje..."}
            className={cn(
              "w-full bg-zinc-900 border border-zinc-800 rounded-[28px] py-5 pl-6 pr-16 text-sm font-bold focus:ring-2 focus:ring-white transition-all outline-none shadow-2xl",
              chatLimitReached ? "cursor-not-allowed opacity-50" : ""
            )}
          />
          <button
            type="submit"
            disabled={(!input.trim() && !chatLimitReached) || isLoading}
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-all",
              input.trim() && !isLoading 
                ? "bg-white text-black shadow-lg shadow-white/10" 
                : "bg-zinc-800 text-zinc-600"
            )}
          >
            <Send size={20} strokeWidth={2.5} />
          </button>
        </form>
      </div>
    </div>
  );
}
