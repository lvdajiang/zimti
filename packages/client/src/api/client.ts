import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import { toast } from '../utils/toast.js'

const axiosInstance: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

axiosInstance.interceptors.response.use(
  (response) => {
    if (response.headers['x-stub'] === 'true') {
      const desc = response.headers['x-stub-description'] || '该功能尚在开发中'
      toast.warning(desc)
    }
    return response.data
  },
  (error) => {
    const msg = error.response?.data?.error || error.message
    toast.error(`请求失败: ${msg}`)
    console.error('[API Error]', error.response?.data ?? error.message)
    return Promise.reject(error)
  },
)

interface ApiClient {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  delete<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  del<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
}

const api = axiosInstance as unknown as ApiClient

export default api
