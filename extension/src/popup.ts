import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

const authSection = document.getElementById('authSection')!;
const syncSection = document.getElementById('syncSection')!;
const loginBtn = document.getElementById('loginBtn') as HTMLButtonElement;
const logoutBtn = document.getElementById('logoutBtn') as HTMLButtonElement;
const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
const emailInput = document.getElementById('email') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const errorMsg = document.getElementById('errorMsg')!;
const statusMsg = document.getElementById('statusMsg')!;

// Settings elements
const autoSyncToggle = document.getElementById('autoSyncToggle') as HTMLInputElement;
const siteList = document.getElementById('siteList')!;
const newSiteInput = document.getElementById('newSiteInput') as HTMLInputElement;
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

// Default settings
const DEFAULT_SETTINGS = {
  autoSync: false,
  syncMode: 'buffer', // 'buffer' or 'message'
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

// ... existing renderSiteList and other functions ...

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

// ... auth and range listeners ...

modeBuffer.addEventListener('change', () => {
  bufferSettings.classList.remove('hidden');
  messageSettings.classList.add('hidden');
});

modeMessage.addEventListener('change', () => {
  bufferSettings.classList.add('hidden');
  messageSettings.classList.remove('hidden');
});

bufferRange.addEventListener('input', () => {
  bufferVal.textContent = bufferRange.value;
});

messageRange.addEventListener('input', () => {
  messageVal.textContent = messageRange.value;
});

useCustomApi.addEventListener('change', () => {
  customApiFields.classList.toggle('hidden', !useCustomApi.checked);
});

addSiteBtn.addEventListener('click', () => {
  const site = newSiteInput.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (site && !currentSettings.sites.includes(site)) {
    currentSettings.sites.push(site);
    renderSiteList();
    newSiteInput.value = '';
  }
});

saveBtn.addEventListener('click', async () => {
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  await saveSettings();
  statusMsg.textContent = '✓ Settings saved!';
  statusMsg.style.color = '#10b981';
  saveBtn.disabled = false;
  saveBtn.textContent = 'Save Settings';
  setTimeout(() => { statusMsg.textContent = ''; }, 2000);
});

// Listen for sync status from background
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'sync_status') {
    statusMsg.textContent = request.status;
    statusMsg.style.color = request.error ? '#ef4444' : '#10b981';
  }
});
