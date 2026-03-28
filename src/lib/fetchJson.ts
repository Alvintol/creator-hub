export const fetchJson = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, options);
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    const preview = text.slice(0, 100).replace(/\s+/g, ' ');
    throw new Error(`API returned non-JSON response: ${preview}`);
  }
}