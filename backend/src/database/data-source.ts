import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });
import { DataSource } from 'typeorm';
import * as neon from '@neondatabase/serverless';
import { Usuario, Paciente, SelecaoProtocolo, Avaliacao, Revisao, FonteSugerida, Retorno, CustoRegime, Insumo, Apresentacao, PremissasRecursos } from './entities';

const url = process.env.DATABASE_URL || 'postgres://oncoguia:oncoguia123@localhost:5432/oncoguia';
// Neon: WebSocket na porta 443 — funciona em redes que bloqueiam a 5432
const isNeon = /\.neon\.tech/.test(url);

export const AppDataSource = new DataSource({
  type: 'postgres',
  url,
  driver: isNeon ? neon : undefined,
  entities: [Usuario, Paciente, SelecaoProtocolo, Avaliacao, Revisao, FonteSugerida, Retorno, CustoRegime, Insumo, Apresentacao, PremissasRecursos],
  migrations: [path.join(__dirname, 'migrations', '*.ts')],
  synchronize: false,
  ssl: !isNeon && /supabase|vercel|amazonaws/.test(url)
    ? { rejectUnauthorized: false }
    : false,
});
