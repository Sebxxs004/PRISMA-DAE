import React, { useState } from 'react';
import useAuthStore from '../store/useAuthStore';
import fgnLogo from '../assets/fgn-logo.png';
import prismaLogo from '../assets/PRISMA-DAE.png';
import fondoLogin from '../assets/fondo-login.png';

function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const { login, loading } = useAuthStore();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const success = await login(formData.email, formData.password);
    if (!success) {
      setError('Email o contraseña inválidos');
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-investigation-bg text-slate-100">
      <aside className="relative z-10 flex h-full w-full max-w-[460px] flex-col justify-between border-r border-white/10 bg-panel-dark px-8 py-10 backdrop-blur-xl md:px-10">
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.4em] text-cyan-300/90">
              PRISMA DAE
            </p>
            <h1 className="max-w-sm font-mono text-3xl font-semibold uppercase tracking-[0.18em] text-slate-50 md:text-[2.15rem]">
              Sistema de Acceso y Enlace Judicial
            </h1>
            <p className="max-w-sm text-sm leading-6 text-slate-300/90">
              Ingreso seguro para operadores autorizados. El entorno visual se
              diseña como una central de inteligencia para análisis investigativo.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 px-4 py-2 text-sm text-orange-300">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="admin@prisma.dae"
                disabled={loading}
                className="w-full rounded-lg border border-cyan-500/20 bg-slate-950/60 px-4 py-3 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-500 disabled:opacity-50 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="admin123"
                disabled={loading}
                className="w-full rounded-lg border border-cyan-500/20 bg-slate-950/60 px-4 py-3 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-500 disabled:opacity-50 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 font-mono text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200 transition disabled:opacity-50 hover:bg-cyan-500/20 hover:text-white"
            >
              {loading ? 'INGRESANDO...' : 'Ingresar al sistema'}
            </button>
          </form>

          <div className="text-center text-xs text-slate-400">
            <p>Demo: admin@prisma.dae / admin123</p>
            <p>Demo: investigador@prisma.dae / investigador123</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
          <img
            src={fgnLogo}
            alt="Logo FGN"
            className="h-16 w-auto opacity-90 drop-shadow-[0_0_18px_rgba(0,240,255,0.16)]"
          />
        </div>
      </aside>

      <main
        className="relative flex flex-1 items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(10, 15, 22, 0.96) 0%, rgba(10, 15, 22, 0.72) 34%, rgba(10, 15, 22, 0.28) 68%, rgba(10, 15, 22, 0.12) 100%), url(${fondoLogin})`,
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.08),transparent_55%)]" />

        <div className="animate-slide-in-down relative max-w-2xl px-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.45em] text-cyan-300/80">
            PRISMA DAE
          </p>
          <h2 className="mt-2 text-4xl font-semibold tracking-[0.2em] text-slate-100 drop-shadow-[0_0_24px_rgba(0,240,255,0.18)] md:text-5xl">
            Investigación en curso
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-300/90 md:text-base">
            Sistema diseñado para relacionar expedientes, nexos y evidencias en
            un entorno visual de alta confidencialidad.
          </p>

          <img
            src={prismaLogo}
            alt="Logo PRISMA DAE"
            className="mx-auto mt-4 h-48 w-auto md:h-64"
          />
        </div>
      </main>
    </div>
  );
}

export default LoginPage;
