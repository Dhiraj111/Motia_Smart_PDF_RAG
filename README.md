# 🤖 Smart PDF Assistant (with Salesforce Automation)

An intelligent, full-stack AI agent that doesn't just read PDFs—it acts on them.

This project demonstrates an **Agentic Workflow** where users can upload a resume, chat with it using RAG (Retrieval-Augmented Generation), and automatically extract structured data to create Leads in Salesforce CRM without a single click.

## ✨ Features

- **📄 Smart PDF Ingestion:** Handles large PDF uploads via chunking and extracts raw text.
- **🧠 RAG Chatbot:** Uses **Pinecone** vector database and **Llama 3 (Groq)** to answer questions based *strictly* on the document content.
- **🔍 Auto-Extraction:** Automatically parses resumes to identify Name, Email, Company, and Summary using AI.
- **☁️ Salesforce Integration:**
  - **Zero-Click Automation:** Detects valid emails and auto-creates a **Lead** in Salesforce.
  - **OAuth 2.0:** Secure authentication using Refresh Tokens.
- **⚡ High Performance:** Built on **Motia**, enabling fast, serverless-style step execution.

## 🛠️ Tech Stack

- **Frontend:** React (Vite), Tailwind CSS
- **Backend/Framework:** Node.js, [Motia](https://motia.dev) (AI Agent Framework)
- **AI Models:**
  - **LLM:** Llama 3.3 70B (via Groq API)
  - **Embeddings:** Xenova/all-MiniLM-L6-v2 (Local, ONNX-based)
- **Database:** Pinecone (Vector DB)
- **Integration:** Salesforce REST API
- **Tools:** PDF-Parse, Axios, Dotenv

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- A Salesforce Developer Account
- API Keys for Groq and Pinecone

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone <your-repo-url>
cd smart-pdf-assistant
npm install
```

### 3. Environment Setup

Create a .env file in the root directory.

# AI Services
GROQ_API_KEY=gsk_...
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX=your-index-name

# Salesforce Configuration
SALESFORCE_CLIENT_ID=...
SALESFORCE_CLIENT_SECRET=...
SALESFORCE_REFRESH_TOKEN=...
SALESFORCE_INSTANCE_URL=[https://your-domain.my.salesforce.com](https://your-domain.my.salesforce.com)

## 4. Running the App

Start the backend development server:

```bash
npm run dev
```

The server will start on http://localhost:3000 (or the port defined in Motia).

Start the Frontend (in a separate terminal):

```bash
cd frontend
npm run dev
```

## 🔐 How to Authenticate with Salesforce

This project uses the OAuth 2.0 Web Server Flow to get a permanent REFRESH_TOKEN so the backend can log in automatically.

Step 1: Create a Connected App
Log in to Salesforce Setup.

Go to App Manager -> New Connected App.

Name: "Motia Integration" (or similar).

Contact Email: Your email.

Enable OAuth Settings: Check this box.

Callback URL: https://oauth.pstmn.io/v1/callback (If using Postman) or http://localhost:3000/callback.

Selected OAuth Scopes: Add Manage user data via APIs (api) and Perform requests on your behalf at any time (refresh_token, offline_access).

Save. Note your Consumer Key (Client ID) and Consumer Secret (Client Secret).

Step 2: Get the Authorization Code
Paste this URL into your browser (replace values with yours):

```bash
https://<YOUR_INSTANCE>[.my.salesforce.com/services/oauth2/authorize?client_id=](https://.my.salesforce.com/services/oauth2/authorize?client_id=)<YOUR_CLIENT_ID>&redirect_uri=<YOUR_CALLBACK_URL>&response_type=code
```

Log in and click "Allow". The browser will redirect you to a URL with a code= parameter at the end. Copy this code.

Step 3: Get the Refresh Token
Use curl or Postman to make a POST request:

POST https://login.salesforce.com/services/oauth2/token

Body (x-www-form-urlencoded):

grant_type: authorization_code

client_id: YOUR_CLIENT_ID

client_secret: YOUR_CLIENT_SECRET

redirect_uri: YOUR_CALLBACK_URL

code: CODE_FROM_STEP_2

The response will contain your refresh_token. Add this to your .env file!

```bash
├── client/src
│   └──  App.css     
│   └──  App.tsx
│   └──  index.css
│   └──  main.tsx
│     
├── steps/
│   ├── upload.step.ts     # API: Receives chunks & emits 'file.uploaded'
│   ├── chat.step.ts       # API: Search Pinecone & query Groq
│   ├── ingest_step.py     # WORKER: Listens for events, embeds PDF
│   └── frontend.step.ts   # API: Serves the HTML UI
│   └── salesforce.step.ts # Salesforce integration
│   └── status.step.ts     # Polling operation for status check
│ 
├── uploads/              # Local storage for PDF files
├── .env                  # API Keys
└── package.json
```

## 🔗 How It Works (The Agentic Flow)

Upload: User uploads a PDF via the React UI.

Vectorization: The backend chunks the text, creates embeddings locally, and stores them in Pinecone.

Extraction (Agent): Llama 3 analyzes the text simultaneously to extract structured JSON (Name, Email, Summary).

Action: If a valid email is found, the system triggers the salesforce.step.ts logic.

Result: A new Lead appears in Salesforce instantly.

Chat: The user can then ask "What is this candidate's experience?" and get cited answers.

## 🛡️ Troubleshooting

"pdf is not a function": We use a custom import fix in upload.step.ts to handle ESM/CommonJS compatibility for pdf-parse.

Salesforce Errors: Ensure your SALESFORCE_INSTANCE_URL does not have a trailing slash or quotes in the .env file.