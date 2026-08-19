import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';

class LoginDto {
  @IsString() @IsNotEmpty({ message: 'Login obrigatório' }) login: string;
  @IsString() @IsNotEmpty({ message: 'Senha obrigatória' }) senha: string;
}

class AlterarSenhaDto {
  @IsString() @IsNotEmpty({ message: 'Senha atual obrigatória' }) senha_atual: string;
  @IsString() @MinLength(6, { message: 'Nova senha deve ter no mínimo 6 caracteres' }) senha_nova: string;
}

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
  perfil(@Request() req: { user: { id: number } }) {
    return this.authService.perfil(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('alterar-senha')
  alterarSenha(@Request() req: { user: { id: number } }, @Body() dto: AlterarSenhaDto) {
    return this.authService.alterarSenha(req.user.id, dto.senha_atual, dto.senha_nova);
  }
}
