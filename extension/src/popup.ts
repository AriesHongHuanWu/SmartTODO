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
const useCustomApi = document.getElementById('useCustomApi') as HTMLInputElement;
const customApiFields = document.getElementById('customApiFields')!;
const customApiUrl = document.getElementById('customApiUrl') as HTMLInputElement;
const customApiKey = document.getElementById('customApiKey') as HTMLInputElement;

// Default settings
const DEFAULT_SETTINGS = {
  autoSync: false,
  sites: ['www.messenger.com'],
  bufferSize: 5000,
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
  bufferRange.value = String(currentSettings.bufferSize);
  bufferVal.textContent = String(currentSettings.bufferSize);
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

  // Attach remove handlers
  siteList.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-index') || '0');
      currentSettings.sites.splice(idx, 1);
      renderSiteList();
    });
  });
}

async function saveSettings() {
  currentSettings.autoSync = autoSyncToggle.checked;
  currentSettings.bufferSize = parseInt(bufferRange.value);
  currentSettings.useCustomApi = useCustomApi.checked;
  currentSettings.customApiUrl = customApiUrl.value.trim();
  currentSettings.customApiKey = customApiKey.value.trim();

  return new Promise<void>((resolve) => {
    chrome.storage.sync.set({ smarttodo_settings: currentSettings }, () => {
      // Notify background/content scripts that settings changed
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

// Settings handlers
bufferRange.addEventListener('input', () => {
  bufferVal.textContent = bufferRange.value;
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
