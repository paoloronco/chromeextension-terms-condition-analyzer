// UI Elements
const analyzeBtn = document.getElementById('analyzeBtn');
const dashboardBtn = document.getElementById('dashboardBtn');
const outputElement = document.getElementById('output');

// Firebase Function URL
const ANALYZE_FUNCTION_URL = 'https://europe-west1-chromeext-termsconditions.cloudfunctions.net/analyzeTerms';

// Helper to format category names for display
function formatCategoryName(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
}

// Function to get the current language
async function getCurrentLanguage() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getLanguage' }, (response) => {
      resolve(response?.language || 'en');
    });
  });
}

// Function to display the structured analysis
async function displayStructuredAnalysis(analysis) {
  // Add robust type checking to handle data mismatches
  if (typeof analysis !== 'object' || analysis === null) {
    console.error("Received invalid analysis format. Expected an object, but got:", analysis);
    outputElement.innerHTML = `<p class="error-text">${getString('errorOccurred')}</p>`;
    return;
  }

  const { overallRating, categoryRatings, summary } = analysis;
  const currentLang = await getCurrentLanguage();

  let html = `<div class="analysis-results">`;
  
  // Overall Rating
  const ratingClass = overallRating ? `rating-${overallRating.toLowerCase().replace(/\s+/g, '-')}` : '';
  html += `<h2>${getString('overallRating', currentLang)}: <span class="${ratingClass}">${overallRating || 'N/A'}</span></h2>`;

  // Category Ratings
  html += `<h3>${getString('categoryRatings', currentLang)}</h3><div class="category-ratings">`;
  if (categoryRatings) {
    for (const [key, value] of Object.entries(categoryRatings)) {
      const translatedKey = getString(key, currentLang) || formatCategoryName(key);
      html += `<div class="rating-item"><span class="rating-label">${translatedKey}:</span> <span class="rating-value">${value}/10</span></div>`;
    }
  }
  html += `</div>`;

  // Summary
  html += `<h3>${getString('summary', currentLang)}</h3><div class="summary-text">`;
  if (summary) {
    if (Array.isArray(summary)) {
      html += '<ul>' + summary.map(item => `<li>${item}</li>`).join('') + '</ul>';
    } else if (typeof summary === 'string') {
      html += `<p>${summary.replace(/\n/g, '<br>')}</p>`;
    } else {
      html += `<p>${getString('noSummaryAvailable', currentLang)}</p>`;
    }
  } else {
    html += `<p>${getString('noSummaryAvailable', currentLang)}</p>`;
  }
  html += `</div>`; // closes summary-text

  html += `</div>`; // closes analysis-results

  outputElement.innerHTML = html;
}

// Function to get user preferences from storage
async function getUserPreferences() {
  const preferenceKeys = [
    'pref-hiddenFees',
    'pref-dataCollection',
    'pref-targetedAds',
    'pref-dataRetention',
    'pref-rightToDelete',
    'pref-dataSharing'
  ];
  return new Promise((resolve) => {
    chrome.storage.local.get(preferenceKeys, (result) => {
      const preferences = {};
      for (const key of preferenceKeys) {
        const prefName = key.replace('pref-', '');
        preferences[prefName] = result[key] || '50';
      }
      resolve(preferences);
    });
  });
}

// Main analyze button handler
analyzeBtn.addEventListener('click', async () => {
  try {
    const currentLang = await getCurrentLanguage();
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = getString('analyzing', currentLang);
    outputElement.classList.remove('hidden');
    outputElement.innerHTML = `<p class="loading-text">${getString('analysisInProgress', currentLang)}</p>`;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => document.body.innerText
    });

    if (!result || !result.result) throw new Error(getString('noContent', currentLang));

    const pageContent = result.result;
    const fingerprint = await getOrCreateFingerprint();
    const preferences = await getUserPreferences();
    const language = await getCurrentLanguage();

    const response = await fetch(ANALYZE_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text: pageContent, 
        fingerprint, 
        preferences,
        language // Send the current language to the backend
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || getString('analysisFailed', currentLang));
    }

    const data = await response.json();

    if (data.success && data.analysis) {
      await displayStructuredAnalysis(data.analysis);
    } else {
      outputElement.textContent = getString('analysisFailed', currentLang);
    }

  } catch (error) {
    console.error('Error:', error);
    const currentLang = await getCurrentLanguage();
    outputElement.innerHTML = `<p class="error-text">${getString('errorOccurred', currentLang)}: ${error.message || getString('unknownError', currentLang)}</p>`;
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = getString('analyzeBtn', await getCurrentLanguage());
  }
});

// Generate or retrieve fingerprint
async function getOrCreateFingerprint() {
  return new Promise((resolve) => {
    chrome.storage.local.get('fingerprint', (result) => {
      if (result.fingerprint) return resolve(result.fingerprint);
      const fp = window.crypto?.randomUUID ? crypto.randomUUID() : 'fp-' + Math.random().toString(36).substring(2, 15);
      chrome.storage.local.set({ fingerprint: fp }, () => resolve(fp));
    });
  });
}

// Navigation to Dashboard
dashboardBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'dashboard.html' });
});

// Listen for language changes from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'languageChanged') {
    document.documentElement.lang = request.language;
    updateUILanguage();
    // Update any displayed content that might be language-dependent
    if (outputElement && !outputElement.classList.contains('hidden')) {
      const currentContent = outputElement.innerHTML;
      outputElement.innerHTML = currentContent; // This will trigger a re-render
    }
  }
});

// Also listen for window messages (for direct communication)
window.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'languageChanged') {
    document.documentElement.lang = event.data.language;
    updateUILanguage();
  }
});

// Update UI when language changes
async function updateUILanguage() {
  try {
    // Get current language
    const lang = document.documentElement.lang || await getCurrentLanguage() || 'en';
    
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      if (key) {
        const text = getString(key, lang);
        if (element.tagName === 'INPUT' && (element.type === 'text' || 
            element.type === 'submit' || 
            element.type === 'button')) {
          element.value = text;
        } else if (element.tagName === 'TEXTAREA' || 
                  (element.tagName === 'INPUT' && element.type === 'text')) {
          element.placeholder = text;
        } else {
          element.textContent = text;
        }
      }
    });
    
    // Update title
    const titleElement = document.querySelector('title');
    if (titleElement && titleElement.hasAttribute('data-i18n')) {
      const titleKey = titleElement.getAttribute('data-i18n');
      titleElement.textContent = getString(titleKey, lang) || titleElement.textContent;
    }
    
    // Update HTML lang attribute
    document.documentElement.lang = lang;
    
  } catch (error) {
    console.error('Error updating UI language:', error);
  }
}

// Listen for language change messages
function handleMessage(message, sender, sendResponse) {
  if (message.action === 'languageChanged') {
    console.log('Popup received language change:', message.language);
    updateUILanguage().then(() => {
      if (sendResponse) {
        sendResponse({ success: true });
      }
    });
    return true; // Keep the message channel open for async response
  }
}

// Add message listener
chrome.runtime.onMessage.addListener(handleMessage);

// Initialize language when the page loads
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await updateUILanguage();
  } catch (error) {
    console.error('Error initializing popup:', error);
  }
});

// Initialize language when popup opens
(async () => {
  try {
    await updateUILanguage();
  } catch (error) {
    console.error('Error initializing popup:', error);
  }
})();