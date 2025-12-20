import { ApiRouteConfig, Handler } from 'motia';
import { Pinecone } from '@pinecone-database/pinecone';

export const config: ApiRouteConfig = {
  name: 'CheckStatus',
  type: 'api',
  path: '/status',
  method: 'POST',
  emits: [],
};

export const handler: Handler = async (req, { logger }) => {
  const { fileId } = req.body;

  try {
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    const index = pc.index(process.env.PINECONE_INDEX!);

    // We do a "dummy search" to see if any data exists for this file
    // We search for a vector of all zeros; we just care if we get ANY match.
    // (Dimension 384 is standard for all-MiniLM-L6-v2)
    const dummyVector = new Array(384).fill(0);

    const queryResponse = await index.query({
      vector: dummyVector,
      topK: 1,
      filter: { file_id: fileId },
      includeMetadata: false
    });

    const isReady = queryResponse.matches.length > 0;

    return { 
      status: 200, 
      body: { ready: isReady } 
    };

  } catch (error: any) {
    logger.error('Status Check Failed', { error: error.message });
    return { status: 500, body: { error: error.message } };
  }
};