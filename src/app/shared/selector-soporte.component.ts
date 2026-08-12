import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { DataService } from '../core/services/data.service';
import { TecnicoSoporteConCarga } from '../core/models/models';
import { BadgeComponent, ModalComponent } from './ui';

/**
 * Selector de Técnico de Soporte con su carga laboral, equivalente al buscador de Técnicos de
 * Hardware pero contando los procesos del área de Soporte. Se usa en todos los puntos donde hay
 * que elegir un responsable de Soporte —Técnico de Configuración, corrección F0302, atención de
 * inconformidad, atención de garantía, descargo y distribución—, para que la decisión se tome
 * viendo el trabajo que cada quien ya tiene encima y no solo su nombre en una lista desplegable.
 *
 * La lista la decide quien lo usa (`tecnicos`): en el Expediente único llegan ya filtrados por la
 * Dirección/Unidad del requerimiento —los que no la atienden **no aparecen**, no se muestran
 * deshabilitados—, y en la distribución llegan todos. La carga alta advierte, nunca bloquea.
 */
@Component({
  selector: 'app-selector-soporte',
  imports: [FormsModule, RouterLink, BadgeComponent, ModalComponent],
  styles: `
    .filtros { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px; }
    @media (max-width: 900px) { .filtros { grid-template-columns: 1fr 1fr; } }
    .carga-cell { position: relative; display: inline-flex; align-items: center; gap: 6px; cursor: help; }
    .carga-cell .resumen {
      display: none; position: absolute; z-index: 80; left: 0; top: calc(100% + 6px); width: 250px;
      background: var(--navy-900); color: var(--tx-inv); border-radius: 10px; padding: 10px 12px;
      box-shadow: var(--shadow-2); font-size: 11.5px; line-height: 1.6; text-align: left; font-weight: 400;
    }
    .carga-cell:hover .resumen, .carga-cell .resumen.abierto { display: block; }
    .carga-cell .resumen b { color: #fff; }
    .det-fila { background: var(--surface-2); }
    .det-fila .datos { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 8px 18px; }
    .det-fila .datos > div { display: flex; flex-direction: column; font-size: 12.5px; }
    .det-fila .datos span { color: var(--tx-2); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    .dir-lista { display: grid; gap: 2px; font-size: 11.5px; max-width: 210px; line-height: 1.35; }
    .n-proc { font-variant-numeric: tabular-nums; text-align: center; }
    /* Nueve columnas más la acción: sin esto los encabezados largos empujan la carga laboral y el
       botón «Seleccionar» fuera de la vista, que es justo lo que hay que poder ver. */
    .tabla-tec th {
      white-space: normal; line-height: 1.2; vertical-align: bottom;
      font-size: 9.5px; letter-spacing: .02em; padding-left: 6px; padding-right: 6px;
    }
    .tabla-tec th.col-num { width: 78px; }
    .tabla-tec th.col-dir { width: 200px; }
    .tabla-tec th.col-nom { width: 96px; }
    .tabla-tec th.col-rol { width: 84px; }
    .tabla-tec th.col-accion { text-align: right; }
    .tabla-tec td { vertical-align: middle; padding-left: 6px; padding-right: 6px; }
  `,
  template: `
    <!-- Modal ancho: nueve columnas y la acción no caben en el ancho normal, y la carga laboral
         y el botón «Seleccionar» quedaban fuera de la vista, que es justo lo que hay que ver. -->
    <ui-modal [titulo]="titulo()" [sub]="sub()" [ancho]="true" (cerrar)="cerrar.emit()">
      <div class="alert mb-2">
        <span class="alert-ico">i</span>
        <span>{{ nota() }}</span>
      </div>

      <div class="filtros">
        <input class="control" type="search" placeholder="Buscar por nombre del técnico…" [(ngModel)]="q" />
        <select class="control" [(ngModel)]="fDireccion">
          <option value="">Dirección/Unidad: todas</option>
          @for (d of direcciones(); track d) { <option [value]="d">{{ d }}</option> }
        </select>
        <select class="control" [(ngModel)]="fCarga">
          <option value="">Carga laboral: toda</option>
          <option value="Baja">Carga baja</option>
          <option value="Media">Carga media</option>
          <option value="Alta">Carga alta</option>
        </select>
        <select class="control" [(ngModel)]="fDisponibilidad">
          <option value="">Disponibilidad: toda</option>
          <option value="Disponible">Disponible</option>
          <option value="Ocupado">Ocupado</option>
        </select>
      </div>

      <div class="table-wrap">
        <table class="tbl tbl-compacta tabla-tec">
          <thead>
            <tr>
              <th class="col-nom">Nombre</th><th class="col-rol">Rol</th>
              <th class="col-dir">Dirección/Unidad atendida</th>
              <th class="col-num">Configuraciones activas</th>
              <th class="col-num">Correcciones pendientes</th>
              <th class="col-num">Inconformidades pendientes</th>
              <th class="col-num">Casos de garantía activos</th>
              <th>Carga laboral</th><th>Disponibilidad</th><th class="col-accion">Acción</th>
            </tr>
          </thead>
          <tbody>
            @for (t of filtrados(); track t.nombreRol) {
              <tr>
                <td class="main-cell">
                  {{ t.usuario.nombre }}
                  @if (t.nombreRol === seleccionado()) { <div class="sub-cell">Seleccionado actualmente</div> }
                </td>
                <td>{{ t.usuario.rol }}</td>
                <td>
                  <div class="dir-lista">
                    @for (d of direccionesDe(t); track d) { <span>{{ d }}</span> }
                    @if (!direccionesDe(t).length) { <span class="muted">No atiende ninguna Dirección/Unidad.</span> }
                  </div>
                </td>
                <td class="mono n-proc">{{ t.configuraciones }}</td>
                <td class="mono n-proc">{{ t.correcciones }}</td>
                <td class="mono n-proc">{{ t.inconformidades }}</td>
                <td class="mono n-proc">{{ t.garantias }}</td>
                <td>
                  <!-- §7: el resumen rápido aparece al pasar el mouse y también al pulsar la etiqueta -->
                  <span class="carga-cell" (click)="alternarResumen(t.nombreRol); $event.stopPropagation()">
                    <ui-badge [estado]="t.carga" />
                    <span class="resumen" [class.abierto]="resumenAbierto() === t.nombreRol">
                      <b>Procesos activos: {{ t.total }}</b><br />
                      Expedientes únicos: {{ t.expedientesUnicos }}<br />
                      Configuraciones: {{ t.configuraciones }}<br />
                      Correcciones: {{ t.correcciones }}<br />
                      Inconformidades: {{ t.inconformidades }}<br />
                      Garantías: {{ t.garantias }}<br />
                      Descargos: {{ t.descargos }}<br />
                      Conformidades en seguimiento: {{ t.conformidades }}<br />
                      Carga: <b>{{ t.nivel }}</b>
                    </span>
                  </span>
                </td>
                <td>{{ t.disponibilidad }}</td>
                <td>
                  <div class="row" style="justify-content: flex-end; flex-wrap: nowrap;">
                    <button class="btn btn-ghost btn-sm" (click)="alternarDetalle(t)">
                      {{ detalle() === t.nombreRol ? 'Ocultar' : 'Ver detalle' }}
                    </button>
                    <button class="btn btn-primary btn-sm" (click)="elegir(t)">Seleccionar</button>
                  </div>
                </td>
              </tr>

              @if (detalle() === t.nombreRol) {
                <tr>
                  <td colspan="10" class="det-fila">
                    <!-- §8: la carga alta se advierte aquí y en el resumen del seleccionado; nunca bloquea -->
                    @if (t.nivel === 'Alta') {
                      <div class="alert warn mb-2">
                        <span class="alert-ico">!</span>
                        <span>{{ data.MSG_CARGA_ALTA }}</span>
                      </div>
                    }
                    <div class="datos mb-2">
                      <div><span>Nombre del técnico</span><b>{{ t.usuario.nombre }}</b></div>
                      <div><span>Rol</span><b>{{ t.usuario.rol }}</b></div>
                      <div><span>Direcciones/Unidades asignadas</span><b>{{ t.direccionUnidad || 'Ninguna' }}</b></div>
                      <div><span>Estado</span><b>{{ t.usuario.estado }}</b></div>
                      <div><span>Carga laboral actual</span><b>{{ t.carga }}</b></div>
                      <div><span>Total de procesos activos</span><b>{{ t.total }}</b></div>
                      <div><span>Expedientes únicos activos</span><b>{{ t.expedientesUnicos }}</b></div>
                      <div><span>Configuraciones F0302 activas</span><b>{{ t.configuraciones }}</b></div>
                      <div><span>Correcciones F0302 pendientes</span><b>{{ t.correcciones }}</b></div>
                      <div><span>Inconformidades pendientes</span><b>{{ t.inconformidades }}</b></div>
                      <div><span>Casos de garantía activos</span><b>{{ t.garantias }}</b></div>
                      <div><span>Descargos pendientes</span><b>{{ t.descargos }}</b></div>
                      <div><span>Conformidades en seguimiento</span><b>{{ t.conformidades }}</b></div>
                      <div><span>Última asignación</span><b class="mono">{{ t.ultimaAsignacion || '—' }}</b></div>
                    </div>

                    <div class="sec-title">Procesos activos a su cargo</div>
                    <div class="table-wrap">
                      <table class="tbl tbl-compacta">
                        <thead>
                          <tr>
                            <th>Código</th><th>Tipo de proceso</th><th>Equipo</th><th>Inventario</th>
                            <th>Usuario final</th><th>Dirección/Unidad</th><th>Estado</th>
                            <th>Fecha de asignación</th><th>Prioridad</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (p of procesos(t); track p.tipoProceso + p.codigo) {
                            <tr>
                              <td class="mono main-cell">{{ p.codigo }}</td>
                              <td>{{ p.tipoProceso }}</td>
                              <td>{{ p.equipo || '—' }}</td>
                              <td class="mono">{{ p.inventario || '—' }}</td>
                              <td>{{ p.usuarioFinal || '—' }}</td>
                              <td>{{ p.direccion === p.unidad ? p.direccion : p.direccion + ' / ' + p.unidad }}</td>
                              <td><ui-badge [estado]="p.estado" /></td>
                              <td class="mono">{{ p.fechaAsignacion || '—' }}</td>
                              <td>{{ p.prioridad }}</td>
                            </tr>
                          } @empty {
                            <tr><td colspan="9" class="muted" style="text-align:center; padding: 18px;">
                              Este técnico no tiene procesos activos.
                            </td></tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              }
            } @empty {
              <tr><td colspan="10" class="muted" style="text-align:center; padding: 26px;">
                @if (tecnicos().length) {
                  Ningún Técnico de Soporte coincide con los filtros aplicados.
                  <div class="mt-1"><button class="btn btn-ghost btn-sm" (click)="limpiar()">Limpiar filtros</button></div>
                } @else {
                  <b>{{ vacio() }}</b>
                  @if (rutaVacio(); as r) {
                    <div class="mt-1">Debe configurar la distribución de soportes antes de continuar.</div>
                    <a class="btn btn-outline btn-sm mt-2" [routerLink]="r" (click)="cerrar.emit()">Ir a Distribución de soportes</a>
                  }
                }
              </td></tr>
            }
          </tbody>
        </table>
      </div>

      @if (elegido(); as t) {
        <div class="alert mt-2" [class.warn]="t.nivel === 'Alta'">
          <span class="alert-ico">{{ t.nivel === 'Alta' ? '!' : 'i' }}</span>
          <span>
            <b>{{ t.usuario.nombre }}</b> — {{ t.carga }} con {{ t.total }} procesos activos.
            <div>{{ data.resumenCargaSoporte(t) }}.</div>
            <div>{{ data.avisoCarga(t.nivel) }}</div>
          </span>
        </div>
      }
    </ui-modal>
  `
})
export class SelectorSoporteComponent {
  protected readonly data = inject(DataService);
  private readonly auth = inject(AuthService);

  /** Técnicos elegibles. Quien usa el componente decide el filtro de negocio. */
  readonly tecnicos = input.required<TecnicoSoporteConCarga[]>();
  readonly titulo = input('Seleccionar Técnico de Soporte');
  readonly sub = input('');
  /** Aclara de dónde sale la lista; se muestra arriba, junto al icono de información. */
  readonly nota = input(
    'La lista muestra la carga laboral de cada Técnico de Soporte al día de hoy. Una carga alta no impide seleccionarlo.');
  /** Mensaje cuando no hay ningún técnico elegible. */
  readonly vacio = input('No hay Técnicos de Soporte disponibles.');
  /** Enlace a la distribución cuando el vacío se debe a que nadie atiende la Dirección/Unidad. */
  readonly rutaVacio = input('');
  /** «Nombre — Rol» ya seleccionado, para marcarlo en la lista. */
  readonly seleccionado = input('');
  /** Expediente al que pertenece la selección; se anota en la trazabilidad de la consulta. */
  readonly expediente = input('');

  readonly seleccion = output<TecnicoSoporteConCarga>();
  readonly cerrar = output<void>();

  protected q = signal('');
  protected fDireccion = signal('');
  protected fCarga = signal('');
  protected fDisponibilidad = signal('');
  protected detalle = signal('');
  protected resumenAbierto = signal('');
  protected elegido = signal<TecnicoSoporteConCarga | null>(null);

  /** Direcciones/Unidades presentes en la lista, para el filtro. */
  protected readonly direcciones = computed(() =>
    [...new Set(this.tecnicos().flatMap((t) => this.direccionesDe(t)))].sort());

  protected readonly filtrados = computed(() => {
    const q = this.q().toLowerCase().trim();
    const dir = this.fDireccion();
    const carga = this.fCarga();
    const disp = this.fDisponibilidad();
    return this.tecnicos().filter((t) => {
      if (q && !t.usuario.nombre.toLowerCase().includes(q)) return false;
      if (dir && !this.direccionesDe(t).includes(dir)) return false;
      if (carga && t.nivel !== carga) return false;
      if (disp && t.disponibilidad !== disp) return false;
      return true;
    });
  });

  protected direccionesDe(t: TecnicoSoporteConCarga): string[] {
    return t.direccionUnidad ? t.direccionUnidad.split('; ') : [];
  }

  protected procesos(t: TecnicoSoporteConCarga) {
    return this.data.procesosActivosDeSoporte(t.nombreRol);
  }

  protected limpiar(): void {
    this.q.set('');
    this.fDireccion.set('');
    this.fCarga.set('');
    this.fDisponibilidad.set('');
  }

  protected alternarResumen(nombreRol: string): void {
    this.resumenAbierto.set(this.resumenAbierto() === nombreRol ? '' : nombreRol);
  }

  /**
   * Abrir el detalle deja constancia de la consulta (§12). Se registra aquí y no en cada búsqueda
   * ni al pasar el mouse: una consulta por movimiento del cursor vuelve ilegible la trazabilidad.
   */
  protected alternarDetalle(t: TecnicoSoporteConCarga): void {
    if (this.detalle() === t.nombreRol) { this.detalle.set(''); return; }
    this.detalle.set(t.nombreRol);
    const u = this.auth.usuario();
    if (u) this.data.registrarConsultaCargaSoporte(t.nombreRol, `${u.nombre} — ${u.rol}`, this.expediente());
  }

  protected elegir(t: TecnicoSoporteConCarga): void {
    this.elegido.set(t);
    this.seleccion.emit(t);
  }
}
