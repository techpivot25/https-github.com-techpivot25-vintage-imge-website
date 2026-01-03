
export interface GenerationState {
  isGenerating: boolean;
  error: string | null;
  resultImage: string | null;
}

export interface ImageSource {
  base64: string;
  mimeType: string;
}

export interface User {
  email: string;
  credits: number;
  isLoggedIn: boolean;
  isPro: boolean;
  history: string[];
}

export type VisionModel = 'standard' | 'studio';
