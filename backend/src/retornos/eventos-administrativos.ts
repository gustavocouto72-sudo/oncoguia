import { EventoAdministrativo } from '../database/entities';

// Evento administrativo (reagendamento / contato) na forma em que sai da API — a ficha da
// secretaria e a trilha do médico usam o MESMO mapa: o médico vê exatamente o que ela
// registrou, com autor e perfil ativo.
export function mapEventoAdministrativo(e: EventoAdministrativo) {
  return {
    id: e.id,
    paciente_id: e.paciente_id,
    tipo: e.tipo,
    data: e.data,
    data_anterior: e.data_anterior,
    meio: e.meio,
    nota: e.nota,
    criado_em: e.criado_em,
    por: e.registradoPor
      ? { id: e.registradoPor.id, nome: e.registradoPor.nome, perfil: e.perfil_ativo || e.registradoPor.perfil }
      : null,
  };
}
