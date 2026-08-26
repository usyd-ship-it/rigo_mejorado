export const metadata = {
  title: "RIGO+ — Portal ciudadano",
  description: "Reportes ciudadanos — Municipio de Heroica Matamoros",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
