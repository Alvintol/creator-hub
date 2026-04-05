-- Remove old self-serve seller and Twitch-specific profile columns
-- By this point the data should live in seller_applications and profile_platform_accounts
alter table
  public.profiles drop column if exists creator_enabled,
  drop column if exists twitch_login,
  drop column if exists twitch_user_id,
  drop column if exists twitch_created_at,
  drop column if exists twitch_age_ok,
  drop column if exists twitch_connected_at;