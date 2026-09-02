import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Request, UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { randomInt } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { UsuariosService } from './usuarios.service';
import type { Perfil } from '../database/entities';

// Perfis atribuíveis na tela de admin. 'auditor' entra aqui como eixo próprio: decide
// solicitação de exceção (protocolo Inelegível/Não incorporado) e mais nada — não herda
// nem cede permissão de nenhum outro perfil.
const PERFIS: Perfil[] = ['oncologista', 'revisor', 'auditor', 'admin'];

// Senha temporária aleatória por usuário (alfabeto sem caracteres ambíguos: 0/O, 1/l/I).
function gerarSenhaTemporaria(tamanho = 10): string {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let senha = '';
  for (let i = 0; i < tamanho; i++) senha += alfabeto[randomInt(alfabeto.length)];
  return senha;
}

class CriarUsuarioDto {
  @IsString() @IsNotEmpty({ message: 'Nome obrigatório' }) nome: string;
  @IsString() @IsNotEmpty({ message: 'Login obrigatório' }) login: string;
  @IsIn(PERFIS, { message: 'Perfil inválido' }) perfil: Perfil;
}

class AtualizarUsuarioDto {
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsString() login?: string;
  @IsOptional() @IsString() @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres' }) senha?: string;
  @IsOptional() @IsIn(PERFIS, { message: 'Perfil inválido' }) perfil?: Perfil;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

type ReqUser = { user: { id: number } };

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private service: UsuariosService) {}

  @Get()
  @Roles('admin')
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @Roles('admin')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post()
  @Roles('admin')
  async create(@Body() dto: CriarUsuarioDto) {
    const senha = gerarSenhaTemporaria();
    const usuario = await this.service.create({ ...dto, senha });
    return { ...usuario, senha_temporaria: senha };
  }

  @Patch(':id')
  @Roles('admin')
  update(@Request() req: ReqUser, @Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarUsuarioDto) {
    if (req.user.id === id && dto.ativo === false) {
      throw new BadRequestException('Você não pode desativar o próprio usuário');
    }
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Request() req: ReqUser, @Param('id', ParseIntPipe) id: number) {
    if (req.user.id === id) throw new BadRequestException('Você não pode remover o próprio usuário');
    return this.service.remove(id);
  }
}
