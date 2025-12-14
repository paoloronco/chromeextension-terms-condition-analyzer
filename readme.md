Terms & Conditions Analyzer – Chrome Extension
==============================================

⚠️ **Important notice**  
This repository contains the source code of a **personal project**: a Chrome Extension developed for experimental purposes that analyzed **Terms and Conditions** of websites using **Firebase** and **OpenAI APIs**.

The extension is **no longer published on the Chrome Web Store** and the project is now released **freely for study, reference, and reuse**.

* * *

🧠 Project overview
-------------------

The goal of the extension was to help users quickly understand long and complex **Terms and Conditions** by:

1. Extracting the Terms & Conditions text from the current web page

2. Sending the content to a Firebase backend

3. Analyzing the text using **OpenAI**

4. Returning a **structured summary**, highlighting critical aspects such as privacy, data usage, limitations, and user rights

* * *

🧩 High-level architecture
--------------------------

    Chrome Extension
       |
       |  HTTPS request
       v
    Firebase Cloud Functions
       |
       |  OpenAI API
       v
    AI-powered Terms & Conditions analysis

### Technologies used

* **Chrome Extension (Manifest V3)**

* **JavaScript / HTML / CSS**

* **Firebase Cloud Functions (Node.js)**

* **OpenAI API**

* **Firebase configuration & hosting**

* * *

🧩 Repository structure
-----------------------

### 📁 Chrome Extension

Contains the frontend code of the extension:

* `manifest.json` – Chrome extension configuration

* `popup.html / popup.js` – main extension UI

* `dashboard.html` – detailed analysis results page

* JavaScript logic for:
  
  * extracting page content
  
  * calling Firebase endpoints
  
  * rendering AI-generated results

### 📁 Firebase Functions

Serverless backend responsible for:

* exposing HTTPS endpoints (e.g. `analyzeTerms`)

* receiving the extracted Terms & Conditions text

* invoking the OpenAI API

* returning the analysis to the extension

The OpenAI API key is **not hardcoded** and is retrieved via Firebase environment configuration:
    functions.config().openai.key

* * *

🔐 Security & configuration notes
---------------------------------

* No API keys or secrets are hardcoded in the repository

* Sensitive configuration was managed via **Firebase Environment Config**

* Basic CORS and input validation were applied on backend endpoints

⚠️ If you plan to reuse this project, it is strongly recommended to:

* add authentication

* restrict public endpoint access

* implement rate limiting and abuse protection

* * *

📦 Project status
-----------------

* ❌ Extension **no longer published**

* ❌ No active backend services guaranteed

* ✅ Code released freely

* ✅ Can be used as a reference for:
  
  * Chrome Extensions
  
  * Firebase serverless backends
  
  * OpenAI API integrations

* * *

📄 License
----------

This project is released as **free software**.  
You are free to use, modify, and adapt it for your own purposes.

* * *

ℹ️ Disclaimer
-------------

This project was developed for **experimental and educational purposes only**.  
It does **not provide legal advice** and does not replace professional legal review of Terms and Conditions.

* * *

✉️ Contact
----------

For technical questions or curiosity about the project, feel free to open an **issue** on GitHub.
