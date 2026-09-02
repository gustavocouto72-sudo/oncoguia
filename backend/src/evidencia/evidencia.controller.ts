import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { EvidenciaService } from './evidencia.service';

// Corpus de protocolos (output do squad, empacotado por app/build-data.py em
// backend/data/evidencia.json). Antes era servido como arquivo estático público
// (app/data.js); agora só sai daqui, atrás de JWT — quem não está logado não
// enxerga nenhum protocolo.
@Controller('evidencia')
export class EvidenciaController {
  constructor(private evidencia: EvidenciaService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  evidenciaJson() {
    return this.evidencia.carregar();
  }
}
