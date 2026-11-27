import path from 'node:path';
import { type NextConfig } from 'next';

import { verificarAmbienteDeProducao } from './src/lib/ambiente';

// no build de produção da Vercel, falha cedo se faltar uma variável essencial (ver src/lib/ambiente.ts)
if (process.env.VERCEL_ENV === 'production') {
  const { erros, avisos } = verificarAmbienteDeProducao(process.env);
  for (const aviso of avisos) console.warn(`⚠ ${aviso}`);
  if (erros.length > 0) {
    throw new Error(`Variáveis de ambiente de produção com problema:\n- ${erros.join('\n- ')}`);
  }
}

const nextConfig: NextConfig = {
  // em desenvolvimento o Next só aceita recursos (HMR) vindos de localhost; sem isto, abrir
  // pelo IP (127.0.0.1, ou o da rede, para ver no celular) carrega o HTML mas não o JavaScript
  allowedDevOrigins: ['127.0.0.1'],
  turbopack: {
    // raiz do monorepo; evita o Next adivinhar a raiz por lockfiles fora do repo
    root: path.join(__dirname, '..'),
    rules: {
      '*.svg': {
        as: '*.js',
        loaders: ['@svgr/webpack'],
      },
    },
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/i,
      use: ['@svgr/webpack'],
    });
    return config;
  },
};

export default nextConfig;
