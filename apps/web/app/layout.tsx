import type { Metadata } from 'next';
import './styles.css';
export const metadata: Metadata = {
  title: 'REMS Governance Console',
  description: 'Governed RED-001 foundation',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
