import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { Equipo, ExpedienteTecnico, UsuarioSistema } from '../../core/models/models';
import { BadgeComponent, HelpTipComponent, ModalComponent } from '../../shared/ui';
import { TecnicoBuscadorComponent } from '../../shared/tecnico-buscador.component';

/**
 * Expediente técnico: pertenece al EQUIPO y a su preparación técnica. No tiene relación
 * con solicitudes o requerimientos (esa unión ocurre después, al crear el Expediente único).
 * Se crea desde el Inventario de Hardware para dejar el equipo listo para asignación.
 */
@Component({
  selector: 'app-expediente-tecnico',
  imports: [FormsModule, RouterLink, BadgeComponent, HelpTipComponent, ModalComponent, TecnicoBuscadorComponent],
  styles: `
    .tipo-tag { font-size: 12px; font-weight: 700; color: var(--navy-800); background: var(--blue-050); border: 1px solid var(--blue-100); border-radius: 8px; padding: 6px 12px; display: inline-block; }
    .sin-exp {
      display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: .05em;
      color: var(--danger); background: var(--danger-bg); border: 1px solid var(--danger-line);
      border-radius: 999px; padding: 3px 9px; white-space: nowrap;
    }
    .reingreso-tag {
      display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: .05em;
      color: var(--gold-600); background: var(--gold-100); border: 1px solid #e4d193;
      border-radius: 999px; padding: 3px 9px; white-space: nowrap;
    }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Proceso técnico</div>
          <h1>
            Expediente técnico
            <ui-help texto="El expediente técnico pertenece al equipo y a su preparación: se crea desde el Inventario de Hardware, alimenta el F0288 y deja el equipo listo para asignación. La relación con la solicitud se hace después, al crear el Expediente único." />
          </h1>
          <p class="page-sub">Registro técnico para la preparación del equipo.</p>
        </div>
      </div>

      <!-- Crear expediente técnico (solo Encargados) -->
      @if (puedeCrearET()) {
        <div class="card mb-3">
          <div class="card-head">
            <div>
              <h2>Crear expediente técnico</h2>
              <p class="sub">Seleccione el equipo por número de inventario; los datos se completan automáticamente</p>
            </div>
            <span class="tipo-tag">Código siguiente: {{ siguienteCodigo() }}</span>
          </div>
          <div class="card-body">
            <div class="form-grid">
              <div class="field">
                <label>
                  Número de inventario <span class="req">*</span>
                  <ui-help texto="Al hacer clic o digitar se abre el catálogo de equipos disponibles: equipos pendientes de preparación y equipos reingresados a Hardware con su ciclo anterior cerrado." />
                </label>
                <input class="control" type="text" placeholder="Clic para abrir el catálogo o digite el inventario…"
                  [ngModel]="invInput()" (ngModelChange)="digitarInventario($event)" (focus)="abrirCatalogo()"
                  [class.invalid]="eqNoEncontrado() || eqBloqueado()" />
                @if (eqNoEncontrado()) { <span class="error">No se encontró un equipo con este número de inventario.</span> }
                @if (eqBloqueado()) { <span class="error">{{ mensajeBloqueo() }}</span> }
              </div>

              @if (eqBloqueado() && ultimoET(); as bet) {
                <div class="full alert warn">
                  <span class="alert-ico">!</span>
                  <span>
                    Expediente técnico: <b class="mono">{{ bet.codigo }}</b> · {{ bet.estado }}.
                    @if (bet.estado === 'Creado' || bet.estado === 'En preparación') {
                      <a routerLink="/preparacion-tecnica">Continuar preparación F0288</a> ·
                    } @else {
                      <a routerLink="/descargo" [queryParams]="{ inventario: invInput().trim() }">Registrar descargo / reingreso</a> ·
                    }
                    <a routerLink="/trazabilidad" [queryParams]="{ inventario: invInput().trim() }">Ver trazabilidad</a>
                  </span>
                </div>
              }

              @if (eqConHistorial(); as hist) {
                <div class="full alert" style="border-color: var(--blue-100); background: var(--blue-050); flex-wrap: wrap;">
                  <span class="alert-ico">i</span>
                  <span>
                    Este equipo ya tiene expedientes técnicos anteriores registrados como historial. Puede crear un
                    nuevo Expediente técnico para el nuevo ciclo de preparación.<br />
                    <span class="small muted">
                      Último expediente: <b class="mono">{{ ultimoET()!.codigo }}</b> ·
                      Estado: {{ ultimoET()!.estado === 'Cerrado' ? 'Histórico / Finalizado' : ultimoET()!.estado }}
                      @if (ultimaPrepDelEquipo(); as p) { · Última preparación: {{ p.firma.fecha || p.fecha }} }
                      @if (motivoReingresoActual(); as m) { · Motivo del reingreso: <b>{{ m }}</b> }
                    </span>
                  </span>
                  <a class="btn btn-ghost btn-sm" style="margin-left:auto;" routerLink="/trazabilidad" [queryParams]="{ inventario: invInput().trim() }">Ver historial técnico</a>
                </div>
              }

              <div class="field">
                <label>Marca y modelo</label>
                <input class="control" readonly [value]="eqActual() ? eqActual()!.marca + ' ' + eqActual()!.modelo : '—'" />
              </div>

              <div class="field">
                <label>Tipo de equipo</label>
                <input class="control" readonly [value]="eqActual() ? (eqActual()!.tipo === 'Desktop' ? 'CPU / Desktop' : 'Laptop') : '—'" />
              </div>

              <div class="field">
                <label>Serie</label>
                <input class="control" readonly [value]="eqActual()?.serie || '—'" />
              </div>

              <div class="field">
                <label>RAM · Disco</label>
                <input class="control" readonly [value]="eqActual() ? eqActual()!.ram + ' · ' + eqActual()!.disco : '—'" />
              </div>

              <div class="field">
                <label>Sistema operativo base</label>
                <input class="control" readonly [value]="eqActual()?.sistemaOperativo || '—'" />
              </div>

              <div class="field">
                <label>Condición del equipo</label>
                <div class="opt-row">
                  <span class="opt" [class.on]="eqActual()?.condicion === 'Nuevo'"><input type="radio" disabled [checked]="eqActual()?.condicion === 'Nuevo'" /> Nuevo</span>
                  <span class="opt" [class.on]="eqActual()?.condicion === 'Usado'"><input type="radio" disabled [checked]="eqActual()?.condicion === 'Usado'" /> Usado</span>
                </div>
              </div>

              @if (eqActual()?.observaciones) {
                <div class="full alert">
                  <span class="alert-ico">i</span>
                  <span><b>Observaciones técnicas previas del equipo:</b> {{ eqActual()!.observaciones }}</span>
                </div>
              }

              <div class="field">
                <label>
                  Unidad que atenderá <span class="req">*</span>
                  <ui-help texto="La preparación técnica F0288 la atiende principalmente Hardware, sin importar si el equipo es CPU o Laptop. Si se elige Soporte, es una excepción y debe justificarse en observaciones." />
                </label>
                <select class="control" [ngModel]="unidad()" (ngModelChange)="cambiarUnidad($event)">
                  <option value="Hardware">Hardware</option>
                  <option value="Soporte">Soporte</option>
                </select>
              </div>

              <div class="field full">
                <app-tecnico-buscador [unidad]="unidad()" [nombreSeleccionado]="tecnico()" (seleccion)="elegirTecnico($event)" />
              </div>

              @if (unidad() === 'Soporte') {
                <div class="full alert warn">
                  <span class="alert-ico">!</span>
                  <span>Debe justificar en <b>observaciones</b> por qué este Expediente técnico será trabajado por la Unidad de Soporte.</span>
                </div>
              }

              <div class="field">
                <label>Responsable que crea el expediente</label>
                <input class="control" readonly [value]="auth.usuario()?.nombre + ' — ' + auth.usuario()?.rol" />
              </div>

              <div class="field">
                <label>Estado del expediente técnico</label>
                <input class="control" readonly value="Creado — pasará a preparación técnica F0288" />
              </div>

              <div class="field full">
                <label>
                  Observaciones técnicas
                  <span class="hint">{{ unidad() === 'Soporte' ? '(obligatoria: justifique la atención por Soporte)' : '(opcional)' }}</span>
                </label>
                <textarea class="control" rows="2"
                  [placeholder]="unidad() === 'Soporte' ? 'Ej.: el personal de Hardware no se encuentra disponible…' : 'Observaciones del expediente técnico…'"
                  [(ngModel)]="observaciones"></textarea>
              </div>
            </div>
          </div>
          <div class="card-foot">
            <span class="small muted" style="margin-right: auto;">Siguiente paso obligatorio: <b>Preparación técnica F0288</b>. Al finalizarla, el equipo queda <b>Preparado</b> y listo para asignación.</span>
            <button class="btn btn-primary btn-lg" (click)="crear()" [disabled]="!datosCreacionListos()">
              {{ eqConHistorial() ? 'Crear nuevo Expediente técnico' : 'Crear expediente técnico' }}
            </button>
          </div>
        </div>
      } @else {
        <div class="alert warn mb-3">
          <span class="alert-ico">!</span>
          <span><b>No tiene permisos para crear expedientes técnicos.</b> Esta acción corresponde a un Encargado (Soporte o Hardware). Los técnicos participan en la preparación o configuración según se les asigne.</span>
        </div>
      }

      <!-- Expedientes técnicos registrados -->
      <div class="card table-wrap">
        <div class="card-head">
          <div>
            <h2>Expedientes de preparación técnica</h2>
            <p class="sub">
              @if (auth.esTecnico()) {
                Vista filtrada: solo los expedientes donde usted participó como técnico de preparación
              } @else if (auth.esEncargadoHardware()) {
                Expedientes técnicos del área de Hardware
              } @else {
                Los equipos preparados quedan disponibles para asignación y para el Expediente único
              }
            </p>
          </div>
        </div>
        <table class="tbl">
          <thead>
            <tr>
              <th>Código</th>
              <th>Equipo</th>
              <th>Tipo</th>
              <th>Unidad</th>
              <th>Técnico</th>
              <th>F0288</th>
              <th>Estado</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (x of data.expedientesTecnicosVisibles(); track x.codigo) {
              <tr>
                <td class="mono main-cell">{{ x.codigo }}</td>
                <td>
                  <div class="main-cell">{{ x.marcaModelo }}</div>
                  <div class="sub-cell">{{ x.inventario }}</div>
                </td>
                <td>{{ x.tipoExpediente }}</td>
                <td>{{ x.unidadResponsable }}</td>
                <td>{{ x.tecnicoPreparacion.split('—')[0].trim() }}</td>
                <td>
                  <ui-badge [estado]="estadoF0288(x)" />
                  @for (r of reprocesosDe(x); track r.id) {
                    <div class="sub-cell">Reproceso #{{ r.numero }}: {{ r.estado }} <span class="mono">{{ r.id }}</span></div>
                  }
                </td>
                <td><ui-badge [estado]="x.estado" /></td>
                <td>
                  <div class="row" style="justify-content: flex-end; flex-wrap: nowrap;">
                    @if (f0288Pendiente(x)) {
                      <a class="btn btn-outline btn-sm" routerLink="/preparacion-tecnica">Preparación F0288</a>
                    }
                    @if (x.estado === 'Preparado' && !asignado(x)) {
                      <a class="btn btn-ghost btn-sm" routerLink="/expediente-unico">Disponible para asignación →</a>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="muted" style="text-align:center; padding: 28px;">Aún no hay expedientes técnicos registrados.</td></tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Modal: catálogo de equipos para crear expediente técnico -->
      @if (catalogoAbierto()) {
        <ui-modal titulo="Catálogo de equipos disponibles" sub="Equipos pendientes de preparación y equipos reingresados a Hardware con su ciclo anterior cerrado" (cerrar)="catalogoAbierto.set(false)">
          <div class="field mb-2">
            <input class="control" type="search" placeholder="Buscar por inventario, marca, modelo, tipo o serie…"
              [ngModel]="qCat()" (ngModelChange)="qCat.set($event)" />
          </div>
          <div class="table-wrap">
            <table class="tbl">
              <thead>
                <tr><th>Inventario</th><th>Equipo</th><th>Serie</th><th>RAM · Disco</th><th>Preparación</th><th>Asignación</th><th>Expediente técnico</th><th style="text-align:right;"></th></tr>
              </thead>
              <tbody>
                @for (e of catalogo(); track e.inventario) {
                  <tr>
                    <td class="mono main-cell">{{ e.inventario }}</td>
                    <td>
                      <div class="main-cell">{{ e.marca }} {{ e.modelo }}</div>
                      <div class="sub-cell">{{ e.tipo === 'Desktop' ? 'CPU / Desktop' : 'Laptop' }} · {{ e.condicion.toLowerCase() }}</div>
                    </td>
                    <td class="mono">{{ e.serie }}</td>
                    <td>
                      <div class="main-cell">{{ e.ram.split('·')[0].trim() }} · {{ e.disco.split('·')[0].trim() }}</div>
                      <div class="sub-cell">{{ e.sistemaOperativo || 'Sin SO base' }}</div>
                    </td>
                    <td><ui-badge [estado]="data.estadoPreparacionEquipo(e.inventario)" /></td>
                    <td><ui-badge [estado]="data.estadoAsignacionEquipo(e.inventario)" /></td>
                    <td>
                      @if (data.expTecnicoDeEquipo(e.inventario); as t) {
                        <span class="mono small">{{ t.codigo }}</span>
                        <div class="sub-cell"><span class="reingreso-tag">REINGRESO — ELEGIBLE PARA NUEVA PREPARACIÓN</span></div>
                      } @else {
                        <span class="sin-exp">NO TIENE EXPEDIENTE TÉCNICO</span>
                      }
                    </td>
                    <td>
                      <div class="row" style="justify-content: flex-end;">
                        <button class="btn btn-primary btn-sm" (click)="seleccionarEquipo(e)">Seleccionar equipo</button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="8" class="muted" style="text-align:center; padding: 22px;">No hay equipos pendientes de preparación que coincidan con la búsqueda.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </ui-modal>
      }
    </div>
  `
})
export class ExpedienteTecnicoComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** Llega como query param desde Inventario de Hardware («Crear Expediente técnico»). */
  readonly inventario = input<string>();

  protected invInput = signal('');
  protected catalogoAbierto = signal(false);
  protected qCat = signal('');
  /** Se trabaja preferentemente por Hardware; Soporte es la excepción y exige justificación. */
  protected unidad = signal<'Soporte' | 'Hardware'>('Hardware');
  protected tecnico = signal('');
  protected observaciones = signal('');

  constructor() {
    effect(() => {
      const inv = this.inventario();
      if (inv && this.data.equipoDe(inv) && this.data.puedeCrearNuevoExpedienteTecnico(inv)) this.invInput.set(inv);
    });
  }

  protected readonly rol = computed(() => this.auth.usuario()?.clave ?? '');
  /** Solo los Encargados crean expedientes técnicos; los técnicos no. */
  protected readonly puedeCrearET = computed(() => this.rol() === 'enc-soporte' || this.rol() === 'enc-hardware');

  /** Equipos que pueden recibir expediente técnico: nuevos o reingresados a Hardware (ver `puedeCrearNuevoExpedienteTecnico`). */
  protected readonly catalogo = computed(() => {
    const q = this.qCat().toLowerCase().trim();
    return this.data.equiposSinExpedienteTecnico().filter((e) => {
      if (!q) return true;
      return `${e.inventario} ${e.marca} ${e.modelo} ${e.tipo} ${e.serie}`.toLowerCase().includes(q);
    });
  });

  /** Último expediente técnico del equipo escrito/seleccionado (activo o histórico), si tiene alguno. */
  protected readonly ultimoET = computed(() => {
    const inv = this.invInput().trim();
    return inv ? this.data.expedientesTecnicosDeEquipo(inv)[0] : undefined;
  });

  protected readonly ultimaPrepDelEquipo = computed(() => {
    const inv = this.invInput().trim();
    return inv ? this.data.preparacionesDeEquipo(inv)[0] : undefined;
  });

  /** Motivo del reingreso ya registrado (vía Descargo) para el ingreso a Hardware pendiente de expediente. */
  protected readonly motivoReingresoActual = computed(() => {
    const inv = this.invInput().trim();
    if (!inv) return '';
    const pendiente = this.data.ingresosDeEquipo(inv).find((i) => !i.expedienteTecnicoAsociado);
    return pendiente && pendiente.motivoIngreso !== 'Preparación inicial' ? pendiente.motivoIngreso : '';
  });

  protected readonly eqActual = computed(() => {
    const inv = this.invInput().trim();
    if (!inv) return undefined;
    const eq = this.data.equipoDe(inv);
    return eq && this.data.puedeCrearNuevoExpedienteTecnico(inv) ? eq : undefined;
  });

  protected readonly eqNoEncontrado = computed(() => {
    const inv = this.invInput().trim();
    return !!inv && !this.catalogoAbierto() && !this.data.equipoDe(inv);
  });

  /** El equipo existe pero NO puede recibir un nuevo Expediente técnico ahora mismo. */
  protected readonly eqBloqueado = computed(() => {
    const inv = this.invInput().trim();
    return !!inv && !!this.data.equipoDe(inv) && !this.data.puedeCrearNuevoExpedienteTecnico(inv);
  });

  /** El equipo puede recibir un nuevo Expediente técnico y ya tiene ciclos anteriores (reingreso). */
  protected readonly eqConHistorial = computed(() => !!this.eqActual() && this.ultimoET() !== undefined);

  /** Mensaje específico del bloqueo, según por qué `eqBloqueado()` es verdadero. */
  protected readonly mensajeBloqueo = computed(() => {
    const et = this.ultimoET();
    if (!et) return '';
    if (et.estado === 'Creado' || et.estado === 'En preparación') {
      return 'Este equipo ya cuenta con un Expediente técnico activo. Debe finalizar o cerrar el expediente actual antes de crear uno nuevo.';
    }
    const inv = this.invInput().trim();
    if (this.data.estadoAsignacionEquipo(inv) === 'Asignado') {
      return 'Este equipo sigue asignado a un usuario final. Registre su Descargo y reingreso a Hardware antes de crear un nuevo Expediente técnico.';
    }
    return 'Este equipo ya fue preparado anteriormente y no tiene un reingreso a Hardware registrado. Regístrelo desde el módulo Descargo antes de crear un nuevo Expediente técnico.';
  });

  protected readonly datosCreacionListos = computed(() =>
    !!this.eqActual() && !!this.unidad() && !!this.tecnico() &&
    (this.unidad() !== 'Soporte' || !!this.observaciones().trim())
  );

  protected readonly siguienteCodigo = computed(() => {
    const nums = this.data.expedientesTecnicos()
      .map((x) => parseInt(x.codigo.slice(-4), 10))
      .filter((n) => !isNaN(n));
    return `EXP-PT-2026-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
  });

  protected elegirTecnico(u: UsuarioSistema): void {
    this.tecnico.set(`${u.nombre} — ${u.rol}`);
  }

  protected cambiarUnidad(valor: 'Soporte' | 'Hardware'): void {
    this.unidad.set(valor);
    this.tecnico.set('');
  }

  protected digitarInventario(valor: string): void {
    this.invInput.set(valor);
    this.qCat.set(valor);
    if (!this.catalogoAbierto() && valor.trim() && !this.data.equipoDe(valor.trim())) {
      this.catalogoAbierto.set(true);
    }
  }

  protected abrirCatalogo(): void {
    if (this.eqActual()) return;
    this.qCat.set(this.invInput());
    this.catalogoAbierto.set(true);
  }

  protected seleccionarEquipo(e: Equipo): void {
    this.invInput.set(e.inventario);
    this.catalogoAbierto.set(false);
    this.qCat.set('');
  }

  protected estadoF0288(t: ExpedienteTecnico): string {
    return this.data.preparacionPorCodigo(t.codigo)?.estado ?? 'Sin registro';
  }

  /**
   * Reprocesos F0288 del expediente: correcciones por fallas detectadas en F0302 que se registran
   * aquí en lugar de generar expedientes técnicos nuevos.
   */
  protected reprocesosDe(t: ExpedienteTecnico) {
    return [...this.data.reprocesosDeExpTecnico(t.codigo)].sort((a, b) => a.numero - b.numero);
  }

  protected f0288Pendiente(t: ExpedienteTecnico): boolean {
    const p = this.data.preparacionPorCodigo(t.codigo);
    return !!p && p.estado !== 'Completada';
  }

  protected asignado(t: ExpedienteTecnico): boolean {
    return this.data.estadoAsignacionEquipo(t.inventario) === 'Asignado';
  }

  protected crear(): void {
    if (!this.puedeCrearET()) {
      this.toast.error('Acción no permitida', 'Solo los Encargados de Soporte y Hardware crean expedientes técnicos.');
      return;
    }
    if (!this.eqActual() || !this.unidad() || !this.tecnico()) {
      this.toast.warn('Complete los campos obligatorios', 'Seleccione el equipo del catálogo, la unidad que atenderá y el técnico de preparación.');
      return;
    }
    if (this.unidad() === 'Soporte' && !this.observaciones().trim()) {
      this.toast.warn('Falta la justificación', 'Debe justificar en observaciones por qué este Expediente técnico será trabajado por la Unidad de Soporte.');
      return;
    }
    const u = this.auth.usuario();
    const esReingreso = this.eqConHistorial();
    const resultado = this.data.crearExpedienteTecnico({
      inventario: this.invInput().trim(),
      unidadResponsable: this.unidad(),
      creadoPor: `${u?.nombre} — ${u?.rol}`,
      tecnicoPreparacion: this.tecnico(),
      observaciones: this.observaciones().trim()
    });
    if (typeof resultado === 'string') {
      this.toast.error('No se puede crear el expediente técnico', resultado);
      return;
    }
    this.toast.ok(`Expediente técnico ${resultado.codigo} creado`,
      esReingreso
        ? 'Nuevo ciclo por reingreso a Hardware. Siguiente paso obligatorio: completar la Preparación técnica F0288.'
        : 'Siguiente paso obligatorio: completar la Preparación técnica F0288 para dejar el equipo preparado y listo para asignación.');
    this.invInput.set('');
    this.unidad.set('Hardware');
    this.tecnico.set('');
    this.observaciones.set('');
  }
}
