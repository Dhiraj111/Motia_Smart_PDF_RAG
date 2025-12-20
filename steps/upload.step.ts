import { ApiRouteConfig, Handler } from 'motia';
import fs from 'fs-extra';
import path from 'path';

export const config: ApiRouteConfig = {
  name: 'UploadPDF',
  type: 'api',
  path: '/upload',
  method: 'POST',
  emits: ['file.uploaded'],
};

export const handler: Handler = async (req, { emit, logger }) => {
  try {
    const { fileId, fileName, chunkIndex, totalChunks, dataBase64 } = req.body;

    if (!fileId || !dataBase64) {
      return { status: 400, body: { error: 'Missing data' } };
    }

    // 1. Define file path
    const uploadDir = path.join(process.cwd(), 'uploads');
    await fs.ensureDir(uploadDir);
    const safeName = `${fileId}-${fileName}`;
    const filePath = path.join(uploadDir, safeName);

    // 2. Append chunk to file
    const buffer = Buffer.from(dataBase64, 'base64');
    
    // If it's the first chunk, ensure we start fresh (overwrite if exists)
    if (chunkIndex === 0) {
      await fs.writeFile(filePath, buffer);
    } else {
      await fs.appendFile(filePath, buffer);
    }

    logger.info(`Received chunk ${chunkIndex + 1}/${totalChunks} for ${fileName}`);

    // 3. Check if upload is complete
    if (chunkIndex === totalChunks - 1) {
      logger.info('Upload complete. Emitting event.');
      
      // Emit event for Python to pick up
      await emit({
        topic: 'file.uploaded',
        data: { filePath, fileName, fileId },
      });

      return { 
        status: 200, 
        body: { message: 'Upload complete', complete: true, fileId } 
      };
    }

    return { 
      status: 200, 
      body: { message: 'Chunk received', complete: false } 
    };

  } catch (error: any) {
    logger.error('Upload failed', { error: error.message });
    return { status: 500, body: { error: 'Internal Server Error' } };
  }
};