-- Record administrator report actions without weakening the existing action-type allowlist.
alter table public.admin_actions
  drop constraint if exists admin_actions_action_type_check;

alter table public.admin_actions
  add constraint admin_actions_action_type_check
  check (
    action_type = any (array[
      'user_suspend',
      'user_unblock',
      'user_verify',
      'user_warn',
      'business_approve',
      'business_reject',
      'business_revoke',
      'business_suspend',
      'business_terminate',
      'listing_hide',
      'listing_restore',
      'listing_delete',
      'listing_report',
      'verification_approve',
      'verification_reject',
      'verification_revoke',
      'report_resolve',
      'user_ban',
      'business_post_payment_approve',
      'business_post_payment_reject'
    ]::text[])
  );
