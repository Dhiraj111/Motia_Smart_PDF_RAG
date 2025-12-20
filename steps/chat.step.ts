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
  // 1. EXTRACT fileId
  const { question, fileId } = req.body;
  
  if (!question) return { status: 400, body: { error: 'Question required' } };
  
  // Optional: You can enforce fileId required if you want strict scoping
  // if (!fileId) return { status: 400, body: { error: 'fileId required' } };

  logger.info(`📝 Question: "${question}" for File: ${fileId || 'ALL'}`);

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    const indexName = process.env.PINECONE_INDEX!;
    const index = pc.index(indexName);

    if (!extractor) {
      logger.info('⬇️ Loading embedding model...');
      extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }

    const output = await extractor(question, { pooling: 'mean', normalize: true });
    const queryVector = Array.from(output.data);

    // 2. CONSTRUCT FILTER
    // If fileId is present, we tell Pinecone: "Only match vectors where metadata.file_id == fileId"
    const filter = fileId ? { file_id: fileId } : undefined;

    logger.info(`🔍 Searching Pinecone with Filter: ${JSON.stringify(filter)}`);

    // 3. QUERY WITH FILTER
    const queryResponse = await index.query({
      vector: queryVector as number[],
      topK: 3,
      includeMetadata: true,
      filter: filter, // <--- APPLY FILTER HERE
    });

    if (!queryResponse.matches || queryResponse.matches.length === 0) {
      return { 
        status: 200, 
        body: { answer: "I couldn't find any relevant info in this specific PDF.", sources: [] } 
      };
    }

    const contextText = queryResponse.matches
      .map((match: any) => match.metadata?.text || '')
      .join('\n\n---\n\n');

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Answer the user question using ONLY the context provided below.' },
        { role: 'system', content: `Context:\n${contextText}` },
        { role: 'user', content: question },
      ],
      model: 'llama-3.3-70b-versatile',
    });

    const answer = completion.choices[0]?.message?.content || "No answer generated.";

    return { 
      status: 200, 
      body: { answer, sources: queryResponse.matches } 
    };

  } catch (error: any) {
    logger.error('Chat Failed', { error: error.message });
    return { status: 500, body: { error: `Server Error: ${error.message}` } };
  }
};