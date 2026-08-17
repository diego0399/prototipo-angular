import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/services/data.service';
import { EquipoControles } from '../../core/models/models';
import { BadgeComponent, HelpTipComponent } from '../../shared/ui';

/**
 * Inventario operativo del proyecto de Controles. No es un módulo de captura: es el reflejo de
 * una regla del proceso — un equipo pertenece a una Dirección/Unidad solo desde que el usuario
 * final firma la conformidad, y deja de pertenecerle cuando se registra su descargo. Nada se
 * teclea aquí; todo llega desde la aceptación y desde el descargo.
 */
@Component({
  selector: 'app-inventario-controles',
  imports: [FormsModule, BadgeComponent, HelpTipComponent],
  styles: `
    .kpi { border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface); padding: 14px 16px; }
    .kpi .k-num { font-size: 26px; font-weight: 800; color: var(--navy-900); line-height: 1.1; }
    .kpi .k-lbl { font-size: 11.5px; color: var(--tx-2); margin-top: 2px; }
    .det-fila { background: var(--surface-2); }
    .det-fila .datos { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px 18px; padding: 12px 4px; }
    .det-fila .datos > div { font-size: 12.5px; }
    .det-fila .datos span { display: block; color: var(--tx-2); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Cierre y auditoría</div>
          <h1>
            Inventario operativo de Controles
            <ui-help texto="Solo entran los equipos aceptados por el usuario final. Un equipo pendiente de aceptación, no conforme, en corrección o en reproceso no aparece aquí. El descargo lo retira del inventario activo sin borrar su historial." />
          </h1>
          <p class="page-sub">Equipos que pertenecen hoy a una Dirección/Unidad, y los que ya salieron por descargo.</p>
        </div>
      </div>

      <div class="grid grid-4 mb-3">
        <div class="kpi"><div class="k-num">{{ activos().length }}</div><div class="k-lbl">Equipos activos en Dirección/Unidad</div></div>
        <div class="kpi"><div class="k-num">{{ direcciones().length }}</div><div class="k-lbl">Direcciones con equipos activos</div></div>
        <div class="kpi"><div class="k-num">{{ activos().length }}</div><div class="k-lbl">Disponibles para controles mensuales</div></div>
        <div class="kpi"><div class="k-num">{{ descargados().length }}</div><div class="k-lbl">Descargados de Dirección/Unidad</div></div>
      </div>

      <div class="card mb-3">
        <div class="card-head">
          <div>
            <h2>Equipos activos</h2>
            <p class="sub">Ingresaron al inventario operativo con la aceptación del usuario final</p>
          </div>
          <input class="control" style="max-width: 300px;" [(ngModel)]="q" placeholder="Buscar por inventario, usuario, dirección…" />
        </div>
        <div class="card-body table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Inventario</th><th>Equipo</th><th>Usuario final</th><th>Dirección</th><th>Unidad</th>
                <th>Soporte responsable</th><th>Aceptación</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              @for (c of activosFiltrados(); track c.inventario + c.expediente) {
                <tr>
                  <td class="mono main-cell">{{ c.inventario }}</td>
                  <td>
                    {{ c.marca }} {{ c.modelo }}
                    <div class="sub-cell">
                      {{ c.tipoEquipo }}@if (c.nombreEquipo) { · {{ c.nombreEquipo }} }@if (c.ip) { · IP {{ c.ip }} }
                    </div>
                  </td>
                  <td>{{ c.usuarioFinal }}<div class="sub-cell">{{ c.correoInstitucional }}</div></td>
                  <td>{{ c.direccion }}</td>
                  <td>{{ c.unidad }}</td>
                  <td>
                    @if (c.soporteResponsable) { {{ c.soporteResponsable.split('—')[0].trim() }} }
                    @else { <span class="muted">Sin asignar</span> }
                  </td>
                  <td class="mono">{{ c.fechaAceptacion }}</td>
                  <td><ui-badge [estado]="c.estado" /></td>
                  <td style="text-align:right;">
                    <button class="btn btn-ghost btn-sm" (click)="detalle.set(detalle() === c.inventario ? '' : c.inventario)">
                      {{ detalle() === c.inventario ? 'Ocultar' : 'Ver ficha' }}
                    </button>
                  </td>
                </tr>
                @if (detalle() === c.inventario) {
                  <tr>
                    <td colspan="9" class="det-fila">
                      <div class="datos">
                        <div><span>Expediente único</span><b class="mono">{{ c.expedienteUnico || '—' }}</b></div>
                        <div><span>Requerimiento</span><b class="mono">{{ c.expediente }}</b></div>
                        <div><span>Serie</span><b class="mono">{{ c.serie || '—' }}</b></div>
                        <div><span>Nombre del equipo</span><b class="mono">{{ c.nombreEquipo || '—' }}</b></div>
                        <div><span>IP reservada</span><b class="mono">{{ c.ip || 'Sin reserva de IP' }}</b></div>
                        <div><span>MAC</span><b class="mono">{{ c.mac || '—' }}</b></div>
                        <div><span>Técnico de configuración</span><b>{{ c.tecnicoConfiguracion.split('—')[0].trim() || '—' }}</b></div>
                        <div><span>Garantía</span><b>{{ c.garantia }}</b></div>
                        <div><span>Estado en controles</span><b>{{ c.estadoControlMensual }}</b></div>
                        <div><span>Estado en Gestión de Equipos</span><b>{{ c.estadoGestion }}</b></div>
                      </div>
                    </td>
                  </tr>
                }
              } @empty {
                <tr><td colspan="9" class="muted" style="text-align:center; padding: 26px;">
                  <b>No hay equipos activos en el inventario operativo.</b>
                  <div class="mt-1">Un equipo entra aquí cuando el usuario final acepta la conformidad.</div>
                </td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <h2>Equipos descargados</h2>
            <p class="sub">Salieron del inventario activo de su Dirección/Unidad; el historial se conserva</p>
          </div>
        </div>
        <div class="card-body table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Inventario</th><th>Usuario final anterior</th><th>Dirección anterior</th><th>Unidad anterior</th>
                <th>Descargado por</th><th>Fecha</th><th>Motivo</th><th>Acción posterior</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              @for (c of descargados(); track c.inventario + c.expediente) {
                <tr>
                  <td class="mono main-cell">{{ c.inventario }}</td>
                  <td>{{ c.usuarioFinalAnterior || c.usuarioFinal }}</td>
                  <td>{{ c.direccionAnterior || c.direccion }}</td>
                  <td>{{ c.unidadAnterior || c.unidad }}</td>
                  <td>{{ (c.descargadoPor || '').split('—')[0].trim() || '—' }}</td>
                  <td class="mono">{{ c.fechaDescargo || '—' }}</td>
                  <td>{{ c.motivoDescargo || '—' }}</td>
                  <td>{{ c.accionPosterior || '—' }}</td>
                  <td><ui-badge [estado]="c.estadoGestion" /></td>
                </tr>
              } @empty {
                <tr><td colspan="9" class="muted" style="text-align:center; padding: 22px;">Aún no hay equipos descargados.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class InventarioControlesComponent {
  protected readonly data = inject(DataService);

  protected q = signal('');
  protected detalle = signal('');

  protected readonly activos = computed(() => this.data.controlesActivos());
  protected readonly descargados = computed(() =>
    this.data.controles().filter((c) => c.estado === 'Descargado de Dirección/Unidad'));

  /** Direcciones distintas con al menos un equipo activo: el conteo por Dirección del proyecto. */
  protected readonly direcciones = computed(() =>
    [...new Set(this.activos().map((c) => c.direccion))]);

  protected readonly activosFiltrados = computed<EquipoControles[]>(() => {
    const q = this.q().toLowerCase().trim();
    if (!q) return this.activos();
    return this.activos().filter((c) =>
      [c.inventario, c.marca, c.modelo, c.serie, c.usuarioFinal, c.correoInstitucional,
        c.direccion, c.unidad, c.soporteResponsable, c.expedienteUnico, c.expediente]
        .filter(Boolean).join(' ').toLowerCase().includes(q));
  });
}
