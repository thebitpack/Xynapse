import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up JSON body limits to support base64 images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Simulated data for local fallback / webhook mock analysis
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
    hasApiKey: true, // The app communicates with the remote Flask production server directly
    timestamp: new Date().toISOString()
  });
});

app.post("/api/analyze", async (req, res): Promise<any> => {
  const { image, mimeType, patientName = "Anonymous Patient" } = req.body;

  if (!image) {
    return res.status(400).json({ error: "Missing image parameter" });
  }

  console.log("[Xynapse Server] /api/analyze webhook mock request received.");
  
  // Choose a mock report based on name or query parameters
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
    message: "This analysis was generated using standard presets."
  });
});

app.post("/api/chat", async (req, res): Promise<any> => {
  const { message, history = [], scan } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Missing message parameter" });
  }

  // Transform history: map role "model" → "assistant", rename field text → content
  const transformedHistory = history.map((msg: any) => ({
    role: msg.role === "model" ? "assistant" : msg.role,
    content: msg.text !== undefined ? msg.text : msg.content,
  }));

  // Transform scan: build detected[] and probs{} from findings[]
  let transformedScan: any = undefined;
  if (scan && Array.isArray(scan.findings)) {
    transformedScan = {
      detected: scan.findings.map((f: any) => f.name),
      probs: Object.fromEntries(scan.findings.map((f: any) => [f.name, f.confidence])),
    };
  }

  const flaskPayload: any = { message, history: transformedHistory };
  if (transformedScan !== undefined) {
    flaskPayload.scan = transformedScan;
  }

  try {
    const flaskRes = await fetch("https://xynapse-backend-production.up.railway.app/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(flaskPayload),
    });

    const data = await flaskRes.json();

    if (!flaskRes.ok) {
      return res.status(flaskRes.status).json(data);
    }

    return res.json(data);
  } catch (error: any) {
    console.error("Flask chat proxy error:", error);
    return res.status(502).json({
      error: "Failed to reach chat backend.",
      details: error.message || String(error),
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
