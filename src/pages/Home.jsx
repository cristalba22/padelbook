import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, ArrowUpRight, Clock3, MapPin } from "lucide-react";
import heroImg from "../assets/hero-padel.webp";
import { ROUTES } from "../constants/routes.js";
import { usePricing } from "../context/PricingContext.jsx";
import { useClubSettings } from "../context/ClubSettingsContext.jsx";
import { getCourtPrice } from "../utils/pricing.js";
import { useBooking } from "../hooks/useBooking.jsx";
import { useAvailability } from "../hooks/useAvailability.js";
import { useSchedule } from "../hooks/useSchedule.jsx";
import { useTournaments } from "../hooks/useTournaments.jsx";
import { useAuth } from "../hooks/useAuth.jsx";
import { COURTS, COURT_HOURS } from "../data/bookingConfig.js";
import { argentinaDateISO, blockOverlapsBooking, bookingsOverlap, fitsOperatingHours, isPastSlot } from "../utils/bookingDomain.js";
import "./home.css";

const formatMoney = (amount) => `$${Number(amount).toLocaleString("es-AR")}`;

function useReveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll(".home-page [data-reveal]");
    if (!window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -30px 0px" });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}

function getCourtAvailability({ today, bookings, occupied, blocks, loading, error }) {
  return COURTS.map((court, index) => {
    const nextHour = !loading && !error ? COURT_HOURS.find((hour) => {
      if (!fitsOperatingHours(hour, 60) || isPastSlot(today, hour)) return false;
      const candidate = { date: today, courtId: court.id, time: hour, durationMinutes: 60 };
      return !blocks.some((block) => blockOverlapsBooking(block, candidate)) &&
        ![...bookings, ...occupied].some((booking) => bookingsOverlap(booking, candidate));
    }) : null;
    return {
      ...court,
      number: String(index + 1).padStart(2, "0"),
      nextHour: loading ? "Consultando" : error ? "Sin datos" : nextHour || "Sin horarios hoy",
      available: Boolean(nextHour),
      note: index === 0 ? "Césped sintético · Exterior" : index === 1 ? "Blindex · Interior" : "Césped fibrilado · Techada",
    };
  });
}

export default function Home() {
  useReveal();
  const { prices } = usePricing();
  const { settings } = useClubSettings();
  const { bookings } = useBooking();
  const { blocks, loading: blocksLoading, error: blocksError } = useSchedule();
  const { tournaments, loading: tournamentsLoading, error: tournamentsError } = useTournaments();
  const { apiOnline } = useAuth();
  const today = argentinaDateISO();
  const { occupied, loading: availabilityLoading, error: availabilityError } = useAvailability(today);
  const loading = blocksLoading || availabilityLoading;
  const error = blocksError || availabilityError;
  const courts = getCourtAvailability({ today, bookings, occupied, blocks, loading, error });
  const availableCourts = courts.filter((court) => court.available).length;
  const nextTournament = tournaments.find((tournament) => tournament.status === "abierto" && tournament.date >= today);
  const courtPrice = getCourtPrice("15:00", new Date(), prices);
  const defaultHeadline = settings.homeHeadline === "Tu próximo partido empieza antes de llegar a la cancha.";
  const todayLabel = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "long", day: "numeric", month: "long" }).format(new Date());

  const moveHero = (event) => {
    if (event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    event.currentTarget.style.setProperty("--pointer-x", `${x * 14}px`);
    event.currentTarget.style.setProperty("--pointer-y", `${y * 14}px`);
  };

  return (
    <main className="home-page">
      <section className="home-hero" aria-labelledby="home-title" onPointerMove={moveHero} onPointerLeave={(event) => { event.currentTarget.style.setProperty("--pointer-x", "0px"); event.currentTarget.style.setProperty("--pointer-y", "0px"); }}>
        <div className="home-hero__copy">
          <p className="home-hero__eyebrow"><span className="home-hero__pulse" aria-hidden="true" />{settings.clubName} <span> / Reservas online</span></p>
          <h1 id="home-title">{defaultHeadline ? <>Nos vemos<br />en la <span>cancha.</span></> : settings.homeHeadline}</h1>
          <p className="home-hero__description">{settings.homeSubtitle}</p>
          <div className="home-hero__actions">
            <Link to={ROUTES.BOOKING} className="home-action home-action--primary">Buscar un turno <span className="home-action__icon"><ArrowUpRight size={19} aria-hidden="true" /></span></Link>
            <a href="#home-courts" className="home-action home-action--text">Ver canchas <ArrowDown size={18} aria-hidden="true" /></a>
          </div>
          <div className="home-hero__details"><span><Clock3 size={16} aria-hidden="true" />{settings.openingHours}</span><span><MapPin size={16} aria-hidden="true" />{settings.address}</span></div>
        </div>
        <figure className="home-hero__image"><img src={heroImg} alt="Partido de pádel en una cancha" loading="eager" /><div className="home-hero__image-wash" aria-hidden="true" /><figcaption><span>EL PARTIDO<br /><strong>EMPIEZA ACÁ.</strong></span><span>01 / 03</span></figcaption></figure>
        <div className="home-hero__side-note" aria-hidden="true">JUGÁ MÁS · ORGANIZÁ MENOS</div>
      </section>

      <section id="home-courts" className="home-courts" aria-labelledby="home-courts-title">
        <div className="home-section-heading" data-reveal><div><span className="home-overline">La agenda</span><h2 id="home-courts-title">Elegí dónde jugar.</h2></div><p>Cancha, superficie y próximo horario en un vistazo. Después elegís el tiempo de juego y confirmás tu turno.</p></div>
        <div className="home-schedule" data-reveal>
          <div className="home-schedule__heading"><div><span className="home-schedule__dot" aria-hidden="true" /><strong>Disponibilidad de hoy</strong><span>{todayLabel}</span></div><span className="home-schedule__mode">{apiOnline ? "Agenda en vivo" : "Vista demo"}</span></div>
          <div className="home-schedule__summary" role="status" aria-live="polite">
            {loading ? "Consultando horarios de hoy…" : error ? "No pudimos consultar la agenda ahora. Podés explorar otras fechas." : availableCourts ? `${availableCourts} ${availableCourts === 1 ? "cancha tiene" : "canchas tienen"} lugar hoy` : "Hoy no quedan horarios. Consultá otra fecha."}
          </div>
          <div className="home-schedule__rows">
            {courts.map((court) => <Link key={court.id} to={`${ROUTES.BOOKING}?court=${court.id}`} className="home-court-row">
              <span className="home-court-row__number">{court.number}<span aria-hidden="true">/</span></span>
              <span className="home-court-row__identity"><strong>{court.name.replace(/^Cancha \d+ - /, "")}</strong><small>{court.note}</small></span>
              <span className={`home-court-row__availability ${court.available ? "is-available" : ""}`}><small>{court.available ? "Próximo libre" : loading ? "Estado" : "Disponibilidad"}</small><strong>{court.nextHour}</strong></span>
              <span className="home-court-row__link">Ver horarios <ArrowUpRight size={18} aria-hidden="true" /></span>
            </Link>)}
          </div>
          <div className="home-schedule__footer"><span>Turnos de 1, 1:30, 2 o 2:30 h · Desde {formatMoney(courtPrice)} por hora base</span><Link to={ROUTES.BOOKING}>Abrir agenda completa <ArrowRight size={16} aria-hidden="true" /></Link></div>
        </div>
      </section>

      <section className="home-life" aria-labelledby="home-life-title">
        <span className="home-life__ambient" aria-hidden="true">PLAY</span>
        <div className="home-life__intro" data-reveal><span className="home-overline">Más allá del turno</span><h2 id="home-life-title">El club también<br />se vive afuera.</h2><p>Un lugar para competir, encontrar gente para jugar y tener tus partidos siempre a mano.</p></div>
        <div className="home-life__links" data-reveal>
          <Link to={ROUTES.TOURNAMENTS}><span className="home-life__index">01</span><span><strong>{nextTournament ? nextTournament.name : "Torneos del club"}</strong><small>{nextTournament ? `${nextTournament.date.split("-").reverse().join("/")} · ${nextTournament.category}` : tournamentsLoading ? "Consultando próximos torneos" : tournamentsError ? "Explorá los torneos cuando vuelva la conexión" : "Conocé los próximos torneos"}</small></span><ArrowUpRight size={22} aria-hidden="true" /></Link>
          <Link to={ROUTES.COMMUNITY}><span className="home-life__index">02</span><span><strong>Encontrá tu grupo</strong><small>Jugadores y partidos de tu nivel</small></span><ArrowUpRight size={22} aria-hidden="true" /></Link>
          <Link to={ROUTES.MY_BOOKINGS}><span className="home-life__index">03</span><span><strong>Tu agenda</strong><small>Turnos, pagos y actividad en un solo lugar</small></span><ArrowUpRight size={22} aria-hidden="true" /></Link>
        </div>
      </section>

      <section className="home-closing" data-reveal><div><span className="home-overline">Tu próximo partido</span><h2>Nos encontramos<br />en la cancha.</h2></div><Link to={ROUTES.BOOKING} className="home-action home-action--primary">Reservar ahora <ArrowUpRight size={19} aria-hidden="true" /></Link></section>
    </main>
  );
}
