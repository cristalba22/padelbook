// src/pages/Home.jsx
import React from "react";
import heroImg from "../assets/hero-padel.png"; // usá el path que tengas

export default function Home() {
  return (
    <div className="home-wrapper">
      {/* HERO */}
      <section className="home-hero">
        {/* texto */}
        <div className="hero-text">
          <p className="hero-kicker">GESTIÓN DE TURNOS EN VIVO</p>
          <h1 className="hero-title">
            Reservá tu cancha de <span>pádel</span> ahora.
          </h1>
          <p className="hero-sub">
            Calendario online, disponibilidad en tiempo real, confirmación
            instantánea. Todo desde tu celular. Sin llamados. Sin drama.
          </p>
          <div className="hero-actions">
            <a href="/booking" className="btn-glow">
              Reservar turno
            </a>
            <a href="#por-que" className="btn-ghost">
              ¿Por qué elegimos?
            </a>
          </div>
          <div className="hero-pill">
            <strong>Beneficio jugadores fieles:</strong> reservá 8 turnos en el
            mes y el 9° es <span className="text-lime-200">GRATIS</span>. Tu
            club te recompensa por jugar.
          </div>
        </div>

        {/* tarjeta derecha */}
        <div className="hero-player">
          <div className="hero-img-box">
            <img src={heroImg} alt="Jugador de pádel" />
          </div>
          <div className="hero-player-info">
            <p className="hero-player-label">Tu próximo turno</p>
            <p className="hero-player-court">Cancha 2 – 19:00</p>
            <p className="hero-player-text">
              Confirmación inmediata. Pagás la seña desde el celu o elegís pagar
              en el club cuando llegás. Si no podés ir, cancelás sin llamar.
            </p>
          </div>
        </div>
      </section>

      {/* CARDS */}
      <section id="por-que" className="home-cards">
        <div className="home-card">
          <p className="card-label">Función</p>
          <h3 className="card-title">Calendario en tiempo real</h3>
          <p className="card-text">
            El jugador ve horarios libres y reserva al toque. Sin mensajes, sin
            Excel.
          </p>
          <a href="/booking" className="card-link">
            Ver turnos →
          </a>
        </div>

        <div className="home-card">
          <p className="card-label">Función</p>
          <h3 className="card-title">Múltiples canchas</h3>
          <p className="card-text">
            Mostrá todas tus canchas y sus precios en una sola vista.
          </p>
          <p className="card-badge">Y también clases con profe 🔥</p>
        </div>

        <div className="home-card">
          <p className="card-label">Función</p>
          <h3 className="card-title">Clases con profesor</h3>
          <p className="card-text">
            Turnos individuales o grupales con los profes del club.
          </p>
        </div>

        <div className="home-card home-card-wide">
          <p className="card-label">🏆 Torneos relámpago</p>
          <p className="card-text">
            Inscribite solo o en pareja. Eliminación directa, ranking del club.
          </p>
          <a href="/torneos" className="card-link">
            Ver torneos →
          </a>
        </div>

        <div className="home-card home-card-wide">
          <p className="card-label">❤️ Comunidad de jugadores</p>
          <p className="card-text">
            Unite a tu categoría (7ma a 2da). Si te falta uno, el club te arma
            por WhatsApp.
          </p>
          <a href="/comunidad" className="card-link">
            Entrar →
          </a>
        </div>
      </section>
    </div>
  );
}
