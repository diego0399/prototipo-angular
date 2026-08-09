import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Cronometro, EvidenciaReproceso, ItemReproceso, ReprocesoF0288, ResultadoReproceso, TipoProblemaReproceso
} from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { BadgeComponent, HelpTipComponent, ModalComponent } from '../../shared/ui';
import { IconComponent } from '../../shared/icon';
import { ConstanciaReprocesoComponent } from '../../shared/constancia-reproceso';
import { EvidenciasComponent } from '../../shared/evidencias';

/**
 * Reprocesos F0288 pendientes: la bandeja de Hardware para los equipos devueltos por una falla
 * detectada en la Configuración F0302 (rollback). Un reproceso NO es una preparación nueva ni un
 * expediente técnico nuevo: es una corrección registrada dentro del expediente técnico que el
 * equipo ya tiene, con su propio checklist, su tiempo trabajado y la firma de quien la hizo.
 */
@Component({
  selector: 'app-reprocesos',
  imports: [FormsModule, RouterLink, BadgeComponent, HelpTipComponent, ModalComponent, IconComponent,
    ConstanciaReprocesoComponent, EvidenciasComponent],
  styles: `
    .rep-card { border-left: 4px solid var(--warn, #c9930a); }
    .rep-card.alta { border-left-color: var(--danger, #c0392b); }
    .chk-sec { margin: 14px 0 2px; font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--tx-3); }
    .chk-row { display: flex; align-items: center; gap: 10px; padding: 8px 4px; border-bottom: 1px dashed var(--line); font-size: 13.5px; }
    .chk-row:last-child { border-bottom: 0; }
    .chk-row .c-nombre { flex: 1; color: var(--navy-900); font-weight: 500; }
    .chk-row .c-nombre.na { color: var(--tx-3); font-weight: 300; text-decoration: line-through solid var(--line-strong); }
    .chk-row .chip-ev { background: transparent; border: 1px solid var(--line-strong); color: var(--tx-3); font-weight: 500; }
    .chk-row .chk-est { width: 104px; text-align: right; flex: none; }
    .chk-row .chk-acc { width: 138px; text-align: right; flex: none; }
    .chk-row input[type=checkbox] { width: 17px; height: 17px; accent-color: var(--ok); cursor: pointer; }
    .chk-ev { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 2px 4px 10px 31px; border-bottom: 1px dashed var(--line); }
    .chk-thumb { width: 92px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid var(--line); cursor: pointer; }
    .chk-ev .i-falta { font-size: 11.5px; font-weight: 600; color: var(--danger, #c0392b); }
    .ev-grande { max-width: 100%; max-height: 58vh; display: block; margin: 0 auto; border-radius: 8px; border: 1px solid var(--line); }
    .val-row { display: flex; align-items: flex-start; gap: 10px; padding: 7px 0; border-bottom: 1px dashed var(--line); font-size: 13px; color: var(--tx-3); }
    .val-row:last-child { border-bottom: 0; }
    .val-row.ok { color: var(--ok, #1e7a46); }
    .val-row .v-txt { flex: 1; color: var(--navy-900); }
    .val-row .v-txt b { font-weight: 600; display: block; }
    .crono-rep { font-family: var(--font-mono, monospace); font-size: 22px; color: var(--navy-900); }
    .firma-box { border: 1px dashed var(--line-strong); border-radius: 8px; padding: 12px 14px; background: var(--bg-2, #fafafa); }
    .firma-box .f-nombre { font-family: var(--font-brand, cursive); font-size: 19px; color: var(--navy-900); }
    .datos-cambio { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 6px 18px; }
    .datos-cambio span { display: block; font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--tx-3); }
    .datos-cambio b { font-size: 13px; font-weight: 500; color: var(--navy-900); }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Preparación técnica</div>
          <h1>
            {{ esEncargado() ? 'Reprocesos F0288' : 'Mis reprocesos F0288' }}
            <ui-help texto="Equipos devueltos a Hardware por una falla detectada en la Configuración F0302. El reproceso se registra dentro del Expediente técnico original —nunca se crea uno nuevo—, lo asigna un Encargado y se cierra con la firma del Técnico de Hardware." />
          </h1>
          <p class="page-sub">
            @if (esEncargado()) { Asignación y seguimiento · corrección dentro del Expediente técnico original. }
            @else { Reprocesos que le fueron asignados · corrección dentro del Expediente técnico original. }
          </p>
        </div>
      </div>

      <!-- Fallas que exigen reproceso y quedaron sin él (expedientes anteriores a la regla) -->
      @if (esEncargado() && sinReproceso().length) {
        <div class="card card-pad mb-3" style="border-left: 4px solid var(--danger, #c0392b);">
          <b class="small">{{ sinReproceso().length }} falla(s) F0302 exigen reproceso y todavía no lo tienen</b>
          <p class="small muted">Vienen de expedientes registrados antes de esta regla. Genere el reproceso para que puedan continuar.</p>
          @for (c of sinReproceso(); track c.expediente) {
            <div class="row-between mt-1" style="flex-wrap: wrap; gap: 12px;">
              <span class="small">
                <b class="mono">{{ c.expediente }}</b> · {{ c.datos.inventario }} · {{ c.falla?.tipo }}
              </span>
              <button class="btn btn-outline btn-sm" (click)="generarReproceso(c.expediente)">Generar reproceso F0288</button>
            </div>
          }
        </div>
      }

      <!-- ── Bandeja de Encargados: reprocesos pendientes de asignación ── -->
      @if (esEncargado()) {
        <div class="card mb-3">
          <div class="card-head">
            <div>
              <h3>Reprocesos F0288 pendientes de asignación</h3>
              <p class="sub">Ningún reproceso se asigna solo: aquí se decide qué Técnico de Hardware lo atiende</p>
            </div>
            <span class="chip">{{ porAsignar().length }} por asignar</span>
          </div>
          <div class="card-body table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Código de reproceso</th>
                  <th>Expediente técnico original</th>
                  <th>Expediente único</th>
                  <th>Número de inventario</th>
                  <th>Tipo de equipo</th>
                  <th>Tipo de falla</th>
                  <th>Técnico de Soporte que reportó</th>
                  <th>Fecha de reporte</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th style="text-align:right;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (r of porAsignar(); track r.id) {
                  <tr>
                    <td class="mono main-cell">{{ r.id }}<div class="sub-cell">Reproceso #{{ r.numero }}</div></td>
                    <td class="mono">{{ r.expedienteTecnico }}</td>
                    <td class="mono">{{ r.expedienteUnico || '—' }}</td>
                    <td class="mono">{{ r.inventario }}</td>
                    <td>{{ tipoEquipo(r) }}<div class="sub-cell">{{ equipoTxt(r) }}</div></td>
                    <td>{{ r.tipoFalla }}<div class="sub-cell">{{ origen(r) }}</div></td>
                    <td>{{ r.solicitadoPor.split('—')[0].trim() }}<div class="sub-cell">{{ r.solicitadoPor.split('—')[1] || '' }}</div></td>
                    <td class="mono">{{ r.fechaSolicitud }}<div class="sub-cell">{{ r.horaSolicitud }}</div></td>
                    <td><ui-badge [estado]="r.prioridad === 'Alta' ? 'Carga alta' : 'Carga baja'" /><div class="sub-cell">{{ r.prioridad }}</div></td>
                    <td><ui-badge [estado]="r.estado" /></td>
                    <td style="text-align:right;">
                      <div class="row" style="justify-content: flex-end; flex-wrap: nowrap;">
                        <button class="btn btn-ghost btn-sm" (click)="abrir(r.id)">
                          {{ seleccion() === r.id ? 'Ocultar' : 'Ver detalle de falla' }}
                        </button>
                        @if (data.constanciaDeReproceso(r.id)) {
                          <button class="btn btn-outline btn-sm" (click)="verConstancia.set(r.id)">Ver constancia</button>
                        }
                        <button class="btn btn-primary btn-sm" (click)="abrirAsignacion(r)">Asignar Técnico de Hardware</button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="11" class="muted" style="text-align:center; padding: 26px;">
                    No hay reprocesos pendientes de asignación.
                  </td></tr>
                }
              </tbody>
            </table>
          </div>
          @if (porAsignar().length) {
            <div class="card-body" style="padding-top: 0;">
              <div class="row" style="flex-wrap: wrap;">
                <a class="btn btn-outline btn-sm" routerLink="/trazabilidad">Ver historial técnico</a>
                <a class="btn btn-outline btn-sm" routerLink="/trazabilidad">Ver trazabilidad</a>
              </div>
            </div>
          }
        </div>
      }

      <!-- ── Reprocesos en curso (Encargados) / Mis reprocesos (Técnico de Hardware) ── -->
      <div class="card mb-3">
        <div class="card-head">
          <div>
            <h3>{{ esEncargado() ? 'Reprocesos asignados y en curso' : 'Mis reprocesos F0288' }}</h3>
            <p class="sub">
              @if (esEncargado()) { Seguimiento de los reprocesos ya asignados a Hardware }
              @else { Solo aparecen los reprocesos que un Encargado le asignó }
            </p>
          </div>
          <span class="chip">{{ enCurso().length }} en curso</span>
        </div>
        <div class="card-body table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Código de reproceso</th>
                <th>Expediente técnico original</th>
                <th>Equipo</th>
                <th>Inventario</th>
                <th>Tipo de falla</th>
                <th>Fecha de asignación</th>
                <th>Estado</th>
                <th style="text-align:right;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (r of enCurso(); track r.id) {
                <tr>
                  <td class="mono main-cell">{{ r.id }}<div class="sub-cell">Reproceso #{{ r.numero }}</div></td>
                  <td class="mono">{{ r.expedienteTecnico }}</td>
                  <td>{{ equipoTxt(r) }}</td>
                  <td class="mono">{{ r.inventario }}</td>
                  <td>{{ r.tipoFalla }}<div class="sub-cell">{{ origen(r) }}</div></td>
                  <td class="mono">{{ r.fechaAsignacion || '—' }}
                    <div class="sub-cell">{{ r.tecnicoAsignado.split('—')[0].trim() || 'Sin asignar' }}</div>
                    @if (esEncargado() && r.asignadoPor) { <div class="sub-cell">Asignó: {{ r.asignadoPor.split('—')[0].trim() }}</div> }
                  </td>
                  <td>
                    <ui-badge [estado]="r.estado" />
                    @if (data.constanciaDeReproceso(r.id); as d) {
                      <div class="sub-cell mono">{{ d.codigo }} · {{ d.estado }}</div>
                    }
                  </td>
                  <td style="text-align:right;">
                    <div class="row" style="justify-content: flex-end; flex-wrap: nowrap;">
                      <button class="btn btn-ghost btn-sm" (click)="abrir(r.id)">
                        {{ seleccion() === r.id ? 'Ocultar detalle' : 'Ver detalle' }}
                      </button>
                      @if (data.constanciaDeReproceso(r.id)) {
                        <button class="btn btn-outline btn-sm" (click)="verConstancia.set(r.id)">Ver constancia</button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="8" class="muted" style="text-align:center; padding: 26px;">
                  @if (esEncargado()) {
                    No hay reprocesos asignados en curso.
                  } @else {
                    No tiene reprocesos F0288 asignados. Cuando un Encargado le asigne uno, aparecerá aquí.
                  }
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
              <dt>Origen del reproceso</dt><dd>{{ origen(r) }}</dd>
              @if (esGarantia(r)) {
                <dt>Caso de garantía</dt><dd class="mono">{{ r.casoGarantia }}</dd>
                <dt>Usuario final</dt><dd>{{ r.usuarioFinal || '—' }}</dd>
                @if (r.tecnicoSugerido) {
                  <dt>Técnico sugerido</dt>
                  <dd>{{ r.tecnicoSugerido }}<div class="sub-cell">{{ r.motivoSugerencia }}</div></dd>
                }
              }
              @if (r.origen === 'Inconformidad del usuario final') {
                <dt>Usuario final</dt><dd>{{ r.usuarioFinal || '—' }}</dd>
                <dt>Intento de conformidad</dt><dd>#{{ r.intentoConformidad }}</dd>
                <dt>Observación del Usuario Final</dt><dd>{{ r.observacionUsuarioFinal || '—' }}</dd>
                <dt>Corrección relacionada</dt><dd class="mono">{{ r.correccionRelacionada || '—' }}</dd>
              }
              <dt>Tipo de falla reportada en F0302</dt><dd>{{ r.tipoFalla }}</dd>
              <dt>Observación de Soporte</dt><dd>{{ r.observacionSoporte || '—' }}</dd>
              <dt>Evidencia reportada por Soporte</dt><dd>{{ r.evidenciaSoporte || 'Sin evidencia adjunta' }}</dd>
              @if (evidenciaFalla(r); as ev) {
                <dt>Tipo de evidencia inicial</dt><dd>{{ ev.item || ev.tipo }}</dd>
              }
              <dt>Técnico de Hardware asignado</dt>
              <dd>
                {{ r.tecnicoAsignado || 'Sin asignar' }}
                @if (r.justificacionUnidad) { <div class="sub-cell">Excepción autorizada: {{ r.justificacionUnidad }}</div> }
                @if (r.fechaAsignacion) { <div class="sub-cell">{{ r.asignadoPor }} · {{ r.fechaAsignacion }} {{ r.horaAsignacion }}</div> }
              </dd>
            </dl>

            <!-- La imagen con la que Soporte reportó la falla viaja al reproceso: el Técnico de
                 Hardware ve el problema tal como se detectó, antes de tocar el equipo. -->
            @if (evidenciaFalla(r); as ev) {
              <ui-evidencias titulo="Falla reportada desde F0302 · evidencia inicial"
                [lista]="[ev]"
                nota="Cargada por Soporte al reportar la falla. La evidencia de la corrección la adjunta Hardware más abajo."
                (visualizar)="verEvidenciaFallaOrigen(r, $event)" />
            }

            <!-- Rollback: asignación a un Técnico de Hardware, potestad del Encargado -->
            @if (r.estado === 'Pendiente de asignación' || r.estado === 'Asignado') {
              <div class="card card-pad mt-2">
                <div class="row-between" style="flex-wrap: wrap; gap: 12px;">
                  <div>
                    <b class="small">Rollback a Hardware</b>
                    <p class="small muted">
                      @if (esEncargado()) {
                        El equipo regresa a la Unidad de Hardware. Puede tomarlo el mismo técnico que lo preparó u otro.
                      } @else {
                        La asignación la hace un Encargado: ningún técnico toma un reproceso por su cuenta.
                      }
                    </p>
                  </div>
                  @if (esEncargado()) {
                    <button class="btn btn-primary btn-sm" (click)="abrirAsignacion(r)">
                      {{ r.tecnicoAsignado ? 'Reasignar técnico' : 'Asignar Técnico de Hardware' }}
                    </button>
                  }
                </div>
                @if (esEncargado() && preparoInicialmente(r); as prev) {
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

            <!-- El tipo de problema manda sobre el checklist: cambiarlo lo regenera entero -->
            <div class="sec-title mt-3">Tipo de problema del reproceso</div>
            <div class="field" style="max-width: 380px;">
              <select class="control" [ngModel]="data.tipoProblemaDeReproceso(r)"
                (ngModelChange)="pedirCambioTipo(r, $event)" [disabled]="r.estado !== 'En proceso'">
                @for (t of tiposProblema; track t) { <option [value]="t">{{ t }}</option> }
              </select>
              @if (r.estado === 'En proceso') {
                <span class="hint">El checklist se arma con este tipo; cambiarlo lo regenera y limpia lo marcado.</span>
              }
            </div>
            @if (data.tipoProblemaDeReproceso(r) === 'Accesorio faltante' && data.accesoriosRequeridos(r.inventario).length) {
              <p class="hint">Accesorios requeridos para este equipo: <b>{{ data.accesoriosRequeridos(r.inventario).join(' · ') }}</b>.</p>
            }

            <!-- Checklist dinámico según el tipo de problema, agrupado por secciones -->
            <div class="row-between mt-3" style="align-items: flex-end; gap: 12px;">
              <div class="sec-title" style="margin: 0;">{{ tituloChecklist(r) }}</div>
              <span class="chip">{{ completados(r) }} de {{ r.checklist.length }} completados</span>
            </div>
            @for (g of data.checklistPorSeccion(r); track g.seccion) {
              <div class="chk-sec">{{ g.seccion }}</div>
              @for (i of g.items; track i.nombre) {
                <div class="chk-row">
                  <input type="checkbox" [checked]="i.estado === 'Realizado'" [disabled]="r.estado !== 'En proceso'"
                    (change)="marcar(r, i.nombre, $event)" />
                  <span class="c-nombre" [class.na]="i.estado === 'No aplica'">{{ i.nombre }}</span>
                  @if (data.itemRequiereEvidencia(i)) { <span class="chip chip-ev">Requiere evidencia</span> }
                  <span class="chk-est"><ui-badge [estado]="data.etiquetaItemReproceso(i)" /></span>
                  <span class="chk-acc">
                    @if (r.estado === 'En proceso' && data.itemAdmiteNoAplica(i)) {
                      <button class="btn btn-ghost btn-sm" (click)="noAplica(r, i.nombre, i.estado)">
                        {{ i.estado === 'No aplica' ? 'Vuelve a aplicar' : 'Marcar No aplica' }}
                      </button>
                    }
                  </span>
                </div>
                <!-- La imagen se adjunta desde el ítem que la exige: nadie la asocia a mano -->
                @if (data.itemRequiereEvidencia(i) && i.estado === 'Realizado') {
                  <div class="chk-ev">
                    @if (evidenciaDeItem(r, i.nombre); as ev) {
                      @if (ev.imagen) {
                        <img class="chk-thumb" [src]="ev.imagen" [alt]="ev.archivo" (click)="abrirImagen(r, ev)" />
                      }
                      <span class="small mono">{{ ev.archivo }}</span>
                      <span class="chip">{{ ev.tipo }}</span>
                      <button class="btn btn-ghost btn-sm" (click)="abrirImagen(r, ev)">Ver imagen</button>
                      @if (r.estado === 'En proceso') {
                        <button class="btn btn-ghost btn-sm" (click)="eliminarEvidencia(r, ev.archivo)">Eliminar</button>
                      }
                    } @else if (r.estado === 'En proceso') {
                      <input type="file" hidden #evi accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                        (change)="subirEvidenciaItem(r, i, evi)" />
                      <button class="btn btn-outline btn-sm" (click)="evi.click()">
                        <ui-icon name="image" [size]="14" /> Adjuntar imagen
                      </button>
                      <span class="hint">Se guardará como <b>{{ data.tipoEvidenciaDeItem(i) }}</b>, asociada a este ítem.</span>
                    } @else {
                      <span class="i-falta">Sin imagen adjunta</span>
                    }
                  </div>
                }
              }
            }
            @if (r.estado === 'En proceso') {
              @if (data.itemsSinEvidenciaReproceso(r); as faltan) {
                @if (faltan.length) {
                  <div class="alert warn mt-2">
                    <span class="alert-ico">!</span>
                    <span>{{ data.mensajeItemSinEvidencia(faltan[0].nombre) }} Adjúntela desde el propio ítem del checklist.</span>
                  </div>
                }
              }
              <p class="hint">«No aplica» solo se ofrece en los ítems condicionales; los demás corresponden al tipo de problema y hay que resolverlos. Un ítem en «No aplica» no exige imagen.</p>
            }

            <!-- Resumen de lo cargado, y carga de lo que no respalda ningún ítem concreto -->
            <ui-evidencias titulo="Evidencias del reproceso"
              [lista]="r.evidencias"
              [editable]="r.estado === 'En proceso'"
              [contextos]="data.contextosEvidenciaReproceso()"
              tituloCarga="Adjuntar evidencia adicional"
              nota="Las imágenes de los ítems se adjuntan desde el propio ítem del checklist. Aquí solo se agrega evidencia adicional del reproceso."
              [sugeridas]="data.imagenesSugeridasReproceso(data.tipoProblemaDeReproceso(r))"
              (adjuntar)="agregarEvidencia(r, $event)"
              (eliminar)="eliminarEvidencia(r, $event)"
              (visualizar)="verEvidencia(r, $event)"
              (error)="toast.error('No se pudo adjuntar la imagen', $event)" />

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
                @if (data.constanciaDeReproceso(r.id); as d) {
                  <dt>Constancia de Reproceso F0288</dt>
                  <dd>
                    <b class="mono">{{ d.codigo }}</b> · <ui-badge [estado]="d.estado ?? 'Generado'" />
                    <div class="sub-cell">Generada el {{ d.fecha }} {{ d.hora }} · huella {{ d.hash }}</div>
                  </dd>
                }
              </dl>
            } @else if (r.estado === 'Finalizado') {
              <div class="alert warn mt-2">
                <span class="alert-ico">!</span>
                <span>El reproceso está finalizado pero <b>no firmado</b>. Sin la firma del Técnico de Hardware no se cierra ni devuelve el equipo a Configuración F0302.</span>
              </div>
            }

            <!-- Lo que falta para cerrar: las tres de finalizar y las dos de la firma, juntas -->
            @if (r.estado === 'En proceso' || r.estado === 'Finalizado') {
              <div class="sec-title mt-3">Validación antes de cerrar el reproceso</div>
              <div class="card card-pad">
                @for (v of data.validacionesReproceso(r, correccion(), observaciones()); track v.etiqueta) {
                  <div class="val-row" [class.ok]="v.cumplida">
                    <ui-icon [name]="v.cumplida ? 'check-circle' : 'circle'" />
                    <span class="v-txt">
                      <b>{{ v.etiqueta }}</b>
                      <span class="sub-cell">{{ v.detalle }}</span>
                    </span>
                    <span class="chip">{{ v.momento === 'Finalizar' ? 'Al finalizar' : 'Al firmar' }}</span>
                  </div>
                }
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
                <button class="btn btn-outline" (click)="verConstancia.set(r.id)">Ver constancia</button>
              }
              <a class="btn btn-outline" routerLink="/trazabilidad" [queryParams]="{ inventario: r.inventario }">Ver trazabilidad</a>
            </div>
            @if (r.estado === 'Pendiente de asignación') {
              <span class="hint">«Iniciar reproceso» se habilita cuando un <b>Encargado</b> asigne el reproceso a un Técnico de Hardware.</span>
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
          @if (avisoCarga(); as aviso) {
            <div class="alert warn mt-2">
              <span class="alert-ico">!</span>
              <span>{{ aviso }}</span>
            </div>
          }
          <div class="table-wrap mt-2">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Técnico de Hardware</th>
                  <th>Reprocesos activos</th>
                  <th>Expedientes activos</th>
                  <th>Pendientes por preparar</th>
                  <th>Carga laboral</th>
                  <th style="text-align:right;"></th>
                </tr>
              </thead>
              <tbody>
                @for (t of tecnicos(); track t.nombreRol) {
                  <tr>
                    <td>
                      <div class="main-cell">{{ t.usuario.nombre }}</div>
                      <div class="sub-cell">{{ t.usuario.rol }} · {{ t.usuario.unidad }}</div>
                      @if (t.nombreRol === preparoInicialmente(r)) { <span class="chip">Preparó este equipo inicialmente</span> }
                    </td>
                    <td class="mono">{{ t.reprocesos }}</td>
                    <td class="mono">{{ t.expedientes }}</td>
                    <td class="mono">{{ t.preparaciones }}</td>
                    <td>
                      <ui-badge [estado]="t.carga" />
                      @if (t.carga === 'Carga alta') {
                        <div class="sub-cell">Este técnico tiene carga alta. Revise sus pendientes antes de asignarle el reproceso.</div>
                      }
                    </td>
                    <td style="text-align:right;">
                      <button class="btn btn-primary btn-sm" (click)="asignar(r, t.nombreRol)">Asignar</button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="muted" style="text-align:center; padding: 20px;">No hay técnicos de Hardware activos.</td></tr>
                }
              </tbody>
            </table>
          </div>
          <span class="hint">La carga alta advierte, no bloquea: el Encargado decide con el dato a la vista.</span>
          @if (esEncargado()) {
            <div class="field mt-2">
              <label>Excepción: asignar fuera de la Unidad de Hardware</label>
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
        <ui-modal [titulo]="esGarantia(r) ? 'Firmar revisión técnica de garantía' : 'Firmar reproceso F0288'"
          (cerrar)="firmaAbierta.set(false)">
          <p class="small muted">
            La firma es lo que cierra {{ esGarantia(r) ? 'la revisión' : 'el reproceso' }}
            <b class="mono">{{ r.id }}</b>: deja constancia de quién intervino el equipo.
            @if (esGarantia(r)) { El caso de garantía volverá a Soporte para su validación. }
          </p>
          <div class="field mt-2">
            <label>Resultado del reproceso <span class="req">*</span></label>
            <select class="control" [ngModel]="resultado()" (ngModelChange)="resultado.set($event)">
              <option value="">Seleccione…</option>
              @for (x of resultadosDe(r); track x) { <option [value]="x">{{ x }}</option> }
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

      <!-- Cambiar el tipo de problema rehace el checklist: se confirma antes -->
      @if (cambioTipo(); as c) {
        <ui-modal titulo="Cambiar tipo de problema" [sub]="c.reproceso" (cerrar)="cambioTipo.set(null)">
          <p class="small">
            Al cambiar el tipo de problema se actualizará el checklist de reproceso. Los ítems marcados
            que no correspondan al nuevo tipo serán limpiados.
          </p>
          <div class="datos-cambio mt-2">
            <div><span>Tipo actual</span><b>{{ c.actual }}</b></div>
            <div><span>Tipo nuevo</span><b>{{ c.nuevo }}</b></div>
          </div>
          <div class="row mt-3" style="justify-content: flex-end;">
            <button class="btn btn-ghost" (click)="cambioTipo.set(null)">Cancelar</button>
            <button class="btn btn-primary" (click)="confirmarCambioTipo()">Cambiar tipo de problema</button>
          </div>
        </ui-modal>
      }

      @if (imagenAbierta(); as ev) {
        <ui-modal [titulo]="'Evidencia del ítem · ' + ev.tipo" [sub]="ev.item ?? ev.archivo"
          (cerrar)="imagenAbierta.set(null)">
          @if (ev.imagen) {
            <img class="ev-grande" [src]="ev.imagen" [alt]="ev.archivo" />
          } @else {
            <p class="small muted">Evidencia del set de demostración: se conserva la referencia, no se inventa la imagen.</p>
          }
          <dl class="dl mt-2">
            <dt>Archivo</dt><dd class="mono">{{ ev.archivo }}</dd>
            <dt>Ítem del checklist</dt><dd>{{ ev.item || 'Evidencia adicional del reproceso' }}</dd>
            <dt>Tipo de evidencia</dt><dd>{{ ev.tipo }}</dd>
            <dt>Cargada por</dt><dd>{{ ev.cargadaPor }}</dd>
            <dt>Fecha y hora</dt><dd>{{ ev.fecha }} {{ ev.hora }}</dd>
          </dl>
        </ui-modal>
      }

      <!-- Visor de la constancia: la misma vista en todas las pantallas -->
      <ui-constancia-reproceso [idReproceso]="verConstancia()" (cerrado)="verConstancia.set('')" />
    </div>
  `
})
export class ReprocesosComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);
  protected readonly toast = inject(ToastService);

  protected seleccion = signal('');
  /** Reproceso cuya constancia se está viendo; '' cierra el visor. */
  protected verConstancia = signal('');
  /** Imagen de un ítem del checklist abierta a tamaño grande. */
  protected imagenAbierta = signal<EvidenciaReproceso | null>(null);
  protected asignarAbierto = signal(false);
  protected firmaAbierta = signal(false);
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

  /**
   * Bandeja de Encargados: lo que espera una decisión de asignación. El Técnico de Hardware nunca
   * ve esta lista —si la viera podría tomarlos, y repartir la carga es tarea del Encargado—.
   */
  protected readonly porAsignar = computed<ReprocesoF0288[]>(() =>
    this.esEncargado() ? this.pendientes().filter((r) => r.estado === 'Pendiente de asignación') : []
  );

  /** Reprocesos ya asignados: la lista de trabajo del técnico y el seguimiento del Encargado. */
  protected readonly enCurso = computed<ReprocesoF0288[]>(() =>
    this.pendientes().filter((r) => r.estado !== 'Pendiente de asignación')
  );

  /** Fallas que exigen reproceso y quedaron sin él (solo en expedientes anteriores a la regla). */
  protected readonly sinReproceso = computed(() => this.data.fallasSinReproceso());

  /** Advertencia del modal cuando todos los técnicos disponibles están cargados. */
  protected readonly avisoCarga = computed<string>(() => {
    const lista = this.tecnicos();
    if (!lista.length || lista.some((t) => t.carga !== 'Carga alta')) return '';
    return 'Todos los técnicos de Hardware tienen carga alta. Revise sus pendientes antes de asignarles el reproceso.';
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

  /**
   * De dónde vino el reproceso. Importa para atenderlo: uno por inconformidad tiene al usuario
   * final esperando con el equipo ya entregado, y termina reenviando el formulario de conformidad.
   */
  protected origen(r: ReprocesoF0288): string {
    if (r.origen === 'Garantía') return `Garantía · caso ${r.casoGarantia ?? '—'}`;
    return r.origen === 'Inconformidad del usuario final'
      ? `Inconformidad del usuario final${r.intentoConformidad ? ` · intento #${r.intentoConformidad}` : ''}`
      : 'Falla detectada en F0302';
  }

  /** ¿Es una revisión técnica de garantía? Cambia el vocabulario de la pantalla, no el mecanismo. */
  protected esGarantia(r: ReprocesoF0288): boolean {
    return r.origen === 'Garantía';
  }

  /** Título del checklist según de dónde venga: no es lo mismo un reproceso que una garantía. */
  protected tituloChecklist(r: ReprocesoF0288): string {
    return this.esGarantia(r)
      ? `Checklist de Revisión Técnica de Garantía — ${this.data.tipoProblemaDeReproceso(r)}`
      : `Checklist de Reproceso F0288 — ${this.data.tipoProblemaDeReproceso(r)}`;
  }

  /**
   * «Requiere retorno a Configuración F0302» solo tiene sentido en una garantía: un reproceso por
   * falla ya vuelve a configuración cuando queda corregido.
   */
  protected resultadosDe(r: ReprocesoF0288): ResultadoReproceso[] {
    return this.esGarantia(r) ? [...this.resultados, 'Requiere retorno a Configuración F0302'] : this.resultados;
  }

  /** «CPU» / «Laptop»: el vocabulario del formulario, no el «Desktop» del inventario. */
  protected tipoEquipo(r: ReprocesoF0288): string {
    const eq = this.data.equipoDe(r.inventario);
    return eq ? (eq.tipo === 'Desktop' ? 'CPU' : eq.tipo) : '—';
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
  }

  protected generarReproceso(expediente: string): void {
    const r = this.data.asegurarReprocesoDeFalla(expediente, this.usuarioActual);
    if (typeof r === 'string') { this.toast.error('No se pudo generar el reproceso', r); return; }
    this.seleccion.set(r.id);
    this.toast.ok(`Reproceso ${r.id} generado`,
      `Queda pendiente de asignación sobre el Expediente técnico ${r.expedienteTecnico}: no se creó uno nuevo.`);
  }

  protected abrirAsignacion(r: ReprocesoF0288): void {
    this.seleccion.set(r.id);
    this.otroTecnico.set('');
    this.justificacion.set('');
    this.asignarAbierto.set(true);
  }

  protected asignar(r: ReprocesoF0288, tecnico: string): void {
    const carga = this.tecnicos().find((t) => t.nombreRol === tecnico);
    const error = this.data.asignarReprocesoF0288(r.id, tecnico, this.usuarioActual, this.justificacion());
    if (error) { this.toast.error('No se pudo asignar el reproceso', error); return; }
    this.asignarAbierto.set(false);
    this.firmante.set(tecnico);
    // La carga alta advierte, no bloquea: la asignación ya quedó hecha y el aviso acompaña.
    if (carga?.carga === 'Carga alta') {
      this.toast.error('Este técnico tiene carga alta',
        `Revise sus pendientes antes de asignarle el reproceso. ${r.id} quedó asignado a ${tecnico}.`);
      return;
    }
    this.toast.ok('Rollback a Hardware registrado',
      `${r.id} quedó asignado a ${tecnico}. El Expediente técnico ${r.expedienteTecnico} sigue siendo el mismo.`);
  }

  protected iniciar(r: ReprocesoF0288): void {
    const error = this.data.iniciarReprocesoF0288(r.id, this.usuarioActual);
    if (error) { this.toast.error('No se pudo iniciar el reproceso', error); return; }
    this.toast.ok('Reproceso F0288 iniciado', 'Se inició el cronómetro del tiempo trabajado y se cargó el checklist del tipo de problema, agrupado por secciones.');
  }

  /** Tipos de problema que puede atender un reproceso; cada uno trae su propio checklist. */
  protected readonly tiposProblema: TipoProblemaReproceso[] = [
    'Accesorio faltante', 'Falla física del equipo', 'Falla de disco', 'Falla de memoria',
    'Problema de sistema operativo', 'Problema de red física', 'Problema de encendido',
    'Problema de periféricos', 'Otro'
  ];
  /** Cambio de tipo pendiente de confirmar; null cierra el modal. */
  protected cambioTipo = signal<{ reproceso: string; actual: string; nuevo: TipoProblemaReproceso } | null>(null);

  /**
   * No se cambia el tipo en el acto: cambiarlo rehace el checklist y borra lo marcado, así que se
   * pregunta antes. Cancelar deja el reproceso como estaba.
   */
  protected pedirCambioTipo(r: ReprocesoF0288, nuevo: TipoProblemaReproceso): void {
    const actual = this.data.tipoProblemaDeReproceso(r);
    if (actual === nuevo) return;
    this.cambioTipo.set({ reproceso: r.id, actual, nuevo });
  }

  protected confirmarCambioTipo(): void {
    const c = this.cambioTipo();
    if (!c) return;
    const error = this.data.cambiarTipoProblemaReproceso(c.reproceso, c.nuevo, this.usuarioActual);
    this.cambioTipo.set(null);
    if (error) { this.toast.error('No se pudo cambiar el tipo de problema', error); return; }
    this.toast.ok('Checklist actualizado', `El reproceso ${c.reproceso} usa ahora el checklist de «${c.nuevo}».`);
  }

  /** Ítems ya completados, para el contador del encabezado del checklist. */
  protected completados(r: ReprocesoF0288): number {
    return r.checklist.filter((i) => i.estado === 'Realizado').length;
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

  /** Evidencia adicional: la que no respalda ningún ítem del checklist. */
  protected agregarEvidencia(r: ReprocesoF0288, ev: { archivo: string; imagen: string }): void {
    const error = this.data.agregarEvidenciaReproceso(r.id, ev.archivo, this.usuarioActual, ev.imagen);
    if (error) { this.toast.error('No se pudo adjuntar la imagen', error); return; }
    this.toast.ok('Evidencia adicional adjuntada',
      'Queda guardada con el código del reproceso y el expediente técnico original. No sustituye la imagen de los ítems marcados.');
  }

  /** Imagen ya adjunta a un ítem del checklist, si la hay. */
  protected evidenciaDeItem(r: ReprocesoF0288, item: string): EvidenciaReproceso | undefined {
    return r.evidencias.find((e) => e.item === item);
  }

  /**
   * Adjunta la imagen desde el propio ítem. El tipo lo pone el servicio a partir del ítem: aquí no
   * hay nada que elegir, que es justamente el punto.
   */
  protected async subirEvidenciaItem(r: ReprocesoF0288, item: ItemReproceso, input: HTMLInputElement): Promise<void> {
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    if (!this.data.evid.formatoValido(archivo.name)) {
      this.toast.error('Archivo no válido', this.data.evid.MSG_FORMATO);
      return;
    }
    try {
      const leida = await this.data.evid.leerImagen(archivo);
      const error = this.data.agregarEvidenciaReproceso(r.id, leida.archivo, this.usuarioActual,
        leida.imagen, item.nombre);
      if (error) { this.toast.error('No se pudo adjuntar la imagen', error); return; }
      this.toast.ok('Imagen adjuntada al ítem',
        `Quedó asociada a «${item.nombre}» como ${this.data.tipoEvidenciaDeItem(item)}.`);
    } catch {
      this.toast.error('Archivo no válido', this.data.evid.MSG_FORMATO);
    }
  }

  /** Abre la imagen de un ítem a tamaño grande; la consulta queda anotada igual que en la galería. */
  protected abrirImagen(r: ReprocesoF0288, ev: EvidenciaReproceso): void {
    this.imagenAbierta.set(ev);
    this.verEvidencia(r, ev.archivo);
  }

  /** Abrir la imagen también es un acceso a la evidencia: queda constancia de quién la consultó. */
  protected verEvidencia(r: ReprocesoF0288, archivo: string): void {
    this.data.registrarConsultaEvidencia(r.id, archivo, this.usuarioActual);
  }

  /** Imagen con la que Soporte reportó la falla que originó este reproceso, si la hay. */
  protected evidenciaFalla(r: ReprocesoF0288) {
    return this.data.evidenciaDeFalla(r.expediente);
  }

  /** La consulta de la evidencia inicial se anota contra el F0302, que es donde vive. */
  protected verEvidenciaFallaOrigen(r: ReprocesoF0288, archivo: string): void {
    this.data.registrarConsultaEvidenciaTecnica('Configuración F0302', r.expediente, r.expediente,
      archivo, this.usuarioActual);
  }

  protected eliminarEvidencia(r: ReprocesoF0288, archivo: string): void {
    const error = this.data.eliminarEvidenciaReproceso(r.id, archivo, this.usuarioActual);
    if (error) { this.toast.error('No se pudo eliminar la imagen', error); return; }
    this.toast.ok('Imagen de evidencia eliminada', `${archivo} ya no respalda este reproceso.`);
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

}
