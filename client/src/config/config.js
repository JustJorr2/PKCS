// API Configuration and base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/";

export const config = {
  API_BASE_URL,
  timeout: 10000
};

export default config;
