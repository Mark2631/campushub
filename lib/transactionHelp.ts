export const transactionHelpTopics = [
  {
    title: 'Buying and checkout',
    content: 'Place orders only for active product listings that support direct purchase. Select a quantity and either free pickup or an available D-Delivery zone, then review the item amount, displayed fees, and backend-calculated total before continuing.',
  },
  {
    title: 'M-PESA payment confirmation',
    content: 'Protected payment is manual for now. After the seller accepts, pay using the configured CampusTrader instructions and submit the M-PESA reference. A reference or screenshot is not proof of payment; only an authorized administrator can confirm funds. Direct payments between buyer and seller are not verified or protected by CampusTrader.',
  },
  {
    title: 'Pickup and D-Delivery',
    content: 'Pickup is free. D-Delivery is optional and is offered only for destinations and fees configured by CampusTrader. Provide a clear landmark and receiver details. Delivery progress is shown in Orders; live rider tracking is not part of this version.',
  },
  {
    title: 'Seller acceptance and order status',
    content: 'After verified payment, the seller can accept or decline the order. Check the payment and order status in Orders before arranging handover. A successful payment prompt by itself does not mean the seller has been paid.',
  },
  {
    title: 'Receipt and disputes',
    content: 'Confirm receipt only after the item has arrived and you have checked it. If an order is wrong, damaged, or delayed, open a dispute from Orders and report the issue so the transaction can be reviewed.',
  },
  {
    title: 'Protected orders and release',
    content: '“Protected order” describes the order and payment workflow; it is not a claim of legally regulated escrow. Seller settlement is not automatic in this version. Any release must be recorded through an authorized backend workflow.',
  },
  {
    title: 'Stay safe',
    content: 'Never share your M-PESA PIN, one-time password, or account password. Do not treat screenshots or payment codes sent by another user as confirmation. Use the existing issue-report form for help with a transaction.',
  },
] as const;
