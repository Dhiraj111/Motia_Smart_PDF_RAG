import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';

// Import your steps as modules
import * as ChatStep from './steps/chat.step.ts';
import * as SalesforceStep from './steps/salesforce.step.ts';
import * as UploadStep from './steps/upload.step.ts'; // 👈 UNCOMMENTED THIS

dotenv.config();

const app = express();

// Middleware
app.use(cors({ origin: '*' }));
// Keep your 50mb limit, it is correct!
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

const registerRoute = (stepModule: any) => {
    const { config, handler } = stepModule;
    if (!config || !handler) {
        console.error(`❌ Failed to register a step: Missing config or handler export.`);
        return;
    }
    const method = config.method.toLowerCase() as 'get' | 'post';
    const path = config.path;

    app[method](path, async (req: express.Request, res: express.Response) => {
        try {
            const context = { logger: { info: console.log, error: console.error, warn: console.warn } };
            const result = await handler(req, context);
            res.status(result.status || 200).json(result.body);
        } catch (error: any) {
            console.error(`Error in ${path}:`, error);
            res.status(500).json({ error: error.message || 'Internal Server Error' });
        }
    });

    console.log(`✅ Registered Route: ${config.method.toUpperCase()} ${path}`);
};

// --- REGISTER ROUTES HERE ---
registerRoute(ChatStep);
registerRoute(SalesforceStep);
registerRoute(UploadStep); // 👈 UNCOMMENTED THIS TOO

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`\n🚀 Server running on http://localhost:${port}`);
});