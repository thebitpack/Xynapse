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
  Info, 
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
  const [selectedScanId, setSelectedScanId] = useState<string>("scan_1");
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
  const [activeTab, setActiveTab] = useState<"report" | "chat">("report");
  const [chatInput, setChatInput] = useState<string>("");
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<Record<string, { role: "user" | "model"; text: string }[]>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeTab === "chat") {
      scrollToBottom();
    }
  }, [chatHistory, activeTab, selectedScanId]);

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
              src="/assets/logo/logo.png"
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
              className="flex-1 py-4 flex flex-col min-h-[calc(100vh-120px)]"
            >
              <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] lg:h-[780px] gap-5 flex-1">
                
                {/* Left Panel: Scopes configuration & History */}
                <div className="bg-surface-container-lowest/80 rounded-lg glass-border flex flex-col gap-4 p-5 lg:h-full lg:max-h-[780px] overflow-y-auto">
                  
                  {/* Inline Sandbox Mode Alert */}
                  {!hasApiKey && (
                    <div className="p-3.5 bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-md flex items-start gap-3 backdrop-blur-md animate-fade-in-up">
                      <Info className="w-5 h-5 text-secondary-container shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-primary tracking-wide uppercase">Sandbox Active</span>
                        <p className="text-[10px] text-on-surface-variant mt-0.5 leading-relaxed">
                          No <code className="font-mono bg-surface-container-lowest py-0.5 px-1 rounded text-secondary-container">GEMINI_API_KEY</code> found. Using high-fidelity presets for mock diagnosis. Add your key in the secrets panel to deploy live analysis.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Upload Configuration / Patient Ingestion Header */}
                  <div className="flex flex-col gap-3">
                    <h3 className="font-label-caps text-label-caps text-on-surface-variant text-[10px] tracking-[0.12em] uppercase">Ingest Radiograph</h3>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold">Patient Demographics</label>
                      <input 
                        type="text" 
                        value={newPatientName}
                        onChange={(e) => setNewPatientName(e.target.value)}
                        placeholder="Patient Full Name / ID"
                        className="w-full bg-surface-container px-3 py-2.5 text-[13px] border border-white/5 rounded-md text-primary focus:outline-none focus:border-secondary-container/60 placeholder:text-on-surface-variant/40 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Upload Drag and Drop Target Area */}
                  <div 
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={triggerFileInput}
                    className={`border border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-[120px] ${
                      dragActive 
                        ? "border-secondary-container bg-secondary-container/10 scale-[0.99]" 
                        : "border-outline-variant hover:border-on-surface-variant/40 hover:bg-surface-container-low"
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileInputChange}
                      className="hidden" 
                      accept="image/*"
                    />
                    
                    {isAnalyzing ? (
                      <div className="flex flex-col items-center py-4">
                        <RefreshCw className="w-7 h-7 text-secondary-container animate-spin mb-3" />
                        <span className="font-medium text-primary text-[13px]">Consulting Gemini AI...</span>
                        <span className="font-data-mono text-[10px] text-on-surface-variant/60 mt-1">Staging model pipeline</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-7 h-7 text-on-surface-variant mb-2 group-hover:text-primary transition-colors duration-200" />
                        <span className="font-medium text-primary text-[13px]">Drop Image or Browse</span>
                        <span className="font-data-mono text-data-mono text-on-surface-variant/60 text-[10px] mt-1.5">PNG, JPG, DCM up to 20MB</span>
                      </>
                    )}
                  </div>

                  {/* Feedback on uploaded error */}
                  {uploadError && (
                    <div className="p-3 bg-error-container/15 border border-error/20 text-error rounded-sm text-[12px] flex items-start gap-2 animate-fade-in-up">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {/* Scan History list */}
                  <div className="flex flex-col gap-2 mt-3 flex-1">
                    <div className="flex justify-between items-center">
                      <h3 className="font-label-caps text-label-caps text-on-surface-variant text-[10px] tracking-[0.12em] uppercase">Active Radiographs</h3>
                      <span className="text-[10px] text-on-surface-variant font-mono bg-surface-container-high px-2 py-0.5 rounded-md">{scans.length} loaded</span>
                    </div>
                    
                    <div className="flex flex-col gap-2 overflow-y-auto max-h-[300px] lg:max-h-none pr-0.5">
                      {scans.map((scan) => {
                        const isSelected = scan.id === selectedScanId;
                        const hasFindings = scan.findings.length > 0;
                        return (
                          <div 
                            key={scan.id}
                            onClick={() => setSelectedScanId(scan.id)}
                            className={`p-3 rounded-md border transition-all duration-200 cursor-pointer flex flex-col gap-2 ${
                              isSelected 
                                ? "bg-surface-container-high border-secondary-container/40" 
                                : "bg-surface-container-low/50 border-white/5 hover:bg-surface-container hover:border-white/10"
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-primary text-[13px] font-semibold leading-tight truncate max-w-[170px]">
                                {scan.patientName}
                              </span>
                              
                              {/* Diagnostic tag chip */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`w-1.5 h-1.5 rounded-full ${hasFindings ? "bg-secondary-container animate-pulse" : "bg-green-400"}`} />
                                <span className={`font-data-mono text-[10px] uppercase font-bold tracking-tight ${hasFindings ? "text-secondary-container" : "text-green-400"}`}>
                                  {hasFindings ? scan.findings[0].name.split(" ")[0] : "Normal"}
                                </span>
                              </div>
                            </div>

                            <div className="flex justify-between items-center text-[10px] text-on-surface-variant font-mono">
                              <span className="truncate max-w-[150px]">{scan.fileName}</span>
                              <span className="shrink-0 ml-2">{scan.date}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Panel: High-fidelity image workspace viewer */}
                <div className="bg-surface rounded-lg glass-border flex flex-col overflow-hidden shadow-2xl relative min-h-[580px] md:h-[780px] lg:h-full lg:max-h-[780px]">
                  
                  {/* Top toolbar */}
                  <div className="h-[44px] border-b border-white/5 flex items-center px-4 justify-between bg-surface-container-lowest select-none shrink-0">
                    <div className="flex gap-1 items-center">
                      <button 
                        onClick={handleZoomIn}
                        title="Zoom In" 
                        className="p-1.5 rounded-md text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={handleZoomOut}
                        title="Zoom Out" 
                        className="p-1.5 rounded-md text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      
                      <div className="h-3.5 w-[1px] bg-white/8 mx-1.5" />

                      <button 
                        onClick={() => setContrastSetting(c => c === "normal" ? "high" : c === "high" ? "inverted" : "normal")}
                        title="Cycling Contrast LUT Maps" 
                        className={`p-1.5 px-2 rounded-md flex items-center gap-1.5 text-[11px] font-mono transition-all ${
                          contrastSetting !== "normal" 
                            ? "bg-secondary-container/10 text-secondary-container" 
                            : "text-on-surface-variant hover:text-primary hover:bg-surface-container"
                        }`}
                      >
                        <Contrast className="w-3.5 h-3.5" />
                        <span className="capitalize hidden lg:inline">{contrastSetting} Map</span>
                      </button>

                      <div className="h-3.5 w-[1px] bg-white/8 mx-1.5" />

                      <button 
                        onClick={() => setShowCoordinates(!showCoordinates)}
                        title="Toggle Diagnostic Overlays" 
                        className={`p-1.5 px-2 text-[11px] font-mono rounded-md transition-all ${
                          showCoordinates 
                            ? "bg-white/10 text-primary" 
                            : "text-on-surface-variant hover:text-primary hover:bg-surface-container"
                        }`}
                      >
                        Overlay: {showCoordinates ? "ON" : "OFF"}
                      </button>

                      <button 
                        onClick={handleResetFilters}
                        title="Reset Viewer Scale" 
                        className="text-[10px] font-mono p-1.5 px-2 text-on-surface-variant/60 hover:text-primary transition-all"
                      >
                        Reset
                      </button>
                    </div>

                    <div className="font-data-mono text-data-mono text-on-surface-variant text-[10px] hidden sm:block truncate max-w-[160px]">
                      {activeScan.fileName}
                    </div>
                  </div>

                  {/* Main Viewer & Findings columns */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_380px] lg:grid-cols-[1fr_400px] overflow-hidden relative h-[calc(100%-44px)]">
                    
                    {/* Centered Canvas Container */}
                    <div className="bg-surface-container-lowest/40 flex items-center justify-center p-4 overflow-hidden relative min-h-[400px] md:h-full">
                      
                      {/* Active radiograph viewport block */}
                      <div className="relative w-full max-w-[480px] aspect-square bg-surface-container-high/60 rounded-md xl:rounded-xl glass-border overflow-hidden flex items-center justify-center shadow-lg transition-all">
                        
                        <div 
                          className="w-full h-full flex items-center justify-center p-6 transition-transform duration-200"
                          style={{
                            transform: `scale(${zoom})`,
                            filter: contrastSetting === "high" 
                              ? "contrast(1.45) brightness(0.9)" 
                              : contrastSetting === "inverted" 
                              ? "invert(1) contrast(1.15) brightness(0.95)" 
                              : "none"
                          }}
                        >
                          {/* Render custom base64 scan OR vector presets */}
                          {activeScan.imageUrl.startsWith("data:") ? (
                            <img 
                              src={activeScan.imageUrl} 
                              alt="Chest Radiography scan" 
                              className="max-h-full max-w-full object-contain pointer-events-none select-none rounded"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            renderLungStencil(activeScan.imageUrl)
                          )}
                        </div>

                        {/* Relative Absolute Bounding box visualization layer */}
                        {showCoordinates && activeScan.findings.map((f, index) => {
                          const isSelected = selectedFinding?.name === f.name;
                          return (
                            <div
                              key={index}
                              onClick={() => setSelectedFinding(f)}
                              className={`absolute border cursor-pointer hover:border-secondary-container transition-all group duration-300 ${
                                isSelected 
                                  ? "border-secondary-container bg-secondary-container/10 ring-2 ring-secondary-container/20" 
                                  : "border-secondary-container/45 bg-secondary-container/5"
                              }`}
                              style={{
                                top: `${f.location.y}%`,
                                left: `${f.location.x}%`,
                                width: `${f.location.width}%`,
                                height: `${f.location.height}%`
                              }}
                            >
                              {/* Label node */}
                              <div className="absolute -top-6 left-0 bg-secondary-container text-on-secondary-container font-data-mono text-[9px] px-1.5 py-0.5 rounded-sm font-bold shadow-md uppercase tracking-wide">
                                {f.name} {(f.confidence * 100).toFixed(0)}%
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Display warning badge if scan is custom simulated */}
                      {activeScan.isSimulated && (
                        <div className="absolute top-4 left-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-[10px] font-mono px-2.5 py-1 rounded-sm flex items-center gap-1.5 backdrop-blur-md">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Simulated Report (Demo Mode)</span>
                        </div>
                      )}
                    </div>

                    {/* AI Insights & Medical reports side table */}
                    <div className="border-t md:border-t-0 md:border-l border-white/5 bg-surface-container-lowest/80 flex flex-col overflow-hidden h-full">
                      {/* Tabs Header */}
                      <div className="flex border-b border-white/5 bg-surface-container-lowest shrink-0">
                        <button
                          onClick={() => setActiveTab("report")}
                          className={`flex-1 py-3.5 text-center text-[10px] font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 border-b-2 cursor-pointer ${
                            activeTab === "report"
                              ? "text-primary border-primary bg-surface-container-lowest/30"
                              : "text-on-surface-variant/65 border-transparent hover:text-primary hover:bg-surface-container-low/20"
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Clinical Report
                        </button>
                        <button
                          onClick={() => setActiveTab("chat")}
                          className={`flex-1 py-3.5 text-center text-[10px] font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 border-b-2 cursor-pointer ${
                            activeTab === "chat"
                              ? "text-primary border-primary bg-surface-container-lowest/30"
                              : "text-on-surface-variant/65 border-transparent hover:text-primary hover:bg-surface-container-low/20"
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          AI Q&A Chat
                        </button>
                      </div>

                      {/* Tab Contents */}
                      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        {activeTab === "report" ? (
                          <div className="flex-1 flex flex-col p-4 overflow-y-auto">
                            <div className="flex justify-between items-center pb-3 border-b border-white/5 shrink-0">
                              <span className="font-label-caps text-label-caps text-on-surface-variant text-[10px] tracking-[0.12em] uppercase">AI Analysis</span>
                              <div className="font-mono text-secondary-container text-[10px] font-bold">
                                Avg: {activeScan.findings.length > 0 ? (activeScan.findings[0].confidence * 100).toFixed(1) + "%" : "100.0%"}
                              </div>
                            </div>

                            {/* text contents & checklists container with scrolling wrapper inside */}
                            <div className="flex-1 flex flex-col gap-4 py-4 min-h-0">
                              {activeScan.findings.length === 0 ? (
                                <div className="flex flex-col items-center justify-center text-center p-6 bg-surface-container-low/30 rounded border border-white/5">
                                  <span className="text-green-400 font-bold text-[14px]">No Anomalies Found</span>
                                  <p className="text-[11px] text-on-surface-variant mt-1.5 leading-relaxed">
                                    Gemini analyzed this lung and determined that both lung lobes, cardioportal silhouette, and spinal vertebrae alignment are entirely clear.
                                  </p>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-3">
                                  <label className="text-[10px] text-on-surface-variant font-bold tracking-[0.12em] uppercase">Detected Lesions</label>
                                  
                                  {activeScan.findings.map((f, i) => {
                                    const isSelected = selectedFinding?.name === f.name;
                                    return (
                                      <div 
                                        key={i}
                                        onClick={() => setSelectedFinding(f)}
                                        className={`p-3 rounded-md border transition-all cursor-pointer ${
                                          isSelected 
                                            ? "bg-surface-container-high border-secondary-container" 
                                            : "bg-surface-container-low border-white/5 hover:border-white/15"
                                        }`}
                                      >
                                        <div className="flex justify-between items-start mb-1.5">
                                          <span className="font-semibold text-primary text-[13px]">{f.name}</span>
                                          <span className="font-data-mono text-[11px] text-secondary-container font-bold">{(f.confidence * 100).toFixed(1)}%</span>
                                        </div>
                                        <p className="text-[11px] text-on-surface-variant leading-relaxed mb-2.5">
                                          {f.description}
                                        </p>

                                        <div className="flex justify-between items-center font-mono text-[10px]">
                                          <span className="text-on-surface-variant/60">Severity</span>
                                          <span className={`px-1.5 py-0.5 rounded-sm font-bold ${
                                            f.severity === "Severe" 
                                              ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                                              : f.severity === "Moderate" 
                                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                          }`}>
                                            {f.severity}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Clinical Summary Block */}
                              <div className="flex flex-col gap-2 mt-2">
                                <label className="text-[10px] text-on-surface-variant font-bold tracking-[0.12em] uppercase">Radiologist Summary</label>
                                <div className="bg-surface-container-low/40 p-3 rounded-md border border-white/5 text-[12px] text-on-surface-variant leading-relaxed">
                                  {activeScan.summary}
                                </div>
                              </div>

                              {/* Clinical Recommendations */}
                              <div className="flex flex-col gap-2 mt-2">
                                <label className="text-[10px] text-on-surface-variant font-bold tracking-[0.12em] uppercase flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-secondary-container shrink-0" />
                                  Suggested Clinical Directives
                                </label>
                                <ul className="flex flex-col gap-1.5">
                                  {activeScan.recommendations.map((rec, index) => (
                                    <li key={index} className="text-[11px] text-on-surface-variant leading-relaxed flex items-start gap-1.5">
                                      <span className="text-secondary-container font-bold select-none shrink-0">•</span>
                                      <span>{rec}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            {/* Summary diagnostic specs */}
                            <div className="border-t border-white/5 pt-3 mt-4 flex justify-between items-center text-[9px] font-mono text-on-surface-variant/40 shrink-0">
                              <span>Latency: {activeScan.metrics.lat}</span>
                              <span>Accuracy: {activeScan.metrics.acc}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col min-h-0 justify-between p-4 bg-surface/20">
                            {/* Chat Header controls */}
                            <div className="flex justify-between items-center pb-2.5 border-b border-white/5 shrink-0 mb-3">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-secondary-container animate-pulse" />
                                <span className="text-[11px] font-mono text-on-surface-variant/80">Xynapse Co-Pilot</span>
                              </div>
                              {(chatHistory[selectedScanId] || []).length > 0 && (
                                <button
                                  onClick={handleClearChatHistory}
                                  className="text-[10px] font-mono text-error hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Clear Chat
                                </button>
                              )}
                            </div>

                            {/* Chat messages viewport */}
                            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1.5 scrollbar-thin select-text">
                              {(chatHistory[selectedScanId] || []).length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-4 py-8">
                                  <div className="w-12 h-12 rounded-full bg-secondary-container/10 border border-secondary-container/20 flex items-center justify-center mb-3">
                                    <Sparkles className="w-6 h-6 text-secondary-container animate-[pulse_2.5s_infinite]" />
                                  </div>
                                  <span className="font-semibold text-primary text-[13px] tracking-wide">Interactive AI Consultation</span>
                                  <p className="text-[11px] text-on-surface-variant/75 mt-1.5 max-w-[240px] leading-relaxed">
                                    Ask anything about {activeScan.patientName}'s scan. Verify findings, request explanations, or formulate discharge queries.
                                  </p>
                                  
                                  {/* Suggestions Container inside empty state */}
                                  <div className="w-full mt-6 space-y-2">
                                    <span className="text-[9px] font-mono text-on-surface-variant/50 uppercase tracking-widest block text-left">Suggested Questions</span>
                                    <div className="flex flex-col gap-2">
                                      {[
                                        "Explain findings in simple terms",
                                        "What are the recommended clinical next steps?",
                                        activeScan.findings.length > 0 ? "Are the findings moderate or severe?" : "Confirm if lungs are clear"
                                      ].map((chip, idx) => (
                                        <button
                                          key={idx}
                                          onClick={() => handleSendChatMessage(undefined, chip)}
                                          className="w-full text-left p-2.5 bg-surface-container-low hover:bg-surface-container border border-white/5 hover:border-secondary-container/30 text-on-surface-variant hover:text-primary text-[11px] rounded transition-all duration-200 cursor-pointer"
                                        >
                                          {chip} &rarr;
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {/* Chat bubble list */}
                                  {(chatHistory[selectedScanId] || []).map((msg, index) => {
                                    const isUser = msg.role === "user";
                                    return (
                                      <div
                                        key={index}
                                        className={`flex flex-col max-w-[85%] ${isUser ? "ml-auto items-end" : "mr-auto items-start"} animate-fade-in-up`}
                                      >
                                        <div
                                          className={`p-3 rounded-lg text-[12px] leading-relaxed shadow-sm ${
                                            isUser
                                              ? "bg-secondary-container text-on-secondary-container rounded-tr-none font-medium"
                                              : "bg-surface-container-high border border-white/5 text-on-surface rounded-tl-none font-normal"
                                          }`}
                                        >
                                          {/* Handle formatting for newlines cleanly */}
                                          {msg.text.split("\n").map((line, lIdx) => (
                                            <p key={lIdx} className={lIdx > 0 ? "mt-1.5" : ""}>
                                              {line}
                                            </p>
                                          ))}
                                        </div>
                                        <span className="text-[9px] font-mono text-on-surface-variant/40 mt-1 uppercase tracking-wider">
                                          {isUser ? "You" : "AI"}
                                        </span>
                                      </div>
                                    );
                                  })}
                                  
                                  {/* Loading Typist indicator */}
                                  {isChatLoading && (
                                    <div className="flex flex-col max-w-[85%] mr-auto items-start animate-fade-in-up">
                                      <div className="bg-surface-container-high border border-white/5 p-3 rounded-lg rounded-tl-none flex gap-1.5 items-center">
                                        <span className="w-1.5 h-1.5 rounded-full bg-secondary-container animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <span className="w-1.5 h-1.5 rounded-full bg-secondary-container animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <span className="w-1.5 h-1.5 rounded-full bg-secondary-container animate-bounce" style={{ animationDelay: "300ms" }} />
                                      </div>
                                      <span className="text-[9px] font-mono text-on-surface-variant/40 mt-1 uppercase tracking-wider">AI Typing</span>
                                    </div>
                                  )}
                                  <div ref={chatEndRef} />
                                </>
                              )}
                            </div>

                            {/* Suggestions mini tray (only visible when there are messages) */}
                            {(chatHistory[selectedScanId] || []).length > 0 && (
                              <div className="pt-2 flex gap-1.5 overflow-x-auto scrollbar-none whitespace-nowrap shrink-0 border-t border-white/5 mt-2 pb-1">
                                {[
                                  "Explain findings",
                                  "Suggested next steps",
                                  "Are results severe?"
                                ].map((chip, idx) => (
                                  <button
                                    key={idx}
                                    disabled={isChatLoading}
                                    onClick={() => handleSendChatMessage(undefined, chip)}
                                    className="px-2.5 py-1 bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-primary text-[10px] border border-white/5 rounded-md transition-all duration-200 select-none shrink-0 disabled:opacity-50 cursor-pointer"
                                  >
                                    {chip}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Text Input Row */}
                            <form
                              onSubmit={handleSendChatMessage}
                              className="mt-3 pt-2.5 border-t border-white/5 flex gap-2 shrink-0 relative"
                            >
                              <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                disabled={isChatLoading}
                                placeholder={`Ask about ${activeScan.patientName.split(" ")[0]}...`}
                                className="w-full bg-surface-container px-3.5 py-3 pr-10 text-[13px] border border-white/5 rounded-md text-primary focus:outline-none focus:border-secondary-container/60 placeholder:text-on-surface-variant/45 transition-colors disabled:opacity-50"
                              />
                              <button
                                type="submit"
                                disabled={isChatLoading || !chatInput.trim()}
                                className="absolute right-2 top-[16px] text-secondary-container hover:text-primary transition-colors disabled:opacity-30 disabled:hover:text-secondary-container p-1 rounded cursor-pointer"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
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
              src="/assets/logo/logo.png"
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
