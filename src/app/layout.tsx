import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "SoundSense",
  description: "AI-powered music discovery. Enter a song, get 10 recommendations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: "rgb(var(--color-accent-rgb))",
              color: "rgb(var(--color-on-accent-rgb))",
              border: "none",
              borderRadius: "9999px",
              fontSize: "13px",
              fontWeight: 500,
              padding: "12px 24px",
            },
          }}
        />
      </body>
    </html>
  );
}
