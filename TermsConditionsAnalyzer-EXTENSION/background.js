// Function to broadcast language change to all extension components
async function broadcastLanguageChange(language, sendResponse = null) {
  console.log('Broadcasting language change to:', language);
  
  try {
    // Query for all open extension pages (dashboard, etc.)
    const tabs = await chrome.tabs.query({
      url: [
        chrome.runtime.getURL('dashboard.html') + '*',
        chrome.runtime.getURL('popup.html') + '*'
      ]
    });

    // Send a message to each open extension tab
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { 
          action: 'languageChanged', 
          language: language 
        });
        console.log(`Notified tab ${tab.id} of language change.`);
      } catch (error) {
        // This can happen if the tab is not ready, which is not critical.
        console.warn(`Could not send message to tab ${tab.id}:`, error.message);
      }
    }

    // Also send a message to the runtime, which will be picked up by the active popup.
    // Use try-catch to handle cases where there are no listeners
    try {
      await chrome.runtime.sendMessage({
        action: 'languageChanged',
        language: language
      });
    } catch (e) {
      console.log('No active runtime listeners for language change');
    }

    if (sendResponse) {
      sendResponse({ success: true });
    }
  } catch (error) {
    // An error here might mean no listeners were available (e.g., popup closed).
    // This is not a critical failure of the broadcast itself.
    console.log('Finished broadcasting with a minor error (likely no listeners):', error.message);
    if (sendResponse) {
      sendResponse({ success: true, warning: 'No active listeners found.' });
    }
  }
}

// Handle incoming messages
function handleMessage(request, sender, sendResponse) {
  console.log('Background received message:', request);
  
  // Handle getLanguage request
  if (request.action === 'getLanguage') {
    chrome.storage.local.get('language', (result) => {
      const lang = result.language || 'en';
      console.log('Sending current language:', lang);
      sendResponse({ language: lang });
    });
    return true; // Keep message channel open for async response
  } 
  
  // Handle setLanguage request
  if (request.action === 'setLanguage') {
    console.log('Setting language to:', request.language);
    chrome.storage.local.set({ language: request.language }, () => {
      console.log('Language set in storage, broadcasting change');
      broadcastLanguageChange(request.language, sendResponse);
    });
    return true; // Keep message channel open for async response
  }
  
  // Handle languageChanged notification
  if (request.action === 'languageChanged') {
    console.log('Received language change notification, rebroadcasting');
    broadcastLanguageChange(request.language, sendResponse);
    return true; // Keep message channel open for async response
  }
  
  // For any other messages, don't keep the message channel open
  return false;
}

// Add message listener
chrome.runtime.onMessage.addListener(handleMessage);

// Listen for storage changes to sync language across all components
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.language) {
    console.log('Detected language change in storage:', changes.language.newValue);
    broadcastLanguageChange(changes.language.newValue);
  }
});

// Listen for installation/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details);
  // Set default language if not set
  chrome.storage.local.get('language', (result) => {
    if (!result.language) {
      console.log('No language set, defaulting to English');
      chrome.storage.local.set({ language: 'en' });
    } else {
      console.log('Current language:', result.language);
    }
  });
});

// Log when the background script is loaded
console.log('Background script loaded');