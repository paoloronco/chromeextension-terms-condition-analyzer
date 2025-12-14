// Function to update UI with current language
async function updateUILanguage() {
  try {
    // Get the current language from the document or storage
    let lang = document.documentElement.lang;
    if (!lang) {
      const result = await chrome.storage.local.get('language');
      lang = result.language || 'en';
      document.documentElement.lang = lang;
    }
    
    console.log('Updating popup UI language to:', lang);
    
    // Make sure setLanguage is called to update the language in the translations
    if (typeof setLanguage === 'undefined' && typeof window.setLanguage === 'function') {
      await window.setLanguage(lang);
    } else if (typeof setLanguage === 'function') {
      await setLanguage(lang);
    }
    
    // Update all elements with data-i18n attribute
    const elements = document.querySelectorAll('[data-i18n]');
    console.log('Found', elements.length, 'elements to translate in popup');
    
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
      const titleKey = titleElement.getAttribute('data-i18n') || 'popupTitle';
      const titleText = getString(titleKey, lang) || 'Legaly';
      titleElement.textContent = titleText;
      console.log('Updated popup title to:', titleText);
    }
    
    // Update HTML lang attribute
    document.documentElement.lang = lang;
    console.log('Popup UI language updated to:', lang);
  } catch (error) {
    console.error('Error in popup updateUILanguage:', error);
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Initializing popup...');
    
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
    
    // Update UI with current language
    await updateUILanguage();
    
    console.log('Popup initialization complete');
  } catch (error) {
    console.error('Error initializing popup:', error);
  }
});
