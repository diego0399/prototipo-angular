import { Component, computed, inject, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { CasoActivoService } from '../../core/services/caso-activo.service';
import { CargaSoporte, CorreccionNoConformidad, ResolucionInconformidad, RespuestaSiNo, TipoProblemaInconformidad } from '../../core/models/models';
import { BadgeComponent, HelpTipComponent } from '../../shared/ui';
import { IconComponent } from '../../shared/icon';
import { ConstanciaCorreccionComponent } from '../../shared/constancia-correccion';
import { ConstanciaReprocesoComponent } from '../../shared/constancia-reproceso';
import { BuscarExpedienteUnicoModalComponent, FilaExpedienteUnico, filaExpedienteUnico } from '../../shared/buscar-expediente';
import { EvidenciasComponent } from '../../shared/evidencias';
import { SelectorSoporteComponent } from '../../shared/selector-soporte.component';

@Component({
  selector: 'app-entrega',
  imports: [RouterLink, SlicePipe, FormsModule, BadgeComponent, HelpTipComponent, BuscarExpedienteUnicoModalComponent,
    ConstanciaCorreccionComponent, ConstanciaReprocesoComponent, IconComponent, EvidenciasComponent,
    SelectorSoporteComponent],
  styles: `
    .conf-panel { background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 16px 18px; }
    .conf-panel .cp-title { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--tx-3); margin-bottom: 8px; }
    .respuesta { border-left: 3px solid var(--ok); background: var(--ok-bg); padding: 10px 14px; border-radius: 0 10px 10px 0; font-size: 13px; }
    .respuesta.mala { border-left-color: var(--danger); background: var(--danger-bg); }
    .firma-uf { border: 1px dashed var(--line-strong); border-radius: var(--r-md); background: var(--surface-2); padding: 12px 16px; }
    .firma-uf .fu-cap { font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--gold-600); margin-bottom: 5px; }
    .firma-uf .fu-nombre { font-family: var(--font-brand); font-size: 19px; color: var(--navy-900); border-bottom: 1px solid var(--tx-2); padding-bottom: 3px; margin-bottom: 5px; max-width: 320px; }
    .firma-uf .fu-det { font-size: 11.5px; color: var(--tx-3); line-height: 1.6; }
    .noconf { border: 1px solid var(--danger-line, var(--line)); background: var(--danger-bg); border-radius: var(--r-md); padding: 14px 16px; }
    .hist { display: grid; gap: 8px; }
    .hist-item { border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface-2); padding: 10px 14px; }
    .chk { display: grid; gap: 6px; margin-top: 6px; }
    .chk-fila { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 13px; border-bottom: 1px dashed var(--line); padding-bottom: 6px; }
    .pasos { list-style: none; padding: 0; display: grid; gap: 4px; font-size: 12.5px; color: var(--tx-3); }
    .pasos li.hecho { color: var(--ok); }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Entrega y garantía</div>
          <h1>
            Entrega y aceptación
            <ui-help texto="¿Cómo funciona? El técnico entrega el equipo y SISGOST envía un enlace único al correo institucional del usuario final. El usuario responde el formulario externo (acepta o registra inconformidad) sin ingresar al sistema; su respuesta queda anexada al expediente único." />
          </h1>
          <p class="page-sub">Recepción del equipo y conformidad del usuario final.</p>
        </div>
      </div>

      <div class="card card-pad mb-3">
        <div class="row-between" style="flex-wrap: wrap; gap: 16px;">
          <div style="min-width: 0;">
            <div class="sec-title" style="margin-bottom: 3px;">Entrega</div>
            @if (entrega(); as e) {
              <p class="small"><b class="mono">{{ e.expediente }}</b> — {{ e.usuarioFinal }} · {{ e.estado }}</p>
            } @else {
              <p class="small muted">Ninguna seleccionada.</p>
            }
          </div>
          @if (opciones().length > 1) {
            <button class="btn btn-outline btn-sm" (click)="buscarAbierto.set(true)"><ui-icon name="search" [size]="14" /> Buscar expediente</button>
          }
        </div>
        @if (auth.esTecnico()) {
          <span class="hint">Solo se muestran las entregas asignadas a usted.</span>
        }
      </div>

      @if (entrega(); as e) {
        <div class="grid grid-2 mb-2">
          <div class="card">
            <div class="card-head">
              <div>
                <h2>Datos de la entrega</h2>
                <p class="sub">{{ e.solicitudRef }}</p>
              </div>
              <ui-badge [estado]="e.estado" />
            </div>
            <div class="card-body">
              <dl class="dl">
                <dt>Usuario final receptor</dt><dd>{{ e.usuarioFinal }} (carné {{ e.carne }})</dd>
                <dt>Correo institucional</dt><dd>{{ e.correo }}</dd>
                <dt>Unidad destino</dt><dd>{{ e.unidadDestino }}</dd>
                <dt>Equipo entregado</dt><dd>{{ e.equipo }}</dd>
                <dt>Inventario recibido</dt><dd>{{ e.inventario }}</dd>
                <dt>Fecha de entrega</dt><dd>{{ e.fechaEntrega }}</dd>
              </dl>
              <hr class="divider" />
              <dl class="dl">
                <dt>Responsable de entrega</dt><dd>{{ e.tecnicoEntrega }}</dd>
                <dt>Configuró el equipo</dt><dd>{{ e.tecnicoConfiguro }}</dd>
                @if (data.direccionDe(e.tecnicoConfiguro); as dir) { <dt>Dirección del técnico que configuró</dt><dd>{{ dir }}</dd> }
                <dt>Preparó el equipo</dt><dd>{{ e.preparadoPor }}</dd>
                <dt>F0302</dt>
                <dd>
                  @if (e.f0302Generado) { <ui-badge estado="Generado" /> <span class="small muted">· {{ e.f0302Fecha }} (automático)</span> }
                  @else { <ui-badge estado="Pendiente" /> }
                </dd>
              </dl>
              <div class="row mt-2">
                <a class="btn btn-outline btn-sm" routerLink="/expediente-unico">Ver expediente único</a>
                <a class="btn btn-outline btn-sm" routerLink="/trazabilidad">Ver trazabilidad</a>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-head">
              <div>
                <h2>Formulario de conformidad</h2>
                <p class="sub">Respuesta del usuario final mediante enlace externo</p>
              </div>
            </div>
            <div class="card-body">
              @if (conformidad(); as c) {
                <div class="conf-panel mb-2">
                  <div class="cp-title">Estado del formulario · intento #{{ ultimoIntento()?.numero || 1 }}</div>
                  <dl class="dl">
                    <dt>Estado de aceptación</dt><dd><ui-badge [estado]="estadoAcept()" /></dd>
                    <dt>Enlace único</dt><dd class="mono">{{ c.token }}</dd>
                    <dt>Enviado el</dt><dd>{{ c.fechaEnvio ? (c.fechaEnvio | slice: 0:10) : '—' }} <span class="muted">· vence {{ c.vence }}</span></dd>
                    <dt>Respondido el</dt><dd>{{ c.fechaRespuesta ? (c.fechaRespuesta | slice: 0:10) : 'Sin respuesta aún' }}</dd>
                  </dl>
                </div>

                @if (estadoAcept() === 'Aceptado') {
                  <div class="respuesta">
                    <b>Usuario final aceptó la recepción del equipo.</b>
                    <div class="small mt-1">Entrega cerrada · garantía habilitada.</div>
                  </div>
                  <div class="firma-uf mt-2">
                    <div class="fu-cap">Firma de conformidad simulada del usuario final</div>
                    <div class="fu-nombre">{{ c.firmaUsuarioFinal || c.usuarioFinal }}</div>
                    <div class="fu-det">
                      {{ c.correo }}<br />
                      Fecha de aceptación: {{ c.fechaRespuesta | slice: 0:10 }} · {{ c.fechaRespuesta | slice: 11:16 }}<br />
                      Asociada al Expediente único, a la constancia de Entrega y aceptación y al F0302.
                    </div>
                  </div>
                } @else if (estadoAcept() === 'No conforme') {
                  <div class="respuesta mala">
                    <b>El usuario final marcó No conforme.</b>
                    <div class="small mt-1">Observación: {{ ultimoIntento()?.observacion }}</div>
                  </div>

                  <div class="noconf mt-2">
                    <div class="cp-title">Atender inconformidad</div>
                    <dl class="dl">
                      <dt>Equipo</dt><dd>{{ e.equipo }}</dd>
                      <dt>N.º de inventario</dt><dd>{{ e.inventario }}</dd>
                      <dt>Expediente único</dt><dd class="mono">{{ unicoCod() }}</dd>
                      <dt>Expediente técnico original</dt><dd class="mono">{{ expTecnico() || '—' }}</dd>
                      <dt>F0302 relacionado</dt><dd>{{ f0302Relacionado() }}</dd>
                      <dt>Usuario final</dt><dd>{{ e.usuarioFinal }}</dd>
                      <dt>Observación del Usuario Final</dt><dd>{{ ultimoIntento()?.observacion }}</dd>
                      <dt>Fecha de la inconformidad</dt><dd>{{ ultimoIntento()?.fecha }} @if (ultimoIntento()?.hora) { · {{ ultimoIntento()?.hora }} }</dd>
                      <dt>Intento de conformidad</dt><dd>#{{ ultimoIntento()?.numero }}</dd>
                      <dt>Técnico que configuró</dt><dd>{{ e.tecnicoConfiguro }}</dd>
                      <dt>Estado actual</dt><dd><ui-badge [estado]="estadoIncidencia()" /></dd>
                      <dt>Acción a realizar</dt><dd>{{ accionSugerida() }}</dd>
                    </dl>

                    <div class="alert mt-2">
                      <span class="alert-ico">i</span>
                      <span>Mientras la inconformidad esté abierta <b>no se cierra la entrega, no se habilita la garantía y no se permite descargo</b>. La inconformidad se resuelve igual que una falla de Configuración F0302.</span>
                    </div>

                    @if (!puedeAtender()) {
                      <p class="small muted mt-2">La inconformidad debe atenderla un Técnico de Soporte o un Encargado.</p>
                    } @else {
                      @if (!correccionActiva() && !correccionLista()) {
                        <!-- Paso 1: clasificación del problema y resolución (spec §5 y §6) -->
                        <div class="field mt-2">
                          <label>Tipo de problema <span class="req">*</span></label>
                          <select class="control" [ngModel]="tipoProblema()" (ngModelChange)="cambiarTipo($event)">
                            <option value="">Seleccione…</option>
                            @for (t of tiposProblema; track t) { <option [value]="t">{{ t }}</option> }
                          </select>
                          @if (tipoProblema()) { <span class="hint">{{ matriz().nota }}</span> }
                        </div>
                        @if (matriz().pregunta) {
                          <div class="field mt-2">
                            <label>{{ matriz().pregunta }} <span class="req">*</span></label>
                            <div class="opt-row">
                              <label class="opt" [class.on]="respuestaDepende() === 'Sí'"><input type="radio" name="dep" [checked]="respuestaDepende() === 'Sí'" (change)="setDepende('Sí')" /> Sí</label>
                              <label class="opt" [class.on]="respuestaDepende() === 'No'"><input type="radio" name="dep" [checked]="respuestaDepende() === 'No'" (change)="setDepende('No')" /> No</label>
                            </div>
                            <span class="hint">De esta respuesta depende si lo corrige Soporte o si el equipo vuelve a Hardware.</span>
                          </div>
                        }
                        @if (sugerencia()) {
                          <div class="field mt-2">
                            <label>Resolución <span class="req">*</span></label>
                            <div class="opt-row">
                              <label class="opt" [class.on]="resolucion() === 'Corrección F0302'"><input type="radio" name="reso" [checked]="resolucion() === 'Corrección F0302'" (change)="resolucion.set('Corrección F0302')" /> Corrección F0302</label>
                              <label class="opt" [class.on]="resolucion() === 'Reproceso F0288'"><input type="radio" name="reso" [checked]="resolucion() === 'Reproceso F0288'" (change)="resolucion.set('Reproceso F0288')" /> Reproceso F0288</label>
                            </div>
                            <span class="hint">Sugerencia del sistema para «{{ tipoProblema() }}»: <b>{{ sugerencia() }}</b>.</span>
                          </div>
                          @if (resolucion() && resolucion() !== sugerencia()) {
                            <div class="field mt-2">
                              <label>Justificación de la excepción <span class="req">*</span></label>
                              <textarea class="control" rows="2" [ngModel]="justificacion()" (ngModelChange)="justificacion.set($event)" placeholder="Por qué se resuelve distinto a lo sugerido"></textarea>
                            </div>
                          }
                          @if (resolucion() === 'Reproceso F0288') {
                            <span class="hint">Se generará un reproceso sobre el <b>mismo Expediente técnico</b> ({{ expTecnico() || '—' }}-R#). No se crea un Expediente técnico nuevo, y solo un <b>Encargado</b> puede asignarlo a un Técnico de Hardware.</span>
                          }
                        }

                        <!-- Técnico responsable de atender la inconformidad, con su carga laboral -->
                        <div class="field mt-2">
                          <label>Técnico responsable de atención <span class="req">*</span></label>
                          <input class="control" readonly [value]="responsableAtencion() || 'Sin asignar'" />
                          @if (cargaResponsable(); as c) {
                            <div class="small muted mt-1">{{ c.carga }} · {{ c.total }} procesos activos · {{ data.resumenCargaSoporte(c) }}.</div>
                            @if (c.nivel === 'Alta') {
                              <div class="alert warn mt-1">
                                <span class="alert-ico">!</span>
                                <span>{{ data.MSG_CARGA_ALTA }}</span>
                              </div>
                            }
                          }
                          @if (puedeElegirResponsable()) {
                            <button type="button" class="btn btn-outline btn-sm mt-1" (click)="buscarResponsable.set(e.expediente)">
                              {{ responsableAtencion() ? 'Cambiar técnico' : 'Seleccionar Técnico de Soporte' }}
                            </button>
                          } @else {
                            <span class="hint">La corrección queda a su nombre. El Encargado de Soporte puede asignarla a otro técnico.</span>
                          }
                        </div>

                        <button class="btn btn-primary btn-sm mt-2" [disabled]="!puedeAtenderAhora()" (click)="atender(e.expediente)">Atender inconformidad</button>
                      }

                      @if (correccionActiva(); as cor) {
                        <div class="alert warn mt-2">
                          <span class="alert-ico">!</span>
                          <span><b class="mono">{{ cor.id }}</b> — {{ cor.tipoProblema }} · resolución <b>{{ cor.resolucion }}</b>, iniciada el {{ cor.fechaInicio }} · {{ cor.horaInicio }} por {{ cor.tecnico }}.@if (cor.justificacionResolucion) {  Excepción justificada: {{ cor.justificacionResolucion }}}</span>
                        </div>

                        @if (cor.resolucion === 'Reproceso F0288') {
                          <!-- La inconformidad la cierra Hardware: aquí solo se ve en qué va (spec §8, §10) -->
                          <dl class="dl mt-1">
                            <dt>Reproceso F0288</dt><dd class="mono">{{ cor.reprocesoId || 'Pendiente de generar' }}</dd>
                            <dt>Expediente técnico</dt><dd class="mono">{{ expTecnico() || '—' }} <span class="muted">— el mismo; no se crea uno nuevo</span></dd>
                            @if (reprocesoActivo(); as r) {
                              <dt>Estado del reproceso</dt><dd><ui-badge [estado]="r.estado" /></dd>
                              <dt>Técnico de Hardware</dt><dd>{{ r.tecnicoAsignado || 'Pendiente de asignación por un Encargado' }}</dd>
                              @if (r.resultado) { <dt>Resultado</dt><dd>{{ r.resultado }}</dd> }
                            }
                          </dl>
                          <ul class="pasos mt-1">
                            @for (p of pasosReproceso(); track p.nombre) {
                              <li [class.hecho]="p.hecho"><ui-icon [name]="p.hecho ? 'check' : 'circle'" [size]="13" /> {{ p.nombre }}</li>
                            }
                          </ul>
                          <div class="row mt-2">
                            <a class="btn btn-outline btn-sm" routerLink="/reprocesos-f0288">Ver reproceso F0288</a>
                            <a class="btn btn-outline btn-sm" routerLink="/trazabilidad" [queryParams]="{ inventario: e.inventario }">Ver historial técnico</a>
                            @if (reprocesoActivo()?.firma) {
                              <button class="btn btn-gold btn-sm" (click)="verConstanciaReproceso.set(cor.reprocesoId ?? '')">Ver constancia del reproceso</button>
                            }
                          </div>
                          <p class="small muted mt-1">El reproceso lo asigna un Encargado y lo firma el Técnico de Hardware. El formulario se reenvía cuando quede <b>finalizado y firmado</b>.</p>
                        } @else if (cor.estado === 'Iniciada') {
                          <!-- Checklist dinámico según el tipo de problema (spec §11) -->
                          <div class="cp-title mt-2">Checklist de atención · {{ cor.tipoProblema }}</div>
                          <div class="chk">
                            @for (i of cor.checklist; track i.nombre) {
                              <div class="chk-fila">
                                <span>{{ i.nombre }} @if (i.implicaEvidencia) { <span class="hint">· exige evidencia si se marca</span> }</span>
                                <span class="row">
                                  <button class="btn btn-sm" [class.btn-primary]="i.estado === 'Realizado'" [class.btn-outline]="i.estado !== 'Realizado'" (click)="marcar(cor.id, i.nombre, 'Realizado')">Realizado</button>
                                  <button class="btn btn-sm" [class.btn-primary]="i.estado === 'No aplica'" [class.btn-outline]="i.estado !== 'No aplica'" (click)="marcar(cor.id, i.nombre, 'No aplica')">No aplica</button>
                                </span>
                              </div>
                            }
                          </div>

                          <ui-evidencias titulo="Evidencias de la corrección F0302"
                            [lista]="data.evid.de('Corrección F0302', cor.id)"
                            [editable]="true"
                            [obligatoria]="true"
                            [mensajeFalta]="data.evid.mensajeFalta('Corrección F0302')"
                            [contextos]="data.evid.contextosDe('Corrección F0302')"
                            [sugeridas]="sugeridasCorreccion"
                            (adjuntar)="adjuntar(cor.id, $event)"
                            (eliminar)="quitarEvidencia(cor.id, $event)"
                            (visualizar)="verEvidencia(cor, $event)"
                            (error)="toast.error('No se pudo adjuntar la imagen', $event)" />

                          <div class="field mt-2">
                            <label>Descripción de la corrección <span class="req">*</span></label>
                            <textarea class="control" rows="2" [ngModel]="descCorreccion()" (ngModelChange)="descCorreccion.set($event)" placeholder="Qué se corrigió (configuración, software, acceso, dominio, IP, DLP…)"></textarea>
                          </div>
                          <div class="field mt-2">
                            <label>¿Hubo complejidad? <span class="req">*</span></label>
                            <div class="opt-row">
                              <label class="opt" [class.on]="hubo() === 'Sí'"><input type="radio" name="hubo" [checked]="hubo() === 'Sí'" (change)="hubo.set('Sí')" /> Sí</label>
                              <label class="opt" [class.on]="hubo() === 'No'"><input type="radio" name="hubo" [checked]="hubo() === 'No'" (change)="hubo.set('No')" /> No</label>
                            </div>
                          </div>
                          @if (hubo() === 'Sí') {
                            <div class="field mt-2"><label>Detalle de la complejidad <span class="req">*</span></label><input class="control" [ngModel]="detalle()" (ngModelChange)="detalle.set($event)" placeholder="Describa la complejidad" /></div>
                          } @else {
                            <div class="field mt-2"><label>Observación técnica <span class="hint">(opcional)</span></label><input class="control" [ngModel]="obsTecnica()" (ngModelChange)="obsTecnica.set($event)" /></div>
                          }
                          <div class="row mt-2">
                            <button class="btn btn-primary btn-sm" (click)="finalizar(cor.id)">Finalizar corrección</button>
                            <button class="btn btn-ghost btn-sm" (click)="escalarAbierto.set(!escalarAbierto())">La corrección requiere Hardware</button>
                          </div>
                          @if (escalarAbierto()) {
                            <!-- §15: el problema resultó ser del equipo; se deriva sin empezar de nuevo -->
                            <div class="field mt-2">
                              <label>Motivo para derivar a reproceso F0288 <span class="req">*</span></label>
                              <textarea class="control" rows="2" [ngModel]="motivoEscalar()" (ngModelChange)="motivoEscalar.set($event)" placeholder="Qué se encontró que requiere intervención de Hardware"></textarea>
                              <button class="btn btn-outline btn-sm mt-1" (click)="escalar(cor.id)">Derivar a reproceso F0288</button>
                              <span class="hint">Se genera un reproceso sobre el mismo Expediente técnico; lo asigna un Encargado.</span>
                            </div>
                          }
                        } @else if (cor.estado === 'Finalizada') {
                          <!-- §13: sin firma no se cierra -->
                          <div class="respuesta mt-2">
                            <b>Corrección finalizada.</b>
                            <div class="small mt-1">{{ cor.descripcion }} · tiempo trabajado: {{ tiempoCorreccion(cor) }} · complejidad: {{ cor.huboComplejidad === 'Sí' ? 'Sí' : 'No' }}</div>
                          </div>
                          <div class="field mt-2">
                            <label>Firma del Técnico de Soporte <span class="req">*</span></label>
                            <input class="control" [ngModel]="firmaSoporte()" (ngModelChange)="firmaSoporte.set($event)" [placeholder]="usuarioActual()" />
                            <span class="hint">Debe registrar la firma del Técnico de Soporte para finalizar la corrección.</span>
                          </div>
                          <button class="btn btn-primary btn-sm mt-1" (click)="firmar(cor.id)">Firmar corrección</button>
                        }
                      }

                      @if (correccionLista(); as cor) {
                        <div class="respuesta mt-2">
                          <b>Inconformidad resuelta — {{ cor.resultado }}.</b>
                          <div class="small mt-1">
                            {{ cor.id }} · {{ cor.tipoProblema }} · {{ cor.resolucion }}@if (cor.reprocesoId) {  · reproceso {{ cor.reprocesoId }}}
                            @if (cor.descripcion) { <br />{{ cor.descripcion }} }
                          </div>
                        </div>
                        <div class="row mt-2">
                          <button class="btn btn-primary btn-sm" (click)="reenviarAceptacion(e.expediente)">Reenviar formulario de conformidad</button>
                          @if (cor.firma) {
                            <button class="btn btn-gold btn-sm" (click)="verConstancia.set(cor.id)">Ver constancia de corrección</button>
                          }
                          @if (cor.reprocesoId) {
                            <button class="btn btn-gold btn-sm" (click)="verConstanciaReproceso.set(cor.reprocesoId)">Ver constancia del reproceso</button>
                          }
                        </div>
                      }
                    }
                  </div>
                } @else {
                  @if (c.respuesta) {
                    <div class="respuesta"><b>Respuesta del usuario final:</b> «{{ c.respuesta }}»</div>
                  } @else {
                    <div class="alert warn">
                      <span class="alert-ico">!</span>
                      <span>El usuario final aún no responde. Puede <b>reenviar</b> el formulario o abrir la vista externa para la demostración.</span>
                    </div>
                  }
                  <button class="btn btn-primary btn-sm mt-2" (click)="reenviar(e.expediente)">Reenviar formulario</button>
                }

                <div class="row mt-2">
                  <a class="btn btn-gold btn-sm" [routerLink]="['/formulario-conformidad', c.token]" target="_blank">
                    Abrir formulario externo (simulación)
                  </a>
                  @if (intentos().length) {
                    <button class="btn btn-ghost btn-sm" (click)="verHistorial.set(!verHistorial())">
                      {{ verHistorial() ? 'Ocultar' : 'Ver' }} historial de intentos ({{ intentos().length }})
                    </button>
                  }
                  <a class="btn btn-outline btn-sm" routerLink="/trazabilidad">Ver trazabilidad</a>
                </div>

                @if (verHistorial()) {
                  <!-- §17: el historial muestra la inconformidad y cómo se resolvió, no solo el resultado -->
                  <div class="hist mt-2">
                    @for (i of intentos(); track i.id) {
                      <div class="hist-item">
                        <div class="row-between">
                          <b>Formulario de conformidad intento #{{ i.numero }}</b>
                          <ui-badge [estado]="i.resultado" />
                        </div>
                        <div class="small muted">{{ i.fecha || i.fechaEnvio }} @if (i.hora) { · {{ i.hora }} }</div>
                        @if (i.observacion) { <div class="small">Observación: {{ i.observacion }}</div> }
                        @if (i.firma) { <div class="small">Firma: {{ i.firma }}</div> }
                        @if (correccionDeIntento(i.numero); as cor) {
                          <div class="small">Incidencia: {{ cor.tipoProblema }} — resuelta como {{ cor.resolucion }}</div>
                          @if (cor.resolucion === 'Corrección F0302') {
                            <div class="small">
                              Corrección F0302: <span class="mono">{{ cor.id }}</span> — {{ estadoTexto(cor) }}
                              @if (cor.firma) {
                                <button class="btn btn-ghost btn-sm" (click)="verConstancia.set(cor.id)">Ver constancia</button>
                              }
                            </div>
                          } @else {
                            <div class="small">
                              Reproceso: <span class="mono">{{ cor.reprocesoId }}</span> — {{ estadoTexto(cor) }}
                              @if (reprocesoDe(cor.reprocesoId)?.firma) {
                                <button class="btn btn-ghost btn-sm" (click)="verConstanciaReproceso.set(cor.reprocesoId ?? '')">Ver constancia</button>
                              }
                            </div>
                          }
                        }
                        @if (i.correccionRealizada) { <div class="small">Corrección previa: {{ i.correccionRealizada }}</div> }
                      </div>
                    }
                    @if (estadoAcept() === 'Aceptado' && data.garantiaDe(e.expediente)) {
                      <div class="hist-item"><b>Garantía habilitada</b> <span class="small muted">tras la aceptación del usuario final</span></div>
                    }
                  </div>
                }
              } @else {
                <div class="alert">
                  <span class="alert-ico">i</span>
                  <span>Aún no se ha enviado el formulario de conformidad para esta entrega.</span>
                </div>
                <!-- La validación de la reserva de IP se hace en el modal de Configuración F0302:
                     desde aquí se envía solo cuando ya quedó completa. -->
                @if (faltaValidacionIP(e.expediente); as falta) {
                  <p class="small muted mt-2">{{ falta }}</p>
                  <a class="btn btn-primary mt-1" routerLink="/configuracion" (click)="casoActivo.seleccionar(e.expediente)">
                    Validar reserva de IP en Configuración F0302
                  </a>
                } @else {
                  <button class="btn btn-primary mt-2" (click)="enviar(e.expediente)" [disabled]="!e.f0302Generado">
                    Enviar formulario de conformidad
                  </button>
                }
                @if (!e.f0302Generado) {
                  <p class="small muted mt-1">Se habilita al generar el F0302.</p>
                }
              }
            </div>
          </div>
        </div>
      } @else {
        <div class="card card-pad">
          <p class="muted">
            @if (auth.esTecnico()) {
              No tiene entregas asignadas. Las entregas donde usted participa aparecerán aquí al enviar el formulario de conformidad desde Configuración F0302.
            } @else {
              No hay entregas registradas todavía. Las entregas aparecen al enviar el formulario de conformidad desde Configuración F0302.
            }
          </p>
        </div>
      }

      @if (buscarAbierto()) {
        <app-buscar-expediente-unico
          [filas]="opciones()"
          sub="Busque por código de expediente único, solicitud, inventario o usuario final"
          (seleccionar)="elegir($event)"
          (cerrar)="buscarAbierto.set(false)" />
      }

      <!-- Técnico responsable de atender la inconformidad, con la carga de Soporte a la vista -->
      @if (buscarResponsable(); as id) {
        <app-selector-soporte
          titulo="Técnico responsable de atención de inconformidad"
          sub="Se mostrará la carga laboral de cada técnico antes de asignarle la corrección"
          nota="La corrección F0302 y el seguimiento de la inconformidad quedan a cargo de este técnico. Una carga alta no impide asignársela."
          vacio="No hay Técnicos de Soporte activos registrados."
          [tecnicos]="data.tecnicosSoporteParaProceso(id)"
          [seleccionado]="responsableAtencion()"
          [expediente]="id"
          (seleccion)="responsableAtencion.set($event.nombreRol); buscarResponsable.set('')"
          (cerrar)="buscarResponsable.set('')" />
      }

      <ui-constancia-correccion [idCorreccion]="verConstancia()" (cerrado)="verConstancia.set('')" />
      <ui-constancia-reproceso [idReproceso]="verConstanciaReproceso()" (cerrado)="verConstanciaReproceso.set('')" />
    </div>
  `
})
export class EntregaComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);
  protected readonly toast = inject(ToastService);
  protected readonly casoActivo = inject(CasoActivoService);

  protected seleccion = signal('');
  protected buscarAbierto = signal(false);

  /** Catálogo de búsqueda: solo los expedientes únicos con entrega visible para el rol. */
  protected readonly opciones = computed<FilaExpedienteUnico[]>(() =>
    this.data.entregasVisibles()
      .map((e) => this.data.expedienteUnicoDe(e.expediente))
      .filter((x): x is NonNullable<typeof x> => !!x)
      .map((x) => filaExpedienteUnico(this.data, x))
  );

  /**
   * Con una sola entrega disponible se carga automáticamente; con varias, se retoma el último
   * caso activo si sigue visible para el rol, o se requiere el modal «Buscar expediente».
   */
  protected readonly entrega = computed(() => {
    const visibles = this.data.entregasVisibles();
    if (visibles.length === 1) return visibles[0];
    const sel = this.seleccion() || this.casoActivo.expediente();
    return visibles.find((e) => e.expediente === sel);
  });

  protected elegir(id: string): void {
    this.seleccion.set(id);
    this.casoActivo.seleccionar(id);
    this.buscarAbierto.set(false);
  }

  protected readonly conformidad = computed(() => {
    const e = this.entrega();
    return e ? this.data.conformidadDeProceso(e.expediente) : undefined;
  });

  // ---------- Estado del ciclo de aceptación y no conformidad ----------
  protected readonly estadoAcept = computed(() => {
    const e = this.entrega();
    return e ? this.data.estadoAceptacion(e.expediente) : 'Sin enviar';
  });
  protected readonly intentos = computed(() => {
    const e = this.entrega();
    return e ? this.data.intentosDe(e.expediente) : [];
  });
  protected readonly ultimoIntento = computed(() => {
    const e = this.entrega();
    return e ? this.data.ultimoIntento(e.expediente) : undefined;
  });
  protected readonly correccionActiva = computed(() => {
    const e = this.entrega();
    return e ? this.data.correccionActivaDe(e.expediente) : undefined;
  });
  protected readonly correccionLista = computed(() => {
    const e = this.entrega();
    return e ? this.data.correccionListaParaReenvio(e.expediente) : undefined;
  });
  /** Reproceso F0288 de la inconformidad en curso, cuando la resolución fue de Hardware. */
  protected readonly reprocesoActivo = computed(() => {
    const cor = this.correccionActiva();
    return cor ? this.data.reprocesoDeCorreccion(cor) : undefined;
  });
  protected readonly pasosReproceso = computed(() => {
    const cor = this.correccionActiva();
    return cor ? this.data.pasosReprocesoInconformidad(cor) : [];
  });
  protected readonly unicoCod = computed(() => {
    const e = this.entrega();
    return e ? (this.data.expedienteUnicoDe(e.expediente)?.codigoUnico ?? e.expediente) : '';
  });
  /** Expediente técnico original del equipo: el mismo sobre el que se abre el reproceso. */
  protected readonly expTecnico = computed(() => {
    const e = this.entrega();
    return e ? (this.data.expTecnicoDeEquipo(e.inventario)?.codigo ?? '') : '';
  });
  protected readonly estadoIncidencia = computed(() => {
    const e = this.entrega();
    return this.data.textoEstadoIncidenciaConformidad(e ? this.data.estadoIncidenciaConformidad(e.expediente) : '');
  });

  // ---------- Técnico responsable de atender la inconformidad ----------
  /**
   * Un Técnico de Soporte atiende la inconformidad él mismo; el Encargado de Soporte y el
   * Administrador la reparten viendo la carga de cada quien. Guarda el expediente cuyo buscador
   * está abierto, no un booleano, porque la lista de técnicos depende del proceso.
   */
  protected buscarResponsable = signal('');
  protected responsableAtencion = signal(
    this.auth.usuario()?.clave === 'tec-soporte'
      ? `${this.auth.usuario()?.nombre} — ${this.auth.usuario()?.rol}`
      : '');
  protected readonly puedeElegirResponsable = computed(() => {
    const clave = this.auth.usuario()?.clave;
    return clave === 'enc-soporte' || clave === 'admin';
  });
  /** Carga del técnico elegido; se muestra junto al nombre sin tener que reabrir el buscador. */
  protected cargaResponsable(): CargaSoporte | null {
    const t = this.responsableAtencion();
    return t ? this.data.cargaSoporteDe(t) : null;
  }

  /** Clasificación de la inconformidad (spec §5, §6). */
  protected readonly tiposProblema: TipoProblemaInconformidad[] = [
    'Problema de configuración', 'Problema de software', 'Problema de usuario o credenciales',
    'Problema de dominio', 'Problema de red', 'Problema de IP reservada', 'Problema con Agente DLP',
    'Accesorio faltante', 'Falla física del equipo', 'Falla de disco', 'Falla de memoria',
    'Problema de sistema operativo', 'Otro'
  ];
  protected tipoProblema = signal<TipoProblemaInconformidad | ''>('');
  protected respuestaDepende = signal<RespuestaSiNo>('');
  protected resolucion = signal<ResolucionInconformidad | ''>('');
  protected justificacion = signal('');
  protected archivoEvidencia = signal('');
  protected descCorreccion = signal('');
  protected hubo = signal<RespuestaSiNo>('');
  protected detalle = signal('');
  protected obsTecnica = signal('');
  protected firmaSoporte = signal('');
  protected escalarAbierto = signal(false);
  protected motivoEscalar = signal('');
  protected verHistorial = signal(false);
  protected verConstancia = signal('');
  protected verConstanciaReproceso = signal('');

  /** Matriz del tipo elegido: qué sugiere y con qué pregunta se decide cuando depende. */
  protected readonly matriz = computed(() => {
    const t = this.tipoProblema();
    return t ? this.data.matrizInconformidad(t) : { sugerencia: '' as const, pregunta: '', nota: '' };
  });
  /** Sugerencia ya resuelta; vacía mientras falte responder la pregunta del «Depende». */
  protected readonly sugerencia = computed(() => {
    const t = this.tipoProblema();
    if (!t) return '';
    return this.data.sugerenciaInconformidad(t, this.detalleDepende());
  });

  /** La respuesta del «Depende» viaja en el campo que corresponde al tipo elegido. */
  private detalleDepende(): { revisionFisicaRed?: RespuestaSiNo; reinstalacionSO?: RespuestaSiNo } {
    return this.tipoProblema() === 'Problema de red'
      ? { revisionFisicaRed: this.respuestaDepende() }
      : { reinstalacionSO: this.respuestaDepende() };
  }

  /** Cambiar el tipo reinicia la respuesta y la resolución: sugerir sobre una respuesta vieja engaña. */
  protected cambiarTipo(valor: string): void {
    this.tipoProblema.set(valor as TipoProblemaInconformidad | '');
    this.respuestaDepende.set('');
    this.justificacion.set('');
    this.resolucion.set(this.sugerencia() || '');
  }
  protected setDepende(valor: RespuestaSiNo): void {
    this.respuestaDepende.set(valor);
    // Al responder la pregunta la sugerencia queda definida; se propone, sin bloquear el cambio.
    this.resolucion.set(this.sugerencia() || '');
  }

  protected puedeAtenderAhora(): boolean {
    if (!this.tipoProblema() || !this.sugerencia() || !this.resolucion()) return false;
    if (this.resolucion() !== this.sugerencia() && !this.justificacion().trim()) return false;
    // Sin responsable no hay a quién reclamarle la corrección; la carga alta advierte, no bloquea.
    if (!this.responsableAtencion()) return false;
    return true;
  }

  /** Solo el Técnico de Soporte (o Enc. de Soporte / Administrador) atiende la inconformidad. */
  protected puedeAtender(): boolean {
    const c = this.auth.usuario()?.clave;
    return c === 'tec-soporte' || c === 'enc-soporte' || c === 'admin';
  }
  protected accionSugerida(): string {
    const cor = this.correccionActiva();
    if (cor?.resolucion === 'Reproceso F0288') {
      const r = this.data.reprocesoDeCorreccion(cor);
      if (!r?.tecnicoAsignado) return 'Un Encargado debe asignar el reproceso F0288 a un Técnico de Hardware.';
      if (!r.firma) return 'Hardware debe completar y firmar el reproceso F0288.';
      return 'Reenviar el formulario de conformidad (nuevo intento).';
    }
    if (cor?.estado === 'Finalizada') return 'Registrar la firma del Técnico de Soporte para cerrar la corrección.';
    if (cor) return 'Completar el checklist, registrar la corrección y finalizarla.';
    if (this.correccionLista()) return 'Reenviar el formulario de conformidad (nuevo intento).';
    return 'Clasificar el problema y definir si se corrige en F0302 o requiere reproceso F0288.';
  }

  /** F0302 del proceso, para el panel de atención. */
  protected f0302Relacionado(): string {
    const e = this.entrega();
    if (!e) return '—';
    return e.f0302Generado ? `Generado · ${e.f0302Fecha}` : 'Pendiente';
  }
  protected exigeEvidencia(cor: CorreccionNoConformidad): boolean {
    return this.data.correccionExigeEvidencia(cor);
  }
  protected tiempoCorreccion(cor: CorreccionNoConformidad): string {
    return this.data.formatoDuracion(cor.cronometro?.duracionMinutos ?? null) || 'menos de 1 min';
  }
  protected correccionDeIntento(numero: number): CorreccionNoConformidad | undefined {
    const e = this.entrega();
    return e ? this.data.correccionesDe(e.expediente).find((c) => c.intentoNumero === numero) : undefined;
  }
  protected reprocesoDe(id?: string) {
    return id ? this.data.reprocesoDe(id) : undefined;
  }
  protected estadoTexto(cor: CorreccionNoConformidad): string {
    if (cor.estado === 'Firmada' || cor.estado === 'Cerrada por reproceso F0288') return 'Finalizada y firmada';
    return cor.estado;
  }
  protected usuarioActual(): string {
    const u = this.auth.usuario();
    return `${u?.nombre} — ${u?.rol}`;
  }

  /**
   * Mensaje de la validación de reserva de IP que falta, si falta alguna. El modal que la resuelve
   * vive en Configuración F0302, así que desde aquí se enlaza en lugar de ofrecer un envío que se
   * bloquearía de todos modos.
   */
  protected faltaValidacionIP(id: string): string {
    const m = this.data.validarEnvioConformidad(id);
    return m && /reserva de IP|IP reservada|MAC del equipo|justificar/i.test(m) ? m : '';
  }

  protected enviar(id: string): void {
    const u = this.auth.usuario();
    const c = this.data.enviarConformidad(id, `${u?.nombre} — ${u?.rol}`);
    if (typeof c === 'string') { this.toast.error('No es posible enviar', c); return; }
    this.toast.ok('Formulario enviado', `Enlace único enviado a ${c.correo}.`);
  }

  protected reenviar(id: string): void {
    const u = this.auth.usuario();
    const c = this.data.enviarConformidad(id, `${u?.nombre} — ${u?.rol}`);
    if (typeof c === 'string') { this.toast.error('No es posible reenviar', c); return; }
    this.toast.ok('Formulario reenviado', 'Se envió nuevamente el enlace al correo institucional del usuario final.');
  }

  protected atender(id: string): void {
    const responsable = this.responsableAtencion() || this.usuarioActual();
    // Se deja constancia de la carga del responsable ANTES de abrir la corrección: es la que tenía
    // al recibirla, no la que tendrá ya con este caso encima.
    this.data.registrarSeleccionSoporte(responsable, this.usuarioActual(), {
      expediente: id, modulo: 'Atención de inconformidad',
      inventario: this.entrega()?.inventario, expedienteUnico: this.unicoCod()
    });
    const r = this.data.atenderInconformidad(id, {
      tipoProblema: this.tipoProblema(), resolucion: this.resolucion(),
      justificacionResolucion: this.justificacion(), ...this.detalleDepende()
    }, responsable);
    if (typeof r === 'string') { this.toast.error('No se pudo atender la inconformidad', r); return; }
    this.descCorreccion.set(''); this.hubo.set(''); this.detalle.set(''); this.obsTecnica.set('');
    this.tipoProblema.set(''); this.respuestaDepende.set(''); this.resolucion.set(''); this.justificacion.set('');
    this.toast.ok('Inconformidad en atención', r.resolucion === 'Reproceso F0288'
      ? `${r.id} — se generó el reproceso ${r.reprocesoId} sobre el mismo Expediente técnico; un Encargado debe asignarlo.`
      : `${r.id} — complete el checklist de «${r.tipoProblema}», registre la corrección y fírmela.`);
  }

  protected marcar(idCor: string, item: string, estado: 'Realizado' | 'No aplica'): void {
    const err = this.data.marcarItemCorreccion(idCor, item, estado);
    if (err) this.toast.error('No se pudo marcar el ítem', err);
  }

  /** Qué imágenes se esperan al corregir por Soporte, según el tipo de problema atendido. */
  protected readonly sugeridasCorreccion = [
    'Captura de la configuración corregida', 'Captura del software reinstalado o reparado',
    'Captura del acceso o las credenciales validadas', 'Captura del equipo en el dominio',
    'Captura de la red o la IP reservada', 'Captura del Agente DLP funcionando'
  ];

  protected adjuntar(idCor: string, ev: { archivo: string; tipo: string; imagen: string; item: string }): void {
    const err = this.data.agregarEvidenciaCorreccion(idCor, ev.archivo, ev.tipo, this.usuarioActual(), ev.imagen, ev.item);
    if (err) { this.toast.error('No se pudo adjuntar la imagen', err); return; }
    this.toast.ok('Imagen de evidencia adjuntada', 'Queda asociada a la corrección y al expediente.');
  }

  protected quitarEvidencia(idCor: string, archivo: string): void {
    const err = this.data.eliminarEvidenciaCorreccion(idCor, archivo, this.usuarioActual());
    if (err) { this.toast.error('No se pudo eliminar la imagen', err); return; }
    this.toast.ok('Imagen de evidencia eliminada', `${archivo} ya no respalda esta corrección.`);
  }

  protected verEvidencia(cor: { id: string; expediente: string }, archivo: string): void {
    this.data.registrarConsultaEvidenciaTecnica('Corrección F0302', cor.id, cor.expediente,
      archivo, this.usuarioActual());
  }

  protected escalar(idCor: string): void {
    const err = this.data.escalarAReprocesoF0288(idCor, this.usuarioActual(), this.motivoEscalar());
    if (err) { this.toast.error('No se pudo derivar a reproceso', err); return; }
    this.escalarAbierto.set(false); this.motivoEscalar.set('');
    this.toast.ok('Derivada a reproceso F0288', 'Se generó el reproceso sobre el mismo Expediente técnico; un Encargado debe asignarlo.');
  }

  protected finalizar(idCor: string): void {
    const err = this.data.finalizarCorreccionF0302(idCor, {
      descripcion: this.descCorreccion(), huboComplejidad: this.hubo(),
      detalleComplejidad: this.detalle(), observacionTecnica: this.obsTecnica()
    }, this.usuarioActual());
    if (err) { this.toast.error('Revise la corrección', err); return; }
    this.toast.ok('Corrección finalizada', 'Registre la firma del Técnico de Soporte para cerrarla.');
  }

  protected firmar(idCor: string): void {
    const err = this.data.firmarCorreccionF0302(idCor, this.usuarioActual(), this.firmaSoporte());
    if (err) { this.toast.error('No se pudo firmar', err); return; }
    this.firmaSoporte.set('');
    this.toast.ok('Corrección firmada', 'Se generó la constancia; ya puede reenviar el formulario de conformidad.');
  }

  protected reenviarAceptacion(id: string): void {
    const r = this.data.reenviarFormularioAceptacion(id, this.usuarioActual());
    if (typeof r === 'string') { this.toast.error('No se pudo reenviar', r); return; }
    this.toast.ok('Formulario reenviado', 'Se creó un nuevo intento de conformidad y se envió el enlace al usuario final.');
  }
}
