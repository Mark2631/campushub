import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Orders loads the backend payment option and keeps direct arrangements separate from secured payments', async () => {
  const orders = await read('../lib/orders.ts');
  const activity = await read('../components/OrdersActivity.tsx');

  assert.match(orders, /payment_option: string/);
  assert.match(orders, /order_state, payment_option, payment_state/);
  assert.match(activity, /function orderIsDirect\(order: MarketplaceOrder\)/);
  assert.match(activity, /normalizeState\(order\.payment_option\) === 'DIRECT'/);
  assert.match(activity, /function orderIsPaid\(order: MarketplaceOrder\)[\s\S]*?PAYMENT_SECURED/);
  assert.match(activity, /function orderCanProgress\(order: MarketplaceOrder\)[\s\S]*?DIRECT_ARRANGED/);
  assert.match(activity, /Direct payment · not verified by CampusTrader/);
});

test('direct orders can be accepted by the seller without being described as paid or protected', async () => {
  const activity = await read('../components/OrdersActivity.tsx');

  assert.match(activity, /canSellerRespond = !isBuying && orderCanProgress\(order\)/);
  assert.match(activity, /Direct payment is arranged between you and the buyer/);
  assert.match(activity, /CampusTrader does not receive or verify it/);
  assert.match(activity, /orderIsDirect\(order\) \? 'Order accepted\\. Agree on direct payment/);
  assert.match(activity, /canSellerConfirmHandover = !isBuying && isSelfPickup && orderIsPaid\(order\)/);
});

test('direct pickup receipt can only be confirmed after seller acceptance', async () => {
  const activity = await read('../components/OrdersActivity.tsx');

  assert.match(activity, /directPickupReady = orderIsDirect\(order\)[\s\S]*?isSelfPickup[\s\S]*?SELLER_ACCEPTED/);
  assert.match(activity, /orderIsDirect\(order\) \? isSelfPickup \? 'Confirm collection'/);
  assert.match(activity, /Only confirm after you have physically collected and checked the item/);
  assert.match(activity, /Confirm collection\. Direct payment remains between you and the buyer/);
});

test('direct D-Delivery receipt waits for the buyer-visible delivery record to arrive', async () => {
  const [orders, activity] = await Promise.all([
    read('../lib/orders.ts'),
    read('../components/OrdersActivity.tsx'),
  ]);

  assert.match(orders, /getBuyerDeliveryStatus\(orderId: string, buyerId: string\)/);
  assert.match(orders, /\\.from\\('deliveries'\\)[\\s\\S]*?\\.eq\\('order_id', orderId\\)[\\s\\S]*?\\.eq\\('buyer_id', buyerId/);
  assert.match(activity, /getBuyerDeliveryStatus\(String\(orderId\), userId\)/);
  assert.match(activity, /directDeliveryReady = orderIsDirect\(order\)[\s\S]*?ARRIVED', 'DELIVERED/);
  assert.match(activity, /Confirm delivery received/);
  assert.match(activity, /Receipt confirmation appears after the backend records arrival/);
});

test('direct requests can be cancelled before seller acceptance without using the protected-payment cancellation gate', async () => {
  const activity = await read('../components/OrdersActivity.tsx');
  assert.match(activity, /canCancelDirectRequest = isBuying[\s\S]*?DIRECT_ARRANGED[\s\S]*?orderState === 'CREATED'/);
  assert.match(activity, /canCancelUnpaidProtected = isBuying && !orderIsDirect\(order\)/);
  assert.match(activity, /Cancel order request/);
  assert.match(activity, /CampusTrader does not receive or verify any direct payment/);
});

test('direct completed orders can be reviewed after buyer receipt while protected seller handover remains secured-only', async () => {
  const activity = await read('../components/OrdersActivity.tsx');
  assert.match(activity, /submitReview\(order: MarketplaceOrder\)[\s\S]*?!orderCanProgress\(order\)/);
  assert.match(activity, /completedReceipt = isBuying[\s\S]*?orderCanProgress\(order\)[\s\S]*?buyerReceiptState === 'CONFIRMED'/);
  assert.match(activity, /canSellerConfirmHandover = !isBuying && isSelfPickup && orderIsPaid\(order\)/);
});
