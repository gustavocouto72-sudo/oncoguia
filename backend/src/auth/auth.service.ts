import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../database/entities';
import { publico } from '../usuarios/usuarios.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private usuarioRepo: Repository<Usuario>,
    private jwtService: JwtService,
  ) {}

  async login(login: string, senha: string) {
    const usuario = await this.usuarioRepo.findOneBy({ login, ativo: true });
    if (!usuario) throw new UnauthorizedException('Usuário ou senha inválidos');
    const ok = await bcrypt.compare(senha, usuario.senha_hash);
    if (!ok) throw new UnauthorizedException('Usuário ou senha inválidos');
    const payload = { sub: usuario.id, login: usuario.login, perfil: usuario.perfil };
    return {
      access_token: this.jwtService.sign(payload),
      // Inclui a identificação profissional: é ela que pré-preenche o bloco do
      // solicitante na guia TISS sem uma segunda ida ao backend.
      usuario: publico(usuario),
    };
  }

  async perfil(userId: number) {
    const u = await this.usuarioRepo.findOneBy({ id: userId });
    if (!u) throw new UnauthorizedException();
    return publico(u);
  }

  async alterarSenha(userId: number, senhaAtual: string, senhaNova: string) {
    const u = await this.usuarioRepo.findOneBy({ id: userId });
    if (!u) throw new UnauthorizedException();
    const ok = await bcrypt.compare(senhaAtual, u.senha_hash);
    if (!ok) throw new UnauthorizedException('Senha atual incorreta');
    u.senha_hash = await bcrypt.hash(senhaNova, 10);
    await this.usuarioRepo.save(u);
    return { mensagem: 'Senha alterada com sucesso' };
  }
}
