import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
const pdfParse = require('pdf-parse');

dotenv.config();

// Use the correct syntax for the @google/genai SDK
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});

export const analyzeDocument = async (fileBuffer: Buffer, fileName: string, mimeType: string) => {
  try {
    let textContent = `Filename: ${fileName}\n\n`;

    // Basic text extraction for prompt
    if (mimeType === 'application/pdf') {
      try {
        const data = await pdfParse(fileBuffer);
        textContent += data.text.substring(0, 10000);
      } catch (e) {
        console.error('Failed to parse PDF:', e);
      }
    } else if (mimeType === 'text/plain') {
      textContent += fileBuffer.toString('utf-8').substring(0, 10000);
    } else {
      textContent += '(Content not parsed, rely on filename for date extraction if applicable)';
    }

    const prompt = `
      Analyze the following document text and filename.
      Extract a "date_valeur" (value date, e.g., meeting date, contract date) if present in the text or filename. Format the date as YYYY-MM-DD. If no date is found, return null.
      Also, generate a short description (1-2 sentences) of the document.

      Text:
      ${textContent}

      Return a JSON object with this exact structure:
      {
        "date_valeur": "YYYY-MM-DD" | null,
        "description": "Short description here"
      }
    `;

    // Update generateContent call to match the newer SDK structure
    const result = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
      throw new Error('No response text from Gemini');
    }
    
    // Attempt to extract JSON from the response text in case it's wrapped in markdown
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : responseText;
    
    const parsed = JSON.parse(cleanJson);
    return {
      date_valeur: parsed.date_valeur || new Date().toISOString().split('T')[0],
      description: parsed.description || 'No description available.',
    };
  } catch (error) {
    console.error('Error analyzing document with Gemini 3 Pro:', error);
    return {
      date_valeur: new Date().toISOString().split('T')[0],
      description: 'Analysis failed or unsupported format.',
    };
  }
};
