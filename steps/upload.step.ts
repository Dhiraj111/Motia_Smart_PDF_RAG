import { ApiRouteConfig, Handler } from 'motia';
import * as fs from 'fs';
import * as path from 'path';
import { Pinecone } from '@pinecone-database/pinecone';
import Groq from 'groq-sdk';
import { pipeline } from '@xenova/transformers';
import dotenv from 'dotenv';
import { handler as createLeadHandler } from './salesforce.step.ts';

// --- THE FIX: Direct Internal Import ---
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Pointing directly to the implementation file to avoid ESM wrapper issues
const pdf = require('pdf-parse/lib/pdf-parse.js');
// -------------------------------------

dotenv.config();

export const config: ApiRouteConfig = {
  name: 'UploadPDF',
  type: 'api',
  path: '/upload',
  method: 'POST',
  emits: ['file.uploaded'],
};

// Global cache for embedding model
let extractor: any = null;

export const handler: Handler = async (req, { logger, emit }) => {
  const { fileId, fileName, chunkIndex, totalChunks, dataBase64 } = req.body;

  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const safeFileName = `${fileId}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const filePath = path.join(uploadDir, safeFileName);

  try {
    const buffer = Buffer.from(dataBase64, 'base64');

    if (chunkIndex === 0 && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    fs.appendFileSync(filePath, buffer);
    logger.info(`📝 Chunk ${chunkIndex + 1}/${totalChunks} written.`);

    if (chunkIndex === totalChunks - 1) {
      logger.info('✅ Upload finished! Starting AI Processing...');

      const fullFileBuffer = fs.readFileSync(filePath);
      
      // 1. EXTRACT TEXT
      // Now using the direct function. 
      // Note: pdf-parse usually returns a Promise.
      const data = await pdf(fullFileBuffer);
      const text = data.text;

      // 2. Index to Pinecone
      logger.info("[AI] Indexing to Pinecone...");
      const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
      const index = pc.index(process.env.PINECONE_INDEX!);

      if (!extractor) {
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      }

      const textChunks = text.match(/[\s\S]{1,1000}/g) || [text];
      
      for (const [i, chunk] of textChunks.entries()) {
        const output = await extractor(chunk, { pooling: 'mean', normalize: true });
        const vector = Array.from(output.data);
        
        await index.upsert([{
          id: `${fileId}-${i}`,
          values: vector as number[],
          metadata: { text: chunk, file_id: fileId }
        }]);
      }
      logger.info("[AI] Pinecone Indexing Complete.");

      // 3. Extract Candidate Info (Groq)
      logger.info("[AI] Extracting Candidate Data...");
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      
      const extractionPrompt = `
        Extract the following details from the resume text below.
        Return ONLY a raw JSON object. Do not add markdown formatting.
        Fields: "name", "email", "company" (current or last company), "summary" (3 sentences).
        
        Resume Text:
        ${text.substring(0, 3000)}
      `;

      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: extractionPrompt }],
        model: "llama-3.3-70b-versatile",
      });

      const rawJson = completion.choices[0]?.message?.content || "{}";
      let candidateData = { name: "Unknown", email: "unknown@example.com", company: "", summary: "" };
      
      try {
        const cleanJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
        candidateData = JSON.parse(cleanJson);
      } catch (e) {
        logger.warn("⚠️ JSON Parse failed. Using defaults.");
      }

      // 4. Trigger Salesforce
      let salesforceResult = null;
      if (candidateData.email && candidateData.email !== "unknown@example.com") {
        logger.info(`[Salesforce] Creating Lead for ${candidateData.name}...`);
        
        salesforceResult = await createLeadHandler(
          { 
            body: {
              name: candidateData.name,
              email: candidateData.email,
              company: candidateData.company,
              summary: candidateData.summary
            } 
          } as any, 
          { logger } as any
        );
      } else {
        logger.info("[Salesforce] Skipped: No email found.");
      }

      // 5. Emit Event
      const eventPayload = { filePath, fileId };
      await emit({ topic: 'file.uploaded', data: eventPayload });
      
      return { 
        status: 200, 
        body: { 
          message: 'Upload, Indexing & Lead Creation Complete', 
          filePath,
          extraction: candidateData,
          salesforce: salesforceResult ? salesforceResult.body : "Skipped"
        } 
      };
    }

    return { status: 200, body: { message: 'Chunk received' } };

  } catch (error: any) {
    logger.error(`❌ Upload/Process Failed: ${error.message}`);
    return { status: 500, body: { error: error.message } };
  }
};