import OrdersPageContent from '../../components/OrdersPageContent';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ view?: string }> };

export default async function OrdersPage({ searchParams }: Props) {
  const { view } = await searchParams;
  return <OrdersPageContent initialView={view === 'selling' ? 'selling' : 'buying'} />;
}
