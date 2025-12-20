import { ApiRouteConfig, Handler } from 'motia'; // <--- NO 'emit' HERE
import * as fs from 'fs';
import * as path from 'path';

export const config: ApiRouteConfig = {
  name: 'UploadPDF',
  type: 'api',
  path: '/upload',
  method: 'POST',
  emits: ['file.uploaded'],
};

// <--- 'emit' MUST BE HERE
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
      logger.info('✅ Upload finished! Sending event...');

      const eventPayload = {
        filePath: filePath,
        fileId: fileId
      };
      
      // DEBUG LOG: If this number is big, the code is wrong.
      logger.info(`🔍 DEBUG: Payload Size = ${JSON.stringify(eventPayload).length} chars`);

      await emit({
        topic: 'file.uploaded',
        data: eventPayload // <--- TINY PAYLOAD ONLY
      });
      
      return { status: 200, body: { message: 'Upload complete', filePath } };
    }

    return { status: 200, body: { message: 'Chunk received' } };

  } catch (error: any) {
    logger.error(`❌ Upload Failed: ${error.message}`);
    return { status: 500, body: { error: error.message } };
  }
};