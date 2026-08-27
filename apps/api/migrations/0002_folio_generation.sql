-- Generación de folio — formato A: código de eventualidad + consecutivo
-- global de 6 dígitos (ej. LAF-000123). Se calcula una sola vez, en el
-- INSERT, vía trigger — nunca se regenera, ni al reclasificar (el
-- trigger es BEFORE INSERT únicamente, no dispara en UPDATE).

-- ⚠️ PENDIENTE — número base provisional, no definitivo:
-- 26409 se eligió porque el export de Tactica que tenemos a mano
-- ("RIGO  MATAMOROS al 170826.xlsx") es del 17-ago-2026 y el folio más
-- alto visible ahí es LAF0026408. Entre esa fecha y el arranque real
-- de este sistema en producción, Tactica sigue generando folios que
-- no están en ese export. Antes de B7 (migración de legados) o de ir
-- a producción, hay que:
--   1) Pedir un export fresco de Tactica (o el acceso de lectura del
--      punto abierto #3 en CLAUDE.md §10).
--   2) Confirmar el folio numérico más alto real a esa fecha.
--   3) Correr `alter sequence folio_seq restart with <ese_numero + 1>;`
--      antes de que folio_seq empiece a emitir folios reales — si ya
--      se generaron folios con la base provisional, hay que evaluar
--      colisión contra el export fresco antes del restart.
create sequence if not exists folio_seq start with 26409;

create or replace function set_folio()
returns trigger as $$
begin
  if new.folio is null then
    new.folio := new.eventualidad_cod || '-' || lpad(nextval('folio_seq')::text, 6, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_reportes_set_folio
  before insert on reportes
  for each row
  execute function set_folio();
