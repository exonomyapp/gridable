// gridable-app/services/restClient.ts

/**
 * @interface RestClientConfig
 * Configuration for the RestClientService instance.
 */
export interface RestClientConfig {
  baseURL?: string;
  headers?: Record<string, string>;
}

/**
 * @interface RequestConfig
 * Configuration for a single request, extends native RequestInit.
 */
export interface RequestConfig extends RequestInit {
  headers?: Record<string, string>;
}

/**
 * @class RestClientService
 * A standalone, reusable TypeScript service for making REST API requests.
 */
export class RestClientService {
  private readonly baseURL: string;
  private readonly defaultHeaders: Record<string, string>;

  /**
   * Creates an instance of RestClientService.
   * @param {RestClientConfig} [config={}] - Optional configuration for the client.
   */
  constructor(config: RestClientConfig = {}) {
    this.baseURL = config.baseURL || '';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  /**
   * Handles the response from the fetch API.
   * @private
   * @param {Response} response - The response object from a fetch call.
   * @returns {Promise<T>} A promise that resolves with the JSON data.
   * @throws {Error} If the network response was not ok.
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`HTTP error! status: ${response.status}`, { cause: errorData });
    }
    // Handle cases where the response body is empty
    const text = await response.text();
    return text ? JSON.parse(text) : ({} as T);
  }

  /**
   * Performs a GET request.
   * @template T - The expected response type.
   * @param {string} url - The URL for the request.
   * @param {RequestConfig} [config] - Optional request configuration.
   * @returns {Promise<T>} A promise that resolves with the response data.
   */
  public async get<T>(url: string, config?: RequestConfig): Promise<T> {
    const response = await fetch(`${this.baseURL}${url}`, {
      ...config,
      method: 'GET',
      headers: {
        ...this.defaultHeaders,
        ...config?.headers,
      },
    });
    return this.handleResponse<T>(response);
  }

  /**
   * Performs a POST request.
   * @template T - The expected response type.
   * @param {string} url - The URL for the request.
   * @param {any} [data] - The data to send in the request body.
   * @param {RequestConfig} [config] - Optional request configuration.
   * @returns {Promise<T>} A promise that resolves with the response data.
   */
  public async post<T>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    const response = await fetch(`${this.baseURL}${url}`, {
      ...config,
      method: 'POST',
      headers: {
        ...this.defaultHeaders,
        ...config?.headers,
      },
      body: data ? JSON.stringify(data) : null,
    });
    return this.handleResponse<T>(response);
  }

  /**
   * Performs a PUT request.
   * @template T - The expected response type.
   * @param {string} url - The URL for the request.
   * @param {any} [data] - The data to send in the request body.
   * @param {RequestConfig} [config] - Optional request configuration.
   * @returns {Promise<T>} A promise that resolves with the response data.
   */
  public async put<T>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    const response = await fetch(`${this.baseURL}${url}`, {
      ...config,
      method: 'PUT',
      headers: {
        ...this.defaultHeaders,
        ...config?.headers,
      },
      body: data ? JSON.stringify(data) : null,
    });
    return this.handleResponse<T>(response);
  }

  /**
   * Performs a DELETE request.
   * @template T - The expected response type.
   * @param {string} url - The URL for the request.
   * @param {RequestConfig} [config] - Optional request configuration.
   * @returns {Promise<T>} A promise that resolves with the response data.
   */
  public async delete<T>(url: string, config?: RequestConfig): Promise<T> {
    const response = await fetch(`${this.baseURL}${url}`, {
      ...config,
      method: 'DELETE',
      headers: {
        ...this.defaultHeaders,
        ...config?.headers,
      },
    });
    return this.handleResponse<T>(response);
  }
}