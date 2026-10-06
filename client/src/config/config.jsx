const RAW_API_URL =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:5000");
const API_BASE_URL = RAW_API_URL.replace(/\/+$/, "");

// dev_purpose = [
// sarapanpagipge : https://sarapanpagipge.com/
// localhost : http://localhost:5000/
// ]

export const config = {
  API_BASE_URL,
  timeout: 10000
};

export default config;

