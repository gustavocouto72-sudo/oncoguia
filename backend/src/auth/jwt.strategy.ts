import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario, Perfil } from '../database/entities';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(Usuario) private usuarioRepo: Repository<Usuario>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  // O PERFIL ATIVO VEM DO TOKEN, não do banco — é o token que carrega o chapéu vestido,
  // e é ele que o /auth/trocar-perfil reemite. Ler `usuario.perfil` aqui (como era antes
  // dos perfis múltiplos) faria toda troca ser silenciosamente desfeita na requisição
  // seguinte: o guard veria sempre o perfil PADRÃO da conta.
  //
  // E porque o token manda, ele é conferido CONTRA A LISTA a cada requisição: admin que
  // retira um perfil de alguém corta o acesso na hora, sem esperar o token expirar. Sem
  // esta checagem, um token de 8h emitido antes da mudança continuaria valendo — que é a
  // forma mais comum de "revoguei o acesso e ele continuou entrando".
  async validate(payload: { sub: number; login: string; perfil: Perfil }) {
    const usuario = await this.usuarioRepo.findOneBy({ id: payload.sub, ativo: true });
    if (!usuario) throw new UnauthorizedException('Sessão inválida');
    const perfis = usuario.perfis || [usuario.perfil];
    if (!payload.perfil || !perfis.includes(payload.perfil)) {
      throw new UnauthorizedException('Perfil da sessão não está mais atribuído a este usuário');
    }
    return { id: usuario.id, login: usuario.login, perfil: payload.perfil, nome: usuario.nome };
  }
}
