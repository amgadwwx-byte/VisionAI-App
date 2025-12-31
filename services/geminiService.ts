
import { GoogleGenAI } from "@google/genai";
import { DesignConfig, DesignType } from "../types";

export const generateDesign = async (config: DesignConfig): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let internalPrompt = '';
  
  if (config.type === DesignType.LOGO) {
    internalPrompt = `Design a clean, professional logo. 
      Business description: ${config.prompt}. 
      Logo style: ${config.style}, scalable, vector-friendly, centered composition.
      Color theme: ${config.colorPalette || 'professional branding colors'}.
      Background: White or transparent-friendly. No mockups, no 3D walls, no text unless essential.
      High contrast, iconic quality.`;
  } else {
    internalPrompt = `Create a high-quality professional ${config.type} in ${config.style} style. 
      Subject: ${config.prompt}. 
      Color theme: ${config.colorPalette || 'visually appealing palette'}. 
      Ensure high resolution, clear details, and professional composition for ${config.aspectRatio}.
      No watermarks.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: internalPrompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: config.aspectRatio,
        },
      },
    });

    const results: string[] = [];
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        results.push(`data:image/png;base64,${part.inlineData.data}`);
      }
    }

    if (results.length === 0) throw new Error("No image was generated");
    return results;
  } catch (error) {
    console.error("Gemini Image Generation Error:", error);
    throw error;
  }
};

export const removeBackground = async (imageBase64: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: 'image/png' } },
          { text: "Remove the background from this image precisely. Return only the subject with a transparent background." },
        ],
      },
    });

    let imageUrl = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
    return imageUrl || imageBase64;
  } catch (error) {
    console.error("Background Removal Error:", error);
    return imageBase64;
  }
};

export const upscaleImage = async (imageBase64: string, prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: 'image/png' } },
          { text: `Enhance and upscale this image. Increase sharpness, detail, and quality while maintaining the original design.` },
        ],
      },
    });

    let imageUrl = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
    return imageUrl || imageBase64;
  } catch (error) {
    console.error("Upscale Error:", error);
    return imageBase64;
  }
};

export const removeTextAndWatermarks = async (imageBase64: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: 'image/png' } },
          { text: "Remove ALL Arabic and English text overlays, watermarks, and floating labels from this image. Inpaint the resulting gaps to match the surrounding background naturally. Return the cleaned image without any visible text overlays." },
        ],
      },
    });

    let imageUrl = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
    return imageUrl || imageBase64;
  } catch (error) {
    console.error("Text Removal Error:", error);
    return imageBase64;
  }
};

export const customImageEdit = async (imageBase64: string, customPrompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: 'image/png' } },
          { text: `Modify this image based on the following instruction: "${customPrompt}". Preserve the original style, lighting, and composition as much as possible, focusing only on the requested change.` },
        ],
      },
    });

    let imageUrl = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
    return imageUrl || imageBase64;
  } catch (error) {
    console.error("Custom AI Edit Error:", error);
    return imageBase64;
  }
};
