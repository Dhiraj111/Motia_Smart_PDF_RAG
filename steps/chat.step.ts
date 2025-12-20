import { ApiRouteConfig, Handler } from 'motia';
import { Pinecone } from '@pinecone-database/pinecone';
import Groq from 'groq-sdk';
import { pipeline } from '@xenova/transformers';

export const config: ApiRouteConfig = {
  name: 'ChatPDF',
  type: 'api',
  path: '/chat',
  method: 'POST',
  emits: [],
};

let extractor: any = null;

export const handler: Handler = async (req, { logger }) => {
  const { messages, fileId } = req.body;
  
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { status: 400, body: { error: 'Messages array required' } };
  }

  const lastMessage = messages[messages.length - 1];
  const question = lastMessage.content;

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    const index = pc.index(process.env.PINECONE_INDEX!);

    if (!extractor) {
      extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }

    // 1. Search for Context
    const output = await extractor(question, { pooling: 'mean', normalize: true });
    const queryVector = Array.from(output.data);

    const filter = fileId ? { file_id: fileId } : undefined;
    const queryResponse = await index.query({
      vector: queryVector as number[],
      topK: 5, // Increase to 5 for better context coverage
      includeMetadata: true,
      filter: filter,
    });

    const contextText = queryResponse.matches?.map((m: any) => m.metadata?.text).join('\n---\n') || '';

    // 2. NEW INTELLIGENT SYSTEM PROMPT
    const systemPrompt = `
    You are an intelligent AI assistant capable of analyzing PDF documents.
    
    HERE IS THE CONTEXT FROM THE UPLOADED PDF:
    ${contextText}

    INSTRUCTIONS:
    1. If the user asks a question about facts in the PDF, answer STRICTLY using the context above.
    2. If the user asks for a definition, grammar check, summary, or to "reframe" a sentence, USE YOUR GENERAL KNOWLEDGE to help them, while keeping the PDF context in mind.
    3. If the user says "okay", "thanks", or "hello", be polite and conversational.
    4. Do NOT say "I don't see that in the document" unless the question is a specific factual query about the PDF that is truly missing.
    `;

    const finalMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    const completion = await groq.chat.completions.create({
      messages: finalMessages as any,
      model: 'llama-3.3-70b-versatile',
    });

    const answer = completion.choices[0]?.message?.content || "No answer generated.";

    return { 
      status: 200, 
      body: { answer, sources: queryResponse.matches } 
    };

  } catch (error: any) {
    logger.error('Chat Failed', { error: error.message });
    return { status: 500, body: { error: error.message } };
  }
};