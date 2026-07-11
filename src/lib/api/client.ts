import axios from "axios";

export const apiClient = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30s timeout to allow for model generation and complex scoring
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "An unexpected API error occurred";
    
    return Promise.reject(new Error(message));
  }
);
