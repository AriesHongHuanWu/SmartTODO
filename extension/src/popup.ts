import { auth } from "./firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";

const authSection = document.getElementById('authSection')!;
const syncSection = document.getElementById('syncSection')!;
const loginBtn = document.getElementById('loginBtn') as HTMLButtonElement;
const logoutBtn = document.getElementById('logoutBtn') as HTMLButtonElement;
const emailInput = document.getElementById('email') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const errorMsg = document.getElementById('errorMsg')!;

const autoSyncToggle = document.getElementById('autoSync') as HTMLInputElement;
const siteList = document.getElementById('siteList')!;
const newSiteInput = document.getElementById('newSite') as HTMLInputElement;
const addSiteBtn = document.getElementById('addSiteBtn') as HTMLButtonElement;
const bufferRange = document.getElementById('bufferRange') as HTMLInputElement;
const bufferVal = document.getElementById('bufferVal')!;
const messageRange = document.getElementById('messageRange') as HTMLInputElement;
const messageVal = document.getElementById('messageVal')!;
const modeBuffer = document.getElementById('modeBuffer') as HTMLInputElement;
const modeMessage = document.getElementById('modeMessage') as HTMLInputElement;
const bufferSettings = document.getElementById('bufferSettings')!;
const messageSettings = document.getElementById('messageSettings')!;

const useCustomApi = document.getElementById('useCustomApi') as HTMLInputElement;
const customApiFields = document.getElementById('customApiFields')!;
const customApiUrl = document.getElementById('customApiUrl') as HTMLInputElement;
const customApiKey = document.getElementById('customApiKey') as HTMLInputElement;

const syncStatus = document.getElementById('syncStatus')!;
const statusText = document.getElementById('statusText')!;

// Default settings
const DEFAULT_SETTINGS = {
  autoSync: false,
  syncMode: 'buffer',
  messageThreshold: 10,
  sites: ['www.messenger.com'],
  bufferSize: 3000,
  useCustomApi: false,
  customApiUrl: '',
  customApiKey: ''
};

let currentSettings = { ...DEFAULT_SETTINGS };

// Load settings from chrome.storage
async function loadSettings() {
  return new Promise<void>((resolve) => {
    chrome.storage.sync.get('smarttodo_settings', (result) => {
      if (result.smarttodo_settings) {
        currentSettings = { ...DEFAULT_SETTINGS, ...result.smarttodo_settings };
      }
      resolve();
    });
  });
}

function renderSettings() {
  autoSyncToggle.checked = currentSettings.autoSync;
  
  if (currentSettings.syncMode === 'message') {
    modeMessage.checked = true;
    bufferSettings.classList.add('hidden');
    messageSettings.classList.remove('hidden');
  } else {
    modeBuffer.checked = true;
    bufferSettings.classList.remove('hidden');
    messageSettings.classList.add('hidden');
  }

  bufferRange.value = String(currentSettings.bufferSize);
  bufferVal.textContent = String(currentSettings.bufferSize);
  messageRange.value = String(currentSettings.messageThreshold);
  messageVal.textContent = String(currentSettings.messageThreshold);
  
  useCustomApi.checked = currentSettings.useCustomApi;
  customApiFields.classList.toggle('hidden', !currentSettings.useCustomApi);
  customApiUrl.value = currentSettings.customApiUrl;
  customApiKey.value = currentSettings.customApiKey;
  renderSiteList();
}

function renderSiteList() {
  siteList.innerHTML = '';
  currentSettings.sites.forEach((site, i) => {
    const div = document.createElement('div');
    div.className = 'site-item';
    div.innerHTML = `<span>${site}</span><button data-index="${i}">✕</button>`;
    siteList.appendChild(div);
  });

  siteList.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-index') || '0');
      currentSettings.sites.splice(idx, 1);
      renderSiteList();
      saveSettings();
    });
  });
}

async function saveSettings() {
  currentSettings.autoSync = autoSyncToggle.checked;
  currentSettings.syncMode = modeMessage.checked ? 'message' : 'buffer';
  currentSettings.bufferSize = parseInt(bufferRange.value);
  currentSettings.messageThreshold = parseInt(messageRange.value);
  currentSettings.useCustomApi = useCustomApi.checked;
  currentSettings.customApiUrl = customApiUrl.value.trim();
  currentSettings.customApiKey = customApiKey.value.trim();

  return new Promise<void>((resolve) => {
    chrome.storage.sync.set({ smarttodo_settings: currentSettings }, () => {
      chrome.runtime.sendMessage({ action: 'settings_updated', settings: currentSettings });
      resolve();
    });
  });
}

// Auth
onAuthStateChanged(auth, async (user) => {
  if (user) {
    authSection.classList.add('hidden');
    syncSection.classList.remove('hidden');
    await loadSettings();
    renderSettings();
  } else {
    authSection.classList.remove('hidden');
    syncSection.classList.add('hidden');
  }
});

loginBtn.addEventListener('click', async () => {
  errorMsg.classList.add('hidden');
  try {
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
  } catch (error: any) {
    errorMsg.textContent = error.message;
    errorMsg.classList.remove('hidden');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
  }
});

logoutBtn.addEventListener('click', () => signOut(auth));

// UI Listeners
addSiteBtn.addEventListener('click', () => {
  const site = newSiteInput.value.trim();
  if (site && !currentSettings.sites.includes(site)) {
    currentSettings.sites.push(site);
    newSiteInput.value = '';
    renderSiteList();
    saveSettings();
  }
});

autoSyncToggle.addEventListener('change', saveSettings);

modeBuffer.addEventListener('change', () => {
  bufferSettings.classList.remove('hidden');
  messageSettings.classList.add('hidden');
  saveSettings();
});

modeMessage.addEventListener('change', () => {
  bufferSettings.classList.add('hidden');
  messageSettings.classList.remove('hidden');
  saveSettings();
});

bufferRange.addEventListener('input', () => {
  bufferVal.textContent = bufferRange.value;
});
bufferRange.addEventListener('change', saveSettings);

messageRange.addEventListener('input', () => {
  messageVal.textContent = messageRange.value;
});
messageRange.addEventListener('change', saveSettings);

useCustomApi.addEventListener('change', () => {
  customApiFields.classList.toggle('hidden', !useCustomApi.checked);
  saveSettings();
});

customApiUrl.addEventListener('change', saveSettings);
customApiKey.addEventListener('change', saveSettings);

// Status updates from background
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'sync_status') {
    syncStatus.classList.remove('hidden');
    statusText.textContent = request.status;
    if (request.error) {
      statusText.style.color = '#ef4444';
    } else {
      statusText.style.color = request.done ? '#10b981' : '#3b82f6';
    }
  }
});
