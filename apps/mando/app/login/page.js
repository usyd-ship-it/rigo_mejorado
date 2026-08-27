"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../src/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 360 }}>
      <h1 style={{ color: "#7A1F2B" }}>RIGO+ Mando</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input type="email" placeholder="correo" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          type="password"
          placeholder="contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Entrar</button>
        {error && <p style={{ color: "#B3392E" }}>{error}</p>}
      </form>
    </main>
  );
}
