import cors from 'cors';

const corsMiddleware = cors({
  origin: [
    'https://daudtravel.com',
    'https://www.daudtravel.com',
    'https://test.daudtravel.com'
  ],  // This is your frontend's URL
  credentials: true,                // Allows cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],  // List of allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow headers you want
  preflightContinue: false,         // Whether to pass the CORS preflight response to the next handler
  optionsSuccessStatus: 200         // Some legacy browsers (like IE11) choke on 204
});

export default corsMiddleware;
