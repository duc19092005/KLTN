import axios from 'axios';
import { API_URL } from '../../utils/constants';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.response.use((response) => {
  if (response.data && typeof response.data === 'object' && 'success' in response.data && 'data' in response.data) {
    return { ...response, data: response.data.data };
  }
  return response;
});

export default api;
