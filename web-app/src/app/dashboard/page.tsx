"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc, addDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { CheckCircle, Circle, Trash2, Clock, Sparkles, MessageCircle, Plus, X, Filter, Calendar, RefreshCw, Tag } from "lucide-react";

const CATEGORIES = [
  { id: 'all', label: 'All', icon: '📋', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  { id: 'general', label: 'General', icon: '📋', color: 'bg-slate-50 text-slate-700 border-slate-200' },
  { id: 'meeting', label: 'Meeting', icon: '📅', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'homework', label: 'Homework', icon: '📝', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { id: 'shopping', label: 'Shopping', icon: '🛒', color: 'bg-green-50 text-green-700 border-green-200' },
  { id: 'work', label: 'Work', icon: '💼', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'personal', label: 'Personal', icon: '🏠', color: 'bg-orange-50 text-orange-700 border-orange-200' },
];

interface Todo {
  id: string;
  title: string;
  context?: string;
  category?: string;
  status: 'pending' | 'completed';
  completedBy?: 'ai' | 'user';
  source: string;
  createdAt: any;
  completedAt: any;
  dueDate: any;
  updatedAt?: any;
}

function formatTime(timestamp: any) {
  if (!timestamp) return '';
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

function formatDueDate(timestamp: any) {
  if (!timestamp) return null;
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const isOverdue = d < now;
  const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  return { label, isOverdue };
}

function getCategoryMeta(categoryId: string) {
  return CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[1]; // default to 'general'
}

export default function Dashboard() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [newDueDate, setNewDueDate] = useState('');
  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      const q = query(
        collection(db, "todos"),
        where("userId", "==", user.uid)
      );

      const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const fetchedTodos: Todo[] = [];
        snapshot.forEach((d) => {
          fetchedTodos.push({ id: d.id, ...d.data() } as Todo);
        });
        // Sort client-side: newest first
        fetchedTodos.sort((a, b) => {
          const ta = a.createdAt?.seconds || 0;
          const tb = b.createdAt?.seconds || 0;
          return tb - ta;
        });
        setTodos(fetchedTodos);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching todos:", error);
        setLoading(false);
      });

      return () => unsubscribeSnapshot();
    });

    return () => unsubscribeAuth();
  }, [router]);

  const toggleStatus = async (todo: Todo) => {
    try {
      const newStatus = todo.status === 'pending' ? 'completed' : 'pending';
      await updateDoc(doc(db, "todos", todo.id), {
        status: newStatus,
        completedBy: newStatus === 'completed' ? 'user' : null,
        completedAt: newStatus === 'completed' ? new Date() : null,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      await deleteDoc(doc(db, "todos", id));
    } catch (error) {
      console.error("Error deleting todo:", error);
    }
  };

  const addManualTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const user = auth.currentUser;
    if (!user) return;

    try {
      const docData: any = {
        userId: user.uid,
        title: newTitle.trim(),
        context: '',
        category: newCategory,
        status: 'pending',
        source: 'manual',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        completedAt: null,
        dueDate: null
      };

      if (newDueDate) {
        docData.dueDate = Timestamp.fromDate(new Date(newDueDate));
      }

      await addDoc(collection(db, "todos"), docData);
      setNewTitle('');
      setNewDueDate('');
      setShowAddForm(false);
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const filteredTodos = activeFilter === 'all' 
    ? todos 
    : todos.filter(t => (t.category || 'general') === activeFilter);

  // Separate pending into dated and undated, sort dated by nearest first
  const allPending = filteredTodos.filter(t => t.status === 'pending');
  
  const datedPending = allPending
    .filter(t => t.dueDate)
    .sort((a, b) => {
      const da = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
      const db2 = b.dueDate?.toDate ? b.dueDate.toDate() : new Date(b.dueDate);
      return da.getTime() - db2.getTime();
    });
  
  const undatedPending = allPending.filter(t => !t.dueDate);
  
  // Group dated tasks by date string
  const dateGroups: { label: string, dateKey: string, isOverdue: boolean, tasks: Todo[] }[] = [];
  const now = new Date();
  datedPending.forEach(t => {
    const d = t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
    const dateKey = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const isOverdue = d < now;
    let group = dateGroups.find(g => g.dateKey === dateKey);
    if (!group) {
      group = { label: dateKey, dateKey, isOverdue, tasks: [] };
      dateGroups.push(group);
    }
    group.tasks.push(t);
  });

  const pendingTodos = [...datedPending, ...undatedPending]; // for count
  const aiCompletedTodos = filteredTodos.filter(t => t.status === 'completed' && t.completedBy === 'ai');
  const userCompletedTodos = filteredTodos.filter(t => t.status === 'completed' && t.completedBy !== 'ai');

  // Count per category for badges
  const pendingCounts: Record<string, number> = {};
  todos.filter(t => t.status === 'pending').forEach(t => {
    const cat = t.category || 'general';
    pendingCounts[cat] = (pendingCounts[cat] || 0) + 1;
  });

  const TaskCard = ({ todo, isCompleted }: { todo: Todo, isCompleted: boolean }) => {
    const catMeta = getCategoryMeta(todo.category || 'general');
    const due = formatDueDate(todo.dueDate);

    return (
      <div className={`group relative bg-white/70 backdrop-blur-md border border-gray-200/50 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 ${isCompleted ? 'opacity-75 hover:opacity-100' : ''}`}>
        <div className="flex items-start gap-4">
          <button 
            onClick={() => toggleStatus(todo)} 
            className={`flex-shrink-0 mt-1 transition-all active:scale-90 ${isCompleted ? 'text-green-500 hover:text-gray-400' : 'text-gray-300 hover:text-blue-500'}`}
          >
            {isCompleted ? <CheckCircle className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
          </button>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-4 mb-1">
              <h3 className={`text-lg font-semibold truncate ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                {todo.title}
              </h3>
              <button 
                onClick={() => deleteTodo(todo.id)} 
                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Delete task"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            
            {todo.context && (
              <p className={`text-sm mb-3 ${isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>
                {todo.context}
              </p>
            )}

            <div className="flex items-center flex-wrap gap-2 text-xs font-medium">
              {/* Category badge */}
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border ${catMeta.color}`}>
                <span>{catMeta.icon}</span>
                {catMeta.label}
              </span>

              {/* Source badge */}
              {todo.source === 'messenger' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100/50">
                  <MessageCircle className="w-3.5 h-3.5" />
                  Messenger
                </span>
              )}
              {todo.source === 'manual' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-50 text-gray-600 border border-gray-200/50">
                  <Plus className="w-3.5 h-3.5" />
                  Manual
                </span>
              )}
              
              {/* AI badge */}
              {todo.completedBy === 'ai' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-100/50">
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Detected
                </span>
              )}

              {/* Due date */}
              {due && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border ${due.isOverdue && !isCompleted ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  <Calendar className="w-3.5 h-3.5" />
                  {due.isOverdue && !isCompleted ? 'Overdue: ' : 'Due: '}{due.label}
                </span>
              )}
              
              {/* Timestamp */}
              <span className="text-gray-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {isCompleted && todo.completedAt ? `Done ${formatTime(todo.completedAt)}` : `Added ${formatTime(todo.createdAt)}`}
              </span>

              {/* Updated indicator */}
              {todo.updatedAt && todo.createdAt && todo.updatedAt?.seconds > todo.createdAt?.seconds + 60 && (
                <span className="text-amber-500 flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Updated
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-20">
      <div className="max-w-4xl mx-auto px-4 pt-12">
        {/* Header */}
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">Your Workspace</h1>
            <p className="text-gray-500 text-lg">Automatically synced and organized by AI.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Add Task
            </button>
            <a 
              href="/extension.zip" 
              download 
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white font-medium rounded-lg transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Extension
            </a>
          </div>
        </header>

        {/* Add Task Form */}
        {showAddForm && (
          <form onSubmit={addManualTask} className="mb-8 bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">New Task</h3>
              <button type="button" onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <input
                type="text"
                placeholder="Task title..."
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="col-span-full sm:col-span-1 px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-gray-900"
                required
                autoFocus
              />
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-gray-700 bg-white"
              >
                {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={newDueDate}
                onChange={e => setNewDueDate(e.target.value)}
                className="px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-gray-700"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm">
                Add Task
              </button>
            </div>
          </form>
        )}

        {/* Category Filter Tabs */}
        <div className="mb-8 flex flex-wrap gap-2">
          {CATEGORIES.map(cat => {
            const count = cat.id === 'all' 
              ? todos.filter(t => t.status === 'pending').length 
              : (pendingCounts[cat.id] || 0);
            const isActive = activeFilter === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveFilter(cat.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  isActive 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                <span>{cat.icon}</span>
                {cat.label}
                {count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${isActive ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        
        <div className="space-y-12">
          {/* Pending Section */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Pending Tasks</h2>
              <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-semibold">{pendingTodos.length}</span>
            </div>
            
            {pendingTodos.length === 0 ? (
              <div className="text-center py-12 bg-white/50 border border-dashed border-gray-300 rounded-2xl">
                <p className="text-gray-500 text-lg">
                  {activeFilter === 'all' ? "You're all caught up! No pending tasks." : `No pending ${getCategoryMeta(activeFilter).label.toLowerCase()} tasks.`}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Dated tasks grouped by date */}
                {dateGroups.map(group => (
                  <div key={group.dateKey}>
                    <div className={`flex items-center gap-3 mb-3 ${group.isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm font-semibold">
                        {group.isOverdue ? '⚠️ Overdue — ' : ''}{group.label}
                      </span>
                      <div className="flex-1 h-px bg-gray-200"></div>
                    </div>
                    <div className="grid gap-3">
                      {group.tasks.map(todo => <TaskCard key={todo.id} todo={todo} isCompleted={false} />)}
                    </div>
                  </div>
                ))}
                
                {/* Undated tasks */}
                {undatedPending.length > 0 && (
                  <div>
                    {dateGroups.length > 0 && (
                      <div className="flex items-center gap-3 mb-3 text-gray-400">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-semibold">No due date</span>
                        <div className="flex-1 h-px bg-gray-200"></div>
                      </div>
                    )}
                    <div className="grid gap-3">
                      {undatedPending.map(todo => <TaskCard key={todo.id} todo={todo} isCompleted={false} />)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* AI Completed Section */}
          {aiCompletedTodos.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">AI Detected Complete</h2>
                <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-semibold">{aiCompletedTodos.length}</span>
              </div>
              <div className="grid gap-4">
                {aiCompletedTodos.map((todo) => <TaskCard key={todo.id} todo={todo} isCompleted={true} />)}
              </div>
            </section>
          )}

          {/* User Completed Section */}
          {userCompletedTodos.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Completed</h2>
                <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-semibold">{userCompletedTodos.length}</span>
              </div>
              <div className="grid gap-4">
                {userCompletedTodos.map((todo) => <TaskCard key={todo.id} todo={todo} isCompleted={true} />)}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
