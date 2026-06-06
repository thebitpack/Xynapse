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
  Trash2
} from "lucide-react";
import { PRESET_SCANS, TEAM_MEMBERS, LUNG_SVG_STENCIL, LUNG_SVG_STENCIL_CARDIOMEGALY, LUNG_SVG_STENCIL_NORMAL } from "./data/presets";
import { ActiveSection, Scan, Finding } from "./types";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>("home");
  const [scans, setScans] = useState<Scan[]>(PRESET_SCANS);
  const [selectedScanId, setSelectedScanId] = useState<string>("new");
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  
  // Image viewer filters & manipulation
  const [zoom, setZoom] = useState<number>(1.0);
  const [contrastSetting, setContrastSetting] = useState<"normal" | "high" | "inverted">("normal");
  const [showCoordinates, setShowCoordinates] = useState<boolean>(true);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  // Chatbot UI state
  const [chatInput, setChatInput] = useState<string>("");
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<Record<string, { role: "user" | "model"; text: string }[]>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  // Form states for manual patient meta ingestion
  const [newPatientName, setNewPatientName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selected scan detail
  const activeScan = scans.find(s => s.id === selectedScanId) || scans[0];

  // Fetch server status and check API key configuration
  useEffect(() => {
    fetch("/api/health")
      .then(res => res.json())
      .then(data => {
        setHasApiKey(data.hasApiKey);
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

  // Convert uploaded image file to base64 and call analysis service
  const handleFileSelected = (file: File) => {
    setUploadError(null);
    
    // Size check (max 20MB for immediate reliable analysis in standard preview)
    if (file.size > 20 * 1024 * 1024) {
      setUploadError("File exceeds 20MB limit. Please upload a compressed PNG or JPG.");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      processAnalysisRequest(base64Data, file.name, file.type, file.size);
    };
    reader.onerror = () => {
      setUploadError("Error reading the local image file. Please try another one.");
    };
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  // Perform Gemini AI Request
  const processAnalysisRequest = async (base64Image: string, fileName: string, mimeType: string, rawSize: number) => {
    setIsAnalyzing(true);
    setUploadError(null);

    const formattedSize = `${(rawSize / (1024 * 1024)).toFixed(1)} MB`;
    const patientLabel = newPatientName.trim() || `Patient #${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64Image,
          mimeType,
          patientName: patientLabel
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || "Analysis request failed.");
      }

      const results = await response.json();
      
      const newScanRecord: Scan = {
        id: `scan_${Date.now()}`,
        patientName: results.patientName || patientLabel,
        fileName,
        fileSize: formattedSize,
        date: "Just now",
        imageUrl: base64Image, // Use base64 string directly for visual rendering inside the viewer card
        findings: results.findings || [],
        summary: results.summary || "Analysis returned successfully with no major anomalies detected.",
        recommendations: results.recommendations || ["No urgent therapeutic directives noted."],
        metrics: results.metrics || { acc: "94.2%", lat: "450ms" },
        isSimulated: results.isSimulated
      };

      setScans(prev => [newScanRecord, ...prev]);
      setSelectedScanId(newScanRecord.id);
      
      // Reset text field
      setNewPatientName("");
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || "Something went wrong during analysis. Verify your network or credentials.");
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
        <div className="flex justify-between items-center max-w-[1440px] mx-auto px-6 md:px-8 h-full">
          {/* Logo Brand */}
          <div 
            onClick={() => setActiveSection("home")}
            className="flex items-center gap-2.5 cursor-pointer select-none font-headline-md text-headline-md font-bold text-primary tracking-tight shrink-0"
          >
            <img 
  alt="Xynapse Logo" 
  className="w-[60px] h-[60px] object-contain" 
  src="/logo.png"
/>
            <span className="tracking-wide">Xynapse</span>
          </div>

          {/* Navigation Links — centered */}
          <div className="hidden md:flex gap-6 lg:gap-8 items-center absolute left-1/2 -translate-x-1/2">
            {(["home", "analysis", "about", "team", "docs"] as ActiveSection[]).map((section) => {
              const isActive = activeSection === section;
              return (
                <button
                  key={section}
                  onClick={() => setActiveSection(section)}
                  className={`capitalize relative px-1 py-1.5 font-medium text-[13px] transition-all duration-300 ${
                    isActive 
                      ? "text-primary font-bold" 
                      : "text-on-surface-variant hover:text-primary opacity-75 hover:opacity-100"
                  }`}
                >
                  {section}
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

          {/* Trailing Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={() => setActiveSection("analysis")}
              className="bg-primary hover:bg-white/90 text-on-primary px-5 py-2 text-[13px] rounded-md font-medium transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Start Analysis &rarr;
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="pt-[96px] min-h-[calc(100vh-64px)] flex flex-col max-w-[1440px] mx-auto px-6 md:px-8 pb-12">
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
                <div className="flex flex-col gap-6">
                  <h1 className="font-display-italic text-[56px] sm:text-[72px] lg:text-[84px] leading-[0.95] text-primary tracking-tight">
                    Clarity in the<br />Shadows.
                  </h1>
                  <p className="text-on-surface-variant max-w-[420px] text-[15px] leading-[1.7]">
                    Advanced radiological insights powered by deep learning. Minimizing cognitive load for medical professionals through high-end software craftsmanship.
                  </p>
                  <div className="flex flex-wrap gap-4 pt-2">
                    <button 
                      onClick={() => setActiveSection("analysis")}
                      className="bg-primary text-on-primary px-6 py-3 rounded-md font-semibold flex items-center gap-2.5 hover:opacity-95 duration-200 transition-all shadow-lg hover:shadow-cyan-950/20 text-[14px]"
                    >
                      Start Analysis <ArrowRight className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setActiveSection("docs")}
                      className="bg-transparent text-primary px-6 py-3 rounded-md glass-border-hi font-medium hover:bg-surface-bright duration-200 transition-all text-[14px]"
                    >
                      View Docs
                    </button>
                  </div>
                </div>

                {/* Chest X-ray Visual Poster */}
                <div className="relative bg-surface rounded-lg glass-border h-[400px] lg:h-[430px] flex items-center justify-center overflow-hidden group shadow-[0_0_80px_20px_rgba(0,0,0,0.4)]">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary-fixed/5 to-transparent pointer-events-none" />
                  
                  {/* Decorative Scan Lines */}
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-secondary-container/20 shadow-[0_0_15px_#00e3fd] animate-[ping_4s_infinite]" />
                  
                  <div className="w-[260px] h-[260px] lg:w-[300px] lg:h-[300px] flex items-center justify-center relative">
                    {renderLungStencil("pleural_effusion")}
                  </div>

                  {/* Dynamic Indicators */}
                  <div className="absolute bottom-5 left-5 right-5 flex justify-between">
                    <div className="bg-surface-container-high px-3 py-1.5 rounded-md font-data-mono text-data-mono text-secondary-container glass-border text-[11px] tracking-wider uppercase">
                      ACC: 94.7%
                    </div>
                    <div className="bg-surface-container-high px-3 py-1.5 rounded-md font-data-mono text-data-mono text-on-surface-variant glass-border text-[11px] tracking-wider uppercase">
                      LAT: 12ms
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Metrics Strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-0 mt-16 rounded-lg glass-border overflow-hidden bg-surface-container-lowest/25">
                <div className="flex flex-col gap-1.5 py-8 px-6 border-r border-white/5 last:border-r-0">
                  <span className="font-label-caps text-label-caps text-on-surface-variant text-[10px] tracking-[0.12em] uppercase">Scans Analyzed</span>
                  <span className="font-headline-lg text-headline-lg text-primary text-[32px] lg:text-[36px] leading-none">100k+</span>
                </div>
                <div className="flex flex-col gap-1.5 py-8 px-6 border-r border-white/5">
                  <span className="font-label-caps text-label-caps text-on-surface-variant text-[10px] tracking-[0.12em] uppercase">False Positive Rate</span>
                  <span className="font-headline-lg text-headline-lg text-primary text-[32px] lg:text-[36px] leading-none">&lt;1.2%</span>
                </div>
                <div className="flex flex-col gap-1.5 py-8 px-6 border-r border-white/5">
                  <span className="font-label-caps text-label-caps text-on-surface-variant text-[10px] tracking-[0.12em] uppercase">DenseNet Depth</span>
                  <span className="font-headline-lg text-headline-lg text-primary text-[32px] lg:text-[36px] leading-none">121 Layers</span>
                </div>
                <div className="flex flex-col gap-1.5 py-8 px-6">
                  <span className="font-label-caps text-label-caps text-on-surface-variant text-[10px] tracking-[0.12em] uppercase">Clinical Precision</span>
                  <span className="font-headline-lg text-headline-lg text-primary text-[32px] lg:text-[36px] leading-none">99.4%</span>
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
              <div className="flex items-center justify-between mb-5 shrink-0">
                <div>
                  <h2 className="text-primary font-bold text-[22px] tracking-tight leading-none">Radiology Workspace</h2>
                  <p className="text-on-surface-variant text-[12px] mt-1">AI-powered diagnostic analysis{selectedScanId !== "new" ? ` · ${activeScan.patientName}` : " · Upload a radiograph to begin"}</p>
                </div>
                {!hasApiKey && (
                  <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-surface-container-high border border-outline-variant/30 rounded-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                    <span className="text-[10px] font-mono text-on-surface-variant">Sandbox Mode — No API Key</span>
                  </div>
                )}
              </div>

              {/* 3-column grid layout */}
              <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_340px] gap-4" style={{ height: "calc(100vh - 220px)", minHeight: "640px", overflow: "hidden" }}>

                {/* ── COL 1: Upload + Scan History ── */}
                <div className="bg-surface-container-lowest/70 rounded-xl border border-white/5 flex flex-col gap-4 p-4 h-full overflow-hidden">
                  {/* Scan list */}
                  <div className="flex flex-col gap-2 flex-1 min-h-0">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-on-surface-variant tracking-[0.14em] uppercase">Radiograph Queue</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono text-on-surface-variant/60 bg-surface-container px-1.5 py-0.5 rounded">{scans.length}</span>
                        <button
                          onClick={() => setSelectedScanId("new")}
                          title="New Upload"
                          className={`w-5 h-5 rounded flex items-center justify-center transition-all duration-200 ${
                            selectedScanId === "new"
                              ? "bg-secondary-container text-on-secondary-container"
                              : "bg-surface-container border border-white/10 text-on-surface-variant hover:text-primary hover:border-secondary-container/40"
                          }`}
                        >
                          <Upload className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 overflow-y-auto pr-0.5 flex-1 min-h-0">
                      {scans.map((scan) => {
                        const isSelected = scan.id === selectedScanId;
                        const hasFindings = scan.findings.length > 0;
                        return (
                          <div
                            key={scan.id}
                            onClick={() => setSelectedScanId(scan.id)}
                            className={`p-2.5 rounded-lg border transition-all duration-200 cursor-pointer ${
                              isSelected
                                ? "bg-surface-container-high border-secondary-container/35 shadow-[0_0_12px_rgba(0,227,253,0.06)]"
                                : "bg-surface-container-low/40 border-white/4 hover:bg-surface-container hover:border-white/10"
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-primary text-[12px] font-semibold truncate max-w-[150px]">{scan.patientName}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className={`w-1.5 h-1.5 rounded-full ${hasFindings ? "bg-secondary-container animate-pulse" : "bg-emerald-400"}`} />
                                <span className={`font-data-mono text-[9px] uppercase font-bold ${hasFindings ? "text-secondary-container" : "text-emerald-400"}`}>
                                  {hasFindings ? scan.findings[0].name.split(" ")[0] : "Clear"}
                                </span>
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

                {/* ── COL 2: HERO — AI Chatbot ── */}
                <div className="relative rounded-xl overflow-hidden flex flex-col border border-white/5 shadow-[0_0_60px_rgba(0,227,253,0.04)] h-full" style={{ background: "linear-gradient(160deg, #0d0d16 0%, #13131b 60%, #0d1018 100%)" }}>

                  {/* Ambient glow top-center */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[340px] h-[1px] bg-gradient-to-r from-transparent via-secondary-container/40 to-transparent" />
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[60px] bg-secondary-container/5 blur-3xl rounded-full pointer-events-none" />

                  {/* Chat hero header */}
                  <div className="relative shrink-0 px-5 py-4 border-b border-white/5 flex items-center justify-between" style={{ background: "rgba(13,13,22,0.8)" }}>
                    <div className="flex items-center gap-3">
                      {/* AI avatar */}
                      <div className="relative w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, rgba(0,227,253,0.15), rgba(0,227,253,0.04))", border: "1px solid rgba(0,227,253,0.25)" }}>
                        <Sparkles className="w-4 h-4 text-secondary-container" />
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-surface-container-lowest" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-primary font-bold text-[14px] tracking-tight">Xynapse Co-Pilot</span>
                          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-secondary-container/10 text-secondary-container border border-secondary-container/20 uppercase tracking-widest">Gemini</span>
                        </div>
                        <p className="text-[10px] text-on-surface-variant/70 mt-0.5">
                          Context: <span className="text-secondary-container/90">{selectedScanId === "new" ? "New Upload" : activeScan.patientName}</span> {selectedScanId !== "new" && `· ${activeScan.findings.length > 0 ? `${activeScan.findings.length} finding${activeScan.findings.length > 1 ? "s" : ""}` : "No anomalies"}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {(chatHistory[selectedScanId] || []).length > 0 && (
                        <button
                          onClick={handleClearChatHistory}
                          className="flex items-center gap-1.5 text-[10px] font-mono text-on-surface-variant/50 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Messages area */}
                  <div className={`flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin select-text min-w-0 ${selectedScanId === "new" ? "flex flex-col justify-center items-center" : "flex flex-col"}`}>
                    {selectedScanId === "new" ? (
                      <div style={{ width: "100%", maxWidth: "420px" }} className="flex flex-col gap-6">
                        <div className="text-center mb-2">
                          <h3 className="text-primary font-bold text-[20px] tracking-tight mb-2">Initialize Analysis</h3>
                          <p className="text-on-surface-variant/70 text-[13px] leading-relaxed">
                            Provide the patient's radiograph and ID to generate a comprehensive AI-driven clinical report.
                          </p>
                        </div>
                        
                        {/* Patient input */}
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-bold text-on-surface-variant tracking-[0.14em] uppercase text-left">Patient Demographics</label>
                          <input
                            type="text"
                            value={newPatientName}
                            onChange={(e) => setNewPatientName(e.target.value)}
                            placeholder="Full Name or Patient ID"
                            className="w-full bg-surface-container px-4 py-3 text-[13px] border border-white/5 rounded-xl text-primary focus:outline-none focus:border-secondary-container/50 placeholder:text-on-surface-variant/35 transition-colors"
                          />
                        </div>

                        {/* Drop zone */}
                        <div
                          onDragEnter={handleDrag}
                          onDragOver={handleDrag}
                          onDragLeave={handleDrag}
                          onDrop={handleDrop}
                          onClick={triggerFileInput}
                          className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
                            dragActive
                              ? "border-secondary-container bg-secondary-container/10 scale-[0.98]"
                              : "border-outline-variant/40 hover:border-secondary-container/50 hover:bg-surface-container-low/80"
                          }`}
                        >
                          <input type="file" ref={fileInputRef} onChange={handleFileInputChange} className="hidden" accept="image/*" />
                          {isAnalyzing ? (
                            <div className="flex flex-col items-center py-4">
                              <RefreshCw className="w-8 h-8 text-secondary-container animate-spin mb-4" />
                              <span className="font-medium text-primary text-[14px]">Consulting Gemini...</span>
                              <span className="font-data-mono text-[10px] text-on-surface-variant/50 mt-1.5">Processing multi-modal inputs</span>
                            </div>
                          ) : (
                            <>
                              <div className="w-12 h-12 rounded-full bg-secondary-container/10 border border-secondary-container/20 flex items-center justify-center mb-4">
                                <Upload className="w-6 h-6 text-secondary-container" />
                              </div>
                              <span className="font-bold text-primary text-[14px] mb-1">Drag radiograph here or browse</span>
                              <span className="font-data-mono text-[10px] text-on-surface-variant/50">PNG, JPG, DCM up to 20MB</span>
                            </>
                          )}
                        </div>

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
                          Ask anything about <span className="text-primary font-medium">{activeScan.patientName}</span>'s radiograph. I'll explain findings, severity, and clinical guidance in plain language.
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
                              <div className={`max-w-[78%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                                <div className={`px-4 py-3 rounded-2xl text-[13px] leading-relaxed ${
                                  isUser
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
                                  {isUser ? "You" : "Co-Pilot"}
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
                        <div ref={chatEndRef} />
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
                        placeholder={`Ask about ${activeScan.patientName.split(" ")[0]}'s scan...`}
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

                {/* ── COL 3: Image Viewer + Findings ── */}
                <div className="flex flex-col gap-3 h-full overflow-hidden">
                  {selectedScanId === "new" ? (
                    <div className="h-full border border-dashed border-white/10 rounded-xl bg-surface-container-lowest/30 flex flex-col items-center justify-center text-center p-6 text-on-surface-variant/40">
                      <ImageIcon className="w-10 h-10 mb-4 opacity-20" />
                      <span className="text-[13px] font-medium text-on-surface-variant/60">Awaiting Radiograph</span>
                      <p className="text-[10px] mt-2 max-w-[200px] leading-relaxed">
                        Upload a scan in the central panel to generate clinical findings.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
                      {/* Image viewer card */}
                  <div className="bg-surface-container-lowest/70 rounded-xl border border-white/5 flex flex-col overflow-hidden" style={{ height: "300px", flexShrink: 0 }}>
                    {/* Toolbar */}
                    <div className="h-[38px] border-b border-white/5 flex items-center px-3 gap-1 bg-surface-container-lowest/80 shrink-0">
                      <button onClick={handleZoomIn} title="Zoom In" className="p-1.5 rounded-md text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all">
                        <ZoomIn className="w-3 h-3" />
                      </button>
                      <button onClick={handleZoomOut} title="Zoom Out" className="p-1.5 rounded-md text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all">
                        <ZoomOut className="w-3 h-3" />
                      </button>
                      <div className="w-[1px] h-3 bg-white/8 mx-1" />
                      <button
                        onClick={() => setContrastSetting(c => c === "normal" ? "high" : c === "high" ? "inverted" : "normal")}
                        className={`p-1.5 rounded-md flex items-center gap-1 text-[10px] font-mono transition-all ${contrastSetting !== "normal" ? "text-secondary-container bg-secondary-container/10" : "text-on-surface-variant hover:text-primary"}`}
                      >
                        <Contrast className="w-3 h-3" />
                        <span className="capitalize">{contrastSetting}</span>
                      </button>
                      <div className="w-[1px] h-3 bg-white/8 mx-1" />
                      <button
                        onClick={() => setShowCoordinates(!showCoordinates)}
                        className={`p-1 text-[9px] font-mono rounded transition-all ${showCoordinates ? "text-primary" : "text-on-surface-variant/50"}`}
                      >
                        OVL:{showCoordinates ? "ON" : "OFF"}
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

                      {/* Metrics row */}
                      <div className="absolute bottom-3 left-3 right-3 flex justify-between">
                        <span className="text-[9px] font-mono px-2 py-1 rounded bg-surface-container/80 border border-white/5 text-secondary-container">{activeScan.metrics.acc}</span>
                        <span className="text-[9px] font-mono px-2 py-1 rounded bg-surface-container/80 border border-white/5 text-on-surface-variant">{activeScan.metrics.lat}</span>
                      </div>
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
                              <span className="text-emerald-400 font-bold text-[13px]">No Anomalies</span>
                              <p className="text-[10px] text-on-surface-variant/60 mt-1 leading-relaxed">Both lung lobes, cardiac silhouette, and vertebral alignment are clear.</p>
                            </div>
                          ) : (
                            activeScan.findings.map((f, i) => {
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
                                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                                    f.severity === "Severe" ? "bg-red-500/10 text-red-400 border border-red-500/20"
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
                </div>

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
              className="flex-1 py-10 max-w-3xl mx-auto flex flex-col justify-center gap-6 w-full"
            >
              <h2 className="font-display-italic text-[48px] sm:text-[54px] text-primary leading-none tracking-tight">The Research.</h2>
              <div className="bg-surface-container-lowest border border-white/5 rounded-lg p-6 md:p-8 flex flex-col gap-5 leading-relaxed text-[15px] text-on-surface-variant">
                <p>
                  <strong className="text-primary">Xynapse</strong> is a state-of-the-art medical radiology analysis platform designed to bridge the gap between heavy deep learning networks and the high-pressure workflow of clinical specialists.
                </p>
                <p>
                  Originally conceived as an advanced Final Year Project, it introduces structured medical diagnostics visualizer systems using serverless orchestration. The pipeline utilizes tailored classification pipelines to extract pleural fluids indices, heart metrics, spinal scoliosis angles, and lung consolidate densities securely.
                </p>
                <p>
                  By presenting clear bounding-box coordinate systems and clinical-grade recommendations drafted automatically using generative intelligence templates, it dramatically reduces a specialist's reading latency, allowing them to allocate high-tier clinical attention where it's needed most.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4 pt-5 border-t border-white/5">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-on-surface-variant/60 font-mono tracking-[0.12em] uppercase">Target Focus</span>
                    <span className="text-primary text-sm font-semibold">Thoracic Pathology Classifier</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-on-surface-variant/60 font-mono tracking-[0.12em] uppercase">Underlying Base</span>
                    <span className="text-primary text-sm font-semibold">DenseNet-121 / PyTorch Pipeline</span>
                  </div>
                </div>
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
                    className="bg-surface-container-lowest rounded-lg p-6 border border-white/5 hover:border-secondary-container/20 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
                  >
                    <div>
                      {/* Avatar initial */}
                      <div className="w-11 h-11 rounded-full p-[2px] bg-gradient-to-br from-secondary-fixed to-on-tertiary-container mb-4 flex items-center justify-center">
                        <div className="w-[38px] h-[38px] rounded-full bg-surface-container-high flex items-center justify-center text-primary font-bold font-mono text-[13px]">
                           {member.avatar}
                        </div>
                      </div>
                      
                      <h3 className="text-primary text-[17px] font-bold leading-tight">{member.name}</h3>
                      <span className="text-secondary-container text-[11px] font-mono tracking-wide mt-1 block">
                        {member.role}
                      </span>
                      <p className="text-[12px] text-on-surface-variant mt-2.5 leading-relaxed">
                        {member.gradTitle}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-6 pt-4 border-t border-white/5">
                      {member.skills.map((skill, si) => (
                        <span 
                          key={si}
                          className="px-2.5 py-1 bg-surface-container-high text-secondary-fixed/95 text-[10px] font-mono rounded-md transition-colors duration-200 hover:bg-secondary-container/20 hover:text-white"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
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
          <div className="flex items-center gap-2.5 font-headline-md text-headline-md font-bold text-primary tracking-tight shrink-0">
          <img 
  alt="Xynapse Logo" 
  className="w-[70px] h-[70px] object-contain" 
  src="/logo.png"
/>
            <span className="text-sm">Xynapse</span>
          </div>

          {/* Links list */}
          <div className="flex flex-wrap justify-center gap-5 text-on-surface-variant text-[11px] lowercase tracking-widest font-normal">
            <a className="hover:text-secondary-fixed transition-colors duration-200" href="#privacy">Privacy Policy</a>
            <a className="hover:text-secondary-fixed transition-colors duration-200" href="#terms">Terms of Service</a>
            <a className="hover:text-secondary-fixed transition-colors duration-200" href="#hipaa">HIPAA Compliance</a>
            <a className="hover:text-secondary-fixed transition-colors duration-200" href="#contact">Contact Support</a>
          </div>

          <div className="text-on-surface-variant text-center md:text-right max-w-[340px] text-[10px] leading-relaxed tracking-wider normal-case opacity-60 shrink-0">
            © 2025 Xynapse AI.<br />For clinical decision support only.<br />Not a primary diagnostic tool.
          </div>
        </div>
      </footer>
    </div>
  );
}
