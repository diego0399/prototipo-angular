import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Cronometro, ReprocesoF0288, ResultadoReproceso } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { BadgeComponent, HelpTipComponent, ModalComponent } from '../../shared/ui';

/**
 * Reprocesos F0288 pendientes: la bandeja de Hardware para los equipos devueltos por una falla
 * detectada en la Configuración F0302 (rollback). Un reproceso NO es una preparación nueva ni un
 * expediente técnico nuevo: es una corrección registrada dentro del expediente técnico que el
 * equipo ya tiene, con su propio checklist, su tiempo trabajado y la firma de quien la hizo.
 */
@Component({
  selector: 'app-reprocesos',
  imports: [FormsModule, RouterLink, BadgeComponent, HelpTipComponent, ModalComponent],
  styles: `
    .rep-card { border-left: 4px solid var(--warn, #c9930a); }
    .rep-card.alta { border-left-color: var(--danger, #c0392b); }
    .chk-row { display: flex; align-items: center; gap: 12px; padding: 8px 4px; border-bottom: 1px dashed var(--line); font-size: 13.5px; }
    .chk-row:last-child { border-bottom: 0; }
    .chk-row .c-nombre { flex: 1; color: var(--navy-900); font-weight: 500; }
    .chk-row .c-nombre.na { color: var(--tx-3); font-weight: 300; text-decoration: line-through solid var(--line-strong); }
    .chk-row input[type=checkbox] { width: 17px; height: 17px; accent-color: var(--ok); cursor: pointer; }
    .crono-rep { font-family: var(--font-mono, monospace); font-size: 22px; color: var(--navy-900); }
    .firma-box { border: 1px dashed var(--line-strong); border-radius: 8px; padding: 12px 14px; background: var(--bg-2, #fafafa); }
    .firma-box .f-nombre { font-family: var(--font-brand, cursive); font-size: 19px; color: var(--navy-900); }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Preparación técnica</div>
          <h1>
            Reprocesos F0288 pendientes
            <ui-help texto="Equipos devueltos a Hardware por una falla detectada en la Configuración F0302. El reproceso se registra dentro del Expediente técnico original —nunca se crea uno nuevo— y se cierra con la firma del Técnico de Hardware." />
          </h1>
          <p class="page-sub">Rollback a Hardware · corrección dentro del Expediente técnico original.</p>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-head">
          <div>
            <h3>Equipos devueltos por falla en F0302</h3>
            <p class="sub">Se atienden primero los de prioridad Alta (fallas con revisión física)</p>
          </div>
          <span class="chip">{{ pendientes().length }} pendiente(s)</span>
        </div>
        <div class="card-body table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Código reproceso</th>
                <th>Expediente técnico original</th>
                <th>Equipo</th>
                <th>Inventario</th>
                <th>Tipo de falla</th>
                <th>Prioridad</th>
                <th>Fecha de devolución</th>
                <th>Técnico de Soporte que reportó</th>
                <th>Estado</th>
                <th style="text-align:right;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (r of pendientes(); track r.id) {
                <tr>
                  <td class="mono main-cell">{{ r.id }}<div class="sub-cell">Reproceso #{{ r.numero }}</div></td>
                  <td class="mono">{{ r.expedienteTecnico }}</td>
                  <td>{{ equipoTxt(r) }}</td>
                  <td class="mono">{{ r.inventario }}</td>
                  <td>{{ r.tipoFalla }}</td>
                  <td><ui-badge [estado]="r.prioridad === 'Alta' ? 'Carga alta' : 'Carga baja'" /><div class="sub-cell">{{ r.prioridad }}</div></td>
                  <td class="mono">{{ r.fechaSolicitud }}<div class="sub-cell">{{ r.horaSolicitud }}</div></td>
                  <td>{{ r.solicitadoPor.split('—')[0].trim() }}<div class="sub-cell">{{ r.tecnicoAsignado ? 'Atiende: ' + r.tecnicoAsignado.split('—')[0].trim() : 'Sin asignar' }}</div></td>
                  <td><ui-badge [estado]="r.estado" /></td>
                  <td style="text-align:right;">
                    <button class="btn btn-ghost btn-sm" (click)="abrir(r.id)">
                      {{ seleccion() === r.id ? 'Ocultar detalle' : 'Ver detalle de falla' }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="10" class="muted" style="text-align:center; padding: 26px;">
                  No hay reprocesos F0288 pendientes. Los equipos con falla en F0302 que requieren volver a preparación aparecen aquí.
                </td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Detalle y trabajo del reproceso seleccionado -->
      @if (activo(); as r) {
        <div class="card rep-card mb-3" [class.alta]="r.prioridad === 'Alta'">
          <div class="card-head">
            <div>
              <h3>Checklist de Reproceso F0288 <span class="mono">{{ r.id }}</span></h3>
              <p class="sub">No es la preparación inicial: es la corrección de <b class="mono">{{ r.expedienteTecnico }}</b> por la falla de F0302</p>
            </div>
            <ui-badge [estado]="r.estado" />
          </div>
          <div class="card-body">
            <!-- Lo que trae de Soporte -->
            <dl class="dl">
              <dt>Expediente técnico original</dt><dd class="mono">{{ r.expedienteTecnico }} <span class="chip">No se crea uno nuevo</span></dd>
              <dt>Código del reproceso</dt><dd class="mono">{{ r.id }}</dd>
              <dt>Expediente único</dt><dd class="mono">{{ r.expedienteUnico || '—' }}</dd>
              <dt>Equipo</dt><dd>{{ equipoTxt(r) }} · <span class="mono">{{ r.inventario }}</span></dd>
              <dt>Tipo de falla reportada en F0302</dt><dd>{{ r.tipoFalla }}</dd>
              <dt>Observación de Soporte</dt><dd>{{ r.observacionSoporte || '—' }}</dd>
              <dt>Evidencia reportada por Soporte</dt><dd>{{ r.evidenciaSoporte || 'Sin evidencia adjunta' }}</dd>
              <dt>Técnico de Hardware asignado</dt>
              <dd>
                {{ r.tecnicoAsignado || 'Sin asignar' }}
                @if (r.justificacionUnidad) { <div class="sub-cell">Excepción autorizada: {{ r.justificacionUnidad }}</div> }
                @if (r.fechaAsignacion) { <div class="sub-cell">{{ r.asignadoPor }} · {{ r.fechaAsignacion }} {{ r.horaAsignacion }}</div> }
              </dd>
            </dl>

            <!-- Rollback: asignación a un Técnico de Hardware -->
            @if (r.estado === 'Requerido' || r.estado === 'Asignado') {
              <div class="card card-pad mt-2">
                <div class="row-between" style="flex-wrap: wrap; gap: 12px;">
                  <div>
                    <b class="small">Rollback a Hardware</b>
                    <p class="small muted">El equipo regresa a la Unidad de Hardware. Puede tomarlo el mismo técnico que lo preparó u otro.</p>
                  </div>
                  <button class="btn btn-primary btn-sm" (click)="abrirAsignacion(r)">
                    {{ r.tecnicoAsignado ? 'Reasignar técnico' : 'Asignar Técnico de Hardware' }}
                  </button>
                </div>
                @if (preparoInicialmente(r); as prev) {
                  <span class="hint">Preparó inicialmente este equipo: <b>{{ prev }}</b>.</span>
                }
              </div>
            }

            <!-- Cronómetro del reproceso -->
            @if (r.cronometro; as cr) {
              <div class="card card-pad mt-2">
                <div class="row-between" style="flex-wrap: wrap; gap: 12px;">
                  <div>
                    <b class="small">Tiempo trabajado del reproceso</b>
                    <p class="small muted">Inicio {{ cr.fechaInicio }} · {{ cr.horaInicio }}@if (cr.horaFin) { → fin {{ cr.fechaFin }} · {{ cr.horaFin }} }</p>
                  </div>
                  <div class="crono-rep">{{ transcurrido(cr) }}</div>
                </div>
              </div>
            }

            <!-- Checklist dinámico según el tipo de falla -->
            <div class="sec-title mt-3">Checklist de Reproceso F0288 — {{ r.tipoFalla }}</div>
            @for (i of r.checklist; track i.nombre) {
              <div class="chk-row">
                <input type="checkbox" [checked]="i.estado === 'Realizado'" [disabled]="r.estado !== 'En proceso'"
                  (change)="marcar(r, i.nombre, $event)" />
                <span class="c-nombre" [class.na]="i.estado === 'No aplica'">
                  {{ i.nombre }}
                  @if (i.implicaCorreccion) { <span class="chip">Exige evidencia si se marca</span> }
                </span>
                @if (r.estado === 'En proceso') {
                  <button class="btn btn-ghost btn-sm" (click)="noAplica(r, i.nombre, i.estado)">
                    {{ i.estado === 'No aplica' ? 'Vuelve a aplicar' : 'No aplica' }}
                  </button>
                } @else {
                  <ui-badge [estado]="i.estado" />
                }
              </div>
            }
            @if (data.reprocesoExigeEvidencia(r)) {
              <div class="alert warn mt-2">
                <span class="alert-ico">!</span>
                <span>Se marcó un ítem que implica <b>cambio, reparación o corrección técnica</b>: la evidencia es obligatoria para finalizar el reproceso.</span>
              </div>
            }

            <!-- Evidencias del reproceso -->
            <div class="sec-title mt-3">Evidencias del reproceso</div>
            @for (e of r.evidencias; track e.archivo) {
              <div class="sub-cell">{{ e.archivo }} · {{ e.tipo }} · {{ e.cargadaPor }} · {{ e.fecha }} {{ e.hora }} · <span class="mono">{{ e.reproceso }}</span></div>
            } @empty {
              <p class="small muted">Sin evidencias adjuntas.</p>
            }
            @if (r.estado === 'En proceso') {
              <div class="grid grid-2 mt-1">
                <div class="field">
                  <label>Archivo de evidencia</label>
                  <input class="control" [ngModel]="evArchivo()" (ngModelChange)="evArchivo.set($event)" placeholder="captura-diagnostico-disco.png" />
                </div>
                <div class="field">
                  <label>Tipo de evidencia</label>
                  <input class="control" [ngModel]="evTipo()" (ngModelChange)="evTipo.set($event)" placeholder="Evidencia de corrección" />
                </div>
              </div>
              <div class="row" style="justify-content: flex-end;">
                <button class="btn btn-outline btn-sm" (click)="agregarEvidencia(r)">Adjuntar evidencia</button>
              </div>
            }

            <!-- Cierre técnico -->
            @if (r.estado === 'En proceso') {
              <div class="field mt-2">
                <label>Corrección técnica realizada <span class="req">*</span></label>
                <textarea class="control" rows="2" [ngModel]="correccion()" (ngModelChange)="correccion.set($event)"
                  placeholder="Qué se revisó o corrigió en el equipo (obligatorio)…"></textarea>
              </div>
              <div class="field">
                <label>Observaciones de Hardware</label>
                <textarea class="control" rows="2" [ngModel]="observaciones()" (ngModelChange)="observaciones.set($event)"></textarea>
              </div>
            } @else if (r.correccionTecnica) {
              <dl class="dl mt-2">
                <dt>Corrección técnica</dt><dd>{{ r.correccionTecnica }}</dd>
                @if (r.observaciones) { <dt>Observaciones de Hardware</dt><dd>{{ r.observaciones }}</dd> }
                <dt>Tiempo trabajado</dt><dd>{{ data.formatoDuracion(r.cronometro?.duracionMinutos ?? null) || 'menos de 1 min' }}</dd>
              </dl>
            }

            <!-- Firma y resultado -->
            @if (r.firma; as f) {
              <div class="sec-title mt-3">Firma del Técnico de Hardware</div>
              <div class="firma-box">
                <div class="f-nombre">{{ f.firma }}</div>
                <div class="small muted">{{ f.nombre }} · {{ f.cargo }} · {{ f.unidad }} · {{ f.fecha }} {{ f.hora }}</div>
              </div>
              <dl class="dl mt-2">
                <dt>Resultado del reproceso</dt><dd><ui-badge [estado]="r.resultado" /></dd>
                @if (r.observacionResultado) { <dt>Observación del resultado</dt><dd>{{ r.observacionResultado }}</dd> }
              </dl>
            } @else if (r.estado === 'Finalizado') {
              <div class="alert warn mt-2">
                <span class="alert-ico">!</span>
                <span>El reproceso está finalizado pero <b>no firmado</b>. Sin la firma del Técnico de Hardware no se cierra ni devuelve el equipo a Configuración F0302.</span>
              </div>
            }

            <!-- Acciones del reproceso -->
            <div class="row mt-3" style="flex-wrap: wrap;">
              @if (r.estado === 'Asignado') {
                <button class="btn btn-primary" (click)="iniciar(r)">Iniciar reproceso</button>
              } @else if (r.estado === 'En proceso') {
                <button class="btn btn-primary" (click)="finalizar(r)">Finalizar reproceso</button>
              } @else if (r.estado === 'Finalizado') {
                <button class="btn btn-primary" (click)="firmaAbierta.set(true)">Firmar reproceso</button>
              } @else if (r.estado === 'Firmado') {
                <button class="btn btn-primary" (click)="devolver(r)">Devolver a Configuración F0302</button>
              }
              @if (r.firma) {
                <button class="btn btn-outline" (click)="descargarConstancia(r)">Constancia de Reproceso F0288</button>
              }
              <a class="btn btn-outline" routerLink="/trazabilidad" [queryParams]="{ inventario: r.inventario }">Ver trazabilidad</a>
            </div>
            @if (r.estado === 'Requerido') {
              <span class="hint">«Iniciar reproceso» se habilita cuando el reproceso quede asignado a un Técnico de Hardware.</span>
            }
            @if (r.estado === 'No corregido') {
              <div class="alert warn mt-2">
                <span class="alert-ico">!</span>
                <span>El reproceso cerró como <b>{{ r.resultado }}</b>: el equipo no vuelve a Configuración F0302 hasta que el Encargado resuelva. {{ r.observacionResultado }}</span>
              </div>
            }
          </div>
        </div>
      }

      <!-- Buscador de técnicos de Hardware con carga laboral -->
      @if (asignarAbierto() && activo(); as r) {
        <ui-modal titulo="Asignar reproceso a un Técnico de Hardware" (cerrar)="asignarAbierto.set(false)">
          <p class="small muted">
            El equipo <b class="mono">{{ r.inventario }}</b> regresa a Hardware por <b>{{ r.tipoFalla }}</b>.
            Puede tomarlo el mismo técnico que lo preparó o cualquier otro.
          </p>
          <div class="table-wrap mt-2">
            <table class="tbl">
              <thead><tr><th>Técnico de Hardware</th><th>Preparaciones abiertas</th><th>Reprocesos abiertos</th><th>Carga</th><th style="text-align:right;"></th></tr></thead>
              <tbody>
                @for (t of tecnicos(); track t.nombreRol) {
                  <tr>
                    <td>
                      <div class="main-cell">{{ t.usuario.nombre }}</div>
                      <div class="sub-cell">{{ t.usuario.rol }} · {{ t.usuario.unidad }}</div>
                      @if (t.nombreRol === preparoInicialmente(r)) { <span class="chip">Preparó este equipo</span> }
                    </td>
                    <td class="mono">{{ t.preparaciones }}</td>
                    <td class="mono">{{ t.reprocesos }}</td>
                    <td><ui-badge [estado]="t.carga" /></td>
                    <td style="text-align:right;">
                      <button class="btn btn-primary btn-sm" (click)="asignar(r, t.nombreRol)">Asignar</button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="muted" style="text-align:center; padding: 20px;">No hay técnicos de Hardware activos.</td></tr>
                }
              </tbody>
            </table>
          </div>
          @if (esEncargado()) {
            <div class="field mt-2">
              <label>Excepción: asignar fuera de Hardware</label>
              <input class="control" [ngModel]="otroTecnico()" (ngModelChange)="otroTecnico.set($event)" placeholder="Nombre — Rol del técnico…" />
              <textarea class="control mt-1" rows="2" [ngModel]="justificacion()" (ngModelChange)="justificacion.set($event)"
                placeholder="Justifique por qué este reproceso no lo atiende Hardware (obligatorio)…"></textarea>
              <span class="hint">Solo un Encargado puede autorizarlo, y queda registrado con su justificación.</span>
              <div class="row mt-1" style="justify-content: flex-end;">
                <button class="btn btn-outline btn-sm" (click)="asignar(r, otroTecnico())">Asignar con excepción</button>
              </div>
            </div>
          }
        </ui-modal>
      }

      <!-- Firma y resultado del reproceso -->
      @if (firmaAbierta() && activo(); as r) {
        <ui-modal titulo="Firmar reproceso F0288" (cerrar)="firmaAbierta.set(false)">
          <p class="small muted">
            La firma es lo que cierra el reproceso <b class="mono">{{ r.id }}</b>: deja constancia de quién intervino el equipo.
          </p>
          <div class="field mt-2">
            <label>Resultado del reproceso <span class="req">*</span></label>
            <select class="control" [ngModel]="resultado()" (ngModelChange)="resultado.set($event)">
              <option value="">Seleccione…</option>
              @for (x of resultados; track x) { <option [value]="x">{{ x }}</option> }
            </select>
          </div>
          @if (resultado() && resultado() !== 'Corregido') {
            <div class="field">
              <label>Observación del resultado <span class="req">*</span></label>
              <textarea class="control" rows="2" [ngModel]="obsResultado()" (ngModelChange)="obsResultado.set($event)"
                placeholder="Qué impidió corregirlo y qué debe resolver el Encargado…"></textarea>
            </div>
          }
          <div class="field">
            <label>Firma del Técnico de Hardware <span class="req">*</span></label>
            <input class="control" [ngModel]="firmante()" (ngModelChange)="firmante.set($event)" />
            <span class="hint">Firma simulada del prototipo. Se guardan nombre, cargo, unidad, fecha y hora.</span>
          </div>
          <div class="row mt-2" style="justify-content: flex-end;">
            <button class="btn btn-outline" (click)="firmaAbierta.set(false)">Cancelar</button>
            <button class="btn btn-primary" (click)="firmar(r)">Firmar y cerrar reproceso</button>
          </div>
        </ui-modal>
      }
    </div>
  `
})
export class ReprocesosComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected seleccion = signal('');
  protected asignarAbierto = signal(false);
  protected firmaAbierta = signal(false);
  protected evArchivo = signal('');
  protected evTipo = signal('');
  protected correccion = signal('');
  protected observaciones = signal('');
  protected resultado = signal<ResultadoReproceso | ''>('');
  protected obsResultado = signal('');
  protected firmante = signal('');
  protected otroTecnico = signal('');
  protected justificacion = signal('');

  protected readonly resultados: ResultadoReproceso[] =
    ['Corregido', 'No corregido', 'Requiere sustitución de equipo', 'Requiere evaluación del Encargado'];

  /** Tic de 1 s para que el cronómetro del reproceso avance a la vista. */
  private readonly tick = signal(Date.now());

  constructor() {
    const intervalo = setInterval(() => this.tick.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(intervalo));
  }

  /** Reprocesos pendientes que el usuario conectado puede ver, ordenados por prioridad. */
  protected readonly pendientes = computed<ReprocesoF0288[]>(() => {
    const visibles = new Set(this.data.reprocesosVisibles().map((r) => r.id));
    return this.data.reprocesosPendientes().filter((r) => visibles.has(r.id));
  });

  protected readonly activo = computed(() => this.pendientes().find((r) => r.id === this.seleccion())
    ?? this.data.reprocesos().find((r) => r.id === this.seleccion()));

  protected readonly tecnicos = computed(() => this.data.tecnicosHardwareConCarga());

  protected esEncargado(): boolean {
    const c = this.auth.usuario()?.clave;
    return c === 'enc-hardware' || c === 'enc-soporte' || c === 'admin';
  }

  private get usuarioActual(): string {
    const u = this.auth.usuario();
    return `${u?.nombre} — ${u?.rol}`;
  }

  protected equipoTxt(r: ReprocesoF0288): string {
    const eq = this.data.equipoDe(r.inventario);
    return eq ? `${eq.marca} ${eq.modelo}` : '—';
  }

  protected preparoInicialmente(r: ReprocesoF0288): string {
    return this.data.tecnicoPreparoInicialmente(r.inventario);
  }

  protected transcurrido(c: Cronometro): string {
    this.tick();
    if (c.duracionMinutos !== null) return this.data.formatoDuracion(c.duracionMinutos) || 'menos de 1 min';
    return this.data.formatoDuracion(this.data.minutosTranscurridos(c)) || 'menos de 1 min';
  }

  protected abrir(id: string): void {
    const nuevo = this.seleccion() === id ? '' : id;
    this.seleccion.set(nuevo);
    const r = nuevo ? this.data.reprocesoDe(nuevo) : undefined;
    // El formulario se carga con lo que el reproceso ya tenga, para no perder lo escrito antes.
    this.correccion.set(r?.correccionTecnica ?? '');
    this.observaciones.set(r?.observaciones ?? '');
    this.firmante.set(r?.tecnicoAsignado || this.usuarioActual);
    this.resultado.set(r?.resultado ?? '');
    this.obsResultado.set(r?.observacionResultado ?? '');
    this.evArchivo.set(''); this.evTipo.set('');
  }

  protected abrirAsignacion(r: ReprocesoF0288): void {
    this.seleccion.set(r.id);
    this.otroTecnico.set('');
    this.justificacion.set('');
    this.asignarAbierto.set(true);
  }

  protected asignar(r: ReprocesoF0288, tecnico: string): void {
    const error = this.data.asignarReprocesoF0288(r.id, tecnico, this.usuarioActual, this.justificacion());
    if (error) { this.toast.error('No se pudo asignar el reproceso', error); return; }
    this.asignarAbierto.set(false);
    this.firmante.set(tecnico);
    this.toast.ok('Rollback a Hardware registrado',
      `${r.id} quedó asignado a ${tecnico}. El Expediente técnico ${r.expedienteTecnico} sigue siendo el mismo.`);
  }

  protected iniciar(r: ReprocesoF0288): void {
    const error = this.data.iniciarReprocesoF0288(r.id, this.usuarioActual);
    if (error) { this.toast.error('No se pudo iniciar el reproceso', error); return; }
    this.toast.ok('Reproceso F0288 iniciado', 'Se inició el cronómetro del tiempo trabajado y se cargó el checklist según el tipo de falla.');
  }

  protected marcar(r: ReprocesoF0288, item: string, ev: Event): void {
    const marcado = (ev.target as HTMLInputElement).checked;
    const error = this.data.marcarItemReproceso(r.id, item, marcado ? 'Realizado' : 'Pendiente');
    if (error) this.toast.error('No se pudo actualizar el checklist', error);
  }

  protected noAplica(r: ReprocesoF0288, item: string, estadoActual: string): void {
    const error = this.data.marcarItemReproceso(r.id, item, estadoActual === 'No aplica' ? 'Pendiente' : 'No aplica');
    if (error) this.toast.error('No se pudo actualizar el checklist', error);
  }

  protected agregarEvidencia(r: ReprocesoF0288): void {
    const error = this.data.agregarEvidenciaReproceso(r.id, this.evArchivo(), this.evTipo(), this.usuarioActual);
    if (error) { this.toast.error('No se pudo adjuntar la evidencia', error); return; }
    this.evArchivo.set(''); this.evTipo.set('');
    this.toast.ok('Evidencia adjuntada', 'Queda guardada con el código del reproceso y el expediente técnico original.');
  }

  protected finalizar(r: ReprocesoF0288): void {
    const error = this.data.finalizarReprocesoF0288(r.id, this.usuarioActual, this.correccion(), this.observaciones());
    if (error) { this.toast.error('No se puede finalizar el reproceso', error); return; }
    this.toast.ok('Reproceso F0288 finalizado',
      'Se guardó el tiempo trabajado. Falta la firma del Técnico de Hardware para cerrarlo.');
  }

  protected firmar(r: ReprocesoF0288): void {
    const error = this.data.firmarReprocesoF0288(r.id, this.usuarioActual, this.resultado(), this.obsResultado(), this.firmante());
    if (error) { this.toast.error('No se pudo firmar el reproceso', error); return; }
    this.firmaAbierta.set(false);
    this.toast.ok('Firma registrada', this.resultado() === 'Corregido'
      ? 'El reproceso quedó firmado. Devuelva el equipo a Configuración F0302 para habilitar el nuevo intento.'
      : `El reproceso cerró como «${this.resultado()}»: el caso pasa al Encargado y el equipo no vuelve a configuración.`);
  }

  protected devolver(r: ReprocesoF0288): void {
    const error = this.data.devolverAConfiguracionF0302(r.id, this.usuarioActual);
    if (error) { this.toast.error('No se pudo devolver el equipo', error); return; }
    this.toast.ok('Equipo devuelto a Configuración F0302', 'Soporte ya puede iniciar el nuevo intento F0302 sobre el mismo Expediente técnico.');
  }

  protected descargarConstancia(r: ReprocesoF0288): void {
    const lineas = this.data.constanciaReprocesoF0288(r.id);
    if (typeof lineas === 'string') { this.toast.error('No se puede generar la constancia', lineas); return; }
    const blob = new Blob([lineas.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Constancia-Reproceso-${r.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    this.data.registrarConstanciaReproceso(r.id, this.usuarioActual);
    this.toast.ok('Constancia de Reproceso F0288 generada', `Se descargó la constancia del reproceso ${r.id}.`);
  }
}
