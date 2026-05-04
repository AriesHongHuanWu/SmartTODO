import { GoogleGenerativeAI } from "@google/generative-ai";
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

// Ensure auth is loaded
let currentUser: any = null;
auth.onAuthStateChanged((user) => {
  currentUser = user;
});

const genAI = new GoogleGenerativeAI("AIzaSyCTbBBrrl-UG589Xpb7UDeJss4-_lPZCsA");

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

  updateStatus("Analyzing chat with AI...", false, false);

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Or gemini-3.1-flash-lite-preview as requested
    
    const prompt = `Analyze the chat log below. 
1. Identify new actionable tasks and output as JSON.
2. Identify if any existing tasks have been completed based on context.

Output strictly in JSON format:
{
  "newTasks": ["task 1", "task 2"],
  "completedTasks": ["task 3"]
}

Chat Log:
${chatLogs.join('\n')}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Clean up markdown if any
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsedData = JSON.parse(text);
    
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
        // Simple string matching to see if completed tasks match pending tasks
        // For better matching, could use LLM to map IDs, but simple string includes is a start
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
