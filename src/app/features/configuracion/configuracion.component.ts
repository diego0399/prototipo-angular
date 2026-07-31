import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfiguracionF0302, Cronometro, NivelComplejidad, RespuestaSiNo, TipoFallaF0302 } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { CasoActivoService } from '../../core/services/caso-activo.service';
import { BadgeComponent, HelpTipComponent } from '../../shared/ui';
import { BuscarExpedienteUnicoModalComponent, FilaExpedienteUnico, filaExpedienteUnico } from '../../shared/buscar-expediente';

@Component({
  selector: 'app-configuracion',
  imports: [FormsModule, RouterLink, BadgeComponent, HelpTipComponent, BuscarExpedienteUnicoModalComponent],
  styles: `
    .sw-row td .chk { width: 17px; height: 17px; accent-color: var(--ok); cursor: pointer; }
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
            <ui-help texto="El F0302 se completa dentro de SISGOST como checklist digital. Solo se muestran las secciones y el software aplicables al requerimiento; el resto se oculta automáticamente." />
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
                <dt>Nombre del equipo</dt><dd>{{ c.datos.nombrePC }}</dd>
                <dt>Reserva de IP</dt><dd>{{ c.datos.requiereReservaIP || 'Sin responder' }}</dd>
                <dt>IP reservada</dt><dd class="mono">{{ data.textoIPReservada(c) }}</dd>
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

        @if (enCurso(c) || c.estado === 'Completada') {
        <!-- Software estándar -->
        <div class="card mb-2">
          <div class="card-head">
            <div>
              <h2>Software estándar instalado</h2>
              <p class="sub">Según el requerimiento seleccionado</p>
            </div>
          </div>
          <div class="card-body table-wrap">
            <table class="tbl">
              <thead><tr><th style="width:44px;"></th><th>Software</th><th>Versión</th><th>Evidencia</th><th>Estado</th></tr></thead>
              <tbody>
                @for (s of c.software; track s.nombre) {
                  <tr class="sw-row">
                    <td>
                      <input class="chk" type="checkbox" [checked]="s.estado === 'Realizado'"
                        [disabled]="c.estado === 'Completada'"
                        (change)="marcar(c.expediente, s.nombre, $event)" />
                    </td>
                    <td class="main-cell">{{ s.nombre }}</td>
                    <td class="mono">{{ s.version }}</td>
                    <td>@if (s.evidencia) { <span class="chip">{{ s.evidencia }}</span> } @else { <span class="muted">—</span> }</td>
                    <td><ui-badge [estado]="s.estado" /></td>
                  </tr>
                }
              </tbody>
            </table>
            @if (c.softwareOculto.length > 0) {
              <details class="acc subtle mt-2">
                <summary class="muted">Software oculto por el checklist dinámico ({{ c.softwareOculto.length }}) <span class="acc-arrow">▶</span></summary>
                <div class="acc-body">
                  @for (o of c.softwareOculto; track o.nombre) {
                    <p class="small"><b>{{ o.nombre }}</b> — <span class="muted">{{ o.motivo }}</span></p>
                  }
                </div>
              </details>
            }
          </div>
        </div>

        <!-- Reserva de IP: dato clave del expediente, igual que el nombre del equipo -->
        <div class="card mb-2">
          <div class="card-head">
            <div>
              <h3>
                Reserva de IP
                <ui-help texto="Si el equipo requiere una IP fija en la red institucional, la IP reservada queda registrada como dato clave del expediente: aparece en el F0302 generado, en el expediente único, en el historial técnico y en la trazabilidad." />
              </h3>
              <p class="sub">Se registra dentro del checklist F0302 y acompaña al nombre del equipo</p>
            </div>
            <ui-badge [estado]="c.datos.requiereReservaIP ? 'Registrada' : 'Pendiente'" />
          </div>
          <div class="card-body">
            @if (c.estado === 'Completada') {
              <dl class="dl">
                <dt>Nombre del equipo</dt><dd class="mono">{{ c.datos.nombrePC }}</dd>
                <dt>Reserva de IP</dt><dd>{{ c.datos.requiereReservaIP || '—' }}</dd>
                <dt>IP reservada</dt><dd class="mono">{{ data.textoIPReservada(c) }}</dd>
              </dl>
            } @else {
              <div class="grid grid-2">
                <div class="field">
                  <label>¿Requiere reserva de IP? <span class="req">*</span></label>
                  <div class="radio-line" style="padding-top: 8px;">
                    <label><input type="radio" name="kip" [checked]="ipReq() === 'Sí'" (change)="ipReq.set('Sí')" /> Sí</label>
                    <label><input type="radio" name="kip" [checked]="ipReq() === 'No'" (change)="cambiarNoRequiere()" /> No</label>
                  </div>
                </div>
                @if (ipReq() === 'Sí') {
                  <div class="field">
                    <label>IP reservada <span class="req">*</span></label>
                    <input class="control mono" [ngModel]="ipVal()" (ngModelChange)="ipVal.set($event)"
                      placeholder="192.168.10.45" (keyup.enter)="guardarIP(c)" />
                    @if (ipVal().trim() && !data.ipValida(ipVal())) {
                      <span class="hint" style="color: var(--danger, #c0392b);">La IP ingresada no tiene un formato válido. Use el formato xxx.xxx.xxx.xxx (por ejemplo 192.168.10.45).</span>
                    } @else {
                      <span class="hint">Formato xxx.xxx.xxx.xxx. La IP no puede estar reservada en otro equipo activo.</span>
                    }
                  </div>
                }
              </div>
              @if (ipReq() === 'No') {
                <span class="hint">El equipo no requiere reserva de IP: el expediente registrará «IP reservada: No aplica».</span>
              } @else if (!ipReq()) {
                <span class="hint">Responda Sí o No. Con «Sí», la IP reservada es obligatoria para finalizar la configuración.</span>
              }
              <div class="row mt-2" style="justify-content: flex-end;">
                <button class="btn btn-outline btn-sm" (click)="guardarIP(c)">Guardar reserva de IP</button>
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
                  <span class="small" style="font-weight:500; color: var(--navy-900);">{{ e.nombre }}</span>
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
              <button class="btn btn-gold btn-lg" [disabled]="c.estado !== 'Completada' || yaEnviada(c.expediente)" (click)="enviarConformidad(c.expediente)">
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

  // ---------- Reserva de IP ----------
  protected ipReq = signal<RespuestaSiNo>('');
  protected ipVal = signal('');
  /** Última reserva cargada en el formulario; evita repisar lo que el técnico está escribiendo. */
  private ipCargada = '';

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
      const clave = c ? `${c.expediente}·${c.datos.requiereReservaIP ?? ''}·${c.datos.ipReservada ?? ''}` : '';
      if (clave === this.ipCargada) return;
      this.ipCargada = clave;
      this.ipReq.set(c?.datos.requiereReservaIP ?? '');
      this.ipVal.set(c?.datos.ipReservada ?? '');
    });
  }

  /** «No requiere» limpia la IP: el expediente registrará «No aplica». */
  protected cambiarNoRequiere(): void {
    this.ipReq.set('No');
    this.ipVal.set('');
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
    this.data.marcarSoftwareF0302(id, nombre, checked ? 'Realizado' : 'Pendiente');
  }

  protected generar(id: string): void {
    const u = this.auth.usuario();
    // La reserva de IP se guarda con lo que haya en pantalla: así el técnico no queda bloqueado
    // por no haber presionado «Guardar reserva de IP», y su validación se aplica igual.
    const c = this.conf();
    if (c && c.expediente === id && !this.guardarIP(c, true)) return;
    const error = this.data.cerrarConfiguracion(id, `${u?.nombre} — ${u?.rol}`, {
      nivel: this.cNivel(), hubo: this.cHubo(), detalle: this.cDetalle(), observacion: this.cObs()
    });
    if (!error) {
      const ip = this.ipReq() === 'Sí' ? `IP reservada ${this.ipVal().trim()}` : 'sin reserva de IP';
      this.toast.ok('Configuración F0302 finalizada',
        `Cronómetro detenido: tiempo total, complejidad, observación y la reserva de IP (${ip}) quedaron en el historial y en la trazabilidad. El documento quedó firmado y anexado al expediente único.`);
      this.cHubo.set('');
      this.cDetalle.set('');
      this.cObs.set('');
      this.cNivel.set('Sin complejidad');
    } else {
      this.toast.error('No se puede finalizar la configuración', error);
    }
  }

  protected enviarConformidad(id: string): void {
    const u = this.auth.usuario();
    const conf = this.data.enviarConformidad(id, `${u?.nombre} — ${u?.rol}`);
    if (conf) {
      this.toast.ok('Formulario de conformidad enviado', `Se envió el enlace único al correo institucional ${conf.correo}.`);
    } else {
      this.toast.error('No es posible enviar el formulario', 'El F0302 debe estar generado antes de solicitar la conformidad del usuario final.');
    }
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
