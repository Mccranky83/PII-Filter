# Privacy-Preserving Gateway for LLMs

**Project Members:** Annan Cai, Jiaxi Tian

## Project Overview
The Privacy-Preserving Gateway is an intermediary system that sits between users and cloud-based Large Language Models (LLMs). Before a user's prompt is ever transmitted to external AI providers (like Google's Gemini), this gateway automatically scans the text for sensitive information—including names, emails, API keys, medical data, and Social Security Numbers. It redacts this Personally Identifiable Information (PII) using a robust Context-Preserving Redaction mechanism. This ensures that users can leverage the power of cloud LLMs without risking the leakage of confidential or security-sensitive data.

## Architecture Map
Here is how a request flows through the Privacy-Preserving Gateway:

```text
[ User Input ]
      │
      ▼
[ Express Gateway (gateway.js) ] ─── Routes incoming POST /query requests.
      │
      ▼
[ PII Filter Middleware (pii-filter.js) ]
      │
      ├──▶ 1. Regex Engine (maskPatternPII)
      │       Scans for structured PII (SSNs, Phone #s, Emails, API Keys).
      │
      ├──▶ 2. Transformer (NER) Engine (maskEntityPII)
      │       Uses Hugging Face BERT to catch unstructured PII (Names, Orgs).
      │
      ▼
[ Redacted Prompt ] ─── E.g., "Hello, my name is [NAME_1]."
      │
      ▼
[ Gemini LLM Client (llm-client.js) ] ─── Sends secure prompt via @google/generative-ai.
      │
      ▼
[ LLM Response ]
      │
      ▼
[ User ]
```

## Folder Structure
*   **`src/`**: Contains the core backend logic.
    *   **`gateway.js`**: The main Express.js application file. It sets up the server, defines the routes (like `/query`), and manages the request/response lifecycle.
    *   **`pii-filter.js`**: The brains of the operation. Contains the "Double-Pass" privacy logic (Regex + NER) and acts as middleware.
    *   **`llm-client.js`**: A dedicated module that handles authentication and communication with the external Gemini API.
*   **`public/`**: Contains static assets served to the user.
    *   **`index.html`**: The frontend UI where users can type prompts and visualize the redaction process.
*   **`tests/`**: Contains automated scripts and mock data to verify system integrity.
    *   **`eval.js`**: An offline evaluation script that scores precision and recall.
    *   **`test-suite.js`**: An automated script that pushes synthetic prompts through the live gateway.
    *   **`test-ner.js`**: A script to isolate and test the BERT NER model.
    *   **`test-prompt.json`**: A JSON dataset containing synthetic prompts and their expected gold-standard redacted outputs.
*   **`.env`**: (Generated locally) Stores the `GEMINI_API_KEY`.

## Underlying Mechanisms: The "Double-Pass" System
To guarantee minimal PII leakage, the gateway employs a "Double-Pass" redaction system, utilizing two distinct technologies that complement each other's weaknesses:

1.  **Regex for Patterns:** Regular Expressions are extremely fast, highly precise, and computationally inexpensive. They are perfect for identifying structured data that follows rigid patterns, such as Emails, API Keys, and Social Security Numbers.
2.  **Transformers for Context:** Regex fails completely on unstructured data, like a person's name or a newly formed company, because names don't follow rigid character patterns. For this, we use a Transformer-based Named Entity Recognition (NER) model (`Xenova/bert-base-NER`). The AI evaluates the context of the sentence to deduce if a word represents a `Person` or an `Organization`.

By combining both, we achieve maximum security without sacrificing performance.
