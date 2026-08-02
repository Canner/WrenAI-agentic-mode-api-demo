import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WrenAI Agent Mode Demo",
  description: "Demo app for the WrenAI agentic mode API",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
