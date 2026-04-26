import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Edit2, Check, X, GripVertical, PlusCircle } from 'lucide-react';
import { Task } from '../types';
import { cn } from '../lib/utils';
import { auth, db } from '../firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';

export default function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<string[]>(['POR HACER', 'EN PROCESO', 'COMPLETADO']);
  
  const [newTaskText, setNewTaskText] = useState('');
  const [activeColumnMobile, setActiveColumnMobile] = useState<string>('POR HACER');
  
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskText, setEditTaskText] = useState('');

  const [newColumnName, setNewColumnName] = useState('');
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [dragHoverCol, setDragHoverCol] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragHoverIndex, setDragHoverIndex] = useState<number | null>(null);

  // Sync tasks
  useEffect(() => {
    if (!auth.currentUser) {
      const savedTasks = localStorage.getItem('impulse_tasks');
      if (savedTasks) {
        try { setTasks(JSON.parse(savedTasks)); } catch (e) {}
      }
      const savedCols = localStorage.getItem('impulse_task_columns');
      if (savedCols) {
        try { setColumns(JSON.parse(savedCols)); } catch (e) {}
      }
      return;
    }

    const qTasks = query(collection(db, `users/${auth.currentUser.uid}/tasks`));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      const fetchedTasks = snapshot.docs.map(doc => ({ ...doc.data() } as Task));
      setTasks(fetchedTasks);
    }, (error) => {
      console.error('TasksView: Firestore tasks error:', error);
    });

    const docSettings = doc(db, `users/${auth.currentUser.uid}/settings/tasksConfig`);
    getDoc(docSettings).then(snap => {
      if (snap.exists() && snap.data().columns) {
        setColumns(snap.data().columns);
      }
    });

    return () => unsubTasks();
  }, []);

  useEffect(() => {
    localStorage.setItem('impulse_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('impulse_task_columns', JSON.stringify(columns));
    if (auth.currentUser && auth.currentUser.uid !== 'local-user') {
      setDoc(doc(db, `users/${auth.currentUser.uid}/settings/tasksConfig`), { columns }, { merge: true });
    }
  }, [columns]);

  const addTask = async (columnId: string) => {
    if (!newTaskText.trim()) return;
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      text: newTaskText.trim(),
      completed: false,
      status: columnId,
      order: tasks.filter(t => t.status === columnId).length
    };
    
    setTasks(prev => [...prev, newTask]);
    setNewTaskText('');

    if (auth.currentUser && auth.currentUser.uid !== 'local-user') {
      await setDoc(doc(db, `users/${auth.currentUser.uid}/tasks`, newTask.id), newTask);
    }
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    const newCompletedState = !task.completed;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: newCompletedState } : t));
    
    if (auth.currentUser && auth.currentUser.uid !== 'local-user') {
      await setDoc(doc(db, `users/${auth.currentUser.uid}/tasks`, id), { completed: newCompletedState }, { merge: true });
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string, newIndex?: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    let updatedTasks = [...tasks];
    
    const getSortedCol = (colId: string) => updatedTasks.filter(t => (t.status || 'POR HACER') === colId).sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const isSameColumn = task.status === newStatus;
    
    if (isSameColumn && newIndex !== undefined) {
      const colTasks = getSortedCol(newStatus);
      const currentIndex = colTasks.findIndex(t => t.id === taskId);
      if (currentIndex === newIndex) return; 
      
      const [movedTask] = colTasks.splice(currentIndex, 1);
      colTasks.splice(newIndex, 0, movedTask);
      
      colTasks.forEach((t, idx) => {
         const tIndex = updatedTasks.findIndex(ut => ut.id === t.id);
         if (tIndex >= 0) {
            updatedTasks[tIndex] = { ...updatedTasks[tIndex], order: idx };
         }
      });
    } else {
      const oldColTasks = getSortedCol(task.status || 'POR HACER').filter(t => t.id !== taskId);
      const newColTasks = getSortedCol(newStatus);
      
      const tIndex = updatedTasks.findIndex(ut => ut.id === taskId);
      updatedTasks[tIndex] = { ...updatedTasks[tIndex], status: newStatus };
      
      if (newIndex !== undefined) {
        newColTasks.splice(newIndex, 0, updatedTasks[tIndex]);
      } else {
        newColTasks.push(updatedTasks[tIndex]);
      }
      
      oldColTasks.forEach((t, idx) => {
         const ti = updatedTasks.findIndex(ut => ut.id === t.id);
         if (ti >= 0) updatedTasks[ti] = { ...updatedTasks[ti], order: idx };
      });
      newColTasks.forEach((t, idx) => {
         const ti = updatedTasks.findIndex(ut => ut.id === t.id);
         if (ti >= 0) updatedTasks[ti] = { ...updatedTasks[ti], order: idx };
      });
    }

    setTasks(updatedTasks);

    if (auth.currentUser && auth.currentUser.uid !== 'local-user') {
       const batch = writeBatch(db);
       updatedTasks.forEach(t => {
          if (task.status === newStatus && t.id !== taskId && newIndex === undefined) return; 
          const ref = doc(db, `users/${auth.currentUser!.uid}/tasks`, t.id);
          batch.set(ref, t, { merge: true });
       });
       await batch.commit();
    }
  };

  const saveEditTask = async (id: string) => {
    if (!editTaskText.trim()) return;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, text: editTaskText.trim() } : t));
    setEditingTaskId(null);

    if (auth.currentUser && auth.currentUser.uid !== 'local-user') {
      await setDoc(doc(db, `users/${auth.currentUser.uid}/tasks`, id), { text: editTaskText.trim() }, { merge: true });
    }
  };

  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    if (auth.currentUser && auth.currentUser.uid !== 'local-user') {
      await deleteDoc(doc(db, `users/${auth.currentUser.uid}/tasks`, id));
    }
  };

  const handleAddColumn = () => {
    if (!newColumnName.trim() || columns.includes(newColumnName.trim().toUpperCase())) return;
    setColumns(prev => [...prev, newColumnName.trim().toUpperCase()]);
    setNewColumnName('');
    setIsAddingColumn(false);
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
    setDragHoverIndex(null);
    const target = e.target as HTMLElement;
    
    target.style.transform = 'rotate(4deg) scale(1.05)';
    target.style.boxShadow = '0 30px 60px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255,255,255,0.2)';
    target.style.zIndex = '50';
    target.style.transition = 'none';

    setTimeout(() => {
      target.style.transform = '';
      target.style.boxShadow = '';
      target.style.zIndex = '';
      target.style.transition = '';
      target.style.opacity = '0.3';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedTaskId(null);
    setDragHoverCol(null);
    setDragHoverIndex(null);
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
  };

  const handleDragOverCol = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const isAtBottom = (e.clientY - rect.top) > (target.scrollHeight - 60);

    if (dragHoverCol !== colId) {
      setDragHoverCol(colId);
    }

    if (isAtBottom) {
      setDragHoverIndex(getTasksByCol(colId).length);
    }
  };

  const handleDragOverItem = (e: React.DragEvent, colId: string, itemIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    
    if (dragHoverCol !== colId) setDragHoverCol(colId);
    
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const midPoint = rect.top + rect.height / 2;
    const isBelow = e.clientY > midPoint;
    
    setDragHoverIndex(isBelow ? itemIndex + 1 : itemIndex);
  };

  const handleDragLeaveCol = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragHoverCol === colId) {
      setDragHoverCol(null);
      setDragHoverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const finalIndex = dragHoverIndex !== null ? dragHoverIndex : getTasksByCol(colId).length;
    
    setDragHoverCol(null);
    setDragHoverIndex(null);
    setDraggedTaskId(null);
    
    if (taskId) {
      updateTaskStatus(taskId, colId, finalIndex);
    }
  };

  const getTasksByCol = (colId: string) => {
    return tasks.filter(t => (t.status || 'POR HACER') === colId).sort((a,b) => (a.order || 0) - (b.order || 0));
  };

  return (
    <div 
      className={cn(
        "space-y-6 relative h-full flex flex-col transition-all duration-700 bg-white dark:bg-zinc-900 text-black dark:text-white",
        "rounded-3xl p-2 md:p-4"
      )}
    >
      <div className="flex flex-row justify-between items-start md:items-center gap-4 px-6 pt-4 mb-6">
        <div>
          <h2 className="text-3xl font-black tracking-tight mb-1 text-black dark:text-white">Tareas</h2>
          <p className="font-bold text-xs text-zinc-500 dark:text-zinc-400">Organiza tu flujo de trabajo.</p>
        </div>
      </div>

      {/* MOBILE CATEGORY SCROLL */}
      <div className="md:hidden flex overflow-x-auto gap-3 pb-4 px-4 scrollbar-hide snap-x">
        {columns.map(col => (
          <button
            key={col}
            onClick={() => setActiveColumnMobile(col)}
            onDragOver={(e) => handleDragOverCol(e, col)}
            onDragLeave={(e) => handleDragLeaveCol(e, col)}
            onDrop={(e) => handleDrop(e, col)}
            className={cn(
              "whitespace-nowrap px-6 py-3 rounded-full text-xs font-black tracking-widest transition-all snap-center snap-always",
              activeColumnMobile === col 
                ? "bg-black text-white dark:bg-white dark:text-black shadow-lg shadow-black/5 border border-zinc-800 dark:border-zinc-200" 
                : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300",
              dragHoverCol === col && "bg-zinc-100 dark:bg-zinc-700 scale-105 border-zinc-400 dark:border-zinc-500"
            )}
          >
            {col} ({getTasksByCol(col).length})
          </button>
        ))}
        <button
          onClick={() => setIsAddingColumn(true)}
          className="whitespace-nowrap px-6 py-3 rounded-full text-xs font-black tracking-widest bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 border-dashed hover:bg-zinc-50 dark:hover:bg-zinc-700"
        >
          + CATEGORÍA
        </button>
      </div>

      {/* DESKTOP CONTENT - Trello Style Kanban Grid */}
      <div className="hidden md:flex gap-6 overflow-x-auto pb-8 items-start h-[calc(100vh-160px)] px-4">
        {columns.map(col => (
          <div 
            key={col}
            className={cn(
              "w-[350px] shrink-0 max-h-full flex flex-col shadow-2xl transition-all duration-300 rounded-[32px] border",
              "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700",
              dragHoverCol === col && "bg-zinc-50 dark:bg-zinc-700/50 border-zinc-300 dark:border-zinc-600 scale-[1.02] shadow-lg ring-2 ring-black/5 dark:ring-white/5"
            )}
            onDragOver={(e) => handleDragOverCol(e, col)}
            onDragLeave={(e) => handleDragLeaveCol(e, col)}
            onDrop={(e) => handleDrop(e, col)}
          >
            <div className="p-6 border-b shrink-0 pb-4 sticky top-0 z-10 border-black/5 dark:border-white/5">
              <h3 className="font-black text-sm uppercase tracking-widest flex items-center justify-between mb-4 text-black/90 dark:text-white/90">
                <div className="flex items-center gap-3">
                  <span>{col}</span>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] shadow-sm bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 text-black dark:text-white">{getTasksByCol(col).length}</span>
              </h3>
              <div className="relative group">
                <input
                  type="text"
                  placeholder={`+ Añadir a ${col}`}
                  value={activeColumnMobile === col ? newTaskText : ''}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addTask(col);
                    }
                  }}
                  onFocus={() => setActiveColumnMobile(col)}
                  className="w-full text-xs font-bold rounded-xl px-4 py-3 outline-none transition-all pr-10 bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-black dark:text-white placeholder:text-zinc-500 dark:placeholder:text-zinc-500 focus:border-black dark:focus:border-white focus:bg-white dark:focus:bg-zinc-800"
                />
                <Plus size={14} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-50 text-black dark:text-white" />
              </div>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar relative min-h-[150px]">
              <AnimatePresence>
                {getTasksByCol(col).map((task, index) => (
                  <React.Fragment key={task.id}>
                    {draggedTaskId && dragHoverCol === col && dragHoverIndex === index && draggedTaskId !== task.id && (
                       <motion.div 
                          layoutId={`drop-indicator-${col}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 60 }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-cyan-500/10 border-2 border-dashed border-cyan-500/30 rounded-[20px] mb-3 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]"
                       />
                    )}
                    
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      draggable
                      onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, task.id)}
                      onDragEnd={handleDragEnd as unknown as (e: React.DragEvent) => void}
                      onDragOver={(e) => handleDragOverItem(e as unknown as React.DragEvent, col, index)}
                      onDrop={(e) => { e.stopPropagation(); handleDrop(e as unknown as React.DragEvent, col); }} 
                      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                      className={cn(
                        "shadow-lg hover:shadow-xl border p-4 rounded-[20px] cursor-grab active:cursor-grabbing hover:-translate-y-0.5 transition-all group mb-3 relative z-10 select-none",
                        draggedTaskId === task.id 
                          ? "bg-black text-white dark:bg-white dark:text-black opacity-95 scale-105 border-dashed ring-2 ring-black/20 dark:ring-white/20" 
                          : task.completed 
                            ? "bg-zinc-50 dark:bg-zinc-800/50 opacity-60 text-black dark:text-white" 
                            : "bg-white dark:bg-zinc-900 text-black dark:text-white",
                        "border-zinc-200 dark:border-zinc-700"
                      )}
                    >
                      {editingTaskId === task.id ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editTaskText}
                            onChange={(e) => setEditTaskText(e.target.value)}
                            className="flex-1 border-none rounded-xl px-3 py-2 text-xs font-bold outline-none ring-1 bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white ring-black/10 dark:ring-white/10"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && saveEditTask(task.id)}
                          />
                          <button onClick={() => saveEditTask(task.id)} className="p-2 bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 text-black dark:text-white rounded-lg hover:scale-105 transition-transform"><Check size={14}/></button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3 pointer-events-none group-hover:pointer-events-auto">
                          <div className="flex items-center gap-2 pointer-events-auto">
                            <div className={cn("opacity-20 cursor-move hover:opacity-100 transition-opacity", draggedTaskId === task.id ? "text-white dark:text-black" : "text-black dark:text-white")}>
                              <GripVertical size={14} />
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
                              className={cn(
                                "w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all border-2",
                                task.completed 
                                  ? draggedTaskId === task.id ? "bg-white border-white text-black dark:bg-black dark:border-black dark:text-white" : "bg-black border-black text-white dark:bg-white dark:border-white dark:text-black" 
                                  : draggedTaskId === task.id ? "bg-transparent border-white text-transparent" : "bg-transparent border-zinc-300 dark:border-zinc-600 text-transparent hover:border-black dark:hover:border-white"
                              )}
                            >
                              <Check size={10} strokeWidth={3} className={task.completed ? "opacity-100 text-white dark:text-black" : "opacity-0"} />
                            </button>
                          </div>
                          <p 
                            className="flex-1 text-[11px] tracking-wide leading-relaxed pointer-events-auto cursor-pointer"
                            style={{ fontFamily: '"Arial Black", "Arial Bold", sans-serif', fontWeight: 900 }}
                            onClick={() => toggleTask(task.id)}
                          >
                            {task.completed ? <span className={cn("line-through", draggedTaskId === task.id ? "text-white/70 dark:text-black/70" : "text-zinc-400 dark:text-zinc-500")}>{task.text}</span> : task.text}
                          </p>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                            <button onClick={() => { setEditingTaskId(task.id); setEditTaskText(task.text); }} className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-black dark:hover:text-white transition-colors"><Edit2 size={12}/></button>
                            <button onClick={() => deleteTask(task.id)} className="w-7 h-7 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-colors"><Trash2 size={12}/></button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </React.Fragment>
                ))}
                
                {draggedTaskId && dragHoverCol === col && dragHoverIndex === getTasksByCol(col).length && (
                  <motion.div 
                      layoutId={`drop-indicator-${col}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 60 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-cyan-500/10 border-2 border-dashed border-cyan-500/30 rounded-[20px] mb-3 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]"
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
        ))}
        
        {/* ADD NEW COLUMN DESKTOP */}
        <div className="shrink-0 w-[300px] mb-8">
          {isAddingColumn ? (
            <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-[32px] p-6 flex gap-2">
              <input 
                type="text" 
                placeholder="Nombre"
                value={newColumnName}
                onChange={e => setNewColumnName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-xs font-black outline-none text-black dark:text-white"
              />
              <button onClick={handleAddColumn} className="bg-black text-white dark:bg-white dark:text-black px-4 py-3 rounded-xl text-xs font-black hover:bg-zinc-800 dark:hover:bg-zinc-200"><Check size={16}/></button>
              <button onClick={() => setIsAddingColumn(false)} className="bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-4 py-3 rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400"><X size={16}/></button>
            </div>
          ) : (
            <button 
              onClick={() => setIsAddingColumn(true)}
              className="w-full h-[80px] rounded-[32px] border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-black dark:text-white transition-colors flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest"
            >
              <PlusCircle size={16} /> Crear Categoría
            </button>
          )}
        </div>
      </div>

      {/* MOBILE CONTENT */}
      <div className="md:hidden flex-1 overflow-y-auto px-4 pb-20 custom-scrollbar">
        {isAddingColumn && (
          <div className="mb-6 p-4 bg-white dark:bg-zinc-800 rounded-2xl flex gap-2 border border-zinc-200 dark:border-zinc-700 shadow-md">
             <input 
                type="text" 
                placeholder="Nombre de categoría..."
                value={newColumnName}
                onChange={e => setNewColumnName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-xs font-bold outline-none text-black dark:text-white"
              />
              <button onClick={handleAddColumn} className="bg-black text-white dark:bg-white dark:text-black px-4 py-3 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm"><Check size={16}/></button>
              <button onClick={() => setIsAddingColumn(false)} className="bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-4 py-3 rounded-xl"><X size={16}/></button>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            placeholder={`Nueva tarea en ${activeColumnMobile}...`}
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask(activeColumnMobile)}
            className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-5 py-4 text-sm font-bold text-black dark:text-white outline-none focus:border-black dark:focus:border-white shadow-sm"
          />
          <button 
            onClick={() => addTask(activeColumnMobile)}
            className="bg-white dark:bg-zinc-800 text-black dark:text-white px-5 py-4 rounded-2xl shadow-xl shadow-white/5 border border-zinc-200 dark:border-zinc-700 disabled:opacity-50"
            disabled={!newTaskText.trim()}
          >
            <Plus size={20} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div 
            key={activeColumnMobile}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-3 min-h-[50vh]"
            onDragOver={(e) => handleDragOverCol(e, activeColumnMobile)}
            onDragLeave={(e) => handleDragLeaveCol(e, activeColumnMobile)}
            onDrop={(e) => handleDrop(e, activeColumnMobile)}
          >
            <AnimatePresence>
              {getTasksByCol(activeColumnMobile).map((task, index) => (
                <React.Fragment key={task.id}>
                  {draggedTaskId && dragHoverCol === activeColumnMobile && dragHoverIndex === index && draggedTaskId !== task.id && (
                     <motion.div 
                        layoutId={`drop-indicator-mobile-${activeColumnMobile}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 60 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-cyan-500/10 border-2 border-dashed border-cyan-500/30 rounded-[20px] shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]"
                     />
                  )}
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    draggable
                    onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, task.id)}
                    onDragEnd={handleDragEnd as unknown as (e: React.DragEvent) => void}
                    onDragOver={(e) => handleDragOverItem(e as unknown as React.DragEvent, activeColumnMobile, index)}
                    onDrop={(e) => { e.stopPropagation(); handleDrop(e as unknown as React.DragEvent, activeColumnMobile); }}
                    style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                    className={cn(
                      "border p-5 rounded-[24px] cursor-grab active:cursor-grabbing select-none",
                      draggedTaskId === task.id 
                        ? "bg-black text-white dark:bg-white dark:text-black opacity-95 scale-105 border-dashed ring-2 ring-black/20 dark:ring-white/20" 
                        : task.completed 
                          ? "bg-zinc-50 dark:bg-zinc-800/50 opacity-60 text-black dark:text-white" 
                          : "bg-white dark:bg-zinc-900 text-black dark:text-white",
                      "border-zinc-200 dark:border-zinc-700"
                    )}
                  >
                    {editingTaskId === task.id ? (
                        <div className="flex gap-2 mb-4">
                          <input
                            type="text"
                            value={editTaskText}
                            onChange={(e) => setEditTaskText(e.target.value)}
                            className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-black dark:text-white rounded-xl px-4 py-3 text-sm font-bold outline-none"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && saveEditTask(task.id)}
                          />
                          <button onClick={() => saveEditTask(task.id)} className="p-3 bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 text-black dark:text-white rounded-xl shadow-sm"><Check size={16}/></button>
                        </div>
                    ) : (
                      <div className="flex items-start gap-4">
                        <div className="flex items-center gap-2 mt-0.5 z-10">
                            <div className={cn("opacity-20 shrink-0", draggedTaskId === task.id ? "text-white dark:text-black" : "text-black dark:text-white")}>
                              <GripVertical size={16} />
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
                              className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all border-2 cursor-pointer z-20",
                                task.completed 
                                  ? draggedTaskId === task.id ? "bg-white border-white text-black dark:bg-black dark:border-black dark:text-white" : "bg-black border-black text-white dark:bg-white dark:border-white dark:text-black" 
                                  : draggedTaskId === task.id ? "bg-transparent border-white text-transparent" : "bg-transparent border-zinc-300 dark:border-zinc-600 text-transparent hover:border-black dark:hover:border-white"
                              )}
                            >
                              <Check size={14} strokeWidth={3} className={task.completed ? "opacity-100 text-white dark:text-black" : "opacity-0"} />
                            </button>
                          </div>
                          <p className={cn(
                            "flex-1 text-sm font-bold leading-relaxed transition-all cursor-pointer",
                            task.completed ? "line-through text-zinc-400 dark:text-zinc-500" : ""
                          )}
                          onClick={() => toggleTask(task.id)}
                          >{task.text}</p>
                        <div className="flex gap-1.5 shrink-0 z-10">
                           <button onClick={() => { setEditingTaskId(task.id); setEditTaskText(task.text); }} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400"><Edit2 size={12}/></button>
                           <button onClick={() => deleteTask(task.id)} className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-500"><Trash2 size={12}/></button>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 shrink-0">Mover a:</span>
                      {columns.filter(c => c !== activeColumnMobile).map(c => (
                        <button 
                          key={c}
                          onClick={() => updateTaskStatus(task.id, c)}
                          className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-colors border border-zinc-200 dark:border-zinc-700"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </React.Fragment>
              ))}
              
              {draggedTaskId && dragHoverCol === activeColumnMobile && dragHoverIndex === getTasksByCol(activeColumnMobile).length && (
                <motion.div 
                    layoutId={`drop-indicator-mobile-${activeColumnMobile}`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 60 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-cyan-500/10 border-2 border-dashed border-cyan-500/30 rounded-[20px] mt-3 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]"
                />
              )}
            </AnimatePresence>
            {getTasksByCol(activeColumnMobile).length === 0 && (
               <div className="pt-10 pb-20 text-center opacity-30">
                 <p className="text-xs font-black tracking-widest uppercase text-black dark:text-white">No hay tareas en esta categoría</p>
               </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
