-- Orden manual de tarjetas en columnas Kanban (menor = más arriba).
alter table public.appointments
  add column if not exists board_sort_order integer;

comment on column public.appointments.board_sort_order is 'Orden en columna Kanban; null = sin posición fija (se ordena por start_time).';

create index if not exists appointments_pipeline_stage_board_sort_idx
  on public.appointments (pipeline_stage_id, board_sort_order);
