export class ApiError extends Error {
  public readonly errorName: string;
  public readonly statusCode: number;

  constructor(errorName: string, message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.errorName = errorName;
    this.statusCode = statusCode;
  }
}

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    if (isJson) {
      const body = await res.json();
      throw new ApiError(
        body.error || 'RequestError',
        body.message || `HTTP ${res.status}`,
        body.statusCode || res.status
      );
    }
    throw new ApiError('RequestError', `HTTP ${res.status}: ${res.statusText}`, res.status);
  }

  return (isJson ? await res.json() : await res.text()) as T;
}
