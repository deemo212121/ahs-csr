-- ER RPC: approve portal request into the official ER tickets table
-- Run this in the ER Supabase SQL Editor.
-- Safe scope:
-- - Creates/replaces one function: public.approve_portal_request_to_ticket(uuid)
-- - Does NOT alter, drop, truncate, update, or delete public.tickets.
-- - The function inserts ONE new public.tickets row only when your website calls it for an approved request.
-- - The function updates only public.portal_service_requests sync fields for the request being approved/retried.

create or replace function public.approve_portal_request_to_ticket(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.portal_service_requests%rowtype;
  v_company_id uuid;
  v_ticket_id uuid;
  v_ticket_no text;
  v_error text;
begin
  select *
  into v_req
  from public.portal_service_requests
  where id = p_request_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'Portal service request was not found.'
    );
  end if;

  if v_req.verification_status <> 'approved' then
    return jsonb_build_object(
      'ok', false,
      'error', 'Only approved portal service requests can be posted to tickets.'
    );
  end if;

  -- If already linked, return the existing link.
  if v_req.er_ticket_id is not null then
    return jsonb_build_object(
      'ok', true,
      'er_ticket_id', v_req.er_ticket_id,
      'er_ticket_no', coalesce(v_req.er_ticket_no, v_req.request_number),
      'message', 'Portal request is already linked to an ER ticket.'
    );
  end if;

  -- If a ticket already exists with the same ticket number, link to it instead of creating a duplicate.
  select id, ticket_no
  into v_ticket_id, v_ticket_no
  from public.tickets
  where ticket_no = v_req.request_number
  limit 1;

  if v_ticket_id is not null then
    update public.portal_service_requests
    set
      er_ticket_id = v_ticket_id,
      er_ticket_no = coalesce(v_ticket_no, v_req.request_number),
      sync_status = 'synced_to_er',
      sync_error = null,
      last_synced_at = now()
    where id = p_request_id;

    return jsonb_build_object(
      'ok', true,
      'er_ticket_id', v_ticket_id,
      'er_ticket_no', coalesce(v_ticket_no, v_req.request_number),
      'message', 'Existing ER ticket found and linked.'
    );
  end if;

  v_company_id := v_req.company_id;

  -- Defensive fallback if an older request somehow has no company_id.
  if v_company_id is null then
    select id
    into v_company_id
    from public.companies
    where coalesce(is_active, true) = true
    order by created_at nulls last, id
    limit 1;
  end if;

  if v_company_id is null then
    select company_id
    into v_company_id
    from public.tickets
    where company_id is not null
    group by company_id
    order by count(*) desc
    limit 1;
  end if;

  if v_company_id is null then
    update public.portal_service_requests
    set
      sync_status = 'sync_failed',
      sync_error = 'Missing company_id. portal_service_requests.company_id is null and no fallback company was found.',
      last_synced_at = now()
    where id = p_request_id;

    return jsonb_build_object(
      'ok', false,
      'error', 'Missing company_id. portal_service_requests.company_id is null and no fallback company was found.'
    );
  end if;

  begin
    insert into public.tickets (
      company_id,
      ticket_no,
      customer_id,
      location_id,
      assigned_tech_id,
      ticket_source,
      warranty,
      manufacturer,
      account,
      claim_company,
      model,
      model_version,
      serial,
      product_type,
      purchase_date
    ) values (
      v_company_id,
      v_req.request_number,
      null,
      null,
      null,
      coalesce(nullif(v_req.ticket_source, ''), 'Customer Portal'),
      nullif(v_req.warranty_type, ''),
      nullif(v_req.manual_brand, ''),
      null,
      null,
      nullif(v_req.model_number, ''),
      nullif(v_req.product_model_version, ''),
      nullif(v_req.serial_number, ''),
      nullif(v_req.manual_appliance_type, ''),
      v_req.purchase_date
    )
    returning id, ticket_no into v_ticket_id, v_ticket_no;
  exception
    when unique_violation then
      select id, ticket_no
      into v_ticket_id, v_ticket_no
      from public.tickets
      where ticket_no = v_req.request_number
      limit 1;

      if v_ticket_id is null then
        raise;
      end if;
    when others then
      v_error := sqlerrm;

      update public.portal_service_requests
      set
        sync_status = 'sync_failed',
        sync_error = v_error || ' | attempted company_id=' || coalesce(v_company_id::text, 'NULL'),
        last_synced_at = now()
      where id = p_request_id;

      return jsonb_build_object(
        'ok', false,
        'error', v_error,
        'attempted_company_id', v_company_id
      );
  end;

  update public.portal_service_requests
  set
    company_id = v_company_id,
    er_ticket_id = v_ticket_id,
    er_ticket_no = coalesce(v_ticket_no, v_req.request_number),
    sync_status = 'synced_to_er',
    sync_error = null,
    last_synced_at = now()
  where id = p_request_id;

  return jsonb_build_object(
    'ok', true,
    'er_ticket_id', v_ticket_id,
    'er_ticket_no', coalesce(v_ticket_no, v_req.request_number),
    'message', 'Approved portal request was inserted into ER tickets.'
  );
end;
$$;

revoke all on function public.approve_portal_request_to_ticket(uuid) from public, anon, authenticated;
grant execute on function public.approve_portal_request_to_ticket(uuid) to service_role;
