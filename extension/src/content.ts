let lastChatHash = '';

function extractAndSendChat(isManual = false) {
  try {
    const messageElements = Array.from(document.querySelectorAll('div[dir="auto"]'));
    
    // Filter out elements that don't look like chat messages and take the last 30
    const chatTexts = messageElements
      .map(el => el.textContent?.trim())
      .filter(text => text && text.length > 0)
      .slice(-30);

    const currentHash = chatTexts.join('|');
    
    // Only send if it's a manual trigger OR if the chat has actually changed
    if (isManual || (chatTexts.length > 0 && currentHash !== lastChatHash)) {
      lastChatHash = currentHash;
      chrome.runtime.sendMessage({
        action: 'process_chat',
        chatLog: chatTexts
      });
      return true;
    }
    return false;
  } catch (e) {
    console.error('SmartTODO: Error extracting chat', e);
    return false;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract_chat') {
    const sent = extractAndSendChat(true);
    sendResponse({ status: sent ? "Extracting..." : "No new messages" });
  }
});

// Auto-sync every 30 seconds
setInterval(() => extractAndSendChat(false), 30000);
