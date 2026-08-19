import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/jwt.guard';

// Corpus de protocolos (output do squad, empacotado por app/build-data.py em
// backend/data/evidencia.json). Antes era servido como arquivo estático público
// (app/data.js); agora só sai daqui, atrás de JWT — quem não está logado não
// enxerga nenhum protocolo.
@Controller('evidencia')
export class EvidenciaController {
  @UseGuards(JwtAuthGuard)
  @Get()
  evidencia() {
    // cwd cobre o dev local (node dist/main em backend/); __dirname cobre o build
    // serverless (Vercel), onde o cwd não é a raiz do backend.
    const candidatos = [
      process.env.ONCOGUIA_EVIDENCIA_PATH,
      path.resolve(process.cwd(), 'data', 'evidencia.json'),
      path.resolve(__dirname, '..', '..', '..', 'data', 'evidencia.json'),
    ].filter(Boolean) as string[];
    for (const p of candidatos) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
      } catch {
        /* tenta o próximo */
      }
    }
    throw new NotFoundException(
      'Evidência não encontrada — rode python3 app/build-data.py para gerar backend/data/evidencia.json',
    );
  }
}
