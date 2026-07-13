-- Domain-restricted sign-up: anyone with a Google account on an allowed domain can
-- create an account; anyone else is rejected before the account is ever created.
--
-- This function is meant to be wired up as a Supabase Auth "Before User Created" hook
-- (Dashboard -> Authentication -> Hooks -> Before User Created -> select this function).
-- That wiring is a dashboard action, not something a SQL migration can do by itself --
-- see SETUP_LOVABLE.md Section 3 for the exact click path.
--
-- Raising an exception here aborts the sign-up entirely (the person sees an error on
-- Google's redirect back, no row is written to auth.users) -- this is the real gate,
-- stronger than any client-side check, since it runs server-side before the account
-- exists at all.

create or replace function public.restrict_signup_to_moxie_domain(event jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  user_email text;
  allowed_domains text[] := array['joinmoxie.com'];
  email_domain text;
begin
  user_email := lower(coalesce(event->'user'->>'email', ''));
  email_domain := split_part(user_email, '@', 2);

  if email_domain is null or email_domain = '' or not (email_domain = any(allowed_domains)) then
    raise exception 'Sign-up is restricted to % accounts', array_to_string(allowed_domains, ', ');
  end if;

  return jsonb_build_object('decision', 'continue');
end;
$$;

-- Grant the auth hook system access to call this function.
grant execute on function public.restrict_signup_to_moxie_domain(jsonb) to supabase_auth_admin;
