const API_URL = (() => {
  if (import.meta.env.PROD) return "";

  const configured =
    typeof import.meta.env.VITE_API_URL === "string" &&
    import.meta.env.VITE_API_URL.trim().length > 0
      ? import.meta.env.VITE_API_URL.trim()
      : "http://localhost:3000";

  return configured.replace(/\/+$/, "");
})();

function resolveApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_URL}${normalizedPath}`;
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("webdev_token");
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(resolveApiUrl(path), {
    ...options,
    headers,
    credentials: "include"
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || "Erro na comunicação com o servidor");
  }

  return data as T;
}
