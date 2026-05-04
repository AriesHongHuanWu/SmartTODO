"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { ChevronLeft, ChevronRight, Clock, MessageCircle, Plus } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-slate-400',
  meeting: 'bg-blue-500',
  homework: 'bg-yellow-500',
  shopping: 'bg-green-500',
  work: 'bg-purple-500',
  personal: 'bg-orange-500',
};

const CATEGORY_ICONS: Record<string, string> = {
  general: '📋',
  meeting: '📅',
  homework: '📝',
  shopping: '🛒',
  work: '💼',
  personal: '🏠',
};

interface Todo {
  id: string;
  title: string;
  category?: string;
  status: 'pending' | 'completed';
  source: string;
  dueDate: any;
  createdAt: any;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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
        const fetched: Todo[] = [];
        snapshot.forEach((d) => {
          fetched.push({ id: d.id, ...d.data() } as Todo);
        });
        setTodos(fetched);
        setLoading(false);
      }, () => setLoading(false));

      return () => unsubscribeSnapshot();
    });
    return () => unsubscribeAuth();
  }, [router]);

  // Build a map: dateKey -> Todo[]
  const tasksByDate: Record<string, Todo[]> = {};
  todos.forEach(t => {
    if (t.dueDate) {
      const d = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
      const key = toDateKey(d);
      if (!tasksByDate[key]) tasksByDate[key] = [];
      tasksByDate[key].push(t);
    }
  });

  // Calendar grid generation
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun
  const totalDays = lastDay.getDate();
  
  const days: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let i = 1; i <= totalDays; i++) days.push(i);
  // Pad end to fill last row
  while (days.length % 7 !== 0) days.push(null);

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
  const todayKey = toDateKey(new Date());

  const monthLabel = currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const selectedTasks = selectedDate ? (tasksByDate[selectedDate] || []) : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-20">
      <div className="max-w-5xl mx-auto px-4 pt-12">
        <header className="mb-8">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">Calendar</h1>
          <p className="text-gray-500 text-lg">View your tasks on a timeline.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar Grid */}
          <div className="lg:col-span-2 bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-sm">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-6">
              <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h2 className="text-xl font-bold text-gray-800">{monthLabel}</h2>
              <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
              ))}
            </div>

            {/* Day Cells */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, i) => {
                if (day === null) return <div key={i} className="aspect-square" />;
                
                const dateKey = toDateKey(new Date(year, month, day));
                const tasksForDay = tasksByDate[dateKey] || [];
                const isToday = dateKey === todayKey;
                const isSelected = dateKey === selectedDate;
                
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all text-sm font-medium relative
                      ${isToday ? 'bg-blue-600 text-white shadow-md' : ''}
                      ${isSelected && !isToday ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-400' : ''}
                      ${!isToday && !isSelected ? 'hover:bg-gray-100 text-gray-700' : ''}
                    `}
                  >
                    {day}
                    {tasksForDay.length > 0 && (
                      <div className="flex gap-0.5">
                        {tasksForDay.slice(0, 3).map((t, j) => (
                          <div key={j} className={`w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white/80' : (CATEGORY_COLORS[t.category || 'general'] || 'bg-gray-400')}`} />
                        ))}
                        {tasksForDay.length > 3 && (
                          <span className={`text-[8px] ${isToday ? 'text-white/70' : 'text-gray-400'}`}>+{tasksForDay.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Category Legend */}
            <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-100 pt-4">
              {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
                <div key={cat} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                  {CATEGORY_ICONS[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </div>
              ))}
            </div>
          </div>

          {/* Side Panel: Tasks for selected date */}
          <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {selectedDate 
                ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                : 'Select a date'
              }
            </h3>
            
            {!selectedDate ? (
              <p className="text-gray-400 text-sm">Click on a date to see tasks due that day.</p>
            ) : selectedTasks.length === 0 ? (
              <p className="text-gray-400 text-sm">No tasks due on this date.</p>
            ) : (
              <div className="space-y-3">
                {selectedTasks.map(t => (
                  <div key={t.id} className={`p-3 rounded-xl border ${t.status === 'completed' ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span>{CATEGORY_ICONS[t.category || 'general']}</span>
                      <span className={`font-medium text-sm ${t.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      {t.source === 'messenger' && <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />Messenger</span>}
                      {t.source === 'manual' && <span className="flex items-center gap-1"><Plus className="w-3 h-3" />Manual</span>}
                      <span className={`px-1.5 py-0.5 rounded text-xs ${t.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                        {t.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
