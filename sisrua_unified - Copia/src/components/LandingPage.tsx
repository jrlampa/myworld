import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Rocket, ShieldCheck, MapPinned, CheckCircle2 } from 'lucide-react';

interface LandingPageProps {
  onEnterApp: () => void;
}

const features = [
  {
    title: 'Mapeamento inteligente',
    description: 'Seleção de área por raio, polígono e perfil de terreno para fluxos técnicos rápidos.',
    icon: MapPinned
  },
  {
    title: 'Exportação DXF profissional',
    description: 'Geração de arquivos CAD com foco em uso real de engenharia e urbanismo.',
    icon: Rocket
  },
  {
    title: 'Confiável para operação',
    description: 'Pipeline validado com CI/CD e deploy em Cloud Run para releases contínuas.',
    icon: ShieldCheck
  }
];

function LandingPage({ onEnterApp }: LandingPageProps) {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-cyan-100 via-sky-50 to-emerald-100 text-slate-800 overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-120px] right-[-80px] h-80 w-80 rounded-full bg-cyan-300/30 blur-3xl" />
        <div className="absolute bottom-[-140px] left-[-100px] h-96 w-96 rounded-full bg-indigo-300/20 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto max-w-7xl px-6 py-10 md:px-10 md:py-14">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="rounded-3xl border border-white/50 bg-white/55 p-8 shadow-2xl backdrop-blur-xl md:p-12"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/50 bg-cyan-100/70 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cyan-800">
            <Sparkles size={14} />
            Lançamento SIS RUA Unified
          </div>

          <h1 className="max-w-4xl text-4xl font-black leading-tight tracking-tight text-slate-900 md:text-6xl">
            Transforme dados OSM em DXF com uma experiência visual premium.
          </h1>

          <p className="mt-5 max-w-3xl text-base text-slate-700 md:text-lg">
            Plataforma pronta para equipes técnicas que precisam acelerar análise territorial, validação de áreas e exportação CAD com segurança operacional.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={onEnterApp}
              className="rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-extrabold uppercase tracking-wider text-white shadow-lg shadow-cyan-400/30 transition hover:scale-[1.02]"
            >
              Quero testar Alpha grátis
            </button>
            <button
              onClick={onEnterApp}
              className="rounded-2xl border border-slate-300/70 bg-white/70 px-6 py-3 text-sm font-bold uppercase tracking-wider text-slate-700 backdrop-blur transition hover:bg-white"
            >
              Entrar na plataforma
            </button>
          </div>
        </motion.section>

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * (index + 1), duration: 0.4 }}
                className="rounded-2xl border border-white/60 bg-white/50 p-6 shadow-xl backdrop-blur-xl"
              >
                <div className="mb-4 inline-flex rounded-xl bg-cyan-100/80 p-2 text-cyan-700">
                  <Icon size={18} />
                </div>
                <h2 className="text-lg font-black text-slate-900">{feature.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{feature.description}</p>
              </motion.article>
            );
          })}
        </section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.45 }}
          className="mt-8 rounded-3xl border border-white/60 bg-white/60 p-8 shadow-2xl backdrop-blur-xl md:p-10"
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-2xl font-black text-slate-900 md:text-3xl">Plano de evolução comercial</h3>
              <p className="mt-2 text-sm text-slate-700 md:text-base">
                Fase de aquisição ativa: removemos barreira de entrada nas versões iniciais para acelerar adoção e feedback real.
              </p>
            </div>
            <span className="rounded-full border border-emerald-300/70 bg-emerald-100/80 px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-emerald-800">
              Acesso imediato
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-cyan-300/50 bg-cyan-50/80 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-700">Alpha</p>
              <p className="mt-2 text-2xl font-black text-slate-900">Grátis</p>
              <p className="mt-2 text-sm text-slate-700">Teste livre durante validação técnica.</p>
            </div>
            <div className="rounded-2xl border border-blue-300/50 bg-blue-50/80 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Beta</p>
              <p className="mt-2 text-2xl font-black text-slate-900">Grátis</p>
              <p className="mt-2 text-sm text-slate-700">Sem cobrança enquanto consolidamos produto.</p>
            </div>
            <div className="rounded-2xl border border-indigo-300/50 bg-indigo-50/80 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">v1.0+</p>
              <p className="mt-2 text-2xl font-black text-slate-900">Pago</p>
              <p className="mt-2 text-sm text-slate-700">Cobrança inicia apenas após lançamento oficial.</p>
            </div>
          </div>

          <ul className="mt-6 space-y-2 text-sm text-slate-700">
            <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-600" /> Alpha e Beta sem custo para usuários pioneiros.</li>
            <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-600" /> Prioridade para feedback de produto e roadmap.</li>
            <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-600" /> Modelo comercial ativado somente na versão v1.0.</li>
          </ul>
        </motion.section>
      </main>
    </div>
  );
}

export default LandingPage;
