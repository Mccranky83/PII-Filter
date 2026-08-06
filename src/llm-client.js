import { GoogleGenerativeAI } from '@google/generative-ai';

export async function sendToLLM(prompt) {
    console.log('Sending cleansed prompt to Gemini LLM:', prompt);
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
}
