import * as brevo from '@getbrevo/brevo';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.BREVO_API_KEY;

if (!apiKey) {
    console.error("BREVO_API_KEY not found in environment variables!");
    throw new Error("Brevo API Key is missing.");
}

const apiInstance = new brevo.TransactionalEmailsApi();
const apiClient = brevo.ApiClient.instance;
apiClient.authentications['apiKey'].apiKey = apiKey;

export { apiInstance, brevo };
