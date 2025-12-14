// Tab functionality
const tabLinks = document.querySelectorAll('.tab-link');
const tabContents = document.querySelectorAll('.tab-content');

function showTab(tabName) {
  // Hide all content and deactivate all links
  tabContents.forEach(content => content.classList.remove('active'));
  tabLinks.forEach(link => link.classList.remove('active'));

  // Activate the correct tab and link
  document.getElementById(tabName).classList.add('active');
  document.querySelector(`.tab-link[data-tab='${tabName}']`).classList.add('active');
}

// Initialize tabs
tabLinks.forEach(link => {
  link.addEventListener('click', () => {
    const tabName = link.getAttribute('data-tab');
    showTab(tabName);
  });
});

// Show the 'privacy' tab by default
showTab('privacy');

// --- Sliders and Language Persistence ---
const sliders = document.querySelectorAll('.slider');
sliders.forEach(slider => {
  const key = slider.id;
  const valSpan = document.getElementById(`val-${key}`);
  
  // Load saved preferences from chrome.storage
  chrome.storage.local.get(`pref-${key}`, (result) => {
    const saved = result[`pref-${key}`];
    if (saved !== undefined) {
      slider.value = saved;
      if(valSpan) valSpan.textContent = saved;
    }
  });

  // Save changes to chrome.storage
  slider.addEventListener('input', () => {
    if(valSpan) valSpan.textContent = slider.value;
    chrome.storage.local.set({ [`pref-${key}`]: slider.value });
  });
});

// Language selection and handling
const languageSelect = document.getElementById('languageSelect');

// Update UI with current language
async function updateUILanguage() {
  try {
    // Get the current language from the document or storage
    let lang = document.documentElement.lang;
    if (!lang) {
      const result = await chrome.storage.local.get('language');
      lang = result.language || 'en';
      document.documentElement.lang = lang;
    }
    
    console.log('Updating dashboard UI language to:', lang);
    
    // Ensure the language is set in the dropdown
    if (languageSelect) {
      languageSelect.value = lang;
    }
    
    // Update all elements with data-i18n attribute
    const elements = document.querySelectorAll('[data-i18n]');
    console.log('Found', elements.length, 'elements to translate in dashboard');
    
    for (const element of elements) {
      const key = element.getAttribute('data-i18n');
      if (key) {
        try {
          const text = getString(key, lang) || key;
          console.log(`Translating ${key} to ${lang}:`, text);
          
          if (element.tagName === 'INPUT') {
            if (element.type === 'submit' || element.type === 'button') {
              element.value = text;
            } else if (element.type === 'text' || element.type === 'email' || element.type === 'password') {
              element.placeholder = text;
            }
          } else if (element.tagName === 'TEXTAREA') {
            element.placeholder = text;
          } else {
            element.textContent = text;
          }
        } catch (error) {
          console.error(`Error translating ${key}:`, error);
        }
      }
    }
    
    // Update title
    const titleElement = document.querySelector('title');
    if (titleElement) {
      const titleKey = titleElement.getAttribute('data-i18n') || 'dashboardTitle';
      const titleText = getString(titleKey, lang) || 'Legaly Dashboard';
      titleElement.textContent = titleText;
      console.log('Updated dashboard title to:', titleText);
    }
    
    console.log('Dashboard UI language updated to:', lang);
  } catch (error) {
    console.error('Error in dashboard updateUILanguage:', error);
  }
}

// Handle language selection change
if (languageSelect) {
  // Load saved language
  chrome.storage.local.get('language', (result) => {
    if (result.language) {
      languageSelect.value = result.language;
      console.log('Loaded saved language:', result.language);
    } else {
      console.log('No saved language, using default');
    }
  });
  
  // Save language preference, update UI and broadcast change
  languageSelect.addEventListener('change', async (event) => {
    try {
      const lang = event.target.value;
      console.log('Language changed to:', lang);
      
      // Update the language in storage and UI
      await setLanguage(lang);
      await updateUILanguage();
      
      // Broadcast language change to other parts of the extension
      chrome.runtime.sendMessage({ 
        action: 'languageChanged', 
        language: lang 
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending language change message:', chrome.runtime.lastError);
        } else {
          console.log('Language change broadcasted successfully');
        }
      });
      
    } catch (error) {
      console.error('Error changing language:', error);
    }
  });
}

// Initialize language when the page loads
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Initializing dashboard...');
    
    // Get saved language or use browser language
    const result = await chrome.storage.local.get('language');
    const savedLang = result.language || navigator.language.split('-')[0] || 'en';
    console.log('Using language:', savedLang);
    
    // Set initial language
    await setLanguage(savedLang);
    document.documentElement.lang = savedLang;
    
    // Initial UI update
    await updateUILanguage();
    
    // Listen for language changes from other parts of the extension
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'languageChanged') {
        console.log('Dashboard received language change:', request.language);
        document.documentElement.lang = request.language;
        updateUILanguage();
        if (sendResponse) {
          sendResponse({ success: true });
        }
        return true; // Keep the message channel open for the async response
      }
    });
    
    console.log('Dashboard initialized with language:', savedLang);
    window.addEventListener('message', (event) => {
      if (event.data && event.data.action === 'languageChanged') {
        document.documentElement.lang = event.data.language;
        updateUILanguage();
        
        // Update the dropdown to reflect the current language
        if (languageSelect && languageSelect.value !== event.data.language) {
          languageSelect.value = event.data.language;
        }
      }
    });
    
  } catch (error) {
    console.error('Error initializing dashboard:', error);
  }
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentLanguage') {
    chrome.storage.local.get('language', (result) => {
      sendResponse({ language: result.language || 'en' });
    });
    return true; // Required for async sendResponse
  }
});

