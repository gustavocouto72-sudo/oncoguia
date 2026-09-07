import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario, Perfil } from '../database/entities';
import { publico } from '../usuarios/usuarios.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private usuarioRepo: Repository<Usuario>,
    private jwtService: JwtService,
  ) {}

  // Um token carrega UM perfil ativo. No login ele é o padrão da conta (`usuario.perfil`),
  // que o CHECK do banco garante estar em `usuario.perfis`.
  private emitir(usuario: Usuario, perfil: Perfil) {
    const payload = { sub: usuario.id, login: usuario.login, perfil };
    return {
      access_token: this.jwtService.sign(payload),
      // `usuario` traz `perfil` (o ATIVO desta sessão, não o padrão da conta) e `perfis`
      // (a lista) — é com esses dois que a app decide entre badge estático e seletor.
      // Inclui também a identificação profissional: é ela que pré-preenche o bloco do
      // solicitante na guia TISS sem uma segunda ida ao backend.
      usuario: { ...publico(usuario), perfil },
    };
  }

  async login(login: string, senha: string) {
    const usuario = await this.usuarioRepo.findOneBy({ login, ativo: true });
    if (!usuario) throw new UnauthorizedException('Usuário ou senha inválidos');
    const ok = await bcrypt.compare(senha, usuario.senha_hash);
    if (!ok) throw new UnauthorizedException('Usuário ou senha inválidos');
    return this.emitir(usuario, usuario.perfil);
  }

  // TROCA DE CHAPÉU — o único caminho para um perfil ativo diferente.
  //
  // A validação é contra a LISTA do usuário autenticado, lida do banco AGORA (não do
  // token): pedir um perfil que não está nela é 403, inclusive batendo direto na URL com
  // um JWT válido. É aqui que "vários chapéus" para de ser uma promessa da tela e vira
  // uma regra — a app esconde as opções que a pessoa não tem, mas quem recusa é isto.
  async trocarPerfil(userId: number, perfil: Perfil) {
    const usuario = await this.usuarioRepo.findOneBy({ id: userId, ativo: true });
    if (!usuario) throw new UnauthorizedException('Sessão inválida');
    const perfis = usuario.perfis || [usuario.perfil];
    if (!perfis.includes(perfil)) {
      throw new ForbiddenException(`Perfil "${perfil}" não está atribuído a este usuário`);
    }
    return this.emitir(usuario, perfil);
  }

  // O boot da app revalida a sessão por aqui. O perfil devolvido é o ATIVO (do token, que
  // o JwtStrategy já conferiu contra a lista) — devolver `u.perfil` faria um F5 desfazer a
  // troca na tela enquanto o token seguia com o outro chapéu: tela e guard discordando.
  async perfil(userId: number, perfilAtivo: Perfil) {
    const u = await this.usuarioRepo.findOneBy({ id: userId });
    if (!u) throw new UnauthorizedException();
    return { ...publico(u), perfil: perfilAtivo };
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
