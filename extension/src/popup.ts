import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

const authSection = document.getElementById('authSection')!;
const syncSection = document.getElementById('syncSection')!;
const loginBtn = document.getElementById('loginBtn') as HTMLButtonElement;
const logoutBtn = document.getElementById('logoutBtn') as HTMLButtonElement;
const syncBtn = document.getElementById('syncBtn') as HTMLButtonElement;
const emailInput = document.getElementById('email') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const errorMsg = document.getElementById('errorMsg')!;
const statusMsg = document.getElementById('statusMsg')!;

onAuthStateChanged(auth, (user) => {
  if (user) {
    authSection.classList.add('hidden');
    syncSection.classList.remove('hidden');
  } else {
    authSection.classList.remove('hidden');
    syncSection.classList.add('hidden');
  }
});

loginBtn.addEventListener('click', async () => {
  errorMsg.classList.add('hidden');
  try {
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
  } catch (error: any) {
    errorMsg.textContent = error.message;
    errorMsg.classList.remove('hidden');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login to Sync';
  }
});

logoutBtn.addEventListener('click', () => {
  signOut(auth);
});

syncBtn.addEventListener('click', () => {
  statusMsg.textContent = 'Triggering sync...';
  syncBtn.disabled = true;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab.id && tab.url?.includes('messenger.com')) {
      chrome.tabs.sendMessage(tab.id, { action: 'extract_chat' }, (response) => {
        if (chrome.runtime.lastError) {
          statusMsg.textContent = 'Error: Make sure you are on Messenger.';
          statusMsg.style.color = '#ef4444';
          syncBtn.disabled = false;
        }
      });
    } else {
      statusMsg.textContent = 'Please open Messenger to sync.';
      statusMsg.style.color = '#ef4444';
      syncBtn.disabled = false;
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sync_status') {
    statusMsg.textContent = request.status;
    statusMsg.style.color = request.error ? '#ef4444' : '#10b981';
    if (request.done) {
      syncBtn.disabled = false;
    }
  }
});
