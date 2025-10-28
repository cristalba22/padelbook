import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function SplashScreen({ show, onFinish }) {
  // cuando la animación terminó, avisamos al padre para esconderlo
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => {
      onFinish();
    }, 1800); // dura ~1.8s total
    return () => clearTimeout(t);
  }, [show, onFinish]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
        >
          {/* Glow radial detrás del logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0.6, 1, 1.1, 1.2],
            }}
            transition={{
              duration: 1.4,
              times: [0, 0.3, 0.6, 1],
              ease: "easeOut",
            }}
            className="absolute w-[280px] h-[280px] rounded-full bg-[radial-gradient(circle_at_center,rgba(163,230,53,0.3)_0%,rgba(0,0,0,0)_70%)] blur-2xl"
          />

          {/* Tarjeta/loguito */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{
              scale: [0.7, 1, 1],
              opacity: [0, 1, 1],
              boxShadow: [
                "0 0 0 rgba(163,230,53,0)",
                "0 0 40px rgba(163,230,53,0.6)",
                "0 0 20px rgba(163,230,53,0.3)",
              ],
            }}
            transition={{
              duration: 1.2,
              ease: "easeOut",
              times: [0, 0.4, 1],
            }}
            className="relative bg-neutral-900 border border-lime-400/40 rounded-xl px-5 py-4 flex flex-col items-center text-center"
          >
            <div className="flex items-baseline gap-2">
              <div className="bg-lime-400 text-neutral-900 font-bold text-[11px] leading-none rounded-md px-2 py-1 shadow-[0_0_20px_rgba(163,230,53,0.6)]">
                BK
              </div>
              <div className="bg-lime-400 text-neutral-900 font-bold text-[11px] leading-none rounded-md px-2 py-1 shadow-[0_0_20px_rgba(163,230,53,0.6)]">
                PDL
              </div>
            </div>

            <div className="mt-3 text-white font-semibold text-sm leading-none">
              Book Padel
            </div>
            <div className="text-neutral-500 text-[10px] mt-1">
              Gestión de turnos
            </div>

            {/* Barra de carga fake abajo */}
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.2, ease: "easeInOut", delay: 0.3 }}
              className="h-[3px] w-full bg-lime-400 rounded-full mt-4 shadow-[0_0_15px_rgba(163,230,53,0.8)]"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
