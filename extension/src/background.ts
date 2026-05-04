import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, Timestamp } from "firebase/firestore";
import { signInWithCustomToken } from "firebase/auth";
import { auth, db } from "./firebase";

// Ensure auth is loaded
let currentUser: any = null;
let authInitialized = false;

auth.onAuthStateChanged((user) => {
  currentUser = user;
  authInitialized = true;
});

// Listen for external messages (from Web App) to sync login state
chrome.runtime.onMessageExternal.addListener((request, _sender, sendResponse) => {
  if (request.action === 'sync_auth_token') {
    // The web app sends a custom token or signs in immediately on its end and passes it here.
    // Actually, passing session from web is easiest if we implement signInWithCustomToken on backend.
    // For now, simpler: we can store the token or state directly.
    signInWithCustomToken(auth, request.customToken)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
  return false;
});


// Settings
let settings = {
  autoSync: false,
  sites: ['www.messenger.com'],
  bufferSize: 3000,
  useLocalAi: false,
  useCustomApi: false,
  customApiUrl: '',
  customApiKey: ''
};

// Initial load
chrome.storage.sync.get('smarttodo_settings', (result) => {
  if (result.smarttodo_settings) {
    settings = { ...settings, ...result.smarttodo_settings };
  }
});

// Helper to wait for auth state
async function waitForAuth() {
  if (authInitialized) return currentUser;
  
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      currentUser = user;
      authInitialized = true;
      unsubscribe();
      resolve(user);
    });
    // Timeout after 5 seconds
    setTimeout(() => {
      unsubscribe();
      resolve(currentUser);
    }, 5000);
  });
}

chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
  if (request.action === 'process_chat') {
    processChatLogs(request.chatLog);
  }
  if (request.action === 'settings_updated') {
    settings = { ...settings, ...request.settings };
  }
  if (request.action === 'check_schedule') {
    handleCheckSchedule(request.text);
  }
  return false;
});

// Real-time time detection alert logic
async function handleCheckSchedule(text: string) {
  const user = await waitForAuth();
  if (!user) return;

  try {
    const q = query(
      collection(db, "todos"), 
      where("userId", "==", user.uid), 
      where("status", "==", "pending")
    );
    const snap = await getDocs(q);
    const count = snap.docs.filter(d => d.data().dueDate !== null).length;
    
    if (count > 0) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'show_toast',
            message: `SmartTODO Alert: Found a time mention ("${text}"). You have ${count} scheduled upcoming tasks!`,
            isError: false,
            isAlert: true
          }).catch(() => {});
        }
      });
    }
  } catch(e) {}
}

async function processChatLogs(chatLogObjects: {text: string, url: string, site: string}[]) {
  const user = await waitForAuth();
  
  if (!user) {
    updateStatus("Error: Not logged in", true, true);
    return;
  }

  updateStatus("Analyzing chat securely via API...", false, false);

  try {
    // Fetch existing pending tasks to send to the AI for context
    let existingTasks: { title: string, category: string, dueDate: string | null }[] = [];
    try {
      const existingQ = query(collection(db, "todos"), where("userId", "==", user.uid), where("status", "==", "pending"));
      const existingSnap = await getDocs(existingQ);
      existingTasks = existingSnap.docs.map(d => {
        const data = d.data();
        return {
          title: data.title,
          category: data.category,
          dueDate: data.dueDate ? new Date(data.dueDate.seconds * 1000).toISOString() : null
        };
      });
    } catch (dbError) {
      console.warn("Failed to fetch existing tasks for context", dbError);
    }

    if (settings.useLocalAi && typeof (self as any).ai !== 'undefined' && (self as any).ai.languageModel) {
      updateStatus("Analyzing chat securely locally (Gemini Nano)...", false, false);
      const capabilities = await (self as any).ai.languageModel.capabilities();
      if (capabilities.available !== 'no') {
        const session = await (self as any).ai.languageModel.create({
          systemPrompt: `You are a task extraction AI. Identify NEW actionable tasks from the chat logs.
RULES:
1. Return output in STRICT JSON format matching this schema: { "tasks": [ { "action": "create", "title": "Task title", "context": "Reason", "category": "work", "dueDate": null, "threadUrl": "url", "siteName": "site" } ] }
2. Categories: 'work', 'personal', 'shopping', 'meeting', 'homework', 'general'.
3. Do not invent tasks if it is just a casual chat. Return {"tasks": []}.`
        });

        const promptText = `Existing Pending Tasks:\n${JSON.stringify(existingTasks)}\n\nChat Logs:\n${JSON.stringify(chatLogObjects)}`;
        const localResponse = await session.prompt(promptText);
        
        let cleanText = localResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedData = JSON.parse(cleanText);
        await syncToFirestore(parsedData);
        session.destroy();
        return;
      } else {
        console.warn("Local AI is disabled or requires Chrome flags to be enabled.");
        updateStatus("Local AI not ready. Falling back to Cloud API...", false, false);
      }
    }

    const apiUrl = settings.useCustomApi && settings.customApiUrl 
      ? settings.customApiUrl 
      : "https://smarttodo.pages.dev/api/analyze";
    
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (settings.useCustomApi && settings.customApiKey) {
      headers["Authorization"] = `Bearer ${settings.customApiKey}`;
    }

    // Call the API
    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        chatLogs: chatLogObjects,
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
  const userId = currentUser?.uid;
  if (!userId) return;

  try {
    let count = 0;
    if (data.tasks && Array.isArray(data.tasks)) {
      for (const t of data.tasks) {
        if (t.action === 'update' && t.targetTitle) {
          // Find the existing task and update it
          const q = query(collection(db, "todos"), where("userId", "==", userId), where("status", "==", "pending"));
          const snap = await getDocs(q);
          const docToUpdate = snap.docs.find(d => d.data().title === t.targetTitle);
          if (docToUpdate) {
            await updateDoc(docToUpdate.ref, {
              title: t.title,
              context: t.context,
              category: t.category,
              dueDate: t.dueDate ? Timestamp.fromDate(new Date(t.dueDate)) : null,
              updatedAt: serverTimestamp(),
              url: t.threadUrl || null,
              site: t.siteName || null
            });
            count++;
          }
        } else {
          // Create new
          await addDoc(collection(db, "todos"), {
            userId: userId,
            title: t.title,
            context: t.context,
            category: t.category,
            status: "pending",
            dueDate: t.dueDate ? Timestamp.fromDate(new Date(t.dueDate)) : null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            url: t.threadUrl || null,
            site: t.siteName || null
          });
          count++;
        }
      }
    }
    updateStatus(count > 0 ? `✨ Sync complete! (${count} tasks)` : "✨ No new tasks detected.", false, true);
  } catch (error: any) {
    console.error("SmartTODO sync error:", error);
    updateStatus("Error syncing to DB: " + (error.message || "Unknown"), true, true);
  }
}

function updateStatus(status: string, error: boolean, done: boolean) {
  try {
    // 1. Send to popup if open
    chrome.runtime.sendMessage({ action: 'sync_status', status, error, done });
  } catch (e) {
    // Popup might be closed, ignore
  }

  // 2. Send to current active tab to show floating toast
  if (status.includes("Analyzing") || status.includes("Sync complete") || error) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'show_toast',
          message: status,
          isError: error
        }).catch(() => {
          // Content script might not be injected on this specific page, ignore
        });
      }
    });
  }
}
