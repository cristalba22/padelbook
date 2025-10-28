import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import padelHero from "../assets/hero-padel.png";
import SplashScreen from "../components/SplashScreen.jsx";

export default function Home() {
  // estado: ¿mostrar splash sí/no?
  const [showSplash, setShowSplash] = useState(true);

  // cuando el splash termina, lo apagamos
  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);

  const fadeUp = (delay = 0) => ({
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut", delay },
    },
  });

  return (
    <>
      {/* splash arriba de todo */}
      <SplashScreen show={showSplash} onFinish={handleSplashFinish} />

      {/* el home real abajo. lo mostramos igual para que ya "esté listo",
          pero lo entramos suave cuando showSplash se apaga */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: showSplash ? 0 : 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative min-h-screen overflow-hidden bg-gradient-to-b from-black via-neutral-950 to-[#0a0a0a] text-white pb-20"
      >
        {/* Fondo dinámico suave (glow verde moviéndose) */}
        <motion.div
          animate={{
            background: [
              "radial-gradient(circle at 20% 20%, rgba(163,230,53,0.05), transparent 60%)",
              "radial-gradient(circle at 80% 80%, rgba(163,230,53,0.08), transparent 60%)",
              "radial-gradient(circle at 20% 20%, rgba(163,230,53,0.05), transparent 60%)",
            ],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            repeatType: "reverse",
          }}
          className="absolute inset-0 z-0"
        />

        {/* HERO */}
        <section className="relative z-10 max-w-6xl mx-auto px-4 pt-16 pb-20 grid lg:grid-cols-2 gap-10">
          {/* Texto lado izquierdo */}
          <motion.div
            variants={fadeUp(0.1)}
            initial="hidden"
            animate={showSplash ? "hidden" : "visible"}
            className="max-w-xl"
          >
            <div className="text-[10px] text-lime-400 font-semibold tracking-wide mb-4 uppercase">
              Gestión de turnos en vivo
            </div>

            <h1 className="text-white font-bold text-4xl sm:text-5xl leading-tight drop-shadow-[0_0_20px_rgba(163,230,53,0.25)]">
              Reservá tu cancha de pádel{" "}
              <span className="text-lime-400">ahora.</span>
            </h1>

            <p className="text-neutral-400 text-sm mt-4 leading-relaxed max-w-md">
              Disponibilidad en tiempo real, confirmación instantánea. Todo
              desde tu celular. Sin llamadas, sin drama.
            </p>

            <motion.div
              variants={fadeUp(0.3)}
              initial="hidden"
              animate={showSplash ? "hidden" : "visible"}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-6"
            >
              <Link
                to="/booking"
                className="bg-lime-400 text-neutral-900 font-semibold text-sm px-5 py-2.5 rounded-lg shadow-[0_0_25px_rgba(163,230,53,0.6)] hover:scale-[1.05] active:scale-[0.97] transition-all"
              >
                Reservar Turno
              </Link>

              <button className="border border-neutral-700 text-sm px-5 py-2.5 rounded-lg bg-neutral-900/60 hover:border-lime-400 hover:text-lime-400 transition-all">
                ¿Por qué elegirnos?
              </button>
            </motion.div>

            <motion.div
              variants={fadeUp(0.45)}
              initial="hidden"
              animate={showSplash ? "hidden" : "visible"}
              className="mt-6 bg-neutral-900/60 border border-neutral-800 rounded-lg p-4 text-[12px] leading-relaxed shadow-[0_0_40px_rgba(163,230,53,0.15)] hover:shadow-[0_0_50px_rgba(163,230,53,0.25)] transition-all"
            >
              <div className="text-[10px] text-lime-400 font-bold uppercase tracking-wide mb-1">
                Beneficio jugadores fieles
              </div>
              <div className="text-neutral-300">
                Reservá 8 turnos en el mes y el 9° es GRATIS.
                Tu club te recompensa por jugar.
              </div>
            </motion.div>
          </motion.div>

          {/* Imagen lado derecho */}
          <motion.div
            variants={fadeUp(0.6)}
            initial="hidden"
            animate={showSplash ? "hidden" : "visible"}
            className="relative"
          >
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="rounded-xl overflow-hidden shadow-[0_0_40px_rgba(163,230,53,0.2)] relative"
            >
              <img
                src={padelHero}
                alt="Jugador de pádel con luz verde"
                className="w-full h-[400px] object-cover brightness-[1.15]"
              />

              {/* degradé negro abajo para leer el texto sobre la imagen */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>

              {/* Glow verde suave que aparece al hover */}
              <motion.div
                className="absolute inset-0 bg-lime-400/10 blur-3xl opacity-0"
                whileHover={{ opacity: 0.3 }}
              />

              {/* Caja turno arriba */}
              <div className="absolute top-4 left-4 bg-neutral-900/70 border border-neutral-700 rounded-lg px-3 py-2 text-[11px] text-neutral-200 shadow-[0_0_15px_rgba(163,230,53,0.3)] backdrop-blur-sm">
                <div className="text-[10px] uppercase text-lime-400 font-semibold">
                  Tu próximo turno
                </div>
                <div className="flex justify-between text-white">
                  <span>Cancha 2</span>
                  <span className="text-lime-400 font-semibold">19:00</span>
                </div>
                <div className="text-[10px] text-neutral-500">
                  Hoy • $9000
                </div>
              </div>

              {/* Copy para el jugador abajo */}
              <div className="absolute bottom-4 left-4 right-4 bg-neutral-900/70 border border-neutral-700 rounded-lg px-3 py-2 text-[10px] text-neutral-300 shadow-[0_0_20px_rgba(0,0,0,0.6)] backdrop-blur-sm leading-relaxed">
                Confirmación inmediata.
                Pagás la seña desde el celu o elegís pagar en el club cuando
                llegás. Si no podés ir, cancelás sin llamar.
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* Cards de ventaja */}
        <motion.section
          variants={fadeUp(0.8)}
          initial="hidden"
          animate={showSplash ? "hidden" : "visible"}
          className="relative z-10 max-w-6xl mx-auto px-4 grid md:grid-cols-3 gap-5"
        >
          {[
            {
              title: "Calendario en tiempo real",
              text: "El jugador ve horarios libres y reserva al toque. Sin mensajes, sin Excel.",
              extra:
                "Promo: jugá 8 turnos en el mes y el 9° va de regalo 💸",
            },
            {
              title: "Múltiples canchas",
              text: "Mostrá todas tus canchas y precios: techada, blindex premium, césped sintético.",
              extra: "Y también clases con profe 😉",
            },
            {
              title: "Clases con profesor",
              text: "Turnos individuales o grupales con nuestros profes. Técnica y correcciones reales.",
              extra: "Lucio (1 a 1), Eze (hasta 4).",
            },
          ].map((card, i) => (
            <motion.div
              key={i}
              whileHover={{
                scale: 1.02,
                boxShadow:
                  "0 0 40px rgba(163,230,53,0.25)",
                borderColor: "#a3e635",
              }}
              className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-5 text-sm shadow-[0_0_25px_rgba(0,0,0,0.6)] transition-all"
            >
              <div className="text-white font-semibold mb-2">
                {card.title}
              </div>
              <p className="text-neutral-400 text-[13px] leading-relaxed">
                {card.text}
              </p>
              <p className="text-lime-400 text-[11px] mt-3 italic">
                {card.extra}
              </p>
            </motion.div>
          ))}
        </motion.section>

        {/* Sección comunidad / club */}
        <motion.section
          variants={fadeUp(1)}
          initial="hidden"
          animate={showSplash ? "hidden" : "visible"}
          className="max-w-6xl mx-auto px-4 mt-20 grid lg:grid-cols-2 gap-10"
        >
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-5 text-sm shadow-[0_0_25px_rgba(163,230,53,0.1)] hover:shadow-[0_0_35px_rgba(163,230,53,0.25)] transition-all">
            <div className="text-white font-semibold text-lg leading-tight">
              ¿Querés jugar más seguido?
            </div>
            <p className="text-neutral-400 text-[13px] leading-relaxed mt-2">
              Sumate a la comunidad. ¿Te falta un jugador? ¿Querés entrar en
              partidos armados? Registrate y quedás visible para que te
              inviten.
            </p>

            <div className="text-[12px] text-neutral-500 mt-4 leading-relaxed">
              WhatsApp:{" "}
              <span className="text-lime-400 font-medium">
                +543517662122
              </span>
              <br />
              Instagram:{" "}
              <span className="text-lime-400 font-medium">@bookpadel</span>
              <br />
              Email:{" "}
              <span className="text-lime-400 font-medium">
                contacto@bookpadel.com
              </span>
            </div>
          </div>

          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-5 text-sm shadow-[0_0_25px_rgba(163,230,53,0.1)] hover:shadow-[0_0_35px_rgba(163,230,53,0.25)] transition-all">
            <div className="text-white font-semibold text-lg leading-tight">
              ¿Querés tu club acá?
            </div>
            <p className="text-neutral-400 text-[13px] leading-relaxed mt-2">
              Te mostramos el panel, armamos tu cuenta admin y activamos el
              cobro de señas. Todo sin complicarte.
            </p>

            <div className="mt-4 grid gap-3 text-[13px]">
              <input
                className="bg-neutral-800 text-white text-sm rounded-lg px-3 py-2 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-lime-400 placeholder-neutral-500"
                placeholder="Nombre del club"
              />
              <input
                className="bg-neutral-800 text-white text-sm rounded-lg px-3 py-2 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-lime-400 placeholder-neutral-500"
                placeholder="WhatsApp de contacto"
              />
              <button className="bg-lime-400 text-neutral-900 font-semibold text-sm px-4 py-2 rounded-lg shadow-[0_0_25px_rgba(163,230,53,0.5)] hover:scale-[1.05] active:scale-[0.97] transition">
                Quiero info
              </button>
            </div>
          </div>
        </motion.section>
      </motion.div>
    </>
  );
}
