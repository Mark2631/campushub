import { ImageResponse } from 'next/og';
import BrandMark from '../components/BrandMark';

export const runtime = 'edge';
export const alt = 'CampusTrader — student marketplace in Kenya.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', flexDirection: 'column', justifyContent: 'center', padding: 72, background: 'linear-gradient(135deg,#0e4839 0%,#125b47 64%,#1d7559 100%)', color: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <BrandMark size={108} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 37, fontWeight: 750, letterSpacing: 0.5, color: '#ffffff' }}>CampusTrader</div>
          <div style={{ display: 'flex', marginTop: 8, fontSize: 23, color: '#d7eadf' }}>Student marketplace in Kenya</div>
        </div>
      </div>
      <div style={{ display: 'flex', marginTop: 46, fontSize: 68, fontWeight: 800, lineHeight: 1.08 }}>Discover. Connect. Trade.</div>
      <div style={{ display: 'flex', marginTop: 23, fontSize: 27, color: '#e6eee8' }}>Products, services, rentals and student requests.</div>
    </div>,
    size
  );
}
