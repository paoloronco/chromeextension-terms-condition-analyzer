const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const crypto = require("crypto");

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Get the OpenAI API key from Firebase Functions config
const OPENAI_API_KEY = functions.config().openai.key;
if (!OPENAI_API_KEY) {
  console.error("ERROR: OpenAI API key is not configured.");
  throw new Error("OpenAI API key not configured");
}

// Helper function to build the dynamic, structured prompt for OpenAI
function buildStructuredPrompt(preferences) {
  const basePrompt = `You are an expert legal AI assistant. Analyze the following terms and conditions and provide a structured analysis in JSON format. The user is concerned about several key areas of privacy and data handling. Your analysis must be accurate, concise, and easy to understand for a non-legal audience.`;

  const concernMapping = {
    hiddenFees: "Hidden Fees & Charges",
    dataCollection: "Personal Data Collection",
    targetedAds: "Targeted Advertising Practices",
    dataRetention: "Data Retention Policy",
    rightToDelete: "Right to Delete Data",
    dataSharing: "Data Sharing with Third Parties",
  };

  let focusPrompt = "The user has not specified any particular concerns. Provide a balanced, general analysis across all key areas.";

  if (preferences && Object.keys(preferences).length > 0) {
    const sortedConcerns = Object.entries(preferences)
      .map(([key, value]) => ({ key, value: parseInt(value, 10) }))
      .filter((p) => p.value > 50)
      .sort((a, b) => b.value - a.value);

    if (sortedConcerns.length > 0) {
      focusPrompt = "The user has expressed specific concerns. Please focus your analysis on the following topics, in order of importance:";
      sortedConcerns.forEach((concern) => {
        if (concernMapping[concern.key]) {
          focusPrompt += `\n- ${concernMapping[concern.key]} (Concern Level: ${concern.value}/100)`;
        }
      });
    }
  }

  const jsonStructure = {
    overallRating: "Provide a single, clear rating from: Excellent, Good, Fair, Poor, Use with Caution.",
    categoryRatings: {
      hiddenFees: "Rate from 1-10 (1=Very Bad, 10=Excellent).",
      dataCollection: "Rate from 1-10.",
      targetedAds: "Rate from 1-10.",
      dataRetention: "Rate from 1-10.",
      rightToDelete: "Rate from 1-10.",
      dataSharing: "Rate from 1-10.",
    },
    summary: "Provide a concise, intelligent summary of the most critical findings. Start with the most important points. Use bullet points for clarity.",
  };

  return `${basePrompt}\n\n${focusPrompt}\n\nPlease respond ONLY with a valid JSON object matching this structure:\n${JSON.stringify(jsonStructure, null, 2)}`;
}

const analyzeTerms = functions
  .runWith({ memory: "512MB", timeoutSeconds: 120, cpu: 1 })
  .region("europe-west1")
  .https.onRequest(async (req, res) => {
    // Set CORS headers for preflight and actual requests
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(204).send('');
    }
    if (req.method !== "POST") {
      return res.status(405).send("Only POST allowed");
    }

    try {
      const { text, fingerprint, preferences } = req.body;
      if (!text || !fingerprint) {
        return res.status(400).json({ error: "Missing 'text' or 'fingerprint' field" });
      }

      // Simple rate limiting (can be expanded)
      const userHash = crypto.createHash("sha256").update(fingerprint).digest("hex");
      const rateLimitRef = db.collection("rate_limits").doc(userHash);
      const rateLimitDoc = await rateLimitRef.get();
      const now = Date.now();

      if (rateLimitDoc.exists && (now - rateLimitDoc.data().timestamp < 60 * 1000)) { // 1 request per minute
        return res.status(429).json({ error: "Rate limit exceeded. Please wait a moment before trying again." });
      }
      await rateLimitRef.set({ timestamp: now });

      const systemPrompt = buildStructuredPrompt(preferences);
      const textToAnalyze = text.length > 15000 ? text.substring(0, 15000) : text;

      const response = await axios.post("https://api.openai.com/v1/chat/completions", {
        model: "gpt-4-turbo-preview", // Use a model that is good with JSON
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Here is the text to analyze:\n\n${textToAnalyze}` },
        ],
        response_format: { type: "json_object" }, // Enforce JSON output
        temperature: 0.2,
      }, {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      const analysisResult = response.data.choices[0].message.content;
      
      // The result should already be a JSON string, so parse it
      const parsedResult = JSON.parse(analysisResult);

      return res.status(200).json({ success: true, analysis: parsedResult });

    } catch (err) {
      console.error("Error during analysis:", err.response ? err.response.data : err.message);
      return res.status(500).json({ error: "Internal server error", detail: err.message });
    }
  });

exports.analyzeTerms = analyzeTerms;
