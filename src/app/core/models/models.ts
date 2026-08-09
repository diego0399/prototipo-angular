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
  /**
   * Dirección MAC física del equipo, tal como figura en el registro institucional. Es el origen
   * preferente del dato al solicitar la reserva de IP al Departamento de Servidores: si el equipo
   * la trae, el modal la muestra autocompletada y el técnico no la teclea.
   */
  mac?: string;
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

/**
 * Corrección de una asignación ya registrada. Nunca sustituye a la anterior: se apila, para que
 * el expediente diga qué equipo tenía antes, cuál tiene ahora y por qué cambió.
 */
export interface ModificacionAsignacion {
  fecha: string;
  hora: string;
  equipoAnterior: string;
  equipoNuevo: string;
  usuarioFinal: string;
  /** Motivo de la corrección, o el texto de la observación administrativa. */
  motivo: string;
  /** Observación que acompaña a la corrección. */
  observacion: string;
  encargado: string;
  rol: string;
  estadoAnterior: string;
  estadoNuevo: string;
  /** true cuando el proceso ya no admitía cambiar el equipo y solo se dejó una observación. */
  soloObservacion?: boolean;
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
  /** Historial de correcciones y observaciones administrativas de esta asignación. */
  modificaciones?: ModificacionAsignacion[];
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

/**
 * Motivo por el que el Técnico de Soporte agrega un software adicional en la Configuración F0302:
 * el software instalado depende del requerimiento del usuario final, no de una lista fija.
 */
export type MotivoSoftwareF0302 =
  | 'Solicitado en requerimiento' | 'Necesario para funciones del usuario'
  | 'Software institucional estándar' | 'Requerido por unidad solicitante' | 'Otro';

/**
 * Origen de un ítem del checklist F0302:
 * - `'F0302'`: software del catálogo agregado por el Técnico de Soporte según el requerimiento.
 * - `'Configuración'`: actividad general de configuración (ingreso a dominio, credenciales, Agente
 *   DLP); no es software del catálogo y no tiene control de versiones.
 *
 * El software instalado durante la Preparación F0288 **no se copia aquí**: se hereda del propio
 * F0288 (ver `DataService.softwareHeredadoF0288`) y se muestra bloqueado.
 */
export type OrigenSoftwareF0302 = 'F0302' | 'Configuración';

export interface SoftwareF0302 {
  nombre: string;
  version: string;
  estado: string;
  evidencia: string | null;
  /** Código del catálogo de software, cuando el ítem proviene de `SoftwareCatalogo` (controla las versiones permitidas). */
  codigoSoftware?: string;
  /** Categoría del catálogo (para agrupar y para el checkbox «Seleccionar todo» por categoría). */
  categoria?: string;
  /** Origen del ítem dentro del F0302; sin valor equivale a `'F0302'` (configuraciones anteriores a la regla). */
  origen?: OrigenSoftwareF0302;
  /** Versión vigente del catálogo al momento de agregarlo; la seleccionada puede ser otra permitida. */
  versionVigente?: string;
  /** Motivo o requerimiento que justifica el software; obligatorio al agregarlo desde el catálogo. */
  motivo?: MotivoSoftwareF0302 | '';
  /** Observación del técnico; obligatoria cuando el motivo es «Otro». */
  observacion?: string;
  /** Técnico de Soporte que agregó el software («Nombre — Rol»). */
  agregadoPor?: string;
  /** Fecha y hora en que se agregó (`YYYY-MM-DD HH:mm`). */
  fechaAgregado?: string;
  /**
   * Ítems que no se pueden dar por configurados sin captura de evidencia (en el F0302, el «Agente
   * DLP»): `cerrarConfiguracion` bloquea el cierre y la generación del documento mientras falte la
   * captura, incluso si el ítem se marcó con el checkbox «Seleccionar todo» de su categoría.
   */
  requiereEvidencia?: boolean;
}

/**
 * Evidencia técnica del F0302. En los ítems con captura obligatoria (Agente DLP) guarda además el
 * archivo simulado, quién lo cargó y cuándo; las evidencias declarativas del checklist solo llevan
 * nombre y estado.
 */
export interface EvidenciaF0302 {
  nombre: string;
  estado: string;
  /** Ítem del checklist F0302 al que respalda (p. ej. «Agente DLP»). */
  item?: string;
  /** Archivo simulado cargado (p. ej. `captura-dlp-instalado.png`). */
  archivo?: string;
  /** Tipo de evidencia (p. ej. «Agente DLP»). */
  tipo?: string;
  /** Técnico que cargó la evidencia. */
  cargadaPor?: string;
  /** Fecha y hora de carga (`YYYY-MM-DD HH:mm`). */
  fecha?: string;
  /** Formulario asociado; siempre «F0302» en esta pantalla. */
  formulario?: string;
}

/**
 * Software instalado durante la Preparación F0288 tal como lo muestra la Configuración F0302:
 * información heredada, visible y bloqueada. No se vuelve a marcar ni se puede editar en F0302, y
 * tampoco puede agregarse de nuevo como software adicional.
 */
export interface SoftwareHeredadoF0288 {
  /** Nombre del catálogo (p. ej. «Antivirus institucional»). */
  nombre: string;
  /** Versión registrada en el F0288; si el registro no la guardó, la vigente del catálogo. */
  version: string;
  categoria: string;
  /** Captura registrada en el F0288, o null si ese ítem no exigía evidencia. */
  evidencia: string | null;
  codigoSoftware: string;
  /** Ítem del checklist F0288 del que proviene (p. ej. «Instalación de Antivirus»). */
  item: string;
  /** Expediente técnico del F0288 que lo instaló. */
  expedienteTecnico: string;
}

/**
 * Estado de la solicitud de reserva de IP ante el Departamento de Servidores. Es el dato que
 * decide si el formulario de conformidad puede enviarse: con «Sí» a la reserva, solo «Enviada»
 * habilita el envío.
 */
export type EstadoSolicitudReservaIP = 'No aplica' | 'Pendiente de envío' | 'Enviada';

/**
 * Correo simulado que SISGOST envía al Departamento de Servidores para pedir la reserva de una IP.
 * El prototipo no envía correo real: se arma con los datos del expediente, se muestra en pantalla y
 * queda registrado como envío simulado en el expediente y la trazabilidad.
 */
export interface SolicitudReservaIP {
  para: string;
  asunto: string;
  nombreEquipo: string;
  inventario: string;
  tipoEquipo: string;
  mac: string;
  ip: string;
  usuarioFinal: string;
  expedienteUnico: string;
  tecnico: string;
  /** Fecha y hora de la solicitud (`YYYY-MM-DD HH:mm`). */
  fecha: string;
  /** Cuerpo del correo ya redactado, tal como se muestra en el modal y en el documento. */
  cuerpo: string;
}

export interface ConfiguracionF0302 {
  expediente: string;
  tecnico: string;
  seleccionadoPor: string;
  fecha: string;
  estado: string;
  datos: {
    requerimiento: string; inventario: string;
    /**
     * Nombre del equipo (hostname) que digita el Técnico de Soporte en el checklist F0302, p. ej.
     * `DT-KRIVAS-045`. '' = aún sin registrar: es dato obligatorio del expediente y se exige antes
     * de finalizar la configuración.
     */
    nombrePC: string;
    tipoServicio: string;
    asignadoA: string; carne: string; direccionGerencia: string; unidad: string; puesto: string;
    sistemaOperativo: string; arquitectura: string;
    /**
     * Reserva de IP del equipo. '' = aún sin responder. **Solo se captura desde el modal de
     * validación previo al envío del formulario de conformidad**: no es una sección del checklist
     * F0302. Una vez guardada se muestra como dato de consulta en el detalle, el documento, el
     * expediente único, el historial técnico y la trazabilidad.
     */
    requiereReservaIP?: RespuestaSiNo;
    /** IP reservada; obligatoria con «Sí» y vacía con «No» (se muestra como «No aplica»). */
    ipReservada?: string;
    /**
     * MAC del equipo con la que se solicitó la reserva. Se autocompleta con la del inventario
     * institucional cuando existe; si el equipo no la trae, el técnico la digita en el modal y es
     * obligatoria para solicitar la reserva.
     */
    macEquipo?: string;
    /**
     * Por qué el equipo no requiere reserva de IP. Obligatoria cuando la respuesta es «No»: sin
     * ella el formulario de conformidad no se envía.
     */
    justificacionSinReservaIP?: string;
    /**
     * Estado de la solicitud de reserva ante el Departamento de Servidores. «No aplica» cuando el
     * equipo no requiere reserva; «Pendiente de envío» mientras el correo simulado no se haya
     * enviado; «Enviada» una vez enviado. '' mientras la reserva no se haya respondido.
     */
    estadoSolicitudIP?: EstadoSolicitudReservaIP | '';
    /** Si el correo simulado a Servidores llegó a enviarse. */
    correoReservaEnviado?: RespuestaSiNo;
    /** Fecha y hora del envío simulado (`YYYY-MM-DD HH:mm`). */
    fechaSolicitudIP?: string;
    /** Técnico que validó la reserva en el modal previo al envío del formulario («Nombre — Rol»). */
    ipValidadaPor?: string;
    /** Fecha y hora de esa validación (`YYYY-MM-DD HH:mm`). */
    ipValidadaEl?: string;
  };
  software: SoftwareF0302[];
  evidencias: EvidenciaF0302[];
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
  /**
   * Datos clave del F0302 congelados al enviar el formulario: el usuario final debe ver con qué
   * nombre y con qué reserva de IP quedó configurado el equipo que está aceptando. Son opcionales
   * porque las conformidades enviadas antes de esta regla no los guardaron; en ese caso la
   * pantalla los toma de la configuración F0302 del proceso.
   */
  nombreEquipo?: string;
  requiereReservaIP?: RespuestaSiNo;
  /** IP reservada al momento del envío; vacía cuando el equipo no requiere reserva. */
  ipReservada?: string;
  /** MAC con la que se solicitó la reserva; vacía cuando el equipo no requiere reserva. */
  macEquipo?: string;
  /** Justificación registrada cuando el equipo no requiere reserva de IP. */
  justificacionSinReservaIP?: string;
  /** Estado de la solicitud ante Servidores congelado al enviar el formulario. */
  estadoSolicitudIP?: EstadoSolicitudReservaIP;
  /** Técnico que validó la reserva en el modal previo al envío. */
  ipValidadaPor?: string;
  /** Fecha y hora de esa validación (`YYYY-MM-DD HH:mm`). */
  ipValidadaEl?: string;
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

/**
 * Estado del documento generado. Los F0288/F0302 nacen «Generado»; la constancia de reproceso
 * recorre «Pendiente de firma» → «Firmado» → «Disponible para consulta», que es lo que distingue
 * un documento que existe de uno que además puede consultarse después.
 */
export type EstadoDocumento = 'Pendiente de firma' | 'Firmado' | 'Generado' | 'Disponible para consulta';

export interface DocumentoGenerado {
  tipo: 'F0288' | 'F0302' | 'Entrega y aceptación' | 'Reporte final' | 'Constancia de reproceso F0288'
    | 'Constancia de corrección F0302 por inconformidad';
  expediente: string;
  generadoPor: string;
  fecha: string;
  hash: string;
  /**
   * Código del reproceso al que pertenece la constancia. El documento se guarda bajo el
   * expediente del proceso —para que aparezca junto a los demás— pero un mismo expediente puede
   * acumular varias constancias, una por reproceso, y este campo es lo que las distingue.
   */
  reproceso?: string;
  /** Código propio del documento (`CONST-REP-2026-0001`), en las constancias de reproceso. */
  codigo?: string;
  /** Hora de generación, para ordenar y para la trazabilidad de consulta. */
  hora?: string;
  estado?: EstadoDocumento;
  /** Expediente técnico original al que pertenece la constancia. */
  expedienteTecnico?: string;
  /** Número de inventario del equipo, para poder filtrar los documentos por equipo. */
  inventario?: string;
  /** Técnico de Hardware que firmó la constancia del reproceso. */
  tecnicoHardware?: string;
  /** Resultado del reproceso que la constancia documenta. */
  resultado?: string;
  /** Código de la corrección F0302 por inconformidad, en su constancia. */
  correccion?: string;
  /** Técnico de Soporte que firmó la constancia de corrección. */
  tecnicoSoporte?: string;
  /** Usuario final que reportó la inconformidad que la constancia documenta. */
  usuarioFinal?: string;
  /** Tipo de problema clasificado en la inconformidad, para filtrar el catálogo. */
  tipoProblema?: string;
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

/**
 * Tipo de problema que el usuario final reporta al marcar inconformidad. Cumple el mismo papel
 * que el tipo de falla del F0302: de él salen el checklist de atención y la resolución sugerida.
 */
export type TipoProblemaInconformidad =
  | 'Problema de configuración'
  | 'Problema de software'
  | 'Problema de usuario o credenciales'
  | 'Problema de dominio'
  | 'Problema de red'
  | 'Problema de IP reservada'
  | 'Problema con Agente DLP'
  | 'Accesorio faltante'
  | 'Falla física del equipo'
  | 'Falla de disco'
  | 'Falla de memoria'
  | 'Problema de sistema operativo'
  | 'Otro';

/**
 * Cómo se resuelve la inconformidad. Es la misma disyuntiva de una falla en F0302: lo que Soporte
 * puede corregir sobre la configuración no vuelve a Hardware, y lo que toca el equipo sí.
 */
export type ResolucionInconformidad = 'Corrección F0302' | 'Reproceso F0288';

/** Resultado con el que se cierra la atención de una inconformidad. */
export type ResultadoInconformidad =
  | 'Corregido en F0302'
  | 'Corregido con reproceso F0288'
  | 'No corregido';

/**
 * Estado de la incidencia de conformidad, desde que el usuario final marca No conforme hasta que
 * acepta y la garantía inicia. Mientras no llegue a `CONFORMIDAD_ACEPTADA` la entrega no cierra.
 */
export type EstadoIncidenciaConformidad =
  | 'CONFORMIDAD_NO_ACEPTADA'
  | 'INCIDENCIA_CONFORMIDAD_REGISTRADA'
  | 'PENDIENTE_EVALUACION_INCONFORMIDAD'
  | 'CORRECCION_F0302_REQUERIDA'
  | 'CORRECCION_F0302_EN_PROCESO'
  | 'CORRECCION_F0302_FINALIZADA'
  | 'CORRECCION_F0302_FIRMADA'
  | 'REPROCESO_F0288_REQUERIDO'
  | 'REPROCESO_F0288_PENDIENTE_ASIGNACION'
  | 'REPROCESO_F0288_ASIGNADO'
  | 'REPROCESO_F0288_FINALIZADO'
  | 'REPROCESO_F0288_FIRMADO'
  | 'LISTO_PARA_REENVIO_CONFORMIDAD'
  | 'FORMULARIO_CONFORMIDAD_REENVIADO'
  | 'CONFORMIDAD_ACEPTADA'
  | 'GARANTIA_HABILITADA';

/**
 * Ítem del checklist de atención de la inconformidad. Cambia según el tipo de problema: revisar
 * credenciales no tiene nada que ver con revisar un disco.
 */
export interface ItemCorreccion {
  nombre: string;
  estado: 'Realizado' | 'Pendiente' | 'No aplica';
  /**
   * true en los ítems que producen algo que adjuntar (instalación, cambio de acceso, captura del
   * Agente DLP). Marcar uno hace obligatoria la evidencia.
   */
  implicaEvidencia?: boolean;
  nota: string;
}

/** Evidencia simulada adjuntada durante la corrección F0302 por inconformidad. */
export interface EvidenciaCorreccion {
  archivo: string;
  tipo: string;
  fecha: string;
  hora: string;
  cargadaPor: string;
  /** Código de la corrección y expediente del proceso: la evidencia se guarda con ambos. */
  correccion: string;
  expediente: string;
}

/** Firma simulada del Técnico de Soporte que cierra la corrección F0302 por inconformidad. */
export interface FirmaCorreccion {
  nombre: string;
  cargo: string;
  unidad: string;
  fecha: string;
  hora: string;
  /** Firma simulada del prototipo (no hay firma electrónica real). */
  firma: string;
}

/**
 * Atención de una inconformidad del usuario final. Se resuelve igual que una falla detectada en
 * F0302: se clasifica el problema, se decide si lo corrige Soporte sobre la configuración o si
 * requiere volver a Hardware, y se cierra con firma.
 *  - `resolucion` = «Corrección F0302»: Soporte corrige, no se toca el Expediente técnico y la
 *    corrección cierra con la firma del Técnico de Soporte.
 *  - `resolucion` = «Reproceso F0288»: se genera un reproceso `…-R1` sobre el MISMO Expediente
 *    técnico (`reprocesoId`), lo asigna un Encargado y lo firma el Técnico de Hardware.
 *
 * En ninguno de los dos casos se crea un Expediente técnico principal nuevo, ni se descarga el
 * equipo (nunca fue aceptado formalmente), ni se reinician contadores históricos.
 */
export interface CorreccionNoConformidad {
  /** Código propio de la corrección (COR-F0302-AÑO-####). */
  id: string;
  expediente: string;
  inventario: string;
  /** Número del intento No conforme que esta corrección atiende. */
  intentoNumero: number;
  /** Clasificación del problema reportado por el usuario final. */
  tipoProblema: TipoProblemaInconformidad;
  /** Resolución elegida por Soporte o el Encargado. */
  resolucion: ResolucionInconformidad;
  /** Lo que la matriz sugiere para ese tipo de problema (§7 y §8). */
  sugerencia: ResolucionInconformidad;
  /** Justificación obligatoria cuando la resolución elegida no coincide con la sugerida. */
  justificacionResolucion: string;
  /** «Problema de red»: ¿la revisión es física? Es lo que decide entre corregir en F0302 o ir a Hardware. */
  revisionFisicaRed?: RespuestaSiNo;
  /** «Problema de sistema operativo»: ¿requiere reinstalación o reparación base? Misma disyuntiva. */
  reinstalacionSO?: RespuestaSiNo;
  /** Técnico de Soporte que atiende la inconformidad. */
  tecnico: string;
  /** Copia de la observación del usuario final que motivó la corrección. */
  observacionUsuario: string;
  usuarioFinal: string;
  fechaInicio: string;
  horaInicio: string;
  fechaFin: string;
  horaFin: string;
  /** Cronómetro de la corrección: arranca al atender la inconformidad y se detiene al finalizarla. */
  cronometro?: Cronometro;
  /** Checklist de atención, según el tipo de problema. */
  checklist: ItemCorreccion[];
  evidencias: EvidenciaCorreccion[];
  descripcion: string;
  huboComplejidad: RespuestaSiNo;
  detalleComplejidad: string;
  observacionTecnica: string;
  resultado: ResultadoInconformidad | '';
  /** Firma del Técnico de Soporte: sin ella la corrección F0302 no se finaliza. */
  firma?: FirmaCorreccion;
  /** Reproceso F0288 generado por esta inconformidad, cuando la resolución es de Hardware. */
  reprocesoId?: string;
  /** Estado de la incidencia de conformidad; avanza con cada paso de la atención. */
  estadoIncidencia: EstadoIncidenciaConformidad;
  estado: 'Iniciada' | 'Finalizada' | 'Firmada' | 'Derivada a reproceso F0288' | 'Cerrada por reproceso F0288';
}

/**
 * Tipo de falla detectada durante la Configuración F0302. NO todas devuelven el equipo a F0288:
 * cada tipo tiene su propio checklist y su propia sugerencia de reproceso (ver `matrizFalla`).
 */
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
 * Lo que la matriz por tipo de falla sugiere sobre el reproceso F0288. «Depende» significa que la
 * respuesta sale de una pregunta adicional del checklist (reinstalación del SO, revisión física de
 * red, acción requerida) y no del tipo de falla por sí solo.
 */
export type SugerenciaReproceso = 'Sí' | 'No' | 'Depende';

/** Acción requerida cuando la configuración quedó incompleta por una falla previa. */
export type AccionRequeridaFalla =
  | 'Corregir en F0302'
  | 'Revisar por Hardware'
  | 'Reproceso F0288'
  | 'Escalar a Encargado';

/**
 * Estado de la incidencia de configuración abierta por una falla en F0302. Sustituye a la idea de
 * «nuevo expediente técnico»: la incidencia vive dentro del expediente técnico vigente y avanza
 * hasta quedar lista para un nuevo intento F0302.
 */
export type EstadoIncidenciaF0302 =
  | 'INCIDENCIA_CONFIGURACION_REGISTRADA'
  | 'PENDIENTE_CORRECCION_SOPORTE'
  | 'PENDIENTE_REVISION_HARDWARE'
  | 'REPROCESO_F0288_REQUERIDO'
  | 'REPROCESO_F0288_PENDIENTE_ASIGNACION'
  | 'REPROCESO_F0288_ASIGNADO'
  | 'REPROCESO_F0288_EN_PROCESO'
  | 'REPROCESO_F0288_FINALIZADO'
  | 'REPROCESO_F0288_FIRMADO'
  | 'REPROCESO_F0288_NO_CORREGIDO'
  | 'PENDIENTE_EVALUACION_ENCARGADO'
  | 'PENDIENTE_SUSTITUCION_EQUIPO'
  | 'LISTO_PARA_REINTENTO_F0302';

/**
 * Campos del checklist dinámico de la falla: solo se llenan los que el tipo seleccionado pide. Se
 * guardan juntos para que el detalle no ensucie la falla con una decena de campos sueltos que
 * además serían inaplicables entre sí (la serie del disco no significa nada en un problema de red).
 */
export interface DetalleFallaF0302 {
  /** Falla física: componente afectado (Carcasa · Pantalla · Puertos · Fuente · Batería · Teclado · Touchpad · Otro). */
  componenteAfectado?: string;
  /** Falla de disco: tipo (HDD/SSD/NVMe/Otro) y serie, si aplica. */
  tipoDisco?: string;
  serieDisco?: string;
  /** Falla de memoria: capacidad de RAM instalada. */
  capacidadRam?: string;
  /** Falla de disco o de memoria: síntoma detectado. */
  sintoma?: string;
  /** Sistema operativo: tipo de problema y si implica reinstalación o reparación base. */
  tipoProblemaSO?: string;
  requiereReinstalacion?: RespuestaSiNo;
  /** Red: tipo de problema, datos de conectividad y si requiere revisión física por Hardware. */
  tipoProblemaRed?: string;
  mac?: string;
  ipActual?: string;
  puntoRed?: string;
  requiereRevisionFisica?: RespuestaSiNo;
  /** Dominio: cuenta utilizada, mensaje de error y nombre del equipo. */
  usuarioCuenta?: string;
  mensajeError?: string;
  nombreEquipo?: string;
  /** Accesorio faltante: cuál y su número de inventario esperado, si aplica. */
  accesorio?: string;
  inventarioEsperado?: string;
  /** Configuración incompleta: etapa donde se detectó y acción requerida. */
  etapaDeteccion?: string;
  accionRequerida?: AccionRequeridaFalla;
  /** Observación dirigida a Hardware, en las fallas que se atienden allí. */
  observacionHardware?: string;
}

/** Corrección registrada por Soporte dentro del mismo F0302, cuando la falla no exige reproceso. */
export interface CorreccionSoporteF0302 {
  descripcion: string;
  tecnico: string;
  fecha: string;
  hora: string;
}

/**
 * Falla detectada durante la Configuración F0302. El F0302 queda como intento realizado con falla
 * (nunca se borra) y se abre una incidencia de configuración sobre el MISMO expediente técnico:
 * no se crea uno nuevo. Según el tipo de falla, la incidencia se corrige en F0302 o pasa a un
 * reproceso F0288. Conserva el tiempo trabajado del cronómetro hasta el momento de la falla.
 */
export interface FallaF0302 {
  tipo: TipoFallaF0302;
  descripcion: string;
  /** ¿La falla requiere revisión por Hardware? */
  requiereHardware: boolean;
  /**
   * ¿La falla requiere reproceso de Preparación F0288? Se llamaba `requiereNuevaPreparacion`: el
   * nombre sugería crear un expediente nuevo, que es justo lo que no debe ocurrir.
   */
  requiereReprocesoF0288: boolean;
  /** Lo que sugirió la matriz al momento de reportar; se conserva para poder auditar el cambio. */
  sugerencia: SugerenciaReproceso;
  /** Obligatoria cuando el técnico se aparta de la sugerencia del sistema. */
  justificacionReproceso: string;
  /** Campos propios del tipo de falla seleccionado. */
  detalle: DetalleFallaF0302;
  estadoIncidencia: EstadoIncidenciaF0302;
  /** Reproceso F0288 abierto por esta falla, cuando aplicó. */
  reprocesoId?: string;
  /** Corrección de Soporte registrada en el mismo F0302, cuando la falla no exigió reproceso. */
  correccionSoporte?: CorreccionSoporteF0302;
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
 * Tipo de problema que atiende un reproceso F0288. No es el mismo catálogo que el de las fallas de
 * F0302: aquí se nombra lo que Hardware va a revisar sobre el equipo —encendido, periféricos, red
 * física—, y de él sale el checklist. Un reproceso nace con el tipo derivado de la falla o de la
 * inconformidad que lo originó, y el Técnico de Hardware puede corregirlo si al abrir el equipo
 * resulta ser otra cosa.
 */
export type TipoProblemaReproceso =
  | 'Accesorio faltante'
  | 'Falla física del equipo'
  | 'Falla de disco'
  | 'Falla de memoria'
  | 'Problema de sistema operativo'
  | 'Problema de red física'
  | 'Problema de encendido'
  | 'Problema de periféricos'
  | 'Otro';

/** Resultado con el que Hardware cierra un reproceso F0288. */
export type ResultadoReproceso =
  | 'Corregido'
  | 'No corregido'
  | 'Requiere sustitución de equipo'
  | 'Requiere evaluación del Encargado';

/**
 * Sección del Checklist de Reproceso F0288. Las cinco son las mismas para todos los tipos de
 * problema —lo que cambia es lo que va dentro—, así el técnico lee siempre el mismo recorrido:
 * qué se encontró, qué se hizo, cómo se comprobó, qué queda como respaldo y cómo se cierra.
 */
export type SeccionReproceso =
  | 'Diagnóstico'
  | 'Acción correctiva'
  | 'Validación posterior'
  | 'Evidencia'
  | 'Cierre del reproceso';

/**
 * Ítem del checklist de reproceso. Es un checklist propio, NO el del F0288 original: se llama
 * «Checklist de Reproceso F0288» y su contenido depende del tipo de problema que se revisa.
 */
export interface ItemReproceso {
  nombre: string;
  estado: 'Realizado' | 'Pendiente' | 'No aplica';
  /**
   * true en los ítems que implican cambio, reparación o corrección técnica. Marcar uno de ellos
   * hace obligatoria la evidencia: es la diferencia entre revisar y haber intervenido el equipo.
   */
  implicaCorreccion?: boolean;
  /** Sección a la que pertenece el ítem; los checklists guardados antes la derivan de su nombre. */
  seccion?: SeccionReproceso;
  /**
   * true solo en los ítems que el propio texto declara condicionales («si aplica», «si
   * corresponde»). Únicamente esos admiten «No aplica»: los demás son parte de la revisión y
   * marcarlos así sería declarar innecesario algo que el tipo de problema sí exige.
   */
  opcional?: boolean;
  nota: string;
}

/** Evidencia simulada adjuntada durante el reproceso. */
export interface EvidenciaReproceso {
  archivo: string;
  tipo: string;
  fecha: string;
  hora: string;
  cargadaPor: string;
  /** Código del reproceso y expediente técnico original: la evidencia se guarda con ambos. */
  reproceso: string;
  expedienteTecnico: string;
}

/** Firma simulada del Técnico de Hardware que cierra el reproceso. */
export interface FirmaReproceso {
  nombre: string;
  cargo: string;
  unidad: string;
  fecha: string;
  hora: string;
  /** Firma simulada del prototipo (no hay firma electrónica real). */
  firma: string;
}

/**
 * Reproceso de Preparación F0288 abierto por una falla detectada en F0302 (revisión técnica
 * complementaria / corrección de preparación). Pertenece al MISMO Expediente técnico que la
 * preparación original: es lo que evita multiplicar expedientes técnicos por cada falla. El F0288
 * original se conserva intacto; el reproceso registra la corrección hecha sobre él, con su propio
 * checklist, sus evidencias, su tiempo trabajado y la firma del técnico que lo atendió.
 */
export interface ReprocesoF0288 {
  /** `EXP-PT-2026-0095-R1`: el expediente técnico original y el número de reproceso dentro de él. */
  id: string;
  /** El mismo Expediente técnico de la preparación original: nunca se crea uno nuevo. */
  expedienteTecnico: string;
  /** Expediente (solicitud) del proceso donde se detectó la falla. */
  expediente: string;
  expedienteUnico: string;
  inventario: string;
  /** Reproceso #1, #2… dentro del mismo Expediente técnico. */
  numero: number;
  /**
   * Qué originó el reproceso. El mecanismo es el mismo —código derivado, asignación del Encargado,
   * checklist, firma—, pero el desenlace cambia: una falla de F0302 devuelve el equipo a
   * configuración, y una inconformidad además obliga a reenviar el formulario de conformidad.
   */
  origen?: 'Falla F0302' | 'Inconformidad del usuario final';
  /** Corrección de inconformidad que generó el reproceso, cuando el origen es una inconformidad. */
  correccionRelacionada?: string;
  /** Intento de conformidad No conforme que lo originó. */
  intentoConformidad?: number;
  /** Usuario final que reportó la inconformidad, y lo que observó. */
  usuarioFinal?: string;
  observacionUsuarioFinal?: string;
  tipoFalla: TipoFallaF0302;
  /** Tipo de problema que se revisa en el reproceso; de él sale el checklist. */
  tipoProblema?: TipoProblemaReproceso;
  /** Motivo del reproceso, tomado de la falla que lo originó. */
  motivo: string;
  /** Prioridad de atención, derivada del tipo de falla (Alta cuando hay revisión física). */
  prioridad: 'Alta' | 'Normal';
  /** Unidad que atiende la corrección: Hardware salvo excepción justificada por un Encargado. */
  unidadAtiende: 'Soporte' | 'Hardware';
  /** Justificación del Encargado cuando el reproceso se asigna fuera de Hardware. */
  justificacionUnidad: string;
  /** Técnico de Soporte que reportó la falla, y lo que dejó dicho al reportarla. */
  solicitadoPor: string;
  observacionSoporte: string;
  evidenciaSoporte: string;
  fechaSolicitud: string;
  horaSolicitud: string;
  /**
   * Técnico al que un Encargado asignó el reproceso (rollback a Hardware). Nace vacío: el
   * reproceso queda pendiente de asignación y ningún técnico puede tomárselo por su cuenta.
   */
  tecnicoAsignado: string;
  /** Encargado que hizo la asignación. Solo los Encargados pueden asignar reprocesos. */
  asignadoPor: string;
  fechaAsignacion: string;
  horaAsignacion: string;
  /**
   * Justificación del Encargado al abrir un reproceso nuevo con otro todavía abierto sobre el
   * mismo Expediente técnico. Sin ella el segundo reproceso no se crea.
   */
  justificacionReprocesoSimultaneo: string;
  /** Quien efectivamente lo trabajó (normalmente el asignado). */
  atendidoPor: string;
  fechaInicio: string;
  fechaFin: string;
  /** Cronómetro del reproceso: arranca al iniciarlo y se detiene al finalizarlo. */
  cronometro?: Cronometro;
  /** Checklist de Reproceso F0288, adaptado al tipo de falla. */
  checklist: ItemReproceso[];
  evidencias: EvidenciaReproceso[];
  /** Corrección técnica realizada durante el reproceso. */
  correccionTecnica: string;
  observaciones: string;
  /** Firma del Técnico de Hardware: sin ella el reproceso no se cierra. */
  firma?: FirmaReproceso;
  resultado: ResultadoReproceso | '';
  /** Observación del resultado, obligatoria cuando el reproceso no quedó corregido. */
  observacionResultado: string;
  estado: 'Pendiente de asignación' | 'Asignado' | 'En proceso' | 'Finalizado' | 'Firmado' | 'No corregido';
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
  /** MAC del equipo, en los eventos de reserva de IP y de solicitud a Servidores. */
  mac?: string;
  /** Justificación de no reserva, en los eventos con «Reserva de IP: No». */
  justificacion?: string;
  /** Estado de la solicitud de reserva ante Servidores al momento del evento. */
  estadoSolicitudIP?: string;
  /** Tipo de falla, en los eventos de la incidencia de configuración F0302. */
  tipoFalla?: string;
  /** «Sí»/«No» del reproceso F0288 evaluado para esa falla. */
  requiereReproceso?: string;
  /** Acción tomada tras evaluar la falla (corrección en F0302, reproceso F0288, revisión…). */
  accionTomada?: string;
  /** Evidencia registrada con la falla o con la corrección. */
  evidencia?: string;
  /** Reproceso F0288 al que pertenece el evento, cuando aplica. */
  reproceso?: string;
  /** Técnico de Soporte que reportó la falla que originó el reproceso. */
  tecnicoReporta?: string;
  /** Técnico de Hardware asignado al reproceso. */
  tecnicoHardware?: string;
  /** Encargado que asignó el reproceso: la asignación nunca es automática ni del propio técnico. */
  encargadoAsigno?: string;
  /** Resultado con el que se cerró el reproceso. */
  resultadoReproceso?: string;
  /** «Sí»/«No»: si la firma del Técnico de Hardware ya estaba registrada al momento del evento. */
  firmaRegistrada?: string;
  /** Documento consultado, generado o descargado (código de la constancia). */
  documento?: string;
  /** Estado del documento al momento del evento. */
  estadoDocumento?: string;
  /** Tipo de problema clasificado en la inconformidad del usuario final. */
  tipoProblema?: string;
  /** Resolución definida para la inconformidad: corrección F0302 o reproceso F0288. */
  resolucion?: string;
  /** Código de la corrección F0302 por inconformidad a la que pertenece el evento. */
  correccion?: string;
  /** Número del intento de conformidad al que se refiere el evento. */
  intentoConformidad?: number;
  /** Origen del reproceso F0288: falla en F0302 o inconformidad del usuario final. */
  origenReproceso?: string;
  /** Rol de quien ejecutó la acción, en los eventos de asignación. */
  rol?: string;
  /** Equipo que tenía la asignación antes de la corrección. */
  equipoAnterior?: string;
  /** Equipo que quedó asociado tras la corrección. */
  equipoNuevo?: string;
  /** Motivo de la corrección o texto de la observación administrativa. */
  motivo?: string;
}
