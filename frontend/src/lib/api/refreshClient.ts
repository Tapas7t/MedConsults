import axios from 'axios';
import { env } from '../env';

// Isolated client without interceptors to prevent circular refresh loops
export const refreshClient = axios.create({
  baseURL: env.NEXT_PUBLIC_API_URL,
  withCredentials: true, // Sends the HttpOnly rotating refresh cookie
  timeout: 10000,
});

