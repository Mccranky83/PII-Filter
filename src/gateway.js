import express from 'express';
import dotenv from 'dotenv';
import { filterPII } from './pii-filter.js';
import { sendToLLM } from './llm-client.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

/**
 * POST /query
 * This endpoint acts as the primary interface for the privacy gateway.
 * It routes the incoming user prompt through the PII filter middleware,
 * forwards the securely redacted prompt to the Gemini LLM, and returns
 * the original prompt, the cleansed prompt, and the final AI response.
 */
app.post('/query', filterPII, async (req, res) => {
    try {
        const originalPrompt = req.body.prompt;
        const cleansedPrompt = req.processedPrompt;
        
        if (!originalPrompt) {
            return res.status(400).json({ error: 'Prompt is required in the request body' });
        }

        let llmResponse = null;
        try {
            llmResponse = await sendToLLM(cleansedPrompt);
            res.json({ 
                success: true, 
                originalPrompt: originalPrompt,
                cleansedPrompt: cleansedPrompt,
                result: llmResponse 
            });
        } catch (error) {
            console.error('Error sending to LLM:', error);
            res.json({ 
                success: false,
                originalPrompt: originalPrompt,
                cleansedPrompt: cleansedPrompt,
                error: 'LLM Failed, but PII was filtered.'
            });
        }
    } catch (error) {
        console.error('Error in /query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(port, () => {
    console.log(`Privacy-Preserving Gateway listening at http://localhost:${port}`);
});
