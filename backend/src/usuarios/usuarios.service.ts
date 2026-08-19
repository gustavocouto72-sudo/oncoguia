import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario, Perfil } from '../database/entities';

@Injectable()
export class UsuariosService {
  constructor(@InjectRepository(Usuario) private repo: Repository<Usuario>) {}

  findAll() {
    return this.repo.find({ select: ['id', 'nome', 'login', 'perfil', 'ativo'], order: { nome: 'ASC' } });
  }

  async findOne(id: number) {
    const u = await this.repo.findOne({ where: { id }, select: ['id', 'nome', 'login', 'perfil', 'ativo'] });
    if (!u) throw new NotFoundException('Usuário não encontrado');
    return u;
  }

  async create(dto: { nome: string; login: string; senha: string; perfil: Perfil }) {
    const existe = await this.repo.findOneBy({ login: dto.login });
    if (existe) throw new BadRequestException('Login já está em uso');
    const hash = await bcrypt.hash(dto.senha, 10);
    const salvo = await this.repo.save({ nome: dto.nome, login: dto.login, senha_hash: hash, perfil: dto.perfil });
    return { id: salvo.id, nome: salvo.nome, login: salvo.login, perfil: salvo.perfil, ativo: salvo.ativo };
  }

  async update(id: number, dto: { nome?: string; login?: string; senha?: string; perfil?: Perfil; ativo?: boolean }) {
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
    await this.repo.save(u);
    return { id: u.id, nome: u.nome, login: u.login, perfil: u.perfil, ativo: u.ativo };
  }

  async remove(id: number) {
    const u = await this.repo.findOneBy({ id });
    if (!u) throw new NotFoundException('Usuário não encontrado');
    await this.repo.remove(u);
    return { mensagem: 'Usuário removido' };
  }
}
