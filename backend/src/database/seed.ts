import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario, Paciente } from './entities';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL || 'postgres://oncoguia:oncoguia123@localhost:5432/oncoguia',
  entities: [Usuario, Paciente],
  synchronize: false,
  ssl: /neon|supabase|vercel|amazonaws/.test(process.env.DATABASE_URL || '')
    ? { rejectUnauthorized: false }
    : false,
});

async function seed() {
  await AppDataSource.initialize();
  console.log('Conectado ao banco. Executando seed...');

  const usuarioRepo = AppDataSource.getRepository(Usuario);
  const usuarios: Array<{ nome: string; login: string; senha: string; perfil: Usuario['perfil'] }> = [
    { nome: 'Administrador', login: 'admin', senha: 'admin123', perfil: 'admin' },
    { nome: 'Dr. Oncologista de Teste', login: 'oncologista', senha: 'onco123', perfil: 'oncologista' },
    { nome: 'Dra. Revisora de Teste', login: 'revisor', senha: 'revisor123', perfil: 'revisor' },
    // 2º revisor: tumor board tem >1 parecerista (valida a visibilidade cruzada de decisões).
    { nome: 'Dr. Revisor Dois', login: 'revisor2', senha: 'revisor123', perfil: 'revisor' },
  ];
  for (const u of usuarios) {
    const existente = await usuarioRepo.findOneBy({ login: u.login });
    if (!existente) {
      const hash = await bcrypt.hash(u.senha, 10);
      await usuarioRepo.save({ nome: u.nome, login: u.login, senha_hash: hash, perfil: u.perfil });
      console.log(`Usuário ${u.perfil} criado (login: ${u.login} / senha: ${u.senha})`);
    }
  }

  // Paciente fictício de validação (o mesmo do protótipo estático)
  const pacienteRepo = AppDataSource.getRepository(Paciente);
  const jaTem = await pacienteRepo.findOneBy({ nome: 'Maria Alves de Souza' });
  if (!jaTem) {
    await pacienteRepo.save({
      nome: 'Maria Alves de Souza', nasc: '1971-03-12', sexo: 'F',
      cidade: 'Belo Horizonte/MG', operadora: 'Unimed', plano: 'Unimed Pleno',
      carteirinha: '0 123 456789012 3',
    });
    console.log('Paciente fictício de validação criado');
  }

  await AppDataSource.destroy();
  console.log('Seed concluído com sucesso.');
}

seed().catch((err) => { console.error(err); process.exit(1); });
