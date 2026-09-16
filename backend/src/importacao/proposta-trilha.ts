import { ImportacaoProposta } from '../database/entities';

// Proposta de importação na forma em que entra na TRILHA do médico: um evento
// administrativo ("proposta de importação por <secretária> em <data>"), no dia em que foi
// enviada, com o desfecho junto quando já decidida. Lida direto de `importacao_propostas`
// — a proposta é a própria fonte, não há linha em eventos_administrativos. Mesmo papel do
// mapEventoAdministrativo para reagendamento/contato.
export function mapPropostaTrilha(p: ImportacaoProposta) {
  return {
    tipo: 'administrativo',
    evento: 'proposta_importacao',
    id: p.id,
    proposta_id: p.id,
    estado: p.estado,
    criado_em: p.criada_em,
    data: p.criada_em,
    decidida_em: p.validada_em,
    motivo_descarte: p.motivo_descarte,
    resultado: p.resultado
      ? { vigente: !!p.resultado.vigente, regimen_id: p.resultado.regimen_id, motivo: p.resultado.motivo, avaliacao_id: p.resultado.avaliacao_id }
      : null,
    por: p.criadaPor ? { id: p.criadaPor.id, nome: p.criadaPor.nome, perfil: p.perfil_ativo || p.criadaPor.perfil } : null,
    decidida_por: p.validadaPor ? { id: p.validadaPor.id, nome: p.validadaPor.nome } : null,
    nota: `Proposta de importação por ${p.criadaPor ? p.criadaPor.nome : '—'}`,
  };
}
