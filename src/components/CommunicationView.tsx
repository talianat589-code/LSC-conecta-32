
import { useEffect, useRef, useState } from "react";
import Peer, { type MediaConnection } from "peerjs";

export default function CommunicationView() {
  const peerRef = useRef<Peer | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callRef = useRef<MediaConnection | null>(null);

  const [miId, setMiId] = useState("");
  const [idDestino, setIdDestino] = useState("");
  const [estado, setEstado] = useState("Preparando conexión...");
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [microfonoActivo, setMicrofonoActivo] = useState(true);
  const [conectado, setConectado] = useState(false);
  const [llamadaEntrante, setLlamadaEntrante] =
    useState<MediaConnection | null>(null);

  useEffect(() => {
    const peer = new Peer();
    peerRef.current = peer;

    peer.on("open", (id) => {
      setMiId(id);
      setEstado("Listo para conectar");
    });

    peer.on("call", (llamada) => {
      setLlamadaEntrante(llamada);
      setEstado("Tienes una llamada entrante");
    });

    

    peer.on("error", (error) => {
      console.error("Error de PeerJS:", error);
    
      const tipoError =
        "type" in error ? String(error.type) : "";
    
      switch (tipoError) {
        case "peer-unavailable":
          setEstado(
            "No encontramos a esa persona. Comprueba su identificador e inténtalo de nuevo."
          );
          break;
    
        case "network":
        case "server-error":
        case "socket-error":
        case "socket-closed":
          setEstado(
            "Problema de conexión. Comprueba Internet e inténtalo de nuevo."
          );
          break;
    
        case "unavailable-id":
          setEstado(
            "No se pudo crear el identificador. Intenta iniciar de nuevo."
          );
          break;
    
        default:
          setEstado(
            "Ocurrió un problema con la llamada. Inténtalo de nuevo."
          );
      }
    });    
    
peer.on("disconnected", () => {
  setEstado(
    "Conexión interrumpida. Intentando reconectar..."
  );

  if (!peer.destroyed) {
    try {
      peer.reconnect();
    } catch (error) {
      console.error(
        "No se pudo reconectar con PeerJS:",
        error
      );

      setEstado(
        "No se pudo reconectar. Comprueba tu conexión a Internet."
      );
    }
  }
});

    return () => {
      callRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
      peer.destroy();
      peerRef.current = null;
    };
  }, []);

  async function activarCamara() {
    try {
      setEstado("Solicitando permiso para cámara y micrófono...");

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setCamaraActiva(true);
      setMicrofonoActivo(true);
      setEstado("Cámara y micrófono activos");
    } catch (error) {
      console.error(error);
      setEstado(
        "No se pudo acceder a la cámara o al micrófono. Revisa los permisos."
      );
    }
  }

  function conectarVideo(llamada: MediaConnection) {
    callRef.current = llamada;

    llamada.on("stream", (stream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }

      setConectado(true);
      setEstado("Conectado en tiempo real");
      setLlamadaEntrante(null);
    });

    llamada.on("close", () => {
      setConectado(false);
      setEstado("La llamada ha finalizado");

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      callRef.current = null;
    });

    llamada.on("error", (error) => {
      console.error(error);
      setEstado("Se produjo un error durante la llamada");
      setConectado(false);
    });
  }

  function llamar() {
    const peer = peerRef.current;
    const stream = localStreamRef.current;
    const destino = idDestino.trim();

    if (!peer || !stream) {
      setEstado("Primero activa la cámara y el micrófono");
      return;
    }

    if (!destino) {
      setEstado("Escribe el ID de la otra persona");
      return;
    }

    if (destino === miId) {
      setEstado("No puedes llamarte a ti mismo");
      return;
    }

    setEstado("Llamando...");

    const llamada = peer.call(destino, stream);

    if (!llamada) {
      setEstado("No se pudo iniciar la llamada");
      return;
    }

    conectarVideo(llamada);
  }

  function responder() {
    const stream = localStreamRef.current;

    if (!stream || !llamadaEntrante) {
      setEstado("Activa la cámara antes de responder");
      return;
    }

    llamadaEntrante.answer(stream);
    conectarVideo(llamadaEntrante);
    setLlamadaEntrante(null);
  }

  function silenciarMicrofono() {
    const stream = localStreamRef.current;

    if (!stream) return;

    const nuevoEstado = !microfonoActivo;

    stream.getAudioTracks().forEach((track) => {
      track.enabled = nuevoEstado;
    });

    setMicrofonoActivo(nuevoEstado);
  }

  function finalizarLlamada() {
    callRef.current?.close();
    callRef.current = null;

    llamadaEntrante?.close();
    setLlamadaEntrante(null);

    setConectado(false);
    setLlamadaEntrante(null);
    setEstado("Llamada finalizada");

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }

  function detenerCamara() {
    finalizarLlamada();

    localStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    localStreamRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    setCamaraActiva(false);
    setMicrofonoActivo(true);
    setEstado("Cámara desactivada");
  }

  async function copiarId() {
    try {
      await navigator.clipboard.writeText(miId);
      setEstado("ID copiado. Ya puedes compartirlo.");
    } catch {
      setEstado("Selecciona y copia tu ID manualmente.");
    }
  }

  return (
    <section className="communication-view">
      <div className="communication-heading">
        <span className="eyebrow">COMUNICACIÓN EN TIEMPO REAL</span>
        <h2>Conectemos dos dispositivos</h2>
        <p>
          Comparte tu ID con otra persona para iniciar una
          videollamada.
        </p>
      </div>

      <div className="connection-panel">
        <h3>Tu identificador de conexión</h3>

        <div className="my-id">
          <code>{miId || "Generando ID..."}</code>
          <button
            type="button"
            onClick={copiarId}
            disabled={!miId}
          >
            Copiar ID
          </button>
        </div>

        <label htmlFor="peer-destino">
          ID de la otra persona
        </label>

        <input
          id="peer-destino"
          value={idDestino}
          onChange={(event) => setIdDestino(event.target.value)}
          placeholder="Pega aquí el ID recibido"
          autoComplete="off"
        />

        <button
          type="button"
          className="primary-button"
          onClick={llamar}
          disabled={!camaraActiva || conectado}
        >
          Iniciar videollamada
        </button>

        {llamadaEntrante && (
          <div className="incoming-call">
            <p>¡Una persona te está llamando!</p>
            <button type="button" onClick={responder}>
              Responder llamada
            </button>
          </div>
        )}
      </div>

      <div className="communication-grid">
        <article className="communication-card">
          <h3>Mi cámara</h3>

          <div className="video-container">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
            />

            {!camaraActiva && (
              <div className="video-placeholder">
                <span>📷</span>
                <p>Tu cámara aparecerá aquí</p>
              </div>
            )}
          </div>
          <p className="video-caption">Tu dispositivo</p>
        </article>

        <article className="communication-card">
          <h3>La otra persona</h3>

          <div className="video-container">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
            />

            {!conectado && (
              <div className="video-placeholder">
                <span>👤</span>
                <p>Esperando conexión...</p>
              </div>
            )}
          </div>
          <p className="video-caption">
            {conectado ? "Conectado" : "Sin conexión"}
          </p>
        </article>
      </div>

      <div className="communication-status">
        <span className={conectado ? "status-dot online" : "status-dot"} />
        <span>{estado}</span>
      </div>

      <div className="communication-controls">
        {!camaraActiva ? (
          <button
            type="button"
            className="primary-button"
            onClick={activarCamara}
          >
            Activar cámara y micrófono
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={silenciarMicrofono}
            >
              {microfonoActivo
                ? "🎙️ Silenciar micrófono"
                : "🔇 Activar micrófono"}
            </button>

            <button
              type="button"
              className="danger-button"
              onClick={finalizarLlamada}
            >
              Finalizar llamada
            </button>

            <button
              type="button"
              onClick={detenerCamara}
            >
              Apagar cámara
            </button>
          </>
        )}
      </div>

      <div className="communication-note">
        <strong>Próximo objetivo:</strong> integrar el reconocimiento
        de voz y el avatar de Lengua de Señas Colombiana.
      </div>
    </section>
  );
}
