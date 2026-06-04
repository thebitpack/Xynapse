import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up JSON body limits to support base64 images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy initializer for Google Gen AI
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY is not configured in environment variables.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Simulated data in case Gemini key is not found, to keep app functional
const MOCK_REPORTS: Record<string, any> = {
  pleural_effusion: {
    findings: [
      {
        name: "Pleural Effusion",
        confidence: 0.894,
        location: { x: 25, y: 30, width: 35, height: 40 },
        description: "Blunting of the costophrenic angle on the lateral side with fluid accumulation.",
        severity: "Moderate"
      }
    ],
    summary: "Radiological evidence suggests moderate unilateral pleural effusion in the left lung zone. Normal cardiac silhouette. No signs of pneumothorax.",
    recommendations: [
      "Correlate findings with patient's clinical presentation (shortness of breath, chest pain).",
      "Symptom-guided thoracentesis may be considered if clinically indicated.",
      "Follow-up upright chest radiograph in 24-48 hours to assess fluid levels."
    ],
    metrics: { acc: "94.7%", lat: "12ms" }
  },
  cardiomegaly: {
    findings: [
      {
        name: "Cardiomegaly",
        confidence: 0.912,
        location: { x: 40, y: 55, width: 30, height: 28 },
        description: "Enlargement of the cardiac silhouette with cardiothoracic ratio exceeding 0.55.",
        severity: "Mild"
      }
    ],
    summary: "Mild cardiomegaly noted. Bilateral lung fields are clear with no vascular crowding or pleural fluid.",
    recommendations: [
      "Clinical correlation with blood pressure tracking and cardiac history.",
      "Echocardiogram suggested to assess left ventricular ejection fraction if patient is symptomatic."
    ],
    metrics: { acc: "95.2%", lat: "14ms" }
  },
  normal: {
    findings: [],
    summary: "No focal consolidation, pneumothorax, or pleural effusion. The cardiomediastinal silhouette is normal in size and configuration. Normal lung expansion.",
    recommendations: [
      "Routine clinical follow-up. No acute radiological abnormality detected."
    ],
    metrics: { acc: "98.1%", lat: "10ms" }
  }
};

// API Endpoints
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY",
    timestamp: new Date().toISOString()
  });
});

app.post("/api/analyze", async (req, res): Promise<any> => {
  const { image, mimeType, patientName = "Anonymous Patient" } = req.body;

  if (!image) {
    return res.status(400).json({ error: "Missing image parameter" });
  }

  const hasRealKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";

  if (!hasRealKey) {
    // If no real API key is configured, return mock data simulated based on keyword matching
    console.log("No GEMINI_API_KEY found, fallback to mock analysis responses.");
    
    // Choose a mock report based on name or random
    const searchString = (patientName + " " + (mimeType || "")).toLowerCase();
    let reportType = "normal";
    if (searchString.includes("effusion") || searchString.includes("fluid") || Math.random() > 0.6) {
      reportType = "pleural_effusion";
    } else if (searchString.includes("cardio") || searchString.includes("heart")) {
      reportType = "cardiomegaly";
    }

    const mockReport = MOCK_REPORTS[reportType];
    return res.json({
      ...mockReport,
      patientName,
      isSimulated: true,
      message: "This analysis was generated using standard presets since no GEMINI_API_KEY is configured in Settings."
    });
  }

  try {
    const ai = getGenAI();

    // The client sends base64 image data without prefix "data:image/png;base64,"
    const cleanBase64 = image.includes("base64,") ? image.split("base64,")[1] : image;
    const cleanMime = mimeType || "image/png";

    const promptText = `
      You are an expert radiological chest X-ray deep learning analyzer and clinical assistant.
      Analyze the attached image and identify anomalies (such as Pleural Effusion, Cardiomegaly, Pneumothorax, Nodules, Consolidation, Normal, etc.).
      
      You MUST respond STRICTLY in JSON format matching this schema:
      {
        "findings": [
          {
            "name": "Finding name (e.g., Pleural Effusion)",
            "confidence": 0.89,
            "location": {
              "x": 25, 
              "y": 30, 
              "width": 30, 
              "height": 40
            },
            "description": "Specific visual description of the visual markers",
            "severity": "Mild" | "Moderate" | "Severe"
          }
        ],
        "summary": "Full clinical radiological summary of your investigation.",
        "recommendations": [
          "Prescriptive actionable recommendation 1",
          "Prescriptive actionable recommendation 2"
        ],
        "metrics": {
          "acc": "AI model simulated confidence average percentage (e.g. 94.7%)",
          "lat": "Inference time (e.g., 12ms)"
        }
      }

      Important constraints:
      1. Bounding box 'location' coordinates (x, y, width, height) must be relative integer percentages from 0 to 100 representing the bounding box. x and y represent the center or top-left (assume top-left) coordinates of the finding on the X-ray, where 0,0 is top-left and 100,100 is bottom-right.
      2. If the X-ray is entirely normal, return "findings": [].
      3. Do NOT include any markdown code blocks, backticks (such as \`\`\`json), or text before/after the JSON. Return only the raw JSON.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: cleanMime,
            data: cleanBase64
          }
        },
        promptText
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    const textOutput = response.text || "{}";
    
    // Parse response
    let reportDataAndMetrics;
    try {
      reportDataAndMetrics = JSON.parse(textOutput.trim());
    } catch (parseError) {
      console.error("Failed to parse Gemini JSON output:", textOutput);
      // Fallback clean regex extraction
      const jsonRegex = /\{[\s\S]*\}/;
      const match = textOutput.match(jsonRegex);
      if (match) {
        reportDataAndMetrics = JSON.parse(match[0]);
      } else {
        throw new Error("Invalid output format from analyzer model.");
      }
    }

    return res.json({
      ...reportDataAndMetrics,
      patientName,
      isSimulated: false
    });

  } catch (error: any) {
    console.error("Gemini analysis error:", error);
    return res.status(500).json({
      error: "Error processing the X-ray scan.",
      details: error.message || String(error)
    });
  }
});

app.post("/api/chat", async (req, res): Promise<any> => {
  const { message, history = [], scan } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Missing message parameter" });
  }

  const hasRealKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";

  if (!hasRealKey) {
    // Return a smart mock response based on the scan content and user message
    let reply = "I am the Xynapse AI assistant. I can help analyze this radiograph, but my live connection is disabled because no Gemini API key is configured. Please add a GEMINI_API_KEY in the environment files to enable live conversation.";
    
    const msgLower = message.toLowerCase();
    if (scan) {
      const findingsStr = scan.findings.map((f: any) => f.name).join(", ");
      if (msgLower.includes("finding") || msgLower.includes("what did you find") || msgLower.includes("lesion") || msgLower.includes("abnormality") || msgLower.includes("detect")) {
        if (scan.findings.length > 0) {
          reply = `Based on the radiograph analysis for ${scan.patientName}, the primary finding is ${findingsStr}. ${scan.findings[0].description} This is classified as ${scan.findings[0].severity} severity.`;
        } else {
          reply = `The radiograph analysis for ${scan.patientName} shows normal, clear lung fields with no detected anomalies or lesions.`;
        }
      } else if (msgLower.includes("recommend") || msgLower.includes("next step") || msgLower.includes("do next") || msgLower.includes("clinical directive") || msgLower.includes("suggest")) {
        reply = `For ${scan.patientName}, the recommended next steps are:\n` + scan.recommendations.map((r: string) => `- ${r}`).join("\n");
      } else if (msgLower.includes("summary") || msgLower.includes("explain") || msgLower.includes("detail")) {
        reply = `Here is the clinical summary for ${scan.patientName}: "${scan.summary}"`;
      } else if (msgLower.includes("hello") || msgLower.includes("hi") || msgLower.includes("hey")) {
        reply = `Hello! I am your clinical assistant for ${scan.patientName}'s radiograph. How can I help you interpret the findings today?`;
      } else {
        reply = `Regarding the radiograph of ${scan.patientName} showing ${findingsStr || "no anomalies"}: the summary notes: "${scan.summary}". Please let me know if you have specific questions about these findings or the recommended clinical directives.`;
      }
    }
    return res.json({ reply });
  }

  try {
    const ai = getGenAI();
    
    // Construct system prompt with scan context
    let scanContext = "";
    if (scan) {
      scanContext = `
        Active Scan Details:
        - Patient Name: ${scan.patientName}
        - File Name: ${scan.fileName}
        - Findings: ${JSON.stringify(scan.findings)}
        - Radiologist Summary: ${scan.summary}
        - Suggested Clinical Directives: ${scan.recommendations.join("; ")}
      `;
    }

    const systemPrompt = `
      You are an expert clinical radiology assistant for Xynapse.
      You help medical specialists interpret chest radiographs and answer questions about patients' scan reports.
      Be professional, concise, and clinically precise. Use formatting (bullet points, bold text) where appropriate.
      
      Always base your answers on the provided Active Scan Details context if relevant.
      If the user asks questions unrelated to medical imaging or this scan, politely redirect them back to clinical analysis.
      
      Here is the patient's radiograph analysis context:
      ${scanContext}
    `;

    // Map history to Google Gen AI contents structure
    const contents: any[] = [];
    
    // Add history
    for (const msg of history) {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }]
      });
    }

    // Add current message
    contents.push({
      role: "user",
      parts: [{ text: `${systemPrompt}\n\nUser Question: ${message}` }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
    });

    return res.json({ reply: response.text || "I was unable to formulate a response." });
  } catch (error: any) {
    console.error("Gemini chat error:", error);
    return res.status(500).json({
      error: "Error generating chat response.",
      details: error.message || String(error)
    });
  }
});

// Configure Vite and static assets middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Xynapse Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
