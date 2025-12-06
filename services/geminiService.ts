import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { GenerationPlan, Scenario } from '../types';

// Helper to convert blob to base64
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:image/jpeg;base64,") for API usage
      // Check if it has a prefix first
      if (base64String.includes(',')) {
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      } else {
        resolve(base64String);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Phase 1: Analyze the uploaded image and generate a plan (prompts).
 * We use gemini-2.5-flash for fast reasoning and JSON output.
 */
export const analyzeAndPlanSession = async (
  imageBase64: string,
  imageMimeType: string,
  count: number,
  genderPreference: string,
  outfitStyle: string = 'sexy'
): Promise<GenerationPlan> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Define instruction set based on selected style
  let styleInstruction = "";
  
  if (outfitStyle === 'formal') {
    styleInstruction = `
      - **OUTFIT RULES**: STRICTLY FORMAL, ELEGANT, and PROFESSIONAL.
      - **For Men**: Tuxedos, tailored suits, white tie, black tie, business professional.
      - **For Women**: Evening gowns, cocktail dresses, elegant power suits, structured blazers, silk blouses.
      - **Vibe**: Sophisticated, Gala, Red Carpet, Corporate Executive, High-end Dinner.
      - NO casual wear, no jeans, no sneakers.
    `;
  } else if (outfitStyle === 'casual') {
    styleInstruction = `
      - **OUTFIT RULES**: STYLISH CASUAL, STREETWEAR, and EVERYDAY FASHION.
      - **Items**: Denim jackets, fitted jeans, oversized hoodies, crop tops, leather jackets, knitwear, summer dresses, chic streetwear.
      - **Vibe**: Urban, Relaxed, Coffee Run, Travel, Influencer Lifestyle, Cozy.
      - NO formal suits, no tuxedos.
    `;
  } else if (outfitStyle === 'sexy') {
    styleInstruction = `
      - **OUTFIT RULES**: STRICTLY "BOLD" & "HOT" FASHION (+18 Style).
      - **Female Subjects**: MUST be styled in "mini dress", "micro mini skirt", "fishnet dress", "sheer overlays", "latex", or "plunging necklines".
      - **Male Subjects**: Unbuttoned shirts, shirtless with leather jackets, fitted muscle shirts.
      - **Vibe**: High-fashion editorial, Sultry, Provocative, Nightlife, Avant-garde, Daring.
    `;
  } else {
    // Fallback/Auto
    styleInstruction = `
       - **OUTFIT RULES**: Create a diverse mix of styles (Business, Casual, and Artistic).
    `;
  }

  const prompt = `
    Analyze the provided image of a person.
    1. Provide a concise but detailed physical description (face, hair, build, age estimate, ethnicity) to ensure identity consistency.
    2. Generate ${count} distinct, professional fashion editorial scenarios for this person.
    
    The goal is to create a diverse portfolio of the SAME person in different "character" styles.
    
    CRITICAL REQUIREMENTS:
    1. **FULL BODY**: Every single scenario MUST specify a "Full body shot" pose.
    2. **DIVERSITY**: Vary the styling significantly. Change the hairstyle, makeup, accessories and vibe.
    3. **SELECTED STYLE**:
    ${styleInstruction}
    
    If gender preference is '${genderPreference}' (and not auto), ensure the gender matches.
    
    Return JSON.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { inlineData: { mimeType: imageMimeType, data: imageBase64 } },
        { text: prompt }
      ]
    },
    config: {
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          physicalDescription: { type: Type.STRING, description: "Detailed physical description of the person" },
          scenarios: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                outfit: { type: Type.STRING },
                location: { type: Type.STRING },
                lighting: { type: Type.STRING },
                pose: { type: Type.STRING },
                styleName: { type: Type.STRING, description: "Short title for this style (e.g. 'Neon Cyberpunk')" }
              },
              required: ["outfit", "location", "lighting", "pose", "styleName"]
            }
          }
        },
        required: ["physicalDescription", "scenarios"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Failed to generate plan");
  
  return JSON.parse(text) as GenerationPlan;
};

/**
 * Phase 2: Generate a single image based on the reference and the specific scenario.
 * We use gemini-2.5-flash-image for reliable access and multimodal generation.
 */
export const generateSingleImage = async (
  referenceImageBase64: string,
  imageMimeType: string,
  scenario: Scenario,
  physicalDescription: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Prompt Engineering for Identity Preservation & High Quality
  const prompt = `
    Professional high-fashion editorial photography, Vogue magazine style cover shot.
    Captured with an 85mm prime lens at f/1.8 for cinematic depth of field.
    
    Subject: ${physicalDescription}.
    
    CRITICAL INSTRUCTIONS: 
    1. **Identity**: Preserve the facial identity of the reference image exactly.
    2. **Framing**: GENERATE A FULL BODY SHOT from head to toe, including shoes.
    
    Scenario:
    - Outfit: ${scenario.outfit} (Rendered with intricate fabric details and high-fashion aesthetics)
    - Location: ${scenario.location}
    - Lighting: ${scenario.lighting}
    - Pose: ${scenario.pose}, confident full body stance or stride.
    
    Visual Style Keywords:
    Hyper-realistic, 8k resolution, highly detailed skin texture, sharp focus on eyes, volumetric lighting, color grading, masterpiece, award-winning photography.
    
    Ensure the result is a professional, artistic fashion portrait.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: imageMimeType, data: referenceImageBase64 } }
        ]
      },
      config: {
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
        imageConfig: {
          aspectRatio: "9:16", // 9:16 is better for full body shots
        }
      }
    });

    // Check if the response was blocked
    if (response.promptFeedback?.blockReason) {
       console.error("Generation blocked:", response.promptFeedback.blockReason);
       throw new Error(`Generation blocked by safety filters: ${response.promptFeedback.blockReason}`);
    }

    // Extract image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    // Check for text refusal in the candidate
    const textPart = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (textPart) {
        console.error("Model refused with text:", textPart);
        throw new Error(`Model refused the request: ${textPart}`);
    }
    
    throw new Error("No image data returned. The model may have refused the request.");
  } catch (error) {
    console.error("Generation error details:", error);
    throw error;
  }
};