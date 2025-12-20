# 📚 Motia Smart PDF Assistant (Advanced RAG)

A full-stack AI application that allows users to upload PDF documents and chat with them in real-time. 

This project demonstrates the power of **Motia's Polyglot Architecture**, seamlessly blending **TypeScript** (for API/Frontend) and **Python** (for AI/Embeddings) into a single, cohesive workflow.

![Motia RAG Architecture]

## 🚀 Features

- **📄 PDF Ingestion:** Uploads are streamed, chunked, and saved locally.
- **🧠 Local Embeddings:** Uses `HuggingFace (all-MiniLM-L6-v2)` running locally in Python to generate free vector embeddings.
- **⚡ Instant Chat:** Uses **Groq (Llama 3)** for near-instant, zero-cost AI responses.
- **🔍 Semantic Search:** Stores and retrieves vectors using **Pinecone**.
- **🔗 Event-Driven:** Decoupled architecture using Motia events (`file.uploaded`).

## 🛠️ Tech Stack

| Component | Technology | Role |
|-----------|------------|------|
| **Orchestration** | [Motia](https://motia.dev) | Connecting Steps & Events |
| **Backend API** | TypeScript (Node.js) | REST API & Upload Handling |
| **AI Worker** | Python 3.9+ | PDF Parsing & Embedding |
| **LLM** | Groq (Llama 3) | Generative AI Answers |
| **Vector DB** | Pinecone | Storing Knowledge |
| **Embeddings** | HuggingFace | Vectorizing Text (Local) |

## 📂 Project Structure

```bash
├── public/
│   └── index.html        # Simple frontend UI
├── steps/
│   ├── upload.step.ts    # API: Receives chunks & emits 'file.uploaded'
│   ├── chat.step.ts      # API: Search Pinecone & query Groq
│   ├── ingest_step.py    # WORKER: Listens for events, embeds PDF
│   └── frontend.step.ts  # API: Serves the HTML UI
├── uploads/              # Local storage for PDF files
├── .env                  # API Keys
└── package.json
```

## 🏃‍♂️ Getting Started

### 1. Clone & Install
```bash
git clone [https://github.com/yourusername/motia-smart-pdf.git](https://github.com/yourusername/motia-smart-pdf.git)
cd motia-smart-pdf

# Install Node dependencies
npm install

# Install Python dependencies
pip3 install -r requirements.txt
```

## 2. Configure Environment

Create a `.env` file in the root directory:

```env
# Vector Database
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX=motia-rag

# LLM (Brain)
GROQ_API_KEY=gsk_your_groq_key

# Optional (for Python Mac optimizations)
TQDM_DISABLE=1
TOKENIZERS_PARALLELISM=false
```

## 3. Run Development Server

Motia runs both the TypeScript server and Python worker simultaneously.

```bash
npm run dev
```

## 4. Use the App

Open http://localhost:3000/app
Upload a PDF.
Watch the terminal to see the Python Worker index the file.
Ask a question!

## 🐛 Troubleshooting

Python Worker Crashes?

Ensure you have installed pip install python-dotenv langchain-huggingface.

Check that your Pinecone Index is 384 dimensions.

"Socket Hang Up" on Upload?

The frontend uses chunking (10KB chunks) to prevent process overflows. Ensure you are not bypassing the frontend logic.
