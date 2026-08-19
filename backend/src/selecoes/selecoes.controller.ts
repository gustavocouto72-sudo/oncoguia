import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { SelecoesService } from './selecoes.service';

class CriarSelecaoDto {
  @IsInt() paciente_id: number;
  @IsString() @IsNotEmpty() @MaxLength(160) regimen_id: string;
  @IsString() @IsNotEmpty() @MaxLength(255) protocolo_nome: string;
  @IsOptional() @IsString() @MaxLength(60) tumor?: string;
  @IsOptional() @IsObject() dados_clinicos?: Record<string, any>;
  @IsOptional() @IsString() justificativa?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('selecoes')
export class SelecoesController {
  constructor(private selecoesService: SelecoesService) {}

  @Post()
  criar(@Body() dto: CriarSelecaoDto, @Request() req: { user: { id: number } }) {
    return this.selecoesService.criar(dto, req.user.id);
  }
}
