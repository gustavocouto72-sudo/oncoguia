import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario, Perfil, PERFIS } from '../database/entities';

// Campos devolvidos pela API de usuários. Os quatro últimos são a identificação
// profissional usada no bloco "Profissional Solicitante" da guia TISS SP/SADT.
const CAMPOS = [
  'id', 'nome', 'login', 'perfil', 'perfis', 'ativo',
  'conselho', 'numero_conselho', 'uf_conselho', 'cbos',
] as const;

// Dados de conselho: opcionais e livremente apagáveis (string vazia → null), porque um
// cadastro incompleto é estado legítimo — a guia simplesmente imprime o campo em branco.
export type DadosProfissionais = {
  conselho?: string; numero_conselho?: string; uf_conselho?: string; cbos?: string;
};
const PROFISSIONAIS: (keyof DadosProfissionais)[] = ['conselho', 'numero_conselho', 'uf_conselho', 'cbos'];

// UF sobe para maiúscula aqui, não só na tela: quem grava pela API não deve conseguir
// deixar "mg" no banco e "MG" na guia impressa do colega ao lado.
function normaliza(campo: keyof DadosProfissionais, v: string | undefined) {
  const t = (v ?? '').trim();
  if (t === '') return null;
  return campo === 'uf_conselho' ? t.toUpperCase() : t;
}

// `perfis` cai no fallback [perfil] para o caso de uma linha lida antes da migration
// (ou por um SELECT que não trouxe a coluna): a app não pode receber lista vazia — ela
// decide entre badge estático e seletor pelo tamanho dela.
export function publico(u: Usuario) {
  return {
    id: u.id, nome: u.nome, login: u.login, perfil: u.perfil,
    perfis: (u.perfis && u.perfis.length ? u.perfis : [u.perfil]),
    ativo: u.ativo,
    conselho: u.conselho ?? null, numero_conselho: u.numero_conselho ?? null,
    uf_conselho: u.uf_conselho ?? null, cbos: u.cbos ?? null,
  };
}

// A LISTA de perfis, normalizada: sem repetido, sem vazio, ordem estável (a do
// vocabulário, não a de digitação — assim a tela não muda de ordem entre dois saves).
function normalizaPerfis(perfis: Perfil[]): Perfil[] {
  const set = new Set(perfis);
  return PERFIS.filter((p) => set.has(p));
}

// O PERFIL ATIVO PADRÃO tem de estar na lista — é invariante do banco (CHK_usuarios_perfis),
// e violá-lo daria um 500 de constraint em vez de uma mensagem. Quando a lista muda e o
// padrão sai dela, o padrão passa a ser o primeiro item: a pessoa continua entrando.
function defaultAtivo(atual: Perfil, perfis: Perfil[]): Perfil {
  return perfis.includes(atual) ? atual : perfis[0];
}

@Injectable()
export class UsuariosService {
  constructor(@InjectRepository(Usuario) private repo: Repository<Usuario>) {}

  findAll() {
    return this.repo.find({ select: [...CAMPOS], order: { nome: 'ASC' } });
  }

  async findOne(id: number) {
    const u = await this.repo.findOne({ where: { id }, select: [...CAMPOS] });
    if (!u) throw new NotFoundException('Usuário não encontrado');
    return u;
  }

  async create(
    dto: { nome: string; login: string; senha: string; perfis: Perfil[] } & DadosProfissionais,
  ) {
    const existe = await this.repo.findOneBy({ login: dto.login });
    if (existe) throw new BadRequestException('Login já está em uso');
    const perfis = normalizaPerfis(dto.perfis);
    if (!perfis.length) throw new BadRequestException('Selecione ao menos um perfil');
    const hash = await bcrypt.hash(dto.senha, 10);
    const novo = this.repo.create({
      nome: dto.nome, login: dto.login, senha_hash: hash, perfis, perfil: perfis[0],
    });
    for (const k of PROFISSIONAIS) novo[k] = normaliza(k, dto[k]);
    const salvo = await this.repo.save(novo);
    return publico(salvo);
  }

  async update(
    id: number,
    dto: { nome?: string; login?: string; senha?: string; perfis?: Perfil[]; ativo?: boolean } & DadosProfissionais,
    autorId?: number,
  ) {
    const u = await this.repo.findOneBy({ id });
    if (!u) throw new NotFoundException('Usuário não encontrado');
    if (dto.perfis) {
      const perfis = normalizaPerfis(dto.perfis);
      if (!perfis.length) throw new BadRequestException('Selecione ao menos um perfil');
      // TRAVA ANTI-LOCKOUT: o admin não retira o próprio 'admin'. Com um só administrador
      // — o caso comum — isso trancaria a porta pelo lado de fora: ninguém mais poderia
      // devolvê-lo, porque devolver perfil É rota de admin. Mesma família da trava que já
      // impede desativar e remover a si mesmo, e mesmo motivo: o erro é irreversível pelo
      // produto. Retirar o admin DE OUTRA pessoa continua permitido.
      const tinhaAdmin = (u.perfis && u.perfis.length ? u.perfis : [u.perfil]).includes('admin');
      if (autorId === id && tinhaAdmin && !perfis.includes('admin')) {
        throw new BadRequestException(
          'Você não pode remover o próprio perfil de administrador — peça a outro admin.',
        );
      }
      u.perfis = perfis;
      u.perfil = defaultAtivo(u.perfil, perfis);
    }
    if (dto.login && dto.login !== u.login) {
      const existe = await this.repo.findOneBy({ login: dto.login });
      if (existe) throw new BadRequestException('Login já está em uso');
      u.login = dto.login;
    }
    if (dto.nome) u.nome = dto.nome;
    if (dto.ativo !== undefined) u.ativo = dto.ativo;
    if (dto.senha) u.senha_hash = await bcrypt.hash(dto.senha, 10);
    // Chave ausente = não mexe; chave presente vazia = APAGA. Sem isso não haveria como
    // corrigir um CRM digitado errado a não ser digitando outro por cima.
    for (const k of PROFISSIONAIS) if (dto[k] !== undefined) u[k] = normaliza(k, dto[k]);
    await this.repo.save(u);
    return publico(u);
  }

  async remove(id: number) {
    const u = await this.repo.findOneBy({ id });
    if (!u) throw new NotFoundException('Usuário não encontrado');
    await this.repo.remove(u);
    return { mensagem: 'Usuário removido' };
  }
}
