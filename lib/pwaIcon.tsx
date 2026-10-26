import { ImageResponse } from 'next/og';
import BrandMark from '../components/BrandMark';

export function renderPwaIcon(size: number) {
  return new ImageResponse(
    <BrandMark size={size} title="CampusTrader" />,
    { width: size, height: size }
  );
}
