import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import {
  AccesorioCatalogoInstitucional, AccesorioVerificado, AccionPosteriorDescargo, AccionRequeridaFalla, Asignacion, CargaHardware, CargaSoporte, CasoGarantia, ChecklistItem, ChecklistSeccion, CierreTecnico,
  NivelCarga, ProcesoActivo, TecnicoSoporteConCarga,
  ComentarioCaso, Conformidad, ConfiguracionF0302, ConsultaInventario, ContextoEvidencia, CorreccionNoConformidad, Cronometro, Descargo,
  DetalleFallaF0302, DistribucionSoporte, DocumentoGenerado, Entrega, Equipo, EquipoCatalogoInstitucional, EquipoControles, EstadoControles, EvidenciaCorreccion, EvidenciaReproceso, EvidenciaTecnica, FilaValidacionLote, ModuloConEvidenciaObligatoria, ModuloEvidencia,
  EstadoAsignacionEquipo, EstadoDetalleGarantia, EstadoGarantia, EstadoIncidenciaConformidad, EstadoIncidenciaF0302, EstadoPreparacionEquipo, EstadoRevisionGarantia, EstadoSolicitudReservaIP, EtapaSoftware, EventoTrazabilidad, ExpedienteTecnico, ExpedienteUnico, FallaF0302,
  ModificacionGarantia, TipoGarantia,
  FirmaCorreccion, FirmaProceso, FirmaReproceso, Garantia, IngresoHardware, IntentoAceptacion, ItemCorreccion, ItemReproceso, ModificacionAsignacion, MotivoDescargo, MotivoIngreso, MotivoSoftwareF0302, PreparacionF0288,
  ReprocesoF0288, ResolucionInconformidad, ResultadoConsultaAccesorio, RespuestaSiNo, ResultadoIntento, ResultadoReproceso, RolClave, SeccionOculta, SeccionReproceso, Solicitud, SoftwareCatalogo, TipoEvidenciaReproceso,
  SoftwareF0302, SoftwareHeredadoF0288, SolicitudReservaIP, SugerenciaReproceso,
  TipoComentarioCaso, TipoEvidencia, TipoExpedienteTecnico, TipoFallaF0302, TipoProblemaInconformidad, TipoProblemaReproceso, UsuarioSistema, ValidacionGarantia, VerificacionAccesorios,
  VerificacionFalla
} from '../models/models';
import { AuthService } from './auth.service';
import { EvidenciaService } from './evidencia.service';
import { DireccionOrganizacion, SupportDistributionService } from './support-distribution.service';
import { SharedInventoryService } from './shared-inventory.service';

/**
 * Familias de inventario de los accesorios institucionales. Un accesorio se asocia a un equipo
 * usado por su FAMILIA (el tipo de bien) y su SUFIJO (qué accesorio es), no por el número del
 * equipo principal: los equipos se numeran `2201-NNNN-AAAA` y los accesorios
 * `2201-00-101|920-XXXX-SS`, así que sus correlativos son independientes.
 */
const FAMILIA_ACCESORIO_CPU = '2201-00-101';
const FAMILIA_ACCESORIO_LAPTOP = '2201-00-920';

/**
 * Almacén único de datos de SISGOST. Carga los JSON simulados de assets/data
 * y expone signals; las operaciones mutan el estado en memoria para simular
 * el proceso completo sin backend ni base de datos.
 */
@Injectable({ providedIn: 'root' })
export class DataService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  /**
   * Reglas y almacén de las imágenes de evidencia. La dependencia va solo en este sentido:
   * `EvidenciaService` valida y guarda; aquí se decide qué etapa se bloquea y qué se anota en la
   * trazabilidad, que es lo que cambia de un módulo a otro.
   */
  readonly evid = inject(EvidenciaService);
  /**
   * Distribución de soportes por Dirección/Unidad: **registro compartido del ecosistema SISGOST**.
   * Se administra en SISGOST — Controles Mensuales y este módulo lo consume para decidir qué
   * Técnicos de Soporte pueden recibir equipos para configurar en cada Dirección/Unidad.
   */
  readonly soportes = inject(SupportDistributionService);
  /** Inventario operativo compartido con SISGOST — Controles Mensuales. */
  private readonly inventarioCompartido = inject(SharedInventoryService);

  readonly listo = signal(false);

  readonly usuarios = signal<UsuarioSistema[]>([]);
  readonly solicitudes = signal<Solicitud[]>([]);
  readonly equipos = signal<Equipo[]>([]);
  readonly asignaciones = signal<Asignacion[]>([]);
  readonly expedientesTecnicos = signal<ExpedienteTecnico[]>([]);
  readonly expedientesUnicos = signal<ExpedienteUnico[]>([]);
  readonly preparaciones = signal<PreparacionF0288[]>([]);
  readonly configuraciones = signal<ConfiguracionF0302[]>([]);
  readonly entregas = signal<Entrega[]>([]);
  readonly conformidades = signal<Conformidad[]>([]);
  readonly garantias = signal<Garantia[]>([]);
  readonly documentos = signal<DocumentoGenerado[]>([]);
  readonly eventos = signal<EventoTrazabilidad[]>([]);
  readonly ingresosHardware = signal<IngresoHardware[]>([]);
  readonly descargos = signal<Descargo[]>([]);
  /** Historial de intentos de aceptación (uno por cada envío del formulario; nunca se sobrescriben). */
  readonly intentos = signal<IntentoAceptacion[]>([]);
  /** Correcciones de no conformidad registradas por el Técnico de Soporte. */
  readonly correcciones = signal<CorreccionNoConformidad[]>([]);
  /**
   * Reprocesos de Preparación F0288 abiertos por fallas detectadas en F0302. Cada uno pertenece al
   * Expediente técnico que ya tenía el equipo: son la alternativa a crear expedientes nuevos.
   */
  readonly reprocesos = signal<ReprocesoF0288[]>([]);
  /**
   * Distribución de Soportes por Dirección/Unidad: catálogo administrado por el Encargado de
   * Soporte. De él salen los técnicos elegibles como Técnico de Configuración de un requerimiento
   * y el soporte responsable que queda registrado cuando el usuario final acepta el equipo.
   */
  readonly distribuciones = this.soportes.registros;
  /**
   * Inventario operativo del proyecto de Controles. Un equipo entra aquí **solo** cuando el
   * usuario final acepta la conformidad, y sale (sin borrarse) cuando se registra su descargo.
   */
  readonly controles = signal<EquipoControles[]>([]);
  /**
   * Base de datos institucional simulada que se consulta por número de inventario al ingresar
   * un equipo. Es solo lectura: no se persiste en localStorage ni se reinicia con la demo,
   * porque representa un sistema externo a SISGOST.
   */
  readonly catalogoInstitucional = signal<EquipoCatalogoInstitucional[]>([]);
  /**
   * Catálogo de software permitido (F0288/F0302). A diferencia del institucional de equipos, SÍ
   * es administrable (pantalla «Catálogo de software») y por eso SÍ se persiste en localStorage
   * y se reinicia con «Restablecer datos de demostración», igual que el resto del estado mutable.
   */
  readonly catalogoSoftware = signal<SoftwareCatalogo[]>([]);
  /** Base institucional simulada de accesorios (Monitor/Teclado/Mouse/Maletín), consultada por número de inventario. */
  readonly catalogoAccesorios = signal<AccesorioCatalogoInstitucional[]>([]);

  /** Clave de persistencia en localStorage: todo cambio sobrevive a un F5 dentro del mismo navegador. */
  private readonly storageKey = 'sisgost.datos.v1';
  /** Última foto serializada escrita/leída: evita reescrituras y el ping-pong de sincronización entre pestañas. */
  private lastSerialized = '';

  constructor() {
    // Persiste el estado completo cada vez que cualquier signal mutable cambia, una vez cargado.
    effect(() => {
      if (!this.listo()) return;
      this.persistirEnLocalStorage();
    });

    // Sincronización entre pestañas: el formulario externo de conformidad se abre en otra
    // pestaña (target="_blank"), que es una instancia aparte de la app con su propio estado.
    // Cuando esa pestaña acepta/rechaza y escribe en localStorage, este evento (que solo se
    // dispara en las OTRAS pestañas) rehidrata el estado aquí para que la fase de Entrega y
    // aceptación se cierre y la garantía aparezca sin recargar.
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (ev) => {
        if (ev.key === this.storageKey && ev.newValue) this.hidratarDesdeLocalStorage();
      });
    }
  }

  cargar(): void {
    if (this.listo()) return;
    // El catálogo institucional se carga siempre y aparte: no forma parte del estado guardado,
    // así que debe estar disponible incluso cuando el resto se rehidrata desde localStorage.
    if (this.catalogoInstitucional().length === 0) {
      this.http.get<EquipoCatalogoInstitucional[]>('assets/data/catalogo-institucional.json')
        .subscribe((c) => this.catalogoInstitucional.set(c));
    }
    if (this.catalogoAccesorios().length === 0) {
      this.http.get<AccesorioCatalogoInstitucional[]>('assets/data/accesorios-institucionales.json')
        .subscribe((c) => this.catalogoAccesorios.set(c));
    }
    // El catálogo organizacional tampoco forma parte del estado guardado y es quien resuelve el
    // nombre de una Dirección/Unidad a su ID estable: sin él, la distribución no encuentra a nadie.
    if (this.soportes.organizacion().length === 0) {
      this.http.get<DireccionOrganizacion[]>('assets/data/direcciones.json')
        .subscribe((d) => {
          this.soportes.cargarOrganizacion(d);
          // Las asignaciones ya cargadas se renormalizan contra el catálogo recién llegado.
          this.soportes.cargar(this.distribuciones());
        });
    }
    if (this.hidratarDesdeLocalStorage()) {
      // El catálogo de software SÍ viaja dentro de la foto guardada (es administrable); si una
      // foto anterior a esta funcionalidad no lo trae, se siembra aparte desde el JSON original.
      if (this.catalogoSoftware().length === 0) {
        this.http.get<SoftwareCatalogo[]>('assets/data/catalogo-software.json')
          .subscribe((c) => this.catalogoSoftware.set(this.normalizarCatalogoSoftware(c)));
      }
      // La distribución de soportes también viaja en la foto; una foto anterior a esta regla no
      // la trae, y sin ella no habría técnicos elegibles para ninguna Dirección/Unidad.
      if (this.distribuciones().length === 0) {
        this.http.get<DistribucionSoporte[]>('assets/data/distribucion-soportes.json')
          .subscribe((d) => this.soportes.cargar(d));
      } else {
        // Una foto guardada antes de los IDs estables trae las asignaciones sin ellos.
        this.soportes.cargar(this.distribuciones());
      }
      this.asegurarIntentosDeConformidades();
      this.listo.set(true);
      return;
    }
    const json = <T>(archivo: string) => this.http.get<T>(`assets/data/${archivo}.json`);
    forkJoin({
      usuarios: json<UsuarioSistema[]>('usuarios-sistema'),
      solicitudes: json<Solicitud[]>('solicitudes'),
      equipos: json<Equipo[]>('equipos'),
      asignaciones: json<Asignacion[]>('asignaciones'),
      expTec: json<ExpedienteTecnico[]>('expedientes-tecnicos'),
      expedientes: json<ExpedienteUnico[]>('expedientes'),
      preparaciones: json<PreparacionF0288[]>('preparaciones-f0288'),
      configuraciones: json<ConfiguracionF0302[]>('configuraciones-f0302'),
      entregas: json<Entrega[]>('entregas'),
      conformidades: json<Conformidad[]>('conformidades'),
      garantias: json<Garantia[]>('garantias'),
      documentos: json<DocumentoGenerado[]>('documentos-generados'),
      eventos: json<EventoTrazabilidad[]>('trazabilidad'),
      ingresos: json<IngresoHardware[]>('ingresos-hardware'),
      descargos: json<Descargo[]>('descargos'),
      reprocesos: json<ReprocesoF0288[]>('reprocesos-f0288'),
      distribuciones: json<DistribucionSoporte[]>('distribucion-soportes'),
      organizacion: json<DireccionOrganizacion[]>('direcciones'),
      catalogoSoftware: json<SoftwareCatalogo[]>('catalogo-software')
    }).subscribe((r) => {
      this.usuarios.set(r.usuarios);
      this.solicitudes.set(r.solicitudes);
      this.equipos.set(r.equipos);
      this.asignaciones.set(r.asignaciones);
      this.expedientesTecnicos.set(r.expTec);
      this.expedientesUnicos.set(r.expedientes);
      this.preparaciones.set(this.normalizarPreparaciones(r.preparaciones));
      this.configuraciones.set(this.normalizarConfiguraciones(r.configuraciones));
      this.entregas.set(r.entregas);
      this.conformidades.set(r.conformidades);
      this.garantias.set(this.normalizarGarantias(r.garantias));
      this.documentos.set(r.documentos);
      this.eventos.set(r.eventos);
      this.ingresosHardware.set(r.ingresos);
      this.descargos.set(r.descargos);
      this.reprocesos.set(this.normalizarReprocesos(r.reprocesos ?? []));
      // El catálogo organizacional se carga primero: resuelve nombre → ID estable, y la
      // distribución se normaliza contra él al entrar.
      this.soportes.cargarOrganizacion(r.organizacion ?? []);
      this.soportes.cargar(r.distribuciones ?? []);
      this.catalogoSoftware.set(this.normalizarCatalogoSoftware(r.catalogoSoftware));
      // El inventario de Controles no tiene JSON semilla: se deriva de las aceptaciones que el
      // set de datos ya trae. No se inventa ninguna pertenencia — solo entran los equipos cuyo
      // usuario final firmó la conformidad, que es exactamente la regla del módulo.
      this.controles.set(this.controlesDeAceptacionesPrevias([]));
      // No hay JSON semilla de intentos/correcciones: el flujo de no conformidad se genera
      // durante la demostración y se conserva luego en localStorage. Se siembra un intento
      // inicial por cada conformidad ya existente para que el estado de aceptación sea coherente.
      this.intentos.set([]);
      this.correcciones.set([]);
      // Las imágenes de evidencia se cargan durante la demostración: no hay JSON semilla con
      // fotografías, y fabricarlas sería inventar un respaldo que nadie tomó. Lo único que se
      // traslada son las referencias que el set de datos ya trae, como la imagen con la que se
      // reportó una falla: se muestran con el bloque simulado, sin fotografía inventada.
      this.evid.hidratar(this.evidenciasDeFallasSembradas([]));
      this.asegurarIntentosDeConformidades();
      this.listo.set(true);
    });
  }

  /**
   * Garantiza que cada conformidad ya respondida/enviada tenga al menos un intento de aceptación.
   * Idempotente: solo crea los que falten. Sirve para las conformidades semilla (JSON) y para
   * datos guardados por versiones anteriores a los intentos. No sobrescribe intentos existentes.
   */
  private asegurarIntentosDeConformidades(): void {
    const estadosConIntento = ['Aceptado', 'No conforme', 'Pendiente de respuesta', 'Enviado'];
    const faltantes = this.conformidades().filter(
      (c) => estadosConIntento.includes(c.estado) && !this.intentos().some((i) => i.expediente === c.expediente)
    );
    for (const c of faltantes) {
      const resultado: ResultadoIntento =
        c.estado === 'Aceptado' ? 'Aceptado' : c.estado === 'No conforme' ? 'No conforme' : 'Pendiente de firma';
      const intento: IntentoAceptacion = {
        id: this.siguienteCodigoPorAnio(`INT-${this.anioActual()}-`, this.intentos().map((i) => i.id)),
        expediente: c.expediente, inventario: c.inventario, numero: 1, token: c.token, resultado,
        fecha: c.fechaRespuesta ? c.fechaRespuesta.slice(0, 10) : '',
        hora: c.fechaRespuesta ? c.fechaRespuesta.slice(11, 16) : '',
        fechaEnvio: c.fechaEnvio ? c.fechaEnvio.slice(0, 10) : this.hoy(),
        usuarioFinal: c.usuarioFinal,
        observacion: c.estado === 'No conforme' ? (c.observaciones || '') : '',
        firma: c.estado === 'Aceptado' ? (c.firmaUsuarioFinal || c.usuarioFinal) : ''
      };
      this.intentos.update((list) => [...list, intento]);
    }
  }

  /** Restaura el estado completo guardado en localStorage. Devuelve false si no hay nada o está corrupto. */
  private hidratarDesdeLocalStorage(): boolean {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return false;
      const d = JSON.parse(raw);
      // Marca esta foto como la vigente ANTES de mutar los signals: así el effect de
      // persistencia que dispararán los .set() no reescribe lo mismo (rompe el ping-pong).
      this.lastSerialized = raw;
      this.usuarios.set(d.usuarios ?? []);
      this.solicitudes.set(d.solicitudes ?? []);
      this.equipos.set(d.equipos ?? []);
      this.asignaciones.set(d.asignaciones ?? []);
      this.expedientesTecnicos.set(d.expedientesTecnicos ?? []);
      this.expedientesUnicos.set(d.expedientesUnicos ?? []);
      this.preparaciones.set(this.normalizarPreparaciones(d.preparaciones ?? []));
      this.configuraciones.set(this.normalizarConfiguraciones(d.configuraciones ?? []));
      this.entregas.set(d.entregas ?? []);
      this.conformidades.set(d.conformidades ?? []);
      this.garantias.set(this.normalizarGarantias(d.garantias ?? []));
      this.documentos.set(d.documentos ?? []);
      this.eventos.set(d.eventos ?? []);
      this.ingresosHardware.set(d.ingresosHardware ?? []);
      this.descargos.set(d.descargos ?? []);
      this.intentos.set(d.intentos ?? []);
      this.correcciones.set(this.normalizarCorrecciones(d.correcciones ?? []));
      this.reprocesos.set(this.normalizarReprocesos(d.reprocesos ?? []));
      this.soportes.cargar(d.distribuciones ?? []);
      this.controles.set(this.controlesDeAceptacionesPrevias(d.controles ?? []));
      this.evid.hidratar(this.evidenciasDeFallasSembradas(d.evidencias ?? []));
      // Se normaliza al rehidratar: una foto anterior guardó el catálogo con aplicaF0288/aplicaF0302
      // y sin descripción ni licenciamiento; aquí se convierte al modelo por etapa del proceso.
      this.catalogoSoftware.set(this.normalizarCatalogoSoftware(d.catalogoSoftware ?? []));
      return true;
    } catch {
      return false;
    }
  }

  /** Guarda una foto completa del estado mutable. Si localStorage no está disponible, el prototipo sigue en memoria. */
  private persistirEnLocalStorage(): void {
    try {
      const d = {
        usuarios: this.usuarios(), solicitudes: this.solicitudes(), equipos: this.equipos(),
        asignaciones: this.asignaciones(), expedientesTecnicos: this.expedientesTecnicos(),
        expedientesUnicos: this.expedientesUnicos(), preparaciones: this.preparaciones(),
        configuraciones: this.configuraciones(), entregas: this.entregas(),
        conformidades: this.conformidades(), garantias: this.garantias(),
        documentos: this.documentos(), eventos: this.eventos(),
        ingresosHardware: this.ingresosHardware(), descargos: this.descargos(),
        intentos: this.intentos(), correcciones: this.correcciones(),
        reprocesos: this.reprocesos(),
        distribuciones: this.distribuciones(), controles: this.controles(),
        // Las imágenes de evidencia viven en su propio servicio, pero se guardan con el resto del
        // estado: si no, se perderían al recargar y los cierres validados quedarían sin respaldo.
        evidencias: this.evid.lista(),
        catalogoSoftware: this.catalogoSoftware()
      };
      const json = JSON.stringify(d);
      // Si el contenido no cambió (p. ej. justo después de rehidratar desde otra pestaña),
      // no reescribas: evita disparar el evento `storage` y el rebote entre pestañas.
      if (json === this.lastSerialized) return;
      this.lastSerialized = json;
      localStorage.setItem(this.storageKey, json);
    } catch {
      // localStorage no disponible o cuota excedida: el prototipo sigue funcionando en memoria.
    }
  }

  /** Descarta los datos guardados en el navegador y vuelve a cargar el set de datos original (JSON de demo). */
  reiniciarDatosDemo(): void {
    try { localStorage.removeItem(this.storageKey); } catch { /* no-op */ }
    this.lastSerialized = '';
    this.listo.set(false);
    this.cargar();
  }

  // ---------- Consultas ----------
  solicitud(id: string): Solicitud | undefined {
    return this.solicitudes().find((s) => s.expediente === id);
  }
  equipoDe(inventario: string): Equipo | undefined {
    return this.equipos().find((e) => e.inventario === inventario);
  }
  equipoDeSolicitud(id: string): Equipo | undefined {
    const s = this.solicitud(id);
    return s ? this.equipoDe(s.equipoInventario) : undefined;
  }
  asignacionDe(id: string): Asignacion | undefined {
    return this.asignaciones().find((a) => a.expediente === id);
  }
  /** Expediente técnico del proceso: se resuelve a través del equipo asignado a la solicitud. */
  expTecnicoDe(id: string): ExpedienteTecnico | undefined {
    const s = this.solicitud(id);
    return s?.equipoInventario ? this.expTecnicoDeEquipo(s.equipoInventario) : undefined;
  }
  expedienteUnicoDe(id: string): ExpedienteUnico | undefined {
    return this.expedientesUnicos().find((x) => x.expediente === id);
  }
  /**
   * Configuración F0302 VIGENTE del proceso: la que no quedó «Con falla». Un proceso puede
   * acumular varias configuraciones (una con falla → devuelta a F0288 → nueva configuración);
   * las «Con falla» son historial y esta consulta devuelve la activa. Si todas quedaron con
   * falla, devuelve la más reciente para que la UI muestre la falla y ofrezca una nueva.
   */
  configuracionDe(id: string): ConfiguracionF0302 | undefined {
    const activa = this.configuraciones().find((c) => c.expediente === id && c.estado !== 'Con falla');
    return activa ?? this.configuraciones().find((c) => c.expediente === id);
  }
  /** Configuraciones F0302 «Con falla» del proceso (intentos con falla), de la más reciente a la más antigua. */
  configuracionesConFallaDe(id: string): ConfiguracionF0302[] {
    return this.configuraciones().filter((c) => c.expediente === id && c.estado === 'Con falla');
  }
  entregaDe(id: string): Entrega | undefined {
    return this.entregas().find((e) => e.expediente === id);
  }
  conformidadPorToken(token: string): Conformidad | undefined {
    return this.conformidades().find((c) => c.token === token);
  }
  /** Conformidad vigente del proceso (una por expediente; el reenvío la reutiliza con nuevo token). */
  conformidadDeProceso(id: string): Conformidad | undefined {
    return this.conformidades().find((c) => c.expediente === id);
  }

  // ---------- Intentos de aceptación y correcciones de no conformidad ----------
  /** Intentos de aceptación de un proceso, del más reciente al más antiguo. */
  intentosDe(id: string): IntentoAceptacion[] {
    return this.intentos().filter((i) => i.expediente === id).sort((a, b) => b.numero - a.numero);
  }
  /** Último (vigente) intento de aceptación del proceso. */
  ultimoIntento(id: string): IntentoAceptacion | undefined {
    return this.intentosDe(id)[0];
  }
  /**
   * Estado del ciclo de aceptación del proceso, derivado del último intento:
   * «Sin enviar» · «Pendiente de firma» · «No conforme» · «Aceptado».
   */
  estadoAceptacion(id: string): 'Sin enviar' | ResultadoIntento {
    return this.ultimoIntento(id)?.resultado ?? 'Sin enviar';
  }
  /** Correcciones de no conformidad de un proceso, de la más reciente a la más antigua. */
  correccionesDe(id: string): CorreccionNoConformidad[] {
    return this.correcciones().filter((c) => c.expediente === id).sort((a, b) => b.intentoNumero - a.intentoNumero);
  }
  /** Corrección abierta del proceso: en curso, esperando firma o en manos de Hardware. */
  correccionActivaDe(id: string): CorreccionNoConformidad | undefined {
    return this.correccionesDe(id)
      .find((c) => c.estado === 'Iniciada' || c.estado === 'Finalizada' || c.estado === 'Derivada a reproceso F0288');
  }
  /**
   * Corrección lista para habilitar «Reenviar formulario de conformidad». La regla es la misma en
   * los dos caminos: nadie reenvía el formulario hasta que alguien firmó lo que hizo.
   *  - Corrección F0302: firmada por el Técnico de Soporte.
   *  - Reproceso F0288: cerrado con la firma del Técnico de Hardware y resultado «Corregido».
   */
  correccionListaParaReenvio(id: string): CorreccionNoConformidad | undefined {
    if (this.estadoAceptacion(id) !== 'No conforme') return undefined;
    const ultimo = this.ultimoIntento(id);
    return this.correccionesDe(id).find((c) => c.intentoNumero === ultimo?.numero &&
      (c.estado === 'Firmada' || c.estado === 'Cerrada por reproceso F0288'));
  }
  /** Reproceso F0288 generado por una inconformidad, si esta corrección lo tiene. */
  reprocesoDeCorreccion(cor: CorreccionNoConformidad): ReprocesoF0288 | undefined {
    return cor.reprocesoId ? this.reprocesoDe(cor.reprocesoId) : undefined;
  }
  /** Corrección de inconformidad a la que pertenece un reproceso, si nació de una. */
  correccionDeReproceso(idReproceso: string): CorreccionNoConformidad | undefined {
    return this.correcciones().find((c) => c.reprocesoId === idReproceso);
  }
  /** Inconformidad cuyo reproceso F0288 todavía está en manos de Hardware. */
  reprocesoPorInconformidadPendiente(id: string): CorreccionNoConformidad | undefined {
    return this.correccionesDe(id).find((c) => c.estado === 'Derivada a reproceso F0288' &&
      c.intentoNumero === this.ultimoIntento(id)?.numero);
  }
  /** Procesos con una no conformidad vigente pendiente de atender (para el Técnico de Soporte). */
  noConformidadesPendientes(): { expediente: string; intento: IntentoAceptacion }[] {
    return this.intentos()
      .filter((i) => i.resultado === 'No conforme' && this.ultimoIntento(i.expediente)?.numero === i.numero)
      .map((intento) => ({ expediente: intento.expediente, intento }));
  }
  /** true si el equipo está pendiente de revisión por una no conformidad de su proceso vigente. */
  equipoPendienteRevision(inventario: string): boolean {
    const eq = this.equipoDe(inventario);
    return !!eq?.expediente && this.estadoAceptacion(eq.expediente) === 'No conforme';
  }
  /**
   * true mientras el equipo tiene un F0302 «Con falla» con su incidencia todavía abierta y aún no
   * se ha iniciado el nuevo intento. Ya NO habilita crear un Expediente técnico nuevo: la falla se
   * atiende dentro del expediente vigente, corrigiéndola en F0302 o con un reproceso F0288.
   */
  revisionTecnicaPorFallaF0302(inventario: string): boolean {
    const eq = this.equipoDe(inventario);
    if (!eq?.expediente) return false;
    if (this.configuracionesConFallaDe(eq.expediente).length === 0) return false;
    // Si ya existe una configuración activa (no «Con falla»), el reintento F0302 ya arrancó.
    const activa = this.configuraciones().find((c) => c.expediente === eq.expediente && c.estado !== 'Con falla');
    return !activa;
  }
  /**
   * true cuando el ingreso a Hardware más reciente del equipo todavía no tiene Expediente técnico
   * asociado: el equipo volvió a F0288 (por reingreso, inconformidad o falla en F0302) y aún debe
   * crear el nuevo Expediente técnico y completar la nueva Preparación. Mientras esté pendiente, el
   * equipo NO está listo para una nueva Configuración F0302 aunque su Expediente técnico anterior siga
   * marcado «Preparado» — así se obliga el paso real por F0288 tras una falla.
   */
  reingresoHardwarePendiente(inventario: string): boolean {
    const ultimoIngreso = this.ingresosDeEquipo(inventario)[0];
    return !!ultimoIngreso && !ultimoIngreso.expedienteTecnicoAsociado;
  }
  garantiaDe(id: string): Garantia | undefined {
    return this.garantias().find((g) => g.expediente === id);
  }
  eventosDe(id: string): EventoTrazabilidad[] {
    return this.eventos().filter((e) => e.expediente === id);
  }
  documentosDe(id: string): DocumentoGenerado[] {
    return this.documentos().filter((d) => d.expediente === id);
  }
  /**
   * F0288 de un expediente técnico: el documento se registra con el código del expediente
   * técnico (`EXP-PT-2026-…`) y, si ya existe Expediente único, se re-asocia a la solicitud.
   * Esta consulta funciona en ambos casos, con o sin Expediente único.
   */
  documentoF0288DeExpTecnico(codigoTec: string): DocumentoGenerado | undefined {
    const directo = this.documentos().find((d) => d.tipo === 'F0288' && d.expediente === codigoTec);
    if (directo) return directo;
    const tec = this.expedientesTecnicos().find((x) => x.codigo === codigoTec);
    const asig = tec ? this.asignacionDeEquipo(tec.inventario) : undefined;
    if (!asig) return undefined;
    return this.documentos().find((d) => d.tipo === 'F0288' && d.expediente === asig.expediente);
  }

  // ---------- Inventario de Hardware (estados derivados) ----------
  /**
   * Expediente técnico VIGENTE del equipo (el más reciente), identificado por su número de
   * inventario. Un equipo puede tener varios expedientes técnicos a lo largo de su vida
   * (reingreso a Hardware); el historial completo se conserva y se consulta con
   * `expedientesTecnicosDeEquipo`.
   */
  expTecnicoDeEquipo(inventario: string): ExpedienteTecnico | undefined {
    return this.expedientesTecnicosDeEquipo(inventario)[0];
  }
  /** Asignación VIGENTE del equipo (si el usuario final todavía lo tiene). Un Descargo la cierra sin borrarla. */
  asignacionDeEquipo(inventario: string): Asignacion | undefined {
    return this.asignaciones().find((a) => a.equipoInventario === inventario && a.vigente);
  }
  /** CPU/Desktop → Encargado de Hardware, Laptop → Encargado de Soporte. Puramente derivado del
   *  tipo de equipo; nunca se almacena en Equipo (no reemplaza «Unidad responsable»). */
  responsableOperativo(equipo: Pick<Equipo, 'tipo'>): 'Encargado de Hardware' | 'Encargado de Soporte' {
    return equipo.tipo === 'Desktop' ? 'Encargado de Hardware' : 'Encargado de Soporte';
  }
  /** Etiqueta visible del tipo de requerimiento de una solicitud: nunca expone el origen documental
   *  (Memorando/Requerimiento) ni su referencia externa, solo si es de Laptop o de CPU. */
  tipoRequerimientoTexto(s: Pick<Solicitud, 'tipoEquipo'> | undefined | null, corto = false): string {
    const base = s?.tipoEquipo === 'Desktop' ? 'CPU' : 'Laptop';
    return corto ? base : `Requerimiento de ${base}`;
  }

  // ---------- Historial técnico del equipo ----------
  // El historial nunca sobrescribe registros: cada preparación, configuración o asignación
  // del equipo se conserva y estas consultas devuelven TODAS, de la más reciente a la más
  // antigua, para las pestañas del «Historial técnico del equipo».

  /** Todas las preparaciones F0288 realizadas al equipo (cada una con su propio F0288). */
  preparacionesDeEquipo(inventario: string): PreparacionF0288[] {
    return this.preparaciones()
      .filter((p) => p.datosGenerales.inventario === inventario)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }
  /** Todas las configuraciones F0302 realizadas al equipo (cada una con su propio F0302). */
  configuracionesDeEquipo(inventario: string): ConfiguracionF0302[] {
    return this.configuraciones()
      .filter((c) => c.datos.inventario === inventario)
      .sort((a, b) => (b.fecha || '9999').localeCompare(a.fecha || '9999'));
  }
  /** Historial de asignaciones del equipo: conserva cada usuario final que lo tuvo asignado. */
  asignacionesDeEquipo(inventario: string): Asignacion[] {
    return this.asignaciones()
      .filter((a) => a.equipoInventario === inventario)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }
  /** Garantías (con sus casos) asociadas al equipo a través de sus procesos de entrega. */
  garantiasDeEquipo(inventario: string): Garantia[] {
    return this.garantias().filter((g) => g.inventario === inventario);
  }
  /** Todos los documentos históricos del equipo: F0288, F0302, constancias y reportes. */
  documentosDeEquipo(inventario: string): DocumentoGenerado[] {
    const ids = new Set<string>([
      ...this.expedientesTecnicos().filter((t) => t.inventario === inventario).map((t) => t.codigo),
      ...this.asignaciones().filter((a) => a.equipoInventario === inventario).map((a) => a.expediente),
      this.equipoDe(inventario)?.expediente ?? ''
    ].filter(Boolean));
    return this.documentos()
      .filter((d) => ids.has(d.expediente))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }
  /** Nombre actual del equipo (hostname): el registrado en su configuración más reciente. */
  nombreEquipoActual(inventario: string): string {
    return this.configuracionesDeEquipo(inventario)[0]?.datos.nombrePC ?? '';
  }
  /** Todos los expedientes técnicos del equipo (un ciclo por reingreso), del más reciente al más antiguo. */
  expedientesTecnicosDeEquipo(inventario: string): ExpedienteTecnico[] {
    return this.expedientesTecnicos()
      .filter((x) => x.inventario === inventario)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }
  /** Todos los ingresos del equipo a Hardware (inicial y reingresos), del más reciente al más antiguo. */
  ingresosDeEquipo(inventario: string): IngresoHardware[] {
    return this.ingresosHardware()
      .filter((i) => i.inventario === inventario)
      .sort((a, b) => (b.fechaIngreso + b.horaIngreso).localeCompare(a.fechaIngreso + a.horaIngreso));
  }
  /** Todos los descargos del equipo, del más reciente al más antiguo. */
  descargosDeEquipo(inventario: string): Descargo[] {
    return this.descargos()
      .filter((d) => d.inventario === inventario)
      .sort((a, b) => b.fechaDescargo.localeCompare(a.fechaDescargo));
  }
  vecesIngresado(inventario: string): number {
    return this.ingresosDeEquipo(inventario).length;
  }
  vecesDescargado(inventario: string): number {
    return this.descargosDeEquipo(inventario).length;
  }
  ultimoDescargo(inventario: string): Descargo | undefined {
    return this.descargosDeEquipo(inventario)[0];
  }
  /**
   * Una preparación F0288 cuenta como realizada si llegó a finalizarse (Completada) o si su
   * ciclo se cerró por un descargo posterior (Cerrada) — al descargar el equipo la preparación
   * pasa a Cerrada, pero YA fue una preparación real y debe seguir contando: los contadores
   * históricos nunca se reinician al descargar ni al reingresar a Hardware.
   */
  preparacionFinalizada(p: PreparacionF0288): boolean {
    return p.estado === 'Completada' || p.estado === 'Cerrada';
  }
  /** Igual criterio para la configuración F0302: Completada o Cerrada cuenta como realizada («Veces configurado»). */
  configuracionFinalizada(c: ConfiguracionF0302): boolean {
    return c.estado === 'Completada' || c.estado === 'Cerrada';
  }
  /**
   * Un F0302 cuenta como INTENTO si se finalizó correctamente (Completada/Cerrada) o si quedó
   * «Con falla»: los intentos con falla también forman parte del historial de configuración.
   */
  configuracionEsIntento(c: ConfiguracionF0302): boolean {
    return this.configuracionFinalizada(c) || c.estado === 'Con falla';
  }
  /** Intentos F0302 del equipo = configuraciones finalizadas correctamente + configuraciones con falla. */
  intentosF0302(inventario: string): number {
    return this.configuracionesDeEquipo(inventario).filter((c) => this.configuracionEsIntento(c)).length;
  }
  /** Fallas F0302 del equipo = intentos que quedaron «Con falla». */
  fallasF0302(inventario: string): number {
    return this.configuracionesDeEquipo(inventario).filter((c) => c.estado === 'Con falla').length;
  }
  /**
   * Resumen consolidado del equipo, usado tanto por «Ver detalle» en Inventario de Hardware
   * como por la pestaña Resumen del Historial técnico, para que ambas vistas muestren
   * exactamente los mismos números.
   */
  resumenEquipo(inventario: string): {
    vecesIngresado: number; vecesPreparado: number; vecesConfigurado: number; intentosF0302: number;
    fallasF0302: number; reprocesosF0288: number;
    vecesAsignado: number; vecesDescargado: number; responsableOperativo: string;
    ultimoTecnicoPreparo: string; ultimoTecnicoConfiguro: string;
    ultimaPreparacion?: PreparacionF0288; ultimaConfiguracion?: ConfiguracionF0302;
    ultimoDescargo?: Descargo; estadoGarantia: string;
  } {
    const eq = this.equipoDe(inventario);
    const preps = this.preparacionesDeEquipo(inventario);
    const confs = this.configuracionesDeEquipo(inventario);
    const asigs = this.asignacionesDeEquipo(inventario);
    const gars = this.garantiasDeEquipo(inventario);
    return {
      vecesIngresado: this.vecesIngresado(inventario),
      vecesPreparado: preps.filter((p) => this.preparacionFinalizada(p)).length,
      vecesConfigurado: confs.filter((c) => this.configuracionFinalizada(c)).length,
      intentosF0302: confs.filter((c) => this.configuracionEsIntento(c)).length,
      // Los reprocesos NO se cuentan como preparaciones ni como expedientes técnicos: son
      // correcciones dentro del mismo expediente y llevan su propio contador.
      fallasF0302: confs.filter((c) => c.estado === 'Con falla').length,
      reprocesosF0288: this.reprocesosDeEquipo(inventario).length,
      vecesAsignado: asigs.length,
      vecesDescargado: this.vecesDescargado(inventario),
      responsableOperativo: eq ? this.responsableOperativo(eq) : '—',
      ultimoTecnicoPreparo: preps[0]?.tecnico ?? '',
      ultimoTecnicoConfiguro: confs[0]?.tecnico ?? '',
      ultimaPreparacion: preps.find((p) => this.preparacionFinalizada(p)),
      ultimaConfiguracion: confs.find((c) => this.configuracionFinalizada(c)),
      ultimoDescargo: this.ultimoDescargo(inventario),
      estadoGarantia: gars[0]?.estado ?? 'No aplica'
    };
  }
  /**
   * Un equipo solo cuenta como Preparado cuando su F0288 está finalizado. Si el expediente
   * técnico vigente quedó Cerrado (por un Descargo), el equipo vuelve a Pendiente de
   * preparación: ese expediente ya no puede reutilizarse para asignarlo de nuevo.
   */
  estadoPreparacionEquipo(inventario: string): EstadoPreparacionEquipo {
    const tec = this.expTecnicoDeEquipo(inventario);
    if (!tec || tec.estado === 'Cerrado') return 'Pendiente de preparación';
    return tec.estado === 'Preparado' ? 'Preparado' : 'En preparación';
  }
  estadoAsignacionEquipo(inventario: string): EstadoAsignacionEquipo {
    return this.asignacionDeEquipo(inventario) ? 'Asignado' : 'No asignado';
  }
  /** Equipos listos para asignar: preparados (F0288 finalizado), con expediente técnico y no asignados. */
  equiposDisponiblesParaAsignar(): Equipo[] {
    return this.equipos().filter((e) =>
      this.estadoPreparacionEquipo(e.inventario) === 'Preparado' &&
      this.estadoAsignacionEquipo(e.inventario) === 'No asignado'
    );
  }

  /**
   * Equipos que pueden asignarse a un usuario final: los preparados y sin asignación, con su F0288
   * finalizado y firmado, y sin trabajo abierto sobre la preparación. Un equipo con un reproceso
   * F0288 sin cerrar o con una falla de F0302 sin resolver está preparado en el papel, pero
   * entregarlo sería empezar un proceso nuevo sobre algo que todavía no termina el anterior.
   */
  equiposParaAsignar(): Equipo[] {
    return this.equiposDisponiblesParaAsignar().filter((e) => {
      const tec = this.expTecnicoDeEquipo(e.inventario);
      if (!tec) return false;
      const prep = this.preparacionPorCodigo(tec.codigo);
      if (prep && (prep.estado !== 'Completada' || prep.firma?.estado !== 'Firmado')) return false;
      if (this.reprocesoAbiertoDeExpTecnico(tec.codigo)) return false;
      const proceso = this.equipoDe(e.inventario)?.expediente;
      if (proceso && (this.expedienteUnicoDe(proceso) || this.fallaVigenteDe(proceso))) return false;
      return true;
    });
  }

  /**
   * Requerimientos que pueden recibir un equipo. Es el filtro **base** del flujo de nueva
   * asignación: ningún filtro rápido ni búsqueda puede saltárselo.
   *
   * Se exige que el requerimiento no tenga equipo **por ningún camino**: ni número de inventario
   * asociado, ni registro de asignación —vigente o no—, ni estado «Asignada». Comprobar solo la
   * asignación vigente dejaba pasar los casos en que la asignación se cerró (p. ej. por descargo)
   * pero el requerimiento se quedó con su inventario y su estado: aparecían aquí como si no
   * tuvieran equipo.
   */
  solicitudesParaAsignar(): Solicitud[] {
    const yaAsignada = ['Asignada', 'En configuración', 'Pendiente de aceptación', 'No conforme',
      'Entregado', 'Cerrado', 'Cancelado'];
    return this.solicitudes().filter((s) =>
      !yaAsignada.includes(s.estado) &&
      !s.equipoInventario &&
      !this.asignacionDe(s.expediente) &&
      !this.expedienteUnicoDe(s.expediente) &&
      !this.conformidadDeProceso(s.expediente) &&
      !this.garantiaDe(s.expediente)
    );
  }

  /** true si el requerimiento ya tiene equipo por cualquiera de sus rastros. */
  solicitudYaTieneEquipo(id: string): boolean {
    const s = this.solicitud(id);
    return !!s && (!!s.equipoInventario || !!this.asignacionDe(id) || s.estado === 'Asignada');
  }

  /**
   * Asignaciones que todavía se pueden corregir: las que tienen equipo pero **aún no tienen
   * Expediente único**. Es el mismo corte que usa `casoModificacionAsignacion`: en cuanto el
   * expediente existe, el equipo deja de ser un dato suelto de la asignación y pasa a ser la base
   * del F0302, de sus evidencias y de sus firmas.
   */
  asignacionesModificables(): Asignacion[] {
    return this.asignaciones().filter((a) => a.vigente && !!a.equipoInventario &&
      !this.expedienteUnicoDe(a.expediente) &&
      !this.configuracionIniciada(a.expediente) &&
      !this.conformidadDeProceso(a.expediente) &&
      !this.garantiaDe(a.expediente));
  }

  /**
   * Validación de respaldo del flujo de nueva asignación: bloquea seleccionar un requerimiento que
   * ya tiene equipo aunque, por un dato desalineado, hubiera llegado hasta el listado.
   */
  validarSolicitudParaAsignar(id: string): string | null {
    if (!this.solicitudYaTieneEquipo(id)) return null;
    return 'Esta solicitud ya tiene un equipo asignado. No puede seleccionarse para una nueva asignación. '
      + 'Use la opción Modificar asignación si necesita corregirla.';
  }

  /**
   * Solicitudes que pueden convertirse en Expediente único. El equipo **no se busca aquí**: llega
   * desde la asignación al usuario final, que es el paso anterior del proceso. Por eso solo se
   * listan las solicitudes que ya lo tienen, y con su preparación terminada:
   *
   *  - asignación vigente con equipo (sin ella no hay nada que consolidar);
   *  - expediente técnico del equipo en «Preparado» y su F0288 finalizado y firmado;
   *  - sin reproceso F0288 abierto ni falla de F0302 sin resolver: el equipo estaría preparado en
   *    el papel pero no listo para entregar;
   *  - sin Expediente único previo, y sin procesos ya terminados (entregados o cerrados), que no
   *    tienen nada que consolidar.
   *
   * El F0288 se exige **cuando existe el registro**: es la misma tolerancia que aplica
   * `crearExpedienteUnico` con los expedientes anteriores a que el F0288 se guardara aparte. Si la
   * lista fuera más estricta que la creación, mostraría menos de lo que el sistema sí permite.
   */
  solicitudesParaExpedienteUnico(): Solicitud[] {
    return this.solicitudes().filter((s) => {
      if (s.estado === 'Entregado' || s.estado === 'Cerrado') return false;
      if (this.expedienteUnicoDe(s.expediente)) return false;
      const asig = this.asignacionDe(s.expediente);
      const inventario = asig?.vigente ? asig.equipoInventario : '';
      if (!inventario) return false;
      const tec = this.expTecnicoDeEquipo(inventario);
      if (tec?.estado !== 'Preparado') return false;
      const prep = this.preparacionPorCodigo(tec.codigo);
      if (prep && (prep.estado !== 'Completada' || prep.firma?.estado !== 'Firmado')) return false;
      if (this.reprocesoAbiertoDeExpTecnico(tec.codigo)) return false;
      if (this.fallaVigenteDe(s.expediente)) return false;
      return true;
    });
  }

  // ---------- Carga laboral ----------
  /**
   * Cortes de la escala de carga laboral, común a Hardware y a Soporte: 0 a 2 procesos activos es
   * baja, 3 a 5 media, 6 o más alta. Lo que cambia entre las dos áreas es **qué se cuenta**
   * (`cargaSoporteDe` y `cargaHardwareDe`), nunca dónde están los cortes.
   */
  private readonly CARGA_MEDIA_DESDE = 3;
  private readonly CARGA_ALTA_DESDE = 6;

  /** Nivel que corresponde a una cantidad de procesos activos. */
  nivelDeCarga(total: number): NivelCarga {
    return total >= this.CARGA_ALTA_DESDE ? 'Alta' : total >= this.CARGA_MEDIA_DESDE ? 'Media' : 'Baja';
  }

  /**
   * Aviso que corresponde al nivel de carga. La carga alta **advierte, no bloquea**: quien asigna
   * sigue pudiendo elegir al técnico, pero se le dice antes y no después.
   */
  avisoCarga(nivel: NivelCarga): string {
    if (nivel === 'Alta') return this.MSG_CARGA_ALTA;
    if (nivel === 'Media') return 'Este técnico tiene carga laboral media. Verifique si puede asumir un nuevo proceso.';
    return 'Este técnico tiene carga laboral baja y puede recibir nuevos procesos.';
  }

  /** Advertencia de carga alta. No impide seleccionar: solo pide revisar la disponibilidad. */
  readonly MSG_CARGA_ALTA =
    'Este técnico tiene carga laboral alta. Puede seleccionarlo, pero se recomienda revisar su disponibilidad.';

  /** El nombre suelto de un responsable guardado como «Nombre — Rol». */
  private soloNombre(tecnico: string): string {
    return (tecnico ?? '').split('—')[0].trim();
  }

  /**
   * Configuraciones F0302 **en proceso** de un Técnico de Soporte: las que ya empezaron y todavía
   * no se completaron, incluidas las que quedaron «Con falla» —el equipo sigue siendo suyo hasta
   * que la incidencia se resuelve—. Las que aún no se han iniciado no se cuentan aquí sino como
   * expediente único pendiente: es trabajo asignado, pero de otra clase.
   */
  configuracionesActivasDeSoporte(tecnico: string): ConfiguracionF0302[] {
    const nombre = this.soloNombre(tecnico);
    if (!nombre) return [];
    return this.configuraciones().filter((c) =>
      c.tecnico.includes(nombre) && c.estado !== 'Completada' && this.configuracionIniciada(c.expediente));
  }

  /**
   * Expedientes únicos a cargo del técnico cuyo F0302 **todavía no ha empezado**. Junto con
   * `configuracionesActivasDeSoporte` reparten todo el trabajo de configuración sin solaparse: un
   * mismo proceso no puede sumar dos veces a la carga, o «Carga alta» dejaría de significar seis
   * trabajos y pasaría a significar tres contados dos veces.
   *
   * Se toma la configuración F0302 como fuente —existe desde que se crea el Expediente único— y se
   * añaden las asignaciones vigentes que todavía no tienen ninguna, que es como quedaron los
   * procesos anteriores a que el F0302 se guardara aparte.
   */
  expedientesUnicosActivosDeSoporte(tecnico: string): { expediente: string; inventario: string; estado: string; fecha: string }[] {
    const nombre = this.soloNombre(tecnico);
    if (!nombre) return [];
    const pendientes = this.configuraciones()
      .filter((c) => c.tecnico.includes(nombre) && c.estado !== 'Completada' && !this.configuracionIniciada(c.expediente))
      .map((c) => ({ expediente: c.expediente, inventario: c.datos.inventario, estado: 'Pendiente de configuración', fecha: c.fecha }));
    const conConfiguracion = new Set(this.configuraciones().map((c) => c.expediente));
    const sinConfiguracion = this.asignaciones()
      .filter((a) => a.vigente &&
        (a.responsablesFase?.tecnicoConfiguracion ?? '').includes(nombre) &&
        a.responsablesFase?.estadoConfiguracion !== 'Completada' &&
        !conConfiguracion.has(a.expediente))
      .map((a) => ({
        expediente: a.expediente, inventario: a.equipoInventario,
        estado: a.responsablesFase?.estadoConfiguracion ?? 'Pendiente', fecha: a.fecha
      }));
    return [...pendientes, ...sinConfiguracion];
  }

  /** Correcciones F0302 por inconformidad que el técnico tiene pendientes o en proceso. */
  correccionesActivasDeSoporte(tecnico: string): CorreccionNoConformidad[] {
    const nombre = this.soloNombre(tecnico);
    if (!nombre) return [];
    return this.correcciones().filter((c) =>
      c.tecnico.includes(nombre) && c.estado !== 'Firmada' && c.estado !== 'Cerrada por reproceso F0288');
  }

  /**
   * Inconformidades que todavía nadie empezó a atender, en procesos donde el técnico es el
   * responsable de la configuración. Es trabajo suyo aunque aún no exista la corrección: por eso
   * se cuenta aparte de `correccionesActivasDeSoporte`.
   */
  inconformidadesPendientesDeSoporte(tecnico: string): IntentoAceptacion[] {
    const nombre = this.soloNombre(tecnico);
    if (!nombre) return [];
    return this.intentos().filter((i) => {
      if (i.resultado !== 'No conforme') return false;
      if (this.correccionesDe(i.expediente).some((c) => c.intentoNumero === i.numero)) return false;
      const asig = this.asignacionDe(i.expediente);
      return (asig?.responsablesFase?.tecnicoConfiguracion ?? '').includes(nombre);
    });
  }

  /** Casos de garantía abiertos o en revisión que atiende el técnico. */
  casosGarantiaActivosDeSoporte(tecnico: string): { garantia: Garantia; caso: CasoGarantia }[] {
    const nombre = this.soloNombre(tecnico);
    if (!nombre) return [];
    return this.garantias().flatMap((g) =>
      g.casos
        .filter((c) => c.responsableAtencion.includes(nombre) && (c.estado === 'Abierto' || c.estado === 'En revisión'))
        .map((caso) => ({ garantia: g, caso })));
  }

  /** Descargos registrados por el técnico que aún no se han procesado. */
  descargosPendientesDeSoporte(tecnico: string): Descargo[] {
    const nombre = this.soloNombre(tecnico);
    if (!nombre) return [];
    return this.descargos().filter((d) => d.responsableRegistro.includes(nombre) && d.estado === 'Registrado');
  }

  /**
   * Formularios de conformidad enviados y sin respuesta en procesos donde el técnico participa
   * (configuró o entregó). Son seguimiento pendiente: el proceso no avanza solo.
   */
  conformidadesEnSeguimientoDeSoporte(tecnico: string): Conformidad[] {
    const nombre = this.soloNombre(tecnico);
    if (!nombre) return [];
    return this.conformidades().filter((c) => {
      if (c.estado !== 'Enviado' && c.estado !== 'Pendiente de respuesta') return false;
      const e = this.entregaDe(c.expediente);
      const asig = this.asignacionDe(c.expediente);
      return (e?.tecnicoConfiguro ?? '').includes(nombre) || (e?.tecnicoEntrega ?? '').includes(nombre)
        || (asig?.responsablesFase?.tecnicoConfiguracion ?? '').includes(nombre);
    });
  }

  /**
   * Carga laboral de un Técnico de Soporte, con el desglose por tipo de proceso. Cuenta **solo**
   * procesos del área de Soporte (§9): mezclarlos con los de Hardware daría un total que no
   * describe el trabajo de ninguno de los dos.
   */
  cargaSoporteDe(tecnico: string): CargaSoporte {
    const expedientesUnicos = this.expedientesUnicosActivosDeSoporte(tecnico).length;
    const configuraciones = this.configuracionesActivasDeSoporte(tecnico).length;
    const correcciones = this.correccionesActivasDeSoporte(tecnico).length;
    const inconformidades = this.inconformidadesPendientesDeSoporte(tecnico).length;
    const garantias = this.casosGarantiaActivosDeSoporte(tecnico).length;
    const descargos = this.descargosPendientesDeSoporte(tecnico).length;
    const conformidades = this.conformidadesEnSeguimientoDeSoporte(tecnico).length;
    const total = expedientesUnicos + configuraciones + correcciones + inconformidades
      + garantias + descargos + conformidades;
    const nivel = this.nivelDeCarga(total);
    return {
      expedientesUnicos, configuraciones, correcciones, inconformidades, garantias, descargos,
      conformidades, total, nivel,
      carga: `Carga ${nivel.toLowerCase()}`,
      disponibilidad: nivel === 'Alta' ? 'Ocupado' : 'Disponible'
    };
  }

  /**
   * Los procesos activos que hay detrás de esa carga, uno por fila. Es lo que permite responder
   * «¿por qué está en carga alta?» sin salir del buscador de técnicos.
   */
  procesosActivosDeSoporte(tecnico: string): ProcesoActivo[] {
    const filas: ProcesoActivo[] = [];
    const dirUni = (expediente: string): { direccion: string; unidad: string } => {
      const s = this.solicitud(expediente);
      return { direccion: s?.direccionGerencia ?? '', unidad: s?.unidadDestino ?? '' };
    };
    const nombreEquipo = (inventario: string): string => {
      const e = this.equipoDe(inventario);
      return e ? `${e.marca} ${e.modelo}` : '';
    };

    for (const c of this.configuracionesActivasDeSoporte(tecnico)) {
      const { direccion, unidad } = dirUni(c.expediente);
      filas.push({
        codigo: this.expedienteUnicoDe(c.expediente)?.codigoUnico ?? c.expediente,
        tipoProceso: 'Configuración F0302',
        equipo: nombreEquipo(c.datos.inventario), inventario: c.datos.inventario,
        usuarioFinal: c.datos.asignadoA, direccion: direccion || c.datos.direccionGerencia,
        unidad: unidad || c.datos.unidad, estado: c.estado, fechaAsignacion: c.fecha,
        prioridad: c.estado === 'Con falla' ? 'Alta' : 'Normal'
      });
    }
    for (const a of this.expedientesUnicosActivosDeSoporte(tecnico)) {
      const { direccion, unidad } = dirUni(a.expediente);
      filas.push({
        codigo: this.expedienteUnicoDe(a.expediente)?.codigoUnico ?? a.expediente,
        tipoProceso: 'Expediente único',
        equipo: nombreEquipo(a.inventario), inventario: a.inventario,
        usuarioFinal: this.solicitud(a.expediente)?.destinatario ?? '', direccion, unidad,
        estado: a.estado, fechaAsignacion: a.fecha || this.asignacionDe(a.expediente)?.fecha || '',
        prioridad: 'Normal'
      });
    }
    for (const c of this.correccionesActivasDeSoporte(tecnico)) {
      const { direccion, unidad } = dirUni(c.expediente);
      filas.push({
        codigo: c.id, tipoProceso: 'Corrección F0302',
        equipo: nombreEquipo(c.inventario), inventario: c.inventario,
        usuarioFinal: c.usuarioFinal, direccion, unidad, estado: c.estado,
        fechaAsignacion: c.fechaInicio, prioridad: 'Alta'
      });
    }
    for (const i of this.inconformidadesPendientesDeSoporte(tecnico)) {
      const { direccion, unidad } = dirUni(i.expediente);
      filas.push({
        codigo: `${i.expediente} · intento ${i.numero}`, tipoProceso: 'Inconformidad',
        equipo: nombreEquipo(i.inventario), inventario: i.inventario,
        usuarioFinal: i.usuarioFinal, direccion, unidad, estado: 'Pendiente de atención',
        fechaAsignacion: i.fecha, prioridad: 'Alta'
      });
    }
    for (const { garantia, caso } of this.casosGarantiaActivosDeSoporte(tecnico)) {
      const { direccion, unidad } = dirUni(garantia.expediente);
      filas.push({
        codigo: caso.codigo, tipoProceso: 'Garantía',
        equipo: garantia.equipo, inventario: garantia.inventario,
        usuarioFinal: garantia.usuarioFinal, direccion, unidad, estado: caso.estado,
        fechaAsignacion: caso.fechaApertura, prioridad: 'Normal'
      });
    }
    for (const d of this.descargosPendientesDeSoporte(tecnico)) {
      const { direccion, unidad } = dirUni(d.asignacionRelacionada);
      filas.push({
        codigo: d.idDescargo, tipoProceso: 'Descargo',
        equipo: nombreEquipo(d.inventario), inventario: d.inventario,
        usuarioFinal: d.usuarioFinalEntrega, direccion, unidad, estado: d.estado,
        fechaAsignacion: d.fechaDescargo, prioridad: 'Normal'
      });
    }
    for (const c of this.conformidadesEnSeguimientoDeSoporte(tecnico)) {
      const { direccion, unidad } = dirUni(c.expediente);
      filas.push({
        codigo: c.token, tipoProceso: 'Formulario de conformidad',
        equipo: c.marcaModelo, inventario: c.inventario, usuarioFinal: c.usuarioFinal,
        direccion, unidad, estado: c.estado, fechaAsignacion: c.fechaEnvio.slice(0, 10),
        prioridad: 'Normal'
      });
    }
    return filas.sort((a, b) => b.fechaAsignacion.localeCompare(a.fechaAsignacion));
  }

  /** Desglose de la carga en una línea, para tooltips, resúmenes y trazabilidad. */
  resumenCargaSoporte(carga: CargaSoporte): string {
    const partes = [
      [carga.expedientesUnicos, 'expedientes únicos'],
      [carga.configuraciones, 'configuraciones'],
      [carga.correcciones, 'correcciones'],
      [carga.inconformidades, 'inconformidades'],
      [carga.garantias, 'garantías'],
      [carga.descargos, 'descargos'],
      [carga.conformidades, 'conformidades en seguimiento']
    ] as const;
    const activas = partes.filter(([n]) => n > 0).map(([n, etiqueta]) => `${n} ${etiqueta}`);
    return activas.length ? activas.join(' · ') : 'Sin procesos activos';
  }

  /** Fecha del proceso más reciente que se le asignó al técnico de soporte, si tiene alguno. */
  ultimaAsignacionSoporte(tecnico: string): string {
    return this.procesosActivosDeSoporte(tecnico)[0]?.fechaAsignacion ?? '';
  }

  /**
   * Técnicos de Soporte activos con su carga laboral desglosada y las Direcciones/Unidades que
   * atienden. Repartir sin ver esto es cómo se satura siempre al mismo. Se ordena por carga
   * ascendente: el primero de la lista es el que puede recibir el trabajo con menos costo.
   */
  tecnicosSoporteConCarga(): TecnicoSoporteConCarga[] {
    return this.usuarios()
      .filter((u) => u.clave === 'tec-soporte' && u.estado !== 'Inactivo')
      .map((usuario) => {
        const nombreRol = `${usuario.nombre} — ${usuario.rol}`;
        const carga = this.cargaSoporteDe(nombreRol);
        const direcciones = this.direccionesDeTecnico(nombreRol)
          .map((d) => (d.direccion === d.unidad ? d.direccion : `${d.direccion} / ${d.unidad}`));
        return {
          ...carga, usuario, nombreRol,
          direccionUnidad: direcciones.join('; '),
          ultimaAsignacion: this.ultimaAsignacionSoporte(nombreRol)
        };
      })
      .sort((a, b) => a.total - b.total || a.usuario.nombre.localeCompare(b.usuario.nombre));
  }

  /**
   * Carga laboral de un Técnico de **Hardware**. Cuenta lo suyo —expedientes técnicos activos,
   * preparaciones F0288 sin finalizar, reprocesos asignados y revisiones técnicas de garantía—, y
   * nunca procesos de Soporte. Un reproceso con origen «Garantía» se cuenta como revisión de
   * garantía y no como reproceso, para no sumarlo dos veces.
   */
  cargaHardwareDe(tecnico: string): CargaHardware {
    const nombre = this.soloNombre(tecnico);
    const expedientes = this.expedientesActivosDeTecnico(nombre).length;
    const preparaciones = this.preparaciones()
      .filter((p) => p.tecnico.includes(nombre) && p.estado !== 'Completada' && p.estado !== 'Cerrada').length;
    const abiertos = nombre
      ? this.reprocesos().filter((r) => r.tecnicoAsignado.includes(nombre)
          && r.estado !== 'Firmado' && r.estado !== 'No corregido')
      : [];
    const revisionesGarantia = abiertos.filter((r) => r.origen === 'Garantía').length;
    const reprocesos = abiertos.length - revisionesGarantia;
    const total = expedientes + preparaciones + reprocesos + revisionesGarantia;
    const nivel = this.nivelDeCarga(total);
    return {
      expedientes, preparaciones, reprocesos, revisionesGarantia, total, nivel,
      carga: `Carga ${nivel.toLowerCase()}`,
      disponibilidad: nivel === 'Alta' ? 'Ocupado' : 'Disponible'
    };
  }

  /** Desglose de la carga de Hardware en una línea. */
  resumenCargaHardware(carga: CargaHardware): string {
    const partes = [
      [carga.expedientes, 'expedientes técnicos'],
      [carga.preparaciones, 'preparaciones F0288'],
      [carga.reprocesos, 'reprocesos F0288'],
      [carga.revisionesGarantia, 'revisiones de garantía']
    ] as const;
    const activas = partes.filter(([n]) => n > 0).map(([n, etiqueta]) => `${n} ${etiqueta}`);
    return activas.length ? activas.join(' · ') : 'Sin procesos activos';
  }

  /**
   * Deja constancia de que se consultó el detalle de carga laboral de un Técnico de Soporte. Se
   * registra al abrir el detalle, no en cada búsqueda ni al pasar el mouse: la trazabilidad debe
   * poder leerse, y una consulta de solo lectura por cada movimiento del cursor la vuelve inútil.
   */
  registrarConsultaCargaSoporte(tecnico: string, usuario: string, expediente = ''): void {
    const carga = this.cargaSoporteDe(tecnico);
    const detalle = this.resumenCargaSoporte(carga);
    this.registrarEvento(expediente || `TECNICO-${this.soloNombre(tecnico)}`, usuario,
      `Carga laboral de Técnico de Soporte visualizada: ${this.soloNombre(tecnico)}`, 'Consulta realizada',
      `${carga.carga} — ${carga.total} procesos activos. ${detalle}.`, false,
      { modulo: 'Carga laboral de Soporte', tecnicoSoporte: tecnico, cargaLaboral: carga.carga,
        procesosActivos: carga.total, detalleCarga: detalle, rol: this.rolConectado() });
  }

  /**
   * Deja constancia de que se seleccionó un Técnico de Soporte, con la carga que tenía **en ese
   * momento**. Si el técnico venía en carga alta se registra como evento aparte: la advertencia se
   * mostró y aun así se asignó, y eso es justo lo que después hay que poder auditar.
   */
  registrarSeleccionSoporte(tecnico: string, usuario: string, contexto: {
    expediente?: string; modulo: string; direccion?: string; unidad?: string;
    inventario?: string; expedienteUnico?: string;
  }): void {
    const carga = this.cargaSoporteDe(tecnico);
    const detalle = this.resumenCargaSoporte(carga);
    const ref = {
      modulo: contexto.modulo, tecnicoSoporte: tecnico, cargaLaboral: carga.carga,
      procesosActivos: carga.total, detalleCarga: detalle, direccion: contexto.direccion,
      unidad: contexto.unidad, inventario: contexto.inventario,
      expedienteUnico: contexto.expedienteUnico, rol: this.rolConectado()
    };
    const expediente = contexto.expediente || `TECNICO-${this.soloNombre(tecnico)}`;
    this.registrarEvento(expediente, usuario,
      `Técnico de Soporte seleccionado: ${this.soloNombre(tecnico)}`, 'Asignación realizada',
      `${carga.carga} al momento de asignar — ${carga.total} procesos activos. ${detalle}.`, false, ref);
    if (carga.nivel === 'Alta') {
      this.registrarEvento(expediente, usuario,
        `Técnico seleccionado con carga alta: ${this.soloNombre(tecnico)}`, 'Asignación realizada',
        `${this.MSG_CARGA_ALTA} Se asignó de todos modos con ${carga.total} procesos activos.`, false, ref);
    }
  }
  /**
   * Un equipo puede recibir un NUEVO expediente técnico si nunca tuvo uno, o si su último
   * expediente técnico ya quedó «Preparado» o «Cerrado» (por un Descargo) Y su ingreso a
   * Hardware más reciente todavía no tiene expediente técnico asociado (reingreso pendiente)
   * Y el equipo no tiene actualmente una asignación vigente. El expediente cerrado nunca se
   * reutiliza: esta función solo habilita CREAR uno nuevo, nunca reabre el anterior.
   *
   * Se identifica el reingreso por `expedienteTecnicoAsociado` (no por comparar fechas): un
   * ingreso y el expediente técnico que genera pueden registrarse el mismo día calendario
   * (p. ej. al probar el flujo completo de un tirón), y `fechaIngreso`/`fecha` solo guardan el
   * día, sin hora — comparar con `>` los dejaba empatados y bloqueaba el reingreso por error.
   */
  puedeCrearNuevoExpedienteTecnico(inventario: string): boolean {
    const ultimoET = this.expedientesTecnicosDeEquipo(inventario)[0];
    if (!ultimoET) return true;
    if (ultimoET.estado !== 'Preparado' && ultimoET.estado !== 'Cerrado') return false;
    const hayReingresoPendiente = this.reingresoHardwarePendiente(inventario);
    // Ya no hay excepción por inconformidad del usuario final: una inconformidad se resuelve como
    // una falla de F0302 —corrigiendo en configuración o con un reproceso F0288 sobre el mismo
    // Expediente técnico—, nunca creando un expediente principal nuevo.
    // Tampoco hay excepción por falla en F0302: una falla del mismo ciclo se atiende con un reproceso
    // F0288 dentro del expediente técnico vigente. Un expediente nuevo corresponde solo a un ciclo
    // nuevo —reingreso formal tras descargo, sustitución del equipo o autorización de jefatura—,
    // que es exactamente lo que exige la condición de abajo: reingreso pendiente y sin asignación.
    return hayReingresoPendiente && !this.asignacionDeEquipo(inventario);
  }
  /**
   * Equipos que aún pueden recibir un expediente técnico: sin expediente, o reingresados y
   * elegibles para una nueva preparación (ver `puedeCrearNuevoExpedienteTecnico`).
   */
  equiposSinExpedienteTecnico(): Equipo[] {
    return this.equipos().filter((e) =>
      this.estadoAsignacionEquipo(e.inventario) === 'No asignado' &&
      (!this.expTecnicoDeEquipo(e.inventario) || this.puedeCrearNuevoExpedienteTecnico(e.inventario))
    );
  }

  // ---------- Consulta a la base institucional simulada ----------
  /**
   * Formatos válidos de número de inventario. El bloque central identifica el tipo de equipo:
   * `101` es CPU / Desktop y `920` es Laptop. Los cuatro últimos dígitos son el correlativo.
   */
  private readonly formatoCPU = /^2201-00-101-\d{4}$/;
  private readonly formatoLaptop = /^2201-00-920-\d{4}$/;

  /** Tipo de equipo deducido del número de inventario, o null si el formato no corresponde a ninguno. */
  tipoPorNumeroInventario(inventario: string): 'Laptop' | 'Desktop' | null {
    const inv = inventario.trim();
    if (this.formatoCPU.test(inv)) return 'Desktop';
    if (this.formatoLaptop.test(inv)) return 'Laptop';
    return null;
  }

  /** Ficha del catálogo institucional, si el número existe. */
  fichaInstitucional(inventario: string): EquipoCatalogoInstitucional | undefined {
    return this.catalogoInstitucional().find((c) => c.inventario === inventario.trim());
  }

  // ---------- Catálogo de software permitido (F0288 / F0302) ----------
  softwareCatalogoDe(codigo: string): SoftwareCatalogo | undefined {
    return this.catalogoSoftware().find((s) => s.codigo === codigo);
  }
  /**
   * Software del catálogo, activo, que se usa en la etapa indicada («Ambas etapas» aplica a las
   * dos). No filtra por CPU/Laptop a propósito: el tipo de equipo ya se conoce por el inventario
   * y el catálogo no lo configura.
   */
  softwareAplicable(formulario: 'F0288' | 'F0302'): SoftwareCatalogo[] {
    const etapa: EtapaSoftware = formulario === 'F0288' ? 'Preparación F0288' : 'Configuración F0302';
    return this.catalogoSoftware().filter((s) => s.activo && (s.etapa === etapa || s.etapa === 'Ambas etapas'));
  }

  /**
   * Enlaza un ítem fijo del checklist F0288 con su software del catálogo, solo si ese software
   * sigue activo y se usa en esa etapa. Si no lo está, el ítem se conserva (sigue siendo un paso
   * del checklist) pero sin control de versiones: no se ofrece software inactivo.
   */
  private enlaceSoftware(codigo: string, formulario: 'F0288' | 'F0302'): { codigoSoftware?: string } {
    return this.softwareAplicable(formulario).some((s) => s.codigo === codigo) ? { codigoSoftware: codigo } : {};
  }

  /** Siguiente código correlativo del catálogo («SOFT-008»); el usuario no lo escribe a mano. */
  siguienteCodigoSoftware(): string {
    const nums = this.catalogoSoftware()
      .map((s) => parseInt(s.codigo.replace(/^SOFT-/, ''), 10))
      .filter((n) => !isNaN(n));
    return `SOFT-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`;
  }

  /**
   * Normaliza el catálogo leído del JSON semilla o de una foto de localStorage anterior a la
   * etapa del proceso: convierte los antiguos `aplicaF0288`/`aplicaF0302` en `etapa` y completa
   * los campos nuevos. `aplicaCPU`/`aplicaLaptop` se descartan: el catálogo ya no distingue tipo
   * de equipo.
   */
  private normalizarCatalogoSoftware(lista: SoftwareCatalogo[]): SoftwareCatalogo[] {
    return (lista ?? []).map((s) => {
      const viejo = s as SoftwareCatalogo & { aplicaF0288?: boolean; aplicaF0302?: boolean };
      const etapa: EtapaSoftware = s.etapa
        ?? (viejo.aplicaF0288 && viejo.aplicaF0302 ? 'Ambas etapas'
          : viejo.aplicaF0288 ? 'Preparación F0288' : 'Configuración F0302');
      return {
        codigo: s.codigo, nombre: s.nombre, categoria: s.categoria,
        descripcion: s.descripcion ?? '',
        versionesPermitidas: s.versionesPermitidas ?? [], versionVigente: s.versionVigente ?? '',
        etapa,
        requiereLicencia: s.requiereLicencia ?? false,
        tipoLicencia: s.requiereLicencia ? (s.tipoLicencia ?? '') : '',
        activo: s.activo ?? true, observacion: s.observacion ?? '',
        ultimaActualizacion: s.ultimaActualizacion ?? ''
      };
    });
  }

  /**
   * Ítems que ya no pertenecen al F0288: credenciales, ingreso a dominio y Agente DLP son
   * actividades del Técnico de Soporte, no de la preparación técnica de Hardware.
   */
  private fueraDelF0288(nombre: string): boolean {
    return /^(agente dlp|ingreso a dominio|credenciales)/i.test((nombre ?? '').trim());
  }

  /**
   * Sufijo que corresponde a un accesorio dentro de su familia: en CPU, Monitor -02, Teclado -03
   * y Mouse -04; en Laptop, Mouse -02 y Maletín -03 (el Mouse cambia de sufijo según la familia).
   */
  private sufijoAccesorio(nombre: string, familia: string): string {
    if (familia === FAMILIA_ACCESORIO_LAPTOP) return nombre === 'Mouse' ? '02' : '03';
    return nombre === 'Monitor' ? '02' : nombre === 'Teclado' ? '03' : '04';
  }

  /** Título actual de una sección del checklist F0288 (las secciones se renombraron con el tiempo). */
  private tituloSeccionF0288(titulo: string): string {
    if (titulo === 'Software según SISSOR · dominio · credenciales') return 'Instalación de software institucional';
    if (titulo === 'Sistema operativo y cuenta administrador') return 'Sistema operativo, componentes de Windows y cuenta administrador';
    return titulo;
  }

  /**
   * Agrega «.NET Framework 3.5» a la sección de sistema operativo de una preparación guardada
   * antes de que el ítem existiera. **Solo se agrega a preparaciones todavía en curso**: un F0288
   * ya finalizado documenta lo que realmente se hizo, y sumarle un ítem después sería reescribir
   * un registro técnico cerrado.
   */
  private itemsSistemaOperativo(sec: ChecklistSeccion, p: PreparacionF0288): ChecklistItem[] {
    const esSeccionSO = this.tituloSeccionF0288(sec.titulo) === 'Sistema operativo, componentes de Windows y cuenta administrador';
    if (!esSeccionSO || p.estado !== 'En preparación') return sec.items;
    if (sec.items.some((i) => i.nombre.startsWith('.NET Framework'))) return sec.items;
    const nuevo: ChecklistItem = {
      nombre: '.NET Framework 3.5', estado: 'Pendiente', evidencia: null,
      nota: 'Se habilita como característica de Windows cuando aplique.', codigoSoftware: 'SOFT-008'
    };
    // Va después de «Controladores» y antes de la cuenta de administrador, igual que en la plantilla.
    const corte = sec.items.findIndex((i) => i.nombre.startsWith('Habilitar cuenta'));
    return corte < 0 ? [...sec.items, nuevo] : [...sec.items.slice(0, corte), nuevo, ...sec.items.slice(corte)];
  }

  /** Nombre actual de los ítems de software del F0288 («Antivirus» → «Instalación de Antivirus»). */
  private nombreItemF0288(nombre: string): string {
    const n = (nombre ?? '').trim();
    if (n === 'Antivirus') return 'Instalación de Antivirus';
    if (n === 'OCS Inventory') return 'Instalación de OCS Inventory';
    return n;
  }

  /** Etiqueta corta para los avisos y eventos de evidencia («Instalación de Antivirus» → «Antivirus»). */
  private etiquetaEvidencia(nombreItem: string): string {
    return nombreItem.replace(/^Instalación de /, '');
  }

  /**
   * Normaliza las preparaciones leídas del JSON semilla o de una foto de localStorage anterior:
   * saca del F0288 los ítems de credenciales, dominio y Agente DLP (con sus evidencias y sus
   * secciones ocultas), renombra los ítems de software al nombre actual y marca como
   * «requiere evidencia» los de Antivirus y OCS Inventory. Una demo con datos previos queda
   * alineada con la regla nueva sin obligar a restablecer los datos de demostración.
   */
  private normalizarPreparaciones(lista: PreparacionF0288[]): PreparacionF0288[] {
    return (lista ?? []).map((p) => ({
      ...p,
      // Accesorios guardados antes de que existieran la familia y el sello de verificación. Las
      // fotos más antiguas guardaban solo `{ nombre, estado }`, así que se completan todos los
      // campos: sin esto la pantalla de accesorios no tendría con qué buscar.
      verificacionAccesorios: p.verificacionAccesorios
        ? { ...p.verificacionAccesorios, accesorios: (p.verificacionAccesorios.accesorios ?? []).map((a) => ({
            ...a,
            familiaEsperada: a.familiaEsperada || this.familiaAccesoriosDe(p),
            sufijoEsperado: a.sufijoEsperado || this.sufijoAccesorio(a.nombre, this.familiaAccesoriosDe(p)),
            seleccionado: a.seleccionado ?? false,
            numeroInventario: a.numeroInventario ?? '',
            resultadoBusqueda: a.resultadoBusqueda ?? '',
            marca: a.marca ?? '', modelo: a.modelo ?? '', serie: a.serie ?? '', estadoFisico: a.estadoFisico ?? '',
            observacion: a.observacion ?? '',
            verificadoPor: a.verificadoPor ?? '',
            fechaVerificacion: a.fechaVerificacion ?? ''
          })) }
        : p.verificacionAccesorios,
      secciones: (p.secciones ?? [])
        .map((sec) => ({
          titulo: this.tituloSeccionF0288(sec.titulo),
          items: this.itemsSistemaOperativo(sec, p).filter((i) => !this.fueraDelF0288(i.nombre)).map((i) => {
            const nombre = this.nombreItemF0288(i.nombre);
            const exigeCaptura = nombre === 'Instalación de Antivirus' || nombre === 'Instalación de OCS Inventory';
            return exigeCaptura ? { ...i, nombre, requiereEvidencia: true } : { ...i, nombre };
          })
        }))
        .filter((sec) => sec.items.length > 0),
      // La sección oculta «Credenciales, dominio y Agente DLP» pierde sentido: esos ítems ya no
      // forman parte del F0288 ni siquiera como ítem oculto.
      seccionesOcultas: (p.seccionesOcultas ?? []).filter((o) => !/dlp|dominio|credenciales/i.test(o.nombre)),
      evidencias: (p.evidencias ?? [])
        .filter((e) => !this.fueraDelF0288(e.item))
        .map((e) => ({ ...e, item: this.nombreItemF0288(e.item) }))
    }));
  }

  /**
   * Actividades generales de la configuración que viven en el mismo arreglo que el software pero
   * NO son software del catálogo: ingreso a dominio, credenciales y Agente DLP. No tienen versión
   * controlada ni motivo asociado y se muestran en su propia sección del F0302.
   */
  private esActividadConfiguracion(nombre: string): boolean {
    return /^(agente dlp|soluci[óo]n dlp|ingreso a dominio|credenciales)/i.test((nombre ?? '').trim());
  }

  /**
   * Normaliza las configuraciones leídas del JSON semilla o de una foto de localStorage anterior:
   * marca cada ítem con su origen («Configuración» para las actividades generales, «F0302» para el
   * software) y completa los campos nuevos del software adicional. **No elimina ítems**: un F0302
   * ya finalizado documenta lo que realmente se hizo. El software que ahora se hereda del F0288
   * deja de listarse como adicional en pantalla (`softwareAdicionalF0302`), no aquí.
   *
   * No puede consultar el catálogo de software: al rehidratar, las configuraciones se cargan antes
   * que el catálogo.
   */
  private normalizarConfiguraciones(lista: ConfiguracionF0302[]): ConfiguracionF0302[] {
    return (lista ?? []).map((c) => {
      // `softwareOculto` desapareció del F0302: el checklist es dinámico y lo que no se agregó
      // simplemente no está. Se descarta al rehidratar para que ninguna foto anterior lo reviva.
      const { softwareOculto, ...resto } = c as ConfiguracionF0302 & { softwareOculto?: unknown };
      void softwareOculto;
      // Estado de la solicitud de reserva en fotos anteriores a la regla: «No aplica» cuando el
      // equipo no requiere reserva y «Pendiente de envío» cuando sí, porque en ellas nunca se envió
      // la solicitud simulada a Servidores. No se da por enviada una solicitud que no existió; si
      // el expediente ya estaba finalizado, el modal permite completarla (nunca se registró).
      const requiere = resto.datos?.requiereReservaIP ?? '';
      return {
        ...resto,
        falla: resto.falla ? this.normalizarFalla(resto.falla) : undefined,
        datos: {
          ...resto.datos,
          macEquipo: resto.datos?.macEquipo ?? '',
          justificacionSinReservaIP: resto.datos?.justificacionSinReservaIP ?? '',
          estadoSolicitudIP: resto.datos?.estadoSolicitudIP
            ?? (requiere === 'Sí' ? 'Pendiente de envío' : requiere === 'No' ? 'No aplica' : ''),
          correoReservaEnviado: resto.datos?.correoReservaEnviado ?? '',
          fechaSolicitudIP: resto.datos?.fechaSolicitudIP ?? ''
        },
        software: (resto.software ?? [])
          // Las credenciales de SISSOR salen del checklist: nunca fueron una actividad que el
          // técnico ejecutara, y su «Pendiente» bloqueaba el cierre sin nada que hacer. El dato no
          // se pierde —se muestra como referencia—, deja de ser una casilla.
          .filter((s) => !this.esCredencialesSISSOR(s.nombre))
          .map((s) => ({
          ...s,
          origen: s.origen ?? (this.esActividadConfiguracion(s.nombre) ? 'Configuración' as const : 'F0302' as const),
          motivo: s.motivo ?? '',
          observacion: s.observacion ?? '',
          // El Agente DLP pasó a exigir captura: se marca también en las configuraciones guardadas
          // antes de la regla, para que el cierre la pida igual.
          requiereEvidencia: s.requiereEvidencia ?? this.esAgenteDLP(s.nombre)
        })),
        evidencias: (resto.evidencias ?? []).map((e) => (this.esAgenteDLP(e.item ?? e.nombre)
          ? { ...e, item: e.item ?? 'Agente DLP', tipo: e.tipo ?? 'Agente DLP', formulario: e.formulario ?? 'F0302' }
          : e))
      };
    });
  }

  /**
   * Completa una falla guardada por una versión anterior. El campo `requiereNuevaPreparacion`
   * pasó a llamarse `requiereReprocesoF0288`: el nombre viejo sugería crear un expediente técnico
   * nuevo, que es justo lo que dejó de hacerse.
   *
   * El estado de la incidencia se deduce de lo que la falla pedía, nunca de lo que habría sido
   * cómodo: una falla vieja que exigía volver a preparación queda «reproceso requerido», no
   * «lista para reintento», porque en esas fotos ese reproceso nunca se registró como tal. El
   * reproceso puede abrirse después desde Preparación técnica y así completar lo que falta.
   */
  private normalizarFalla(f: FallaF0302): FallaF0302 {
    const vieja = f as FallaF0302 & { requiereNuevaPreparacion?: boolean };
    const reproceso = f.requiereReprocesoF0288 ?? vieja.requiereNuevaPreparacion ?? false;
    return {
      ...f,
      requiereReprocesoF0288: reproceso,
      sugerencia: f.sugerencia ?? this.matrizFalla(f.tipo).sugerencia,
      justificacionReproceso: f.justificacionReproceso ?? '',
      detalle: f.detalle ?? {},
      estadoIncidencia: f.estadoIncidencia ?? (reproceso
        ? 'REPROCESO_F0288_REQUERIDO'
        : f.requiereHardware ? 'PENDIENTE_REVISION_HARDWARE' : 'PENDIENTE_CORRECCION_SOPORTE')
    };
  }

  /** El «Agente DLP» (antes «Solución DLP») es el ítem del F0302 con captura de evidencia obligatoria. */
  private esAgenteDLP(nombre: string): boolean {
    return /^(agente|soluci[óo]n) dlp/i.test((nombre ?? '').trim());
  }

  /** El ítem de ingreso al dominio institucional del checklist F0302. */
  private esIngresoDominio(nombre: string): boolean {
    return /^ingreso a dominio/i.test((nombre ?? '').trim());
  }

  /**
   * Ítems del F0302 que admiten «No aplica»: el Agente DLP y el Ingreso a dominio. Son los dos
   * que pueden no corresponder a un equipo concreto —uno aislado de la red, uno en revisión— y
   * obligarlos a marcarse como hechos sería pedirle al técnico que registre algo falso. El resto
   * del checklist no admite ese estado: o se hizo o está pendiente.
   */
  admiteNoAplicaF0302(nombre: string): boolean {
    return this.esAgenteDLP(nombre) || this.esIngresoDominio(nombre);
  }

  /**
   * Controles especiales del F0302: cada uno se decide de a uno porque su estado arrastra una
   * obligación distinta —imagen si está realizado, justificación si no aplica—. Ninguna acción en
   * bloque los toca: marcarlos de un plumazo produciría exactamente el registro falso que las
   * reglas de evidencia y justificación existen para evitar.
   *
   * Hoy coinciden con los que admiten «No aplica», pero son dos ideas distintas: una dice qué
   * estados acepta el ítem y esta dice que no se decide en grupo.
   */
  esControlEspecialF0302(nombre: string): boolean {
    return this.esAgenteDLP(nombre) || this.esIngresoDominio(nombre);
  }

  /**
   * El ítem de credenciales que el F0302 arrastraba en el checklist. No es una actividad técnica
   * que el técnico ejecute y marque: el nombre de equipo y la cuenta de red vienen de SISSOR y son
   * referencia para configurar. Puesto como casilla junto al Agente DLP y al dominio parecía una
   * tarea más, y su «Pendiente» bloqueaba el cierre sin que hubiera nada que hacer.
   */
  private esCredencialesSISSOR(nombre: string): boolean {
    return /^credenciales\s*:/i.test((nombre ?? '').trim());
  }

  /** Mensaje de la justificación que falta, con el nombre del ítem que la exige. */
  mensajeJustificacionNoAplica(nombre: string): string {
    if (this.esAgenteDLP(nombre)) {
      return 'Debe justificar por qué no aplica la instalación o validación del Agente DLP.';
    }
    if (this.esIngresoDominio(nombre)) {
      return 'Debe justificar por qué no aplica el ingreso del equipo al dominio.';
    }
    return `Debe justificar por qué no aplica ${nombre}.`;
  }

  /**
   * Ejemplos de motivo, para que el técnico no tenga que inventar la redacción. Son sugerencias
   * visibles, no opciones: ninguna se selecciona sola, porque la justificación tiene que ser una
   * afirmación de quien configura, no un valor por omisión del sistema.
   */
  justificacionesSugeridasF0302(nombre: string): string[] {
    if (this.esAgenteDLP(nombre)) {
      return [
        'Equipo no requiere agente DLP por condición especial autorizada.',
        'Equipo en revisión temporal.',
        'Equipo no será conectado a red institucional.',
        'Excepción indicada por Encargado de Soporte.',
        'Otro motivo justificado.'
      ];
    }
    if (this.esIngresoDominio(nombre)) {
      return [
        'Equipo no será unido al dominio por uso temporal.',
        'Equipo destinado a ambiente aislado.',
        'Equipo en revisión o prueba.',
        'Excepción autorizada por Encargado de Soporte.',
        'Otro motivo justificado.'
      ];
    }
    return [];
  }

  /** Ítems marcados «No aplica» que todavía no tienen motivo escrito. */
  itemsNoAplicaSinJustificar(c: ConfiguracionF0302): SoftwareF0302[] {
    return this.softwareChecklistF0302(c)
      .filter((s) => s.estado === 'No aplica' && !(s.justificacionNoAplica ?? '').trim());
  }

  /** Ítems del F0302 que quedaron fuera con su motivo, para el documento y el historial. */
  itemsNoAplicaF0302(c: ConfiguracionF0302): SoftwareF0302[] {
    return this.softwareChecklistF0302(c).filter((s) => s.estado === 'No aplica');
  }

  /**
   * Guarda el motivo del «No aplica» de un ítem del F0302. El texto lo escribe el técnico: el
   * sistema ofrece ejemplos, pero no rellena ninguno.
   */
  justificarNoAplicaF0302(id: string, nombre: string, justificacion: string, usuario: string): string | null {
    const c = this.configuracionDe(id);
    if (!c) return 'No se encontró la configuración indicada.';
    if (c.estado === 'Completada') return 'La configuración ya está finalizada: el checklist no admite cambios.';
    const item = this.softwareChecklistF0302(c).find((s) => s.nombre === nombre);
    if (!item) return 'No se encontró el ítem indicado en el checklist.';
    if (item.estado !== 'No aplica') return 'El ítem no está marcado como «No aplica».';
    const texto = justificacion.trim();
    if (!texto) return this.mensajeJustificacionNoAplica(nombre);

    this.actualizarConfiguracionActiva(id, (x) => ({
      ...x, software: x.software.map((s) => (s.nombre === nombre
        ? { ...s, justificacionNoAplica: texto, noAplicaPor: usuario, fechaNoAplica: this.selloAhora() }
        : s))
    }));
    this.registrarEvento(id, usuario, `Justificación de «No aplica» registrada para ${nombre}`, 'No aplica',
      texto, false, this.refItemF0302(id, nombre, 'No aplica', texto));
    return null;
  }

  /** Referencia común de los eventos de un ítem del checklist F0302. */
  private refItemF0302(id: string, nombre: string, estado: string, justificacion = ''): Partial<EventoTrazabilidad> {
    const c = this.configuracionDe(id);
    return {
      modulo: 'Configuración F0302', inventario: c?.datos.inventario,
      expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico,
      nombreEquipo: c?.datos.nombrePC, rol: this.rolConectado(),
      itemChecklist: nombre, estadoItem: estado,
      justificacion: justificacion || undefined,
      evidencia: c?.software.find((s) => s.nombre === nombre)?.evidencia ?? undefined
    };
  }

  /** Deja constancia de que se abrió/consultó la pantalla «Catálogo de software» (una vez por visita, no por render). */
  registrarConsultaCatalogoSoftware(usuario: string): void {
    this.registrarEvento('CATALOGO-SOFTWARE', usuario, 'Catálogo de software consultado', 'Consultado',
      `${this.catalogoSoftware().length} software(s) en el catálogo.`, false, { modulo: 'Catálogo de software' });
  }

  /**
   * Valida los datos de un software del catálogo antes de agregarlo o editarlo. `codigoOriginal`
   * es el código del registro que se está editando (para no chocar consigo mismo en la
   * verificación de unicidad); en alta es `null`.
   */
  private validarSoftwareCatalogo(datos: SoftwareCatalogo, codigoOriginal: string | null): string | null {
    const codigo = datos.codigo.trim();
    if (!codigo) return 'El código del software es obligatorio.';
    if (!datos.nombre.trim()) return 'El nombre del software es obligatorio.';
    if (!datos.categoria.trim()) return 'La categoría es obligatoria.';
    if (this.catalogoSoftware().some((s) => s.codigo === codigo && s.codigo !== codigoOriginal)) {
      return `Ya existe un software con el código ${codigo} en el catálogo.`;
    }
    const versiones = datos.versionesPermitidas.map((v) => v.trim()).filter(Boolean);
    if (versiones.length === 0) return 'Registre al menos una versión permitida.';
    if (!datos.versionVigente.trim()) return 'La versión vigente es obligatoria.';
    if (!versiones.includes(datos.versionVigente.trim())) {
      return 'La versión vigente debe estar incluida en las versiones permitidas.';
    }
    if (!datos.etapa) return 'Indique la etapa del proceso en la que se usa el software.';
    if (datos.requiereLicencia && !datos.tipoLicencia) {
      return 'Indique el tipo de licencia: el software está marcado como que requiere licencia.';
    }
    return null;
  }

  /**
   * Limpia los campos de texto y deja el registro coherente: sin licencia no hay tipo de licencia,
   * y la última actualización se sella con la fecha/hora del movimiento.
   */
  private limpiarSoftwareCatalogo(datos: SoftwareCatalogo, codigo: string): SoftwareCatalogo {
    return {
      ...datos, codigo, nombre: datos.nombre.trim(), categoria: datos.categoria.trim(),
      descripcion: datos.descripcion.trim(),
      versionesPermitidas: datos.versionesPermitidas.map((v) => v.trim()).filter(Boolean),
      versionVigente: datos.versionVigente.trim(),
      tipoLicencia: datos.requiereLicencia ? datos.tipoLicencia : '',
      observacion: datos.observacion.trim(),
      ultimaActualizacion: `${this.hoy()} ${this.hora()}`
    };
  }

  /**
   * Agrega un software nuevo al catálogo. El código se autogenera si viene vacío (el formulario
   * no obliga a escribirlo). Devuelve null si se guardó, o el mensaje de la validación que falló.
   */
  agregarSoftwareCatalogo(datos: SoftwareCatalogo, usuario: string): string | null {
    const limpio = this.limpiarSoftwareCatalogo(datos, datos.codigo.trim() || this.siguienteCodigoSoftware());
    const error = this.validarSoftwareCatalogo(limpio, null);
    if (error) return error;
    this.catalogoSoftware.update((list) => [...list, limpio]);
    this.registrarEvento('CATALOGO-SOFTWARE', usuario, `Software agregado al catálogo: ${limpio.codigo} — ${limpio.nombre}`,
      limpio.activo ? 'Activo' : 'Inactivo',
      `Etapa: ${limpio.etapa}. ${limpio.observacion}`.trim(), false, { modulo: 'Catálogo de software' });
    return null;
  }

  /** Edita un software existente del catálogo (el código no se puede cambiar: es la clave usada por F0288/F0302). */
  editarSoftwareCatalogo(codigo: string, datos: Omit<SoftwareCatalogo, 'codigo'>, usuario: string): string | null {
    const limpio = this.limpiarSoftwareCatalogo({ ...datos, codigo }, codigo);
    const error = this.validarSoftwareCatalogo(limpio, codigo);
    if (error) return error;
    this.catalogoSoftware.update((list) => list.map((s) => (s.codigo === codigo ? limpio : s)));
    this.registrarEvento('CATALOGO-SOFTWARE', usuario, `Software editado en el catálogo: ${codigo} — ${limpio.nombre}`,
      limpio.activo ? 'Activo' : 'Inactivo',
      `Etapa: ${limpio.etapa}. ${limpio.observacion}`.trim(), false, { modulo: 'Catálogo de software' });
    return null;
  }

  /**
   * Activa o desactiva un software del catálogo. Un software inactivo deja de ofrecerse para
   * NUEVAS selecciones (`softwareAplicable` ya filtra por `activo`), pero no borra ni afecta
   * las selecciones ya guardadas en F0288/F0302 anteriores: esos registros son una copia propia
   * (código, nombre, versión, categoría), no una referencia viva al catálogo.
   */
  cambiarEstadoSoftwareCatalogo(codigo: string, activo: boolean, usuario: string): void {
    const sello = `${this.hoy()} ${this.hora()}`;
    this.catalogoSoftware.update((list) =>
      list.map((s) => (s.codigo === codigo ? { ...s, activo, ultimaActualizacion: sello } : s)));
    this.registrarEvento('CATALOGO-SOFTWARE', usuario,
      `Software ${activo ? 'activado' : 'desactivado'} en el catálogo: ${codigo}`,
      activo ? 'Activo' : 'Inactivo', '', false, { modulo: 'Catálogo de software' });
  }

  /**
   * Consulta el número de inventario en la base institucional simulada: valida el formato,
   * deduce el tipo de equipo, busca la ficha y avisa si el equipo ya está en el Inventario de
   * Hardware. Nunca devuelve datos inventados: en «No encontrado» y «Formato inválido» la ficha
   * queda vacía. Deja la consulta y su resultado en la trazabilidad del equipo.
   */
  consultarBaseInstitucional(inventario: string, usuario: string): ConsultaInventario {
    const inv = inventario.trim();
    const tipo = this.tipoPorNumeroInventario(inv);
    const etiqueta = tipo === 'Desktop' ? 'CPU / Desktop' : tipo === 'Laptop' ? 'Laptop' : 'Tipo no identificado';

    if (!inv) {
      return { resultado: 'Formato inválido', inventario: inv, mensaje: 'Escriba el número de inventario que desea consultar.' };
    }
    if (!tipo) {
      // El formato inválido no se registra contra un equipo: no hay número de inventario real al que asociarlo.
      return {
        resultado: 'Formato inválido', inventario: inv,
        mensaje: 'El número de inventario no cumple con el formato esperado. Para CPU use: 2201-00-101-xxxx. Para Laptop use: 2201-00-920-xxxx.'
      };
    }

    this.registrarEvento(inv, usuario, `Consulta de inventario realizada para el número ${inv}`, 'Consulta realizada',
      `Tipo identificado por el número de inventario: ${etiqueta}.`, false,
      { modulo: 'Inventario de Hardware', estadoAnterior: 'Fuera de inventario', inventario: inv });

    const ficha = this.fichaInstitucional(inv);
    if (!ficha) {
      this.registrarEvento(inv, usuario, `Equipo no encontrado en base institucional simulada (${inv})`, 'No encontrado',
        `Resultado de la consulta: no encontrado · ${etiqueta}. No se autocompletó ningún dato.`, false,
        { modulo: 'Inventario de Hardware', estadoAnterior: 'Fuera de inventario', inventario: inv });
      return {
        resultado: 'No encontrado', inventario: inv,
        mensaje: 'No se encontró información para este número de inventario en la base institucional simulada. Verifique el número ingresado.'
      };
    }

    this.registrarEvento(inv, usuario, `Equipo consultado en base institucional simulada (${inv})`, 'Encontrado',
      `Resultado de la consulta: encontrado · ${etiqueta} ${ficha.marca} ${ficha.modelo}, serie ${ficha.serie}.` +
        (ficha.fechaAdquisicion ? ` Adquirido el ${ficha.fechaAdquisicion}${ficha.proveedor ? ` a ${ficha.proveedor}` : ''}.` : ''),
      false,
      { modulo: 'Inventario de Hardware', estadoAnterior: 'Fuera de inventario', inventario: inv,
        fechaAdquisicion: ficha.fechaAdquisicion, tipoGarantia: ficha.tipoGarantiaSugerida });

    if (this.equipoDe(inv)) {
      return {
        resultado: 'Ya registrado', inventario: inv, equipo: ficha,
        mensaje: 'Este equipo ya se encuentra registrado en el Inventario de Hardware.'
      };
    }
    return { resultado: 'Encontrado', inventario: inv, equipo: ficha, mensaje: 'Equipo encontrado en la base institucional simulada.' };
  }

  /**
   * Ingresa al Inventario de Hardware un equipo con los datos que trajo la consulta institucional.
   * Reutiliza `agregarEquipo` (misma validación de duplicados y mismos estados iniciales) y añade
   * el origen del dato y el evento de autocompletado. Devuelve null si se registró, o el mensaje
   * de la validación que falló.
   */
  ingresarDesdeCatalogo(ficha: EquipoCatalogoInstitucional, usuario: string, observaciones = ''): string | null {
    const error = this.agregarEquipo({
      inventario: ficha.inventario,
      serie: ficha.serie,
      marca: ficha.marca,
      modelo: ficha.modelo,
      tipo: ficha.tipo,
      condicion: ficha.estadoFisicoInicial,
      procesador: ficha.procesador,
      ram: ficha.ram,
      disco: ficha.almacenamiento,
      sistemaOperativo: ficha.sistemaOperativo,
      observaciones: observaciones.trim() || ficha.observacionRegistro,
      origenDato: 'Base institucional simulada',
      ultimaActualizacion: ficha.ultimaActualizacion,
      // La fecha de adquisición viaja con el equipo desde el registro institucional: es de donde
      // arrancará su garantía de proveedor. Si la ficha no la trae, no se sustituye por la del
      // ingreso —son fechas distintas— y queda pendiente de que el Encargado la registre.
      fechaAdquisicion: ficha.fechaAdquisicion,
      fechaRecepcionInstitucional: ficha.fechaRecepcion,
      proveedor: ficha.proveedor
    }, usuario);
    if (error) return error;
    this.registrarEvento(ficha.inventario, usuario,
      `Datos autocompletados desde base institucional simulada para el equipo ${ficha.inventario}`,
      'Pendiente de preparación',
      `${ficha.tipo === 'Desktop' ? 'CPU / Desktop' : 'Laptop'} ${ficha.marca} ${ficha.modelo} · serie ${ficha.serie} · ${ficha.procesador} · ${ficha.ram} · ${ficha.almacenamiento}. Dato institucional actualizado al ${ficha.ultimaActualizacion}; no se tecleó ningún campo a mano.`,
      false,
      { modulo: 'Inventario de Hardware', estadoAnterior: 'Fuera de inventario', inventario: ficha.inventario });
    if (ficha.fechaAdquisicion) {
      this.registrarEvento(ficha.inventario, usuario,
        `Fecha de adquisición obtenida desde base institucional (${ficha.fechaAdquisicion})`,
        'Pendiente de preparación',
        `Proveedor: ${ficha.proveedor || 'no consta'}. Es la fecha desde la que corre la garantía del proveedor; no la sustituye la fecha de ingreso al inventario.`,
        false, { modulo: 'Inventario de Hardware', inventario: ficha.inventario,
          fechaAdquisicion: ficha.fechaAdquisicion, tipoGarantia: ficha.tipoGarantiaSugerida });
      const inicio = ficha.inicioGarantiaProveedor || ficha.fechaAdquisicion;
      const fin = ficha.vencimientoGarantiaProveedor
        || this.sumarAnios(ficha.fechaAdquisicion, this.ANIOS_GARANTIA_PROVEEDOR);
      const agotada = this.garantiaProveedorAgotada(ficha.fechaAdquisicion);
      this.registrarEvento(ficha.inventario, usuario,
        `Garantía de proveedor calculada desde fecha de adquisición (${inicio} → ${fin})`,
        agotada ? 'Garantía de proveedor vencida' : 'Garantía de proveedor vigente',
        `${ficha.duracionGarantiaProveedor || `${this.ANIOS_GARANTIA_PROVEEDOR} años`} desde la adquisición.` +
          (agotada ? ' Ya vencida: el equipo requiere responsabilidad interna de Soporte.' : ''),
        false, { modulo: 'Inventario de Hardware', inventario: ficha.inventario,
          fechaAdquisicion: ficha.fechaAdquisicion, tipoGarantia: ficha.tipoGarantiaSugerida,
          inicioNuevo: inicio, vencimientoNuevo: fin });
    } else if (ficha.estadoFisicoInicial === 'Nuevo') {
      // No debería ocurrir: la base institucional trae la fecha de todo equipo nuevo. Si pasa, es
      // un error del dato de origen y así se nombra.
      this.registrarEvento(ficha.inventario, usuario,
        'Base institucional sin fecha de adquisición para un equipo nuevo',
        'Pendiente de corrección de datos institucionales',
        this.MSG_DATOS_INSTITUCIONALES, false,
        { modulo: 'Inventario de Hardware', inventario: ficha.inventario });
    }
    return null;
  }

  /**
   * Ingresa un equipo nuevo al Inventario de Hardware (solo Encargados o Administrador).
   * El equipo queda Pendiente de preparación, No asignado y sin Expediente técnico: esos
   * estados se derivan solos porque el equipo aún no tiene expediente ni asignación.
   * Devuelve null si se registró, o el mensaje de la validación que falló.
   */
  agregarEquipo(datos: Omit<Equipo, 'expediente'>, usuario: string): string | null {
    const inventario = datos.inventario.trim();
    if (!inventario) return 'Registre el número de inventario del equipo.';
    if (this.equipoDe(inventario)) return `Ya existe un equipo con el número de inventario ${inventario}.`;
    // El ingreso guarda automáticamente fecha, hora y usuario conectado (con su rol).
    const nuevo: Equipo = {
      ...datos, inventario, expediente: '',
      fechaIngreso: this.hoy(), horaIngreso: this.hora(), ingresadoPor: usuario,
      // Sin origen explícito el equipo se cargó a mano: lo normal es que venga de la consulta
      // institucional (ver `ingresarDesdeCatalogo`), que sí lo informa.
      origenDato: datos.origenDato || 'Registro manual',
      ultimaActualizacion: datos.ultimaActualizacion || this.hoy()
    };
    this.equipos.update((list) => [nuevo, ...list]);
    // El ingreso al Inventario es también el Ingreso a Hardware #1 del equipo (historial de ingresos).
    const ingreso: IngresoHardware = {
      idIngresoHardware: `${inventario}-01`, inventario, numeroIngreso: 1,
      fechaIngreso: nuevo.fechaIngreso!, horaIngreso: nuevo.horaIngreso!, motivoIngreso: 'Preparación inicial',
      ingresadoPor: usuario, estadoInicial: 'Pendiente de preparación', estadoFinal: '', observaciones: ''
    };
    this.ingresosHardware.update((list) => [ingreso, ...list]);
    this.registrarEvento(inventario, usuario,
      `Equipo ${inventario} (${datos.marca} ${datos.modelo}) ingresado al Inventario de Hardware`,
      'Pendiente de preparación',
      `${datos.tipo === 'Desktop' ? 'CPU / Desktop' : 'Laptop'} ${datos.condicion.toLowerCase()} · queda pendiente de preparación, no asignado y sin Expediente técnico.`,
      true,
      { modulo: 'Inventario de Hardware', estadoAnterior: 'Fuera de inventario', inventario });
    return null;
  }

  /**
   * Valida una lista de números de inventario para el ingreso múltiple: por cada uno, deduce el
   * tipo, consulta la base institucional (reutilizando `consultarBaseInstitucional`, que ya deja
   * su propio rastro de trazabilidad por número) y marca si queda «Listo para ingresar». Los
   * números repetidos dentro del mismo listado se marcan «Ya registrado» a partir de la segunda
   * aparición. No ingresa nada todavía: solo arma la vista previa.
   */
  validarLoteInventario(numeros: string[], usuario: string, origen: 'listado' | 'rango' = 'listado'): FilaValidacionLote[] {
    const vistos = new Set<string>();
    const limpios = numeros.map((n) => n.trim()).filter(Boolean);
    this.registrarEvento('INGRESO-LOTE', usuario,
      origen === 'rango'
        ? `Ingreso por rango validado (${limpios.length} número(s))`
        : `Consulta múltiple de inventario realizada (${limpios.length} número(s))`,
      'Consulta múltiple realizada', limpios.join(', '), false, { modulo: 'Inventario de Hardware' });

    return limpios.map((inv): FilaValidacionLote => {
      if (vistos.has(inv)) {
        this.registrarEvento(inv, usuario, `Equipo omitido por duplicado dentro del listado (${inv})`,
          'Omitido por duplicado', '', false, { modulo: 'Inventario de Hardware', inventario: inv });
        return { inventario: inv, tipo: this.tipoPorNumeroInventario(inv), marca: '', modelo: '', serie: '', resultado: 'Ya registrado' };
      }
      vistos.add(inv);
      const c = this.consultarBaseInstitucional(inv, usuario);
      if (c.resultado === 'Formato inválido') {
        this.registrarEvento(inv, usuario, `Equipo omitido por formato inválido (${inv})`,
          'Omitido por formato inválido', '', false, { modulo: 'Inventario de Hardware', inventario: inv });
        return { inventario: inv, tipo: null, marca: '', modelo: '', serie: '', resultado: 'Formato inválido' };
      }
      if (c.resultado === 'No encontrado') {
        return { inventario: inv, tipo: this.tipoPorNumeroInventario(inv), marca: '', modelo: '', serie: '', resultado: 'No encontrado' };
      }
      const f = c.equipo!;
      if (c.resultado === 'Ya registrado') {
        return { inventario: inv, tipo: f.tipo, marca: f.marca, modelo: f.modelo, serie: f.serie, resultado: 'Ya registrado', ficha: f };
      }
      return { inventario: inv, tipo: f.tipo, marca: f.marca, modelo: f.modelo, serie: f.serie, resultado: 'Listo para ingresar', ficha: f };
    });
  }

  /**
   * Genera la lista de números de inventario de un rango (mismo tipo de equipo, correlativo
   * entre `desde` y `hasta`). Corrección: la validación anterior comparaba la longitud del
   * número contra 15 caracteres, pero un número válido tiene 16 (`2201-00-101-0001`), así que
   * la comparación fallaba siempre y la función devolvía una lista vacía sin importar el rango
   * — «el ingreso por rango no funciona». Ahora usa `tipoPorNumeroInventario` (el mismo
   * validador de formato que el resto del ingreso institucional) en vez de contar caracteres.
   */
  generarRangoInventario(desde: string, hasta: string): { numeros: string[]; error: string | null } {
    const d = desde.trim(); const h = hasta.trim();
    if (!d || !h) return { numeros: [], error: 'Indique los números "Desde" y "Hasta" del rango.' };
    const tipoD = this.tipoPorNumeroInventario(d);
    const tipoH = this.tipoPorNumeroInventario(h);
    if (!tipoD || !tipoH) {
      return { numeros: [], error: 'El rango no es válido. Use el formato 2201-00-101-xxxx (CPU) o 2201-00-920-xxxx (Laptop).' };
    }
    if (tipoD !== tipoH) {
      return { numeros: [], error: 'El rango no es válido. El número inicial y final deben pertenecer al mismo tipo de equipo.' };
    }
    const prefijo = d.slice(0, -4);
    const nD = parseInt(d.slice(-4), 10);
    const nH = parseInt(h.slice(-4), 10);
    if (nD > nH) return { numeros: [], error: 'El número final no puede ser menor que el inicial.' };
    const numeros: string[] = [];
    for (let n = nD; n <= nH && numeros.length < 200; n++) numeros.push(`${prefijo}${String(n).padStart(4, '0')}`);
    return { numeros, error: null };
  }

  /** Deja constancia en trazabilidad de que se generó un rango de números de inventario (antes de validarlos). */
  registrarRangoGenerado(desde: string, hasta: string, cantidad: number, usuario: string): void {
    this.registrarEvento('INGRESO-LOTE', usuario, `Ingreso por rango generado: ${desde} a ${hasta} (${cantidad} número(s))`,
      'Rango generado', '', false, { modulo: 'Inventario de Hardware' });
  }

  /** Ingresa solo las filas «Listo para ingresar» de un lote ya validado; reutiliza `ingresarDesdeCatalogo`. */
  ingresarLoteValido(filas: FilaValidacionLote[], usuario: string): { exitosos: number; errores: string[] } {
    let exitosos = 0;
    const errores: string[] = [];
    for (const f of filas) {
      if (f.resultado !== 'Listo para ingresar' || !f.ficha) continue;
      const err = this.ingresarDesdeCatalogo(f.ficha, usuario);
      if (err) errores.push(`${f.inventario}: ${err}`);
      else exitosos++;
    }
    return { exitosos, errores };
  }

  // ---------- Visibilidad por rol ----------
  // Encargados (y Administrador) ven catálogos globales dentro de sus módulos; el Encargado
  // de Hardware solo los de su área. Los Técnicos nunca ven catálogos globales: solo los
  // procesos que tienen asignados o donde participaron (activos, finalizados o cerrados).

  private claveConectada(): RolClave | '' {
    return this.auth.usuario()?.clave ?? '';
  }
  private nombreConectado(): string {
    return this.auth.usuario()?.nombre ?? '';
  }
  /** Rol del usuario conectado, tal como se muestra («Técnico de Soporte»). */
  rolConectado(): string {
    return this.auth.usuario()?.rol ?? '';
  }
  /** Usuario conectado en el formato «Nombre — Rol» con el que se guardan los responsables. */
  usuarioConectadoTexto(): string {
    const u = this.auth.usuario();
    return u ? `${u.nombre} — ${u.rol}` : '';
  }
  private esTecnicoConectado(): boolean {
    const c = this.claveConectada();
    return c === 'tec-soporte' || c === 'tec-hardware';
  }

  /** Un usuario participa en un proceso si figura como responsable en alguna de sus fases. */
  participaEnProceso(id: string, nombre = this.nombreConectado()): boolean {
    if (!nombre) return false;
    const textos: (string | undefined)[] = [];
    const a = this.asignacionDe(id);
    if (a) {
      textos.push(a.responsableAsignacion, a.responsablesFase.tecnicoPreparacion,
        a.responsablesFase.tecnicoConfiguracion, a.responsablesFase.responsableEntrega);
    }
    const t = this.expTecnicoDe(id);
    if (t) textos.push(t.creadoPor, t.tecnicoPreparacion);
    const c = this.configuracionDe(id);
    if (c) textos.push(c.tecnico, c.seleccionadoPor);
    const e = this.entregaDe(id);
    if (e) textos.push(e.tecnicoEntrega, e.tecnicoConfiguro, e.preparadoPor);
    const g = this.garantiaDe(id);
    if (g) g.casos.forEach((k) => textos.push(k.responsableAtencion));
    return textos.some((x) => !!x && x.includes(nombre));
  }

  /** F0288: los técnicos solo ven las preparaciones asignadas a ellos; Enc. de Hardware, las de su área. */
  preparacionesVisibles(): PreparacionF0288[] {
    if (this.esTecnicoConectado()) {
      const n = this.nombreConectado();
      return this.preparaciones().filter((p) => p.tecnico.includes(n));
    }
    if (this.claveConectada() === 'enc-hardware') {
      return this.preparaciones().filter((p) => p.unidad === 'Hardware');
    }
    return this.preparaciones();
  }

  /** Expedientes técnicos: técnicos solo donde participaron; Enc. de Hardware los de su área. */
  expedientesTecnicosVisibles(): ExpedienteTecnico[] {
    if (this.esTecnicoConectado()) {
      const n = this.nombreConectado();
      return this.expedientesTecnicos().filter((x) => x.tecnicoPreparacion.includes(n) || x.creadoPor.includes(n));
    }
    if (this.claveConectada() === 'enc-hardware') {
      return this.expedientesTecnicos().filter((x) => x.unidadResponsable === 'Hardware');
    }
    return this.expedientesTecnicos();
  }

  /** Todos los expedientes técnicos de un técnico (activos, preparados y cerrados). Se busca por
   *  nombre porque `tecnicoPreparacion` se guarda como «Nombre — Rol». */
  expedientesDeTecnico(nombreTecnico: string): ExpedienteTecnico[] {
    return this.expedientesTecnicos().filter((x) => x.tecnicoPreparacion.startsWith(nombreTecnico));
  }
  /**
   * Carga laboral de un técnico: expedientes técnicos activos (todo lo que no está `'Cerrado'`
   * — un expediente `'Cerrado'` es histórico, cerrado por un Descargo, y no cuenta).
   */
  expedientesActivosDeTecnico(nombreTecnico: string): ExpedienteTecnico[] {
    return this.expedientesDeTecnico(nombreTecnico).filter((x) => x.estado !== 'Cerrado');
  }
  /**
   * Clasificación de la carga laboral de un Técnico de **Hardware**. Cuenta los cuatro procesos
   * del área (`cargaHardwareDe`), no solo los expedientes técnicos: un técnico con dos expedientes
   * y cuatro reprocesos encima no está «con carga baja». Los procesos de Soporte no entran aquí
   * (§9); para esos está `cargaSoporteDe`.
   */
  cargaLaboral(nombreTecnico: string): NivelCarga {
    return this.cargaHardwareDe(nombreTecnico).nivel;
  }
  /**
   * Expedientes pendientes por preparar de un técnico: activos cuyo F0288 todavía no se ha
   * finalizado (`'Creado'` o `'En preparación'`; `'Preparado'` ya generó su F0288 y no cuenta).
   */
  expedientesPendientesPorPreparar(nombreTecnico: string): ExpedienteTecnico[] {
    return this.expedientesActivosDeTecnico(nombreTecnico).filter((x) => x.estado === 'Creado' || x.estado === 'En preparación');
  }
  /** Expedientes cuyo F0288 ya se finalizó (`'Preparado'`), incluidos los ya cerrados por un Descargo posterior. */
  expedientesFinalizadosDeTecnico(nombreTecnico: string): ExpedienteTecnico[] {
    return this.expedientesDeTecnico(nombreTecnico).filter((x) => x.estado === 'Preparado' || x.estado === 'Cerrado');
  }
  /** Fecha del expediente técnico más reciente asignado al técnico, si tiene alguno. */
  ultimaAsignacionTecnico(nombreTecnico: string): string | undefined {
    return this.expedientesDeTecnico(nombreTecnico).sort((a, b) => b.fecha.localeCompare(a.fecha))[0]?.fecha;
  }
  /**
   * Deja constancia en trazabilidad de una consulta al detalle completo de un técnico (modal
   * «Ver detalle»): se registra al abrir el modal, no en cada búsqueda o al pasar el mouse, para
   * no inundar la trazabilidad con consultas de solo lectura.
   */
  registrarConsultaTecnico(tecnico: UsuarioSistema, usuario: UsuarioSistema): void {
    // Un Técnico de Soporte se consulta con su propia carga: la de Hardware no describe su trabajo.
    if (tecnico.clave === 'tec-soporte') {
      this.registrarConsultaCargaSoporte(`${tecnico.nombre} — ${tecnico.rol}`, `${usuario.nombre} — ${usuario.rol}`);
      return;
    }
    const carga = this.cargaHardwareDe(tecnico.nombre);
    const pendientes = this.expedientesPendientesPorPreparar(tecnico.nombre).length;
    this.registrarEvento(`TECNICO-${tecnico.usuario}`, `${usuario.nombre} — ${usuario.rol}`,
      `Detalle de técnico consultado: ${tecnico.nombre}`, 'Consulta realizada',
      `Unidad: ${tecnico.unidad}. ${carga.carga} — ${carga.total} procesos activos. `
        + `${this.resumenCargaHardware(carga)}. Pendientes por preparar: ${pendientes}.`,
      false, { modulo: 'Expediente técnico', cargaLaboral: carga.carga, procesosActivos: carga.total,
        detalleCarga: this.resumenCargaHardware(carga) });
  }

  /** F0302: el Técnico de Soporte solo ve las configuraciones asignadas a él. */
  configuracionesVisibles(): ConfiguracionF0302[] {
    if (!this.esTecnicoConectado()) return this.configuraciones();
    const n = this.nombreConectado();
    return this.configuraciones().filter((c) => c.tecnico.includes(n));
  }

  /** Entregas: los técnicos solo ven aquellas donde participan como responsables. */
  entregasVisibles(): Entrega[] {
    if (!this.esTecnicoConectado()) return this.entregas();
    const n = this.nombreConectado();
    return this.entregas().filter((e) =>
      e.tecnicoEntrega.includes(n) || e.tecnicoConfiguro.includes(n) || e.preparadoPor.includes(n)
    );
  }

  /**
   * Expedientes únicos: Hardware (Encargado y Técnico) no gestiona ni visualiza el Expediente
   * único — ese módulo es exclusivo de Soporte. El Técnico de Soporte solo ve donde participa.
   */
  expedientesUnicosVisibles(): ExpedienteUnico[] {
    const clave = this.claveConectada();
    if (clave === 'tec-hardware' || clave === 'enc-hardware') return [];
    if (clave === 'tec-soporte') {
      const n = this.nombreConectado();
      return this.expedientesUnicos().filter((x) => this.participaEnProceso(x.expediente, n));
    }
    return this.expedientesUnicos();
  }

  /** Garantías: los técnicos solo ven las de procesos donde participaron. */
  garantiasVisibles(): Garantia[] {
    if (!this.esTecnicoConectado()) return this.garantias();
    const n = this.nombreConectado();
    return this.garantias().filter((g) => this.participaEnProceso(g.expediente, n));
  }

  /** Trazabilidad: los técnicos solo ven eventos propios o de procesos donde participaron. */
  eventosVisibles(): EventoTrazabilidad[] {
    if (!this.esTecnicoConectado()) return this.eventos();
    const n = this.nombreConectado();
    return this.eventos().filter((e) => e.usuario.includes(n) || this.participaEnProceso(e.expediente, n));
  }

  /**
   * Recorrido completo del equipo (solo Encargados y Administrador): reúne, en orden
   * cronológico, los eventos de su ingreso al Inventario de Hardware, su expediente técnico
   * (F0288) y su proceso de solicitud (asignación, expediente único, F0302, entrega,
   * garantía y casos). Si el ingreso no quedó en la bitácora, se reconstruye desde los
   * datos de ingreso guardados en el propio equipo.
   */
  lineaTiempoEquipo(inventario: string): EventoTrazabilidad[] {
    const eq = this.equipoDe(inventario);
    if (!eq) return [];
    const ids = new Set<string>(
      [inventario, this.expTecnicoDeEquipo(inventario)?.codigo,
       this.asignacionDeEquipo(inventario)?.expediente, eq.expediente].filter((x): x is string => !!x)
    );
    const linea = this.eventos().filter((e) => ids.has(e.expediente) || e.inventario === inventario);
    if (eq.fechaIngreso && !linea.some((e) => e.modulo === 'Inventario de Hardware')) {
      linea.push({
        expediente: inventario,
        fecha: eq.fechaIngreso,
        hora: eq.horaIngreso ?? '',
        usuario: eq.ingresadoPor ?? '—',
        accion: `Equipo ${inventario} (${eq.marca} ${eq.modelo}) ingresado al Inventario de Hardware`,
        estado: 'Pendiente de preparación',
        observacion: `${eq.tipo === 'Desktop' ? 'CPU / Desktop' : 'Laptop'} ${eq.condicion.toLowerCase()} · estado inicial: pendiente de preparación, no asignado y sin Expediente técnico.`,
        hito: true,
        modulo: 'Inventario de Hardware',
        estadoAnterior: 'Fuera de inventario',
        inventario
      });
    }
    return linea.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  }

  /**
   * Equipos cuyo recorrido completo puede consultar el usuario conectado: los Encargados
   * ven la línea de tiempo desde el ingreso hasta la garantía (el de Hardware, dentro de
   * los procesos de su área). Los técnicos no usan esta vista: su trazabilidad se limita
   * a los procesos donde participan.
   */
  equiposConRecorrido(): Equipo[] {
    if (this.esTecnicoConectado()) return [];
    if (this.claveConectada() === 'enc-hardware') {
      // Sin expediente técnico, el equipo aún no pertenece a un área: sigue visible para
      // el Encargado de Hardware, que administra el Inventario de Hardware.
      return this.equipos().filter((e) => {
        const tec = this.expTecnicoDeEquipo(e.inventario);
        return !tec || tec.unidadResponsable === 'Hardware';
      });
    }
    return this.equipos();
  }

  /** Unidad del usuario conectado según su rol (los técnicos y encargados pertenecen a una unidad). */
  private unidadConectada(): 'Soporte' | 'Hardware' | '' {
    const c = this.claveConectada();
    if (c === 'enc-soporte' || c === 'tec-soporte') return 'Soporte';
    if (c === 'enc-hardware' || c === 'tec-hardware') return 'Hardware';
    return '';
  }

  /**
   * El documento F0288 solo se puede ver/descargar si el usuario conectado participó en la
   * preparación técnica (técnico que preparó o encargado que creó el expediente) o si la
   * preparación la realizó su unidad. Si Soporte no preparó, Soporte no ve ese F0288.
   */
  puedeVerF0288(codigoTec: string): boolean {
    const u = this.auth.usuario();
    if (!u) return false;
    if (u.clave === 'admin') return true;
    const tec = this.expedientesTecnicos().find((x) => x.codigo === codigoTec);
    if (!tec) return false;
    const participo = tec.tecnicoPreparacion.includes(u.nombre) || tec.creadoPor.includes(u.nombre);
    if (this.esTecnicoConectado()) return participo;
    return participo || tec.unidadResponsable === this.unidadConectada();
  }

  /** Igual que `puedeVerF0288`, pero partiendo del proceso (solicitud) del Expediente único. */
  puedeVerF0288DeProceso(id: string): boolean {
    const tec = this.expTecnicoDe(id);
    return !!tec && this.puedeVerF0288(tec.codigo);
  }

  // ---------- Utilidades ----------
  /**
   * Fecha de HOY en zona horaria LOCAL (YYYY-MM-DD). Debe ser local para que coincida con
   * `horaCrono()`/`hora()` (que usan la hora local): los cronómetros recombinan
   * `fechaInicio + horaInicio` y, si la fecha fuera UTC, en horario vespertino (p. ej. UTC-6)
   * la fecha UTC ya es del día siguiente y el inicio quedaría en el futuro → el cronómetro se
   * congelaba en 00:00:00. Usar la fecha local mantiene todo consistente.
   */
  private hoy(): string {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  private anioActual(): number {
    return new Date().getFullYear();
  }
  /**
   * Codificación dinámica por año: toma el correlativo más alto de los códigos que ya
   * pertenecen al año del prefijo y suma 1. Como el prefijo incluye el año, el correlativo
   * se reinicia automáticamente cada año y los códigos de años anteriores no se mezclan.
   */
  private siguienteCodigoPorAnio(prefijo: string, codigos: string[]): string {
    const nums = codigos
      .filter((c) => c.startsWith(prefijo))
      .map((c) => parseInt(c.slice(prefijo.length), 10))
      .filter((n) => !isNaN(n));
    return `${prefijo}${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
  }
  /** Fecha y hora de ahora, para sellar en pantalla algo que todavía no se ha guardado. */
  selloAhora(): string {
    return `${this.hoy()} ${this.hora().slice(0, 5)}`;
  }

  private hora(): string {
    return new Date().toTimeString().slice(0, 5);
  }
  /** Hora con segundos, usada por los cronómetros F0288/F0302. */
  private horaCrono(): string {
    return new Date().toTimeString().slice(0, 8);
  }
  /** Formatea minutos como texto legible: «01 h 25 min», «45 min» o «menos de 1 min». */
  formatoDuracion(min: number | null | undefined): string {
    if (min === null || min === undefined) return '';
    if (min < 1) return 'menos de 1 min';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${String(h).padStart(2, '0')} h ${String(m).padStart(2, '0')} min` : `${m} min`;
  }
  /** Minutos transcurridos desde el inicio de un cronómetro aún en curso. */
  minutosTranscurridos(c: Cronometro): number {
    const inicio = new Date(`${c.fechaInicio}T${c.horaInicio}`).getTime();
    return isNaN(inicio) ? 0 : Math.max(0, Math.floor((Date.now() - inicio) / 60000));
  }
  private hash(): string {
    const h = () => Math.random().toString(16).slice(2, 6);
    return `${h()}…${h()}`;
  }

  /**
   * Registra un evento de trazabilidad con fecha, hora y usuario (con su rol). `detalle`
   * agrega el módulo, el estado anterior y las referencias del evento (inventario,
   * expediente técnico, expediente único, usuario final) cuando aplican.
   */
  registrarEvento(expediente: string, usuario: string, accion: string, estado: string, observacion = '', hito = false,
    detalle: Partial<EventoTrazabilidad> = {}): void {
    this.eventos.update((list) => [
      ...list,
      { expediente, fecha: this.hoy(), hora: this.hora(), usuario, accion, estado, observacion, hito, ...detalle }
    ]);
  }

  private setEstadoSolicitud(id: string, estado: string, pendiente?: string): void {
    this.solicitudes.update((list) =>
      list.map((s) => (s.expediente === id ? { ...s, estado, pendiente: pendiente ?? s.pendiente, diasEnFase: 0 } : s))
    );
  }

  // ---------- Asignación de equipo ----------
  /**
   * Asigna al usuario final un equipo preparado del Inventario de Hardware.
   * Solo procede si el equipo tiene expediente técnico y su F0288 está finalizado.
   * Devuelve null si la asignación se registró, o el mensaje de la validación que falló.
   */
  asignarEquipo(id: string, inventario: string, responsable: string, observacion: string, decideDireccion: boolean): string | null {
    const s = this.solicitud(id);
    const eq = this.equipoDe(inventario);
    if (!s || !eq) return 'Verifique la solicitud y el equipo seleccionados.';
    const tec = this.expTecnicoDeEquipo(inventario);
    if (!tec) return 'No se puede asignar este equipo porque no cuenta con Expediente técnico completado.';
    if (this.estadoPreparacionEquipo(inventario) !== 'Preparado') {
      return 'No se puede asignar este equipo porque aún no ha finalizado la Preparación técnica F0288.';
    }
    if (this.asignacionDeEquipo(inventario)) return 'Este equipo ya está asignado a otro usuario final.';

    // El equipo preparado queda vinculado a la solicitud.
    this.solicitudes.update((list) =>
      list.map((x) => (x.expediente === id ? { ...x, equipoInventario: inventario } : x))
    );
    this.equipos.update((list) =>
      list.map((e) => (e.inventario === inventario ? { ...e, expediente: id } : e))
    );

    const nueva: Asignacion = {
      expediente: id,
      equipoInventario: inventario,
      usuarioFinal: `${s.destinatario} — ${s.unidadDestino}`,
      tipoEquipo: eq.tipo,
      condicion: eq.condicion,
      responsableAsignacion: responsable,
      decideDireccion,
      fecha: this.hoy(),
      estado: 'Vigente',
      observacion,
      vigente: true,
      responsablesFase: {
        expedienteTecnico: tec.codigo,
        unidadPreparacion: tec.unidadResponsable,
        tecnicoPreparacion: tec.tecnicoPreparacion,
        estadoPreparacion: 'Completada',
        unidadConfiguracion: 'Soporte',
        tecnicoConfiguracion: 'Por asignar',
        estadoConfiguracion: 'Pendiente',
        responsableEntrega: 'Por asignar',
        estadoEntrega: 'Pendiente',
        observaciones: ''
      }
    };
    this.asignaciones.update((list) => [nueva, ...list]);
    this.setEstadoSolicitud(id, 'Asignada', 'Crear Expediente único y continuar a configuración');
    this.registrarEvento(id, responsable, `Equipo ${inventario} (preparado) asignado al usuario final`, 'Asignada', observacion, true,
      { modulo: 'Asignación de equipo', estadoAnterior: 'No asignado', inventario, expedienteTecnico: tec.codigo, usuarioFinal: nueva.usuarioFinal });
    return null;
  }

  // ---------- Modificación de una asignación ya registrada ----------
  /** Solo los Encargados y el Administrador corrigen asignaciones; los técnicos consultan. */
  puedeModificarAsignaciones(): boolean {
    const c = this.claveConectada();
    return c === 'enc-soporte' || c === 'enc-hardware' || c === 'admin';
  }

  /** true si alguna Configuración F0302 del proceso ya arrancó, se completó o quedó con falla. */
  configuracionIniciada(id: string): boolean {
    return this.configuraciones().some((c) => c.expediente === id &&
      (!!c.cronometro?.horaInicio || c.estado === 'Completada' || c.estado === 'Con falla'));
  }

  /**
   * Hasta dónde se puede corregir una asignación ya hecha. La regla no es el permiso sino **cuánto
   * proceso hay encima**: el corte está en el Expediente único. Mientras el equipo es solo un dato
   * de la asignación, se corrige; en cuanto el expediente existe, ese equipo pasa a ser la base del
   * F0302, de sus evidencias y de sus firmas, y cambiarlo dejaría todo eso apuntando a otro equipo.
   */
  casoModificacionAsignacion(id: string): {
    caso: 'Modificable' | 'Con Expediente único' | 'Configuración iniciada' | 'Conformidad enviada';
    permiteCambioEquipo: boolean; aviso: string;
  } {
    if (this.conformidadDeProceso(id)) {
      return {
        caso: 'Conformidad enviada', permiteCambioEquipo: false,
        aviso: 'Esta asignación ya fue enviada a conformidad o aceptada por el usuario final. No puede modificarse directamente desde Asignación de Equipo.'
      };
    }
    if (this.configuracionIniciada(id)) {
      return {
        caso: 'Configuración iniciada', permiteCambioEquipo: false,
        aviso: 'Esta asignación ya tiene configuración F0302 iniciada. No puede modificarse directamente. Debe gestionarse mediante corrección, reproceso, anulación controlada o nuevo flujo según corresponda.'
      };
    }
    if (this.expedienteUnicoDe(id)) {
      return {
        caso: 'Con Expediente único', permiteCambioEquipo: false,
        aviso: 'Esta asignación ya tiene Expediente único creado y no puede modificarse desde Asignación de Equipo. Debe gestionarse desde el flujo correspondiente del expediente.'
      };
    }
    return { caso: 'Modificable', permiteCambioEquipo: true, aviso: '' };
  }

  /**
   * Cambia el equipo de una asignación ya registrada. **No sobrescribe**: apila la corrección en
   * el historial de la asignación con el equipo anterior, el nuevo y el motivo, libera el equipo
   * anterior y arrastra el cambio a lo que ya dependía de él (solicitud, expediente único y la
   * configuración F0302 todavía sin iniciar).
   */
  modificarAsignacion(id: string, nuevoInventario: string, motivo: string, observacion: string,
    usuario: string, rol = ''): string | null {
    if (!this.puedeModificarAsignaciones()) {
      return 'Solo un Encargado o el Administrador puede modificar una asignación.';
    }
    const asig = this.asignacionDe(id);
    if (!asig?.vigente) return 'Este requerimiento no tiene una asignación vigente que modificar.';
    if (!motivo.trim()) return 'Debe justificar el motivo de la modificación de la asignación.';
    // El corte vuelve a comprobarse aquí y no solo en la lista: una pantalla que no ofrece el botón
    // no es una regla, y a esta función se puede llegar con el caso ya avanzado.
    const caso = this.casoModificacionAsignacion(id);
    if (!caso.permiteCambioEquipo) return caso.aviso;
    const anterior = asig.equipoInventario;
    if (nuevoInventario === anterior) return 'El equipo seleccionado es el mismo que ya estaba asignado.';
    const eq = this.equipoDe(nuevoInventario);
    const s = this.solicitud(id);
    if (!eq || !s) return 'Verifique el requerimiento y el equipo seleccionados.';
    if (eq.tipo !== s.tipoEquipo) {
      return `El requerimiento pide ${this.tipoRequerimientoTexto(s)} y el equipo seleccionado es de otro tipo.`;
    }
    // El equipo nuevo pasa por el mismo filtro que una asignación nueva: preparado, con F0288
    // firmado, libre y sin trabajo abierto.
    if (!this.equiposParaAsignar().some((x) => x.inventario === nuevoInventario)) {
      return 'El equipo seleccionado no está disponible para asignación: revise su preparación, su F0288 o si ya tiene trabajo abierto.';
    }
    const tec = this.expTecnicoDeEquipo(nuevoInventario)!;
    const estadoAnterior = s.estado;

    // El equipo anterior queda libre; el nuevo toma su lugar.
    this.equipos.update((list) => list.map((e) =>
      e.inventario === anterior ? { ...e, expediente: '' }
        : e.inventario === nuevoInventario ? { ...e, expediente: id } : e));
    this.solicitudes.update((list) =>
      list.map((x) => (x.expediente === id ? { ...x, equipoInventario: nuevoInventario } : x)));

    const modificacion: ModificacionAsignacion = {
      fecha: this.hoy(), hora: this.hora(), equipoAnterior: anterior, equipoNuevo: nuevoInventario,
      usuarioFinal: asig.usuarioFinal, motivo: motivo.trim(), observacion: observacion.trim(),
      encargado: usuario, rol, estadoAnterior, estadoNuevo: s.estado, soloObservacion: false
    };
    this.asignaciones.update((list) => list.map((a) => (a.expediente === id
      ? {
          ...a, equipoInventario: nuevoInventario, tipoEquipo: eq.tipo, condicion: eq.condicion,
          observacion: observacion.trim() || a.observacion,
          responsablesFase: {
            ...a.responsablesFase, expedienteTecnico: tec.codigo,
            unidadPreparacion: tec.unidadResponsable, tecnicoPreparacion: tec.tecnicoPreparacion
          },
          modificaciones: [...(a.modificaciones ?? []), modificacion]
        }
      : a)));

    // No hay Expediente único ni Configuración F0302 que arrastrar: la corrección solo se permite
    // antes de que existan, justamente para no tener que reescribir lo que ya se armó sobre ellos.
    const ref = {
      modulo: 'Asignación de equipo', inventario: nuevoInventario, expedienteTecnico: tec.codigo,
      usuarioFinal: asig.usuarioFinal, rol, equipoAnterior: anterior,
      equipoNuevo: nuevoInventario, motivo: motivo.trim()
    };
    this.registrarEvento(id, usuario, 'Asignación modificada por Encargado', 'Asignación corregida',
      `Equipo anterior ${anterior} → equipo nuevo ${nuevoInventario}. Motivo: ${motivo.trim()}` +
        (observacion.trim() ? ` Observación: ${observacion.trim()}` : ''), true,
      { ...ref, estadoAnterior });
    this.registrarEvento(id, usuario, 'Equipo anterior liberado', 'Disponible para asignación',
      `${anterior} queda disponible para asignación: no tenía configuración iniciada.`, false,
      { ...ref, inventario: anterior, estadoAnterior: 'Asignado' });
    this.registrarEvento(id, usuario, 'Nuevo equipo asociado al requerimiento', 'Asignada',
      `${nuevoInventario} · ${eq.marca} ${eq.modelo} · Expediente técnico ${tec.codigo}.`, true,
      { ...ref, estadoAnterior: 'No asignado' });
    return null;
  }

  /**
   * Observación administrativa sobre una asignación que ya no admite cambiar el equipo. No altera
   * el proceso: deja dicho en el expediente qué se observó y quién lo observó.
   */
  registrarObservacionAsignacion(id: string, texto: string, usuario: string, rol = ''): string | null {
    if (!this.puedeModificarAsignaciones()) {
      return 'Solo un Encargado o el Administrador puede registrar observaciones administrativas.';
    }
    const asig = this.asignacionDe(id);
    if (!asig) return 'Este requerimiento no tiene una asignación registrada.';
    if (!texto.trim()) return 'Escriba la observación administrativa.';
    const caso = this.casoModificacionAsignacion(id);
    const registro: ModificacionAsignacion = {
      fecha: this.hoy(), hora: this.hora(), equipoAnterior: asig.equipoInventario,
      equipoNuevo: asig.equipoInventario, usuarioFinal: asig.usuarioFinal, motivo: texto.trim(),
      observacion: texto.trim(), encargado: usuario, rol,
      estadoAnterior: caso.caso, estadoNuevo: caso.caso, soloObservacion: true
    };
    this.asignaciones.update((list) => list.map((a) => (a.expediente === id
      ? { ...a, modificaciones: [...(a.modificaciones ?? []), registro] } : a)));
    this.registrarEvento(id, usuario, 'Observación administrativa registrada', caso.caso, texto.trim(), false,
      { modulo: 'Asignación de equipo', inventario: asig.equipoInventario, usuarioFinal: asig.usuarioFinal,
        rol, motivo: texto.trim(), expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico });
    return null;
  }

  /** Deja constancia de que una modificación se intentó sobre un proceso que ya no la admite. */
  registrarModificacionRechazada(id: string, usuario: string, rol = ''): void {
    const caso = this.casoModificacionAsignacion(id);
    if (caso.permiteCambioEquipo) return;
    this.registrarEvento(id, usuario, 'Modificación rechazada por estado avanzado del proceso', caso.caso,
      caso.aviso, false,
      { modulo: 'Asignación de equipo', inventario: this.asignacionDe(id)?.equipoInventario,
        usuarioFinal: this.asignacionDe(id)?.usuarioFinal, rol,
        expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico });
  }

  // ---------- Descargo y reingreso a Hardware ----------
  /**
   * Registra un nuevo ingreso a Hardware para un equipo que ya estuvo en el inventario
   * (reingreso). No crea Expediente técnico por sí solo: eso lo decide después un Encargado
   * desde «Crear Expediente técnico», ahora habilitado por `puedeCrearNuevoExpedienteTecnico`.
   */
  private registrarIngresoHardware(inventario: string, motivo: MotivoIngreso, usuario: string, observaciones = ''): IngresoHardware {
    const previos = this.ingresosDeEquipo(inventario);
    const nuevo: IngresoHardware = {
      idIngresoHardware: `${inventario}-${String(previos.length + 1).padStart(2, '0')}`,
      inventario, numeroIngreso: previos.length + 1,
      fechaIngreso: this.hoy(), horaIngreso: this.hora(), motivoIngreso: motivo,
      ingresadoPor: usuario, estadoInicial: 'Pendiente de preparación', estadoFinal: '', observaciones
    };
    this.ingresosHardware.update((list) => [nuevo, ...list]);
    this.registrarEvento(inventario, usuario, `Reingreso a Hardware registrado para el equipo ${inventario} (${motivo})`,
      'Pendiente de preparación', observaciones, true,
      { modulo: 'Ingreso a Hardware', estadoAnterior: 'Descargado', inventario });
    return nuevo;
  }

  /**
   * Un equipo **descargado que quedó en espera de un reingreso explícito**. Es el caso de las
   * acciones posteriores «Preparar para reasignación», «Dejar pendiente de revisión» y «Marcar
   * como no disponible»: a diferencia de «Reingresar a Hardware» / «Enviar a nueva preparación»,
   * NO generan el ingreso automáticamente, así que alguien debe registrarlo para que el equipo
   * pueda recibir un nuevo Expediente técnico y volver al flujo (ver `registrarReingresoAHardware`).
   *
   * Sin este paso el equipo quedaba sin salida: su Expediente técnico anterior está «Cerrado»
   * (no se reutiliza) y `puedeCrearNuevoExpedienteTecnico` exige un reingreso pendiente, por lo
   * que no aparecía ni en «Buscar equipo preparado» ni en «Crear Expediente técnico».
   */
  esperaReingresoAHardware(inventario: string): boolean {
    if (!this.ultimoDescargo(inventario)) return false;          // nunca estuvo con un usuario final
    if (this.asignacionDeEquipo(inventario)) return false;        // sigue asignado: primero se descarga
    if (this.reingresoHardwarePendiente(inventario)) return false; // ya reingresó; falta su Expediente técnico
    // Solo si no hay un ciclo nuevo en marcha: un ET vigente «En preparación» o «Preparado» ya es un ciclo activo.
    return this.estadoPreparacionEquipo(inventario) === 'Pendiente de preparación';
  }

  /** Motivo de ingreso sugerido a partir del motivo del descargo que dejó al equipo en espera. */
  motivoReingresoSugerido(inventario: string): MotivoIngreso {
    switch (this.ultimoDescargo(inventario)?.motivoDescargo) {
      case 'Reasignación': return 'Reingreso por reasignación';
      case 'Cambio de usuario': return 'Reingreso por cambio de usuario';
      case 'Garantía': return 'Reingreso por garantía';
      case 'Devolución':
      case 'Finalización de uso': return 'Reingreso por devolución';
      default: return 'Reingreso por revisión técnica';
    }
  }

  /**
   * Registra el **reingreso explícito** a Hardware de un equipo descargado que quedó en espera
   * (ver `esperaReingresoAHardware`). Lo hacen los Encargados o el Administrador. No reabre nada
   * del ciclo anterior: solo crea el Ingreso a Hardware que habilita crear un **nuevo** Expediente
   * técnico y repetir la Preparación F0288, tal como exige la regla de que ningún expediente
   * anterior se reutiliza. Devuelve null si se registró, o el mensaje de la validación que falló.
   */
  registrarReingresoAHardware(inventario: string, motivo: MotivoIngreso, usuario: string, observaciones = ''): string | null {
    if (!this.equipoDe(inventario)) return 'No se encontró el equipo indicado.';
    if (this.asignacionDeEquipo(inventario)) {
      return 'Este equipo sigue asignado a un usuario final: primero debe registrarse su descargo.';
    }
    if (this.reingresoHardwarePendiente(inventario)) {
      return 'Este equipo ya tiene un reingreso a Hardware pendiente: lo que falta es crear su nuevo Expediente técnico.';
    }
    if (!this.esperaReingresoAHardware(inventario)) {
      return 'Este equipo no está en espera de reingreso a Hardware.';
    }
    this.registrarIngresoHardware(inventario, motivo, usuario, observaciones);
    return null;
  }

  /**
   * Registra el descargo de un equipo: deja de estar asignado al usuario final y vuelve al
   * flujo interno. Cierra (sin borrar) la asignación vigente y, según `accionPosterior`,
   * puede originar un nuevo Ingreso a Hardware (reingreso):
   *  - «Reingresar a Hardware» / «Enviar a preparación» → sí generan un nuevo ingreso.
   *  - «Preparar para reasignación» → no genera ingreso: el equipo sigue Preparado y
   *    reaparece directo en «Buscar equipo preparado» (no necesita repetir el F0288).
   *  - «Dejar pendiente de revisión» / «Marcar como no disponible» → estados de espera,
   *    sin efecto automático adicional.
   */
  /**
   * Registra el descargo de un equipo (lo hace el Técnico de Soporte asignado; el Encargado de
   * Soporte solo supervisa/consulta). Cierra la asignación vigente y **todo el ciclo anterior**
   * del equipo — Expediente técnico, F0288, Expediente único, F0302 y Garantía, si existían —
   * como histórico: nunca se borran, pero dejan de poder reutilizarse para un ciclo nuevo
   * (ver `puedeCrearNuevoExpedienteTecnico`, `estadoPreparacionEquipo`).
   */
  registrarDescargo(datos: {
    inventario: string; motivoDescargo: MotivoDescargo; responsableRegistro: string;
    estadoFisico: string; observaciones: string; accionPosterior: AccionPosteriorDescargo;
    /** Obligatorio cuando descarga el Encargado de Soporte o el Administrador (§27). */
    motivoAdministrativo?: string;
  }): string | Descargo {
    const eq = this.equipoDe(datos.inventario);
    if (!eq) return 'No se encontró el equipo indicado.';
    const asig = this.asignacionDeEquipo(datos.inventario);
    if (!asig) return 'Este equipo no tiene una asignación vigente: no hay nada que descargar.';
    if (this.estadoAceptacion(asig.expediente) !== 'Aceptado' || !this.garantiaDe(asig.expediente)) {
      return 'No se puede registrar el descargo: el equipo debe tener la aceptación del usuario final y la garantía habilitada.';
    }
    // Quien descarga debe ser el soporte responsable de la Dirección/Unidad donde el equipo está
    // activo, el Encargado de Soporte o el Administrador (§18/§19).
    const bloqueo = this.bloqueoDescargo(datos.inventario);
    if (bloqueo) {
      this.registrarEvento(asig.expediente, datos.responsableRegistro,
        'Intento de descargo por un usuario que no es el soporte responsable', 'Descargo bloqueado',
        bloqueo, false,
        { modulo: 'Descargo', inventario: datos.inventario, usuarioFinal: asig.usuarioFinal,
          rol: this.rolConectado(), soporteResponsable: this.soporteResponsableDeEquipo(datos.inventario) });
      return bloqueo;
    }
    // El descargo administrativo (Encargado de Soporte o Administrador) exige motivo: el equipo
    // no lo devuelve quien lo tenía a cargo, y sin motivo el historial no explicaría por qué.
    const administrativo = this.claveConectada() === 'enc-soporte' || this.claveConectada() === 'admin';
    const motivoAdministrativo = (datos.motivoAdministrativo ?? '').trim();
    if (administrativo && !motivoAdministrativo) {
      return 'Debe indicar el motivo administrativo del descargo: lo registra el Encargado de Soporte o el Administrador, no el soporte responsable del equipo.';
    }

    // El descargo no se registra sin una imagen del estado físico: es lo que respalda en qué
    // condiciones se recibió el equipo, y después ya no hay forma de comprobarlo. La imagen se
    // adjunta contra el número de inventario, porque el código del descargo todavía no existe.
    const sinImagen = this.exigirEvidencia('Descargo', datos.inventario, asig.expediente,
      datos.responsableRegistro, datos.inventario);
    if (sinImagen) return sinImagen;

    const tec = this.expTecnicoDeEquipo(datos.inventario);
    const prep = tec ? this.preparacionPorCodigo(tec.codigo) : undefined;
    const expUnico = this.expedienteUnicoDe(asig.expediente);
    const conf = this.configuracionDe(asig.expediente);
    const gar = this.garantiaDe(asig.expediente);

    const codigo = this.siguienteCodigoPorAnio(`DESC-${this.anioActual()}-`, this.descargos().map((d) => d.idDescargo));
    const nuevo: Descargo = {
      idDescargo: codigo, inventario: datos.inventario, asignacionRelacionada: asig.expediente,
      usuarioFinalEntrega: asig.usuarioFinal, responsableRegistro: datos.responsableRegistro,
      fechaDescargo: this.hoy(), motivoDescargo: datos.motivoDescargo,
      estadoFisico: datos.estadoFisico,
      observaciones: administrativo
        ? `${datos.observaciones} Motivo administrativo: ${motivoAdministrativo}`.trim()
        : datos.observaciones,
      expedienteUnicoAnterior: expUnico?.codigoUnico,
      accionPosterior: datos.accionPosterior, encargadoDestino: this.responsableOperativo(eq),
      estado: 'Procesado'
    };
    this.descargos.update((list) => [nuevo, ...list]);
    this.registrarEvento(asig.expediente, datos.responsableRegistro,
      `Descargo ${codigo} iniciado sobre el equipo ${datos.inventario}`, 'Descargo iniciado',
      administrativo ? `Descargo administrativo. Motivo: ${motivoAdministrativo}` : '', false,
      { modulo: 'Descargo', inventario: datos.inventario, usuarioFinal: asig.usuarioFinal,
        rol: this.rolConectado(), descargo: codigo, motivo: datos.motivoDescargo,
        soporteResponsable: this.soporteResponsableDeEquipo(datos.inventario) });

    // Cierra la asignación vigente (sin borrarla): es el mecanismo central del ciclo múltiple.
    this.asignaciones.update((list) =>
      list.map((a) => (a.expediente === asig.expediente ? { ...a, vigente: false, estado: 'Descargada' } : a)));

    this.registrarEvento(asig.expediente, datos.responsableRegistro,
      administrativo
        ? `Equipo ${datos.inventario} descargado del usuario final por el ${this.rolConectado()} (${datos.motivoDescargo})`
        : `Equipo ${datos.inventario} descargado del usuario final por el soporte responsable (${datos.motivoDescargo})`,
      'Descargado', nuevo.observaciones, true,
      { modulo: 'Descargo', estadoAnterior: 'Asignado', inventario: datos.inventario,
        usuarioFinal: asig.usuarioFinal, rol: this.rolConectado(), descargo: codigo,
        soporteResponsable: this.soporteResponsableDeEquipo(datos.inventario) });
    this.registrarCierreConEvidencia('Descargo', datos.inventario, asig.expediente,
      datos.responsableRegistro, datos.inventario);
    // Salida automática del inventario activo de la Dirección/Unidad y de Controles: no requiere
    // ninguna acción manual adicional (§26).
    this.retirarDeControles(nuevo, motivoAdministrativo);

    // Cierra como histórico todo el ciclo anterior: nunca se reutiliza para uno nuevo.
    if (tec && tec.estado !== 'Cerrado') {
      this.expedientesTecnicos.update((list) =>
        list.map((x) => (x.codigo === tec.codigo ? { ...x, estado: 'Cerrado' } : x)));
      this.registrarEvento(tec.codigo, datos.responsableRegistro,
        `Expediente técnico ${tec.codigo} cerrado por el descargo del equipo ${datos.inventario}; queda como histórico`,
        'Cerrado', '', false,
        { modulo: 'Descargo', estadoAnterior: 'Preparado', inventario: datos.inventario, expedienteTecnico: tec.codigo });
    }
    if (prep && prep.estado !== 'Cerrada') {
      this.actualizarPreparacion(prep.expedienteTecnico, (x) => ({ ...x, estado: 'Cerrada' }));
      this.registrarEvento(prep.expedienteTecnico, datos.responsableRegistro,
        `Preparación F0288 ${prep.expedienteTecnico} cerrada por el descargo del equipo; ya no puede reutilizarse`,
        'Cerrada', '', false,
        { modulo: 'Descargo', estadoAnterior: prep.estado, inventario: datos.inventario, expedienteTecnico: prep.expedienteTecnico });
    }
    if (expUnico && expUnico.estado !== 'Cerrado') {
      this.expedientesUnicos.update((list) =>
        list.map((x) => (x.expediente === asig.expediente
          ? { ...x, estado: 'Cerrado', resumenEstado: 'Cerrado · Equipo descargado, expediente histórico' } : x)));
      this.registrarEvento(asig.expediente, datos.responsableRegistro,
        `Expediente único ${expUnico.codigoUnico} cerrado por el descargo del equipo; queda como histórico`,
        'Cerrado', '', false,
        { modulo: 'Descargo', estadoAnterior: expUnico.estado, inventario: datos.inventario, expedienteUnico: expUnico.codigoUnico });
    }
    if (conf && conf.estado !== 'Cerrada') {
      this.configuraciones.update((list) =>
        list.map((x) => (x.expediente === asig.expediente && x.estado !== 'Con falla' ? { ...x, estado: 'Cerrada' } : x)));
      this.registrarEvento(asig.expediente, datos.responsableRegistro,
        `Configuración F0302 cerrada por el descargo del equipo; ya no puede reutilizarse`,
        'Cerrada', '', false,
        { modulo: 'Descargo', estadoAnterior: conf.estado, inventario: datos.inventario, expedienteUnico: expUnico?.codigoUnico });
    }
    if (gar && gar.estado !== 'Cerrado' && gar.estado !== 'Vencida') {
      const estadoGar = this.garantiaVencida(gar) ? 'Vencida' : 'Cerrado';
      this.garantias.update((list) =>
        list.map((g) => (g.expediente === asig.expediente
          ? { ...g, estado: estadoGar, nota: `${g.nota} Cerrada por el descargo del equipo.`.trim() } : g)));
      this.registrarEvento(asig.expediente, datos.responsableRegistro,
        `Garantía del expediente cerrada por el descargo del equipo`, estadoGar, '', false,
        { modulo: 'Descargo', estadoAnterior: gar.estado, inventario: datos.inventario, expedienteUnico: expUnico?.codigoUnico });
    }

    if (datos.accionPosterior === 'Reingresar a Hardware' || datos.accionPosterior === 'Enviar a nueva preparación') {
      const motivoIngreso: MotivoIngreso = datos.accionPosterior === 'Enviar a nueva preparación'
        ? 'Reingreso por revisión técnica' : 'Reingreso por devolución';
      this.registrarIngresoHardware(datos.inventario, motivoIngreso, datos.responsableRegistro, datos.observaciones);
    } else {
      this.registrarEvento(datos.inventario, datos.responsableRegistro,
        `Equipo ${datos.inventario} pendiente de nuevo ingreso a Hardware y de un nuevo Expediente técnico para continuar el flujo`,
        'Pendiente de preparación', '', false,
        { modulo: 'Descargo', estadoAnterior: 'Descargado', inventario: datos.inventario });
    }
    return nuevo;
  }
  /** Descargos visibles: el Técnico de Soporte solo ve los suyos; Encargado de Soporte y Administrador ven todos (supervisión). */
  descargosVisibles(): Descargo[] {
    if (this.claveConectada() === 'tec-soporte') {
      const n = this.nombreConectado();
      return this.descargos().filter((d) => d.responsableRegistro.includes(n));
    }
    return this.descargos();
  }
  /** Dirección asignada del técnico, buscada por su texto «Nombre — Rol»; '' si no aplica. */
  direccionDe(tecnicoTexto: string): string {
    if (!tecnicoTexto) return '';
    return this.usuarios().find((u) => tecnicoTexto.includes(u.nombre))?.direccionAsignada ?? '';
  }

  // ---------- Distribución de Soportes por Dirección/Unidad ----------
  /**
   * Mensajes de las tres puertas que abre esta distribución. Se guardan aquí y no en las
   * pantallas porque la regla es del proceso: quien decide es el servicio, la pantalla solo la
   * enuncia, y así el texto no se duplica entre el modal, la validación y el bloqueo.
   */
  readonly MSG_SIN_DISTRIBUCION =
    'No hay Técnicos de Soporte asignados a la Dirección/Unidad de este requerimiento. Debe configurar la distribución de soportes antes de crear el Expediente único.';
  readonly MSG_TECNICO_FUERA_DIRECCION =
    'El Técnico de Configuración seleccionado no está asignado a la Dirección/Unidad de este requerimiento. Seleccione un técnico responsable de esa Dirección/Unidad.';
  readonly MSG_DESCARGO_FUERA_DIRECCION =
    'Este equipo pertenece a una Dirección/Unidad que no está asignada a este Técnico de Soporte. Solo el soporte responsable, el Encargado de Soporte o el Administrador pueden registrar este descargo.';

  /** Compara Dirección/Unidad sin que un espacio o una mayúscula de más cambie el resultado. */
  private claveDirUnidad(direccion: string, unidad: string): string {
    return `${(direccion || '').trim().toLowerCase()}|${(unidad || '').trim().toLowerCase()}`;
  }

  /**
   * Direcciones/Unidades del catálogo, tomadas de los requerimientos y de la distribución ya
   * registrada. No se teclean aparte: la Dirección/Unidad la define el requerimiento (§4), así
   * que inventar un catálogo propio sería crear una segunda verdad que se desincroniza sola.
   */
  direccionesUnidades(): { direccion: string; unidad: string }[] {
    const mapa = new Map<string, { direccion: string; unidad: string }>();
    for (const s of this.solicitudes()) {
      if (!s.direccionGerencia || !s.unidadDestino) continue;
      mapa.set(this.claveDirUnidad(s.direccionGerencia, s.unidadDestino),
        { direccion: s.direccionGerencia, unidad: s.unidadDestino });
    }
    for (const d of this.distribuciones()) {
      mapa.set(this.claveDirUnidad(d.direccion, d.unidad), { direccion: d.direccion, unidad: d.unidad });
    }
    return [...mapa.values()].sort((a, b) =>
      a.direccion.localeCompare(b.direccion) || a.unidad.localeCompare(b.unidad));
  }

  /** Asignaciones vigentes de una Dirección/Unidad (las desactivadas quedan solo en el historial). */
  distribucionesDe(direccion: string, unidad: string): DistribucionSoporte[] {
    return this.soportes.deDireccionUnidad(direccion, unidad);
  }

  /** Técnicos de Soporte responsables de una Dirección/Unidad, en formato «Nombre — Rol». */
  tecnicosDeDireccionUnidad(direccion: string, unidad: string): string[] {
    return this.soportes.tecnicosDe(direccion, unidad);
  }

  /** Direcciones/Unidades que atiende un técnico (§6: «Ver Direcciones/Unidades atendidas»). */
  direccionesDeTecnico(tecnico: string): DistribucionSoporte[] {
    return this.soportes.deTecnico(tecnico);
  }

  /** ¿Este técnico está en la distribución vigente de esa Dirección/Unidad? */
  atiendeDireccionUnidad(tecnico: string, direccion: string, unidad: string): boolean {
    return this.soportes.atiende(tecnico, direccion, unidad);
  }

  /**
   * Soporte responsable de una Dirección/Unidad. Si el técnico que configuró el equipo atiende
   * esa Dirección/Unidad, es él: ya conoce el equipo y no tiene sentido pasárselo a otro. Si no,
   * el primero de la distribución vigente.
   */
  soporteResponsableDe(direccion: string, unidad: string, preferido = ''): string {
    return this.soportes.responsableDe(direccion, unidad, preferido);
  }

  /** Solo el Encargado de Soporte y el Administrador gestionan la distribución (§6). */
  puedeGestionarDistribucion(): boolean {
    const clave = this.claveConectada();
    return clave === 'enc-soporte' || clave === 'admin';
  }

  /** Registra que un Técnico de Soporte atiende una Dirección/Unidad. */
  asignarDistribucion(datos: { direccion: string; unidad: string; tecnico: string; observacion: string },
    usuario: string): string | DistribucionSoporte {
    if (!this.puedeGestionarDistribucion()) {
      return 'Solo el Encargado de Soporte o el Administrador pueden gestionar la distribución de soportes.';
    }
    if (!datos.direccion.trim() || !datos.unidad.trim()) return 'Debe indicar la Dirección y la Unidad.';
    if (!datos.tecnico) return 'Debe seleccionar el Técnico de Soporte responsable.';
    const usuarioTec = this.usuarios().find((u) => datos.tecnico.includes(u.nombre));
    if (!usuarioTec || usuarioTec.clave !== 'tec-soporte') {
      return 'La distribución solo admite Técnicos de Soporte: Hardware no atiende Direcciones/Unidades.';
    }
    if (usuarioTec.estado === 'Inactivo') return 'No se puede asignar un técnico inactivo.';
    if (this.atiendeDireccionUnidad(datos.tecnico, datos.direccion, datos.unidad)) {
      return `${usuarioTec.nombre} ya atiende ${datos.direccion} / ${datos.unidad}.`;
    }
    const nuevo: DistribucionSoporte = {
      id: this.siguienteCodigoPorAnio(`DIST-${this.anioActual()}-`, this.distribuciones().map((d) => d.id)),
      tecnicoId: this.soportes.idTecnico(datos.tecnico),
      direccionId: this.soportes.idDireccion(datos.direccion),
      unidadId: this.soportes.idUnidad(datos.direccion, datos.unidad),
      direccion: datos.direccion.trim(), unidad: datos.unidad.trim(), tecnico: datos.tecnico,
      asignadoPor: usuario, fecha: this.hoy(), hora: this.hora(), activo: true,
      observacion: datos.observacion.trim()
    };
    // La carga se toma ANTES de sumar la Dirección/Unidad: es con la que se decidió asignársela.
    const carga = this.cargaSoporteDe(datos.tecnico);
    this.distribuciones.update((list) => [nuevo, ...list]);
    this.registrarEvento(nuevo.id, usuario,
      `${usuarioTec.nombre} asignado como Técnico de Soporte de ${nuevo.direccion} / ${nuevo.unidad}`,
      'Activa',
      `${nuevo.observacion}${nuevo.observacion ? ' ' : ''}`
        + `${carga.carga} al momento de asignar — ${carga.total} procesos activos. ${this.resumenCargaSoporte(carga)}.`,
      false,
      { modulo: 'Distribución de soportes', direccion: nuevo.direccion, unidad: nuevo.unidad,
        soporteResponsable: nuevo.tecnico, tecnicoSoporte: nuevo.tecnico, cargaLaboral: carga.carga,
        procesosActivos: carga.total, detalleCarga: this.resumenCargaSoporte(carga),
        rol: this.rolConectado() });
    return nuevo;
  }

  /** Cambia el técnico o la observación de una asignación vigente (§6: «Modificar distribución»). */
  modificarDistribucion(id: string, cambios: { tecnico?: string; observacion?: string }, usuario: string): string | null {
    if (!this.puedeGestionarDistribucion()) {
      return 'Solo el Encargado de Soporte o el Administrador pueden gestionar la distribución de soportes.';
    }
    const actual = this.distribuciones().find((d) => d.id === id);
    if (!actual) return 'No se encontró la asignación indicada.';
    if (!actual.activo) return 'La asignación está desactivada: no puede modificarse.';
    const tecnico = cambios.tecnico ?? actual.tecnico;
    const usuarioTec = this.usuarios().find((u) => tecnico.includes(u.nombre));
    if (!usuarioTec || usuarioTec.clave !== 'tec-soporte') {
      return 'La distribución solo admite Técnicos de Soporte: Hardware no atiende Direcciones/Unidades.';
    }
    if (tecnico !== actual.tecnico && this.atiendeDireccionUnidad(tecnico, actual.direccion, actual.unidad)) {
      return `${usuarioTec.nombre} ya atiende ${actual.direccion} / ${actual.unidad}.`;
    }
    this.distribuciones.update((list) => list.map((d) => (d.id === id
      ? { ...d, tecnico, observacion: cambios.observacion ?? d.observacion } : d)));
    this.registrarEvento(id, usuario,
      `Distribución de ${actual.direccion} / ${actual.unidad} modificada`, 'Activa',
      tecnico === actual.tecnico ? 'Observación actualizada.'
        : `Responsable anterior: ${actual.tecnico}. Responsable nuevo: ${tecnico}.`, false,
      { modulo: 'Distribución de soportes', direccion: actual.direccion, unidad: actual.unidad,
        soporteResponsable: tecnico, rol: this.rolConectado() });
    return null;
  }

  /**
   * Desactiva una asignación. Nunca se borra: los equipos aceptados mientras estuvo vigente
   * siguen apuntando a ella, y borrarla dejaría su historial señalando a un responsable que el
   * sistema ya no sabría nombrar.
   */
  desactivarDistribucion(id: string, usuario: string, motivo: string): string | null {
    if (!this.puedeGestionarDistribucion()) {
      return 'Solo el Encargado de Soporte o el Administrador pueden gestionar la distribución de soportes.';
    }
    const actual = this.distribuciones().find((d) => d.id === id);
    if (!actual) return 'No se encontró la asignación indicada.';
    if (!actual.activo) return 'La asignación ya está desactivada.';
    if (!motivo.trim()) return 'Debe indicar el motivo por el que se desactiva la asignación.';
    const activos = this.controlesActivos()
      .filter((c) => this.claveDirUnidad(c.direccion, c.unidad) === this.claveDirUnidad(actual.direccion, actual.unidad)
        && c.soporteResponsable === actual.tecnico);
    const quedan = this.distribucionesDe(actual.direccion, actual.unidad).filter((d) => d.id !== id);
    if (activos.length && !quedan.length) {
      return `No se puede desactivar: ${actual.direccion} / ${actual.unidad} tiene ${activos.length} equipo(s) activo(s) y quedaría sin ningún Técnico de Soporte responsable.`;
    }
    this.distribuciones.update((list) => list.map((d) => (d.id === id
      ? { ...d, activo: false, desactivadaPor: usuario, fechaDesactivacion: this.hoy(),
          observacion: `${d.observacion} Desactivada: ${motivo.trim()}`.trim() }
      : d)));
    // Los equipos activos que apuntaban a este técnico pasan al responsable que queda vigente:
    // un equipo en uso nunca puede quedarse sin nadie a quien reclamarle el soporte.
    if (activos.length && quedan.length) {
      const nuevo = quedan[0].tecnico;
      for (const c of activos) {
        this.controles.update((list) => list.map((x) => (x.inventario === c.inventario && x.expediente === c.expediente
          ? { ...x, soporteResponsable: nuevo } : x)));
        this.registrarEvento(c.expediente, usuario,
          `Soporte responsable determinado tras desactivar la distribución anterior`, c.estado,
          `${c.inventario}: de ${actual.tecnico} a ${nuevo}.`, false,
          { modulo: 'Distribución de soportes', inventario: c.inventario, direccion: c.direccion,
            unidad: c.unidad, soporteResponsable: nuevo, expedienteUnico: c.expedienteUnico });
      }
    }
    this.registrarEvento(id, usuario,
      `Distribución de ${actual.direccion} / ${actual.unidad} desactivada (${actual.tecnico.split('—')[0].trim()})`,
      'Desactivada', motivo.trim(), false,
      { modulo: 'Distribución de soportes', estadoAnterior: 'Activa', direccion: actual.direccion,
        unidad: actual.unidad, soporteResponsable: actual.tecnico, rol: this.rolConectado() });
    return null;
  }

  // ---------- Técnico de Configuración según Dirección/Unidad ----------
  /** Dirección y Unidad del requerimiento: es de donde salen, nunca de una selección manual (§4). */
  dirUnidadDeSolicitud(id: string): { direccion: string; unidad: string } {
    const s = this.solicitud(id);
    return { direccion: s?.direccionGerencia ?? '', unidad: s?.unidadDestino ?? '' };
  }

  /**
   * Técnicos elegibles como Técnico de Configuración de un requerimiento: los de la distribución
   * vigente de SU Dirección/Unidad, activos y con su carga a la vista. Un técnico que no atiende
   * esa Dirección/Unidad no aparece — no se muestra deshabilitado, no aparece.
   */
  tecnicosConfiguracionDe(id: string): TecnicoSoporteConCarga[] {
    const { direccion, unidad } = this.dirUnidadDeSolicitud(id);
    if (!direccion || !unidad) return [];
    const responsables = this.tecnicosDeDireccionUnidad(direccion, unidad);
    return this.tecnicosSoporteConCarga()
      .filter((t) => responsables.some((r) => r.includes(t.usuario.nombre)));
  }

  /**
   * Técnicos de Soporte que pueden hacerse cargo de un proceso ya en marcha —una corrección, una
   * inconformidad, un caso de garantía o un descargo—. Se prefiere a los responsables de su
   * Dirección/Unidad; si esa Dirección/Unidad todavía no tiene distribución vigente se ofrecen
   * todos, porque un caso abierto no puede quedarse sin quién lo atienda mientras se corrige el
   * catálogo. La regla estricta de la distribución solo aplica al Técnico de Configuración, que es
   * donde el requerimiento define a quién le toca desde el inicio.
   */
  tecnicosSoporteParaProceso(id: string): TecnicoSoporteConCarga[] {
    const propios = this.tecnicosConfiguracionDe(id);
    return propios.length ? propios : this.tecnicosSoporteConCarga();
  }

  /**
   * Las siete condiciones que deben cumplirse antes de crear el Expediente único (§11). Se
   * devuelven todas con su estado —no solo la primera que falla— para que la pantalla muestre
   * qué falta sin obligar a descubrirlo de a una.
   */
  validacionesExpedienteUnico(id: string, tecnicoConfiguracion: string): { texto: string; ok: boolean }[] {
    const s = this.solicitud(id);
    const asig = this.asignacionDe(id);
    const inventario = asig?.equipoInventario ?? '';
    const tec = inventario ? this.expTecnicoDeEquipo(inventario) : undefined;
    const prep = tec ? this.preparacionPorCodigo(tec.codigo) : undefined;
    const { direccion, unidad } = this.dirUnidadDeSolicitud(id);
    return [
      { texto: 'Solicitud seleccionada', ok: !!s },
      { texto: 'Solicitud tiene equipo asignado', ok: !!inventario },
      { texto: 'Equipo asignado tiene F0288 finalizado y firmado',
        ok: !!tec && tec.estado === 'Preparado' && (!prep || (prep.estado === 'Completada' && prep.firma?.estado === 'Firmado')) },
      { texto: 'Expediente técnico está completado', ok: tec?.estado === 'Preparado' },
      { texto: 'Técnico de configuración seleccionado', ok: !!tecnicoConfiguracion },
      { texto: 'Técnico de configuración pertenece a la Dirección/Unidad del requerimiento',
        ok: !!tecnicoConfiguracion && this.atiendeDireccionUnidad(tecnicoConfiguracion, direccion, unidad) },
      { texto: 'No existe Expediente único previo para esa solicitud', ok: !this.expedienteUnicoDe(id) }
    ];
  }

  /**
   * Motivo por el que NO se puede crear el Expediente único, o '' si se puede. Es la puerta que
   * consulta `crearExpedienteUnico`: la pantalla muestra el mismo texto que aplica el servicio.
   */
  bloqueoExpedienteUnico(id: string, tecnicoConfiguracion: string): string {
    const { direccion, unidad } = this.dirUnidadDeSolicitud(id);
    if (!direccion || !unidad) return 'El requerimiento no tiene Dirección ni Unidad solicitante registradas.';
    if (!this.tecnicosDeDireccionUnidad(direccion, unidad).length) return this.MSG_SIN_DISTRIBUCION;
    if (!tecnicoConfiguracion) return 'Debe seleccionar el Técnico de Configuración.';
    if (!this.atiendeDireccionUnidad(tecnicoConfiguracion, direccion, unidad)) return this.MSG_TECNICO_FUERA_DIRECCION;
    const pendientes = this.validacionesExpedienteUnico(id, tecnicoConfiguracion).filter((v) => !v.ok);
    if (pendientes.length) return `Falta: ${pendientes.map((v) => v.texto.toLowerCase()).join('; ')}.`;
    return '';
  }

  // ---------- Inventario operativo de Controles ----------
  /** Ficha vigente del equipo en Controles (la del ciclo actual), esté activa o ya descargada. */
  controlDe(inventario: string): EquipoControles | undefined {
    return this.controles().find((c) => c.inventario === inventario);
  }
  /** Ficha del equipo solo si sigue activo en su Dirección/Unidad. */
  controlActivoDe(inventario: string): EquipoControles | undefined {
    const c = this.controlDe(inventario);
    return c?.estado === 'Activo en Dirección/Unidad' ? c : undefined;
  }
  /** Equipos activos en alguna Dirección/Unidad: lo que cuenta para los controles mensuales. */
  controlesActivos(): EquipoControles[] {
    return this.controles().filter((c) => c.estado === 'Activo en Dirección/Unidad');
  }
  /** Equipos activos de una Dirección (todas sus unidades). */
  controlesDeDireccion(direccion: string): EquipoControles[] {
    const d = direccion.trim().toLowerCase();
    return this.controlesActivos().filter((c) => c.direccion.trim().toLowerCase() === d);
  }
  /** Equipos activos bajo un Técnico de Soporte responsable. */
  controlesDeSoporte(tecnico: string): EquipoControles[] {
    if (!tecnico) return [];
    const nombre = tecnico.split('—')[0].trim();
    return this.controlesActivos().filter((c) => c.soporteResponsable.includes(nombre));
  }
  /** Historial completo del equipo en Controles: los ciclos activos y los ya descargados. */
  historialControlesDe(inventario: string): EquipoControles[] {
    return this.controles().filter((c) => c.inventario === inventario);
  }
  /** Técnico de Soporte responsable del equipo hoy; '' si el equipo no está activo en ninguna Dirección/Unidad. */
  soporteResponsableDeEquipo(inventario: string): string {
    return this.controlActivoDe(inventario)?.soporteResponsable ?? '';
  }

  /**
   * Deriva las fichas de Controles de las aceptaciones que el set de datos ya trae. La garantía
   * solo existe después de que el usuario final firmó, así que sirve de prueba de la aceptación:
   * no se inventa ninguna pertenencia, solo se refleja la que el expediente ya registra. Los
   * registros guardados ganan siempre — solo se completan los que faltan.
   */
  private controlesDeAceptacionesPrevias(guardados: EquipoControles[]): EquipoControles[] {
    const resultado = [...guardados];
    for (const g of this.garantias()) {
      if (resultado.some((c) => c.expediente === g.expediente && c.inventario === g.inventario)) continue;
      const ficha = this.fichaControles(g.expediente, g.inventario, g.fechaAceptacion);
      if (!ficha) continue;
      // Un descargo del mismo ciclo ya cerró esa pertenencia: la ficha nace descargada, no activa.
      const desc = this.descargos().find((d) => d.inventario === g.inventario && d.asignacionRelacionada === g.expediente);
      resultado.push(desc ? this.fichaDescargada(ficha, desc) : ficha);
    }
    return resultado;
  }

  /** Arma la ficha de Controles de un proceso aceptado; devuelve undefined si le falta la solicitud. */
  private fichaControles(id: string, inventario: string, fechaAceptacion: string): EquipoControles | undefined {
    const s = this.solicitud(id);
    if (!s) return undefined;
    const eq = this.equipoDe(inventario);
    const asig = this.asignacionDe(id);
    const tecConfig = asig?.responsablesFase?.tecnicoConfiguracion ?? '';
    const responsable = this.soporteResponsableDe(s.direccionGerencia, s.unidadDestino, tecConfig);
    // Datos técnicos con los que quedó configurado el equipo. Viajan con la ficha al inventario
    // operativo de Controles: allí el F0387 identifica los equipos por su IP.
    const cfg = this.configuracionDe(id)?.datos;
    return {
      inventario, expediente: id,
      expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico ?? '',
      tipoEquipo: eq?.tipo ?? s.tipoEquipo,
      marca: eq?.marca ?? '', modelo: eq?.modelo ?? '', serie: eq?.serie ?? '',
      nombreEquipo: cfg?.nombrePC ?? '',
      ip: (cfg?.requiereReservaIP === 'Sí' ? cfg?.ipReservada ?? '' : '').trim(),
      mac: (cfg?.macEquipo ?? '').trim(),
      usuarioFinal: s.destinatario, correoInstitucional: s.correoDestinatario,
      direccion: s.direccionGerencia, unidad: s.unidadDestino,
      soporteResponsable: responsable, tecnicoConfiguracion: tecConfig,
      fechaAceptacion, estado: 'Activo en Dirección/Unidad',
      garantia: 'Habilitada',
      estadoControlMensual: 'Disponible para controles mensuales',
      estadoGestion: 'Activo en Dirección/Unidad'
    };
  }

  /** Aplica un descargo sobre una ficha: la cierra conservando la Dirección/Unidad anterior. */
  private fichaDescargada(ficha: EquipoControles, d: Descargo): EquipoControles {
    const estados = this.estadoTrasDescargo(d.accionPosterior);
    return {
      ...ficha,
      estado: 'Descargado de Dirección/Unidad',
      estadoControlMensual: 'Fuera de controles activos',
      estadoGestion: estados.gestion,
      fechaDescargo: d.fechaDescargo, descargadoPor: d.responsableRegistro,
      motivoDescargo: d.motivoDescargo, estadoFisicoRecibido: d.estadoFisico,
      accionPosterior: d.accionPosterior, usuarioFinalAnterior: ficha.usuarioFinal,
      direccionAnterior: ficha.direccion, unidadAnterior: ficha.unidad, descargo: d.idDescargo
    };
  }

  /**
   * Estado con el que queda el equipo en Controles y en Gestión de Equipos según la acción
   * posterior elegida en el descargo (§21). En Controles siempre queda «Descargado»; lo que
   * cambia es el matiz que se muestra al lado y el estado del equipo en Gestión de Equipos.
   */
  estadoTrasDescargo(accion: AccionPosteriorDescargo): { controles: string; gestion: string } {
    switch (accion) {
      case 'Reingresar a Hardware':
        return { controles: 'Descargado', gestion: 'Reingresado a Hardware' };
      case 'Enviar a nueva preparación':
        return { controles: 'Descargado', gestion: 'Reingresado a Hardware para nueva preparación' };
      case 'Dejar pendiente de revisión':
        return { controles: 'Descargado / Pendiente de revisión', gestion: 'Pendiente de revisión' };
      case 'Preparar para reasignación':
        return { controles: 'Descargado', gestion: 'Disponible para nueva asignación' };
      case 'Marcar como no disponible':
        return { controles: 'Descargado / No disponible', gestion: 'No disponible' };
      case 'Enviar a garantía':
        return { controles: 'Descargado / En garantía', gestion: 'Enviado a garantía' };
      default:
        return { controles: 'Descargado', gestion: 'Descargado' };
    }
  }

  /**
   * Registra la pertenencia del equipo a su Dirección/Unidad y lo incorpora al inventario
   * operativo de Controles. Se llama en un solo lugar —la aceptación del usuario final— porque
   * ese es el único momento en que el equipo pasa a pertenecer a una Dirección/Unidad (§1).
   */
  private registrarPertenencia(id: string): void {
    const asig = this.asignacionDe(id);
    const inventario = asig?.equipoInventario ?? this.conformidadDeProceso(id)?.inventario ?? '';
    if (!inventario) return;
    if (this.controles().some((c) => c.expediente === id && c.inventario === inventario
      && c.estado === 'Activo en Dirección/Unidad')) return;
    const ficha = this.fichaControles(id, inventario, this.hoy());
    if (!ficha) return;
    this.controles.update((list) => [ficha, ...list.filter((c) => !(c.expediente === id && c.inventario === inventario))]);

    const dirUni = ficha.direccion === ficha.unidad ? ficha.direccion : `${ficha.direccion} / ${ficha.unidad}`;
    const ref = {
      modulo: 'Inventario operativo de Controles', inventario, direccion: ficha.direccion,
      unidad: ficha.unidad, soporteResponsable: ficha.soporteResponsable,
      tecnicoConfiguracion: ficha.tecnicoConfiguracion, expedienteUnico: ficha.expedienteUnico,
      usuarioFinal: ficha.usuarioFinal
    };
    this.registrarEvento(id, 'Sistema',
      `Equipo ${inventario} asociado a ${dirUni}`, 'Activo en Dirección/Unidad',
      'El equipo pertenece a la Dirección/Unidad desde la aceptación del usuario final, no antes.',
      true, { ...ref, estadoAnterior: 'Pendiente de aceptación', estadoControles: 'Activo en Dirección/Unidad' });
    if (ficha.soporteResponsable) {
      this.registrarEvento(id, 'Sistema',
        `Soporte responsable determinado: ${ficha.soporteResponsable.split('—')[0].trim()}`, 'Activo en Dirección/Unidad',
        `Según la distribución de soportes vigente de ${dirUni}.`, false, ref);
    } else {
      // Sin distribución no hay a quién señalar. Se deja dicho en la trazabilidad en vez de
      // inventar un responsable: el Encargado tiene que configurar la distribución.
      this.registrarEvento(id, 'Sistema',
        'Soporte responsable pendiente de determinar', 'Activo en Dirección/Unidad',
        `${dirUni} no tiene Técnicos de Soporte en la distribución vigente.`, false, ref);
    }
    this.registrarEvento(id, 'Sistema',
      `Equipo ${inventario} incorporado al inventario operativo de Controles`, 'Activo en Dirección/Unidad',
      'Solo los equipos aceptados por el usuario final pasan a Controles.', false,
      { ...ref, estadoControles: 'Activo en Dirección/Unidad' });
    this.registrarEvento(id, 'Sistema',
      'Equipo disponible para controles mensuales', 'Disponible para controles mensuales',
      '', false, { ...ref, estadoControles: 'Activo en Dirección/Unidad' });
    // Y se publica en el inventario operativo COMPARTIDO, que es lo que lee Controles Mensuales.
    this.syncAcceptedEquipmentToOperationalInventory(id, ficha);
  }

  /**
   * Publica el equipo aceptado en el inventario operativo compartido del ecosistema. Es el punto
   * exacto en que Controles Mensuales se entera: no hay botón que incorporar el equipo allá.
   * Idempotente — reabrir la pantalla o volver a guardar la aceptación no duplica el registro.
   */
  private syncAcceptedEquipmentToOperationalInventory(id: string, ficha: EquipoControles): void {
    // El expediente técnico se lleva por número de inventario, no por requerimiento.
    const expTecnico = this.expedientesTecnicos().find((x) => x.inventario === ficha.inventario)?.codigo ?? '';
    const { resultado, registro, anterior } = this.inventarioCompartido.registrarAceptacion({
      numeroInventario: ficha.inventario,
      tipoEquipo: ficha.tipoEquipo,
      marca: ficha.marca, modelo: ficha.modelo, serie: ficha.serie,
      nombreEquipo: ficha.nombreEquipo ?? '',
      ip: ficha.ip ?? '', mac: ficha.mac ?? '',
      usuarioFinal: ficha.usuarioFinal, correoUsuarioFinal: ficha.correoInstitucional,
      direccion: ficha.direccion, unidad: ficha.unidad,
      tecnicoConfiguracion: ficha.tecnicoConfiguracion,
      soporteResponsable: ficha.soporteResponsable,
      expediente: id,
      expedienteUnico: ficha.expedienteUnico,
      expedienteTecnico: expTecnico,
      fechaAceptacion: ficha.fechaAceptacion,
      garantia: ficha.garantia
    });

    const dirUni = registro.direccion === registro.unidad
      ? registro.direccion : `${registro.direccion} / ${registro.unidad}`;
    const ref = {
      modulo: 'Inventario operativo compartido', inventario: registro.numeroInventario,
      direccion: registro.direccion, unidad: registro.unidad,
      usuarioFinal: registro.usuarioFinal, expedienteUnico: registro.expedienteUnico,
      soporteResponsable: registro.soporteResponsable, estadoControles: registro.estadoOperativo
    };

    if (resultado === 'sin-cambios') {
      // No se reescribe nada, pero queda constancia de que el intento se detectó y se evitó.
      this.registrarEvento(id, 'Sistema',
        `Intento de sincronización duplicada evitado (${registro.numeroInventario})`,
        'Activo en Dirección/Unidad',
        'El equipo ya figuraba activo en el inventario operativo compartido con los mismos datos.',
        false, { ...ref, estadoAnterior: 'Activo en Dirección/Unidad' });
      return;
    }
    if (resultado === 'nuevo-ciclo' && anterior) {
      this.registrarEvento(id, 'Sistema',
        `Ciclo operativo anterior de ${registro.numeroInventario} pasado a histórico`, 'Histórico',
        `El equipo inicia un nuevo ciclo en ${dirUni}; el registro de ${anterior.direccion} / ${anterior.unidad} se conserva como historia.`,
        false, { ...ref, estadoAnterior: 'Activo en Dirección/Unidad', estadoControles: 'Histórico' });
    }
    this.registrarEvento(id, 'Sistema',
      resultado === 'actualizado'
        ? `Equipo ${registro.numeroInventario} actualizado en el inventario operativo compartido`
        : `Equipo ${registro.numeroInventario} incorporado automáticamente al inventario operativo de Controles Mensuales`,
      'Activo en Dirección/Unidad',
      `${dirUni} · usuario final ${registro.usuarioFinal}${registro.ip ? ` · IP ${registro.ip}` : ' · sin reserva de IP'}. Sincronizado a las ${registro.fechaSincronizacion.slice(11)}.`,
      true, { ...ref, estadoAnterior: 'Pendiente de aceptación' });
    if (!registro.soporteResponsable) {
      this.registrarEvento(id, 'Sistema',
        'La Dirección/Unidad del equipo no tiene Técnico de Soporte asignado en la distribución',
        'Activo en Dirección/Unidad',
        `${dirUni} no figura en la distribución de soportes vigente: el equipo queda activo pero sin responsable en Controles Mensuales.`,
        true, ref);
    }
  }

  /**
   * Motivo por el que este usuario NO puede registrar el descargo del equipo, o '' si puede.
   * Pueden hacerlo el Técnico de Soporte responsable de la Dirección/Unidad donde el equipo está
   * activo, el Encargado de Soporte y el Administrador (§19). Un Técnico de Soporte de otra
   * Dirección/Unidad no puede, aunque sea Soporte.
   */
  bloqueoDescargo(inventario: string): string {
    const clave = this.claveConectada();
    if (clave === 'tec-hardware') {
      return 'El Técnico de Hardware no registra descargos: el equipo está bajo la Dirección/Unidad de un Técnico de Soporte.';
    }
    if (clave === 'enc-hardware') {
      return 'El Encargado de Hardware no registra descargos de equipos activos en una Dirección/Unidad.';
    }
    if (clave === 'enc-soporte' || clave === 'admin') return '';
    if (clave !== 'tec-soporte') return 'No tiene permisos para registrar descargos.';
    const control = this.controlActivoDe(inventario);
    // Un equipo aceptado antes de que existiera el inventario de Controles no tiene ficha; en ese
    // caso se cae a la Dirección/Unidad del requerimiento, que es la misma fuente del dato.
    const asig = this.asignacionDeEquipo(inventario);
    const dirUni = control
      ? { direccion: control.direccion, unidad: control.unidad }
      : asig ? this.dirUnidadDeSolicitud(asig.expediente) : { direccion: '', unidad: '' };
    if (!dirUni.direccion || !dirUni.unidad) return '';
    const yo = this.usuarioConectadoTexto();
    return this.atiendeDireccionUnidad(yo, dirUni.direccion, dirUni.unidad) ? '' : this.MSG_DESCARGO_FUERA_DIRECCION;
  }

  /** Las cinco comprobaciones del inicio de un descargo (§18), con su estado, para mostrarlas. */
  validacionesDescargo(inventario: string): { texto: string; ok: boolean }[] {
    const control = this.controlActivoDe(inventario);
    const asig = this.asignacionDeEquipo(inventario);
    const clave = this.claveConectada();
    const yo = this.usuarioConectadoTexto();
    const dirUni = control ? { direccion: control.direccion, unidad: control.unidad }
      : asig ? this.dirUnidadDeSolicitud(asig.expediente) : { direccion: '', unidad: '' };
    return [
      { texto: 'Equipo está activo en una Dirección/Unidad', ok: !!control || (!!asig && !!dirUni.direccion) },
      { texto: 'Equipo tiene Usuario Final asociado', ok: !!asig?.usuarioFinal },
      { texto: 'Equipo tiene soporte responsable asignado',
        ok: !!(control?.soporteResponsable || this.tecnicosDeDireccionUnidad(dirUni.direccion, dirUni.unidad).length) },
      { texto: 'El usuario que realiza el descargo es Técnico de Soporte',
        ok: clave === 'tec-soporte' || clave === 'enc-soporte' || clave === 'admin' },
      { texto: 'El Técnico de Soporte está asignado a esa Dirección/Unidad',
        ok: clave !== 'tec-soporte' || this.atiendeDireccionUnidad(yo, dirUni.direccion, dirUni.unidad) }
    ];
  }

  /**
   * Retira el equipo del inventario activo de su Dirección/Unidad. No borra la ficha: la cierra
   * conservando a qué Dirección/Unidad y a qué usuario final perteneció, porque el descargo no
   * deshace la historia del equipo, la termina.
   */
  private retirarDeControles(d: Descargo, motivoAdministrativo: string): void {
    const control = this.controlActivoDe(d.inventario);
    const ficha = control ?? this.fichaControles(d.asignacionRelacionada, d.inventario, this.hoy());
    if (!ficha) return;
    const cerrada = this.fichaDescargada(ficha, d);
    const estados = this.estadoTrasDescargo(d.accionPosterior);
    this.controles.update((list) => {
      const sinEsta = list.filter((c) => !(c.inventario === d.inventario && c.expediente === d.asignacionRelacionada));
      return [cerrada, ...sinEsta];
    });

    const dirUni = ficha.direccion === ficha.unidad ? ficha.direccion : `${ficha.direccion} / ${ficha.unidad}`;
    const ref = {
      modulo: 'Inventario operativo de Controles', inventario: d.inventario,
      direccion: ficha.direccion, unidad: ficha.unidad,
      soporteResponsable: ficha.soporteResponsable, usuarioFinal: ficha.usuarioFinal,
      expedienteUnico: ficha.expedienteUnico, descargo: d.idDescargo,
      accionPosterior: d.accionPosterior
    };
    this.registrarEvento(d.asignacionRelacionada, d.responsableRegistro,
      'Validación de soporte responsable realizada', 'Descargo autorizado',
      this.claveConectada() === 'tec-soporte'
        ? `${d.responsableRegistro.split('—')[0].trim()} atiende ${dirUni}.`
        : `Descargo administrativo autorizado por ${this.rolConectado()}.`,
      false, { ...ref, rol: this.rolConectado() });
    this.registrarEvento(d.asignacionRelacionada, d.responsableRegistro,
      `Equipo ${d.inventario} retirado del inventario activo de ${dirUni}`, 'Descargado de Dirección/Unidad',
      `Usuario final anterior: ${ficha.usuarioFinal}. Motivo: ${d.motivoDescargo}.`, true,
      { ...ref, estadoAnterior: 'Activo en Dirección/Unidad', estadoControles: 'Descargado de Dirección/Unidad' });
    this.registrarEvento(d.asignacionRelacionada, d.responsableRegistro,
      `Equipo ${d.inventario} retirado del inventario operativo activo de Controles`, estados.controles,
      'Deja de contar en los controles mensuales; su historial se conserva.', false,
      { ...ref, estadoAnterior: 'Disponible para controles mensuales', estadoControles: estados.controles });
    this.registrarEvento(d.asignacionRelacionada, d.responsableRegistro,
      `Acción posterior al descargo registrada: ${d.accionPosterior}`, estados.gestion,
      motivoAdministrativo || d.observaciones, false,
      { ...ref, estadoControles: estados.controles });

    // El inventario operativo compartido también se cierra: Controles Mensuales dejará de ver el
    // equipo como activo sin que allá haya que aplicar nada a mano.
    const cerrado = this.inventarioCompartido.registrarDescargo(d.inventario, {
      fechaDescargo: d.fechaDescargo || this.hoy(),
      motivoDescargo: d.motivoDescargo,
      accionPosterior: d.accionPosterior
    });
    if (cerrado) {
      this.registrarEvento(d.asignacionRelacionada, d.responsableRegistro,
        `Equipo ${d.inventario} retirado del inventario operativo compartido`, 'Descargado',
        `Controles Mensuales dejará de contarlo como activo en ${dirUni}. Sincronizado a las ${cerrado.fechaSincronizacion.slice(11)}.`,
        true, { ...ref, modulo: 'Inventario operativo compartido',
          estadoAnterior: 'Activo en Dirección/Unidad', estadoControles: 'Descargado' });
    }
  }

  // ---------- Expediente técnico ----------
  /** EXP-PT-AÑO-CORRELATIVO: el correlativo se reinicia cada año. */
  private siguienteCodigoExpTec(): string {
    return this.siguienteCodigoPorAnio(
      `EXP-PT-${this.anioActual()}-`,
      this.expedientesTecnicos().map((x) => x.codigo)
    );
  }

  /** Arma el checklist F0288 dinámico según condición, tipo de equipo y unidad que prepara. */
  private plantillaF0288(unidad: 'Soporte' | 'Hardware', condicion: 'Nuevo' | 'Usado', tipo: 'Laptop' | 'Desktop'):
    { secciones: ChecklistSeccion[]; ocultas: SeccionOculta[]; falla?: VerificacionFalla; accesorios?: VerificacionAccesorios } {
    const item = (nombre: string, nota = '') => ({ nombre, estado: 'Pendiente' as const, evidencia: null, nota });
    const secciones: ChecklistSeccion[] = [];
    const ocultas: SeccionOculta[] = [];
    let falla: VerificacionFalla | undefined;
    let accesorios: VerificacionAccesorios | undefined;

    if (condicion === 'Usado') {
      // Equipo usado: preguntas Sí/No con campos dinámicos según la respuesta (no checklist plano).
      // «¿Se verificaron accesorios del equipo?» tiene su propia pregunta, separada de la de falla,
      // para no confundirlas: cada una es una tarjeta independiente en la pantalla de preparación.
      falla = { respuesta: '', fallaEncontrada: '', diagnostico: '', accionRealizada: '', observaciones: '' };
      // La familia depende del TIPO de equipo, no de su número de inventario: los equipos se
      // numeran `2201-NNNN-AAAA` y los accesorios `2201-00-101|920-XXXX-SS`, así que el accesorio
      // nunca comparte número base con su equipo principal.
      const familia = tipo === 'Desktop' ? FAMILIA_ACCESORIO_CPU : FAMILIA_ACCESORIO_LAPTOP;
      const acc = (nombre: string, sufijoEsperado: string) => ({
        nombre, familiaEsperada: familia, sufijoEsperado, seleccionado: false, numeroInventario: '',
        resultadoBusqueda: '' as const, marca: '', modelo: '', serie: '', estadoFisico: '',
        observacion: '', verificadoPor: '', fechaVerificacion: ''
      });
      // El conjunto de accesorios depende del tipo de equipo: CPU usado → Monitor/Teclado/Mouse;
      // Laptop usada → Mouse/Maletín (no se muestran otros accesorios).
      accesorios = {
        respuesta: '',
        accesorios: tipo === 'Desktop'
          ? [acc('Monitor', '02'), acc('Teclado', '03'), acc('Mouse', '04')]
          : [acc('Mouse', '02'), acc('Maletín', '03')],
        observaciones: ''
      };
    } else {
      ocultas.push(
        { nombre: 'Verificación de falla', motivo: 'No aplica a un equipo nuevo; el checklist dinámico la oculta.' },
        { nombre: 'Verificación de accesorios', motivo: 'No aplica a un equipo nuevo; el checklist dinámico la oculta.' }
      );
    }
    // «.NET Framework» va aquí y no en la sección de software institucional: es un componente de
    // Windows que se habilita como característica del sistema, parte de dejar el sistema operativo
    // listo. Su versión sale del catálogo (SOFT-008), no se escribe a mano.
    secciones.push({
      titulo: 'Sistema operativo, componentes de Windows y cuenta administrador',
      items: [
        { ...item('Instalación de Windows'), ...this.enlaceSoftware('SOFT-001', 'F0288') },
        item('Instalar actualizaciones'), item('Controladores'),
        { ...item('.NET Framework 3.5', 'Se habilita como característica de Windows cuando aplique.'),
          ...this.enlaceSoftware('SOFT-008', 'F0288') },
        item('Habilitar cuenta Administrador'),
        item('Asignar contraseña Admin', 'Se registra la acción; la contraseña nunca se almacena.')
      ]
    });
    secciones.push({
      titulo: 'Configuración básica',
      items: [
        item('Servicios (proced. remoto, registro, ubicador, update)'),
        item('Perfiles de Firewall (dominio, privado, público)')
      ]
    });
    // Antivirus y OCS Inventory son parte de la preparación técnica que hace Hardware: van siempre
    // en el F0288, enlazados al catálogo de software y con captura de evidencia obligatoria.
    // Credenciales, ingreso a dominio y Agente DLP salieron del F0288: son actividades del Técnico
    // de Soporte y se realizan en la Configuración F0302.
    const software: ChecklistItem[] = [
      { ...item('Instalación de Antivirus'), ...this.enlaceSoftware('SOFT-003', 'F0288'), requiereEvidencia: true },
      { ...item('Instalación de OCS Inventory'), ...this.enlaceSoftware('SOFT-004', 'F0288'), requiereEvidencia: true }
    ];
    if (unidad === 'Soporte') {
      software.push(item('Office / Chrome / Acrobat'));
    } else {
      ocultas.push({
        nombre: 'Office / Chrome / Acrobat',
        motivo: 'Lo instala Soporte durante la configuración; el checklist dinámico lo oculta cuando prepara Hardware.'
      });
    }
    secciones.push({ titulo: 'Instalación de software institucional', items: software });
    return { secciones, ocultas, falla, accesorios };
  }

  /**
   * Crea el expediente técnico de un equipo del Inventario de Hardware que aún no está
   * preparado. Pertenece al equipo (sin solicitud ni requerimiento) y genera su checklist
   * F0288 pendiente: la preparación es el siguiente paso obligatorio.
   */
  crearExpedienteTecnico(datos: {
    inventario: string; unidadResponsable: 'Soporte' | 'Hardware';
    creadoPor: string; tecnicoPreparacion: string; observaciones: string; prioridad?: 'Normal' | 'Alta';
  }): ExpedienteTecnico | string {
    const eq = this.equipoDe(datos.inventario);
    if (!eq || !this.puedeCrearNuevoExpedienteTecnico(datos.inventario)) return 'No se puede crear el expediente técnico para este equipo.';
    // El Expediente técnico se trabaja preferentemente por Hardware; si se elige Soporte, la
    // justificación en observaciones es obligatoria (regla confirmada por el usuario).
    if (datos.unidadResponsable === 'Soporte' && !datos.observaciones.trim()) {
      return 'Debe justificar en observaciones por qué este Expediente técnico será trabajado por la Unidad de Soporte.';
    }
    // Se captura antes de crear el nuevo, para poder referenciarlo en el evento si es un reingreso.
    const anterior = this.expedientesTecnicosDeEquipo(datos.inventario)[0];
    const tipo: TipoExpedienteTecnico =
      eq.tipo === 'Laptop'
        ? (eq.condicion === 'Nuevo' ? 'Laptop nueva' : 'Laptop usada')
        : (eq.condicion === 'Nuevo' ? 'CPU nuevo' : 'CPU usado');
    const nuevo: ExpedienteTecnico = {
      codigo: this.siguienteCodigoExpTec(),
      inventario: eq.inventario,
      tipoEquipo: eq.tipo,
      condicion: eq.condicion,
      marcaModelo: `${eq.marca} ${eq.modelo}`,
      unidadResponsable: datos.unidadResponsable,
      creadoPor: datos.creadoPor,
      tecnicoPreparacion: datos.tecnicoPreparacion,
      tipoExpediente: tipo,
      observaciones: datos.observaciones,
      estado: 'En preparación',
      fecha: this.hoy(),
      prioridad: datos.prioridad ?? 'Normal'
    };
    this.expedientesTecnicos.update((list) => [nuevo, ...list]);
    // Se enlaza este expediente técnico con el ingreso a Hardware que lo originó (el más
    // reciente que todavía no tenía expediente técnico asociado).
    this.ingresosHardware.update((list) => {
      const ultimo = list.filter((i) => i.inventario === eq.inventario && !i.expedienteTecnicoAsociado)
        .sort((a, b) => (b.fechaIngreso + b.horaIngreso).localeCompare(a.fechaIngreso + a.horaIngreso))[0];
      return ultimo
        ? list.map((i) => (i.idIngresoHardware === ultimo.idIngresoHardware ? { ...i, expedienteTecnicoAsociado: nuevo.codigo } : i))
        : list;
    });

    // El expediente técnico alimenta el F0288: se genera su checklist pendiente.
    const plantilla = this.plantillaF0288(datos.unidadResponsable, eq.condicion, eq.tipo);
    const prep: PreparacionF0288 = {
      expedienteTecnico: nuevo.codigo,
      unidad: datos.unidadResponsable,
      tecnico: datos.tecnicoPreparacion,
      creadoPor: datos.creadoPor,
      fecha: this.hoy(),
      estado: 'En preparación',
      datosGenerales: {
        provieneDe: 'Inventario de Hardware',
        referencia: `Preparación del equipo ${eq.inventario}`,
        inventario: eq.inventario,
        ram: eq.ram.split('·')[0].trim(),
        disco: eq.disco.replace(' · Serie', ' ·')
      },
      seccionesOcultas: plantilla.ocultas,
      secciones: plantilla.secciones,
      verificacionFalla: plantilla.falla,
      verificacionAccesorios: plantilla.accesorios,
      evidencias: [],
      firma: {
        quien: datos.tecnicoPreparacion.replace(' — ', ' · '),
        detalle: 'Se registra al finalizar la preparación técnica',
        estado: 'Pendiente de cierre',
        fecha: ''
      }
    };
    this.preparaciones.update((list) => [prep, ...list]);

    // Carga laboral y pendientes del técnico al momento de asignarle este expediente (se anota en
    // el detalle del evento de creación en vez de generar un evento aparte por cada consulta).
    const nombreTecnico = datos.tecnicoPreparacion.split('—')[0].trim();
    const carga = this.cargaHardwareDe(nombreTecnico);
    const pendientes = this.expedientesPendientesPorPreparar(nombreTecnico).length;
    const detalleCarga = `Carga laboral del técnico al asignar: ${carga.carga} — ${carga.total} procesos activos `
      + `(${this.resumenCargaHardware(carga)}; ${pendientes} pendientes por preparar).`;

    if (anterior) {
      // Reingreso: el equipo ya tenía un expediente técnico (ahora histórico); se referencia
      // explícitamente en el evento, junto con el motivo del reingreso que lo originó.
      const motivoReingreso = this.ingresosDeEquipo(eq.inventario)
        .find((i) => i.expedienteTecnicoAsociado === nuevo.codigo)?.motivoIngreso ?? '—';
      this.registrarEvento(nuevo.codigo, datos.creadoPor,
        `Nuevo Expediente técnico ${nuevo.codigo} creado por reingreso a Hardware del equipo ${eq.inventario}`,
        'En preparación',
        `Expediente anterior: ${anterior.codigo} (${anterior.estado}) — se conserva como histórico, no se reutiliza. ` +
          `Motivo del reingreso: ${motivoReingreso}. Técnico de preparación asignado: ${datos.tecnicoPreparacion}. ${detalleCarga}`,
        true,
        { modulo: 'Expediente técnico', estadoAnterior: 'Pendiente de preparación', inventario: eq.inventario, expedienteTecnico: nuevo.codigo });
    } else {
      this.registrarEvento(nuevo.codigo, datos.creadoPor,
        `Expediente técnico ${nuevo.codigo} creado para el equipo ${eq.inventario}`, 'En preparación',
        `Técnico de preparación asignado: ${datos.tecnicoPreparacion}. ${detalleCarga}`, true,
        { modulo: 'Expediente técnico', estadoAnterior: 'Pendiente de preparación', inventario: eq.inventario, expedienteTecnico: nuevo.codigo });
    }
    if (datos.unidadResponsable === 'Soporte') {
      this.registrarEvento(nuevo.codigo, datos.creadoPor,
        `Expediente técnico ${nuevo.codigo} asignado a la Unidad de Soporte con justificación`, 'En preparación',
        `Justificación: ${datos.observaciones.trim()}`, false,
        { modulo: 'Expediente técnico', inventario: eq.inventario, expedienteTecnico: nuevo.codigo });
    } else {
      this.registrarEvento(nuevo.codigo, datos.creadoPor,
        `Expediente técnico ${nuevo.codigo} asignado a la Unidad de Hardware`, 'En preparación', '', false,
        { modulo: 'Expediente técnico', inventario: eq.inventario, expedienteTecnico: nuevo.codigo });
    }
    // Una inconformidad ya no crea Expedientes técnicos: se atiende con una corrección F0302 o con
    // un reproceso F0288 sobre el expediente que el equipo ya tiene.
    return nuevo;
  }

  // ---------- Expediente único ----------
  /**
   * El Expediente único une solicitud, usuario final, equipo preparado, expediente técnico,
   * F0288, técnico de configuración y las fases posteriores (F0302, entrega, garantía).
   * Requiere solicitud, equipo asignado, expediente técnico completado y F0288 finalizado.
   */
  crearExpedienteUnico(id: string, tecnicoConfiguracion: string, usuario: string): ExpedienteUnico | null {
    const s = this.solicitud(id);
    const asig = this.asignacionDe(id);
    const tec = this.expTecnicoDe(id);
    const prep = tec ? this.preparacionPorCodigo(tec.codigo) : undefined;
    if (!s || !asig || !tec || tec.estado !== 'Preparado' || (prep && prep.estado !== 'Completada')) return null;
    // Una solicitud pertenece a un solo Expediente único: si ya lo tiene, no se crea otro.
    if (this.expedienteUnicoDe(id)) return null;
    // El Técnico de Configuración debe pertenecer a la distribución de soporte de la
    // Dirección/Unidad solicitante (§7/§11). La pantalla ya filtra el listado, pero la puerta
    // vive aquí: filtrar es una comodidad, la regla no puede depender de qué se mostró.
    if (this.bloqueoExpedienteUnico(id, tecnicoConfiguracion)) return null;

    // La carga laboral del Técnico de Configuración se deja registrada ANTES de crear nada: es la
    // que tenía al momento de asignarle este proceso, no la que tendrá ya con él encima (§12).
    const dirUniSel = this.dirUnidadDeSolicitud(id);
    this.registrarSeleccionSoporte(tecnicoConfiguracion, usuario, {
      expediente: id, modulo: 'Expediente único', direccion: dirUniSel.direccion,
      unidad: dirUniSel.unidad, inventario: asig.equipoInventario
    });

    // EXP-AÑO-CORRELATIVO: el correlativo del Expediente único también se reinicia por año.
    const codigo = this.siguienteCodigoPorAnio(
      `EXP-${this.anioActual()}-`,
      this.expedientesUnicos().map((x) => x.codigoUnico)
    );

    const nuevo: ExpedienteUnico = {
      expediente: id,
      codigoUnico: codigo,
      estado: 'En configuración',
      resumenEstado: 'En configuración',
      fechaEntrega: '',
      anexos: [
        { nombre: 'Solicitud / requerimiento', detalle: this.tipoRequerimientoTexto(s), estado: 'Anexado', fecha: s.fecha },
        { nombre: 'Asignación del equipo', detalle: `Asignado por ${asig.responsableAsignacion}`, estado: 'Anexado', fecha: asig.fecha },
        { nombre: 'Se anexa expediente de preparación técnica', detalle: `${tec.codigo} · ${tec.tipoExpediente}`, estado: 'Anexado', fecha: this.hoy() },
        { nombre: 'Se anexa configuración del equipo', detalle: `Técnico de configuración: ${tecnicoConfiguracion}`, estado: 'Pendiente', fecha: '' },
        prep?.estado === 'Completada'
          ? { nombre: 'F0288 generado', detalle: 'Generado al finalizar la preparación técnica', estado: 'Generado', fecha: prep.firma.fecha || this.hoy() }
          : { nombre: 'F0288 generado', detalle: 'Se genera al cerrar la preparación técnica', estado: 'Pendiente', fecha: '' },
        { nombre: 'F0302 generado', detalle: 'Se genera al cerrar la configuración', estado: 'Pendiente', fecha: '' },
        { nombre: 'Evidencias técnicas complementarias', detalle: 'Se cargan durante las fases técnicas', estado: 'Pendiente', fecha: '' },
        { nombre: 'Firmas registradas', detalle: 'Se registran al cierre de cada fase', estado: '0 de 3', fecha: '' },
        { nombre: 'Formulario de conformidad', detalle: 'Se envía al correo institucional al finalizar la configuración', estado: 'No enviado', fecha: '' },
        { nombre: 'Entrega y aceptación', detalle: 'Pendiente', estado: 'Pendiente', fecha: '' },
        { nombre: 'Servicio de garantía', detalle: 'Se habilita con la aceptación del usuario final; su vigencia depende del tipo de garantía', estado: 'No iniciada', fecha: '' },
        { nombre: 'Reporte final de auditoría', detalle: 'Consolida el expediente completo', estado: 'Pendiente', fecha: '' }
      ]
    };
    this.expedientesUnicos.update((list) => [nuevo, ...list]);
    this.asignaciones.update((list) =>
      list.map((a) => (a.expediente === id
        ? { ...a, responsablesFase: { ...a.responsablesFase, tecnicoConfiguracion, estadoConfiguracion: 'En configuración' } }
        : a))
    );
    // El documento F0288 (generado con el código del expediente técnico) se re-asocia al proceso.
    this.documentos.update((list) =>
      list.map((d) => (d.expediente === tec.codigo ? { ...d, expediente: id } : d))
    );
    // Se habilita de inmediato la Configuración F0302 con su checklist pendiente.
    if (!this.configuracionDe(id)) {
      const eq = this.equipoDe(asig.equipoInventario);
      // El checklist F0302 arranca SIN software: no hay una lista fija obligatoria para todos los
      // casos. El software depende del requerimiento del usuario final y el Técnico de Soporte lo
      // agrega desde el Catálogo de Software permitido durante la configuración; lo que ya instaló
      // la Preparación F0288 se hereda y se muestra bloqueado, sin copiarse aquí.
      // Sí quedan fijas las actividades generales de configuración —Agente DLP, ingreso a dominio
      // y credenciales—, que no son software de catálogo: son tareas del Técnico de Soporte y
      // salieron del F0288 (donde estaban por error) porque no son preparación técnica de Hardware.
      const actividad = (nombre: string, version: string, categoria: string, requiereEvidencia = false): SoftwareF0302 =>
        ({ nombre, version, estado: 'Pendiente', evidencia: null, categoria, origen: 'Configuración', requiereEvidencia });
      // Solo los dos controles especiales: cada uno se decide de a uno y arrastra su propia
      // obligación. Las credenciales de SISSOR ya no son una casilla del checklist —no son una
      // actividad que el técnico ejecute— y se muestran como información de referencia.
      const software: SoftwareF0302[] = [
        // El Agente DLP es control de seguridad institucional: no se da por configurado sin captura.
        actividad('Agente DLP', 'Corporativo', 'Seguridad', true),
        actividad('Ingreso a dominio', 'Dominio institucional', 'Red')
      ];
      const nuevaConf: ConfiguracionF0302 = {
        expediente: id,
        tecnico: tecnicoConfiguracion,
        seleccionadoPor: usuario,
        fecha: '',
        estado: 'En curso',
        datos: {
          requerimiento: this.tipoRequerimientoTexto(s),
          inventario: asig.equipoInventario,
          // El nombre del equipo lo digita el Técnico de Soporte dentro del checklist F0302: no se
          // propone uno automático, porque es dato del expediente y responde a la convención de la
          // unidad (p. ej. `DT-KRIVAS-045`), no al número de inventario.
          nombrePC: '',
          tipoServicio: 'Asignación de equipo',
          asignadoA: s.destinatario,
          carne: s.carne,
          direccionGerencia: s.direccionGerencia,
          unidad: s.unidadDestino,
          puesto: 'Según registro de RRHH',
          sistemaOperativo: eq?.sistemaOperativo || 'Windows 11 Pro',
          arquitectura: 'x64',
          // La reserva de IP no forma parte del checklist F0302: se pregunta en el modal previo al
          // envío del formulario de conformidad, junto con la MAC y la solicitud a Servidores.
          requiereReservaIP: '',
          ipReservada: '',
          // La MAC se autocompleta desde el registro institucional del equipo cuando lo trae.
          macEquipo: this.equipoDe(asig.equipoInventario)?.mac ?? '',
          justificacionSinReservaIP: '',
          estadoSolicitudIP: '',
          correoReservaEnviado: '',
          fechaSolicitudIP: ''
        },
        software,
        // Las capturas de Antivirus y OCS Inventory son evidencia del F0288 y el F0302 las hereda
        // bloqueadas: aquí solo quedan las evidencias propias de la configuración. La del Agente
        // DLP se completa con el archivo cuando el técnico la carga (`registrarEvidenciaSoftwareF0302`).
        evidencias: [
          { nombre: 'Ingreso exitoso al dominio institucional', estado: 'Pendiente' },
          { nombre: 'Captura de instalación/configuración del Agente DLP', estado: 'Pendiente',
            item: 'Agente DLP', tipo: 'Agente DLP', formulario: 'F0302' },
          { nombre: 'Configuración final para el usuario', estado: 'Pendiente' }
        ],
        firmas: {
          preparo: {
            quien: tec.tecnicoPreparacion.replace(' — ', ' · '),
            detalle: 'Firma registrada al cerrar el F0288',
            estado: prep?.estado === 'Completada' ? 'Firmado' : 'Pendiente de cierre',
            fecha: prep?.firma.fecha ?? ''
          },
          configuro: {
            quien: tecnicoConfiguracion.replace(' — ', ' · '),
            detalle: 'Se registra al finalizar la configuración',
            estado: 'Pendiente de cierre',
            fecha: ''
          }
        }
      };
      this.configuraciones.update((list) => [nuevaConf, ...list]);
    }
    this.setEstadoSolicitud(id, 'En configuración', 'Checklist F0302');
    const dirUni = this.dirUnidadDeSolicitud(id);
    this.registrarEvento(id, usuario,
      `Técnico de configuración validado por Dirección/Unidad: ${tecnicoConfiguracion.split('—')[0].trim()}`,
      'En configuración',
      `Pertenece a la distribución de soporte de ${dirUni.direccion === dirUni.unidad ? dirUni.direccion : `${dirUni.direccion} / ${dirUni.unidad}`}. `
        + `Asignación realizada por ${usuario}.`,
      false,
      { modulo: 'Expediente único', inventario: asig.equipoInventario, expedienteUnico: codigo,
        direccion: dirUni.direccion, unidad: dirUni.unidad, tecnicoConfiguracion,
        tecnicoSoporte: tecnicoConfiguracion, rol: this.rolConectado() });
    this.registrarEvento(id, usuario, `Expediente único ${codigo} creado; continúa la Configuración F0302`, 'En configuración',
      `Técnico de configuración: ${tecnicoConfiguracion}.`, true,
      { modulo: 'Expediente único', estadoAnterior: 'Asignada', inventario: asig.equipoInventario,
        expedienteTecnico: tec.codigo, expedienteUnico: codigo, usuarioFinal: asig.usuarioFinal });
    return nuevo;
  }

  actualizarAnexo(id: string, nombre: string, estado: string, detalle?: string): void {
    this.expedientesUnicos.update((list) =>
      list.map((x) => (x.expediente === id
        ? {
            ...x,
            anexos: x.anexos.map((a) =>
              a.nombre === nombre ? { ...a, estado, detalle: detalle ?? a.detalle, fecha: this.hoy() } : a)
          }
        : x))
    );
  }

  // ---------- Checklists ----------
  /** Las preparaciones F0288 se identifican por el código del expediente técnico (funciona con o sin solicitud). */
  preparacionPorCodigo(codigoTec: string): PreparacionF0288 | undefined {
    return this.preparaciones().find((p) => p.expedienteTecnico === codigoTec);
  }

  /** Actualiza la preparación indicada aplicando una transformación inmutable. */
  private actualizarPreparacion(codigoTec: string, cambio: (p: PreparacionF0288) => PreparacionF0288): void {
    this.preparaciones.update((list) =>
      list.map((p) => (p.expedienteTecnico === codigoTec ? cambio(p) : p))
    );
  }

  /** Responde o edita la pregunta «¿Se realizó verificación de falla?» y sus campos dinámicos. */
  actualizarVerificacionFalla(codigoTec: string, cambios: Partial<VerificacionFalla>): void {
    this.actualizarPreparacion(codigoTec, (p) =>
      p.verificacionFalla ? { ...p, verificacionFalla: { ...p.verificacionFalla, ...cambios } } : p
    );
  }

  /** Responde la pregunta «¿Se verificaron accesorios del equipo?» o edita sus observaciones. */
  actualizarVerificacionAccesorios(codigoTec: string, cambios: Partial<Omit<VerificacionAccesorios, 'accesorios'>>): void {
    this.actualizarPreparacion(codigoTec, (p) =>
      p.verificacionAccesorios ? { ...p, verificacionAccesorios: { ...p.verificacionAccesorios, ...cambios } } : p
    );
  }

  private mapaAccesorio(codigoTec: string, nombre: string, cambio: (a: AccesorioVerificado) => AccesorioVerificado): void {
    this.actualizarPreparacion(codigoTec, (p) =>
      p.verificacionAccesorios
        ? { ...p, verificacionAccesorios: { ...p.verificacionAccesorios, accesorios: p.verificacionAccesorios.accesorios.map((a) => (a.nombre === nombre ? cambio(a) : a)) } }
        : p
    );
  }

  /** Marca o desmarca un accesorio (checkbox). Al desmarcar se limpia su ficha: hay que volver a buscarlo si se vuelve a marcar. */
  seleccionarAccesorio(codigoTec: string, nombre: string, seleccionado: boolean, usuario: string): void {
    const p = this.preparacionPorCodigo(codigoTec);
    this.mapaAccesorio(codigoTec, nombre, (a) => (seleccionado
      ? { ...a, seleccionado }
      : { ...a, seleccionado, numeroInventario: '', resultadoBusqueda: '', marca: '', modelo: '', serie: '',
          estadoFisico: '', observacion: '', verificadoPor: '', fechaVerificacion: '' }));
    if (p && seleccionado) {
      this.registrarEvento(codigoTec, usuario, `Accesorio seleccionado: ${nombre}`, 'Verificación de accesorios iniciada',
        '', false, { modulo: 'Preparación técnica F0288', inventario: p.datosGenerales.inventario, expedienteTecnico: codigoTec });
    }
  }

  /** Cambia el número de inventario escrito para un accesorio, antes de buscarlo. */
  escribirNumeroAccesorio(codigoTec: string, nombre: string, numero: string): void {
    this.mapaAccesorio(codigoTec, nombre, (a) => ({ ...a, numeroInventario: numero, resultadoBusqueda: '' }));
  }

  /** Cambia la observación de un accesorio en particular. */
  escribirObservacionAccesorio(codigoTec: string, nombre: string, observacion: string): void {
    this.mapaAccesorio(codigoTec, nombre, (a) => ({ ...a, observacion }));
  }

  private readonly formatoAccesorio = /^2201-00-(101|920)-\d{4}-\d{2}$/;

  /**
   * Normaliza el número de accesorio antes de buscarlo: quita espacios (incluidos los de en medio,
   * frecuentes al pegar desde una hoja de cálculo) y pasa a mayúsculas, conservando los guiones.
   */
  private normalizarNumeroAccesorio(numero: string): string {
    return (numero ?? '').replace(/\s+/g, '').toUpperCase();
  }

  /** Etiqueta del tipo de equipo según la familia del accesorio, para mensajes y eventos. */
  private tipoPorFamilia(familia: string): 'Laptop' | 'CPU' {
    return familia === FAMILIA_ACCESORIO_LAPTOP ? 'Laptop' : 'CPU';
  }

  /**
   * ¿El accesorio ya está asociado a otro F0288 vigente? Solo cuentan las preparaciones de OTRO
   * expediente técnico donde el accesorio quedó marcado y encontrado. No cuenta el historial
   * cerrado: una preparación «Cerrada» (por descargo) o de un expediente técnico ya cerrado es
   * archivo, y su accesorio puede volver a asociarse a otro equipo.
   */
  private accesorioAsociadoActivamente(numero: string, codigoTecActual: string): PreparacionF0288 | undefined {
    return this.preparaciones().find((otra) => {
      if (otra.expedienteTecnico === codigoTecActual || otra.estado === 'Cerrada') return false;
      const tec = this.expedientesTecnicos().find((x) => x.codigo === otra.expedienteTecnico);
      if (tec?.estado === 'Cerrado') return false;
      return (otra.verificacionAccesorios?.accesorios ?? [])
        .some((a) => a.seleccionado && a.resultadoBusqueda === 'Encontrado' && a.numeroInventario.trim() === numero);
    });
  }

  /**
   * Familia de accesorios de una preparación guardada antes de que `familiaEsperada` existiera:
   * se deduce del tipo del equipo y, si el equipo ya no está, del conjunto de accesorios (solo
   * la laptop lleva Maletín; solo el CPU lleva Monitor o Teclado).
   */
  private familiaAccesoriosDe(p: PreparacionF0288): string {
    const tipo = this.equipoDe(p.datosGenerales.inventario)?.tipo;
    if (tipo) return tipo === 'Desktop' ? FAMILIA_ACCESORIO_CPU : FAMILIA_ACCESORIO_LAPTOP;
    const nombres = (p.verificacionAccesorios?.accesorios ?? []).map((a) => a.nombre);
    return nombres.includes('Maletín') ? FAMILIA_ACCESORIO_LAPTOP : FAMILIA_ACCESORIO_CPU;
  }

  /**
   * Busca un accesorio en la base institucional simulada. Valida, en orden: formato del número,
   * familia del equipo (CPU `2201-00-101` / Laptop `2201-00-920`), sufijo del accesorio
   * seleccionado, existencia en la base y que no esté ya asociado a otro F0288 vigente.
   *
   * **El correlativo del accesorio no tiene que coincidir con el del equipo principal**: son
   * bienes con numeración independiente (los equipos son `2201-NNNN-AAAA`), así que exigir el
   * mismo número base hacía que la búsqueda nunca encontrara nada. Nunca autocompleta datos
   * inventados: si la validación falla, la ficha queda vacía.
   */
  consultarAccesorio(codigoTec: string, nombre: string, usuario: string): string | null {
    const p = this.preparacionPorCodigo(codigoTec);
    const acc = p?.verificacionAccesorios?.accesorios.find((a) => a.nombre === nombre);
    if (!p || !acc) return 'No se encontró el accesorio indicado.';
    const inventarioEquipo = p.datosGenerales.inventario;
    const numero = this.normalizarNumeroAccesorio(acc.numeroInventario);
    const familia = acc.familiaEsperada || this.familiaAccesoriosDe(p);
    const tipoEquipo = this.tipoPorFamilia(familia);
    // La búsqueda va contra la base GLOBAL de accesorios: no se derivan del equipo principal ni
    // del método de ingreso (individual, múltiple o por rango), que no intervienen en la consulta.
    const ficha = this.catalogoAccesorios().find((f) => f.numeroInventario === numero);
    const duplicado = this.accesorioAsociadoActivamente(numero, codigoTec);

    let resultado: ResultadoConsultaAccesorio;
    let mensaje: string;
    if (!this.formatoAccesorio.test(numero)) {
      resultado = 'Formato inválido';
      mensaje = 'El número de inventario del accesorio no tiene un formato válido.';
    } else if (!numero.startsWith(`${familia}-`)) {
      resultado = 'No corresponde al equipo';
      mensaje = tipoEquipo === 'Laptop'
        ? 'El accesorio no corresponde a una Laptop.'
        : 'El accesorio no corresponde al tipo de equipo seleccionado.';
    } else if (numero.slice(-2) !== acc.sufijoEsperado) {
      resultado = 'No corresponde al accesorio';
      mensaje = 'El número ingresado no corresponde al accesorio seleccionado.';
    } else if (!ficha) {
      resultado = 'No encontrado';
      mensaje = 'No se encontró información del accesorio en la base institucional simulada.';
    } else if (duplicado) {
      resultado = 'Asociado a otro equipo';
      mensaje = 'Este accesorio ya se encuentra asociado a otro equipo activo. Verifique antes de continuar.';
    } else {
      resultado = 'Encontrado';
      mensaje = 'Accesorio encontrado en la base institucional simulada.';
    }
    const asociado = resultado === 'Encontrado';
    this.mapaAccesorio(codigoTec, nombre, (a) => ({
      // Se guarda el número ya normalizado: lo que queda en el F0288 y en el documento es el
      // número limpio, no lo que se tecleó o pegó con espacios.
      ...a, numeroInventario: numero, resultadoBusqueda: resultado,
      marca: asociado ? ficha!.marca : '', modelo: asociado ? ficha!.modelo : '',
      serie: asociado ? ficha!.serie : '', estadoFisico: asociado ? ficha!.estadoFisico : '',
      verificadoPor: asociado ? usuario : '', fechaVerificacion: asociado ? `${this.hoy()} ${this.hora()}` : ''
    }));
    // Contexto común de los eventos: además de fecha, hora, usuario y rol que ya guarda
    // `registrarEvento`, cada evento deja el equipo principal, el expediente técnico, el accesorio
    // consultado y el resultado.
    const contexto = { modulo: 'Preparación técnica F0288', inventario: inventarioEquipo, expedienteTecnico: codigoTec };
    // El evento nombra el tipo de equipo («Accesorio de Laptop…», «Accesorio de CPU…») para poder
    // filtrar la trazabilidad por el flujo que se estaba probando.
    const rotulo = `Accesorio de ${tipoEquipo}`;
    const ref = `${nombre} (${numero || 'sin número'})`;
    const detalle = `${tipoEquipo} principal: ${inventarioEquipo}. Accesorio seleccionado: ${nombre} ` +
      `(familia ${familia}, sufijo -${acc.sufijoEsperado}). Número consultado: ${numero || 'sin número'}. ` +
      `Resultado: ${resultado}. ${mensaje}`;
    this.registrarEvento(codigoTec, usuario,
      `${rotulo} consultado en base institucional simulada: ${ref}`, resultado, detalle, false, contexto);
    switch (resultado) {
      case 'Encontrado':
        this.registrarEvento(codigoTec, usuario, `${rotulo} encontrado: ${ref}`, 'Encontrado',
          `${ficha!.tipo} ${ficha!.marca} ${ficha!.modelo} · serie ${ficha!.serie} · estado ${ficha!.estadoFisico}.`,
          false, contexto);
        this.registrarEvento(codigoTec, usuario, `${rotulo} asociado a F0288: ${ref}`, 'Encontrado',
          `Verificado por ${usuario}.`, false, contexto);
        break;
      case 'No encontrado':
        this.registrarEvento(codigoTec, usuario, `${rotulo} no encontrado: ${ref}`, 'No encontrado',
          mensaje, false, contexto);
        break;
      case 'Formato inválido':
        this.registrarEvento(codigoTec, usuario, `${rotulo} rechazado por formato inválido: ${ref}`,
          'Formato inválido', mensaje, false, contexto);
        break;
      case 'No corresponde al equipo':
      case 'No corresponde al accesorio':
        this.registrarEvento(codigoTec, usuario,
          `${rotulo} rechazado por no corresponder al ${resultado === 'No corresponde al equipo' ? 'tipo de equipo' : 'accesorio seleccionado'}: ${ref}`,
          resultado, mensaje, false, contexto);
        break;
      case 'Asociado a otro equipo':
        this.registrarEvento(codigoTec, usuario, `${rotulo} rechazado por duplicado activo: ${ref}`,
          'Asociado a otro equipo',
          `${mensaje} Ya está asociado al expediente técnico ${duplicado!.expedienteTecnico} (equipo ${duplicado!.datosGenerales.inventario}).`,
          false, contexto);
        break;
    }
    return null;
  }

  /**
   * Marca o desmarca un ítem del checklist F0288. Cuando el ítem viene del catálogo de software
   * (`codigoSoftware`), al marcarlo se le asigna la versión vigente si aún no tenía una elegida
   * (sin pisar una versión ya escogida a mano) y al desmarcarlo se limpia la versión: la versión
   * solo tiene sentido mientras el software está marcado. Solo genera el evento «Software
   * seleccionado» cuando el ítem es de catálogo y pasa de no-Realizado a Realizado (no en cada
   * clic de un ítem normal ni al desmarcar).
   */
  marcarItemF0288(codigoTec: string, seccion: string, item: string, estado: 'Realizado' | 'Pendiente', usuario: string): void {
    let codigoSoftware: string | undefined;
    let eraRealizado = false;
    let seRetiroCaptura = false;
    this.preparaciones.update((list) =>
      list.map((p) => (p.expedienteTecnico === codigoTec
        ? {
            ...p,
            secciones: p.secciones.map((sec) =>
              sec.titulo === seccion
                ? { ...sec, items: sec.items.map((i) => {
                    if (i.nombre !== item) return i;
                    codigoSoftware = i.codigoSoftware;
                    eraRealizado = i.estado === 'Realizado';
                    // Al desmarcar un ítem que exige captura, su evidencia deja de tener respaldo:
                    // se retira con el ítem para no dejar la captura de algo que no está instalado.
                    const evidencia = estado === 'Pendiente' && i.requiereEvidencia ? null : i.evidencia;
                    if (evidencia !== i.evidencia) seRetiroCaptura = true;
                    if (!i.codigoSoftware) return { ...i, estado, evidencia };
                    const vigente = this.softwareCatalogoDe(i.codigoSoftware)?.versionVigente ?? '';
                    return estado === 'Realizado'
                      ? { ...i, estado, evidencia, versionSeleccionada: i.versionSeleccionada || vigente }
                      : { ...i, estado, evidencia, versionSeleccionada: '' };
                  }) }
                : sec)
          }
        : p))
    );
    if (seRetiroCaptura) {
      this.actualizarPreparacion(codigoTec, (x) => ({ ...x, evidencias: x.evidencias.filter((e) => e.item !== item) }));
    }
    if (codigoSoftware && estado === 'Realizado' && !eraRealizado) {
      const p = this.preparacionPorCodigo(codigoTec);
      const sw = this.softwareCatalogoDe(codigoSoftware);
      if (p && sw) {
        const version = p.secciones.flatMap((s) => s.items)
          .find((i) => i.nombre === item)?.versionSeleccionada || sw.versionVigente;
        this.registrarEvento(codigoTec, usuario, `Software seleccionado: ${sw.nombre}`, 'Realizado',
          `Versión: ${version} · Categoría: ${sw.categoria} · Formulario: F0288 · Registrado desde el Catálogo de Software (${sw.codigo}).`,
          false,
          { modulo: 'Preparación técnica F0288', inventario: p.datosGenerales.inventario, expedienteTecnico: codigoTec });
      }
    }
  }

  /**
   * Checkbox «Seleccionar todo» de una sección del checklist F0288: marca o desmarca todos sus
   * ítems aplicables a la vez. Los ítems de catálogo reciben su versión vigente al marcarse (si
   * no tenían una ya elegida) y pierden la versión al desmarcarse, igual que al marcarlos uno a
   * uno.
   */
  marcarSeccionCompletaF0288(codigoTec: string, seccion: string, estado: 'Realizado' | 'Pendiente', usuario: string): void {
    // Ítems de la categoría que exigen captura: al desmarcarla completa, sus evidencias se retiran
    // igual que al desmarcarlos uno a uno.
    const conCaptura = estado === 'Pendiente'
      ? (this.preparacionPorCodigo(codigoTec)?.secciones.find((s) => s.titulo === seccion)?.items ?? [])
          .filter((i) => i.requiereEvidencia).map((i) => i.nombre)
      : [];
    this.preparaciones.update((list) =>
      list.map((p) => (p.expedienteTecnico === codigoTec
        ? { ...p,
            secciones: p.secciones.map((sec) => (sec.titulo === seccion
              ? { ...sec, items: sec.items.map((i) => {
                  if (i.estado === 'No solicitado' || i.estado === 'No aplica') return i;
                  const evidencia = estado === 'Pendiente' && i.requiereEvidencia ? null : i.evidencia;
                  if (!i.codigoSoftware) return { ...i, estado, evidencia };
                  const vigente = this.softwareCatalogoDe(i.codigoSoftware)?.versionVigente ?? '';
                  return estado === 'Realizado'
                    ? { ...i, estado, evidencia, versionSeleccionada: i.versionSeleccionada || vigente }
                    : { ...i, estado, evidencia, versionSeleccionada: '' };
                }) }
              : sec)),
            evidencias: p.evidencias.filter((e) => !conCaptura.includes(e.item))
          }
        : p))
    );
    const p = this.preparacionPorCodigo(codigoTec);
    if (p) {
      this.registrarEvento(codigoTec, usuario, `Categoría completa seleccionada en checklist: ${seccion} (${estado})`, estado, '', false,
        { modulo: 'Preparación técnica F0288', inventario: p.datosGenerales.inventario, expedienteTecnico: codigoTec });
    }
  }

  /** Selecciona la versión de un software del catálogo dentro de un ítem del checklist F0288 (p. ej. «Instalación de Windows»). */
  seleccionarVersionItemF0288(codigoTec: string, seccion: string, item: string, version: string, usuario: string): void {
    this.preparaciones.update((list) =>
      list.map((p) => (p.expedienteTecnico === codigoTec
        ? { ...p, secciones: p.secciones.map((sec) => (sec.titulo === seccion
            ? { ...sec, items: sec.items.map((i) => (i.nombre === item ? { ...i, versionSeleccionada: version } : i)) }
            : sec)) }
        : p))
    );
    const p = this.preparacionPorCodigo(codigoTec);
    if (p) {
      this.registrarEvento(codigoTec, usuario, `Versión de software seleccionada: ${item} — ${version}`, 'Realizado', '', false,
        { modulo: 'Preparación técnica F0288', inventario: p.datosGenerales.inventario, expedienteTecnico: codigoTec });
    }
  }

  /**
   * Registra la captura de evidencia de un ítem del checklist F0288 que la exige (Antivirus y OCS
   * Inventory). Sin esta captura el F0288 no se puede finalizar ni generar su documento.
   */
  registrarEvidenciaItemF0288(codigoTec: string, seccion: string, item: string, archivo: string,
    usuario: string, tipoEvidencia = '', imagen = ''): string | null {
    const captura = archivo.trim();
    const p = this.preparacionPorCodigo(codigoTec);
    if (!p) return 'No se encontró la preparación técnica indicada.';
    if (p.estado === 'Completada') return 'Esta preparación ya fue finalizada; su evidencia no se puede modificar.';
    if (p.estado === 'Cerrada') return 'Esta preparación quedó cerrada por un descargo del equipo y ya no puede reutilizarse.';
    const actual = p.secciones.find((s) => s.titulo === seccion)?.items.find((i) => i.nombre === item);
    if (!actual) return 'No se encontró el ítem del checklist indicado.';
    if (actual.estado !== 'Realizado') return `Marque «${item}» en el checklist antes de registrar su captura de evidencia.`;
    const etiqueta = this.etiquetaEvidencia(item);
    // La captura del ítem es una imagen como cualquier otra evidencia: se valida y se guarda en el
    // almacén común, y el ítem conserva el nombre del archivo para el documento F0288.
    const error = this.adjuntarEvidencia({
      modulo: 'Preparación F0288', proceso: codigoTec, expediente: codigoTec,
      inventario: p.datosGenerales.inventario, archivo: captura,
      tipo: tipoEvidencia || 'Instalación validada', usuario, imagen, item
    });
    if (error) return error;
    this.actualizarPreparacion(codigoTec, (x) => ({
      ...x,
      secciones: x.secciones.map((sec) => (sec.titulo === seccion
        ? { ...sec, items: sec.items.map((i) => (i.nombre === item ? { ...i, evidencia: captura } : i)) }
        : sec)),
      // Una captura por ítem: volver a registrarla reemplaza la anterior, no acumula filas.
      evidencias: [
        ...x.evidencias.filter((e) => e.item !== item),
        { item, tipo: `Captura de ${etiqueta}`, cargadaPor: usuario.split('—')[0].trim(), fecha: this.hoy(), estado: 'Cargada' }
      ]
    }));
    this.registrarEvento(codigoTec, usuario, `Captura de ${etiqueta} registrada`, 'Realizado',
      `Evidencia registrada: ${captura}.`, false,
      { modulo: 'Preparación técnica F0288', inventario: p.datosGenerales.inventario, expedienteTecnico: codigoTec,
        evidencia: captura, tipoEvidencia: tipoEvidencia || 'Instalación validada', estadoValidacion: 'Válida' });
    return null;
  }

  // ---------- Evidencias con imagen: una sola puerta para todos los módulos ----------

  /** Módulo de evidencia al que pertenece un proceso, para la trazabilidad. */
  private moduloTrazabilidad(modulo: ModuloEvidencia): string {
    return modulo === 'Preparación F0288' ? 'Preparación técnica F0288'
      : modulo === 'Reproceso F0288' ? 'Reprocesos F0288'
        : modulo === 'Descargo' ? 'Descargo de equipo'
          : modulo === 'Garantía' ? 'Servicio de garantía' : modulo;
  }

  /**
   * Adjunta una imagen de evidencia en cualquier módulo. La validación es la del servicio de
   * evidencias —formato, tipo y duplicados—; aquí solo se anota quién la cargó y sobre qué.
   */
  adjuntarEvidencia(datos: {
    modulo: ModuloEvidencia; proceso: string; expediente: string; inventario?: string;
    archivo: string; tipo: string; usuario: string; imagen?: string; item?: string;
  }): string | null {
    const resultado = this.evid.agregar({
      modulo: datos.modulo, proceso: datos.proceso, expediente: datos.expediente,
      archivo: datos.archivo, tipo: datos.tipo, cargadaPor: datos.usuario,
      rol: this.rolDeUsuario(datos.usuario), item: datos.item, imagen: datos.imagen
    });
    if (typeof resultado === 'string') return resultado;
    this.registrarEvento(datos.expediente, datos.usuario, 'Imagen de evidencia cargada',
      `${datos.modulo} en proceso`, `${resultado.archivo} · ${resultado.tipo}`, false,
      { modulo: this.moduloTrazabilidad(datos.modulo), inventario: datos.inventario,
        rol: this.rolDeUsuario(datos.usuario), evidencia: resultado.archivo,
        tipoEvidencia: resultado.tipo, estadoValidacion: 'Válida',
        accionTomada: `Imagen adjuntada al proceso ${datos.proceso}` });
    return null;
  }

  /** Quita una imagen de evidencia y deja constancia de ello. */
  eliminarEvidencia(modulo: ModuloEvidencia, proceso: string, expediente: string,
    archivo: string, usuario: string): string | null {
    const resultado = this.evid.eliminar(modulo, proceso, archivo);
    if (typeof resultado === 'string') return resultado;
    this.registrarEvento(expediente, usuario, 'Imagen de evidencia eliminada',
      `${modulo} en proceso`, `${resultado.archivo} · ${resultado.tipo}`, false,
      { modulo: this.moduloTrazabilidad(modulo), rol: this.rolDeUsuario(usuario),
        evidencia: resultado.archivo, tipoEvidencia: resultado.tipo, estadoValidacion: 'Retirada',
        accionTomada: `Imagen retirada del proceso ${proceso}` });
    return null;
  }

  /** Deja constancia de quién abrió una imagen; una vez por usuario e imagen. */
  registrarConsultaEvidenciaTecnica(modulo: ModuloEvidencia, proceso: string, expediente: string,
    archivo: string, usuario: string): void {
    const evidencia = this.evid.de(modulo, proceso).find((e) => e.archivo === archivo);
    if (!evidencia) return;
    const clave = `Imagen de evidencia visualizada·${modulo}·${proceso}·${archivo}·${usuario}`;
    if (this.consultasRegistradas.has(clave)) return;
    this.consultasRegistradas.add(clave);
    this.registrarEvento(expediente, usuario, 'Imagen de evidencia visualizada', `${modulo}`,
      `${evidencia.archivo} · ${evidencia.tipo}`, false,
      { modulo: this.moduloTrazabilidad(modulo), rol: this.rolDeUsuario(usuario),
        evidencia: evidencia.archivo, tipoEvidencia: evidencia.tipo, estadoValidacion: 'Consultada',
        accionTomada: `Consulta de la imagen de evidencia de ${proceso}` });
  }

  /**
   * Guardián común de las etapas que no se pueden cerrar sin respaldo visual. Devuelve el mensaje
   * del módulo y **anota el intento**: un cierre frenado por falta de evidencia es parte de la
   * historia del expediente, no un error que se pierde en un aviso.
   */
  exigirEvidencia(modulo: ModuloConEvidenciaObligatoria, proceso: string, expediente: string,
    usuario: string, inventario?: string): string | null {
    const falta = this.evid.faltaEvidencia(modulo, proceso);
    if (!falta) return null;
    this.registrarEvento(expediente, usuario, 'Intento de finalizar sin evidencia requerida',
      `${modulo} en proceso`, falta, false,
      { modulo: this.moduloTrazabilidad(modulo), inventario, rol: this.rolDeUsuario(usuario),
        estadoValidacion: 'Sin evidencia', accionTomada: `Cierre bloqueado en ${proceso}` });
    return falta;
  }

  /** Anota que la etapa cerró con su respaldo visual, y con cuál. */
  registrarCierreConEvidencia(modulo: ModuloEvidencia, proceso: string, expediente: string,
    usuario: string, inventario?: string): void {
    const lista = this.evid.de(modulo, proceso);
    if (!lista.length) return;
    this.registrarEvento(expediente, usuario, 'Proceso finalizado con evidencia', `${modulo} finalizado`,
      lista.map((e) => `${e.archivo} · ${e.tipo}`).join(' · '), false,
      { modulo: this.moduloTrazabilidad(modulo), inventario, rol: this.rolDeUsuario(usuario),
        evidencia: lista.map((e) => e.archivo).join(', '),
        tipoEvidencia: [...new Set(lista.map((e) => e.tipo))].join(', '),
        estadoValidacion: 'Válida',
        accionTomada: `${lista.length} imagen(es) respaldan el cierre de ${proceso}` });
  }

  // ---------- Evidencia exigida por ítem: F0288 y F0302 ----------

  /**
   * Aviso —y anotación— cuando falta la imagen de un ítem que la exige. Devuelve el mensaje o null.
   *
   * Es el equivalente de `exigirEvidencia` para las etapas donde la imagen no la pide el proceso
   * entero sino ítems concretos. El intento bloqueado queda igual en la trazabilidad: un cierre
   * frenado por falta de evidencia es parte de la historia del expediente.
   */
  private exigirImagenDeItems(modulo: ModuloEvidencia, proceso: string, expediente: string,
    usuario: string, faltantes: string[], mensaje: string, inventario?: string): string | null {
    if (!faltantes.length) return null;
    this.registrarEvento(expediente, usuario, 'Intento de finalizar sin evidencia requerida',
      `${modulo} en proceso`, mensaje, false,
      { modulo: this.moduloTrazabilidad(modulo), inventario, rol: this.rolDeUsuario(usuario),
        estadoValidacion: 'Sin evidencia',
        accionTomada: `Cierre bloqueado en ${proceso}: falta la imagen de ${faltantes.join(', ')}` });
    return mensaje;
  }

  /** Nombre con el que se anuncia el ítem en los avisos de evidencia. */
  private nombreEvidencia(nombreItem: string): string {
    const n = this.etiquetaEvidencia(nombreItem);
    return n === 'Antivirus' ? 'Antivirus institucional' : n;
  }

  /** Ítems del checklist F0288 marcados que exigen imagen y todavía no la tienen. */
  itemsSinCapturaF0288(p: PreparacionF0288): ChecklistItem[] {
    return p.secciones.flatMap((s) => s.items)
      .filter((i) => i.requiereEvidencia && i.estado === 'Realizado' && !i.evidencia?.trim());
  }

  /**
   * Lo que impide cerrar el F0288 por falta de imagen: solo el Antivirus institucional y el OCS
   * Inventory. Si falta uno, el aviso nombra ese; si faltan los dos, los nombra juntos.
   */
  private faltaImagenF0288(p: PreparacionF0288, usuario: string): string | null {
    const faltan = this.itemsSinCapturaF0288(p).map((i) => this.nombreEvidencia(i.nombre));
    if (!faltan.length) return null;
    const mensaje = faltan.length === 1
      ? `Debe adjuntar la imagen de evidencia de ${faltan[0]}.`
      : `Debe adjuntar la imagen de evidencia de ${faltan.slice(0, -1).join(', ')} y ${faltan[faltan.length - 1]} para finalizar la Preparación F0288.`;
    return this.exigirImagenDeItems('Preparación F0288', p.expedienteTecnico, p.expedienteTecnico,
      usuario, faltan, mensaje, p.datosGenerales.inventario);
  }

  /** Lo mismo en el F0302, donde el único ítem que exige imagen es el Agente DLP. */
  private faltaImagenF0302(c: ConfiguracionF0302, usuario: string): string | null {
    const faltan = this.itemsSinCapturaF0302(c).map((s) => s.nombre);
    if (!faltan.length) return null;
    const mensaje = `Debe adjuntar la imagen de evidencia del ${faltan[0]} para finalizar la Configuración F0302.`;
    return this.exigirImagenDeItems('Configuración F0302', c.expediente, c.expediente, usuario,
      faltan, mensaje, c.datos.inventario);
  }

  /** Nombres de las imágenes que respaldan un proceso, para guardarlas con el documento generado. */
  private evidenciasDelDocumento(modulo: ModuloEvidencia, proceso: string): string[] {
    return this.evid.de(modulo, proceso).map((e) => e.archivo);
  }

  /** Anota que un documento se generó con su respaldo visual asociado. */
  private registrarDocumentoConEvidencias(expediente: string, usuario: string, documento: string,
    modulo: ModuloEvidencia, proceso: string, inventario?: string): void {
    const lista = this.evid.de(modulo, proceso);
    if (!lista.length) return;
    this.registrarEvento(expediente, usuario, 'Documento generado con evidencias', `${modulo}`,
      `${documento} — ${lista.length} imagen(es) adjuntas.`, false,
      { modulo: this.moduloTrazabilidad(modulo), inventario, rol: this.rolDeUsuario(usuario),
        documento, evidencia: lista.map((e) => e.archivo).join(', '),
        tipoEvidencia: [...new Set(lista.map((e) => e.tipo))].join(', '),
        estadoValidacion: 'Válida', accionTomada: 'Evidencias asociadas al documento generado' });
  }

  /**
   * Evidencias de un expediente agrupadas por proceso, para el historial técnico. Incluye las del
   * reproceso, que siguen guardándose dentro del propio reproceso desde la ronda 54: moverlas
   * habría reescrito el contenido de una constancia ya firmada.
   */
  evidenciasDelExpediente(expediente: string): { etapa: string; proceso: string; lista: EvidenciaTecnica[] }[] {
    const grupos = new Map<string, { etapa: string; proceso: string; lista: EvidenciaTecnica[] }>();
    for (const e of this.evid.delExpediente(expediente)) {
      const clave = `${e.modulo}·${e.proceso}`;
      if (!grupos.has(clave)) grupos.set(clave, { etapa: e.modulo, proceso: e.proceso, lista: [] });
      grupos.get(clave)!.lista.push(e);
    }
    for (const r of this.reprocesos().filter((x) => x.expediente === expediente && x.evidencias.length)) {
      grupos.set(`Reproceso F0288·${r.id}`, {
        etapa: 'Reproceso F0288', proceso: r.id,
        lista: r.evidencias.map((e) => ({
          modulo: 'Reproceso F0288' as ModuloEvidencia, proceso: r.id, expediente: r.expediente,
          archivo: e.archivo, tipo: e.tipo, fecha: e.fecha, hora: e.hora,
          cargadaPor: e.cargadaPor, imagen: e.imagen, formato: e.formato
        }))
      });
    }
    return [...grupos.values()];
  }

  /** El detalle es obligatorio cuando hubo complejidad; sin responder Sí/No no se puede cerrar. */
  private validarCierre(cierre: CierreTecnico, proceso: string): string | null {
    if (!cierre.hubo) return `Responda Sí o No a «¿Hubo complejidad durante la ${proceso}?» antes de finalizar.`;
    if (cierre.hubo === 'Sí' && !cierre.detalle.trim()) {
      return 'Registre el detalle de la complejidad: es obligatorio cuando la respuesta es Sí.';
    }
    return null;
  }

  /** Detiene un cronómetro en curso y calcula la duración total en minutos. */
  private detenerCronometro(c: Cronometro, usuario: string): Cronometro {
    return {
      ...c, fechaFin: this.hoy(), horaFin: this.horaCrono(), finalizadoPor: usuario,
      duracionMinutos: this.minutosTranscurridos(c)
    };
  }

  /**
   * Inicia el cronómetro de la preparación F0288: registra fecha, hora y técnico que inició,
   * lo deja visible en pantalla y anota el evento en la trazabilidad del equipo.
   */
  iniciarPreparacion(codigoTec: string, usuario: string): string | null {
    const p = this.preparacionPorCodigo(codigoTec);
    if (!p) return 'No se encontró la preparación técnica indicada.';
    if (p.estado === 'Completada') return 'Esta preparación ya fue finalizada.';
    if (p.estado === 'Cerrada') return 'Esta preparación quedó cerrada por un descargo del equipo y ya no puede reutilizarse.';
    if (p.cronometro) return 'El cronómetro de esta preparación ya está en curso.';
    const crono: Cronometro = {
      fechaInicio: this.hoy(), horaInicio: this.horaCrono(), iniciadoPor: usuario,
      fechaFin: '', horaFin: '', finalizadoPor: '', duracionMinutos: null
    };
    this.actualizarPreparacion(codigoTec, (x) => ({ ...x, cronometro: crono }));
    this.registrarEvento(codigoTec, usuario, `Cronómetro F0288 iniciado para el expediente técnico ${codigoTec}`, 'En preparación',
      `Inicio del registro de tiempo de la preparación del equipo ${p.datosGenerales.inventario}.`, false,
      { modulo: 'Preparación técnica F0288', inventario: p.datosGenerales.inventario, expedienteTecnico: codigoTec });
    return null;
  }

  /**
   * Cierra la preparación F0288: valida el checklist, las verificaciones Sí/No y el registro
   * de complejidad, detiene el cronómetro y guarda tiempo total, complejidad y observación.
   * Devuelve null si se generó el documento, o el mensaje de la validación que falló.
   */
  cerrarPreparacion(codigoTec: string, usuario: string, cierre: CierreTecnico): string | null {
    const p = this.preparacionPorCodigo(codigoTec);
    if (!p) return 'No se encontró la preparación técnica indicada.';
    if (p.estado === 'Cerrada') return 'Esta preparación quedó cerrada por un descargo del equipo y ya no puede reutilizarse.';
    if (!p.cronometro) return 'Presione «Iniciar preparación» para comenzar el cronómetro antes de finalizar.';
    const pendientes = p.secciones.flatMap((s) => s.items).filter((i) => i.estado === 'Pendiente');
    if (pendientes.length > 0) return 'Complete todos los ítems aplicables del checklist antes de generar el F0288.';
    const sinVersion = p.secciones.flatMap((s) => s.items)
      .some((i) => i.codigoSoftware && i.estado === 'Realizado' && !i.versionSeleccionada?.trim());
    if (sinVersion) return 'Seleccione la versión de cada software marcado en el checklist antes de generar el F0288.';
    // Antivirus y OCS Inventory no se pueden dar por instalados sin su imagen: es el respaldo
    // técnico del F0288 y bloquea tanto el cierre como la generación del documento. Ningún otro
    // ítem del checklist bloquea el cierre por falta de fotografía.
    const sinCaptura = this.faltaImagenF0288(p, usuario);
    if (sinCaptura) return sinCaptura;
    const vf = p.verificacionFalla;
    if (vf) {
      if (!vf.respuesta) return 'Responda Sí o No a «¿Se realizó verificación de falla?» antes de generar el F0288.';
      if (vf.respuesta === 'Sí' && (!vf.fallaEncontrada.trim() || !vf.accionRealizada.trim())) {
        return 'Registre la falla encontrada y la acción realizada en la verificación de falla.';
      }
    }
    const va = p.verificacionAccesorios;
    if (va) {
      if (!va.respuesta) return 'Responda Sí o No a «¿Se verificaron accesorios del equipo?» antes de generar el F0288.';
      if (va.respuesta === 'Sí' && !va.accesorios.some((a) => a.seleccionado)) {
        return 'Seleccione al menos un accesorio verificado antes de generar el F0288.';
      }
      if (va.respuesta === 'Sí' && va.accesorios.some((a) => a.seleccionado && a.resultadoBusqueda !== 'Encontrado')) {
        return 'Busque y confirme cada accesorio seleccionado en la base institucional simulada antes de generar el F0288.';
      }
    }
    const errCierre = this.validarCierre(cierre, 'preparación');
    if (errCierre) return errCierre;

    const crono = this.detenerCronometro(p.cronometro, usuario);
    this.preparaciones.update((list) =>
      list.map((x) => (x.expedienteTecnico === codigoTec
        ? {
            ...x, estado: 'Completada', cronometro: crono, cierre,
            firma: { ...x.firma, estado: 'Firmado', fecha: this.hoy(), hora: this.hora(), detalle: 'Firmado electrónicamente al generar el F0288 (firma simulada)' }
          }
        : x))
    );
    // El documento F0288 queda registrado con el código del expediente técnico; al crear el
    // Expediente único se re-asocia a la solicitud correspondiente.
    this.documentos.update((list) => [...list, {
      tipo: 'F0288', expediente: codigoTec, generadoPor: usuario, fecha: this.hoy(), hash: this.hash(),
      inventario: p.datosGenerales.inventario, expedienteTecnico: codigoTec,
      evidencias: this.evidenciasDelDocumento('Preparación F0288', codigoTec)
    }]);
    this.expedientesTecnicos.update((list) =>
      list.map((x) => (x.codigo === codigoTec ? { ...x, estado: 'Preparado' as const } : x))
    );
    const tiempo = this.formatoDuracion(crono.duracionMinutos);
    // El evento de cierre deja constancia del software de catálogo instalado y su versión, para
    // que la trazabilidad diga con qué quedó preparado el equipo sin abrir el checklist.
    const instalado = p.secciones.flatMap((s) => s.items)
      .filter((i) => i.codigoSoftware && i.estado === 'Realizado')
      .map((i) => `${i.nombre}${i.versionSeleccionada ? ` ${i.versionSeleccionada}` : ''}`)
      .join(', ');
    this.registrarEvento(codigoTec, usuario, 'Preparación F0288 finalizada; documento F0288 generado y firmado. Equipo preparado y listo para asignación', 'Preparado',
      `Tiempo total: ${tiempo} · Complejidad: ${cierre.nivel}` +
        (instalado ? ` · Software instalado: ${instalado}` : '') +
        (cierre.hubo === 'Sí' ? ` · Detalle: ${cierre.detalle.trim()}` : (cierre.observacion.trim() ? ` · Observación: ${cierre.observacion.trim()}` : '')),
      true,
      { modulo: 'Preparación técnica F0288', estadoAnterior: 'En preparación', inventario: p.datosGenerales.inventario,
        expedienteTecnico: codigoTec, tiempo, complejidad: cierre.nivel });
    this.registrarCierreConEvidencia('Preparación F0288', codigoTec, codigoTec, usuario, p.datosGenerales.inventario);
    this.registrarDocumentoConEvidencias(codigoTec, usuario, 'F0288', 'Preparación F0288', codigoTec,
      p.datosGenerales.inventario);
    return null;
  }

  /**
   * Actualiza la configuración F0302 ACTIVA del proceso (la que no quedó «Con falla»). Un proceso
   * puede conservar configuraciones con falla como historial; estas nunca se mutan.
   */
  private actualizarConfiguracionActiva(id: string, cambio: (c: ConfiguracionF0302) => ConfiguracionF0302): void {
    this.configuraciones.update((list) =>
      list.map((c) => (c.expediente === id && c.estado !== 'Con falla' ? cambio(c) : c))
    );
  }

  /**
   * Marca o desmarca un software del checklist F0302. Cuando el software viene del catálogo
   * (`codigoSoftware`), al marcarlo se le asigna la versión vigente si aún no tenía una elegida
   * y al desmarcarlo se limpia la versión. Solo genera «Software seleccionado» cuando el software
   * es de catálogo y pasa de no-Realizado a Realizado.
   */
  marcarSoftwareF0302(id: string, nombre: string, estado: 'Realizado' | 'Pendiente' | 'No aplica', usuario: string): void {
    let codigoSoftware: string | undefined;
    let eraRealizado = false;
    let exigeCaptura = false;
    let eraNoAplica = false;
    this.actualizarConfiguracionActiva(id, (c) => ({
      ...c, software: c.software.map((s) => {
        if (s.nombre !== nombre) return s;
        codigoSoftware = s.codigoSoftware;
        eraRealizado = s.estado === 'Realizado';
        eraNoAplica = s.estado === 'No aplica';
        exigeCaptura = !!s.requiereEvidencia;
        // Al desmarcar un ítem con captura obligatoria, la captura deja de tener sentido: se limpia.
        // «No aplica» también la limpia: un ítem que no corresponde no lleva evidencia.
        const evidencia = s.requiereEvidencia && estado !== 'Realizado' ? null : s.evidencia;
        // Salir de «No aplica» retira su justificación: quedaría explicando un estado que ya no es.
        const noAplica = estado === 'No aplica'
          ? { justificacionNoAplica: s.justificacionNoAplica, noAplicaPor: usuario, fechaNoAplica: this.selloAhora() }
          : { justificacionNoAplica: '', noAplicaPor: undefined, fechaNoAplica: undefined };
        if (!s.codigoSoftware) return { ...s, estado, evidencia, ...noAplica };
        const vigente = this.softwareCatalogoDe(s.codigoSoftware)?.versionVigente ?? '';
        return estado === 'Realizado'
          ? { ...s, estado, evidencia, ...noAplica, version: s.version || vigente }
          : { ...s, estado, evidencia, ...noAplica, version: '' };
      }),
      evidencias: exigeCaptura && estado !== 'Realizado'
        ? c.evidencias.map((e) => (e.item === nombre
            ? { nombre: e.nombre, estado: estado === 'No aplica' ? 'No aplica' : 'Pendiente',
                item: e.item, tipo: e.tipo, formulario: e.formulario }
            : e))
        : c.evidencias
    }));
    if (exigeCaptura && estado === 'Realizado' && !eraRealizado) {
      const c = this.configuracionDe(id);
      this.registrarEvento(id, usuario, `${nombre} seleccionado en F0302`, 'Realizado',
        `Formulario: F0302 · Requiere captura de evidencia obligatoria para finalizar la configuración.`, false,
        { modulo: 'Configuración F0302', inventario: c?.datos.inventario,
          expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, nombreEquipo: c?.datos.nombrePC });
    }
    if (estado === 'No aplica' && !eraNoAplica) {
      this.registrarEvento(id, usuario, `${nombre} marcado como No aplica`, 'No aplica',
        'Requiere justificación obligatoria para finalizar la Configuración F0302.' +
          (exigeCaptura ? ' No se exige imagen de evidencia para un ítem que no aplica.' : ''),
        false, this.refItemF0302(id, nombre, 'No aplica'));
    }
    if (codigoSoftware && estado === 'Realizado' && !eraRealizado) {
      const sw = this.softwareCatalogoDe(codigoSoftware);
      const c = this.configuracionDe(id);
      if (sw && c) {
        const item = c.software.find((s) => s.codigoSoftware === codigoSoftware);
        this.registrarEvento(id, usuario, `Software instalado en F0302: ${sw.nombre}`, 'Realizado',
          `Software: ${sw.nombre} · Versión: ${item?.version || sw.versionVigente} · Categoría: ${sw.categoria} · ` +
            `Origen: F0302 · Formulario: F0302` + (item?.motivo ? ` · Motivo: ${item.motivo}` : '') +
            (item?.observacion?.trim() ? ` · Observación: ${item.observacion.trim()}` : ''), false,
          { modulo: 'Configuración F0302', inventario: c.datos.inventario, expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico });
      }
    }
  }

  /**
   * Checkbox «Seleccionar todo» de una categoría de la configuración general F0302 (p. ej. «Red»):
   * marca o desmarca todo el grupo a la vez. Solo alcanza a las actividades de configuración: el
   * software adicional del catálogo se marca uno a uno, porque cada ítem lleva su propio motivo.
   */
  marcarCategoriaSoftwareF0302(id: string, categoria: string, estado: 'Realizado' | 'Pendiente', usuario: string): void {
    // «Seleccionar todo» solo alcanza a los ítems simples. Los controles especiales —Agente DLP e
    // Ingreso a dominio— quedan fuera siempre, en cualquier estado: cada uno arrastra una imagen o
    // una justificación, y marcarlos en bloque produciría justo el registro sin respaldo que esas
    // obligaciones existen para evitar.
    const alcanza = (s: SoftwareF0302) =>
      s.origen === 'Configuración' && s.categoria === categoria && !this.esControlEspecialF0302(s.nombre);
    // «Seleccionar todo» NO exime de la captura: marca el ítem igual que a mano, así que el Agente
    // DLP queda «Realizado» y sin evidencia, y el cierre lo sigue bloqueando.
    const conCaptura = this.configuracionDe(id)?.software.filter((s) => alcanza(s) && s.requiereEvidencia) ?? [];
    this.actualizarConfiguracionActiva(id, (c) => ({
      ...c,
      software: c.software.map((s) => (alcanza(s)
        ? { ...s, estado, evidencia: s.requiereEvidencia && estado !== 'Realizado' ? null : s.evidencia }
        : s)),
      evidencias: estado === 'Realizado' ? c.evidencias : c.evidencias.map((e) =>
        (conCaptura.some((s) => s.nombre === e.item)
          ? { nombre: e.nombre, estado: 'Pendiente', item: e.item, tipo: e.tipo, formulario: e.formulario }
          : e))
    }));
    const c = this.configuracionDe(id);
    this.registrarEvento(id, usuario, `Categoría completa seleccionada en checklist: ${categoria} (${estado})`, estado,
      estado === 'Realizado' && conCaptura.length > 0
        ? `Formulario: F0302 · ${conCaptura.map((s) => s.nombre).join(' · ')} sigue(n) requiriendo captura de evidencia obligatoria.`
        : '',
      false,
      { modulo: 'Configuración F0302', inventario: c?.datos.inventario, expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico });
  }

  /**
   * Registra la captura de evidencia de un ítem del checklist F0302 que la exige (Agente DLP). La
   * carga es simulada —basta el nombre del archivo o su referencia—, pero guarda quién la cargó,
   * cuándo, de qué tipo es, a qué ítem respalda y en qué formulario, igual que lo haría un
   * repositorio real de evidencias.
   *
   * Devuelve null si quedó registrada, o el mensaje de la validación que falló.
   */
  registrarEvidenciaSoftwareF0302(id: string, nombre: string, archivo: string, usuario: string,
    tipoEvidencia = '', imagen = ''): string | null {
    const captura = archivo.trim();
    const c = this.configuracionDe(id);
    if (!c) return 'No se encontró la configuración indicada.';
    if (c.estado === 'Completada') return 'La configuración ya fue finalizada; su evidencia no se puede modificar.';
    if (c.estado === 'Con falla') return 'Esta configuración quedó con falla y el equipo volvió a F0288. Inicie una nueva configuración F0302.';
    if (c.estado === 'Cerrada') return 'Esta configuración quedó cerrada por un descargo del equipo y ya no puede reutilizarse.';
    const item = c.software.find((s) => s.nombre === nombre);
    if (!item) return 'No se encontró el ítem del checklist indicado.';
    if (item.estado !== 'Realizado') return `Marque «${nombre}» en el checklist antes de registrar su captura de evidencia.`;

    // La captura del ítem es una imagen como cualquier otra: se valida y se guarda en el almacén
    // común, y el ítem conserva el nombre del archivo para el documento F0302.
    const error = this.adjuntarEvidencia({
      modulo: 'Configuración F0302', proceso: id, expediente: id, inventario: c.datos.inventario,
      archivo: captura, tipo: tipoEvidencia || 'Configuración validada', usuario, imagen, item: nombre
    });
    if (error) return error;
    const sello = `${this.hoy()} ${this.hora().slice(0, 5)}`;
    const fila = {
      nombre: `Captura de instalación/configuración del ${nombre}`, estado: 'Cargada',
      item: nombre, archivo: captura, tipo: nombre,
      cargadaPor: usuario.split('—')[0].trim(), fecha: sello, formulario: 'F0302'
    };
    this.actualizarConfiguracionActiva(id, (x) => ({
      ...x,
      software: x.software.map((s) => (s.nombre === nombre ? { ...s, evidencia: captura } : s)),
      // Una captura por ítem: volver a registrarla reemplaza la anterior, no acumula filas.
      evidencias: [...x.evidencias.filter((e) => e.item !== nombre), fila]
    }));
    this.registrarEvento(id, usuario, `Captura de ${nombre} registrada`, 'Realizado',
      `Archivo: ${captura} · Tipo de evidencia: ${nombre} · Formulario: F0302 · Ítem: ${nombre} · Fecha de carga: ${sello}`,
      false,
      { modulo: 'Configuración F0302', inventario: c.datos.inventario,
        expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, nombreEquipo: c.datos.nombrePC });
    return null;
  }

  /**
   * ¿Esta categoría tiene ítems simples? Si solo contiene controles especiales, el «Seleccionar
   * todo» no tendría a qué aplicarse: ofrecerlo prometería una acción que no hace nada.
   */
  categoriaAdmiteSeleccionarTodo(c: ConfiguracionF0302, categoria: string): boolean {
    return this.itemsConfiguracionF0302(c)
      .some((s) => (s.categoria || 'Otros') === categoria && !this.esControlEspecialF0302(s.nombre));
  }

  // Los datos que SISSOR aporta —nombre de equipo, cuenta de red, usuario, Dirección/Unidad—
  // siguen viviendo en `ConfiguracionF0302.datos` y los usan el F0302, el expediente único y el
  // formulario de conformidad. Lo que no existe es una función que los agrupe para pintarlos como
  // bloque de credenciales: esa vista se retiró, y dejar el ayudante sin llamadas invitaría a
  // volver a montarla sin querer.

  /** Ítems del checklist F0302 marcados que exigen captura y todavía no la tienen. */
  itemsSinCapturaF0302(c: ConfiguracionF0302): SoftwareF0302[] {
    return this.softwareChecklistF0302(c)
      .filter((s) => s.requiereEvidencia && s.estado === 'Realizado' && !s.evidencia?.trim());
  }

  /** Selecciona la versión permitida de un software del catálogo dentro del checklist F0302. */
  seleccionarVersionSoftwareF0302(id: string, nombre: string, version: string, usuario: string): void {
    this.actualizarConfiguracionActiva(id, (c) => ({
      ...c, software: c.software.map((s) => (s.nombre === nombre ? { ...s, version } : s))
    }));
    const c = this.configuracionDe(id);
    const sw = c?.software.find((s) => s.nombre === nombre);
    this.registrarEvento(id, usuario, `Versión de software seleccionada en F0302: ${nombre} — ${version}`, 'Realizado',
      `Software: ${nombre} · Versión: ${version} · Origen: F0302` +
        (sw?.motivo ? ` · Motivo: ${sw.motivo}` : ''), false,
      { modulo: 'Configuración F0302', inventario: c?.datos.inventario, expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico });
  }

  // ---------- Software heredado del F0288 y software adicional del F0302 ----------
  // El software instalado durante la Preparación F0288 NO se copia al F0302: se lee del propio
  // F0288 y se muestra bloqueado, para que el Técnico de Soporte no lo vuelva a marcar ni pueda
  // agregarlo otra vez. Lo que sí es propio del F0302 es el software ADICIONAL, que depende del
  // requerimiento del usuario final y se elige del Catálogo de Software permitido.

  /** Motivos por los que puede agregarse un software adicional en la Configuración F0302. */
  readonly motivosSoftwareF0302: MotivoSoftwareF0302[] = [
    'Solicitado en requerimiento', 'Necesario para funciones del usuario',
    'Software institucional estándar', 'Requerido por unidad solicitante', 'Otro'
  ];

  /**
   * Software instalado durante la Preparación F0288 del proceso, tal como lo hereda el F0302:
   * los ítems del checklist F0288 enlazados al catálogo y ya realizados (Windows, .NET Framework,
   * Antivirus, OCS Inventory…), con la versión y la captura registradas en esa preparación.
   */
  softwareHeredadoF0288(id: string): SoftwareHeredadoF0288[] {
    const tec = this.expTecnicoDe(id);
    const prep = tec ? this.preparacionPorCodigo(tec.codigo) : undefined;
    if (!prep || !tec) return [];
    return prep.secciones
      .flatMap((s) => s.items)
      .filter((i) => i.codigoSoftware && i.estado === 'Realizado')
      .map((i) => {
        const sw = this.softwareCatalogoDe(i.codigoSoftware!);
        return {
          nombre: sw?.nombre ?? this.etiquetaEvidencia(i.nombre),
          // Las preparaciones antiguas no guardaban la versión elegida; se muestra la vigente del catálogo.
          version: i.versionSeleccionada?.trim() || sw?.versionVigente || '—',
          categoria: sw?.categoria ?? 'Otros',
          evidencia: i.evidencia ?? null,
          codigoSoftware: i.codigoSoftware!,
          item: i.nombre,
          expedienteTecnico: tec.codigo
        };
      });
  }

  /** Códigos de catálogo ya instalados en el F0288 del proceso: no pueden repetirse en el F0302. */
  private codigosHeredadosF0288(id: string): Set<string> {
    return new Set(this.softwareHeredadoF0288(id).map((s) => s.codigoSoftware));
  }

  /** Actividades generales de configuración del F0302 (dominio, credenciales, DLP): no son software del catálogo. */
  itemsConfiguracionF0302(c: ConfiguracionF0302): SoftwareF0302[] {
    return c.software.filter((s) => s.origen === 'Configuración');
  }

  /**
   * Software adicional del F0302: el que el Técnico de Soporte agregó según el requerimiento. Se
   * excluye el que ya viene heredado del F0288 —una configuración guardada por una versión
   * anterior podía repetirlo— para que un mismo software nunca aparezca dos veces en pantalla.
   */
  softwareAdicionalF0302(c: ConfiguracionF0302): SoftwareF0302[] {
    const heredados = this.codigosHeredadosF0288(c.expediente);
    return c.software.filter((s) => s.origen !== 'Configuración'
      && !(s.codigoSoftware && heredados.has(s.codigoSoftware)));
  }

  /** Ítems del checklist F0302 que el técnico debe completar: actividades de configuración + software adicional. */
  softwareChecklistF0302(c: ConfiguracionF0302): SoftwareF0302[] {
    return [...this.itemsConfiguracionF0302(c), ...this.softwareAdicionalF0302(c)];
  }

  /**
   * Catálogo ofrecido al agregar software en el F0302: solo software ACTIVO cuya etapa es
   * «Configuración F0302» o «Ambas etapas». El software exclusivo de la Preparación F0288 nunca
   * se ofrece aquí.
   */
  catalogoParaF0302(): SoftwareCatalogo[] {
    return this.softwareAplicable('F0302');
  }

  /**
   * Situación de un software del catálogo respecto de la configuración: si ya está instalado desde
   * el F0288, si ya se agregó al F0302, o si está disponible para agregarse.
   */
  situacionSoftwareF0302(id: string, codigo: string): 'Instalado en F0288' | 'Agregado en F0302' | 'Disponible' {
    if (this.codigosHeredadosF0288(id).has(codigo)) return 'Instalado en F0288';
    const c = this.configuracionDe(id);
    return c?.software.some((s) => s.codigoSoftware === codigo) ? 'Agregado en F0302' : 'Disponible';
  }

  /** Deja constancia de que el técnico abrió el selector del Catálogo de Software desde el F0302. */
  registrarConsultaCatalogoF0302(id: string, usuario: string): void {
    const c = this.configuracionDe(id);
    const disponibles = this.catalogoParaF0302().length;
    this.registrarEvento(id, usuario, 'Catálogo de Software consultado en F0302', c?.estado ?? 'En configuración',
      `${disponibles} software(s) activo(s) aplicable(s) a Configuración F0302 o Ambas etapas · Formulario: F0302`, false,
      { modulo: 'Configuración F0302', inventario: c?.datos.inventario, expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico });
  }

  /**
   * Agrega un software adicional al checklist F0302 desde el Catálogo de Software. La versión se
   * elige entre las permitidas del catálogo (nunca se escribe a mano) y el motivo o requerimiento
   * asociado es obligatorio; con motivo «Otro», la observación también. No se permite duplicar
   * software ya instalado en el F0288 ni ya agregado al F0302.
   *
   * Devuelve null si quedó agregado, o el mensaje de la validación que falló.
   */
  agregarSoftwareF0302(id: string, datos: {
    codigo: string; version: string; motivo: MotivoSoftwareF0302 | ''; observacion: string;
  }, usuario: string): string | null {
    const c = this.configuracionDe(id);
    if (!c) return 'No se encontró la configuración indicada.';
    if (c.estado === 'Completada') return 'La configuración ya fue finalizada: el F0302 generado no puede modificarse.';
    if (c.estado === 'Con falla') return 'Esta configuración quedó con falla y el equipo volvió a F0288. Inicie una nueva configuración F0302.';
    if (c.estado === 'Cerrada') return 'Esta configuración quedó cerrada por un descargo del equipo y ya no puede modificarse.';
    if (!c.cronometro) return 'Presione «Iniciar configuración» antes de agregar software al checklist F0302.';

    const sw = this.softwareCatalogoDe(datos.codigo);
    if (!sw) return 'No se encontró el software en el Catálogo de Software.';
    if (!sw.activo) return `${sw.nombre} está inactivo en el catálogo y no puede agregarse a la configuración.`;
    if (sw.etapa === 'Preparación F0288') {
      return `${sw.nombre} es software de la Preparación F0288 y no puede agregarse a la Configuración F0302.`;
    }
    const unico = this.expedienteUnicoDe(id)?.codigoUnico;
    const traza = { modulo: 'Configuración F0302', inventario: c.datos.inventario, expedienteUnico: unico };
    if (this.codigosHeredadosF0288(id).has(datos.codigo)) {
      this.registrarEvento(id, usuario, `Software duplicado rechazado: ${sw.nombre}`, c.estado,
        `Software: ${sw.nombre} · Origen: F0288 · Ya instalado durante la Preparación F0288 · Formulario: F0302`, false, traza);
      return 'Este software ya fue instalado durante la Preparación F0288 y no puede agregarse nuevamente.';
    }
    if (c.software.some((s) => s.codigoSoftware === datos.codigo)) {
      this.registrarEvento(id, usuario, `Software duplicado rechazado: ${sw.nombre}`, c.estado,
        `Software: ${sw.nombre} · Origen: F0302 · Ya agregado a la Configuración F0302 · Formulario: F0302`, false, traza);
      return 'Este software ya fue agregado a la Configuración F0302.';
    }
    const version = (datos.version ?? '').trim();
    if (!version) return `Seleccione la versión de ${sw.nombre} desde el catálogo.`;
    if (!sw.versionesPermitidas.includes(version)) {
      return `La versión ${version} no está entre las versiones permitidas de ${sw.nombre} en el catálogo.`;
    }
    if (!datos.motivo) return 'Seleccione el motivo o requerimiento asociado al software.';
    const observacion = (datos.observacion ?? '').trim();
    if (datos.motivo === 'Otro' && !observacion) {
      return 'Con el motivo «Otro», la observación es obligatoria: indique por qué se instala este software.';
    }

    const item: SoftwareF0302 = {
      nombre: sw.nombre, version, estado: 'Pendiente', evidencia: null,
      codigoSoftware: sw.codigo, categoria: sw.categoria, origen: 'F0302',
      versionVigente: sw.versionVigente, motivo: datos.motivo, observacion,
      agregadoPor: usuario, fechaAgregado: `${this.hoy()} ${this.hora().slice(0, 5)}`
    };
    this.actualizarConfiguracionActiva(id, (x) => ({ ...x, software: [...x.software, item] }));
    this.registrarEvento(id, usuario, `Software agregado a Configuración F0302: ${sw.nombre}`, c.estado,
      `Software: ${sw.nombre} · Versión: ${version} · Versión vigente: ${sw.versionVigente} · Categoría: ${sw.categoria} · ` +
        `Origen: F0302 · Motivo: ${datos.motivo}` + (observacion ? ` · Observación: ${observacion}` : '') +
        ' · Formulario: F0302 · Seleccionado desde el Catálogo de Software',
      false, traza);
    this.registrarEvento(id, usuario, `Versión de software seleccionada en F0302: ${sw.nombre} — ${version}`, c.estado,
      `Software: ${sw.nombre} · Versión: ${version} · Origen: F0302 · Motivo: ${datos.motivo}`, false, traza);
    return null;
  }

  /**
   * Retira un software adicional del checklist F0302 mientras la configuración sigue en curso: el
   * checklist es dinámico y el técnico puede corregir lo que agregó. Nunca toca el software
   * heredado del F0288 ni las actividades generales de configuración.
   */
  quitarSoftwareF0302(id: string, codigo: string, usuario: string): string | null {
    const c = this.configuracionDe(id);
    if (!c) return 'No se encontró la configuración indicada.';
    if (c.estado !== 'En curso' && c.estado !== 'Pendiente') {
      return 'Solo puede retirarse software mientras la configuración está en curso.';
    }
    const item = c.software.find((s) => s.codigoSoftware === codigo && s.origen !== 'Configuración');
    if (!item) return 'Ese software no forma parte del software adicional de esta configuración.';
    this.actualizarConfiguracionActiva(id, (x) => ({
      ...x, software: x.software.filter((s) => !(s.codigoSoftware === codigo && s.origen !== 'Configuración'))
    }));
    this.registrarEvento(id, usuario, `Software adicional retirado de la Configuración F0302: ${item.nombre}`, c.estado,
      `Software: ${item.nombre} · Versión: ${item.version} · Origen: F0302` +
        (item.motivo ? ` · Motivo: ${item.motivo}` : '') + ' · Formulario: F0302', false,
      { modulo: 'Configuración F0302', inventario: c.datos.inventario, expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico });
    return null;
  }

  // ---------- Reserva de IP (checklist F0302) ----------
  // La IP reservada es dato clave del expediente, igual que el nombre del equipo: se registra
  // en el checklist F0302, se valida antes de finalizar y viaja al documento, al historial
  // técnico y a la trazabilidad.

  /**
   * Justificaciones frecuentes de no reserva. Son atajos para no teclear: el técnico puede elegir
   * una o escribir la suya, pero el campo nunca queda vacío.
   */
  readonly justificacionesSinReservaIP: string[] = [
    'El equipo utilizará IP dinámica.',
    'El equipo no estará conectado de forma permanente a la red institucional.',
    'El requerimiento no solicita reserva de IP.',
    'La unidad solicitante no requiere IP fija.',
    'Otro motivo justificado.'
  ];

  /** Formato xxx.xxx.xxx.xxx con octetos de 0 a 255 (192.168.10.999 y abc.def.1.2 no pasan). */
  ipValida(ip: string): boolean {
    const partes = ip.trim().split('.');
    return partes.length === 4 && partes.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
  }

  /**
   * Formato de MAC: seis pares hexadecimales separados por `:` o por `-`, sin mezclar separadores
   * (`00:1A:2B:3C:4D:5E` y `00-1A-2B-3C-4D-5E` son válidas).
   */
  macValida(mac: string): boolean {
    const valor = (mac ?? '').trim();
    return /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(valor)
      || /^([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}$/.test(valor);
  }

  /** La MAC se guarda en mayúsculas para que no queden dos escrituras del mismo dato. */
  private macNormalizada(mac: string): string {
    return (mac ?? '').trim().toUpperCase();
  }

  /**
   * MAC que el modal muestra autocompletada: la que ya quedó en la configuración F0302 o, si no
   * hay, la del registro institucional del equipo. Devuelve '' cuando el equipo no la trae y el
   * técnico debe digitarla.
   */
  macSugeridaF0302(id: string): string {
    const c = this.configuracionDe(id);
    const guardada = this.macNormalizada(c?.datos.macEquipo ?? '');
    if (guardada) return guardada;
    return this.macNormalizada(this.equipoDe(c?.datos.inventario ?? '')?.mac ?? '');
  }

  /** De dónde salió la MAC que se muestra: del inventario institucional o digitada en el modal. */
  origenMacF0302(id: string): string {
    const c = this.configuracionDe(id);
    const delEquipo = this.macNormalizada(this.equipoDe(c?.datos.inventario ?? '')?.mac ?? '');
    const guardada = this.macNormalizada(c?.datos.macEquipo ?? '');
    if (delEquipo && (!guardada || guardada === delEquipo)) return 'Registro institucional del equipo';
    return guardada ? 'Digitada en la validación previa a conformidad' : '';
  }

  /**
   * Estado de la solicitud de reserva ante el Departamento de Servidores, listo para mostrar:
   * «No aplica», «Pendiente de envío», «Enviada» o, mientras la reserva no se haya respondido,
   * «Pendiente de validación antes de conformidad».
   */
  textoEstadoSolicitudIP(c: Pick<ConfiguracionF0302, 'datos'> | undefined): string {
    if (!c?.datos.requiereReservaIP) return 'Pendiente de validación antes de conformidad';
    if (c.datos.requiereReservaIP === 'No') return 'No aplica';
    return c.datos.estadoSolicitudIP || 'Pendiente de envío';
  }

  /**
   * Registra el nombre del equipo (hostname) que digita el Técnico de Soporte en el checklist
   * F0302. Es dato obligatorio del expediente: viaja al expediente único, al documento generado,
   * al historial técnico, a la trazabilidad, al formulario de conformidad y al detalle del equipo.
   *
   * En una configuración ya finalizada solo se admite cuando el nombre nunca llegó a registrarse
   * (expedientes anteriores a esta regla): completar el dato que falta sí es válido, cambiar el
   * que ya quedó documentado no.
   *
   * Devuelve null si quedó registrado, o el mensaje de la validación que falló.
   */
  registrarNombreEquipo(id: string, usuario: string, nombre: string): string | null {
    const c = this.configuracionDe(id);
    if (!c) return 'No se encontró la configuración indicada.';
    if (c.estado === 'Con falla') return 'Esta configuración quedó con falla y el equipo volvió a F0288. Inicie una nueva configuración F0302.';
    if (c.estado === 'Cerrada') return 'Esta configuración quedó cerrada por un descargo del equipo y ya no puede reutilizarse.';
    const anterior = (c.datos.nombrePC ?? '').trim();
    if (c.estado === 'Completada' && anterior) {
      return 'La configuración ya fue finalizada; el nombre del equipo no puede modificarse.';
    }
    const valor = nombre.trim();
    if (!valor) return 'Debe ingresar el nombre del equipo para finalizar la configuración.';
    if (valor === anterior) return null;
    this.actualizarConfiguracionActiva(id, (x) => ({ ...x, datos: { ...x.datos, nombrePC: valor } }));
    this.registrarEvento(id, usuario, `Nombre del equipo registrado en F0302: ${valor}`, c.estado,
      anterior
        ? `Equipo ${c.datos.inventario} · el nombre pasó de ${anterior} a ${valor}.`
        : `Equipo ${c.datos.inventario} para ${c.datos.asignadoA}.`,
      false,
      { modulo: 'Configuración F0302', inventario: c.datos.inventario,
        expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: c.datos.asignadoA,
        nombreEquipo: valor, estadoAnterior: anterior ? `Nombre del equipo: ${anterior}` : 'Sin nombre de equipo registrado' });
    return null;
  }

  /**
   * Configuración de OTRO equipo activo que ya tiene reservada esa IP. Las configuraciones
   * «Cerrada» (equipo descargado) y «Con falla» no cuentan: esas reservas quedaron liberadas.
   */
  configuracionConIP(ip: string, inventario: string): ConfiguracionF0302 | undefined {
    const buscada = ip.trim();
    if (!buscada) return undefined;
    return this.configuraciones().find((c) =>
      c.datos.inventario !== inventario &&
      c.estado !== 'Cerrada' && c.estado !== 'Con falla' &&
      (c.datos.ipReservada ?? '').trim() === buscada);
  }

  /**
   * Valida la reserva de IP. Devuelve null si es válida, o el mensaje de la regla que falló: falta
   * la respuesta, falta la IP, formato incorrecto o IP duplicada. Los mensajes hablan del envío del
   * formulario de conformidad porque es el único punto donde se captura la reserva.
   */
  validarReservaIP(inventario: string, requiere: RespuestaSiNo, ip: string, mac = '', justificacion = ''): string | null {
    if (!requiere) return 'Indique si el equipo requiere reserva de IP antes de enviar el formulario de conformidad.';
    // Con «No» el dato que falta es el motivo: sin él, el expediente no explicaría por qué el
    // equipo quedó sin IP fija y el formulario de conformidad no puede enviarse.
    if (requiere === 'No') {
      return justificacion.trim() ? null
        : 'Debe justificar por qué no se reservó IP antes de enviar el formulario de conformidad.';
    }
    const valor = ip.trim();
    if (!valor) return 'Debe ingresar la IP reservada antes de enviar el formulario de conformidad.';
    if (!this.ipValida(valor)) return 'La IP ingresada no tiene un formato válido.';
    const otra = this.configuracionConIP(valor, inventario);
    if (otra) {
      return 'La IP ingresada ya se encuentra registrada en otro equipo activo. ' +
        `Verifique la reserva antes de continuar (equipo ${otra.datos.inventario} · ${otra.datos.nombrePC}).`;
    }
    // La MAC identifica al equipo en la solicitud a Servidores: sin ella la reserva no puede pedirse.
    const dir = mac.trim();
    if (!dir) return 'Debe ingresar la MAC del equipo para solicitar la reserva de IP.';
    if (!this.macValida(dir)) return 'La MAC del equipo no tiene un formato válido.';
    return null;
  }

  /**
   * Guarda la reserva de IP de la configuración activa y deja el evento de trazabilidad. Se llama
   * únicamente desde el modal de validación previo al envío del formulario de conformidad: la
   * reserva no es una sección del checklist F0302.
   *
   * Devuelve null si se guardó (o si no hubo cambio), o el mensaje de validación.
   */
  registrarReservaIP(id: string, usuario: string, requiere: RespuestaSiNo, ip: string,
    mac = '', justificacion = ''): string | null {
    const c = this.configuracionDe(id);
    if (!c) return 'No se encontró la configuración indicada.';
    const macNueva = requiere === 'Sí' ? this.macNormalizada(mac) : '';
    const justNueva = requiere === 'No' ? justificacion.trim() : '';
    // Reconfirmar en el modal lo mismo que ya estaba guardado no es un cambio: se acepta sin tocar
    // nada, para que el envío del formulario no se trabe por «no puede modificarse».
    const igual = (c.datos.requiereReservaIP ?? '') === requiere
      && (c.datos.ipReservada ?? '').trim() === (requiere === 'Sí' ? ip.trim() : '')
      && this.macNormalizada(c.datos.macEquipo ?? '') === macNueva
      && (c.datos.justificacionSinReservaIP ?? '').trim() === justNueva;
    if (igual) return this.validarReservaIP(c.datos.inventario, requiere, ip, mac, justificacion);
    // La reserva se captura DESPUÉS de finalizar el F0302, así que «Completada» no puede ser el
    // punto de congelación: mientras el formulario de conformidad no se haya enviado, el técnico
    // todavía puede corregir la IP, la MAC o la justificación —de lo contrario un dato mal digitado
    // dejaría el proceso trabado—. Una vez enviado el formulario, el dato queda congelado en él.
    if (this.conformidades().some((x) => x.expediente === id)) {
      return 'El formulario de conformidad ya fue enviado; la reserva de IP no puede modificarse.';
    }
    if (c.estado === 'Con falla') return 'Esta configuración quedó con falla y el equipo volvió a F0288. Inicie una nueva configuración F0302.';
    if (c.estado === 'Cerrada') return 'Esta configuración quedó cerrada por un descargo del equipo y ya no puede reutilizarse.';
    const error = this.validarReservaIP(c.datos.inventario, requiere, ip, mac, justificacion);
    if (error) return error;

    const anteriorReq = c.datos.requiereReservaIP ?? '';
    const anteriorIP = (c.datos.ipReservada ?? '').trim();
    const anteriorMac = this.macNormalizada(c.datos.macEquipo ?? '');
    const anteriorJust = (c.datos.justificacionSinReservaIP ?? '').trim();
    const nuevaIP = requiere === 'Sí' ? ip.trim() : '';
    // Si la IP o la MAC cambian, la solicitud que se envió a Servidores dejó de corresponder a
    // estos datos: vuelve a «Pendiente de envío» y hay que enviarla de nuevo.
    const solicitudVigente = requiere === 'Sí'
      && c.datos.estadoSolicitudIP === 'Enviada' && anteriorIP === nuevaIP && anteriorMac === macNueva;
    const estadoSolicitud: EstadoSolicitudReservaIP = requiere === 'No'
      ? 'No aplica' : solicitudVigente ? 'Enviada' : 'Pendiente de envío';
    const sello = `${this.hoy()} ${this.hora().slice(0, 5)}`;
    this.actualizarConfiguracionActiva(id, (x) => ({
      ...x, datos: {
        ...x.datos, requiereReservaIP: requiere, ipReservada: nuevaIP,
        macEquipo: macNueva, justificacionSinReservaIP: justNueva,
        estadoSolicitudIP: estadoSolicitud,
        correoReservaEnviado: solicitudVigente ? (x.datos.correoReservaEnviado ?? 'Sí') : 'No',
        fechaSolicitudIP: solicitudVigente ? (x.datos.fechaSolicitudIP ?? '') : '',
        ipValidadaPor: usuario, ipValidadaEl: sello
      }
    }));

    const ref = {
      modulo: 'Configuración F0302', estadoAnterior: anteriorReq ? `Reserva de IP: ${anteriorReq}` : 'Sin reserva de IP registrada',
      inventario: c.datos.inventario, expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico,
      usuarioFinal: c.datos.asignadoA, nombreEquipo: c.datos.nombrePC, ipReservada: nuevaIP || 'No aplica',
      mac: macNueva || 'No aplica', justificacion: justNueva, estadoSolicitudIP: estadoSolicitud
    };
    if (anteriorReq !== requiere) {
      this.registrarEvento(id, usuario, `Reserva de IP marcada como ${requiere}`,
        `Reserva de IP: ${requiere}`,
        `Formulario: F0302 · Equipo ${c.datos.inventario} (${c.datos.nombrePC}). ` +
          (requiere === 'Sí'
            ? `IP reservada: ${nuevaIP} · MAC: ${macNueva} · Solicitud de reserva de IP: ${estadoSolicitud}.`
            : 'El equipo no requiere reserva de IP: se registra «IP reservada: No aplica» y la justificación del técnico.') +
          ` Validada por ${usuario} el ${sello}.`,
        false, ref);
    }
    if (requiere === 'No' && justNueva !== anteriorJust) {
      this.registrarEvento(id, usuario, 'Justificación de no reserva registrada', 'Reserva de IP: No',
        `Formulario: F0302 · Equipo ${c.datos.inventario} (${c.datos.nombrePC}) · Justificación: «${justNueva}» · ` +
          `Registrada por ${usuario} el ${sello}.`, false,
        { ...ref, estadoAnterior: anteriorJust ? `Justificación: ${anteriorJust}` : 'Sin justificación registrada' });
    }
    if (requiere === 'Sí' && nuevaIP !== anteriorIP) {
      this.registrarEvento(id, usuario,
        anteriorIP ? `IP reservada actualizada: ${anteriorIP} → ${nuevaIP}` : `IP reservada registrada: ${nuevaIP}`,
        `Reserva de IP: Sí`,
        `Formulario: F0302 · Equipo ${c.datos.inventario} (${c.datos.nombrePC}) para ${c.datos.asignadoA} · ` +
          `Validada por ${usuario} el ${sello}.`, false,
        { ...ref, estadoAnterior: anteriorIP ? `IP reservada: ${anteriorIP}` : 'Sin IP reservada' });
    }
    if (requiere === 'Sí' && macNueva !== anteriorMac) {
      this.registrarEvento(id, usuario, `MAC del equipo registrada: ${macNueva}`, 'Reserva de IP: Sí',
        `Formulario: F0302 · Equipo ${c.datos.inventario} (${c.datos.nombrePC}) · Origen del dato: ` +
          `${this.origenMacF0302(id) || 'Digitada en la validación previa a conformidad'} · ` +
          `Se usará en la solicitud de reserva al Departamento de Servidores.`, false,
        { ...ref, estadoAnterior: anteriorMac ? `MAC: ${anteriorMac}` : 'Sin MAC registrada' });
    }
    return null;
  }

  /**
   * Arma el correo simulado de solicitud de reserva de IP con los datos del expediente. Se usa
   * tanto para la vista previa del modal como para dejar el cuerpo registrado tras el envío.
   * Devuelve null si la configuración no tiene los datos mínimos (reserva «Sí», IP y MAC).
   */
  solicitudReservaIP(id: string, ipManual?: string, macManual?: string): SolicitudReservaIP | null {
    const c = this.configuracionDe(id);
    if (!c) return null;
    // Con valores explícitos arma la vista previa de lo que el técnico está escribiendo en el modal,
    // antes de guardarlo; sin ellos, la solicitud tal como quedó registrada en el expediente.
    const previa = ipManual !== undefined || macManual !== undefined;
    if (!previa && c.datos.requiereReservaIP !== 'Sí') return null;
    const ip = (ipManual ?? c.datos.ipReservada ?? '').trim();
    const mac = this.macNormalizada(macManual ?? c.datos.macEquipo ?? '');
    if (!this.ipValida(ip) || !this.macValida(mac)) return null;
    const eq = this.equipoDe(c.datos.inventario);
    const s: SolicitudReservaIP = {
      para: 'Departamento de Servidores',
      asunto: 'Solicitud de reserva de IP para equipo institucional',
      nombreEquipo: c.datos.nombrePC || 'Sin registrar',
      inventario: c.datos.inventario,
      tipoEquipo: eq?.tipo === 'Desktop' ? 'CPU' : (eq?.tipo ?? '—'),
      mac, ip,
      usuarioFinal: c.datos.asignadoA,
      expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico ?? '—',
      tecnico: c.datos.ipValidadaPor || c.tecnico,
      fecha: c.datos.fechaSolicitudIP || `${this.hoy()} ${this.hora().slice(0, 5)}`,
      cuerpo: ''
    };
    s.cuerpo = [
      'Se solicita la reserva de la siguiente dirección IP para el equipo institucional:',
      '',
      `Nombre del equipo: ${s.nombreEquipo}`,
      `Número de inventario: ${s.inventario}`,
      `Tipo de equipo: ${s.tipoEquipo}`,
      `MAC del equipo: ${s.mac}`,
      `IP solicitada: ${s.ip}`,
      `Usuario final asignado: ${s.usuarioFinal}`,
      `Expediente único: ${s.expedienteUnico}`,
      `Técnico solicitante: ${s.tecnico}`,
      `Fecha de solicitud: ${s.fecha}`,
      '',
      'Favor gestionar la reserva correspondiente.'
    ].join('\n');
    return s;
  }

  /**
   * Simula el envío del correo de solicitud de reserva al Departamento de Servidores: el prototipo
   * no envía correo real, registra el envío simulado en el expediente y en la trazabilidad y deja
   * la solicitud en estado «Enviada», que es lo que habilita el envío del formulario de conformidad.
   *
   * Devuelve la solicitud enviada o el mensaje de la regla que la impide.
   */
  registrarSolicitudReservaIP(id: string, usuario: string): SolicitudReservaIP | string {
    const c = this.configuracionDe(id);
    if (!c) return 'No se encontró la configuración indicada.';
    if (c.estado === 'Con falla') return 'Esta configuración quedó con falla y el equipo volvió a F0288. Inicie una nueva configuración F0302.';
    if (c.estado === 'Cerrada') return 'Esta configuración quedó cerrada por un descargo del equipo y ya no puede reutilizarse.';
    const error = this.validarReservaIP(c.datos.inventario, c.datos.requiereReservaIP ?? '',
      c.datos.ipReservada ?? '', c.datos.macEquipo ?? '', c.datos.justificacionSinReservaIP ?? '');
    if (error) return error;
    if (c.datos.requiereReservaIP === 'No') {
      return 'El equipo no requiere reserva de IP: no hay solicitud que enviar al Departamento de Servidores.';
    }
    if (c.datos.estadoSolicitudIP === 'Enviada') {
      return 'La solicitud de reserva de IP ya fue enviada al Departamento de Servidores para esta IP y esta MAC.';
    }
    const sello = `${this.hoy()} ${this.hora().slice(0, 5)}`;
    this.actualizarConfiguracionActiva(id, (x) => ({
      ...x, datos: { ...x.datos, estadoSolicitudIP: 'Enviada', correoReservaEnviado: 'Sí', fechaSolicitudIP: sello }
    }));
    const solicitud = this.solicitudReservaIP(id);
    if (!solicitud) return 'No se pudo armar la solicitud de reserva de IP con los datos del expediente.';
    this.registrarEvento(id, usuario, 'Solicitud simulada de reserva de IP enviada a Servidores', c.estado,
      `Para: ${solicitud.para} · Asunto: ${solicitud.asunto} · Equipo ${solicitud.inventario} ` +
        `(${solicitud.nombreEquipo}) · MAC: ${solicitud.mac} · IP solicitada: ${solicitud.ip} · ` +
        `Envío simulado: el prototipo no envía correo real.`, false,
      { modulo: 'Configuración F0302', estadoAnterior: 'Solicitud de reserva de IP: Pendiente de envío',
        inventario: c.datos.inventario, expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico,
        usuarioFinal: c.datos.asignadoA, nombreEquipo: c.datos.nombrePC, ipReservada: solicitud.ip,
        mac: solicitud.mac, estadoSolicitudIP: 'Enviada' });
    return solicitud;
  }

  /** Deja constancia de que el técnico abrió el modal de validación previo al envío del formulario. */
  registrarAperturaModalConformidad(id: string, usuario: string): void {
    const c = this.configuracionDe(id);
    if (!c) return;
    this.registrarEvento(id, usuario, 'Modal de validación de reserva de IP abierto', c.estado,
      `Formulario: F0302 · Nombre del equipo: ${c.datos.nombrePC || 'Sin registrar'} · ` +
        `Reserva de IP: ${c.datos.requiereReservaIP || 'Sin responder'} · IP reservada: ${this.textoIPReservada(c)} · ` +
        `Solicitud de reserva de IP: ${this.textoEstadoSolicitudIP(c)}`,
      false,
      { modulo: 'Entrega y aceptación', inventario: c.datos.inventario,
        expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: c.datos.asignadoA,
        nombreEquipo: c.datos.nombrePC, ipReservada: this.textoIPReservada(c),
        mac: this.macSugeridaF0302(id) || 'Sin registrar', estadoSolicitudIP: this.textoEstadoSolicitudIP(c) });
  }

  /** Reserva de IP vigente del equipo: la de su configuración F0302 más reciente. */
  reservaIPEquipo(inventario: string): { requiere: RespuestaSiNo; ip: string } {
    const c = this.configuracionesDeEquipo(inventario)[0];
    return { requiere: c?.datos.requiereReservaIP ?? '', ip: (c?.datos.ipReservada ?? '').trim() };
  }

  /**
   * Texto legible de la reserva de IP: «192.168.10.45», «No aplica» o, mientras no se haya
   * respondido, «Pendiente de validación antes de conformidad». Ese último caso es normal: la
   * reserva no es dato del cierre del F0302, se pregunta al enviar el formulario de conformidad.
   */
  textoIPReservada(c: Pick<ConfiguracionF0302, 'datos'> | undefined): string {
    if (!c?.datos.requiereReservaIP) return 'Pendiente de validación antes de conformidad';
    return c.datos.requiereReservaIP === 'Sí' ? (c.datos.ipReservada || '—') : 'No aplica';
  }

  /**
   * Inicia el cronómetro de la configuración F0302: registra fecha, hora y técnico que
   * inició, lo deja visible en pantalla y anota el evento en la trazabilidad del equipo.
   */
  iniciarConfiguracion(id: string, usuario: string): string | null {
    const c = this.configuracionDe(id);
    if (!c) return 'No se encontró la configuración indicada.';
    if (c.estado === 'Con falla') return 'Esta configuración quedó con falla y el equipo volvió a F0288. Inicie una nueva configuración F0302.';
    if (c.estado === 'Completada') return 'Esta configuración ya fue finalizada.';
    if (c.estado === 'Cerrada') return 'Esta configuración quedó cerrada por un descargo del equipo y ya no puede reutilizarse.';
    if (c.cronometro) return 'El cronómetro de esta configuración ya está en curso.';
    const crono: Cronometro = {
      fechaInicio: this.hoy(), horaInicio: this.horaCrono(), iniciadoPor: usuario,
      fechaFin: '', horaFin: '', finalizadoPor: '', duracionMinutos: null
    };
    this.actualizarConfiguracionActiva(id, (x) => ({ ...x, cronometro: crono }));
    const ref = { modulo: 'Configuración F0302', inventario: c.datos.inventario,
      expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: c.datos.asignadoA };
    this.registrarEvento(id, usuario, `Cronómetro F0302 iniciado para el expediente ${this.expedienteUnicoDe(id)?.codigoUnico ?? id}`, 'En configuración',
      `Inicio del registro de tiempo de la configuración del equipo ${c.datos.inventario} (${c.datos.nombrePC}) para ${c.datos.asignadoA}.`, false, ref);
    // Al abrir el checklist, el F0302 muestra el software que ya instaló la Preparación F0288 como
    // información heredada y bloqueada: queda constancia de qué se heredó y de que no se re-marca.
    const heredado = this.softwareHeredadoF0288(id);
    if (heredado.length > 0) {
      const detalle = heredado.map((s) => `${s.nombre} ${s.version}${s.evidencia ? ` (evidencia: ${s.evidencia})` : ''}`).join(' · ');
      this.registrarEvento(id, usuario, 'Software heredado desde F0288 mostrado en F0302', 'En configuración',
        `Origen: F0288 (${heredado[0].expedienteTecnico}) · Formulario: F0302 · ${detalle}`, false, ref);
      this.registrarEvento(id, usuario, 'Software de F0288 bloqueado en F0302', 'En configuración',
        'Origen: F0288 · Formulario: F0302 · No puede volver a marcarse, editarse ni agregarse como software adicional: ' +
          heredado.map((s) => s.nombre).join(' · '), false, ref);
    }
    return null;
  }

  /**
   * Cierra la configuración F0302: valida el checklist de software y el registro de
   * complejidad, detiene el cronómetro y guarda tiempo total, complejidad y observación.
   * Devuelve null si se generó el documento, o el mensaje de la validación que falló.
   */
  cerrarConfiguracion(id: string, usuario: string, cierre: CierreTecnico): string | null {
    const c = this.configuracionDe(id);
    if (!c) return 'No se encontró la configuración indicada.';
    if (c.estado === 'Con falla') return 'Esta configuración quedó con falla y el equipo volvió a F0288. Inicie una nueva configuración F0302.';
    if (c.estado === 'Cerrada') return 'Esta configuración quedó cerrada por un descargo del equipo y ya no puede reutilizarse.';
    if (!c.cronometro) return 'Presione «Iniciar configuración» para comenzar el cronómetro antes de finalizar.';
    // Solo se valida el checklist propio del F0302 (actividades de configuración + software
    // adicional): el software heredado del F0288 ya está instalado y se muestra bloqueado.
    const checklist = this.softwareChecklistF0302(c);
    if (checklist.some((s) => s.estado === 'Pendiente')) {
      return 'Complete todo el software aplicable antes de generar el F0302.';
    }
    if (checklist.some((s) => s.codigoSoftware && s.estado === 'Realizado' && !s.version?.trim())) {
      return 'Seleccione la versión de cada software marcado antes de generar el F0302.';
    }
    // El nombre del equipo es dato obligatorio del expediente: lo digita el técnico y viaja al
    // documento, al expediente único, al historial, a la trazabilidad y al formulario de conformidad.
    if (!(c.datos.nombrePC ?? '').trim()) {
      return 'Debe ingresar el nombre del equipo para finalizar la configuración.';
    }
    // Un ítem marcado «No aplica» no exige imagen, pero sí motivo: un control de seguridad que se
    // salta sin explicación es indistinguible de uno que se olvidó. Va antes que la captura porque
    // «No aplica» ya excluye al ítem de exigirla.
    const sinJustificar = this.itemsNoAplicaSinJustificar(c);
    if (sinJustificar.length) {
      const mensaje = this.mensajeJustificacionNoAplica(sinJustificar[0].nombre);
      this.registrarEvento(id, usuario, 'Intento de finalizar F0302 sin justificación de No aplica',
        'En configuración', mensaje, false,
        this.refItemF0302(id, sinJustificar[0].nombre, 'No aplica'));
      return mensaje;
    }
    // Ítems que no se dan por configurados sin captura (Agente DLP). Vale igual si se marcaron con
    // el checkbox «Seleccionar todo» de la categoría: la validación es sobre el ítem, no sobre cómo
    // se marcó. Un ítem «No aplica» ya quedó fuera: `itemsSinCapturaF0302` solo mira los Realizados.
    const sinCaptura = this.faltaImagenF0302(c, usuario);
    if (sinCaptura) return sinCaptura;
    // La reserva de IP NO se valida aquí, ni siquiera cuando ya viene respondida: no es dato del
    // cierre. Se pregunta, se valida y se guarda en el modal previo al envío del formulario de
    // conformidad, que es donde el dato hace falta de verdad. Finalizar y generar el F0302 no
    // dependen de ella.
    const errCierre = this.validarCierre(cierre, 'configuración');
    if (errCierre) return errCierre;

    const crono = this.detenerCronometro(c.cronometro, usuario);
    this.actualizarConfiguracionActiva(id, (x) => ({
      ...x, estado: 'Completada', fecha: this.hoy(), cronometro: crono, cierre,
      firmas: {
        ...x.firmas,
        configuro: { ...x.firmas.configuro, estado: 'Firmado', fecha: this.hoy(), hora: this.hora(), detalle: 'Firmado electrónicamente al generar el F0302 (firma simulada)' }
      }
    }));
    this.documentos.update((list) => [...list, {
      tipo: 'F0302', expediente: id, generadoPor: usuario, fecha: this.hoy(), hash: this.hash(),
      inventario: c.datos.inventario, evidencias: this.evidenciasDelDocumento('Configuración F0302', id)
    }]);
    this.actualizarAnexo(id, 'F0302 generado', 'Generado', 'Documento generado automáticamente');
    this.actualizarAnexo(id, 'Firmas registradas', '2 de 3', 'F0288 y F0302 firmados; falta la conformidad del usuario final');
    this.actualizarAnexo(id, 'Se anexa configuración del equipo', 'Anexado', 'Checklist digital F0302 completado');
    this.entregas.update((list) =>
      list.map((e) => (e.expediente === id ? { ...e, f0302Generado: true, f0302Fecha: this.hoy() } : e))
    );
    const tiempo = this.formatoDuracion(crono.duracionMinutos);
    const conReserva = c.datos.requiereReservaIP === 'Sí';
    // La reserva se responde después, en el modal previo al envío del formulario de conformidad:
    // al cerrar el F0302 lo normal es que todavía no exista, y el evento lo dice así.
    const reservaTexto = c.datos.requiereReservaIP || 'Se define al enviar el formulario de conformidad';
    const ipTexto = this.textoIPReservada(c);
    const conCaptura = this.softwareChecklistF0302(c).filter((s) => s.requiereEvidencia && s.evidencia?.trim());
    const capturas = conCaptura.map((s) => `${s.nombre}: ${s.evidencia}`).join(' · ');
    // La comprobación de las capturas obligatorias es parte del cierre: queda registrada aparte
    // para que la trazabilidad muestre que se verificó, no solo que el F0302 se generó.
    for (const s of conCaptura) {
      const ev = c.evidencias.find((e) => e.item === s.nombre && e.archivo);
      this.registrarEvento(id, usuario, `Validación de evidencia de ${s.nombre} realizada`, 'Realizado',
        `Formulario: F0302 · ${s.nombre}: Configurado · Evidencia registrada: ${s.evidencia}` +
          (ev ? ` · ${ev.cargadaPor} · ${ev.fecha}` : ''), false,
        { modulo: 'Configuración F0302', inventario: c.datos.inventario,
          expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, nombreEquipo: c.datos.nombrePC });
    }
    // Cerrar sin reserva de IP es el caso normal, no una omisión: queda registrado para que el
    // historial explique por qué el F0302 se generó sin ese dato y dónde se completará.
    if (!c.datos.requiereReservaIP) {
      const refIP = { modulo: 'Configuración F0302', inventario: c.datos.inventario,
        expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, nombreEquipo: c.datos.nombrePC,
        ipReservada: 'Pendiente de validación antes de conformidad' };
      const detalleIP = 'Formulario: F0302 · La reserva de IP no es requisito del cierre: se pregunta y se valida '
        + 'en el modal previo al envío del formulario de conformidad.';
      this.registrarEvento(id, usuario, 'F0302 finalizado sin validación de IP reservada', 'Listo para entrega', detalleIP, false, refIP);
      this.registrarEvento(id, usuario, 'F0302 generado sin validación de IP reservada', 'Listo para entrega', detalleIP, false, refIP);
    }
    // El cierre deja constancia del software adicional agregado según el requerimiento y del que
    // se heredó del F0288, para que el historial muestre ambos apartados sin abrir el documento.
    const adicional = this.softwareAdicionalF0302(c).filter((s) => s.codigoSoftware);
    const heredado = this.softwareHeredadoF0288(id);
    const textoAdicional = adicional
      .map((s) => `${s.nombre} ${s.version}${s.motivo ? ` (${s.motivo})` : ''}`).join(' · ');
    const textoHeredado = heredado.map((s) => `${s.nombre} ${s.version}`).join(' · ');
    this.registrarEvento(id, usuario,
      adicional.length > 0
        ? `Configuración F0302 finalizada con software adicional (${adicional.length}); documento F0302 generado y firmado`
        : conReserva
          ? `Configuración F0302 finalizada con reserva de IP ${ipTexto}; documento F0302 generado y firmado`
          : 'Configuración F0302 finalizada; documento F0302 generado y firmado',
      'Listo para entrega',
      `Nombre del equipo: ${c.datos.nombrePC} · Reserva de IP: ${reservaTexto} · IP reservada: ${ipTexto} · ` +
        `Tiempo total: ${tiempo} · Complejidad: ${cierre.nivel}` +
        (capturas ? ` · Evidencias registradas: ${capturas}` : '') +
        (textoHeredado ? ` · Software heredado de F0288: ${textoHeredado}` : '') +
        (textoAdicional ? ` · Software agregado en F0302: ${textoAdicional}` : ' · Sin software adicional agregado en F0302') +
        (cierre.hubo === 'Sí' ? ` · Detalle: ${cierre.detalle.trim()}` : (cierre.observacion.trim() ? ` · Observación: ${cierre.observacion.trim()}` : '')),
      true,
      { modulo: 'Configuración F0302', estadoAnterior: 'En configuración', inventario: c.datos.inventario,
        expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: c.datos.asignadoA, tiempo,
        complejidad: cierre.nivel, nombreEquipo: c.datos.nombrePC, ipReservada: ipTexto });
    // Los ítems que quedaron fuera se nombran uno a uno con su motivo: en el documento y en la
    // trazabilidad tiene que verse qué no se hizo y por qué, no solo lo que sí se hizo.
    const noAplica = this.itemsNoAplicaF0302(c);
    if (noAplica.length) {
      this.registrarEvento(id, usuario,
        `Configuración F0302 finalizada con ${noAplica.length} ítem(s) No aplica justificados`,
        'Listo para entrega',
        noAplica.map((s) => `${s.nombre}: ${s.justificacionNoAplica}`).join(' · '), false,
        { modulo: 'Configuración F0302', inventario: c.datos.inventario,
          expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, nombreEquipo: c.datos.nombrePC,
          rol: this.rolDeUsuario(usuario), estadoItem: 'No aplica',
          itemChecklist: noAplica.map((s) => s.nombre).join(', ') });
    }
    this.registrarCierreConEvidencia('Configuración F0302', id, id, usuario, c.datos.inventario);
    this.registrarDocumentoConEvidencias(id, usuario, 'F0302', 'Configuración F0302', id, c.datos.inventario);
    return null;
  }

  // ---------- Falla en F0302: checklist dinámico e incidencia de configuración ----------

  /**
   * Comportamiento esperado por tipo de falla. Es el corazón de la regla: NO todas las fallas
   * devuelven el equipo a preparación, así que cada tipo trae su propio checklist, su sugerencia
   * de reproceso y la nota que explica qué hará el sistema.
   *
   * `sugerencia: 'Depende'` significa que el tipo por sí solo no decide: la respuesta sale de una
   * pregunta adicional del checklist (reinstalación del SO, revisión física de red, acción
   * requerida), y `sugerenciaReproceso` la resuelve cuando esa pregunta está contestada.
   */
  matrizFalla(tipo: TipoFallaF0302): {
    sugerencia: SugerenciaReproceso; revisionHardware: boolean; campos: string[]; nota: string;
  } {
    switch (tipo) {
      case 'Falla física del equipo':
        return { sugerencia: 'Sí', revisionHardware: true,
          campos: ['componenteAfectado', 'descripcion', 'evidencia', 'observacionHardware'],
          nota: 'Requiere revisión por Hardware y reproceso F0288 dentro del mismo Expediente técnico.' };
      case 'Falla de disco':
        return { sugerencia: 'Sí', revisionHardware: true,
          campos: ['tipoDisco', 'serieDisco', 'sintoma', 'evidencia', 'observacionHardware'],
          nota: 'Requiere revisión por Hardware y reproceso F0288. Detalle el disco afectado.' };
      case 'Falla de memoria':
        return { sugerencia: 'Sí', revisionHardware: true,
          campos: ['capacidadRam', 'sintoma', 'evidencia', 'observacionHardware'],
          nota: 'Requiere revisión por Hardware y reproceso F0288. Detalle la memoria RAM.' };
      case 'Problema de sistema operativo':
        return { sugerencia: 'Depende', revisionHardware: false,
          campos: ['tipoProblemaSO', 'requiereReinstalacion', 'evidencia', 'observacionTecnica'],
          nota: 'Con reinstalación o reparación base va a reproceso F0288; sin ella se corrige en el mismo F0302.' };
      case 'Problema de red':
        return { sugerencia: 'No', revisionHardware: false,
          campos: ['tipoProblemaRed', 'mac', 'ipActual', 'puntoRed', 'requiereRevisionFisica', 'evidencia', 'observacionTecnica'],
          nota: 'Se atiende en F0302. Solo va a reproceso F0288 si se marca revisión física por Hardware.' };
      case 'No permite ingreso a dominio':
        return { sugerencia: 'No', revisionHardware: false,
          campos: ['usuarioCuenta', 'mensajeError', 'nombreEquipo', 'evidencia', 'observacionTecnica'],
          nota: 'Corresponde a Soporte: se corrige en el mismo F0302, sin reproceso F0288 por defecto.' };
      case 'Accesorio faltante':
        return { sugerencia: 'Sí', revisionHardware: true,
          campos: ['accesorio', 'inventarioEsperado', 'evidencia', 'observacionTecnica'],
          nota: 'Se atiende por Hardware dentro del mismo Expediente técnico; no se crea uno nuevo.' };
      case 'Configuración incompleta por falla previa':
        return { sugerencia: 'Depende', revisionHardware: false,
          campos: ['etapaDeteccion', 'descripcion', 'accionRequerida', 'evidencia', 'justificacionReproceso'],
          nota: 'La acción requerida decide si se corrige en F0302 o pasa a reproceso F0288.' };
      default:
        return { sugerencia: 'Depende', revisionHardware: false,
          campos: ['descripcion', 'evidencia', 'justificacionReproceso'],
          nota: 'El técnico decide si requiere reproceso F0288 y lo justifica.' };
    }
  }

  /** true si el checklist dinámico de ese tipo de falla incluye el campo indicado. */
  fallaPideCampo(tipo: TipoFallaF0302, campo: string): boolean {
    return this.matrizFalla(tipo).campos.includes(campo);
  }

  /**
   * Sugerencia de reproceso ya resuelta con lo que el técnico lleva contestado. Los tres tipos
   * «Depende» se resuelven con su pregunta propia; mientras esa pregunta esté sin responder, la
   * sugerencia sigue siendo «Depende» y la pantalla no puede preseleccionar nada.
   */
  sugerenciaReproceso(tipo: TipoFallaF0302, detalle: DetalleFallaF0302 = {}): SugerenciaReproceso {
    if (tipo === 'Problema de sistema operativo') {
      return detalle.requiereReinstalacion === 'Sí' ? 'Sí' : detalle.requiereReinstalacion === 'No' ? 'No' : 'Depende';
    }
    if (tipo === 'Problema de red') {
      // Por defecto «No»: el problema de red se atiende en F0302 salvo que haya revisión física.
      return detalle.requiereRevisionFisica === 'Sí' ? 'Sí' : 'No';
    }
    if (tipo === 'Configuración incompleta por falla previa') {
      const a = detalle.accionRequerida;
      if (!a) return 'Depende';
      return a === 'Reproceso F0288' || a === 'Revisar por Hardware' ? 'Sí' : 'No';
    }
    return this.matrizFalla(tipo).sugerencia;
  }

  /**
   * ¿La falla lleva revisión por Hardware? El tipo la implica (física, disco, memoria, accesorio)
   * o el técnico la marcó en el checklist de red / en la acción requerida.
   */
  fallaRequiereHardware(tipo: TipoFallaF0302, detalle: DetalleFallaF0302 = {}): boolean {
    if (this.matrizFalla(tipo).revisionHardware) return true;
    if (tipo === 'Problema de red') return detalle.requiereRevisionFisica === 'Sí';
    if (tipo === 'Configuración incompleta por falla previa') return detalle.accionRequerida === 'Revisar por Hardware';
    return false;
  }

  /** Opciones sugeridas de cada campo del checklist dinámico (spec §8). */
  readonly componentesFalla = ['Carcasa', 'Pantalla', 'Puertos', 'Fuente', 'Batería', 'Teclado', 'Touchpad', 'Otro'];
  readonly tiposDisco = ['HDD', 'SSD', 'NVMe', 'Otro'];
  readonly sintomasDisco = ['No detecta disco', 'Sectores dañados', 'Lentitud extrema', 'Error de arranque', 'Requiere cambio de disco', 'Otro'];
  readonly sintomasMemoria = ['No reconoce memoria', 'Pantallazos', 'Reinicio inesperado', 'Error en prueba de memoria', 'Otro'];
  readonly problemasSO = ['Error de arranque', 'Sistema inestable', 'Actualización fallida', 'Drivers pendientes', 'Activación pendiente', 'Otro'];
  readonly problemasRed = ['Sin conexión', 'No obtiene IP', 'IP duplicada', 'Problema de DNS', 'Problema de punto de red', 'Problema de adaptador', 'Otro'];
  readonly accesoriosFalla = ['Monitor', 'Teclado', 'Mouse', 'Maletín', 'Cargador', 'Otro'];
  readonly accionesRequeridasFalla: AccionRequeridaFalla[] =
    ['Corregir en F0302', 'Revisar por Hardware', 'Reproceso F0288', 'Escalar a Encargado'];

  /**
   * Valida el checklist dinámico antes de registrar la falla: exige la imagen que la respalda y los
   * campos del tipo seleccionado, y pide justificación cuando el técnico se aparta de la sugerencia
   * del sistema (en cualquiera de las dos direcciones) o decide un reproceso que el sistema no dedujo.
   */
  validarFalla(datos: {
    tipo: TipoFallaF0302; descripcion: string; requiereReprocesoF0288: boolean;
    justificacionReproceso?: string; detalle?: DetalleFallaF0302; evidencia?: string;
  }): string | null {
    const d = datos.detalle ?? {};
    const t = datos.tipo;
    if (!datos.descripcion.trim()) return 'La observación / descripción de la falla es obligatoria.';
    const sinImagen = this.faltaEvidenciaFalla(datos.evidencia ?? '');
    if (sinImagen) return sinImagen;
    if (t === 'Falla física del equipo' && !(d.componenteAfectado ?? '').trim()) {
      return 'Indique el componente afectado por la falla física.';
    }
    if (t === 'Falla de disco') {
      if (!(d.tipoDisco ?? '').trim()) return 'Indique el tipo de disco afectado.';
      if (!(d.sintoma ?? '').trim()) return 'Seleccione el síntoma detectado en el disco.';
    }
    if (t === 'Falla de memoria') {
      if (!(d.capacidadRam ?? '').trim()) return 'Indique la capacidad de RAM instalada.';
      if (!(d.sintoma ?? '').trim()) return 'Seleccione el síntoma detectado en la memoria.';
    }
    if (t === 'Problema de sistema operativo') {
      if (!(d.tipoProblemaSO ?? '').trim()) return 'Indique el tipo de problema del sistema operativo.';
      if (!d.requiereReinstalacion) return 'Indique si el problema requiere reinstalación o reparación base del sistema operativo.';
    }
    if (t === 'Problema de red') {
      if (!(d.tipoProblemaRed ?? '').trim()) return 'Indique el tipo de problema de red.';
      if (!(d.mac ?? '').trim()) return 'Indique la MAC del equipo para registrar el problema de red.';
      if ((d.mac ?? '').trim() && !this.macValida(d.mac ?? '')) return 'La MAC del equipo no tiene un formato válido.';
      if (!d.requiereRevisionFisica) return 'Indique si el problema de red requiere revisión física por Hardware.';
    }
    if (t === 'No permite ingreso a dominio') {
      if (!(d.usuarioCuenta ?? '').trim()) return 'Indique el usuario o cuenta con la que se intentó el ingreso al dominio.';
      if (!(d.mensajeError ?? '').trim()) return 'Registre el mensaje de error del intento de ingreso al dominio.';
      if (!(d.nombreEquipo ?? '').trim()) return 'Indique el nombre del equipo con el que se intentó ingresar al dominio.';
    }
    if (t === 'Accesorio faltante' && !(d.accesorio ?? '').trim()) return 'Indique el accesorio faltante.';
    if (t === 'Configuración incompleta por falla previa') {
      if (!(d.etapaDeteccion ?? '').trim()) return 'Indique la etapa donde se detectó la configuración incompleta.';
      if (!d.accionRequerida) return 'Seleccione la acción requerida para la configuración incompleta.';
    }

    const sugerida = this.sugerenciaReproceso(t, d);
    const elegida: SugerenciaReproceso = datos.requiereReprocesoF0288 ? 'Sí' : 'No';
    const just = (datos.justificacionReproceso ?? '').trim();
    if (sugerida !== 'Depende' && sugerida !== elegida && !just) {
      return `El sistema determinó «${sugerida === 'Sí' ? 'Reproceso F0288' : 'Corrección en el mismo F0302'}» para este tipo de falla: justifique el cambio antes de registrarla.`;
    }
    // «Otro» y «Configuración incompleta» quedan en manos del técnico: si decide el reproceso, la
    // justificación es lo único que deja constancia de por qué el equipo vuelve a preparación.
    if (sugerida === 'Depende' && datos.requiereReprocesoF0288 && !just) {
      return 'Registre la justificación del reproceso de Preparación F0288.';
    }
    return null;
  }

  // ---------- Evidencia de la falla F0302 ----------

  /**
   * Lleva al almacén común las imágenes de falla que el set de datos ya trae referenciadas en la
   * configuración, sin duplicar las que la foto guardada tuviera. **No inventa la fotografía**: la
   * evidencia va sin `imagen` y la galería la dibuja como vista previa simulada, igual que el resto
   * de las evidencias de demostración. Sin este paso, la imagen con la que se reportó una falla no
   * llegaría al reproceso que esa falla originó.
   */
  private evidenciasDeFallasSembradas(guardadas: EvidenciaTecnica[]): EvidenciaTecnica[] {
    const lista = [...(guardadas ?? [])];
    for (const c of this.configuraciones()) {
      const archivo = (c.falla?.evidencia ?? '').trim();
      if (!c.falla || !archivo || !this.evid.formatoValido(archivo)) continue;
      const repetida = lista.some((e) => e.modulo === 'Configuración F0302'
        && e.proceso === c.expediente && e.archivo === archivo);
      if (repetida) continue;
      lista.push({
        modulo: 'Configuración F0302', proceso: c.expediente, expediente: c.expediente,
        archivo, tipo: this.TIPO_EVIDENCIA_FALLA, fecha: c.falla.fecha, hora: c.falla.hora,
        cargadaPor: c.falla.tecnicoReporta, rol: this.rolDeUsuario(c.falla.tecnicoReporta),
        item: this.etiquetaEvidenciaFalla(c.falla.tipo), formato: this.evid.formatoDe(archivo)
      });
    }
    return lista;
  }

  /** Tipo con el que se guarda la imagen de una falla; la distingue de la de su corrección. */
  readonly TIPO_EVIDENCIA_FALLA: TipoEvidencia = 'Evidencia de falla F0302';
  readonly MSG_EVIDENCIA_FALLA = 'Debe adjuntar una imagen de evidencia de la falla detectada para registrar la incidencia.';
  readonly MSG_EVIDENCIA_CORRECCION_SOPORTE = 'Debe adjuntar una imagen que respalde la corrección realizada en F0302.';

  /**
   * Cómo se nombra la imagen que respalda una falla, según el tipo detectado. El técnico no elige
   * la etiqueta: sale del tipo de falla que acaba de seleccionar.
   */
  etiquetaEvidenciaFalla(tipo: TipoFallaF0302): string {
    switch (tipo) {
      case 'Problema de sistema operativo': return 'Evidencia de falla de sistema operativo';
      case 'Falla de disco': return 'Evidencia de falla de disco';
      case 'Falla de memoria': return 'Evidencia de falla de memoria';
      case 'Falla física del equipo': return 'Evidencia de falla física';
      case 'Accesorio faltante': return 'Evidencia de accesorio faltante';
      case 'Problema de red': return 'Evidencia de falla de red física';
      default: return 'Evidencia de falla reportada';
    }
  }

  /**
   * Lo que impide registrar la falla por su imagen: que no haya archivo, o que el archivo no sea
   * una imagen. Una falla sin respaldo visual es una afirmación sin comprobante, y de ella pueden
   * salir un reproceso o la sustitución del equipo.
   */
  faltaEvidenciaFalla(archivo: string): string | null {
    const a = (archivo ?? '').trim();
    if (!a) return this.MSG_EVIDENCIA_FALLA;
    if (!this.evid.formatoValido(a)) return this.evid.MSG_FORMATO;
    return null;
  }

  /** Imagen con la que se reportó la falla de un F0302, si la hay. */
  evidenciaDeFalla(expediente: string): EvidenciaTecnica | undefined {
    return this.evid.de('Configuración F0302', expediente)
      .filter((e) => e.tipo === this.TIPO_EVIDENCIA_FALLA).at(-1);
  }

  /** Texto legible de los estados técnicos de la incidencia (spec §9), para mostrarlos sin jerga. */
  textoEstadoIncidencia(estado: EstadoIncidenciaF0302): string {
    switch (estado) {
      case 'INCIDENCIA_CONFIGURACION_REGISTRADA': return 'Incidencia de configuración registrada';
      case 'PENDIENTE_CORRECCION_SOPORTE': return 'Pendiente de corrección de Soporte';
      case 'PENDIENTE_REVISION_HARDWARE': return 'Pendiente de revisión de Hardware';
      case 'REPROCESO_F0288_REQUERIDO': return 'Reproceso F0288 requerido';
      case 'REPROCESO_F0288_PENDIENTE_ASIGNACION': return 'Reproceso F0288 pendiente de asignación';
      case 'REPROCESO_F0288_ASIGNADO': return 'Reproceso F0288 asignado';
      case 'REPROCESO_F0288_EN_PROCESO': return 'Reproceso F0288 en proceso';
      case 'REPROCESO_F0288_FINALIZADO': return 'Reproceso F0288 finalizado';
      case 'REPROCESO_F0288_FIRMADO': return 'Reproceso F0288 firmado';
      case 'REPROCESO_F0288_NO_CORREGIDO': return 'Reproceso F0288 no corregido';
      case 'PENDIENTE_EVALUACION_ENCARGADO': return 'Pendiente de evaluación del Encargado';
      case 'PENDIENTE_SUSTITUCION_EQUIPO': return 'Pendiente de sustitución de equipo';
      default: return 'Listo para reintento F0302';
    }
  }

  /**
   * Completa los reprocesos guardados por una versión anterior, que no tenían asignación,
   * checklist, evidencias, cronómetro, firma ni resultado. El estado se conserva: un reproceso
   * que quedó «Finalizado» sin firma sigue sin firma —no se inventa una— y por eso no podrá
   * devolver el equipo hasta que alguien la registre, que es exactamente la regla nueva.
   */
  private normalizarReprocesos(lista: ReprocesoF0288[]): ReprocesoF0288[] {
    return (lista ?? []).map((r) => ({
      ...r,
      // «Requerido» pasó a llamarse «Pendiente de asignación»: el nombre dice ahora qué falta y
      // de quién depende, que es lo que la bandeja de Encargados necesita mostrar.
      estado: (r.estado as string) === 'Requerido' ? 'Pendiente de asignación' : r.estado,
      justificacionReprocesoSimultaneo: r.justificacionReprocesoSimultaneo ?? '',
      prioridad: r.prioridad ?? 'Normal',
      unidadAtiende: r.unidadAtiende ?? 'Hardware',
      justificacionUnidad: r.justificacionUnidad ?? '',
      observacionSoporte: r.observacionSoporte ?? r.motivo ?? '',
      evidenciaSoporte: r.evidenciaSoporte ?? '',
      tecnicoAsignado: r.tecnicoAsignado ?? r.atendidoPor ?? '',
      asignadoPor: r.asignadoPor ?? '',
      fechaAsignacion: r.fechaAsignacion ?? '',
      horaAsignacion: r.horaAsignacion ?? '',
      tipoProblema: r.tipoProblema ?? this.tipoProblemaDeFalla(r.tipoFalla),
      // Un checklist ya guardado no se rehace: se le completan la sección y la condición, que son
      // lecturas de su propio texto, no cambios en lo que el técnico marcó.
      checklist: r.checklist?.length
        ? r.checklist.map((i) => ({ ...i, seccion: this.seccionDeItem(i), opcional: this.itemAdmiteNoAplica(i) }))
        : this.checklistReproceso(this.tipoProblemaDeFalla(r.tipoFalla)),
      evidencias: r.evidencias ?? [],
      resultado: r.resultado ?? '',
      observacionResultado: r.observacionResultado ?? '',
      // Los reprocesos guardados antes de que la inconformidad usara este mecanismo vienen todos
      // de una falla de F0302: es de donde salían.
      origen: r.origen ?? 'Falla F0302'
    }));
  }

  /**
   * Completa las correcciones de inconformidad guardadas por una versión anterior, cuando la
   * atención se clasificaba como «tipo de corrección» y podía crear un Expediente técnico nuevo.
   * El checklist queda vacío a propósito: nadie lo llenó entonces y el prototipo no inventa
   * ítems marcados. La firma tampoco se fabrica —una corrección vieja sigue sin firmar—, así que
   * el reenvío del formulario esperará a que alguien la registre, que es la regla nueva.
   */
  private normalizarCorrecciones(lista: CorreccionNoConformidad[]): CorreccionNoConformidad[] {
    const tipoViejo: Record<string, TipoProblemaInconformidad> = {
      'Corrección de configuración': 'Problema de configuración',
      'Revisión técnica / Hardware': 'Falla física del equipo',
      'Accesorios': 'Accesorio faltante',
      'Otro': 'Otro'
    };
    return (lista ?? []).map((c) => {
      const previo = c as CorreccionNoConformidad & { tipo?: string; requiereNuevoExpediente?: boolean };
      const tipoProblema = c.tipoProblema ?? tipoViejo[previo.tipo ?? ''] ?? 'Otro';
      const resolucion: ResolucionInconformidad = c.resolucion
        ?? (previo.requiereNuevoExpediente ? 'Reproceso F0288' : 'Corrección F0302');
      const estado = c.estado ?? 'Iniciada';
      const estadoIncidencia: EstadoIncidenciaConformidad = c.estadoIncidencia
        ?? (estado === 'Finalizada' ? 'CORRECCION_F0302_FINALIZADA'
          : resolucion === 'Reproceso F0288' ? 'REPROCESO_F0288_REQUERIDO' : 'CORRECCION_F0302_EN_PROCESO');
      return {
        ...c, tipoProblema, resolucion, sugerencia: c.sugerencia ?? resolucion,
        justificacionResolucion: c.justificacionResolucion ?? '',
        usuarioFinal: c.usuarioFinal ?? this.ultimoIntento(c.expediente)?.usuarioFinal ?? '',
        checklist: c.checklist ?? [], evidencias: c.evidencias ?? [],
        resultado: c.resultado ?? '', estadoIncidencia, estado
      };
    });
  }

  /** Reprocesos F0288 de un Expediente técnico, del más reciente al más antiguo. */
  reprocesosDeExpTecnico(codigoTec: string): ReprocesoF0288[] {
    return this.reprocesos().filter((r) => r.expedienteTecnico === codigoTec).sort((a, b) => b.numero - a.numero);
  }
  /** Reprocesos F0288 del equipo, del más reciente al más antiguo. */
  reprocesosDeEquipo(inventario: string): ReprocesoF0288[] {
    return this.reprocesos().filter((r) => r.inventario === inventario)
      .sort((a, b) => `${b.fechaSolicitud}${b.horaSolicitud}`.localeCompare(`${a.fechaSolicitud}${a.horaSolicitud}`));
  }
  /** Reproceso F0288 abierto del equipo (aún sin firmar), si lo hay. */
  reprocesoAbiertoDeEquipo(inventario: string): ReprocesoF0288 | undefined {
    return this.reprocesosDeEquipo(inventario).find((r) => r.estado !== 'Firmado' && r.estado !== 'No corregido');
  }
  /**
   * Reprocesos que todavía piden algo: los requeridos, los asignados, los que están en proceso y
   * los firmados que aún no devolvieron el equipo a Configuración F0302.
   */
  reprocesosPendientes(): ReprocesoF0288[] {
    return this.reprocesos()
      .filter((r) => r.estado !== 'No corregido' &&
        (r.estado !== 'Firmado' || this.fallaVigenteDe(r.expediente)?.estadoIncidencia === 'REPROCESO_F0288_FIRMADO'))
      .sort((a, b) => (a.prioridad === b.prioridad ? 0 : a.prioridad === 'Alta' ? -1 : 1)
        || `${b.fechaSolicitud}${b.horaSolicitud}`.localeCompare(`${a.fechaSolicitud}${a.horaSolicitud}`));
  }
  /**
   * Reprocesos visibles según el rol. El Técnico de Hardware ve **solo los que le asignaron**: si
   * viera los pendientes de asignación podría tomarlos, y repartir la carga de Hardware es tarea
   * del Encargado. Los Encargados y el Administrador ven todos; el Técnico de Soporte ve los de
   * los procesos donde participó, porque son los que está esperando.
   */
  reprocesosVisibles(): ReprocesoF0288[] {
    const clave = this.claveConectada();
    const nombre = this.nombreConectado();
    const todos = this.reprocesos();
    if (clave === 'tec-hardware') {
      return todos.filter((r) => !!r.tecnicoAsignado && r.tecnicoAsignado.includes(nombre));
    }
    if (clave === 'tec-soporte') {
      return todos.filter((r) => r.solicitadoPor.includes(nombre) || this.participaEnProceso(r.expediente, nombre));
    }
    return todos;
  }
  reprocesoDe(idReproceso: string): ReprocesoF0288 | undefined {
    return this.reprocesos().find((r) => r.id === idReproceso);
  }
  /** Falla vigente del proceso: la del intento F0302 con falla más reciente. */
  fallaVigenteDe(id: string): FallaF0302 | undefined {
    return this.configuracionesConFallaDe(id)[0]?.falla;
  }

  /**
   * Reporta una falla detectada durante la Configuración F0302: detiene el cronómetro y guarda el
   * tiempo trabajado, marca el F0302 como intento «Con falla» (nunca se borra) y abre una
   * **incidencia de configuración sobre el MISMO Expediente técnico**.
   *
   * Lo que ya no hace: crear un ingreso a Hardware y, con él, obligar a un Expediente técnico
   * nuevo. Multiplicar expedientes por cada falla del mismo ciclo desordenaba el historial sin
   * aportar nada; cuando la falla exige volver a preparación se abre un **reproceso F0288** dentro
   * del expediente vigente. Un expediente nuevo solo corresponde en un ciclo nuevo: reingreso
   * formal tras descargo, sustitución del equipo o autorización de jefatura.
   *
   * Devuelve null si se registró, o el mensaje de la validación que falló.
   */
  reportarFallaF0302(id: string, datos: {
    tipo: TipoFallaF0302; descripcion: string; requiereReprocesoF0288: boolean;
    justificacionReproceso?: string; detalle?: DetalleFallaF0302;
    observacionTecnica?: string;
    /** Nombre e imagen de la evidencia de la falla; sin ella la incidencia no se registra. */
    evidencia?: string; evidenciaImagen?: string;
    /** Excepción de un Encargado para abrir un reproceso con otro todavía abierto. */
    justificacionReprocesoSimultaneo?: string;
  }, usuario: string): string | null {
    const c = this.configuracionDe(id);
    if (!c) return 'No se encontró la configuración indicada.';
    if (c.estado === 'Con falla') return 'Esta configuración ya fue reportada con falla.';
    if (c.estado === 'Completada') return 'La configuración ya fue finalizada; no puede reportarse una falla.';
    if (c.estado === 'Cerrada') return 'Esta configuración quedó cerrada por un descargo del equipo.';
    if (!c.cronometro) return 'Inicie la configuración (cronómetro en curso) antes de reportar una falla.';
    // El intento sin imagen se anota antes de rechazarlo: que alguien haya intentado registrar una
    // falla sin respaldo es parte de la historia del expediente.
    const sinImagen = this.faltaEvidenciaFalla(datos.evidencia ?? '');
    if (sinImagen) {
      this.registrarEvento(id, usuario, 'Intento de registrar falla sin evidencia', 'En configuración',
        sinImagen, false,
        { modulo: 'Configuración F0302', inventario: c.datos.inventario,
          expedienteTecnico: this.expTecnicoDeEquipo(c.datos.inventario)?.codigo,
          expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, rol: this.rolDeUsuario(usuario),
          tipoFalla: datos.tipo, estadoValidacion: 'Sin evidencia',
          accionTomada: 'Registro de la falla bloqueado por falta de imagen' });
      return sinImagen;
    }
    const invalido = this.validarFalla(datos);
    if (invalido) return invalido;

    const detalle: DetalleFallaF0302 = { ...(datos.detalle ?? {}) };
    const reproceso = datos.requiereReprocesoF0288;
    const hardware = this.fallaRequiereHardware(datos.tipo, detalle);
    // Un solo reproceso abierto por Expediente técnico: dos corrigiendo la misma preparación al
    // mismo tiempo se pisarían y el historial no diría cuál dejó el equipo como quedó. Un Encargado
    // puede autorizar la excepción, pero deja escrito por qué.
    const justSimultaneo = (datos.justificacionReprocesoSimultaneo ?? '').trim();
    const codigoTecnico = this.expTecnicoDeEquipo(c.datos.inventario)?.codigo;
    if (reproceso && codigoTecnico) {
      const abierto = this.reprocesoAbiertoDeExpTecnico(codigoTecnico);
      if (abierto && !this.puedeAsignarReprocesos()) {
        return 'Ya existe un reproceso abierto para este expediente. Debe cerrarse antes de generar uno nuevo.';
      }
      if (abierto && !justSimultaneo) {
        return `Ya existe un reproceso abierto para este expediente (${abierto.id}, ${abierto.estado}). Justifique la excepción para generar uno nuevo.`;
      }
    }
    const crono = this.detenerCronometro(c.cronometro, usuario);
    const estadoIncidencia: EstadoIncidenciaF0302 = reproceso
      ? 'REPROCESO_F0288_PENDIENTE_ASIGNACION'
      : hardware ? 'PENDIENTE_REVISION_HARDWARE' : 'PENDIENTE_CORRECCION_SOPORTE';
    const falla: FallaF0302 = {
      tipo: datos.tipo, descripcion: datos.descripcion.trim(), requiereHardware: hardware,
      requiereReprocesoF0288: reproceso, sugerencia: this.sugerenciaReproceso(datos.tipo, detalle),
      justificacionReproceso: (datos.justificacionReproceso ?? '').trim(), detalle, estadoIncidencia,
      observacionTecnica: (datos.observacionTecnica ?? '').trim(), evidencia: (datos.evidencia ?? '').trim(),
      tecnicoReporta: usuario, fecha: this.hoy(), hora: this.hora(), tiempoMinutos: crono.duracionMinutos
    };
    // El F0302 con falla se conserva: solo cambia de estado y guarda la falla; nunca se elimina.
    this.actualizarConfiguracionActiva(id, (x) => ({ ...x, estado: 'Con falla', cronometro: crono, falla }));

    const tiempo = this.formatoDuracion(crono.duracionMinutos);
    const unicoCod = this.expedienteUnicoDe(id)?.codigoUnico;
    const codigoTec = this.expTecnicoDeEquipo(c.datos.inventario)?.codigo;
    const ref = {
      modulo: 'Configuración F0302', inventario: c.datos.inventario, expedienteUnico: unicoCod,
      expedienteTecnico: codigoTec, usuarioFinal: c.datos.asignadoA, tipoFalla: datos.tipo,
      requiereReproceso: reproceso ? 'Sí' : 'No', evidencia: falla.evidencia,
      rol: this.rolDeUsuario(usuario), tipoEvidencia: this.TIPO_EVIDENCIA_FALLA
    };
    const accion = reproceso ? 'Reproceso F0288 dentro del mismo Expediente técnico'
      : hardware ? 'Revisión de Hardware sin reproceso F0288' : 'Corrección de Soporte en el mismo F0302';

    // La imagen de la falla se guarda con el resto de las evidencias del expediente. Su etiqueta
    // sale del tipo de falla, y su tipo la separa de la imagen de la corrección posterior.
    this.adjuntarEvidencia({
      modulo: 'Configuración F0302', proceso: id, expediente: id, inventario: c.datos.inventario,
      archivo: falla.evidencia, tipo: this.TIPO_EVIDENCIA_FALLA, usuario,
      imagen: datos.evidenciaImagen, item: this.etiquetaEvidenciaFalla(datos.tipo)
    });
    this.registrarEvento(id, usuario, 'Imagen de evidencia de falla cargada', 'F0302 con falla',
      `${falla.evidencia} · ${this.etiquetaEvidenciaFalla(datos.tipo)}`, false,
      { ...ref, estadoValidacion: 'Válida', accionTomada: accion });

    // No habilita aceptación ni garantía: el expediente queda con la incidencia abierta.
    this.setEstadoSolicitud(id, 'F0302 con falla',
      reproceso ? 'Reproceso F0288 por falla en la configuración' : 'Corrección de Soporte por falla en la configuración');
    this.expedientesUnicos.update((list) =>
      list.map((x) => (x.expediente === id
        ? { ...x, estado: reproceso ? 'Pendiente de reproceso F0288' : 'Pendiente de corrección de Soporte',
            resumenEstado: `F0302 con falla · ${this.textoEstadoIncidencia(estadoIncidencia)}` }
        : x)));
    this.actualizarAnexo(id, 'Se anexa configuración del equipo', 'Con falla', `${datos.tipo}: ${falla.descripcion}`);

    // Trazabilidad de la incidencia (spec §14).
    this.registrarEvento(id, usuario, 'Falla reportada durante F0302', 'F0302 con falla',
      `${datos.tipo}: ${falla.descripcion}`, true, { ...ref, estadoAnterior: 'En configuración', tiempo, accionTomada: accion });
    this.registrarEvento(id, usuario, `Tipo de falla seleccionado: ${datos.tipo}`, 'F0302 con falla',
      this.resumenDetalleFalla(falla), false, { ...ref, accionTomada: accion });
    this.registrarEvento(id, usuario, 'Checklist dinámico de falla cargado', 'F0302 con falla',
      this.matrizFalla(datos.tipo).nota, false, { ...ref, accionTomada: accion });
    this.registrarEvento(id, usuario,
      `Requiere reproceso F0288 evaluado: ${reproceso ? 'Sí' : 'No'}`, 'F0302 con falla',
      falla.sugerencia === (reproceso ? 'Sí' : 'No')
        ? `Sugerencia del sistema para «${datos.tipo}»: ${falla.sugerencia}.`
        : `Sugerencia del sistema: ${falla.sugerencia}. Justificación del cambio: ${falla.justificacionReproceso}`,
      true, { ...ref, accionTomada: accion, justificacion: falla.justificacionReproceso });
    this.registrarEvento(id, usuario, 'Decisión de corrección definida', 'F0302 con falla',
      reproceso ? 'Reproceso F0288: el equipo vuelve a preparación.'
        : 'Corrección en el mismo F0302: el equipo no vuelve a preparación.', true,
      { ...ref, accionTomada: accion, justificacion: falla.justificacionReproceso });
    this.registrarEvento(id, usuario, `Cronómetro F0302 detenido por falla (tiempo trabajado: ${tiempo || 'menos de 1 min'})`,
      'F0302 con falla', '', false, { ...ref, tiempo });
    this.registrarEvento(id, usuario, 'F0302 guardado como intento con falla', 'F0302 con falla',
      'El intento se conserva en el historial: no se borra ni se reinician los contadores.', false, { ...ref, accionTomada: accion });
    this.registrarEvento(id, usuario, 'Incidencia de configuración registrada', this.textoEstadoIncidencia(estadoIncidencia),
      `Asociada al Expediente técnico ${codigoTec ?? '—'} y al Expediente único ${unicoCod ?? '—'}: no se crea un Expediente técnico nuevo.`,
      true, { ...ref, accionTomada: accion });

    if (reproceso) {
      const r = this.abrirReprocesoF0288(c, falla, usuario, codigoTec, unicoCod, justSimultaneo);
      this.actualizarConfiguracionConFalla(id, (f) => ({ ...f, reprocesoId: r.id }));
      this.registrarEvento(id, usuario, 'Reproceso F0288 requerido', 'Reproceso F0288 requerido',
        `La falla «${datos.tipo}» exige volver a preparación: el equipo no continúa en F0302.`, true,
        { ...ref, accionTomada: accion, reproceso: r.id });
      this.registrarEvento(id, usuario, 'Reproceso F0288 generado', 'Reproceso F0288 pendiente de asignación',
        `${r.id} — reproceso #${r.numero} del Expediente técnico ${r.expedienteTecnico}. No se crea un Expediente técnico nuevo.`
          + (justSimultaneo ? ` Excepción autorizada: ${justSimultaneo}` : ''),
        true, { ...ref, accionTomada: accion, reproceso: r.id, justificacion: justSimultaneo });
      this.registrarEvento(id, usuario, 'Equipo enviado a reproceso F0288', 'Reproceso F0288 pendiente de asignación',
        `Reproceso ${r.id} sobre el Expediente técnico ${r.expedienteTecnico}; el F0288 original se conserva.`,
        true, { ...ref, accionTomada: accion, reproceso: r.id });
      // Nadie lo toma solo: la bandeja de Encargados es la que decide quién lo atiende.
      this.registrarEvento(id, usuario, 'Reproceso pendiente de asignación por Encargado',
        'Reproceso F0288 pendiente de asignación',
        'El Técnico de Soporte reporta la falla; la asignación a Hardware la hace un Encargado.',
        true, { ...ref, accionTomada: 'Pendiente de asignación por Encargado', reproceso: r.id,
          encargadoAsigno: 'Pendiente de asignación', tecnicoHardware: 'Sin asignar' });
    } else {
      this.registrarEvento(id, usuario, 'Equipo enviado a corrección de Soporte',
        this.textoEstadoIncidencia(estadoIncidencia),
        'La falla se atiende en el mismo F0302: el equipo no regresa a Preparación F0288.',
        true, { ...ref, accionTomada: accion });
    }
    return null;
  }

  /** Resumen de una línea con los campos del checklist dinámico que sí aplican al tipo de falla. */
  resumenDetalleFalla(f: FallaF0302): string {
    const d = f.detalle ?? {};
    const partes: string[] = [];
    const agrega = (etiqueta: string, valor?: string) => { if ((valor ?? '').trim()) partes.push(`${etiqueta}: ${valor}`); };
    agrega('Componente afectado', d.componenteAfectado);
    agrega('Tipo de disco', d.tipoDisco);
    agrega('Serie del disco', d.serieDisco);
    agrega('RAM instalada', d.capacidadRam);
    agrega('Síntoma', d.sintoma);
    agrega('Problema del SO', d.tipoProblemaSO);
    agrega('¿Reinstalación o reparación base?', d.requiereReinstalacion);
    agrega('Problema de red', d.tipoProblemaRed);
    agrega('MAC', d.mac);
    agrega('IP actual', d.ipActual);
    agrega('Punto de red', d.puntoRed);
    agrega('¿Revisión física por Hardware?', d.requiereRevisionFisica);
    agrega('Usuario o cuenta', d.usuarioCuenta);
    agrega('Mensaje de error', d.mensajeError);
    agrega('Nombre del equipo', d.nombreEquipo);
    agrega('Accesorio faltante', d.accesorio);
    agrega('Inventario esperado', d.inventarioEsperado);
    agrega('Etapa de detección', d.etapaDeteccion);
    agrega('Acción requerida', d.accionRequerida);
    agrega('Observación para Hardware', d.observacionHardware);
    return partes.join(' · ');
  }

  /** Actualiza la falla del intento F0302 con falla más reciente del proceso. */
  private actualizarConfiguracionConFalla(id: string, cambio: (f: FallaF0302) => FallaF0302): void {
    const objetivo = this.configuracionesConFallaDe(id)[0];
    if (!objetivo?.falla) return;
    this.configuraciones.update((list) =>
      list.map((c) => (c === objetivo && c.falla ? { ...c, falla: cambio(c.falla) } : c)));
  }

  /**
   * Tipo de problema del reproceso a partir de la falla que lo originó. «Problema de red» solo
   * llega a reproceso cuando Soporte marcó revisión **física**, así que se nombra como tal; el
   * dominio y la configuración incompleta no son trabajo de Hardware sobre el equipo y caen en
   * «Otro», donde el técnico describe lo que encontró.
   */
  tipoProblemaDeFalla(tipo: TipoFallaF0302): TipoProblemaReproceso {
    switch (tipo) {
      case 'Accesorio faltante': return 'Accesorio faltante';
      case 'Falla física del equipo': return 'Falla física del equipo';
      case 'Falla de disco': return 'Falla de disco';
      case 'Falla de memoria': return 'Falla de memoria';
      case 'Problema de sistema operativo': return 'Problema de sistema operativo';
      case 'Problema de red': return 'Problema de red física';
      default: return 'Otro';
    }
  }

  /**
   * Checklist de Reproceso F0288 según el **tipo de problema** que se va a revisar. Es un checklist
   * PROPIO, no una copia del F0288: la preparación inicial ya se hizo y no se repite. Cada tipo
   * trae solo lo suyo —un accesorio faltante no pide revisar el disco, y una falla física no pide
   * dominio ni credenciales, que son de F0302—.
   *
   * Los ítems marcados `implicaCorreccion` son los que dejan de ser revisión y pasan a ser
   * intervención sobre el equipo.
   */
  checklistReproceso(tipo: TipoProblemaReproceso): ItemReproceso[] {
    // El nombre del ítem declara si es condicional: «si aplica» y «si corresponde» son las únicas
    // formas de que un ítem admita «No aplica». Deducirlo del texto evita que la lista y la regla
    // se separen con el tiempo.
    const item = (seccion: SeccionReproceso, nombre: string, implicaCorreccion = false): ItemReproceso =>
      ({ nombre, estado: 'Pendiente', implicaCorreccion, seccion, opcional: this.itemOpcional(nombre), nota: '' });
    const diag = (nombre: string, corr = false) => item('Diagnóstico', nombre, corr);
    const accion = (nombre: string, corr = true) => item('Acción correctiva', nombre, corr);
    const valida = (nombre: string) => item('Validación posterior', nombre);
    const evidencia = (nombre: string, corr = true) => item('Evidencia', nombre, corr);
    // Las dos últimas son iguales en todos los tipos: el reproceso siempre cierra registrando qué
    // se hizo y qué observó Hardware.
    const cierre = (): ItemReproceso[] => [
      item('Cierre del reproceso', 'Registrar corrección técnica realizada'),
      item('Cierre del reproceso', 'Registrar observaciones de Hardware, si corresponde')
    ];
    switch (tipo) {
      case 'Accesorio faltante':
        return [diag('Revisar observación reportada por Soporte o Usuario Final'),
          diag('Identificar accesorio faltante'), diag('Verificar tipo de equipo: CPU o Laptop'),
          diag('Validar accesorios requeridos según tipo de equipo'),
          accion('Buscar accesorio en base institucional simulada', false),
          accion('Asociar número de inventario del accesorio'),
          valida('Verificar estado físico del accesorio'),
          valida('Confirmar que el equipo queda completo para continuar'),
          evidencia('Registrar evidencia del accesorio asociado'),
          ...cierre()];
      case 'Falla física del equipo':
        return [diag('Revisar observación reportada'), diag('Realizar inspección física general'),
          diag('Revisar carcasa, tornillos, tapas y estructura externa'),
          diag('Revisar puertos físicos del equipo'), diag('Revisar conectores de energía'),
          diag('Revisar estado de ventilación'), diag('Verificar si existen daños visibles'),
          accion('Corregir o reemplazar la pieza dañada, si corresponde'),
          valida('Indicar si el equipo queda apto para continuar'),
          evidencia('Adjuntar evidencia fotográfica del diagnóstico o la corrección'),
          ...cierre()];
      case 'Falla de disco':
        return [diag('Revisar observación reportada'), diag('Verificar detección del disco'),
          diag('Revisar conexión física del disco'), diag('Ejecutar verificación básica del disco'),
          diag('Registrar capacidad del disco'), diag('Registrar número de serie del disco, si aplica'),
          accion('Sustituir disco, si corresponde'),
          valida('Validar arranque del sistema después de la revisión'),
          evidencia('Adjuntar evidencia del diagnóstico o la sustitución'),
          ...cierre()];
      case 'Falla de memoria':
        return [diag('Revisar observación reportada'), diag('Verificar capacidad de memoria instalada'),
          diag('Revisar módulos de RAM instalados'), diag('Ejecutar prueba básica de memoria'),
          accion('Retirar y reinstalar módulo, si aplica'),
          accion('Sustituir módulo de memoria, si corresponde'),
          valida('Registrar capacidad final de memoria'), valida('Confirmar estabilidad del equipo'),
          evidencia('Adjuntar evidencia del diagnóstico o la sustitución'),
          ...cierre()];
      case 'Problema de sistema operativo':
        // Sin credenciales, dominio ni DLP: esos pasos pertenecen a la Configuración F0302.
        return [diag('Revisar observación reportada'), diag('Validar inicio del sistema operativo'),
          diag('Revisar errores de arranque'),
          accion('Reparar sistema operativo, si aplica'),
          accion('Reinstalar Windows, si corresponde'),
          valida('Verificar activación o configuración base'),
          valida('Verificar instalación de .NET Framework 3.5, si aplica'),
          valida('Verificar actualizaciones básicas'),
          valida('Confirmar que el equipo queda listo para regresar a Configuración F0302'),
          evidencia('Adjuntar evidencia de diagnóstico o corrección'),
          ...cierre()];
      case 'Problema de red física':
        // La reserva de IP no entra aquí: se resuelve en F0302 o en la validación previa a conformidad.
        return [diag('Revisar observación reportada'), diag('Verificar puerto físico de red'),
          diag('Verificar adaptador de red'), diag('Validar dirección MAC del equipo'),
          accion('Revisar o sustituir conexión física o cableado, si aplica'),
          valida('Verificar reconocimiento del adaptador en el sistema'),
          valida('Confirmar si el equipo queda apto para continuar'),
          evidencia('Adjuntar evidencia del diagnóstico o la corrección'),
          ...cierre()];
      case 'Problema de encendido':
        return [diag('Revisar observación reportada'), diag('Verificar conexión eléctrica'),
          diag('Verificar botón de encendido'), diag('Revisar indicadores de energía'),
          accion('Revisar o sustituir cargador o fuente de poder, si aplica'),
          valida('Validar encendido del equipo'),
          valida('Indicar si el equipo queda apto para continuar'),
          evidencia('Adjuntar evidencia del diagnóstico o la corrección'),
          ...cierre()];
      case 'Problema de periféricos':
        return [diag('Revisar observación reportada'), diag('Identificar periférico con problema'),
          diag('Validar conexión del periférico'), diag('Verificar funcionamiento del periférico'),
          accion('Sustituir periférico, si corresponde'),
          accion('Registrar inventario del periférico, si aplica', false),
          valida('Confirmar que el problema fue corregido'),
          evidencia('Adjuntar evidencia del periférico revisado o sustituido'),
          ...cierre()];
      default:
        // «Otro»: checklist general controlado. La descripción del problema es obligatoria.
        return [diag('Revisar observación reportada'), diag('Registrar diagnóstico técnico'),
          diag('Describir problema identificado'),
          accion('Registrar acción correctiva aplicada, si corresponde'),
          valida('Indicar resultado del reproceso'),
          evidencia('Adjuntar evidencia, si aplica', false),
          ...cierre()];
    }
  }

  /** Orden en que se leen las secciones del checklist de reproceso. */
  readonly seccionesReproceso: SeccionReproceso[] =
    ['Diagnóstico', 'Acción correctiva', 'Validación posterior', 'Evidencia', 'Cierre del reproceso'];

  /**
   * ¿El ítem es condicional? Lo dice su propio texto. Solo estos admiten «No aplica»: los demás
   * son parte de la revisión que el tipo de problema exige.
   */
  itemOpcional(nombre: string): boolean {
    return /,\s*si (aplica|corresponde|existen?)/i.test(nombre);
  }

  /**
   * Sección de un ítem guardado antes de que el checklist tuviera secciones. No se reescribe el
   * nombre —eso cambiaría lo que el técnico marcó—: solo se ubica en la sección que le toca para
   * poder leerlo agrupado.
   */
  seccionDeItem(item: ItemReproceso): SeccionReproceso {
    if (item.seccion) return item.seccion;
    const n = item.nombre;
    if (/evidencia/i.test(n)) return 'Evidencia';
    if (/^Registrar (corrección técnica|observaci)/i.test(n)) return 'Cierre del reproceso';
    if (/^(Sustituir|Reparar|Reinstalar|Retirar|Asociar|Corregir|Cambiar|Cambio|Buscar|Reemplazar)/i.test(n)) return 'Acción correctiva';
    if (/(arranque|estabilidad|apto para continuar|queda (completo|listo)|fue corregido|resultado del reproceso)/i.test(n)) return 'Validación posterior';
    return 'Diagnóstico';
  }

  /**
   * Checklist del reproceso agrupado por sección, en el orden de lectura y sin secciones vacías.
   * Es la forma en que se muestra en pantalla y se imprime en la constancia.
   */
  checklistPorSeccion(r: ReprocesoF0288): { seccion: SeccionReproceso; items: ItemReproceso[] }[] {
    return this.seccionesReproceso
      .map((seccion) => ({ seccion, items: r.checklist.filter((i) => this.seccionDeItem(i) === seccion) }))
      .filter((g) => g.items.length > 0);
  }

  /**
   * Estado del ítem tal como se lee en pantalla y en la constancia. `Realizado` se guarda así en
   * todo el prototipo; aquí se nombra **Completado**, que es lo que significa en un checklist.
   */
  etiquetaItemReproceso(item: ItemReproceso): 'Pendiente' | 'Completado' | 'No aplica' {
    return item.estado === 'Realizado' ? 'Completado' : item.estado === 'No aplica' ? 'No aplica' : 'Pendiente';
  }

  /**
   * ¿Marcar este ítem obliga a adjuntar evidencia? Los de intervención sobre el equipo y los de la
   * sección Evidencia: dar por adjuntado un archivo que no existe es la contradicción que se
   * quiere evitar.
   */
  itemRequiereEvidencia(item: ItemReproceso): boolean {
    return !!item.implicaCorreccion || this.seccionDeItem(item) === 'Evidencia';
  }

  /** ¿Este ítem admite «No aplica»? Solo los condicionales; el resto hay que resolverlos. */
  itemAdmiteNoAplica(item: ItemReproceso): boolean {
    return item.opcional ?? this.itemOpcional(item.nombre);
  }

  /**
   * Accesorios que exige el tipo de equipo, para el checklist de «Accesorio faltante». Es el mismo
   * criterio del F0288: un CPU usado llega con monitor, teclado y ratón; una laptop usada, con
   * ratón y maletín.
   */
  accesoriosRequeridos(inventario: string): string[] {
    const eq = this.equipoDe(inventario);
    if (!eq || eq.condicion !== 'Usado') return [];
    return eq.tipo === 'Desktop' ? ['Monitor', 'Teclado', 'Mouse'] : ['Mouse', 'Maletín'];
  }

  /**
   * Catálogo de tipos de evidencia. Desde la regla global es el mismo en todo el sistema: el
   * reproceso ya no tiene una lista propia, usa la de `EvidenciaService`.
   */
  readonly tiposEvidenciaReproceso = this.evid.tipos;

  /** Formatos de imagen admitidos; los define el servicio de evidencias para todos los módulos. */
  readonly formatosEvidencia = this.evid.formatos;

  /** Mensajes de la evidencia del reproceso, tomados del servicio común. */
  readonly MSG_EVIDENCIA_REPROCESO = this.evid.mensajeFalta('Reproceso F0288');
  readonly MSG_FORMATO_EVIDENCIA = this.evid.MSG_FORMATO;
  readonly MSG_TIPO_EVIDENCIA = this.evid.MSG_TIPO;

  /** Extensión del archivo, en minúsculas y sin punto. */
  formatoDeArchivo(archivo: string): string {
    return this.evid.formatoDe(archivo);
  }

  /** ¿El archivo es una imagen de las admitidas? Un PDF o un Word no sirven como evidencia visual. */
  formatoEvidenciaValido(archivo: string): boolean {
    return this.evid.formatoValido(archivo);
  }

  /**
   * Imágenes que se piden para cada tipo de problema. Es una guía, no una lista de casillas: dice
   * qué se espera ver para que la evidencia sea congruente con lo que se revisó.
   */
  imagenesSugeridasReproceso(tipo: TipoProblemaReproceso): string[] {
    switch (tipo) {
      case 'Problema de sistema operativo':
        return ['Captura de error de arranque', 'Captura de reparación del sistema operativo',
          'Captura de reinstalación de Windows', 'Captura de validación posterior'];
      case 'Falla de disco':
        return ['Captura del diagnóstico del disco', 'Fotografía del disco revisado',
          'Fotografía del disco sustituido', 'Captura de validación de arranque'];
      case 'Falla de memoria':
        return ['Fotografía del módulo de memoria revisado', 'Fotografía del cambio de memoria',
          'Captura de prueba básica de memoria'];
      case 'Falla física del equipo':
        return ['Fotografía del estado físico del equipo', 'Fotografía del daño identificado',
          'Fotografía posterior a la revisión'];
      case 'Accesorio faltante':
        return ['Fotografía del accesorio asociado', 'Fotografía del número de inventario del accesorio',
          'Fotografía del equipo con accesorios completos'];
      case 'Problema de red física':
        return ['Fotografía del puerto de red', 'Captura del adaptador de red',
          'Fotografía de conexión física revisada'];
      case 'Problema de encendido':
        return ['Fotografía del equipo encendido', 'Fotografía del cargador o fuente revisada',
          'Fotografía de indicadores de energía'];
      case 'Problema de periféricos':
        return ['Fotografía del periférico revisado', 'Fotografía del periférico sustituido',
          'Fotografía del periférico funcionando'];
      default:
        return ['Imagen de evidencia técnica del problema o corrección realizada'];
    }
  }

  /**
   * Tipos de imagen que exige un ítem del checklist cuando se marca como completado. No basta con
   * adjuntar cualquier imagen: si se sustituyó un disco, lo que respalda el reproceso es la foto
   * del componente, no una captura de diagnóstico.
   */
  evidenciaExigidaPorItem(nombreItem: string): TipoEvidenciaReproceso[] {
    const n = nombreItem.toLowerCase();
    if (/reinstalar windows|reparar sistema operativo/.test(n)) return ['Corrección realizada', 'Validación posterior'];
    // «Revisar o sustituir…» y «Corregir o reemplazar…» pueden acabar en cualquiera de las dos
    // cosas: vale la foto del componente o la del equipo revisado.
    if (/revisar o sustituir|corregir o reemplazar/.test(n)) return ['Componente sustituido', 'Equipo revisado'];
    if (/^sustituir /.test(n)) return ['Componente sustituido'];
    if (/asociar número de inventario del accesorio/.test(n)) return ['Accesorio asociado'];
    if (/daños visibles|inspección física general/.test(n)) return ['Equipo revisado'];
    return [];
  }

  /** Etiqueta de la imagen que no respalda un ítem concreto sino el reproceso en general. */
  readonly ITEM_EVIDENCIA_ADICIONAL = 'Evidencia adicional del reproceso';

  /**
   * Tipo de evidencia que corresponde a un ítem del checklist. Nadie lo elige: sale de lo que el
   * ítem dice que se hizo. Los de la sección Evidencia y los de validación no describen una
   * intervención concreta, así que caen en el tipo de su sección.
   */
  tipoEvidenciaDeItem(item: ItemReproceso): TipoEvidencia {
    const exigido = this.evidenciaExigidaPorItem(item.nombre)[0];
    if (exigido) return exigido;
    return this.seccionDeItem(item) === 'Validación posterior' ? 'Validación posterior' : 'Diagnóstico';
  }

  /**
   * Ítems marcados que exigen imagen y todavía no la tienen. La correspondencia es por **ítem**, no
   * por tipo: la imagen se adjunta desde el ítem que la pide, así que respaldar «Reinstalar
   * Windows» con la foto de otra acción ya no es posible.
   *
   * Un ítem en «No aplica» no exige nada: no se hizo.
   */
  itemsSinEvidenciaReproceso(r: ReprocesoF0288): ItemReproceso[] {
    return r.checklist.filter((i) => i.estado === 'Realizado' && this.itemRequiereEvidencia(i)
      && !r.evidencias.some((e) => e.item === i.nombre));
  }

  /** Lo que se responde cuando un ítem marcado se quedó sin su imagen. */
  mensajeItemSinEvidencia(item: string): string {
    return `Debe adjuntar evidencia para el ítem: ${item}.`;
  }

  /** Imágenes del reproceso agrupadas por el ítem que respaldan; es lo que imprime la constancia. */
  evidenciasPorItemReproceso(r: ReprocesoF0288): { item: string; lista: EvidenciaReproceso[] }[] {
    const grupos: { item: string; lista: EvidenciaReproceso[] }[] = [];
    for (const e of r.evidencias) {
      const item = e.item?.trim() || this.ITEM_EVIDENCIA_ADICIONAL;
      const grupo = grupos.find((g) => g.item === item);
      if (grupo) grupo.lista.push(e); else grupos.push({ item, lista: [e] });
    }
    return grupos;
  }

  /**
   * Técnicos de Hardware con su carga de trabajo, para el buscador del rollback. La carga cuenta
   * las preparaciones F0288 sin cerrar y los reprocesos abiertos que ya tiene asignados: son las
   * dos cosas que ocupan realmente a un técnico de Hardware.
   */
  tecnicosHardwareConCarga(): {
    usuario: UsuarioSistema; nombreRol: string; preparaciones: number; reprocesos: number;
    expedientes: number; total: number; carga: string;
  }[] {
    return this.usuarios()
      .filter((u) => u.clave === 'tec-hardware' && u.estado !== 'Inactivo')
      .map((usuario) => {
        const nombreRol = `${usuario.nombre} — ${usuario.rol}`;
        const preparaciones = this.preparaciones()
          .filter((p) => p.tecnico.includes(usuario.nombre) && p.estado !== 'Completada' && p.estado !== 'Cerrada').length;
        const reprocesos = this.reprocesos()
          .filter((r) => r.tecnicoAsignado.includes(usuario.nombre) && r.estado !== 'Firmado' && r.estado !== 'No corregido').length;
        // Expedientes técnicos que todavía no llegaron a «Preparado»: trabajo abierto del técnico.
        const expedientes = this.expedientesTecnicos()
          .filter((t) => t.tecnicoPreparacion.includes(usuario.nombre) && t.estado !== 'Preparado' && t.estado !== 'Cerrado').length;
        const total = preparaciones + reprocesos;
        return { usuario, nombreRol, preparaciones, reprocesos, expedientes, total,
          carga: total >= 3 ? 'Carga alta' : total >= 1 ? 'Carga media' : 'Carga baja' };
      })
      .sort((a, b) => a.total - b.total);
  }

  /** Técnico de Hardware que preparó inicialmente el equipo: el candidato natural del rollback. */
  tecnicoPreparoInicialmente(inventario: string): string {
    const tec = this.expTecnicoDeEquipo(inventario);
    return tec?.tecnicoPreparacion ?? '';
  }

  /**
   * Solo los Encargados asignan reprocesos. La regla existe para que la carga de Hardware la
   * reparta quien la conoce: si el técnico pudiera autoasignarse, los reprocesos incómodos se
   * quedarían sin dueño y los fáciles se los llevaría el primero que entrara.
   */
  puedeAsignarReprocesos(): boolean {
    const c = this.claveConectada();
    return c === 'enc-hardware' || c === 'enc-soporte' || c === 'admin';
  }

  /** Reproceso todavía abierto (sin firmar ni cerrar) del Expediente técnico, si lo hay. */
  reprocesoAbiertoDeExpTecnico(codigoTec: string): ReprocesoF0288 | undefined {
    return this.reprocesosDeExpTecnico(codigoTec)
      .find((r) => r.estado !== 'Firmado' && r.estado !== 'No corregido');
  }

  /**
   * Abre el reproceso F0288 de una falla **sobre el Expediente técnico que el equipo ya tiene**.
   * El correlativo (`…-R1`, `…-R2`) es por expediente técnico: así el historial se lee como
   * «F0288 #1 → F0302 #1 con falla → Reproceso F0288 #1 → F0302 #2» sin multiplicar expedientes.
   * Nace sin técnico asignado: el rollback a Hardware es un paso propio y con nombre.
   */
  private abrirReprocesoF0288(c: ConfiguracionF0302, falla: FallaF0302, usuario: string,
    codigoTec?: string, unicoCod?: string, justificacionSimultaneo = ''): ReprocesoF0288 {
    const tecnico = codigoTec ?? this.expTecnicoDeEquipo(c.datos.inventario)?.codigo ?? c.datos.inventario;
    // El correlativo sale del mayor número ya usado, no de la cantidad: si un reproceso se cerró y
    // otro se abrió, contar la lista podría repetir un código que ya existió.
    const numero = Math.max(0, ...this.reprocesosDeExpTecnico(tecnico).map((r) => r.numero)) + 1;
    const reproceso: ReprocesoF0288 = {
      id: `${tecnico}-R${numero}`, expedienteTecnico: tecnico, expediente: c.expediente,
      expedienteUnico: unicoCod ?? '', inventario: c.datos.inventario, numero,
      tipoFalla: falla.tipo, motivo: `${falla.tipo}: ${falla.descripcion}`,
      // Una falla que exige revisión física deja al equipo detenido en Hardware: se atiende primero.
      prioridad: falla.requiereHardware ? 'Alta' : 'Normal',
      unidadAtiende: 'Hardware', justificacionUnidad: '',
      solicitadoPor: usuario, observacionSoporte: falla.observacionTecnica || falla.descripcion,
      evidenciaSoporte: falla.evidencia,
      fechaSolicitud: this.hoy(), horaSolicitud: this.hora(),
      // Nace sin dueño: la asignación es potestad de un Encargado, nunca automática.
      tecnicoAsignado: '', asignadoPor: '', fechaAsignacion: '', horaAsignacion: '',
      justificacionReprocesoSimultaneo: justificacionSimultaneo,
      atendidoPor: '', fechaInicio: '', fechaFin: '', cronometro: undefined,
      tipoProblema: this.tipoProblemaDeFalla(falla.tipo),
      checklist: this.checklistReproceso(this.tipoProblemaDeFalla(falla.tipo)),
      evidencias: [], correccionTecnica: '',
      observaciones: falla.detalle?.observacionHardware ?? '',
      firma: undefined, resultado: '', observacionResultado: '', estado: 'Pendiente de asignación'
    };
    this.reprocesos.update((list) => [reproceso, ...list]);
    return reproceso;
  }

  /** Datos de referencia comunes a todos los eventos de un reproceso (spec §19). */
  private refReproceso(r: ReprocesoF0288): Partial<EventoTrazabilidad> {
    return {
      modulo: 'Reprocesos F0288', inventario: r.inventario, expedienteTecnico: r.expedienteTecnico,
      expedienteUnico: r.expedienteUnico, tipoFalla: r.tipoFalla, requiereReproceso: 'Sí',
      reproceso: r.id, tecnicoReporta: r.solicitadoPor, tecnicoHardware: r.tecnicoAsignado || 'Sin asignar',
      resultadoReproceso: r.resultado || 'Pendiente', firmaRegistrada: r.firma ? 'Sí' : 'No',
      encargadoAsigno: r.asignadoPor || 'Pendiente de asignación'
    };
  }

  private actualizarReproceso(id: string, cambio: (r: ReprocesoF0288) => ReprocesoF0288): void {
    this.reprocesos.update((list) => list.map((x) => (x.id === id ? cambio(x) : x)));
  }

  /**
   * Abre un reproceso F0288 para una falla que ya está registrada pero todavía no lo tiene. Cubre
   * las fotos anteriores a esta regla —donde la falla mandaba a preparación sin dejar constancia
   * de un reproceso— y evita que esos expedientes queden sin salida.
   */
  asegurarReprocesoDeFalla(id: string, usuario: string): ReprocesoF0288 | string {
    if (!this.puedeAsignarReprocesos()) {
      return 'Solo un Encargado puede generar el reproceso F0288 de una falla ya registrada.';
    }
    const conFalla = this.configuracionesConFallaDe(id)[0];
    if (!conFalla?.falla) return 'Este proceso no tiene una falla F0302 registrada.';
    if (!conFalla.falla.requiereReprocesoF0288) return 'Esta falla no requiere reproceso de Preparación F0288.';
    const existente = conFalla.falla.reprocesoId ? this.reprocesoDe(conFalla.falla.reprocesoId) : undefined;
    if (existente) return existente;
    const codigoTec = this.expTecnicoDeEquipo(conFalla.datos.inventario)?.codigo;
    const unicoCod = this.expedienteUnicoDe(id)?.codigoUnico;
    const r = this.abrirReprocesoF0288(conFalla, conFalla.falla, conFalla.falla.tecnicoReporta || usuario, codigoTec, unicoCod);
    this.actualizarConfiguracionConFalla(id, (f) => ({
      ...f, reprocesoId: r.id, estadoIncidencia: 'REPROCESO_F0288_PENDIENTE_ASIGNACION'
    }));
    this.registrarEvento(id, usuario, 'Reproceso F0288 generado', 'Reproceso F0288 pendiente de asignación',
      `${r.id} — reproceso #${r.numero} del Expediente técnico ${r.expedienteTecnico}. Se completó una falla registrada antes de esta regla; no se crea un Expediente técnico nuevo.`,
      true, { ...this.refReproceso(r), accionTomada: 'Reproceso F0288 dentro del mismo Expediente técnico' });
    this.registrarEvento(id, usuario, 'Reproceso pendiente de asignación por Encargado',
      'Reproceso F0288 pendiente de asignación',
      'El reproceso queda a la espera de que un Encargado lo asigne a un Técnico de Hardware.', true,
      { ...this.refReproceso(r), accionTomada: 'Pendiente de asignación por Encargado' });
    return r;
  }

  /**
   * Fallas que exigen reproceso pero todavía no lo tienen: solo ocurre con expedientes guardados
   * antes de que el reproceso existiera. Se listan para que un Encargado los complete en lugar de
   * dejarlos trabados sin salida.
   */
  fallasSinReproceso(): ConfiguracionF0302[] {
    return this.configuraciones().filter((c) =>
      c.estado === 'Con falla' && c.falla?.requiereReprocesoF0288 && !c.falla.reprocesoId
      && c.falla.estadoIncidencia !== 'LISTO_PARA_REINTENTO_F0302');
  }

  /**
   * Rollback a Hardware: asigna el reproceso a un Técnico de Hardware. Puede ser el mismo que
   * preparó el equipo o cualquier otro. Asignarlo fuera de Hardware es la excepción y solo la
   * autoriza un Encargado con justificación: si cualquiera pudiera desviarlo a Soporte, la
   * revisión física simplemente no ocurriría.
   */
  asignarReprocesoF0288(idReproceso: string, tecnico: string, usuario: string, justificacion = ''): string | null {
    const r = this.reprocesoDe(idReproceso);
    if (!r) return 'No se encontró el reproceso F0288 indicado.';
    // La asignación es potestad de los Encargados. Un Técnico de Hardware no se autoasigna
    // reprocesos y un Técnico de Soporte no reparte trabajo de otra unidad: el que reporta la
    // falla no decide quién la corrige.
    if (!this.puedeAsignarReprocesos()) {
      return 'Solo un Encargado puede asignar reprocesos F0288. El reproceso queda pendiente de asignación.';
    }
    if (r.estado !== 'Pendiente de asignación' && r.estado !== 'Asignado') {
      return 'El reproceso F0288 ya fue iniciado: no puede reasignarse.';
    }
    if (!tecnico.trim()) return 'Seleccione el Técnico de Hardware que atenderá el reproceso.';
    const esHardware = this.tecnicosHardwareConCarga().some((t) => t.nombreRol === tecnico.trim());
    if (!esHardware && !justificacion.trim()) {
      return 'Justifique por qué este reproceso se asigna fuera de la Unidad de Hardware.';
    }
    this.actualizarReproceso(idReproceso, (x) => ({
      ...x, estado: 'Asignado', tecnicoAsignado: tecnico.trim(), asignadoPor: usuario,
      fechaAsignacion: this.hoy(), horaAsignacion: this.hora(),
      unidadAtiende: esHardware ? 'Hardware' : 'Soporte',
      justificacionUnidad: esHardware ? '' : justificacion.trim()
    }));
    this.actualizarConfiguracionConFalla(r.expediente, (f) => ({ ...f, estadoIncidencia: 'REPROCESO_F0288_ASIGNADO' }));
    this.avanzarRevisionGarantia(r, 'REVISION_HARDWARE_GARANTIA_ASIGNADA');
    const actualizado = this.reprocesoDe(idReproceso)!;
    this.registrarEvento(r.expediente, usuario, 'Rollback realizado a Hardware', 'Reproceso F0288 asignado',
      `El equipo ${r.inventario} regresa a la Unidad de ${actualizado.unidadAtiende} por ${r.tipoFalla}.`, true,
      { ...this.refReproceso(actualizado), accionTomada: 'Rollback a Hardware' });
    this.registrarEvento(r.expediente, usuario, 'Reproceso asignado por Encargado', 'Reproceso F0288 asignado',
      esHardware
        ? `${r.id} asignado a ${tecnico.trim()} por ${usuario}.`
        : `${r.id} asignado a ${tecnico.trim()} fuera de Hardware por ${usuario}. Justificación: ${justificacion.trim()}`,
      true, { ...this.refReproceso(actualizado), accionTomada: 'Asignación del reproceso F0288',
        justificacion: actualizado.justificacionUnidad });
    return null;
  }

  /** El Técnico de Hardware toma el reproceso: arranca el cronómetro del tiempo trabajado. */
  iniciarReprocesoF0288(idReproceso: string, usuario: string): string | null {
    const r = this.reprocesoDe(idReproceso);
    if (!r) return 'No se encontró el reproceso F0288 indicado.';
    if (r.estado === 'Pendiente de asignación') {
      return 'Un Encargado debe asignar el reproceso F0288 a un Técnico de Hardware antes de iniciarlo.';
    }
    if (r.estado === 'En proceso') return 'Este reproceso F0288 ya está en proceso.';
    if (r.estado !== 'Asignado') return 'Este reproceso F0288 ya fue finalizado.';
    // Solo lo trabaja el técnico asignado: nadie toma un reproceso que no le tocó.
    const nombre = this.nombreConectado();
    if (nombre && r.tecnicoAsignado && !r.tecnicoAsignado.includes(nombre) && !this.puedeAsignarReprocesos()) {
      return `Este reproceso está asignado a ${r.tecnicoAsignado}. Solo un Encargado puede reasignarlo.`;
    }
    this.actualizarReproceso(idReproceso, (x) => ({
      ...x, estado: 'En proceso', atendidoPor: usuario, fechaInicio: this.hoy(),
      cronometro: { fechaInicio: this.hoy(), horaInicio: this.horaCrono(), iniciadoPor: usuario,
        fechaFin: '', horaFin: '', finalizadoPor: '', duracionMinutos: null }
    }));
    this.actualizarConfiguracionConFalla(r.expediente, (f) => ({ ...f, estadoIncidencia: 'REPROCESO_F0288_EN_PROCESO' }));
    this.avanzarRevisionGarantia(r, 'REVISION_HARDWARE_GARANTIA_EN_PROCESO');
    this.registrarEvento(r.expediente, usuario, 'Reproceso F0288 iniciado', 'Reproceso F0288 en proceso',
      `${r.id} sobre el Expediente técnico ${r.expedienteTecnico} (${r.unidadAtiende}). Checklist de Reproceso F0288 según «${r.tipoFalla}».`,
      true, { ...this.refReproceso(r), tecnicoHardware: r.tecnicoAsignado || usuario,
        accionTomada: 'Inicio del reproceso F0288' });
    return null;
  }

  /** Marca un ítem del Checklist de Reproceso F0288. Solo mientras el reproceso está en proceso. */
  marcarItemReproceso(idReproceso: string, nombreItem: string, estado: ItemReproceso['estado'], nota = ''): string | null {
    const r = this.reprocesoDe(idReproceso);
    if (!r) return 'No se encontró el reproceso F0288 indicado.';
    if (r.estado !== 'En proceso') return 'Inicie el reproceso F0288 para completar su checklist.';
    // «No aplica» no es un atajo para cerrar el checklist: solo lo admiten los ítems que el propio
    // tipo de problema declara condicionales.
    const item = r.checklist.find((i) => i.nombre === nombreItem);
    if (item && estado === 'No aplica' && !this.itemAdmiteNoAplica(item)) {
      return `«${nombreItem}» es obligatorio para un reproceso por «${this.tipoProblemaDeReproceso(r)}»: no puede marcarse como «No aplica».`;
    }
    this.actualizarReproceso(idReproceso, (x) => ({
      ...x, checklist: x.checklist.map((i) => (i.nombre === nombreItem ? { ...i, estado, nota: nota || i.nota } : i))
    }));
    return null;
  }

  /**
   * Adjunta una imagen de evidencia al reproceso, con el código del reproceso y su expediente. La
   * imagen llega como `data:` URL ya reducida por la pantalla: el prototipo la guarda con el resto
   * del estado y no depende de ningún servidor de archivos.
   *
   * El **tipo no se recibe**: sale del ítem del checklist desde el que se adjuntó. Elegirlo a mano
   * permitía respaldar un ítem con la imagen de otro, que es justo lo que no debe pasar.
   */
  agregarEvidenciaReproceso(idReproceso: string, archivo: string, usuario: string,
    imagen = '', item = ''): string | null {
    const r = this.reprocesoDe(idReproceso);
    if (!r) return 'No se encontró el reproceso F0288 indicado.';
    if (r.estado !== 'En proceso') return 'Inicie el reproceso F0288 para adjuntar evidencias.';
    if (!archivo.trim()) return 'Seleccione la imagen de evidencia que desea adjuntar.';
    if (!this.formatoEvidenciaValido(archivo)) return this.MSG_FORMATO_EVIDENCIA;
    if (r.evidencias.some((e) => e.archivo === archivo.trim())) {
      return `La imagen «${archivo.trim()}» ya está adjunta a este reproceso.`;
    }
    // Sin ítem, la imagen es evidencia adicional del reproceso: no respalda ninguna acción concreta
    // y por eso tampoco satisface la exigencia de ningún ítem marcado.
    const nombreItem = item.trim() || this.ITEM_EVIDENCIA_ADICIONAL;
    const delChecklist = r.checklist.find((i) => i.nombre === nombreItem);
    if (item.trim() && !delChecklist) return 'No se encontró el ítem del checklist indicado.';
    const evidencia: EvidenciaReproceso = {
      archivo: archivo.trim(), tipo: delChecklist ? this.tipoEvidenciaDeItem(delChecklist) : 'Otro',
      fecha: this.hoy(), hora: this.hora(), cargadaPor: usuario,
      reproceso: r.id, expedienteTecnico: r.expedienteTecnico,
      imagen, formato: this.formatoDeArchivo(archivo), item: nombreItem
    };
    this.actualizarReproceso(idReproceso, (x) => ({ ...x, evidencias: [...x.evidencias, evidencia] }));
    this.registrarEvento(r.expediente, usuario, 'Imagen de evidencia cargada', 'Reproceso F0288 en proceso',
      `${evidencia.archivo} · ${evidencia.tipo}`, false,
      { ...this.refEvidencia(r, evidencia, usuario), accionTomada: 'Imagen de evidencia adjuntada al reproceso F0288' });
    return null;
  }

  /**
   * Datos que acompañan a todo evento de una imagen de evidencia: quién, con qué rol, sobre qué
   * reproceso, qué problema se revisaba y qué muestra la imagen.
   */
  private refEvidencia(r: ReprocesoF0288, e: EvidenciaReproceso, usuario: string): Partial<EventoTrazabilidad> {
    return {
      ...this.refReproceso(r),
      rol: this.rolDeUsuario(usuario),
      tipoProblema: this.tipoProblemaDeReproceso(r),
      evidencia: e.archivo,
      tipoEvidencia: e.tipo
    };
  }

  /** Rol del usuario tal como está en el catálogo; si no se encuentra, lo que venga tras el guion. */
  private rolDeUsuario(usuario: string): string {
    const u = this.usuarios().find((x) => usuario.startsWith(x.nombre));
    return u?.rol ?? usuario.split('—')[1]?.trim() ?? '';
  }

  /**
   * Quita una imagen de evidencia. Solo mientras el reproceso está en proceso: una vez finalizado
   * la evidencia ya respalda lo que se declaró, y borrarla dejaría el cierre sin sustento.
   */
  eliminarEvidenciaReproceso(idReproceso: string, archivo: string, usuario: string): string | null {
    const r = this.reprocesoDe(idReproceso);
    if (!r) return 'No se encontró el reproceso F0288 indicado.';
    if (r.estado !== 'En proceso') {
      return 'El reproceso ya no está en proceso: sus imágenes de evidencia no pueden eliminarse.';
    }
    const evidencia = r.evidencias.find((e) => e.archivo === archivo);
    if (!evidencia) return 'No se encontró la imagen de evidencia indicada.';
    this.actualizarReproceso(idReproceso, (x) => ({
      ...x, evidencias: x.evidencias.filter((e) => e.archivo !== archivo)
    }));
    this.registrarEvento(r.expediente, usuario, 'Imagen de evidencia eliminada', 'Reproceso F0288 en proceso',
      `${evidencia.archivo} · ${evidencia.tipo}`, false,
      { ...this.refEvidencia(r, evidencia, usuario), accionTomada: 'Imagen de evidencia eliminada del reproceso F0288' });
    return null;
  }

  /** Deja constancia de quién abrió una imagen de evidencia; una vez por usuario e imagen. */
  registrarConsultaEvidencia(idReproceso: string, archivo: string, usuario: string): void {
    const r = this.reprocesoDe(idReproceso);
    const evidencia = r?.evidencias.find((e) => e.archivo === archivo);
    if (!r || !evidencia) return;
    const clave = `Imagen de evidencia visualizada·${r.id}·${archivo}·${usuario}`;
    if (this.consultasRegistradas.has(clave)) return;
    this.consultasRegistradas.add(clave);
    this.registrarEvento(r.expediente, usuario, 'Imagen de evidencia visualizada', `Reproceso F0288 ${r.estado.toLowerCase()}`,
      `${evidencia.archivo} · ${evidencia.tipo}`, false,
      { ...this.refEvidencia(r, evidencia, usuario), accionTomada: 'Consulta de la imagen de evidencia del reproceso' });
  }

  /**
   * Nombre de archivo y tipo de evidencia sugeridos según el problema que se revisa: una captura
   * de disco en un caso de sistema operativo no respalda nada. El tipo sale de la lista cerrada,
   * así el formulario llega con la clasificación más probable ya elegida.
   */
  evidenciaSugeridaReproceso(tipo: TipoProblemaReproceso): { archivo: string; tipo: TipoEvidenciaReproceso } {
    switch (tipo) {
      case 'Accesorio faltante': return { archivo: 'foto-accesorio-asociado.png', tipo: 'Accesorio asociado' };
      case 'Falla física del equipo': return { archivo: 'foto-inspeccion-fisica.png', tipo: 'Equipo revisado' };
      case 'Falla de disco': return { archivo: 'captura-diagnostico-disco.png', tipo: 'Diagnóstico' };
      case 'Falla de memoria': return { archivo: 'captura-diagnostico-memoria.png', tipo: 'Diagnóstico' };
      case 'Problema de sistema operativo': return { archivo: 'captura-reparacion-sistema-operativo.png', tipo: 'Corrección realizada' };
      case 'Problema de red física': return { archivo: 'captura-adaptador-red.png', tipo: 'Diagnóstico' };
      case 'Problema de encendido': return { archivo: 'foto-encendido-equipo.png', tipo: 'Equipo revisado' };
      case 'Problema de periféricos': return { archivo: 'foto-periferico-sustituido.png', tipo: 'Componente sustituido' };
      default: return { archivo: 'captura-diagnostico.png', tipo: 'Diagnóstico' };
    }
  }

  /**
   * Contexto único del bloque general del reproceso: la evidencia **adicional**, la que no
   * respalda ninguna acción concreta. Las de los ítems se adjuntan desde el ítem, así que aquí no
   * hay nada que elegir y el formulario no muestra desplegable.
   */
  contextosEvidenciaReproceso(): ContextoEvidencia[] {
    return [{ nombre: this.ITEM_EVIDENCIA_ADICIONAL, tipo: 'Otro' }];
  }

  /**
   * Lo que falta para cerrar el reproceso, en el orden en que ocurre. Las cinco primeras se exigen
   * al finalizar y las dos últimas al firmar: mostrarlas juntas evita que el técnico descubra el
   * requisito cuando ya creía haber terminado. `correccionEnCurso` es lo escrito en el formulario
   * y todavía no guardado.
   */
  validacionesReproceso(r: ReprocesoF0288, correccionEnCurso = '', _observacionEnCurso = ''):
    { etiqueta: string; cumplida: boolean; detalle: string; momento: 'Finalizar' | 'Firmar' }[] {
    const cerrado = r.estado === 'Finalizado' || r.estado === 'Firmado' || r.estado === 'No corregido';
    const pendientes = r.checklist.filter((i) => i.estado === 'Pendiente');
    const correccion = (correccionEnCurso.trim() || r.correccionTecnica).trim();
    const faltantes = this.itemsSinEvidenciaReproceso(r);
    const conItem = r.checklist.filter((i) => this.itemRequiereEvidencia(i) && i.estado === 'Realizado');
    return [
      { etiqueta: 'Al menos una imagen de evidencia adjunta', momento: 'Finalizar',
        cumplida: r.evidencias.length > 0,
        detalle: r.evidencias.length
          ? `${r.evidencias.length} imagen(es) adjuntas`
          : 'La evidencia visual respalda la corrección realizada' },
      { etiqueta: 'Imagen en cada ítem marcado que la exige', momento: 'Finalizar',
        cumplida: faltantes.length === 0,
        detalle: faltantes.length
          ? `Falta la imagen de: ${faltantes.map((f) => f.nombre).join(' · ')}`
          : conItem.length
            ? `${conItem.length} ítem(es) con su imagen adjunta`
            : 'Ningún ítem marcado exige imagen' },
      { etiqueta: 'Corrección técnica realizada registrada', momento: 'Finalizar',
        cumplida: !!correccion,
        detalle: correccion ? 'Registrada' : 'Describa qué se revisó o corrigió en el equipo' },
      { etiqueta: 'Checklist obligatorio completado', momento: 'Finalizar',
        cumplida: pendientes.length === 0,
        detalle: pendientes.length === 0
          ? `${r.checklist.length} ítems resueltos`
          : `${pendientes.length} ítem(s) pendientes de resolver` },
      { etiqueta: 'Resultado del reproceso seleccionado', momento: 'Firmar',
        cumplida: !!r.resultado,
        detalle: r.resultado || (cerrado ? 'Se elige al firmar' : 'Se elige al firmar, después de finalizar') },
      { etiqueta: 'Firma del Técnico de Hardware registrada', momento: 'Firmar',
        cumplida: !!r.firma,
        detalle: r.firma ? `${r.firma.nombre} · ${r.firma.fecha} ${r.firma.hora}` : 'Sin la firma el reproceso no se cierra' }
    ];
  }

  /** Tipo de problema del reproceso; los guardados antes de existir el campo lo derivan de su falla. */
  tipoProblemaDeReproceso(r: ReprocesoF0288): TipoProblemaReproceso {
    return r.tipoProblema ?? this.tipoProblemaDeFalla(r.tipoFalla);
  }

  /**
   * Cambia el tipo de problema del reproceso y **regenera su checklist**. Lo marcado antes no se
   * conserva: pertenecía a otra revisión, y arrastrar un «disco verificado» a un caso de accesorio
   * faltante sería dar por hecho algo que nadie hizo.
   */
  cambiarTipoProblemaReproceso(idReproceso: string, tipo: TipoProblemaReproceso, usuario: string): string | null {
    const r = this.reprocesoDe(idReproceso);
    if (!r) return 'No se encontró el reproceso F0288 indicado.';
    if (r.estado === 'Firmado' || r.estado === 'No corregido') return 'Este reproceso ya fue cerrado con firma.';
    if (r.estado === 'Finalizado') return 'Finalice o reabra el reproceso: ya no admite cambiar el tipo de problema.';
    const anterior = this.tipoProblemaDeReproceso(r);
    if (anterior === tipo) return null;
    this.actualizarReproceso(idReproceso, (x) => ({
      ...x, tipoProblema: tipo, checklist: this.checklistReproceso(tipo)
    }));
    const actualizado = this.reprocesoDe(idReproceso)!;
    this.registrarEvento(r.expediente, usuario, 'Tipo de problema seleccionado', 'Reproceso F0288 en proceso',
      `${anterior} → ${tipo}. Los ítems marcados del checklist anterior se limpiaron.`, false,
      { ...this.refReproceso(actualizado), tipoProblema: tipo,
        accionTomada: 'Cambio de tipo de problema del reproceso' });
    this.registrarEvento(r.expediente, usuario, 'Checklist de reproceso generado según tipo de problema',
      'Reproceso F0288 en proceso',
      `${actualizado.checklist.length} ítems para «${tipo}».`, false,
      { ...this.refReproceso(actualizado), tipoProblema: tipo,
        accionTomada: 'Checklist de Reproceso F0288 regenerado' });
    return null;
  }

  /**
   * Finaliza el trabajo técnico del reproceso: detiene el cronómetro y guarda el tiempo trabajado.
   * Exige el checklist resuelto (sin ítems pendientes), la corrección técnica y la evidencia
   * cuando hubo intervención. No lo cierra: el cierre es la firma.
   */
  finalizarReprocesoF0288(idReproceso: string, usuario: string, correccion: string, observaciones = ''): string | null {
    const r = this.reprocesoDe(idReproceso);
    if (!r) return 'No se encontró el reproceso F0288 indicado.';
    if (r.estado === 'Pendiente de asignación' || r.estado === 'Asignado') return 'Inicie el reproceso F0288 antes de finalizarlo.';
    if (r.estado !== 'En proceso') return 'Este reproceso F0288 ya fue finalizado.';
    if (r.checklist.some((i) => i.estado === 'Pendiente')) {
      return 'Complete el Checklist de Reproceso F0288 antes de finalizarlo.';
    }
    if (!correccion.trim()) return 'Registre la corrección técnica realizada antes de finalizar el reproceso F0288.';
    // Cada ítem marcado que exige imagen debe tener la suya, adjuntada desde el ítem. El aviso
    // nombra el ítem: es lo que el técnico tiene que ir a resolver. El intento queda anotado,
    // porque es parte de la historia del reproceso.
    const faltantes = this.itemsSinEvidenciaReproceso(r);
    if (faltantes.length) {
      const mensaje = this.mensajeItemSinEvidencia(faltantes[0].nombre);
      this.registrarEvento(r.expediente, usuario, 'Reproceso intentó finalizar sin evidencia',
        'Reproceso F0288 en proceso', mensaje, false,
        { ...this.refReproceso(r), rol: this.rolDeUsuario(usuario),
          tipoProblema: this.tipoProblemaDeReproceso(r), estadoValidacion: 'Sin evidencia',
          accionTomada: `Cierre bloqueado: falta la imagen de ${faltantes.map((f) => f.nombre).join(', ')}` });
      return mensaje;
    }
    // Red de seguridad: si ningún ítem marcado exigiera imagen, el reproceso seguiría sin poder
    // cerrarse sin respaldo visual.
    if (r.evidencias.length === 0) {
      this.registrarEvento(r.expediente, usuario, 'Reproceso intentó finalizar sin evidencia',
        'Reproceso F0288 en proceso', this.MSG_EVIDENCIA_REPROCESO, false,
        { ...this.refReproceso(r), rol: this.rolDeUsuario(usuario),
          tipoProblema: this.tipoProblemaDeReproceso(r), estadoValidacion: 'Sin evidencia',
          accionTomada: 'Cierre bloqueado por falta de imagen de evidencia' });
      return this.MSG_EVIDENCIA_REPROCESO;
    }
    const crono = r.cronometro ? this.detenerCronometro(r.cronometro, usuario) : undefined;
    this.actualizarReproceso(idReproceso, (x) => ({
      ...x, estado: 'Finalizado', fechaFin: this.hoy(), cronometro: crono,
      correccionTecnica: correccion.trim(), observaciones: observaciones.trim() || x.observaciones,
      atendidoPor: x.atendidoPor || usuario
    }));
    this.actualizarConfiguracionConFalla(r.expediente, (f) => ({ ...f, estadoIncidencia: 'REPROCESO_F0288_FINALIZADO' }));
    this.avanzarRevisionGarantia(r, 'REVISION_HARDWARE_GARANTIA_FINALIZADA');
    const tiempo = this.formatoDuracion(crono?.duracionMinutos ?? null);
    this.registrarEvento(r.expediente, usuario, 'Checklist de reproceso completado', 'Reproceso F0288 finalizado',
      r.checklist.map((i) => `${i.nombre}: ${this.etiquetaItemReproceso(i)}`).join(' · '), false,
      { ...this.refReproceso(r), accionTomada: 'Checklist de Reproceso F0288 completado' });
    this.registrarEvento(r.expediente, usuario, 'Reproceso finalizado con evidencia', 'Reproceso F0288 finalizado',
      r.evidencias.map((e) => `${e.archivo} · ${e.tipo}`).join(' · '), false,
      { ...this.refReproceso(r), rol: this.rolDeUsuario(usuario),
        tipoProblema: this.tipoProblemaDeReproceso(r),
        evidencia: r.evidencias.map((e) => e.archivo).join(', '),
        tipoEvidencia: [...new Set(r.evidencias.map((e) => e.tipo))].join(', '),
        accionTomada: `${r.evidencias.length} imagen(es) de evidencia respaldan el cierre` });
    this.registrarEvento(r.expediente, usuario, 'Reproceso F0288 finalizado', 'Reproceso F0288 finalizado',
      `Corrección técnica: ${correccion.trim()}`, true,
      { ...this.refReproceso(r), tiempo: tiempo || 'menos de 1 min',
        accionTomada: 'Corrección técnica registrada en el reproceso F0288' });
    return null;
  }

  /**
   * Firma del Técnico de Hardware y resultado del reproceso. La firma es lo que cierra: sin ella
   * el reproceso queda finalizado pero abierto, porque nadie se hizo responsable de lo que se
   * hizo sobre el equipo. El resultado decide a dónde va el proceso.
   */
  firmarReprocesoF0288(idReproceso: string, usuario: string, resultado: ResultadoReproceso | '',
    observacionResultado = '', firmaSimulada = ''): string | null {
    const r = this.reprocesoDe(idReproceso);
    if (!r) return 'No se encontró el reproceso F0288 indicado.';
    if (r.estado !== 'Finalizado') return 'Finalice el reproceso F0288 antes de firmarlo.';
    if (!resultado) return 'Seleccione el resultado del reproceso antes de firmarlo.';
    const firmante = (firmaSimulada || usuario).trim();
    if (!firmante) return 'Debe registrar la firma del Técnico de Hardware para finalizar el reproceso.';
    if (resultado !== 'Corregido' && !observacionResultado.trim()) {
      return 'Registre la observación del resultado: el reproceso no quedó corregido.';
    }
    const u = this.usuarios().find((x) => firmante.startsWith(x.nombre));
    const firma: FirmaReproceso = {
      nombre: u?.nombre ?? firmante.split('—')[0].trim(),
      cargo: u?.rol ?? firmante.split('—')[1]?.trim() ?? 'Técnico de Hardware',
      unidad: u?.unidad ?? r.unidadAtiende,
      fecha: this.hoy(), hora: this.hora(),
      firma: `Firmado electrónicamente (simulado) por ${firmante}`
    };
    // «Requiere retorno a Configuración F0302» solo existe en las garantías, y ahí es un desenlace
    // resuelto: Hardware terminó, lo que falta es que Soporte valide la configuración.
    const resuelto = resultado === 'Corregido'
      || (r.origen === 'Garantía' && resultado === 'Requiere retorno a Configuración F0302');
    const estadoReproceso = resuelto ? 'Firmado' as const : 'No corregido' as const;
    this.actualizarReproceso(idReproceso, (x) => ({
      ...x, firma, resultado, observacionResultado: observacionResultado.trim(), estado: estadoReproceso
    }));
    const firmado = this.reprocesoDe(idReproceso)!;
    // La constancia se genera aquí, al firmar, no al descargarla: si dependiera de que alguien
    // pulsara «Descargar», un reproceso firmado podría quedarse sin documento que lo respalde.
    this.registrarConstanciaReproceso(idReproceso, usuario);
    this.registrarEvento(r.expediente, usuario, 'Firma de Técnico de Hardware registrada',
      resultado === 'Corregido' ? 'Reproceso F0288 firmado' : 'Reproceso F0288 no corregido',
      `${firma.nombre} — ${firma.cargo} (${firma.unidad}) · ${firma.fecha} ${firma.hora} · Resultado: ${resultado}`,
      true, { ...this.refReproceso(firmado), accionTomada: 'Firma del reproceso F0288',
        origenReproceso: r.origen ?? 'Falla F0302' });
    // Si el reproceso nació de una inconformidad, su firma es también la que cierra la incidencia
    // de conformidad: quien responde por lo que se le hizo al equipo es quien lo firmó.
    const inconformidad = this.correccionDeReproceso(idReproceso);
    if (inconformidad) this.cerrarCorreccionPorReproceso(inconformidad, firmado, usuario);

    // Una revisión de garantía no toca la incidencia del F0302: vuelve a Soporte, que valida lo
    // que Hardware hizo y decide si el caso se cierra.
    if (r.origen === 'Garantía') {
      this.devolverGarantiaASoporte(firmado, usuario);
      return null;
    }

    // El resultado decide el desenlace: solo «Corregido» devuelve el equipo a configuración.
    if (resultado === 'Corregido') {
      this.actualizarConfiguracionConFalla(r.expediente, (f) => ({ ...f, estadoIncidencia: 'REPROCESO_F0288_FIRMADO' }));
      return null;
    }
    if (resultado === 'Requiere sustitución de equipo') {
      this.actualizarConfiguracionConFalla(r.expediente, (f) => ({ ...f, estadoIncidencia: 'PENDIENTE_SUSTITUCION_EQUIPO' }));
      this.solicitarSustitucionEquipo(r.expediente, usuario,
        `Resultado del reproceso ${r.id}: ${observacionResultado.trim()}`);
      return null;
    }
    const incidencia = resultado === 'No corregido' ? 'REPROCESO_F0288_NO_CORREGIDO' as const : 'PENDIENTE_EVALUACION_ENCARGADO' as const;
    this.actualizarConfiguracionConFalla(r.expediente, (f) => ({ ...f, estadoIncidencia: incidencia }));
    this.setEstadoSolicitud(r.expediente, 'Pendiente de evaluación del Encargado',
      `Reproceso ${r.id} sin corregir: ${observacionResultado.trim()}`);
    this.expedientesUnicos.update((list) => list.map((x) => (x.expediente === r.expediente
      ? { ...x, estado: 'Pendiente de evaluación del Encargado',
          resumenEstado: `Reproceso F0288 ${r.id} · ${resultado}` } : x)));
    this.registrarEvento(r.expediente, usuario, 'Reproceso F0288 enviado a evaluación del Encargado',
      'Pendiente de evaluación del Encargado', observacionResultado.trim(), true,
      { ...this.refReproceso(firmado), accionTomada: 'Evaluación del Encargado' });
    return null;
  }

  /**
   * Cierra el paso de Hardware en una garantía: el caso vuelve a Soporte con el resultado que la
   * revisión dejó. Aquí no se cierra ninguna garantía —eso lo hace Soporte tras validar—, solo se
   * deja el caso en el estado que corresponde a lo que Hardware encontró.
   */
  private devolverGarantiaASoporte(r: ReprocesoF0288, usuario: string): void {
    const par = this.casoDeRevisionGarantia(r);
    if (!par) return;
    const { garantia: g, caso } = par;
    const sustitucion = r.resultado === 'Requiere sustitución de equipo';
    this.actualizarCasoGarantia(g.expediente, caso.codigo, (c) => ({
      ...c, estadoRevision: sustitucion ? 'GARANTIA_REQUIERE_SUSTITUCION' : 'GARANTIA_PENDIENTE_VALIDACION_SOPORTE'
    }));
    const actualizado = this.garantiaDe(g.expediente)!.casos.find((c) => c.codigo === caso.codigo)!;
    const ref = { ...this.refGarantia(g, actualizado), rol: this.rolDeUsuario(usuario),
      reproceso: r.id, resultadoReproceso: r.resultado, firmaRegistrada: 'Sí' };
    this.registrarEvento(g.expediente, usuario, 'Revisión técnica de garantía finalizada',
      'Revisión de garantía firmada',
      `${r.id} · Resultado: ${r.resultado}. ${r.observacionResultado || r.correccionTecnica}`, true,
      { ...ref, accionTomada: 'Revisión técnica de garantía firmada' });
    this.registrarEvento(g.expediente, usuario, 'Caso devuelto a Soporte',
      sustitucion ? 'Garantía requiere sustitución' : 'Garantía pendiente de validación de Soporte',
      sustitucion
        ? 'La revisión concluyó que el equipo requiere sustitución: la decisión es del Encargado.'
        : 'Soporte debe validar la corrección, el funcionamiento y la evidencia antes de cerrar el caso.',
      true, { ...ref, accionTomada: sustitucion ? 'Decisión del Encargado' : 'Validación de Soporte' });
    if (sustitucion) {
      this.registrarEvento(g.expediente, usuario, 'Garantía requiere sustitución',
        'Garantía requiere sustitución', r.observacionResultado, true,
        { ...ref, accionTomada: 'Sustitución del equipo por garantía' });
    }
  }

  /**
   * Devuelve el equipo a Configuración F0302 tras el reproceso: habilita el nuevo intento. Exige
   * la firma —es la regla de «no cerrar sin firma»— y que el resultado haya sido «Corregido».
   */
  devolverAConfiguracionF0302(idReproceso: string, usuario: string): string | null {
    const r = this.reprocesoDe(idReproceso);
    if (!r) return 'No se encontró el reproceso F0288 indicado.';
    // Una revisión de garantía solo vuelve a configuración si su resultado lo pidió: el equipo ya
    // fue entregado y aceptado, y reabrir el F0302 sin motivo desharía ese cierre.
    if (r.origen === 'Garantía' && r.resultado !== 'Requiere retorno a Configuración F0302') {
      return 'Esta revisión es de garantía: el caso vuelve a Soporte para su validación, no a Configuración F0302.';
    }
    if (r.estado === 'Pendiente de asignación' || r.estado === 'Asignado' || r.estado === 'En proceso') {
      return 'Finalice el reproceso F0288 antes de devolver el equipo a Configuración F0302.';
    }
    if (!r.firma) return 'Debe registrar la firma del Técnico de Hardware para finalizar el reproceso.';
    const habilita = r.resultado === 'Corregido'
      || (r.origen === 'Garantía' && r.resultado === 'Requiere retorno a Configuración F0302');
    if (!habilita) {
      return `El reproceso cerró como «${r.resultado}»: el equipo no puede volver a Configuración F0302 hasta que el Encargado lo resuelva.`;
    }
    // Un reproceso por inconformidad no reabre el ciclo de configuración: el equipo ya se entregó.
    // Soporte valida la configuración corregida y lo que sigue es reenviar el formulario.
    if (r.origen === 'Inconformidad del usuario final') {
      this.setEstadoSolicitud(r.expediente, 'Pendiente de reenvío del formulario de conformidad',
        'Validar la configuración corregida y reenviar el formulario de conformidad');
      this.expedientesUnicos.update((list) => list.map((x) => (x.expediente === r.expediente
        ? { ...x, estado: 'Pendiente de corrección',
            resumenEstado: `Reproceso F0288 ${r.id} firmado · pendiente de reenviar el formulario` } : x)));
      this.registrarEvento(r.expediente, usuario, 'Configuración F0302 validada tras el reproceso',
        'Listo para reenviar el formulario de conformidad',
        `Tras el reproceso ${r.id} por inconformidad; el Expediente técnico ${r.expedienteTecnico} sigue siendo el mismo.`,
        true, { ...this.refReproceso(r), origenReproceso: r.origen,
          accionTomada: 'Validación de la configuración tras el reproceso' });
      return null;
    }
    this.actualizarConfiguracionConFalla(r.expediente, (f) => ({ ...f, estadoIncidencia: 'LISTO_PARA_REINTENTO_F0302' }));
    this.setEstadoSolicitud(r.expediente, 'Pendiente de nuevo intento F0302', 'Nueva Configuración F0302 tras el reproceso F0288');
    this.expedientesUnicos.update((list) => list.map((x) => (x.expediente === r.expediente
      ? { ...x, estado: 'Pendiente de configuración', resumenEstado: `Reproceso F0288 ${r.id} finalizado y firmado · listo para reintento F0302` } : x)));
    this.registrarEvento(r.expediente, usuario, 'Equipo devuelto a Configuración F0302', 'Listo para reintento F0302',
      `Tras el reproceso ${r.id}; el Expediente técnico ${r.expedienteTecnico} sigue siendo el mismo.`, true,
      { ...this.refReproceso(r), accionTomada: 'Devolución a Configuración F0302' });
    this.registrarEvento(r.expediente, usuario, 'Nuevo intento F0302 habilitado', 'Listo para reintento F0302',
      'Soporte puede iniciar el nuevo intento sobre el mismo Expediente técnico.', true,
      { ...this.refReproceso(r), accionTomada: 'Habilitación del nuevo intento F0302' });
    return null;
  }

  /**
   * Constancia interna del reproceso: se genera al firmarlo y consolida lo que quedó registrado.
   * Es un documento del reproceso, no un F0288 nuevo — el F0288 original no se toca.
   */
  constanciaReprocesoF0288(idReproceso: string): string[] | string {
    const r = this.reprocesoDe(idReproceso);
    if (!r) return 'No se encontró el reproceso F0288 indicado.';
    if (!r.firma) return 'Debe registrar la firma del Técnico de Hardware para finalizar el reproceso.';
    const eq = this.equipoDe(r.inventario);
    const doc = this.constanciaDeReproceso(r.id);
    const garantia = this.casoDeRevisionGarantia(r);
    return [
      'SISGOST · Centro Nacional de Registros',
      garantia ? 'Constancia de Revisión Técnica de Garantía' : 'Constancia de Reproceso F0288',
      '='.repeat(60),
      `Documento: ${doc?.codigo ?? 'Pendiente de generar'} · Estado: ${doc?.estado ?? 'Pendiente de firma'}`,
      ...(garantia
        ? [`Código de garantía: ${garantia.caso.codigo}`,
          `Código de la revisión técnica de garantía: ${r.id}`,
          `Usuario final: ${garantia.garantia.usuarioFinal}`]
        : [`Código del reproceso: ${r.id}`]),
      `Expediente técnico original: ${r.expedienteTecnico}`,
      `Expediente único: ${r.expedienteUnico || '—'}`,
      `Equipo: ${eq ? `${eq.marca} ${eq.modelo}` : '—'}`,
      `Tipo de equipo: ${eq ? (eq.tipo === 'Desktop' ? 'CPU' : eq.tipo) : '—'}`,
      `Número de inventario: ${r.inventario}`,
      ...(garantia
        ? [`Tipo de problema reportado en garantía: ${garantia.caso.tipoProblema ?? r.tipoFalla}`]
        : [`Tipo de falla reportada en F0302: ${r.tipoFalla}`]),
      `Tipo de problema del ${garantia ? 'checklist' : 'reproceso'}: ${this.tipoProblemaDeReproceso(r)}`,
      `Descripción de la falla: ${r.motivo}`,
      `Reportada por: ${r.solicitadoPor} · ${r.fechaSolicitud} ${r.horaSolicitud}`,
      `Observación de Soporte: ${r.observacionSoporte || '—'}`,
      `Evidencia reportada por Soporte: ${r.evidenciaSoporte || '—'}`,
      `Encargado que asignó el reproceso: ${r.asignadoPor || '—'}${r.fechaAsignacion ? ` · ${r.fechaAsignacion} ${r.horaAsignacion}` : ''}`,
      `Técnico de Hardware asignado: ${r.tecnicoAsignado || '—'}`,
      '',
      // Solo el checklist del tipo de problema atendido, agrupado en sus secciones: el reproceso
      // no llevó otros ítems y se lee en el mismo orden en que se trabajó.
      `${garantia ? 'CHECKLIST DE REVISIÓN TÉCNICA DE GARANTÍA' : 'CHECKLIST DE REPROCESO F0288'} — ${this.tipoProblemaDeReproceso(r)}`,
      '-'.repeat(60),
      ...this.checklistPorSeccion(r).flatMap((g) => [
        `  ${g.seccion.toUpperCase()}`,
        ...g.items.map((i) =>
          `    [${i.estado === 'Realizado' ? 'X' : i.estado === 'No aplica' ? '—' : ' '}] ${i.nombre}` +
          ` · ${this.etiquetaItemReproceso(i)}${i.nota ? ` · ${i.nota}` : ''}`)
      ]),
      // El resumen de «No aplica» solo aparece si hubo alguno: si no, no hay nada que aclarar.
      ...(r.checklist.some((i) => i.estado === 'No aplica')
        ? ['', '  Ítems marcados como No aplica:',
          ...r.checklist.filter((i) => i.estado === 'No aplica').map((i) => `    — ${i.nombre}`)]
        : []),
      '',
      `IMÁGENES DE EVIDENCIA DEL REPROCESO (${r.evidencias.length})`,
      '-'.repeat(60),
      // Agrupadas por el ítem que respaldan: así se lee qué acción quedó demostrada y cuál no.
      ...(r.evidencias.length
        ? this.evidenciasPorItemReproceso(r).flatMap((g) => [
          `  Ítem: ${g.item}`,
          ...g.lista.flatMap((e) => [
            `    Evidencia: ${e.archivo}`,
            `    Tipo: ${e.tipo}`,
            `    Cargada por: ${e.cargadaPor} · ${e.fecha} ${e.hora}`,
            // El prototipo no imprime la imagen: deja la referencia y el visor la muestra.
            `    [ imagen ${e.formato ? e.formato.toUpperCase() : this.formatoDeArchivo(e.archivo).toUpperCase()} adjunta` +
            `${e.imagen ? ' · vista previa disponible en el visor' : ' · vista previa simulada'} ]`
          ]),
          ''
        ])
        : ['  Sin evidencias adjuntas.']),
      '',
      `Tiempo trabajado: ${this.formatoDuracion(r.cronometro?.duracionMinutos ?? null) || 'menos de 1 min'}`,
      `Fecha de inicio: ${r.cronometro?.fechaInicio ?? r.fechaInicio} ${r.cronometro?.horaInicio ?? ''}`.trim(),
      `Fecha de finalización: ${r.cronometro?.fechaFin ?? r.fechaFin} ${r.cronometro?.horaFin ?? ''}`.trim(),
      `Corrección técnica: ${r.correccionTecnica || '—'}`,
      `Resultado del reproceso: ${r.resultado || '—'}`,
      `Observaciones del Técnico de Hardware: ${r.observacionResultado || r.observaciones || '—'}`,
      '',
      'FIRMA DEL TÉCNICO DE HARDWARE',
      '-'.repeat(60),
      `  ${r.firma.nombre}`,
      `  ${r.firma.cargo} · ${r.firma.unidad}`,
      `  ${r.firma.fecha} · ${r.firma.hora}`,
      `  ${r.firma.firma}`,
      '',
      'Documento de demostración del prototipo SISGOST; las firmas son simuladas.'
    ];
  }

  /** Constancia ya generada de un reproceso, si existe. */
  constanciaDeReproceso(idReproceso: string): DocumentoGenerado | undefined {
    return this.documentos().find((d) => d.reproceso === idReproceso
      && (d.tipo === 'Constancia de reproceso F0288' || d.tipo === 'Constancia de Revisión Técnica de Garantía'));
  }
  /** Todas las constancias de reproceso, de la más reciente a la más antigua. */
  constanciasReproceso(): DocumentoGenerado[] {
    return this.documentos()
      .filter((d) => d.tipo === 'Constancia de reproceso F0288')
      .sort((a, b) => `${b.fecha} ${b.hora ?? ''}`.localeCompare(`${a.fecha} ${a.hora ?? ''}`));
  }
  /** Constancias de revisión técnica de garantía, de la más reciente a la más antigua. */
  constanciasRevisionGarantia(): DocumentoGenerado[] {
    return this.documentos()
      .filter((d) => d.tipo === 'Constancia de Revisión Técnica de Garantía')
      .sort((a, b) => `${b.fecha} ${b.hora ?? ''}`.localeCompare(`${a.fecha} ${a.hora ?? ''}`));
  }
  /** Constancias de los reprocesos y revisiones de garantía de un equipo, para el historial técnico. */
  constanciasDeEquipo(inventario: string): DocumentoGenerado[] {
    return [...this.constanciasReproceso(), ...this.constanciasRevisionGarantia()]
      .filter((d) => d.inventario === inventario);
  }

  /**
   * Genera y guarda la constancia del reproceso **al firmarlo**. Antes solo existía mientras el
   * técnico tenía la pantalla abierta: se veía en el momento de la firma y después no había dónde
   * consultarla. Un documento firmado que no se puede volver a abrir no sirve como respaldo.
   *
   * Se guarda una sola vez por reproceso: consultarla o descargarla de nuevo abre la que ya existe,
   * nunca genera otra ni cambia su huella de integridad.
   */
  registrarConstanciaReproceso(idReproceso: string, usuario: string): DocumentoGenerado | undefined {
    const r = this.reprocesoDe(idReproceso);
    if (!r?.firma) return undefined;
    const existente = this.constanciaDeReproceso(r.id);
    if (existente) return existente;
    // La revisión de garantía usa el mismo mecanismo pero es otro documento: su nombre y su
    // correlativo la distinguen de la constancia de un reproceso por falla de F0302.
    const deGarantia = r.origen === 'Garantía';
    const doc: DocumentoGenerado = {
      tipo: deGarantia ? 'Constancia de Revisión Técnica de Garantía' : 'Constancia de reproceso F0288',
      codigo: deGarantia
        ? this.siguienteCodigoPorAnio(`CONST-GAR-${this.anioActual()}-`,
          this.constanciasRevisionGarantia().map((d) => d.codigo ?? ''))
        : this.siguienteCodigoPorAnio(`CONST-REP-${this.anioActual()}-`,
          this.constanciasReproceso().map((d) => d.codigo ?? '')),
      expediente: r.expediente, reproceso: r.id, expedienteTecnico: r.expedienteTecnico,
      casoGarantia: r.casoGarantia, usuarioFinal: r.usuarioFinal,
      inventario: r.inventario, tecnicoHardware: r.tecnicoAsignado || r.atendidoPor,
      resultado: r.resultado || '', estado: 'Disponible para consulta',
      // Qué imágenes respaldaban el reproceso al firmarlo: el documento debe decir qué certificó.
      evidencias: r.evidencias.map((e) => e.archivo),
      generadoPor: usuario, fecha: this.hoy(), hora: this.hora(), hash: this.hash()
    };
    this.documentos.update((list) => [...list, doc]);
    const ref = { ...this.refReproceso(r), documento: doc.codigo, garantia: r.casoGarantia,
      accionTomada: deGarantia ? 'Constancia de Revisión Técnica de Garantía' : 'Constancia de Reproceso F0288' };
    this.registrarEvento(r.expediente, usuario,
      deGarantia ? 'Constancia de Revisión Técnica de Garantía generada' : 'Constancia de reproceso generada',
      'Reproceso F0288 firmado',
      `${doc.codigo} — constancia del reproceso ${r.id} sobre el Expediente técnico ${r.expedienteTecnico}.`,
      false, { ...ref, estadoDocumento: 'Generado' });
    this.registrarEvento(r.expediente, usuario, 'Constancia de reproceso firmada', 'Reproceso F0288 firmado',
      `Firmada por ${r.firma.nombre} — ${r.firma.cargo} el ${r.firma.fecha} ${r.firma.hora}.`,
      false, { ...ref, estadoDocumento: 'Firmado' });
    this.registrarEvento(r.expediente, usuario, 'Documento de reproceso disponible para consulta',
      'Reproceso F0288 firmado',
      'La constancia queda guardada en el expediente: puede consultarse y descargarse después.',
      true, { ...ref, estadoDocumento: 'Disponible para consulta' });
    return doc;
  }

  /**
   * Registra que alguien abrió la constancia. Se anota una vez por usuario y documento: la
   * trazabilidad debe decir quién la consultó, no cuántas veces la volvió a abrir en la sesión.
   */
  registrarConsultaConstancia(idReproceso: string, usuario: string, descargada = false): void {
    const r = this.reprocesoDe(idReproceso);
    const doc = this.constanciaDeReproceso(idReproceso);
    if (!r || !doc) return;
    const accion = descargada ? 'Documento de reproceso descargado' : 'Documento de reproceso consultado';
    const clave = `${accion}·${doc.codigo}·${usuario}`;
    if (this.consultasRegistradas.has(clave)) return;
    this.consultasRegistradas.add(clave);
    this.registrarEvento(r.expediente, usuario, accion, 'Reproceso F0288 firmado',
      `${doc.codigo} — constancia del reproceso ${r.id}.`, false,
      { ...this.refReproceso(r), documento: doc.codigo, estadoDocumento: doc.estado ?? 'Disponible para consulta',
        accionTomada: descargada ? 'Descarga de la constancia' : 'Consulta de la constancia' });
  }
  /** Consultas ya anotadas en esta sesión, para no repetir el mismo evento en cada clic. */
  private readonly consultasRegistradas = new Set<string>();

  // ---------- Constancia de Corrección F0302 por Inconformidad ----------
  /** Constancia ya generada de una corrección por inconformidad, si existe. */
  constanciaDeCorreccion(idCorreccion: string): DocumentoGenerado | undefined {
    return this.documentos()
      .find((d) => d.tipo === 'Constancia de corrección F0302 por inconformidad' && d.correccion === idCorreccion);
  }
  /** Todas las constancias de corrección, de la más reciente a la más antigua. */
  constanciasCorreccion(): DocumentoGenerado[] {
    return this.documentos()
      .filter((d) => d.tipo === 'Constancia de corrección F0302 por inconformidad')
      .sort((a, b) => `${b.fecha} ${b.hora ?? ''}`.localeCompare(`${a.fecha} ${a.hora ?? ''}`));
  }
  /** Constancias de inconformidad de un equipo, para el historial técnico y el detalle del equipo. */
  constanciasCorreccionDeEquipo(inventario: string): DocumentoGenerado[] {
    return this.constanciasCorreccion().filter((d) => d.inventario === inventario);
  }

  /**
   * Genera y guarda la constancia de la corrección **al firmarla**, con la misma regla que la del
   * reproceso: una sola por corrección, y volver a pedirla devuelve la que ya existe en lugar de
   * cambiar la huella de un documento firmado.
   */
  registrarConstanciaCorreccion(idCorreccion: string, usuario: string): DocumentoGenerado | undefined {
    const cor = this.correccionDe(idCorreccion);
    if (!cor?.firma) return undefined;
    const existente = this.constanciaDeCorreccion(cor.id);
    if (existente) return existente;
    const doc: DocumentoGenerado = {
      tipo: 'Constancia de corrección F0302 por inconformidad',
      codigo: this.siguienteCodigoPorAnio(`CONST-COR-${this.anioActual()}-`,
        this.constanciasCorreccion().map((d) => d.codigo ?? '')),
      expediente: cor.expediente, correccion: cor.id,
      expedienteTecnico: this.expTecnicoDeEquipo(cor.inventario)?.codigo,
      inventario: cor.inventario, tecnicoSoporte: cor.tecnico, usuarioFinal: cor.usuarioFinal,
      tipoProblema: cor.tipoProblema, resultado: cor.resultado || 'Corregido en F0302',
      estado: 'Disponible para consulta',
      generadoPor: usuario, fecha: this.hoy(), hora: this.hora(), hash: this.hash()
    };
    this.documentos.update((list) => [...list, doc]);
    const ref = { ...this.refInconformidad(cor), documento: doc.codigo,
      accionTomada: 'Constancia de Corrección F0302 por Inconformidad' };
    this.registrarEvento(cor.expediente, usuario, 'Constancia de corrección generada', 'Corrección F0302 firmada',
      `${doc.codigo} — constancia de la corrección ${cor.id} del intento de conformidad #${cor.intentoNumero}.`,
      false, { ...ref, estadoDocumento: 'Generado' });
    this.registrarEvento(cor.expediente, usuario, 'Constancia de corrección firmada', 'Corrección F0302 firmada',
      `Firmada por ${cor.firma.nombre} — ${cor.firma.cargo} el ${cor.firma.fecha} ${cor.firma.hora}.`,
      false, { ...ref, estadoDocumento: 'Firmado', firmaRegistrada: 'Sí' });
    this.registrarEvento(cor.expediente, usuario, 'Documento de corrección disponible para consulta',
      'Corrección F0302 firmada',
      'La constancia queda guardada en el expediente: puede consultarse y descargarse después.',
      true, { ...ref, estadoDocumento: 'Disponible para consulta', firmaRegistrada: 'Sí' });
    return doc;
  }

  /** Consulta o descarga de la constancia de corrección; se anota una vez por usuario y documento. */
  registrarConsultaConstanciaCorreccion(idCorreccion: string, usuario: string, descargada = false): void {
    const cor = this.correccionDe(idCorreccion);
    const doc = this.constanciaDeCorreccion(idCorreccion);
    if (!cor || !doc) return;
    const accion = descargada ? 'Documento de corrección descargado' : 'Documento de corrección consultado';
    const clave = `${accion}·${doc.codigo}·${usuario}`;
    if (this.consultasRegistradas.has(clave)) return;
    this.consultasRegistradas.add(clave);
    this.registrarEvento(cor.expediente, usuario, accion, 'Corrección F0302 firmada',
      `${doc.codigo} — constancia de la corrección ${cor.id}.`, false,
      { ...this.refInconformidad(cor), documento: doc.codigo,
        estadoDocumento: doc.estado ?? 'Disponible para consulta',
        accionTomada: descargada ? 'Descarga de la constancia' : 'Consulta de la constancia' });
  }

  /**
   * Contenido de la Constancia de Corrección F0302 por Inconformidad: lo que quedó registrado
   * durante la atención, sin recalcular nada.
   */
  constanciaCorreccionF0302(idCorreccion: string): string[] | string {
    const cor = this.correccionDe(idCorreccion);
    if (!cor) return 'No se encontró la corrección indicada.';
    if (!cor.firma) return 'La corrección aún no está firmada por el Técnico de Soporte.';
    const doc = this.constanciaDeCorreccion(cor.id);
    const eq = this.equipoDe(cor.inventario);
    const unico = this.expedienteUnicoDe(cor.expediente);
    return [
      'CONSTANCIA DE CORRECCIÓN F0302 POR INCONFORMIDAD',
      '='.repeat(60),
      `Documento: ${doc?.codigo ?? '—'} · Estado: ${doc?.estado ?? 'Generado'}`,
      `Código de corrección: ${cor.id}`,
      `Expediente único: ${unico?.codigoUnico ?? '—'}`,
      `Expediente técnico: ${this.expTecnicoDeEquipo(cor.inventario)?.codigo ?? '—'}`,
      `Equipo: ${eq ? `${eq.marca} ${eq.modelo}` : '—'}`,
      `Tipo de equipo: ${eq ? (eq.tipo === 'Desktop' ? 'CPU' : eq.tipo) : '—'}`,
      `Número de inventario: ${cor.inventario}`,
      `Usuario final: ${cor.usuarioFinal}`,
      `Intento de conformidad: #${cor.intentoNumero}`,
      `Tipo de problema: ${cor.tipoProblema}`,
      `Resolución: ${cor.resolucion}${cor.justificacionResolucion ? ` (excepción justificada: ${cor.justificacionResolucion})` : ''}`,
      `Observación del Usuario Final: ${cor.observacionUsuario || '—'}`,
      '',
      'CHECKLIST DE ATENCIÓN',
      '-'.repeat(60),
      ...cor.checklist.map((i) => `  [${i.estado === 'Realizado' ? 'X' : i.estado === 'No aplica' ? '—' : ' '}] ${i.nombre}${i.nota ? ` · ${i.nota}` : ''}`),
      '',
      'EVIDENCIAS DE LA CORRECCIÓN',
      '-'.repeat(60),
      ...(cor.evidencias.length
        ? cor.evidencias.map((e) => `  ${e.archivo} · ${e.tipo} · ${e.cargadaPor} · ${e.fecha} ${e.hora}`)
        : ['  Sin evidencias adjuntas (la corrección no implicó intervención).']),
      '',
      `Corrección realizada: ${cor.descripcion || '—'}`,
      `Técnico de Soporte: ${cor.tecnico}`,
      `Fecha de inicio: ${cor.fechaInicio} ${cor.horaInicio}`.trim(),
      `Fecha de finalización: ${cor.fechaFin} ${cor.horaFin}`.trim(),
      `Tiempo trabajado: ${this.formatoDuracion(cor.cronometro?.duracionMinutos ?? null) || 'menos de 1 min'}`,
      `Complejidad: ${cor.huboComplejidad === 'Sí' ? `Sí — ${cor.detalleComplejidad}` : 'No'}`,
      `Observación técnica: ${cor.observacionTecnica || '—'}`,
      `Resultado: ${cor.resultado || '—'}`,
      '',
      'FIRMA DEL TÉCNICO DE SOPORTE',
      '-'.repeat(60),
      `  ${cor.firma.nombre}`,
      `  ${cor.firma.cargo} · ${cor.firma.unidad}`,
      `  ${cor.firma.fecha} · ${cor.firma.hora}`,
      `  ${cor.firma.firma}`,
      '',
      'Documento de demostración del prototipo SISGOST; las firmas son simuladas.'
    ];
  }

  /**
   * Registra la corrección de Soporte de una falla que NO requiere reproceso F0288 (red, dominio,
   * sistema operativo sin reinstalación…). Deja el proceso listo para el nuevo intento F0302 sin
   * que el equipo haya salido del escritorio del técnico.
   */
  registrarCorreccionSoporte(id: string, usuario: string, descripcion: string,
    archivo = '', imagen = ''): string | null {
    const conFalla = this.configuracionesConFallaDe(id)[0];
    if (!conFalla?.falla) return 'Este proceso no tiene una falla F0302 que corregir.';
    const f = conFalla.falla;
    if (f.requiereReprocesoF0288) return 'Esta falla requiere reproceso de Preparación F0288: no puede cerrarse como corrección de Soporte.';
    if (f.estadoIncidencia === 'LISTO_PARA_REINTENTO_F0302') return 'La corrección de Soporte ya fue registrada.';
    if (!descripcion.trim()) return 'Describa la corrección realizada antes de registrarla.';
    // La imagen de la corrección es otra que la de la falla: una muestra el problema y la otra que
    // se resolvió. Sin ella el proceso no queda listo para el reintento.
    if (!archivo.trim()) return this.MSG_EVIDENCIA_CORRECCION_SOPORTE;
    if (!this.evid.formatoValido(archivo)) return this.evid.MSG_FORMATO;
    const errorImagen = this.adjuntarEvidencia({
      modulo: 'Configuración F0302', proceso: id, expediente: id,
      inventario: conFalla.datos.inventario, archivo, tipo: 'Corrección realizada', usuario,
      imagen, item: 'Corrección realizada en F0302'
    });
    if (errorImagen) return errorImagen;
    this.actualizarConfiguracionConFalla(id, (x) => ({
      ...x, estadoIncidencia: 'LISTO_PARA_REINTENTO_F0302',
      correccionSoporte: { descripcion: descripcion.trim(), tecnico: usuario, fecha: this.hoy(), hora: this.hora() }
    }));
    this.setEstadoSolicitud(id, 'Pendiente de nuevo intento F0302', 'Nueva Configuración F0302 tras la corrección de Soporte');
    this.expedientesUnicos.update((list) => list.map((x) => (x.expediente === id
      ? { ...x, estado: 'Pendiente de configuración', resumenEstado: 'Corrección de Soporte registrada · listo para reintento F0302' } : x)));
    this.registrarEvento(id, usuario, 'Corrección de Soporte registrada', 'Listo para reintento F0302',
      descripcion.trim(), true,
      { modulo: 'Configuración F0302', inventario: conFalla.datos.inventario,
        expedienteTecnico: this.expTecnicoDeEquipo(conFalla.datos.inventario)?.codigo,
        expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, tipoFalla: f.tipo, requiereReproceso: 'No',
        rol: this.rolDeUsuario(usuario), evidencia: archivo.trim(), tipoEvidencia: 'Corrección realizada',
        estadoValidacion: 'Válida', accionTomada: 'Corrección de Soporte en el mismo F0302' });
    return null;
  }

  /**
   * Solicita la sustitución del equipo: el único desenlace de una falla en el que sí puede
   * evaluarse un Expediente técnico nuevo, porque el equipo que lo recibiría es otro. No lo crea
   * automáticamente —eso sigue siendo decisión de un Encargado— ni descarga el equipo por su
   * cuenta: deja el proceso marcado y el equipo señalado como no apto para entrega.
   */
  solicitarSustitucionEquipo(id: string, usuario: string, motivo: string): string | null {
    const conFalla = this.configuracionesConFallaDe(id)[0];
    if (!conFalla?.falla) return 'Este proceso no tiene una falla F0302 registrada.';
    if (!motivo.trim()) return 'Indique el motivo por el que el equipo debe sustituirse.';
    const inventario = conFalla.datos.inventario;
    this.equipos.update((list) => list.map((e) => (e.inventario === inventario
      ? { ...e, observaciones: `${e.observaciones ? e.observaciones + ' · ' : ''}No apto para entrega: sustitución solicitada por falla en F0302 (${motivo.trim()})` }
      : e)));
    this.setEstadoSolicitud(id, 'Pendiente de sustitución de equipo', 'Sustitución del equipo por falla en F0302');
    this.expedientesUnicos.update((list) => list.map((x) => (x.expediente === id
      ? { ...x, estado: 'Pendiente de sustitución de equipo', resumenEstado: 'Equipo no apto para entrega · sustitución solicitada' } : x)));
    this.registrarEvento(id, usuario, 'Sustitución de equipo solicitada por falla en F0302', 'Pendiente de sustitución de equipo',
      `${motivo.trim()} — El equipo queda marcado como no apto para entrega; el Expediente técnico del equipo sustituto se evalúa aparte.`,
      true, { modulo: 'Configuración F0302', inventario,
        expedienteTecnico: this.expTecnicoDeEquipo(inventario)?.codigo,
        expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, tipoFalla: conFalla.falla.tipo,
        accionTomada: 'Sustitución de equipo' });
    return null;
  }

  /**
   * Inicia un NUEVO intento de Configuración F0302 tras una falla, sin borrar el anterior: el
   * F0302 con falla queda como intento en el historial y esta crea una configuración activa
   * fresca sobre el MISMO Expediente técnico. Requiere que la incidencia esté resuelta —corrección
   * de Soporte registrada o reproceso F0288 finalizado y devuelto— y que el equipo siga preparado.
   * Devuelve la nueva configuración o el mensaje de validación.
   */
  nuevaConfiguracionF0302(id: string, usuario: string): ConfiguracionF0302 | string {
    const conFalla = this.configuracionesConFallaDe(id)[0];
    if (!conFalla) return 'Este proceso no tiene una configuración F0302 con falla que reintentar.';
    const activa = this.configuraciones().find((c) => c.expediente === id && c.estado !== 'Con falla');
    if (activa) return 'Ya existe una configuración F0302 activa para este proceso.';
    const inventario = conFalla.datos.inventario;
    const falla = conFalla.falla;
    // La incidencia manda: ya no se exige un reingreso a Hardware ni un Expediente técnico nuevo,
    // pero sí que la falla se haya atendido de verdad —corregida por Soporte o reprocesada en
    // F0288 y devuelta—. Sin eso el reintento arrancaría sobre el mismo problema.
    if (falla && falla.estadoIncidencia !== 'LISTO_PARA_REINTENTO_F0302') {
      return falla.requiereReprocesoF0288
        ? `Complete el reproceso de Preparación F0288 y devuelva el equipo a Configuración F0302 antes de reintentar (estado: ${this.textoEstadoIncidencia(falla.estadoIncidencia)}).`
        : 'Registre la corrección de Soporte de la falla antes de iniciar un nuevo intento F0302.';
    }
    if (this.estadoPreparacionEquipo(inventario) !== 'Preparado') {
      return 'El equipo debe completar la Preparación F0288 antes de iniciar una nueva Configuración F0302.';
    }
    // `datos` se conserva tal cual, incluida la reserva de IP: es el mismo equipo para el mismo
    // usuario final, y el técnico puede modificarla en el checklist de la nueva configuración.
    const nueva: ConfiguracionF0302 = {
      ...conFalla,
      seleccionadoPor: usuario,
      fecha: '',
      estado: 'En curso',
      cronometro: undefined,
      cierre: undefined,
      falla: undefined,
      software: conFalla.software.map((s) => ({ ...s, estado: 'Pendiente', evidencia: null })),
      evidencias: conFalla.evidencias.map((e) => ({ ...e, estado: 'Pendiente' })),
      firmas: {
        preparo: { ...conFalla.firmas.preparo },
        configuro: { ...conFalla.firmas.configuro, estado: 'Pendiente de cierre', fecha: '' }
      }
    };
    this.configuraciones.update((list) => [nueva, ...list]);
    this.setEstadoSolicitud(id, 'En configuración', 'Checklist F0302 (reintento tras falla)');
    this.expedientesUnicos.update((list) =>
      list.map((x) => (x.expediente === id
        ? { ...x, estado: 'En configuración', resumenEstado: 'Nueva configuración F0302 tras falla' }
        : x)));
    this.actualizarAnexo(id, 'Se anexa configuración del equipo', 'En proceso', 'Nueva configuración F0302 tras la falla anterior');
    const intento = this.configuracionesDeEquipo(inventario).filter((x) => this.configuracionEsIntento(x)).length + 1;
    this.registrarEvento(id, usuario, `Nuevo intento F0302 iniciado (intento #${intento})`, 'En configuración',
      `El F0302 con falla se conserva como intento en el historial; se trabaja sobre el mismo Expediente técnico ${this.expTecnicoDeEquipo(inventario)?.codigo ?? '—'}.`,
      true,
      { modulo: 'Configuración F0302', estadoAnterior: this.textoEstadoIncidencia(falla?.estadoIncidencia ?? 'LISTO_PARA_REINTENTO_F0302'),
        inventario, expedienteTecnico: this.expTecnicoDeEquipo(inventario)?.codigo,
        expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: conFalla.datos.asignadoA,
        tipoFalla: falla?.tipo, requiereReproceso: falla ? (falla.requiereReprocesoF0288 ? 'Sí' : 'No') : undefined,
        accionTomada: 'Nuevo intento de Configuración F0302', reproceso: falla?.reprocesoId });
    return nueva;
  }

  // ---------- Entrega, conformidad y garantía ----------

  /**
   * Datos del F0302 que no pueden faltar antes de enviar el formulario de conformidad: el usuario
   * final debe ver con qué nombre quedó el equipo y con qué reserva de IP se configuró. Mientras
   * falte alguno, el flujo NO avanza —no se envía el formulario, no se crea el intento de
   * aceptación, no se inicia el conteo ni se habilita la garantía—.
   *
   * Devuelve null si el formulario puede enviarse, o el mensaje de la regla que lo impide.
   */
  validarEnvioConformidad(id: string): string | null {
    const c = this.configuracionDe(id);
    if (!c) return 'No se encontró la configuración F0302 del proceso.';
    if (c.estado !== 'Completada') {
      return 'El F0302 debe estar generado antes de solicitar la conformidad del usuario final.';
    }
    if (!(c.datos.nombrePC ?? '').trim()) {
      return 'Debe ingresar el nombre del equipo para finalizar la configuración.';
    }
    const requiere = c.datos.requiereReservaIP ?? '';
    if (!requiere) return 'Indique si el equipo requiere reserva de IP antes de enviar el formulario de conformidad.';
    // Con «No» basta la justificación; con «Sí» hacen falta IP, MAC y la solicitud ya enviada.
    const falta = this.validarReservaIP(c.datos.inventario, requiere, c.datos.ipReservada ?? '',
      c.datos.macEquipo ?? '', c.datos.justificacionSinReservaIP ?? '');
    if (falta) return falta;
    if (requiere === 'Sí' && c.datos.estadoSolicitudIP !== 'Enviada') {
      return 'Debe completar y enviar la solicitud de reserva de IP antes de enviar el formulario de conformidad.';
    }
    return null;
  }

  /**
   * Envía (o reenvía) el formulario de conformidad al usuario final. Devuelve la conformidad
   * creada/actualizada, o el mensaje que impide enviarla: el flujo se detiene ahí, sin cambiar de
   * estado ni registrar intento de aceptación.
   */
  enviarConformidad(id: string, usuario: string): Conformidad | string {
    const s = this.solicitud(id);
    const c = this.configuracionDe(id);
    const bloqueo = this.validarEnvioConformidad(id);
    if (bloqueo || !s || !c) {
      const motivo = bloqueo ?? 'No se encontró el proceso o su configuración F0302.';
      if (c) {
        // El bloqueo también deja rastro: es un intento de avanzar el flujo sin un dato del expediente.
        const porIP = /reserva de IP|IP reservada|MAC del equipo|formato válido|justificar/i.test(motivo);
        this.registrarEvento(id, usuario,
          porIP
            ? 'Formulario de conformidad bloqueado por falta de validación de IP'
            : 'Formulario de conformidad bloqueado por falta del nombre del equipo',
          c.estado,
          `${motivo} Formulario: F0302 · No se envió el formulario, no se inició el conteo de aceptación, ` +
            'no se habilitó la respuesta del usuario final ni la garantía y no se cerró la entrega.', false,
          { modulo: 'Entrega y aceptación', inventario: c.datos.inventario,
            expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: c.datos.asignadoA,
            nombreEquipo: c.datos.nombrePC, ipReservada: this.textoIPReservada(c),
            mac: this.macNormalizada(c.datos.macEquipo ?? '') || 'Sin registrar',
            estadoSolicitudIP: this.textoEstadoSolicitudIP(c) });
      }
      return motivo;
    }
    // La reserva quedó confirmada antes del envío: se deja constancia de la verificación.
    const dlp = this.softwareChecklistF0302(c).find((s) => s.requiereEvidencia);
    this.registrarEvento(id, usuario, 'Reserva de IP validada antes de enviar conformidad',
      c.estado, `Formulario: F0302 · Nombre del equipo: ${c.datos.nombrePC} · Reserva de IP: ${c.datos.requiereReservaIP} · ` +
        `IP reservada: ${this.textoIPReservada(c)}` +
        (c.datos.requiereReservaIP === 'Sí'
          ? ` · MAC: ${this.macNormalizada(c.datos.macEquipo ?? '')} · Solicitud de reserva de IP: ${this.textoEstadoSolicitudIP(c)}`
          : ` · Justificación: «${c.datos.justificacionSinReservaIP ?? ''}»`) +
        (dlp ? ` · ${dlp.nombre}: ${dlp.estado}${dlp.evidencia ? ` · Evidencia: ${dlp.evidencia}` : ''}` : ''), false,
      { modulo: 'Entrega y aceptación', inventario: c.datos.inventario,
        expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: c.datos.asignadoA,
        nombreEquipo: c.datos.nombrePC, ipReservada: this.textoIPReservada(c),
        mac: this.macNormalizada(c.datos.macEquipo ?? '') || 'No aplica',
        justificacion: c.datos.justificacionSinReservaIP ?? '',
        estadoSolicitudIP: this.textoEstadoSolicitudIP(c) });

    const existente = this.conformidades().find((x) => x.expediente === id);
    const vence = new Date();
    vence.setDate(vence.getDate() + 7);
    if (existente) {
      this.conformidades.update((list) =>
        list.map((x) => (x.expediente === id
          ? { ...x, estado: 'Pendiente de respuesta', fechaEnvio: new Date().toISOString(), vence: vence.toISOString().slice(0, 10),
              // El reenvío vuelve a congelar los datos del F0302: pudieron completarse después del primer envío.
              nombreEquipo: c.datos.nombrePC, requiereReservaIP: c.datos.requiereReservaIP ?? '',
              ipReservada: (c.datos.ipReservada ?? '').trim(),
              macEquipo: this.macNormalizada(c.datos.macEquipo ?? ''),
              justificacionSinReservaIP: c.datos.justificacionSinReservaIP ?? '',
              estadoSolicitudIP: this.textoEstadoSolicitudIP(c) as EstadoSolicitudReservaIP,
              ipValidadaPor: c.datos.ipValidadaPor ?? '', ipValidadaEl: c.datos.ipValidadaEl ?? '' }
          : x))
      );
      this.registrarEvento(id, usuario, 'Formulario de conformidad reenviado al correo institucional del usuario final', 'Pendiente de aceptación');
      return this.conformidades().find((x) => x.expediente === id)
        ?? 'No se encontró el formulario de conformidad del proceso.';
    }

    const eq = this.equipoDe(s.equipoInventario);
    const nueva: Conformidad = {
      token: `CONF-${this.anioActual()}-${id.slice(-4)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      expediente: id,
      usuarioFinal: s.destinatario,
      correo: s.correoDestinatario,
      unidad: s.unidadDestino,
      equipo: eq ? `${eq.tipo} · ${eq.condicion.toLowerCase()}` : s.tipoEquipo,
      marcaModelo: eq ? `${eq.marca} ${eq.modelo}` : '—',
      inventario: s.equipoInventario,
      fechaEntrega: this.hoy(),
      tecnicoEntrega: usuario,
      resumenF0302: `${c.datos.sistemaOperativo} · software estándar instalado y verificado · firmas de los técnicos registradas en el sistema`,
      estado: 'Pendiente de respuesta',
      fechaEnvio: new Date().toISOString(),
      vence: vence.toISOString().slice(0, 10),
      fechaRespuesta: '',
      aceptaTerminos: false,
      respuesta: '',
      observaciones: '',
      // Datos del F0302 congelados en el formulario: el usuario final debe ver con qué nombre y
      // con qué reserva de IP quedó configurado el equipo que está aceptando.
      nombreEquipo: c.datos.nombrePC,
      requiereReservaIP: c.datos.requiereReservaIP ?? '',
      ipReservada: (c.datos.ipReservada ?? '').trim(),
      macEquipo: this.macNormalizada(c.datos.macEquipo ?? ''),
      justificacionSinReservaIP: c.datos.justificacionSinReservaIP ?? '',
      estadoSolicitudIP: this.textoEstadoSolicitudIP(c) as EstadoSolicitudReservaIP,
      ipValidadaPor: c.datos.ipValidadaPor ?? '',
      ipValidadaEl: c.datos.ipValidadaEl ?? ''
    };
    this.conformidades.update((list) => [...list, nueva]);

    const entregaExistente = this.entregaDe(id);
    if (!entregaExistente) {
      const asig = this.asignacionDe(id);
      this.entregas.update((list) => [
        ...list,
        {
          expediente: id,
          solicitudRef: this.tipoRequerimientoTexto(s),
          usuarioFinal: s.destinatario,
          carne: s.carne,
          correo: s.correoDestinatario,
          unidadDestino: s.unidadDestino,
          equipo: `${nueva.marcaModelo} · ${nueva.equipo}`,
          inventario: s.equipoInventario,
          fechaEntrega: this.hoy(),
          tecnicoEntrega: usuario,
          tecnicoConfiguro: c.tecnico,
          preparadoPor: asig?.responsablesFase.tecnicoPreparacion ?? '—',
          f0302Generado: true,
          f0302Fecha: c.fecha || this.hoy(),
          conformidadToken: nueva.token,
          estado: 'Pendiente de respuesta'
        }
      ]);
    } else {
      this.entregas.update((list) =>
        list.map((e) => (e.expediente === id ? { ...e, conformidadToken: nueva.token, estado: 'Pendiente de respuesta' } : e))
      );
    }

    this.setEstadoSolicitud(id, 'Pendiente de aceptación', 'Respuesta del formulario de conformidad');
    this.actualizarAnexo(id, 'Formulario de conformidad', 'Pendiente de respuesta', `Enviado al correo institucional ${s.correoDestinatario}`);
    this.registrarEvento(id, usuario, 'Formulario de conformidad enviado al correo institucional del usuario final',
      'Pendiente de aceptación',
      `Enlace único ${nueva.token}, vence el ${nueva.vence}. Nombre del equipo: ${c.datos.nombrePC} · ` +
        `Reserva de IP: ${c.datos.requiereReservaIP} · IP reservada: ${this.textoIPReservada(c)}.`, true,
      { modulo: 'Entrega y aceptación', estadoAnterior: 'Listo para entrega', inventario: s.equipoInventario,
        usuarioFinal: s.destinatario, nombreEquipo: c.datos.nombrePC, ipReservada: this.textoIPReservada(c) });
    // Intento de aceptación #1: cada envío del formulario queda registrado como intento propio.
    this.crearIntentoAceptacion(id, nueva);
    return nueva;
  }

  /**
   * Registra un nuevo intento de aceptación (Pendiente de firma) para el proceso, con el token
   * del formulario vigente. Nunca sobrescribe intentos anteriores; el número es correlativo por
   * proceso. `correccion` enlaza el reenvío con la corrección que lo originó (intento #2 en adelante).
   */
  private crearIntentoAceptacion(id: string, conf: Conformidad, correccion?: CorreccionNoConformidad): void {
    const numero = this.intentosDe(id).length + 1;
    const intento: IntentoAceptacion = {
      id: this.siguienteCodigoPorAnio(`INT-${this.anioActual()}-`, this.intentos().map((i) => i.id)),
      expediente: id,
      inventario: conf.inventario,
      numero,
      token: conf.token,
      resultado: 'Pendiente de firma',
      fecha: '',
      hora: '',
      fechaEnvio: this.hoy(),
      usuarioFinal: conf.usuarioFinal,
      observacion: '',
      firma: '',
      correccionRelacionada: correccion?.id,
      correccionRealizada: correccion
        ? `${correccion.tipoProblema} — ${correccion.resolucion}: ${correccion.descripcion || 'corrección registrada'}`
        : undefined
    };
    this.intentos.update((list) => [...list, intento]);
    if (numero > 1) {
      this.registrarEvento(id, 'Sistema', `Nuevo intento de aceptación #${numero} creado`, 'Pendiente de firma',
        'El formulario se reenvió tras registrar la corrección; los intentos anteriores se conservan.', false,
        { modulo: 'Entrega y aceptación', inventario: conf.inventario,
          expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: conf.usuarioFinal });
    }
  }

  /**
   * Registra la respuesta del formulario externo. Si el usuario final acepta, `firmaNombre`
   * queda como su firma de conformidad simulada (asociada al Expediente único, al documento
   * de Entrega y aceptación y al F0302); si marca «No estoy conforme», NO se genera firma.
   */
  responderConformidad(token: string, acepta: boolean, observaciones: string, firmaNombre = ''): void {
    const conf = this.conformidadPorToken(token);
    if (!conf) return;
    const id = conf.expediente;
    const respuesta = acepta ? 'Acepto la recepción del equipo' : 'No estoy conforme';
    this.conformidades.update((list) =>
      list.map((x) => (x.token === token
        ? {
            ...x, estado: acepta ? 'Aceptado' : 'No conforme', fechaRespuesta: new Date().toISOString(),
            aceptaTerminos: true, respuesta, observaciones: observaciones || 'Sin observaciones',
            firmaUsuarioFinal: acepta ? (firmaNombre.trim() || conf.usuarioFinal) : ''
          }
        : x))
    );
    // Registra el resultado sobre el intento vigente (el que porta este token); nunca lo sobrescribe con otro.
    this.intentos.update((list) =>
      list.map((i) => (i.token === token && i.resultado === 'Pendiente de firma'
        ? {
            ...i, resultado: acepta ? 'Aceptado' : 'No conforme', fecha: this.hoy(), hora: this.hora(),
            observacion: acepta ? '' : (observaciones || 'Inconformidad sin detalle'),
            firma: acepta ? (firmaNombre.trim() || conf.usuarioFinal) : ''
          }
        : i))
    );
    const nIntento = this.ultimoIntento(id)?.numero ?? 1;
    this.entregas.update((list) =>
      list.map((e) => (e.expediente === id ? { ...e, estado: acepta ? 'Cerrada' : 'Observada' } : e))
    );
    this.registrarEvento(id, 'Sistema (formulario externo)',
      acepta ? `Usuario final aceptó la recepción del equipo (intento de aceptación #${nIntento})`
             : `Formulario de conformidad marcado como No conforme (intento #${nIntento})`,
      acepta ? 'Entregado' : 'No conforme',
      'Respuesta registrada con fecha y hora y anexada al expediente único.', true,
      { modulo: 'Entrega y aceptación', estadoAnterior: 'Pendiente de aceptación', inventario: conf.inventario,
        expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: conf.usuarioFinal });

    if (acepta) {
      this.setEstadoSolicitud(id, 'Entregado', 'Reporte final de auditoría');
      this.actualizarAnexo(id, 'Formulario de conformidad', 'Aceptado', 'Respondido desde el correo institucional');
      this.actualizarAnexo(id, 'Entrega y aceptación', 'Completada', 'Conformidad registrada mediante formulario externo');
      // La firma de conformidad del usuario final queda capturada y la constancia de
      // Entrega y aceptación se registra como documento descargable con esa firma.
      this.actualizarAnexo(id, 'Firmas registradas', '3 de 3', 'F0288, F0302 y conformidad del usuario final firmados');
      this.documentos.update((list) => [
        ...list,
        { tipo: 'Entrega y aceptación', expediente: id, generadoPor: 'Sistema (formulario externo)', fecha: this.hoy(), hash: this.hash() }
      ]);
      this.registrarEvento(id, 'Sistema (formulario externo)',
        `Firma de conformidad del usuario final capturada (${firmaNombre.trim() || conf.usuarioFinal})`, 'Entregado',
        'Firma simulada asociada al Expediente único, al documento de Entrega y aceptación y al F0302.', false,
        { modulo: 'Entrega y aceptación', inventario: conf.inventario,
          expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: conf.usuarioFinal });
      // La garantía ya no dura «un mes desde la aceptación»: se calcula por fechas y depende de
      // qué responde por el equipo. Si es nuevo, responde el proveedor desde que se compró; si es
      // usado, responde Soporte desde que el equipo quedó activo.
      const fechaAceptacion = this.hoy();
      const p = this.garantiaPropuesta(conf.inventario, fechaAceptacion);
      const eq = this.equipoDe(conf.inventario);
      const nuevaGarantia = this.sincronizarVigencia({
        expediente: id,
        equipo: conf.marcaModelo,
        inventario: conf.inventario,
        usuarioFinal: `${conf.usuarioFinal} — ${conf.unidad}`,
        fechaAceptacion,
        fechaInicio: '', fechaVencimiento: '',
        estado: 'Vigente',
        casos: [],
        nota: `${p.nota} La aceptación confirma que el equipo fue recibido conforme; queda anexada al expediente único.`,
        tipoGarantia: p.tipo, fechaAdquisicion: p.fechaAdquisicion,
        inicioProveedor: p.inicioProveedor, vencimientoProveedor: p.vencimientoProveedor,
        inicioInterna: p.inicioInterna, vencimientoInterna: p.vencimientoInterna,
        proveedor: eq?.proveedor ?? '', observacionesGarantia: eq?.observacionGarantia ?? '',
        modificaciones: []
      });
      this.garantias.update((list) => [...list, nuevaGarantia]);

      const refGar = {
        modulo: 'Servicio de garantía', inventario: conf.inventario, usuarioFinal: conf.usuarioFinal,
        expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico,
        tipoGarantia: p.tipo, fechaAdquisicion: p.fechaAdquisicion, fechaAceptacion,
        inicioNuevo: nuevaGarantia.fechaInicio, vencimientoNuevo: nuevaGarantia.fechaVencimiento
      };
      if (p.tipo === 'Garantía de proveedor' && p.inicioProveedor) {
        this.actualizarAnexo(id, 'Servicio de garantía', 'Vigente',
          `Garantía de proveedor ${p.inicioProveedor} → ${p.vencimientoProveedor}`);
        this.registrarEvento(id, 'Sistema',
          `Garantía de proveedor asignada desde fecha de adquisición (${p.inicioProveedor}, vence ${p.vencimientoProveedor})`,
          'Garantía de proveedor vigente',
          `Equipo nuevo: ${this.ANIOS_GARANTIA_PROVEEDOR} años desde la adquisición. La fecha de aceptación (${fechaAceptacion}) no inicia la garantía del proveedor.`,
          true, { ...refGar, estadoAnterior: 'Entregado' });
      } else if (p.tipo === 'Garantía de proveedor') {
        // Equipo nuevo sin fecha de adquisición. La base institucional siempre la trae, así que
        // esto es un fallo del dato de origen: se nombra así y no se inventa una fecha.
        this.actualizarAnexo(id, 'Servicio de garantía', 'Pendiente de corrección de datos institucionales',
          'La base institucional no devolvió la fecha de adquisición del equipo');
        this.registrarEvento(id, 'Sistema', 'Garantía de proveedor pendiente de corrección de datos institucionales',
          'Pendiente de corrección de datos institucionales', this.MSG_DATOS_INSTITUCIONALES, true,
          { ...refGar, estadoAnterior: 'Entregado' });
      } else if (p.tipo === 'Sin garantía de proveedor') {
        // El equipo ya agotó sus tres años. No se le inventa una responsabilidad interna: la fija
        // el Encargado de Soporte, que es quien la asume.
        this.actualizarAnexo(id, 'Servicio de garantía', 'Garantía de proveedor vencida',
          `Garantía de proveedor ${p.inicioProveedor} → ${p.vencimientoProveedor}, ya vencida`);
        this.registrarEvento(id, 'Sistema',
          `Garantía de proveedor vencida (cubrió del ${p.inicioProveedor} al ${p.vencimientoProveedor})`,
          'Garantía de proveedor vencida', this.MSG_PROVEEDOR_VENCIDA_USADO, true,
          { ...refGar, estadoAnterior: 'Entregado' });
      } else {
        this.actualizarAnexo(id, 'Servicio de garantía', 'Vigente',
          `Responsabilidad interna de Soporte ${p.inicioInterna} → ${p.vencimientoInterna}`);
        this.registrarEvento(id, 'Sistema',
          `Responsabilidad interna de Soporte asignada (${p.inicioInterna} → ${p.vencimientoInterna})`,
          'Responsabilidad interna activa',
          'Equipo usado: sin garantía de proveedor. El vencimiento lo ajusta el Encargado de Soporte cuando corresponda.',
          true, { ...refGar, estadoAnterior: 'Entregado' });
      }
      // El expediente NO se cierra: queda disponible para registrar casos de garantía.
      this.expedientesUnicos.update((list) =>
        list.map((x) => (x.expediente === id
          ? { ...x, estado: 'Aceptado', resumenEstado: 'Aceptado · Garantía vigente', fechaEntrega: this.hoy() }
          : x))
      );
      // El equipo entregado queda con la garantía habilitada.
      this.registrarEvento(id, 'Sistema', 'Equipo con garantía habilitada tras la aceptación del usuario final', 'Garantía habilitada',
        '', false, { modulo: 'Servicio de garantía', estadoAnterior: 'Pendiente de aceptación', inventario: conf.inventario, usuarioFinal: conf.usuarioFinal });
      // Aquí —y solo aquí— el equipo pasa a pertenecer a la Dirección/Unidad del requerimiento y
      // entra al inventario operativo de Controles. Antes de la firma estaba en proceso de entrega.
      this.registrarPertenencia(id);
      // Aceptación después de una inconformidad: cierra la incidencia que quedó abierta y deja
      // dicho en la trazabilidad que lo aceptado es el equipo ya corregido.
      const previa = this.correccionesDe(id).find((c) => c.intentoNumero === nIntento - 1);
      if (previa) {
        this.actualizarCorreccion(previa.id, (c) => ({ ...c, estadoIncidencia: 'CONFORMIDAD_ACEPTADA' }));
        this.registrarEvento(id, 'Sistema (formulario externo)', 'Formulario de conformidad aceptado', 'Entregado',
          `Intento #${nIntento}, tras resolver la inconformidad ${previa.id} (${previa.tipoProblema}) como ${previa.resolucion}.`,
          true, { ...this.refInconformidad(this.correccionDe(previa.id)!), intentoConformidad: nIntento,
            accionTomada: 'Aceptación tras la corrección' });
        this.actualizarCorreccion(previa.id, (c) => ({ ...c, estadoIncidencia: 'GARANTIA_HABILITADA' }));
      }
    } else {
      // NO se habilita garantía: la entrega queda observada y el proceso pendiente de corrección.
      this.setEstadoSolicitud(id, 'No conforme', 'Atender la no conformidad y reenviar el formulario de aceptación');
      this.actualizarAnexo(id, 'Formulario de conformidad', 'No conforme', observaciones || 'Inconformidad registrada');
      this.actualizarAnexo(id, 'Entrega y aceptación', 'Observada', 'Inconformidad del usuario final; pendiente de corrección');
      this.expedientesUnicos.update((list) =>
        list.map((x) => (x.expediente === id
          ? { ...x, estado: 'Pendiente de corrección', resumenEstado: 'Pendiente de corrección por inconformidad' }
          : x))
      );
      // Trazabilidad granular de la no conformidad (spec §12).
      this.registrarEvento(id, 'Sistema (formulario externo)', 'Observación de inconformidad registrada', 'No conforme',
        observaciones || 'Inconformidad sin detalle', false,
        { modulo: 'Entrega y aceptación', inventario: conf.inventario, usuarioFinal: conf.usuarioFinal,
          intentoConformidad: nIntento });
      // La incidencia queda abierta desde aquí: es lo que bloquea el cierre de la entrega y la
      // garantía hasta que alguien la clasifique y la resuelva.
      this.registrarEvento(id, 'Sistema', 'Incidencia de conformidad abierta', 'Pendiente de evaluación de la inconformidad',
        'Soporte o el Encargado debe clasificar el problema y definir si se corrige en F0302 o requiere reproceso F0288.',
        true, { modulo: 'Entrega y aceptación', inventario: conf.inventario, usuarioFinal: conf.usuarioFinal,
          intentoConformidad: nIntento, accionTomada: 'Apertura de la incidencia de conformidad' });
      this.registrarEvento(id, 'Sistema', 'Entrega observada', 'Observada',
        'La entrega no se cierra como aceptada mientras exista una inconformidad.', false,
        { modulo: 'Entrega y aceptación', estadoAnterior: 'Pendiente de aceptación', inventario: conf.inventario, usuarioFinal: conf.usuarioFinal });
      this.registrarEvento(id, 'Sistema', 'Garantía no habilitada', 'No habilitada',
        'La garantía solo inicia con la aceptación formal del usuario final.', false,
        { modulo: 'Servicio de garantía', inventario: conf.inventario, usuarioFinal: conf.usuarioFinal });
      // El equipo NO pasa a pertenecer a la Dirección/Unidad ni entra a Controles: una
      // inconformidad deja el equipo en proceso de entrega, no entregado.
      this.registrarEvento(id, 'Sistema', 'Equipo no incorporado al inventario operativo de Controles',
        'Pendiente de aceptación',
        'Solo los equipos aceptados por el usuario final pertenecen a una Dirección/Unidad y pasan a Controles.',
        false, { modulo: 'Inventario operativo de Controles', inventario: conf.inventario,
          usuarioFinal: conf.usuarioFinal, direccion: this.dirUnidadDeSolicitud(id).direccion,
          unidad: this.dirUnidadDeSolicitud(id).unidad, estadoControles: 'No incorporado' });
      this.registrarEvento(id, 'Sistema', 'Expediente único pendiente de corrección', 'Pendiente de corrección',
        'El equipo queda pendiente de revisión; el Técnico de Soporte debe atender la no conformidad.', true,
        { modulo: 'Expediente único', estadoAnterior: 'En entrega', inventario: conf.inventario,
          expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: conf.usuarioFinal });
    }
  }

  // ---------- Atención de la inconformidad ----------
  /**
   * Matriz por tipo de problema: qué resolución sugiere el sistema y con qué pregunta se decide
   * cuando el tipo por sí solo no alcanza. Es la misma idea de la matriz de fallas del F0302: lo
   * que Soporte puede corregir sobre la configuración no vuelve a Hardware; lo que toca el equipo, sí.
   */
  matrizInconformidad(tipo: TipoProblemaInconformidad): {
    sugerencia: ResolucionInconformidad | 'Depende'; pregunta: string; nota: string;
  } {
    switch (tipo) {
      case 'Problema de configuración':
      case 'Problema de software':
      case 'Problema de usuario o credenciales':
      case 'Problema de dominio':
      case 'Problema de IP reservada':
      case 'Problema con Agente DLP':
        return { sugerencia: 'Corrección F0302', pregunta: '',
          nota: 'Lo resuelve Soporte sobre la configuración: no se genera reproceso ni vuelve a Hardware.' };
      case 'Accesorio faltante':
      case 'Falla física del equipo':
      case 'Falla de disco':
      case 'Falla de memoria':
        return { sugerencia: 'Reproceso F0288', pregunta: '',
          nota: 'Toca el equipo: se atiende con un reproceso F0288 sobre el mismo Expediente técnico.' };
      case 'Problema de red':
        return { sugerencia: 'Depende', pregunta: '¿Requiere revisión física de red (puerto, cable o adaptador)?',
          nota: 'Un problema lógico de red lo corrige Soporte; uno físico lo revisa Hardware.' };
      case 'Problema de sistema operativo':
        return { sugerencia: 'Depende', pregunta: '¿Requiere reinstalación o reparación base del sistema operativo?',
          nota: 'Un ajuste del sistema se corrige en F0302; reinstalar o reparar la base es reproceso F0288.' };
      default:
        return { sugerencia: 'Corrección F0302', pregunta: '',
          nota: 'Sin tipo específico: si el problema resulta ser del equipo, justifique el reproceso F0288.' };
    }
  }

  /**
   * Resolución sugerida ya resuelta. Los dos «Depende» los decide su propia pregunta: sin
   * responderla la sugerencia queda vacía, y el sistema no se inventa una recomendación.
   */
  sugerenciaInconformidad(tipo: TipoProblemaInconformidad,
    detalle: { revisionFisicaRed?: RespuestaSiNo; reinstalacionSO?: RespuestaSiNo } = {}): ResolucionInconformidad | '' {
    const m = this.matrizInconformidad(tipo);
    if (m.sugerencia !== 'Depende') return m.sugerencia;
    const respuesta = tipo === 'Problema de red' ? detalle.revisionFisicaRed : detalle.reinstalacionSO;
    if (respuesta === 'Sí') return 'Reproceso F0288';
    if (respuesta === 'No') return 'Corrección F0302';
    return '';
  }

  /**
   * Checklist de atención de la inconformidad, según el tipo de problema. Contiene lo que hace
   * **Soporte**: cuando el caso deriva en reproceso, lo que hace Hardware vive en el Checklist de
   * Reproceso F0288, no aquí — un mismo ítem no puede pertenecer a dos responsables.
   */
  checklistInconformidad(tipo: TipoProblemaInconformidad): ItemCorreccion[] {
    const item = (nombre: string, implicaEvidencia = false): ItemCorreccion =>
      ({ nombre, estado: 'Pendiente', implicaEvidencia, nota: '' });
    switch (tipo) {
      case 'Problema de configuración':
        return [item('Revisar configuración reportada por el usuario'), item('Aplicar corrección', true),
          item('Validar funcionamiento'), item('Adjuntar evidencia, si aplica'),
          item('Registrar observación de Soporte')];
      case 'Problema de software':
        return [item('Revisar software solicitado'), item('Verificar Catálogo de Software'),
          item('Instalar o ajustar software permitido', true), item('Registrar versión instalada'),
          item('Adjuntar evidencia, si aplica')];
      case 'Problema de usuario o credenciales':
        return [item('Revisar usuario asignado'), item('Validar credenciales'), item('Corregir acceso', true),
          item('Probar inicio de sesión'), item('Adjuntar evidencia, si aplica')];
      case 'Problema de dominio':
        return [item('Revisar nombre del equipo'), item('Revisar unión a dominio'),
          item('Validar ingreso al dominio', true), item('Registrar mensaje de error, si aplica'),
          item('Adjuntar evidencia', true)];
      case 'Problema de IP reservada':
        return [item('Revisar si requiere reserva de IP'), item('Validar IP registrada'),
          item('Validar MAC del equipo'), item('Revisar solicitud simulada enviada a Servidores'),
          item('Corregir información si aplica', true)];
      case 'Problema con Agente DLP':
        // La captura es obligatoria: del estado del Agente DLP no queda rastro fuera de la pantalla.
        return [item('Revisar instalación/configuración del Agente DLP'), item('Validar estado del agente'),
          item('Adjuntar captura obligatoria', true), item('Registrar observación')];
      case 'Problema de red':
        return [item('Revisar conectividad reportada por el usuario'), item('Validar configuración lógica de red'),
          item('Verificar punto de red y adaptador'), item('Aplicar corrección, si aplica', true),
          item('Adjuntar evidencia, si aplica')];
      case 'Problema de sistema operativo':
        return [item('Revisar el sistema operativo instalado'), item('Aplicar ajuste o actualización, si aplica', true),
          item('Validar funcionamiento'), item('Registrar mensaje de error, si aplica'),
          item('Adjuntar evidencia, si aplica')];
      case 'Accesorio faltante':
        return [item('Revisar observación del Usuario Final'), item('Identificar accesorio faltante'),
          item('Registrar evidencia, si aplica'), item('Enviar a reproceso F0288')];
      case 'Falla física del equipo':
      case 'Falla de disco':
      case 'Falla de memoria':
        return [item('Revisar observación del Usuario Final'), item('Registrar evidencia, si aplica'),
          item('Enviar a reproceso F0288')];
      default:
        return [item('Revisar observación del Usuario Final'), item('Diagnosticar el problema reportado'),
          item('Aplicar corrección', true), item('Validar con el usuario final'),
          item('Adjuntar evidencia, si aplica')];
    }
  }

  /**
   * Pasos que le tocan a Hardware cuando la inconformidad deriva en reproceso. No son un checklist
   * que alguien marque a mano: se leen del estado real del reproceso, para que la pantalla de
   * Soporte muestre en qué va sin poder adelantarlo.
   */
  pasosReprocesoInconformidad(cor: CorreccionNoConformidad): { nombre: string; hecho: boolean }[] {
    const r = this.reprocesoDeCorreccion(cor);
    return [
      { nombre: 'Reproceso F0288 generado sobre el Expediente técnico', hecho: !!r },
      { nombre: 'Encargado asigna Técnico de Hardware', hecho: !!r?.tecnicoAsignado },
      { nombre: 'Hardware completa el Checklist de Reproceso F0288', hecho: r?.estado === 'Finalizado' || !!r?.firma },
      { nombre: 'Hardware firma el reproceso', hecho: !!r?.firma }
    ];
  }

  /** Equivalencia con el tipo de falla del F0302: el reproceso ya sabe qué checklist usar para cada uno. */
  private tipoFallaEquivalente(tipo: TipoProblemaInconformidad): TipoFallaF0302 {
    switch (tipo) {
      case 'Accesorio faltante': return 'Accesorio faltante';
      case 'Falla física del equipo': return 'Falla física del equipo';
      case 'Falla de disco': return 'Falla de disco';
      case 'Falla de memoria': return 'Falla de memoria';
      case 'Problema de sistema operativo': return 'Problema de sistema operativo';
      case 'Problema de red': return 'Problema de red';
      case 'Problema de dominio': return 'No permite ingreso a dominio';
      default: return 'Otro';
    }
  }

  /** Datos de referencia comunes a los eventos de una inconformidad. */
  private refInconformidad(cor: CorreccionNoConformidad): Partial<EventoTrazabilidad> {
    return {
      modulo: 'Entrega y aceptación', inventario: cor.inventario,
      expedienteUnico: this.expedienteUnicoDe(cor.expediente)?.codigoUnico,
      expedienteTecnico: this.expTecnicoDeEquipo(cor.inventario)?.codigo,
      usuarioFinal: cor.usuarioFinal, correccion: cor.id, intentoConformidad: cor.intentoNumero,
      tipoProblema: cor.tipoProblema, resolucion: cor.resolucion,
      reproceso: cor.reprocesoId, firmaRegistrada: cor.firma ? 'Sí' : 'No'
    };
  }

  /**
   * Estado de la incidencia de conformidad del proceso, derivado de lo que realmente pasó: del
   * último intento mientras nadie la atiende, de la corrección cuando ya se atiende, y del cierre
   * cuando el usuario final aceptó.
   */
  estadoIncidenciaConformidad(id: string): EstadoIncidenciaConformidad | '' {
    const ultimo = this.ultimoIntento(id);
    if (!ultimo) return '';
    if (ultimo.resultado === 'Aceptado') {
      return this.garantiaDe(id) ? 'GARANTIA_HABILITADA' : 'CONFORMIDAD_ACEPTADA';
    }
    if (ultimo.resultado === 'Pendiente de firma') {
      return ultimo.numero > 1 ? 'FORMULARIO_CONFORMIDAD_REENVIADO' : '';
    }
    const cor = this.correccionesDe(id).find((c) => c.intentoNumero === ultimo.numero);
    return cor?.estadoIncidencia ?? 'PENDIENTE_EVALUACION_INCONFORMIDAD';
  }

  /** Texto legible del estado de la incidencia de conformidad, para no mostrar la jerga del código. */
  textoEstadoIncidenciaConformidad(estado: EstadoIncidenciaConformidad | ''): string {
    switch (estado) {
      case 'CONFORMIDAD_NO_ACEPTADA': return 'Conformidad no aceptada';
      case 'INCIDENCIA_CONFORMIDAD_REGISTRADA': return 'Incidencia de conformidad registrada';
      case 'PENDIENTE_EVALUACION_INCONFORMIDAD': return 'Pendiente de evaluación de la inconformidad';
      case 'CORRECCION_F0302_REQUERIDA': return 'Corrección F0302 requerida';
      case 'CORRECCION_F0302_EN_PROCESO': return 'Corrección F0302 en proceso';
      case 'CORRECCION_F0302_FINALIZADA': return 'Corrección F0302 finalizada';
      case 'CORRECCION_F0302_FIRMADA': return 'Corrección F0302 firmada';
      case 'REPROCESO_F0288_REQUERIDO': return 'Reproceso F0288 requerido';
      case 'REPROCESO_F0288_PENDIENTE_ASIGNACION': return 'Reproceso F0288 pendiente de asignación';
      case 'REPROCESO_F0288_ASIGNADO': return 'Reproceso F0288 asignado';
      case 'REPROCESO_F0288_FINALIZADO': return 'Reproceso F0288 finalizado';
      case 'REPROCESO_F0288_FIRMADO': return 'Reproceso F0288 firmado';
      case 'LISTO_PARA_REENVIO_CONFORMIDAD': return 'Listo para reenviar el formulario de conformidad';
      case 'FORMULARIO_CONFORMIDAD_REENVIADO': return 'Formulario de conformidad reenviado';
      case 'CONFORMIDAD_ACEPTADA': return 'Conformidad aceptada';
      case 'GARANTIA_HABILITADA': return 'Garantía habilitada';
      default: return 'Pendiente de corrección';
    }
  }

  private actualizarCorreccion(idCorreccion: string, cambio: (c: CorreccionNoConformidad) => CorreccionNoConformidad): void {
    this.correcciones.update((list) => list.map((c) => (c.id === idCorreccion ? cambio(c) : c)));
  }

  /** La corrección de inconformidad indicada. */
  correccionDe(idCorreccion: string): CorreccionNoConformidad | undefined {
    return this.correcciones().find((c) => c.id === idCorreccion);
  }

  /**
   * Soporte atiende la inconformidad: clasifica el problema y define si se resuelve corrigiendo la
   * configuración (F0302) o si hay que devolver el equipo a Hardware con un reproceso F0288. No se
   * crea un Expediente técnico principal nuevo en ninguno de los dos casos, ni se descarga el
   * equipo —nunca fue aceptado— ni se reinician contadores.
   */
  atenderInconformidad(id: string, datos: {
    tipoProblema: TipoProblemaInconformidad | ''; resolucion: ResolucionInconformidad | '';
    justificacionResolucion?: string; revisionFisicaRed?: RespuestaSiNo; reinstalacionSO?: RespuestaSiNo;
  }, tecnico: string): CorreccionNoConformidad | string {
    const ultimo = this.ultimoIntento(id);
    if (!ultimo || ultimo.resultado !== 'No conforme') return 'No hay una inconformidad vigente que atender en este proceso.';
    if (this.correccionActivaDe(id)) return 'Ya existe una atención en curso para esta inconformidad.';
    if (!datos.tipoProblema) return 'Clasifique el tipo de problema reportado por el Usuario Final.';
    const matriz = this.matrizInconformidad(datos.tipoProblema);
    const sugerencia = this.sugerenciaInconformidad(datos.tipoProblema, datos);
    if (!sugerencia) return `Responda: ${matriz.pregunta}`;
    if (!datos.resolucion) return 'Defina si la inconformidad se resuelve con corrección F0302 o con reproceso F0288.';
    const justificacion = (datos.justificacionResolucion ?? '').trim();
    // Apartarse de la sugerencia se puede, pero con motivo: es la diferencia entre una decisión
    // técnica y saltarse la clasificación.
    if (datos.resolucion !== sugerencia && !justificacion) {
      return `La clasificación sugiere «${sugerencia}». Justifique por qué se resuelve como «${datos.resolucion}».`;
    }
    // Un solo reproceso abierto por Expediente técnico: dos correcciones simultáneas sobre la misma
    // preparación se pisarían y el historial no diría cuál dejó el equipo como está.
    if (datos.resolucion === 'Reproceso F0288') {
      const codigoTec = this.expTecnicoDeEquipo(ultimo.inventario)?.codigo;
      const abierto = codigoTec ? this.reprocesoAbiertoDeExpTecnico(codigoTec) : undefined;
      if (abierto) {
        return `Ya existe un reproceso abierto para este expediente (${abierto.id}, ${abierto.estado}). Debe cerrarse antes de generar uno nuevo.`;
      }
    }
    const esReproceso = datos.resolucion === 'Reproceso F0288';
    const cor: CorreccionNoConformidad = {
      id: this.siguienteCodigoPorAnio(`COR-F0302-${this.anioActual()}-`, this.correcciones().map((c) => c.id)),
      expediente: id, inventario: ultimo.inventario, intentoNumero: ultimo.numero,
      tipoProblema: datos.tipoProblema, resolucion: datos.resolucion, sugerencia,
      justificacionResolucion: justificacion,
      revisionFisicaRed: datos.revisionFisicaRed ?? '', reinstalacionSO: datos.reinstalacionSO ?? '',
      tecnico, observacionUsuario: ultimo.observacion, usuarioFinal: ultimo.usuarioFinal,
      fechaInicio: this.hoy(), horaInicio: this.hora(), fechaFin: '', horaFin: '',
      cronometro: esReproceso ? undefined : {
        fechaInicio: this.hoy(), horaInicio: this.horaCrono(), iniciadoPor: tecnico,
        fechaFin: '', horaFin: '', finalizadoPor: '', duracionMinutos: null
      },
      checklist: this.checklistInconformidad(datos.tipoProblema),
      evidencias: [], descripcion: '', huboComplejidad: '', detalleComplejidad: '', observacionTecnica: '',
      resultado: '', firma: undefined, reprocesoId: undefined,
      estadoIncidencia: esReproceso ? 'REPROCESO_F0288_REQUERIDO' : 'CORRECCION_F0302_REQUERIDA',
      estado: esReproceso ? 'Derivada a reproceso F0288' : 'Iniciada'
    };
    this.correcciones.update((list) => [...list, cor]);
    this.registrarEvento(id, tecnico, 'Incidencia de conformidad registrada', 'Inconformidad en atención',
      `${cor.id} — intento de conformidad #${cor.intentoNumero}: ${cor.observacionUsuario}`, true,
      { ...this.refInconformidad(cor), accionTomada: 'Atención de la inconformidad' });
    this.registrarEvento(id, tecnico, 'Tipo de problema de inconformidad seleccionado', 'Inconformidad clasificada',
      `${cor.tipoProblema}. ${matriz.nota}`, false,
      { ...this.refInconformidad(cor), accionTomada: 'Clasificación del problema' });
    this.registrarEvento(id, tecnico, `Resolución definida como ${cor.resolucion}`,
      esReproceso ? 'Reproceso F0288 requerido' : 'Corrección F0302 requerida',
      justificacion
        ? `Sugerencia del sistema: ${sugerencia}. Justificación de la excepción: ${justificacion}`
        : `Coincide con la sugerencia del sistema (${sugerencia}).`,
      true, { ...this.refInconformidad(cor), justificacion, accionTomada: `Resolución: ${cor.resolucion}` });

    if (esReproceso) {
      const r = this.abrirReprocesoPorInconformidad(cor, tecnico);
      this.actualizarCorreccion(cor.id, (c) => ({
        ...c, reprocesoId: r.id, estadoIncidencia: 'REPROCESO_F0288_PENDIENTE_ASIGNACION'
      }));
      const conReproceso = this.correccionDe(cor.id)!;
      this.setEstadoSolicitud(id, 'Reproceso F0288 por inconformidad',
        'Asignación del reproceso F0288 por un Encargado');
      this.registrarEvento(id, tecnico, 'Reproceso F0288 generado por inconformidad',
        'Reproceso F0288 pendiente de asignación',
        `${r.id} — reproceso #${r.numero} sobre el Expediente técnico ${r.expedienteTecnico}. No se crea un Expediente técnico nuevo por la inconformidad.`,
        true, { ...this.refInconformidad(conReproceso), tecnicoHardware: 'Sin asignar',
          origenReproceso: 'Inconformidad del usuario final',
          accionTomada: 'Reproceso F0288 dentro del mismo Expediente técnico' });
      this.registrarEvento(id, tecnico, 'Reproceso pendiente de asignación por Encargado',
        'Reproceso F0288 pendiente de asignación',
        'Solo un Encargado puede asignarlo a un Técnico de Hardware.', true,
        { ...this.refInconformidad(conReproceso), origenReproceso: 'Inconformidad del usuario final',
          accionTomada: 'Pendiente de asignación por Encargado' });
      return conReproceso;
    }
    this.actualizarCorreccion(cor.id, (c) => ({ ...c, estadoIncidencia: 'CORRECCION_F0302_EN_PROCESO' }));
    this.setEstadoSolicitud(id, 'Corrección F0302 por inconformidad', 'Registrar y firmar la corrección F0302');
    this.registrarEvento(id, tecnico, 'Corrección F0302 iniciada', 'Corrección F0302 en proceso',
      `${cor.id} — checklist de «${cor.tipoProblema}». No se crea un nuevo Expediente técnico.`, true,
      { ...this.refInconformidad(cor), accionTomada: 'Inicio de la corrección F0302' });
    return this.correccionDe(cor.id)!;
  }

  /**
   * Abre el reproceso F0288 de una inconformidad sobre el Expediente técnico que el equipo ya
   * tiene. Es el mismo mecanismo de las fallas de F0302 —código derivado `…-R1`, sin dueño hasta
   * que un Encargado lo asigne—: lo único que cambia es de dónde vino el problema.
   */
  private abrirReprocesoPorInconformidad(cor: CorreccionNoConformidad, usuario: string): ReprocesoF0288 {
    const tecnico = this.expTecnicoDeEquipo(cor.inventario)?.codigo ?? cor.inventario;
    const numero = Math.max(0, ...this.reprocesosDeExpTecnico(tecnico).map((r) => r.numero)) + 1;
    const tipoFalla = this.tipoFallaEquivalente(cor.tipoProblema);
    const reproceso: ReprocesoF0288 = {
      id: `${tecnico}-R${numero}`, expedienteTecnico: tecnico, expediente: cor.expediente,
      expedienteUnico: this.expedienteUnicoDe(cor.expediente)?.codigoUnico ?? '',
      inventario: cor.inventario, numero,
      origen: 'Inconformidad del usuario final', correccionRelacionada: cor.id,
      intentoConformidad: cor.intentoNumero, usuarioFinal: cor.usuarioFinal,
      observacionUsuarioFinal: cor.observacionUsuario,
      tipoFalla, motivo: `Inconformidad del usuario final — ${cor.tipoProblema}: ${cor.observacionUsuario}`,
      // El equipo ya está con el usuario final: un reproceso por inconformidad no espera turno.
      prioridad: 'Alta',
      unidadAtiende: 'Hardware', justificacionUnidad: '',
      solicitadoPor: usuario, observacionSoporte: cor.observacionUsuario, evidenciaSoporte: '',
      fechaSolicitud: this.hoy(), horaSolicitud: this.hora(),
      tecnicoAsignado: '', asignadoPor: '', fechaAsignacion: '', horaAsignacion: '',
      justificacionReprocesoSimultaneo: '',
      atendidoPor: '', fechaInicio: '', fechaFin: '', cronometro: undefined,
      tipoProblema: this.tipoProblemaDeFalla(tipoFalla),
      checklist: this.checklistReproceso(this.tipoProblemaDeFalla(tipoFalla)), evidencias: [], correccionTecnica: '',
      observaciones: '', firma: undefined, resultado: '', observacionResultado: '',
      estado: 'Pendiente de asignación'
    };
    this.reprocesos.update((list) => [reproceso, ...list]);
    return reproceso;
  }

  /** Marca un ítem del checklist de la corrección. Solo mientras la corrección está abierta. */
  marcarItemCorreccion(idCorreccion: string, nombreItem: string, estado: ItemCorreccion['estado'], nota = ''): string | null {
    const cor = this.correccionDe(idCorreccion);
    if (!cor) return 'No se encontró la corrección indicada.';
    if (cor.estado !== 'Iniciada') return 'La corrección ya no admite cambios en su checklist.';
    this.actualizarCorreccion(idCorreccion, (c) => ({
      ...c, checklist: c.checklist.map((i) => (i.nombre === nombreItem ? { ...i, estado, nota: nota || i.nota } : i))
    }));
    return null;
  }

  /**
   * Adjunta una imagen de evidencia a la corrección. La imagen se guarda en el almacén común de
   * evidencias; la fila de `EvidenciaCorreccion` se conserva porque la constancia de corrección la
   * imprime y hay correcciones anteriores que solo tienen esa fila.
   */
  agregarEvidenciaCorreccion(idCorreccion: string, archivo: string, tipo: string, usuario: string,
    imagen = '', item = ''): string | null {
    const cor = this.correccionDe(idCorreccion);
    if (!cor) return 'No se encontró la corrección indicada.';
    if (cor.estado !== 'Iniciada') return 'La corrección ya no admite nuevas evidencias.';
    const error = this.adjuntarEvidencia({
      modulo: 'Corrección F0302', proceso: cor.id, expediente: cor.expediente,
      inventario: cor.inventario, archivo, tipo, usuario, imagen, item
    });
    if (error) return error;
    const evidencia: EvidenciaCorreccion = {
      archivo: archivo.trim(), tipo: tipo.trim(),
      fecha: this.hoy(), hora: this.hora(), cargadaPor: usuario,
      correccion: cor.id, expediente: cor.expediente, item: item.trim() || undefined
    };
    this.actualizarCorreccion(idCorreccion, (c) => ({ ...c, evidencias: [...c.evidencias, evidencia] }));
    return null;
  }

  /** Quita una imagen de la corrección, de las dos listas a la vez. */
  eliminarEvidenciaCorreccion(idCorreccion: string, archivo: string, usuario: string): string | null {
    const cor = this.correccionDe(idCorreccion);
    if (!cor) return 'No se encontró la corrección indicada.';
    if (cor.estado !== 'Iniciada') return 'La corrección ya no admite cambios en sus evidencias.';
    const error = this.eliminarEvidencia('Corrección F0302', cor.id, cor.expediente, archivo, usuario);
    if (error) return error;
    this.actualizarCorreccion(idCorreccion, (c) => ({
      ...c, evidencias: c.evidencias.filter((e) => e.archivo !== archivo)
    }));
    return null;
  }

  /**
   * ¿Esta corrección exige evidencia? Desde la regla global, siempre: toda corrección de Soporte
   * debe quedar respaldada con una imagen. Antes solo la exigía si se había marcado un ítem que
   * produjera algo que adjuntar.
   */
  correccionExigeEvidencia(_cor: CorreccionNoConformidad): boolean {
    return true;
  }

  /**
   * Durante la corrección se descubre que el problema es del equipo: la inconformidad pasa a
   * reproceso F0288 sin volver a empezar y sin crear un Expediente técnico nuevo.
   */
  escalarAReprocesoF0288(idCorreccion: string, usuario: string, motivo: string): string | null {
    const cor = this.correccionDe(idCorreccion);
    if (!cor) return 'No se encontró la corrección indicada.';
    if (cor.estado !== 'Iniciada') return 'Solo una corrección en curso puede derivarse a reproceso F0288.';
    if (!motivo.trim()) return 'Indique por qué la corrección requiere intervención de Hardware.';
    const codigoTec = this.expTecnicoDeEquipo(cor.inventario)?.codigo;
    const abierto = codigoTec ? this.reprocesoAbiertoDeExpTecnico(codigoTec) : undefined;
    if (abierto) {
      return `Ya existe un reproceso abierto para este expediente (${abierto.id}, ${abierto.estado}). Debe cerrarse antes de generar uno nuevo.`;
    }
    const crono = cor.cronometro ? this.detenerCronometro(cor.cronometro, usuario) : undefined;
    this.actualizarCorreccion(idCorreccion, (c) => ({
      ...c, resolucion: 'Reproceso F0288', justificacionResolucion: motivo.trim(),
      cronometro: crono, estado: 'Derivada a reproceso F0288', estadoIncidencia: 'REPROCESO_F0288_REQUERIDO'
    }));
    const derivada = this.correccionDe(idCorreccion)!;
    const r = this.abrirReprocesoPorInconformidad(derivada, usuario);
    this.actualizarCorreccion(idCorreccion, (c) => ({
      ...c, reprocesoId: r.id, estadoIncidencia: 'REPROCESO_F0288_PENDIENTE_ASIGNACION'
    }));
    const conReproceso = this.correccionDe(idCorreccion)!;
    this.setEstadoSolicitud(cor.expediente, 'Reproceso F0288 por inconformidad',
      'Asignación del reproceso F0288 por un Encargado');
    this.registrarEvento(cor.expediente, usuario, 'Resolución definida como Reproceso F0288',
      'Reproceso F0288 requerido', `Durante la corrección ${cor.id}: ${motivo.trim()}`, true,
      { ...this.refInconformidad(conReproceso), justificacion: motivo.trim(),
        accionTomada: 'Escalamiento de la corrección F0302 a reproceso F0288' });
    this.registrarEvento(cor.expediente, usuario, 'Reproceso F0288 generado por inconformidad',
      'Reproceso F0288 pendiente de asignación',
      `${r.id} — reproceso #${r.numero} sobre el Expediente técnico ${r.expedienteTecnico}.`, true,
      { ...this.refInconformidad(conReproceso), origenReproceso: 'Inconformidad del usuario final',
        tecnicoHardware: 'Sin asignar', accionTomada: 'Reproceso F0288 dentro del mismo Expediente técnico' });
    return null;
  }

  /**
   * Finaliza el trabajo de la corrección F0302: detiene el cronómetro y guarda el tiempo trabajado.
   * Exige el checklist resuelto, la descripción y la evidencia cuando hubo intervención. No la
   * cierra: el cierre es la firma del Técnico de Soporte.
   */
  finalizarCorreccionF0302(idCorreccion: string, datos: {
    descripcion: string; huboComplejidad: RespuestaSiNo; detalleComplejidad: string; observacionTecnica: string;
  }, usuario = ''): string | null {
    const cor = this.correccionDe(idCorreccion);
    if (!cor) return 'No se encontró la corrección indicada.';
    if (cor.estado === 'Derivada a reproceso F0288' || cor.estado === 'Cerrada por reproceso F0288') {
      return 'Esta inconformidad se atiende con un reproceso F0288: la cierra el Técnico de Hardware.';
    }
    if (cor.estado !== 'Iniciada') return 'Esta corrección ya fue finalizada.';
    if (cor.checklist.some((i) => i.estado === 'Pendiente')) {
      return 'Complete el checklist de la corrección antes de finalizarla.';
    }
    if (!datos.descripcion.trim()) return 'Describa la corrección realizada.';
    const quienIntenta = usuario || cor.tecnico;
    const sinImagen = this.exigirEvidencia('Corrección F0302', cor.id, cor.expediente, quienIntenta, cor.inventario);
    if (sinImagen) return sinImagen;
    if (datos.huboComplejidad === '') return 'Indique si hubo complejidad en la corrección.';
    if (datos.huboComplejidad === 'Sí' && !datos.detalleComplejidad.trim()) return 'Detalle la complejidad de la corrección.';
    const quien = usuario || cor.tecnico;
    const crono = cor.cronometro ? this.detenerCronometro(cor.cronometro, quien) : undefined;
    this.actualizarCorreccion(idCorreccion, (c) => ({
      ...c, estado: 'Finalizada', estadoIncidencia: 'CORRECCION_F0302_FINALIZADA',
      fechaFin: this.hoy(), horaFin: this.hora(), cronometro: crono,
      descripcion: datos.descripcion.trim(), huboComplejidad: datos.huboComplejidad,
      detalleComplejidad: datos.detalleComplejidad.trim(), observacionTecnica: datos.observacionTecnica.trim()
    }));
    const fin = this.correccionDe(idCorreccion)!;
    this.actualizarAnexo(cor.expediente, 'Configuración F0302', 'Corrección registrada',
      `${cor.tipoProblema}: ${datos.descripcion.trim()}`);
    this.registrarEvento(cor.expediente, quien, 'Corrección F0302 finalizada', 'Corrección F0302 finalizada',
      datos.descripcion.trim(), true,
      { ...this.refInconformidad(fin), tiempo: this.formatoDuracion(crono?.duracionMinutos ?? null) || 'menos de 1 min',
        complejidad: datos.huboComplejidad === 'Sí' ? 'Con complejidad' : 'Sin complejidad',
        accionTomada: 'Corrección F0302 registrada' });
    this.registrarCierreConEvidencia('Corrección F0302', cor.id, cor.expediente, quien, cor.inventario);
    return null;
  }

  /**
   * Firma del Técnico de Soporte: es lo que cierra la corrección. Sin ella la corrección queda
   * finalizada pero sin responsable, y el formulario de conformidad no puede reenviarse.
   */
  firmarCorreccionF0302(idCorreccion: string, usuario: string, firmaSimulada = ''): string | null {
    const cor = this.correccionDe(idCorreccion);
    if (!cor) return 'No se encontró la corrección indicada.';
    if (cor.estado === 'Iniciada') return 'Finalice la corrección F0302 antes de firmarla.';
    if (cor.estado !== 'Finalizada') return 'Esta corrección ya fue firmada.';
    const firmante = (firmaSimulada || usuario).trim();
    if (!firmante) return 'Debe registrar la firma del Técnico de Soporte para finalizar la corrección.';
    const u = this.usuarios().find((x) => firmante.startsWith(x.nombre));
    const firma: FirmaCorreccion = {
      nombre: u?.nombre ?? firmante.split('—')[0].trim(),
      cargo: u?.rol ?? firmante.split('—')[1]?.trim() ?? 'Técnico de Soporte',
      unidad: u?.unidad ?? 'Soporte',
      fecha: this.hoy(), hora: this.hora(),
      firma: `Firmado electrónicamente (simulado) por ${firmante}`
    };
    this.actualizarCorreccion(idCorreccion, (c) => ({
      ...c, firma, estado: 'Firmada', estadoIncidencia: 'LISTO_PARA_REENVIO_CONFORMIDAD',
      resultado: 'Corregido en F0302'
    }));
    const firmada = this.correccionDe(idCorreccion)!;
    // La constancia se genera aquí, al firmar: un documento que dependiera de que alguien pulse
    // «Descargar» dejaría correcciones firmadas sin respaldo que consultar después.
    this.registrarConstanciaCorreccion(idCorreccion, usuario);
    this.registrarEvento(cor.expediente, usuario, 'Firma de Técnico de Soporte registrada', 'Corrección F0302 firmada',
      `${firma.nombre} — ${firma.cargo} (${firma.unidad}) · ${firma.fecha} ${firma.hora}`, true,
      { ...this.refInconformidad(firmada), firmaRegistrada: 'Sí', accionTomada: 'Firma de la corrección F0302' });
    this.setEstadoSolicitud(cor.expediente, 'Pendiente de reenvío del formulario de conformidad',
      'Reenviar el formulario de conformidad al usuario final');
    return null;
  }

  /**
   * Cierra la inconformidad cuando su reproceso F0288 se firma. Solo «Corregido» habilita el
   * reenvío del formulario: con cualquier otro resultado el caso queda en manos del Encargado.
   */
  private cerrarCorreccionPorReproceso(cor: CorreccionNoConformidad, r: ReprocesoF0288, usuario: string): void {
    const corregido = r.resultado === 'Corregido';
    this.actualizarCorreccion(cor.id, (c) => ({
      ...c, fechaFin: this.hoy(), horaFin: this.hora(),
      resultado: corregido ? 'Corregido con reproceso F0288' : 'No corregido',
      descripcion: c.descripcion || r.correccionTecnica,
      estado: corregido ? 'Cerrada por reproceso F0288' : c.estado,
      estadoIncidencia: corregido ? 'LISTO_PARA_REENVIO_CONFORMIDAD' : 'REPROCESO_F0288_FINALIZADO'
    }));
    const cerrada = this.correccionDe(cor.id)!;
    this.registrarEvento(cor.expediente, usuario, 'Reproceso F0288 finalizado y firmado',
      corregido ? 'Listo para reenviar el formulario de conformidad' : 'Pendiente de evaluación del Encargado',
      `${r.id} — resultado: ${r.resultado}. Inconformidad ${cor.id} del intento #${cor.intentoNumero}.`, true,
      { ...this.refInconformidad(cerrada), origenReproceso: 'Inconformidad del usuario final',
        tecnicoHardware: r.tecnicoAsignado || r.atendidoPor, resultadoReproceso: r.resultado || 'Pendiente',
        firmaRegistrada: 'Sí', accionTomada: corregido ? 'Cierre de la inconformidad por reproceso F0288' : 'Evaluación del Encargado' });
    if (corregido) {
      this.setEstadoSolicitud(cor.expediente, 'Pendiente de reenvío del formulario de conformidad',
        'Reenviar el formulario de conformidad al usuario final');
    }
  }

  /**
   * Reenvía el formulario de conformidad tras resolver la inconformidad: crea un NUEVO intento
   * (Pendiente de firma) con un token nuevo, sin sobrescribir los anteriores. Exige que la
   * corrección F0302 esté firmada por Soporte o que el reproceso F0288 esté firmado por Hardware.
   * Devuelve la conformidad reenviada o un mensaje de validación.
   */
  reenviarFormularioAceptacion(id: string, usuario: string): Conformidad | string {
    if (this.estadoAceptacion(id) !== 'No conforme') return 'No hay una inconformidad vigente para reenviar el formulario.';
    const cor = this.correccionListaParaReenvio(id);
    if (!cor) {
      const abierta = this.correccionActivaDe(id);
      if (abierta?.estado === 'Derivada a reproceso F0288') {
        return 'El reproceso F0288 debe estar finalizado y firmado antes de reenviar el formulario de conformidad.';
      }
      if (abierta?.estado === 'Finalizada') {
        return 'Debe registrar la firma del Técnico de Soporte para finalizar la corrección.';
      }
      return 'Debe resolver la inconformidad y firmarla antes de reenviar el formulario de conformidad.';
    }
    // La corrección que se le va a mostrar al usuario final debe tener respaldo visual. Si la
    // resolvió Hardware, la imagen es la del reproceso; si la resolvió Soporte, la de la corrección.
    const conImagen = cor.reprocesoId
      ? (this.reprocesoDe(cor.reprocesoId)?.evidencias.length ?? 0) > 0
      : this.evid.hay('Corrección F0302', cor.id);
    if (!conImagen) {
      return 'Debe adjuntar evidencia visual de la corrección antes de reenviar el formulario de conformidad.';
    }
    const conf = this.conformidadDeProceso(id);
    const s = this.solicitud(id);
    if (!conf || !s) return 'No se encontró el formulario de conformidad de este proceso.';
    const vence = new Date();
    vence.setDate(vence.getDate() + 7);
    const nuevoToken = `CONF-${this.anioActual()}-${id.slice(-4)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    // Se reutiliza la conformidad del proceso con un token nuevo y estado pendiente (el historial
    // del intento No conforme ya quedó guardado en `intentos`).
    this.conformidades.update((list) =>
      list.map((x) => (x.expediente === id
        ? { ...x, token: nuevoToken, estado: 'Pendiente de respuesta', fechaEnvio: new Date().toISOString(),
            vence: vence.toISOString().slice(0, 10), fechaRespuesta: '', aceptaTerminos: false, respuesta: '',
            observaciones: '', firmaUsuarioFinal: undefined }
        : x))
    );
    this.entregas.update((list) =>
      list.map((e) => (e.expediente === id ? { ...e, conformidadToken: nuevoToken, estado: 'Pendiente de respuesta' } : e))
    );
    this.expedientesUnicos.update((list) =>
      list.map((x) => (x.expediente === id
        ? { ...x, estado: 'En entrega', resumenEstado: 'Corrección realizada · pendiente de firma' }
        : x))
    );
    this.setEstadoSolicitud(id, 'Pendiente de aceptación', 'Respuesta del formulario de conformidad reenviado');
    this.actualizarAnexo(id, 'Formulario de conformidad', 'Pendiente de respuesta', 'Formulario reenviado tras resolver la inconformidad');
    this.actualizarCorreccion(cor.id, (c) => ({ ...c, estadoIncidencia: 'FORMULARIO_CONFORMIDAD_REENVIADO' }));
    this.registrarEvento(id, usuario, 'Formulario de conformidad reenviado', 'Pendiente de aceptación',
      `${cor.id} (${cor.tipoProblema}) resuelta como ${cor.resolucion}` +
        (cor.reprocesoId ? ` con el reproceso ${cor.reprocesoId}` : '') +
        `. Enlace único ${nuevoToken}.`, true,
      { ...this.refInconformidad(this.correccionDe(cor.id)!), estadoAnterior: 'No conforme',
        accionTomada: 'Reenvío del formulario de conformidad' });
    const confActualizada = this.conformidadDeProceso(id)!;
    this.crearIntentoAceptacion(id, confActualizada, cor);
    return confActualizada;
  }

  // ---------- Vigencia de la garantía: proveedor vs. responsabilidad interna ----------
  /** Duración sugerida de la garantía del proveedor de un equipo nuevo, en años. */
  readonly ANIOS_GARANTIA_PROVEEDOR = 3;
  /** Umbral en días a partir del cual la garantía del proveedor se muestra «por vencer». */
  private readonly DIAS_POR_VENCER = 60;

  readonly MSG_SIN_FECHA_ADQUISICION =
    'No se encontró fecha de adquisición del equipo. El Encargado de Soporte debe registrar o confirmar la fecha para calcular la garantía del proveedor.';
  /**
   * Mensaje excepcional: un equipo nuevo llegó sin fecha de adquisición. No se le pide al Encargado
   * que la invente en la garantía; se le dice dónde está el problema, que es el registro de origen.
   */
  readonly MSG_DATOS_INSTITUCIONALES =
    'La base institucional no devolvió fecha de adquisición para este equipo. Revise los datos del inventario institucional.';
  readonly MSG_PROVEEDOR_VENCIDA_USADO =
    'La garantía del proveedor de este equipo ya venció. El Encargado de Soporte debe establecer la responsabilidad interna de Soporte para poder atender casos.';
  readonly MSG_VENCIMIENTO_MENOR =
    'La fecha de vencimiento no puede ser menor que la fecha de inicio.';
  readonly MSG_MOTIVO_GARANTIA =
    'Debe ingresar un motivo para modificar la garantía.';
  readonly MSG_GARANTIA_DESDE_ADQUISICION =
    'La garantía del proveedor debe calcularse desde la fecha de adquisición del equipo.';
  readonly MSG_PROVEEDOR_VENCIDA =
    'La garantía de proveedor se encuentra vencida. El Encargado de Soporte puede autorizar atención por responsabilidad interna.';

  /** Suma años a una fecha `YYYY-MM-DD` sin arrastrar la zona horaria del navegador. */
  private sumarAnios(fecha: string, anios: number): string {
    if (!fecha) return '';
    const [a, m, d] = fecha.slice(0, 10).split('-').map(Number);
    if (!a || !m || !d) return '';
    return new Date(Date.UTC(a + anios, m - 1, d)).toISOString().slice(0, 10);
  }

  /**
   * Fecha desde la que corre la garantía del proveedor: la de adquisición, o la de recepción
   * institucional si el equipo se compró sin registrarse la compra. **Nunca la de aceptación** —
   * ese es exactamente el error que esta regla corrige. '' cuando ninguna consta.
   */
  fechaAdquisicionDe(inventario: string): string {
    const eq = this.equipoDe(inventario);
    if (!eq) return '';
    return eq.fechaAdquisicion || eq.fechaRecepcionInstitucional || '';
  }

  /** ¿El equipo es nuevo? Solo los nuevos llevan garantía de proveedor. */
  private equipoEsNuevo(inventario: string): boolean {
    return this.equipoDe(inventario)?.condicion === 'Nuevo';
  }

  /** ¿La garantía del proveedor de ese equipo ya se agotó a día de hoy? */
  garantiaProveedorAgotada(adquisicion: string): boolean {
    if (!adquisicion) return false;
    const fin = this.sumarAnios(adquisicion, this.ANIOS_GARANTIA_PROVEEDOR);
    return new Date(`${fin}T23:59:59Z`).getTime() < Date.now();
  }

  /**
   * Qué garantía corresponde a un equipo y con qué fechas. La condición del equipo no decide sola:
   * lo que decide es **si el proveedor todavía responde**, y eso se sabe por la fecha de
   * adquisición. Un equipo usado comprado hace un año sigue teniendo garantía de proveedor; uno
   * comprado hace cinco, no.
   *
   *  - con fecha de adquisición y dentro de los tres años → garantía de proveedor;
   *  - con fecha de adquisición y fuera de los tres años → sin garantía de proveedor, con la
   *    vigencia agotada a la vista y pendiente de que el Encargado fije la responsabilidad interna;
   *  - usado sin fecha de adquisición → responsabilidad interna desde la aceptación;
   *  - nuevo sin fecha de adquisición → error de datos institucionales, sin fechas inventadas.
   */
  garantiaPropuesta(inventario: string, fechaAceptacion: string): {
    tipo: TipoGarantia; fechaAdquisicion: string;
    inicioProveedor: string; vencimientoProveedor: string;
    inicioInterna: string; vencimientoInterna: string; nota: string;
  } {
    const adquisicion = this.fechaAdquisicionDe(inventario);
    const nuevo = this.equipoEsNuevo(inventario);

    if (!adquisicion) {
      if (nuevo) {
        // Un equipo nuevo sin fecha de adquisición no es un paso del flujo: la base institucional
        // siempre la trae. Se nombra como el error de datos que es, en vez de pedirle al Encargado
        // que teclee una fecha que no le consta.
        return {
          tipo: 'Garantía de proveedor', fechaAdquisicion: '',
          inicioProveedor: '', vencimientoProveedor: '', inicioInterna: '', vencimientoInterna: '',
          nota: this.MSG_DATOS_INSTITUCIONALES
        };
      }
      return {
        tipo: 'Responsabilidad interna de Soporte', fechaAdquisicion: '',
        inicioProveedor: '', vencimientoProveedor: '',
        inicioInterna: fechaAceptacion, vencimientoInterna: this.finDeAnioDe(fechaAceptacion),
        nota: 'Equipo usado sin fecha de adquisición en el registro institucional: no hay garantía de proveedor que reclamar. La responsabilidad interna de Soporte inicia con la aceptación y su vencimiento lo define el Encargado de Soporte.'
      };
    }

    const vencimiento = this.sumarAnios(adquisicion, this.ANIOS_GARANTIA_PROVEEDOR);
    if (!this.garantiaProveedorAgotada(adquisicion)) {
      return {
        tipo: 'Garantía de proveedor', fechaAdquisicion: adquisicion,
        inicioProveedor: adquisicion, vencimientoProveedor: vencimiento,
        inicioInterna: '', vencimientoInterna: '',
        nota: `Garantía de proveedor de ${this.ANIOS_GARANTIA_PROVEEDOR} años desde la fecha de adquisición (${adquisicion}). La aceptación del usuario final no modifica este inicio.`
      };
    }
    // Los tres años ya pasaron. Las fechas del proveedor se conservan —son un hecho del equipo,
    // no una vigencia— y no se sustituyen por una responsabilidad interna inventada: esa la fija
    // el Encargado de Soporte, que es quien la asume.
    return {
      tipo: 'Sin garantía de proveedor', fechaAdquisicion: adquisicion,
      inicioProveedor: adquisicion, vencimientoProveedor: vencimiento,
      inicioInterna: '', vencimientoInterna: '',
      nota: `La garantía del proveedor cubrió del ${adquisicion} al ${vencimiento} y ya venció. El Encargado de Soporte debe establecer la responsabilidad interna de Soporte.`
    };
  }

  /**
   * Vencimiento propuesto de la responsabilidad interna: el cierre del año en curso. No hay una
   * duración institucional fija para un equipo usado —el pedido la deja «personalizada»— y dejarla
   * vacía habría dado una garantía sin fin. El Encargado de Soporte la edita cuando corresponda.
   */
  private finDeAnioDe(fecha: string): string {
    const anio = (fecha || this.hoy()).slice(0, 4);
    return `${anio}-12-31`;
  }

  /** Las dos fechas que rigen hoy: las del proveedor si aplica, las de la interna si no. */
  vigenciaEfectiva(g: Garantia): { inicio: string; vencimiento: string } {
    if (g.tipoGarantia === 'Garantía de proveedor' && g.inicioProveedor && g.vencimientoProveedor) {
      return { inicio: g.inicioProveedor, vencimiento: g.vencimientoProveedor };
    }
    if (g.inicioInterna || g.vencimientoInterna) {
      return { inicio: g.inicioInterna ?? '', vencimiento: g.vencimientoInterna ?? '' };
    }
    // «Sin garantía de proveedor» conserva las fechas del proveedor como dato histórico, pero no
    // cubren nada: devolver la vigencia anterior aquí haría pasar por vigente un equipo que no
    // tiene a nadie detrás.
    if (g.tipoGarantia === 'Sin garantía de proveedor') return { inicio: '', vencimiento: '' };
    return { inicio: g.fechaInicio, vencimiento: g.fechaVencimiento };
  }

  /** Días que faltan para el vencimiento vigente; null cuando no hay fecha que contar. */
  diasRestantesGarantia(g: Garantia): number | null {
    const { vencimiento } = this.vigenciaEfectiva(g);
    if (!vencimiento) return null;
    const fin = new Date(`${vencimiento}T23:59:59Z`).getTime();
    if (Number.isNaN(fin)) return null;
    return Math.ceil((fin - Date.now()) / 86400000);
  }

  /**
   * ¿Falta la fecha de adquisición de un equipo que debería traerla? Solo puede pasar por un error
   * de los datos institucionales: la base siempre la devuelve para un equipo nuevo.
   */
  faltaFechaAdquisicion(g: Garantia): boolean {
    return g.tipoGarantia === 'Garantía de proveedor' && !g.fechaAdquisicion;
  }

  /**
   * El proveedor ya no responde y todavía nadie asumió el equipo: los tres años se agotaron y el
   * Encargado de Soporte aún no fijó la responsabilidad interna.
   */
  sinCoberturaVigente(g: Garantia): boolean {
    return g.tipoGarantia === 'Sin garantía de proveedor' && !g.inicioInterna && !g.vencimientoInterna;
  }

  /**
   * Estado detallado (§11): dice de qué garantía se habla y en qué punto está, sin sustituir al
   * estado grueso que ya usaban badges y filtros.
   */
  estadoDetalleGarantia(g: Garantia): EstadoDetalleGarantia {
    if (g.estado === 'Cerrado') return 'Cerrada';
    // Un equipo nuevo sin fecha de adquisición es un fallo del dato de origen, no un paso del
    // proceso: se nombra por lo que hay que arreglar.
    if (this.faltaFechaAdquisicion(g)) return 'Pendiente de corrección de datos institucionales';
    const dias = this.diasRestantesGarantia(g);
    if (g.tipoGarantia === 'Garantía de proveedor') {
      if (dias === null) return 'Pendiente de fecha de adquisición';
      if (dias < 0) return 'Garantía de proveedor vencida';
      return dias <= this.DIAS_POR_VENCER ? 'Garantía de proveedor por vencer' : 'Garantía de proveedor vigente';
    }
    if (g.tipoGarantia === 'Sin garantía de proveedor') {
      // La vigencia del proveedor se conserva aunque ya no cubra: decir «garantía de proveedor
      // vencida» es más informativo que un «sin garantía» que esconde que alguna vez la tuvo.
      return g.vencimientoProveedor ? 'Garantía de proveedor vencida' : 'Sin garantía de proveedor';
    }
    if (dias === null) return 'Sin garantía de proveedor';
    return dias < 0 ? 'Responsabilidad interna vencida' : 'Responsabilidad interna activa';
  }

  /** Responsable de la garantía: el proveedor cuando la da él, la Unidad de Soporte cuando no. */
  responsableGarantia(g: Garantia): string {
    if (g.tipoGarantia === 'Garantía de proveedor') return g.proveedor || 'Proveedor (pendiente de registrar)';
    return 'Unidad de Soporte';
  }

  /** Última modificación de la vigencia, para mostrarla junto a la garantía. */
  ultimaModificacionGarantia(g: Garantia): ModificacionGarantia | undefined {
    const lista = g.modificaciones ?? [];
    return lista.length ? lista[0] : undefined;
  }

  /**
   * Rearma las dos fechas efectivas y el estado grueso a partir del tipo y de los pares de
   * vigencia. Se llama en cada cambio: así `fechaInicio`/`fechaVencimiento` nunca se desincronizan
   * de la garantía real, y todo lo escrito antes de esta regla sigue leyendo lo correcto.
   */
  private sincronizarVigencia(g: Garantia): Garantia {
    const { inicio, vencimiento } = this.vigenciaEfectiva(g);
    const abiertos = g.casos.some((c) => c.estado === 'Abierto' || c.estado === 'En revisión');
    let estado: EstadoGarantia;
    if (g.estado === 'Cerrado') estado = 'Cerrado';
    else if (this.faltaFechaAdquisicion(g)) estado = 'Pendiente de fecha de adquisición';
    else if (abiertos) estado = 'Caso abierto';
    // Los tres años del proveedor se agotaron y nadie fijó todavía la responsabilidad interna:
    // el equipo no está cubierto, y decir «Vigente» porque no hay fecha que comparar sería mentir.
    else if (this.sinCoberturaVigente(g)) estado = 'Vencida';
    else if (vencimiento && new Date(`${vencimiento}T23:59:59Z`).getTime() < Date.now()) estado = 'Vencida';
    else estado = 'Vigente';
    return { ...g, fechaInicio: inicio, fechaVencimiento: vencimiento, estado };
  }

  /**
   * Normaliza las garantías leídas del JSON semilla o de una foto anterior a esta regla: las que
   * se guardaron con la vigencia fija de un mes desde la aceptación se recalculan por tipo de
   * equipo. La fecha de aceptación se conserva —ocurrió— pero deja de ser el inicio de la
   * garantía del proveedor.
   */
  private normalizarGarantias(lista: Garantia[]): Garantia[] {
    return lista.map((g) => {
      if (g.tipoGarantia) return this.sincronizarVigencia({ ...g, modificaciones: g.modificaciones ?? [] });
      const p = this.garantiaPropuesta(g.inventario, g.fechaAceptacion);
      return this.sincronizarVigencia({
        ...g,
        tipoGarantia: p.tipo, fechaAdquisicion: p.fechaAdquisicion,
        inicioProveedor: p.inicioProveedor, vencimientoProveedor: p.vencimientoProveedor,
        inicioInterna: p.inicioInterna, vencimientoInterna: p.vencimientoInterna,
        proveedor: this.equipoDe(g.inventario)?.proveedor ?? '',
        observacionesGarantia: this.equipoDe(g.inventario)?.observacionGarantia ?? '',
        modificaciones: g.modificaciones ?? []
      });
    });
  }

  /** Solo el Encargado de Soporte y el Administrador modifican la vigencia de la garantía (§8). */
  puedeModificarGarantia(): boolean {
    const clave = this.claveConectada();
    return clave === 'enc-soporte' || clave === 'admin';
  }

  /**
   * Modifica la vigencia de la garantía. Exige motivo siempre que cambie una fecha o el tipo, y
   * deja el cambio en el historial con lo que había antes: una garantía que vence en otra fecha
   * sin explicación es indistinguible de un error de captura.
   */
  modificarGarantia(id: string, datos: {
    tipoGarantia: TipoGarantia; fechaAdquisicion: string; inicio: string; vencimiento: string;
    proveedor: string; motivo: string; observaciones: string;
  }, usuario: string): string | null {
    const g = this.garantiaDe(id);
    if (!g) return 'No se encontró la garantía del expediente.';
    if (!this.puedeModificarGarantia()) {
      this.registrarEvento(id, usuario, 'Intento de modificación de garantía sin permisos', g.estado,
        'La vigencia de la garantía solo la modifican el Encargado de Soporte y el Administrador.', false,
        { modulo: 'Servicio de garantía', inventario: g.inventario, rol: this.rolConectado(),
          tipoGarantia: g.tipoGarantia });
      return 'Solo el Encargado de Soporte y el Administrador pueden modificar la vigencia de la garantía. Los Técnicos pueden consultarla y registrar casos.';
    }
    // Una garantía cerrada ya no se toca, salvo que sea el Administrador quien corrige.
    if (g.estado === 'Cerrado' && this.claveConectada() !== 'admin') {
      return 'La garantía de este expediente está cerrada. Solo el Administrador puede modificar una garantía cerrada.';
    }

    const anterior = this.vigenciaEfectiva(g);
    const proveedor = datos.tipoGarantia === 'Garantía de proveedor';
    const cambiaFecha = datos.inicio !== anterior.inicio || datos.vencimiento !== anterior.vencimiento
      || datos.fechaAdquisicion !== (g.fechaAdquisicion ?? '');
    const cambiaTipo = datos.tipoGarantia !== g.tipoGarantia;

    if (!cambiaFecha && !cambiaTipo && datos.proveedor === (g.proveedor ?? '')
      && datos.observaciones === (g.observacionesGarantia ?? '')) {
      return 'No hay ningún cambio que registrar en la garantía.';
    }
    if ((cambiaFecha || cambiaTipo) && !datos.motivo.trim()) {
      this.registrarEvento(id, usuario, 'Intento de modificación de garantía sin motivo', g.estado,
        this.MSG_MOTIVO_GARANTIA, false,
        { modulo: 'Servicio de garantía', inventario: g.inventario, rol: this.rolConectado(),
          tipoGarantia: datos.tipoGarantia });
      return this.MSG_MOTIVO_GARANTIA;
    }
    // Un tipo que exige vigencia no se guarda sin ella: quedaría una garantía sin fin.
    if (datos.tipoGarantia !== 'Sin garantía de proveedor' && (!datos.inicio || !datos.vencimiento)) {
      return 'Debe indicar la fecha de inicio y la de vencimiento para este tipo de garantía.';
    }
    if (datos.inicio && datos.vencimiento && datos.vencimiento < datos.inicio) {
      return this.MSG_VENCIMIENTO_MENOR;
    }
    // La garantía del proveedor arranca en la adquisición: si consta y se pretende otro inicio,
    // el sistema lo dice en vez de aceptar una fecha que contradice la regla.
    if (proveedor) {
      if (!datos.fechaAdquisicion) return this.MSG_SIN_FECHA_ADQUISICION;
      if (datos.inicio !== datos.fechaAdquisicion) return this.MSG_GARANTIA_DESDE_ADQUISICION;
      // Reponer una garantía de proveedor que el calendario ya agotó sería declarar cubierto un
      // equipo que nadie cubre.
      if (this.garantiaProveedorAgotada(datos.fechaAdquisicion)) {
        return `La garantía del proveedor de este equipo venció el ${this.sumarAnios(datos.fechaAdquisicion, this.ANIOS_GARANTIA_PROVEEDOR)}. Establezca la responsabilidad interna de Soporte en su lugar.`;
      }
    }

    const modificacion: ModificacionGarantia = {
      fecha: this.hoy(), hora: this.hora(), usuario, rol: this.rolConectado(),
      motivo: datos.motivo.trim(), observaciones: datos.observaciones.trim(),
      tipoAnterior: g.tipoGarantia ?? 'Garantía de proveedor', tipoNuevo: datos.tipoGarantia,
      fechaAdquisicionAnterior: g.fechaAdquisicion ?? '', fechaAdquisicionNueva: datos.fechaAdquisicion,
      inicioAnterior: anterior.inicio, inicioNuevo: datos.inicio,
      vencimientoAnterior: anterior.vencimiento, vencimientoNuevo: datos.vencimiento,
      proveedorAnterior: g.proveedor ?? '', proveedorNuevo: datos.proveedor.trim()
    };

    // La vigencia del proveedor se conserva aunque el tipo pase a ser otro: que el equipo tuvo
    // garantía de proveedor del día X al día Y es un hecho, y borrarlo dejaría el expediente sin
    // poder explicar por qué hoy responde Soporte.
    const interna = datos.tipoGarantia === 'Responsabilidad interna de Soporte';
    const vigenciaProveedor = proveedor
      ? { inicio: datos.inicio, vencimiento: datos.vencimiento }
      : datos.fechaAdquisicion
        ? { inicio: datos.fechaAdquisicion, vencimiento: this.sumarAnios(datos.fechaAdquisicion, this.ANIOS_GARANTIA_PROVEEDOR) }
        : { inicio: '', vencimiento: '' };
    this.garantias.update((list) => list.map((x) => {
      if (x.expediente !== id) return x;
      const base: Garantia = {
        ...x, tipoGarantia: datos.tipoGarantia, fechaAdquisicion: datos.fechaAdquisicion,
        proveedor: datos.proveedor.trim(), observacionesGarantia: datos.observaciones.trim(),
        inicioProveedor: vigenciaProveedor.inicio,
        vencimientoProveedor: vigenciaProveedor.vencimiento,
        inicioInterna: interna ? datos.inicio : '',
        vencimientoInterna: interna ? datos.vencimiento : '',
        modificaciones: [modificacion, ...(x.modificaciones ?? [])]
      };
      return this.sincronizarVigencia(base);
    }));

    // La fecha de adquisición vive en el equipo: si el Encargado la registra aquí, se registra allí.
    if (datos.fechaAdquisicion && datos.fechaAdquisicion !== this.fechaAdquisicionDe(g.inventario)) {
      this.equipos.update((list) => list.map((e) => (e.inventario === g.inventario
        ? { ...e, fechaAdquisicion: datos.fechaAdquisicion, adquisicionRegistradaPor: usuario,
            fechaRegistroAdquisicion: this.hoy(), proveedor: datos.proveedor.trim() || e.proveedor }
        : e)));
      this.registrarEvento(id, usuario, 'Fecha de adquisición modificada', 'Registrada',
        `${modificacion.fechaAdquisicionAnterior || 'sin registrar'} → ${datos.fechaAdquisicion}. ${datos.motivo.trim()}`,
        false, { modulo: 'Servicio de garantía', inventario: g.inventario, rol: this.rolConectado(),
          fechaAdquisicion: datos.fechaAdquisicion, tipoGarantia: datos.tipoGarantia,
          expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: g.usuarioFinal });
    }

    const actualizada = this.garantiaDe(id)!;
    const ref = {
      modulo: 'Servicio de garantía', inventario: g.inventario, rol: this.rolConectado(),
      tipoGarantia: datos.tipoGarantia, fechaAdquisicion: datos.fechaAdquisicion,
      fechaAceptacion: g.fechaAceptacion,
      inicioAnterior: anterior.inicio, vencimientoAnterior: anterior.vencimiento,
      inicioNuevo: datos.inicio, vencimientoNuevo: datos.vencimiento,
      expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: g.usuarioFinal,
      motivo: datos.motivo.trim()
    };
    if (cambiaTipo) {
      this.registrarEvento(id, usuario,
        `Tipo de garantía modificado: ${modificacion.tipoAnterior} → ${datos.tipoGarantia}`,
        this.estadoDetalleGarantia(actualizada), datos.motivo.trim(), false,
        { ...ref, estadoAnterior: this.estadoDetalleGarantia(g) });
    }
    this.registrarEvento(id, usuario, 'Fecha de garantía modificada',
      this.estadoDetalleGarantia(actualizada),
      `${anterior.inicio || 'sin fecha'} → ${anterior.vencimiento || 'sin fecha'} reemplazada por ${datos.inicio} → ${datos.vencimiento}. ${datos.motivo.trim()}`,
      true, { ...ref, estadoAnterior: this.estadoDetalleGarantia(g) });
    return null;
  }

  /**
   * Autoriza atender un equipo por responsabilidad interna cuando la garantía del proveedor ya
   * venció (§18). Es una decisión del Encargado, no un automatismo: el proveedor ya no responde y
   * alguien tiene que asumirlo explícitamente.
   */
  autorizarResponsabilidadInterna(id: string, usuario: string, motivo: string): string | null {
    const g = this.garantiaDe(id);
    if (!g) return 'No se encontró la garantía del expediente.';
    if (!this.puedeModificarGarantia()) {
      return 'Solo el Encargado de Soporte y el Administrador pueden autorizar la atención por responsabilidad interna.';
    }
    if (!motivo.trim()) return 'Debe justificar la autorización por responsabilidad interna.';
    this.garantias.update((list) => list.map((x) => (x.expediente === id
      ? { ...x, autorizacionInterna: { autorizadoPor: usuario, fecha: this.hoy(), hora: this.hora(), motivo: motivo.trim() } }
      : x)));
    this.registrarEvento(id, usuario, 'Responsabilidad interna de Soporte asignada',
      'Responsabilidad interna activa', motivo.trim(), true,
      { modulo: 'Servicio de garantía', inventario: g.inventario, rol: this.rolConectado(),
        tipoGarantia: g.tipoGarantia, fechaAdquisicion: g.fechaAdquisicion,
        fechaAceptacion: g.fechaAceptacion, estadoAnterior: this.estadoDetalleGarantia(g),
        expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: g.usuarioFinal });
    return null;
  }

  /**
   * La garantía está vencida cuando su estado lo indica o su fecha de vencimiento ya pasó: queda
   * en modo consulta. Una garantía de proveedor vencida con autorización del Encargado se atiende
   * igual, por responsabilidad interna; y una sin fecha de vencimiento no está vencida: está
   * pendiente de que se registre la fecha de adquisición.
   */
  garantiaVencida(g: Garantia): boolean {
    if (g.autorizacionInterna) return false;
    if (g.estado === 'Vencida') return true;
    const { vencimiento } = this.vigenciaEfectiva(g);
    if (!vencimiento) return false;
    return new Date(`${vencimiento}T23:59:59Z`).getTime() < Date.now();
  }

  /** Motivo por el que no se puede abrir un caso hoy, o '' si se puede. */
  bloqueoCasoGarantia(g: Garantia): string {
    // El dato que falta es institucional: se dice dónde corregirlo, no se le pide al Encargado
    // que lo invente aquí.
    if (this.faltaFechaAdquisicion(g)) return this.MSG_DATOS_INSTITUCIONALES;
    // El proveedor ya no responde y nadie asumió el equipo todavía.
    if (this.sinCoberturaVigente(g)) return this.MSG_PROVEEDOR_VENCIDA_USADO;
    if (this.garantiaVencida(g)) {
      return g.tipoGarantia === 'Garantía de proveedor'
        ? this.MSG_PROVEEDOR_VENCIDA
        : 'La responsabilidad interna de Soporte de este equipo está vencida. El Encargado de Soporte puede ampliarla desde «Modificar garantía».';
    }
    return '';
  }

  /** Solo se puede comentar con garantía vigente y caso Abierto o En revisión; caso cerrado = solo lectura. */
  puedeComentarCaso(g: Garantia, c: CasoGarantia): boolean {
    return !this.garantiaVencida(g) && (c.estado === 'Abierto' || c.estado === 'En revisión');
  }

  /** Abre un caso de garantía asociado al Expediente único; un expediente puede tener varios casos. */
  registrarCasoGarantia(id: string, motivo: string, descripcion: string, responsable: string): CasoGarantia | null {
    const g = this.garantiaDe(id);
    if (!g || this.garantiaVencida(g) || this.faltaFechaAdquisicion(g)) return null;
    const caso: CasoGarantia = {
      codigo: this.siguienteCodigoPorAnio(
        `CASO-${this.anioActual()}-`,
        this.garantias().flatMap((x) => x.casos.map((c) => c.codigo))
      ),
      fechaApertura: this.hoy(),
      motivo,
      descripcion,
      responsableAtencion: responsable,
      estado: 'Abierto',
      evidenciaTecnica: '',
      resultado: '',
      fechaCierre: '',
      comentarios: []
    };
    this.garantias.update((list) =>
      list.map((x) => (x.expediente === id ? { ...x, estado: 'Caso abierto', casos: [...x.casos, caso] } : x))
    );
    this.registrarEvento(id, responsable, `Caso de garantía ${caso.codigo} abierto: ${motivo}`, 'Caso abierto', descripcion, true,
      { modulo: 'Servicio de garantía', estadoAnterior: g.estado, inventario: g.inventario, usuarioFinal: g.usuarioFinal });
    return caso;
  }

  /**
   * Agrega un comentario interno a un caso de garantía. Guarda automáticamente fecha, hora,
   * usuario (con su rol) y el estado del caso al momento de comentar. Los comentarios no
   * reemplazan la trazabilidad general: son el historial de seguimiento dentro del caso.
   */
  agregarComentarioCaso(id: string, codigoCaso: string, tipo: TipoComentarioCaso, texto: string, usuario: string): string | null {
    const g = this.garantiaDe(id);
    const caso = g?.casos.find((c) => c.codigo === codigoCaso);
    if (!g || !caso) return 'No se encontró el caso de garantía indicado.';
    if (this.garantiaVencida(g)) return 'La garantía de este expediente está vencida. No se pueden abrir nuevos casos ni agregar comentarios.';
    if (caso.estado === 'Cerrado' || caso.estado === 'Resuelto') return 'Este caso de garantía está cerrado. No se pueden agregar nuevos comentarios.';
    if (!texto.trim()) return 'Escriba el comentario antes de guardarlo.';
    const comentario: ComentarioCaso = {
      fecha: this.hoy(), hora: this.hora(), usuario, tipo, texto: texto.trim(), estadoCaso: caso.estado
    };
    this.garantias.update((list) =>
      list.map((x) => (x.expediente === id
        ? {
            ...x,
            casos: x.casos.map((c) =>
              c.codigo === codigoCaso ? { ...c, comentarios: [...(c.comentarios ?? []), comentario] } : c)
          }
        : x))
    );
    return null;
  }

  // ---------- Revisión técnica de garantía ----------

  /**
   * Problemas con los que Soporte clasifica un caso de garantía, y quién los atiende. Los que
   * exigen mirar el equipo van a Hardware; los de configuración, cuentas o software los resuelve
   * Soporte sin mover el equipo de sitio. **No todo caso de garantía genera una revisión técnica.**
   *
   * El tipo de problema del reproceso es el que arma el checklist: la revisión de garantía reusa
   * el mismo mecanismo que el Reproceso F0288, con otro nombre y otro código.
   */
  readonly problemasGarantia: {
    nombre: string; hardware: boolean; tipoProblema: TipoProblemaReproceso; nota: string;
  }[] = [
    { nombre: 'Falla física del equipo', hardware: true, tipoProblema: 'Falla física del equipo',
      nota: 'Requiere inspección física: lo revisa Hardware.' },
    { nombre: 'Falla de disco', hardware: true, tipoProblema: 'Falla de disco',
      nota: 'Diagnóstico y posible sustitución del disco: lo revisa Hardware.' },
    { nombre: 'Falla de memoria', hardware: true, tipoProblema: 'Falla de memoria',
      nota: 'Diagnóstico y posible sustitución de memoria: lo revisa Hardware.' },
    { nombre: 'Problema de encendido', hardware: true, tipoProblema: 'Problema de encendido',
      nota: 'El equipo no enciende o enciende mal: lo revisa Hardware.' },
    { nombre: 'Problema de periféricos', hardware: true, tipoProblema: 'Problema de periféricos',
      nota: 'Revisión o sustitución del periférico: lo revisa Hardware.' },
    { nombre: 'Accesorio con falla', hardware: true, tipoProblema: 'Problema de periféricos',
      nota: 'El accesorio existe pero no funciona: lo revisa Hardware.' },
    { nombre: 'Accesorio faltante', hardware: true, tipoProblema: 'Accesorio faltante',
      nota: 'Reposición y asociación del accesorio: lo atiende Hardware.' },
    { nombre: 'Problema de sistema operativo que requiere reparación base o reinstalación',
      hardware: true, tipoProblema: 'Problema de sistema operativo',
      nota: 'Reparación base o reinstalación: lo atiende Hardware.' },
    { nombre: 'Problema de red física', hardware: true, tipoProblema: 'Problema de red física',
      nota: 'Adaptador, cableado o punto de red: lo revisa Hardware.' },
    { nombre: 'Revisión técnica de preparación', hardware: true, tipoProblema: 'Otro',
      nota: 'Revisión de lo hecho en la preparación original: lo revisa Hardware.' },
    { nombre: 'Otro problema que requiera revisión física del equipo', hardware: true, tipoProblema: 'Otro',
      nota: 'Describa lo que Hardware debe revisar en el equipo.' },
    { nombre: 'Problema de configuración', hardware: false, tipoProblema: 'Otro',
      nota: 'Se resuelve en Soporte: no requiere revisión física del equipo.' },
    { nombre: 'Problema de usuario o credenciales', hardware: false, tipoProblema: 'Otro',
      nota: 'Se resuelve en Soporte: no requiere revisión física del equipo.' },
    { nombre: 'Problema de software adicional', hardware: false, tipoProblema: 'Otro',
      nota: 'Se resuelve en Soporte: no requiere revisión física del equipo.' },
    { nombre: 'Problema de dominio', hardware: false, tipoProblema: 'Otro',
      nota: 'Se resuelve en Soporte: no requiere revisión física del equipo.' },
    { nombre: 'Problema de Agente DLP', hardware: false, tipoProblema: 'Otro',
      nota: 'Se resuelve en Soporte: no requiere revisión física del equipo.' },
    { nombre: 'Problema de IP reservada', hardware: false, tipoProblema: 'Otro',
      nota: 'Se resuelve en Soporte: no requiere revisión física del equipo.' },
    { nombre: 'Ajuste menor de configuración F0302', hardware: false, tipoProblema: 'Otro',
      nota: 'Se resuelve en Soporte: no requiere revisión física del equipo.' }
  ];

  /**
   * Tipo de falla equivalente a un problema de checklist. Es la inversa de `tipoProblemaDeFalla`:
   * el reproceso guarda un `tipoFalla` aunque no venga de una falla de F0302, y el historial lo lee.
   */
  private fallaEquivalenteDeProblema(tipo: TipoProblemaReproceso): TipoFallaF0302 {
    switch (tipo) {
      case 'Accesorio faltante': return 'Accesorio faltante';
      case 'Falla de disco': return 'Falla de disco';
      case 'Falla de memoria': return 'Falla de memoria';
      case 'Problema de sistema operativo': return 'Problema de sistema operativo';
      case 'Problema de red física': return 'Problema de red';
      // Encendido y periféricos no tienen falla propia en el F0302: son físicos del equipo.
      case 'Falla física del equipo':
      case 'Problema de encendido':
      case 'Problema de periféricos': return 'Falla física del equipo';
      default: return 'Otro';
    }
  }

  /** ¿El problema clasificado exige que Hardware mire el equipo? */
  garantiaRequiereHardware(problema: string): boolean {
    return this.problemasGarantia.find((p) => p.nombre === problema)?.hardware ?? false;
  }

  /** Nota que explica a quién le toca el problema clasificado. */
  notaProblemaGarantia(problema: string): string {
    return this.problemasGarantia.find((p) => p.nombre === problema)?.nota ?? '';
  }

  /**
   * Técnico de Hardware que preparó originalmente el equipo. Es el que más contexto tiene sobre lo
   * que se le hizo, así que se propone primero — **propone, no asigna**: la asignación sigue siendo
   * potestad de un Encargado.
   */
  tecnicoSugeridoGarantia(inventario: string): { tecnico: string; motivo: string } | undefined {
    const tec = this.expTecnicoDeEquipo(inventario);
    const prep = tec ? this.preparacionPorCodigo(tec.codigo) : undefined;
    const nombre = (prep?.tecnico ?? '').trim();
    if (!nombre) return undefined;
    return { tecnico: nombre, motivo: 'Técnico que preparó originalmente el equipo.' };
  }

  /** Revisiones técnicas de garantía de un Expediente técnico, para numerar la siguiente. */
  revisionesGarantiaDeExpTecnico(codigoTec: string): ReprocesoF0288[] {
    return this.reprocesosDeExpTecnico(codigoTec).filter((r) => r.origen === 'Garantía');
  }

  /** Revisión técnica de garantía de un caso, si se generó. */
  revisionDeCasoGarantia(codigoCaso: string): ReprocesoF0288 | undefined {
    return this.reprocesos().find((r) => r.origen === 'Garantía' && r.casoGarantia === codigoCaso);
  }

  /** Casos de garantía con revisión técnica abierta o cerrada, para el historial del equipo. */
  casosGarantiaDeEquipo(inventario: string): { garantia: Garantia; caso: CasoGarantia }[] {
    return this.garantiasDeEquipo(inventario)
      .flatMap((g) => g.casos.map((caso) => ({ garantia: g, caso })));
  }

  private actualizarCasoGarantia(id: string, codigoCaso: string,
    cambio: (c: CasoGarantia) => CasoGarantia): void {
    this.garantias.update((list) => list.map((g) => (g.expediente === id
      ? { ...g, casos: g.casos.map((c) => (c.codigo === codigoCaso ? cambio(c) : c)) } : g)));
  }

  /** Referencia común de los eventos de un caso de garantía. */
  private refGarantia(g: Garantia, c: CasoGarantia): Partial<EventoTrazabilidad> {
    return {
      modulo: 'Servicio de garantía', inventario: g.inventario, usuarioFinal: g.usuarioFinal,
      expedienteUnico: this.expedienteUnicoDe(g.expediente)?.codigoUnico,
      expedienteTecnico: this.expTecnicoDeEquipo(g.inventario)?.codigo,
      tipoProblema: c.tipoProblema, garantia: c.codigo
    };
  }

  /**
   * Soporte clasifica el caso: deja escrito qué problema es y, con eso, si le toca a Hardware o se
   * resuelve aquí. Es el paso que faltaba entre abrir el caso y cerrarlo.
   */
  revisarCasoGarantia(id: string, codigoCaso: string, problema: string, usuario: string): string | null {
    const g = this.garantiaDe(id);
    const caso = g?.casos.find((c) => c.codigo === codigoCaso);
    if (!g || !caso) return 'No se encontró el caso de garantía indicado.';
    if (this.garantiaVencida(g)) return 'La garantía de este expediente está vencida.';
    if (caso.estado === 'Cerrado' || caso.estado === 'Resuelto') return 'Este caso de garantía ya está cerrado.';
    if (!problema.trim()) return 'Seleccione el tipo de problema del caso de garantía.';
    if (!this.problemasGarantia.some((p) => p.nombre === problema)) {
      return 'El tipo de problema indicado no está en el catálogo de garantía.';
    }
    const hardware = this.garantiaRequiereHardware(problema);
    this.actualizarCasoGarantia(id, codigoCaso, (c) => ({
      ...c, tipoProblema: problema, estado: 'En revisión',
      estadoRevision: hardware ? 'GARANTIA_REQUIERE_HARDWARE' : 'GARANTIA_EN_REVISION_SOPORTE'
    }));
    const actualizado = this.garantiaDe(id)!.casos.find((c) => c.codigo === codigoCaso)!;
    this.registrarEvento(id, usuario, 'Caso de garantía revisado por Soporte',
      hardware ? 'Garantía requiere revisión de Hardware' : 'Garantía en revisión de Soporte',
      `${problema}. ${this.notaProblemaGarantia(problema)}`, true,
      { ...this.refGarantia(g, actualizado), rol: this.rolDeUsuario(usuario),
        accionTomada: hardware ? 'Clasificado para revisión de Hardware' : 'Se resuelve en Soporte' });
    if (hardware) {
      this.registrarEvento(id, usuario, 'Garantía requiere revisión de Hardware',
        'Garantía requiere revisión de Hardware',
        'El problema exige revisión física del equipo: genere la revisión técnica de garantía.', true,
        { ...this.refGarantia(g, actualizado), rol: this.rolDeUsuario(usuario),
          accionTomada: 'Pendiente de generar la revisión técnica' });
    }
    return null;
  }

  /**
   * Genera la revisión técnica de garantía sobre el Expediente técnico que el equipo ya tiene. Es
   * el mismo mecanismo del reproceso —checklist por tipo de problema, asignación del Encargado,
   * evidencia por ítem y firma— con un código propio `…-G1` que la distingue de un reproceso por
   * falla de F0302. **No se crea un Expediente técnico nuevo.**
   */
  generarRevisionGarantia(id: string, codigoCaso: string, usuario: string,
    observacion = ''): ReprocesoF0288 | string {
    const g = this.garantiaDe(id);
    const caso = g?.casos.find((c) => c.codigo === codigoCaso);
    if (!g || !caso) return 'No se encontró el caso de garantía indicado.';
    if (this.garantiaVencida(g)) return 'La garantía de este expediente está vencida.';
    if (caso.estado === 'Cerrado' || caso.estado === 'Resuelto') return 'Este caso de garantía ya está cerrado.';
    if (!caso.tipoProblema) return 'Clasifique el problema del caso antes de enviarlo a revisión de Hardware.';
    if (!this.garantiaRequiereHardware(caso.tipoProblema)) {
      return `«${caso.tipoProblema}» se resuelve en Soporte: no requiere revisión técnica de Hardware.`;
    }
    if (caso.revisionId) return `Este caso ya tiene la revisión técnica ${caso.revisionId}.`;
    const tecnico = this.expTecnicoDeEquipo(g.inventario)?.codigo ?? g.inventario;
    const numero = Math.max(0, ...this.revisionesGarantiaDeExpTecnico(tecnico).map((r) => r.numero)) + 1;
    const problema = this.problemasGarantia.find((p) => p.nombre === caso.tipoProblema)!;
    const sugerido = this.tecnicoSugeridoGarantia(g.inventario);
    const revision: ReprocesoF0288 = {
      id: `${tecnico}-G${numero}`, expedienteTecnico: tecnico, expediente: g.expediente,
      expedienteUnico: this.expedienteUnicoDe(g.expediente)?.codigoUnico ?? '',
      inventario: g.inventario, numero,
      origen: 'Garantía', casoGarantia: caso.codigo,
      tecnicoSugerido: sugerido?.tecnico, motivoSugerencia: sugerido?.motivo,
      usuarioFinal: g.usuarioFinal,
      tipoFalla: this.fallaEquivalenteDeProblema(problema.tipoProblema),
      motivo: `Garantía ${caso.codigo} — ${caso.tipoProblema}: ${caso.descripcion}`,
      // El equipo ya está con el usuario final: una garantía no espera turno.
      prioridad: 'Alta',
      unidadAtiende: 'Hardware', justificacionUnidad: '',
      solicitadoPor: usuario, observacionSoporte: observacion.trim() || caso.descripcion,
      evidenciaSoporte: this.evid.de('Garantía', caso.codigo).map((e) => e.archivo).join(', '),
      fechaSolicitud: this.hoy(), horaSolicitud: this.hora(),
      // Nace sin dueño: la asignación es potestad de un Encargado, nunca automática.
      tecnicoAsignado: '', asignadoPor: '', fechaAsignacion: '', horaAsignacion: '',
      justificacionReprocesoSimultaneo: '',
      atendidoPor: '', fechaInicio: '', fechaFin: '', cronometro: undefined,
      tipoProblema: problema.tipoProblema,
      checklist: this.checklistReproceso(problema.tipoProblema), evidencias: [], correccionTecnica: '',
      observaciones: '', firma: undefined, resultado: '', observacionResultado: '',
      estado: 'Pendiente de asignación'
    };
    this.reprocesos.update((list) => [revision, ...list]);
    this.actualizarCasoGarantia(id, codigoCaso, (c) => ({
      ...c, revisionId: revision.id, estado: 'En revisión',
      estadoRevision: 'REVISION_HARDWARE_GARANTIA_PENDIENTE_ASIGNACION'
    }));
    const actualizado = this.garantiaDe(id)!.casos.find((c) => c.codigo === codigoCaso)!;
    const ref = { ...this.refGarantia(g, actualizado), rol: this.rolDeUsuario(usuario), reproceso: revision.id };
    this.registrarEvento(id, usuario, 'Revisión técnica de garantía generada',
      'Revisión de garantía pendiente de asignación',
      `${revision.id} — revisión #${numero} del Expediente técnico ${tecnico}. No se crea un Expediente técnico nuevo.`,
      true, { ...ref, accionTomada: 'Revisión técnica de garantía dentro del mismo Expediente técnico' });
    if (sugerido) {
      this.registrarEvento(id, usuario, 'Técnico de Hardware sugerido',
        'Revisión de garantía pendiente de asignación',
        `${sugerido.tecnico} — ${sugerido.motivo} La asignación la hace un Encargado.`, false,
        { ...ref, tecnicoHardware: sugerido.tecnico, accionTomada: 'Sugerencia del sistema' });
    }
    this.registrarEvento(id, usuario, 'Revisión de garantía pendiente de asignación por Encargado',
      'Revisión de garantía pendiente de asignación',
      'El Técnico de Soporte reporta; la asignación a Hardware la hace un Encargado.', true,
      { ...ref, encargadoAsigno: 'Pendiente de asignación', tecnicoHardware: 'Sin asignar',
        accionTomada: 'Pendiente de asignación por Encargado' });
    return revision;
  }

  /** Caso de garantía al que pertenece una revisión técnica, si lo hay. */
  casoDeRevisionGarantia(r: ReprocesoF0288): { garantia: Garantia; caso: CasoGarantia } | undefined {
    if (r.origen !== 'Garantía' || !r.casoGarantia) return undefined;
    const g = this.garantiaDe(r.expediente);
    const caso = g?.casos.find((c) => c.codigo === r.casoGarantia);
    return g && caso ? { garantia: g, caso } : undefined;
  }

  /** Mueve el estado técnico del caso cuando su revisión avanza. */
  private avanzarRevisionGarantia(r: ReprocesoF0288, estado: EstadoRevisionGarantia): void {
    const par = this.casoDeRevisionGarantia(r);
    if (!par) return;
    this.actualizarCasoGarantia(par.garantia.expediente, par.caso.codigo, (c) => ({ ...c, estadoRevision: estado }));
  }

  /**
   * Soporte valida lo que Hardware devolvió: la corrección, el funcionamiento del equipo y la
   * evidencia. Sin esta validación el caso no se cierra — quien responde ante el usuario final es
   * Soporte, no el técnico que tocó el equipo.
   */
  validarGarantiaTrasRevision(id: string, codigoCaso: string, datos: {
    correccionRealizada: RespuestaSiNo; equipoFunciona: RespuestaSiNo;
    evidenciaRevisada: RespuestaSiNo; observacion: string;
  }, usuario: string): string | null {
    const g = this.garantiaDe(id);
    const caso = g?.casos.find((c) => c.codigo === codigoCaso);
    if (!g || !caso) return 'No se encontró el caso de garantía indicado.';
    const revision = caso.revisionId ? this.reprocesoDe(caso.revisionId) : undefined;
    if (!revision) return 'Este caso no tiene una revisión técnica de garantía que validar.';
    if (!revision.firma) return 'Espere la firma del Técnico de Hardware antes de validar la revisión.';
    if (!datos.correccionRealizada) return 'Indique si la corrección se realizó.';
    if (!datos.equipoFunciona) return 'Indique si el equipo funciona correctamente.';
    if (!datos.evidenciaRevisada) return 'Confirme que revisó la evidencia adjuntada por Hardware.';
    if (!datos.observacion.trim()) return 'Registre la observación de la validación del caso.';
    const validacion: ValidacionGarantia = {
      correccionRealizada: datos.correccionRealizada, equipoFunciona: datos.equipoFunciona,
      evidenciaRevisada: datos.evidenciaRevisada, observacion: datos.observacion.trim(),
      validadoPor: usuario, fecha: this.hoy(), hora: this.hora()
    };
    const conforme = datos.correccionRealizada === 'Sí' && datos.equipoFunciona === 'Sí';
    this.actualizarCasoGarantia(id, codigoCaso, (c) => ({
      ...c, validacionSoporte: validacion,
      estadoRevision: conforme ? 'GARANTIA_CORREGIDA' : 'GARANTIA_NO_CORREGIDA'
    }));
    const actualizado = this.garantiaDe(id)!.casos.find((c) => c.codigo === codigoCaso)!;
    this.registrarEvento(id, usuario, 'Garantía validada por Soporte',
      conforme ? 'Garantía corregida' : 'Garantía no corregida',
      `Corrección: ${datos.correccionRealizada} · Equipo funciona: ${datos.equipoFunciona}`
        + ` · Evidencia revisada: ${datos.evidenciaRevisada}. ${validacion.observacion}`, true,
      { ...this.refGarantia(g, actualizado), rol: this.rolDeUsuario(usuario), reproceso: revision.id,
        resultadoReproceso: revision.resultado,
        accionTomada: conforme ? 'Validación conforme: el caso puede cerrarse' : 'Validación no conforme' });
    return null;
  }

  /** Lo que impide cerrar el caso cuando pasó por Hardware; null si ya se puede cerrar. */
  faltaValidacionGarantia(caso: CasoGarantia): string | null {
    if (!caso.revisionId) return null;
    const revision = this.reprocesoDe(caso.revisionId);
    if (!revision) return null;
    if (!revision.firma) {
      return `La revisión técnica ${revision.id} todavía no tiene la firma del Técnico de Hardware.`;
    }
    if (revision.resultado === 'Requiere sustitución de equipo') {
      return `La revisión ${revision.id} concluyó que el equipo requiere sustitución: la decisión es del Encargado, el caso no se cierra aquí.`;
    }
    if (!caso.validacionSoporte) {
      return `Valide el resultado de la revisión técnica ${revision.id} antes de cerrar el caso de garantía.`;
    }
    return null;
  }

  /**
   * Cierra un caso de garantía. Ningún caso se cierra sin imagen: el resultado dice qué se
   * concluyó, y la imagen es lo que lo respalda ante el usuario final.
   */
  cerrarCasoGarantia(id: string, codigoCaso: string, resultado: string, evidencia: string, usuario: string): string | null {
    const inventario = this.garantiaDe(id)?.inventario;
    // Un caso que pasó por Hardware no lo cierra Hardware: vuelve a Soporte, que valida y cierra.
    const caso = this.garantiaDe(id)?.casos.find((c) => c.codigo === codigoCaso);
    const sinValidar = caso ? this.faltaValidacionGarantia(caso) : null;
    if (sinValidar) return sinValidar;
    const sinImagen = this.exigirEvidencia('Garantía', codigoCaso, id, usuario, inventario);
    if (sinImagen) return sinImagen;
    const imagenes = this.evid.de('Garantía', codigoCaso);
    this.garantias.update((list) =>
      list.map((g) => {
        if (g.expediente !== id) return g;
        const casos = g.casos.map((c) =>
          c.codigo === codigoCaso
            ? {
                ...c, estado: 'Cerrado' as const, resultado, fechaCierre: this.hoy(),
                // La evidencia técnica del caso pasa a nombrar las imágenes que lo respaldan.
                evidenciaTecnica: evidencia.trim() || imagenes.map((e) => e.archivo).join(', ')
              }
            : c);
        // El estado vuelve a derivarse de la vigencia real (proveedor o interna), no de una
        // fecha fija: cerrar el último caso no puede reabrir una garantía que ya venció.
        return this.sincronizarVigencia({ ...g, casos });
      })
    );
    if (caso?.revisionId) {
      this.actualizarCasoGarantia(id, codigoCaso, (c) => ({ ...c, estadoRevision: 'GARANTIA_CERRADA' }));
    }
    this.registrarEvento(id, usuario, `Caso de garantía ${codigoCaso} cerrado`, 'Cerrado', resultado, false,
      { modulo: 'Servicio de garantía', estadoAnterior: 'Caso abierto', inventario,
        rol: this.rolDeUsuario(usuario), garantia: codigoCaso });
    this.registrarCierreConEvidencia('Garantía', codigoCaso, id, usuario, inventario);
    return null;
  }

  // ---------- Documentos, firmas y reporte final ----------
  /** Divide «Nombre — Rol» en sus partes. */
  private nombreRol(texto: string): { nombre: string; rol: string } {
    const [nombre, rol] = texto.split('—').map((x) => x.trim());
    return { nombre: nombre || texto, rol: rol || '' };
  }

  /**
   * Firmas simuladas del proceso para la sección «Firmas registradas» y los documentos
   * descargables. Se DERIVAN de los datos reales (F0288, F0302, entrega, conformidad y
   * reporte final), no se almacenan aparte: así nunca quedan desincronizadas. Si el usuario
   * final marcó «No estoy conforme», su firma de aceptación queda como No aplica.
   */
  firmasDeProceso(id: string): FirmaProceso[] {
    const firmas: FirmaProceso[] = [];
    const tec = this.expTecnicoDe(id);
    if (tec) {
      const prep = this.preparacionPorCodigo(tec.codigo);
      const capturada = prep?.estado === 'Completada' || tec.estado === 'Preparado';
      const { nombre, rol } = this.nombreRol(tec.tecnicoPreparacion);
      firmas.push({
        documento: 'F0288', rotulo: 'Técnico que preparó el equipo', nombre, rol: rol || 'Técnico de preparación',
        fecha: capturada ? (prep?.firma.fecha || tec.fecha) : '', hora: (capturada && prep?.firma.hora) || '',
        estado: capturada ? 'Capturada' : 'Pendiente',
        detalle: capturada ? 'Firmada electrónicamente al generar el F0288 (firma simulada)' : 'Se captura al generar el F0288'
      });
    }
    const conf = this.configuracionDe(id);
    if (conf) {
      const capturada = conf.firmas.configuro.estado === 'Firmado';
      const { nombre, rol } = this.nombreRol(conf.tecnico);
      firmas.push({
        documento: 'F0302', rotulo: 'Técnico que configuró / instaló', nombre, rol: rol || 'Técnico de configuración',
        fecha: capturada ? (conf.firmas.configuro.fecha || conf.fecha) : '', hora: (capturada && conf.firmas.configuro.hora) || '',
        estado: capturada ? 'Capturada' : 'Pendiente',
        detalle: capturada ? 'Firmada electrónicamente al generar el F0302 (firma simulada)' : 'Se captura al generar el F0302'
      });
    }
    const e = this.entregaDe(id);
    if (e) {
      const { nombre, rol } = this.nombreRol(e.tecnicoEntrega);
      firmas.push({
        documento: 'Entrega y aceptación', rotulo: 'Responsable de entrega', nombre, rol: rol || 'Responsable de entrega',
        fecha: e.fechaEntrega, hora: '', estado: 'Capturada',
        detalle: 'Registrada al entregar el equipo y enviar el formulario de conformidad'
      });
    }
    const c = this.conformidades().find((x) => x.expediente === id);
    if (c) {
      const acepto = c.estado === 'Aceptado';
      const noConforme = c.estado === 'No conforme';
      firmas.push({
        documento: 'Entrega y aceptación', rotulo: 'Conformidad del usuario final',
        nombre: (acepto && c.firmaUsuarioFinal) || c.usuarioFinal, rol: `Usuario final · ${c.correo}`,
        fecha: c.fechaRespuesta ? c.fechaRespuesta.slice(0, 10) : '',
        hora: c.fechaRespuesta ? c.fechaRespuesta.slice(11, 16) : '',
        estado: acepto ? 'Capturada' : (noConforme ? 'No aplica' : 'Pendiente'),
        detalle: acepto
          ? 'Firma de conformidad simulada, capturada al aceptar la recepción del equipo'
          : noConforme
            ? 'El usuario final registró inconformidad: no se genera firma de aceptación'
            : 'Se captura cuando el usuario final acepta el equipo mediante el formulario externo'
      });
    }
    const rep = this.documentos().find((d) => d.tipo === 'Reporte final' && d.expediente === id);
    if (rep) {
      const { nombre, rol } = this.nombreRol(rep.generadoPor);
      firmas.push({
        documento: 'Reporte final', rotulo: 'Responsable del reporte final', nombre, rol: rol || 'Encargado de Soporte',
        fecha: rep.fecha, hora: '', estado: 'Capturada',
        detalle: 'Consolida las firmas capturadas durante todo el proceso'
      });
    }
    return firmas;
  }

  generarReporteFinal(id: string, usuario: string): boolean {
    const conf = this.conformidades().find((c) => c.expediente === id);
    if (!conf || conf.estado !== 'Aceptado') return false;
    this.documentos.update((list) => [...list, { tipo: 'Reporte final', expediente: id, generadoPor: usuario, fecha: this.hoy(), hash: this.hash() }]);
    this.setEstadoSolicitud(id, 'Cerrado', 'Ninguno');
    this.actualizarAnexo(id, 'Reporte final de auditoría', 'Generado', 'Consolida el expediente completo');
    // El cierre es de auditoría: el expediente sigue disponible para casos de garantía
    // mientras la garantía esté vigente.
    this.expedientesUnicos.update((list) =>
      list.map((x) => (x.expediente === id ? { ...x, estado: 'Cerrado', resumenEstado: 'Cerrado · Auditoría completa · Disponible para garantía' } : x))
    );
    this.registrarEvento(id, usuario, 'Reporte final de auditoría generado; el expediente sigue disponible para garantía', 'Cerrado', '', true,
      { modulo: 'Reporte final de auditoría', estadoAnterior: 'Entregado', inventario: conf.inventario,
        expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: conf.usuarioFinal });
    return true;
  }
}
