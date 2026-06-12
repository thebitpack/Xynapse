import { Scan, TeamMember } from "../types";
import muneebImage from "../assets/muneeb.jpeg";
import talhaImage from "../assets/talha.jpg";
import ehsaanImage from "../assets/ehsaan.png";

// Base64 or standard SVG data of chest X-ray silhouettes to draw natively
export const LUNG_SVG_STENCIL = `<svg viewBox="0 0 400 400" className="w-full h-full opacity-40 text-surface-tint" fill="currentColor">
  <!-- Ribcage outline -->
  <path d="M100 80 C 100 80, 200 60, 300 80" stroke="currentColor" strokeWidth="3" fill="none" />
  <path d="M80 120 C 80 120, 200 90, 320 120" stroke="currentColor" strokeWidth="2" fill="none" />
  <path d="M60 160 C 60 160, 200 120, 340 160" stroke="currentColor" strokeWidth="2" fill="none" />
  <path d="M50 200 C 50 200, 200 150, 350 200" stroke="currentColor" strokeWidth="2" fill="none" />
  <path d="M50 250 C 50 250, 200 190, 350 250" stroke="currentColor" strokeWidth="2" fill="none" />
  <path d="M60 300 C 60 300, 200 240, 340 300" stroke="currentColor" strokeWidth="2" fill="none" />
  
  <!-- Spine -->
  <rect x="194" y="50" width="12" height="300" rx="3" fill="currentColor" opacity="0.15" />
  <line x1="194" y1="90" x2="206" y2="90" stroke="currentColor" strokeWidth="2" opacity="0.3" />
  <line x1="194" y1="130" x2="206" y2="130" stroke="currentColor" strokeWidth="2" opacity="0.3" />
  <line x1="194" y1="170" x2="206" y2="170" stroke="currentColor" strokeWidth="2" opacity="0.3" />
  <line x1="194" y1="210" x2="206" y2="210" stroke="currentColor" strokeWidth="2" opacity="0.3" />
  <line x1="194" y1="250" x2="206" y2="250" stroke="currentColor" strokeWidth="2" opacity="0.3" />
  <line x1="194" y1="290" x2="206" y2="290" stroke="currentColor" strokeWidth="2" opacity="0.3" />

  <!-- Lungs Left/Right -->
  <!-- Left Lung (Screen Left - Anatomical Right) -->
  <path d="M185 100 C 150 90, 100 130, 90 200 C 80 270, 110 320, 180 300 C 185 240, 185 160, 185 100 Z" fill="none" stroke="currentColor" strokeWidth="4" />
  <!-- Right Lung (Screen Right - Anatomical Left) -->
  <path d="M215 100 C 250 90, 300 130, 310 200 C 320 270, 290 320, 220 300 C 215 240, 215 160, 215 100 Z" fill="none" stroke="currentColor" strokeWidth="4" />

  <!-- Heart Silhouette -->
  <path d="M170 200 C 170 200, 200 240, 240 240 C 260 210, 240 180, 200 180 Z" fill="currentColor" opacity="0.2" />
  <path d="M170 200 C 170 200, 200 240, 240 240 C 260 210, 240 180, 200 180 Z" fill="none" stroke="currentColor" strokeWidth="2" />
  
  <!-- Effusion Shadow Left (Fluid level shading at bottom left lung) -->
  <path d="M90 200 C 85 240, 100 280, 140 295 C 130 260, 110 220, 90 200 Z" fill="currentColor" opacity="0.3" id="effusion-fluid-path" />
</svg>`;

export const LUNG_SVG_STENCIL_CARDIOMEGALY = `<svg viewBox="0 0 400 400" className="w-full h-full opacity-40 text-surface-tint" fill="currentColor">
  <!-- Spine -->
  <rect x="194" y="50" width="12" height="300" rx="3" fill="currentColor" opacity="0.15" />
  
  <!-- Lungs Left/Right -->
  <path d="M185 100 C 150 90, 100 130, 90 200 C 80 270, 110 320, 180 300 C 185 240, 185 160, 185 100 Z" fill="none" stroke="currentColor" strokeWidth="4" />
  <path d="M215 100 C 250 90, 300 130, 310 200 C 320 270, 290 320, 220 300 C 215 240, 215 160, 215 100 Z" fill="none" stroke="currentColor" strokeWidth="4" />

  <!-- Enlarged Heart Silhouette (Cardiomegaly) -->
  <path d="M160 190 C 150 220, 190 285, 260 280 C 285 230, 250 180, 200 170 Z" fill="currentColor" opacity="0.35" />
  <path d="M160 190 C 150 220, 190 285, 260 280 C 285 230, 250 180, 200 170 Z" fill="none" stroke="currentColor" strokeWidth="2.5" />
</svg>`;

export const LUNG_SVG_STENCIL_NORMAL = `<svg viewBox="0 0 400 400" className="w-full h-full opacity-40 text-surface-tint" fill="currentColor">
  <!-- Spine -->
  <rect x="194" y="50" width="12" height="300" rx="3" fill="currentColor" opacity="0.15" />
  
  <!-- Lungs Left/Right -->
  <path d="M185 100 C 150 90, 100 130, 90 200 C 80 270, 110 320, 180 300 C 185 240, 185 160, 185 100 Z" fill="none" stroke="currentColor" strokeWidth="3.5" />
  <path d="M215 100 C 250 90, 300 130, 310 200 C 320 270, 290 320, 220 300 C 215 240, 215 160, 215 100 Z" fill="none" stroke="currentColor" strokeWidth="3.5" />

  <!-- Normal Heart -->
  <path d="M175 200 C 175 200, 200 235, 230 235 C 245 210, 235 185, 200 185 Z" fill="currentColor" opacity="0.12" />
  <path d="M175 200 C 175 200, 200 235, 230 235 C 245 210, 235 185, 200 185 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
</svg>`;

export const PRESET_SCANS: Scan[] = [
  {
    id: "scan_1",
    patientName: "John Doe (Patient A)",
    fileName: "Patient_A_Thorax.png",
    fileSize: "14.2 MB",
    date: "Today, 09:41 AM",
    imageUrl: "pleural_effusion",
    findings: [
      {
        name: "Pleural Effusion",
        confidence: 0.894,
        location: {
          x: 18,
          y: 42,
          width: 32,
          height: 38
        },
        description: "Significant blunting of the left costophrenic angle indicating dense fluid accumulation.",
        severity: "Moderate"
      }
    ],
    summary: "Radiographic study of the chest demonstrates a moderate pleural effusion in the left lower hemithorax. Underlying parenchymal consolidation is not fully evaluated due to fluid density. Normal heart size. No evidence of pneumothorax.",
    recommendations: [
      "Correlate findings clinically with current patient symptoms (dyspnea, pleuritic pain).",
      "Echocardiographic testing optional to verify absence of cardiac etiology.",
      "Consider thoracic ultrasound or lateral decubitus radiograph if patient remains symptomatic."
    ],
    metrics: {
      acc: "94.7%",
      lat: "12ms"
    }
  },
  {
    id: "scan_2",
    patientName: "Robert Miller (Patient B)",
    fileName: "Patient_B_Cardio.png",
    fileSize: "18.5 MB",
    date: "Yesterday, 02:15 PM",
    imageUrl: "cardiomegaly",
    findings: [
      {
        name: "Cardiomegaly",
        confidence: 0.925,
        location: {
          x: 35,
          y: 32,
          width: 38,
          height: 40
        },
        description: "Transverse heart diameter is moderately enlarged, presenting a cardio-thoracic ratio > 0.58.",
        severity: "Severe"
      }
    ],
    summary: "Significant cardiomegly noted with lateral displacement of the cardiac apex. Mild pulmonary congestion without overt pleural effusions. Scoliosis of the thoracic spine is secondary.",
    recommendations: [
      "Immediate correlation with echocardiogram and clinical hemodynamic assessment.",
      "Evaluate chest pain or congestive symptoms immediately.",
      "Pharmacological monitoring of blood pressure or volume load indications is strongly suggested."
    ],
    metrics: {
      acc: "96.1%",
      lat: "15ms"
    }
  },
  {
    id: "scan_3",
    patientName: "Sarah Jenkins (Patient C)",
    fileName: "Patient_C_Healthy.png",
    fileSize: "12.8 MB",
    date: "2 days ago, 11:10 AM",
    imageUrl: "normal",
    findings: [],
    summary: "The lungs are clear, well-expanded, and free of focal consolidations, infiltrates, or nodules. Left and right costophrenic recesses are sharp and normal. Cardiac contour and size are unremarkable. Spine and osseous structures are intact.",
    recommendations: [
      "Routine follow-up or discharge from current imaging cycle. Normal findings."
    ],
    metrics: {
      acc: "98.5%",
      lat: "10ms"
    }
  }
];

export const TEAM_MEMBERS: TeamMember[] = [
  {
    name: "M Talha Khan",
    role: "Software & AI Engineer",
    avatar: "MT",
    rollNo: "62723",
    responsibilities: [
      "Frontend development",
      "Model improvements",
      "Code Optimization"
    ],
    image: talhaImage,
    linkedin: "https://www.linkedin.com/in/talhax/"
  },
  {
    name: "Muneeb Khan",
    role: "ML Engineer & AI Architecture",
    avatar: "MK",
    rollNo: "62799",
    responsibilities: [
      "Model integration",
      "Training & evaluation",
      "Data preprocessing"
    ],
    image: muneebImage,
    linkedin: "https://www.linkedin.com/in/muneeb-0-khan/"
  },
  {
    name: "M Ehsaan Bawany",
    role: "UI/UX & Documentation",
    avatar: "ME",
    rollNo: "62375",
    responsibilities: [
      "UI/UX design",
      "Documentation",
      "Report writing"
    ],
    image: ehsaanImage
  }
];

