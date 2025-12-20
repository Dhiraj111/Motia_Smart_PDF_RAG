# 📚 Motia Smart PDF Assistant (Advanced RAG)

A full-stack AI application that allows users to upload PDF documents and chat with them in real-time. 

An intelligent, AI-powered document assistant that lets you chat with your PDF files. Built with **React**, **Motia**, **Pinecone**, and **Groq (Llama 3)**.

![Motia RAG Architecture]

## 🚀 Features

* **📄 Drag & Drop Upload:** seamless PDF uploading with automatic 1MB chunking for stability.
* **🧠 RAG Architecture:** Retrieval-Augmented Generation to answer questions strictly based on your document's content.
* **⚡ Real-Time Polling:** Smart UI that waits for backend indexing before allowing user interaction.
* **🌊 Streaming Responses:** Simulated "typewriter" effect for a polished, ChatGPT-like experience.
* **💎 Markdown Support:** Rich text rendering (Bullet points, **Bold**, Code blocks) in AI answers.
* **🔮 One-Click Summarization:** Instantly generate an Executive Summary, Key Points, and Action Items.
* **💾 Persistent Chat:** Your conversation and file session are saved automatically to `localStorage` (survives page refreshes).

## 🛠️ Tech Stack

### **Frontend**
* **Framework:** React + Vite (TypeScript)
* **Styling:** Tailwind CSS (v3)
* **Icons:** Lucide React
* **State Management:** React Hooks + LocalStorage
* **Markdown:** `react-markdown`

### **Backend**
* **Runtime:** Node.js
* **Framework:** [Motia](https://motia.dev) (Workflow & API Engine)
* **Vector Database:** Pinecone
* **LLM:** Groq (Llama-3.3-70b-versatile)
* **PDF Parsing:** `pdf-parse`

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

### 1. Prerequisites
* Node.js (v18 or higher)
* Pinecone API Key (Index dimension: **384**)
* Groq API Key

### 2. Backend Setup (Root Folder)
1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Configure Environment:**
    Create a `.env` file in the root directory:
    ```env
    PINECONE_API_KEY=your_pinecone_key
    PINECONE_INDEX=your_index_name
    GROQ_API_KEY=your_groq_key
    ```
3.  **Start the Backend Server:**
    ```bash
    npm run dev
    ```
    *Server runs on `http://localhost:3000`*

### 3. Frontend Setup (Client Folder)
1.  **Navigate to client folder:**
    ```bash
    cd client
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Start the React App:**
    ```bash
    npm run dev
    ```
    *App runs on `http://localhost:5173`*

---

## 📖 Usage Guide

1.  **Upload:** Drag & drop a PDF. The app will upload it in chunks and index it in Pinecone.
2.  **Wait:** The status bar will change from "⏳ Uploading" to "✅ Ready" once indexing is complete.
3.  **Chat:** Type any question about the document.
4.  **Summarize:** Click the **✨ Summarize** button in the header for an instant structured overview.
5.  **Reset:** Click the **Trash Icon** (🗑️) to clear history and upload a new file.

## 🐛 Troubleshooting

Python Worker Crashes?

Ensure you have installed pip install python-dotenv langchain-huggingface.

Check that your Pinecone Index is 384 dimensions.

"Socket Hang Up" on Upload?

The frontend uses chunking (10KB chunks) to prevent process overflows. Ensure you are not bypassing the frontend logic.

<br />

<div align="center">

Built with ❤️ for the 2025 Hackathon.

</div>
