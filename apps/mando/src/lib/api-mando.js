import { createClient } from "./supabase/client";

// Solo para Client Components: usa el cliente de Supabase del navegador
// (mismo de B5) y window para el redirect de sesión expirada.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function apiMando(path, options = {}) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${session?.access_token ?? ""}`,
  };

  const resp = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (resp.status === 401) {
    // sesión expirada — no mostrar error genérico, mandar a /login
    window.location.href = "/login";
    return new Promise(() => {}); // corta la cadena; la navegación ya va en curso
  }

  const datos = await resp.json().catch(() => null);

  if (!resp.ok) {
    const error = new Error(`apiMando ${path} -> ${resp.status}`);
    error.status = resp.status;
    error.body = datos;
    throw error;
  }

  return datos;
}
