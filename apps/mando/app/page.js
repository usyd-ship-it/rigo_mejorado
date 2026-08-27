import { redirect } from "next/navigation";
import { createClient } from "../src/lib/supabase/server";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", color: "#241A1E" }}>
      <h1 style={{ color: "#7A1F2B" }}>RIGO+ Mando</h1>
      <p>Sesión iniciada como {user.email}.</p>
      <p>
        El UX real (KPIs, mapa operativo, drawer de expediente) se migra desde <code>mando.html</code> en el siguiente
        hito.
      </p>
      <form action={signOut}>
        <button type="submit">Cerrar sesión</button>
      </form>
    </main>
  );
}
