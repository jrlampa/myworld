import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { Layers, Download, Globe, ArrowRight, Sparkles, FileStack, Zap, Map, Mountain, Scan } from 'lucide-react';
import { APP_VERSION } from '../constants';

interface LandingPageProps {
  onEnter: () => void;
}

// Floating coordinate bubbles
const COORDS = [
  { label: '-23.5505°S', sub: '46.6333°W', x: '8%', y: '20%', delay: 0 },
  { label: '-15.7801°S', sub: '47.9292°W', x: '85%', y: '15%', delay: 0.4 },
  { label: '-3.7172°S',  sub: '38.5433°W', x: '12%', y: '75%', delay: 0.8 },
  { label: '-30.0346°S', sub: '51.2177°W', x: '80%', y: '72%', delay: 0.2 },
  { label: '-22.9068°S', sub: '43.1729°W', x: '50%', y: '88%', delay: 0.6 },
];

const FEATURES = [
  { icon: Sparkles, title: 'IA Integrada',         desc: 'Busca inteligente via GROQ AI e geocoding automático',         color: 'from-violet-500 to-purple-600' },
  { icon: Globe,    title: 'Coordenadas UTM',       desc: 'Projeção absoluta e relativa pronta para AutoCAD',             color: 'from-cyan-500 to-blue-600' },
  { icon: Download, title: 'Exportação DXF 2.5D',  desc: 'Arquivos CAD com elevação real e camadas organizadas',         color: 'from-emerald-500 to-teal-600' },
  { icon: FileStack,title: 'Processamento em Lote',desc: 'Upload CSV com fila assíncrona via Cloud Tasks',               color: 'from-orange-500 to-amber-600' },
  { icon: Layers,   title: 'Camadas Avançadas',    desc: 'Edifícios, vias, curvas de nível, vegetação e mobiliário',    color: 'from-blue-500 to-indigo-600' },
  { icon: Map,      title: 'Análise Espacial',     desc: 'Perfis de elevação, polígonos customizados e KML import',     color: 'from-rose-500 to-pink-600' },
  { icon: Mountain, title: 'Engine de Terreno',    desc: 'Grid de altitude de alta resolução com análise de declive',   color: 'from-lime-500 to-green-600' },
  { icon: Zap,      title: 'Cloud Native',         desc: 'Deploy automatizado no Google Cloud Run via Docker',          color: 'from-yellow-500 to-orange-600' },
];

const STATS = [
  { value: '12+', label: 'Camadas DXF' },
  { value: '2.5D', label: 'Elevação Real' },
  { value: 'AI', label: 'GROQ Powered' },
  { value: '∞', label: 'Cobertura OSM' },
];

// Animated scan-line grid background
const GridBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let scanY = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      // Grid lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
      ctx.lineWidth = 1;
      const cellSize = 60;
      for (let x = 0; x <= width; x += cellSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y <= height; y += cellSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }

      // Dot at intersections
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      for (let x = 0; x <= width; x += cellSize) {
        for (let y = 0; y <= height; y += cellSize) {
          ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Scan line
      const grad = ctx.createLinearGradient(0, scanY - 80, 0, scanY + 80);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.12)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, scanY - 80, width, 160);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, scanY); ctx.lineTo(width, scanY); ctx.stroke();

      scanY = (scanY + 0.6) % height;
      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />;
};

const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const ctaControls = useAnimation();

  useEffect(() => {
    let cancelled = false;
    const pulse = async () => {
      while (!cancelled) {
        await ctaControls.start({ boxShadow: '0 0 0 0px rgba(99,102,241,0)' });
        if (cancelled) break;
        await ctaControls.start({ boxShadow: '0 0 0 18px rgba(99,102,241,0)', transition: { duration: 1.4, ease: 'easeOut' } });
      }
    };
    pulse();
    return () => { cancelled = true; ctaControls.stop(); };
  }, [ctaControls]);

  return (
    <div className="min-h-screen w-full bg-[#030712] flex flex-col items-center justify-center overflow-hidden relative select-none">

      {/* Animated grid + scan-line */}
      <GridBackground />

      {/* Radial glow center */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(59,130,246,0.12) 0%, transparent 70%)' }}
      />

      {/* Floating coordinate bubbles */}
      {COORDS.map((c, i) => (
        <motion.div
          key={i}
          className="absolute hidden md:flex flex-col items-start bg-white/4 backdrop-blur-md border border-sky-400/20 rounded-xl px-3 py-2 pointer-events-none"
          style={{ left: c.x, top: c.y }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: [0.5, 0.9, 0.5], y: [0, -8, 0] }}
          transition={{ delay: c.delay, duration: 4 + i, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
        >
          <span className="text-sky-300 font-mono text-[11px] font-bold">{c.label}</span>
          <span className="text-slate-500 font-mono text-[9px]">{c.sub}</span>
        </motion.div>
      ))}

      {/* ── HERO ── */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 pt-12 pb-4 max-w-5xl w-full">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-300 text-xs font-bold tracking-widest uppercase"
        >
          <Scan size={12} />
          v{APP_VERSION} — Plataforma Geoespacial
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="text-[clamp(3rem,10vw,7rem)] font-black leading-none tracking-tighter text-white mb-4"
        >
          SIS{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #34d399 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            RUA
          </span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="h-px w-48 mx-auto mb-6"
          style={{ background: 'linear-gradient(90deg, transparent, #38bdf8, transparent)' }}
        />

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="text-slate-400 text-lg md:text-xl font-light max-w-2xl mb-3 leading-relaxed"
        >
          Converta dados do <span className="text-sky-400 font-semibold">OpenStreetMap</span> em arquivos{' '}
          <span className="text-violet-400 font-semibold">DXF 2.5D</span> prontos para AutoCAD —
          com elevação real, análise AI e processamento em nuvem.
        </motion.p>

        {/* Tech pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
          className="flex flex-wrap items-center justify-center gap-2 mb-10 text-xs"
        >
          {['React + TypeScript', 'Python · OSMnx', 'Docker', 'Cloud Run', 'GROQ AI'].map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-slate-400 font-mono"
            >
              {tag}
            </span>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, type: 'spring', stiffness: 180 }}
        >
          <motion.button
            animate={ctaControls}
            whileHover={{ scale: 1.06, y: -3 }}
            whileTap={{ scale: 0.97 }}
            onClick={onEnter}
            className="group relative inline-flex items-center gap-3 px-10 py-4 rounded-2xl font-black text-base tracking-wide text-white overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%)',
            }}
          >
            {/* Shimmer sweep */}
            <span
              aria-hidden="true"
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)' }}
            />
            <span className="relative z-10 flex items-center gap-3">
              Iniciar Aplicação
              <ArrowRight className="group-hover:translate-x-1.5 transition-transform duration-200" size={20} />
            </span>
          </motion.button>
        </motion.div>
      </div>

      {/* ── STATS BAR ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
        className="relative z-10 mt-10 grid grid-cols-4 gap-px w-full max-w-2xl mx-6"
      >
        {STATS.map((s, i) => (
          <div
            key={i}
            className="flex flex-col items-center py-5 px-2 bg-white/[0.03] border border-white/[0.07] first:rounded-l-2xl last:rounded-r-2xl"
          >
            <span className="text-2xl font-black text-white">{s.value}</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">{s.label}</span>
          </div>
        ))}
      </motion.div>

      {/* ── FEATURE CARDS ── */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1 }}
        className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3 mt-10 px-6 max-w-5xl w-full pb-12"
      >
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            onHoverStart={() => setHovered(i)}
            onHoverEnd={() => setHovered(null)}
            whileHover={{ y: -6, scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-5 cursor-default"
          >
            {/* Hover glow */}
            <AnimatePresence>
              {hovered === i && (
                <motion.div
                  key="glow"
                  className={`absolute inset-0 opacity-20 bg-gradient-to-br ${f.color}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.18 }}
                  exit={{ opacity: 0 }}
                />
              )}
            </AnimatePresence>

            {/* Icon */}
            <div className={`mb-3 w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${f.color} shadow-lg`}>
              <f.icon size={20} className="text-white" />
            </div>

            <h3 className="text-white font-bold text-sm mb-1 leading-tight">{f.title}</h3>
            <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

export default LandingPage;
