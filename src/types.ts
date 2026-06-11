export type ActiveSection = "home" | "analysis" | "team" | "about";

export interface Finding {
  name: string;
  confidence: number;
  location: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  description: string;
  severity: "Normal" | "Mild" | "Moderate" | "Severe";
}

export interface Scan {
  id: string;
  patientName: string;
  fileName: string;
  fileSize: string;
  date: string;
  imageUrl: string;
  findings: Finding[];
  summary: string;
  recommendations: string[];
  metrics: {
    acc: string;
    lat: string;
  };
  isSimulated?: boolean;
}

export interface TeamMember {
  name: string;
  role: string;
  avatar: string;
  gradTitle: string;
  skills: string[];
}
