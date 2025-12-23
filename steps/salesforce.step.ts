import { ApiRouteConfig, Handler } from 'motia';
import axios from 'axios'; 
import dotenv from 'dotenv';

dotenv.config();

// --- HELPER FUNCTION (Moved inside to fix build error) ---
async function getSalesforceAccessToken(): Promise<string> {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('client_id', process.env.SF_CLIENT_ID!);
    params.append('client_secret', process.env.SF_CLIENT_SECRET!);
    params.append('refresh_token', process.env.SF_REFRESH_TOKEN!);

    console.log("DEBUG: Instance URL:", process.env.SF_INSTANCE_URL);
    console.log("DEBUG: Refresh Token:", process.env.SF_REFRESH_TOKEN ? "Exists" : "Missing");

    try {
        const response = await axios.post(
            `${process.env.SF_INSTANCE_URL}/services/oauth2/token`,
            params,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        return response.data.access_token;
    } catch (error: any) {
        console.error("❌ Failed to refresh token:", error.response?.data || error.message);
        throw new Error("Could not authenticate with Salesforce");
    }
}

// --- STEP CONFIGURATION ---
export const config: ApiRouteConfig = {
    name: 'Create Lead',
    type: 'api',
    path: '/steps/create-lead',
    method: 'POST',
    emits: [],
};

// --- STEP HANDLER ---
export const handler: Handler = async (req, { logger }) => {
    const { name, email, phone, company, summary } = req.body;

    // Validation
    if (!name || !email) {
        return {
            status: 400,
            body: { error: "Name and Email are required to create a Lead." }
        };
    }

    logger.info(`[Salesforce] Creating lead for ${name}...`);

    try {
        // 1. Get Token using the internal helper
        const token = await getSalesforceAccessToken();

        // 2. Send to Salesforce
        const response = await axios.post(
            `${process.env.SF_INSTANCE_URL}/services/data/v58.0/sobjects/Lead`,
            {
                LastName: name,
                Company: company || 'Unknown Company',
                Email: email,
                Phone : phone,
                Description: summary || 'Lead generated via Motia Smart PDF',
                LeadSource: 'Web'
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        logger.info(`✅ Lead Created! ID: ${response.data.id}`);

        return {
            status: 200,
            body: {
                success: true,
                message: "Successfully saved to Salesforce.",
                leadId: response.data.id,
                link: `${process.env.SF_INSTANCE_URL}/${response.data.id}`
            }
        };

    } catch (error: any) {
        logger.error("❌ Salesforce Error:", error.response?.data || error.message);
        return {
            status: 500,
            body: { error: "Failed to create Lead in Salesforce." }
        };
    }
};