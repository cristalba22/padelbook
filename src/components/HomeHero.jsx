import { Link } from "react-router-dom";
import { ArrowDown, ArrowUpRight, Clock3, MapPin } from "lucide-react";
import heroImg from "../assets/hero-padel.webp";
import { ROUTES } from "../constants/routes.js";

export default function HomeHero({ settings, courtCount = 0, showDetails = true }) {
  const defaultHeadline = settings.homeHeadline === "Nos vemos en la cancha.";
  const moveHero = (event) => {
    if (event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    event.currentTarget.style.setProperty("--pointer-x", `${x * 14}px`);
    event.currentTarget.style.setProperty("--pointer-y", `${y * 14}px`);
  };
  return (
      <section className="home-hero" aria-labelledby="home-title" onPointerMove={moveHero} onPointerLeave={(event) => { event.currentTarget.style.setProperty("--pointer-x", "0px"); event.currentTarget.style.setProperty("--pointer-y", "0px"); }}>
        <div className="home-hero__copy">
          <p className="home-hero__eyebrow"><span className="home-hero__pulse" aria-hidden="true" />{settings.clubName} <span> / Reservas online</span></p>
          <h1 id="home-title">{defaultHeadline ? <>Nos vemos<br />en la <span>cancha.</span></> : settings.homeHeadline}</h1>
          <p className="home-hero__description">{settings.homeSubtitle}</p>
          <div className="home-hero__actions">
            <Link to={ROUTES.BOOKING} className="home-action home-action--primary">Buscar un turno <span className="home-action__icon"><ArrowUpRight size={19} aria-hidden="true" /></span></Link>
            <a href="#home-courts" className="home-action home-action--text">Ver canchas <ArrowDown size={18} aria-hidden="true" /></a>
          </div>
          {showDetails && <div className="home-hero__details"><span><Clock3 size={16} aria-hidden="true" />{settings.openingHours}</span>{settings.address && <span><MapPin size={16} aria-hidden="true" />{settings.address}</span>}</div>}
        </div>
        <figure className="home-hero__image"><img src={heroImg} alt="Partido de pádel en una cancha" loading="eager" /><div className="home-hero__image-wash" aria-hidden="true" /><figcaption><span>EL PARTIDO<br /><strong>EMPIEZA ACÁ.</strong></span>{showDetails && <span>01 / {String(courtCount).padStart(2, "0")}</span>}</figcaption></figure>
        <div className="home-hero__side-note" aria-hidden="true">CANCHA · HORARIO · PARTIDO</div>
      </section>
  );
}
