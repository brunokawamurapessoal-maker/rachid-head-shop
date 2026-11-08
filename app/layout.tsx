import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rachid Head Shop | Cultura, qualidade e estilo",
  description:
    "Produtos selecionados, catálogo online e entrega para todo o Brasil. Rachid Head Shop, Fortaleza — CE.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}