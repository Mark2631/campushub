import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'CampusTrader — Discover. Connect. Trade.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', flexDirection: 'column', justifyContent: 'center', padding: 88, background: 'linear-gradient(135deg,#020617 0%,#0b2353 65%,#153e91 100%)', color: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 36, fontWeight: 700, letterSpacing: 1, color: '#93c5fd' }}>CAMPUS<span style={{ color: '#ffffff' }}>TRADER</span></div>
      <div style={{ display: 'flex', marginTop: 42, fontSize: 72, fontWeight: 800, lineHeight: 1.1 }}>Discover. Connect. Trade.</div>
      <div style={{ display: 'flex', marginTop: 28, fontSize: 29, color: '#cbd5e1' }}>Your marketplace across universities, colleges & technical institutions.</div>
      <div style={{ display: 'flex', marginTop: 58, fontSize: 23, color: '#93c5fd' }}>Products  •  Services  •  Rentals  •  Student Requests</div>
    </div>, size
  );
}
