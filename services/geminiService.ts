import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ImageSource, VisionModel } from "../types";

export const editImage = async (
  source: ImageSource,
  prompt: string,
  tier: VisionModel = 'standard'
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = tier === 'studio' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          {
            inlineData: {
              data: source.base64.split(',')[1],
              mimeType: source.mimeType,
            },
          },
          {
            text: `VINTAGE 80S TRANSFORMATION: ${prompt}. Essential: Maintain the person's identity and facial features from the original photo. Apply heavy 80s film aesthetics: warm golden glow, film grain, soft focus, and cinematic lighting.`,
          },
        ],
      },
      config: tier === 'studio' ? {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      } : undefined
    });

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("The vintage lens failed to capture a response. Please try again.");
    }

    const candidate = response.candidates[0];
    if (candidate.finishReason === 'SAFETY') {
      throw new Error("SAFETY_ERROR");
    }

    let generatedImageUrl: string | null = null;
    
    if (candidate.content && candidate.content.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          generatedImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!generatedImageUrl) {
      throw new Error("The AI couldn't develop this specific frame. Try a simpler prompt or a clearer reference photo.");
    }

    return generatedImageUrl;
  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    const msg = error.message || "";
    
    if (msg.includes("429") || msg.includes("rate limit")) throw new Error("RATE_LIMIT_ERROR");
    if (msg.includes("quota") || msg.includes("billing")) throw new Error("QUOTA_ERROR");
    if (msg.includes("key") || msg.includes("AUTH")) throw new Error("AUTH_ERROR");
    if (msg.includes("safety")) throw new Error("SAFETY_ERROR");

    throw new Error(msg || "An unexpected error occurred during the chemical development of your photo.");
  }
};