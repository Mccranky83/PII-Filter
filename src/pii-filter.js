import { pipeline } from '@xenova/transformers';

let nerPipeline = null;

async function getNERPipeline() {
    if (!nerPipeline) {
        nerPipeline = await pipeline('token-classification', 'Xenova/bert-base-NER');
    }
    return nerPipeline;
}

/**
 * maskPatternPII
 * First pass of the privacy pipeline. Uses Regular Expressions (Regex) to 
 * detect and redact highly structured PII such as Social Security Numbers, 
 * Email Addresses, API Keys, and Phone Numbers. It uses Context-Preserving 
 * Redaction (e.g., [EMAIL_1], [EMAIL_2]) to help the LLM maintain syntactic context.
 */
export function maskPatternPII(text, mapContext = { counts: { SSN: 1, EMAIL: 1, API_KEY: 1, PHONE_NUMBER: 1 }, dict: {} }) {
    if (!text) return text;
    
    let redacted = text;
    
    // Helper for context mapping
    const replacer = (type) => (match) => {
        if (!mapContext.dict[match]) {
            mapContext.dict[match] = `[${type}_${mapContext.counts[type]++}]`;
        }
        return mapContext.dict[match];
    };
    
    // Redact SSN (Allow 3-2-3 or 3-2-4 digits)
    const ssnRegex = /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{3,4}\b/g;
    redacted = redacted.replace(ssnRegex, replacer('SSN'));
    
    // Redact Emails
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    redacted = redacted.replace(emailRegex, replacer('EMAIL'));
    
    // Redact API Keys (sk- or AIza)
    const apiKeyRegex = /\b(?:sk-[a-zA-Z0-9_]+|AIza[a-zA-Z0-9_\-]+)\b/g;
    redacted = redacted.replace(apiKeyRegex, replacer('API_KEY'));
    
    // Redact Phone numbers (including 7-digit local numbers)
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{3}[-.\s]?\d{4}\b/g;
    redacted = redacted.replace(phoneRegex, replacer('PHONE_NUMBER'));
    
    return redacted;
}

/**
 * maskEntityPII
 * Second pass of the privacy pipeline. Uses a Transformer-based Named Entity 
 * Recognition (NER) model to detect unstructured PII such as People's Names 
 * and Organizations. It reconstructs tokenized subwords and applies 
 * Context-Preserving Redaction (e.g., [NAME_1], [ORG_1]).
 */
export async function maskEntityPII(text, mapContext = { counts: { NAME: 1, ORG: 1 }, dict: {} }) {
    if (!text) return text;

    const ner = await getNERPipeline();
    const results = await ner(text);
    
    let currentEntity = null;
    let currentWord = '';
    const wordsToReplace = [];

    for (const result of results) {
        if (result.entity.startsWith('B-')) {
            if (currentEntity) {
                wordsToReplace.push({ entity: currentEntity, word: currentWord });
            }
            currentEntity = result.entity.substring(2); // 'PER', 'ORG'
            currentWord = result.word;
        } else if (result.entity.startsWith('I-')) {
            if (result.word.startsWith('##')) {
                currentWord += result.word.substring(2);
            } else {
                currentWord += ' ' + result.word;
            }
        }
    }
    if (currentEntity) {
        wordsToReplace.push({ entity: currentEntity, word: currentWord });
    }

    let cleansed = text;
    // Replace longer words first
    wordsToReplace.sort((a, b) => b.word.length - a.word.length);
    
    if(!mapContext.counts.NAME) mapContext.counts.NAME = 1;
    if(!mapContext.counts.ORG) mapContext.counts.ORG = 1;
    
    for (const item of wordsToReplace) {
        // Skip if this word happens to be something small like "SSN" caught as ORG
        if (item.word === 'SSN' || item.word === 'SS') continue;
        
        let entityType = item.entity === 'PER' ? 'NAME' : 'ORG';
        
        if (!mapContext.dict[item.word]) {
            mapContext.dict[item.word] = `[${entityType}_${mapContext.counts[entityType]++}]`;
        }
        
        cleansed = cleansed.replace(new RegExp(`\\b${item.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), mapContext.dict[item.word]);
    }
    
    return cleansed;
}

/**
 * cleansePrompt
 * Orchestrates the double-pass redaction strategy. It first scrubs pattern-based 
 * structured data, followed by entity-based unstructured data, returning a 
 * fully sanitized prompt ready for the LLM.
 */
export async function cleansePrompt(text) {
    const mapContext = { counts: { SSN: 1, EMAIL: 1, API_KEY: 1, PHONE_NUMBER: 1, NAME: 1, ORG: 1 }, dict: {} };
    let cleansed = maskPatternPII(text, mapContext);
    cleansed = await maskEntityPII(cleansed, mapContext);
    return cleansed;
}

/**
 * filterPII
 * Express middleware that intercepts the incoming request. It extracts the raw 
 * prompt, passes it through the cleansePrompt pipeline, and attaches the 
 * safe `processedPrompt` to the request object before passing control to the 
 * next handler.
 */
export async function filterPII(req, res, next) {
    console.log('Scanning for PII...');
    
    const prompt = req.body.prompt;
    if (prompt) {
        try {
            req.processedPrompt = await cleansePrompt(prompt);
        } catch (error) {
            console.error('Error during PII filtering:', error);
            return res.status(500).json({ error: 'Failed to process prompt for PII' });
        }
    }
    
    next();
}
