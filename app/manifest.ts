import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "Soma — Stories from Kenya", short_name: "Soma", description: "Read stories in English and Kiswahili.", start_url: "/", display: "standalone", background_color: "#f8f7f2", theme_color: "#ed7248", orientation: "portrait", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }] };
}
