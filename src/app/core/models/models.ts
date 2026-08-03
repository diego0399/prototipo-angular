// Interfaces de SISGOST — Sistema de Gestión y Seguimiento de Soporte Técnico (CNR)
// Los datos provienen de archivos JSON simulados en assets/data; no hay backend ni base de datos.

/** Roles internos con acceso al sistema. Dirección y Usuario Final NO son roles: participan solo como datos del proceso. */
export type RolClave = 'tec-soporte' | 'tec-hardware' | 'enc-soporte' | 'enc-hardware' | 'admin';

export interface UsuarioSistema {
  usuario: string;
  nombre: string;
  rol: string;
  clave: RolClave;
  iniciales: string;
  unidad: string;
  estado: string;
  /** Dirección a la que está asignado el Técnico de Soporte. Dato del usuario, no un módulo nuevo. */
  direccionAsignada?: string;
}

/**
 * Solicitud / requerimiento externo. La descripción indica el tipo de equipo solicitado
 * (Laptop, CPU…) SIN mencionar nuevo/usado: la condición pertenece al equipo del inventario.
 * `equipoInventario` queda '' hasta que se asigna un equipo preparado (SIN ASIGNACIÓN).
 */
export interface Solicitud {
  expediente: string;
  origenTipo: 'Memorando' | 'Requerimiento';
  origenRef: string;
  tipoEquipo: 'Laptop' | 'Desktop';
  descripcion: string;
  destinatario: string;
  carne: string;
  unidadDestino: string;
  direccionGerencia: string;
  correoDestinatario: string;
  estado: string;
  fecha: string;
  diasEnFase: number;
  pendiente: string;
  equipoInventario: string;
  nota: string;
}

/**
 * Equipo del Inventario de Hardware. Sus estados de preparación (Pendiente de preparación ·
 * En preparación · Preparado) y de asignación (No asignado · Asignado) se derivan en el
 * DataService a partir del expediente técnico, el F0288 y las asignaciones.
 */
export interface Equipo {
  inventario: string;
  serie: string;
  marca: string;
  modelo: string;
  tipo: 'Laptop' | 'Desktop';
  condicion: 'Nuevo' | 'Usado';
  procesador: string;
  ram: string;
  disco: string;
  sistemaOperativo: string;
  observaciones: string;
  expediente: string;
  /** Registro automático del ingreso al Inventario de Hardware. */
  fechaIngreso?: string;
  horaIngreso?: string;
  ingresadoPor?: string;
  /** De dónde salieron los datos del equipo: la base institucional simulada o la carga manual. */
  origenDato?: string;
  /** Fecha del dato en el origen (la del registro institucional, o la del ingreso si fue manual). */
  ultimaActualizacion?: string;
}

/**
 * Ficha de un equipo en la **base de datos institucional simulada** que SISGOST consulta por
 * número de inventario antes de ingresarlo. Es un catálogo de solo lectura: no se edita ni se
 * persiste con el resto del estado; solo sirve para autocompletar el ingreso al Inventario de
 * Hardware y evitar que los datos se tecleen a mano.
 */
export interface EquipoCatalogoInstitucional {
  inventario: string;
  tipo: 'Laptop' | 'Desktop';
  marca: string;
  modelo: string;
  serie: string;
  procesador: string;
  ram: string;
  almacenamiento: string;
  /** Vacío cuando el equipo no trae sistema operativo y se instalará en la preparación. */
  sistemaOperativo: string;
  /** Condición física con la que figura en el registro institucional. */
  estadoFisicoInicial: 'Nuevo' | 'Usado';
  observacionRegistro: string;
  ultimaActualizacion: string;
}

/** Desenlace de una consulta a la base institucional simulada. */
export type ResultadoConsultaInventario = 'Formato inválido' | 'No encontrado' | 'Encontrado' | 'Ya registrado';

/** Desenlace de una fila dentro de la vista previa del ingreso múltiple. */
export type ResultadoFilaLote = 'Listo para ingresar' | 'No encontrado' | 'Formato inválido' | 'Ya registrado';

/** Fila de la vista previa del ingreso múltiple: una por cada número de inventario digitado. */
export interface FilaValidacionLote {
  inventario: string;
  tipo: 'Laptop' | 'Desktop' | null;
  marca: string;
  modelo: string;
  serie: string;
  resultado: ResultadoFilaLote;
  ficha?: EquipoCatalogoInstitucional;
}

/**
 * Respuesta de `consultarBaseInstitucional`. `equipo` viene con datos solo cuando el número
 * existe en el catálogo; en «No encontrado» y «Formato inválido» queda vacío a propósito para
 * no autocompletar datos inventados.
 */
export interface ConsultaInventario {
  resultado: ResultadoConsultaInventario;
  inventario: string;
  mensaje: string;
  equipo?: EquipoCatalogoInstitucional;
}

export type EstadoPreparacionEquipo = 'Pendiente de preparación' | 'En preparación' | 'Preparado';
export type EstadoAsignacionEquipo = 'No asignado' | 'Asignado';

/** Motivo de un ingreso del equipo a la unidad de Hardware. El primero siempre es «Preparación inicial». */
export type MotivoIngreso =
  | 'Preparación inicial'
  | 'Reingreso por reasignación'
  | 'Reingreso por garantía'
  | 'Reingreso por devolución'
  | 'Reingreso por revisión técnica'
  | 'Reingreso por cambio de usuario'
  | 'Otro';

/**
 * Ingreso del equipo a la unidad de Hardware: el primero se registra automáticamente al
 * ingresar el equipo al Inventario; los siguientes (reingresos) los origina un Descargo o se
 * registran manualmente. Nunca se sobrescribe: cada ingreso queda como historial propio.
 */
export interface IngresoHardware {
  idIngresoHardware: string;
  inventario: string;
  /** 1, 2, 3… por equipo. */
  numeroIngreso: number;
  fechaIngreso: string;
  horaIngreso: string;
  motivoIngreso: MotivoIngreso;
  ingresadoPor: string;
  estadoInicial: string;
  estadoFinal: string;
  /** Código del Expediente técnico creado a partir de este ingreso, una vez que existe. */
  expedienteTecnicoAsociado?: string;
  observaciones: string;
}

export interface ResponsablesFase {
  expedienteTecnico: string;
  unidadPreparacion: 'Soporte' | 'Hardware';
  tecnicoPreparacion: string;
  estadoPreparacion: string;
  unidadConfiguracion: 'Soporte' | 'Hardware';
  tecnicoConfiguracion: string;
  estadoConfiguracion: string;
  responsableEntrega: string;
  estadoEntrega: string;
  observaciones: string;
}

export interface Asignacion {
  expediente: string;
  equipoInventario: string;
  usuarioFinal: string;
  tipoEquipo: 'Laptop' | 'Desktop';
  condicion: 'Nuevo' | 'Usado';
  responsableAsignacion: string;
  decideDireccion: boolean;
  fecha: string;
  estado: string;
  observacion: string;
  responsablesFase: ResponsablesFase;
  /** true mientras el equipo sigue activamente en poder del usuario final; un Descargo la cierra (false) sin borrarla. */
  vigente: boolean;
}

/** Motivo por el que un usuario final entrega/deja de tener el equipo. */
export type MotivoDescargo =
  | 'Cambio de usuario'
  | 'Cambio de equipo'
  | 'Devolución'
  | 'Reasignación'
  | 'Falla'
  | 'Garantía'
  | 'Finalización de uso'
  | 'Otro';

/** Qué ocurre con el equipo inmediatamente después del descargo. */
export type AccionPosteriorDescargo =
  | 'Reingresar a Hardware'
  | 'Enviar a nueva preparación'
  | 'Dejar pendiente de revisión'
  | 'Marcar como no disponible'
  | 'Preparar para reasignación';

/**
 * Descargo: el equipo deja de estar asignado a un usuario final y vuelve al flujo interno.
 * Lo registra el Técnico de Soporte asignado (el Encargado de Soporte solo supervisa/consulta).
 * Cierra la Asignación vigente del equipo (la marca `vigente: false`, sin borrarla) y **cierra
 * como histórico todo el ciclo anterior** (Expediente técnico, F0288, Expediente único, F0302
 * y Garantía si existían): no se eliminan, pero dejan de poder reutilizarse para un ciclo
 * nuevo. Según `accionPosterior`, puede además originar un nuevo Ingreso a Hardware (reingreso).
 */
export interface Descargo {
  idDescargo: string;
  inventario: string;
  /** Expediente de la Asignación que este descargo cierra. */
  asignacionRelacionada: string;
  usuarioFinalEntrega: string;
  /** Técnico de Soporte que registra el descargo (o Administrador). */
  responsableRegistro: string;
  fechaDescargo: string;
  motivoDescargo: MotivoDescargo;
  estadoFisico: string;
  observaciones: string;
  /** Código del Expediente único del ciclo que este descargo cierra, si llegó a existir. */
  expedienteUnicoAnterior?: string;
  accionPosterior: AccionPosteriorDescargo;
  /** Encargado al que se dirige el equipo tras el descargo: CPU → Encargado de Hardware, Laptop → Encargado de Soporte. */
  encargadoDestino: 'Encargado de Hardware' | 'Encargado de Soporte';
  estado: 'Registrado' | 'Procesado';
}

export type TipoExpedienteTecnico = 'Laptop nueva' | 'Laptop usada' | 'CPU nuevo' | 'CPU usado';

/**
 * Expediente de preparación técnica: pertenece al EQUIPO y a su preparación, sin ninguna
 * relación con solicitudes o requerimientos (esa unión ocurre después, en el Expediente
 * único). Solo lo crean los Encargados (Soporte o Hardware) y alimenta el F0288.
 */
export interface ExpedienteTecnico {
  codigo: string;
  inventario: string;
  tipoEquipo: 'Laptop' | 'Desktop';
  condicion: 'Nuevo' | 'Usado';
  marcaModelo: string;
  unidadResponsable: 'Soporte' | 'Hardware';
  creadoPor: string;
  tecnicoPreparacion: string;
  tipoExpediente: TipoExpedienteTecnico;
  observaciones: string;
  /** Creado · En preparación · Preparado · Cerrado (cerrado por un Descargo: ya no reutilizable). */
  estado: 'Creado' | 'En preparación' | 'Preparado' | 'Cerrado';
  fecha: string;
  /** Prioridad informativa para ordenar los pendientes por preparar de un técnico. 'Normal' si no se indica. */
  prioridad?: 'Normal' | 'Alta';
}

export interface AnexoExpediente {
  nombre: string;
  detalle: string;
  estado: string;
  fecha: string;
}

export interface ExpedienteUnico {
  expediente: string;
  /** Código propio del expediente único (p. ej. EXP-2026-0001), distinto del número de solicitud. */
  codigoUnico: string;
  estado: string;
  resumenEstado: string;
  fechaEntrega: string;
  anexos: AnexoExpediente[];
}

export interface ChecklistItem {
  nombre: string;
  estado: 'Realizado' | 'Pendiente' | 'No solicitado' | 'No aplica';
  evidencia: string | null;
  nota: string;
  /** Código del catálogo de software (`SoftwareCatalogo.codigo`), solo en ítems que instalan un software controlado (p. ej. «Instalación de Windows» → SOFT-001). */
  codigoSoftware?: string;
  /** Versión elegida entre `SoftwareCatalogo.versionesPermitidas`, cuando `codigoSoftware` aplica. */
  versionSeleccionada?: string;
  /**
   * Ítems que no se pueden dar por instalados sin captura de evidencia (en el F0288, «Instalación
   * de Antivirus» e «Instalación de OCS Inventory»): `cerrarPreparacion` bloquea el cierre y la
   * generación del documento mientras falte la captura.
   */
  requiereEvidencia?: boolean;
}

export interface ChecklistSeccion {
  titulo: string;
  items: ChecklistItem[];
}

export interface SeccionOculta {
  nombre: string;
  motivo: string;
}

export interface EvidenciaF0288 {
  item: string;
  tipo: string;
  cargadaPor: string;
  fecha: string;
  estado: string;
}

export interface Firma {
  quien: string;
  detalle: string;
  estado: string;
  fecha: string;
  /** Hora de captura de la firma simulada (se registra junto con la fecha al firmar). */
  hora?: string;
}

/** Estado de una firma dentro de la sección «Firmas registradas» del Generador de documentos. */
export type EstadoFirmaProceso = 'Capturada' | 'Pendiente' | 'No aplica';

/**
 * Firma simulada consolidada de un proceso (se deriva de los datos reales del F0288, F0302,
 * conformidad y entrega; no se almacena aparte para que nunca quede desincronizada).
 */
export interface FirmaProceso {
  documento: string;
  rotulo: string;
  nombre: string;
  rol: string;
  fecha: string;
  hora: string;
  estado: EstadoFirmaProceso;
  detalle: string;
}

/** Respuesta de las preguntas Sí/No del F0288; '' = aún sin responder. */
export type RespuestaSiNo = '' | 'Sí' | 'No';

/** Nivel de complejidad registrado al finalizar una preparación F0288 o configuración F0302. */
export type NivelComplejidad = 'Sin complejidad' | 'Baja' | 'Media' | 'Alta';

/**
 * Cronómetro de una preparación F0288 o configuración F0302: inicia cuando el técnico
 * presiona «Iniciar…» y se detiene al finalizar. Guarda fecha y hora de ambos extremos
 * y la duración total; mientras está en curso, `duracionMinutos` es null.
 */
export interface Cronometro {
  fechaInicio: string;
  horaInicio: string;
  iniciadoPor: string;
  fechaFin: string;
  horaFin: string;
  finalizadoPor: string;
  duracionMinutos: number | null;
}

/**
 * Registro técnico del cierre de una preparación o configuración: nivel de complejidad,
 * si hubo complejidad (con detalle obligatorio cuando la respuesta es Sí) y la
 * observación técnica opcional cuando no la hubo.
 */
export interface CierreTecnico {
  nivel: NivelComplejidad;
  hubo: RespuestaSiNo;
  detalle: string;
  observacion: string;
}

/**
 * Verificación de falla del F0288 (equipo usado). Los campos de detalle solo aplican
 * cuando la respuesta es «Sí»; con «No» quedan como no aplicables y se ocultan.
 */
export interface VerificacionFalla {
  respuesta: RespuestaSiNo;
  fallaEncontrada: string;
  diagnostico: string;
  accionRealizada: string;
  observaciones: string;
}

/**
 * Desenlace de la búsqueda de un accesorio en la base institucional simulada. «No corresponde al
 * equipo» = familia equivocada (accesorio de laptop en un CPU o al revés); «No corresponde al
 * accesorio» = familia correcta pero sufijo de otro accesorio (p. ej. un «-02» de Monitor cuando
 * se seleccionó Mouse); «Asociado a otro equipo» = el accesorio ya está en otro F0288 vigente.
 */
export type ResultadoConsultaAccesorio =
  | 'Encontrado' | 'No encontrado' | 'Formato inválido'
  | 'No corresponde al equipo' | 'No corresponde al accesorio' | 'Asociado a otro equipo';

/**
 * Ficha de un accesorio en la base institucional simulada de accesorios, consultada por su
 * número de inventario (equipo principal + sufijo, p. ej. `2201-00-101-0001-02`).
 */
export interface AccesorioCatalogoInstitucional {
  numeroInventario: string;
  tipo: string;
  marca: string;
  modelo: string;
  serie: string;
  estadoFisico: string;
}

/**
 * Accesorio a verificar del equipo usado. El conjunto de accesorios (nombre, familia y sufijo
 * esperado) depende del tipo de equipo: CPU usado → familia `2201-00-101` con Monitor (-02),
 * Teclado (-03) y Mouse (-04); Laptop usada → familia `2201-00-920` con Mouse (-02) y Maletín
 * (-03). Al marcar `seleccionado`, se habilita la búsqueda por número de inventario contra
 * `AccesorioCatalogoInstitucional`; los campos de la ficha solo se autocompletan cuando
 * `resultadoBusqueda` es «Encontrado» — nunca se inventan datos.
 *
 * El correlativo del accesorio **no tiene que coincidir** con el del equipo principal: los
 * accesorios son bienes con su propio número de inventario y se asocian por familia y sufijo.
 */
export interface AccesorioVerificado {
  nombre: string;
  /** Prefijo de familia que debe tener el accesorio: `2201-00-101` (CPU) o `2201-00-920` (Laptop). */
  familiaEsperada: string;
  sufijoEsperado: string;
  seleccionado: boolean;
  numeroInventario: string;
  resultadoBusqueda: ResultadoConsultaAccesorio | '';
  marca: string;
  modelo: string;
  serie: string;
  estadoFisico: string;
  observacion: string;
  /** Técnico que hizo la verificación (se sella cuando el accesorio se asocia al F0288). */
  verificadoPor: string;
  /** Fecha y hora de la verificación (`YYYY-MM-DD HH:mm`); vacía mientras no se haya asociado. */
  fechaVerificacion: string;
}

/** Verificación de accesorios del F0288 (equipo usado): detalle visible solo con respuesta «Sí». */
export interface VerificacionAccesorios {
  respuesta: RespuestaSiNo;
  accesorios: AccesorioVerificado[];
  observaciones: string;
}

/**
 * Etapa del proceso en la que se usa un software del catálogo. Sustituye a los antiguos
 * indicadores `aplicaF0288`/`aplicaF0302`: el control es por etapa, no por tipo de equipo.
 */
export type EtapaSoftware = 'Preparación F0288' | 'Configuración F0302' | 'Ambas etapas';

/** Categorías permitidas para clasificar el software del catálogo. */
export type CategoriaSoftware =
  | 'Sistema operativo' | 'Componentes de Windows' | 'Ofimática' | 'Seguridad' | 'Inventario'
  | 'Navegación' | 'Utilidad' | 'Red' | 'Comunicación' | 'Otro';

/** Tipo de licenciamiento, solo cuando el software requiere licencia. */
export type TipoLicencia = 'Institucional' | 'Por usuario' | 'Por equipo' | 'Libre' | 'Otro';

/**
 * Catálogo de software permitido para los checklists F0288 y F0302: controla qué software puede
 * seleccionarse, qué versiones están permitidas y en qué etapa del proceso se usa. Se administra
 * desde su propia pantalla («Catálogo de software»); los checklists F0288/F0302 solo lo
 * consultan, nunca lo editan.
 *
 * No distingue CPU de Laptop a propósito: el tipo de equipo ya se conoce por el inventario y el
 * software permitido se usa en escritorio o laptop según corresponda, sin configurarlo aquí.
 */
export interface SoftwareCatalogo {
  codigo: string;
  nombre: string;
  categoria: CategoriaSoftware | string;
  /** Descripción opcional del uso del software. */
  descripcion: string;
  versionesPermitidas: string[];
  versionVigente: string;
  /** Etapa del proceso donde se ofrece: F0288, F0302 o ambas. */
  etapa: EtapaSoftware;
  requiereLicencia: boolean;
  /** Tipo de licencia; vacío cuando `requiereLicencia` es false. */
  tipoLicencia: TipoLicencia | '';
  activo: boolean;
  observacion: string;
  /** Fecha y hora del último alta/edición/cambio de estado (`YYYY-MM-DD HH:mm`). */
  ultimaActualizacion: string;
}

/** Checklist F0288, identificado por el código del expediente técnico (pertenece al equipo). */
export interface PreparacionF0288 {
  expedienteTecnico: string;
  unidad: 'Soporte' | 'Hardware';
  tecnico: string;
  creadoPor: string;
  fecha: string;
  estado: string;
  datosGenerales: { provieneDe: string; referencia: string; inventario: string; ram: string; disco: string };
  seccionesOcultas: SeccionOculta[];
  secciones: ChecklistSeccion[];
  /** Solo equipos usados: preguntas Sí/No con campos dinámicos según la respuesta. */
  verificacionFalla?: VerificacionFalla;
  verificacionAccesorios?: VerificacionAccesorios;
  evidencias: EvidenciaF0288[];
  firma: Firma;
  /** Registro de tiempo de la preparación (inicia con «Iniciar preparación»). */
  cronometro?: Cronometro;
  /** Complejidad y observación técnica registradas al finalizar la preparación. */
  cierre?: CierreTecnico;
}

export interface SoftwareF0302 {
  nombre: string;
  version: string;
  estado: string;
  evidencia: string | null;
  /** Código del catálogo de software, cuando el ítem proviene de `SoftwareCatalogo` (controla las versiones permitidas). */
  codigoSoftware?: string;
  /** Categoría del catálogo (para agrupar y para el checkbox «Seleccionar todo» por categoría). */
  categoria?: string;
}

export interface ConfiguracionF0302 {
  expediente: string;
  tecnico: string;
  seleccionadoPor: string;
  fecha: string;
  estado: string;
  datos: {
    requerimiento: string; inventario: string; nombrePC: string; tipoServicio: string;
    asignadoA: string; carne: string; direccionGerencia: string; unidad: string; puesto: string;
    sistemaOperativo: string; arquitectura: string;
    /**
     * Reserva de IP del checklist F0302. '' = aún sin responder: es dato obligatorio del
     * expediente, igual que el nombre del equipo, y se pregunta antes de finalizar.
     */
    requiereReservaIP?: RespuestaSiNo;
    /** IP reservada; obligatoria con «Sí» y vacía con «No» (se muestra como «No aplica»). */
    ipReservada?: string;
  };
  software: SoftwareF0302[];
  softwareOculto: SeccionOculta[];
  evidencias: { nombre: string; estado: string }[];
  firmas: { preparo: Firma; configuro: Firma };
  /** Registro de tiempo de la configuración (inicia con «Iniciar configuración»). */
  cronometro?: Cronometro;
  /** Complejidad y observación técnica registradas al finalizar la configuración. */
  cierre?: CierreTecnico;
  /** Falla detectada durante la configuración: si existe, el F0302 quedó «Con falla» y se devolvió a F0288. */
  falla?: FallaF0302;
}

export type EstadoConformidad = 'No enviado' | 'Enviado' | 'Pendiente de respuesta' | 'Aceptado' | 'No conforme' | 'Vencido';

export interface Entrega {
  expediente: string;
  solicitudRef: string;
  usuarioFinal: string;
  carne: string;
  correo: string;
  unidadDestino: string;
  equipo: string;
  inventario: string;
  fechaEntrega: string;
  tecnicoEntrega: string;
  tecnicoConfiguro: string;
  preparadoPor: string;
  f0302Generado: boolean;
  f0302Fecha: string;
  conformidadToken: string;
  estado: string;
}

export interface Conformidad {
  token: string;
  expediente: string;
  usuarioFinal: string;
  correo: string;
  unidad: string;
  equipo: string;
  marcaModelo: string;
  inventario: string;
  fechaEntrega: string;
  tecnicoEntrega: string;
  resumenF0302: string;
  estado: EstadoConformidad;
  fechaEnvio: string;
  vence: string;
  fechaRespuesta: string;
  aceptaTerminos: boolean;
  respuesta: string;
  observaciones: string;
  /** Nombre escrito por el usuario final al aceptar: es su firma de conformidad simulada. Solo existe si aceptó. */
  firmaUsuarioFinal?: string;
}

export type EstadoGarantia = 'Vigente' | 'Vencida' | 'Caso abierto' | 'Cerrado' | 'No iniciada';
export type EstadoCasoGarantia = 'Abierto' | 'En revisión' | 'Resuelto' | 'Cerrado';

export type TipoComentarioCaso = 'Seguimiento' | 'Revisión técnica' | 'Observación' | 'Resolución' | 'Otro';

/**
 * Comentario interno de un caso de garantía. No reemplaza la trazabilidad general:
 * es el historial de seguimiento dentro del caso, con usuario (incluye su rol),
 * fecha, hora y el estado que tenía el caso al momento de comentar.
 */
export interface ComentarioCaso {
  fecha: string;
  hora: string;
  usuario: string;
  tipo: TipoComentarioCaso;
  texto: string;
  estadoCaso: string;
}

/** Caso del servicio de garantía. Un Expediente único puede tener varios casos asociados. */
export interface CasoGarantia {
  codigo: string;
  fechaApertura: string;
  motivo: string; // Falla del equipo · Inconformidad posterior · Revisión técnica · Otro
  descripcion: string;
  responsableAtencion: string;
  estado: EstadoCasoGarantia;
  evidenciaTecnica: string;
  resultado: string;
  fechaCierre: string;
  comentarios?: ComentarioCaso[];
}

/**
 * La garantía inicia únicamente cuando el usuario final acepta el equipo: en ese momento el
 * Expediente único aparece automáticamente en el módulo Servicio de garantía.
 */
export interface Garantia {
  expediente: string;
  equipo: string;
  inventario: string;
  usuarioFinal: string;
  fechaAceptacion: string;
  fechaInicio: string;
  fechaVencimiento: string;
  estado: EstadoGarantia;
  casos: CasoGarantia[];
  nota: string;
}

export interface DocumentoGenerado {
  tipo: 'F0288' | 'F0302' | 'Entrega y aceptación' | 'Reporte final';
  expediente: string;
  generadoPor: string;
  fecha: string;
  hash: string;
}

/** Resultado de un intento de aceptación del usuario final. */
export type ResultadoIntento = 'Pendiente de firma' | 'Aceptado' | 'No conforme';

/**
 * Intento de aceptación: cada envío del formulario de conformidad queda registrado como un
 * intento propio y NUNCA se sobrescribe. Un Expediente único (y su equipo) puede acumular
 * varios intentos: p. ej. #1 No conforme → corrección → #2 Aceptado. El intento vigente
 * (el último) es el que la fase de Entrega refleja; los anteriores son historial permanente.
 */
export interface IntentoAceptacion {
  /** Código propio del intento (INT-AÑO-####). */
  id: string;
  /** Expediente único / proceso (número de solicitud) al que pertenece. */
  expediente: string;
  inventario: string;
  /** 1, 2, 3… por expediente. */
  numero: number;
  /** Token del formulario externo de ESTE intento (cada reenvío genera uno nuevo). */
  token: string;
  resultado: ResultadoIntento;
  /** Fecha y hora de la RESPUESTA del usuario final (vacías mientras está Pendiente de firma). */
  fecha: string;
  hora: string;
  fechaEnvio: string;
  usuarioFinal: string;
  /** Observación obligatoria del usuario final cuando marca No conforme. */
  observacion: string;
  /** Firma simulada del usuario final cuando acepta. */
  firma: string;
  /** Código de la corrección de Soporte que originó este reenvío (a partir del intento #2). */
  correccionRelacionada?: string;
  /** Resumen legible de la corrección realizada antes de reenviar (para mostrarlo en el nuevo formulario). */
  correccionRealizada?: string;
}

/** Clasificación de la corrección que atiende una no conformidad. */
export type TipoCorreccion =
  | 'Corrección de configuración'
  | 'Revisión técnica / Hardware'
  | 'Accesorios'
  | 'Otro';

/**
 * Corrección de una no conformidad, registrada por el Técnico de Soporte. El equipo NO se
 * descarga (nunca fue aceptado formalmente) ni se reinician contadores históricos.
 *
 * No toda inconformidad genera un nuevo Expediente técnico: tras elegir el tipo, el técnico
 * evalúa explícitamente `requiereNuevoExpediente`.
 *  - Caso A (`requiereNuevoExpediente` = false): configuración / software / usuario / dominio;
 *    se corrige sin volver a Hardware y, al finalizarla, se habilita reenviar el formulario.
 *  - Caso B (`requiereNuevoExpediente` = true): falla física / revisión de Hardware / accesorios;
 *    el equipo vuelve a Hardware (`reingresoHardware`) SIN descargo, se permite crear un nuevo
 *    Expediente técnico (`expedienteTecnicoNuevo`) y una nueva Preparación F0288, y el reenvío se
 *    habilita solo cuando esa revisión/preparación se completa. Requiere además motivo técnico,
 *    acción posterior y responsable de revisión.
 */
export interface CorreccionNoConformidad {
  /** Código propio de la corrección (COR-AÑO-####). */
  id: string;
  expediente: string;
  inventario: string;
  /** Número del intento No conforme que esta corrección atiende. */
  intentoNumero: number;
  tipo: TipoCorreccion;
  /** Evaluación explícita: ¿la corrección requiere crear un nuevo Expediente técnico? */
  requiereNuevoExpediente: boolean;
  /** Técnico de Soporte que corrigió. */
  tecnico: string;
  /** Copia de la observación del usuario final que motivó la corrección. */
  observacionUsuario: string;
  fechaInicio: string;
  horaInicio: string;
  fechaFin: string;
  horaFin: string;
  descripcion: string;
  huboComplejidad: RespuestaSiNo;
  detalleComplejidad: string;
  observacionTecnica: string;
  /** Caso B: motivo técnico de la revisión (obligatorio cuando requiere nuevo Expediente técnico). */
  motivoTecnico: string;
  /** Caso B: acción posterior prevista (obligatoria cuando requiere nuevo Expediente técnico). */
  accionPosterior: string;
  /** Caso B: responsable de la revisión técnica (obligatorio cuando requiere nuevo Expediente técnico). */
  responsableRevision: string;
  /** Caso B: código del nuevo Expediente técnico creado por la inconformidad, una vez que existe. */
  expedienteTecnicoNuevo?: string;
  /** true cuando la corrección implicó reingreso a Hardware / revisión técnica (equivale a Caso B). */
  reingresoHardware: boolean;
  estado: 'Iniciada' | 'Finalizada';
}

/** Tipo de falla detectada durante la Configuración F0302 que obliga a devolver el equipo a F0288. */
export type TipoFallaF0302 =
  | 'Falla física del equipo'
  | 'Falla de disco'
  | 'Falla de memoria'
  | 'Problema de sistema operativo'
  | 'Problema de red'
  | 'No permite ingreso a dominio'
  | 'Accesorio faltante'
  | 'Configuración incompleta por falla previa'
  | 'Otro';

/**
 * Falla detectada durante la Configuración F0302. Se registra al reportar la falla: el F0302
 * queda como intento realizado con falla (nunca se borra), el equipo regresa a revisión/
 * preparación F0288 y NO se habilita ni la aceptación ni la garantía. Conserva el tiempo
 * trabajado del cronómetro hasta el momento de la falla.
 */
export interface FallaF0302 {
  tipo: TipoFallaF0302;
  descripcion: string;
  /** ¿La falla requiere revisión de Hardware (reingreso sin descargo)? */
  requiereHardware: boolean;
  /** ¿La falla requiere una nueva Preparación F0288? */
  requiereNuevaPreparacion: boolean;
  observacionTecnica: string;
  /** Evidencia adjunta (nombre/descripción simulada), si aplica. */
  evidencia: string;
  /** Técnico de Soporte que reporta la falla. */
  tecnicoReporta: string;
  fecha: string;
  hora: string;
  /** Tiempo trabajado del F0302 hasta la falla (minutos), tomado del cronómetro. */
  tiempoMinutos: number | null;
}

/**
 * Evento de trazabilidad. `usuario` incluye el rol («Nombre — Rol») y `estado` es el estado
 * nuevo tras la acción; los campos opcionales detallan módulo, estado anterior y referencias
 * (inventario, expediente técnico, expediente único, usuario final) cuando aplican.
 */
export interface EventoTrazabilidad {
  expediente: string;
  fecha: string;
  hora: string;
  usuario: string;
  accion: string;
  estado: string;
  observacion: string;
  hito: boolean;
  modulo?: string;
  estadoAnterior?: string;
  inventario?: string;
  expedienteTecnico?: string;
  expedienteUnico?: string;
  usuarioFinal?: string;
  /** Tiempo total registrado por el cronómetro, cuando aplica (p. ej. «01 h 25 min»). */
  tiempo?: string;
  /** Nivel de complejidad registrado al cierre, cuando aplica. */
  complejidad?: string;
  /** Nombre del equipo (hostname) al momento del evento, en los eventos del F0302. */
  nombreEquipo?: string;
  /** IP reservada del equipo, en los eventos de reserva de IP y de cierre del F0302. */
  ipReservada?: string;
}
