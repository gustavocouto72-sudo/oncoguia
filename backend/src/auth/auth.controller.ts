import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { PERFIS, type Perfil } from '../database/entities';

class LoginDto {
  @IsString() @IsNotEmpty({ message: 'Login obrigatório' }) login: string;
  @IsString() @IsNotEmpty({ message: 'Senha obrigatória' }) senha: string;
}

class TrocarPerfilDto {
  @IsIn(PERFIS, { message: 'Perfil inválido' }) perfil: Perfil;
}

class AlterarSenhaDto {
  @IsString() @IsNotEmpty({ message: 'Senha atual obrigatória' }) senha_atual: string;
  @IsString() @MinLength(6, { message: 'Nova senha deve ter no mínimo 6 caracteres' }) senha_nova: string;
}

type ReqUser = { user: { id: number; perfil: Perfil } };

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.login, dto.senha);
  }

  @UseGuards(JwtAuthGuard)
  @Get('perfil')
  perfil(@Request() req: ReqUser) {
    return this.authService.perfil(req.user.id, req.user.perfil);
  }

  // Troca de chapéu: token NOVO com outro perfil DA LISTA do usuário. Sem throttle
  // próprio — não é porta de entrada (exige JWT válido) e nem cria sessão nova, só
  // reemite a que já existe com outro perfil ativo.
  @UseGuards(JwtAuthGuard)
  @Post('trocar-perfil')
  trocarPerfil(@Request() req: ReqUser, @Body() dto: TrocarPerfilDto) {
    return this.authService.trocarPerfil(req.user.id, dto.perfil);
  }

  @UseGuards(JwtAuthGuard)
  @Post('alterar-senha')
  alterarSenha(@Request() req: ReqUser, @Body() dto: AlterarSenhaDto) {
    return this.authService.alterarSenha(req.user.id, dto.senha_atual, dto.senha_nova);
  }
}
