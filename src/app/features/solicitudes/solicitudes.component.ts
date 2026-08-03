import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/services/data.service';
import { Solicitud } from '../../core/models/models';
import { BadgeComponent, HelpTipComponent, MarcaModeloPipe, ModalComponent, TipoRequerimientoPipe } from '../../shared/ui';

@Component({
  selector: 'app-solicitudes',
  imports: [FormsModule, BadgeComponent, HelpTipComponent, ModalComponent, MarcaModeloPipe, TipoRequerimientoPipe],
  styles: `
    .filtros { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .filtros input { max-width: 300px; }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .f-chip {
      border: 1px solid var(--line-strong); background: var(--surface); color: var(--tx-2);
      font-size: 12px; font-weight: 500; padding: 5px 12px; border-radius: 999px; cursor: pointer;
      transition: all .12s; font-family: var(--font);
    }
    .f-chip:hover { border-color: var(--blue-500); color: var(--blue-600); }
    .f-chip.on { background: var(--navy-800); border-color: var(--navy-800); color: #fff; }
    .origen { font-size: 11.5px; color: var(--tx-3); white-space: nowrap; }
    .sin-asig {
      display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: .05em;
      color: var(--tx-3); background: var(--surface-2); border: 1px dashed var(--line-strong);
      border-radius: 999px; padding: 3px 9px; white-space: nowrap;
    }
    /* Tabla compacta: filas de altura moderada y textos truncados; el detalle completo vive en «Ver detalle». */
    .tbl-compacta td { padding-top: 8px; padding-bottom: 8px; }
    .desc-cell {
      max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-weight: 500; color: var(--navy-900); font-size: 13px;
    }
    .trunc { max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Gestión</div>
          <h1>
            Solicitudes
            <ui-help texto="Las solicitudes provienen de requerimientos de Laptop o de CPU registrados externamente. En este tablero se consultan, filtran y se da seguimiento a su estado; no se crean solicitudes desde SISGOST." />
          </h1>
          <p class="page-sub">Consulta y seguimiento de requerimientos de Laptop y CPU.</p>
        </div>
      </div>

      <div class="card mb-2 card-pad">
        <div class="filtros">
          <input class="control" type="search" placeholder="Buscar por código, destinatario, unidad o equipo…" [(ngModel)]="busqueda" />
          <div class="chips">
            <button class="f-chip" [class.on]="filtro() === ''" (click)="filtro.set('')">Todas ({{ data.solicitudes().length }})</button>
            @for (e of estados(); track e) {
              <button class="f-chip" [class.on]="filtro() === e" (click)="filtro.set(e)">{{ e }} ({{ contar(e) }})</button>
            }
          </div>
        </div>
      </div>

      <div class="card table-wrap">
        <table class="tbl tbl-compacta">
          <thead>
            <tr>
              <th>Solicitud / requerimiento</th>
              <th>Descripción</th>
              <th>Usuario final</th>
              <th>Unidad</th>
              <th>Equipo</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (s of filtradas(); track s.expediente) {
              <tr>
                <td>
                  <div class="main-cell mono">{{ s.expediente }}</div>
                  <div class="origen">{{ s.tipoEquipo | tipoRequerimiento }}</div>
                </td>
                <td><div class="desc-cell" [title]="s.descripcion">{{ s.descripcion }}</div></td>
                <td><div class="trunc" [title]="s.destinatario">{{ s.destinatario }}</div></td>
                <td><div class="trunc" [title]="s.unidadDestino + ' · ' + s.direccionGerencia">{{ s.unidadDestino }}</div></td>
                <td>
                  @if (s.equipoInventario) {
                    <div class="main-cell">{{ data.equipoDe(s.equipoInventario) | marcaModelo }}</div>
                    <div class="sub-cell mono">{{ s.equipoInventario }}</div>
                  } @else {
                    <span class="sin-asig">SIN ASIGNACIÓN</span>
                  }
                </td>
                <td><ui-badge [estado]="s.estado" /></td>
                <td>
                  <div class="row" style="justify-content: flex-end; flex-wrap: nowrap;">
                    <button class="btn btn-ghost btn-sm" (click)="detalle.set(s)">Ver detalle</button>
                    @if (s.estado === 'Entrante') {
                      <button class="btn btn-primary btn-sm" (click)="enviarAsignacion(s)">Enviar a asignación</button>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="muted" style="text-align:center; padding: 28px;">No hay solicitudes que coincidan con el filtro.</td></tr>
            }
          </tbody>
        </table>
      </div>

      @if (detalle(); as s) {
        <ui-modal [titulo]="'Solicitud ' + s.expediente" [sub]="s.tipoEquipo | tipoRequerimiento" (cerrar)="detalle.set(null)">
          <div class="grid grid-2">
            <div>
              <div class="sec-title">Destinatario</div>
              <dl class="dl">
                <dt>Usuario final</dt><dd>{{ s.destinatario }} (carné {{ s.carne }})</dd>
                <dt>Unidad destino</dt><dd>{{ s.unidadDestino }}</dd>
                <dt>Correo institucional</dt><dd>{{ s.correoDestinatario }}</dd>
              </dl>
            </div>
            <div>
              <div class="sec-title">Equipo</div>
              <dl class="dl">
                <dt>Descripción</dt><dd>{{ s.descripcion }}</dd>
                @if (s.equipoInventario) {
                  <dt>Equipo asignado</dt><dd>{{ data.equipoDe(s.equipoInventario) | marcaModelo }}</dd>
                  <dt>Inventario</dt><dd>{{ s.equipoInventario }}</dd>
                } @else {
                  <dt>Equipo asignado</dt><dd><span class="sin-asig">SIN ASIGNACIÓN</span></dd>
                }
              </dl>
            </div>
          </div>
          <hr class="divider" />
          <dl class="dl">
            <dt>Tipo de requerimiento</dt><dd>{{ s.tipoEquipo | tipoRequerimiento }}</dd>
            <dt>Dirección / gerencia</dt><dd>{{ s.direccionGerencia }}</dd>
            <dt>Estado actual</dt><dd><ui-badge [estado]="s.estado" /></dd>
            <dt>Recibida el</dt><dd>{{ s.fecha }} · {{ s.diasEnFase }} día(s) en la fase actual</dd>
            <dt>Siguiente pendiente</dt><dd>{{ s.pendiente }}</dd>
          </dl>
          @if (s.nota) {
            <div class="alert mt-2">
              <span class="alert-ico">i</span>
              <span><b>Observaciones / justificación:</b> {{ s.nota }}</span>
            </div>
          }
        </ui-modal>
      }
    </div>
  `
})
export class SolicitudesComponent {
  protected readonly data = inject(DataService);
  private readonly router = inject(Router);

  protected busqueda = signal('');
  protected filtro = signal('');
  protected detalle = signal<Solicitud | null>(null);

  protected readonly estados = computed(() => {
    const orden = ['Entrante', 'Asignada', 'En preparación', 'En configuración', 'Pendiente de aceptación', 'Entregado', 'No conforme', 'Cerrado'];
    const presentes = new Set(this.data.solicitudes().map((s) => s.estado));
    return orden.filter((e) => presentes.has(e));
  });

  protected contar(estado: string): number {
    return this.data.solicitudes().filter((s) => s.estado === estado).length;
  }

  protected readonly filtradas = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    const f = this.filtro();
    return this.data.solicitudes().filter((s) => {
      if (f && s.estado !== f) return false;
      if (!q) return true;
      const eq = this.data.equipoDe(s.equipoInventario);
      const tipoTxt = s.tipoEquipo === 'Desktop' ? 'requerimiento de cpu' : 'requerimiento de laptop';
      const texto = `${s.expediente} ${tipoTxt} ${s.destinatario} ${s.unidadDestino} ${s.descripcion} ${s.direccionGerencia} ${eq?.marca ?? ''} ${eq?.modelo ?? ''}`.toLowerCase();
      return texto.includes(q);
    });
  });

  protected enviarAsignacion(s: Solicitud): void {
    this.router.navigate(['/asignacion'], { queryParams: { solicitud: s.expediente } });
  }
}
