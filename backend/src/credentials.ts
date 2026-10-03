import dotenv from 'dotenv';

dotenv.config();

/**
 * Options shared by all Google Cloud clients: use the service account key file
 * when SERVICE_ACCOUNT_FILE is set, Application Default Credentials otherwise.
 */
export const googleClientOptions: { keyFilename?: string } = process.env.SERVICE_ACCOUNT_FILE
  ? { keyFilename: process.env.SERVICE_ACCOUNT_FILE }
  : {};
