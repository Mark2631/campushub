import { renderPwaIcon } from '../../../lib/pwaIcon';

export const runtime = 'edge';
export const contentType = 'image/png';
export const dynamic = 'force-static';

export function GET() {
  return renderPwaIcon(180);
}
