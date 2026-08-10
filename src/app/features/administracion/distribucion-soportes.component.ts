import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { DistribucionSoporte } from '../../core/models/models';
import { BadgeComponent, HelpTipComponent, ModalComponent } from '../../shared/ui';
import { IconComponent } from '../../shared/icon';

/**
 * Distribución de Soportes por Dirección/Unidad. Es el catálogo del que dependen dos reglas del
 * proceso: qué técnicos pueden configurar el equipo de un requerimiento y quién queda como
 * soporte responsable cuando el usuario final acepta. Solo lo gestionan el Encargado de Soporte
 * y el Administrador; el resto lo consulta.
 */
@Component({
  selector: 'app-distribucion-soportes',
  imports: [FormsModule, BadgeComponent, HelpTipComponent, ModalComponent, IconComponent],
  styles: `
    .dir-card { border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface); padding: 14px 16px; }
    .dir-card .d-dir { font-size: 14px; font-weight: 700; color: var(--navy-900); }
    .dir-card .d-uni { font-size: 11.5px; color: var(--gold-600); font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
    .dir-card .d-tecs { margin-top: 10px; display: grid; gap: 6px; }
    .tec-linea { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12.5px; padding: 6px 8px; border-radius: var(--r-sm); background: var(--surface-2); }
    .tec-linea.off { opacity: .55; }
    .sin-tec { font-size: 12.5px; color: var(--danger, #b3261e); font-weight: 600; }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Sistema</div>
          <h1>
            Distribución de Soportes por Dirección/Unidad
            <ui-help texto="Define qué Técnico de Soporte atiende cada Dirección/Unidad. De aquí salen los técnicos que pueden ser Técnico de Configuración de un requerimiento y el soporte responsable del equipo una vez aceptado." />
          </h1>
          <p class="page-sub">Un técnico puede atender varias Direcciones/Unidades; una Dirección/Unidad puede tener varios responsables.</p>
        </div>
        @if (puedeGestionar()) {
          <button class="btn btn-primary" (click)="abrirNueva()"><ui-icon name="plus" [size]="14" /> Asignar técnico</button>
        }
      </div>

      @if (!puedeGestionar()) {
        <div class="alert warn mb-2">
          <span class="alert-ico">!</span>
          <span>
            <b>Solo el Encargado de Soporte y el Administrador gestionan la distribución.</b>
            La pantalla se muestra en modo consulta.
          </span>
        </div>
      }

      @if (sinResponsable().length) {
        <div class="alert warn mb-3">
          <span class="alert-ico">!</span>
          <span>
            <b>{{ sinResponsable().length }} Dirección/Unidad sin Técnico de Soporte responsable.</b>
            No se podrá crear el Expediente único de sus requerimientos hasta asignar uno:
            {{ textoSinResponsable() }}.
          </span>
        </div>
      }

      <!-- Vista por Dirección/Unidad: quién atiende cada una -->
      <div class="mb-2 sec-title">Direcciones y Unidades</div>
      <div class="grid grid-2 mb-3">
        @for (du of direcciones(); track du.direccion + du.unidad) {
          <div class="dir-card">
            <div class="d-uni">{{ du.direccion }}</div>
            <div class="d-dir">{{ du.unidad }}</div>
            <div class="d-tecs">
              @for (d of activasDe(du.direccion, du.unidad); track d.id) {
                <div class="tec-linea">
                  <span>
                    <b>{{ d.tecnico.split('—')[0].trim() }}</b>
                    <span class="muted"> · desde {{ d.fecha }}</span>
                  </span>
                  @if (puedeGestionar()) {
                    <span class="row" style="flex-wrap: nowrap; gap: 6px;">
                      <button class="btn btn-ghost btn-sm" (click)="abrirEditar(d)">Modificar</button>
                      <button class="btn btn-ghost btn-sm" (click)="abrirBaja(d)">Desactivar</button>
                    </span>
                  }
                </div>
              } @empty {
                <div class="sin-tec">Sin Técnico de Soporte asignado.</div>
              }
            </div>
          </div>
        }
      </div>

      <!-- Vista por técnico: qué atiende cada uno -->
      <div class="mb-2 sec-title">Direcciones/Unidades atendidas por cada soporte</div>
      <div class="card table-wrap mb-3">
        <table class="tbl">
          <thead>
            <tr><th>Técnico de Soporte</th><th>Direcciones/Unidades atendidas</th><th>Equipos activos a su cargo</th><th>Estado</th></tr>
          </thead>
          <tbody>
            @for (t of tecnicos(); track t.nombreRol) {
              <tr>
                <td class="main-cell">{{ t.usuario.nombre }}<div class="sub-cell">{{ t.usuario.rol }}</div></td>
                <td>
                  @for (d of data.direccionesDeTecnico(t.nombreRol); track d.id) {
                    <div>{{ d.direccion === d.unidad ? d.direccion : d.direccion + ' / ' + d.unidad }}</div>
                  } @empty {
                    <span class="muted">No atiende ninguna Dirección/Unidad.</span>
                  }
                </td>
                <td class="mono">{{ data.controlesDeSoporte(t.nombreRol).length }}</td>
                <td><ui-badge [estado]="t.usuario.estado" /></td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Historial: incluye las asignaciones desactivadas -->
      <div class="card table-wrap">
        <div class="card-head">
          <div>
            <h2>Registro de la distribución</h2>
            <p class="sub">Las asignaciones desactivadas no se borran: los equipos aceptados mientras estuvieron vigentes las conservan en su historial</p>
          </div>
        </div>
        <table class="tbl">
          <thead>
            <tr><th>Código</th><th>Dirección</th><th>Unidad</th><th>Técnico</th><th>Asignada por</th><th>Fecha</th><th>Estado</th></tr>
          </thead>
          <tbody>
            @for (d of todas(); track d.id) {
              <tr>
                <td class="mono main-cell">{{ d.id }}</td>
                <td>{{ d.direccion }}</td>
                <td>{{ d.unidad }}</td>
                <td>{{ d.tecnico.split('—')[0].trim() }}</td>
                <td>{{ d.asignadoPor.split('—')[0].trim() }}</td>
                <td class="mono">{{ d.fecha }}</td>
                <td><ui-badge [estado]="d.activo ? 'Activa' : 'Desactivada'" /></td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="muted" style="text-align:center; padding: 22px;">Aún no hay distribución registrada.</td></tr>
            }
          </tbody>
        </table>
      </div>

      @if (modo() === 'nueva') {
        <ui-modal titulo="Asignar Técnico de Soporte a Dirección/Unidad"
          sub="La Dirección/Unidad sale de los requerimientos registrados" (cerrar)="cerrar()">
          <div class="form-grid">
            <div class="field full">
              <label>Dirección / Unidad <span class="req">*</span></label>
              <select class="control" [(ngModel)]="dirUnidadSel">
                <option value="">Seleccione…</option>
                @for (du of direcciones(); track du.direccion + du.unidad) {
                  <option [value]="du.direccion + '||' + du.unidad">
                    {{ du.direccion === du.unidad ? du.direccion : du.direccion + ' / ' + du.unidad }}
                  </option>
                }
              </select>
            </div>
            <div class="field full">
              <label>Técnico de Soporte <span class="req">*</span></label>
              <select class="control" [(ngModel)]="tecnicoSel">
                <option value="">Seleccione…</option>
                @for (t of tecnicos(); track t.nombreRol) {
                  <option [value]="t.nombreRol">{{ t.usuario.nombre }} · {{ t.carga }}</option>
                }
              </select>
              <span class="hint">Solo Técnicos de Soporte activos: Hardware no atiende Direcciones/Unidades.</span>
            </div>
            <div class="field full">
              <label>Observación</label>
              <input class="control" [(ngModel)]="observacion" placeholder="Motivo de la asignación, cobertura…" />
            </div>
          </div>
          <div class="row-between mt-3">
            <span class="small muted">El técnico asignado podrá configurar equipos de esa Dirección/Unidad.</span>
            <button class="btn btn-primary" (click)="guardarNueva()">Asignar</button>
          </div>
        </ui-modal>
      }

      @if (modo() === 'editar' && seleccionada(); as d) {
        <ui-modal titulo="Modificar distribución" [sub]="d.direccion + ' / ' + d.unidad" (cerrar)="cerrar()">
          <div class="form-grid">
            <div class="field full">
              <label>Técnico de Soporte responsable <span class="req">*</span></label>
              <select class="control" [(ngModel)]="tecnicoSel">
                @for (t of tecnicos(); track t.nombreRol) {
                  <option [value]="t.nombreRol">{{ t.usuario.nombre }} · {{ t.carga }}</option>
                }
              </select>
            </div>
            <div class="field full">
              <label>Observación</label>
              <input class="control" [(ngModel)]="observacion" />
            </div>
          </div>
          <div class="row-between mt-3">
            <span class="small muted">Responsable actual: <b>{{ d.tecnico.split('—')[0].trim() }}</b>.</span>
            <button class="btn btn-primary" (click)="guardarEdicion()">Guardar cambios</button>
          </div>
        </ui-modal>
      }

      @if (modo() === 'baja' && seleccionada(); as d) {
        <ui-modal titulo="Desactivar asignación" [sub]="d.tecnico.split('—')[0].trim() + ' · ' + d.direccion + ' / ' + d.unidad" (cerrar)="cerrar()">
          <div class="alert mb-2">
            <span class="alert-ico">i</span>
            <span>
              La asignación no se borra: queda como histórico. Si quedan otros responsables de la
              Dirección/Unidad, los equipos activos pasan al primero de ellos.
            </span>
          </div>
          <div class="field full">
            <label>Motivo <span class="req">*</span></label>
            <textarea class="control" rows="2" [(ngModel)]="motivoBaja" placeholder="Cambio de cobertura, traslado del técnico…"></textarea>
          </div>
          <div class="row-between mt-3">
            <span class="small muted">Equipos activos a su cargo en esta Dirección/Unidad: <b>{{ activosDe(d) }}</b>.</span>
            <button class="btn btn-primary" (click)="guardarBaja()">Desactivar</button>
          </div>
        </ui-modal>
      }
    </div>
  `
})
export class DistribucionSoportesComponent {
  protected readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly puedeGestionar = computed(() => {
    const clave = this.auth.usuario()?.clave;
    return clave === 'enc-soporte' || clave === 'admin';
  });

  protected readonly direcciones = computed(() => this.data.direccionesUnidades());
  protected readonly tecnicos = computed(() => this.data.tecnicosSoporteConCarga());
  protected readonly todas = computed(() =>
    [...this.data.distribuciones()].sort((a, b) => b.id.localeCompare(a.id)));

  /** Direcciones/Unidades que hoy no podrían crear un Expediente único. */
  protected readonly sinResponsable = computed(() =>
    this.direcciones().filter((du) => !this.data.tecnicosDeDireccionUnidad(du.direccion, du.unidad).length));
  protected textoSinResponsable(): string {
    return this.sinResponsable()
      .map((du) => (du.direccion === du.unidad ? du.direccion : `${du.direccion} / ${du.unidad}`))
      .join('; ');
  }

  protected activasDe(direccion: string, unidad: string): DistribucionSoporte[] {
    return this.data.distribucionesDe(direccion, unidad);
  }
  protected activosDe(d: DistribucionSoporte): number {
    return this.data.controlesDeSoporte(d.tecnico)
      .filter((c) => c.direccion === d.direccion && c.unidad === d.unidad).length;
  }

  protected modo = signal<'' | 'nueva' | 'editar' | 'baja'>('');
  protected seleccionada = signal<DistribucionSoporte | null>(null);
  protected dirUnidadSel = signal('');
  protected tecnicoSel = signal('');
  protected observacion = signal('');
  protected motivoBaja = signal('');

  private get quien(): string {
    const u = this.auth.usuario();
    return u ? `${u.nombre} — ${u.rol}` : '';
  }

  protected abrirNueva(): void {
    this.dirUnidadSel.set('');
    this.tecnicoSel.set('');
    this.observacion.set('');
    this.modo.set('nueva');
  }
  protected abrirEditar(d: DistribucionSoporte): void {
    this.seleccionada.set(d);
    this.tecnicoSel.set(d.tecnico);
    this.observacion.set(d.observacion);
    this.modo.set('editar');
  }
  protected abrirBaja(d: DistribucionSoporte): void {
    this.seleccionada.set(d);
    this.motivoBaja.set('');
    this.modo.set('baja');
  }
  protected cerrar(): void {
    this.modo.set('');
    this.seleccionada.set(null);
  }

  protected guardarNueva(): void {
    const [direccion, unidad] = this.dirUnidadSel().split('||');
    const r = this.data.asignarDistribucion(
      { direccion: direccion ?? '', unidad: unidad ?? '', tecnico: this.tecnicoSel(), observacion: this.observacion() },
      this.quien);
    if (typeof r === 'string') { this.toast.error('No se pudo asignar', r); return; }
    this.toast.ok('Distribución registrada',
      `${r.tecnico.split('—')[0].trim()} atiende ${r.direccion} / ${r.unidad}.`);
    this.cerrar();
  }

  protected guardarEdicion(): void {
    const d = this.seleccionada();
    if (!d) return;
    const error = this.data.modificarDistribucion(d.id, { tecnico: this.tecnicoSel(), observacion: this.observacion() }, this.quien);
    if (error) { this.toast.error('No se pudo modificar', error); return; }
    this.toast.ok('Distribución modificada', `${d.direccion} / ${d.unidad} actualizada.`);
    this.cerrar();
  }

  protected guardarBaja(): void {
    const d = this.seleccionada();
    if (!d) return;
    const error = this.data.desactivarDistribucion(d.id, this.quien, this.motivoBaja());
    if (error) { this.toast.error('No se pudo desactivar', error); return; }
    this.toast.ok('Asignación desactivada', `${d.tecnico.split('—')[0].trim()} ya no atiende ${d.direccion} / ${d.unidad}.`);
    this.cerrar();
  }
}
