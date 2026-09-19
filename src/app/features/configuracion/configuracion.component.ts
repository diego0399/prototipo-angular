import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AccionRequeridaFalla, CargaSoporte, ConfiguracionF0302, Cronometro, DetalleFallaF0302, ExpedienteUnico, MotivoSoftwareF0302,
  NivelComplejidad, ReprocesoF0288, RespuestaSiNo,
  SoftwareCatalogo, SoftwareF0302, SolicitudReservaIP, TipoFallaF0302
} from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { CasoActivoService } from '../../core/services/caso-activo.service';
import { BadgeComponent, HelpTipComponent, ModalComponent } from '../../shared/ui';
import { IconComponent } from '../../shared/icon';
import { EvidenciasComponent } from '../../shared/evidencias';
import { BuscarExpedienteUnicoModalComponent, FilaExpedienteUnico, filaExpedienteUnico } from '../../shared/buscar-expediente';
import { SelectorSoporteComponent } from '../../shared/selector-soporte.component';

@Component({
  selector: 'app-configuracion',
  imports: [FormsModule, RouterLink, BadgeComponent, HelpTipComponent, ModalComponent, BuscarExpedienteUnicoModalComponent,
    IconComponent, EvidenciasComponent, SelectorSoporteComponent],
  styles: `
    .sw-row td .chk { width: 17px; height: 17px; accent-color: var(--ok); cursor: pointer; }
    .cap-row { display: flex; gap: 7px; align-items: center; flex-wrap: wrap; }
    .falla-thumb { width: 128px; height: 84px; object-fit: cover; border-radius: 6px; border: 1px solid var(--line); cursor: pointer; }
    .falla-grande { max-width: 100%; max-height: 58vh; display: block; margin: 0 auto; border-radius: 8px; border: 1px solid var(--line); }
    .cap-row .control { max-width: 210px; }
    .i-falta { font-size: 11.5px; font-weight: 600; color: var(--danger, #c0392b); }
    /* Ítems con tres estados: Agente DLP e Ingreso a dominio */
    .estados { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 5px; }
    .estados .radio-line { font-size: 12.5px; font-weight: 400; color: var(--tx-2); }
    .just-box { margin-top: 8px; max-width: 520px; }
    .just-box label { display: block; font-size: 11.5px; font-weight: 700; color: var(--navy-900); margin-bottom: 4px; }
    .sug-just { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 6px; }
    .chip-btn { cursor: pointer; border: 1px dashed var(--line-strong); background: transparent; font: inherit; }
    .chip-btn:hover { border-color: var(--blue-500); color: var(--blue-600); }
    .sec-nota { font-size: 11px; color: var(--tx-3); font-weight: 400; text-transform: none; letter-spacing: 0; margin-left: 10px; }
    .sw-row.heredado td { background: var(--surface-2); }
    .sw-row.heredado .candado { opacity: .75; }
    tr.sel td { background: var(--surface-2); box-shadow: inset 3px 0 0 var(--gold-500); }
    .cat-row td { background: var(--surface-2); font-size: 11.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--tx-3); padding: 7px 10px; }
    .cat-row .sec-selall { display: inline-flex; align-items: center; gap: 7px; font-weight: 600; cursor: pointer; float: right; text-transform: none; letter-spacing: normal; }
    .cat-row .sec-selall input { width: 15px; height: 15px; accent-color: var(--navy-800); cursor: pointer; }
    .sw-row select.control { max-width: 150px; }
    .crono-card { border-left: 4px solid var(--line-strong); }
    .crono-card.corriendo { border-left-color: var(--gold-500); }
    .c-titulo { font-size: 11.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--tx-3); }
    .c-timer { font-size: 30px; font-weight: 700; color: var(--navy-900); line-height: 1.2; font-variant-numeric: tabular-nums; }
    .c-timer.ok { color: var(--ok); font-size: 22px; }
    .c-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px 18px; flex: 1; min-width: 260px; }
    .c-grid .d-k { font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--tx-3); }
    .c-grid .d-v { font-size: 13px; color: var(--navy-900); margin-top: 2px; }
    .correo-sim { margin: 8px 0 0; padding: 10px 12px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; font-family: var(--mono, monospace); font-size: 12px; line-height: 1.55; color: var(--navy-900); white-space: pre-wrap; }
    .chip-btn { cursor: pointer; white-space: normal; text-align: left; font-family: var(--font); }
    .radio-line { display: flex; gap: 18px; align-items: center; }
    .radio-line label { display: inline-flex; align-items: center; gap: 7px; cursor: pointer; font-size: 13.5px; font-weight: 600; color: var(--navy-900); }
    .radio-line input[type='radio'] { width: 17px; height: 17px; accent-color: var(--navy-800); cursor: pointer; }
    .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .firma { display: flex; align-items: center; gap: 12px; background: var(--surface-2); border: 1px dashed var(--line-strong); border-radius: var(--r-md); padding: 12px 14px; }
    .firma .f-sello { flex: none; width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--gold-500); color: var(--gold-600); display: grid; place-items: center; font-family: var(--font-brand); font-size: 14px; }
    @media (max-width: 860px) { .firmas { grid-template-columns: 1fr; } }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Proceso técnico</div>
          <h1>
            Configuración del equipo · F0302
            <ui-help texto="El F0302 se completa dentro de SISGOST como checklist digital. No tiene una lista fija de software: solo aparece lo que la Preparación F0288 ya instaló (bloqueado) y lo que el Técnico de Soporte agrega desde el Catálogo de Software según el requerimiento del usuario final." />
          </h1>
          <p class="page-sub">Checklist digital de configuración e instalación.</p>
        </div>
      </div>

      <!-- ── Pendientes de iniciar ──
           El DER separa la designación (ASIGNACION_CONFIGURACION: el técnico queda responsable) de
           la ejecución (FORM_CONFIGURACION: el técnico ya está trabajando). Estos expedientes ya
           tienen técnico; el F0302 no existe hasta que él lo abre desde aquí. -->
      @if (pendientesDeIniciar().length) {
        <div class="card mb-3">
          <div class="card-head">
            <div>
              <h2>Expedientes asignados, pendientes de iniciar</h2>
              <p class="sub">Tienen Técnico de Configuración designado; el checklist F0302 nace al iniciar</p>
            </div>
            <ui-help texto="Que un expediente le esté asignado no significa que el trabajo haya empezado. Al pulsar «Iniciar configuración» se abre la ejecución (FORM_CONFIGURACION) y con ella el checklist F0302." />
          </div>
          <div class="card-body table-wrap">
            <table class="tbl">
              <thead>
                <tr><th>Expediente único</th><th>Solicitud</th><th>Equipo</th><th>Usuario final</th><th>Técnico designado</th><th></th></tr>
              </thead>
              <tbody>
                @for (x of pendientesDeIniciar(); track x.codigoUnico) {
                  <tr>
                    <td class="mono main-cell">{{ x.codigoUnico }}</td>
                    <td class="mono">{{ x.expediente }}</td>
                    <td class="mono">{{ x.inventario }}</td>
                    <td>{{ usuarioFinalDe(x) }}</td>
                    <td>{{ tecnicoDesignadoDe(x) }}</td>
                    <td style="text-align:right;">
                      <button class="btn btn-gold btn-sm" (click)="iniciarTrabajo(x.codigoUnico)">Iniciar configuración</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <div class="card card-pad mb-3">
        <div class="row-between" style="flex-wrap: wrap; gap: 16px;">
          <div style="min-width: 0;">
            <div class="sec-title" style="margin-bottom: 3px;">Proceso en configuración</div>
            @if (conf(); as c) {
              <p class="small"><b class="mono">{{ c.expediente }}</b> — {{ c.estado }}</p>
            } @else {
              <p class="small muted">Ninguno seleccionado.</p>
            }
          </div>
          @if (opciones().length > 1) {
            <button class="btn btn-outline btn-sm" (click)="buscarAbierto.set(true)"><ui-icon name="search" [size]="14" /> Buscar expediente</button>
          }
        </div>
        @if (auth.esTecnico()) {
          <span class="hint">Solo se muestran las configuraciones F0302 asignadas a usted o donde usted participó.</span>
        } @else if (auth.esEncargadoSoporte()) {
          <span class="hint">Vista global de las configuraciones F0302 del proceso de Soporte; puede filtrar por técnico, estado, año, inventario o usuario final.</span>
        }
      </div>

      @if (conf(); as c) {
        <!-- Cronómetro de configuración: inicia con «Iniciar configuración» y se detiene al finalizar -->
        <div class="card mb-2 crono-card" [class.corriendo]="enCurso(c)">
          <div class="card-body">
            @if (!c.cronometro) {
              <div class="row-between" style="flex-wrap: wrap; gap: 12px;">
                <div>
                  <div class="c-titulo">Cronómetro de configuración</div>
                  <p class="small muted" style="max-width: 60ch;">
                    La configuración aún no inicia su registro de tiempo. Al presionar
                    <b>Iniciar configuración</b> comienza el cronómetro y quedan registrados la fecha,
                    la hora y el técnico que inició; el evento se anota en la trazabilidad del equipo.
                  </p>
                </div>
                <button class="btn btn-gold btn-lg" [disabled]="c.estado === 'Completada'" (click)="iniciar(c)"><ui-icon name="chevron" [size]="14" /> Iniciar configuración</button>
              </div>
            } @else if (enCurso(c)) {
              <div class="row-between" style="flex-wrap: wrap; gap: 12px;">
                <div>
                  <div class="c-titulo">Configuración en proceso — cronómetro corriendo</div>
                  <div class="c-timer mono">{{ transcurrido(c.cronometro) }}</div>
                </div>
                <div class="c-grid">
                  <div><div class="d-k">Inicio</div><div class="d-v mono">{{ c.cronometro.fechaInicio }} · {{ c.cronometro.horaInicio.slice(0, 5) }}</div></div>
                  <div><div class="d-k">Inició</div><div class="d-v">{{ c.cronometro.iniciadoPor }}</div></div>
                  <div><div class="d-k">Inventario · equipo</div><div class="d-v mono">{{ c.datos.inventario }} · {{ c.datos.nombrePC }}</div></div>
                  <div><div class="d-k">Usuario final destino</div><div class="d-v">{{ c.datos.asignadoA }}</div></div>
                </div>
              </div>
              <span class="hint">El cronómetro se detiene al presionar «Finalizar configuración y generar F0302»; el tiempo total queda en el historial y en la trazabilidad.</span>
            } @else {
              <div class="row-between" style="flex-wrap: wrap; gap: 12px;">
                <div>
                  <div class="c-titulo">Tiempo de configuración registrado</div>
                  <div class="c-timer mono ok">{{ data.formatoDuracion(c.cronometro.duracionMinutos) }}</div>
                </div>
                <div class="c-grid">
                  <div><div class="d-k">Inicio</div><div class="d-v mono">{{ c.cronometro.fechaInicio }} · {{ c.cronometro.horaInicio.slice(0, 5) }}</div></div>
                  <div><div class="d-k">Fin</div><div class="d-v mono">{{ c.cronometro.fechaFin }} · {{ c.cronometro.horaFin.slice(0, 5) }}</div></div>
                  <div><div class="d-k">Complejidad</div><div class="d-v">{{ c.cierre?.nivel || '—' }}</div></div>
                  <div><div class="d-k">Observación</div><div class="d-v">{{ c.cierre?.detalle || c.cierre?.observacion || 'Sin observaciones' }}</div></div>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Datos de instalación -->
        <div class="card mb-2">
          <div class="card-head">
            <div>
              <h2>Datos de instalación</h2>
              <p class="sub">Técnico seleccionado por {{ c.seleccionadoPor }}</p>
            </div>
            <ui-badge [estado]="c.estado" />
          </div>
          <div class="card-body">
            <div class="grid grid-3">
              <dl class="dl">
                <dt>Requerimiento</dt><dd>{{ c.datos.requerimiento }}</dd>
                <dt>Inventario</dt><dd>{{ c.datos.inventario }}</dd>
                <dt>Nombre del equipo</dt><dd>{{ c.datos.nombrePC || 'Sin registrar' }}</dd>
                <!-- Dato de consulta: aparece cuando ya se registró desde el modal de conformidad. -->
                @if (c.datos.requiereReservaIP) {
                  <dt>Reserva de IP</dt><dd>{{ c.datos.requiereReservaIP }}</dd>
                  <dt>IP reservada</dt><dd class="mono">{{ data.textoIPReservada(c) }}</dd>
                  @if (c.datos.requiereReservaIP === 'Sí') {
                    <dt>MAC del equipo</dt><dd class="mono">{{ c.datos.macEquipo || 'Sin registrar' }}</dd>
                    <dt>Solicitud de reserva de IP</dt><dd>{{ data.textoEstadoSolicitudIP(c) }}</dd>
                  } @else {
                    <dt>Justificación de no reserva</dt><dd>{{ c.datos.justificacionSinReservaIP || 'Sin registrar' }}</dd>
                  }
                }
                <dt>Tipo de servicio</dt><dd>{{ c.datos.tipoServicio }}</dd>
              </dl>
              <dl class="dl">
                <dt>Usuario final</dt><dd>{{ c.datos.asignadoA }} (carné {{ c.datos.carne }})</dd>
                <dt>Dirección / gerencia</dt><dd>{{ c.datos.direccionGerencia }}</dd>
                <dt>Unidad</dt><dd>{{ c.datos.unidad }}</dd>
                <dt>Puesto funcional</dt><dd>{{ c.datos.puesto }}</dd>
              </dl>
              <dl class="dl">
                <dt>Sistema operativo</dt><dd>{{ c.datos.sistemaOperativo }}</dd>
                <dt>Arquitectura</dt><dd>{{ c.datos.arquitectura }}</dd>
                <dt>Técnico</dt><dd>{{ c.tecnico }}</dd>
                @if (data.direccionDe(c.tecnico); as dir) { <dt>Dirección del técnico</dt><dd>{{ dir }}</dd> }
                <dt>Especificaciones</dt><dd>{{ especificaciones(c.expediente) }}</dd>
              </dl>
            </div>
          </div>
        </div>

        <!-- Software heredado de la Preparación F0288: visible, bloqueado y no editable -->
        @if (heredado(); as hs) {
          <div class="card mb-2">
            <div class="card-head">
              <div>
                <h2>
                  Software instalado durante Preparación F0288
                  <ui-help texto="Lo que Hardware ya instaló en la preparación técnica se hereda al F0302 como información: se muestra con la versión y la captura registradas en el F0288, no se vuelve a marcar y no puede agregarse otra vez como software adicional." />
                </h2>
                <p class="sub">Heredado del expediente técnico {{ hs[0].expedienteTecnico }}</p>
              </div>
              <ui-badge estado="Bloqueado" />
            </div>
            <div class="card-body table-wrap">
              <table class="tbl">
                <thead><tr><th>Software</th><th>Versión</th><th>Etapa origen</th><th>Evidencia</th><th>Estado</th></tr></thead>
                <tbody>
                  @for (s of hs; track s.codigoSoftware) {
                    <tr class="sw-row heredado">
                      <td class="main-cell">
                        <span class="candado" title="Bloqueado: instalado en la Preparación F0288"><ui-icon name="lock" [size]="13" /></span> {{ s.nombre }}
                        <div class="sub-cell">{{ s.categoria }} · {{ s.item }}</div>
                      </td>
                      <td class="mono">{{ s.version }}</td>
                      <td><span class="chip">F0288</span></td>
                      <td>@if (s.evidencia) { <span class="chip">{{ s.evidencia }}</span> } @else { <span class="muted">—</span> }</td>
                      <td><ui-badge estado="Instalado en F0288" /></td>
                    </tr>
                  }
                </tbody>
              </table>
              <span class="hint">Software, versión, estado y evidencia son de solo lectura: ya fueron registrados y verificados en la Preparación F0288. El Técnico de Soporte no vuelve a marcarlos.</span>
            </div>
          </div>
        }

        @if (enCurso(c) || c.estado === 'Completada') {
        <!-- Software adicional: depende del requerimiento; se elige del Catálogo de Software -->
        <div class="card mb-2">
          <div class="card-head">
            <div>
              <h2>
                Software adicional requerido
                <ui-help texto="El checklist F0302 no tiene una lista fija de software: el Técnico de Soporte agrega el que necesita el usuario final según su requerimiento, siempre desde el Catálogo de Software permitido y con la versión que el catálogo autoriza." />
              </h2>
              <p class="sub">Según las necesidades del requerimiento · seleccionado desde el Catálogo de Software</p>
            </div>
            @if (c.estado !== 'Completada') {
              <button class="btn btn-outline btn-sm" (click)="abrirCatalogo(c)">＋ Agregar software</button>
            }
          </div>
          <div class="card-body table-wrap">
            @if (adicional(c); as sws) {
              <table class="tbl">
                <thead><tr><th style="width:44px;"></th><th>Software</th><th>Versión</th><th>Motivo / requerimiento</th><th>Estado</th><th style="text-align:right;">Acción</th></tr></thead>
                <tbody>
                  @for (s of sws; track s.nombre) {
                    <tr class="sw-row">
                      <td>
                        <input class="chk" type="checkbox" [checked]="s.estado === 'Realizado'"
                          [disabled]="c.estado === 'Completada'"
                          (change)="marcar(c.expediente, s.nombre, $event)" />
                      </td>
                      <td class="main-cell">
                        {{ s.nombre }}
                        <div class="sub-cell">{{ s.categoria || 'Otros' }}@if (s.agregadoPor) { · agregado por {{ s.agregadoPor }}@if (s.fechaAgregado) { · {{ s.fechaAgregado }} } }</div>
                      </td>
                      <td>
                        @if (s.codigoSoftware; as cod) {
                          <select class="control" [disabled]="c.estado === 'Completada'"
                            (change)="seleccionarVersionSoftware(c, s.nombre, $event)">
                            <option value="" [selected]="!s.version">Seleccione versión…</option>
                            @for (v of versionesDe(cod); track v) {
                              <option [value]="v" [selected]="s.version === v">{{ v }}</option>
                            }
                          </select>
                          @if (s.versionVigente && s.version && s.version !== s.versionVigente) {
                            <div class="sub-cell">Versión vigente del catálogo: {{ s.versionVigente }}</div>
                          }
                        } @else {
                          <span class="mono">{{ s.version }}</span>
                        }
                      </td>
                      <td>
                        {{ s.motivo || '—' }}
                        @if (s.observacion) { <div class="sub-cell" style="max-width: 240px;">{{ s.observacion }}</div> }
                      </td>
                      <td><ui-badge [estado]="s.estado" /></td>
                      <td style="text-align:right;">
                        @if (c.estado !== 'Completada' && s.codigoSoftware) {
                          <button class="btn btn-ghost btn-sm" (click)="quitar(c, s)">Quitar</button>
                        } @else { <span class="muted">—</span> }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <div class="alert">
                <span class="alert-ico">i</span>
                <span>
                  <b>Aún no se ha agregado software adicional.</b> El F0302 no exige una lista fija:
                  agregue desde el <b>Catálogo de Software</b> únicamente lo que necesite el usuario final
                  según su requerimiento. El software ya instalado en la Preparación F0288 aparece arriba, bloqueado.
                </span>
              </div>
            }
          </div>
        </div>

        <!-- Configuración general del equipo: actividades de Soporte, no software de catálogo -->
        <div class="card mb-2">
          <div class="card-head">
            <div>
              <h2>Configuración general del equipo</h2>
              <p class="sub">Actividades de configuración de usuario y de red; no son software del catálogo</p>
            </div>
          </div>
          <div class="card-body table-wrap">
            <table class="tbl">
              <thead><tr><th style="width:44px;"></th><th>Actividad</th><th>Referencia</th><th>Evidencia</th><th>Estado</th></tr></thead>
              @for (cat of categoriasSoftware(c); track cat) {
                <tbody>
                  <tr class="cat-row">
                    <td colspan="5">
                      {{ cat }}
                      <!-- «Seleccionar todo» solo aparece si la categoría tiene ítems simples: los
                           controles especiales se deciden de a uno y la acción en bloque no los toca. -->
                      @if (data.categoriaAdmiteSeleccionarTodo(c, cat)) {
                        <label class="sec-selall" (click)="$event.stopPropagation()">
                          <input type="checkbox" [checked]="estadoSelAllCat(c, cat) === 'todos'"
                            [indeterminate]="estadoSelAllCat(c, cat) === 'parcial'"
                            [disabled]="c.estado === 'Completada'"
                            (change)="toggleCategoria(c, cat, $event)" /> Seleccionar todo
                        </label>
                      } @else {
                        <span class="sec-nota">Control especial: se decide ítem por ítem</span>
                      }
                    </td>
                  </tr>
                  @for (s of itemsCategoria(c, cat); track s.nombre) {
                    <tr class="sw-row">
                      <td>
                        @if (!data.admiteNoAplicaF0302(s.nombre)) {
                          <input class="chk" type="checkbox" [checked]="s.estado === 'Realizado'"
                            [disabled]="c.estado === 'Completada'"
                            (change)="marcar(c.expediente, s.nombre, $event)" />
                        }
                      </td>
                      <td class="main-cell">
                        {{ s.nombre }}
                        @if (s.requiereEvidencia) {
                          <ui-help texto="Control de seguridad institucional: no se da por configurado sin captura. Marcarlo desde «Seleccionar todo» tampoco exime de adjuntarla." />
                        }
                        <!-- Agente DLP e Ingreso a dominio pueden no corresponder a un equipo:
                             se eligen entre tres estados, y «No aplica» exige motivo escrito. -->
                        @if (data.admiteNoAplicaF0302(s.nombre)) {
                          <div class="sub-cell">
                            @if (s.requiereEvidencia) {
                              Si está Realizado: imagen obligatoria. Si está No aplica: justificación obligatoria.
                            } @else {
                              Si está Realizado: validación normal. Si está No aplica: justificación obligatoria.
                            }
                          </div>
                          <div class="estados">
                            @for (op of estadosItem; track op) {
                              <label class="radio-line">
                                <input type="radio" [name]="'st-' + s.nombre" [value]="op"
                                  [checked]="s.estado === op" [disabled]="c.estado === 'Completada'"
                                  (change)="cambiarEstado(c.expediente, s.nombre, op)" />
                                {{ op }}
                              </label>
                            }
                          </div>
                          @if (s.estado === 'No aplica') {
                            <div class="just-box">
                              <label>Justificación de No aplica <span class="req">*</span></label>
                              <textarea class="control" rows="2"
                                [placeholder]="placeholderJustificacion(s.nombre)"
                                [ngModel]="justificacionDe(c, s.nombre)"
                                (ngModelChange)="setJustificacion(c.expediente, s.nombre, $event)"
                                [disabled]="c.estado === 'Completada'"></textarea>
                              @if (c.estado !== 'Completada') {
                                <div class="sug-just">
                                  <span class="hint">Motivos frecuentes (escriba o confirme el suyo):</span>
                                  @for (j of data.justificacionesSugeridasF0302(s.nombre); track j) {
                                    <button type="button" class="chip chip-btn"
                                      (click)="usarSugerencia(c.expediente, s.nombre, j)">{{ j }}</button>
                                  }
                                </div>
                              }
                              @if (!justificacionDe(c, s.nombre).trim()) {
                                <span class="i-falta">{{ data.mensajeJustificacionNoAplica(s.nombre) }}</span>
                              }
                            </div>
                          }
                        }
                      </td>
                      <td><span class="mono">{{ s.version }}</span></td>
                      <td>
                        @if (s.estado === 'No aplica') {
                          <span class="muted">No requiere evidencia</span>
                        } @else if (s.evidencia) {
                          <span class="chip">{{ s.evidencia }}</span>
                          @if (evidenciaDe(c, s.nombre); as ev) {
                            <div class="sub-cell">{{ ev.tipo }} · {{ ev.cargadaPor }} · {{ ev.fecha }} · {{ ev.formulario }}</div>
                          }
                        } @else if (s.requiereEvidencia && s.estado === 'Realizado' && c.estado !== 'Completada') {
                          <span class="chip">Requiere evidencia</span>
                          <div class="cap-row">
                            <input type="file" hidden #cap accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                              (change)="subirCaptura(c, s.nombre, cap)" />
                            <button class="btn btn-outline btn-sm" (click)="cap.click()">
                              <ui-icon name="image" [size]="14" /> Adjuntar imagen
                            </button>
                          </div>
                          <span class="hint">Imagen obligatoria (PNG, JPG, JPEG o WEBP): sin ella no se puede finalizar el F0302 ni generar el documento.</span>
                        } @else if (s.requiereEvidencia) {
                          <span class="i-falta">Imagen obligatoria al marcarlo</span>
                        } @else { <span class="muted">—</span> }
                      </td>
                      <td><ui-badge [estado]="s.estado" /></td>
                    </tr>
                  }
                </tbody>
              }
            </table>
          </div>
          <!-- Las credenciales de SISSOR no se muestran aquí en ninguna forma. Salieron del
               checklist por no ser una actividad, y tampoco vuelven como bloque de referencia: el
               nombre del equipo tiene su propia sección más abajo y el resto de los datos del
               usuario ya viven en el expediente. -->
        </div>

        <!-- Imágenes de evidencia: aquí solo se listan. La única que el F0302 exige se adjunta
             desde su propio ítem del checklist, el Agente DLP. -->
        <div class="card card-pad mb-2">
          <ui-evidencias titulo="Evidencias de la Configuración F0302"
            [lista]="data.evid.de('Configuración F0302', c.expediente)"
            [editable]="c.estado !== 'Completada' && c.estado !== 'Cerrada' && c.estado !== 'Con falla'"
            [puedeAdjuntar]="false"
            nota="Evidencia requerida: Agente DLP."
            (eliminar)="quitarEvidencia(c, $event)"
            (visualizar)="verEvidencia(c, $event)"
            (error)="toast.error('No se pudo adjuntar la imagen', $event)" />
        </div>

        <!-- Nombre del equipo: dato obligatorio del expediente. La reserva de IP NO se captura
             aquí: se pregunta en el modal previo al envío del formulario de conformidad. -->
        <div class="card mb-2">
          <div class="card-head">
            <div>
              <h3>
                Nombre del equipo
                <ui-help texto="El nombre del equipo lo digita el Técnico de Soporte y es obligatorio para finalizar el F0302: aparece en el documento generado, en el expediente único, en el historial técnico, en la trazabilidad y en el formulario de conformidad del usuario final." />
              </h3>
              <p class="sub">Dato del expediente; la reserva de IP se pregunta al enviar el formulario de conformidad</p>
            </div>
            <ui-badge [estado]="c.datos.nombrePC ? 'Registrado' : 'Pendiente'" />
          </div>
          <div class="card-body">
            @if (c.estado === 'Completada') {
              <dl class="dl">
                <dt>Nombre del equipo</dt><dd class="mono">{{ c.datos.nombrePC || 'Sin registrar' }}</dd>
                <!-- La reserva solo se muestra una vez registrada desde el modal: antes no existe. -->
                @if (c.datos.requiereReservaIP) {
                  <dt>Reserva de IP</dt><dd>{{ c.datos.requiereReservaIP }}</dd>
                  <dt>IP reservada</dt><dd class="mono">{{ data.textoIPReservada(c) }}</dd>
                  @if (c.datos.requiereReservaIP === 'Sí') {
                    <dt>MAC del equipo</dt><dd class="mono">{{ c.datos.macEquipo || 'Sin registrar' }}</dd>
                    <dt>Solicitud de reserva de IP</dt><dd>{{ data.textoEstadoSolicitudIP(c) }}</dd>
                    @if (c.datos.fechaSolicitudIP) {
                      <dt>Correo simulado a Servidores</dt><dd>Enviado el {{ c.datos.fechaSolicitudIP }}</dd>
                    }
                  } @else {
                    <dt>Justificación de no reserva</dt><dd>{{ c.datos.justificacionSinReservaIP || 'Sin registrar' }}</dd>
                  }
                  @if (c.datos.ipValidadaPor) {
                    <dt>Validada por</dt><dd>{{ c.datos.ipValidadaPor }} · {{ c.datos.ipValidadaEl }}</dd>
                  }
                }
              </dl>
              @if (!c.datos.requiereReservaIP) {
                <span class="hint">La reserva de IP no es requisito del cierre: se pregunta y se valida al enviar el formulario de conformidad.</span>
              }
            } @else {
              <div class="field">
                <label>Nombre del equipo <span class="req">*</span></label>
                <input class="control mono" [ngModel]="nombrePC()" (ngModelChange)="nombrePC.set($event)"
                  placeholder="DT-KRIVAS-045" (keyup.enter)="guardarNombre(c)" />
                @if (!nombrePC().trim()) {
                  <span class="hint">Obligatorio. Use la convención de la unidad: DT-KRIVAS-045, LAP-MHERNANDEZ-012, CPU-FALVARADO-003.</span>
                } @else {
                  <span class="hint">Quedará en el F0302 generado, el expediente único, el historial técnico, la trazabilidad y el formulario de conformidad.</span>
                }
              </div>
              <div class="row mt-2" style="justify-content: flex-end;">
                <button class="btn btn-outline btn-sm" (click)="guardarNombre(c)">Guardar nombre del equipo</button>
              </div>
            }
          </div>
        </div>

        <!-- Evidencias y firmas -->
        <div class="grid grid-2 mb-2">
          <div class="card">
            <div class="card-head">
              <h3>
                Evidencias técnicas complementarias
                <ui-help texto="La evidencia no reemplaza el checklist; solo respalda ítems técnicos específicos." />
              </h3>
            </div>
            <div class="card-body">
              @for (e of c.evidencias; track e.nombre) {
                <div class="row-between" style="padding: 7px 0; border-bottom: 1px dashed var(--line);">
                  <span class="small" style="font-weight:500; color: var(--navy-900);">
                    {{ e.nombre }}
                    @if (e.archivo) {
                      <div class="sub-cell mono">{{ e.archivo }}</div>
                      <div class="sub-cell">{{ e.tipo }} · {{ e.cargadaPor }} · {{ e.fecha }} · {{ e.formulario }}</div>
                    }
                  </span>
                  <ui-badge [estado]="e.estado" />
                </div>
              }
            </div>
          </div>
          <div class="card">
            <div class="card-head"><h3>Firmas registradas</h3></div>
            <div class="card-body">
              <div class="firmas" style="grid-template-columns: 1fr;">
                <div class="firma">
                  <span class="f-sello">{{ iniciales(c.firmas.preparo.quien) }}</span>
                  <div style="flex:1;">
                    <div class="small" style="font-weight:700; color: var(--navy-900);">Preparó (F0288)</div>
                    <div class="small muted">{{ c.firmas.preparo.quien }}</div>
                    @if (c.firmas.preparo.estado === 'Firmado' && c.firmas.preparo.fecha) {
                      <div class="small muted mono">Firmado el {{ c.firmas.preparo.fecha }}@if (c.firmas.preparo.hora) { · {{ c.firmas.preparo.hora }} }</div>
                    }
                  </div>
                  <ui-badge [estado]="c.firmas.preparo.estado" />
                </div>
                <div class="firma">
                  <span class="f-sello">{{ iniciales(c.firmas.configuro.quien) }}</span>
                  <div style="flex:1;">
                    <div class="small" style="font-weight:700; color: var(--navy-900);">Configuró / instaló (F0302)</div>
                    <div class="small muted">{{ c.firmas.configuro.quien }}</div>
                    @if (c.firmas.configuro.estado === 'Firmado' && c.firmas.configuro.fecha) {
                      <div class="small muted mono">Firmado electrónicamente el {{ c.firmas.configuro.fecha }}@if (c.firmas.configuro.hora) { · {{ c.firmas.configuro.hora }} }</div>
                    }
                  </div>
                  <ui-badge [estado]="c.firmas.configuro.estado" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Cierre técnico: complejidad y observaciones (obligatorio al finalizar) -->
        @if (c.estado !== 'Completada') {
          <div class="card mb-2">
            <div class="card-head">
              <div>
                <h3>
                  Cierre de la configuración: complejidad y observaciones
                  <ui-help texto="Al finalizar la configuración se registra el nivel de complejidad y si hubo complejidad. Con «Sí», el detalle es obligatorio; con «No», puede dejar una observación opcional." />
                </h3>
                <p class="sub">Se solicita al finalizar; queda en el historial técnico y en la trazabilidad</p>
              </div>
            </div>
            <div class="card-body">
              <div class="grid grid-2">
                <div class="field">
                  <label>Nivel de complejidad de configuración <span class="req">*</span></label>
                  <select class="control" [(ngModel)]="cNivel">
                    <option value="Sin complejidad">Sin complejidad</option>
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                  </select>
                </div>
                <div class="field">
                  <label>¿Hubo complejidad durante la configuración? <span class="req">*</span></label>
                  <div class="radio-line" style="padding-top: 8px;">
                    <label><input type="radio" name="khubo" [checked]="cHubo() === 'Sí'" (change)="cHubo.set('Sí')" /> Sí</label>
                    <label><input type="radio" name="khubo" [checked]="cHubo() === 'No'" (change)="cHubo.set('No')" /> No</label>
                  </div>
                </div>
              </div>
              @if (cHubo() === 'Sí') {
                <div class="field">
                  <label>Detalle de complejidad <span class="req">*</span></label>
                  <textarea class="control" rows="2" [(ngModel)]="cDetalle"
                    placeholder="Ej.: Se presentaron problemas de conexión al dominio; se requirió reinstalar software institucional…"></textarea>
                </div>
              } @else if (cHubo() === 'No') {
                <div class="field">
                  <label>Observación técnica (opcional)</label>
                  <textarea class="control" rows="2" [(ngModel)]="cObs"
                    placeholder="Observaciones del cierre de la configuración (opcional)…"></textarea>
                </div>
              } @else {
                <span class="hint">Responda Sí o No. Con «Sí» el detalle de complejidad es obligatorio; con «No» la observación es opcional.</span>
              }
            </div>
          </div>
        }

        <!-- Reportar falla durante la configuración: el checklist se adapta al tipo de falla -->
        @if (enCurso(c)) {
          <div class="card mb-2" style="border-left: 4px solid var(--danger, #c0392b);">
            <div class="card-head">
              <div>
                <h3>
                  ¿Se detectó una falla durante la configuración?
                  <ui-help texto="El checklist se adapta al tipo de falla: no todas devuelven el equipo a Preparación F0288. La falla se registra como intento F0302 y como incidencia del mismo Expediente técnico; nunca se crea uno nuevo." />
                </h3>
                <p class="sub">El intento F0302 se conserva y la incidencia queda en el mismo Expediente técnico</p>
              </div>
              <button class="btn btn-outline btn-sm" (click)="fallaAbierto.set(!fallaAbierto())">
                @if (fallaAbierto()) { Cancelar } @else { <ui-icon name="alert" [size]="14" /> Reportar falla en la configuración }
              </button>
            </div>
            @if (fallaAbierto()) {
              <div class="card-body">
                <div class="grid grid-2">
                  <div class="field">
                    <label>Tipo de falla <span class="req">*</span></label>
                    <select class="control" [ngModel]="fTipo()" (ngModelChange)="cambiarTipoFalla($event)">
                      @for (t of tiposFalla; track t) { <option [value]="t">{{ t }}</option> }
                    </select>
                    <span class="hint">{{ notaFalla() }}</span>
                  </div>
                  <!-- La imagen de la falla es obligatoria: de una falla salen un reproceso o la
                       sustitución del equipo, y ninguno de los dos debería apoyarse solo en un texto. -->
                  <div class="field">
                    <label>Evidencia de la falla <span class="req">*</span></label>
                    <input type="file" hidden #fimg accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                      (change)="subirEvidenciaFalla(fimg)" />
                    <div class="row">
                      <button class="btn btn-outline btn-sm" (click)="fimg.click()">
                        <ui-icon name="image" [size]="15" /> Subir imagen
                      </button>
                      @if (fEvid()) {
                        <button class="btn btn-ghost btn-sm" (click)="quitarEvidenciaFalla()">Eliminar</button>
                      }
                    </div>
                    <span class="hint">Formatos permitidos: PNG, JPG, JPEG o WEBP.</span>
                    <span class="hint">Evidencia obligatoria para registrar la falla. La imagen respalda la
                      incidencia detectada durante la Configuración F0302.</span>
                  </div>
                </div>
                @if (fEvidImagen(); as img) {
                  <div class="row" style="align-items: flex-start; gap: 12px;">
                    <img class="falla-thumb" [src]="img" alt="Vista previa de la evidencia de la falla"
                      (click)="verEvidenciaFalla.set(true)" />
                    <dl class="dl">
                      <dt>Archivo</dt><dd class="mono">{{ fEvid() }}</dd>
                      <dt>Tipo de evidencia</dt><dd>{{ data.TIPO_EVIDENCIA_FALLA }}</dd>
                      <dt>Tipo de falla seleccionado</dt><dd>{{ fTipo() }} · {{ data.etiquetaEvidenciaFalla(fTipo()) }}</dd>
                      <dt>Fecha y hora</dt><dd>{{ fEvidSello() }}</dd>
                      <dt>Técnico</dt><dd>{{ usuarioActual }}</dd>
                    </dl>
                    <div class="row">
                      <button class="btn btn-ghost btn-sm" (click)="verEvidenciaFalla.set(true)">Ver imagen</button>
                      <button class="btn btn-ghost btn-sm" (click)="quitarEvidenciaFalla()">Eliminar</button>
                    </div>
                  </div>
                }

                <!-- Checklist dinámico: solo los campos del tipo seleccionado -->
                @if (pide('componenteAfectado')) {
                  <div class="field">
                    <label>Componente afectado <span class="req">*</span></label>
                    <select class="control" [ngModel]="fDetalle().componenteAfectado ?? ''" (ngModelChange)="setDetalle('componenteAfectado', $event)">
                      <option value="">Seleccione…</option>
                      @for (x of data.componentesFalla; track x) { <option [value]="x">{{ x }}</option> }
                    </select>
                  </div>
                }
                @if (pide('tipoDisco')) {
                  <div class="grid grid-2">
                    <div class="field">
                      <label>Tipo de disco <span class="req">*</span></label>
                      <select class="control" [ngModel]="fDetalle().tipoDisco ?? ''" (ngModelChange)="setDetalle('tipoDisco', $event)">
                        <option value="">Seleccione…</option>
                        @for (x of data.tiposDisco; track x) { <option [value]="x">{{ x }}</option> }
                      </select>
                    </div>
                    <div class="field">
                      <label>Serie del disco (si aplica)</label>
                      <input class="control" [ngModel]="fDetalle().serieDisco ?? ''" (ngModelChange)="setDetalle('serieDisco', $event)" />
                    </div>
                  </div>
                }
                @if (pide('capacidadRam')) {
                  <div class="field">
                    <label>Capacidad de RAM instalada <span class="req">*</span></label>
                    <input class="control" [ngModel]="fDetalle().capacidadRam ?? ''" (ngModelChange)="setDetalle('capacidadRam', $event)" placeholder="p. ej. 8 GB" />
                  </div>
                }
                @if (pide('sintoma')) {
                  <div class="field">
                    <label>Síntoma detectado <span class="req">*</span></label>
                    <select class="control" [ngModel]="fDetalle().sintoma ?? ''" (ngModelChange)="setDetalle('sintoma', $event)">
                      <option value="">Seleccione…</option>
                      @for (x of (fTipo() === 'Falla de disco' ? data.sintomasDisco : data.sintomasMemoria); track x) {
                        <option [value]="x">{{ x }}</option>
                      }
                    </select>
                  </div>
                }
                @if (pide('tipoProblemaSO')) {
                  <div class="grid grid-2">
                    <div class="field">
                      <label>Tipo de problema <span class="req">*</span></label>
                      <select class="control" [ngModel]="fDetalle().tipoProblemaSO ?? ''" (ngModelChange)="setDetalle('tipoProblemaSO', $event)">
                        <option value="">Seleccione…</option>
                        @for (x of data.problemasSO; track x) { <option [value]="x">{{ x }}</option> }
                      </select>
                    </div>
                    <div class="field">
                      <label>¿Requiere reinstalación o reparación base? <span class="req">*</span></label>
                      <div class="radio-line" style="padding-top: 8px;">
                        <label><input type="radio" name="freinst" [checked]="fDetalle().requiereReinstalacion === 'Sí'" (change)="setDetalle('requiereReinstalacion', 'Sí')" /> Sí</label>
                        <label><input type="radio" name="freinst" [checked]="fDetalle().requiereReinstalacion === 'No'" (change)="setDetalle('requiereReinstalacion', 'No')" /> No</label>
                      </div>
                      <span class="hint">Con «Sí» la falla pasa a reproceso F0288; con «No» se corrige en este mismo F0302.</span>
                    </div>
                  </div>
                }
                @if (pide('tipoProblemaRed')) {
                  <div class="grid grid-2">
                    <div class="field">
                      <label>Tipo de problema de red <span class="req">*</span></label>
                      <select class="control" [ngModel]="fDetalle().tipoProblemaRed ?? ''" (ngModelChange)="setDetalle('tipoProblemaRed', $event)">
                        <option value="">Seleccione…</option>
                        @for (x of data.problemasRed; track x) { <option [value]="x">{{ x }}</option> }
                      </select>
                    </div>
                    <div class="field">
                      <label>MAC del equipo <span class="req">*</span></label>
                      <input class="control" [ngModel]="fDetalle().mac ?? ''" (ngModelChange)="setDetalle('mac', $event)" placeholder="00:1A:2B:3C:4D:5E" />
                      <span class="hint">Tomada del registro institucional del equipo: {{ macSugerida(c) || 'no registrada' }}</span>
                    </div>
                  </div>
                  <div class="grid grid-2">
                    <div class="field">
                      <label>IP actual (si aplica)</label>
                      <input class="control" [ngModel]="fDetalle().ipActual ?? ''" (ngModelChange)="setDetalle('ipActual', $event)" placeholder="192.168.10.45" />
                    </div>
                    <div class="field">
                      <label>Punto de red (si aplica)</label>
                      <input class="control" [ngModel]="fDetalle().puntoRed ?? ''" (ngModelChange)="setDetalle('puntoRed', $event)" placeholder="p. ej. PR-2-14" />
                    </div>
                  </div>
                  <div class="field">
                    <label>¿Requiere revisión física por Hardware? <span class="req">*</span></label>
                    <div class="radio-line" style="padding-top: 8px;">
                      <label><input type="radio" name="frevfis" [checked]="fDetalle().requiereRevisionFisica === 'Sí'" (change)="setDetalle('requiereRevisionFisica', 'Sí')" /> Sí</label>
                      <label><input type="radio" name="frevfis" [checked]="fDetalle().requiereRevisionFisica === 'No'" (change)="setDetalle('requiereRevisionFisica', 'No')" /> No</label>
                    </div>
                    <span class="hint">Solo con «Sí» el problema de red pasa a reproceso F0288; por defecto se atiende en este F0302.</span>
                  </div>
                }
                @if (pide('usuarioCuenta')) {
                  <div class="grid grid-2">
                    <div class="field">
                      <label>Usuario o cuenta utilizada <span class="req">*</span></label>
                      <input class="control" [ngModel]="fDetalle().usuarioCuenta ?? ''" (ngModelChange)="setDetalle('usuarioCuenta', $event)" />
                    </div>
                    <div class="field">
                      <label>Nombre del equipo <span class="req">*</span></label>
                      <input class="control" [ngModel]="fDetalle().nombreEquipo ?? ''" (ngModelChange)="setDetalle('nombreEquipo', $event)" [placeholder]="c.datos.nombrePC || 'Nombre del equipo…'" />
                    </div>
                  </div>
                  <div class="field">
                    <label>Mensaje de error <span class="req">*</span></label>
                    <textarea class="control" rows="2" [ngModel]="fDetalle().mensajeError ?? ''" (ngModelChange)="setDetalle('mensajeError', $event)" placeholder="Mensaje mostrado al intentar ingresar al dominio…"></textarea>
                  </div>
                }
                @if (pide('accesorio')) {
                  <div class="grid grid-2">
                    <div class="field">
                      <label>Accesorio faltante <span class="req">*</span></label>
                      <select class="control" [ngModel]="fDetalle().accesorio ?? ''" (ngModelChange)="setDetalle('accesorio', $event)">
                        <option value="">Seleccione…</option>
                        @for (x of data.accesoriosFalla; track x) { <option [value]="x">{{ x }}</option> }
                      </select>
                    </div>
                    <div class="field">
                      <label>Número de inventario esperado (si aplica)</label>
                      <input class="control" [ngModel]="fDetalle().inventarioEsperado ?? ''" (ngModelChange)="setDetalle('inventarioEsperado', $event)" placeholder="2201-00-101-0000-01" />
                    </div>
                  </div>
                }
                @if (pide('etapaDeteccion')) {
                  <div class="grid grid-2">
                    <div class="field">
                      <label>Etapa donde se detectó la falla <span class="req">*</span></label>
                      <input class="control" [ngModel]="fDetalle().etapaDeteccion ?? ''" (ngModelChange)="setDetalle('etapaDeteccion', $event)" placeholder="p. ej. Instalación de software / Ingreso a dominio" />
                    </div>
                    <div class="field">
                      <label>Acción requerida <span class="req">*</span></label>
                      <select class="control" [ngModel]="fDetalle().accionRequerida ?? ''" (ngModelChange)="setDetalle('accionRequerida', $event)">
                        <option value="">Seleccione…</option>
                        @for (x of data.accionesRequeridasFalla; track x) { <option [value]="x">{{ x }}</option> }
                      </select>
                      <span class="hint">«Reproceso F0288» y «Revisar por Hardware» devuelven el equipo a preparación; las otras dos se resuelven aquí.</span>
                    </div>
                  </div>
                }

                <div class="field">
                  <label>
                    {{ fTipo() === 'Configuración incompleta por falla previa' ? 'Descripción de la configuración incompleta' : 'Descripción / observación de la falla' }}
                    <span class="req">*</span>
                  </label>
                  <textarea class="control" rows="2" [ngModel]="fDesc()" (ngModelChange)="fDesc.set($event)" placeholder="Describa la falla detectada (obligatorio)…"></textarea>
                </div>
                @if (pide('observacionHardware')) {
                  <div class="field">
                    <label>Observación para Hardware</label>
                    <textarea class="control" rows="2" [ngModel]="fDetalle().observacionHardware ?? ''" (ngModelChange)="setDetalle('observacionHardware', $event)" placeholder="Lo que Hardware debe revisar o corregir…"></textarea>
                  </div>
                }

                <!-- La decisión sale del checklist, no de una segunda pregunta: para el sistema
                     operativo, «¿requiere reinstalación o reparación base?» ya la resuelve. Se
                     muestra como resultado y solo se abre si el técnico quiere apartarse. -->
                <div class="field">
                  <label>
                    Decisión de corrección
                    <ui-help texto="Reproceso, no «nueva preparación»: la corrección se registra dentro del mismo Expediente técnico. Solo un ciclo nuevo —reingreso tras descargo, sustitución del equipo o autorización de jefatura— justifica un Expediente técnico nuevo." />
                  </label>
                  @if (decisionAutomatica()) {
                    <div class="row" style="padding-top: 4px;">
                      <b class="small">{{ fReproceso() ? 'Reproceso F0288' : 'Corrección en el mismo F0302' }}</b>
                      <span class="chip">Determinado por el sistema</span>
                      <button class="btn btn-ghost btn-sm" (click)="decisionManual.set(true)">Cambiar la decisión</button>
                    </div>
                    <span class="hint">Sale de lo que ya respondió en el checklist de la falla; no hace falta contestarlo dos veces.</span>
                  } @else {
                    <div class="radio-line" style="padding-top: 8px;">
                      <label><input type="radio" name="freproc" [checked]="fReproceso()" (change)="fReproceso.set(true)" /> Reproceso F0288</label>
                      <label><input type="radio" name="freproc" [checked]="!fReproceso()" (change)="fReproceso.set(false)" /> Corregir en el mismo F0302</label>
                      <span class="chip">Sugerencia del sistema: {{ sugerencia() }}</span>
                    </div>
                    @if (sugerencia() === 'Depende') {
                      <span class="hint">Para este tipo de falla el sistema no decide solo: responda la pregunta del checklist o justifique su elección.</span>
                    }
                  }
                </div>
                @if (cambioSugerencia() || (sugerencia() === 'Depende' && fReproceso())) {
                  <div class="field">
                    <label>Justificación <span class="req">*</span></label>
                    <textarea class="control" rows="2" [ngModel]="fJust()" (ngModelChange)="fJust.set($event)"
                      [placeholder]="cambioSugerencia() ? 'Explique por qué se aparta de la sugerencia del sistema…' : 'Explique por qué el equipo debe volver a preparación…'"></textarea>
                  </div>
                }

                <div class="field">
                  <label>Observación técnica (opcional)</label>
                  <textarea class="control" rows="2" [ngModel]="fObs()" (ngModelChange)="fObs.set($event)"></textarea>
                </div>
                <div class="alert warn">
                  <span class="alert-ico">!</span>
                  @if (fReproceso()) {
                    <span>El F0302 quedará <b>Con falla</b> (se conserva como intento) y se abrirá un <b>reproceso de Preparación F0288</b> sobre el mismo Expediente técnico: <b>no se crea un Expediente técnico nuevo</b>. No se habilitará la aceptación ni la garantía.</span>
                  } @else {
                    <span>El F0302 quedará <b>Con falla</b> (se conserva como intento) y la incidencia se atenderá como <b>corrección de Soporte en este mismo F0302</b>: el equipo <b>no</b> regresa a Preparación F0288. No se habilitará la aceptación ni la garantía.</span>
                  }
                </div>
                <div class="row" style="justify-content: flex-end;">
                  <button class="btn btn-primary" (click)="reportarFalla(c.expediente)">
                    {{ fReproceso() ? 'Registrar falla y enviar a reproceso F0288' : 'Registrar falla y corregir en F0302' }}
                  </button>
                </div>
              </div>
            }
          </div>
        }

        <!-- Acciones -->
        <div class="card">
          <div class="card-body row-between">
            <p class="small muted" style="max-width: 56ch;">
              Al finalizar se detiene el cronómetro, se registran el tiempo total, la complejidad y la firma del
              técnico, y el F0302 queda anexado al expediente único. Luego podrá enviarse el formulario de
              conformidad al correo institucional del usuario final.
            </p>
            <div class="row">
              <button class="btn btn-primary btn-lg" [disabled]="c.estado === 'Completada'" (click)="generar(c.expediente)">
                {{ c.estado === 'Completada' ? 'F0302 generado' : 'Finalizar configuración y generar F0302' }}
              </button>
              <button class="btn btn-gold btn-lg" [disabled]="c.estado !== 'Completada' || yaEnviada(c.expediente)" (click)="abrirConfirmacion(c)">
                {{ yaEnviada(c.expediente) ? 'Formulario de conformidad enviado' : 'Enviar formulario de conformidad' }}
              </button>
            </div>
          </div>
        </div>
        } @else if (c.estado === 'Con falla') {
          <div class="card mt-2">
            <div class="card-head">
              <div>
                <h3>Configuración F0302 con falla</h3>
                <p class="sub">Intento conservado en el historial · la incidencia vive en el mismo Expediente técnico</p>
              </div>
              @if (c.falla; as f) { <ui-badge [estado]="data.textoEstadoIncidencia(f.estadoIncidencia)" /> }
            </div>
            <div class="card-body">
              @if (c.falla; as f) {
                <dl class="dl">
                  <dt>Tipo de falla</dt><dd>{{ f.tipo }}</dd>
                  <dt>Descripción de la falla</dt><dd>{{ f.descripcion }}</dd>
                  @if (data.resumenDetalleFalla(f); as det) {
                    <dt>Checklist de la falla</dt><dd>{{ det }}</dd>
                  }
                  <dt>Tiempo trabajado del F0302</dt><dd>{{ data.formatoDuracion(f.tiempoMinutos) || 'menos de 1 min' }}</dd>
                  <dt>Técnico que reportó</dt><dd>{{ f.tecnicoReporta }}</dd>
                  <dt>Fecha y hora</dt><dd>{{ f.fecha }} · {{ f.hora }}</dd>
                  <dt>¿Requiere revisión de Hardware?</dt><dd>{{ f.requiereHardware ? 'Sí' : 'No' }}</dd>
                  <dt>Decisión de corrección</dt>
                  <dd>
                    {{ f.requiereReprocesoF0288 ? 'Reproceso F0288' : 'Corrección en el mismo F0302' }}
                    <span class="chip">Sugerencia del sistema: {{ f.sugerencia }}</span>
                  </dd>
                  @if (f.justificacionReproceso) { <dt>Justificación</dt><dd>{{ f.justificacionReproceso }}</dd> }
                  <dt>Expediente técnico</dt>
                  <dd>{{ expTecnico(c) || '—' }} <span class="chip">Se conserva: no se creó uno nuevo</span></dd>
                  @if (reprocesoDeFalla(c); as r) {
                    <dt>Reproceso F0288</dt>
                    <dd>{{ r.id }} · {{ r.estado }} · atiende {{ r.unidadAtiende }}
                      <div class="sub-cell">Técnico asignado: {{ r.tecnicoAsignado || 'Sin asignar' }} · prioridad {{ r.prioridad }}</div>
                      @if (r.correccionTecnica) { <div class="sub-cell">Corrección: {{ r.correccionTecnica }}</div> }
                      @if (r.firma; as fr) { <div class="sub-cell">Firmado por {{ fr.nombre }} — {{ fr.cargo }} · {{ fr.fecha }} {{ fr.hora }} · Resultado: {{ r.resultado }}</div> }
                      @else if (r.estado === 'Finalizado') { <div class="sub-cell">Pendiente de firma del Técnico de Hardware</div> }
                    </dd>
                  }
                  @if (f.correccionSoporte; as k) {
                    <dt>Corrección de Soporte</dt>
                    <dd>{{ k.descripcion }} <div class="sub-cell">{{ k.tecnico }} · {{ k.fecha }} {{ k.hora }}</div></dd>
                  }
                  @if (f.observacionTecnica) { <dt>Observación técnica</dt><dd>{{ f.observacionTecnica }}</dd> }
                  @if (f.evidencia) { <dt>Evidencia</dt><dd>{{ f.evidencia }}</dd> }
                </dl>

                <!-- Las imágenes de la incidencia: la de la falla y, cuando se corrige aquí, la
                     de la corrección. Solo se listan: se adjuntan desde sus formularios. -->
                <ui-evidencias titulo="Imágenes de la incidencia F0302"
                  [lista]="data.evid.de('Configuración F0302', c.expediente)"
                  (visualizar)="verEvidencia(c, $event)" />

                <div class="alert warn mt-2">
                  <span class="alert-ico">!</span>
                  @if (f.requiereReprocesoF0288) {
                    <span>No se habilita la aceptación ni la garantía mientras la incidencia siga abierta. La corrección se registra como <b>reproceso F0288</b> en <b>Preparación técnica</b>, dentro del Expediente técnico <b>{{ expTecnico(c) || '—' }}</b>.</span>
                  } @else {
                    <span>No se habilita la aceptación ni la garantía mientras la incidencia siga abierta. Esta falla se resuelve <b>aquí mismo</b>: registre la corrección de Soporte y reintente el F0302.</span>
                  }
                </div>

                <!-- Botones según el caso (spec §13) -->
                <div class="row mt-2" style="flex-wrap: wrap;">
                  <a class="btn btn-outline btn-sm" routerLink="/trazabilidad" [queryParams]="{ inventario: c.datos.inventario }">Ver trazabilidad</a>
                  @if (f.requiereReprocesoF0288) {
                    <a class="btn btn-outline btn-sm" routerLink="/reprocesos-f0288">
                      {{ f.estadoIncidencia === 'LISTO_PARA_REINTENTO_F0302' ? 'Ver reproceso F0288' : 'Ver reproceso F0288 en Hardware' }}
                    </a>
                  } @else if (f.estadoIncidencia !== 'LISTO_PARA_REINTENTO_F0302') {
                    <button class="btn btn-outline btn-sm" (click)="correccionAbierta.set(!correccionAbierta())">
                      {{ correccionAbierta() ? 'Cancelar' : 'Registrar corrección' }}
                    </button>
                  }
                  <button class="btn btn-primary btn-sm" [disabled]="!equipoPreparado(c)" (click)="nuevaConfig(c.expediente)">
                    Reintentar F0302
                  </button>
                  <button class="btn btn-outline btn-sm" (click)="sustitucionAbierta.set(!sustitucionAbierta())">
                    {{ sustitucionAbierta() ? 'Cancelar sustitución' : 'Solicitar sustitución de equipo' }}
                  </button>
                </div>
                @if (!equipoPreparado(c)) {
                  <span class="hint">
                    «Reintentar F0302» se habilita cuando la incidencia queda resuelta
                    ({{ f.requiereReprocesoF0288 ? 'reproceso F0288 finalizado y equipo devuelto a configuración' : 'corrección de Soporte registrada' }}).
                  </span>
                }

                @if (correccionAbierta()) {
                  <!-- Quién responde por la corrección, con la carga de Soporte a la vista -->
                  <div class="field mt-2">
                    <label>Técnico responsable de la corrección F0302 <span class="req">*</span></label>
                    <input class="control" readonly [value]="responsableCorreccion() || 'Sin asignar'" />
                    @if (cargaResponsable(); as k) {
                      <div class="small muted mt-1">{{ k.carga }} · {{ k.total }} procesos activos · {{ data.resumenCargaSoporte(k) }}.</div>
                      @if (k.nivel === 'Alta') {
                        <div class="alert warn mt-1">
                          <span class="alert-ico">!</span>
                          <span>{{ data.MSG_CARGA_ALTA }}</span>
                        </div>
                      }
                    }
                    @if (puedeElegirResponsable()) {
                      <button type="button" class="btn btn-outline btn-sm mt-1" (click)="buscarResponsable.set(c.expediente)">
                        {{ responsableCorreccion() ? 'Cambiar técnico' : 'Seleccionar Técnico de Soporte' }}
                      </button>
                    } @else {
                      <span class="hint">La corrección queda a su nombre. El Encargado de Soporte puede asignarla a otro técnico.</span>
                    }
                  </div>
                  <div class="field mt-2">
                    <label>Corrección realizada por Soporte <span class="req">*</span></label>
                    <textarea class="control" rows="2" [ngModel]="cDesc()" (ngModelChange)="cDesc.set($event)"
                      placeholder="Describa lo que se corrigió en el F0302 (obligatorio)…"></textarea>
                  </div>
                  <!-- Otra imagen que la de la falla: aquella muestra el problema y esta que se resolvió -->
                  <div class="field">
                    <label>Evidencia de la corrección <span class="req">*</span></label>
                    <input type="file" hidden #cimg accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                      (change)="subirEvidenciaCorreccion(cimg)" />
                    <div class="row">
                      <button class="btn btn-outline btn-sm" (click)="cimg.click()">
                        <ui-icon name="image" [size]="15" /> Subir imagen
                      </button>
                      @if (cEvidImagen(); as img) {
                        <img class="falla-thumb" [src]="img" alt="Vista previa de la evidencia de la corrección" />
                        <span class="small mono">{{ cEvid() }}</span>
                        <span class="chip">Corrección realizada</span>
                        <button class="btn btn-ghost btn-sm" (click)="quitarEvidenciaCorreccion()">Eliminar</button>
                      }
                    </div>
                    <span class="hint">Formatos permitidos: PNG, JPG, JPEG o WEBP. La imagen respalda la corrección
                      hecha en este mismo F0302.</span>
                  </div>
                  <div class="row mt-1" style="justify-content: flex-end;">
                    <button class="btn btn-primary btn-sm" (click)="registrarCorreccion(c.expediente)">Guardar corrección y continuar configuración</button>
                  </div>
                }
                @if (sustitucionAbierta()) {
                  <div class="field mt-2">
                    <label>Motivo de la sustitución del equipo <span class="req">*</span></label>
                    <textarea class="control" rows="2" [ngModel]="sMotivo()" (ngModelChange)="sMotivo.set($event)"
                      placeholder="Por qué este equipo ya no puede entregarse…"></textarea>
                    <span class="hint">La sustitución marca el equipo como no apto para entrega. Es el único desenlace de una falla en el que corresponde evaluar un Expediente técnico nuevo, porque el equipo que lo recibiría es otro.</span>
                    <div class="row mt-1" style="justify-content: flex-end;">
                      <button class="btn btn-primary btn-sm" (click)="solicitarSustitucion(c.expediente)">Solicitar sustitución</button>
                    </div>
                  </div>
                }
              }
            </div>
          </div>
        } @else if (c.estado === 'Cerrada') {
          <div class="card mt-2 card-pad">
            <div class="alert warn">
              <span class="alert-ico">!</span>
              <span><b>Esta configuración quedó cerrada</b> por el descargo del equipo: es solo consulta y ya no puede reutilizarse para una nueva configuración.</span>
            </div>
          </div>
        } @else {
          <div class="card mt-2 card-pad">
            <div class="alert">
              <span class="alert-ico">i</span>
              <span><b>Debe iniciar la configuración para habilitar el checklist F0302.</b> El checklist de software, las evidencias, las firmas y el cierre se muestran una vez que presiona «Iniciar configuración».</span>
            </div>
          </div>
        }
      } @else {
        <div class="card card-pad">
          <p class="muted">
            @if (auth.esTecnico() && data.configuracionesVisibles().length === 0) {
              No tiene configuraciones F0302 asignadas. Cuando el Encargado de Soporte cree un Expediente único y lo asigne a usted, aparecerá aquí.
            } @else {
              Seleccione un proceso en configuración.
            }
          </p>
        </div>
      }

      <!-- Confirmación previa al envío del formulario de conformidad: nombre del equipo e IP reservada -->
      @if (confirmarAbierto()) {
        @if (conf(); as c) {
          <ui-modal titulo="Validación previa al envío del formulario de conformidad"
            sub="El usuario final verá estos datos en el formulario que recibirá por correo" (cerrar)="confirmarAbierto.set(false)">
            <dl class="dl">
              <dt>Nombre del equipo</dt><dd class="mono">{{ c.datos.nombrePC || 'Sin registrar' }}</dd>
              <dt>Usuario final</dt><dd>{{ c.datos.asignadoA }} — {{ c.datos.unidad }}</dd>
              <dt>Inventario</dt><dd class="mono">{{ c.datos.inventario }}</dd>
            </dl>
            <hr class="divider" />
            <div class="field">
              <label>¿El equipo requiere reserva de IP? <span class="req">*</span></label>
              <div class="radio-line" style="padding-top: 8px;">
                <label><input type="radio" name="kipconf" [checked]="ipReq() === 'Sí'" (change)="ipReq.set('Sí')" /> Sí</label>
                <label><input type="radio" name="kipconf" [checked]="ipReq() === 'No'" (change)="cambiarNoRequiere()" /> No</label>
              </div>
            </div>
            @if (ipReq() === 'Sí') {
              <div class="field">
                <label>IP reservada <span class="req">*</span></label>
                <input class="control mono" [ngModel]="ipVal()" (ngModelChange)="ipVal.set($event)" placeholder="192.168.10.45" />
                @if (ipVal().trim() && !data.ipValida(ipVal())) {
                  <span class="hint" style="color: var(--danger, #c0392b);">La IP ingresada no tiene un formato válido.</span>
                } @else {
                  <span class="hint">Formato xxx.xxx.xxx.xxx (por ejemplo 192.168.10.45).</span>
                }
              </div>
              <div class="field">
                <label>MAC del equipo <span class="req">*</span></label>
                <input class="control mono" [ngModel]="macVal()" (ngModelChange)="macVal.set($event)" placeholder="00:1A:2B:3C:4D:5E" />
                @if (macVal().trim() && !data.macValida(macVal())) {
                  <span class="hint" style="color: var(--danger, #c0392b);">La MAC del equipo no tiene un formato válido.</span>
                } @else if (origenMac(c)) {
                  <span class="hint">Tomada del {{ origenMac(c).toLowerCase() }}. Puede corregirla si no coincide con el equipo.</span>
                } @else {
                  <span class="hint">El equipo no trae MAC registrada: digítela. Formatos 00:1A:2B:3C:4D:5E o 00-1A-2B-3C-4D-5E.</span>
                }
              </div>

              <!-- Solicitud simulada al Departamento de Servidores: sin ella no se envía el formulario -->
              <div class="card mt-2">
                <div class="card-head">
                  <div>
                    <h3>Solicitud de reserva de IP</h3>
                    <p class="sub">Correo simulado al Departamento de Servidores; el prototipo no envía correo real</p>
                  </div>
                  <ui-badge [estado]="data.textoEstadoSolicitudIP(c)" />
                </div>
                <div class="card-body">
                  @if (correo(c); as m) {
                    <dl class="dl">
                      <dt>Para</dt><dd>{{ m.para }}</dd>
                      <dt>Asunto</dt><dd>{{ m.asunto }}</dd>
                    </dl>
                    <pre class="correo-sim">{{ m.cuerpo }}</pre>
                  } @else {
                    <span class="hint">Complete la IP y la MAC con formato válido para armar la solicitud.</span>
                  }
                  @if (c.datos.estadoSolicitudIP === 'Enviada') {
                    <div class="alert ok mt-2">
                      <span class="alert-ico"><ui-icon name="check" [size]="13" /></span>
                      <span>Solicitud enviada de forma simulada el {{ c.datos.fechaSolicitudIP }}. Ya puede enviar el formulario de conformidad.</span>
                    </div>
                  } @else {
                    <button class="btn btn-primary mt-2" (click)="enviarSolicitudIP(c)">Enviar solicitud de reserva de IP</button>
                    <span class="hint">Obligatoria: el formulario de conformidad no se envía mientras la solicitud esté pendiente.</span>
                  }
                </div>
              </div>
            } @else if (ipReq() === 'No') {
              <div class="field">
                <label>Justificación de no reserva de IP <span class="req">*</span></label>
                <textarea class="control" rows="2" [ngModel]="justVal()" (ngModelChange)="justVal.set($event)"
                  placeholder="Indique por qué el equipo no requiere reserva de IP."></textarea>
                @if (!justVal().trim()) {
                  <span class="hint">Indique por qué el equipo no requiere reserva de IP.</span>
                } @else {
                  <span class="hint">Quedará en el F0302, el expediente único, el formulario de conformidad y la trazabilidad.</span>
                }
              </div>
              <div class="row" style="flex-wrap: wrap; gap: 6px;">
                @for (j of data.justificacionesSinReservaIP; track j) {
                  <button class="chip chip-btn" (click)="justVal.set(j)">{{ j }}</button>
                }
              </div>
              <span class="hint">El formulario registrará «Reserva de IP: No · IP reservada: No aplica · Solicitud de reserva de IP: No aplica».</span>
            } @else {
              <span class="hint">Responda Sí o No. Con «Sí» se piden la IP y la MAC del equipo; con «No», la justificación.</span>
            }
            <div class="alert mt-2">
              <span class="alert-ico">i</span>
              <span>
                Mientras falte este dato el flujo no avanza: no se envía el formulario, no inicia el conteo
                de aceptación, no se habilita la respuesta del usuario final ni la garantía.
              </span>
            </div>
            <div class="row" style="justify-content: flex-end;">
              <button class="btn btn-outline" (click)="confirmarAbierto.set(false)">Cancelar</button>
              <button class="btn btn-gold" (click)="confirmarEnvio(c)">Confirmar y enviar formulario</button>
            </div>
          </ui-modal>
        }
      }

      <!-- Selector del Catálogo de Software permitido: solo software activo de F0302 o Ambas etapas -->
      @if (catalogoAbierto()) {
        @if (conf(); as c) {
          <ui-modal titulo="Agregar software desde el Catálogo de Software"
            sub="Solo software activo aplicable a Configuración F0302 o Ambas etapas" (cerrar)="catalogoAbierto.set(false)">
            <div class="field">
              <label>Buscar en el catálogo</label>
              <input class="control" [ngModel]="filtroCat()" (ngModelChange)="filtroCat.set($event)"
                placeholder="Nombre, categoría, versión vigente, etapa o estado…" />
              <span class="hint">El software exclusivo de la Preparación F0288 y el software inactivo no se ofrecen en la Configuración F0302.</span>
            </div>
            <div class="table-wrap" style="max-height: 280px; overflow-y: auto;">
              <table class="tbl">
                <thead><tr><th>Software</th><th>Categoría</th><th>Versión vigente</th><th>Etapa</th><th>Estado</th><th style="text-align:right;"></th></tr></thead>
                <tbody>
                  @for (s of catalogoFiltrado(); track s.codigo) {
                    <tr [class.sel]="swSel()?.codigo === s.codigo">
                      <td class="main-cell">{{ s.nombre }}<div class="sub-cell mono">{{ s.codigo }}</div></td>
                      <td>{{ s.categoria }}</td>
                      <td class="mono">{{ s.versionVigente }}</td>
                      <td>{{ s.etapa }}</td>
                      <td>
                        <ui-badge [estado]="situacion(c, s.codigo)" />
                      </td>
                      <td style="text-align:right;">
                        <button class="btn btn-outline btn-sm" (click)="elegirSoftware(s)">
                          {{ swSel()?.codigo === s.codigo ? 'Seleccionado' : 'Seleccionar' }}
                        </button>
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6" class="muted" style="text-align:center; padding: 18px;">Ningún software del catálogo coincide con la búsqueda.</td></tr>
                  }
                </tbody>
              </table>
            </div>

            @if (swSel(); as sw) {
              <div class="card-pad mt-2" style="background: var(--surface-2); border-radius: var(--r-md);">
                <div class="sec-title" style="margin-bottom: 8px;">{{ sw.nombre }} · {{ sw.categoria }}</div>
                <div class="grid grid-2">
                  <div class="field">
                    <label>Versión <span class="req">*</span></label>
                    <select class="control" [ngModel]="swVersion()" (ngModelChange)="swVersion.set($event)">
                      <option value="">Seleccione versión…</option>
                      @for (v of sw.versionesPermitidas; track v) { <option [value]="v">{{ v }}</option> }
                    </select>
                    <span class="hint">Solo versiones permitidas por el catálogo; la vigente es {{ sw.versionVigente }}. No se escriben versiones a mano.</span>
                  </div>
                  <div class="field">
                    <label>Motivo / requerimiento asociado <span class="req">*</span></label>
                    <select class="control" [ngModel]="swMotivo()" (ngModelChange)="swMotivo.set($event)">
                      <option value="">Seleccione el motivo…</option>
                      @for (m of data.motivosSoftwareF0302; track m) { <option [value]="m">{{ m }}</option> }
                    </select>
                  </div>
                </div>
                <div class="field">
                  <label>Observación @if (swMotivo() === 'Otro') { <span class="req">*</span> }</label>
                  <textarea class="control" rows="2" [ngModel]="swObs()" (ngModelChange)="swObs.set($event)"
                    placeholder="Detalle del requerimiento que justifica este software…"></textarea>
                  @if (swMotivo() === 'Otro') {
                    <span class="hint">Con el motivo «Otro», la observación es obligatoria.</span>
                  }
                </div>
                @if (situacion(c, sw.codigo) !== 'Disponible') {
                  <div class="alert warn">
                    <span class="alert-ico">!</span>
                    <span>
                      @if (situacion(c, sw.codigo) === 'Instalado en F0288') {
                        Este software ya fue instalado durante la Preparación F0288 y no puede agregarse nuevamente.
                      } @else {
                        Este software ya fue agregado a la Configuración F0302.
                      }
                    </span>
                  </div>
                }
                <div class="row" style="justify-content: flex-end;">
                  <button class="btn btn-primary" (click)="agregarSoftware(c)">Agregar al checklist F0302</button>
                </div>
              </div>
            } @else {
              <span class="hint">Seleccione un software del catálogo para elegir su versión y el motivo del requerimiento.</span>
            }
          </ui-modal>
        }
      }

      @if (verEvidenciaFalla() && fEvidImagen()) {
        <ui-modal [titulo]="'Evidencia de la falla · ' + data.etiquetaEvidenciaFalla(fTipo())"
          [sub]="fEvid()" (cerrar)="verEvidenciaFalla.set(false)">
          <img class="falla-grande" [src]="fEvidImagen()" [alt]="fEvid()" />
          <dl class="dl mt-2">
            <dt>Archivo</dt><dd class="mono">{{ fEvid() }}</dd>
            <dt>Tipo de evidencia</dt><dd>{{ data.TIPO_EVIDENCIA_FALLA }}</dd>
            <dt>Tipo de falla seleccionado</dt><dd>{{ fTipo() }}</dd>
            <dt>Fecha y hora</dt><dd>{{ fEvidSello() }}</dd>
            <dt>Técnico</dt><dd>{{ usuarioActual }}</dd>
          </dl>
        </ui-modal>
      }

      @if (buscarAbierto()) {
        <app-buscar-expediente-unico
          [filas]="opciones()"
          titulo="Buscar configuración F0302"
          sub="Busque por expediente único, año, solicitud, inventario, usuario final o técnico asignado"
          (seleccionar)="elegir($event)"
          (cerrar)="buscarAbierto.set(false)" />
      }

      <!-- Técnico responsable de la corrección F0302, con la carga de Soporte a la vista -->
      @if (buscarResponsable(); as id) {
        <app-selector-soporte
          titulo="Técnico responsable de Corrección F0302"
          sub="Se mostrará la carga laboral de cada técnico antes de asignarle la corrección"
          nota="La corrección se registra dentro del mismo F0302 y queda a nombre de este técnico. Una carga alta no impide asignársela."
          vacio="No hay Técnicos de Soporte activos registrados."
          [tecnicos]="data.tecnicosSoporteParaProceso(id)"
          [seleccionado]="responsableCorreccion()"
          [expediente]="id"
          (seleccion)="responsableCorreccion.set($event.nombreRol); buscarResponsable.set('')"
          (cerrar)="buscarResponsable.set('')" />
      }
    </div>
  `
})
export class ConfiguracionComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);
  protected readonly toast = inject(ToastService);
  private readonly casoActivo = inject(CasoActivoService);

  protected seleccion = signal('');
  protected buscarAbierto = signal(false);

  // ---------- Cronómetro y cierre técnico ----------
  /** Tic de 1 s para refrescar el cronómetro visible mientras la configuración está en proceso. */
  private readonly tick = signal(Date.now());
  protected cNivel = signal<NivelComplejidad>('Sin complejidad');
  protected cHubo = signal<RespuestaSiNo>('');
  protected cDetalle = signal('');
  protected cObs = signal('');

  // ---------- Nombre del equipo y reserva de IP ----------
  protected nombrePC = signal('');
  protected ipReq = signal<RespuestaSiNo>('');
  protected ipVal = signal('');
  protected macVal = signal('');
  protected justVal = signal('');
  /** Últimos datos cargados en el formulario; evita repisar lo que el técnico está escribiendo. */
  private ipCargada = '';
  /** Modal de confirmación previo al envío del formulario de conformidad. */
  protected confirmarAbierto = signal(false);

  // ---------- Reporte de falla F0302 con checklist dinámico ----------
  protected readonly tiposFalla: TipoFallaF0302[] = [
    'Falla física del equipo', 'Falla de disco', 'Falla de memoria', 'Problema de sistema operativo',
    'Problema de red', 'No permite ingreso a dominio', 'Accesorio faltante',
    'Configuración incompleta por falla previa', 'Otro'
  ];
  protected fallaAbierto = signal(false);
  protected fTipo = signal<TipoFallaF0302>('Falla física del equipo');
  protected fDesc = signal('');
  protected fObs = signal('');
  /** Imagen de la falla: nombre, contenido reducido y sello de carga. Sin ella no se registra. */
  protected fEvid = signal('');
  protected fEvidImagen = signal('');
  protected fEvidSello = signal('');
  protected verEvidenciaFalla = signal(false);
  /** El técnico pidió apartarse de la decisión que dedujo el sistema. */
  protected decisionManual = signal(false);
  /** Campos del checklist dinámico: solo se envían los que el tipo seleccionado pide. */
  protected fDetalle = signal<DetalleFallaF0302>({});
  /** Decisión de corrección: reproceso F0288 (true) o corregir en el mismo F0302 (false). */
  protected fReproceso = signal(true);
  protected fJust = signal('');
  /** Corrección de Soporte y reproceso, en la vista del F0302 con falla. */
  protected correccionAbierta = signal(false);
  protected cDesc = signal('');
  protected cEvid = signal('');
  protected cEvidImagen = signal('');
  protected sustitucionAbierta = signal(false);
  protected sMotivo = signal('');

  // ---------- Técnico responsable de la corrección F0302 ----------
  /**
   * Un Técnico de Soporte corrige él mismo; el Encargado de Soporte y el Administrador reparten
   * viendo la carga de cada quien. Guarda el expediente cuyo buscador está abierto, no un
   * booleano, porque la lista de técnicos depende del proceso.
   */
  protected buscarResponsable = signal('');
  protected responsableCorreccion = signal(
    this.auth.usuario()?.clave === 'tec-soporte'
      ? `${this.auth.usuario()?.nombre} — ${this.auth.usuario()?.rol}`
      : '');
  protected readonly puedeElegirResponsable = computed(() => {
    const clave = this.auth.usuario()?.clave;
    return clave === 'enc-soporte' || clave === 'admin';
  });
  /** Carga del técnico elegido; se muestra junto al nombre sin reabrir el buscador. */
  protected cargaResponsable(): CargaSoporte | null {
    const t = this.responsableCorreccion();
    return t ? this.data.cargaSoporteDe(t) : null;
  }

  /** Lo que la matriz sugiere con lo que el técnico lleva contestado. */
  protected readonly sugerencia = computed(() => this.data.sugerenciaReproceso(this.fTipo(), this.fDetalle()));
  protected readonly notaFalla = computed(() => this.data.matrizFalla(this.fTipo()).nota);
  /** true cuando el técnico se aparta de la sugerencia: ahí la justificación es obligatoria. */
  protected readonly cambioSugerencia = computed(() => {
    const s = this.sugerencia();
    return s !== 'Depende' && s !== (this.fReproceso() ? 'Sí' : 'No');
  });
  /** El sistema ya dedujo la decisión y el técnico no ha pedido cambiarla: se muestra, no se pregunta. */
  protected readonly decisionAutomatica = computed(() => this.sugerencia() !== 'Depende' && !this.decisionManual());

  protected pide(campo: string): boolean {
    return this.data.fallaPideCampo(this.fTipo(), campo);
  }
  /** Escribe un campo del checklist dinámico sin perder los demás. */
  protected setDetalle(campo: keyof DetalleFallaF0302, valor: string): void {
    this.fDetalle.update((d) => ({ ...d, [campo]: valor }));
    // Las tres preguntas que resuelven un «Depende» mueven la sugerencia: se reajusta la respuesta
    // para que el técnico vea lo que el sistema propone y no lo que quedó de la pregunta anterior.
    if (campo === 'requiereReinstalacion' || campo === 'requiereRevisionFisica' || campo === 'accionRequerida') {
      const s = this.data.sugerenciaReproceso(this.fTipo(), this.fDetalle());
      if (s !== 'Depende') { this.fReproceso.set(s === 'Sí'); this.fJust.set(''); }
    }
  }
  /** Al cambiar el tipo de falla se reinicia el checklist y se toma la sugerencia del nuevo tipo. */
  protected cambiarTipoFalla(tipo: TipoFallaF0302): void {
    this.fTipo.set(tipo);
    this.fDetalle.set({});
    this.fJust.set('');
    this.decisionManual.set(false);
    const s = this.data.matrizFalla(tipo).sugerencia;
    this.fReproceso.set(s === 'Sí');
  }

  /**
   * Imagen de la falla. Se lee y se reduce aquí, pero no se guarda todavía: si el técnico cancela
   * el reporte, no debe quedar una evidencia suelta de una falla que nunca se registró.
   */
  protected async subirEvidenciaFalla(input: HTMLInputElement): Promise<void> {
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    if (!this.data.evid.formatoValido(archivo.name)) {
      this.quitarEvidenciaFalla();
      this.toast.error('Archivo no válido', this.data.evid.MSG_FORMATO);
      return;
    }
    try {
      const leida = await this.data.evid.leerImagen(archivo);
      this.fEvid.set(leida.archivo);
      this.fEvidImagen.set(leida.imagen);
      this.fEvidSello.set(this.data.selloAhora());
    } catch {
      this.quitarEvidenciaFalla();
      this.toast.error('Archivo no válido', this.data.evid.MSG_FORMATO);
    }
  }

  protected quitarEvidenciaFalla(): void {
    this.fEvid.set('');
    this.fEvidImagen.set('');
    this.fEvidSello.set('');
    this.verEvidenciaFalla.set(false);
  }

  /**
   * El equipo del proceso está nuevamente Preparado (F0288 vigente finalizado) y su incidencia de
   * configuración quedó resuelta: recién entonces se habilita el nuevo intento F0302. Ya no se
   * exige un reingreso a Hardware —la falla se atiende dentro del mismo Expediente técnico—, sino
   * que la corrección de Soporte o el reproceso F0288 se hayan completado de verdad.
   */
  protected equipoPreparado(c: ConfiguracionF0302): boolean {
    if (this.data.estadoPreparacionEquipo(c.datos.inventario) !== 'Preparado') return false;
    return (c.falla?.estadoIncidencia ?? 'LISTO_PARA_REINTENTO_F0302') === 'LISTO_PARA_REINTENTO_F0302';
  }
  protected reprocesoDeFalla(c: ConfiguracionF0302): ReprocesoF0288 | undefined {
    return c.falla?.reprocesoId ? this.data.reprocesoDe(c.falla.reprocesoId) : undefined;
  }
  /** Expediente técnico vigente del equipo: el mismo antes y después de la falla. */
  protected expTecnico(c: ConfiguracionF0302): string {
    return this.data.expTecnicoDeEquipo(c.datos.inventario)?.codigo ?? '';
  }

  constructor() {
    const intervalo = setInterval(() => this.tick.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(intervalo));
    // El formulario de reserva de IP se recarga al cambiar de proceso o cuando el dato guardado
    // cambia (al guardarlo, o al restablecer los datos de demostración).
    effect(() => {
      const c = this.conf();
      const clave = c
        ? `${c.expediente}·${c.datos.requiereReservaIP ?? ''}·${c.datos.ipReservada ?? ''}·${c.datos.nombrePC ?? ''}`
        : '';
      if (clave === this.ipCargada) return;
      this.ipCargada = clave;
      this.ipReq.set(c?.datos.requiereReservaIP ?? '');
      this.ipVal.set(c?.datos.ipReservada ?? '');
      this.macVal.set(c ? this.data.macSugeridaF0302(c.expediente) : '');
      this.justVal.set(c?.datos.justificacionSinReservaIP ?? '');
      this.nombrePC.set(c?.datos.nombrePC ?? '');
    });
  }

  /** «No requiere» limpia la IP y la MAC: lo que queda por registrar es la justificación. */
  protected cambiarNoRequiere(): void {
    this.ipReq.set('No');
    this.ipVal.set('');
  }

  /** De dónde salió la MAC que muestra el modal: del inventario institucional o digitada aquí. */
  /** MAC conocida del equipo, para acompañar el checklist de un problema de red. */
  protected macSugerida(c: ConfiguracionF0302): string {
    return this.data.macSugeridaF0302(c.expediente);
  }
  protected origenMac(c: ConfiguracionF0302): string {
    return this.data.origenMacF0302(c.expediente);
  }

  /** Vista previa del correo simulado con lo que el técnico está escribiendo (aún sin guardar). */
  protected correo(c: ConfiguracionF0302): SolicitudReservaIP | null {
    return this.data.solicitudReservaIP(c.expediente, this.ipVal(), this.macVal());
  }

  /**
   * Guarda la reserva y simula el envío del correo al Departamento de Servidores. Sin este envío
   * el formulario de conformidad no se habilita.
   */
  protected enviarSolicitudIP(c: ConfiguracionF0302): void {
    if (!this.guardarIP(c, true)) return;
    const u = this.auth.usuario();
    const r = this.data.registrarSolicitudReservaIP(c.expediente, `${u?.nombre} — ${u?.rol}`);
    if (typeof r === 'string') { this.toast.error('No se pudo enviar la solicitud de reserva', r); return; }
    this.toast.ok('Solicitud de reserva de IP enviada de forma simulada al Departamento de Servidores.',
      `IP ${r.ip} · MAC ${r.mac} · equipo ${r.nombreEquipo} (${r.inventario}). Quedó registrada en el expediente y en la trazabilidad; el prototipo no envía correo real.`);
  }

  /** Guarda el nombre del equipo digitado. Devuelve true si quedó registrado. */
  protected guardarNombre(c: ConfiguracionF0302, silencioso = false): boolean {
    const anterior = (c.datos.nombrePC ?? '').trim();
    const u = this.auth.usuario();
    const error = this.data.registrarNombreEquipo(c.expediente, `${u?.nombre} — ${u?.rol}`, this.nombrePC());
    if (error) {
      this.toast.error('No se puede registrar el nombre del equipo', error);
      return false;
    }
    if (silencioso) return true;
    const valor = this.nombrePC().trim();
    this.toast.ok(anterior && anterior !== valor ? 'Nombre del equipo actualizado' : 'Nombre del equipo registrado',
      `El equipo ${c.datos.inventario} quedó registrado como ${valor}; el dato viaja al F0302 generado, al expediente único, al historial técnico, a la trazabilidad y al formulario de conformidad.`);
    return true;
  }

  /** Guarda la reserva de IP en la configuración activa. Devuelve true si quedó registrada. */
  protected guardarIP(c: ConfiguracionF0302, silencioso = false): boolean {
    const anterior = c.datos.requiereReservaIP ?? '';
    const anteriorIP = (c.datos.ipReservada ?? '').trim();
    const u = this.auth.usuario();
    const error = this.data.registrarReservaIP(c.expediente, `${u?.nombre} — ${u?.rol}`,
      this.ipReq(), this.ipVal(), this.macVal(), this.justVal());
    if (error) {
      this.toast.error('No se puede registrar la reserva de IP', error);
      return false;
    }
    if (silencioso) return true;
    if (this.ipReq() === 'No') {
      this.toast.ok('Reserva de IP registrada', `El equipo ${c.datos.nombrePC} no requiere reserva de IP; el expediente registrará «IP reservada: No aplica» con la justificación del técnico.`);
    } else if (anterior === 'Sí' && anteriorIP && anteriorIP !== this.ipVal().trim()) {
      this.toast.ok('IP reservada actualizada', `La reserva del equipo ${c.datos.nombrePC} pasó de ${anteriorIP} a ${this.ipVal().trim()}; el cambio quedó en la trazabilidad.`);
    } else {
      this.toast.ok('IP reservada registrada', `${this.ipVal().trim()} quedó reservada para ${c.datos.nombrePC}; es dato del expediente y aparecerá en el F0302 generado.`);
    }
    return true;
  }

  protected enCurso(c: ConfiguracionF0302): boolean {
    return !!c.cronometro && c.cronometro.duracionMinutos === null && c.estado !== 'Completada';
  }

  /** Tiempo transcurrido HH:MM:SS del cronómetro en curso (se actualiza cada segundo). */
  protected transcurrido(c: Cronometro): string {
    this.tick();
    const inicio = new Date(`${c.fechaInicio}T${c.horaInicio}`).getTime();
    const seg = isNaN(inicio) ? 0 : Math.max(0, Math.floor((Date.now() - inicio) / 1000));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(Math.floor(seg / 3600))}:${pad(Math.floor((seg % 3600) / 60))}:${pad(seg % 60)}`;
  }

  /**
   * Expedientes con Técnico de Configuración designado cuya ejecución todavía no ha empezado. Un
   * Técnico de Soporte solo ve los suyos; los Encargados y el Administrador, todos.
   */
  protected readonly pendientesDeIniciar = computed(() => {
    const yo = this.auth.usuario()?.nombre ?? '';
    return this.data.expedientesUnicos().filter((x) => {
      if (x.fechaCierre || x.estado === 'Cerrado') return false;
      const ac = this.data.asignacionConfiguracionVigente(x.codigoUnico);
      if (!ac) return false;
      if (this.data.formsConfiguracionDe(x.codigoUnico).some((f) => f.estado === 'En proceso')) return false;
      return this.auth.esTecnico() ? ac.tecnico.includes(yo) : true;
    });
  });

  protected usuarioFinalDe(x: ExpedienteUnico): string {
    return this.data.asignaciones().find((a) => a.expedienteUnico === x.codigoUnico)?.usuarioFinal ?? '—';
  }
  protected tecnicoDesignadoDe(x: ExpedienteUnico): string {
    return this.data.asignacionConfiguracionVigente(x.codigoUnico)?.tecnico.split('—')[0].trim() ?? '—';
  }

  /** Abre la ejecución (FORM_CONFIGURACION) y con ella el checklist F0302. */
  protected iniciarTrabajo(codigoEu: string): void {
    const u = this.auth.usuario();
    const error = this.data.iniciarTrabajoConfiguracion(codigoEu, `${u?.nombre} — ${u?.rol}`);
    if (error) {
      this.toast.error('No se puede iniciar la configuración', error);
      return;
    }
    this.toast.ok('Configuración iniciada', `${codigoEu}: checklist F0302 disponible.`);
  }

  protected iniciar(c: ConfiguracionF0302): void {
    const u = this.auth.usuario();
    const error = this.data.iniciarConfiguracion(c.expediente, `${u?.nombre} — ${u?.rol}`);
    if (!error) {
      this.toast.ok('Cronómetro F0302 iniciado', 'Quedaron registrados la fecha, la hora y el técnico que inició; el evento se anotó en la trazabilidad.');
    } else {
      this.toast.error('No se puede iniciar la configuración', error);
    }
  }

  /** Catálogo de búsqueda: expedientes únicos con configuración F0302 visible (uno por proceso, aunque tenga varios F0302). */
  protected readonly opciones = computed<FilaExpedienteUnico[]>(() => {
    const vistos = new Set<string>();
    return this.data.configuracionesVisibles()
      .filter((c) => (vistos.has(c.expediente) ? false : (vistos.add(c.expediente), true)))
      .map((c) => this.data.expedienteUnicoDe(c.expediente))
      .filter((x): x is NonNullable<typeof x> => !!x)
      .map((x) => filaExpedienteUnico(this.data, x));
  });

  /**
   * Con un solo proceso disponible se carga automáticamente (aunque tenga varias configuraciones
   * F0302, p. ej. una con falla + la activa); con varios, se retoma el último caso activo si sigue
   * visible para el rol, o se requiere el modal «Buscar expediente». Siempre se prefiere la
   * configuración ACTIVA (la que no quedó «Con falla»).
   */
  protected readonly conf = computed(() => {
    const visibles = this.data.configuracionesVisibles();
    const activos = visibles.filter((c) => c.estado !== 'Con falla');
    const expedientes = new Set(visibles.map((c) => c.expediente));
    if (expedientes.size === 1) {
      const id = [...expedientes][0];
      return activos.find((c) => c.expediente === id) ?? visibles.find((c) => c.expediente === id);
    }
    const sel = this.seleccion() || this.casoActivo.expediente();
    return activos.find((c) => c.expediente === sel) ?? visibles.find((c) => c.expediente === sel);
  });

  protected elegir(id: string): void {
    this.seleccion.set(id);
    this.casoActivo.seleccionar(id);
    this.buscarAbierto.set(false);
  }

  protected especificaciones(id: string): string {
    const eq = this.data.equipoDeSolicitud(id);
    return eq ? `${eq.procesador} · ${eq.ram} · ${eq.disco}` : '—';
  }

  protected iniciales(quien: string): string {
    return quien.split('·')[0].trim().split(' ').map((w) => w[0]).join('').replace('.', '').slice(0, 3);
  }

  protected yaEnviada(id: string): boolean {
    const c = this.data.conformidades().find((x) => x.expediente === id);
    return !!c && c.estado !== 'No enviado';
  }

  protected marcar(id: string, nombre: string, ev: Event): void {
    const checked = (ev.target as HTMLInputElement).checked;
    this.data.marcarSoftwareF0302(id, nombre, checked ? 'Realizado' : 'Pendiente', this.quien());
  }

  // ---------- Ítems con «No aplica»: Agente DLP e Ingreso a dominio ----------
  /** Los tres estados que admiten esos dos ítems. El resto del checklist sigue con checkbox. */
  protected readonly estadosItem: ('Pendiente' | 'Realizado' | 'No aplica')[] =
    ['Pendiente', 'Realizado', 'No aplica'];

  protected cambiarEstado(id: string, nombre: string, estado: 'Pendiente' | 'Realizado' | 'No aplica'): void {
    this.data.marcarSoftwareF0302(id, nombre, estado, this.quien());
  }

  protected justificacionDe(c: ConfiguracionF0302, nombre: string): string {
    return this.data.softwareChecklistF0302(c).find((s) => s.nombre === nombre)?.justificacionNoAplica ?? '';
  }

  /**
   * Guarda el motivo mientras se escribe. Se llama al servicio en cada cambio —y no al salir del
   * campo— porque el estado vive en el servicio: mantener una copia local del texto abriría la
   * puerta a finalizar con una justificación que la pantalla muestra pero el expediente no tiene.
   */
  protected setJustificacion(id: string, nombre: string, texto: string): void {
    const error = this.data.justificarNoAplicaF0302(id, nombre, texto, this.quien());
    // Un texto vacío no es un error que reportar: es el estado inicial del campo.
    if (error && texto.trim()) this.toast.error('No se pudo guardar la justificación', error);
  }

  /** Un motivo sugerido se copia al campo; no se guarda solo, el técnico lo confirma o lo edita. */
  protected usarSugerencia(id: string, nombre: string, texto: string): void {
    this.setJustificacion(id, nombre, texto);
  }

  protected placeholderJustificacion(nombre: string): string {
    return this.data.admiteNoAplicaF0302(nombre) && /dominio/i.test(nombre)
      ? 'Escriba el motivo por el cual no aplica el ingreso a dominio…'
      : 'Escriba el motivo por el cual no aplica…';
  }

  private quien(): string {
    const u = this.auth.usuario();
    return `${u?.nombre} — ${u?.rol}`;
  }

  // ---------- Configuración general: agrupada por categoría, con «Seleccionar todo» ----------
  // Solo agrupa las actividades generales (dominio, credenciales, DLP). El software adicional
  // tiene su propia sección: se agrega desde el catálogo y cada ítem lleva su motivo.

  /** Categorías presentes en las actividades de configuración del proceso, en el orden en que aparecen. */
  protected categoriasSoftware(c: ConfiguracionF0302): string[] {
    const vistas: string[] = [];
    for (const s of this.data.itemsConfiguracionF0302(c)) {
      const cat = s.categoria || 'Otros';
      if (!vistas.includes(cat)) vistas.push(cat);
    }
    return vistas;
  }
  protected itemsCategoria(c: ConfiguracionF0302, categoria: string): SoftwareF0302[] {
    return this.data.itemsConfiguracionF0302(c).filter((s) => (s.categoria || 'Otros') === categoria);
  }
  protected estadoSelAllCat(c: ConfiguracionF0302, categoria: string): 'todos' | 'ninguno' | 'parcial' {
    // Los controles especiales no cuentan: el «Seleccionar todo» no los toca, así que incluirlos
    // dejaría la casilla en indeterminado para siempre aunque todo lo demás esté hecho.
    const items = this.itemsCategoria(c, categoria)
      .filter((s) => !this.data.esControlEspecialF0302(s.nombre));
    if (!items.length) return 'ninguno';
    const marcados = items.filter((s) => s.estado === 'Realizado').length;
    if (marcados === 0) return 'ninguno';
    if (marcados === items.length) return 'todos';
    return 'parcial';
  }
  protected toggleCategoria(c: ConfiguracionF0302, categoria: string, ev: Event): void {
    const u = this.auth.usuario();
    const marcar = (ev.target as HTMLInputElement).checked;
    this.data.marcarCategoriaSoftwareF0302(c.expediente, categoria, marcar ? 'Realizado' : 'Pendiente', `${u?.nombre} — ${u?.rol}`);
  }
  protected versionesDe(codigoSoftware: string): string[] {
    return this.data.softwareCatalogoDe(codigoSoftware)?.versionesPermitidas ?? [];
  }

  // ---------- Captura de evidencia de los ítems que la exigen (Agente DLP) ----------
  protected evidenciaDe(c: ConfiguracionF0302, nombre: string) {
    return c.evidencias.find((e) => e.item === nombre && e.archivo);
  }

  /**
   * Captura del ítem que la exige (Agente DLP). Desde la regla global es una imagen: se lee, se
   * reduce y queda con el resto de las evidencias del proceso.
   */
  protected async subirCaptura(c: ConfiguracionF0302, nombre: string, input: HTMLInputElement): Promise<void> {
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    const u = this.auth.usuario();
    try {
      const leida = await this.data.evid.leerImagen(archivo);
      // El tipo sale del ítem, igual que en el bloque de evidencias: nadie tiene que elegirlo.
      const error = this.data.registrarEvidenciaSoftwareF0302(c.expediente, nombre, leida.archivo,
        `${u?.nombre} — ${u?.rol}`, this.data.evid.tipoDeContexto('Configuración F0302', nombre), leida.imagen);
      if (error) { this.toast.error('No se puede registrar la captura', error); return; }
      this.toast.ok('Captura registrada', `La imagen de ${nombre} quedó anexada al F0302 y a la trazabilidad del equipo.`);
    } catch {
      this.toast.error('Archivo no válido', this.data.evid.MSG_FORMATO);
    }
  }

  protected quitarEvidencia(c: ConfiguracionF0302, archivo: string): void {
    const u = this.auth.usuario();
    const error = this.data.eliminarEvidencia('Configuración F0302', c.expediente, c.expediente,
      archivo, `${u?.nombre} — ${u?.rol}`);
    if (error) { this.toast.error('No se pudo eliminar la imagen', error); return; }
    this.toast.ok('Imagen de evidencia eliminada', `${archivo} ya no respalda esta configuración.`);
  }

  protected verEvidencia(c: ConfiguracionF0302, archivo: string): void {
    const u = this.auth.usuario();
    this.data.registrarConsultaEvidenciaTecnica('Configuración F0302', c.expediente, c.expediente,
      archivo, `${u?.nombre} — ${u?.rol}`);
  }
  protected seleccionarVersionSoftware(c: ConfiguracionF0302, nombre: string, ev: Event): void {
    const version = (ev.target as HTMLSelectElement).value;
    const u = this.auth.usuario();
    this.data.seleccionarVersionSoftwareF0302(c.expediente, nombre, version, `${u?.nombre} — ${u?.rol}`);
  }

  // ---------- Software heredado del F0288 y software adicional del F0302 ----------
  protected catalogoAbierto = signal(false);
  protected filtroCat = signal('');
  protected swSel = signal<SoftwareCatalogo | null>(null);
  protected swVersion = signal('');
  protected swMotivo = signal<MotivoSoftwareF0302 | ''>('');
  protected swObs = signal('');

  /** Software que la Preparación F0288 ya instaló: se muestra bloqueado. `undefined` si no hay ninguno. */
  protected readonly heredado = computed(() => {
    const c = this.conf();
    const lista = c ? this.data.softwareHeredadoF0288(c.expediente) : [];
    return lista.length > 0 ? lista : undefined;
  });

  /** Software adicional agregado en la configuración; `undefined` mientras no se haya agregado ninguno. */
  protected adicional(c: ConfiguracionF0302): SoftwareF0302[] | undefined {
    const lista = this.data.softwareAdicionalF0302(c);
    return lista.length > 0 ? lista : undefined;
  }

  /** Catálogo del selector, filtrado por nombre, categoría, versión, etapa o estado. */
  protected readonly catalogoFiltrado = computed(() => {
    const q = this.filtroCat().trim().toLowerCase();
    const lista = this.data.catalogoParaF0302();
    if (!q) return lista;
    return lista.filter((s) =>
      `${s.nombre} ${s.categoria} ${s.versionVigente} ${s.versionesPermitidas.join(' ')} ${s.etapa} ${s.activo ? 'activo' : 'inactivo'}`
        .toLowerCase().includes(q));
  });

  protected situacion(c: ConfiguracionF0302, codigo: string): string {
    return this.data.situacionSoftwareF0302(c.expediente, codigo);
  }

  protected abrirCatalogo(c: ConfiguracionF0302): void {
    this.catalogoAbierto.set(true);
    this.filtroCat.set('');
    this.swSel.set(null);
    this.swVersion.set('');
    this.swMotivo.set('');
    this.swObs.set('');
    const u = this.auth.usuario();
    this.data.registrarConsultaCatalogoF0302(c.expediente, `${u?.nombre} — ${u?.rol}`);
  }

  /** Al elegir un software se propone su versión vigente; el técnico puede cambiarla por otra permitida. */
  protected elegirSoftware(s: SoftwareCatalogo): void {
    this.swSel.set(s);
    this.swVersion.set(s.versionVigente);
  }

  protected agregarSoftware(c: ConfiguracionF0302): void {
    const sel = this.swSel();
    if (!sel) {
      this.toast.error('Seleccione un software', 'Elija primero un software del Catálogo de Software permitido.');
      return;
    }
    const u = this.auth.usuario();
    const error = this.data.agregarSoftwareF0302(c.expediente, {
      codigo: sel.codigo, version: this.swVersion(), motivo: this.swMotivo(), observacion: this.swObs()
    }, `${u?.nombre} — ${u?.rol}`);
    if (error) {
      this.toast.error('No se puede agregar el software', error);
      return;
    }
    this.toast.ok('Software agregado a la Configuración F0302',
      `${sel.nombre} ${this.swVersion()} quedó en el checklist con el motivo «${this.swMotivo()}». Márquelo cuando lo haya instalado.`);
    this.swSel.set(null);
    this.swVersion.set('');
    this.swMotivo.set('');
    this.swObs.set('');
  }

  protected quitar(c: ConfiguracionF0302, s: SoftwareF0302): void {
    const u = this.auth.usuario();
    const error = this.data.quitarSoftwareF0302(c.expediente, s.codigoSoftware ?? '', `${u?.nombre} — ${u?.rol}`);
    if (error) {
      this.toast.error('No se puede retirar el software', error);
      return;
    }
    this.toast.ok('Software retirado del checklist', `${s.nombre} ya no forma parte de la Configuración F0302.`);
  }

  protected generar(id: string): void {
    const u = this.auth.usuario();
    // Solo se guarda el nombre del equipo con lo que haya en pantalla, para que el técnico no quede
    // bloqueado por no haber presionado «Guardar». La reserva de IP NO se toca aquí: no es dato del
    // cierre, se pregunta al enviar el formulario de conformidad.
    const c = this.conf();
    if (c && c.expediente === id && !this.guardarNombre(c, true)) return;
    const error = this.data.cerrarConfiguracion(id, `${u?.nombre} — ${u?.rol}`, {
      nivel: this.cNivel(), hubo: this.cHubo(), detalle: this.cDetalle(), observacion: this.cObs()
    });
    if (!error) {
      const ip = this.conf()?.datos.requiereReservaIP
        ? `reserva de IP ya registrada (${this.data.textoIPReservada(this.conf())})`
        : 'la reserva de IP quedará pendiente hasta enviar el formulario de conformidad';
      this.toast.ok('Configuración F0302 finalizada',
        `Cronómetro detenido: tiempo total, complejidad y observación quedaron en el historial y en la trazabilidad, y ${ip}. El documento quedó firmado y anexado al expediente único.`);
      this.cHubo.set('');
      this.cDetalle.set('');
      this.cObs.set('');
      this.cNivel.set('Sin complejidad');
    } else {
      this.toast.error('No se puede finalizar la configuración', error);
    }
  }

  /**
   * Antes de enviar el formulario de conformidad se confirman el nombre del equipo y la reserva de
   * IP: son los datos del F0302 que el usuario final verá en el formulario y sin los cuales el
   * flujo no debe avanzar.
   */
  protected abrirConfirmacion(c: ConfiguracionF0302): void {
    this.nombrePC.set(c.datos.nombrePC ?? '');
    this.ipReq.set(c.datos.requiereReservaIP ?? '');
    this.ipVal.set(c.datos.ipReservada ?? '');
    // La MAC llega autocompletada desde el registro institucional del equipo cuando lo trae.
    this.macVal.set(this.data.macSugeridaF0302(c.expediente));
    this.justVal.set(c.datos.justificacionSinReservaIP ?? '');
    this.confirmarAbierto.set(true);
    const u = this.auth.usuario();
    this.data.registrarAperturaModalConformidad(c.expediente, `${u?.nombre} — ${u?.rol}`);
  }

  /** Guarda lo respondido en el modal y, solo si queda completo, envía el formulario. */
  protected confirmarEnvio(c: ConfiguracionF0302): void {
    if (!this.guardarIP(c, true)) return;
    if (!this.enviarConformidad(c.expediente)) return;
    this.confirmarAbierto.set(false);
  }

  /** Envía el formulario de conformidad. Devuelve false si una regla lo impidió. */
  protected enviarConformidad(id: string): boolean {
    const u = this.auth.usuario();
    const conf = this.data.enviarConformidad(id, `${u?.nombre} — ${u?.rol}`);
    if (typeof conf === 'string') {
      this.toast.error('No es posible enviar el formulario', conf);
      return false;
    }
    this.toast.ok('Formulario de conformidad enviado',
      `Se envió el enlace único al correo institucional ${conf.correo}, con el nombre del equipo ${conf.nombreEquipo} y la reserva de IP registrada.`);
    return true;
  }

  protected get usuarioActual(): string {
    const u = this.auth.usuario();
    return `${u?.nombre} — ${u?.rol}`;
  }

  protected reportarFalla(id: string): void {
    const reproceso = this.fReproceso();
    const error = this.data.reportarFallaF0302(id, {
      tipo: this.fTipo(), descripcion: this.fDesc(), requiereReprocesoF0288: reproceso,
      justificacionReproceso: this.fJust(), detalle: this.fDetalle(),
      observacionTecnica: this.fObs(), evidencia: this.fEvid(), evidenciaImagen: this.fEvidImagen()
    }, this.usuarioActual);
    if (error) { this.toast.error('No se puede reportar la falla', error); return; }
    this.fallaAbierto.set(false);
    this.fDesc.set(''); this.fObs.set(''); this.fJust.set('');
    this.quitarEvidenciaFalla();
    this.fDetalle.set({}); this.cambiarTipoFalla('Falla física del equipo');
    this.toast.ok('F0302 con falla registrado', reproceso
      ? 'Se abrió un reproceso de Preparación F0288 dentro del mismo Expediente técnico: no se creó uno nuevo. El intento F0302 se conserva en el historial.'
      : 'La falla se atiende como corrección de Soporte en el mismo F0302: el equipo no regresa a Preparación F0288. El intento F0302 se conserva en el historial.');
  }

  /** Imagen de la corrección de Soporte; se guarda al registrar la corrección, no antes. */
  protected async subirEvidenciaCorreccion(input: HTMLInputElement): Promise<void> {
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    if (!this.data.evid.formatoValido(archivo.name)) {
      this.quitarEvidenciaCorreccion();
      this.toast.error('Archivo no válido', this.data.evid.MSG_FORMATO);
      return;
    }
    try {
      const leida = await this.data.evid.leerImagen(archivo);
      this.cEvid.set(leida.archivo);
      this.cEvidImagen.set(leida.imagen);
    } catch {
      this.quitarEvidenciaCorreccion();
      this.toast.error('Archivo no válido', this.data.evid.MSG_FORMATO);
    }
  }

  protected quitarEvidenciaCorreccion(): void {
    this.cEvid.set('');
    this.cEvidImagen.set('');
  }

  protected registrarCorreccion(id: string): void {
    const responsable = this.responsableCorreccion();
    if (!responsable) {
      this.toast.warn('Falta el responsable', 'Seleccione el Técnico de Soporte responsable de la corrección F0302.');
      return;
    }
    const error = this.data.registrarCorreccionSoporte(id, responsable, this.cDesc(),
      this.cEvid(), this.cEvidImagen());
    if (error) { this.toast.error('No se pudo registrar la corrección', error); return; }
    // La carga queda registrada con la corrección ya hecha: aquí no se reparte trabajo futuro, se
    // deja constancia de con cuánta carga encima se atendió esta.
    this.data.registrarSeleccionSoporte(responsable, this.usuarioActual, {
      expediente: id, modulo: 'Corrección F0302',
      expedienteUnico: this.data.expedienteUnicoDe(id)?.codigoUnico
    });
    this.correccionAbierta.set(false);
    this.cDesc.set('');
    this.quitarEvidenciaCorreccion();
    this.toast.ok('Corrección de Soporte registrada', 'El proceso queda listo para el nuevo intento F0302, sobre el mismo Expediente técnico.');
  }

  protected solicitarSustitucion(id: string): void {
    const error = this.data.solicitarSustitucionEquipo(id, this.usuarioActual, this.sMotivo());
    if (error) { this.toast.error('No se pudo solicitar la sustitución', error); return; }
    this.sustitucionAbierta.set(false);
    this.sMotivo.set('');
    this.toast.ok('Sustitución de equipo solicitada',
      'El equipo queda marcado como no apto para entrega. El Expediente técnico del equipo sustituto se evalúa aparte: es el único caso en que corresponde crear uno nuevo.');
  }

  protected nuevaConfig(id: string): void {
    const r = this.data.nuevaConfiguracionF0302(id, this.usuarioActual);
    if (typeof r === 'string') { this.toast.error('No se puede iniciar un nuevo intento F0302', r); return; }
    this.seleccion.set(id);
    this.toast.ok('Nuevo intento F0302 iniciado', 'El F0302 con falla anterior se conserva en el historial. Inicie el cronómetro para comenzar.');
  }
}
