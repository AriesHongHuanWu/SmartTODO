"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Settings, User, Trash2, LogOut, Shield, Zap, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [taskCount, setTaskCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/login");
        return;
      }
      setUser(u);

      // Count tasks
      try {
        const q = query(collection(db, "todos"), where("userId", "==", u.uid));
        const snap = await getDocs(q);
        setTaskCount(snap.size);
      } catch (e) {
        console.error(e);
      }

      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, [router]);

  const handleDeleteAll = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      const q = query(collection(db, "todos"), where("userId", "==", user.uid));
      const snap = await getDocs(q);
      const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      setTaskCount(0);
      setShowConfirm(false);
    } catch (e) {
      console.error("Error deleting tasks:", e);
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-20">
      <div className="max-w-2xl mx-auto px-4 pt-12">
        <header className="mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">Settings</h1>
          <p className="text-gray-500 text-lg">Manage your account and preferences.</p>
        </header>

        <div className="space-y-6">
          {/* Account Info */}
          <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Account</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Email</span>
                <span className="font-medium text-gray-800">{user?.email}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">User ID</span>
                <span className="font-mono text-xs text-gray-600 truncate max-w-[200px]">{user?.uid}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Total Tasks</span>
                <span className="font-semibold text-gray-800">{taskCount}</span>
              </div>
            </div>
          </div>

          {/* Sync Info */}
          <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Zap className="w-5 h-5 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Auto-Sync</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Sync Trigger</span>
                <span className="font-medium text-gray-800">Every 5,000 characters</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">AI Model</span>
                <span className="font-medium text-gray-800">Gemini 3.1 Flash Lite</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Daily Limit (Free)</span>
                <span className="font-medium text-gray-800">1,000 requests/day</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Duplicate Detection</span>
                <span className="font-medium text-green-600">Enabled</span>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Security</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">API Key Storage</span>
                <span className="font-medium text-green-600">Server-side only ✓</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Data Encryption</span>
                <span className="font-medium text-green-600">Firebase TLS ✓</span>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white/80 backdrop-blur-md border border-red-200/50 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-red-800">Danger Zone</h2>
            </div>
            
            {!showConfirm ? (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(true)}
                  className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-medium rounded-lg transition-colors text-sm flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete All Tasks
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 font-medium rounded-lg transition-colors text-sm flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700 mb-3 font-medium">
                  Are you sure? This will permanently delete all {taskCount} tasks. This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteAll}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors text-sm disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Yes, Delete Everything'}
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 font-medium rounded-lg transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
