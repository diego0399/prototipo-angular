import { Component, computed, inject, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { CasoActivoService } from '../../core/services/caso-activo.service';
import { RespuestaSiNo, TipoCorreccion } from '../../core/models/models';
import { BadgeComponent, HelpTipComponent } from '../../shared/ui';
import { BuscarExpedienteUnicoModalComponent, FilaExpedienteUnico, filaExpedienteUnico } from '../../shared/buscar-expediente';

@Component({
  selector: 'app-entrega',
  imports: [RouterLink, SlicePipe, FormsModule, BadgeComponent, HelpTipComponent, BuscarExpedienteUnicoModalComponent],
  styles: `
    .conf-panel { background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 16px 18px; }
    .conf-panel .cp-title { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--tx-3); margin-bottom: 8px; }
    .respuesta { border-left: 3px solid var(--ok); background: var(--ok-bg); padding: 10px 14px; border-radius: 0 10px 10px 0; font-size: 13px; }
    .respuesta.mala { border-left-color: var(--danger); background: var(--danger-bg); }
    .firma-uf { border: 1px dashed var(--line-strong); border-radius: var(--r-md); background: var(--surface-2); padding: 12px 16px; }
    .firma-uf .fu-cap { font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--gold-600); margin-bottom: 5px; }
    .firma-uf .fu-nombre { font-family: var(--font-brand); font-size: 19px; color: var(--navy-900); border-bottom: 1px solid var(--tx-2); padding-bottom: 3px; margin-bottom: 5px; max-width: 320px; }
    .firma-uf .fu-det { font-size: 11.5px; color: var(--tx-3); line-height: 1.6; }
    .noconf { border: 1px solid var(--danger-line, var(--line)); background: var(--danger-bg); border-radius: var(--r-md); padding: 14px 16px; }
    .hist { display: grid; gap: 8px; }
    .hist-item { border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface-2); padding: 10px 14px; }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Entrega y garantía</div>
          <h1>
            Entrega y aceptación
            <ui-help texto="¿Cómo funciona? El técnico entrega el equipo y SISGOST envía un enlace único al correo institucional del usuario final. El usuario responde el formulario externo (acepta o registra inconformidad) sin ingresar al sistema; su respuesta queda anexada al expediente único." />
          </h1>
          <p class="page-sub">Recepción del equipo y conformidad del usuario final.</p>
        </div>
      </div>

      <div class="card card-pad mb-3">
        <div class="row-between" style="flex-wrap: wrap; gap: 16px;">
          <div style="min-width: 0;">
            <div class="sec-title" style="margin-bottom: 3px;">Entrega</div>
            @if (entrega(); as e) {
              <p class="small"><b class="mono">{{ e.expediente }}</b> — {{ e.usuarioFinal }} · {{ e.estado }}</p>
            } @else {
              <p class="small muted">Ninguna seleccionada.</p>
            }
          </div>
          @if (opciones().length > 1) {
            <button class="btn btn-outline btn-sm" (click)="buscarAbierto.set(true)">🔍 Buscar expediente</button>
          }
        </div>
        @if (auth.esTecnico()) {
          <span class="hint">Solo se muestran las entregas asignadas a usted.</span>
        }
      </div>

      @if (entrega(); as e) {
        <div class="grid grid-2 mb-2">
          <div class="card">
            <div class="card-head">
              <div>
                <h2>Datos de la entrega</h2>
                <p class="sub">{{ e.solicitudRef }}</p>
              </div>
              <ui-badge [estado]="e.estado" />
            </div>
            <div class="card-body">
              <dl class="dl">
                <dt>Usuario final receptor</dt><dd>{{ e.usuarioFinal }} (carné {{ e.carne }})</dd>
                <dt>Correo institucional</dt><dd>{{ e.correo }}</dd>
                <dt>Unidad destino</dt><dd>{{ e.unidadDestino }}</dd>
                <dt>Equipo entregado</dt><dd>{{ e.equipo }}</dd>
                <dt>Inventario recibido</dt><dd>{{ e.inventario }}</dd>
                <dt>Fecha de entrega</dt><dd>{{ e.fechaEntrega }}</dd>
              </dl>
              <hr class="divider" />
              <dl class="dl">
                <dt>Responsable de entrega</dt><dd>{{ e.tecnicoEntrega }}</dd>
                <dt>Configuró el equipo</dt><dd>{{ e.tecnicoConfiguro }}</dd>
                @if (data.direccionDe(e.tecnicoConfiguro); as dir) { <dt>Dirección del técnico que configuró</dt><dd>{{ dir }}</dd> }
                <dt>Preparó el equipo</dt><dd>{{ e.preparadoPor }}</dd>
                <dt>F0302</dt>
                <dd>
                  @if (e.f0302Generado) { <ui-badge estado="Generado" /> <span class="small muted">· {{ e.f0302Fecha }} (automático)</span> }
                  @else { <ui-badge estado="Pendiente" /> }
                </dd>
              </dl>
              <div class="row mt-2">
                <a class="btn btn-outline btn-sm" routerLink="/expediente-unico">Ver expediente único</a>
                <a class="btn btn-outline btn-sm" routerLink="/trazabilidad">Ver trazabilidad</a>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-head">
              <div>
                <h2>Formulario de conformidad</h2>
                <p class="sub">Respuesta del usuario final mediante enlace externo</p>
              </div>
            </div>
            <div class="card-body">
              @if (conformidad(); as c) {
                <div class="conf-panel mb-2">
                  <div class="cp-title">Estado del formulario · intento #{{ ultimoIntento()?.numero || 1 }}</div>
                  <dl class="dl">
                    <dt>Estado de aceptación</dt><dd><ui-badge [estado]="estadoAcept()" /></dd>
                    <dt>Enlace único</dt><dd class="mono">{{ c.token }}</dd>
                    <dt>Enviado el</dt><dd>{{ c.fechaEnvio ? (c.fechaEnvio | slice: 0:10) : '—' }} <span class="muted">· vence {{ c.vence }}</span></dd>
                    <dt>Respondido el</dt><dd>{{ c.fechaRespuesta ? (c.fechaRespuesta | slice: 0:10) : 'Sin respuesta aún' }}</dd>
                  </dl>
                </div>

                @if (estadoAcept() === 'Aceptado') {
                  <div class="respuesta">
                    <b>Usuario final aceptó la recepción del equipo.</b>
                    <div class="small mt-1">Entrega cerrada · garantía habilitada.</div>
                  </div>
                  <div class="firma-uf mt-2">
                    <div class="fu-cap">Firma de conformidad simulada del usuario final</div>
                    <div class="fu-nombre">{{ c.firmaUsuarioFinal || c.usuarioFinal }}</div>
                    <div class="fu-det">
                      {{ c.correo }}<br />
                      Fecha de aceptación: {{ c.fechaRespuesta | slice: 0:10 }} · {{ c.fechaRespuesta | slice: 11:16 }}<br />
                      Asociada al Expediente único, a la constancia de Entrega y aceptación y al F0302.
                    </div>
                  </div>
                } @else if (estadoAcept() === 'No conforme') {
                  <div class="respuesta mala">
                    <b>El usuario final marcó No conforme.</b>
                    <div class="small mt-1">Observación: {{ ultimoIntento()?.observacion }}</div>
                  </div>

                  <div class="noconf mt-2">
                    <div class="cp-title">Atender no conformidad</div>
                    <dl class="dl">
                      <dt>Equipo</dt><dd>{{ e.equipo }}</dd>
                      <dt>N.º de inventario</dt><dd>{{ e.inventario }}</dd>
                      <dt>Expediente único</dt><dd class="mono">{{ unicoCod() }}</dd>
                      <dt>Usuario final</dt><dd>{{ e.usuarioFinal }}</dd>
                      <dt>Observación del usuario final</dt><dd>{{ ultimoIntento()?.observacion }}</dd>
                      <dt>Fecha de la no conformidad</dt><dd>{{ ultimoIntento()?.fecha }} @if (ultimoIntento()?.hora) { · {{ ultimoIntento()?.hora }} }</dd>
                      <dt>Técnico que configuró</dt><dd>{{ e.tecnicoConfiguro }}</dd>
                      <dt>Estado actual</dt><dd><ui-badge estado="Pendiente de corrección" /></dd>
                      <dt>Acción a realizar</dt><dd>{{ accionSugerida() }}</dd>
                    </dl>

                    @if (!puedeAtender()) {
                      <p class="small muted mt-2">La corrección de la no conformidad debe registrarla un Técnico de Soporte.</p>
                    } @else {
                      @if (!correccionActiva() && !correccionLista()) {
                        <!-- Paso 1: tipo de corrección + evaluación de nuevo Expediente técnico (spec §1) -->
                        <div class="field mt-2">
                          <label>Tipo de corrección <span class="req">*</span></label>
                          <select class="control" [ngModel]="tipoCorreccion()" (ngModelChange)="tipoCorreccion.set($event)">
                            <option value="Corrección de configuración">Corrección de configuración</option>
                            <option value="Revisión técnica / Hardware">Revisión técnica / Hardware</option>
                            <option value="Accesorios">Accesorios</option>
                            <option value="Otro">Otro</option>
                          </select>
                        </div>
                        <div class="field mt-2">
                          <label>¿La corrección requiere crear un nuevo Expediente técnico? <span class="req">*</span></label>
                          <div class="opt-row">
                            <label class="opt" [class.on]="requiereNuevoET() === 'Sí'"><input type="radio" name="reqet" [checked]="requiereNuevoET() === 'Sí'" (change)="requiereNuevoET.set('Sí')" /> Sí</label>
                            <label class="opt" [class.on]="requiereNuevoET() === 'No'"><input type="radio" name="reqet" [checked]="requiereNuevoET() === 'No'" (change)="requiereNuevoET.set('No')" /> No</label>
                          </div>
                          @if (requiereNuevoET() === 'Sí') {
                            <span class="hint">Caso B (falla física / revisión de Hardware / accesorios): el equipo vuelve a Hardware <b>sin descargo</b>. Podrá crear un nuevo Expediente técnico y una nueva Preparación F0288; el reenvío se habilita al completar la revisión.</span>
                          } @else if (requiereNuevoET() === 'No') {
                            <span class="hint">Caso A (configuración / software / usuario / dominio): no se crea un nuevo Expediente técnico. Al finalizar la corrección se habilita el reenvío.</span>
                          } @else {
                            <span class="hint">No toda inconformidad genera un nuevo Expediente técnico: primero evalúe el tipo de falla.</span>
                          }
                        </div>
                        @if (requiereNuevoET() === 'Sí') {
                          <div class="field mt-2"><label>Motivo técnico <span class="req">*</span></label><input class="control" [ngModel]="motivoTecnico()" (ngModelChange)="motivoTecnico.set($event)" placeholder="Falla física, revisión de disco/memoria, accesorio faltante…" /></div>
                          <div class="field mt-2"><label>Acción posterior <span class="req">*</span></label><input class="control" [ngModel]="accionPosterior()" (ngModelChange)="accionPosterior.set($event)" placeholder="Reingresar a Hardware y crear nuevo Expediente técnico…" /></div>
                          <div class="field mt-2"><label>Responsable de revisión <span class="req">*</span></label><input class="control" [ngModel]="responsableRevision()" (ngModelChange)="responsableRevision.set($event)" placeholder="Técnico / encargado responsable de la revisión" /></div>
                        }
                        <button class="btn btn-primary btn-sm mt-2" [disabled]="!puedeIniciar()" (click)="iniciar(e.expediente)">Iniciar corrección</button>
                      }

                      @if (correccionActiva(); as cor) {
                        <div class="alert warn mt-2">
                          <span class="alert-ico">!</span>
                          <span>Corrección <b>{{ cor.tipo }}</b> iniciada el {{ cor.fechaInicio }} · {{ cor.horaInicio }} por {{ cor.tecnico }}.@if (cor.requiereNuevoExpediente) {  Requiere nuevo Expediente técnico — el equipo volvió a Hardware para revisión (sin descargo).}</span>
                        </div>

                        @if (cor.requiereNuevoExpediente) {
                          <!-- Caso B: revisión técnica con nuevo Expediente técnico (spec §3, §4) -->
                          <dl class="dl mt-1">
                            <dt>Motivo técnico</dt><dd>{{ cor.motivoTecnico }}</dd>
                            <dt>Acción posterior</dt><dd>{{ cor.accionPosterior }}</dd>
                            <dt>Responsable de revisión</dt><dd>{{ cor.responsableRevision }}</dd>
                            <dt>Nuevo Expediente técnico</dt>
                            <dd>@if (cor.expedienteTecnicoNuevo) { <span class="mono">{{ cor.expedienteTecnicoNuevo }}</span> — creado por inconformidad } @else { <span class="muted">Pendiente de crear</span> }</dd>
                          </dl>
                          <div class="row mt-2">
                            @if (!cor.expedienteTecnicoNuevo) {
                              <a class="btn btn-primary btn-sm" routerLink="/expediente-tecnico" [queryParams]="{ inventario: e.inventario }">Crear nuevo Expediente técnico</a>
                            }
                            <a class="btn btn-outline btn-sm" routerLink="/preparacion-tecnica">Continuar a Preparación F0288</a>
                            <a class="btn btn-outline btn-sm" routerLink="/trazabilidad" [queryParams]="{ inventario: e.inventario }">Ver historial técnico</a>
                            <a class="btn btn-outline btn-sm" routerLink="/trazabilidad">Ver trazabilidad</a>
                          </div>
                          @if (!revisionTecnicaLista()) {
                            <div class="alert mt-2">
                              <span class="alert-ico">i</span>
                              <span>Complete la revisión técnica: cree el nuevo Expediente técnico y finalice la Preparación F0288. El registro de la corrección y el reenvío se habilitan cuando el equipo quede <b>Preparado</b>.</span>
                            </div>
                          }
                        }

                        @if (!cor.requiereNuevoExpediente || revisionTecnicaLista()) {
                          <div class="field mt-2">
                            <label>Descripción de la corrección <span class="req">*</span></label>
                            <textarea class="control" rows="2" [ngModel]="descCorreccion()" (ngModelChange)="descCorreccion.set($event)" placeholder="Qué se corrigió (configuración, software, revisión, accesorio…)"></textarea>
                          </div>
                          <div class="field mt-2">
                            <label>¿Hubo complejidad? <span class="req">*</span></label>
                            <div class="opt-row">
                              <label class="opt" [class.on]="hubo() === 'Sí'"><input type="radio" name="hubo" [checked]="hubo() === 'Sí'" (change)="hubo.set('Sí')" /> Sí</label>
                              <label class="opt" [class.on]="hubo() === 'No'"><input type="radio" name="hubo" [checked]="hubo() === 'No'" (change)="hubo.set('No')" /> No</label>
                            </div>
                          </div>
                          @if (hubo() === 'Sí') {
                            <div class="field mt-2"><label>Detalle de la complejidad <span class="req">*</span></label><input class="control" [ngModel]="detalle()" (ngModelChange)="detalle.set($event)" placeholder="Describa la complejidad" /></div>
                          } @else {
                            <div class="field mt-2"><label>Observación técnica <span class="hint">(opcional)</span></label><input class="control" [ngModel]="obsTecnica()" (ngModelChange)="obsTecnica.set($event)" /></div>
                          }
                          <button class="btn btn-primary btn-sm mt-2" (click)="finalizar(cor.id)">Finalizar corrección</button>
                        }
                      }

                      @if (correccionLista(); as cor) {
                        <div class="respuesta mt-2">
                          <b>Corrección {{ cor.tipo }} finalizada.</b>
                          <div class="small mt-1">{{ cor.descripcion }} · complejidad: {{ cor.huboComplejidad === 'Sí' ? 'Sí' : 'No' }}@if (cor.requiereNuevoExpediente && cor.expedienteTecnicoNuevo) {  · nuevo Expediente técnico {{ cor.expedienteTecnicoNuevo }}}</div>
                        </div>
                        <button class="btn btn-primary btn-sm mt-2" (click)="reenviarAceptacion(e.expediente)">Reenviar formulario de aceptación</button>
                      }
                    }
                  </div>
                } @else {
                  @if (c.respuesta) {
                    <div class="respuesta"><b>Respuesta del usuario final:</b> «{{ c.respuesta }}»</div>
                  } @else {
                    <div class="alert warn">
                      <span class="alert-ico">!</span>
                      <span>El usuario final aún no responde. Puede <b>reenviar</b> el formulario o abrir la vista externa para la demostración.</span>
                    </div>
                  }
                  <button class="btn btn-primary btn-sm mt-2" (click)="reenviar(e.expediente)">Reenviar formulario</button>
                }

                <div class="row mt-2">
                  <a class="btn btn-gold btn-sm" [routerLink]="['/formulario-conformidad', c.token]" target="_blank">
                    Abrir formulario externo (simulación)
                  </a>
                  @if (intentos().length) {
                    <button class="btn btn-ghost btn-sm" (click)="verHistorial.set(!verHistorial())">
                      {{ verHistorial() ? 'Ocultar' : 'Ver' }} historial de intentos ({{ intentos().length }})
                    </button>
                  }
                  <a class="btn btn-outline btn-sm" routerLink="/trazabilidad">Ver trazabilidad</a>
                </div>

                @if (verHistorial()) {
                  <div class="hist mt-2">
                    @for (i of intentos(); track i.id) {
                      <div class="hist-item">
                        <div class="row-between">
                          <b>Intento de aceptación #{{ i.numero }}</b>
                          <ui-badge [estado]="i.resultado" />
                        </div>
                        <div class="small muted">{{ i.fecha || i.fechaEnvio }} @if (i.hora) { · {{ i.hora }} }</div>
                        @if (i.observacion) { <div class="small">Observación: {{ i.observacion }}</div> }
                        @if (i.firma) { <div class="small">Firma: {{ i.firma }}</div> }
                        @if (i.correccionRealizada) { <div class="small">Corrección previa: {{ i.correccionRealizada }}</div> }
                      </div>
                    }
                  </div>
                }
              } @else {
                <div class="alert">
                  <span class="alert-ico">i</span>
                  <span>Aún no se ha enviado el formulario de conformidad para esta entrega.</span>
                </div>
                <button class="btn btn-primary mt-2" (click)="enviar(e.expediente)" [disabled]="!e.f0302Generado">
                  Enviar formulario de conformidad
                </button>
                @if (!e.f0302Generado) {
                  <p class="small muted mt-1">Se habilita al generar el F0302.</p>
                }
              }
            </div>
          </div>
        </div>
      } @else {
        <div class="card card-pad">
          <p class="muted">
            @if (auth.esTecnico()) {
              No tiene entregas asignadas. Las entregas donde usted participa aparecerán aquí al enviar el formulario de conformidad desde Configuración F0302.
            } @else {
              No hay entregas registradas todavía. Las entregas aparecen al enviar el formulario de conformidad desde Configuración F0302.
            }
          </p>
        </div>
      }

      @if (buscarAbierto()) {
        <app-buscar-expediente-unico
          [filas]="opciones()"
          sub="Busque por código de expediente único, solicitud, inventario o usuario final"
          (seleccionar)="elegir($event)"
          (cerrar)="buscarAbierto.set(false)" />
      }
    </div>
  `
})
export class EntregaComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly casoActivo = inject(CasoActivoService);

  protected seleccion = signal('');
  protected buscarAbierto = signal(false);

  /** Catálogo de búsqueda: solo los expedientes únicos con entrega visible para el rol. */
  protected readonly opciones = computed<FilaExpedienteUnico[]>(() =>
    this.data.entregasVisibles()
      .map((e) => this.data.expedienteUnicoDe(e.expediente))
      .filter((x): x is NonNullable<typeof x> => !!x)
      .map((x) => filaExpedienteUnico(this.data, x))
  );

  /**
   * Con una sola entrega disponible se carga automáticamente; con varias, se retoma el último
   * caso activo si sigue visible para el rol, o se requiere el modal «Buscar expediente».
   */
  protected readonly entrega = computed(() => {
    const visibles = this.data.entregasVisibles();
    if (visibles.length === 1) return visibles[0];
    const sel = this.seleccion() || this.casoActivo.expediente();
    return visibles.find((e) => e.expediente === sel);
  });

  protected elegir(id: string): void {
    this.seleccion.set(id);
    this.casoActivo.seleccionar(id);
    this.buscarAbierto.set(false);
  }

  protected readonly conformidad = computed(() => {
    const e = this.entrega();
    return e ? this.data.conformidadDeProceso(e.expediente) : undefined;
  });

  // ---------- Estado del ciclo de aceptación y no conformidad ----------
  protected readonly estadoAcept = computed(() => {
    const e = this.entrega();
    return e ? this.data.estadoAceptacion(e.expediente) : 'Sin enviar';
  });
  protected readonly intentos = computed(() => {
    const e = this.entrega();
    return e ? this.data.intentosDe(e.expediente) : [];
  });
  protected readonly ultimoIntento = computed(() => {
    const e = this.entrega();
    return e ? this.data.ultimoIntento(e.expediente) : undefined;
  });
  protected readonly correccionActiva = computed(() => {
    const e = this.entrega();
    return e ? this.data.correccionActivaDe(e.expediente) : undefined;
  });
  protected readonly correccionLista = computed(() => {
    const e = this.entrega();
    return e ? this.data.correccionListaParaReenvio(e.expediente) : undefined;
  });
  /** Caso B: la revisión técnica está completa (nuevo Expediente técnico Preparado) y se puede registrar la corrección. */
  protected readonly revisionTecnicaLista = computed(() => {
    const cor = this.correccionActiva();
    return !!cor && cor.requiereNuevoExpediente && this.data.revisionTecnicaCompleta(cor);
  });
  protected readonly unicoCod = computed(() => {
    const e = this.entrega();
    return e ? (this.data.expedienteUnicoDe(e.expediente)?.codigoUnico ?? e.expediente) : '';
  });

  /** Formulario de corrección de la no conformidad. */
  protected tipoCorreccion = signal<TipoCorreccion>('Corrección de configuración');
  /** Evaluación de nuevo Expediente técnico: '' sin responder · 'Sí' Caso B · 'No' Caso A. */
  protected requiereNuevoET = signal<RespuestaSiNo>('');
  protected motivoTecnico = signal('');
  protected accionPosterior = signal('');
  protected responsableRevision = signal('');
  protected descCorreccion = signal('');
  protected hubo = signal<RespuestaSiNo>('');
  protected detalle = signal('');
  protected obsTecnica = signal('');
  protected verHistorial = signal(false);

  /** Habilita «Iniciar corrección»: exige responder si requiere nuevo ET y, si es Sí, los tres campos técnicos. */
  protected puedeIniciar(): boolean {
    if (this.requiereNuevoET() === '') return false;
    if (this.requiereNuevoET() === 'Sí') {
      return !!(this.motivoTecnico().trim() && this.accionPosterior().trim() && this.responsableRevision().trim());
    }
    return true;
  }

  /** Solo el Técnico de Soporte (o Enc. de Soporte / Administrador) registra la corrección. */
  protected puedeAtender(): boolean {
    const c = this.auth.usuario()?.clave;
    return c === 'tec-soporte' || c === 'enc-soporte' || c === 'admin';
  }
  protected accionSugerida(): string {
    const cor = this.correccionActiva();
    if (cor?.requiereNuevoExpediente && !this.data.revisionTecnicaCompleta(cor)) {
      return 'Crear el nuevo Expediente técnico y completar la Preparación F0288 (revisión técnica).';
    }
    if (this.correccionActiva()) return 'Registrar la corrección realizada y finalizarla.';
    if (this.correccionLista()) return 'Reenviar el formulario de aceptación (nuevo intento).';
    return 'Clasificar la corrección y evaluar si requiere un nuevo Expediente técnico.';
  }

  protected enviar(id: string): void {
    const u = this.auth.usuario();
    const c = this.data.enviarConformidad(id, `${u?.nombre} — ${u?.rol}`);
    if (typeof c === 'string') { this.toast.error('No es posible enviar', c); return; }
    this.toast.ok('Formulario enviado', `Enlace único enviado a ${c.correo}.`);
  }

  protected reenviar(id: string): void {
    const u = this.auth.usuario();
    const c = this.data.enviarConformidad(id, `${u?.nombre} — ${u?.rol}`);
    if (typeof c === 'string') { this.toast.error('No es posible reenviar', c); return; }
    this.toast.ok('Formulario reenviado', 'Se envió nuevamente el enlace al correo institucional del usuario final.');
  }

  protected iniciar(id: string): void {
    const u = this.auth.usuario();
    const requiere = this.requiereNuevoET() === 'Sí';
    const r = this.data.iniciarCorreccion(id, this.tipoCorreccion(), requiere, `${u?.nombre} — ${u?.rol}`, {
      motivoTecnico: this.motivoTecnico(), accionPosterior: this.accionPosterior(), responsableRevision: this.responsableRevision()
    });
    if (typeof r === 'string') { this.toast.error('No se pudo iniciar la corrección', r); return; }
    this.descCorreccion.set(''); this.hubo.set(''); this.detalle.set(''); this.obsTecnica.set('');
    this.requiereNuevoET.set(''); this.motivoTecnico.set(''); this.accionPosterior.set(''); this.responsableRevision.set('');
    this.toast.ok('Corrección iniciada', r.requiereNuevoExpediente
      ? `${r.tipo}. Caso B: el equipo volvió a Hardware para revisión técnica; cree el nuevo Expediente técnico y complete la Preparación F0288.`
      : `${r.tipo}. Registre la corrección realizada y finalícela para reenviar el formulario.`);
  }

  protected finalizar(idCor: string): void {
    const err = this.data.finalizarCorreccion(idCor, {
      descripcion: this.descCorreccion(), huboComplejidad: this.hubo(),
      detalleComplejidad: this.detalle(), observacionTecnica: this.obsTecnica()
    });
    if (err) { this.toast.error('Revise la corrección', err); return; }
    this.toast.ok('Corrección finalizada', 'Ya puede reenviar el formulario de aceptación al usuario final.');
  }

  protected reenviarAceptacion(id: string): void {
    const u = this.auth.usuario();
    const r = this.data.reenviarFormularioAceptacion(id, `${u?.nombre} — ${u?.rol}`);
    if (typeof r === 'string') { this.toast.error('No se pudo reenviar', r); return; }
    this.toast.ok('Formulario reenviado', 'Se creó un nuevo intento de aceptación y se envió el enlace al usuario final.');
  }
}
