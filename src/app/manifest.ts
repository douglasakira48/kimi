import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Contas da Casa",
    short_name: "Contas",
    description: "Despesas da casa, avisos de vencimento e painel de gastos.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f3f4",
    theme_color: "#1f4fe0",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
