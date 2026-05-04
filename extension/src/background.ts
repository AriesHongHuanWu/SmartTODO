import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc } from "firebase/firestore";
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
    // Call the Next.js API route instead of Gemini directly
    const response = await fetch("https://smarttodo.pages.dev/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chatLogs,
        userId: currentUser.uid
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

async function syncToFirestore(data: { newTasks: string[], completedTasks: string[] }) {
  updateStatus("Syncing to database...", false, false);
  const userId = currentUser.uid;

  try {
    // 1. Add new tasks
    for (const title of data.newTasks || []) {
      await addDoc(collection(db, "todos"), {
        userId,
        title,
        status: 'pending',
        source: 'messenger',
        createdAt: serverTimestamp(),
        completedAt: null
      });
    }

    // 2. Mark existing tasks as completed
    if (data.completedTasks && data.completedTasks.length > 0) {
      const q = query(collection(db, "todos"), where("userId", "==", userId), where("status", "==", "pending"));
      const querySnapshot = await getDocs(q);
      
      querySnapshot.forEach(async (docSnap) => {
        const todo = docSnap.data();
        const isCompleted = data.completedTasks.some(completedText => 
          todo.title.toLowerCase().includes(completedText.toLowerCase()) || 
          completedText.toLowerCase().includes(todo.title.toLowerCase())
        );
        
        if (isCompleted) {
          await updateDoc(docSnap.ref, {
            status: 'completed',
            completedAt: serverTimestamp()
          });
        }
      });
    }

    updateStatus("Sync complete!", false, true);
  } catch (error: any) {
    console.error(error);
    updateStatus("Error syncing to DB", true, true);
  }
}

function updateStatus(status: string, error: boolean, done: boolean) {
  chrome.runtime.sendMessage({ action: 'sync_status', status, error, done });
}
