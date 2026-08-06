import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import {
  AccesorioCatalogoInstitucional, AccesorioVerificado, AccionPosteriorDescargo, AccionRequeridaFalla, Asignacion, CasoGarantia, ChecklistItem, ChecklistSeccion, CierreTecnico,
  ComentarioCaso, Conformidad, ConfiguracionF0302, ConsultaInventario, CorreccionNoConformidad, Cronometro, Descargo,
  DetalleFallaF0302, DocumentoGenerado, Entrega, Equipo, EquipoCatalogoInstitucional, EvidenciaReproceso, FilaValidacionLote,
  EstadoAsignacionEquipo, EstadoIncidenciaF0302, EstadoPreparacionEquipo, EstadoSolicitudReservaIP, EtapaSoftware, EventoTrazabilidad, ExpedienteTecnico, ExpedienteUnico, FallaF0302,
  FirmaProceso, FirmaReproceso, Garantia, IngresoHardware, IntentoAceptacion, ItemReproceso, MotivoDescargo, MotivoIngreso, MotivoSoftwareF0302, PreparacionF0288,
  ReprocesoF0288, ResultadoConsultaAccesorio, RespuestaSiNo, ResultadoIntento, ResultadoReproceso, RolClave, SeccionOculta, Solicitud, SoftwareCatalogo,
  SoftwareF0302, SoftwareHeredadoF0288, SolicitudReservaIP, SugerenciaReproceso,
  TipoComentarioCaso, TipoCorreccion, TipoExpedienteTecnico, TipoFallaF0302, UsuarioSistema, VerificacionAccesorios,
  VerificacionFalla
} from '../models/models';
import { AuthService } from './auth.service';

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
    if (this.hidratarDesdeLocalStorage()) {
      // El catálogo de software SÍ viaja dentro de la foto guardada (es administrable); si una
      // foto anterior a esta funcionalidad no lo trae, se siembra aparte desde el JSON original.
      if (this.catalogoSoftware().length === 0) {
        this.http.get<SoftwareCatalogo[]>('assets/data/catalogo-software.json')
          .subscribe((c) => this.catalogoSoftware.set(this.normalizarCatalogoSoftware(c)));
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
      this.garantias.set(r.garantias);
      this.documentos.set(r.documentos);
      this.eventos.set(r.eventos);
      this.ingresosHardware.set(r.ingresos);
      this.descargos.set(r.descargos);
      this.reprocesos.set(this.normalizarReprocesos(r.reprocesos ?? []));
      this.catalogoSoftware.set(this.normalizarCatalogoSoftware(r.catalogoSoftware));
      // No hay JSON semilla de intentos/correcciones: el flujo de no conformidad se genera
      // durante la demostración y se conserva luego en localStorage. Se siembra un intento
      // inicial por cada conformidad ya existente para que el estado de aceptación sea coherente.
      this.intentos.set([]);
      this.correcciones.set([]);
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
      this.garantias.set(d.garantias ?? []);
      this.documentos.set(d.documentos ?? []);
      this.eventos.set(d.eventos ?? []);
      this.ingresosHardware.set(d.ingresosHardware ?? []);
      this.descargos.set(d.descargos ?? []);
      this.intentos.set(d.intentos ?? []);
      this.correcciones.set(d.correcciones ?? []);
      this.reprocesos.set(this.normalizarReprocesos(d.reprocesos ?? []));
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
  /** Corrección abierta (Iniciada) del proceso, si hay una en curso. */
  correccionActivaDe(id: string): CorreccionNoConformidad | undefined {
    return this.correccionesDe(id).find((c) => c.estado === 'Iniciada');
  }
  /**
   * Corrección lista para habilitar «Reenviar formulario de aceptación».
   *  - Caso A (no requiere nuevo Expediente técnico): basta con que la corrección esté Finalizada.
   *  - Caso B (requiere nuevo Expediente técnico): además de finalizada, la revisión técnica debe
   *    estar completa, es decir, el nuevo Expediente técnico ya está «Preparado» (nuevo F0288 generado).
   */
  correccionListaParaReenvio(id: string): CorreccionNoConformidad | undefined {
    if (this.estadoAceptacion(id) !== 'No conforme') return undefined;
    const ultimo = this.ultimoIntento(id);
    const cor = this.correccionesDe(id).find((c) => c.estado === 'Finalizada' && c.intentoNumero === ultimo?.numero);
    if (!cor) return undefined;
    if (cor.requiereNuevoExpediente && !this.revisionTecnicaCompleta(cor)) return undefined;
    return cor;
  }
  /** Caso B: la revisión técnica está completa cuando su nuevo Expediente técnico ya quedó «Preparado». */
  revisionTecnicaCompleta(cor: CorreccionNoConformidad): boolean {
    if (!cor.requiereNuevoExpediente) return true;
    const codigo = cor.expedienteTecnicoNuevo;
    if (!codigo) return false;
    const et = this.expedientesTecnicos().find((x) => x.codigo === codigo);
    return et?.estado === 'Preparado';
  }
  /** Caso B en curso: hay una corrección que requiere nuevo Expediente técnico cuya revisión aún no termina. */
  revisionTecnicaPendiente(id: string): CorreccionNoConformidad | undefined {
    return this.correccionesDe(id).find((c) => c.requiereNuevoExpediente && !this.revisionTecnicaCompleta(c) &&
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
  /** true mientras hay una revisión técnica en Hardware por inconformidad abierta para el equipo. */
  revisionHardwarePorInconformidad(inventario: string): boolean {
    const eq = this.equipoDe(inventario);
    if (!eq?.expediente) return false;
    const cor = this.correccionActivaDe(eq.expediente);
    return !!cor && cor.reingresoHardware;
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
    // Excepción: revisión técnica por inconformidad (Caso B). El equipo volvió a Hardware SIN
    // descargo (aún no fue aceptado formalmente), por lo que la asignación sigue vigente; aun así
    // se permite crear un nuevo Expediente técnico para la revisión mientras la corrección esté abierta.
    if (this.revisionHardwarePorInconformidad(inventario)) return hayReingresoPendiente;
    // Ya NO hay excepción por falla en F0302: una falla del mismo ciclo se atiende con un reproceso
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
        software: (resto.software ?? []).map((s) => ({
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

    this.registrarEvento(inv, usuario, `Equipo encontrado en base institucional simulada (${inv})`, 'Encontrado',
      `Resultado de la consulta: encontrado · ${etiqueta} ${ficha.marca} ${ficha.modelo}, serie ${ficha.serie}.`, false,
      { modulo: 'Inventario de Hardware', estadoAnterior: 'Fuera de inventario', inventario: inv });

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
      ultimaActualizacion: ficha.ultimaActualizacion
    }, usuario);
    if (error) return error;
    this.registrarEvento(ficha.inventario, usuario,
      `Datos autocompletados desde base institucional simulada para el equipo ${ficha.inventario}`,
      'Pendiente de preparación',
      `${ficha.tipo === 'Desktop' ? 'CPU / Desktop' : 'Laptop'} ${ficha.marca} ${ficha.modelo} · serie ${ficha.serie} · ${ficha.procesador} · ${ficha.ram} · ${ficha.almacenamiento}. Dato institucional actualizado al ${ficha.ultimaActualizacion}; no se tecleó ningún campo a mano.`,
      false,
      { modulo: 'Inventario de Hardware', estadoAnterior: 'Fuera de inventario', inventario: ficha.inventario });
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
  /** Clasificación de la carga laboral según la cantidad de expedientes técnicos activos. */
  cargaLaboral(nombreTecnico: string): 'Baja' | 'Media' | 'Alta' {
    const n = this.expedientesActivosDeTecnico(nombreTecnico).length;
    return n >= 6 ? 'Alta' : n >= 3 ? 'Media' : 'Baja';
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
    const carga = this.cargaLaboral(tecnico.nombre);
    const activos = this.expedientesActivosDeTecnico(tecnico.nombre).length;
    const pendientes = this.expedientesPendientesPorPreparar(tecnico.nombre).length;
    this.registrarEvento(`TECNICO-${tecnico.usuario}`, `${usuario.nombre} — ${usuario.rol}`,
      `Detalle de técnico consultado: ${tecnico.nombre}`, 'Consulta realizada',
      `Unidad: ${tecnico.unidad}. Carga laboral: ${carga} (${activos} activos, ${pendientes} pendientes por preparar).`,
      false, { modulo: 'Expediente técnico' });
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
  }): string | Descargo {
    const eq = this.equipoDe(datos.inventario);
    if (!eq) return 'No se encontró el equipo indicado.';
    const asig = this.asignacionDeEquipo(datos.inventario);
    if (!asig) return 'Este equipo no tiene una asignación vigente: no hay nada que descargar.';
    if (this.estadoAceptacion(asig.expediente) !== 'Aceptado' || !this.garantiaDe(asig.expediente)) {
      return 'No se puede registrar el descargo: el equipo debe tener la aceptación del usuario final y la garantía habilitada.';
    }

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
      estadoFisico: datos.estadoFisico, observaciones: datos.observaciones,
      expedienteUnicoAnterior: expUnico?.codigoUnico,
      accionPosterior: datos.accionPosterior, encargadoDestino: this.responsableOperativo(eq),
      estado: 'Procesado'
    };
    this.descargos.update((list) => [nuevo, ...list]);

    // Cierra la asignación vigente (sin borrarla): es el mecanismo central del ciclo múltiple.
    this.asignaciones.update((list) =>
      list.map((a) => (a.expediente === asig.expediente ? { ...a, vigente: false, estado: 'Descargada' } : a)));

    this.registrarEvento(asig.expediente, datos.responsableRegistro,
      `Equipo ${datos.inventario} descargado del usuario final por el Técnico de Soporte (${datos.motivoDescargo})`,
      'Descargado', datos.observaciones, true,
      { modulo: 'Descargo', estadoAnterior: 'Asignado', inventario: datos.inventario, usuarioFinal: asig.usuarioFinal });

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
    const carga = this.cargaLaboral(nombreTecnico);
    const pendientes = this.expedientesPendientesPorPreparar(nombreTecnico).length;
    const detalleCarga = `Carga laboral del técnico al asignar: ${carga} (${this.expedientesActivosDeTecnico(nombreTecnico).length} activos, ${pendientes} pendientes por preparar).`;

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
    // Caso B (no conformidad con revisión técnica): enlaza este Expediente técnico con la corrección
    // abierta que lo originó y registra que fue creado por inconformidad (spec §3, §6, §7).
    const proceso = this.equipoDe(eq.inventario)?.expediente ?? this.asignacionDeEquipo(eq.inventario)?.expediente ?? '';
    const cor = proceso ? this.correccionActivaDe(proceso) : undefined;
    if (cor && cor.requiereNuevoExpediente && !cor.expedienteTecnicoNuevo) {
      this.correcciones.update((list) =>
        list.map((c) => (c.id === cor.id ? { ...c, expedienteTecnicoNuevo: nuevo.codigo } : c)));
      this.registrarEvento(cor.expediente, datos.creadoPor,
        `Nuevo Expediente técnico ${nuevo.codigo} creado por inconformidad`, 'En preparación',
        `Motivo: ${cor.tipo}. Relacionado con el intento de aceptación no conforme #${cor.intentoNumero}.`, true,
        { modulo: 'Expediente técnico', estadoAnterior: 'Pendiente de revisión técnica', inventario: eq.inventario,
          expedienteTecnico: nuevo.codigo, expedienteUnico: this.expedienteUnicoDe(cor.expediente)?.codigoUnico });
    }
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
        { nombre: 'Servicio de garantía de un mes', detalle: 'Inicia con la aceptación del usuario final', estado: 'No iniciada', fecha: '' },
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
      const software: SoftwareF0302[] = [
        // El Agente DLP es control de seguridad institucional: no se da por configurado sin captura.
        actividad('Agente DLP', 'Corporativo', 'Seguridad', true),
        actividad('Ingreso a dominio', 'Dominio institucional', 'Red'),
        actividad('Credenciales: nombre de equipo · cuenta de red', 'Según SISSOR', 'Red')
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
  registrarEvidenciaItemF0288(codigoTec: string, seccion: string, item: string, archivo: string, usuario: string): string | null {
    const captura = archivo.trim();
    if (!captura) return 'Indique la captura de evidencia: nombre del archivo o número de referencia.';
    const p = this.preparacionPorCodigo(codigoTec);
    if (!p) return 'No se encontró la preparación técnica indicada.';
    if (p.estado === 'Completada') return 'Esta preparación ya fue finalizada; su evidencia no se puede modificar.';
    if (p.estado === 'Cerrada') return 'Esta preparación quedó cerrada por un descargo del equipo y ya no puede reutilizarse.';
    const actual = p.secciones.find((s) => s.titulo === seccion)?.items.find((i) => i.nombre === item);
    if (!actual) return 'No se encontró el ítem del checklist indicado.';
    if (actual.estado !== 'Realizado') return `Marque «${item}» en el checklist antes de registrar su captura de evidencia.`;
    const etiqueta = this.etiquetaEvidencia(item);
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
      { modulo: 'Preparación técnica F0288', inventario: p.datosGenerales.inventario, expedienteTecnico: codigoTec });
    return null;
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
    // Antivirus y OCS Inventory no se pueden dar por instalados sin su captura: es el respaldo
    // técnico del F0288 y bloquea tanto el cierre como la generación del documento.
    const sinCaptura = p.secciones.flatMap((s) => s.items)
      .find((i) => i.requiereEvidencia && i.estado === 'Realizado' && !i.evidencia?.trim());
    if (sinCaptura) {
      return `Debe agregar la captura de evidencia de ${this.etiquetaEvidencia(sinCaptura.nombre)} para finalizar la preparación.`;
    }
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
    this.documentos.update((list) => [...list, { tipo: 'F0288', expediente: codigoTec, generadoPor: usuario, fecha: this.hoy(), hash: this.hash() }]);
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
  marcarSoftwareF0302(id: string, nombre: string, estado: 'Realizado' | 'Pendiente', usuario: string): void {
    let codigoSoftware: string | undefined;
    let eraRealizado = false;
    let exigeCaptura = false;
    this.actualizarConfiguracionActiva(id, (c) => ({
      ...c, software: c.software.map((s) => {
        if (s.nombre !== nombre) return s;
        codigoSoftware = s.codigoSoftware;
        eraRealizado = s.estado === 'Realizado';
        exigeCaptura = !!s.requiereEvidencia;
        // Al desmarcar un ítem con captura obligatoria, la captura deja de tener sentido: se limpia.
        const evidencia = s.requiereEvidencia && estado !== 'Realizado' ? null : s.evidencia;
        if (!s.codigoSoftware) return { ...s, estado, evidencia };
        const vigente = this.softwareCatalogoDe(s.codigoSoftware)?.versionVigente ?? '';
        return estado === 'Realizado'
          ? { ...s, estado, evidencia, version: s.version || vigente }
          : { ...s, estado, evidencia, version: '' };
      }),
      evidencias: exigeCaptura && estado !== 'Realizado'
        ? c.evidencias.map((e) => (e.item === nombre
            ? { nombre: e.nombre, estado: 'Pendiente', item: e.item, tipo: e.tipo, formulario: e.formulario }
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
    const alcanza = (s: SoftwareF0302) => s.origen === 'Configuración' && s.categoria === categoria;
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
  registrarEvidenciaSoftwareF0302(id: string, nombre: string, archivo: string, usuario: string): string | null {
    const captura = archivo.trim();
    if (!captura) return 'Indique la captura de evidencia: nombre del archivo o número de referencia.';
    const c = this.configuracionDe(id);
    if (!c) return 'No se encontró la configuración indicada.';
    if (c.estado === 'Completada') return 'La configuración ya fue finalizada; su evidencia no se puede modificar.';
    if (c.estado === 'Con falla') return 'Esta configuración quedó con falla y el equipo volvió a F0288. Inicie una nueva configuración F0302.';
    if (c.estado === 'Cerrada') return 'Esta configuración quedó cerrada por un descargo del equipo y ya no puede reutilizarse.';
    const item = c.software.find((s) => s.nombre === nombre);
    if (!item) return 'No se encontró el ítem del checklist indicado.';
    if (item.estado !== 'Realizado') return `Marque «${nombre}» en el checklist antes de registrar su captura de evidencia.`;

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
    // Ítems que no se dan por configurados sin captura (Agente DLP). Vale igual si se marcaron con
    // el checkbox «Seleccionar todo» de la categoría: la validación es sobre el ítem, no sobre cómo
    // se marcó.
    const sinCaptura = this.itemsSinCapturaF0302(c)[0];
    if (sinCaptura) {
      return `Debe agregar la captura de evidencia del ${sinCaptura.nombre} para finalizar la configuración.`;
    }
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
    this.documentos.update((list) => [...list, { tipo: 'F0302', expediente: id, generadoPor: usuario, fecha: this.hoy(), hash: this.hash() }]);
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
   * Valida el checklist dinámico antes de registrar la falla: solo exige los campos del tipo
   * seleccionado, y pide justificación cuando el técnico se aparta de la sugerencia del sistema
   * (en cualquiera de las dos direcciones) o cuando decide un reproceso que el sistema no dedujo.
   */
  validarFalla(datos: {
    tipo: TipoFallaF0302; descripcion: string; requiereReprocesoF0288: boolean;
    justificacionReproceso?: string; detalle?: DetalleFallaF0302;
  }): string | null {
    const d = datos.detalle ?? {};
    const t = datos.tipo;
    if (!datos.descripcion.trim()) return 'La observación / descripción de la falla es obligatoria.';
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
      return `El sistema sugiere «${sugerida}» en «¿Requiere reproceso de Preparación F0288?» para este tipo de falla: justifique el cambio antes de registrarla.`;
    }
    // «Otro» y «Configuración incompleta» quedan en manos del técnico: si decide el reproceso, la
    // justificación es lo único que deja constancia de por qué el equipo vuelve a preparación.
    if (sugerida === 'Depende' && datos.requiereReprocesoF0288 && !just) {
      return 'Registre la justificación del reproceso de Preparación F0288.';
    }
    return null;
  }

  /** Texto legible de los estados técnicos de la incidencia (spec §9), para mostrarlos sin jerga. */
  textoEstadoIncidencia(estado: EstadoIncidenciaF0302): string {
    switch (estado) {
      case 'INCIDENCIA_CONFIGURACION_REGISTRADA': return 'Incidencia de configuración registrada';
      case 'PENDIENTE_CORRECCION_SOPORTE': return 'Pendiente de corrección de Soporte';
      case 'PENDIENTE_REVISION_HARDWARE': return 'Pendiente de revisión de Hardware';
      case 'REPROCESO_F0288_REQUERIDO': return 'Reproceso F0288 requerido';
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
      prioridad: r.prioridad ?? 'Normal',
      unidadAtiende: r.unidadAtiende ?? 'Hardware',
      justificacionUnidad: r.justificacionUnidad ?? '',
      observacionSoporte: r.observacionSoporte ?? r.motivo ?? '',
      evidenciaSoporte: r.evidenciaSoporte ?? '',
      tecnicoAsignado: r.tecnicoAsignado ?? r.atendidoPor ?? '',
      asignadoPor: r.asignadoPor ?? '',
      fechaAsignacion: r.fechaAsignacion ?? '',
      horaAsignacion: r.horaAsignacion ?? '',
      checklist: r.checklist?.length ? r.checklist : this.checklistReproceso(r.tipoFalla),
      evidencias: r.evidencias ?? [],
      resultado: r.resultado ?? '',
      observacionResultado: r.observacionResultado ?? ''
    }));
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
   * Reprocesos visibles según el rol. El Técnico de Hardware ve los suyos y los que todavía no
   * tienen dueño (para poder tomarlos); los Encargados y el Administrador ven todos; el Técnico de
   * Soporte solo ve los de los procesos donde participó, porque son los que está esperando.
   */
  reprocesosVisibles(): ReprocesoF0288[] {
    const clave = this.claveConectada();
    const nombre = this.nombreConectado();
    const todos = this.reprocesos();
    if (clave === 'tec-hardware') {
      return todos.filter((r) => !r.tecnicoAsignado || r.tecnicoAsignado.includes(nombre));
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
    observacionTecnica?: string; evidencia?: string;
  }, usuario: string): string | null {
    const c = this.configuracionDe(id);
    if (!c) return 'No se encontró la configuración indicada.';
    if (c.estado === 'Con falla') return 'Esta configuración ya fue reportada con falla.';
    if (c.estado === 'Completada') return 'La configuración ya fue finalizada; no puede reportarse una falla.';
    if (c.estado === 'Cerrada') return 'Esta configuración quedó cerrada por un descargo del equipo.';
    if (!c.cronometro) return 'Inicie la configuración (cronómetro en curso) antes de reportar una falla.';
    const invalido = this.validarFalla(datos);
    if (invalido) return invalido;

    const detalle: DetalleFallaF0302 = { ...(datos.detalle ?? {}) };
    const reproceso = datos.requiereReprocesoF0288;
    const hardware = this.fallaRequiereHardware(datos.tipo, detalle);
    const crono = this.detenerCronometro(c.cronometro, usuario);
    const estadoIncidencia: EstadoIncidenciaF0302 = reproceso
      ? 'REPROCESO_F0288_REQUERIDO'
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
      requiereReproceso: reproceso ? 'Sí' : 'No', evidencia: falla.evidencia
    };
    const accion = reproceso ? 'Reproceso F0288 dentro del mismo Expediente técnico'
      : hardware ? 'Revisión de Hardware sin reproceso F0288' : 'Corrección de Soporte en el mismo F0302';

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
    this.registrarEvento(id, usuario, `Cronómetro F0302 detenido por falla (tiempo trabajado: ${tiempo || 'menos de 1 min'})`,
      'F0302 con falla', '', false, { ...ref, tiempo });
    this.registrarEvento(id, usuario, 'F0302 guardado como intento con falla', 'F0302 con falla',
      'El intento se conserva en el historial: no se borra ni se reinician los contadores.', false, { ...ref, accionTomada: accion });
    this.registrarEvento(id, usuario, 'Incidencia de configuración registrada', this.textoEstadoIncidencia(estadoIncidencia),
      `Asociada al Expediente técnico ${codigoTec ?? '—'} y al Expediente único ${unicoCod ?? '—'}: no se crea un Expediente técnico nuevo.`,
      true, { ...ref, accionTomada: accion });

    if (reproceso) {
      const r = this.abrirReprocesoF0288(c, falla, usuario, codigoTec, unicoCod);
      this.actualizarConfiguracionConFalla(id, (f) => ({ ...f, reprocesoId: r.id }));
      this.registrarEvento(id, usuario, 'Equipo enviado a reproceso F0288', 'Reproceso F0288 requerido',
        `Reproceso ${r.id} sobre el Expediente técnico ${r.expedienteTecnico}; el F0288 original se conserva.`,
        true, { ...ref, accionTomada: accion, reproceso: r.id });
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
   * Checklist de Reproceso F0288 según el tipo de falla reportado en F0302. Es un checklist
   * PROPIO, no una copia del F0288: la preparación inicial ya se hizo y no se repite. Los ítems
   * marcados `implicaCorreccion` son los que dejan de ser revisión y pasan a ser intervención
   * sobre el equipo; en cuanto uno de ellos se marca, la evidencia deja de ser opcional.
   */
  checklistReproceso(tipo: TipoFallaF0302): ItemReproceso[] {
    const item = (nombre: string, implicaCorreccion = false): ItemReproceso =>
      ({ nombre, estado: 'Pendiente', implicaCorreccion, nota: '' });
    switch (tipo) {
      case 'Falla física del equipo':
        return [item('Revisión física general del equipo'), item('Verificación de carcasa, puertos y conectores'),
          item('Verificación de encendido'), item('Verificación de componentes internos'),
          item('Corrección aplicada', true), item('Evidencia de revisión física')];
      case 'Falla de disco':
        return [item('Verificación del disco instalado'), item('Revisión de conexión del disco'),
          item('Diagnóstico básico del disco'), item('Cambio de disco, si aplica', true),
          item('Verificación de arranque'), item('Evidencia del diagnóstico o cambio')];
      case 'Falla de memoria':
        return [item('Verificación de memoria RAM instalada'), item('Limpieza o reinstalación de módulo RAM', true),
          item('Prueba básica de memoria'), item('Cambio de memoria, si aplica', true),
          item('Verificación de estabilidad'), item('Evidencia del diagnóstico o cambio')];
      case 'Problema de sistema operativo':
        return [item('Revisión del sistema operativo instalado'), item('Reparación del sistema operativo, si aplica', true),
          item('Reinstalación de Windows, si aplica', true), item('Actualizaciones aplicadas'),
          item('.NET Framework 3.5 verificado'), item('Evidencia de corrección')];
      case 'Problema de red':
        // Un problema de red solo llega a reproceso cuando Soporte marcó revisión física: por eso
        // el checklist es el de la revisión física y no el de conectividad, que ya se descartó.
        return [item('Revisión de puerto de red'), item('Verificación de adaptador de red'),
          item('Verificación de cable o conexión física'), item('Validación de MAC del equipo'),
          item('Evidencia de revisión de red')];
      case 'Accesorio faltante':
        return [item('Verificación de accesorios requeridos'), item('Asociación de accesorio faltante', true),
          item('Validación de inventario del accesorio'), item('Estado físico del accesorio'),
          item('Evidencia de accesorio asociado')];
      default:
        // Base para «Otro», «No permite ingreso a dominio» y «Configuración incompleta».
        return [item('Revisión técnica del caso'), item('Diagnóstico realizado'),
          item('Corrección aplicada', true), item('Prueba posterior a la corrección'),
          item('Evidencia de corrección')];
    }
  }

  /**
   * Técnicos de Hardware con su carga de trabajo, para el buscador del rollback. La carga cuenta
   * las preparaciones F0288 sin cerrar y los reprocesos abiertos que ya tiene asignados: son las
   * dos cosas que ocupan realmente a un técnico de Hardware.
   */
  tecnicosHardwareConCarga(): { usuario: UsuarioSistema; nombreRol: string; preparaciones: number; reprocesos: number; total: number; carga: string }[] {
    return this.usuarios()
      .filter((u) => u.clave === 'tec-hardware' && u.estado !== 'Inactivo')
      .map((usuario) => {
        const nombreRol = `${usuario.nombre} — ${usuario.rol}`;
        const preparaciones = this.preparaciones()
          .filter((p) => p.tecnico.includes(usuario.nombre) && p.estado !== 'Completada' && p.estado !== 'Cerrada').length;
        const reprocesos = this.reprocesos()
          .filter((r) => r.tecnicoAsignado.includes(usuario.nombre) && r.estado !== 'Firmado' && r.estado !== 'No corregido').length;
        const total = preparaciones + reprocesos;
        return { usuario, nombreRol, preparaciones, reprocesos, total,
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
   * Abre el reproceso F0288 de una falla **sobre el Expediente técnico que el equipo ya tiene**.
   * El correlativo (`…-R1`, `…-R2`) es por expediente técnico: así el historial se lee como
   * «F0288 #1 → F0302 #1 con falla → Reproceso F0288 #1 → F0302 #2» sin multiplicar expedientes.
   * Nace sin técnico asignado: el rollback a Hardware es un paso propio y con nombre.
   */
  private abrirReprocesoF0288(c: ConfiguracionF0302, falla: FallaF0302, usuario: string,
    codigoTec?: string, unicoCod?: string): ReprocesoF0288 {
    const tecnico = codigoTec ?? this.expTecnicoDeEquipo(c.datos.inventario)?.codigo ?? c.datos.inventario;
    const numero = this.reprocesosDeExpTecnico(tecnico).length + 1;
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
      tecnicoAsignado: '', asignadoPor: '', fechaAsignacion: '', horaAsignacion: '',
      atendidoPor: '', fechaInicio: '', fechaFin: '', cronometro: undefined,
      checklist: this.checklistReproceso(falla.tipo),
      evidencias: [], correccionTecnica: '',
      observaciones: falla.detalle?.observacionHardware ?? '',
      firma: undefined, resultado: '', observacionResultado: '', estado: 'Requerido'
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
      resultadoReproceso: r.resultado || 'Pendiente', firmaRegistrada: r.firma ? 'Sí' : 'No'
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
  asegurarReprocesoDeFalla(id: string, usuario: string): ReprocesoF0288 | undefined {
    const conFalla = this.configuracionesConFallaDe(id)[0];
    if (!conFalla?.falla) return undefined;
    const existente = conFalla.falla.reprocesoId ? this.reprocesoDe(conFalla.falla.reprocesoId) : undefined;
    if (existente) return existente;
    const r = this.abrirReprocesoF0288(conFalla, conFalla.falla, usuario,
      this.expTecnicoDeEquipo(conFalla.datos.inventario)?.codigo, this.expedienteUnicoDe(id)?.codigoUnico);
    this.actualizarConfiguracionConFalla(id, (f) => ({ ...f, reprocesoId: r.id }));
    return r;
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
    if (r.estado !== 'Requerido' && r.estado !== 'Asignado') {
      return 'El reproceso F0288 ya fue iniciado: no puede reasignarse.';
    }
    if (!tecnico.trim()) return 'Seleccione el Técnico de Hardware que atenderá el reproceso.';
    const esHardware = this.tecnicosHardwareConCarga().some((t) => t.nombreRol === tecnico.trim());
    const clave = this.claveConectada();
    const esEncargado = clave === 'enc-hardware' || clave === 'enc-soporte' || clave === 'admin';
    if (!esHardware) {
      if (!esEncargado) return 'El reproceso F0288 debe asignarse a un Técnico de Hardware. Solo un Encargado puede autorizar una excepción.';
      if (!justificacion.trim()) return 'Justifique por qué este reproceso se asigna fuera de la Unidad de Hardware.';
    }
    this.actualizarReproceso(idReproceso, (x) => ({
      ...x, estado: 'Asignado', tecnicoAsignado: tecnico.trim(), asignadoPor: usuario,
      fechaAsignacion: this.hoy(), horaAsignacion: this.hora(),
      unidadAtiende: esHardware ? 'Hardware' : 'Soporte',
      justificacionUnidad: esHardware ? '' : justificacion.trim()
    }));
    this.actualizarConfiguracionConFalla(r.expediente, (f) => ({ ...f, estadoIncidencia: 'REPROCESO_F0288_ASIGNADO' }));
    const actualizado = this.reprocesoDe(idReproceso)!;
    this.registrarEvento(r.expediente, usuario, 'Rollback realizado a Hardware', 'Reproceso F0288 asignado',
      `El equipo ${r.inventario} regresa a la Unidad de ${actualizado.unidadAtiende} por ${r.tipoFalla}.`, true,
      { ...this.refReproceso(actualizado), accionTomada: 'Rollback a Hardware' });
    this.registrarEvento(r.expediente, usuario, 'Reproceso asignado a Técnico de Hardware', 'Reproceso F0288 asignado',
      esHardware
        ? `${r.id} asignado a ${tecnico.trim()}.`
        : `${r.id} asignado a ${tecnico.trim()} fuera de Hardware. Justificación del Encargado: ${justificacion.trim()}`,
      true, { ...this.refReproceso(actualizado), accionTomada: 'Asignación del reproceso F0288',
        justificacion: actualizado.justificacionUnidad });
    return null;
  }

  /** El Técnico de Hardware toma el reproceso: arranca el cronómetro del tiempo trabajado. */
  iniciarReprocesoF0288(idReproceso: string, usuario: string): string | null {
    const r = this.reprocesoDe(idReproceso);
    if (!r) return 'No se encontró el reproceso F0288 indicado.';
    if (r.estado === 'Requerido') return 'Asigne el reproceso F0288 a un Técnico de Hardware antes de iniciarlo.';
    if (r.estado === 'En proceso') return 'Este reproceso F0288 ya está en proceso.';
    if (r.estado !== 'Asignado') return 'Este reproceso F0288 ya fue finalizado.';
    this.actualizarReproceso(idReproceso, (x) => ({
      ...x, estado: 'En proceso', atendidoPor: usuario, fechaInicio: this.hoy(),
      cronometro: { fechaInicio: this.hoy(), horaInicio: this.horaCrono(), iniciadoPor: usuario,
        fechaFin: '', horaFin: '', finalizadoPor: '', duracionMinutos: null }
    }));
    this.actualizarConfiguracionConFalla(r.expediente, (f) => ({ ...f, estadoIncidencia: 'REPROCESO_F0288_EN_PROCESO' }));
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
    this.actualizarReproceso(idReproceso, (x) => ({
      ...x, checklist: x.checklist.map((i) => (i.nombre === nombreItem ? { ...i, estado, nota: nota || i.nota } : i))
    }));
    return null;
  }

  /** Adjunta una evidencia simulada al reproceso, con el código del reproceso y su expediente. */
  agregarEvidenciaReproceso(idReproceso: string, archivo: string, tipo: string, usuario: string): string | null {
    const r = this.reprocesoDe(idReproceso);
    if (!r) return 'No se encontró el reproceso F0288 indicado.';
    if (r.estado !== 'En proceso') return 'Inicie el reproceso F0288 para adjuntar evidencias.';
    if (!archivo.trim()) return 'Indique el nombre del archivo de evidencia.';
    const evidencia: EvidenciaReproceso = {
      archivo: archivo.trim(), tipo: tipo.trim() || 'Evidencia de corrección',
      fecha: this.hoy(), hora: this.hora(), cargadaPor: usuario,
      reproceso: r.id, expedienteTecnico: r.expedienteTecnico
    };
    this.actualizarReproceso(idReproceso, (x) => ({ ...x, evidencias: [...x.evidencias, evidencia] }));
    this.registrarEvento(r.expediente, usuario, 'Evidencia de reproceso registrada', 'Reproceso F0288 en proceso',
      `${evidencia.archivo} · ${evidencia.tipo}`, false,
      { ...this.refReproceso(r), evidencia: evidencia.archivo, accionTomada: 'Evidencia adjuntada al reproceso F0288' });
    return null;
  }

  /**
   * ¿Este reproceso exige evidencia? Solo cuando se marcó algún ítem que implica cambio,
   * reparación o corrección técnica: revisar y no tocar nada no produce nada que adjuntar.
   */
  reprocesoExigeEvidencia(r: ReprocesoF0288): boolean {
    return r.checklist.some((i) => i.implicaCorreccion && i.estado === 'Realizado');
  }

  /**
   * Finaliza el trabajo técnico del reproceso: detiene el cronómetro y guarda el tiempo trabajado.
   * Exige el checklist resuelto (sin ítems pendientes), la corrección técnica y la evidencia
   * cuando hubo intervención. No lo cierra: el cierre es la firma.
   */
  finalizarReprocesoF0288(idReproceso: string, usuario: string, correccion: string, observaciones = ''): string | null {
    const r = this.reprocesoDe(idReproceso);
    if (!r) return 'No se encontró el reproceso F0288 indicado.';
    if (r.estado === 'Requerido' || r.estado === 'Asignado') return 'Inicie el reproceso F0288 antes de finalizarlo.';
    if (r.estado !== 'En proceso') return 'Este reproceso F0288 ya fue finalizado.';
    if (r.checklist.some((i) => i.estado === 'Pendiente')) {
      return 'Complete el Checklist de Reproceso F0288 antes de finalizarlo.';
    }
    if (!correccion.trim()) return 'Registre la corrección técnica realizada antes de finalizar el reproceso F0288.';
    if (this.reprocesoExigeEvidencia(r) && r.evidencias.length === 0) {
      return 'El reproceso implicó una corrección técnica: adjunte la evidencia antes de finalizarlo.';
    }
    const crono = r.cronometro ? this.detenerCronometro(r.cronometro, usuario) : undefined;
    this.actualizarReproceso(idReproceso, (x) => ({
      ...x, estado: 'Finalizado', fechaFin: this.hoy(), cronometro: crono,
      correccionTecnica: correccion.trim(), observaciones: observaciones.trim() || x.observaciones,
      atendidoPor: x.atendidoPor || usuario
    }));
    this.actualizarConfiguracionConFalla(r.expediente, (f) => ({ ...f, estadoIncidencia: 'REPROCESO_F0288_FINALIZADO' }));
    const tiempo = this.formatoDuracion(crono?.duracionMinutos ?? null);
    this.registrarEvento(r.expediente, usuario, 'Checklist de reproceso completado', 'Reproceso F0288 finalizado',
      r.checklist.map((i) => `${i.nombre}: ${i.estado}`).join(' · '), false,
      { ...this.refReproceso(r), accionTomada: 'Checklist de Reproceso F0288 completado' });
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
    const estadoReproceso = resultado === 'Corregido' ? 'Firmado' as const : 'No corregido' as const;
    this.actualizarReproceso(idReproceso, (x) => ({
      ...x, firma, resultado, observacionResultado: observacionResultado.trim(), estado: estadoReproceso
    }));
    const firmado = this.reprocesoDe(idReproceso)!;
    this.registrarEvento(r.expediente, usuario, 'Firma de Técnico de Hardware registrada',
      resultado === 'Corregido' ? 'Reproceso F0288 firmado' : 'Reproceso F0288 no corregido',
      `${firma.nombre} — ${firma.cargo} (${firma.unidad}) · ${firma.fecha} ${firma.hora} · Resultado: ${resultado}`,
      true, { ...this.refReproceso(firmado), accionTomada: 'Firma del reproceso F0288' });

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
   * Devuelve el equipo a Configuración F0302 tras el reproceso: habilita el nuevo intento. Exige
   * la firma —es la regla de «no cerrar sin firma»— y que el resultado haya sido «Corregido».
   */
  devolverAConfiguracionF0302(idReproceso: string, usuario: string): string | null {
    const r = this.reprocesoDe(idReproceso);
    if (!r) return 'No se encontró el reproceso F0288 indicado.';
    if (r.estado === 'Requerido' || r.estado === 'Asignado' || r.estado === 'En proceso') {
      return 'Finalice el reproceso F0288 antes de devolver el equipo a Configuración F0302.';
    }
    if (!r.firma) return 'Debe registrar la firma del Técnico de Hardware para finalizar el reproceso.';
    if (r.resultado !== 'Corregido') {
      return `El reproceso cerró como «${r.resultado}»: el equipo no puede volver a Configuración F0302 hasta que el Encargado lo resuelva.`;
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
    return [
      'SISGOST · Centro Nacional de Registros',
      'Constancia de Reproceso F0288',
      '='.repeat(60),
      `Código del reproceso: ${r.id}`,
      `Expediente técnico original: ${r.expedienteTecnico}`,
      `Expediente único: ${r.expedienteUnico || '—'}`,
      `Equipo: ${eq ? `${eq.marca} ${eq.modelo}` : '—'}`,
      `Número de inventario: ${r.inventario}`,
      `Tipo de falla reportada: ${r.tipoFalla}`,
      `Reportada por: ${r.solicitadoPor} · ${r.fechaSolicitud} ${r.horaSolicitud}`,
      `Observación de Soporte: ${r.observacionSoporte || '—'}`,
      `Evidencia reportada por Soporte: ${r.evidenciaSoporte || '—'}`,
      `Técnico de Hardware asignado: ${r.tecnicoAsignado || '—'}`,
      '',
      'CHECKLIST DE REPROCESO F0288',
      '-'.repeat(60),
      ...r.checklist.map((i) => `  [${i.estado === 'Realizado' ? 'X' : i.estado === 'No aplica' ? '—' : ' '}] ${i.nombre}${i.nota ? ` · ${i.nota}` : ''}`),
      '',
      'EVIDENCIAS DEL REPROCESO',
      '-'.repeat(60),
      ...(r.evidencias.length
        ? r.evidencias.map((e) => `  ${e.archivo} · ${e.tipo} · ${e.cargadaPor} · ${e.fecha} ${e.hora}`)
        : ['  Sin evidencias adjuntas (el reproceso no implicó corrección técnica).']),
      '',
      `Tiempo trabajado: ${this.formatoDuracion(r.cronometro?.duracionMinutos ?? null) || 'menos de 1 min'}`,
      `Inicio: ${r.cronometro?.fechaInicio ?? r.fechaInicio} ${r.cronometro?.horaInicio ?? ''}`.trim(),
      `Finalización: ${r.cronometro?.fechaFin ?? r.fechaFin} ${r.cronometro?.horaFin ?? ''}`.trim(),
      `Corrección técnica: ${r.correccionTecnica || '—'}`,
      `Resultado: ${r.resultado || '—'}`,
      `Observaciones: ${r.observacionResultado || r.observaciones || '—'}`,
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

  /**
   * Deja registrada la constancia del reproceso como documento del expediente. Se guarda una sola
   * vez por reproceso: volver a descargarla no genera un documento distinto ni una huella nueva.
   */
  registrarConstanciaReproceso(idReproceso: string, usuario: string): void {
    const r = this.reprocesoDe(idReproceso);
    if (!r?.firma) return;
    if (this.documentos().some((d) => d.tipo === 'Constancia de reproceso F0288' && d.reproceso === r.id)) return;
    this.documentos.update((list) => [
      ...list,
      { tipo: 'Constancia de reproceso F0288', expediente: r.expediente, reproceso: r.id,
        generadoPor: usuario, fecha: this.hoy(), hash: this.hash() }
    ]);
    this.registrarEvento(r.expediente, usuario, 'Constancia de Reproceso F0288 generada', 'Reproceso F0288 firmado',
      `Constancia interna del reproceso ${r.id} sobre el Expediente técnico ${r.expedienteTecnico}.`, false,
      { ...this.refReproceso(r), accionTomada: 'Constancia de Reproceso F0288' });
  }

  /**
   * Registra la corrección de Soporte de una falla que NO requiere reproceso F0288 (red, dominio,
   * sistema operativo sin reinstalación…). Deja el proceso listo para el nuevo intento F0302 sin
   * que el equipo haya salido del escritorio del técnico.
   */
  registrarCorreccionSoporte(id: string, usuario: string, descripcion: string): string | null {
    const conFalla = this.configuracionesConFallaDe(id)[0];
    if (!conFalla?.falla) return 'Este proceso no tiene una falla F0302 que corregir.';
    const f = conFalla.falla;
    if (f.requiereReprocesoF0288) return 'Esta falla requiere reproceso de Preparación F0288: no puede cerrarse como corrección de Soporte.';
    if (f.estadoIncidencia === 'LISTO_PARA_REINTENTO_F0302') return 'La corrección de Soporte ya fue registrada.';
    if (!descripcion.trim()) return 'Describa la corrección realizada antes de registrarla.';
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
        accionTomada: 'Corrección de Soporte en el mismo F0302' });
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
      correccionRealizada: correccion ? `${correccion.tipo} — ${correccion.descripcion || 'corrección registrada'}` : undefined
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
             : `Usuario final marcó No conforme (intento de aceptación #${nIntento})`,
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
      const inicio = new Date();
      const fin = new Date();
      fin.setMonth(fin.getMonth() + 1);
      // El Expediente único aparece automáticamente en el módulo Servicio de garantía.
      this.garantias.update((list) => [
        ...list,
        {
          expediente: id,
          equipo: conf.marcaModelo,
          inventario: conf.inventario,
          usuarioFinal: `${conf.usuarioFinal} — ${conf.unidad}`,
          fechaAceptacion: inicio.toISOString().slice(0, 10),
          fechaInicio: inicio.toISOString().slice(0, 10),
          fechaVencimiento: fin.toISOString().slice(0, 10),
          estado: 'Vigente',
          casos: [],
          nota: 'La aceptación del usuario final mediante el formulario externo inició la garantía; queda anexada al expediente único.'
        }
      ]);
      this.actualizarAnexo(id, 'Servicio de garantía de un mes', 'Vigente', 'Inició con la aceptación del usuario final');
      this.registrarEvento(id, 'Sistema', `Garantía de un mes iniciada (vence ${fin.toISOString().slice(0, 10)})`, 'Garantía vigente',
        'Anexada al expediente único del equipo.', false,
        { modulo: 'Servicio de garantía', estadoAnterior: 'Entregado', inventario: conf.inventario, usuarioFinal: conf.usuarioFinal });
      // El expediente NO se cierra: queda disponible para registrar casos de garantía.
      this.expedientesUnicos.update((list) =>
        list.map((x) => (x.expediente === id
          ? { ...x, estado: 'Aceptado', resumenEstado: 'Aceptado · Garantía vigente', fechaEntrega: this.hoy() }
          : x))
      );
      // El equipo entregado queda con la garantía habilitada.
      this.registrarEvento(id, 'Sistema', 'Equipo con garantía habilitada tras la aceptación del usuario final', 'Garantía habilitada',
        '', false, { modulo: 'Servicio de garantía', estadoAnterior: 'Pendiente de aceptación', inventario: conf.inventario, usuarioFinal: conf.usuarioFinal });
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
        { modulo: 'Entrega y aceptación', inventario: conf.inventario, usuarioFinal: conf.usuarioFinal });
      this.registrarEvento(id, 'Sistema', 'Entrega observada', 'Observada',
        'La entrega no se cierra como aceptada mientras exista una inconformidad.', false,
        { modulo: 'Entrega y aceptación', estadoAnterior: 'Pendiente de aceptación', inventario: conf.inventario, usuarioFinal: conf.usuarioFinal });
      this.registrarEvento(id, 'Sistema', 'Garantía no habilitada', 'No habilitada',
        'La garantía solo inicia con la aceptación formal del usuario final.', false,
        { modulo: 'Servicio de garantía', inventario: conf.inventario, usuarioFinal: conf.usuarioFinal });
      this.registrarEvento(id, 'Sistema', 'Expediente único pendiente de corrección', 'Pendiente de corrección',
        'El equipo queda pendiente de revisión; el Técnico de Soporte debe atender la no conformidad.', true,
        { modulo: 'Expediente único', estadoAnterior: 'En entrega', inventario: conf.inventario,
          expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: conf.usuarioFinal });
    }
  }

  // ---------- Atención de la no conformidad ----------
  /**
   * El Técnico de Soporte inicia la corrección de una no conformidad. No hay descargo (el equipo
   * nunca fue aceptado) ni reinicio de contadores. Con tipo «Revisión técnica / Hardware» el
   * equipo vuelve a Hardware para revisión (`reingresoHardware`), registrando un reingreso sin
   * descargo. Devuelve la corrección creada, o un mensaje de validación.
   */
  iniciarCorreccion(id: string, tipo: TipoCorreccion, requiereNuevoExpediente: boolean, tecnico: string,
    extras: { motivoTecnico?: string; accionPosterior?: string; responsableRevision?: string } = {}): CorreccionNoConformidad | string {
    const ultimo = this.ultimoIntento(id);
    if (!ultimo || ultimo.resultado !== 'No conforme') return 'No hay una no conformidad vigente que atender en este proceso.';
    if (this.correccionActivaDe(id)) return 'Ya existe una corrección en curso para esta no conformidad.';
    // Caso B: si requiere nuevo Expediente técnico, el motivo técnico, la acción posterior y el
    // responsable de revisión son obligatorios (spec §5).
    if (requiereNuevoExpediente) {
      if (!extras.motivoTecnico?.trim()) return 'Registre el motivo técnico de la revisión.';
      if (!extras.accionPosterior?.trim()) return 'Registre la acción posterior prevista.';
      if (!extras.responsableRevision?.trim()) return 'Indique el responsable de la revisión técnica.';
    }
    const cor: CorreccionNoConformidad = {
      id: this.siguienteCodigoPorAnio(`COR-${this.anioActual()}-`, this.correcciones().map((c) => c.id)),
      expediente: id,
      inventario: ultimo.inventario,
      intentoNumero: ultimo.numero,
      tipo,
      requiereNuevoExpediente,
      tecnico,
      observacionUsuario: ultimo.observacion,
      fechaInicio: this.hoy(),
      horaInicio: this.hora(),
      fechaFin: '',
      horaFin: '',
      descripcion: '',
      huboComplejidad: '',
      detalleComplejidad: '',
      observacionTecnica: '',
      motivoTecnico: extras.motivoTecnico?.trim() ?? '',
      accionPosterior: extras.accionPosterior?.trim() ?? '',
      responsableRevision: extras.responsableRevision?.trim() ?? '',
      reingresoHardware: requiereNuevoExpediente,
      estado: 'Iniciada'
    };
    this.correcciones.update((list) => [...list, cor]);
    this.registrarEvento(id, tecnico, `No conformidad atendida por el Técnico de Soporte — ${tipo}`, 'En corrección',
      cor.observacionUsuario, true,
      { modulo: 'Entrega y aceptación', estadoAnterior: 'No conforme', inventario: cor.inventario,
        expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: ultimo.usuarioFinal });
    this.registrarEvento(id, tecnico, `Tipo de corrección seleccionado: ${tipo}`, 'Corrección iniciada', '', false,
      { modulo: 'Entrega y aceptación', inventario: cor.inventario, usuarioFinal: ultimo.usuarioFinal });
    // Evaluación explícita de nuevo Expediente técnico (spec §1 y §6).
    this.registrarEvento(id, tecnico, 'Evaluación de nuevo Expediente técnico realizada',
      requiereNuevoExpediente ? 'Requiere nuevo Expediente técnico' : 'No requiere nuevo Expediente técnico',
      requiereNuevoExpediente
        ? `Motivo técnico: ${cor.motivoTecnico}. Acción posterior: ${cor.accionPosterior}. Responsable de revisión: ${cor.responsableRevision}.`
        : 'La inconformidad se resuelve con una corrección de configuración; no se crea un nuevo Expediente técnico.',
      true,
      { modulo: 'Entrega y aceptación', inventario: cor.inventario,
        expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: ultimo.usuarioFinal });
    if (requiereNuevoExpediente) {
      // Caso B: el equipo vuelve a Hardware para revisión técnica, SIN descargo y sin reiniciar contadores.
      this.registrarEvento(id, tecnico, 'No conformidad requiere revisión técnica', 'Pendiente de revisión técnica',
        cor.motivoTecnico, true,
        { modulo: 'Entrega y aceptación', inventario: cor.inventario, usuarioFinal: ultimo.usuarioFinal });
      const previos = this.ingresosDeEquipo(cor.inventario);
      const ingreso: IngresoHardware = {
        idIngresoHardware: `${cor.inventario}-${String(previos.length + 1).padStart(2, '0')}`,
        inventario: cor.inventario, numeroIngreso: previos.length + 1,
        fechaIngreso: this.hoy(), horaIngreso: this.hora(), motivoIngreso: 'Reingreso por revisión técnica',
        ingresadoPor: tecnico, estadoInicial: 'Pendiente de revisión', estadoFinal: '',
        observaciones: `Revisión técnica por inconformidad del usuario final (sin descargo): ${cor.observacionUsuario}`
      };
      this.ingresosHardware.update((list) => [ingreso, ...list]);
      this.registrarEvento(cor.inventario, tecnico,
        `Equipo ${cor.inventario} enviado a flujo F0288 por revisión técnica (reingreso a Hardware sin descargo)`,
        'Pendiente de revisión', 'No se descarga el equipo: aún no fue aceptado formalmente. Los contadores históricos no se reinician.', true,
        { modulo: 'Ingreso a Hardware', estadoAnterior: 'No conforme', inventario: cor.inventario });
    }
    return cor;
  }

  /**
   * Finaliza una corrección de no conformidad: registra técnico, tiempos, descripción y
   * complejidad. Tras finalizarla se habilita reenviar el formulario de aceptación (nuevo intento).
   * Devuelve null si se registró, o el mensaje de la validación que falló.
   */
  finalizarCorreccion(idCorreccion: string, datos: {
    descripcion: string; huboComplejidad: RespuestaSiNo; detalleComplejidad: string; observacionTecnica: string;
  }): string | null {
    const cor = this.correcciones().find((c) => c.id === idCorreccion);
    if (!cor) return 'No se encontró la corrección indicada.';
    if (cor.estado === 'Finalizada') return 'Esta corrección ya fue finalizada.';
    // Caso B: no se finaliza hasta completar la revisión técnica (nuevo Expediente técnico Preparado).
    if (cor.requiereNuevoExpediente && !this.revisionTecnicaCompleta(cor)) {
      return 'Complete la revisión técnica: cree el nuevo Expediente técnico y finalice la Preparación F0288 antes de finalizar la corrección.';
    }
    if (!datos.descripcion.trim()) return 'Describa la corrección realizada.';
    if (datos.huboComplejidad === '') return 'Indique si hubo complejidad en la corrección.';
    if (datos.huboComplejidad === 'Sí' && !datos.detalleComplejidad.trim()) return 'Detalle la complejidad de la corrección.';
    this.correcciones.update((list) =>
      list.map((c) => (c.id === idCorreccion
        ? { ...c, estado: 'Finalizada', fechaFin: this.hoy(), horaFin: this.hora(),
            descripcion: datos.descripcion.trim(), huboComplejidad: datos.huboComplejidad,
            detalleComplejidad: datos.detalleComplejidad.trim(), observacionTecnica: datos.observacionTecnica.trim() }
        : c))
    );
    // Documento de corrección asociado al F0302 del expediente (registro de la corrección).
    this.actualizarAnexo(cor.expediente, 'Configuración F0302', 'Corrección registrada',
      `${cor.tipo}: ${datos.descripcion.trim()}`);
    this.registrarEvento(cor.expediente, cor.tecnico, `Corrección finalizada (${cor.tipo})`, 'Corrección finalizada',
      datos.descripcion.trim(), true,
      { modulo: 'Entrega y aceptación', estadoAnterior: 'Corrección iniciada', inventario: cor.inventario,
        expedienteUnico: this.expedienteUnicoDe(cor.expediente)?.codigoUnico,
        complejidad: datos.huboComplejidad === 'Sí' ? 'Con complejidad' : 'Sin complejidad' });
    return null;
  }

  /**
   * Reenvía el formulario de aceptación tras corregir una no conformidad: crea un NUEVO intento
   * (Pendiente de firma) con un token nuevo, sin sobrescribir los anteriores. Requiere que la
   * corrección del último intento No conforme esté finalizada. Devuelve la conformidad reenviada
   * o un mensaje de validación.
   */
  reenviarFormularioAceptacion(id: string, usuario: string): Conformidad | string {
    if (this.estadoAceptacion(id) !== 'No conforme') return 'No hay una no conformidad vigente para reenviar el formulario.';
    const cor = this.correccionListaParaReenvio(id);
    if (!cor) return 'Debe finalizar la corrección antes de reenviar el formulario de aceptación.';
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
    this.setEstadoSolicitud(id, 'Pendiente de aceptación', 'Respuesta del formulario de aceptación reenviado');
    this.actualizarAnexo(id, 'Formulario de conformidad', 'Pendiente de respuesta', 'Formulario reenviado tras la corrección');
    this.registrarEvento(id, usuario, 'Formulario de aceptación reenviado tras la corrección', 'Pendiente de aceptación',
      `Corrección ${cor.id} (${cor.tipo}).` +
        (cor.requiereNuevoExpediente && cor.expedienteTecnicoNuevo ? ` Nuevo Expediente técnico: ${cor.expedienteTecnicoNuevo}.` : '') +
        ` Enlace único ${nuevoToken}.`, true,
      { modulo: 'Entrega y aceptación', estadoAnterior: 'No conforme', inventario: conf.inventario,
        expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: conf.usuarioFinal });
    const confActualizada = this.conformidadDeProceso(id)!;
    this.crearIntentoAceptacion(id, confActualizada, cor);
    return confActualizada;
  }

  /** La garantía está vencida cuando su estado lo indica o su fecha de vencimiento ya pasó: queda en modo consulta. */
  garantiaVencida(g: Garantia): boolean {
    return g.estado === 'Vencida' || new Date(g.fechaVencimiento).getTime() < Date.now();
  }

  /** Solo se puede comentar con garantía vigente y caso Abierto o En revisión; caso cerrado = solo lectura. */
  puedeComentarCaso(g: Garantia, c: CasoGarantia): boolean {
    return !this.garantiaVencida(g) && (c.estado === 'Abierto' || c.estado === 'En revisión');
  }

  /** Abre un caso de garantía asociado al Expediente único; un expediente puede tener varios casos. */
  registrarCasoGarantia(id: string, motivo: string, descripcion: string, responsable: string): CasoGarantia | null {
    const g = this.garantiaDe(id);
    if (!g || this.garantiaVencida(g)) return null;
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

  cerrarCasoGarantia(id: string, codigoCaso: string, resultado: string, evidencia: string, usuario: string): void {
    this.garantias.update((list) =>
      list.map((g) => {
        if (g.expediente !== id) return g;
        const casos = g.casos.map((c) =>
          c.codigo === codigoCaso
            ? { ...c, estado: 'Cerrado' as const, resultado, evidenciaTecnica: evidencia, fechaCierre: this.hoy() }
            : c);
        const abiertos = casos.some((c) => c.estado === 'Abierto' || c.estado === 'En revisión');
        const vencida = new Date(g.fechaVencimiento).getTime() < Date.now();
        return { ...g, casos, estado: abiertos ? 'Caso abierto' : (vencida ? 'Vencida' : 'Vigente') };
      })
    );
    this.registrarEvento(id, usuario, `Caso de garantía ${codigoCaso} cerrado`, 'Cerrado', resultado, false,
      { modulo: 'Servicio de garantía', estadoAnterior: 'Caso abierto', inventario: this.garantiaDe(id)?.inventario });
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
