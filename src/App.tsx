import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  Upload,
  Image as ImageIcon,
  ArrowRight,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Contrast,
  Code,
  BookOpen,
  User,
  Users,
  Compass,
  ExternalLink,
  Lock,
  CheckCircle2,
  AlertCircle,
  FileText,
  MessageSquare,
  Send,
  Sparkles,
  Trash2,
  Linkedin
} from "lucide-react";
import { PRESET_SCANS, TEAM_MEMBERS, LUNG_SVG_STENCIL, LUNG_SVG_STENCIL_CARDIOMEGALY, LUNG_SVG_STENCIL_NORMAL } from "./data/presets";
import { ActiveSection, Scan, Finding } from "./types";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>("home");
  const [researchTab, setResearchTab] = useState<"intro" | "data" | "arch" | "results" | "limitations">("intro");
  const [scans, setScans] = useState<Scan[]>(PRESET_SCANS);
  const [selectedScanId, setSelectedScanId] = useState<string>("new");
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [stagedFile, setStagedFile] = useState<{ file: File; base64: string } | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const [leftPanelOpen, setLeftPanelOpen] = useState<boolean>(true);
  const [rightPanelOpen, setRightPanelOpen] = useState<boolean>(true);
  const [activeModal, setActiveModal] = useState<"privacy" | "terms" | "hipaa" | "contact" | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "viewer" | "queue">("chat");

  // Image viewer filters & manipulation
  const [zoom, setZoom] = useState<number>(1.0);
  const [contrastSetting, setContrastSetting] = useState<"normal" | "high" | "inverted">("normal");
  const [showCoordinates, setShowCoordinates] = useState<boolean>(true);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  // Chatbot UI state
  const [chatInput, setChatInput] = useState<string>("");
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<Record<string, { role: "user" | "model"; text: string }[]>>({});
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, selectedScanId]);

  const handleSendChatMessage = async (e?: React.FormEvent, presetMessage?: string) => {
    if (e) e.preventDefault();
    const messageToSend = presetMessage || chatInput;
    if (!messageToSend.trim() || isChatLoading) return;

    const currentScanId = selectedScanId;
    const userMsg = { role: "user" as const, text: messageToSend };

    // Update UI locally first
    setChatHistory(prev => ({
      ...prev,
      [currentScanId]: [...(prev[currentScanId] || []), userMsg]
    }));
    if (!presetMessage) setChatInput("");
    setIsChatLoading(true);

    try {
      const currentHistory = chatHistory[currentScanId] || [];
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageToSend,
          history: currentHistory,
          scan: activeScan
        })
      });

      if (!response.ok) {
        throw new Error("Chat request failed.");
      }

      const data = await response.json();
      const assistantMsg = { role: "model" as const, text: data.reply || "No response received." };

      setChatHistory(prev => ({
        ...prev,
        [currentScanId]: [...(prev[currentScanId] || []), assistantMsg]
      }));
    } catch (err: any) {
      console.error(err);
      const errorMsg = { role: "model" as const, text: "Error: Could not connect to clinical assistant. Please check your network connection." };
      setChatHistory(prev => ({
        ...prev,
        [currentScanId]: [...(prev[currentScanId] || []), errorMsg]
      }));
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleClearChatHistory = () => {
    setChatHistory(prev => ({
      ...prev,
      [selectedScanId]: []
    }));
  };

  const handleDeleteScan = (e: React.MouseEvent, scanId: string) => {
    e.stopPropagation();
    setScans(prev => prev.filter(s => s.id !== scanId));
    if (selectedScanId === scanId) {
      setSelectedScanId("new");
    }
    setChatHistory(prev => {
      const updated = { ...prev };
      delete updated[scanId];
      return updated;
    });
  };

  // Form states for manual patient meta ingestion
  const [newPatientName, setNewPatientName] = useState<string>("");
  const [newPatientReport, setNewPatientReport] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selected scan detail
  const activeScan = scans.find(s => s.id === selectedScanId) || scans[0];

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch server status and check API key configuration
  useEffect(() => {
    fetch("https://xynapse-backend-production.up.railway.app/health")
      .then(res => res.json())
      .then(data => {
        setHasApiKey(data.hasApiKey ?? true);
      })
      .catch(error => {
        console.error("Health check failed:", error);
        setHasApiKey(false);
      });
  }, []);

  // When activeScan changes, reset viewer modifiers and default selected finding
  useEffect(() => {
    setZoom(1.0);
    setContrastSetting("normal");
    if (activeScan && activeScan.findings.length > 0) {
      setSelectedFinding(activeScan.findings[0]);
    } else {
      setSelectedFinding(null);
    }
  }, [selectedScanId]);

  // Adjust zoom controls
  const handleZoomIn = () => setZoom(z => Math.min(2.5, z + 0.15));
  const handleZoomOut = () => setZoom(z => Math.max(0.7, z - 0.15));
  const handleResetFilters = () => {
    setZoom(1.0);
    setContrastSetting("normal");
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  // Read file as base64 and stage it for preview — does NOT trigger analysis yet
  const handleFileSelected = (file: File) => {
    setUploadError(null);
    console.log("[Xynapse] handleFileSelected →", { name: file.name, type: file.type, size: file.size });

    // Size check (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      setUploadError("File exceeds 20MB limit. Please upload a compressed PNG or JPG.");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      console.log("[Xynapse] FileReader done — staging file, base64 length:", base64Data.length);
      setStagedFile({ file, base64: base64Data });
    };
    reader.onerror = () => {
      console.error("[Xynapse] FileReader error");
      setUploadError("Error reading the local image file. Please try another one.");
    };
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
      // Reset input so re-selecting the same file fires onChange again
      e.target.value = "";
    }
  };

  // Called when user confirms the upload with the button
  const handleConfirmUpload = () => {
    if (!stagedFile) return;
    const { file, base64 } = stagedFile;
    setStagedFile(null);
    processAnalysisRequest(base64, file, file.name, file.type, file.size, newPatientReport);
  };

  // Send image to Flask /api/predict via FormData and map response into Scan structure
  const processAnalysisRequest = async (
    base64Image: string,
    rawFile: File,
    fileName: string,
    mimeType: string,
    rawSize: number,
    reportText?: string
  ) => {
    setIsAnalyzing(true);
    setUploadError(null);

    const formattedSize = `${(rawSize / (1024 * 1024)).toFixed(1)} MB`;
    const patientLabel = newPatientName.trim() || `Patient #${Math.floor(1000 + Math.random() * 9000)}`;
    console.log("[Xynapse] processAnalysisRequest start →", { fileName, mimeType, formattedSize, patientLabel });

    try {
      // Build multipart/form-data payload for Flask backend
      const formData = new FormData();
      formData.append("image", rawFile);
      if (reportText && reportText.trim()) {
        formData.append("report", reportText.trim());
      }
      console.log("[Xynapse] Sending FormData to /api/predict …");

      const response = await fetch(
        "https://xynapse-backend-production.up.railway.app/api/predict",
        {
          method: "POST",
          body: formData
          // NOTE: Do NOT set Content-Type header — browser sets it automatically with the boundary
        }
      );

      console.log("[Xynapse] /api/predict HTTP status:", response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[Xynapse] /api/predict error body:", errorData);
        throw new Error(errorData.error || `Server returned ${response.status}`);
      }

      const results = await response.json();
      console.log("[Xynapse] /api/predict raw response:", JSON.stringify(results, null, 2));

      // ── Map Flask response fields → Scan object ──────────────────────────────
      // Expected Flask shape: { new_model: { time, result: { probs, detected, predictions } } }
      const modelResult = results?.new_model?.result ?? {};
      console.log("[Xynapse] modelResult extracted:", modelResult);

      const probs: Record<string, number> = modelResult.probs ?? {};
      const detected: string[] = modelResult.detected ?? [];
      const predictions: Record<string, string> = modelResult.predictions ?? {};
      const inferenceTime: number = results?.new_model?.time ?? 0;
      console.log("[Xynapse] Fields → probs:", probs, "| detected:", detected, "| inferenceTime:", inferenceTime);

      // Build findings from detected conditions + their probabilities
      const findings: import("./types").Finding[] = detected.map((condition) => {
        const confidence = probs[condition] ?? 0;
        const predLabel = predictions[condition] ?? "Detected";
        const severityMap: Record<string, "Mild" | "Moderate" | "Severe"> = {
          Pneumonia: "Severe",
          "Pleural Effusion": "Moderate",
          Cardiomegaly: "Moderate",
          Atelectasis: "Mild",
          Edema: "Moderate",
          Consolidation: "Severe",
        };
        return {
          name: condition,
          confidence,
          severity: severityMap[condition] ?? (confidence > 0.75 ? "Severe" : confidence > 0.5 ? "Moderate" : "Mild"),
          description: `${predLabel} — model confidence: ${(confidence * 100).toFixed(1)}%.`,
          location: { x: 20, y: 20, width: 30, height: 30 } // placeholder bbox
        };
      });

      // Build a textual summary from findings
      const summary =
        detected.length > 0
          ? `AI analysis identified ${detected.length} finding(s): ${detected.join(", ")}. Review each finding and correlate with clinical presentation.`
          : "No pathological findings detected. Lung fields, cardiac silhouette, and bony structures appear within normal limits.";

      // Build recommendations
      const recommendations =
        detected.length > 0
          ? [
            `Prioritize review of: ${detected.join(", ")}.`,
            "Correlate findings with patient history and clinical examination.",
            "Consider follow-up imaging if clinically indicated."
          ]
          : ["No urgent therapeutic directives noted. Routine follow-up as clinically appropriate."];

      const newScanRecord: Scan = {
        id: `scan_${Date.now()}`,
        patientName: patientLabel,
        fileName,
        fileSize: formattedSize,
        date: "Just now",
        imageUrl: base64Image, // base64 string for visual rendering in the viewer
        findings,
        summary,
        recommendations,
        metrics: {
          acc: detected.length > 0
            ? `${(Math.max(...Object.values(probs)) * 100).toFixed(1)}%`
            : "Clear",
          lat: `${inferenceTime.toFixed ? inferenceTime.toFixed(0) : inferenceTime}ms`
        },
        isSimulated: false
      };

      console.log("[Xynapse] Built Scan record:", { id: newScanRecord.id, findings: newScanRecord.findings.length, metrics: newScanRecord.metrics, summary: newScanRecord.summary.slice(0, 80) });

      setScans(prev => [newScanRecord, ...prev]);
      setSelectedScanId(newScanRecord.id);

      // Auto-navigation post-upload
      if (isMobile) {
        setMobileTab("viewer");
      } else {
        setRightPanelOpen(true);
      }

      // Reset patient name and report fields
      setNewPatientName("");
      setNewPatientReport("");
    } catch (err: any) {
      console.error("[Xynapse] processAnalysisRequest ERROR:", err?.message ?? err);
      setUploadError(err.message || "Something went wrong during analysis. Verify your network or API endpoint.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Dynamically render diagnostic chest radiography if no custom base64 is uploaded
  const renderLungStencil = (presetType: string) => {
    if (presetType === "pleural_effusion") {
      return <div className="text-secondary/70 h-full w-full" dangerouslySetInnerHTML={{ __html: LUNG_SVG_STENCIL }} />;
    }
    if (presetType === "cardiomegaly") {
      return <div className="text-secondary/70 h-full w-full" dangerouslySetInnerHTML={{ __html: LUNG_SVG_STENCIL_CARDIOMEGALY }} />;
    }
    return <div className="text-secondary/70 h-full w-full" dangerouslySetInnerHTML={{ __html: LUNG_SVG_STENCIL_NORMAL }} />;
  };

  return (
    <div className="bg-surface text-on-surface font-body-main text-body-main min-h-screen relative overflow-x-hidden select-none selection:bg-secondary-container selection:text-on-secondary-container">
      {/* Dynamic Noise Mesh */}
      <div className="noise-overlay" />



      {/* Top Navigation Bar */}
      <nav className="fixed top-0 left-0 w-full h-[64px] z-40 bg-surface/85 backdrop-blur-md border-b border-white/5 font-body-main text-body-main">
        <div className="flex justify-between items-center max-w-[1440px] mx-auto px-4 md:px-8 h-full">
          {/* Logo Brand */}
          <div
            onClick={() => { setActiveSection("home"); setMobileMenuOpen(false); }}
            className="flex items-center gap-0.5 cursor-pointer select-none font-headline-md text-headline-md font-bold text-primary tracking-tight shrink-0"
          >
            <img
              alt="Xynapse Logo"
              className="w-[56px] h-[56px] md:w-[70px] md:h-[70px] object-contain"
              src="/logo.png"
            />
            <span className="tracking-wide text-[20px] md:text-[22px]">Xynapse</span>
          </div>

          {/* Navigation Links — centered (desktop only) */}
          <div className="hidden md:flex gap-6 lg:gap-8 items-center absolute left-1/2 -translate-x-1/2">
            {(["home", "analysis", "team", "about"] as ActiveSection[]).map((section) => {
              const isActive = activeSection === section;
              const label = section === "about" ? "Research" : section;
              return (
                <button
                  key={section}
                  onClick={() => setActiveSection(section)}
                  className={`capitalize relative px-1 py-1.5 font-medium text-[13px] transition-all duration-300 ${isActive
                    ? "text-primary font-bold"
                    : "text-on-surface-variant hover:text-primary opacity-75 hover:opacity-100"
                    }`}
                >
                  {label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-dot"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-[5px] h-[5px] bg-secondary-container rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Trailing Action — desktop CTA + mobile hamburger */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveSection("analysis")}
              className="hidden md:block bg-primary hover:bg-white/90 text-on-primary px-5 py-2 text-[13px] rounded-md font-medium transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Start Analysis &rarr;
            </button>
            {/* Mobile hamburger */}
            <button
              id="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(o => !o)}
              className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-lg border border-white/10 bg-surface-container-low/60 transition-all"
              aria-label="Toggle menu"
            >
              <span className={`block w-5 h-[1.5px] bg-primary rounded-full transition-all duration-300 ${mobileMenuOpen ? "rotate-45 translate-y-[6.5px]" : ""}`} />
              <span className={`block w-5 h-[1.5px] bg-primary rounded-full transition-all duration-300 ${mobileMenuOpen ? "opacity-0" : ""}`} />
              <span className={`block w-5 h-[1.5px] bg-primary rounded-full transition-all duration-300 ${mobileMenuOpen ? "-rotate-45 -translate-y-[6.5px]" : ""}`} />
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="md:hidden absolute top-[64px] left-0 w-full bg-surface/95 backdrop-blur-xl border-b border-white/8 z-50 py-3 px-4 flex flex-col gap-1"
            >
              {(["home", "analysis", "team", "about"] as ActiveSection[]).map((section) => {
                const isActive = activeSection === section;
                const label = section === "about" ? "Research" : section;
                return (
                  <button
                    key={section}
                    onClick={() => { setActiveSection(section); setMobileMenuOpen(false); }}
                    className={`capitalize text-left px-4 py-3 rounded-lg font-medium text-[14px] transition-all duration-200 ${
                      isActive
                        ? "bg-secondary-container/15 text-primary font-bold"
                        : "text-on-surface-variant hover:text-primary hover:bg-surface-container-high"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              <div className="mt-2 pt-2 border-t border-white/6">
                <button
                  onClick={() => { setActiveSection("analysis"); setMobileMenuOpen(false); }}
                  className="w-full bg-primary text-on-primary py-3 rounded-lg font-semibold text-[14px] transition-all"
                >
                  Start Analysis →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main Container */}
      <main className="pt-[76px] md:pt-[96px] min-h-[calc(100vh-64px)] flex flex-col max-w-[1440px] mx-auto px-4 md:px-8 pb-6 md:pb-12">
        <AnimatePresence mode="wait">
          {/* ================= HOME SECTION ================= */}
          {activeSection === "home" && (
            <motion.section
              key="home"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className="flex-1 flex flex-col justify-center py-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center min-h-[500px]">
                {/* Descriptive Copy Block */}
                <div className="flex flex-col gap-5 md:gap-6">
                  <h1 className="font-display-italic text-[44px] sm:text-[64px] lg:text-[84px] leading-[0.95] text-primary tracking-tight">
                    Clarity in the<br />Shadows.
                  </h1>
                  <p className="text-on-surface-variant max-w-[420px] text-[14px] md:text-[15px] leading-[1.7]">
                    Multimodal chest X-ray diagnosis and reporting assistant. Powered by deep learning to detect 5 key thoracic pathologies, minimizing cognitive load for medical professionals.
                  </p>
                  <div className="flex flex-wrap gap-3 md:gap-4 pt-2">
                    <button
                      onClick={() => setActiveSection("analysis")}
                      className="bg-primary text-on-primary px-5 md:px-6 py-2.5 md:py-3 rounded-md font-semibold flex items-center gap-2.5 hover:opacity-95 duration-200 transition-all shadow-lg hover:shadow-cyan-950/20 text-[14px]"
                    >
                      Start Analysis <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setActiveSection("about")}
                      className="bg-transparent text-primary px-5 md:px-6 py-2.5 md:py-3 rounded-md glass-border-hi font-medium hover:bg-surface-bright duration-200 transition-all text-[14px]"
                    >
                      View Research
                    </button>
                  </div>
                </div>

                {/* Chest X-ray Visual Poster */}
                <div className="relative bg-surface rounded-lg glass-border h-[280px] sm:h-[360px] lg:h-[430px] flex items-center justify-center overflow-hidden group shadow-[0_0_80px_20px_rgba(0,0,0,0.4)]">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary-fixed/5 to-transparent pointer-events-none" />



                  <div className="w-[200px] h-[200px] sm:w-[260px] sm:h-[260px] lg:w-[300px] lg:h-[300px] flex items-center justify-center relative">
                    {renderLungStencil("pleural_effusion")}
                  </div>


                </div>
              </div>

              {/* Quick Metrics Strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-0 mt-10 md:mt-16 rounded-lg glass-border overflow-hidden bg-surface-container-lowest/25">
                <div className="flex flex-col gap-1 md:gap-1.5 py-5 md:py-8 px-4 md:px-6 border-r border-b md:border-b-0 border-white/5">
                  <span className="font-label-caps text-label-caps text-on-surface-variant text-[9px] md:text-[10px] tracking-[0.12em] uppercase">Chest X-Rays Analyzed</span>
                  <span className="font-headline-lg text-headline-lg text-primary text-[26px] md:text-[32px] lg:text-[36px] leading-none">100k+</span>
                </div>
                <div className="flex flex-col gap-1 md:gap-1.5 py-5 md:py-8 px-4 md:px-6 border-r border-b md:border-b-0 border-white/5 last:border-r-0 md:last:border-r-0">
                  <span className="font-label-caps text-label-caps text-on-surface-variant text-[9px] md:text-[10px] tracking-[0.12em] uppercase">Model Macro AUC-ROC</span>
                  <span className="font-headline-lg text-headline-lg text-primary text-[26px] md:text-[32px] lg:text-[36px] leading-none">0.973</span>
                </div>
                <div className="flex flex-col gap-1 md:gap-1.5 py-5 md:py-8 px-4 md:px-6 border-r border-white/5">
                  <span className="font-label-caps text-label-caps text-on-surface-variant text-[9px] md:text-[10px] tracking-[0.12em] uppercase">DenseNet Backbone</span>
                  <span className="font-headline-lg text-headline-lg text-primary text-[26px] md:text-[32px] lg:text-[36px] leading-none">121 Layers</span>
                </div>
                <div className="flex flex-col gap-1 md:gap-1.5 py-5 md:py-8 px-4 md:px-6">
                  <span className="font-label-caps text-label-caps text-on-surface-variant text-[9px] md:text-[10px] tracking-[0.12em] uppercase">Target Pathologies</span>
                  <span className="font-headline-lg text-headline-lg text-primary text-[26px] md:text-[32px] lg:text-[36px] leading-none">5 Conditions</span>
                </div>
              </div>
            </motion.section>
          )}

          {/* ================= ANALYSIS SECTION ================= */}
          {activeSection === "analysis" && (
            <motion.section
              key="analysis"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="flex-1 py-4 flex flex-col overflow-hidden"
            >
              {/* Section header */}
              <div className="flex items-center justify-between mb-4 shrink-0">
                <div>
                  <h2 className="text-primary font-bold text-[18px] md:text-[22px] tracking-tight leading-none">Chest X-Ray Workspace</h2>
                  <p className="text-on-surface-variant text-[11px] md:text-[12px] mt-1">AI-powered chest pathology analysis{selectedScanId !== "new" ? ` · ${activeScan.patientName}` : " · Upload a chest X-ray to begin"}</p>
                </div>
                {!hasApiKey && (
                  <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-surface-container-high border border-outline-variant/30 rounded-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                    <span className="text-[10px] font-mono text-on-surface-variant">Sandbox Mode — No API Key</span>
                  </div>
                )}
              </div>

              {/* Mobile tab bar */}
              {isMobile && (
                <div className="flex mb-3 rounded-lg bg-surface-container-lowest/80 border border-white/5 p-1.5 gap-1.5 shrink-0 shadow-md">
                  {(["queue", "chat", "viewer"] as const).map(tab => {
                    const isActive = mobileTab === tab;
                    const Icon = tab === "queue" ? Activity : tab === "chat" ? Sparkles : ImageIcon;
                    const label = tab === "queue" ? "Queue" : tab === "chat" ? "Assistant" : "Viewer";
                    return (
                      <button
                        key={tab}
                        onClick={() => setMobileTab(tab)}
                        className={`flex-1 py-2 px-3 rounded-md flex items-center justify-center gap-1.5 text-[12px] font-semibold transition-all duration-300 border ${
                          isActive
                            ? "bg-secondary-container/15 text-secondary-container border-secondary-container/25 shadow-[0_0_12px_rgba(0,227,253,0.06)]"
                            : "text-on-surface-variant hover:text-primary border-transparent"
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${isActive ? "text-secondary-container" : "text-on-surface-variant/70"}`} />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 3-column flex layout — left and right panels are collapsible (desktop) / tabbed (mobile) */}
              <div 
                className={isMobile ? "flex flex-col flex-1 overflow-hidden gap-3" : "flex gap-3"} 
                style={isMobile ? { height: "calc(100vh - 180px)", minHeight: "480px" } : { height: "calc(100vh - 220px)", minHeight: "640px", overflow: "hidden" }}
              >

                {/* ── COL 1: Radiograph Queue (collapsible) ── */}
                <motion.div
                  animate={isMobile ? {} : { width: leftPanelOpen ? 280 : 44 }}
                  transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                  className={`${
                    isMobile
                      ? mobileTab === "queue" ? "flex flex-col flex-1 overflow-hidden rounded-xl border border-white/5 bg-surface-container-lowest/70" : "hidden"
                      : `flex flex-col h-full overflow-hidden shrink-0 relative ${leftPanelOpen ? "bg-surface-container-lowest/70 rounded-xl border border-white/5" : "bg-transparent border-transparent"}`
                  }`}
                  style={isMobile ? {} : { minWidth: 44 }}
                >

                  {/* Collapsed icon rail — mirrors right panel exactly */}
                  {!isMobile && !leftPanelOpen && (
                    <div className="flex flex-col items-center gap-3 py-3 h-full">
                      <button
                        onClick={() => setLeftPanelOpen(true)}
                        title="Expand queue"
                        className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-container-lowest/70 border border-white/5 text-on-surface-variant/50 hover:text-primary hover:border-secondary-container/40 transition-all duration-200"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ display: "block" }}>
                          <path d="M3 2.5L6 5L3 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <div className="w-px flex-1 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />
                      <button
                        onClick={() => setLeftPanelOpen(true)}
                        title="Chest X-Ray Queue"
                        className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-container-lowest/70 border border-white/5 text-on-surface-variant/40 hover:text-secondary-container hover:border-secondary-container/30 transition-all duration-200"
                      >
                        <Activity className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setLeftPanelOpen(true)}
                        title="Patient Scans"
                        className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-container-lowest/70 border border-white/5 text-on-surface-variant/40 hover:text-secondary-container hover:border-secondary-container/30 transition-all duration-200"
                      >
                        <Users className="w-3.5 h-3.5" />
                      </button>
                      <div className="w-px h-4 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />
                    </div>
                  )}

                  {/* Expanded panel */}
                  {(isMobile || leftPanelOpen) && (
                    <div className="flex flex-col gap-4 p-4 h-full overflow-hidden">
                      {/* Collapse toggle — mirrors right panel's absolute button position */}
                      {!isMobile && (
                        <button
                          onClick={() => setLeftPanelOpen(false)}
                          title="Collapse queue"
                          className="absolute top-3 right-3 z-20 w-6 h-6 rounded-md flex items-center justify-center bg-surface-container border border-white/8 text-on-surface-variant/50 hover:text-primary hover:border-secondary-container/40 hover:bg-surface-container-high transition-all duration-200"
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ display: "block" }}>
                            <path d="M7 2.5L4 5L7 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                      <div className="flex flex-col gap-2 flex-1 min-h-0">
                        <div className="flex items-center gap-2 pr-2 border-b border-white/5 pb-3 mb-1">
                          <span className="text-[9px] font-bold text-on-surface-variant tracking-[0.14em] uppercase">Chest X-Ray Queue</span>
                          <span className="text-[9px] font-mono text-on-surface-variant/60 bg-surface-container px-1.5 py-0.5 rounded">{scans.length}</span>
                        </div>
                        <div className="flex flex-col gap-1.5 overflow-y-auto pr-0.5 flex-1 min-h-0">
                          {scans.map((scan) => {
                            const isSelected = scan.id === selectedScanId;
                            const hasFindings = scan.findings.length > 0;
                            return (
                              <div
                                key={scan.id}
                                onClick={() => setSelectedScanId(scan.id)}
                                className={`p-2.5 rounded-lg border transition-all duration-200 cursor-pointer ${isSelected ? "bg-surface-container-high border-secondary-container/35 shadow-[0_0_12px_rgba(0,227,253,0.06)]" : "bg-surface-container-low/40 border-white/4 hover:bg-surface-container hover:border-white/10"}`}
                              >
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-primary text-[12px] font-semibold truncate max-w-[120px]">{scan.patientName}</span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className={`w-1.5 h-1.5 rounded-full ${hasFindings ? "bg-secondary-container animate-pulse" : "bg-emerald-400"}`} />
                                    <span className={`font-data-mono text-[9px] uppercase font-bold ${hasFindings ? "text-secondary-container" : "text-emerald-400"}`}>
                                      {hasFindings ? scan.findings[0].name.split(" ")[0] : "Clear"}
                                    </span>
                                    <button
                                      onClick={(e) => handleDeleteScan(e, scan.id)}
                                      title="Remove scan"
                                      className="w-4 h-4 rounded flex items-center justify-center text-on-surface-variant/30 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 ml-0.5"
                                    >
                                      <Trash2 className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex justify-between text-[9px] text-on-surface-variant/55 font-mono">
                                  <span className="truncate max-w-[130px]">{scan.fileName}</span>
                                  <span>{scan.date}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* ── COL 2: HERO — AI Chatbot ── */}
                <div className={`relative rounded-xl overflow-hidden flex flex-col border border-white/5 shadow-[0_0_60px_rgba(0,227,253,0.04)] min-w-0 ${
                  isMobile
                    ? mobileTab === "chat" ? "flex-1 overflow-hidden" : "hidden"
                    : "h-full flex-1"
                }`} style={{ background: "linear-gradient(160deg, #0d0d16 0%, #13131b 60%, #0d1018 100%)" }}>

                  {/* Ambient glow top-center */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[340px] h-[1px] bg-gradient-to-r from-transparent via-secondary-container/40 to-transparent" />
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[60px] bg-secondary-container/5 blur-3xl rounded-full pointer-events-none" />

                  {/* Chat hero header */}
                  <div className="relative shrink-0 px-4 md:px-5 py-3.5 md:py-4 border-b border-white/5 flex items-center justify-between" style={{ background: "rgba(13,13,22,0.8)" }}>
                    <div className="flex items-center gap-2 md:gap-3">
                      {/* AI avatar */}
                      <div className="relative w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, rgba(0,227,253,0.15), rgba(0,227,253,0.04))", border: "1px solid rgba(0,227,253,0.25)" }}>
                        <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 text-secondary-container" />
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-surface-container-lowest" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 md:gap-2">
                          <span className="text-primary font-bold text-[13px] md:text-[14px] tracking-tight">Xynapse Assistant</span>
                        </div>
                        <p className="text-[9px] md:text-[10px] text-on-surface-variant/70 mt-0.5">
                          Context: <span className="text-secondary-container/90">{selectedScanId === "new" ? "New Upload" : activeScan.patientName}</span> {selectedScanId !== "new" && `· ${activeScan.findings.length > 0 ? `${activeScan.findings.length} finding${activeScan.findings.length > 1 ? "s" : ""}` : "No anomalies"}`}
                        </p>
                      </div>
                    </div>
 
                    <div className="flex items-center gap-2 md:gap-3">
                      <button
                        onClick={() => setSelectedScanId("new")}
                        className={`flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg text-[11px] md:text-[12px] font-semibold transition-all duration-200 ${selectedScanId === "new"
                          ? "bg-[#0b2b5c] text-white border border-[#1a3d7c]"
                          : "bg-[#0b2b5c]/40 text-white/80 border border-[#0b2b5c]/30 hover:bg-[#0b2b5c]/70 hover:text-white"
                          }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Start New Diagnosis</span>
                        <span className="inline sm:hidden">New</span>
                      </button>
                      {(chatHistory[selectedScanId] || []).length > 0 && (
                        <button
                          onClick={handleClearChatHistory}
                          className="flex items-center gap-1 text-[9px] md:text-[10px] font-mono text-on-surface-variant/50 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
 
                  {/* Messages area */}
                  <div ref={chatMessagesRef} className={`flex-1 overflow-y-auto px-4 md:px-5 py-4 space-y-4 scrollbar-thin select-text min-w-0 ${selectedScanId === "new" ? "flex flex-col justify-start items-center" : "flex flex-col"}`}>
                    {selectedScanId === "new" ? (
                      <div style={{ width: "100%", maxWidth: "420px" }} className="flex flex-col gap-4 md:gap-6 py-2 w-full">
                        <div className="text-center mb-1 md:mb-2">
                          <h3 className="text-primary font-bold text-[18px] md:text-[20px] tracking-tight mb-1 md:mb-2">Initialize Analysis</h3>
                          <p className="text-on-surface-variant/70 text-[12px] md:text-[13px] leading-relaxed">
                            Provide the patient's chest X-ray and optional clinical notes to generate a comprehensive AI-driven chest pathology report.
                          </p>
                        </div>
 
                        {/* Patient input */}
                        <div className="flex flex-col gap-1.5 md:gap-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-on-surface-variant tracking-[0.14em] uppercase text-left">Patient Demographics</label>
                            <span className="text-[9px] font-mono text-on-surface-variant/40 uppercase tracking-wider">Optional</span>
                          </div>
                          <input
                            type="text"
                            value={newPatientName}
                            onChange={(e) => setNewPatientName(e.target.value)}
                            placeholder="Full Name or Patient ID"
                            className="w-full bg-surface-container px-4 py-2.5 md:py-3 text-[13px] border border-white/5 rounded-xl text-primary focus:outline-none focus:border-secondary-container/50 placeholder:text-on-surface-variant/35 transition-colors"
                          />
                        </div>
 
                        {/* Clinical report / notes input (optional) */}
                        <div className="flex flex-col gap-1.5 md:gap-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-on-surface-variant tracking-[0.14em] uppercase text-left">Clinical Notes</label>
                            <span className="text-[9px] font-mono text-on-surface-variant/40 uppercase tracking-wider">Optional</span>
                          </div>
                          <textarea
                            value={newPatientReport}
                            onChange={(e) => setNewPatientReport(e.target.value)}
                            placeholder="Optional: paste a radiology report in plain text, symptoms, or relevant clinical context…"
                            rows={isMobile ? 2 : 3}
                            className="w-full bg-surface-container px-4 py-2.5 md:py-3 text-[13px] border border-white/5 rounded-xl text-primary focus:outline-none focus:border-secondary-container/50 placeholder:text-on-surface-variant/35 transition-colors resize-none leading-relaxed"
                          />
                        </div>
 
                        {/* Drop zone / staged preview */}
                        <input type="file" ref={fileInputRef} onChange={handleFileInputChange} className="hidden" accept="image/*" />

                        {stagedFile ? (
                          /* ── Staged preview: show thumbnail + confirm button ── */
                          <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-secondary-container/50 bg-secondary-container/5 p-5 md:p-6 transition-all duration-300">
                            {/* Thumbnail */}
                            <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-lg" style={{ width: "100%", maxHeight: "180px", background: "#000" }}>
                              <img
                                src={stagedFile.base64}
                                alt="Staged chest X-ray preview"
                                style={{ width: "100%", maxHeight: "180px", objectFit: "contain", display: "block" }}
                              />
                            </div>
                            {/* File info */}
                            <div className="text-center">
                              <p className="text-primary font-semibold text-[13px] truncate max-w-[260px]">{stagedFile.file.name}</p>
                              <p className="text-on-surface-variant/55 font-mono text-[10px] mt-0.5">{(stagedFile.file.size / (1024 * 1024)).toFixed(2)} MB · Ready to analyze</p>
                            </div>
                            {/* Action row */}
                            <div className="flex gap-2.5 w-full">
                              <button
                                onClick={() => { setStagedFile(null); setUploadError(null); }}
                                className="flex-1 py-2.5 rounded-xl border border-white/10 text-on-surface-variant hover:text-red-400 hover:border-red-500/30 text-[12px] font-semibold transition-all duration-200"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleConfirmUpload}
                                className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-[12px] font-bold transition-all duration-200 shadow-md hover:shadow-secondary-container/20"
                                style={{ background: "linear-gradient(135deg, #00c8e0, #00e3fd)", color: "#001f24" }}
                              >
                                <Upload className="w-3.5 h-3.5" />
                                Run Analysis
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* ── Default drop zone ── */
                          <div
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                            onClick={triggerFileInput}
                            className={`border-2 border-dashed rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${dragActive
                              ? "border-secondary-container bg-secondary-container/10 scale-[0.98]"
                              : "border-outline-variant/40 hover:border-secondary-container/50 hover:bg-surface-container-low/80"
                            }`}
                          >
                            {isAnalyzing ? (
                              <div className="flex flex-col items-center py-2 md:py-4">
                                <RefreshCw className="w-6 h-6 md:w-8 md:h-8 text-secondary-container animate-spin mb-3 md:mb-4" />
                                <span className="font-medium text-primary text-[13px] md:text-[14px]">Consulting Xynapse...</span>
                                <span className="font-data-mono text-[9px] md:text-[10px] text-on-surface-variant/50 mt-1.5">Processing multi-modal inputs</span>
                              </div>
                            ) : (
                              <>
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-secondary-container/10 border border-secondary-container/20 flex items-center justify-center mb-3 md:mb-4">
                                  <Upload className="w-5 h-5 md:w-6 md:h-6 text-secondary-container" />
                                </div>
                                <span className="font-bold text-primary text-[13px] md:text-[14px] mb-1">{isMobile ? "Tap to upload chest X-ray" : "Drag chest X-ray here or browse"}</span>
                                <span className="font-data-mono text-[9px] md:text-[10px] text-on-surface-variant/50">PNG, JPG, DCM up to 20MB</span>
                              </>
                            )}
                          </div>
                        )}

                        {uploadError && (
                          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-[12px] flex items-start gap-2 text-left">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{uploadError}</span>
                          </div>
                        )}
                      </div>
                    ) : (chatHistory[selectedScanId] || []).length === 0 ? (
                      /* Empty state — hero welcome */
                      <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10">
                        {/* Glowing orb icon */}
                        <div className="relative mb-6">
                          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(0,227,253,0.18), rgba(0,227,253,0.05))", border: "1px solid rgba(0,227,253,0.3)", boxShadow: "0 0 40px rgba(0,227,253,0.12)" }}>
                            <Sparkles className="w-7 h-7 text-secondary-container" />
                          </div>
                          <div className="absolute inset-0 rounded-full blur-xl bg-secondary-container/10 pointer-events-none" />
                        </div>

                        <h3 className="text-primary font-bold text-[18px] tracking-tight mb-2">AI Clinical Assistant</h3>
                        <p className="text-on-surface-variant/70 text-[13px] leading-relaxed max-w-[360px] mb-8">
                          Ask anything about <span className="text-primary font-medium">{activeScan.patientName}</span>'s chest X-ray. I'll explain findings, severity, and clinical guidance in plain language.
                        </p>

                        {/* Suggested prompt grid */}
                        <div className="w-full max-w-[480px]">
                          <span className="text-[9px] font-mono text-on-surface-variant/40 uppercase tracking-[0.16em] mb-3 block">Suggested prompts</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[
                              { icon: "🔍", text: "Explain findings in plain terms" },
                              { icon: "📋", text: "What are the next clinical steps?" },
                              { icon: "⚠️", text: activeScan.findings.length > 0 ? "How severe are these findings?" : "Confirm lungs are normal" },
                              { icon: "💊", text: "Suggest treatment considerations" },
                            ].map((item, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSendChatMessage(undefined, item.text)}
                                className="text-left px-3.5 py-3 rounded-lg border border-white/6 hover:border-secondary-container/30 text-on-surface-variant hover:text-primary text-[12px] transition-all duration-200 cursor-pointer group"
                                style={{ background: "rgba(255,255,255,0.02)" }}
                              >
                                <span className="mr-2">{item.icon}</span>
                                <span className="group-hover:underline decoration-secondary-container/40 underline-offset-2">{item.text}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {(chatHistory[selectedScanId] || []).map((msg, index) => {
                          const isUser = msg.role === "user";
                          return (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.25 }}
                              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                            >
                              {!isUser && (
                                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2.5 mt-0.5" style={{ background: "linear-gradient(135deg, rgba(0,227,253,0.15), rgba(0,227,253,0.04))", border: "1px solid rgba(0,227,253,0.2)" }}>
                                  <Sparkles className="w-3 h-3 text-secondary-container" />
                                </div>
                              )}
                              <div className={`max-w-[88%] md:max-w-[78%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                                <div className={`px-4 py-3 rounded-2xl text-[13px] leading-relaxed ${isUser
                                  ? "rounded-tr-sm text-on-secondary-container font-medium"
                                  : "rounded-tl-sm border border-white/5 text-on-surface"
                                  }`}
                                  style={isUser
                                    ? { background: "linear-gradient(135deg, #00c8e0, #00e3fd)", color: "#001f24" }
                                    : { background: "rgba(255,255,255,0.04)" }
                                  }
                                >
                                  {msg.text.split("\n").map((line, lIdx) => (
                                    <p key={lIdx} className={lIdx > 0 ? "mt-1.5" : ""}>{line}</p>
                                  ))}
                                </div>
                                <span className="text-[9px] font-mono text-on-surface-variant/35 mt-1.5 uppercase tracking-wider px-1">
                                  {isUser ? "You" : "Assistant"}
                                </span>
                              </div>
                              {isUser && (
                                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 ml-2.5 mt-0.5 bg-surface-container-high border border-white/8">
                                  <User className="w-3 h-3 text-on-surface-variant" />
                                </div>
                              )}
                            </motion.div>
                          );
                        })}

                        {isChatLoading && (
                          <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex justify-start"
                          >
                            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2.5 mt-0.5" style={{ background: "linear-gradient(135deg, rgba(0,227,253,0.15), rgba(0,227,253,0.04))", border: "1px solid rgba(0,227,253,0.2)" }}>
                              <Sparkles className="w-3 h-3 text-secondary-container" />
                            </div>
                            <div className="px-4 py-3 rounded-2xl rounded-tl-sm border border-white/5 flex items-center gap-1.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                              <span className="w-1.5 h-1.5 rounded-full bg-secondary-container animate-bounce" style={{ animationDelay: "0ms" }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-secondary-container animate-bounce" style={{ animationDelay: "160ms" }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-secondary-container animate-bounce" style={{ animationDelay: "320ms" }} />
                            </div>
                          </motion.div>
                        )}

                      </>
                    )}
                  </div>

                  {/* Quick-reply chips (when messages exist) */}
                  {(chatHistory[selectedScanId] || []).length > 0 && (
                    <div className="px-5 pb-2 flex gap-2 overflow-x-auto scrollbar-none shrink-0">
                      {["Explain findings", "Next steps", "Severity level", "Treatment options"].map((chip, idx) => (
                        <button
                          key={idx}
                          disabled={isChatLoading}
                          onClick={() => handleSendChatMessage(undefined, chip)}
                          className="shrink-0 px-3 py-1.5 rounded-full text-[10px] font-mono border border-white/8 text-on-surface-variant hover:text-primary hover:border-secondary-container/30 transition-all duration-200 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                          style={{ background: "rgba(255,255,255,0.03)" }}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Input bar */}
                  {selectedScanId !== "new" && (
                    <div className="px-4 pb-4 pt-2 shrink-0 border-t border-white/5">
                      <form onSubmit={handleSendChatMessage} className="relative flex items-center">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          disabled={isChatLoading}
                          placeholder={`Ask about ${activeScan.patientName.split(" ")[0]}'s chest X-ray...`}
                          className="w-full py-3 pl-4 pr-12 text-[13px] rounded-xl border border-white/8 focus:border-secondary-container/50 focus:outline-none text-primary placeholder:text-on-surface-variant/35 transition-all disabled:opacity-50"
                          style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(8px)" }}
                        />
                        <button
                          type="submit"
                          disabled={isChatLoading || !chatInput.trim()}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 disabled:opacity-30 cursor-pointer"
                          style={{ background: chatInput.trim() ? "linear-gradient(135deg, #00c8e0, #00e3fd)" : "rgba(255,255,255,0.06)" }}
                        >
                          <Send className={`w-3.5 h-3.5 ${chatInput.trim() ? "text-[#001f24]" : "text-on-surface-variant"}`} />
                        </button>
                      </form>
                      <p className="text-center text-[9px] font-mono text-on-surface-variant/25 mt-2">
                        AI-generated clinical guidance · Not a substitute for professional diagnosis
                      </p>
                    </div>
                  )}
                </div>

                {/* ── COL 3: Image Viewer + Findings (collapsible) ── */}
                <motion.div
                  animate={isMobile ? {} : { width: rightPanelOpen ? 340 : 44 }}
                  transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                  className={`${
                    isMobile
                      ? mobileTab === "viewer" ? "flex flex-col flex-1 overflow-hidden gap-3" : "hidden"
                      : "flex flex-col h-full overflow-hidden shrink-0 relative gap-3"
                  }`}
                  style={isMobile ? {} : { minWidth: 44 }}
                >
                  {/* Collapsed icon rail */}
                  {!isMobile && !rightPanelOpen && (
                    <div className="flex flex-col items-center gap-3 py-3 h-full">
                      <button
                        onClick={() => setRightPanelOpen(true)}
                        title="Expand findings"
                        className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-container-lowest/70 border border-white/5 text-on-surface-variant/50 hover:text-primary hover:border-secondary-container/40 transition-all duration-200"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ display: "block" }}>
                          <path d="M7 2.5L4 5L7 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <div className="w-px flex-1 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />
                      <button
                        onClick={() => setRightPanelOpen(true)}
                        title="Image Viewer"
                        className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-container-lowest/70 border border-white/5 text-on-surface-variant/40 hover:text-secondary-container hover:border-secondary-container/30 transition-all duration-200"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setRightPanelOpen(true)}
                        title="Clinical Findings"
                        className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-container-lowest/70 border border-white/5 text-on-surface-variant/40 hover:text-secondary-container hover:border-secondary-container/30 transition-all duration-200"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <div className="w-px h-4 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />
                    </div>
                  )}
 
                  {/* Expanded state */}
                  {(isMobile || rightPanelOpen) && (
                    <>
                      {selectedScanId === "new" ? (
                        <div className="relative h-full border border-dashed border-white/10 rounded-xl bg-surface-container-lowest/30 flex flex-col items-center justify-center text-center p-6 text-on-surface-variant/40">
                          {!isMobile && (
                            <button
                              onClick={() => setRightPanelOpen(false)}
                              title="Collapse findings panel"
                              className="absolute top-3 left-3 w-6 h-6 rounded-md flex items-center justify-center shrink-0 border border-white/8 text-on-surface-variant/50 hover:text-primary hover:border-secondary-container/40 hover:bg-surface-container-high transition-all duration-200"
                              style={{ background: "rgba(255,255,255,0.03)" }}
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ display: "block" }}>
                                <path d="M4 2.5L7 5L4 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          )}
                          <ImageIcon className="w-10 h-10 mb-4 opacity-20" />
                          <span className="text-[13px] font-medium text-on-surface-variant/60">Awaiting Chest X-Ray</span>
                          <p className="text-[10px] mt-2 max-w-[200px] leading-relaxed">
                            Upload a chest X-ray in the central panel to generate clinical findings.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
                          {/* Image viewer card */}
                          <div className="bg-surface-container-lowest/70 rounded-xl border border-white/5 flex flex-col overflow-hidden shrink-0" style={{ height: isMobile ? "220px" : "300px" }}>
                            {/* Toolbar */}
                            <div className="h-[38px] border-b border-white/5 flex items-center px-2 gap-1 bg-surface-container-lowest/80 shrink-0">
                              {/* Collapse button — lives in the toolbar so it never overlaps other buttons */}
                              {!isMobile && (
                                <>
                                  <button
                                    onClick={() => setRightPanelOpen(false)}
                                    title="Collapse findings panel"
                                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border border-white/8 text-on-surface-variant/50 hover:text-primary hover:border-secondary-container/40 hover:bg-surface-container-high transition-all duration-200"
                                    style={{ background: "rgba(255,255,255,0.03)" }}
                                  >
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ display: "block" }}>
                                      <path d="M4 2.5L7 5L4 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </button>
                                  <div className="w-[1px] h-3 bg-white/8 mx-1 shrink-0" />
                                </>
                              )}
                              <button onClick={handleZoomIn} title="Zoom In" className="p-1.5 rounded-md text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all">
                                <ZoomIn className="w-3 h-3" />
                              </button>
                              <button onClick={handleZoomOut} title="Zoom Out" className="p-1.5 rounded-md text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all">
                                <ZoomOut className="w-3 h-3" />
                              </button>
                              <div className="w-[1px] h-3 bg-white/8 mx-0.5 md:mx-1" />
                              <button
                                onClick={() => setContrastSetting(c => c === "normal" ? "high" : c === "high" ? "inverted" : "normal")}
                                className={`p-1.5 rounded-md flex items-center gap-1 text-[10px] font-mono transition-all ${contrastSetting !== "normal" ? "text-secondary-container bg-secondary-container/10" : "text-on-surface-variant hover:text-primary"}`}
                              >
                                <Contrast className="w-3 h-3" />
                                <span className={`capitalize ${isMobile ? "hidden" : ""}`}>{contrastSetting}</span>
                                {isMobile && contrastSetting !== "normal" && (
                                  <span className="text-[8px] font-bold uppercase text-secondary-container px-0.5">
                                    {contrastSetting === "high" ? "H" : "I"}
                                  </span>
                                )}
                              </button>
                              <div className="w-[1px] h-3 bg-white/8 mx-0.5 md:mx-1" />
                              <button
                                onClick={() => setShowCoordinates(!showCoordinates)}
                                className={`p-1 px-1.5 text-[9px] font-mono rounded border transition-all ${
                                  showCoordinates 
                                    ? "text-secondary-container bg-secondary-container/10 border-secondary-container/20" 
                                    : "text-on-surface-variant/50 border-transparent"
                                }`}
                              >
                                OVL
                              </button>
                              <button onClick={handleResetFilters} className="ml-auto text-[9px] font-mono text-on-surface-variant/40 hover:text-primary transition-all p-1">
                                Reset
                              </button>
                            </div>

                            {/* Viewer area */}
                            <div className="relative flex items-center justify-center flex-1 bg-surface-container-lowest/30" style={{ minHeight: 0 }}>
                              <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
                                <div
                                  className="w-full h-full flex items-center justify-center p-4 transition-transform duration-200"
                                  style={{
                                    transform: `scale(${zoom})`,
                                    filter: contrastSetting === "high"
                                      ? "contrast(1.45) brightness(0.9)"
                                      : contrastSetting === "inverted"
                                        ? "invert(1) contrast(1.15) brightness(0.95)"
                                        : "none"
                                  }}
                                >
                                  {activeScan.imageUrl.startsWith("data:") ? (
                                    <img src={activeScan.imageUrl} alt="Chest Radiography" className="max-h-full max-w-full object-contain pointer-events-none select-none rounded" referrerPolicy="no-referrer" />
                                  ) : (
                                    renderLungStencil(activeScan.imageUrl)
                                  )}
                                </div>

                                {showCoordinates && activeScan.findings.map((f, index) => {
                                  const isSel = selectedFinding?.name === f.name;
                                  return (
                                    <div
                                      key={index}
                                      onClick={() => setSelectedFinding(f)}
                                      className={`absolute border cursor-pointer transition-all duration-300 ${isSel ? "border-secondary-container bg-secondary-container/10 ring-1 ring-secondary-container/20" : "border-secondary-container/40 bg-secondary-container/4 hover:border-secondary-container"}`}
                                      style={{ top: `${f.location.y}%`, left: `${f.location.x}%`, width: `${f.location.width}%`, height: `${f.location.height}%` }}
                                    >
                                      <div className="absolute -top-5 left-0 bg-secondary-container text-on-secondary-container font-data-mono text-[8px] px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wide">
                                        {f.name.split(" ")[0]} {(f.confidence * 100).toFixed(0)}%
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {activeScan.isSimulated && (
                                <div className="absolute top-3 left-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[9px] font-mono px-2 py-1 rounded flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  Demo
                                </div>
                              )}

                              {/* Metrics row — show top confidence only when findings exist */}
                              {activeScan.findings.length > 0 && (
                                <div className="absolute bottom-3 left-3">
                                  <span className="text-[9px] font-mono px-2 py-1 rounded bg-surface-container/80 border border-white/5 text-secondary-container">
                                    {(Math.max(...activeScan.findings.map(f => f.confidence)) * 100).toFixed(1)}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Findings + Report card */}
                          <div className="bg-surface-container-lowest/70 rounded-xl border border-white/5 flex flex-col flex-1 overflow-hidden">
                            {/* Findings Header */}
                            <div className="flex border-b border-white/5 shrink-0 bg-surface-container-lowest/80 p-3 items-center justify-between">
                              <div className="flex items-center gap-2 text-primary font-bold text-[11px] tracking-[0.1em] uppercase">
                                <FileText className="w-3.5 h-3.5" />
                                Clinical Findings
                              </div>
                              <span className="text-[9px] font-mono text-secondary-container bg-secondary-container/10 px-1.5 py-0.5 rounded border border-secondary-container/20">AI Generated</span>
                            </div>

                            {/* Report Content */}
                            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                              <>
                                {activeScan.findings.length === 0 ? (
                                  <div className="flex flex-col items-center justify-center text-center p-4 rounded-lg border border-white/5 bg-emerald-500/5 flex-1">
                                    <CheckCircle2 className="w-7 h-7 text-emerald-400 mb-2" />
                                    <span className="text-emerald-400 font-bold text-[13px]">No Target Pathologies Detected</span>
                                    <p className="text-[10px] text-on-surface-variant/60 mt-1 leading-relaxed">None of the 5 target conditions (Cardiomegaly, Pleural Effusion, Pneumonia, Pneumothorax, and Consolidation) were detected.</p>
                                  </div>
                                ) : (
                                  [...activeScan.findings].sort((a, b) => b.confidence - a.confidence).map((f, i) => {
                                    const isSel = selectedFinding?.name === f.name;
                                    return (
                                      <div
                                        key={i}
                                        onClick={() => setSelectedFinding(f)}
                                        className={`p-2.5 rounded-lg border cursor-pointer transition-all ${isSel ? "border-secondary-container/40 bg-surface-container-high" : "border-white/5 bg-surface-container-low/30 hover:border-white/12"}`}
                                      >
                                        <div className="flex justify-between items-start mb-1">
                                          <span className="font-bold text-primary text-[12px]">{f.name}</span>
                                          <span className="font-data-mono text-[10px] text-secondary-container font-bold">{(f.confidence * 100).toFixed(1)}%</span>
                                        </div>
                                        <p className="text-[10px] text-on-surface-variant leading-relaxed mb-2">{f.description}</p>
                                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${f.severity === "Severe" ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                          : f.severity === "Moderate" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                            : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                          }`}>{f.severity}</span>
                                      </div>
                                    );
                                  })
                                )}

                                {/* Summary */}
                                <div className="flex flex-col gap-1.5">
                                  <label className="text-[9px] text-on-surface-variant/60 font-bold tracking-[0.12em] uppercase">Summary</label>
                                  <div className="text-[10px] text-on-surface-variant leading-relaxed p-2.5 rounded-lg bg-surface-container/30 border border-white/5">
                                    {activeScan.summary}
                                  </div>
                                </div>

                                {/* Recommendations */}
                                <div className="flex flex-col gap-1.5">
                                  <label className="text-[9px] text-on-surface-variant/60 font-bold tracking-[0.12em] uppercase flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-secondary-container" />
                                    Clinical Directives
                                  </label>
                                  <ul className="flex flex-col gap-1.5">
                                    {activeScan.recommendations.map((rec, i) => (
                                      <li key={i} className="flex items-start gap-1.5 text-[10px] text-on-surface-variant leading-relaxed">
                                        <span className="text-secondary-container font-bold shrink-0 mt-0.5">›</span>
                                        {rec}
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                <div className="flex justify-between text-[9px] font-mono text-on-surface-variant/30 pt-1 border-t border-white/5 mt-1">
                                  <span>{activeScan.metrics.lat}</span>
                                  <span>{activeScan.metrics.acc}</span>
                                </div>
                              </>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>

              </div>
            </motion.section>
          )}

          {/* ================= ABOUT SECTION ================= */}
          {activeSection === "about" && (
            <motion.section
              key="about"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 py-10 max-w-5xl mx-auto flex flex-col gap-6 w-full"
            >
              <div>
                <h2 className="font-display-italic text-[44px] md:text-[54px] text-primary leading-none tracking-tight">The Research.</h2>
                <h3 className="text-[18px] md:text-[22px] font-semibold text-secondary-container mt-2">Xynapse: A Multimodal Diagnosis and Reporting Assistant for Chest Radiography</h3>
                <p className="text-[11px] font-mono text-on-surface-variant/50 uppercase tracking-wider mt-1">
                  Undergraduate Final Year Project · M. Talha Khan, Muneeb Khan, M. Ehsaan Bawany
                </p>
              </div>

              {/* Research Tabs */}
              <div className="flex border-b border-white/5 pb-2 overflow-x-auto gap-2 scrollbar-none shrink-0 mb-2">
                {[
                  { id: "intro", label: "Abstract & Intro" },
                  { id: "data", label: "Datasets & Sampling" },
                  { id: "arch", label: "Model Architecture" },
                  { id: "results", label: "Experimental Results" },
                  { id: "limitations", label: "Limitations & Future" }
                ].map((tab) => {
                  const isActive = researchTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setResearchTab(tab.id as any)}
                      className={`px-4 py-2.5 rounded-lg text-xs font-bold font-mono tracking-wider uppercase border transition-all duration-200 cursor-pointer whitespace-nowrap ${
                        isActive
                          ? "bg-secondary-container/10 border-secondary-container/30 text-secondary-container shadow-[0_0_12px_rgba(0,227,253,0.05)]"
                          : "border-transparent text-on-surface-variant hover:text-primary hover:bg-white/4"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="bg-surface-container-lowest border border-white/5 rounded-2xl p-6 md:p-8 flex flex-col gap-6 text-[14px] leading-relaxed text-on-surface-variant min-h-[450px]">
                <AnimatePresence mode="wait">
                  {researchTab === "intro" && (
                    <motion.div
                      key="intro"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col gap-5"
                    >
                      <h4 className="text-[16px] font-bold text-primary flex items-center gap-2">
                        <span className="text-secondary-container font-mono">1.</span> Introduction & Clinical Motivation
                      </h4>
                      <p>
                        Radiology departments worldwide face mounting pressure from increasing patient volumes and a persistent shortage of expert radiologists. Chest X-ray interpretation, one of the most frequently performed diagnostic procedures, demands significant time, expertise, and the ability to reason simultaneously over visual findings and accompanying clinical context.
                      </p>
                      <div className="p-4 bg-surface-container-low/40 border border-white/5 rounded-xl text-primary/90 font-medium">
                        "The gap between automated and human diagnostic approaches is therefore not merely one of classification accuracy but of information integration."
                      </div>
                      <p>
                        A radiologist interpreting a chest X-ray will consult the patient's clinical history, indication for the study, and prior imaging reports alongside the image itself. Most existing automated chest X-ray systems operate exclusively on image data, ignoring the textual clinical information that clinicians routinely use to guide interpretation. Current AI systems do not replicate this multimodal reasoning, which limits their utility as decision support tools in real clinical workflows.
                      </p>
                      <p>
                        This paper presents <strong className="text-primary">Xynapse</strong>, a multimodal diagnosis and reporting assistant for chest radiography. Xynapse accepts a chest X-ray image and optionally accompanying clinical notes, processes each through dedicated encoder branches, and combines the resulting feature representations through a learned gated fusion module before performing multi-label classification across five target pathologies: 
                        <span className="text-secondary-container font-semibold"> Cardiomegaly, Pleural Effusion, Pneumonia, Pneumothorax, and Consolidation</span>.
                      </p>
                      <h5 className="text-xs font-bold text-primary uppercase tracking-wider mt-2">Principal Contributions:</h5>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                        {[
                          "A gated fusion architecture that combines DenseNet-121 image features and Bio_ClinicalBERT text embeddings through a learned sigmoid gated weighting mechanism.",
                          "An offline Bio_ClinicalBERT embedding precomputation strategy that eliminates repeated BERT forward passes during training, reducing training time significantly.",
                          "A principled handling of severe dataset imbalance between IU X-Ray and CheXpert through a WeightedRandomSampler with a 55:1 weight ratio.",
                          "An auxiliary image-only classification head with a 0.3 weighted loss that prevents image encoder collapse during training.",
                          "A transparent ablation study that documents the pseudo-label leakage effect in the IU X-Ray subset, identifying the image-only configuration as the real-world proxy."
                        ].map((item, idx) => (
                          <li key={idx} className="flex gap-2.5 text-[12.5px] text-on-surface-variant leading-relaxed">
                            <span className="w-5 h-5 rounded-full bg-secondary-container/10 border border-secondary-container/20 text-secondary-container font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}

                  {researchTab === "data" && (
                    <motion.div
                      key="data"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col gap-5"
                    >
                      <h4 className="text-[16px] font-bold text-primary flex items-center gap-2">
                        <span className="text-secondary-container font-mono">2.</span> Datasets & Clinical Text Alignment
                      </h4>
                      <p>
                        Xynapse is trained and evaluated on a combined dataset drawn from two primary sources, aligning raw pixel data with clinical language expressions:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2">
                        <div className="border border-white/5 bg-surface-container-low/35 rounded-xl p-4 flex flex-col gap-2">
                          <span className="text-xs font-bold text-primary uppercase tracking-wider">Indiana University (IU) X-Ray</span>
                          <span className="text-[20px] font-bold text-secondary-container leading-none">~3,955 studies</span>
                          <p className="text-[12px] leading-relaxed text-on-surface-variant/80">
                            Paired studies with certified radiology reports (FINDINGS, IMPRESSION, INDICATION, and COMPARISON). Pseudo-labels are generated automatically using condition-specific keywords and a 40-character lookback window for negation checking ("no", "without", etc.).
                          </p>
                        </div>
                        <div className="border border-white/5 bg-surface-container-low/35 rounded-xl p-4 flex flex-col gap-2">
                          <span className="text-xs font-bold text-primary uppercase tracking-wider">Stanford CheXpert Dataset</span>
                          <span className="text-[20px] font-bold text-secondary-container leading-none">224,316 images</span>
                          <p className="text-[12px] leading-relaxed text-on-surface-variant/80">
                            Large-scale dataset with NLP-extracted labels. Uncertain labels are treated as negative (U-Zeros policy). To represent clinical text in CheXpert's training split, a randomized template bank is used to assign surrogate clinical phrase templates per condition.
                          </p>
                        </div>
                      </div>
                      <h5 className="text-xs font-bold text-primary uppercase tracking-wider">Weighted random sampling for 55:1 imbalance:</h5>
                      <p>
                        CheXpert vastly outnumbers the clinical report-rich IU X-Ray dataset (55:1). Without correction, training batches would almost exclusively contain CheXpert samples, preventing the text branch from learning to process real clinical report language. A <strong>WeightedRandomSampler</strong> assigns a sampling weight of 55 to IU X-Ray samples and 1 to CheXpert, ensuring a balanced mix of both data sources in every batch.
                      </p>
                    </motion.div>
                  )}

                  {researchTab === "arch" && (
                    <motion.div
                      key="arch"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col gap-5"
                    >
                      <h4 className="text-[16px] font-bold text-primary flex items-center gap-2">
                        <span className="text-secondary-container font-mono">3.</span> Model Architecture & Fusion Strategy
                      </h4>
                      <p>
                        Xynapse's neural network utilizes separate encoding branches for visual and textual inputs, projecting both into a shared space prior to dynamic fusion.
                      </p>

                      <div className="flex flex-col gap-4 border-l-2 border-secondary-container/30 pl-4 mt-2">
                        <div>
                          <span className="text-xs font-mono font-bold text-secondary-container uppercase tracking-wider">Image Encoder (DenseNet-121)</span>
                          <p className="text-[12.5px] mt-0.5">
                            Pre-trained via <em>TorchXRayVision</em> on multiple datasets. Images are resized to 224x224 and visual features are projected to a 256-dimensional space (Linear(1024 &rarr; 256) + LayerNorm + ReLU). A progressive unfreezing schedule freezes earlier blocks and updates only denseblock4 and norm5 after epoch 6.
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-mono font-bold text-secondary-container uppercase tracking-wider">Text Encoder (Bio_ClinicalBERT)</span>
                          <p className="text-[12.5px] mt-0.5">
                            Extracts 768-dimensional CLS token embeddings. To speed up training, these are precomputed offline and retrieved via dictionary cache. Projected into a shared 256-dimensional space. A text dropout rate of 0.35 zero-masks text representations during training to prevent textual dominance.
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-mono font-bold text-secondary-container uppercase tracking-wider">Sigmoid Gated Fusion Module</span>
                          <p className="text-[12.5px] mt-0.5">
                            Avoids naive concatenation or late blending. A gate layer takes the concatenated [image, text] features (512-d) and outputs a 256-d vector <span className="font-mono text-secondary-container">&alpha; &isin; (0,1)</span>. The gated blend is computed as:
                          </p>
                          <div className="bg-surface-container px-4 py-2 font-mono text-[13px] border border-white/5 rounded-lg my-1.5 w-fit">
                            gated = &alpha; &times; image_features + (1 - &alpha;) &times; text_features
                          </div>
                          <p className="text-[12.5px] mt-1">
                            The final fusion representation is a 768-dimensional vector formed by concatenating the gated blend, the original image feature, and the original text feature.
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-mono font-bold text-secondary-container uppercase tracking-wider">Auxiliary Image Head & Loss</span>
                          <p className="text-[12.5px] mt-0.5">
                            An auxiliary classification head directly reads visual features to prevent visual branch collapse during backpropagation. Total training loss is computed as:
                          </p>
                          <div className="bg-surface-container px-4 py-2 font-mono text-[13px] border border-white/5 rounded-lg my-1.5 w-fit">
                            loss = main_loss + 0.3 &times; auxiliary_loss
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {researchTab === "results" && (
                    <motion.div
                      key="results"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col gap-5"
                    >
                      <h4 className="text-[16px] font-bold text-primary flex items-center gap-2">
                        <span className="text-secondary-container font-mono">4.</span> Experimental Evaluation & Calibration
                      </h4>
                      <p>
                        Under its full multimodal setup, Xynapse achieves a macro-averaged AUC-ROC of <strong>0.9731</strong> on the test set.
                      </p>

                      <div className="overflow-x-auto border border-white/5 rounded-xl my-2">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-surface-container-high text-primary border-b border-white/5 font-semibold">
                              <th className="p-3">Condition</th>
                              <th className="p-3">Optimal Threshold</th>
                              <th className="p-3">AUC-ROC</th>
                              <th className="p-3">F1 Score</th>
                              <th className="p-3">Precision</th>
                              <th className="p-3">Recall</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            <tr>
                              <td className="p-3 font-semibold text-primary">Cardiomegaly</td>
                              <td className="p-3 font-mono">0.46</td>
                              <td className="p-3 font-mono text-secondary-container">0.9912</td>
                              <td className="p-3 font-mono">0.8701</td>
                              <td className="p-3 font-mono">0.8816</td>
                              <td className="p-3 font-mono">0.8590</td>
                            </tr>
                            <tr>
                              <td className="p-3 font-semibold text-primary">Pleural Effusion</td>
                              <td className="p-3 font-mono">0.83</td>
                              <td className="p-3 font-mono text-secondary-container">0.9689</td>
                              <td className="p-3 font-mono">0.7588</td>
                              <td className="p-3 font-mono">0.9388</td>
                              <td className="p-3 font-mono">0.7993</td>
                            </tr>
                            <tr>
                              <td className="p-3 font-semibold text-primary">Pneumonia</td>
                              <td className="p-3 font-mono">0.84</td>
                              <td className="p-3 font-mono text-secondary-container">0.9437</td>
                              <td className="p-3 font-mono">0.7021</td>
                              <td className="p-3 font-mono">0.8049</td>
                              <td className="p-3 font-mono">0.7736</td>
                            </tr>
                            <tr>
                              <td className="p-3 font-semibold text-primary">Pneumothorax</td>
                              <td className="p-3 font-mono">0.75</td>
                              <td className="p-3 font-mono text-secondary-container">0.9876</td>
                              <td className="p-3 font-mono">0.8462</td>
                              <td className="p-3 font-mono">0.8067</td>
                              <td className="p-3 font-mono">0.9338</td>
                            </tr>
                            <tr>
                              <td className="p-3 font-semibold text-primary">Consolidation</td>
                              <td className="p-3 font-mono">0.74</td>
                              <td className="p-3 font-mono text-secondary-container">0.9740</td>
                              <td className="p-3 font-mono">0.7731</td>
                              <td className="p-3 font-mono">0.9583</td>
                              <td className="p-3 font-mono">0.7042</td>
                            </tr>
                            <tr className="bg-surface-container/35">
                              <td className="p-3 font-bold text-primary">Macro Average</td>
                              <td className="p-3 font-mono">—</td>
                              <td className="p-3 font-mono text-secondary-container font-bold">0.9731</td>
                              <td className="p-3 font-mono font-bold">0.7901</td>
                              <td className="p-3 font-mono font-bold">0.8781</td>
                              <td className="p-3 font-mono font-bold">0.8140</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <h5 className="text-xs font-bold text-primary uppercase tracking-wider mt-2">Ablation Study (Table 2):</h5>
                      <div className="overflow-x-auto border border-white/5 rounded-xl mb-2">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-surface-container-high text-primary border-b border-white/5 font-semibold">
                              <th className="p-3">Evaluation Configuration</th>
                              <th className="p-3">Macro AUC-ROC</th>
                              <th className="p-3">Interpretation</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            <tr>
                              <td className="p-3 font-semibold text-primary">Full Multimodal (Image + Text)</td>
                              <td className="p-3 font-mono text-secondary-container font-bold">0.9731</td>
                              <td className="p-3 text-on-surface-variant/80">Primary configuration with both encoders active.</td>
                            </tr>
                            <tr>
                              <td className="p-3 font-semibold text-primary">Text Only</td>
                              <td className="p-3 font-mono text-secondary-container">0.8760</td>
                              <td className="p-3 text-on-surface-variant/80">Inflated by pseudo-label leakage on the IU X-Ray subset.</td>
                            </tr>
                            <tr>
                              <td className="p-3 font-semibold text-primary">Image Only</td>
                              <td className="p-3 font-mono text-secondary-container">0.7140</td>
                              <td className="p-3 text-on-surface-variant/80">Proxy for real-world deployment (no clinical text at inference).</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <h5 className="text-xs font-bold text-primary uppercase tracking-wider mt-2">Threshold Calibration Analysis (F1 gains):</h5>
                      <p className="text-[12.5px]">
                        Sweeping thresholds from 0.05 to 0.95 on the validation set corrects positive classification bias, producing F1 score improvements ranging from <strong>13.83%</strong> for Cardiomegaly to <strong>38.42%</strong> for Pneumonia compared to default 0.5 thresholds.
                      </p>

                      <h5 className="text-xs font-bold text-primary uppercase tracking-wider">Gated Fusion Alpha Weight Analysis:</h5>
                      <p className="text-[12.5px]">
                        The dynamic gates converged to mean alpha values of <strong>0.444 - 0.445</strong> across all pathology evaluations. This indicates a stable, text-leaning multimodal balance, proving the auxiliary classification head successfully prevented image encoder collapse.
                      </p>
                    </motion.div>
                  )}

                  {researchTab === "limitations" && (
                    <motion.div
                      key="limitations"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col gap-5"
                    >
                      <h4 className="text-[16px] font-bold text-primary flex items-center gap-2">
                        <span className="text-secondary-container font-mono">5.</span> Limitations, Future Directions & References
                      </h4>
                      <div className="flex flex-col gap-4">
                        <div>
                          <span className="text-xs font-bold text-primary uppercase tracking-wider">Limitations & Caveats</span>
                          <ul className="list-disc list-inside space-y-1 mt-1.5 text-[13px]">
                            <li><strong>Pseudo-Label Leakage:</strong> The text-only baseline is structurally leaked because ground truth was extracted using keyword matching from the same reports BERT evaluated at inference.</li>
                            <li><strong>Dataset Biases:</strong> CheXpert uncertainty labels (U-Zeros policy) treat uncertainties as negative, depressing clinical recall for complex consolidation findings.</li>
                            <li><strong>External Generalization:</strong> Evaluation split remains adjacent to training scanner configurations; external clinical cohorts have not been tested.</li>
                            <li><strong>Surrogate Phrase Approximation:</strong> Template phrasings used for CheXpert do not capture the syntax variance of genuine clinical note-taking.</li>
                          </ul>
                        </div>

                        <div>
                          <span className="text-xs font-bold text-primary uppercase tracking-wider">Future Directions</span>
                          <ul className="list-disc list-inside space-y-1 mt-1.5 text-[13px]">
                            <li>External multi-institution validation with expert adjudicated labels.</li>
                            <li>Eliminating data leakage by testing text encoders on separate clinical corpora.</li>
                            <li>Integrating attention-based spatial localization and explainability maps (e.g. Grad-CAM) directly on image output embeddings.</li>
                            <li>Expanding classification targets beyond the primary 5 pathologies.</li>
                          </ul>
                        </div>

                        <div className="pt-4 border-t border-white/5">
                          <span className="text-xs font-bold text-primary uppercase tracking-wider block mb-2">Key References</span>
                          <ul className="space-y-2 font-mono text-[11px] leading-relaxed text-on-surface-variant/70">
                            <li>Alsentzer, E., et al. (2019). Publicly available clinical BERT embeddings. <em>arXiv preprint arXiv:1904.03323</em>.</li>
                            <li>Boecking, B., et al. (2022). Making the most of text semantics to improve biomedical vision–language processing. <em>ECCV</em>.</li>
                            <li>Irvin, J., et al. (2019). CheXpert: A large chest radiograph dataset with uncertainty labels. <em>AAAI</em>.</li>
                            <li>Rajpurkar, P., et al. (2017). CheXNet: Radiologist-level pneumonia detection on chest X-rays. <em>arXiv:1711.05225</em>.</li>
                            <li>Smit, A., et al. (2020). CheXBERT: Combining automatic labelers and expert annotations for report labeling. <em>EMNLP</em>.</li>
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.section>
          )}

          {/* ================= TEAM SECTION ================= */}
          {activeSection === "team" && (
            <motion.section
              key="team"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-1 py-10 flex flex-col justify-center max-w-5xl mx-auto w-full"
            >
              <h2 className="font-display-italic text-[48px] sm:text-[54px] text-primary mb-8 tracking-tight">The Team.</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {TEAM_MEMBERS.map((member, index) => (
                  <div
                    key={index}
                    className="bg-surface-container-lowest rounded-lg p-6 border border-white/5 hover:border-secondary-container/20 hover:-translate-y-1 transition-all duration-300 group"
                  >
                    {/* Top Row: Avatar/Image & Roll Number/LinkedIn */}
                    <div className="flex items-center justify-between mb-4">
                      {member.image ? (
                        <img
                          src={member.image}
                          alt={member.name}
                          className="w-16 h-16 rounded-full object-cover border border-white/10"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-br from-secondary-fixed to-on-tertiary-container flex items-center justify-center">
                          <div className="w-[60px] h-[60px] rounded-full bg-surface-container-high flex items-center justify-center text-primary font-bold font-mono text-[16px]">
                            {member.avatar}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {member.linkedin && (
                          <a
                            href={member.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg border border-white/5 bg-surface-container-low text-on-surface-variant/50 hover:text-[#00e3fd] hover:border-secondary-container/30 hover:scale-105 transition-all duration-200"
                            title={`LinkedIn profile of ${member.name}`}
                          >
                            <Linkedin className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {member.rollNo && (
                          <span className="px-2.5 py-0.5 rounded-full border border-white/10 text-on-surface-variant/70 bg-surface-container-low text-[10px] font-mono font-medium">
                            #{member.rollNo}
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="text-primary text-[17px] font-bold leading-tight">{member.name}</h3>
                    <span className="text-secondary-container text-[11.5px] font-mono tracking-wide mt-1 block mb-4">
                      {member.role}
                    </span>

                    {/* Primary Responsibilities (3 bullet points) */}
                    {member.responsibilities && member.responsibilities.length > 0 && (
                      <ul className="space-y-2">
                        {member.responsibilities.map((resp, ri) => (
                          <li key={ri} className="text-[12px] text-on-surface-variant/80 flex items-start gap-2 leading-relaxed">
                            <span className="text-secondary-container font-bold shrink-0 mt-0.5">·</span>
                            <span>{resp}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* ================= DOCS SECTION ================= */}
          {activeSection === "docs" && (
            <motion.section
              key="docs"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 py-8 flex flex-col justify-center"
            >
              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8 h-full max-w-4xl mx-auto w-full">
                {/* Side Directory list */}
                <div className="border-r border-white/5 py-4 pr-4 hidden md:block">
                  <h3 className="font-label-caps text-label-caps text-on-surface-variant mb-4 px-2 text-[10px] tracking-[0.12em] uppercase">Introduction</h3>
                  <ul className="flex flex-col gap-0.5 text-[13px]">
                    <li className="px-2.5 py-2 text-primary bg-surface-container-high rounded-md cursor-pointer font-semibold">Getting Started</li>
                    <li className="px-2.5 py-2 text-on-surface-variant hover:text-primary rounded-md cursor-pointer transition-colors">Serverless API</li>
                    <li className="px-2.5 py-2 text-on-surface-variant hover:text-primary rounded-md cursor-pointer transition-colors">Architecture Map</li>
                  </ul>
                </div>

                {/* Sub Contents */}
                <div className="flex-1 py-4">
                  <h1 className="font-headline-lg text-headline-lg text-primary text-[28px] mb-2 tracking-tight">Getting Started</h1>
                  <p className="text-on-surface-variant text-[14px] leading-relaxed mb-6">
                    Integrate the Xynapse inference engine seamlessly into your medical diagnosis and PACS workstation environment.
                  </p>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <span className="text-[12px] font-bold text-primary">Python Inference Script</span>
                      <div className="bg-surface-container-low rounded-md p-4 border border-white/5 font-data-mono text-data-mono text-on-surface-variant/90 text-xs overflow-x-auto relative group">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`import xynapse\n\ model = xynapse.load("thorax-v2")\nresult = model.predict("patient_xray.dcm")\nprint(result.confidence)`);
                          }}
                          className="absolute top-2.5 right-2.5 text-[10px] bg-white/5 px-2.5 py-1 rounded-md text-on-surface-variant/60 group-hover:text-primary transition-all hover:bg-white/15"
                        >
                          Copy
                        </button>
                        <pre><code>{`import xynapse
 
model = xynapse.load("thorax-v2")
result = model.predict("patient_xray.dcm")
print(result.confidence)`}</code></pre>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="text-[12px] font-bold text-primary">Direct HTTP REST Webhook Endpoint</span>
                      <p className="text-[12px] text-on-surface-variant leading-relaxed">
                        To upload DICOM or images via remote integration, post a raw structured payload to the `/api/analyze` webhook coordinate:
                      </p>
                      <div className="bg-surface-container-low rounded-md p-4 border border-white/5 font-data-mono text-data-mono text-on-surface-variant/90 text-xs overflow-x-auto">
                        <pre><code>{`POST /api/analyze HTTP/1.1
Content-Type: application/json
 
{
  "image": "raw_base64_string_here",
  "mimeType": "image/png",
  "patientName": "Sarah Connor"
}`}</code></pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Shared Global Footer */}
      <footer className="w-full py-10 bg-surface-container-lowest border-t border-white/5 font-label-caps text-label-caps select-none mt-auto">
        <div className="max-w-[1440px] mx-auto px-6 md:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-0.5 font-headline-md text-headline-md font-bold text-primary tracking-tight shrink-0">
            <img
              alt="Xynapse Logo"
              className="w-[70px] h-[70px] object-contain"
              src="/logo.png"
            />
            <span className="text-sm">Xynapse</span>
          </div>

          {/* Links list */}
          <div className="flex flex-wrap justify-center gap-5 text-on-surface-variant text-[11px] lowercase tracking-widest font-normal">
            <button className="hover:text-secondary-fixed transition-colors duration-200 cursor-pointer" onClick={() => setActiveModal("privacy")}>Privacy Policy</button>
            <button className="hover:text-secondary-fixed transition-colors duration-200 cursor-pointer" onClick={() => setActiveModal("terms")}>Terms of Service</button>
            <button className="hover:text-secondary-fixed transition-colors duration-200 cursor-pointer" onClick={() => setActiveModal("hipaa")}>HIPAA Compliance</button>
            <button className="hover:text-secondary-fixed transition-colors duration-200 cursor-pointer" onClick={() => setActiveModal("contact")}>Contact Support</button>
          </div>

          <div className="text-on-surface-variant text-center md:text-right max-w-[340px] text-[10px] leading-relaxed tracking-wider normal-case opacity-60 shrink-0">
            © 2025 Xynapse AI.<br />For clinical decision support only.<br />Not a primary diagnostic tool.
          </div>
        </div>
      </footer>

      {/* Global Dialog Modal */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveModal(null)}
              className="absolute inset-0 bg-surface/80 backdrop-blur-md"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full max-w-[580px] bg-surface-container-low border border-white/8 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden z-10 flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/5 flex items-center gap-3 bg-surface-container-lowest/50 shrink-0">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, rgba(0,227,253,0.15), rgba(0,227,253,0.04))", border: "1px solid rgba(0,227,253,0.25)" }}>
                  {activeModal === "hipaa" && <Lock className="w-5 h-5 text-secondary-container" />}
                  {activeModal === "privacy" && <FileText className="w-5 h-5 text-secondary-container" />}
                  {activeModal === "terms" && <BookOpen className="w-5 h-5 text-secondary-container" />}
                  {activeModal === "contact" && <MessageSquare className="w-5 h-5 text-secondary-container" />}
                </div>
                <div>
                  <h3 className="text-primary font-bold text-[18px] tracking-tight">
                    {activeModal === "hipaa" && "HIPAA Compliance"}
                    {activeModal === "privacy" && "Privacy Policy"}
                    {activeModal === "terms" && "Terms of Service"}
                    {activeModal === "contact" && "Contact Support"}
                  </h3>
                  <span className="text-[10px] font-mono text-on-surface-variant/50 uppercase tracking-wider block mt-0.5">
                    Xynapse Platform Documentation
                  </span>
                </div>
                {/* Close Button */}
                <button
                  onClick={() => setActiveModal(null)}
                  className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center border border-white/8 text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-all cursor-pointer"
                >
                  &times;
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-[13.5px] leading-relaxed text-on-surface-variant/90 select-text">
                {activeModal === "hipaa" && (
                  <>
                    <p>
                      Xynapse is designed from the ground up to support compliance with the <strong>Health Insurance Portability and Accountability Act (HIPAA)</strong> safeguards. As a Clinical Decision Support System, we prioritize patients' Protected Health Information (PHI) privacy above all else.
                    </p>
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-surface-container/30 border border-white/5">
                        <h4 className="font-bold text-primary text-[13px] uppercase tracking-wider mb-1">Administrative Safeguards</h4>
                        <p className="text-[12.5px] text-on-surface-variant/80">
                          We implement strict access management policies. Only authenticated clinical roles are authorized to request model predictions and review reports. Audit logs track all operational sessions.
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-surface-container/30 border border-white/5">
                        <h4 className="font-bold text-primary text-[13px] uppercase tracking-wider mb-1">Physical & Session Safeguards</h4>
                        <p className="text-[12.5px] text-on-surface-variant/80">
                          Xynapse runs in a secure sandbox execution mode. Scans are processed in-memory and are immediately cleared from the session memory upon closing or clearing the workspace queue. No persistent copy of patient studies is stored.
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-surface-container/30 border border-white/5">
                        <h4 className="font-bold text-primary text-[13px] uppercase tracking-wider mb-1">Technical Safeguards (Encryption)</h4>
                        <p className="text-[12.5px] text-on-surface-variant/80">
                          All multi-modal data in transit is encrypted using advanced TLS 1.3 encryption protocols. Static assets and demo configs are encrypted at rest with industry-standard AES-256 cipher standards.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {activeModal === "privacy" && (
                  <>
                    <p>
                      Your privacy is paramount. This statement outlines what data is processed when utilizing the Xynapse platform.
                    </p>
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-surface-container/30 border border-white/5">
                        <h4 className="font-bold text-primary text-[13px] uppercase tracking-wider mb-1">Data We Process</h4>
                        <p className="text-[12.5px] text-on-surface-variant/80">
                          The platform processes raw thoracic radiographs (PNG, JPEG, or DICOM formats), patient demographic identifiers (optional), prior clinical reports, and chat dialogue histories with the assistant.
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-surface-container/30 border border-white/5">
                        <h4 className="font-bold text-primary text-[13px] uppercase tracking-wider mb-1">How We Use Your Data</h4>
                        <p className="text-[12.5px] text-on-surface-variant/80">
                          All payloads are parsed immediately by the deep learning classifier (DenseNet-121 backend) to draw bounding-box annotations and clinical recommendations. Logs are stored strictly client-side.
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-surface-container/30 border border-white/5">
                        <h4 className="font-bold text-primary text-[13px] uppercase tracking-wider mb-1">No Data Monetization</h4>
                        <p className="text-[12.5px] text-on-surface-variant/80">
                          We do not sell, rent, or distribute data to ad brokers or third-party analytical suites. Data transmission is limited to the serverless model orchestration endpoint.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {activeModal === "terms" && (
                  <>
                    <p>
                      By accessing the Xynapse workspace, you acknowledge and agree to the following terms and guidelines.
                    </p>
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-surface-container/30 border border-white/5">
                        <h4 className="font-bold text-primary text-[13px] uppercase tracking-wider mb-1">Clinical Decision Support Only</h4>
                        <p className="text-[12.5px] text-on-surface-variant/80">
                          Xynapse operates as a Clinical Decision Support System (CDSS). The model outputs, probability indices, and assistant chat comments are intended solely to assist clinical decision-making. They are NOT a substitute for professional radiology assessments.
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-surface-container/30 border border-white/5">
                        <h4 className="font-bold text-primary text-[13px] uppercase tracking-wider mb-1">Professional Liability</h4>
                        <p className="text-[12.5px] text-on-surface-variant/80">
                          The user retains all professional liability for patient diagnosis and prescription of therapeutics. Xynapse developers and affiliates assume no liability for errors, false positives, or omissions in model outputs.
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-surface-container/30 border border-white/5">
                        <h4 className="font-bold text-primary text-[13px] uppercase tracking-wider mb-1">Usage Constraints</h4>
                        <p className="text-[12.5px] text-on-surface-variant/80">
                          Reverse engineering of neural network weights, hacking the inference endpoints, or using the platform for unsolicited diagnostic reports outside of a certified medical framework is strictly prohibited.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {activeModal === "contact" && (
                  <>
                    <p>
                      Do you have questions about deployment, custom medical API integrations, or HIPAA-compliant hospital networks? Reach out directly.
                    </p>
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-surface-container/30 border border-white/5 space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-mono text-primary uppercase tracking-wider w-20 shrink-0">Email:</span>
                          <a href="mailto:xynapse@thebitpack.com" className="text-secondary-container hover:underline text-[13px]">xynapse@thebitpack.com</a>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-mono text-primary uppercase tracking-wider w-20 shrink-0">Phone:</span>
                          <span className="text-on-surface-variant text-[13px]">+923162319913</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-[11px] font-mono text-primary uppercase tracking-wider w-20 shrink-0 mt-0.5">HQ Address:</span>
                          <span className="text-on-surface-variant/80 text-[12.5px] leading-relaxed">
                            Remote Team, Based In Pakistan. Supporting Worldwide Operations
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] font-mono text-on-surface-variant/40 leading-relaxed text-center">
                        Our clinical integration team typically responds to enterprise hospital deployment inquiries within 24 hours.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/5 bg-surface-container-lowest flex justify-end shrink-0">
                <button
                  onClick={() => setActiveModal(null)}
                  className="bg-primary text-on-primary px-5 py-2 text-[12px] rounded-lg font-semibold hover:opacity-90 transition-all cursor-pointer"
                >
                  Acknowledge & Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
