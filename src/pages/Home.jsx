import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Clock3, MapPin, Sparkles, Users, Zap } from "lucide-react";
import heroImg from "../assets/hero-padel.webp";
import shopImg from "../assets/shop-padel-products.jpg";
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
      nextHour: loading ? "Consultando" : error ? "Sin datos" : nextHour || "Sin turnos",
      available: Boolean(nextHour),
      note: index === 0 ? "Césped sintético · Outdoor" : index === 1 ? "Blindex · Indoor" : "Césped fibrilado · Techada",
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
  const whatsapp = String(settings.whatsapp || "").replace(/\D/g, "");
  const shopUrl = whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, quiero consultar por productos de pádel en ${settings.clubName}.`)}` : null;
  const courtPrice = getCourtPrice("15:00", new Date(), prices);
  const editorialHeadline = settings.homeHeadline === "Tu próximo partido empieza antes de llegar a la cancha.";

  return (
    <main className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__photo" aria-hidden="true"><img src={heroImg} alt="" loading="eager" /></div>
        <div className="home-hero__grid" aria-hidden="true" />
        <div className="home-hero__content">
          <div className="home-kicker home-hero__enter"><span className="home-kicker__line" /> {settings.clubName} <span className="home-kicker__index">/ RESERVAS ONLINE</span></div>
          <h1 id="home-title" className="home-hero__title home-hero__enter">{editorialHeadline ? <>El próximo<br /><em>gran partido</em><br />empieza acá<span className="home-hero__period">.</span></> : settings.homeHeadline}</h1>
          <p className="home-hero__description home-hero__enter">{settings.homeSubtitle}</p>
          <div className="home-hero__actions home-hero__enter">
            <Link to={ROUTES.BOOKING} className="home-button home-button--primary">Reservar cancha <ArrowUpRight size={19} aria-hidden="true" /></Link>
            <Link to={ROUTES.TOURNAMENTS} className="home-button home-button--ghost">Explorar torneos <ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
          <div className="home-hero__facts home-hero__enter">
            <span><Clock3 size={16} aria-hidden="true" /> {settings.openingHours}</span>
            <span><MapPin size={16} aria-hidden="true" /> {settings.address}</span>
          </div>
        </div>
        <div className="home-hero__side-label" aria-hidden="true">JUGÁ EL MOMENTO · PADELBOOK</div>
        <a href="#home-courts" className="home-hero__scroll" aria-label="Ver disponibilidad de canchas"><ArrowDown size={19} aria-hidden="true" /></a>
        <div className="home-hero__number" aria-hidden="true">01 / 03</div>
      </section>

      <div className="home-tape" aria-label="Todo tu pádel en un lugar"><span>RESERVÁ TU CANCHA</span><i /> <span>JUGÁ TORNEOS</span><i /> <span>ENCONTRÁ TU GRUPO</span><i /> <span>VIVÍ EL CLUB</span></div>

      <section id="home-courts" className="home-section home-courts" aria-labelledby="home-courts-title">
        <div className="home-section__intro" data-reveal>
          <div><p className="home-eyebrow"><span>01</span> / LA AGENDA</p><h2 id="home-courts-title">Tu cancha<br /><em>te espera.</em></h2></div>
          <div className="home-section__aside"><p>Elegí tu cancha y encontrá un horario que encaje con tu día. La disponibilidad se actualiza desde la agenda del club.</p><Link to={ROUTES.BOOKING} className="home-text-link">Ver todos los horarios <ArrowUpRight size={17} aria-hidden="true" /></Link></div>
        </div>
        <div className="home-availability" data-reveal role="status">
          <div className="home-availability__signal"><span className={`home-live-dot ${loading ? "is-loading" : ""}`} /> {loading ? "Consultando agenda" : error ? "Agenda temporalmente no disponible" : `${availableCourts} de ${courts.length} canchas con lugar hoy`}</div>
          <span className="home-availability__mode">{apiOnline ? "AGENDA EN VIVO" : "VISTA DEMO"} · {today.split("-").reverse().join("/")}</span>
        </div>
        <div className="home-court-grid">
          {courts.map((court, index) => <Link key={court.id} to={`${ROUTES.BOOKING}?court=${court.id}`} className="home-court" data-reveal style={{ "--reveal-delay": `${index * 90}ms` }}>
            <div className="home-court__top"><span>CANCHA {court.number}</span><ArrowUpRight size={23} aria-hidden="true" /></div>
            <div className="home-court__lines" aria-hidden="true"><span /><span /><span /></div>
            <div className="home-court__bottom"><div><h3>{court.name.replace(/^Cancha \d+ - /, "")}</h3><p>{court.note}</p></div><div className="home-court__time"><span>PRÓXIMO LIBRE</span><strong className={court.available ? "" : "is-muted"}>{court.nextHour}</strong></div></div>
          </Link>)}
        </div>
        <p className="home-courts__footnote">Turnos de 1, 1:30, 2 o 2:30 h · Desde {formatMoney(courtPrice)} por hora base · Precios finales visibles al elegir horario.</p>
      </section>

      <section className="home-feature" aria-labelledby="home-feature-title">
        <div className="home-feature__copy" data-reveal><p className="home-eyebrow"><span>02</span> / SIN VUELTAS</p><h2 id="home-feature-title">Menos mensajes.<br /><em>Más pádel.</em></h2><p>Tu próximo turno, tus torneos y tu grupo, en un mismo lugar. Reservá en minutos y seguí todo desde tu cuenta.</p><Link to={ROUTES.BOOKING} className="home-button home-button--dark">Elegir un turno <ArrowUpRight size={19} aria-hidden="true" /></Link></div>
        <div className="home-feature__steps" data-reveal>
          <div><span>01 / ELEGÍ</span><CalendarDays size={27} aria-hidden="true" /><h3>Cancha y horario</h3><p>Ves las opciones disponibles para la duración de tu partido.</p></div>
          <div><span>02 / CONFIRMÁ</span><Zap size={27} aria-hidden="true" /><h3>Reservá al instante</h3><p>Elegís cómo coordinar el pago y el turno queda en tu agenda.</p></div>
          <div><span>03 / JUGÁ</span><Sparkles size={27} aria-hidden="true" /><h3>Todo listo</h3><p>Consultás el detalle del turno cuando lo necesites.</p></div>
        </div>
      </section>

      <section className="home-section home-more" aria-labelledby="home-more-title">
        <div className="home-section__intro" data-reveal><div><p className="home-eyebrow"><span>03</span> / MÁS QUE UNA CANCHA</p><h2 id="home-more-title">El juego<br /><em>sigue afuera.</em></h2></div><p className="home-section__aside">Conectá con jugadores, sumate a un torneo o volvé a tu agenda. Todo sucede alrededor de tu club.</p></div>
        <div className="home-more__grid">
          <Link to={ROUTES.TOURNAMENTS} className="home-story home-story--tournament" data-reveal><span className="home-story__index">01 / TORNEOS</span><div className="home-story__content"><div className="home-story__icon"><CalendarDays size={22} aria-hidden="true" /></div><h3>{nextTournament ? nextTournament.name : "Próximo desafío"}</h3><p>{nextTournament ? `${nextTournament.date.split("-").reverse().join("/")} · ${nextTournament.category}` : tournamentsLoading ? "Buscando torneos del club" : tournamentsError ? "No se pudieron cargar los torneos" : "Descubrí los torneos del club y preparate para jugar."}</p><span className="home-story__link">{nextTournament ? "Ver torneo" : "Explorar torneos"} <ArrowUpRight size={17} aria-hidden="true" /></span></div></Link>
          <Link to={ROUTES.COMMUNITY} className="home-story home-story--community" data-reveal style={{ "--reveal-delay": "90ms" }}><span className="home-story__index">02 / COMUNIDAD</span><div className="home-story__content"><div className="home-story__icon"><Users size={22} aria-hidden="true" /></div><h3>Siempre hay partido.</h3><p>Encontrá jugadores de tu nivel y armá el próximo encuentro.</p><span className="home-story__link">Buscar jugadores <ArrowUpRight size={17} aria-hidden="true" /></span></div></Link>
          <Link to={ROUTES.MY_BOOKINGS} className="home-story home-story--agenda" data-reveal style={{ "--reveal-delay": "180ms" }}><span className="home-story__index">03 / TU AGENDA</span><div className="home-story__content"><div className="home-story__icon"><Clock3 size={22} aria-hidden="true" /></div><h3>Todo bajo control.</h3><p>Tus turnos y su estado, siempre a mano desde el celular.</p><span className="home-story__link">Ver mis turnos <ArrowUpRight size={17} aria-hidden="true" /></span></div></Link>
        </div>
      </section>

      <section className="home-shop" data-reveal aria-labelledby="home-shop-title"><div className="home-shop__image"><img src={shopImg} alt="Paletas y accesorios de pádel" loading="lazy" /></div><div className="home-shop__copy"><p className="home-eyebrow"><span>EXTRA</span> / EN EL CLUB</p><h2 id="home-shop-title">Equipate para<br /><em>el próximo punto.</em></h2><p>Consultá al club por paletas, pelotas y accesorios. Te confirman modelos, precios y disponibilidad por WhatsApp.</p>{shopUrl && <a className="home-text-link" href={shopUrl} target="_blank" rel="noreferrer">Consultar productos <ArrowUpRight size={17} aria-hidden="true" /></a>}</div></section>

      <section className="home-end" data-reveal><span>EL PARTIDO EMPIEZA ACÁ</span><h2>Nos vemos<br /><em>en la cancha.</em></h2><Link to={ROUTES.BOOKING} className="home-button home-button--primary">Reservar mi turno <ArrowUpRight size={20} aria-hidden="true" /></Link></section>
    </main>
  );
}
