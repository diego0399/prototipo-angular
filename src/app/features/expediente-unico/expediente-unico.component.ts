import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { CasoActivoService } from '../../core/services/caso-activo.service';
import { Equipo, ExpedienteUnico } from '../../core/models/models';
import { BadgeComponent, HelpTipComponent, MarcaModeloPipe, ModalComponent, TipoRequerimientoPipe } from '../../shared/ui';

/**
 * Expediente único: aquí se hace la unión entre la solicitud/requerimiento, el usuario final,
 * el equipo preparado, el expediente técnico y el F0288. Solo el Encargado de Soporte lo crea;
 * al crearse queda habilitada de inmediato la Configuración F0302.
 */
@Component({
  selector: 'app-expediente-unico',
  imports: [FormsModule, RouterLink, BadgeComponent, HelpTipComponent, MarcaModeloPipe, ModalComponent, TipoRequerimientoPipe],
  styles: `
    .exp-card { cursor: pointer; transition: box-shadow .15s, border-color .15s; }
    .exp-card:hover { box-shadow: var(--shadow-2); border-color: var(--blue-500); }
    .exp-cod { font-family: var(--font-brand); font-size: 20px; color: var(--navy-900); }
    .exp-sel { border-color: var(--blue-500); box-shadow: 0 0 0 2px var(--blue-100); }
    .paso-final { border: 2px solid var(--gold-500); box-shadow: 0 0 0 4px var(--gold-100), var(--shadow-1); }
    .paso-final .card-head { background: linear-gradient(90deg, var(--gold-100), transparent 60%); border-radius: var(--r-lg) var(--r-lg) 0 0; }
    .resumen-proceso dt { min-width: 190px; }
    .bloqueado { opacity: .55; pointer-events: none; }
    .sin-asig {
      display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: .05em;
      color: var(--tx-3); background: var(--surface-2); border: 1px dashed var(--line-strong);
      border-radius: 999px; padding: 3px 9px; white-space: nowrap;
    }
    .busq-filtros { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 10px; margin-bottom: 14px; }
    @media (max-width: 800px) { .busq-filtros { grid-template-columns: 1fr; } }
    .cat-busq { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
    .cat-busq input[type='search'] { flex: 1 1 320px; font-size: 13.5px; padding: 10px 14px; }
    .cat-busq select { max-width: 190px; }
    .n-result { font-size: 12px; color: var(--tx-3); }
    .mini-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
    .mini-col h4 { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--tx-3); margin-bottom: 6px; }
    .mini-item {
      display: block; width: 100%; text-align: left; border: 0; background: transparent; cursor: pointer;
      padding: 6px 4px; border-bottom: 1px solid var(--line); font-size: 12px; color: var(--tx-2);
    }
    .mini-item:hover { background: var(--surface-2); }
    .mini-item b { color: var(--navy-900); display: block; }
    .mini-item:last-child { border-bottom: 0; }
    .res-sel { border: 1px solid var(--gold-500); border-left: 5px solid var(--gold-500); }
    .res-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px 18px; margin-top: 10px; }
    .res-grid .d-k { font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--tx-3); }
    .res-grid .d-v { font-size: 13px; color: var(--navy-900); margin-top: 1px; }
    tr.sel td { background: var(--blue-050); }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Proceso técnico</div>
          <h1>
            Expediente único
            <ui-help texto="El Expediente único une la solicitud, el usuario final, el equipo preparado, el expediente técnico, el F0288, el F0302, la entrega, la conformidad y la garantía. Es un contenedor digital del proceso." />
          </h1>
          <p class="page-sub">Consolidación del proceso técnico, configuración, entrega y garantía.</p>
        </div>
      </div>

      <!-- Crear Expediente único (solo Encargado de Soporte) -->
      <div class="card mb-3 paso-final">
        <div class="card-head">
          <div>
            <h2>Crear Expediente único</h2>
            <p class="sub">Seleccione la solicitud, el equipo preparado y el técnico de configuración</p>
          </div>
          <ui-help texto="Solo el Encargado de Soporte crea el Expediente único: selecciona la solicitud, busca un equipo preparado, verifica su expediente técnico y asigna al técnico de configuración." />
        </div>
        <div class="card-body">
          @if (!esEncSoporte()) {
            <div class="alert warn mb-2">
              <span class="alert-ico">!</span>
              <span>Esta acción corresponde al <b>Encargado de Soporte</b>. Su rol puede consultar el avance, pero no crear el Expediente único.</span>
            </div>
          }

          <div [class.bloqueado]="!esEncSoporte()">
            <div class="field mb-2" style="max-width: 480px;">
              <label>Solicitud / requerimiento <span class="req">*</span></label>
              <select class="control" [(ngModel)]="procesoSel">
                <option value="" disabled>Seleccione la solicitud…</option>
                @for (s of procesos(); track s.expediente) {
                  <option [value]="s.expediente">{{ s.expediente }} — {{ s.tipoEquipo | tipoRequerimiento }} · {{ s.destinatario }}</option>
                }
              </select>
              @if (procesos().length === 0) {
                <span class="hint">Todas las solicitudes ya tienen Expediente único.</span>
              }
            </div>

            @if (proceso(); as p) {
              <div class="stepper mb-2">
                @for (paso of pasos(); track paso.lbl; let i = $index) {
                  <div class="step" [class.done]="paso.done" [class.now]="!paso.done && (i === 0 || pasos()[i - 1].done)">
                    <span class="dot">{{ paso.done ? '✓' : i + 1 }}</span>
                    <span class="lbl">{{ paso.lbl }}</span>
                  </div>
                }
              </div>

              <div class="grid grid-2">
                <dl class="dl resumen-proceso">
                  <dt>Solicitud / requerimiento</dt><dd>{{ p.expediente }} · {{ p.tipoEquipo | tipoRequerimiento }}</dd>
                  <dt>Usuario final</dt><dd>{{ p.destinatario }} — {{ p.unidadDestino }}</dd>
                  <dt>Correo institucional</dt><dd>{{ p.correoDestinatario }}</dd>
                  <dt>Equipo preparado</dt>
                  <dd>
                    @if (equipoProceso(); as e) {
                      {{ e | marcaModelo }} · {{ e.tipo === 'Desktop' ? 'CPU' : 'Laptop' }} {{ e.condicion.toLowerCase() }} · inv. {{ e.inventario }}
                      @if (!asigProceso()) {
                        <button class="btn btn-ghost btn-sm" style="margin-left: 8px;" (click)="abrirBusqueda()">Cambiar</button>
                      }
                    } @else {
                      <span class="row">
                        <button class="btn btn-outline btn-sm" (click)="abrirBusqueda()">🔍 Buscar equipo preparado</button>
                        <span class="sin-asig">SIN ASIGNACIÓN</span>
                      </span>
                    }
                  </dd>
                  <dt>Estado del proceso</dt><dd><ui-badge [estado]="p.estado" /></dd>
                </dl>
                <dl class="dl resumen-proceso">
                  <dt>Expediente técnico</dt>
                  <dd>
                    @if (expTecProceso(); as t) {
                      {{ t.codigo }} · {{ t.tipoExpediente }} <ui-badge [estado]="t.estado" />
                    } @else {
                      <span class="row">
                        <button class="btn btn-outline btn-sm" (click)="abrirBusquedaTec()">📁 Buscar expediente técnico</button>
                        <span class="muted small">o seleccione el equipo preparado.</span>
                      </span>
                    }
                  </dd>
                  <dt>Preparación F0288</dt>
                  <dd>
                    @if (prepProceso(); as pr) { <ui-badge [estado]="pr.estado" /> }
                    @else { <span class="muted">—</span> }
                  </dd>
                  <dt>Técnico de preparación</dt>
                  <dd>{{ expTecProceso()?.tecnicoPreparacion || '—' }}</dd>
                  <dt>Técnico de configuración</dt>
                  <dd>
                    <select class="control" style="max-width: 320px;" [(ngModel)]="tecnicoConfig">
                      <option value="" disabled>Seleccione al técnico de configuración…</option>
                      @for (t of tecnicosSoporte(); track t.usuario) {
                        <option [value]="t.nombre + ' — ' + t.rol">{{ t.nombre }} — {{ t.rol }}</option>
                      }
                    </select>
                  </dd>
                </dl>
              </div>

              @if (!puedeCrear()) {
                <div class="alert warn mt-2">
                  <span class="alert-ico">!</span>
                  <span>Para crear el Expediente único debe existir una solicitud, un <b>equipo preparado</b>, un <b>Expediente técnico completado</b> (F0288 finalizado) y un <b>Técnico de Configuración</b> asignado.</span>
                </div>
              }
              <div class="row mt-2" style="justify-content: flex-end;">
                <button class="btn btn-gold btn-lg" [disabled]="!puedeCrear()" (click)="crearUnico()">
                  Crear Expediente único y continuar a configuración
                </button>
              </div>
            } @else {
              <p class="muted small">Seleccione una solicitud para iniciar la creación del Expediente único.</p>
            }
          </div>
        </div>
      </div>

      <!-- Catálogo de expedientes únicos: buscador + filtros + tabla compacta -->
      @if (auth.esTecnico()) {
        <div class="alert mb-2">
          <span class="alert-ico">i</span>
          <span>Vista filtrada por usuario: solo se muestran los <b>expedientes únicos donde usted participa</b> o tiene tareas asignadas.</span>
        </div>
      }
      <div class="card mb-2">
        <div class="card-head">
          <div>
            <h2>Buscar Expediente único</h2>
            <p class="sub">Catálogo filtrable: no dependa de listas largas ni de revisión manual</p>
          </div>
        </div>
        <div class="card-body">
          <div class="cat-busq">
            <input class="control" type="search"
              placeholder="Buscar por expediente, solicitud, inventario, nombre del equipo, IP reservada, usuario final o estado…"
              [(ngModel)]="qU" (ngModelChange)="mostrarU.set(6)" />
            <select class="control" [(ngModel)]="fAnioU" (ngModelChange)="mostrarU.set(6)">
              <option value="">Año: todos</option>
              @for (a of aniosU(); track a) { <option [value]="a">{{ a }}</option> }
            </select>
            <select class="control" [(ngModel)]="fEstadoU" (ngModelChange)="mostrarU.set(6)">
              <option value="">Estado: todos</option>
              @for (e of estadosU(); track e) { <option [value]="e">{{ e }}</option> }
            </select>
            <select class="control" [(ngModel)]="fTipoU" (ngModelChange)="mostrarU.set(6)">
              <option value="">Tipo de equipo: todos</option>
              <option value="Laptop">Laptop</option>
              <option value="Desktop">CPU / Desktop</option>
            </select>
            @if (qU() || fAnioU() || fEstadoU() || fTipoU()) {
              <button class="btn btn-ghost btn-sm" (click)="limpiarCatalogo()">Limpiar filtros</button>
            }
          </div>
          <p class="n-result mb-1">Se encontraron {{ filtradosU().length }} expedientes. Mostrando {{ visiblesU().length }}.</p>
          <div class="table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Expediente</th><th>Solicitud</th><th>Inventario</th><th>Equipo</th>
                  <th>Usuario final</th><th>Fase actual</th><th>Estado</th><th>Garantía</th>
                  <th style="text-align:right;">Acción</th>
                </tr>
              </thead>
              <tbody>
                @for (x of visiblesU(); track x.codigoUnico) {
                  <tr [class.sel]="detalle()?.codigoUnico === x.codigoUnico">
                    <td class="mono main-cell">{{ x.codigoUnico }}</td>
                    <td>
                      <div class="mono">{{ x.expediente }}</div>
                      <div class="sub-cell">{{ solicitudDe(x)?.tipoEquipo | tipoRequerimiento }}</div>
                    </td>
                    <td class="mono">{{ solicitudDe(x)?.equipoInventario || '—' }}</td>
                    <td><div class="sub-cell" style="max-width: 180px;">{{ equipoDe(x) }}</div></td>
                    <td>{{ solicitudDe(x)?.destinatario || '—' }}</td>
                    <td>{{ faseDe(x) }}</td>
                    <td><ui-badge [estado]="x.estado" /></td>
                    <td>
                      @if (garantiaDe(x); as g) { <ui-badge [estado]="g.estado" /> } @else { <span class="muted">—</span> }
                    </td>
                    <td>
                      <div class="row" style="justify-content: flex-end;">
                        <button class="btn btn-primary btn-sm" (click)="seleccionar(x)">Ver detalle</button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="9" class="muted" style="text-align:center; padding: 24px;">
                      @if (auth.esTecnico() && visibles().length === 0) {
                        No participa en ningún expediente único todavía. Aparecerán aquí cuando tenga tareas asignadas en un proceso.
                      } @else {
                        Ningún expediente único coincide con la búsqueda o los filtros aplicados.
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (filtradosU().length > visiblesU().length) {
            <div class="row mt-2" style="justify-content: center;">
              <button class="btn btn-outline" (click)="mostrarU.set(mostrarU() + 6)">Cargar más ({{ filtradosU().length - visiblesU().length }} restantes)</button>
            </div>
          }
        </div>
      </div>

      <!-- Últimos registros y accesos rápidos (respetan permisos por rol) -->
      @if (visibles().length > 0) {
        <div class="card card-pad mb-3">
          <div class="mini-cols">
            <div class="mini-col">
              <h4>Últimos expedientes creados</h4>
              @for (x of ultimosCreados(); track x.codigoUnico) {
                <button class="mini-item" (click)="seleccionar(x)"><b class="mono">{{ x.codigoUnico }}</b>{{ x.resumenEstado }}</button>
              } @empty { <p class="muted small">Sin registros.</p> }
            </div>
            <div class="mini-col">
              <h4>En configuración</h4>
              @for (x of enConfigU(); track x.codigoUnico) {
                <button class="mini-item" (click)="seleccionar(x)"><b class="mono">{{ x.codigoUnico }}</b>{{ solicitudDe(x)?.destinatario }}</button>
              } @empty { <p class="muted small">Ninguno en configuración.</p> }
            </div>
            <div class="mini-col">
              <h4>Pendientes de aceptación</h4>
              @for (x of pendAceptacionU(); track x.codigoUnico) {
                <button class="mini-item" (click)="seleccionar(x)"><b class="mono">{{ x.codigoUnico }}</b>{{ solicitudDe(x)?.destinatario }}</button>
              } @empty { <p class="muted small">Ninguno pendiente.</p> }
            </div>
            <div class="mini-col">
              <h4>En garantía</h4>
              @for (x of enGarantiaU(); track x.codigoUnico) {
                <button class="mini-item" (click)="seleccionar(x)"><b class="mono">{{ x.codigoUnico }}</b>{{ garantiaDe(x)?.estado }}</button>
              } @empty { <p class="muted small">Ninguno en garantía.</p> }
            </div>
          </div>
        </div>
      }

      <!-- Tarjeta resumen del expediente seleccionado -->
      @if (detalle(); as x) {
        <div class="card card-pad res-sel mb-2">
          <div class="row-between">
            <span class="exp-cod">{{ x.codigoUnico }}</span>
            <ui-badge [estado]="x.estado" />
          </div>
          <div class="res-grid">
            <div><div class="d-k">Fase actual</div><div class="d-v">{{ faseDe(x) }}</div></div>
            <div><div class="d-k">Equipo</div><div class="d-v">{{ equipoDe(x) }}</div></div>
            <div><div class="d-k">Inventario</div><div class="d-v mono">{{ solicitudDe(x)?.equipoInventario || '—' }}</div></div>
            <div><div class="d-k">Nombre del equipo</div><div class="d-v mono">{{ configDe(x)?.datos?.nombrePC || '—' }}</div></div>
            <div><div class="d-k">Reserva de IP</div><div class="d-v">{{ configDe(x)?.datos?.requiereReservaIP || '—' }}</div></div>
            <div><div class="d-k">IP reservada</div><div class="d-v mono">{{ data.textoIPReservada(configDe(x)) }}</div></div>
            @if (configDe(x)?.datos?.requiereReservaIP === 'Sí') {
              <div><div class="d-k">MAC del equipo</div><div class="d-v mono">{{ configDe(x)?.datos?.macEquipo || 'Sin registrar' }}</div></div>
              <div><div class="d-k">Solicitud de reserva de IP</div><div class="d-v">{{ data.textoEstadoSolicitudIP(configDe(x)) }}</div></div>
            } @else if (configDe(x)?.datos?.requiereReservaIP === 'No') {
              <div><div class="d-k">Justificación de no reserva</div><div class="d-v">{{ configDe(x)?.datos?.justificacionSinReservaIP || 'Sin registrar' }}</div></div>
            }
            <div><div class="d-k">Usuario final</div><div class="d-v">{{ solicitudDe(x)?.destinatario || '—' }}</div></div>
            <div><div class="d-k">Técnico de configuración</div><div class="d-v">{{ tecnicoConfigDe(x) }}</div></div>
            <div><div class="d-k">Última actualización</div><div class="d-v mono">{{ ultimaActualizacion(x) }}</div></div>
          </div>
          <div class="row mt-2">
            <button class="btn btn-primary btn-sm" (click)="verDetalle.set(!verDetalle())">{{ verDetalle() ? 'Ocultar detalle' : 'Ver detalle' }}</button>
            @if (!auth.esTecnico() && solicitudDe(x)?.equipoInventario) {
              <button class="btn btn-outline btn-sm" (click)="verTrazabilidad(x)">Ver trazabilidad</button>
            }
            <a class="btn btn-outline btn-sm" routerLink="/generador-documentos">Ver documentos</a>
            @if (garantiaDe(x)) {
              <a class="btn btn-outline btn-sm" routerLink="/garantia">Ver garantía</a>
            }
          </div>
        </div>
      }

      <!-- Vista ejecutiva del expediente seleccionado -->
      @if (detalle(); as x) {
        @if (verDetalle()) {
        <div class="card">
          <div class="card-head">
            <div>
              <h2>{{ x.codigoUnico }} — vista ejecutiva</h2>
              <p class="sub">Solicitud {{ x.expediente }} · {{ x.resumenEstado }}</p>
            </div>
            <div class="row">
              @if (x.estado === 'En configuración') {
                <a class="btn btn-primary" routerLink="/configuracion">Continuar a Configuración F0302</a>
              }
              <ui-badge [estado]="x.estado" />
            </div>
          </div>
          <div class="card-body">
            <div class="grid grid-2 mb-2">
              <div>
                <div class="sec-title">Datos generales</div>
                <dl class="dl">
                  <dt>Código único</dt><dd>{{ x.codigoUnico }}</dd>
                  <dt>Solicitud</dt><dd>{{ x.expediente }} · {{ solicitudDe(x)?.tipoEquipo | tipoRequerimiento }}</dd>
                  <dt>Estado</dt><dd>{{ x.resumenEstado }}</dd>
                  @if (x.fechaEntrega) { <dt>Fecha de entrega</dt><dd>{{ x.fechaEntrega }}</dd> }
                </dl>
              </div>
              <div>
                <div class="sec-title">Equipo y usuario final</div>
                <dl class="dl">
                  <dt>Equipo</dt><dd>{{ equipoDe(x) }}</dd>
                  <dt>Inventario</dt><dd>{{ solicitudDe(x)?.equipoInventario }}</dd>
                  <dt>Nombre del equipo</dt><dd class="mono">{{ configDe(x)?.datos?.nombrePC || '—' }}</dd>
                  <dt>Reserva de IP</dt><dd>{{ configDe(x)?.datos?.requiereReservaIP || '—' }}</dd>
                  <dt>IP reservada</dt><dd class="mono">{{ data.textoIPReservada(configDe(x)) }}</dd>
                  @if (configDe(x)?.datos?.requiereReservaIP === 'Sí') {
                    <dt>MAC del equipo</dt><dd class="mono">{{ configDe(x)?.datos?.macEquipo || 'Sin registrar' }}</dd>
                    <dt>Solicitud de reserva de IP</dt><dd>{{ data.textoEstadoSolicitudIP(configDe(x)) }}</dd>
                  } @else if (configDe(x)?.datos?.requiereReservaIP === 'No') {
                    <dt>Justificación de no reserva</dt><dd>{{ configDe(x)?.datos?.justificacionSinReservaIP || 'Sin registrar' }}</dd>
                  }
                  <dt>Usuario final</dt><dd>{{ solicitudDe(x)?.destinatario }} — {{ solicitudDe(x)?.unidadDestino }}</dd>
                  <dt>Correo institucional</dt><dd>{{ solicitudDe(x)?.correoDestinatario }}</dd>
                </dl>
              </div>
            </div>

            <div class="grid grid-2 mb-2">
              <div>
                <div class="sec-title">Responsables técnicos</div>
                <dl class="dl">
                  <dt>Asignó el equipo</dt><dd>{{ asignacionDe(x)?.responsableAsignacion || '—' }}</dd>
                  <dt>Preparación (F0288)</dt><dd>{{ asignacionDe(x)?.responsablesFase?.tecnicoPreparacion || '—' }}</dd>
                  <dt>Configuración (F0302)</dt><dd>{{ asignacionDe(x)?.responsablesFase?.tecnicoConfiguracion || '—' }}</dd>
                  <dt>Entrega</dt><dd>{{ asignacionDe(x)?.responsablesFase?.responsableEntrega || '—' }}</dd>
                </dl>
              </div>
              <div>
                <div class="sec-title">Documentos generados</div>
                @if (docsDe(x).length > 0) {
                  <dl class="dl">
                    @for (d of docsDe(x); track d.tipo + d.fecha) {
                      <dt>{{ d.tipo }}</dt><dd>{{ d.fecha }} · por {{ d.generadoPor }} · huella {{ d.hash }}</dd>
                    }
                  </dl>
                } @else {
                  <p class="muted small">Aún no se han generado documentos para este proceso.</p>
                }
              </div>
            </div>

            <!-- Reporte final de auditoría: antes era un módulo aparte; ahora vive aquí porque -->
            <!-- consolida exactamente lo mismo que ya se ve en este expediente único. -->
            <div class="card mt-2 mb-2">
              <div class="card-head">
                <div>
                  <h3>
                    Reporte final de auditoría
                    <ui-help texto="El reporte final consolida el expediente único completo y cierra el proceso. Requiere que el usuario final haya aceptado la recepción del equipo." />
                  </h3>
                  <p class="sub">Consolida el expediente completo y cierra la auditoría del proceso</p>
                </div>
                <ui-badge [estado]="reporteGenerado(x) ? 'Cerrado' : (x.estado === 'Aceptado' ? 'Pendiente' : 'No iniciada')" />
              </div>
              <div class="card-body">
                <div class="grid grid-2 mb-2">
                  <dl class="dl">
                    <dt>Conformidad</dt>
                    <dd>
                      @if (conformidadDe(x); as c) { <ui-badge [estado]="c.estado" /> <span class="small muted">· formulario externo {{ c.token }}</span> }
                      @else { <span class="muted">No enviada aún</span> }
                    </dd>
                  </dl>
                  <dl class="dl">
                    <dt>Garantía</dt>
                    <dd>
                      @if (garantiaDe(x); as g) { <ui-badge [estado]="g.estado" /> <span class="small muted">· {{ g.fechaInicio }} → {{ g.fechaVencimiento }}</span> }
                      @else { <span class="muted">No iniciada</span> }
                    </dd>
                  </dl>
                </div>
                <div class="row-between">
                  <p class="small muted" style="max-width: 56ch;">
                    Al generar el reporte final, el expediente único queda cerrado y el proceso auditado de extremo a extremo. El expediente sigue disponible para registrar casos de garantía mientras esté vigente.
                    @if (!puedeGenerarReporte() && !reporteGenerado(x)) { <b> La generación corresponde al Encargado de Soporte.</b> }
                  </p>
                  @if (reporteGenerado(x)) {
                    <a class="btn btn-outline btn-sm" routerLink="/generador-documentos">Ver documento</a>
                  } @else {
                    <button class="btn btn-gold btn-lg" [disabled]="x.estado !== 'Aceptado' || !puedeGenerarReporte()" (click)="generarReporte(x)">
                      Generar reporte final
                    </button>
                  }
                </div>
              </div>
            </div>

            @if (x.estado === 'Aceptado' || x.estado === 'Cerrado') {
              <div class="alert ok mb-2">
                <span class="alert-ico">✓</span>
                <span>El expediente permanece <b>disponible para registrar casos de garantía</b> después de la aceptación del usuario final.</span>
                <a class="btn btn-outline btn-sm" routerLink="/garantia" style="margin-left: auto;">Servicio de garantía</a>
              </div>
            }

            <details class="acc">
              <summary>Ver contenido del expediente ({{ x.anexos.length }} elementos) <span class="acc-arrow">▶</span></summary>
              <div class="acc-body table-wrap">
                <table class="tbl">
                  <thead><tr><th>Elemento</th><th>Detalle</th><th>Estado</th><th>Fecha</th></tr></thead>
                  <tbody>
                    @for (a of x.anexos; track a.nombre) {
                      <tr>
                        <td class="main-cell">{{ a.nombre }}</td>
                        <td>{{ a.detalle }}</td>
                        <td><ui-badge [estado]="a.estado" /></td>
                        <td class="mono">{{ a.fecha || '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </details>

            <details class="acc mt-1">
              <summary>Ver trazabilidad resumida <span class="acc-arrow">▶</span></summary>
              <div class="acc-body">
                <div class="timeline">
                  @for (e of hitosDe(x); track $index) {
                    <div class="tl-item hito">
                      <div class="tl-when">{{ e.fecha }} · {{ e.hora }}</div>
                      <div class="tl-what">{{ e.accion }}</div>
                      <div class="tl-who">{{ e.usuario }}</div>
                    </div>
                  } @empty {
                    <p class="muted small">Sin hitos registrados.</p>
                  }
                </div>
              </div>
            </details>
          </div>
        </div>
        }
      }

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
                  <tr><td colspan="6" class="muted" style="text-align:center; padding: 22px;">No hay equipos preparados disponibles. Prepare equipos con Expediente técnico + F0288.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </ui-modal>
      }

      <!-- Catálogo de expedientes técnicos completados -->
      @if (buscarTecAbierto()) {
        <ui-modal titulo="Buscar expediente técnico" sub="Solo expedientes técnicos completados, con F0288 finalizado y equipo preparado sin asignar" (cerrar)="buscarTecAbierto.set(false)">
          <div class="field mb-2">
            <input class="control" type="search"
              placeholder="Código, inventario, marca, modelo, tipo de equipo, técnico o fecha…"
              [(ngModel)]="qTec" />
          </div>
          <div class="table-wrap">
            <table class="tbl">
              <thead>
                <tr><th>Expediente técnico</th><th>Inventario</th><th>Equipo</th><th>Técnico que preparó</th><th>Fecha</th><th>F0288</th><th style="text-align:right;"></th></tr>
              </thead>
              <tbody>
                @for (r of tecnicosDisponibles(); track r.tec.codigo) {
                  <tr>
                    <td>
                      <div class="mono main-cell">{{ r.tec.codigo }}</div>
                      <div class="sub-cell">{{ r.tec.tipoExpediente }}</div>
                    </td>
                    <td class="mono">{{ r.equipo.inventario }}</td>
                    <td>
                      <div class="main-cell">{{ r.equipo | marcaModelo }}</div>
                      <div class="sub-cell">{{ r.equipo.tipo === 'Desktop' ? 'CPU / Desktop' : 'Laptop' }} · {{ r.equipo.condicion.toLowerCase() }}</div>
                    </td>
                    <td>{{ r.tec.tecnicoPreparacion.split('—')[0].trim() }}</td>
                    <td class="mono">{{ r.tec.fecha }}</td>
                    <td><ui-badge [estado]="'Completada'" /></td>
                    <td>
                      <div class="row" style="justify-content: flex-end;">
                        <button class="btn btn-primary btn-sm" (click)="seleccionarTec(r.equipo.inventario)">Seleccionar</button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="7" class="muted" style="text-align:center; padding: 22px;">No hay expedientes técnicos completados listos para anexar con esa búsqueda.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </ui-modal>
      }
    </div>
  `
})
export class ExpedienteUnicoComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly casoActivo = inject(CasoActivoService);
  private readonly router = inject(Router);

  /** Llega como query param desde Servicio de garantía («Ver expediente»). */
  readonly expediente = input<string>();

  protected detalle = signal<ExpedienteUnico | null>(
    this.data.expedientesUnicosVisibles().find((x) => x.expediente === this.casoActivo.expediente())
    ?? this.data.expedientesUnicosVisibles()[0]
    ?? null
  );

  /** Encargados: expedientes únicos globales; Técnico de Soporte: solo donde participa. */
  protected readonly visibles = computed(() => this.data.expedientesUnicosVisibles());

  // ---------- Catálogo con buscador, filtros y «Cargar más» ----------
  protected qU = signal('');
  protected fAnioU = signal('');
  protected fEstadoU = signal('');
  protected fTipoU = signal('');
  protected mostrarU = signal(6);
  protected verDetalle = signal(false);

  protected readonly aniosU = computed(() =>
    [...new Set(this.visibles().map((x) => x.codigoUnico.split('-')[1]).filter(Boolean))].sort().reverse()
  );
  protected readonly estadosU = computed(() =>
    [...new Set(this.visibles().map((x) => x.estado))].sort()
  );

  /**
   * Búsqueda dinámica del catálogo: expediente único, solicitud/requerimiento,
   * inventario, usuario final, correo, marca y modelo, estado, fase, técnico de
   * configuración y garantía (estado y casos).
   */
  protected readonly filtradosU = computed(() => {
    const q = this.qU().toLowerCase().trim();
    return this.visibles().filter((x) => {
      if (this.fAnioU() && x.codigoUnico.split('-')[1] !== this.fAnioU()) return false;
      if (this.fEstadoU() && x.estado !== this.fEstadoU()) return false;
      const s = this.solicitudDe(x);
      if (this.fTipoU() && s?.tipoEquipo !== this.fTipoU()) return false;
      if (!q) return true;
      const g = this.garantiaDe(x);
      const c = this.configDe(x);
      const texto = [
        x.codigoUnico, x.expediente, x.estado, x.resumenEstado, this.faseDe(x),
        s ? this.data.tipoRequerimientoTexto(s) : '', s?.equipoInventario, s?.destinatario, s?.correoDestinatario, s?.unidadDestino,
        // El expediente también se busca por el nombre del equipo, su IP reservada y su MAC.
        c?.datos.nombrePC, c?.datos.ipReservada, c?.datos.macEquipo,
        this.equipoDe(x), this.asignacionDe(x)?.responsablesFase?.tecnicoConfiguracion,
        g?.estado, ...(g?.casos.map((c) => c.codigo) ?? [])
      ].filter(Boolean).join(' ').toLowerCase();
      return texto.includes(q);
    });
  });
  protected readonly visiblesU = computed(() => this.filtradosU().slice(0, this.mostrarU()));

  protected limpiarCatalogo(): void {
    this.qU.set('');
    this.fAnioU.set('');
    this.fEstadoU.set('');
    this.fTipoU.set('');
    this.mostrarU.set(6);
  }

  /** «Ver detalle» del catálogo: muestra primero la tarjeta resumen del expediente. */
  protected seleccionar(x: ExpedienteUnico): void {
    this.detalle.set(x);
    this.verDetalle.set(false);
  }

  /** Fase actual del proceso, derivada del estado de la solicitud (o del expediente). */
  protected faseDe(x: ExpedienteUnico): string {
    const s = this.solicitudDe(x)?.estado ?? x.estado;
    const fases: Record<string, string> = {
      'Asignada': 'Asignación de equipo',
      'En configuración': 'Configuración F0302',
      'Pendiente de aceptación': 'Entrega y aceptación',
      'Entregado': 'Servicio de garantía',
      'No conforme': 'Revisión de inconformidad',
      'Cerrado': 'Auditoría cerrada'
    };
    return fases[s] ?? s;
  }

  protected tecnicoConfigDe(x: ExpedienteUnico): string {
    const t = this.asignacionDe(x)?.responsablesFase?.tecnicoConfiguracion;
    return t ? t.split('—')[0].trim() : '—';
  }

  protected ultimaActualizacion(x: ExpedienteUnico): string {
    const eventos = this.data.eventosDe(x.expediente);
    return eventos[eventos.length - 1]?.fecha ?? x.fechaEntrega ?? '—';
  }

  /** Abre Trazabilidad con el recorrido completo del equipo de este expediente. */
  protected verTrazabilidad(x: ExpedienteUnico): void {
    const inv = this.solicitudDe(x)?.equipoInventario;
    if (inv) this.router.navigate(['/trazabilidad'], { queryParams: { inventario: inv } });
  }

  // Últimos registros y accesos rápidos (sobre los expedientes visibles por rol)
  protected readonly ultimosCreados = computed(() => this.visibles().slice(0, 3));
  protected readonly enConfigU = computed(() =>
    this.visibles().filter((x) => x.estado === 'En configuración').slice(0, 3)
  );
  protected readonly pendAceptacionU = computed(() =>
    this.visibles().filter((x) => this.solicitudDe(x)?.estado === 'Pendiente de aceptación').slice(0, 3)
  );
  protected readonly enGarantiaU = computed(() =>
    this.visibles().filter((x) => {
      const g = this.garantiaDe(x);
      return !!g && (g.estado === 'Vigente' || g.estado === 'Caso abierto');
    }).slice(0, 3)
  );

  constructor() {
    effect(() => {
      const id = this.expediente();
      const x = id ? this.data.expedienteUnicoDe(id) : undefined;
      if (x) this.detalle.set(x);
    });
    // Recuerda el último caso elegido aquí para sembrarlo en Configuración, Entrega y
    // Generador de documentos (sin forzar la selección: cada módulo sigue validando su rol).
    effect(() => {
      const d = this.detalle();
      if (d) this.casoActivo.seleccionar(d.expediente);
    });
  }

  // Creación (solo Encargado de Soporte)
  // Si el último caso activo (p. ej. recién asignado en Asignación de equipo) todavía no
  // tiene Expediente único, se precarga aquí para no tener que volver a buscarlo.
  protected procesoSel = signal(
    this.casoActivo.expediente() && !this.data.expedienteUnicoDe(this.casoActivo.expediente())
      ? this.casoActivo.expediente()
      : ''
  );
  protected equipoSel = signal('');
  protected tecnicoConfig = signal('');
  protected buscarAbierto = signal(false);
  protected q = signal('');
  protected fTipo = signal('');
  protected fCond = signal('');
  protected buscarTecAbierto = signal(false);
  protected qTec = signal('');

  protected readonly esEncSoporte = computed(() => this.auth.usuario()?.clave === 'enc-soporte');

  /** Solicitudes que aún no tienen Expediente único. */
  protected readonly procesos = computed(() =>
    this.data.solicitudes().filter((s) => !this.data.expedienteUnicoDe(s.expediente))
  );
  protected readonly proceso = computed(() =>
    this.procesoSel() ? this.data.solicitud(this.procesoSel()) : undefined
  );
  protected readonly asigProceso = computed(() =>
    this.procesoSel() ? this.data.asignacionDe(this.procesoSel()) : undefined
  );
  /** Equipo del proceso: el ya asignado a la solicitud, o el seleccionado en la búsqueda. */
  protected readonly equipoProceso = computed(() => {
    const asig = this.asigProceso();
    if (asig) return this.data.equipoDe(asig.equipoInventario);
    return this.equipoSel() ? this.data.equipoDe(this.equipoSel()) : undefined;
  });
  protected readonly expTecProceso = computed(() => {
    const e = this.equipoProceso();
    return e ? this.data.expTecnicoDeEquipo(e.inventario) : undefined;
  });
  protected readonly prepProceso = computed(() => {
    const t = this.expTecProceso();
    return t ? this.data.preparacionPorCodigo(t.codigo) : undefined;
  });

  protected readonly pasos = computed(() => [
    { lbl: 'Solicitud seleccionada', done: !!this.proceso() },
    { lbl: 'Equipo preparado seleccionado', done: !!this.equipoProceso() },
    { lbl: 'Expediente técnico completado (F0288)', done: this.expTecProceso()?.estado === 'Preparado' },
    { lbl: 'Técnico de configuración asignado', done: !!this.tecnicoConfig() },
    { lbl: 'Crear Expediente único', done: false },
    { lbl: 'Continuar a Configuración F0302', done: false }
  ]);

  protected readonly puedeCrear = computed(() =>
    this.esEncSoporte() && !!this.proceso() && !!this.proceso()?.correoDestinatario &&
    !!this.equipoProceso() && this.expTecProceso()?.estado === 'Preparado' && !!this.tecnicoConfig()
  );

  protected readonly tecnicosSoporte = computed(() =>
    this.data.usuarios().filter((u) => u.clave === 'tec-soporte')
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

  /**
   * Catálogo de expedientes técnicos listos para anexar: completados (Preparado), con F0288
   * finalizado y cuyo equipo sigue sin asignar. Permite buscar por código, inventario, marca,
   * modelo, tipo de equipo, técnico que preparó o fecha.
   */
  protected readonly tecnicosDisponibles = computed(() => {
    const q = this.qTec().toLowerCase().trim();
    return this.data.equiposDisponiblesParaAsignar()
      .map((equipo) => ({ equipo, tec: this.data.expTecnicoDeEquipo(equipo.inventario)! }))
      .filter(({ equipo, tec }) => {
        if (!q) return true;
        return `${tec.codigo} ${equipo.inventario} ${equipo.marca} ${equipo.modelo} ${tec.tipoEquipo} ${tec.tipoExpediente} ${tec.tecnicoPreparacion} ${tec.fecha} ${tec.estado}`
          .toLowerCase().includes(q);
      });
  });

  protected abrirBusqueda(): void {
    const s = this.proceso();
    if (!s) {
      this.toast.warn('Seleccione primero la solicitud', 'Elija la solicitud antes de buscar el equipo preparado.');
      return;
    }
    this.fTipo.set(s.tipoEquipo);
    this.q.set('');
    this.buscarAbierto.set(true);
  }

  protected abrirBusquedaTec(): void {
    if (!this.proceso()) {
      this.toast.warn('Seleccione primero la solicitud', 'Elija la solicitud antes de buscar el expediente técnico a anexar.');
      return;
    }
    this.qTec.set('');
    this.buscarTecAbierto.set(true);
  }

  protected seleccionarEquipo(e: Equipo): void {
    this.equipoSel.set(e.inventario);
    this.buscarAbierto.set(false);
  }

  /** Anexar por expediente técnico: selecciona el equipo preparado al que pertenece. */
  protected seleccionarTec(inventario: string): void {
    this.equipoSel.set(inventario);
    this.buscarTecAbierto.set(false);
  }

  protected crearUnico(): void {
    const p = this.proceso();
    if (!this.esEncSoporte()) {
      this.toast.error('Acción no permitida', 'Solo el Encargado de Soporte crea el Expediente único.');
      return;
    }
    if (!p || !this.puedeCrear()) {
      this.toast.warn('Datos incompletos', 'Para crear el Expediente único debe existir una solicitud, un equipo preparado, un Expediente técnico completado y un Técnico de Configuración asignado.');
      return;
    }
    const u = this.auth.usuario();
    const quien = `${u?.nombre} — ${u?.rol}`;
    // Si el equipo aún no está asignado a la solicitud, se registra la asignación en este paso.
    if (!this.asigProceso()) {
      const eq = this.equipoProceso()!;
      const error = this.data.asignarEquipo(p.expediente, eq.inventario, quien, '', p.tipoEquipo === 'Laptop');
      if (error) {
        this.toast.error('No se puede asignar el equipo', error);
        return;
      }
    }
    const creado = this.data.crearExpedienteUnico(p.expediente, this.tecnicoConfig(), quien);
    if (creado) {
      this.toast.ok(`Expediente único ${creado.codigoUnico} creado`, 'La Configuración F0302 quedó habilitada para el técnico asignado.');
      this.detalle.set(creado);
      this.verDetalle.set(true);
      this.procesoSel.set('');
      this.equipoSel.set('');
      this.tecnicoConfig.set('');
    } else {
      this.toast.error('No fue posible crear el Expediente único', 'Verifique el equipo preparado y los datos del proceso.');
    }
  }

  protected solicitudDe(x: ExpedienteUnico) { return this.data.solicitud(x.expediente); }
  /** Configuración F0302 del proceso: aporta el nombre del equipo y la reserva de IP al expediente. */
  protected configDe(x: ExpedienteUnico) { return this.data.configuracionDe(x.expediente); }
  protected asignacionDe(x: ExpedienteUnico) { return this.data.asignacionDe(x.expediente); }
  protected docsDe(x: ExpedienteUnico) { return this.data.documentosDe(x.expediente); }
  protected hitosDe(x: ExpedienteUnico) { return this.data.eventosDe(x.expediente).filter((e) => e.hito); }
  protected conformidadDe(x: ExpedienteUnico) { return this.data.conformidades().find((c) => c.expediente === x.expediente); }
  protected garantiaDe(x: ExpedienteUnico) { return this.data.garantiaDe(x.expediente); }
  protected reporteGenerado(x: ExpedienteUnico): boolean {
    return this.docsDe(x).some((d) => d.tipo === 'Reporte final');
  }

  /** El Reporte final lo gestiona el Encargado de Soporte (o el Administrador). */
  protected readonly puedeGenerarReporte = computed(() => {
    const c = this.auth.usuario()?.clave;
    return c === 'enc-soporte' || c === 'admin';
  });

  protected generarReporte(x: ExpedienteUnico): void {
    if (!this.puedeGenerarReporte()) {
      this.toast.error('Acción no permitida', 'El Reporte final lo genera el Encargado de Soporte.');
      return;
    }
    const u = this.auth.usuario();
    if (this.data.generarReporteFinal(x.expediente, `${u?.nombre} — ${u?.rol}`)) {
      this.toast.ok('Reporte final generado', 'El expediente único quedó cerrado; la auditoría del proceso está completa.');
      const actualizado = this.data.expedienteUnicoDe(x.expediente);
      if (actualizado) this.detalle.set(actualizado);
    } else {
      this.toast.error('No es posible generar el reporte final', 'El usuario final debe haber aceptado la recepción del equipo (conformidad).');
    }
  }
  protected equipoDe(x: ExpedienteUnico): string {
    const s = this.solicitudDe(x);
    const eq = s ? this.data.equipoDe(s.equipoInventario) : undefined;
    return eq ? `${eq.marca} ${eq.modelo} · ${eq.tipo === 'Desktop' ? 'CPU' : 'Laptop'} ${eq.condicion.toLowerCase()}` : '—';
  }
}
