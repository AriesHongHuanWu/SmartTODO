import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

// Ensure auth is loaded
let currentUser: any = null;
auth.onAuthStateChanged((user) => {
  currentUser = user;
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'process_chat') {
    processChatLogs(request.chatLog);
  }
});

async function processChatLogs(chatLogs: string[]) {
  if (!currentUser) {
    updateStatus("Error: Not logged in", true, true);
    return;
  }

  updateStatus("Analyzing chat securely via API...", false, false);

  try {
    // Fetch existing pending tasks to send to the AI for context
    let existingTasks: { title: string, category: string, dueDate: string | null }[] = [];
    try {
      const existingQ = query(collection(db, "todos"), where("userId", "==", currentUser.uid), where("status", "==", "pending"));
      const existingSnap = await getDocs(existingQ);
      existingTasks = existingSnap.docs.map(d => {
        const data = d.data();
        return {
          title: data.title || '',
          category: data.category || 'general',
          dueDate: data.dueDate ? data.dueDate.toDate?.().toISOString?.() || null : null
        };
      });
    } catch (e) {
      console.warn("SmartTODO: Could not fetch existing tasks for AI context", e);
    }

    // Call the Next.js API route
    const response = await fetch("https://smarttodo.pages.dev/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatLogs,
        userId: currentUser.uid,
        existingTasks
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const parsedData = await response.json();
    await syncToFirestore(parsedData);
    
  } catch (error: any) {
    console.error(error);
    updateStatus("Error: " + error.message, true, true);
  }
}

async function syncToFirestore(data: any) {
  updateStatus("Syncing to database...", false, false);
  const userId = currentUser.uid;

  try {
    // Fetch all existing tasks for duplicate detection
    let existingDocs: any[] = [];
    try {
      const existingQ = query(collection(db, "todos"), where("userId", "==", userId));
      const existingSnap = await getDocs(existingQ);
      existingDocs = existingSnap.docs;
    } catch (e) {
      console.warn("SmartTODO: Could not fetch existing tasks for dedup", e);
    }

    const existingTitles = existingDocs.map(d => d.data().title?.toLowerCase().trim());

    function isDuplicate(newTitle: string): boolean {
      const normalized = newTitle.toLowerCase().trim();
      return existingTitles.some(existing => {
        if (!existing) return false;
        if (existing === normalized) return true;
        if (existing.includes(normalized) || normalized.includes(existing)) return true;
        return false;
      });
    }

    // 1. Add new tasks (skip duplicates)
    let addedCount = 0;
    for (const task of data.newTasks || []) {
      const title = typeof task === 'string' ? task : task.title;
      const context = typeof task === 'string' ? '' : (task.context || '');
      const category = typeof task === 'string' ? 'general' : (task.category || 'general');
      const dueDateStr = typeof task === 'string' ? null : (task.dueDate || null);
      
      if (!title) continue;
      if (isDuplicate(title)) {
        console.log(`SmartTODO: Skipping duplicate task "${title}"`);
        continue;
      }

      const docData: any = {
        userId,
        title,
        context,
        category,
        status: 'pending',
        source: 'messenger',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        completedAt: null,
        dueDate: null
      };

      // Parse dueDate if provided by AI
      if (dueDateStr) {
        try {
          docData.dueDate = Timestamp.fromDate(new Date(dueDateStr));
        } catch (e) {
          console.warn("SmartTODO: Could not parse dueDate", dueDateStr);
        }
      }

      await addDoc(collection(db, "todos"), docData);
      existingTitles.push(title.toLowerCase().trim());
      addedCount++;
    }

    // 2. Mark existing tasks as completed
    if (data.completedTasks && data.completedTasks.length > 0 && existingDocs.length > 0) {
      for (const docSnap of existingDocs) {
        const todo = docSnap.data();
        if (todo.status !== 'pending') continue;
        
        const isCompleted = data.completedTasks.some((completedText: string) => 
          todo.title.toLowerCase().includes(completedText.toLowerCase()) || 
          completedText.toLowerCase().includes(todo.title.toLowerCase())
        );
        
        if (isCompleted) {
          await updateDoc(docSnap.ref, {
            status: 'completed',
            completedBy: 'ai',
            completedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }
    }

    // 3. Handle updated/rescheduled tasks
    if (data.updatedTasks && data.updatedTasks.length > 0 && existingDocs.length > 0) {
      for (const update of data.updatedTasks) {
        const originalTitle = (update.originalTitle || '').toLowerCase().trim();
        const matchingDoc = existingDocs.find(d => {
          const t = d.data().title?.toLowerCase().trim();
          return t === originalTitle || t?.includes(originalTitle) || originalTitle.includes(t || '');
        });

        if (matchingDoc) {
          const updateData: any = { updatedAt: serverTimestamp() };
          if (update.title) updateData.title = update.title;
          if (update.context) updateData.context = update.context;
          if (update.category) updateData.category = update.category;
          if (update.dueDate) {
            try {
              updateData.dueDate = Timestamp.fromDate(new Date(update.dueDate));
            } catch (e) { /* ignore bad date */ }
          }
          await updateDoc(matchingDoc.ref, updateData);
        }
      }
    }

    updateStatus(`Sync complete! (${addedCount} new)`, false, true);
  } catch (error: any) {
    console.error("SmartTODO sync error:", error);
    updateStatus("Error syncing to DB: " + (error.message || "Unknown"), true, true);
  }
}

function updateStatus(status: string, error: boolean, done: boolean) {
  try {
    chrome.runtime.sendMessage({ action: 'sync_status', status, error, done });
  } catch (e) {
    // Popup might be closed, ignore
  }
}
