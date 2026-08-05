import type { Metadata } from "next";
import "./globals.css";
import { PwaRegister } from "@/app/components/pwa-register";
import { LanguageProvider } from "@/app/components/language-provider";

export const metadata: Metadata = {
  title: { default: "Soma — Stories that stay with you", template: "%s · Soma" },
  description: "A simple home for stories from Kenya, in English and Kiswahili.",
  applicationName: "Soma",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Soma" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;700;800;900&family=Georgia:wght@400;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body><LanguageProvider><PwaRegister />{children}</LanguageProvider></body>
    </html>
  );
}
