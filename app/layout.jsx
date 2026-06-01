import './globals.css';

export const metadata = {
  title: 'Meme Royale',
  description: 'Buy. Hold. Survive. Win.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
