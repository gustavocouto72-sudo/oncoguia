import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paciente, SelecaoProtocolo } from '../database/entities';

@Injectable()
export class SelecoesService {
  constructor(
    @InjectRepository(SelecaoProtocolo) private selecaoRepo: Repository<SelecaoProtocolo>,
    @InjectRepository(Paciente) private pacienteRepo: Repository<Paciente>,
  ) {}

  async criar(dados: Partial<SelecaoProtocolo>, usuarioId: number) {
    const paciente = await this.pacienteRepo.findOneBy({ id: dados.paciente_id });
    if (!paciente) throw new NotFoundException('Paciente não encontrado');
    const sel = this.selecaoRepo.create({ ...dados, selecionado_por: usuarioId });
    return this.selecaoRepo.save(sel);
  }
}
