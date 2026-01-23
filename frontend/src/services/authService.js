import api from "./api";

export const authService = {
  login: async (username, password, remember = false) => {
    const response = await api.post("/auth/login", { username, password, remember });
    return response.data;
  },
  logout: async () => {
    const response = await api.post("/auth/logout");
    return response.data;
  },
  getMe: async () => {
    const response = await api.get("/auth/me");
    return response.data;
  }
};
