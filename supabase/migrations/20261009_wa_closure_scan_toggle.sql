-- Optional one-by-one closure notification campaign. No automatic start.
alter table public.wa_movement_campaigns add column if not exists auto_close_after_sent boolean not null default false;
alter table public.wa_movement_campaigns drop constraint if exists wa_movement_campaigns_kind_valid;
alter table public.wa_movement_campaigns add constraint wa_movement_campaigns_kind_valid
 check(campaign_kind in ('movement','publication','closure_scan'));
-- Only consented sends, never close cases when delivery failed/uncertain.
-- The worker updates the case independently after a confirmed send.
