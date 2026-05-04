"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc, orderBy } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { CheckCircle, Circle, Trash2, Clock, Sparkles, MessageCircle } from "lucide-react";

interface Todo {
  id: string;
  title: string;
  context?: string;
  status: 'pending' | 'completed';
  completedBy?: 'ai' | 'user';
  source: string;
  createdAt: any;
  completedAt: any;
}

function formatTime(timestamp: any) {
  if (!timestamp || !timestamp.toDate) return '';
  return timestamp.toDate().toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

export default function Dashboard() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      const q = query(
        collection(db, "todos"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );

      const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const fetchedTodos: Todo[] = [];
        snapshot.forEach((doc) => {
          fetchedTodos.push({ id: doc.id, ...doc.data() } as Todo);
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
        completedAt: newStatus === 'completed' ? new Date() : null
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const pendingTodos = todos.filter(t => t.status === 'pending');
  const aiCompletedTodos = todos.filter(t => t.status === 'completed' && t.completedBy === 'ai');
  const userCompletedTodos = todos.filter(t => t.status === 'completed' && t.completedBy !== 'ai');

  const TaskCard = ({ todo, isCompleted }: { todo: Todo, isCompleted: boolean }) => (
    <div className={`group relative bg-white/70 backdrop-blur-md border border-gray-200/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 ${isCompleted ? 'opacity-80 hover:opacity-100' : ''}`}>
      <div className="flex items-start gap-4">
        <button 
          onClick={() => toggleStatus(todo)} 
          className={`flex-shrink-0 mt-1 transition-transform active:scale-95 ${isCompleted ? 'text-green-500 hover:text-gray-400' : 'text-gray-300 hover:text-blue-500'}`}
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

          <div className="flex items-center flex-wrap gap-3 text-xs font-medium">
            {todo.source === 'messenger' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100/50">
                <MessageCircle className="w-3.5 h-3.5" />
                Messenger
              </span>
            )}
            
            {todo.completedBy === 'ai' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-100/50">
                <Sparkles className="w-3.5 h-3.5" />
                AI Detected
              </span>
            )}
            
            <span className="text-gray-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {isCompleted && todo.completedAt ? `Finished ${formatTime(todo.completedAt)}` : `Added ${formatTime(todo.createdAt)}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-20">
      <div className="max-w-4xl mx-auto px-4 pt-12">
        <header className="mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">Your Workspace</h1>
          <p className="text-gray-500 text-lg">Automatically synced and organized by AI.</p>
        </header>
        
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
                <p className="text-gray-500 text-lg">You're all caught up! No pending tasks.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {pendingTodos.map((todo) => <TaskCard key={todo.id} todo={todo} isCompleted={false} />)}
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
