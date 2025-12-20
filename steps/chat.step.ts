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
  // EXPECT 'messages' ARRAY NOW
  const { messages, fileId } = req.body;
  
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { status: 400, body: { error: 'Messages array required' } };
  }

  // 1. Get the LATEST question for Vector Search
  const lastMessage = messages[messages.length - 1];
  const question = lastMessage.content;

  logger.info(`📝 New Question: "${question}" (History Length: ${messages.length})`);

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    const indexName = process.env.PINECONE_INDEX!;
    const index = pc.index(indexName);

    if (!extractor) {
      logger.info('⬇️ Loading embedding model...');
      extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }

    // 2. Generate Vector for the LAST question only
    const output = await extractor(question, { pooling: 'mean', normalize: true });
    const queryVector = Array.from(output.data);

    // 3. Search Pinecone (Scoped to File)
    const filter = fileId ? { file_id: fileId } : undefined;
    const queryResponse = await index.query({
      vector: queryVector as number[],
      topK: 3,
      includeMetadata: true,
      filter: filter,
    });

    const contextText = queryResponse.matches?.map((m: any) => m.metadata?.text).join('\n---\n') || '';

    // 4. Construct Full Conversation for Groq
    // SYSTEM PROMPT + HISTORY + NEW CONTEXT
    const finalMessages = [
      { 
        role: 'system', 
        content: `You are a helpful AI assistant. Use the following context to answer the user's question. 
        
        CONTEXT:
        ${contextText}
        
        If the answer is not in the context, say "I don't see that in the document."` 
      },
      ...messages // Spread the full history here
    ];

    logger.info('🤖 Asking Groq with History...');
    
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