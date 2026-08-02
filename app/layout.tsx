import type { ReactNode } from "react";

export const metadata = {
  title: "News Intelligence — Archive",
  description: "Corroboration-weighted news intelligence digests.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          font: "16px/1.5 Georgia, serif",
          maxWidth: "44rem",
          margin: "2rem auto",
          padding: "0 1rem",
        }}
      >
        {children}
      </body>
    </html>
  );
}
