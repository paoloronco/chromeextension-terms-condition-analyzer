// Function to update the UI with the current language
async function updateUILanguage() {
  try {
    // Get the current language from the document or storage
    let lang = document.documentElement.lang;
    if (!lang) {
      const result = await chrome.storage.local.get('language');
      lang = result.language || 'en';
      document.documentElement.lang = lang;
    }
    
    console.log('Updating UI language to:', lang);
    
    // Make sure setLanguage is called to update the language in the translations
    if (typeof setLanguage === 'undefined' && typeof window.setLanguage === 'function') {
      await window.setLanguage(lang);
    } else if (typeof setLanguage === 'function') {
      await setLanguage(lang);
    }
    
    // Update all elements with data-i18n attribute
    const elements = document.querySelectorAll('[data-i18n]');
    console.log('Found', elements.length, 'elements to translate');
    
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
      console.log('Updated title to:', titleText);
    }
    
    // Update HTML lang attribute
    document.documentElement.lang = lang;
    console.log('UI language updated to:', lang);
  } catch (error) {
    console.error('Error in updateUILanguage:', error);
  }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Initializing dashboard...');
    
    // Get saved language or use browser language
    const result = await chrome.storage.local.get('language');
    const savedLang = result.language || navigator.language.split('-')[0] || 'en';
    console.log('Using language:', savedLang);
    
    // Set initial language
    if (typeof setLanguage === 'undefined' && typeof window.setLanguage === 'function') {
      await window.setLanguage(savedLang);
    } else if (typeof setLanguage === 'function') {
      await setLanguage(savedLang);
    }
    document.documentElement.lang = savedLang;
    
    // Set the selected language in the dropdown
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
      languageSelect.value = savedLang;
      
      // Add event listener for language change
      languageSelect.addEventListener('change', async (e) => {
        const newLang = e.target.value;
        console.log('Language changed to:', newLang);
        await chrome.storage.local.set({ language: newLang });
        document.documentElement.lang = newLang;
        await updateUILanguage();
      });
    }
    
    // Set up tab switching
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = link.getAttribute('data-tab');
        
        // Remove active class from all tabs and contents
        tabLinks.forEach(tab => tab.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding content
        link.classList.add('active');
        document.getElementById(tabId).classList.add('active');
      });
    });
    
    // Activate the first tab by default
    if (tabLinks.length > 0) {
      tabLinks[0].click();
    }
    
    // Load saved preferences
    const preferenceKeys = [
      'pref-hiddenFees',
      'pref-dataCollection',
      'pref-targetedAds',
      'pref-dataRetention',
      'pref-rightToDelete',
      'pref-dataSharing'
    ];
    
    const prefs = await chrome.storage.local.get(preferenceKeys);
    
    preferenceKeys.forEach(key => {
      const prefName = key.replace('pref-', '');
      const slider = document.getElementById(prefName);
      const valueSpan = document.getElementById(`val-${prefName}`);
      
      if (slider && valueSpan) {
        // Set the saved value or default to 50
        const savedValue = prefs[key] || 50;
        slider.value = savedValue;
        valueSpan.textContent = savedValue;
        
        // Update value display when slider changes
        slider.addEventListener('input', (e) => {
          const value = e.target.value;
          valueSpan.textContent = value;
          // Save preference
          chrome.storage.local.set({ [key]: parseInt(value, 10) });
        });
      }
    });
    
    // Initial UI update
    await updateUILanguage();
    
    console.log('Dashboard initialization complete');
  } catch (error) {
    console.error('Error initializing dashboard:', error);
  }
});

// Listen for language changes from other parts of the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'languageChanged') {
    console.log('Dashboard received language change:', request.language);
    document.documentElement.lang = request.language;
    updateUILanguage().then(() => {
      if (sendResponse) {
        sendResponse({ success: true });
      }
    });
    return true; // Keep the message channel open for async response
  }
});
