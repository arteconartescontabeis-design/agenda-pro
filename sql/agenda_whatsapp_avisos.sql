-- ============================================================
-- AGENDA PRO — avisos ao cliente por WhatsApp
-- Projeto Supabase do Agenda: vuwgxndahrzinfdlapxz
--
-- Como funciona:
--   1. Gatilho em agenda_agendamentos cria o aviso (confirmação,
--      cancelamento, reagendamento) em agenda_notificacoes, status 'pendente'.
--   2. agenda_whats_gerar_lembretes() cria os lembretes (24 h antes e no dia).
--   3. A Edge Function agenda-whats (chamada pelo pg_cron a cada 2 min e
--      pelo app logo após salvar) reserva os pendentes, monta o texto e
--      coloca na fila do WhatsApp do Cobrança Pro (cob_agenda_enfileirar).
--      Depois acompanha a fila e marca 'enviado' ou 'falha'.
-- Cada tipo de aviso só sai se estiver ligado nas Configurações
-- (agenda_config: whats_confirmacao, whats_lembrete_24h, whats_lembrete_dia,
-- whats_cancelamento, whats_reagendamento) e se o escritório estiver em
-- agenda_whats_tenants (o número é o da Artecon).
-- ============================================================

-- ── 1. Cliente: autoriza avisos por WhatsApp ────────────────
alter table public.agenda_clientes
  add column if not exists whatsapp_avisos boolean not null default true;

-- ── 2. Notificações: campos de envio ────────────────────────
alter table public.agenda_notificacoes
  add column if not exists mensagem      text,
  add column if not exists fila_id       bigint,
  add column if not exists chave         text,
  add column if not exists atualizado_em timestamptz not null default now();
alter table public.agenda_notificacoes alter column agendamento_id drop not null;  -- mensagem de teste não tem agendamento
alter table public.agenda_notificacoes drop constraint if exists agenda_notificacoes_status_check;
alter table public.agenda_notificacoes add constraint agenda_notificacoes_status_check
  check (status in ('pendente','enviando','na_fila','enviado','falha','cancelado'));
alter table public.agenda_notificacoes drop constraint if exists agenda_notificacoes_tipo_check;
alter table public.agenda_notificacoes add constraint agenda_notificacoes_tipo_check
  check (tipo in ('lembrete_24h','lembrete_dia','confirmacao','cancelamento','reagendamento','teste'));
create unique index if not exists agenda_notificacoes_chave_uk on public.agenda_notificacoes (chave);
create index if not exists agenda_notificacoes_abertas_ix on public.agenda_notificacoes (status)
  where status in ('pendente','enviando','na_fila');
create index if not exists agenda_notificacoes_ag_ix on public.agenda_notificacoes (agendamento_id);

-- ── 3. Escritórios liberados para usar o WhatsApp da Artecon ─
create table if not exists public.agenda_whats_tenants (
  tenant_id  bigint primary key references public.agenda_tenants(id) on delete cascade,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);
alter table public.agenda_whats_tenants enable row level security;
drop policy if exists whats_tenants_select on public.agenda_whats_tenants;
create policy whats_tenants_select on public.agenda_whats_tenants
  for select using (tenant_id = public.agenda_meu_tenant_id());

-- ── 4. Funções auxiliares ───────────────────────────────────
create or replace function public.agenda_whats_cfg(p_tenant bigint, p_chave text)
returns text language sql stable security definer set search_path = public as $$
  select valor from public.agenda_config where tenant_id = p_tenant and chave = p_chave limit 1
$$;

-- Número para WhatsApp (DDD + número, sem 55). Usa o campo WhatsApp;
-- se vazio, aceita o telefone só quando é celular (11 dígitos com 9).
create or replace function public.agenda_whats_fone(p_whatsapp text, p_telefone text)
returns text language sql immutable set search_path = public as $$
  with d as (
    select regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g') w,
           regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g') t
  ), n as (
    select case when length(w) in (12, 13) and left(w, 2) = '55' then substr(w, 3) else w end w,
           case when length(t) in (12, 13) and left(t, 2) = '55' then substr(t, 3) else t end t
      from d
  )
  select case when length(w) in (10, 11) then w
              when length(t) = 11 and substr(t, 3, 1) = '9' then t end
    from n
$$;

-- Cria um aviso pendente, se o tipo estiver ligado e o cliente puder receber.
create or replace function public.agenda_whats_criar(p_ag_id bigint, p_tipo text, p_chave text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_ag   public.agenda_agendamentos%rowtype;
  v_cli  public.agenda_clientes%rowtype;
  v_fone text;
begin
  select * into v_ag from public.agenda_agendamentos where id = p_ag_id;
  if not found then return false; end if;
  if not exists (select 1 from public.agenda_whats_tenants where tenant_id = v_ag.tenant_id and ativo) then return false; end if;
  if coalesce(public.agenda_whats_cfg(v_ag.tenant_id, 'whats_' || p_tipo), 'false') <> 'true' then return false; end if;
  select * into v_cli from public.agenda_clientes where id = v_ag.cliente_id;
  if not found or not v_cli.whatsapp_avisos then return false; end if;
  v_fone := public.agenda_whats_fone(v_cli.whatsapp, v_cli.telefone);
  if v_fone is null then return false; end if;
  insert into public.agenda_notificacoes (tenant_id, agendamento_id, tipo, canal, destinatario, status, chave)
  values (v_ag.tenant_id, v_ag.id, p_tipo, 'whatsapp', v_fone, 'pendente', p_chave)
  on conflict (chave) do nothing;
  return found;
end $$;

-- ── 5. Gatilho: confirmação, cancelamento, reagendamento ────
create or replace function public.agenda_whats_evento()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ep text := extract(epoch from new.data_inicio)::bigint::text;
begin
  begin  -- nunca impede salvar o agendamento
    if new.data_inicio > now() then
      if tg_op = 'INSERT' then
        if new.status = 'confirmado' then
          perform public.agenda_whats_criar(new.id, 'confirmacao', 'confirmacao:' || new.id || ':' || v_ep);
        end if;
      elsif new.status in ('cancelado_cliente', 'cancelado_escritorio')
            and old.status not in ('cancelado_cliente', 'cancelado_escritorio') then
        update public.agenda_notificacoes set status = 'cancelado', erro_detalhe = 'agendamento cancelado', atualizado_em = now()
         where agendamento_id = new.id and status = 'pendente';
        perform public.agenda_whats_criar(new.id, 'cancelamento', 'cancelamento:' || new.id || ':' || v_ep);
      elsif new.data_inicio is distinct from old.data_inicio
            and new.status not in ('cancelado_cliente', 'cancelado_escritorio', 'concluido', 'nao_compareceu') then
        update public.agenda_notificacoes set status = 'cancelado', erro_detalhe = 'agendamento reagendado', atualizado_em = now()
         where agendamento_id = new.id and status = 'pendente';
        perform public.agenda_whats_criar(new.id, 'reagendamento', 'reagendamento:' || new.id || ':' || v_ep);
      elsif new.status = 'confirmado' and old.status in ('solicitado', 'pendente_confirmacao') then
        perform public.agenda_whats_criar(new.id, 'confirmacao', 'confirmacao:' || new.id || ':' || v_ep);
      end if;
    end if;
  exception when others then
    raise warning 'agenda_whats_evento (agendamento %): %', new.id, sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists trg_whats_evento on public.agenda_agendamentos;
create trigger trg_whats_evento
  after insert or update of status, data_inicio on public.agenda_agendamentos
  for each row execute function public.agenda_whats_evento();

-- ── 6. Lembretes (chamado pela Edge Function a cada rodada) ─
-- 24 h: sai quando faltam 24 h (até 12 h, se cair no horário de silêncio),
--       só se o agendamento foi confirmado com mais de 24 h de antecedência.
-- No dia: sai a partir do horário escolhido (padrão 08:00), para os
--       agendamentos do dia confirmados antes desse horário.
-- Nada sai entre 21:00 e 07:00.
create or replace function public.agenda_whats_gerar_lembretes()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_agora timestamp := now() at time zone 'America/Sao_Paulo';
  v_n     integer := 0;
  v_cfg   text;
  v_hora  time;
  r       record;
begin
  if v_agora::time < time '07:00' or v_agora::time >= time '21:00' then return 0; end if;
  for r in
    select a.id, a.tenant_id, a.data_inicio, coalesce(a.confirmado_em, a.criado_em) as base
      from public.agenda_agendamentos a
      join public.agenda_whats_tenants t on t.tenant_id = a.tenant_id and t.ativo
     where a.status = 'confirmado'
       and a.data_inicio >  now() + interval '30 minutes'
       and a.data_inicio <= now() + interval '24 hours'
  loop
    if r.data_inicio > now() + interval '12 hours' and r.base <= r.data_inicio - interval '24 hours' then
      if public.agenda_whats_criar(r.id, 'lembrete_24h', 'lembrete_24h:' || r.id || ':' || extract(epoch from r.data_inicio)::bigint) then
        v_n := v_n + 1;
      end if;
    end if;
    v_cfg  := public.agenda_whats_cfg(r.tenant_id, 'whats_hora_lembrete_dia');
    v_hora := case when v_cfg ~ '^\d{2}:\d{2}$' then v_cfg::time else time '08:00' end;
    if (r.data_inicio at time zone 'America/Sao_Paulo')::date = v_agora::date
       and v_agora::time >= v_hora
       and (r.base at time zone 'America/Sao_Paulo') < (v_agora::date + v_hora) then
      if public.agenda_whats_criar(r.id, 'lembrete_dia', 'lembrete_dia:' || r.id || ':' || extract(epoch from r.data_inicio)::bigint) then
        v_n := v_n + 1;
      end if;
    end if;
  end loop;
  return v_n;
end $$;

-- ── 7. Reserva para envio (evita mandar duas vezes) ─────────
create or replace function public.agenda_whats_reservar(p_limite integer default 20)
returns setof public.agenda_notificacoes language plpgsql security definer set search_path = public as $$
begin
  -- os que travaram em 'enviando' voltam para a fila (até 3 tentativas)
  update public.agenda_notificacoes
     set status = case when tentativas >= 3 then 'falha' else 'pendente' end,
         erro_detalhe = case when tentativas >= 3 then coalesce(erro_detalhe, 'não foi possível colocar na fila') else erro_detalhe end,
         atualizado_em = now()
   where status = 'enviando' and atualizado_em < now() - interval '10 minutes';
  return query
    update public.agenda_notificacoes n
       set status = 'enviando', tentativas = n.tentativas + 1, atualizado_em = now()
     where n.id in (select x.id from public.agenda_notificacoes x
                     where x.status = 'pendente' and x.canal = 'whatsapp'
                     order by x.id for update skip locked limit p_limite)
    returning n.*;
end $$;

-- ── 8. Token da fila do Cobrança (cofre) ────────────────────
create or replace function public.agenda_whats_token()
returns text language sql stable security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'cob_agenda_token' limit 1
$$;

-- ── 9. Mensagem de teste (só administrador) ─────────────────
create or replace function public.agenda_whats_teste(p_telefone text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_t    bigint := public.agenda_meu_tenant_id();
  v_fone text;
  v_id   bigint;
begin
  if v_t is null or public.agenda_meu_perfil() is distinct from 'admin' then
    raise exception 'Só o administrador pode enviar a mensagem de teste.';
  end if;
  if not exists (select 1 from public.agenda_whats_tenants where tenant_id = v_t and ativo) then
    raise exception 'O WhatsApp não está liberado para este escritório.';
  end if;
  v_fone := public.agenda_whats_fone(p_telefone, null);
  if v_fone is null then raise exception 'Telefone inválido: informe DDD + número.'; end if;
  if (select count(*) from public.agenda_notificacoes
       where tenant_id = v_t and tipo = 'teste' and criado_em > now() - interval '1 day') >= 10 then
    raise exception 'Limite de 10 mensagens de teste por dia.';
  end if;
  insert into public.agenda_notificacoes (tenant_id, agendamento_id, tipo, canal, destinatario, status, chave)
  values (v_t, null, 'teste', 'whatsapp', v_fone, 'pendente', 'teste:' || v_t || ':' || gen_random_uuid())
  returning id into v_id;
  return v_id;
end $$;

-- ── 10. Permissões ──────────────────────────────────────────
revoke all on function public.agenda_whats_cfg(bigint, text)              from public, anon, authenticated;
revoke all on function public.agenda_whats_criar(bigint, text, text)      from public, anon, authenticated;
revoke all on function public.agenda_whats_evento()                       from public, anon, authenticated;
revoke all on function public.agenda_whats_gerar_lembretes()              from public, anon, authenticated;
revoke all on function public.agenda_whats_reservar(integer)              from public, anon, authenticated;
revoke all on function public.agenda_whats_token()                        from public, anon, authenticated;
revoke all on function public.agenda_whats_teste(text)                    from public, anon;
grant execute on function public.agenda_whats_gerar_lembretes() to service_role;
grant execute on function public.agenda_whats_reservar(integer) to service_role;
grant execute on function public.agenda_whats_token()           to service_role;
grant execute on function public.agenda_whats_cfg(bigint, text) to service_role;
grant execute on function public.agenda_whats_teste(text)       to authenticated;

-- ── 11. Artecon liberada ────────────────────────────────────
insert into public.agenda_whats_tenants (tenant_id) values (2) on conflict do nothing;
