import React from 'react';
import { motion } from 'framer-motion';
import { Map, Layers, Download, Globe, ChevronRight, Container, Sparkles, FileStack, Zap } from 'lucide-react';

interface LandingPageProps {
  onEnter: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center p-8 overflow-hidden relative">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-blue-400/30 rounded-full"
            initial={{ 
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920),
              y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080),
            }}
            animate={{
              y: [null, Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080)],
              x: [null, Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920)],
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'linear'
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-4xl w-full text-center space-y-12 relative z-10"
      >
        {/* Logo and title */}
        <div className="space-y-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/50"
          >
            <Layers size={48} className="text-white" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h1 className="text-6xl md:text-7xl font-black text-white tracking-tight mb-4">
              SIS RUA
              <span className="block text-blue-400 mt-2">UNIFIED</span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-400 font-light mb-3">
              Sistema Avançado de Exportação OSM para DXF 2.5D
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
              <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">v1.0.0</span>
              <span className="flex items-center gap-1.5">
                <Container size={14} />
                Docker Ready
              </span>
              <span className="flex items-center gap-1.5">
                <Zap size={14} />
                Cloud Run
              </span>
            </div>
          </motion.div>
        </div>

        {/* Features grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12"
        >
          {[
            { icon: Sparkles, title: 'IA Integrada', desc: 'Busca inteligente com GROQ AI e geocoding automático' },
            { icon: Globe, title: 'Coordenadas UTM', desc: 'Projeção absoluta e relativa para AutoCAD' },
            { icon: Download, title: 'Exportação DXF 2.5D', desc: 'Arquivos CAD com elevação e camadas organizadas' },
            { icon: FileStack, title: 'Processamento em Lote', desc: 'Upload CSV e processamento assíncrono (Cloud Tasks)' },
            { icon: Layers, title: 'Camadas Avançadas', desc: 'Edifícios, vias, curvas de nível, vegetação e mais' },
            { icon: Map, title: 'Análise Espacial', desc: 'Perfis de elevação, seleção de polígonos e KML import' },
            { icon: Container, title: 'Docker First', desc: 'Zero dependências, isolamento completo, multiplataforma' },
            { icon: Zap, title: 'Cloud Native', desc: 'Deploy automatizado no Google Cloud Run' }
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + index * 0.05 }}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all"
            >
              <feature.icon className="mx-auto mb-4 text-blue-400" size={32} />
              <h3 className="text-white font-bold text-lg mb-2">{feature.title}</h3>
              <p className="text-slate-400 text-sm">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2 }}
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onEnter}
            className="group mt-8 px-12 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold text-lg shadow-2xl shadow-blue-500/50 hover:shadow-blue-500/70 transition-all flex items-center gap-3 mx-auto"
          >
            Iniciar Aplicação
            <ChevronRight className="group-hover:translate-x-1 transition-transform" size={24} />
          </motion.button>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="text-slate-500 text-sm mt-12 space-y-3"
        >
          <p className="text-base font-medium text-slate-400">
            Plataforma completa de extração e análise geoespacial
          </p>
          <div className="flex items-center justify-center gap-6 text-xs">
            <span>React + TypeScript</span>
            <span>•</span>
            <span>Python + OSMnx</span>
            <span>•</span>
            <span>Docker + Cloud Run</span>
          </div>
          <p className="text-xs text-slate-600">
            OpenStreetMap → Análise AI → DXF 2.5D para AutoCAD
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default LandingPage;
