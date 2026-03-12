import axios from "axios";

const baseURL =
  typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "")
    : "";

const instance = axios.create({
  baseURL: baseURL || undefined,
  withCredentials: true,
  timeout: 60000,
});

export default instance;
