import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario, Perfil } from '../database/entities';

// Campos devolvidos pela API de usuários. Os quatro últimos são a identificação
// profissional usada no bloco "Profissional Solicitante" da guia TISS SP/SADT.
const CAMPOS = [
  'id', 'nome', 'login', 'perfil', 'ativo',
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

export function publico(u: Usuario) {
  return {
    id: u.id, nome: u.nome, login: u.login, perfil: u.perfil, ativo: u.ativo,
    conselho: u.conselho ?? null, numero_conselho: u.numero_conselho ?? null,
    uf_conselho: u.uf_conselho ?? null, cbos: u.cbos ?? null,
  };
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

  async create(dto: { nome: string; login: string; senha: string; perfil: Perfil } & DadosProfissionais) {
    const existe = await this.repo.findOneBy({ login: dto.login });
    if (existe) throw new BadRequestException('Login já está em uso');
    const hash = await bcrypt.hash(dto.senha, 10);
    const novo = this.repo.create({ nome: dto.nome, login: dto.login, senha_hash: hash, perfil: dto.perfil });
    for (const k of PROFISSIONAIS) novo[k] = normaliza(k, dto[k]);
    const salvo = await this.repo.save(novo);
    return publico(salvo);
  }

  async update(
    id: number,
    dto: { nome?: string; login?: string; senha?: string; perfil?: Perfil; ativo?: boolean } & DadosProfissionais,
  ) {
    const u = await this.repo.findOneBy({ id });
    if (!u) throw new NotFoundException('Usuário não encontrado');
    if (dto.login && dto.login !== u.login) {
      const existe = await this.repo.findOneBy({ login: dto.login });
      if (existe) throw new BadRequestException('Login já está em uso');
      u.login = dto.login;
    }
    if (dto.nome) u.nome = dto.nome;
    if (dto.perfil) u.perfil = dto.perfil;
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
