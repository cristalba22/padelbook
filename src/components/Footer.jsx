import { Link } from "react-router-dom";
import { ArrowUpRight, MapPin } from "lucide-react";
import { useClubSettings } from "../context/ClubSettingsContext.jsx";
import { ROUTES } from "../constants/routes.js";
import { cleanPhone } from "../utils/whatsapp.js";
import "./siteFooter.css";

export default function Footer() {
  const { settings } = useClubSettings();
  const mapsQuery = encodeURIComponent(settings.mapsQuery || settings.address || settings.clubName);
  const phone = cleanPhone(settings.whatsapp);
  const whatsappUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(`Hola, quiero consultar por reservas en ${settings.clubName}.`)}` : null;
  const instagram = String(settings.instagram || "").replace(/^@/, "").trim();

  return <footer className="site-footer">
    <div className="site-footer__inner">
      <div className="site-footer__intro"><span className="site-footer__eyebrow">EL PARTIDO SIGUE</span><Link to={ROUTES.HOME} className="site-footer__brand"><span aria-hidden="true">p.</span>padelbook</Link><p>Tu club, tu cancha, tu próximo partido. Reservá, competí y volvé a jugar.</p></div>
      <div className="site-footer__column"><h2>Explorá</h2><Link to={ROUTES.BOOKING}>Reservar cancha <ArrowUpRight size={15} aria-hidden="true" /></Link><Link to={ROUTES.TOURNAMENTS}>Torneos <ArrowUpRight size={15} aria-hidden="true" /></Link><Link to={ROUTES.COMMUNITY}>Comunidad <ArrowUpRight size={15} aria-hidden="true" /></Link><Link to={ROUTES.MY_BOOKINGS}>Mis turnos <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
      <div className="site-footer__column"><h2>{settings.clubName}</h2><p className="site-footer__address"><MapPin size={16} aria-hidden="true" />{settings.address}</p><p>Horario · {settings.openingHours}</p><a href={`https://www.google.com/maps?q=${mapsQuery}`} target="_blank" rel="noreferrer">Cómo llegar <ArrowUpRight size={15} aria-hidden="true" /></a>{whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp <ArrowUpRight size={15} aria-hidden="true" /></a>}{instagram && <a href={`https://www.instagram.com/${instagram}/`} target="_blank" rel="noreferrer">Instagram <ArrowUpRight size={15} aria-hidden="true" /></a>}</div>
    </div>
    <div className="site-footer__base"><span>© {new Date().getFullYear()} PadelBook</span><span>Hecho para jugar más.</span></div>
  </footer>;
}
