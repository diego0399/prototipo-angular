import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import {
  AccionPosteriorDescargo, Asignacion, CasoGarantia, ChecklistSeccion, CierreTecnico, ComentarioCaso, Conformidad,
  ConfiguracionF0302, ConsultaInventario, CorreccionNoConformidad, Cronometro, Descargo, DocumentoGenerado, Entrega,
  Equipo, EquipoCatalogoInstitucional, EstadoAccesorio,
  EstadoAsignacionEquipo, EstadoPreparacionEquipo, EventoTrazabilidad, ExpedienteTecnico, ExpedienteUnico, FallaF0302,
  FirmaProceso, Garantia, IngresoHardware, IntentoAceptacion, MotivoDescargo, MotivoIngreso, PreparacionF0288,
  RespuestaSiNo, ResultadoIntento, RolClave, SeccionOculta, Solicitud, TipoComentarioCaso, TipoCorreccion,
  TipoExpedienteTecnico, TipoFallaF0302, UsuarioSistema, VerificacionAccesorios, VerificacionFalla
} from '../models/models';
import { AuthService } from './auth.service';

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
   * Base de datos institucional simulada que se consulta por número de inventario al ingresar
   * un equipo. Es solo lectura: no se persiste en localStorage ni se reinicia con la demo,
   * porque representa un sistema externo a SISGOST.
   */
  readonly catalogoInstitucional = signal<EquipoCatalogoInstitucional[]>([]);

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
    if (this.hidratarDesdeLocalStorage()) {
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
      descargos: json<Descargo[]>('descargos')
    }).subscribe((r) => {
      this.usuarios.set(r.usuarios);
      this.solicitudes.set(r.solicitudes);
      this.equipos.set(r.equipos);
      this.asignaciones.set(r.asignaciones);
      this.expedientesTecnicos.set(r.expTec);
      this.expedientesUnicos.set(r.expedientes);
      this.preparaciones.set(r.preparaciones);
      this.configuraciones.set(r.configuraciones);
      this.entregas.set(r.entregas);
      this.conformidades.set(r.conformidades);
      this.garantias.set(r.garantias);
      this.documentos.set(r.documentos);
      this.eventos.set(r.eventos);
      this.ingresosHardware.set(r.ingresos);
      this.descargos.set(r.descargos);
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
      this.preparaciones.set(d.preparaciones ?? []);
      this.configuraciones.set(d.configuraciones ?? []);
      this.entregas.set(d.entregas ?? []);
      this.conformidades.set(d.conformidades ?? []);
      this.garantias.set(d.garantias ?? []);
      this.documentos.set(d.documentos ?? []);
      this.eventos.set(d.eventos ?? []);
      this.ingresosHardware.set(d.ingresosHardware ?? []);
      this.descargos.set(d.descargos ?? []);
      this.intentos.set(d.intentos ?? []);
      this.correcciones.set(d.correcciones ?? []);
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
        intentos: this.intentos(), correcciones: this.correcciones()
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
   * true mientras el equipo tiene un F0302 «Con falla» pendiente de revisión técnica en su proceso
   * vigente y todavía no se ha iniciado una nueva Configuración F0302. Igual que la revisión por
   * inconformidad (Caso B), el equipo volvió a F0288 SIN descargo —la asignación sigue vigente—, por lo
   * que debe permitirse crear un nuevo Expediente técnico para la nueva preparación pese a esa asignación.
   * Sin esta excepción el equipo quedaba bloqueado y nunca regresaba realmente a F0288.
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
  /**
   * Resumen consolidado del equipo, usado tanto por «Ver detalle» en Inventario de Hardware
   * como por la pestaña Resumen del Historial técnico, para que ambas vistas muestren
   * exactamente los mismos números.
   */
  resumenEquipo(inventario: string): {
    vecesIngresado: number; vecesPreparado: number; vecesConfigurado: number; intentosF0302: number;
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
    // Excepción análoga: falla durante F0302. El equipo debe regresar a F0288 aunque siga asignado
    // (aún no hubo descargo). Se permite crear el nuevo Expediente técnico para la nueva preparación.
    if (this.revisionTecnicaPorFallaF0302(inventario)) return hayReingresoPendiente;
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
      falla = { respuesta: '', fallaEncontrada: '', diagnostico: '', accionRealizada: '', observaciones: '' };
      const acc = (nombre: string, estado: EstadoAccesorio = 'Pendiente') => ({ nombre, estado });
      accesorios = {
        respuesta: '',
        accesorios: [
          acc('Cargador', tipo === 'Desktop' ? 'No aplica' : 'Pendiente'),
          acc('Cable de poder'),
          acc('Mouse'),
          acc('Teclado'),
          acc('Monitor', tipo === 'Laptop' ? 'No aplica' : 'Pendiente'),
          acc('Otros accesorios')
        ],
        observaciones: ''
      };
    } else {
      ocultas.push(
        { nombre: 'Verificación de falla', motivo: 'No aplica a un equipo nuevo; el checklist dinámico la oculta.' },
        { nombre: 'Verificación de accesorios', motivo: 'No aplica a un equipo nuevo; el checklist dinámico la oculta.' }
      );
    }
    secciones.push({
      titulo: 'Sistema operativo y cuenta administrador',
      items: [
        item('Instalación de Windows 11'), item('Instalar actualizaciones'), item('Controladores'),
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
    if (unidad === 'Soporte') {
      secciones.push({
        titulo: 'Software según SISSOR · dominio · credenciales',
        items: [
          item('Antivirus'), item('OCS Inventory'), item('Office / Chrome / Acrobat'),
          item('Agente DLP'), item('Ingreso a dominio'), item('Credenciales: nombre de equipo · cuenta de red')
        ]
      });
    } else {
      ocultas.push({
        nombre: 'Credenciales, dominio y Agente DLP',
        motivo: 'No se muestran como obligatorias cuando prepara Hardware; el checklist dinámico las oculta.'
      });
    }
    return { secciones, ocultas, falla, accesorios };
  }

  /**
   * Crea el expediente técnico de un equipo del Inventario de Hardware que aún no está
   * preparado. Pertenece al equipo (sin solicitud ni requerimiento) y genera su checklist
   * F0288 pendiente: la preparación es el siguiente paso obligatorio.
   */
  crearExpedienteTecnico(datos: {
    inventario: string; unidadResponsable: 'Soporte' | 'Hardware';
    creadoPor: string; tecnicoPreparacion: string; observaciones: string;
  }): ExpedienteTecnico | null {
    const eq = this.equipoDe(datos.inventario);
    if (!eq || !this.puedeCrearNuevoExpedienteTecnico(datos.inventario)) return null;
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
      fecha: this.hoy()
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

    if (anterior) {
      // Reingreso: el equipo ya tenía un expediente técnico (ahora histórico); se referencia
      // explícitamente en el evento, junto con el motivo del reingreso que lo originó.
      const motivoReingreso = this.ingresosDeEquipo(eq.inventario)
        .find((i) => i.expedienteTecnicoAsociado === nuevo.codigo)?.motivoIngreso ?? '—';
      this.registrarEvento(nuevo.codigo, datos.creadoPor,
        `Nuevo Expediente técnico ${nuevo.codigo} creado por reingreso a Hardware del equipo ${eq.inventario}`,
        'En preparación',
        `Expediente anterior: ${anterior.codigo} (${anterior.estado}) — se conserva como histórico, no se reutiliza. ` +
          `Motivo del reingreso: ${motivoReingreso}. Técnico de preparación asignado: ${datos.tecnicoPreparacion}.`,
        true,
        { modulo: 'Expediente técnico', estadoAnterior: 'Pendiente de preparación', inventario: eq.inventario, expedienteTecnico: nuevo.codigo });
    } else {
      this.registrarEvento(nuevo.codigo, datos.creadoPor,
        `Expediente técnico ${nuevo.codigo} creado para el equipo ${eq.inventario}`, 'En preparación',
        `Técnico de preparación asignado: ${datos.tecnicoPreparacion}.`, true,
        { modulo: 'Expediente técnico', estadoAnterior: 'Pendiente de preparación', inventario: eq.inventario, expedienteTecnico: nuevo.codigo });
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
      const sw = (nombre: string, version: string) => ({ nombre, version, estado: 'Pendiente', evidencia: null });
      const nuevaConf: ConfiguracionF0302 = {
        expediente: id,
        tecnico: tecnicoConfiguracion,
        seleccionadoPor: usuario,
        fecha: '',
        estado: 'En curso',
        datos: {
          requerimiento: this.tipoRequerimientoTexto(s),
          inventario: asig.equipoInventario,
          nombrePC: `CNR-${asig.equipoInventario.replace(/-/g, '').slice(-6)}`,
          tipoServicio: 'Asignación de equipo',
          asignadoA: s.destinatario,
          carne: s.carne,
          direccionGerencia: s.direccionGerencia,
          unidad: s.unidadDestino,
          puesto: 'Según registro de RRHH',
          sistemaOperativo: eq?.sistemaOperativo || 'Windows 11 Pro',
          arquitectura: 'x64',
          // La reserva de IP la responde el técnico dentro del checklist F0302, antes de finalizar.
          requiereReservaIP: '',
          ipReservada: ''
        },
        software: [
          sw('Antivirus institucional', 'Corporativo'),
          sw('OCS Inventory', 'Agente CNR'),
          sw('Office 365', 'Canal actual'),
          sw('Google Chrome', 'Estable'),
          sw('Adobe Acrobat Reader', 'DC'),
          sw('Agente DLP', 'Corporativo')
        ],
        softwareOculto: [
          { nombre: 'Visio · Project · Power BI', motivo: 'No solicitados en el requerimiento; el checklist dinámico los oculta.' }
        ],
        evidencias: [
          { nombre: 'Captura de antivirus', estado: 'Pendiente' },
          { nombre: 'Captura de OCS Inventory', estado: 'Pendiente' },
          { nombre: 'Evidencia de Solución DLP', estado: 'Pendiente' }
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

  /** Marca el estado de un accesorio (Verificado · Reemplazado · No aplica) dentro de la verificación. */
  marcarAccesorio(codigoTec: string, nombre: string, estado: EstadoAccesorio): void {
    this.actualizarPreparacion(codigoTec, (p) =>
      p.verificacionAccesorios
        ? {
            ...p,
            verificacionAccesorios: {
              ...p.verificacionAccesorios,
              accesorios: p.verificacionAccesorios.accesorios.map((a) => (a.nombre === nombre ? { ...a, estado } : a))
            }
          }
        : p
    );
  }

  marcarItemF0288(codigoTec: string, seccion: string, item: string, estado: 'Realizado' | 'Pendiente'): void {
    this.preparaciones.update((list) =>
      list.map((p) => (p.expedienteTecnico === codigoTec
        ? {
            ...p,
            secciones: p.secciones.map((sec) =>
              sec.titulo === seccion
                ? { ...sec, items: sec.items.map((i) => (i.nombre === item ? { ...i, estado } : i)) }
                : sec)
          }
        : p))
    );
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
      if (va.respuesta === 'Sí' && va.accesorios.some((a) => a.estado === 'Pendiente')) {
        return 'Marque cada accesorio como Verificado, Reemplazado o No aplica antes de generar el F0288.';
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
    this.registrarEvento(codigoTec, usuario, 'Preparación F0288 finalizada; documento F0288 generado y firmado. Equipo preparado y listo para asignación', 'Preparado',
      `Tiempo total: ${tiempo} · Complejidad: ${cierre.nivel}` +
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

  marcarSoftwareF0302(id: string, nombre: string, estado: 'Realizado' | 'Pendiente'): void {
    this.actualizarConfiguracionActiva(id, (c) => ({
      ...c, software: c.software.map((s) => (s.nombre === nombre ? { ...s, estado } : s))
    }));
  }

  // ---------- Reserva de IP (checklist F0302) ----------
  // La IP reservada es dato clave del expediente, igual que el nombre del equipo: se registra
  // en el checklist F0302, se valida antes de finalizar y viaja al documento, al historial
  // técnico y a la trazabilidad.

  /** Formato xxx.xxx.xxx.xxx con octetos de 0 a 255 (192.168.10.999 y abc.def.1.2 no pasan). */
  ipValida(ip: string): boolean {
    const partes = ip.trim().split('.');
    return partes.length === 4 && partes.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
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
   * Valida la reserva de IP del checklist F0302. Devuelve null si es válida, o el mensaje de
   * la regla que falló: falta la respuesta, falta la IP, formato incorrecto o IP duplicada.
   */
  validarReservaIP(inventario: string, requiere: RespuestaSiNo, ip: string): string | null {
    if (!requiere) return 'Indique si el equipo requiere reserva de IP para continuar con la configuración.';
    if (requiere === 'No') return null;
    const valor = ip.trim();
    if (!valor) return 'Debe ingresar la IP reservada para continuar con la configuración.';
    if (!this.ipValida(valor)) return 'La IP ingresada no tiene un formato válido.';
    const otra = this.configuracionConIP(valor, inventario);
    if (otra) {
      return 'La IP ingresada ya se encuentra registrada en otro equipo activo. ' +
        `Verifique la reserva antes de continuar (equipo ${otra.datos.inventario} · ${otra.datos.nombrePC}).`;
    }
    return null;
  }

  /**
   * Guarda la reserva de IP en la configuración F0302 activa y deja el evento de trazabilidad
   * (marcada · registrada · actualizada). Devuelve null si se guardó, o el mensaje de validación.
   */
  registrarReservaIP(id: string, usuario: string, requiere: RespuestaSiNo, ip: string): string | null {
    const c = this.configuracionDe(id);
    if (!c) return 'No se encontró la configuración indicada.';
    if (c.estado === 'Completada') return 'La configuración ya fue finalizada; la reserva de IP no puede modificarse.';
    if (c.estado === 'Con falla') return 'Esta configuración quedó con falla y el equipo volvió a F0288. Inicie una nueva configuración F0302.';
    if (c.estado === 'Cerrada') return 'Esta configuración quedó cerrada por un descargo del equipo y ya no puede reutilizarse.';
    const error = this.validarReservaIP(c.datos.inventario, requiere, ip);
    if (error) return error;

    const anteriorReq = c.datos.requiereReservaIP ?? '';
    const anteriorIP = (c.datos.ipReservada ?? '').trim();
    const nuevaIP = requiere === 'Sí' ? ip.trim() : '';
    this.actualizarConfiguracionActiva(id, (x) => ({
      ...x, datos: { ...x.datos, requiereReservaIP: requiere, ipReservada: nuevaIP }
    }));

    const ref = {
      modulo: 'Configuración F0302', estadoAnterior: anteriorReq ? `Reserva de IP: ${anteriorReq}` : 'Sin reserva de IP registrada',
      inventario: c.datos.inventario, expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico,
      usuarioFinal: c.datos.asignadoA, nombreEquipo: c.datos.nombrePC, ipReservada: nuevaIP || 'No aplica'
    };
    if (anteriorReq !== requiere) {
      this.registrarEvento(id, usuario, `Reserva de IP marcada en F0302: ${requiere}`, `Reserva de IP: ${requiere}`,
        `Equipo ${c.datos.inventario} (${c.datos.nombrePC}). ${requiere === 'Sí' ? `IP reservada: ${nuevaIP}.` : 'El equipo no requiere reserva de IP.'}`,
        false, ref);
    }
    if (requiere === 'Sí' && nuevaIP !== anteriorIP) {
      this.registrarEvento(id, usuario,
        anteriorIP ? `IP reservada actualizada: ${anteriorIP} → ${nuevaIP}` : `IP reservada registrada: ${nuevaIP}`,
        `Reserva de IP: Sí`,
        `Equipo ${c.datos.inventario} (${c.datos.nombrePC}) para ${c.datos.asignadoA}.`, false,
        { ...ref, estadoAnterior: anteriorIP ? `IP reservada: ${anteriorIP}` : 'Sin IP reservada' });
    }
    return null;
  }

  /** Reserva de IP vigente del equipo: la de su configuración F0302 más reciente. */
  reservaIPEquipo(inventario: string): { requiere: RespuestaSiNo; ip: string } {
    const c = this.configuracionesDeEquipo(inventario)[0];
    return { requiere: c?.datos.requiereReservaIP ?? '', ip: (c?.datos.ipReservada ?? '').trim() };
  }

  /** Texto legible de la reserva de IP de una configuración: «192.168.10.45», «No aplica» o «—». */
  textoIPReservada(c: Pick<ConfiguracionF0302, 'datos'> | undefined): string {
    if (!c?.datos.requiereReservaIP) return '—';
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
    this.registrarEvento(id, usuario, `Cronómetro F0302 iniciado para el expediente ${this.expedienteUnicoDe(id)?.codigoUnico ?? id}`, 'En configuración',
      `Inicio del registro de tiempo de la configuración del equipo ${c.datos.inventario} (${c.datos.nombrePC}) para ${c.datos.asignadoA}.`, false,
      { modulo: 'Configuración F0302', inventario: c.datos.inventario,
        expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: c.datos.asignadoA });
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
    if (c.software.some((s) => s.estado === 'Pendiente')) {
      return 'Complete todo el software aplicable antes de generar el F0302.';
    }
    // La reserva de IP se revalida aquí: es dato obligatorio del expediente y la IP pudo quedar
    // duplicada por una reserva registrada en otro equipo después de guardarla.
    const errIP = this.validarReservaIP(c.datos.inventario, c.datos.requiereReservaIP ?? '', c.datos.ipReservada ?? '');
    if (errIP) return errIP;
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
    const ipTexto = conReserva ? (c.datos.ipReservada ?? '') : 'No aplica';
    this.registrarEvento(id, usuario,
      conReserva
        ? `Configuración F0302 finalizada con reserva de IP ${ipTexto}; documento F0302 generado y firmado`
        : 'Configuración F0302 finalizada; documento F0302 generado y firmado',
      'Listo para entrega',
      `Nombre del equipo: ${c.datos.nombrePC} · Reserva de IP: ${c.datos.requiereReservaIP} · IP reservada: ${ipTexto} · ` +
        `Tiempo total: ${tiempo} · Complejidad: ${cierre.nivel}` +
        (cierre.hubo === 'Sí' ? ` · Detalle: ${cierre.detalle.trim()}` : (cierre.observacion.trim() ? ` · Observación: ${cierre.observacion.trim()}` : '')),
      true,
      { modulo: 'Configuración F0302', estadoAnterior: 'En configuración', inventario: c.datos.inventario,
        expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: c.datos.asignadoA, tiempo,
        complejidad: cierre.nivel, nombreEquipo: c.datos.nombrePC, ipReservada: ipTexto });
    return null;
  }

  /**
   * Reporta una falla detectada durante la Configuración F0302 (spec Parte B): detiene el
   * cronómetro y guarda el tiempo trabajado, marca el F0302 como intento «Con falla» (nunca se
   * borra), devuelve el equipo al flujo F0288 (reingreso a Hardware si aplica) y NO habilita ni
   * la aceptación ni la garantía. La descripción de la falla es obligatoria. Devuelve null si se
   * registró, o el mensaje de la validación que falló.
   */
  reportarFallaF0302(id: string, datos: {
    tipo: TipoFallaF0302; descripcion: string; requiereHardware: boolean;
    requiereNuevaPreparacion: boolean; observacionTecnica: string; evidencia: string;
  }, usuario: string): string | null {
    const c = this.configuracionDe(id);
    if (!c) return 'No se encontró la configuración indicada.';
    if (c.estado === 'Con falla') return 'Esta configuración ya fue reportada con falla.';
    if (c.estado === 'Completada') return 'La configuración ya fue finalizada; no puede reportarse una falla.';
    if (c.estado === 'Cerrada') return 'Esta configuración quedó cerrada por un descargo del equipo.';
    if (!c.cronometro) return 'Inicie la configuración (cronómetro en curso) antes de reportar una falla.';
    if (!datos.descripcion.trim()) return 'La observación / descripción de la falla es obligatoria.';

    const crono = this.detenerCronometro(c.cronometro, usuario);
    const falla: FallaF0302 = {
      tipo: datos.tipo, descripcion: datos.descripcion.trim(), requiereHardware: datos.requiereHardware,
      requiereNuevaPreparacion: datos.requiereNuevaPreparacion, observacionTecnica: datos.observacionTecnica.trim(),
      evidencia: datos.evidencia.trim(), tecnicoReporta: usuario, fecha: this.hoy(), hora: this.hora(),
      tiempoMinutos: crono.duracionMinutos
    };
    // El F0302 con falla se conserva: solo cambia de estado y guarda la falla; nunca se elimina.
    this.actualizarConfiguracionActiva(id, (x) => ({ ...x, estado: 'Con falla', cronometro: crono, falla }));

    const tiempo = this.formatoDuracion(crono.duracionMinutos);
    const unicoCod = this.expedienteUnicoDe(id)?.codigoUnico;
    // No habilita aceptación ni garantía: el expediente queda pendiente de revisión técnica.
    this.setEstadoSolicitud(id, 'F0302 con falla', 'Revisión técnica F0288 por falla en la configuración');
    this.expedientesUnicos.update((list) =>
      list.map((x) => (x.expediente === id
        ? { ...x, estado: 'Pendiente de revisión técnica', resumenEstado: 'F0302 con falla · devuelto a F0288' }
        : x)));
    this.actualizarAnexo(id, 'Se anexa configuración del equipo', 'Con falla', `${datos.tipo}: ${falla.descripcion}`);

    // Trazabilidad obligatoria (spec §18).
    this.registrarEvento(id, usuario, 'Falla detectada durante F0302', 'F0302 con falla',
      `${datos.tipo}: ${falla.descripcion}`, true,
      { modulo: 'Configuración F0302', estadoAnterior: 'En configuración', inventario: c.datos.inventario,
        expedienteUnico: unicoCod, usuarioFinal: c.datos.asignadoA, tiempo });
    this.registrarEvento(id, usuario, `Cronómetro F0302 detenido por falla (tiempo trabajado: ${tiempo || 'menos de 1 min'})`, 'F0302 con falla',
      '', false, { modulo: 'Configuración F0302', inventario: c.datos.inventario, expedienteUnico: unicoCod, tiempo });
    this.registrarEvento(id, usuario, 'F0302 registrado como intento con falla (se conserva en el historial)', 'F0302 con falla',
      'No se borra el intento F0302 ni se reinician los contadores históricos.', false,
      { modulo: 'Configuración F0302', inventario: c.datos.inventario, expedienteUnico: unicoCod });
    this.registrarEvento(id, usuario, 'Equipo pendiente de revisión técnica', 'Pendiente de revisión técnica',
      'No se habilita el formulario de aceptación ni la garantía mientras el F0302 quede con falla.', true,
      { modulo: 'Configuración F0302', inventario: c.datos.inventario, expedienteUnico: unicoCod, usuarioFinal: c.datos.asignadoA });

    const reingresa = datos.requiereHardware || datos.requiereNuevaPreparacion;
    if (reingresa) {
      const previos = this.ingresosDeEquipo(c.datos.inventario);
      const ingreso: IngresoHardware = {
        idIngresoHardware: `${c.datos.inventario}-${String(previos.length + 1).padStart(2, '0')}`,
        inventario: c.datos.inventario, numeroIngreso: previos.length + 1,
        fechaIngreso: this.hoy(), horaIngreso: this.hora(), motivoIngreso: 'Reingreso por revisión técnica',
        ingresadoPor: usuario, estadoInicial: 'Pendiente de revisión', estadoFinal: '',
        observaciones: `Reingreso por falla en F0302 (sin descargo): ${datos.tipo} — ${falla.descripcion}`
      };
      this.ingresosHardware.update((list) => [ingreso, ...list]);
      this.registrarEvento(c.datos.inventario, usuario,
        `Equipo ${c.datos.inventario} devuelto a flujo F0288 por falla en F0302 (nuevo ingreso a Hardware, sin descargo)`,
        'Pendiente de revisión', 'Los F0288 y F0302 anteriores se conservan; los contadores históricos no se reinician.', true,
        { modulo: 'Ingreso a Hardware', estadoAnterior: 'F0302 con falla', inventario: c.datos.inventario });
    } else {
      this.registrarEvento(id, usuario, 'Equipo devuelto a flujo F0288 por falla en F0302', 'Pendiente de revisión técnica',
        'Se podrá iniciar una nueva Configuración F0302 con el equipo ya preparado.', false,
        { modulo: 'Configuración F0302', inventario: c.datos.inventario, expedienteUnico: unicoCod });
    }
    return null;
  }

  /**
   * Inicia una NUEVA Configuración F0302 tras una falla, sin borrar la anterior: el F0302 con
   * falla queda como intento en el historial y esta crea una configuración activa fresca. Requiere
   * que exista una configuración con falla, que no haya otra configuración activa y que el equipo
   * esté nuevamente «Preparado» (nueva Preparación F0288 completada, si aplicaba). Devuelve la
   * nueva configuración o el mensaje de validación.
   */
  nuevaConfiguracionF0302(id: string, usuario: string): ConfiguracionF0302 | string {
    const conFalla = this.configuracionesConFallaDe(id)[0];
    if (!conFalla) return 'Este proceso no tiene una configuración F0302 con falla que reintentar.';
    const activa = this.configuraciones().find((c) => c.expediente === id && c.estado !== 'Con falla');
    if (activa) return 'Ya existe una configuración F0302 activa para este proceso.';
    const inventario = conFalla.datos.inventario;
    // La falla devolvió el equipo a F0288: si quedó un reingreso a Hardware pendiente, primero debe
    // crearse el nuevo Expediente técnico y completarse la nueva Preparación (aunque el ET anterior
    // siga «Preparado»). Solo así se cumple el retorno obligatorio a F0288 tras la falla.
    if (this.reingresoHardwarePendiente(inventario)) {
      return 'El equipo tiene un reingreso a Hardware pendiente por la falla: cree el nuevo Expediente técnico y complete la nueva Preparación F0288 antes de reconfigurar.';
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
    this.registrarEvento(id, usuario, 'Nueva Configuración F0302 iniciada tras la falla anterior', 'En configuración',
      'El F0302 con falla se conserva como intento en el historial de configuraciones.', true,
      { modulo: 'Configuración F0302', estadoAnterior: 'Pendiente de revisión técnica', inventario,
        expedienteUnico: this.expedienteUnicoDe(id)?.codigoUnico, usuarioFinal: conFalla.datos.asignadoA });
    return nueva;
  }

  // ---------- Entrega, conformidad y garantía ----------
  enviarConformidad(id: string, usuario: string): Conformidad | null {
    const s = this.solicitud(id);
    const c = this.configuracionDe(id);
    if (!s || !c || c.estado !== 'Completada') return null;

    const existente = this.conformidades().find((x) => x.expediente === id);
    const vence = new Date();
    vence.setDate(vence.getDate() + 7);
    if (existente) {
      this.conformidades.update((list) =>
        list.map((x) => (x.expediente === id
          ? { ...x, estado: 'Pendiente de respuesta', fechaEnvio: new Date().toISOString(), vence: vence.toISOString().slice(0, 10) }
          : x))
      );
      this.registrarEvento(id, usuario, 'Formulario de conformidad reenviado al correo institucional del usuario final', 'Pendiente de aceptación');
      return this.conformidades().find((x) => x.expediente === id) ?? null;
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
      observaciones: ''
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
      'Pendiente de aceptación', `Enlace único ${nueva.token}, vence el ${nueva.vence}.`, true,
      { modulo: 'Entrega y aceptación', estadoAnterior: 'Listo para entrega', inventario: s.equipoInventario, usuarioFinal: s.destinatario });
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
