
type Props = {
  frase: string;
};

type PatronRelacion = {
  expresion: string[];
  tipo: string;
};

type RelacionDetectada = {
  tipo: string;
  expresion: string;
  complemento: string;
  posicion: number;
};

type SegmentoAnalizado = {
  conector: string;
  palabras: string[];
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .replace(/[¿?¡!.,;:()[\]{}"'“”]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const patronesRelacion: PatronRelacion[] = [
  { expresion: ["quiero"], tipo: "Deseo o intención" },
  { expresion: ["necesito"], tipo: "Necesidad" },
  { expresion: ["busco"], tipo: "Búsqueda" },
  { expresion: ["tengo"], tipo: "Posesión o disponibilidad" },

  { expresion: ["me", "gusta"], tipo: "Preferencia" },
  { expresion: ["me", "gustan"], tipo: "Preferencia" },

  { expresion: ["puedo"], tipo: "Posibilidad o capacidad" },
  { expresion: ["puedes"], tipo: "Posible petición" },
  { expresion: ["podrias"], tipo: "Posible petición" },

  { expresion: ["estoy"], tipo: "Estado o condición" },
  { expresion: ["soy"], tipo: "Identidad o descripción" },
  { expresion: ["siento"], tipo: "Sensación o experiencia emocional" },

  { expresion: ["tomo"], tipo: "Acción de consumo" },
  { expresion: ["voy"], tipo: "Desplazamiento" },
  { expresion: ["vivo"], tipo: "Residencia o ubicación" },

  { expresion: ["ayuda"], tipo: "Acción de ayuda" },
  { expresion: ["ayudo"], tipo: "Acción de ayuda" },
  { expresion: ["ayudan"], tipo: "Acción de ayuda" },
  { expresion: ["ensena"], tipo: "Acción de enseñanza" },
  { expresion: ["enseno"], tipo: "Acción de enseñanza" },
  { expresion: ["ensenas"], tipo: "Acción de enseñanza" },
  { expresion: ["ensenan"], tipo: "Acción de enseñanza" },
  { expresion: ["acompana"], tipo: "Acción de acompañamiento" },
  { expresion: ["acompano"], tipo: "Acción de acompañamiento" },
  { expresion: ["acompanas"], tipo: "Acción de acompañamiento" },
  { expresion: ["acompanan"], tipo: "Acción de acompañamiento" },
  { expresion: ["visito"], tipo: "Acción de visita" },
  { expresion: ["visita"], tipo: "Acción de visita" },
  { expresion: ["visitan"], tipo: "Acción de visita" },
];

const conectores = [
  "y",
  "pero",
  "porque",
  "aunque",
];

const marcadoresNegacion = [
  "no",
  "nunca",
  "jamas",
  "tampoco",
];

const marcadoresPregunta = [
  "que",
  "como",
  "donde",
  "cuando",
  "quien",
  "cual",
  "cuanto",
  "por que",
];

function coincideEn(
  palabras: string[],
  expresion: string[],
  inicio: number
): boolean {
  return expresion.every(
    (palabra, indice) =>
      palabras[inicio + indice] === palabra
  );
}

function segmentarFrase(
  palabras: string[]
): SegmentoAnalizado[] {
  const segmentos: SegmentoAnalizado[] = [];
  let acumuladas: string[] = [];
  let conectorActual = "Frase principal";

  palabras.forEach((palabra) => {
    if (conectores.includes(palabra)) {
      if (acumuladas.length > 0) {
        segmentos.push({
          conector: conectorActual,
          palabras: acumuladas,
        });
      }

      acumuladas = [];
      conectorActual = `Conector: ${palabra}`;
    } else {
      acumuladas.push(palabra);
    }
  });

  if (acumuladas.length > 0) {
    segmentos.push({
      conector: conectorActual,
      palabras: acumuladas,
    });
  }

  return segmentos;
}

function segmentarFraseConPuntuacion(
  texto: string
): SegmentoAnalizado[] {
  const partes = texto
    .split(/[,;]+/)
    .map((parte) => normalizar(parte))
    .filter(Boolean);

  const resultado: SegmentoAnalizado[] = [];

  partes.forEach((parte, indice) => {
    const tokens = parte.split(" ").filter(Boolean);
    const subsegmentos = segmentarFrase(tokens);

    subsegmentos.forEach((segmento, subIndice) => {
      resultado.push({
        ...segmento,
        conector:
          indice > 0 && subIndice === 0
            ? "Separación por puntuación"
            : segmento.conector,
      });
    });
  });

  return resultado;
}

function buscarRelaciones(
  palabras: string[]
): RelacionDetectada[] {
  const encontradas: RelacionDetectada[] = [];

  for (let i = 0; i < palabras.length; i++) {
    const patron = patronesRelacion.find((actual) =>
      coincideEn(palabras, actual.expresion, i)
    );

    if (patron) {
      encontradas.push({
        tipo: patron.tipo,
        expresion: patron.expresion.join(" "),
        complemento: "",
        posicion: i,
      });

      i += patron.expresion.length - 1;
    }
  }

  return encontradas.map((relacion, indice) => {
    const siguiente = encontradas[indice + 1];

    const inicioComplemento =
      relacion.posicion + relacion.expresion.split(" ").length;

    const finComplemento = siguiente
      ? siguiente.posicion
      : palabras.length;

    return {
      ...relacion,
      complemento: palabras
        .slice(inicioComplemento, finComplemento)
        .join(" "),
    };
  });
}

function analizarNegacion(palabras: string[]) {
  const indices = palabras
    .map((palabra, indice) =>
      marcadoresNegacion.includes(palabra)
        ? indice
        : -1
    )
    .filter((indice) => indice >= 0);

  return indices.map((indice) => {
    const marcador = palabras[indice];

    const relacionPosterior = buscarRelaciones(
      palabras.slice(indice + 1)
    )[0];

    const negacionDirecta =
      marcador === "no" &&
      relacionPosterior?.posicion === 0;

    return {
      marcador,
      expresion: palabras.slice(indice).join(" "),
      detalle: negacionDirecta
        ? `La negación aparece antes de una expresión de ${relacionPosterior.tipo.toLowerCase()}.`
        : "Se detectó un marcador negativo, pero su alcance no puede determinarse con seguridad mediante estas reglas.",
    };
  });
}


function clasificarComplemento(texto: string): string[] {
  const palabras = normalizar(texto)
    .split(" ")
    .filter(Boolean);

  if (palabras.length === 0) {
    return ["Sin complemento identificado"];
  }

  const categorias = [
    {
      tipo: "Persona",
      palabras: [
        "mama", "papa", "amigo", "amiga",
        "profesor", "profesora", "hermano",
        "hermana", "doctor", "doctora",
        "nino", "nina", "familia",
      ],
    },
    {
      tipo: "Lugar",
      palabras: [
        "casa", "colegio", "escuela",
        "trabajo", "hospital", "parque",
        "ciudad", "tienda", "universidad",
      ],
    },
    {
      tipo: "Tiempo",
      palabras: [
        "hoy", "manana", "ayer",
        "ahora", "despues", "temprano",
        "tarde", "noche", "siempre",
      ],
    },
    {
      tipo: "Alimento o bebida",
      palabras: [
        "agua", "cafe", "leche", "jugo",
        "comida", "pan", "arroz", "fruta",
        "carne", "desayuno", "almuerzo",
        "cena",
      ],
    },
    {
      tipo: "Ayuda o necesidad",
      palabras: [
        "ayuda", "apoyo", "medicina",
        "medicamento", "dinero", "permiso",
      ],
    },
    {
      tipo: "Objeto",
      palabras: [
        "libro", "celular", "telefono",
        "llave", "ropa", "mesa", "silla",
        "computador", "cuaderno",
      ],
    },
    {
      tipo: "Estado o condición",
      palabras: [
        "feliz", "triste", "enfermo",
        "cansado", "cansada", "bien",
        "mal", "hambre", "sed",
        "preocupado", "preocupada",
      ],
    },
    {
      tipo: "Estado emocional",
      palabras: [
        "alegria", "amor", "miedo",
        "enojo", "rabia", "dolor",
        "tranquilidad", "angustia",
        "felicidad", "tristeza",
      ],
    },
    {
      tipo: "Actividad u ocupación",
      palabras: [
        "estudiante", "profesor",
        "profesora", "medico", "medica",
        "ingeniero", "ingeniera",
        "trabajador", "trabajadora",
        "conductor", "conductora",
        "estudio", "trabajo",
      ],
    },
  ];

  const encontradas = categorias
    .filter((categoria) =>
      categoria.palabras.some((palabra) =>
        palabras.includes(palabra)
      )
    )
    .map((categoria) => categoria.tipo);

  return encontradas.length > 0
    ? encontradas
    : ["Complemento sin clasificar"];
}
function identificarFuncionComplemento(
  tipoRelacion: string,
  categorias: string[]
): string {
  const esLugar = categorias.includes("Lugar");

  const esAlimento =
    categorias.includes("Alimento o bebida");

  const esIdentidad =
    categorias.includes("Actividad u ocupación") ||
    categorias.includes("Persona");

  const esEstado =
    categorias.includes("Estado o condición") ||
    categorias.includes("Estado emocional");

  if (tipoRelacion === "Desplazamiento") {
    return esLugar
      ? "Posible destino o lugar al que se dirige"
      : "Complemento asociado al desplazamiento";
  }

  if (tipoRelacion === "Residencia o ubicación") {
    return esLugar
      ? "Posible lugar de residencia"
      : "Ubicación de residencia pendiente de clasificar";
  }

  if (tipoRelacion === "Acción de consumo") {
    return esAlimento
      ? "Posible elemento consumido"
      : "Elemento asociado al consumo";
  }

  if (
    tipoRelacion === "Identidad o descripción"
  ) {
    return esIdentidad
      ? "Posible identidad, profesión u ocupación"
      : "Descripción de identidad pendiente de clasificar";
  }

  if (
    tipoRelacion === "Estado o condición" ||
    tipoRelacion ===
      "Sensación o experiencia emocional"
  ) {
    return esEstado
      ? "Posible estado o experiencia descrita"
      : "Complemento asociado al estado o experiencia";
  }

  if (
    tipoRelacion === "Necesidad" ||
    tipoRelacion === "Posible petición"
  ) {
    return "Posible elemento solicitado o necesitado";
  }

  if (
    tipoRelacion ===
      "Posesión o disponibilidad"
  ) {
    return "Posible elemento poseído o disponible";
  }

  return "Complemento asociado a la relación detectada";
}

function analizarRolesParticipantes(
  palabras: string[],
  posicionRelacion: number
): string[] {
  const personas = [
    "mama",
    "papa",
    "hermano",
    "hermana",
    "amigo",
    "amiga",
    "profesor",
    "profesora",
    "doctor",
    "doctora",
    "familia",
    "nino",
    "nina",
    "ninos",
    "ninas",
    "maria",
    "juan",
    "carlos",
    "ana",
  ];

  const pronombresParticipante = [
    "me",
    "te",
    "nos",
    "le",
    "les",
    "lo",
    "la",
    "los",
    "las",
    "se",
  ];

  const pronombresSujeto = [
    "yo",
    "ella",
    "nosotros",
    "nosotras",
    "ellos",
    "ellas",
    "usted",
    "ustedes",
  ];

  const encontrados: string[] = [];

  palabras.forEach((palabra, indice) => {
    if (
      pronombresSujeto.includes(palabra) &&
      indice < posicionRelacion
    ) {
      encontrados.push(
        `${palabra}: posible participante mencionado antes de la acción`
      );
      return;
    }

    if (
      pronombresParticipante.includes(palabra) &&
      indice < posicionRelacion
    ) {
      encontrados.push(
        `${palabra}: posible participante afectado o relacionado con la acción`
      );
      return;
    }

    if (!personas.includes(palabra)) {
      return;
    }

    if (indice < posicionRelacion) {
      encontrados.push(
        `${palabra}: posible participante mencionado antes de la acción`
      );
    } else {
      encontrados.push(
        `${palabra}: posible participante mencionado después de la acción; función pendiente de determinar`
      );
    }
  });

  return encontrados.length > 0
    ? encontrados
    : ["No se identificaron participantes del catálogo"];
}

export default function LSCContextAnalysis({
  frase,
}: Props) {
  const texto = frase.trim();

  if (!texto) {
    return (
      <section className="lsc-context-analysis">
        <h3>Análisis contextual del mensaje</h3>
        <p>
          Habla o escribe una frase para analizar
          sus posibles relaciones comunicativas.
        </p>
      </section>
    );
  }

  const normalizada = normalizar(texto);
  const palabras = normalizada.split(" ").filter(Boolean);

  const segmentos = segmentarFraseConPuntuacion(texto);

  const relacionesPorSegmento = segmentos.map(
    (segmento) => ({
      ...segmento,
      relaciones: buscarRelaciones(segmento.palabras),
      negaciones: analizarNegacion(segmento.palabras),
    })
  );

  const contieneExpresion = (expresion: string) =>
    (` ${normalizada} `).includes(
      ` ${normalizar(expresion)} `
    );

  const esPregunta =
    /[¿?]/.test(texto) ||
    marcadoresPregunta.some(contieneExpresion);

  const negacionesDetectadas =
    palabras.filter((palabra) =>
      marcadoresNegacion.includes(palabra)
    );

  const intenciones: string[] = [];

  if (
    contieneExpresion("hola") ||
    contieneExpresion("buenos dias") ||
    contieneExpresion("buenas noches")
  ) {
    intenciones.push("Posible saludo");
  }

  if (contieneExpresion("gracias")) {
    intenciones.push("Posible agradecimiento");
  }

  if (
    contieneExpresion("por favor") ||
    contieneExpresion("necesito") ||
    contieneExpresion("quiero") ||
    contieneExpresion("puedes") ||
    contieneExpresion("podrias") ||
    contieneExpresion("ayudame")
  ) {
    intenciones.push("Posible solicitud o petición");
  }

  if (palabras.includes("si")) {
    intenciones.push("Posible respuesta afirmativa");
  }

  if (
    negacionesDetectadas.includes("no") &&
    palabras.length <= 4
  ) {
    intenciones.push("Posible respuesta negativa");
  }

  if (intenciones.length === 0) {
    intenciones.push(
      "Intención comunicativa no identificada con estas reglas"
    );
  }

  return (
    <section className="lsc-context-analysis">
      <h3>Análisis contextual del mensaje</h3>

      <div>
        <h4>Tipo de expresión</h4>
        <p>
          {esPregunta
            ? "Se detectaron indicadores de una posible pregunta."
            : "No se detectaron indicadores claros de pregunta."}
        </p>
      </div>

      <div>
        <h4>Relaciones por segmento</h4>

        {relacionesPorSegmento.map(
          (segmento, indice) => (
            <div key={indice}>
              <h4>
                Segmento {indice + 1}
              </h4>

              <p>
                <strong>
                  {segmento.conector}
                </strong>
              </p>

              <p>
                <strong>Texto:</strong>{" "}
                {segmento.palabras.join(" ")}
              </p>

              {segmento.relaciones.length > 0 ? (
                segmento.relaciones.map(
                  (relacion, relacionIndice) => (
                    <div key={relacionIndice}>
                      <p>
                        <strong>Relación:</strong>{" "}
                        {relacion.tipo}
                      </p>

                      <p>
  <strong>Expresión:</strong>{" "}
  {relacion.expresion}
</p>

<div>
  <p>
  <strong>Roles posibles de participantes:</strong>
  </p>

  <ul>
    {analizarRolesParticipantes(
      segmento.palabras,
      relacion.posicion
    ).map((participante, participanteIndice) => (
      <li key={participanteIndice}>
        {participante}
      </li>
    ))}
  </ul>
</div>
                        
                      <div>
  <p>
    <strong>Complemento textual:</strong>{" "}
    {relacion.complemento || "No identificado"}
  </p>

  <p>
  <strong>Clasificación del complemento:</strong>{" "}
  {clasificarComplemento(
    relacion.complemento
  ).join(", ")}
</p>

<p>
  <strong>Función probable:</strong>{" "}
  {identificarFuncionComplemento(
    relacion.tipo,
    clasificarComplemento(
      relacion.complemento
    )
  )}
</p>
</div>
                    </div>
                  )
                )
              ) : (
                <p>
                  No se encontró una relación
                  reconocida en este segmento.
                </p>
              )}

              {segmento.negaciones.length > 0 ? (
                <div>
                  <strong>Negación detectada</strong>

                  {segmento.negaciones.map(
                    (negacion, negacionIndice) => (
                      <div key={negacionIndice}>
                        <p>
                          Marcador: {negacion.marcador}
                        </p>
                        <p>
                          Expresión analizada:{" "}
                          {negacion.expresion}
                        </p>
                        <p>{negacion.detalle}</p>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <p>
                  No se detectó negación en este segmento.
                </p>
              )}
            </div>
          )
        )}
      </div>

      <div>
        <h4>Posible intención comunicativa</h4>
        <ul>
          {intenciones.map((intencion) => (
            <li key={intencion}>{intencion}</li>
          ))}
        </ul>
      </div>

      <div>
        <h4>Alcance y limitaciones</h4>
        <p>
          Este módulo separa segmentos mediante
          conectores sencillos y reconoce patrones
          textuales del español. No determina por
          completo el significado ni la estructura
          gramatical de la Lengua de Señas Colombiana.
          Los resultados son experimentales y requieren
          validación lingüística.
        </p>
      </div>
    </section>
  );
}
