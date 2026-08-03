import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ConfiguracionF0302, Cronometro, MotivoSoftwareF0302, NivelComplejidad, RespuestaSiNo,
  SoftwareCatalogo, SoftwareF0302, TipoFallaF0302
} from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { CasoActivoService } from '../../core/services/caso-activo.service';
import { BadgeComponent, HelpTipComponent, ModalComponent } from '../../shared/ui';
import { BuscarExpedienteUnicoModalComponent, FilaExpedienteUnico, filaExpedienteUnico } from '../../shared/buscar-expediente';

@Component({
  selector: 'app-configuracion',
  imports: [FormsModule, RouterLink, BadgeComponent, HelpTipComponent, ModalComponent, BuscarExpedienteUnicoModalComponent],
  styles: `
    .sw-row td .chk { width: 17px; height: 17px; accent-color: var(--ok); cursor: pointer; }
    .cap-row { display: flex; gap: 7px; align-items: center; flex-wrap: wrap; }
    .cap-row .control { max-width: 210px; }
    .i-falta { font-size: 11.5px; font-weight: 600; color: var(--danger, #c0392b); }
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
            <button class="btn btn-outline btn-sm" (click)="buscarAbierto.set(true)">🔍 Buscar expediente</button>
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
                <button class="btn btn-gold btn-lg" [disabled]="c.estado === 'Completada'" (click)="iniciar(c)">▶ Iniciar configuración</button>
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
                        <span class="candado" title="Bloqueado: instalado en la Preparación F0288">🔒</span> {{ s.nombre }}
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
                      <label class="sec-selall" (click)="$event.stopPropagation()">
                        <input type="checkbox" [checked]="estadoSelAllCat(c, cat) === 'todos'"
                          [indeterminate]="estadoSelAllCat(c, cat) === 'parcial'"
                          [disabled]="c.estado === 'Completada'"
                          (change)="toggleCategoria(c, cat, $event)" /> Seleccionar todo
                      </label>
                    </td>
                  </tr>
                  @for (s of itemsCategoria(c, cat); track s.nombre) {
                    <tr class="sw-row">
                      <td>
                        <input class="chk" type="checkbox" [checked]="s.estado === 'Realizado'"
                          [disabled]="c.estado === 'Completada'"
                          (change)="marcar(c.expediente, s.nombre, $event)" />
                      </td>
                      <td class="main-cell">
                        {{ s.nombre }}
                        @if (s.requiereEvidencia) {
                          <ui-help texto="Control de seguridad institucional: no se da por configurado sin captura. Marcarlo desde «Seleccionar todo» tampoco exime de adjuntarla." />
                        }
                      </td>
                      <td><span class="mono">{{ s.version }}</span></td>
                      <td>
                        @if (s.evidencia) {
                          <span class="chip">{{ s.evidencia }}</span>
                          @if (evidenciaDe(c, s.nombre); as ev) {
                            <div class="sub-cell">{{ ev.tipo }} · {{ ev.cargadaPor }} · {{ ev.fecha }} · {{ ev.formulario }}</div>
                          }
                        } @else if (s.requiereEvidencia && s.estado === 'Realizado' && c.estado !== 'Completada') {
                          <div class="cap-row">
                            <input class="control" [ngModel]="textoCaptura(s.nombre)"
                              (ngModelChange)="escribirCaptura(s.nombre, $event)"
                              placeholder="captura-dlp-instalado.png"
                              (keyup.enter)="agregarCaptura(c, s.nombre)" />
                            <button class="btn btn-outline btn-sm" (click)="agregarCaptura(c, s.nombre)">Agregar captura</button>
                          </div>
                          <span class="hint">Obligatoria: sin ella no se puede finalizar el F0302 ni generar el documento.</span>
                        } @else if (s.requiereEvidencia) {
                          <span class="i-falta">Captura obligatoria al marcarlo</span>
                        } @else { <span class="muted">—</span> }
                      </td>
                      <td><ui-badge [estado]="s.estado" /></td>
                    </tr>
                  }
                </tbody>
              }
            </table>
          </div>
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

        <!-- Reportar falla durante la configuración: devuelve el equipo a F0288 (spec Parte B) -->
        @if (enCurso(c)) {
          <div class="card mb-2" style="border-left: 4px solid var(--danger, #c0392b);">
            <div class="card-head">
              <div>
                <h3>
                  ¿Se detectó una falla durante la configuración?
                  <ui-help texto="Reportar una falla detiene el cronómetro y guarda el tiempo trabajado, conserva el F0302 como intento «Con falla» (no se borra) y devuelve el equipo al flujo F0288. No se habilita la aceptación ni la garantía." />
                </h3>
                <p class="sub">El F0302 con falla se conserva como intento; el equipo regresa a revisión/preparación F0288</p>
              </div>
              <button class="btn btn-outline btn-sm" (click)="fallaAbierto.set(!fallaAbierto())">
                {{ fallaAbierto() ? 'Cancelar' : '⚠ Reportar falla y devolver a F0288' }}
              </button>
            </div>
            @if (fallaAbierto()) {
              <div class="card-body">
                <div class="grid grid-2">
                  <div class="field">
                    <label>Tipo de falla <span class="req">*</span></label>
                    <select class="control" [ngModel]="fTipo()" (ngModelChange)="fTipo.set($event)">
                      @for (t of tiposFalla; track t) { <option [value]="t">{{ t }}</option> }
                    </select>
                  </div>
                  <div class="field">
                    <label>Evidencia (si aplica)</label>
                    <input class="control" [ngModel]="fEvid()" (ngModelChange)="fEvid.set($event)" placeholder="Captura / número de evidencia…" />
                  </div>
                </div>
                <div class="field">
                  <label>Descripción / observación de la falla <span class="req">*</span></label>
                  <textarea class="control" rows="2" [ngModel]="fDesc()" (ngModelChange)="fDesc.set($event)" placeholder="Describa la falla detectada (obligatorio)…"></textarea>
                </div>
                <div class="grid grid-2">
                  <div class="field">
                    <label>¿Requiere revisión de Hardware?</label>
                    <div class="radio-line" style="padding-top: 8px;">
                      <label><input type="radio" name="freqhw" [checked]="fReqHw()" (change)="fReqHw.set(true)" /> Sí</label>
                      <label><input type="radio" name="freqhw" [checked]="!fReqHw()" (change)="fReqHw.set(false)" /> No</label>
                    </div>
                  </div>
                  <div class="field">
                    <label>¿Requiere nueva Preparación F0288?</label>
                    <div class="radio-line" style="padding-top: 8px;">
                      <label><input type="radio" name="freqprep" [checked]="fReqPrep()" (change)="fReqPrep.set(true)" /> Sí</label>
                      <label><input type="radio" name="freqprep" [checked]="!fReqPrep()" (change)="fReqPrep.set(false)" /> No</label>
                    </div>
                  </div>
                </div>
                <div class="field">
                  <label>Observación técnica (opcional)</label>
                  <textarea class="control" rows="2" [ngModel]="fObs()" (ngModelChange)="fObs.set($event)"></textarea>
                </div>
                <div class="alert warn">
                  <span class="alert-ico">!</span>
                  <span>El F0302 quedará <b>Con falla</b> (se conserva como intento), se guardará el tiempo trabajado y el equipo volverá a <b>F0288</b>. No se habilitará la aceptación ni la garantía. Los contadores históricos no se reinician.</span>
                </div>
                <div class="row" style="justify-content: flex-end;">
                  <button class="btn btn-primary" (click)="reportarFalla(c.expediente)">Confirmar falla y devolver a F0288</button>
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
                <p class="sub">El equipo fue devuelto a F0288; este intento F0302 se conserva en el historial y no se borra</p>
              </div>
              <ui-badge estado="Con falla" />
            </div>
            <div class="card-body">
              @if (c.falla; as f) {
                <dl class="dl">
                  <dt>Tipo de falla</dt><dd>{{ f.tipo }}</dd>
                  <dt>Descripción de la falla</dt><dd>{{ f.descripcion }}</dd>
                  <dt>Tiempo trabajado del F0302</dt><dd>{{ data.formatoDuracion(f.tiempoMinutos) || 'menos de 1 min' }}</dd>
                  <dt>Técnico que reportó</dt><dd>{{ f.tecnicoReporta }}</dd>
                  <dt>Fecha y hora</dt><dd>{{ f.fecha }} · {{ f.hora }}</dd>
                  <dt>¿Requiere revisión de Hardware?</dt><dd>{{ f.requiereHardware ? 'Sí' : 'No' }}</dd>
                  <dt>¿Requiere nueva Preparación F0288?</dt><dd>{{ f.requiereNuevaPreparacion ? 'Sí' : 'No' }}</dd>
                  @if (f.observacionTecnica) { <dt>Observación técnica</dt><dd>{{ f.observacionTecnica }}</dd> }
                  @if (f.evidencia) { <dt>Evidencia</dt><dd>{{ f.evidencia }}</dd> }
                </dl>
              }
              <div class="alert warn mt-2">
                <span class="alert-ico">!</span>
                <span>No se habilita la aceptación ni la garantía mientras el F0302 quede con falla. El equipo debe pasar por <b>F0288</b> (revisión técnica y/o nueva preparación) antes de reconfigurar.</span>
              </div>
              <div class="row mt-2" style="flex-wrap: wrap;">
                <a class="btn btn-outline btn-sm" routerLink="/trazabilidad" [queryParams]="{ inventario: c.datos.inventario }">Ver historial técnico</a>
                @if (data.puedeCrearNuevoExpedienteTecnico(c.datos.inventario)) {
                  <a class="btn btn-outline btn-sm" routerLink="/expediente-tecnico" [queryParams]="{ inventario: c.datos.inventario }">Crear nuevo Expediente técnico</a>
                }
                <a class="btn btn-outline btn-sm" routerLink="/preparacion-tecnica">Iniciar nueva Preparación F0288</a>
                <button class="btn btn-primary btn-sm" [disabled]="!equipoPreparado(c)" (click)="nuevaConfig(c.expediente)">Iniciar nueva configuración F0302</button>
              </div>
              @if (!equipoPreparado(c)) {
                <span class="hint">«Iniciar nueva configuración F0302» se habilita cuando el equipo quede nuevamente Preparado (nueva Preparación F0288 completada).</span>
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
            } @else if (ipReq() === 'No') {
              <span class="hint">El formulario registrará «Reserva de IP: No · IP reservada: No aplica».</span>
            } @else {
              <span class="hint">Responda Sí o No. Con «Sí», la IP reservada es obligatoria para enviar el formulario.</span>
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

      @if (buscarAbierto()) {
        <app-buscar-expediente-unico
          [filas]="opciones()"
          titulo="Buscar configuración F0302"
          sub="Busque por expediente único, año, solicitud, inventario, usuario final o técnico asignado"
          (seleccionar)="elegir($event)"
          (cerrar)="buscarAbierto.set(false)" />
      }
    </div>
  `
})
export class ConfiguracionComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
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
  /** Últimos datos cargados en el formulario; evita repisar lo que el técnico está escribiendo. */
  private ipCargada = '';
  /** Modal de confirmación previo al envío del formulario de conformidad. */
  protected confirmarAbierto = signal(false);

  // ---------- Reporte de falla F0302 (Parte B) ----------
  protected readonly tiposFalla: TipoFallaF0302[] = [
    'Falla física del equipo', 'Falla de disco', 'Falla de memoria', 'Problema de sistema operativo',
    'Problema de red', 'No permite ingreso a dominio', 'Accesorio faltante',
    'Configuración incompleta por falla previa', 'Otro'
  ];
  protected fallaAbierto = signal(false);
  protected fTipo = signal<TipoFallaF0302>('Falla física del equipo');
  protected fDesc = signal('');
  protected fReqHw = signal(true);
  protected fReqPrep = signal(true);
  protected fObs = signal('');
  protected fEvid = signal('');

  /**
   * El equipo del proceso está nuevamente Preparado (nueva F0288 completada) y sin reingreso a
   * Hardware pendiente: recién entonces se habilita la nueva configuración. Tras una falla el
   * Expediente técnico anterior sigue «Preparado», por eso también se exige que no quede un reingreso
   * pendiente —de lo contrario el equipo saltaría F0288.
   */
  protected equipoPreparado(c: ConfiguracionF0302): boolean {
    return this.data.estadoPreparacionEquipo(c.datos.inventario) === 'Preparado'
      && !this.data.reingresoHardwarePendiente(c.datos.inventario);
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
      this.nombrePC.set(c?.datos.nombrePC ?? '');
    });
  }

  /** «No requiere» limpia la IP: el expediente registrará «No aplica». */
  protected cambiarNoRequiere(): void {
    this.ipReq.set('No');
    this.ipVal.set('');
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
    const error = this.data.registrarReservaIP(c.expediente, `${u?.nombre} — ${u?.rol}`, this.ipReq(), this.ipVal());
    if (error) {
      this.toast.error('No se puede registrar la reserva de IP', error);
      return false;
    }
    if (silencioso) return true;
    if (this.ipReq() === 'No') {
      this.toast.ok('Reserva de IP registrada', `El equipo ${c.datos.nombrePC} no requiere reserva de IP; el expediente registrará «IP reservada: No aplica».`);
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
    const u = this.auth.usuario();
    this.data.marcarSoftwareF0302(id, nombre, checked ? 'Realizado' : 'Pendiente', `${u?.nombre} — ${u?.rol}`);
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
    const items = this.itemsCategoria(c, categoria);
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
  /** Texto escrito en cada campo de captura, por nombre de ítem. */
  protected readonly capturas = signal<Record<string, string>>({});

  protected textoCaptura(nombre: string): string {
    return this.capturas()[nombre] ?? '';
  }

  protected escribirCaptura(nombre: string, valor: string): void {
    this.capturas.update((m) => ({ ...m, [nombre]: valor }));
  }

  protected evidenciaDe(c: ConfiguracionF0302, nombre: string) {
    return c.evidencias.find((e) => e.item === nombre && e.archivo);
  }

  protected agregarCaptura(c: ConfiguracionF0302, nombre: string): void {
    const u = this.auth.usuario();
    const error = this.data.registrarEvidenciaSoftwareF0302(c.expediente, nombre, this.textoCaptura(nombre), `${u?.nombre} — ${u?.rol}`);
    if (error) {
      this.toast.error('No se puede registrar la captura', error);
      return;
    }
    this.capturas.update((m) => ({ ...m, [nombre]: '' }));
    this.toast.ok('Captura registrada', `La evidencia de ${nombre} quedó anexada al F0302 y a la trazabilidad del equipo.`);
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

  protected reportarFalla(id: string): void {
    const u = this.auth.usuario();
    const error = this.data.reportarFallaF0302(id, {
      tipo: this.fTipo(), descripcion: this.fDesc(), requiereHardware: this.fReqHw(),
      requiereNuevaPreparacion: this.fReqPrep(), observacionTecnica: this.fObs(), evidencia: this.fEvid()
    }, `${u?.nombre} — ${u?.rol}`);
    if (error) { this.toast.error('No se puede reportar la falla', error); return; }
    this.fallaAbierto.set(false);
    this.fDesc.set(''); this.fObs.set(''); this.fEvid.set('');
    this.fReqHw.set(true); this.fReqPrep.set(true); this.fTipo.set('Falla física del equipo');
    this.toast.ok('F0302 con falla registrado',
      'Se detuvo el cronómetro y se guardó el tiempo trabajado. El F0302 se conserva como intento con falla y el equipo volvió a F0288. No se habilitó la aceptación ni la garantía.');
  }

  protected nuevaConfig(id: string): void {
    const u = this.auth.usuario();
    const r = this.data.nuevaConfiguracionF0302(id, `${u?.nombre} — ${u?.rol}`);
    if (typeof r === 'string') { this.toast.error('No se puede iniciar una nueva configuración', r); return; }
    this.seleccion.set(id);
    this.toast.ok('Nueva configuración F0302 iniciada', 'El F0302 con falla anterior se conserva en el historial. Inicie el cronómetro para comenzar.');
  }
}
