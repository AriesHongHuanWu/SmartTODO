"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc, orderBy } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { CheckCircle, Circle, Trash2, Clock } from "lucide-react";

interface Todo {
  id: string;
  title: string;
  status: 'pending' | 'completed';
  source: string;
  createdAt: any;
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
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  const pendingTodos = todos.filter(t => t.status === 'pending');
  const completedTodos = todos.filter(t => t.status === 'completed');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Your Tasks</h1>
      
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-blue-500" />
            Pending ({pendingTodos.length})
          </h2>
          {pendingTodos.length === 0 ? (
            <p className="text-gray-500 bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300 text-center">No pending tasks.</p>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {pendingTodos.map((todo) => (
                  <li key={todo.id} className="p-4 hover:bg-gray-50 flex items-center justify-between transition-colors">
                    <div className="flex items-center space-x-3">
                      <button onClick={() => toggleStatus(todo)} className="text-gray-400 hover:text-blue-500 focus:outline-none">
                        <Circle className="w-6 h-6" />
                      </button>
                      <div>
                        <span className="text-gray-900 font-medium">{todo.title}</span>
                        {todo.source === 'messenger' && (
                          <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Messenger
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => deleteTodo(todo.id)} className="text-gray-400 hover:text-red-500 focus:outline-none">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
            Completed ({completedTodos.length})
          </h2>
          {completedTodos.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden opacity-75">
              <ul className="divide-y divide-gray-200">
                {completedTodos.map((todo) => (
                  <li key={todo.id} className="p-4 hover:bg-gray-50 flex items-center justify-between transition-colors">
                    <div className="flex items-center space-x-3">
                      <button onClick={() => toggleStatus(todo)} className="text-green-500 hover:text-gray-400 focus:outline-none">
                        <CheckCircle className="w-6 h-6" />
                      </button>
                      <span className="text-gray-500 line-through">{todo.title}</span>
                    </div>
                    <button onClick={() => deleteTodo(todo.id)} className="text-gray-400 hover:text-red-500 focus:outline-none">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
