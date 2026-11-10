import type { Metadata, Viewport } from "next";
import { Anton, Newsreader } from "next/font/google";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rachid Head Shop | Cultura, qualidade e estilo",
  description:
    "Produtos selecionados, catálogo online e entrega para todo o Brasil. Rachid Head Shop, Fortaleza — CE.",
};

export const viewport: Viewport = {
  themeColor: "#dcd9d4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${anton.variable} ${newsreader.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}