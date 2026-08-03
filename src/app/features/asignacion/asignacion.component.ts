import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { CasoActivoService } from '../../core/services/caso-activo.service';
import { Equipo } from '../../core/models/models';
import { BadgeComponent, HelpTipComponent, MarcaModeloPipe, ModalComponent, TipoRequerimientoPipe } from '../../shared/ui';

/**
 * Asignación de equipo a usuario final. Solo se asignan equipos del Inventario de Hardware
 * que ya están preparados: con Expediente técnico completado y F0288 finalizado.
 */
@Component({
  selector: 'app-asignacion',
  imports: [FormsModule, BadgeComponent, HelpTipComponent, MarcaModeloPipe, ModalComponent, TipoRequerimientoPipe],
  styles: `
    .resumen-eq { background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 14px 16px; }
    .resumen-eq .eq-nombre { font-size: 17px; font-weight: 700; color: var(--navy-900); }
    .resumen-eq .eq-datos { font-size: 12.5px; color: var(--tx-2); margin-top: 3px; }
    .fase-tbl { font-size: 12.5px; }
    .busq-filtros { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 10px; margin-bottom: 14px; }
    @media (max-width: 800px) { .busq-filtros { grid-template-columns: 1fr; } }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Gestión</div>
          <h1>
            Asignación de equipo
            <ui-help texto="Solo pueden asignarse equipos preparados: con Expediente técnico completado, F0288 finalizado y sin asignación previa. El responsable de asignación se toma del usuario conectado." />
          </h1>
          <p class="page-sub">Selección del equipo preparado y asignación al usuario final.</p>
        </div>
      </div>

      @if (!esEncargado()) {
        <div class="alert warn mb-2">
          <span class="alert-ico">!</span>
          <span><b>No tiene permisos para realizar asignaciones.</b> Esta acción corresponde a un Encargado. La pantalla se muestra en modo consulta.</span>
        </div>
      }

      <div class="card mb-3">
        <div class="card-head">
          <div>
            <h2>Nueva asignación</h2>
            <p class="sub">Seleccione la solicitud entrante y busque un equipo preparado y no asignado</p>
          </div>
        </div>
        <div class="card-body">
          <div class="form-grid">
            <div class="field">
              <label>Solicitud / requerimiento <span class="req">*</span></label>
              <select class="control" [(ngModel)]="solicitudSel" [disabled]="!esEncargado()">
                <option value="" disabled>Seleccione una solicitud entrante…</option>
                @for (s of entrantes(); track s.expediente) {
                  <option [value]="s.expediente">{{ s.expediente }} — {{ s.tipoEquipo | tipoRequerimiento }} · {{ s.descripcion }}</option>
                }
              </select>
              @if (entrantes().length === 0) {
                <span class="hint">No hay solicitudes entrantes pendientes de asignación.</span>
              }
            </div>

            <div class="field">
              <label>Usuario a quien se asignará</label>
              <input class="control" readonly [value]="sol() ? sol()!.destinatario + ' — ' + sol()!.unidadDestino : '—'" />
            </div>

            <div class="field full">
              <label>
                Equipo preparado <span class="req">*</span>
                <ui-help texto="La búsqueda solo muestra equipos preparados (F0288 finalizado), con expediente técnico y no asignados. Los equipos pendientes de preparación no aparecen." />
              </label>
              @if (equipo(); as e) {
                <div class="resumen-eq">
                  <div class="row-between">
                    <div>
                      <div class="eq-nombre">{{ e | marcaModelo }}</div>
                      <div class="eq-datos">
                        {{ e.tipo === 'Desktop' ? 'CPU / Desktop' : 'Laptop' }} · inventario {{ e.inventario }} ·
                        {{ e.procesador }} · {{ e.ram.split('·')[0].trim() }}
                      </div>
                      <div class="eq-datos">
                        Expediente técnico <b class="mono">{{ expTecEquipo()?.codigo }}</b> ·
                        F0288 <ui-badge [estado]="'Completada'" /> ·
                        <ui-badge [estado]="'Preparado'" />
                      </div>
                    </div>
                    <div class="row" style="flex-direction: column; align-items: flex-end; gap: 8px;">
                      <ui-badge [estado]="e.condicion" />
                      <button class="btn btn-outline btn-sm" (click)="abrirBusqueda()" [disabled]="!esEncargado()">Cambiar equipo</button>
                    </div>
                  </div>
                </div>
              } @else {
                <div class="row">
                  <button class="btn btn-outline" (click)="abrirBusqueda()" [disabled]="!esEncargado()">🔍 Buscar equipo preparado</button>
                  <span class="hint">Solo aparecen equipos preparados, con expediente técnico y no asignados.</span>
                </div>
              }
            </div>

            @if (tipoNoCoincide()) {
              <div class="full alert warn">
                <span class="alert-ico">!</span>
                <span>La solicitud pide <b>{{ sol()?.tipoEquipo === 'Desktop' ? 'CPU / Desktop' : 'Laptop' }}</b> y el equipo seleccionado es <b>{{ equipo()?.tipo === 'Desktop' ? 'CPU / Desktop' : 'Laptop' }}</b>. Verifique la selección.</span>
              </div>
            }

            <div class="field">
              <label>
                Responsable de asignación
                <ui-help texto="Se llena automáticamente con el usuario conectado. Los técnicos no realizan asignaciones: esta acción corresponde a un Encargado." />
              </label>
              <input class="control" readonly [value]="responsableTxt()" />
              @if (!esEncargado()) { <span class="error">Campo bloqueado: su rol no realiza asignaciones.</span> }
            </div>

            <div class="field">
              <label>Condición del equipo</label>
              <div class="opt-row">
                <span class="opt" [class.on]="equipo()?.condicion === 'Nuevo'"><input type="radio" disabled [checked]="equipo()?.condicion === 'Nuevo'" /> Nuevo</span>
                <span class="opt" [class.on]="equipo()?.condicion === 'Usado'"><input type="radio" disabled [checked]="equipo()?.condicion === 'Usado'" /> Usado</span>
              </div>
              <span class="hint">La condición proviene del equipo del inventario, no de la solicitud.</span>
            </div>

            @if (esLaptop()) {
              <div class="full alert">
                <span class="alert-ico">i</span>
                <span><b>Laptop:</b> la Dirección decide la asignación y el Encargado de Soporte ejecuta el registro en SISGOST.</span>
              </div>
            }

            @if (memorandoBloqueado()) {
              <div class="full alert danger">
                <span class="alert-ico">!</span>
                <span>Esta solicitud es un <b>Requerimiento de Laptop</b>. La asignación solo puede ser registrada por el <b>Encargado de Soporte</b>.</span>
              </div>
            }

            @if (hardwareLaptop()) {
              <div class="full alert danger">
                <span class="alert-ico">!</span>
                <span>El <b>Encargado de Hardware</b> no está habilitado para asignar laptops. Las laptops las asigna el Encargado de Soporte según decisión de la Dirección.</span>
              </div>
            }

            @if (requiereMotivo()) {
              <div class="full alert warn">
                <span class="alert-ico">!</span>
                <span>Para asignar un <b>CPU nuevo desde Hardware</b> debe registrar la autorización o motivo correspondiente.</span>
              </div>
              <div class="field full">
                <label>Motivo de autorización / observación obligatoria <span class="req">*</span></label>
                <textarea class="control" [class.invalid]="motivoInvalido()" rows="3"
                  placeholder="Ej.: reposición urgente por falla del equipo anterior; autorización DTI-2026-…"
                  [(ngModel)]="observacion" [disabled]="!esEncargado()"></textarea>
                @if (motivoInvalido()) { <span class="error">La observación es obligatoria para este caso.</span> }
              </div>
            } @else {
              <div class="field full">
                <label>Observación <span class="hint">(opcional)</span></label>
                <textarea class="control" rows="2" placeholder="Observaciones de la asignación…" [(ngModel)]="observacion" [disabled]="!esEncargado()"></textarea>
              </div>
            }
          </div>
        </div>
        <div class="card-foot">
          <span class="small muted" style="margin-right: auto;">Después de asignar: <b>crear el Expediente único y continuar a configuración</b>.</span>
          <button class="btn btn-primary btn-lg" (click)="asignar()"
            [disabled]="!esEncargado() || !solicitudSel() || !equipoSel() || hardwareLaptop() || memorandoBloqueado()">
            Asignar equipo
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <h2>Asignaciones registradas</h2>
            <p class="sub">Incluye los responsables técnicos por fase de cada proceso</p>
          </div>
        </div>
        <div class="card-body">
          @for (a of data.asignaciones(); track a.expediente) {
            <details class="acc">
              <summary>
                <span class="mono">{{ a.expediente }}</span>
                <span class="muted small">{{ data.equipoDe(a.equipoInventario) | marcaModelo }} · {{ a.usuarioFinal }}</span>
                <ui-badge [estado]="a.estado" />
                <span class="acc-arrow">▶</span>
              </summary>
              <div class="acc-body">
                <div class="grid grid-2">
                  <dl class="dl">
                    <dt>Asignado por</dt><dd>{{ a.responsableAsignacion }}</dd>
                    <dt>Fecha</dt><dd>{{ a.fecha }}</dd>
                    <dt>Expediente técnico</dt><dd class="mono">{{ a.responsablesFase.expedienteTecnico || '—' }}</dd>
                    <dt>Decisión de Dirección</dt><dd>{{ a.decideDireccion ? 'Sí — la Dirección decidió el destinatario' : 'No aplica' }}</dd>
                    @if (a.observacion) { <dt>Observación</dt><dd>{{ a.observacion }}</dd> }
                  </dl>
                  <div>
                    <div class="sec-title">Responsables técnicos por fase</div>
                    <table class="tbl fase-tbl">
                      <thead><tr><th>Fase</th><th>Responsable</th><th>Estado</th></tr></thead>
                      <tbody>
                        <tr>
                          <td>Preparación (F0288)</td>
                          <td>{{ a.responsablesFase.tecnicoPreparacion }}</td>
                          <td><ui-badge [estado]="a.responsablesFase.estadoPreparacion" /></td>
                        </tr>
                        <tr>
                          <td>Configuración (F0302)</td>
                          <td>{{ a.responsablesFase.tecnicoConfiguracion }}</td>
                          <td><ui-badge [estado]="a.responsablesFase.estadoConfiguracion" /></td>
                        </tr>
                        <tr>
                          <td>Entrega</td>
                          <td>{{ a.responsablesFase.responsableEntrega }}</td>
                          <td><ui-badge [estado]="a.responsablesFase.estadoEntrega" /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </details>
          } @empty {
            <p class="muted">Aún no hay asignaciones registradas.</p>
          }
        </div>
      </div>

      <!-- Búsqueda de equipos preparados -->
      @if (buscarAbierto()) {
        <ui-modal titulo="Buscar equipo preparado" sub="Solo se muestran equipos preparados, no asignados y con expediente técnico completado" (cerrar)="buscarAbierto.set(false)">
          <div class="busq-filtros">
            <input class="control" type="search" placeholder="Inventario, marca o modelo…" [(ngModel)]="q" />
            <select class="control" [(ngModel)]="fTipo">
              <option value="">Tipo: todos</option>
              <option value="Laptop">Laptop</option>
              <option value="Desktop">CPU / Desktop</option>
            </select>
            <select class="control" [(ngModel)]="fCond">
              <option value="">Condición: todas</option>
              <option value="Nuevo">Nuevo</option>
              <option value="Usado">Usado</option>
            </select>
          </div>

          <div class="table-wrap">
            <table class="tbl">
              <thead>
                <tr><th>Inventario</th><th>Equipo</th><th>Expediente técnico</th><th>Preparación</th><th>Asignación</th><th style="text-align:right;"></th></tr>
              </thead>
              <tbody>
                @for (e of disponibles(); track e.inventario) {
                  <tr>
                    <td class="mono main-cell">{{ e.inventario }}</td>
                    <td>
                      <div class="main-cell">{{ e | marcaModelo }}</div>
                      <div class="sub-cell">{{ e.tipo === 'Desktop' ? 'CPU / Desktop' : 'Laptop' }} · {{ e.condicion.toLowerCase() }}</div>
                    </td>
                    <td class="mono">{{ data.expTecnicoDeEquipo(e.inventario)?.codigo }}</td>
                    <td><ui-badge [estado]="'Preparado'" /></td>
                    <td><ui-badge [estado]="'No asignado'" /></td>
                    <td>
                      <div class="row" style="justify-content: flex-end;">
                        <button class="btn btn-primary btn-sm" (click)="seleccionarEquipo(e)">Seleccionar</button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="muted" style="text-align:center; padding: 22px;">No hay equipos preparados disponibles con esos filtros. Prepare equipos desde Expediente técnico + F0288.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </ui-modal>
      }
    </div>
  `
})
export class AsignacionComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly casoActivo = inject(CasoActivoService);

  /** Llega como query param desde Solicitudes («Enviar a asignación»). */
  readonly solicitud = input<string>();

  protected solicitudSel = signal('');
  protected equipoSel = signal('');
  protected observacion = signal('');
  protected intento = signal(false);

  // Búsqueda de equipos preparados
  protected buscarAbierto = signal(false);
  protected q = signal('');
  protected fTipo = signal('');
  protected fCond = signal('');

  constructor() {
    effect(() => {
      const q = this.solicitud();
      if (q && this.data.solicitud(q)?.estado === 'Entrante') this.solicitudSel.set(q);
    });
  }

  protected readonly entrantes = computed(() =>
    this.data.solicitudes().filter((s) => s.estado === 'Entrante')
  );

  protected readonly sol = computed(() =>
    this.solicitudSel() ? this.data.solicitud(this.solicitudSel()) : undefined
  );

  protected readonly equipo = computed(() =>
    this.equipoSel() ? this.data.equipoDe(this.equipoSel()) : undefined
  );

  protected readonly expTecEquipo = computed(() =>
    this.equipoSel() ? this.data.expTecnicoDeEquipo(this.equipoSel()) : undefined
  );

  protected readonly esLaptop = computed(() =>
    this.sol()?.tipoEquipo === 'Laptop' || this.equipo()?.tipo === 'Laptop'
  );

  protected readonly tipoNoCoincide = computed(() => {
    const s = this.sol();
    const e = this.equipo();
    return !!s && !!e && s.tipoEquipo !== e.tipo;
  });

  /** El responsable de asignación se toma del usuario conectado (no es campo libre). */
  protected readonly rol = computed(() => this.auth.usuario()?.clave ?? '');
  protected readonly esEncargado = computed(() => this.rol() === 'enc-soporte' || this.rol() === 'enc-hardware');
  protected readonly responsableTxt = computed(() => {
    const u = this.auth.usuario();
    return u ? `${u.nombre} — ${u.rol}` : '—';
  });

  /** Memorando: solo el Encargado de Soporte registra la asignación. */
  protected readonly memorandoBloqueado = computed(() =>
    this.sol()?.origenTipo === 'Memorando' && this.rol() !== 'enc-soporte' && !!this.sol()
  );

  /** Encargado de Hardware + laptop: combinación no permitida. */
  protected readonly hardwareLaptop = computed(() =>
    this.rol() === 'enc-hardware' && this.esLaptop()
  );

  /** Encargado de Hardware + CPU nuevo: requiere autorización con motivo obligatorio. */
  protected readonly requiereMotivo = computed(() =>
    this.rol() === 'enc-hardware' && this.equipo()?.tipo === 'Desktop' && this.equipo()?.condicion === 'Nuevo'
  );

  protected readonly motivoInvalido = computed(() =>
    this.intento() && this.requiereMotivo() && !this.observacion().trim()
  );

  /** Solo equipos preparados, con expediente técnico y no asignados. */
  protected readonly disponibles = computed(() => {
    const q = this.q().toLowerCase().trim();
    return this.data.equiposDisponiblesParaAsignar().filter((e) => {
      if (this.fTipo() && e.tipo !== this.fTipo()) return false;
      if (this.fCond() && e.condicion !== this.fCond()) return false;
      if (!q) return true;
      return `${e.inventario} ${e.marca} ${e.modelo} ${e.serie}`.toLowerCase().includes(q);
    });
  });

  protected abrirBusqueda(): void {
    if (!this.solicitudSel()) {
      this.toast.warn('Seleccione primero la solicitud', 'Elija la solicitud entrante antes de buscar el equipo.');
      return;
    }
    const s = this.sol();
    this.fTipo.set(s?.tipoEquipo ?? '');
    this.q.set('');
    this.buscarAbierto.set(true);
  }

  protected seleccionarEquipo(e: Equipo): void {
    this.equipoSel.set(e.inventario);
    this.buscarAbierto.set(false);
  }

  protected asignar(): void {
    this.intento.set(true);
    const s = this.sol();
    if (!this.esEncargado()) {
      this.toast.error('Acción no permitida', 'No tiene permisos para realizar asignaciones. Esta acción corresponde a un Encargado.');
      return;
    }
    if (!s) {
      this.toast.warn('Seleccione la solicitud', 'Elija una solicitud entrante para asignar el equipo.');
      return;
    }
    if (!this.equipoSel()) {
      this.toast.warn('Seleccione el equipo', 'Busque y seleccione un equipo preparado del Inventario de Hardware.');
      return;
    }
    if (this.memorandoBloqueado()) {
      this.toast.error('Asignación no permitida', 'Esta solicitud es un Requerimiento de Laptop. La asignación solo puede ser registrada por el Encargado de Soporte.');
      return;
    }
    if (this.hardwareLaptop()) {
      this.toast.error('Asignación no permitida', 'El Encargado de Hardware no puede asignar laptops.');
      return;
    }
    if (this.requiereMotivo() && !this.observacion().trim()) {
      this.toast.error('Falta la observación obligatoria', 'Para asignar un CPU nuevo desde Hardware debe registrar la autorización o motivo correspondiente.');
      return;
    }
    const error = this.data.asignarEquipo(s.expediente, this.equipoSel(), this.responsableTxt(), this.observacion().trim(), this.esLaptop());
    if (error) {
      this.toast.error('No se puede asignar el equipo', error);
      return;
    }
    this.toast.ok('Equipo asignado', `${s.expediente} asignado a ${s.destinatario}. Siguiente paso: crear el Expediente único y continuar a configuración.`);
    // Deja este caso como «activo» para que Expediente único lo retome sin volver a buscarlo.
    this.casoActivo.seleccionar(s.expediente);
    this.solicitudSel.set('');
    this.equipoSel.set('');
    this.observacion.set('');
    this.intento.set(false);
  }
}
