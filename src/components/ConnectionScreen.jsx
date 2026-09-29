import { Link } from "react-router-dom";
import Layout from "./Layout.jsx";
import HomeHero from "./HomeHero.jsx";
import "../pages/home.css";

const introduction = {
  clubName: "PadelBook",
  homeHeadline: "Nos vemos en la cancha.",
  homeSubtitle: "Elegí cancha y horario. El club recibe la reserva y podés seguir su estado desde tu cuenta.",
};

export default function ConnectionScreen({ home, error, retry }) {
  const status = <section className="connection-status" role={error ? "alert" : "status"} aria-live="polite">
    <h2>{error ? "No pudimos conectar con el club" : "Consultando la agenda del club…"}</h2>
    <p>{error ? "Podés seguir viendo el inicio. Para reservar o ingresar necesitamos restablecer la conexión." : "Los horarios y el acceso a tu cuenta estarán disponibles cuando termine la conexión."}</p>
    {error && <button type="button" onClick={retry} className="home-action home-action--primary">Volver a intentar</button>}
    {!home && <Link to="/" className="connection-status__back">Volver al inicio</Link>}
  </section>;

  return <div className={`app-shell ${home ? "home-experience" : ""}`}><Layout>
    {home ? <main className="home-page"><HomeHero settings={introduction} showDetails={false} /><div id="home-courts">{status}</div></main> : <main className="connection-page">{status}</main>}
  </Layout></div>;
}
