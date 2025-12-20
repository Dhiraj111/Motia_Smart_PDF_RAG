import { ApiRouteConfig, Handler } from 'motia';
import { Pinecone } from '@pinecone-database/pinecone';
import Groq from 'groq-sdk';
import { pipeline } from '@xenova/transformers';

export const config: ApiRouteConfig = {
  name: 'ChatPDF',
  type: 'api',
  path: '/chat',
  method: 'POST',
};

// Global cache to prevent reloading model on every request
let extractor: any = null;

export const handler: Handler = async (req, { logger }) => {
  const { question } = req.body;
  
  if (!question) {
    return { status: 400, body: { error: 'Question required' } };
  }

  logger.info(`📝 Received Question: "${question}"`);

  try {
    // 1. Initialize Groq & Pinecone
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    const indexName = process.env.PINECONE_INDEX!;
    const index = pc.index(indexName);

    // 2. Generate Embedding (Locally)
    if (!extractor) {
      logger.info('⬇️  Loading embedding model (First run may be slow)...');
      extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }

    logger.info('🧠 Generating vector...');
    const output = await extractor(question, { pooling: 'mean', normalize: true });
    const queryVector = Array.from(output.data);

    // 3. Query Pinecone
    logger.info(`🔍 Searching Pinecone Index: ${indexName}...`);
    const queryResponse = await index.query({
      vector: queryVector as number[],
      topK: 3,
      includeMetadata: true,
    });

    if (!queryResponse.matches || queryResponse.matches.length === 0) {
      logger.warn('⚠️ No matches found in Pinecone.');
      return { 
        status: 200, 
        body: { answer: "I couldn't find any relevant info in the PDF.", sources: [] } 
      };
    }

    const contextText = queryResponse.matches
      .map((match: any) => match.metadata?.text || '')
      .join('\n\n---\n\n');

    logger.info(`✅ Found ${queryResponse.matches.length} matches.`);

    // 4. Generate Answer with Groq
    logger.info('🤖 Asking Groq...');
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Answer the user question using ONLY the context provided below.' },
        { role: 'system', content: `Context:\n${contextText}` },
        { role: 'user', content: question },
      ],
      model: 'llama3-8b-8192',
    });

    const answer = completion.choices[0]?.message?.content || "No answer generated.";
    logger.info('🎉 Answer generated!');

    return { 
      status: 200, 
      body: { answer, sources: queryResponse.matches } 
    };

  } catch (error: any) {
    logger.error('❌ Chat Failed', { error: error.message, stack: error.stack });
    
    // Check for common Pinecone dimension error
    if (error.message.includes("dimension")) {
      return { status: 500, body: { error: "Pinecone Dimension Mismatch! Did you create the index with 384 dimensions?" } };
    }

    return { status: 500, body: { error: `Server Error: ${error.message}` } };
  }
};