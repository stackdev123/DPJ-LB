import { GoogleGenAI } from "@google/genai";
import { LedgerRow } from "../types";

// Note: In a production app, this would be a backend proxy.
// For this demo, we assume process.env.API_KEY is available.
// If not, we return a mock response to ensure the UI doesn't crash.

export const analyzeLedger = async (data: LedgerRow[]): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key not found. Please configure process.env.API_KEY to use AI insights. (Mock: Business looks stable, mortality rates are within acceptable margins.)";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Prepare a summarized text representation of the data to save tokens
    const summary = data.slice(0, 50).map(row => 
      `Date: ${row.date}, Customer: ${row.customer}, Driver: ${row.driver}, Sold: ${row.soldKg}kg, Dead: ${row.mortalityKg}kg, Unpaid: ${row.remainingBalance}`
    ).join('\n');

    const prompt = `
      You are an expert poultry trading business analyst. Analyze the following transaction data for a Live Bird trading system.
      
      Data Snippet:
      ${summary}
      
      Please provide:
      1. A brief summary of total sales volume.
      2. Identification of any drivers or customers with unusually high mortality rates (high dead kg).
      3. A comment on the Accounts Receivable (Piutang) situation.
      4. One actionable recommendation to improve profit.
      
      Keep it concise (max 200 words). Use Markdown formatting.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No insights generated.";

  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to generate AI insights at this time.";
  }
};