import React from "react";

export default function Footer() {
  return (
    <footer
      id="contacto"
      className="border-t border-neutral-800 bg-neutral-900/60 text-neutral-300 text-sm mt-16"
    >
      <div className="max-w-6xl mx-auto px-4 py-10 grid gap-8 sm:grid-cols-3">
        <div>
          <div className="text-white font-semibold text-lg">
            Book Padel
          </div>
          <p className="text-neutral-400 text-xs mt-2 max-w-xs">
            Reservá canchas en tiempo real. Gestión simple para tu club.
          </p>
        </div>

        <div>
          <div className="text-white font-medium mb-2">
            Contacto
          </div>
          <p className="text-xs text-neutral-400">WhatsApp: +543517662122</p>
          <p className="text-xs text-neutral-400">Instagram: @book.padel</p>
          <p className="text-xs text-neutral-400">
            Email: contacto@bookpadel.com
          </p>
        </div>

        <div>
          <div className="text-white font-medium mb-2">
            Redes
          </div>
          <div className="flex gap-3 text-xs">
            <a className="hover:text-lime-400 transition" href="#">Instagram</a>
            <a className="hover:text-lime-400 transition" href="#">WhatsApp</a>
          </div>
          <p className="text-[11px] text-neutral-600 mt-4">
            © {new Date().getFullYear()} Book Padel. Todos los derechos
            reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
