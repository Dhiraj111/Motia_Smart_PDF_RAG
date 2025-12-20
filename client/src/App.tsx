import { useState, useRef, useEffect } from 'react';
import { Send, FileUp, Loader2, Bot, CheckCircle2, Sparkles } from 'lucide-react'; // Added Sparkles icon
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const BotMessage = ({ content, isNew }: { content: string, isNew: boolean }) => {
  const [displayedContent, setDisplayedContent] = useState(isNew ? "" : content);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!isNew || hasStarted.current) {
        setDisplayedContent(content); 
        return;
    }
    hasStarted.current = true;
    let i = 0;
    const speed = 10; 

    const timer = setInterval(() => {
      if (i < content.length) {
        setDisplayedContent((prev) => prev + content.charAt(i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [content, isNew]);

  return <div className="prose"><ReactMarkdown>{displayedContent}</ReactMarkdown></div>;
};

function App() {
  const [fileId, setFileId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // --- 1. NEW SUMMARIZE FUNCTION ---
  const handleSummarize = async () => {
    if (!fileId || isLoading) return;

    const summaryPrompt = "Please generate a structured summary of this document. Include:\n1. **Executive Summary** (2-3 sentences)\n2. **Key Points** (Bulleted list)\n3. **Action Items** (If any)";
    
    // We don't show the user's "prompt" in the chat history to keep it clean.
    // We just show the AI's response.
    setIsLoading(true);

    try {
      const res = await axios.post('/chat', {
        messages: [...messages, { role: 'user', content: summaryPrompt }],
        fileId
      });
      
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.answer }]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus("Initializing...");
    setMessages([]);

    try {
      const newFileId = crypto.randomUUID();
      setFileId(newFileId);

      const CHUNK_SIZE = 1 * 1024 * 1024; 
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(file.size, start + CHUNK_SIZE);
        const chunk = file.slice(start, end);
        const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(chunk);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
        });

        setUploadStatus(`Uploading ${i + 1}/${totalChunks}...`);
        await axios.post('/upload', { fileId: newFileId, fileName: file.name, chunkIndex: i, totalChunks, dataBase64: base64 });
      }

      setUploadStatus("⏳ Indexing...");
      
      const pollInterval = setInterval(async () => {
        try {
            const res = await axios.post('/status', { fileId: newFileId });
            if (res.data.ready) {
                clearInterval(pollInterval);
                setUploadStatus("✅ Ready!");
                setIsUploading(false);
                setMessages([{ role: 'assistant', content: "I've read your PDF! **Ask me anything** or click **Summarize**." }]);
            }
        } catch (err) { console.error(err); }
      }, 2000);

    } catch (err) {
      console.error(err);
      setUploadStatus("❌ Failed");
      setIsUploading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !fileId) return;
    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);
    try {
      const res = await axios.post('/chat', {
        messages: [...messages, { role: 'user', content: userMsg }],
        fileId
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.answer }]);
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="w-full max-w-3xl mx-auto flex flex-col h-full bg-white shadow-xl overflow-hidden">
        
        {/* HEADER */}
        <div className="p-6 border-b bg-white z-10">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              📚 Motia PDF Chat
            </h1>
            {uploadStatus === "✅ Ready!" && (
                <span className="flex items-center gap-1 text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">
                    <CheckCircle2 size={14} /> Ready
                </span>
            )}
          </div>
          
          <div className="mt-6 flex items-center gap-3">
            {/* UPLOAD BUTTON */}
            <label className={`flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-lg cursor-pointer hover:bg-gray-800 transition shadow-lg ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {isUploading ? <Loader2 size={18} className="animate-spin" /> : <FileUp size={18} />}
              <span className="font-medium">Upload PDF</span>
              <input type="file" className="hidden" onChange={handleUpload} accept=".pdf" disabled={isUploading} />
            </label>

            {/* --- 2. NEW SUMMARIZE BUTTON --- */}
            <button 
                onClick={handleSummarize}
                disabled={!fileId || isUploading || isLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Sparkles size={18} />
                <span className="font-medium">Summarize</span>
            </button>

            <span className="text-sm text-gray-500 font-medium animate-pulse ml-2">
                {isUploading ? uploadStatus : ""}
            </span>
          </div>
        </div>

        {/* CHAT AREA */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
          {messages.length === 0 && !isUploading && (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                    <Bot size={32} className="opacity-40" />
                  </div>
                  <p>Upload a PDF to start.</p>
              </div>
          )}
          
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-6 py-4 shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' 
                  : 'bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-tl-sm'
              }`}>
                 {msg.role === 'user' ? (
                     <p className="text-[15px]">{msg.content}</p>
                 ) : (
                     <BotMessage content={msg.content} isNew={i === messages.length - 1} />
                 )}
                 {msg.role === 'assistant' && (
                     <div className="mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">✨ AI Answer</div>
                 )}
              </div>
            </div>
          ))}
          
          {isLoading && (
              <div className="flex justify-start">
                  <div className="bg-white border border-gray-100 px-5 py-4 rounded-2xl rounded-tl-sm flex items-center gap-3 shadow-sm">
                      <Loader2 size={18} className="animate-spin text-blue-600" />
                      <span className="text-sm text-gray-500 font-medium">Thinking...</span>
                  </div>
              </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA */}
        <div className="p-4 bg-white border-t flex gap-3">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            disabled={!fileId || isUploading || isLoading}
            placeholder="Ask a question..."
            className="flex-1 px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition disabled:bg-gray-50"
          />
          <button onClick={sendMessage} disabled={!fileId || isUploading || isLoading} className="p-3.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition">
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;