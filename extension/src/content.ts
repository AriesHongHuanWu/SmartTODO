let seenMessages = new Set<string>();
let messageBuffer: string[] = [];

function checkAndAccumulateChat() {
  try {
    const messageElements = Array.from(document.querySelectorAll('div[dir="auto"]'));
    
    // Filter out elements that don't look like chat messages
    const chatTexts = messageElements
      .map(el => el.textContent?.trim())
      .filter(text => text && text.length > 0);

    let newMessagesFound = false;

    // Add only new messages to buffer
    for (const text of chatTexts) {
      if (text && !seenMessages.has(text)) {
        seenMessages.add(text);
        messageBuffer.push(text);
        newMessagesFound = true;
      }
    }

    // Keep memory usage in check by limiting the Set size
    if (seenMessages.size > 1000) {
      seenMessages.clear();
    }

    // Trigger AI analysis when buffer exceeds 2000 characters (~30-50 messages)
    // Gemini Flash Lite free tier: 1,000 requests/day, 1M token context window
    const currentBufferStr = messageBuffer.join(' ');
    if (currentBufferStr.length >= 2000) {
      chrome.runtime.sendMessage({
        action: 'process_chat',
        chatLog: [...messageBuffer]
      });
      // Clear buffer after sending
      messageBuffer = [];
      return true;
    }

    return newMessagesFound;
  } catch (e) {
    console.error('SmartTODO: Error extracting chat', e);
    return false;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract_chat') {
    // If manually triggered, send whatever is in the buffer immediately
    if (messageBuffer.length > 0) {
      chrome.runtime.sendMessage({
        action: 'process_chat',
        chatLog: [...messageBuffer]
      });
      messageBuffer = [];
      sendResponse({ status: "Extracting buffered messages..." });
    } else {
      sendResponse({ status: "No new messages to sync" });
    }
  }
});

// Scan DOM every 5 seconds for new messages
setInterval(checkAndAccumulateChat, 5000);
