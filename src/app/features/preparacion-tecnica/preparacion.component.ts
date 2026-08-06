import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ChecklistSeccion, Cronometro, ExpedienteTecnico, NivelComplejidad, PreparacionF0288, ReprocesoF0288, ResultadoConsultaAccesorio, RespuestaSiNo } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { CasoActivoService } from '../../core/services/caso-activo.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { BadgeComponent, HelpTipComponent } from '../../shared/ui';
import { BuscarExpedienteTecnicoModalComponent, FilaExpedienteTecnico, filaPreparacion } from '../../shared/buscar-expediente';

@Component({
  selector: 'app-preparacion',
  imports: [FormsModule, RouterLink, BadgeComponent, HelpTipComponent, BuscarExpedienteTecnicoModalComponent],
  styles: `
    .item-row { display: flex; align-items: center; gap: 12px; padding: 9px 4px; border-bottom: 1px dashed var(--line); font-size: 13.5px; }
    .item-row:last-child { border-bottom: 0; }
    .item-row .i-check { flex: none; }
    .item-row .i-check input { width: 17px; height: 17px; accent-color: var(--ok); cursor: pointer; }
    .item-row .i-nombre { flex: 1; color: var(--navy-900); font-weight: 500; }
    .item-row .i-nombre.na { color: var(--tx-3); font-weight: 300; text-decoration: line-through solid var(--line-strong); }
    .item-row .i-evid { font-size: 11.5px; color: var(--blue-600); background: var(--blue-050); border: 1px solid var(--blue-100); border-radius: 999px; padding: 2px 9px; white-space: nowrap; }
    .item-row .i-nota { font-size: 11.5px; color: var(--tx-3); font-style: italic; max-width: 300px; }
    .item-row .i-falta { font-size: 11.5px; color: var(--warn); background: var(--warn-bg); border: 1px solid var(--warn-line); border-radius: 999px; padding: 2px 9px; white-space: nowrap; }
    .item-row .i-cap { flex: none; width: 230px; font-size: 12.5px; padding: 5px 9px; }
    .prog-head { display: flex; align-items: center; gap: 14px; }
    .prog-head .p-num { font-size: 13px; font-weight: 700; color: var(--navy-900); white-space: nowrap; }
    .prog-head .progress { flex: 1; min-width: 140px; }
    .firma-box { display: flex; align-items: center; gap: 14px; background: var(--surface-2); border: 1px dashed var(--line-strong); border-radius: var(--r-md); padding: 14px 16px; }
    .firma-box .f-sello { flex: none; width: 44px; height: 44px; border-radius: 50%; border: 2px solid var(--gold-500); color: var(--gold-600); display: grid; place-items: center; font-family: var(--font-brand); font-size: 15px; }
    .verif-bloque { padding: 12px 0; }
    .verif-bloque + .verif-bloque { border-top: 1px dashed var(--line-strong); }
    .v-preg { font-size: 14px; font-weight: 700; color: var(--navy-900); }
    .radio-line { display: flex; gap: 18px; align-items: center; }
    .radio-line label { display: inline-flex; align-items: center; gap: 7px; cursor: pointer; font-size: 13.5px; font-weight: 600; color: var(--navy-900); }
    .radio-line input[type='radio'] { width: 17px; height: 17px; accent-color: var(--navy-800); cursor: pointer; }
    .acc-item { padding: 9px 0; border-bottom: 1px dashed var(--line); }
    .acc-item:last-child { border-bottom: 0; }
    .acc-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .acc-row .a-check { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
    .acc-row .a-check input { width: 17px; height: 17px; accent-color: var(--navy-800); cursor: pointer; }
    .acc-row .a-nombre { font-size: 13.5px; font-weight: 600; color: var(--navy-900); min-width: 90px; }
    .acc-row .a-num { max-width: 220px; }
    .acc-err { font-size: 12.5px; color: var(--danger); margin: 6px 0 0; }
    .sec-selall { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; color: var(--tx-2); cursor: pointer; margin-left: auto; }
    .sec-selall input { width: 15px; height: 15px; accent-color: var(--navy-800); cursor: pointer; }
    .item-row .i-ver { max-width: 170px; }
    .dest-card { border: 1px solid var(--gold-500); border-left-width: 4px; }
    .dest-card .d-titulo { font-size: 11.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--gold-600); }
    .dest-card h2 { font-size: 17px; margin: 2px 0 0; }
    .dest-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px 18px; margin-top: 10px; }
    .dest-grid .d-k { font-size: 11px; color: var(--tx-3); text-transform: uppercase; letter-spacing: .04em; }
    .dest-grid .d-v { font-size: 13.5px; font-weight: 600; color: var(--navy-900); }
    .mini-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; }
    .mini-cols h4 { font-size: 11.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--tx-3); margin-bottom: 6px; }
    .mini-item { display: block; width: 100%; text-align: left; background: none; border: 0; padding: 5px 0; cursor: pointer; font-family: var(--font); font-size: 12.5px; color: var(--navy-900); border-bottom: 1px dashed var(--line); }
    .mini-item:hover .mono { color: var(--blue-600); }
    .mini-item .sub-cell { font-size: 11.5px; }
    .tec-chip { display: inline-block; font-size: 11.5px; border: 1px solid var(--line-strong); border-radius: 999px; padding: 3px 10px; margin: 2px 4px 2px 0; color: var(--tx-2); }
    .crono-card { border-left: 4px solid var(--line-strong); }
    .crono-card.corriendo { border-left-color: var(--gold-500); }
    .c-titulo { font-size: 11.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--tx-3); }
    .c-timer { font-size: 30px; font-weight: 700; color: var(--navy-900); line-height: 1.2; font-variant-numeric: tabular-nums; }
    .c-timer.ok { color: var(--ok); font-size: 22px; }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Proceso técnico</div>
          <h1>
            Preparación técnica · F0288
            <ui-help texto="El F0288 se completa dentro de SISGOST como checklist digital, no se sube escaneado. Las secciones que no aplican al tipo de equipo se ocultan automáticamente." />
          </h1>
          <p class="page-sub">Checklist digital de preparación del equipo.</p>
        </div>
      </div>

      <!-- Aviso de rollback: los reprocesos se trabajan en su propia pantalla, no aquí -->
      @if (reprocesosPendientes().length) {
        <div class="card card-pad mb-3" style="border-left: 4px solid var(--warn, #c9930a);">
          <div class="row-between" style="flex-wrap: wrap; gap: 16px;">
            <div style="min-width: 0;">
              <b class="small">
                {{ reprocesosPendientes().length }} reproceso(s) F0288 pendiente(s)
                <ui-help texto="Equipos devueltos a Hardware por una falla detectada en F0302. El reproceso corrige la preparación DENTRO del Expediente técnico que el equipo ya tiene: no es una preparación nueva y no crea un expediente nuevo." />
              </b>
              <p class="small muted">
                @for (r of reprocesosPendientes(); track r.id) {
                  <span class="mono">{{ r.id }}</span> · {{ r.tipoFalla }} · {{ r.estado }}@if (!$last) { · }
                }
              </p>
            </div>
            <a class="btn btn-gold" routerLink="/reprocesos-f0288">Atender reprocesos F0288</a>
          </div>
          <span class="hint">El checklist de reproceso, la evidencia, el tiempo trabajado y la firma se registran en «Reprocesos · F0288».</span>
        </div>
      }

      <!-- Último expediente asignado o pendiente: se carga automáticamente, sin obligar a buscar -->
      @if (esDestacada() && prep(); as p) {
        <div class="card card-pad dest-card mb-3">
          <div class="row-between" style="flex-wrap: wrap; gap: 16px;">
            <div style="min-width: 0;">
              <div class="d-titulo">Último expediente asignado</div>
              <h2><span class="mono">{{ p.expedienteTecnico }}</span> <ui-badge [estado]="p.estado" /></h2>
            </div>
            <div class="row" style="gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-gold" (click)="continuar(p)">Continuar preparación F0288</button>
              @if (opciones().length > 1) {
                <button class="btn btn-outline" (click)="buscarAbierto.set(true)">Buscar otros expedientes</button>
              }
            </div>
          </div>
          <div class="dest-grid">
            <div><div class="d-k">Inventario</div><div class="d-v mono">{{ p.datosGenerales.inventario }}</div></div>
            <div><div class="d-k">Equipo</div><div class="d-v">{{ expTec(p)?.tipoExpediente || '—' }}</div></div>
            <div><div class="d-k">Marca y modelo</div><div class="d-v">{{ expTec(p)?.marcaModelo || '—' }}</div></div>
            <div><div class="d-k">Técnico asignado</div><div class="d-v">{{ p.tecnico }}</div></div>
            <div><div class="d-k">Fecha de asignación</div><div class="d-v mono">{{ p.fecha }}</div></div>
            <div><div class="d-k">Unidad</div><div class="d-v">{{ p.unidad }}</div></div>
          </div>
          <span class="hint">Se cargó automáticamente su preparación pendiente más reciente; no necesita buscarla.</span>
        </div>
      } @else {
        <div class="card card-pad mb-3">
          <div class="row-between" style="flex-wrap: wrap; gap: 16px;">
            <div style="min-width: 0;">
              <div class="sec-title" style="margin-bottom: 3px;">Proceso en preparación</div>
              @if (prep(); as p) {
                <p class="small"><b class="mono">{{ p.expedienteTecnico }}</b> — {{ p.estado }} · {{ p.datosGenerales.inventario }} · {{ p.tecnico }}</p>
              } @else {
                <p class="small muted">Ninguno seleccionado.</p>
              }
            </div>
            @if (opciones().length > (prep() ? 1 : 0)) {
              <button class="btn btn-outline btn-sm" (click)="buscarAbierto.set(true)">🔍 Buscar otros expedientes</button>
            }
          </div>
          @if (auth.esTecnico()) {
            <span class="hint">Solo se muestran las preparaciones F0288 asignadas a usted o donde usted participó.</span>
          } @else if (auth.esEncargadoHardware()) {
            <span class="hint">Se muestran las preparaciones F0288 del área de Hardware; puede filtrar por técnico, estado, año o inventario.</span>
          }
        </div>
      }

      <!-- Vista destacada para Encargados: panorama de las preparaciones de su módulo -->
      @if (!auth.esTecnico() && opciones().length > 1) {
        <div class="card card-pad mb-3">
          <div class="mini-cols">
            <div>
              <h4>Últimos expedientes técnicos creados</h4>
              @for (t of ultimosET(); track t.codigo) {
                <button class="mini-item" (click)="elegir(t.codigo)">
                  <span class="mono">{{ t.codigo }}</span>
                  <div class="sub-cell">{{ t.marcaModelo }} · {{ t.fecha }}</div>
                </button>
              } @empty { <p class="small muted">Sin expedientes técnicos.</p> }
            </div>
            <div>
              <h4>Preparaciones F0288 pendientes</h4>
              @for (p of pendientes().slice(0, 3); track p.expedienteTecnico) {
                <button class="mini-item" (click)="elegir(p.expedienteTecnico)">
                  <span class="mono">{{ p.expedienteTecnico }}</span>
                  <div class="sub-cell">{{ p.tecnico }} · {{ p.estado }}</div>
                </button>
              } @empty { <p class="small muted">No hay preparaciones pendientes.</p> }
            </div>
            <div>
              <h4>Preparaciones por técnico</h4>
              @for (t of porTecnico(); track t.tecnico) {
                <span class="tec-chip">{{ t.tecnico }} ({{ t.n }})</span>
              }
            </div>
            <div>
              <h4>Finalizadas recientemente</h4>
              @for (p of finalizadasRecientes(); track p.expedienteTecnico) {
                <button class="mini-item" (click)="elegir(p.expedienteTecnico)">
                  <span class="mono">{{ p.expedienteTecnico }}</span>
                  <div class="sub-cell">{{ p.tecnico }} · {{ p.firma.fecha || p.fecha }}</div>
                </button>
              } @empty { <p class="small muted">Sin preparaciones finalizadas.</p> }
            </div>
          </div>
        </div>
      }

      @if (prep(); as p) {
        <!-- Encabezado del expediente -->
        <div class="card mb-2">
          <div class="card-body">
            <div class="grid grid-2">
              <dl class="dl">
                <dt>Expediente técnico</dt><dd>{{ p.expedienteTecnico }} <span class="muted">· se anexa al expediente único</span></dd>
                <dt>Proviene de</dt><dd>{{ p.datosGenerales.provieneDe }} — {{ p.datosGenerales.referencia }}</dd>
                <dt>Inventario</dt><dd>{{ p.datosGenerales.inventario }} · {{ p.datosGenerales.ram }} · {{ p.datosGenerales.disco }}</dd>
              </dl>
              <dl class="dl">
                <dt>Unidad responsable</dt><dd>{{ p.unidad }}</dd>
                <dt>Técnico</dt><dd>{{ p.tecnico }}</dd>
                <dt>Estado</dt><dd><ui-badge [estado]="p.estado" /></dd>
              </dl>
            </div>
            @if (p.estado !== 'Completada') {
              <div class="alert mt-2">
                <span class="alert-ico">i</span>
                <span>Al generar el F0288 el equipo quedará <b>Preparado</b> y listo para asignación. La relación con la solicitud se hace después, al crear el Expediente único.</span>
              </div>
            }
            <div class="prog-head mt-2">
              <span class="p-num">{{ realizados(p) }} de {{ aplicables(p) }} ítems realizados</span>
              <div class="progress" [class.ok]="progreso(p) === 100"><span [style.width.%]="progreso(p)"></span></div>
              <span class="p-num">{{ progreso(p) }}%</span>
            </div>
          </div>
        </div>

        <!-- Cronómetro de preparación: inicia con «Iniciar preparación» y se detiene al finalizar -->
        <div class="card mb-2 crono-card" [class.corriendo]="enCurso(p)">
          <div class="card-body">
            @if (!p.cronometro) {
              <div class="row-between" style="flex-wrap: wrap; gap: 12px;">
                <div>
                  <div class="c-titulo">Cronómetro de preparación</div>
                  <p class="small muted" style="max-width: 60ch;">
                    La preparación aún no inicia su registro de tiempo. Al presionar
                    <b>Iniciar preparación</b> comienza el cronómetro y quedan registrados la fecha,
                    la hora y el técnico que inició; el evento se anota en la trazabilidad del equipo.
                  </p>
                </div>
                <button class="btn btn-gold btn-lg" [disabled]="p.estado === 'Completada'" (click)="iniciar(p)">▶ Iniciar preparación</button>
              </div>
            } @else if (enCurso(p)) {
              <div class="row-between" style="flex-wrap: wrap; gap: 12px;">
                <div>
                  <div class="c-titulo">Preparación en proceso — cronómetro corriendo</div>
                  <div class="c-timer mono">{{ transcurrido(p.cronometro) }}</div>
                </div>
                <div class="dest-grid" style="margin-top: 0; flex: 1; min-width: 260px;">
                  <div><div class="d-k">Inicio</div><div class="d-v mono">{{ p.cronometro.fechaInicio }} · {{ p.cronometro.horaInicio.slice(0, 5) }}</div></div>
                  <div><div class="d-k">Inició</div><div class="d-v">{{ p.cronometro.iniciadoPor }}</div></div>
                  <div><div class="d-k">Expediente técnico</div><div class="d-v mono">{{ p.expedienteTecnico }}</div></div>
                  <div><div class="d-k">Inventario</div><div class="d-v mono">{{ p.datosGenerales.inventario }}</div></div>
                </div>
              </div>
              <span class="hint">El cronómetro se detiene al presionar «Finalizar preparación y generar F0288»; el tiempo total queda en el historial y en la trazabilidad.</span>
            } @else {
              <div class="row-between" style="flex-wrap: wrap; gap: 12px;">
                <div>
                  <div class="c-titulo">Tiempo de preparación registrado</div>
                  <div class="c-timer mono ok">{{ data.formatoDuracion(p.cronometro.duracionMinutos) }}</div>
                </div>
                <div class="dest-grid" style="margin-top: 0; flex: 1; min-width: 260px;">
                  <div><div class="d-k">Inicio</div><div class="d-v mono">{{ p.cronometro.fechaInicio }} · {{ p.cronometro.horaInicio.slice(0, 5) }}</div></div>
                  <div><div class="d-k">Fin</div><div class="d-v mono">{{ p.cronometro.fechaFin }} · {{ p.cronometro.horaFin.slice(0, 5) }}</div></div>
                  <div><div class="d-k">Complejidad</div><div class="d-v">{{ p.cierre?.nivel || '—' }}</div></div>
                  <div><div class="d-k">Observación</div><div class="d-v">{{ p.cierre?.detalle || p.cierre?.observacion || 'Sin observaciones' }}</div></div>
                </div>
              </div>
            }
          </div>
        </div>

        @if (enCurso(p) || p.estado === 'Completada') {
        <!-- Verificación de falla (solo equipo usado) -->
        @if (p.verificacionFalla; as vf) {
          <div class="card mb-2">
            <div class="card-head">
              <div>
                <h3>
                  Verificación de falla (equipo usado)
                  <ui-help texto="Solo aplica a equipos usados. Responda Sí o No: los campos de detalle se muestran u ocultan dinámicamente según la respuesta." />
                </h3>
                <p class="sub">Responda la pregunta; el detalle aparece solo cuando la respuesta es Sí</p>
              </div>
            </div>
            <div class="card-body">
              <div class="verif-bloque">
                <div class="row-between" style="flex-wrap: wrap; gap: 10px;">
                  <span class="v-preg">¿Se realizó verificación de falla?</span>
                  <div class="radio-line">
                    <label>
                      <input type="radio" name="vfalla" [checked]="vf.respuesta === 'Sí'"
                        [disabled]="p.estado === 'Completada'" (change)="responderFalla(p, 'Sí')" /> Sí
                    </label>
                    <label>
                      <input type="radio" name="vfalla" [checked]="vf.respuesta === 'No'"
                        [disabled]="p.estado === 'Completada'" (change)="responderFalla(p, 'No')" /> No
                    </label>
                  </div>
                </div>
                @if (vf.respuesta === 'Sí') {
                  <div class="grid grid-2 mt-1">
                    <div class="field">
                      <label>Falla encontrada <span class="req">*</span></label>
                      <input class="control" [value]="vf.fallaEncontrada" [disabled]="p.estado === 'Completada'"
                        placeholder="Describa la falla detectada en el equipo…"
                        (input)="campoFalla(p, 'fallaEncontrada', $event)" />
                    </div>
                    <div class="field">
                      <label>Diagnóstico técnico</label>
                      <input class="control" [value]="vf.diagnostico" [disabled]="p.estado === 'Completada'"
                        placeholder="Diagnóstico del técnico…"
                        (input)="campoFalla(p, 'diagnostico', $event)" />
                    </div>
                    <div class="field">
                      <label>Acción realizada <span class="req">*</span></label>
                      <input class="control" [value]="vf.accionRealizada" [disabled]="p.estado === 'Completada'"
                        placeholder="Reparación, reemplazo, ajuste…"
                        (input)="campoFalla(p, 'accionRealizada', $event)" />
                    </div>
                    <div class="field">
                      <label>Observaciones</label>
                      <input class="control" [value]="vf.observaciones" [disabled]="p.estado === 'Completada'"
                        placeholder="Observaciones adicionales (opcional)…"
                        (input)="campoFalla(p, 'observaciones', $event)" />
                    </div>
                  </div>
                } @else if (vf.respuesta === 'No') {
                  <p class="small muted mt-1">No se realizó verificación de falla: los campos de detalle quedan como <b>no aplicables</b> y se ocultan.</p>
                } @else {
                  <span class="hint">Seleccione Sí o No. Con «Sí» se registran la falla encontrada, el diagnóstico, la acción realizada y las observaciones.</span>
                }
              </div>
            </div>
          </div>
        }

        <!-- Verificación de accesorios (solo equipo usado): checkbox por accesorio + búsqueda en base institucional simulada -->
        @if (p.verificacionAccesorios; as va) {
          <div class="card mb-2">
            <div class="card-head">
              <div>
                <h3>
                  Verificación de accesorios (equipo usado)
                  <ui-help texto="Los accesorios dependen del tipo de equipo: CPU usado → Monitor, Teclado, Mouse; Laptop usada → Mouse, Maletín. Al marcar un accesorio se habilita buscar su número de inventario en la base institucional simulada." />
                </h3>
                <p class="sub">Responda la pregunta; el detalle aparece solo cuando la respuesta es Sí</p>
              </div>
            </div>
            <div class="card-body">
              <div class="verif-bloque">
                <div class="row-between" style="flex-wrap: wrap; gap: 10px;">
                  <span class="v-preg">¿Se verificaron accesorios del equipo?</span>
                  <div class="radio-line">
                    <label>
                      <input type="radio" name="vacc" [checked]="va.respuesta === 'Sí'"
                        [disabled]="p.estado === 'Completada'" (change)="responderAccesorios(p, 'Sí')" /> Sí
                    </label>
                    <label>
                      <input type="radio" name="vacc" [checked]="va.respuesta === 'No'"
                        [disabled]="p.estado === 'Completada'" (change)="responderAccesorios(p, 'No')" /> No
                    </label>
                  </div>
                </div>
                @if (va.respuesta === 'Sí') {
                  <div class="mt-1">
                    @for (a of va.accesorios; track a.nombre) {
                      <div class="acc-item">
                        <div class="acc-row">
                          <label class="a-check">
                            <input type="checkbox" [checked]="a.seleccionado" [disabled]="p.estado === 'Completada'"
                              (change)="marcarAcc(p, a.nombre, $event)" />
                            <span class="a-nombre">{{ a.nombre }}</span>
                          </label>
                          @if (a.seleccionado) {
                            <input class="control mono a-num" [value]="a.numeroInventario" [disabled]="p.estado === 'Completada'"
                              [placeholder]="a.familiaEsperada + '-XXXX-' + a.sufijoEsperado"
                              (input)="numAcc(p, a.nombre, $event)" />
                            <button type="button" class="btn btn-outline btn-sm"
                              [disabled]="p.estado === 'Completada' || !a.numeroInventario.trim()"
                              (click)="buscarAcc(p, a.nombre)">Buscar accesorio</button>
                            <ui-help [texto]="'El accesorio se valida por familia (' + a.familiaEsperada + ') y sufijo (-' + a.sufijoEsperado + '), no por el número del equipo principal: el correlativo XXXX del accesorio puede ser distinto al del equipo.'" />
                            @if (a.resultadoBusqueda) { <ui-badge [estado]="a.resultadoBusqueda" /> }
                          }
                        </div>
                        @if (a.seleccionado && a.resultadoBusqueda === 'Encontrado') {
                          <div class="dest-grid" style="margin-top: 8px;">
                            <div><div class="d-k">Marca</div><div class="d-v">{{ a.marca }}</div></div>
                            <div><div class="d-k">Modelo</div><div class="d-v">{{ a.modelo }}</div></div>
                            <div><div class="d-k">Serie</div><div class="d-v mono">{{ a.serie }}</div></div>
                            <div><div class="d-k">Estado físico</div><div class="d-v">{{ a.estadoFisico }}</div></div>
                          </div>
                          @if (a.verificadoPor) {
                            <p class="small muted mt-1">Verificado por {{ a.verificadoPor }} · {{ a.fechaVerificacion }}</p>
                          }
                        } @else if (a.seleccionado && a.resultadoBusqueda) {
                          <p class="acc-err">{{ mensajeResultadoAcc(a.resultadoBusqueda, a.familiaEsperada === '2201-00-920') }}</p>
                        }
                        @if (a.seleccionado) {
                          <div class="field mt-1">
                            <label>Observación del accesorio (opcional)</label>
                            <input class="control" [value]="a.observacion" [disabled]="p.estado === 'Completada'"
                              placeholder="Observación de este accesorio (opcional)…"
                              (input)="obsAcc(p, a.nombre, $event)" />
                          </div>
                        }
                      </div>
                    }
                    <div class="field mt-1">
                      <label>Observaciones generales</label>
                      <input class="control" [value]="va.observaciones" [disabled]="p.estado === 'Completada'"
                        placeholder="Observaciones adicionales sobre los accesorios (opcional)…"
                        (input)="obsAccesorios(p, $event)" />
                    </div>
                  </div>
                } @else if (va.respuesta === 'No') {
                  <p class="small muted mt-1">No se verificaron accesorios: el detalle de los accesorios queda oculto como <b>no aplicable</b>.</p>
                } @else {
                  <span class="hint">Seleccione Sí o No. Con «Sí» se muestra el detalle de los accesorios correspondientes al tipo de equipo (CPU o Laptop).</span>
                }
              </div>
            </div>
          </div>
        }

        <!-- Secciones del checklist -->
        @for (sec of p.secciones; track sec.titulo; let first = $first) {
          <details class="acc" [open]="first">
            <summary>
              {{ sec.titulo }}
              <ui-badge [estado]="seccionCompleta(sec) ? 'Completada' : 'En curso'" />
              @if (aplicablesSeccion(sec) > 0) {
                <label class="sec-selall" (click)="$event.stopPropagation()">
                  <input type="checkbox" [checked]="estadoSelAll(sec) === 'todos'"
                    [indeterminate]="estadoSelAll(sec) === 'parcial'"
                    [disabled]="p.estado === 'Completada'"
                    (click)="$event.stopPropagation()"
                    (change)="toggleSeccion(p, sec, $event)" /> Seleccionar todo
                </label>
              }
              <span class="acc-arrow">▶</span>
            </summary>
            <div class="acc-body">
              @for (item of sec.items; track item.nombre) {
                <div class="item-row">
                  <span class="i-check">
                    @if (item.estado === 'Realizado' || item.estado === 'Pendiente') {
                      <input type="checkbox" [checked]="item.estado === 'Realizado'"
                        [disabled]="p.estado === 'Completada'"
                        (change)="marcar(p.expedienteTecnico, sec.titulo, item.nombre, $event)" />
                    }
                  </span>
                  <span class="i-nombre" [class.na]="item.estado === 'No aplica' || item.estado === 'No solicitado'">{{ item.nombre }}</span>
                  @if (item.codigoSoftware; as cod) {
                    <select class="control i-ver" [disabled]="p.estado === 'Completada' || item.estado !== 'Realizado'"
                      (change)="seleccionarVersion(p, sec.titulo, item, $event)">
                      <option value="" [selected]="!item.versionSeleccionada">Seleccione versión…</option>
                      @for (v of versionesDe(cod); track v) {
                        <option [value]="v" [selected]="item.versionSeleccionada === v">{{ v }}</option>
                      }
                    </select>
                  }
                  @if (item.nota) { <span class="i-nota">{{ item.nota }}</span> }
                  @if (item.evidencia) {
                    <span class="i-evid">{{ item.evidencia }}</span>
                    <ui-help texto="La evidencia no reemplaza el checklist; solo respalda ítems técnicos específicos." />
                  } @else if (item.requiereEvidencia && p.estado !== 'Completada') {
                    @if (item.estado === 'Realizado') {
                      <input class="control i-cap" [ngModel]="textoCaptura(sec.titulo, item.nombre)"
                        (ngModelChange)="escribirCaptura(sec.titulo, item.nombre, $event)"
                        placeholder="Captura de evidencia: archivo o referencia…" />
                      <button class="btn btn-outline btn-sm" (click)="agregarCaptura(p, sec.titulo, item.nombre)">Agregar captura</button>
                      <ui-help [texto]="'Sin esta captura no se puede finalizar la preparación ni generar el F0288. Al desmarcar «' + item.nombre + '» la captura se retira.'" />
                    } @else {
                      <span class="i-falta">Captura obligatoria al marcarlo</span>
                    }
                  }
                  <ui-badge [estado]="item.estado" />
                </div>
              }
            </div>
          </details>
        }

        <!-- Secciones ocultas por checklist dinámico -->
        @if (p.seccionesOcultas.length > 0) {
          <details class="acc subtle mt-1">
            <summary class="muted">Secciones ocultas por el checklist dinámico ({{ p.seccionesOcultas.length }}) <span class="acc-arrow">▶</span></summary>
            <div class="acc-body">
              @for (o of p.seccionesOcultas; track o.nombre) {
                <p class="small"><b>{{ o.nombre }}</b> — <span class="muted">{{ o.motivo }}</span></p>
              }
            </div>
          </details>
        }

        <!-- Evidencias -->
        <div class="card mt-2">
          <div class="card-head">
            <div>
              <h3>
                Evidencias técnicas complementarias
                <ui-help texto="La evidencia no reemplaza el checklist; respalda los ítems técnicos que la exigen. En el F0288 son obligatorias las capturas de Antivirus y de OCS Inventory." />
              </h3>
            </div>
          </div>
          <div class="card-body table-wrap">
            <table class="tbl">
              <thead><tr><th>Ítem</th><th>Tipo de evidencia</th><th>Cargada por</th><th>Fecha</th><th>Estado</th></tr></thead>
              <tbody>
                @for (e of p.evidencias; track e.item) {
                  <tr>
                    <td class="main-cell">{{ e.item }}</td>
                    <td>{{ e.tipo }}</td>
                    <td>{{ e.cargadaPor || '—' }}</td>
                    <td class="mono">{{ e.fecha || '—' }}</td>
                    <td><ui-badge [estado]="e.estado" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Cierre técnico: complejidad y observaciones (obligatorio al finalizar) -->
        @if (p.estado !== 'Completada') {
          <div class="card mt-2">
            <div class="card-head">
              <div>
                <h3>
                  Cierre de la preparación: complejidad y observaciones
                  <ui-help texto="Al finalizar la preparación se registra el nivel de complejidad y si hubo complejidad. Con «Sí», el detalle es obligatorio; con «No», puede dejar una observación opcional." />
                </h3>
                <p class="sub">Se solicita al finalizar; queda en el historial técnico y en la trazabilidad</p>
              </div>
            </div>
            <div class="card-body">
              <div class="grid grid-2">
                <div class="field">
                  <label>Nivel de complejidad de preparación <span class="req">*</span></label>
                  <select class="control" [(ngModel)]="cNivel">
                    <option value="Sin complejidad">Sin complejidad</option>
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                  </select>
                </div>
                <div class="field">
                  <label>¿Hubo complejidad durante la preparación? <span class="req">*</span></label>
                  <div class="radio-line" style="padding-top: 8px;">
                    <label><input type="radio" name="chubo" [checked]="cHubo() === 'Sí'" (change)="cHubo.set('Sí')" /> Sí</label>
                    <label><input type="radio" name="chubo" [checked]="cHubo() === 'No'" (change)="cHubo.set('No')" /> No</label>
                  </div>
                </div>
              </div>
              @if (cHubo() === 'Sí') {
                <div class="field">
                  <label>Detalle de complejidad <span class="req">*</span></label>
                  <textarea class="control" rows="2" [(ngModel)]="cDetalle"
                    placeholder="Ej.: Se presentó lentitud durante instalación de actualizaciones; se detectó falla en disco y fue necesario reemplazo…"></textarea>
                </div>
              } @else if (cHubo() === 'No') {
                <div class="field">
                  <label>Observación técnica (opcional)</label>
                  <textarea class="control" rows="2" [(ngModel)]="cObs"
                    placeholder="Observaciones del cierre de la preparación (opcional)…"></textarea>
                </div>
              } @else {
                <span class="hint">Responda Sí o No. Con «Sí» el detalle de complejidad es obligatorio; con «No» la observación es opcional.</span>
              }
            </div>
          </div>
        }

        <!-- Firma y generación -->
        <div class="card mt-2">
          <div class="card-body">
            <div class="row-between">
              <div class="firma-box">
                <span class="f-sello">{{ iniciales(p.firma.quien) }}</span>
                <div>
                  <div style="font-weight: 700; color: var(--navy-900);">Firma del técnico que preparó</div>
                  <div class="small muted">{{ p.firma.quien }} · {{ p.firma.detalle }}</div>
                  @if (p.firma.estado === 'Firmado') {
                    <div class="small muted mono">Firmado electrónicamente el {{ p.firma.fecha }}@if (p.firma.hora) { · {{ p.firma.hora }} }</div>
                  }
                </div>
                <ui-badge [estado]="p.firma.estado" />
              </div>
              <div style="display: flex; gap: 10px;">
                <button class="btn" [disabled]="p.estado === 'Completada'" (click)="guardar()">Guardar preparación</button>
                <button class="btn btn-gold btn-lg" [disabled]="p.estado === 'Completada'" (click)="generar(p)">
                  {{ p.estado === 'Completada' ? 'F0288 generado' : 'Finalizar preparación y generar F0288' }}
                </button>
              </div>
            </div>
          </div>
        </div>
        } @else if (p.estado === 'Cerrada') {
          <div class="card mt-2 card-pad">
            <div class="alert warn">
              <span class="alert-ico">!</span>
              <span><b>Esta preparación quedó cerrada</b> por el descargo del equipo: es solo consulta y ya no puede reutilizarse para una nueva preparación.</span>
            </div>
          </div>
        } @else {
          <div class="card mt-2 card-pad">
            <div class="alert">
              <span class="alert-ico">i</span>
              <span><b>Debe iniciar la preparación para habilitar el checklist F0288.</b> El checklist, las verificaciones y el cierre se muestran una vez que presiona «Iniciar preparación».</span>
            </div>
          </div>
        }
      } @else {
        <div class="card card-pad">
          @if (data.preparacionesVisibles().length === 0) {
            <p class="muted">
              @if (auth.esTecnico()) {
                No tiene preparaciones F0288 asignadas. Cuando un Encargado le asigne una preparación, aparecerá aquí.
              } @else {
                No hay preparaciones F0288 registradas en su módulo.
              }
            </p>
          } @else {
            <p class="muted">No tiene preparaciones F0288 pendientes en este momento.</p>
            <div class="row mt-2">
              <button class="btn btn-outline btn-sm" (click)="buscarAbierto.set(true)">Ver historial de preparaciones</button>
            </div>
          }
        </div>
      }

      @if (buscarAbierto()) {
        <app-buscar-expediente-tecnico
          [filas]="opciones()"
          titulo="Buscar preparación F0288"
          sub="Busque por código, inventario, marca, modelo, año o técnico; filtre por estado de preparación"
          (seleccionar)="elegir($event)"
          (cerrar)="buscarAbierto.set(false)" />
      }
    </div>
  `
})
export class PreparacionComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly casoActivo = inject(CasoActivoService);

  protected seleccion = signal('');
  protected buscarAbierto = signal(false);

  // ---------- Cronómetro y cierre técnico ----------
  /** Tic de 1 s para refrescar el cronómetro visible mientras la preparación está en proceso. */
  private readonly tick = signal(Date.now());
  protected cNivel = signal<NivelComplejidad>('Sin complejidad');
  protected cHubo = signal<RespuestaSiNo>('');
  protected cDetalle = signal('');
  protected cObs = signal('');

  /**
   * Reprocesos F0288 pendientes que este usuario puede ver. Se trabajan en su propia pantalla:
   * aquí solo se avisa, para que un técnico que entra a preparar no pase por alto un equipo que
   * volvió de configuración.
   */
  protected readonly reprocesosPendientes = computed<ReprocesoF0288[]>(() => {
    const visibles = new Set(this.data.reprocesosVisibles().map((r) => r.id));
    return this.data.reprocesosPendientes().filter((r) => visibles.has(r.id));
  });

  constructor() {
    const intervalo = setInterval(() => this.tick.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(intervalo));
  }

  protected enCurso(p: PreparacionF0288): boolean {
    return !!p.cronometro && p.cronometro.duracionMinutos === null && p.estado !== 'Completada';
  }

  /** Tiempo transcurrido HH:MM:SS del cronómetro en curso (se actualiza cada segundo). */
  protected transcurrido(c: Cronometro): string {
    this.tick();
    const inicio = new Date(`${c.fechaInicio}T${c.horaInicio}`).getTime();
    const seg = isNaN(inicio) ? 0 : Math.max(0, Math.floor((Date.now() - inicio) / 1000));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(Math.floor(seg / 3600))}:${pad(Math.floor((seg % 3600) / 60))}:${pad(seg % 60)}`;
  }

  protected iniciar(p: PreparacionF0288): void {
    const u = this.auth.usuario();
    const error = this.data.iniciarPreparacion(p.expedienteTecnico, `${u?.nombre} — ${u?.rol}`);
    if (!error) {
      this.toast.ok('Cronómetro F0288 iniciado', 'Quedaron registrados la fecha, la hora y el técnico que inició; el evento se anotó en la trazabilidad.');
    } else {
      this.toast.error('No se puede iniciar la preparación', error);
    }
  }

  /** Catálogo de búsqueda: solo las preparaciones visibles para el rol conectado. */
  protected readonly opciones = computed<FilaExpedienteTecnico[]>(() =>
    this.data.preparacionesVisibles().map((p) => filaPreparacion(this.data, p))
  );

  /** Preparaciones pendientes o en proceso del usuario conectado, de la más reciente a la más antigua. */
  protected readonly pendientes = computed(() =>
    this.data.preparacionesVisibles()
      .filter((p) => p.estado !== 'Completada')
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  );

  /** Último expediente asignado o pendiente: se carga automáticamente al entrar. */
  protected readonly destacada = computed(() => this.pendientes()[0]);

  /**
   * El sistema no obliga a buscar: primero la selección manual, luego la preparación
   * pendiente más reciente del usuario, y como último recurso el caso activo.
   */
  protected readonly prep = computed(() => {
    const visibles = this.data.preparacionesVisibles();
    const sel = this.seleccion();
    if (sel) return visibles.find((p) => p.expedienteTecnico === sel);
    if (visibles.length === 1) return visibles[0];
    return this.destacada()
      ?? visibles.find((p) => p.expedienteTecnico === this.data.expTecnicoDe(this.casoActivo.expediente())?.codigo);
  });

  /** La tarjeta destacada se muestra mientras el expediente cargado sea el pendiente más reciente. */
  protected readonly esDestacada = computed(() => {
    const d = this.destacada();
    return !this.seleccion() && !!d && this.prep() === d;
  });

  // ---------- Vista destacada para Encargados ----------
  protected readonly ultimosET = computed(() =>
    [...this.data.expedientesTecnicosVisibles()].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 3)
  );
  protected readonly finalizadasRecientes = computed(() =>
    this.data.preparacionesVisibles()
      .filter((p) => p.estado === 'Completada')
      .sort((a, b) => (b.firma.fecha || b.fecha).localeCompare(a.firma.fecha || a.fecha))
      .slice(0, 3)
  );
  protected readonly porTecnico = computed(() => {
    const conteo = new Map<string, number>();
    for (const p of this.data.preparacionesVisibles()) {
      const t = p.tecnico.split('—')[0].trim();
      conteo.set(t, (conteo.get(t) ?? 0) + 1);
    }
    return [...conteo.entries()].map(([tecnico, n]) => ({ tecnico, n }));
  });

  protected expTec(p: PreparacionF0288): ExpedienteTecnico | undefined {
    return this.data.expedientesTecnicos().find((x) => x.codigo === p.expedienteTecnico);
  }

  protected elegir(codigoTec: string): void {
    this.seleccion.set(codigoTec);
    this.buscarAbierto.set(false);
  }

  /** «Continuar preparación F0288»: fija el expediente destacado y pasa a la vista de trabajo. */
  protected continuar(p: PreparacionF0288): void {
    this.seleccion.set(p.expedienteTecnico);
  }

  protected aplicables(p: { secciones: { items: { estado: string }[] }[] }): number {
    return p.secciones.flatMap((s) => s.items).filter((i) => i.estado === 'Realizado' || i.estado === 'Pendiente').length;
  }
  protected realizados(p: { secciones: { items: { estado: string }[] }[] }): number {
    return p.secciones.flatMap((s) => s.items).filter((i) => i.estado === 'Realizado').length;
  }
  protected progreso(p: { secciones: { items: { estado: string }[] }[] }): number {
    const total = this.aplicables(p);
    return total === 0 ? 100 : Math.round((this.realizados(p) / total) * 100);
  }
  protected seccionCompleta(sec: { items: { estado: string }[] }): boolean {
    return sec.items.every((i) => i.estado !== 'Pendiente');
  }
  protected iniciales(quien: string): string {
    return quien.split('·')[0].trim().split(' ').map((w) => w[0]).join('').replace('.', '').slice(0, 3);
  }

  protected marcar(codigoTec: string, seccion: string, item: string, ev: Event): void {
    const checked = (ev.target as HTMLInputElement).checked;
    const u = this.auth.usuario();
    this.data.marcarItemF0288(codigoTec, seccion, item, checked ? 'Realizado' : 'Pendiente', `${u?.nombre} — ${u?.rol}`);
  }

  // ---------- Verificaciones Sí/No (equipo usado) ----------
  protected responderFalla(p: PreparacionF0288, respuesta: RespuestaSiNo): void {
    this.data.actualizarVerificacionFalla(p.expedienteTecnico, { respuesta });
  }
  protected campoFalla(p: PreparacionF0288, campo: 'fallaEncontrada' | 'diagnostico' | 'accionRealizada' | 'observaciones', ev: Event): void {
    this.data.actualizarVerificacionFalla(p.expedienteTecnico, { [campo]: (ev.target as HTMLInputElement).value });
  }
  protected responderAccesorios(p: PreparacionF0288, respuesta: RespuestaSiNo): void {
    this.data.actualizarVerificacionAccesorios(p.expedienteTecnico, { respuesta });
  }
  protected marcarAcc(p: PreparacionF0288, nombre: string, ev: Event): void {
    const u = this.auth.usuario();
    this.data.seleccionarAccesorio(p.expedienteTecnico, nombre, (ev.target as HTMLInputElement).checked, `${u?.nombre} — ${u?.rol}`);
  }
  protected numAcc(p: PreparacionF0288, nombre: string, ev: Event): void {
    this.data.escribirNumeroAccesorio(p.expedienteTecnico, nombre, (ev.target as HTMLInputElement).value);
  }
  protected obsAcc(p: PreparacionF0288, nombre: string, ev: Event): void {
    this.data.escribirObservacionAccesorio(p.expedienteTecnico, nombre, (ev.target as HTMLInputElement).value);
  }
  protected buscarAcc(p: PreparacionF0288, nombre: string): void {
    const u = this.auth.usuario();
    this.data.consultarAccesorio(p.expedienteTecnico, nombre, `${u?.nombre} — ${u?.rol}`);
  }
  /** `esLaptop` diferencia el aviso de familia equivocada: en una laptop el mensaje lo dice tal cual. */
  protected mensajeResultadoAcc(r: ResultadoConsultaAccesorio | '', esLaptop = false): string {
    switch (r) {
      case 'No encontrado': return 'No se encontró información del accesorio en la base institucional simulada.';
      case 'Formato inválido': return 'El número de inventario del accesorio no tiene un formato válido.';
      case 'No corresponde al equipo': return esLaptop
        ? 'El accesorio no corresponde a una Laptop.'
        : 'El accesorio no corresponde al tipo de equipo seleccionado.';
      case 'No corresponde al accesorio': return 'El número ingresado no corresponde al accesorio seleccionado.';
      case 'Asociado a otro equipo': return 'Este accesorio ya se encuentra asociado a otro equipo activo. Verifique antes de continuar.';
      default: return '';
    }
  }
  protected obsAccesorios(p: PreparacionF0288, ev: Event): void {
    this.data.actualizarVerificacionAccesorios(p.expedienteTecnico, { observaciones: (ev.target as HTMLInputElement).value });
  }

  // ---------- Checklist F0288: «Seleccionar todo» por sección y versión de software ----------
  protected aplicablesSeccion(sec: ChecklistSeccion): number {
    return sec.items.filter((i) => i.estado === 'Realizado' || i.estado === 'Pendiente').length;
  }
  protected estadoSelAll(sec: ChecklistSeccion): 'todos' | 'ninguno' | 'parcial' {
    const aplicables = sec.items.filter((i) => i.estado === 'Realizado' || i.estado === 'Pendiente');
    if (aplicables.length === 0) return 'ninguno';
    const marcados = aplicables.filter((i) => i.estado === 'Realizado').length;
    if (marcados === 0) return 'ninguno';
    if (marcados === aplicables.length) return 'todos';
    return 'parcial';
  }
  protected toggleSeccion(p: PreparacionF0288, sec: ChecklistSeccion, ev: Event): void {
    const u = this.auth.usuario();
    const marcar = (ev.target as HTMLInputElement).checked;
    this.data.marcarSeccionCompletaF0288(p.expedienteTecnico, sec.titulo, marcar ? 'Realizado' : 'Pendiente', `${u?.nombre} — ${u?.rol}`);
  }
  protected versionesDe(codigoSoftware: string): string[] {
    return this.data.softwareCatalogoDe(codigoSoftware)?.versionesPermitidas ?? [];
  }
  protected seleccionarVersion(p: PreparacionF0288, seccion: string, item: { nombre: string }, ev: Event): void {
    const version = (ev.target as HTMLSelectElement).value;
    if (!version) return;
    const u = this.auth.usuario();
    this.data.seleccionarVersionItemF0288(p.expedienteTecnico, seccion, item.nombre, version, `${u?.nombre} — ${u?.rol}`);
  }

  // Captura de evidencia de los ítems que la exigen (Antivirus y OCS Inventory). El texto en
  // edición se guarda por ítem —clave «sección||ítem»— para no mezclar dos capturas a la vez.
  protected capturas = signal<Record<string, string>>({});
  private claveCaptura(seccion: string, item: string): string {
    return `${seccion}||${item}`;
  }
  protected textoCaptura(seccion: string, item: string): string {
    return this.capturas()[this.claveCaptura(seccion, item)] ?? '';
  }
  protected escribirCaptura(seccion: string, item: string, valor: string): void {
    this.capturas.update((m) => ({ ...m, [this.claveCaptura(seccion, item)]: valor }));
  }
  protected agregarCaptura(p: PreparacionF0288, seccion: string, item: string): void {
    const u = this.auth.usuario();
    const error = this.data.registrarEvidenciaItemF0288(
      p.expedienteTecnico, seccion, item, this.textoCaptura(seccion, item), `${u?.nombre} — ${u?.rol}`);
    if (error) {
      this.toast.error('No se pudo registrar la captura', error);
      return;
    }
    this.escribirCaptura(seccion, item, '');
    this.toast.ok('Captura de evidencia registrada',
      `La evidencia de ${item} quedó en el F0288 y en la trazabilidad del equipo.`);
  }

  protected guardar(): void {
    this.toast.ok('Avance guardado', 'El avance de la preparación técnica quedó registrado. Puede continuar más tarde.');
  }

  protected generar(p: PreparacionF0288): void {
    const u = this.auth.usuario();
    const error = this.data.cerrarPreparacion(p.expedienteTecnico, `${u?.nombre} — ${u?.rol}`, {
      nivel: this.cNivel(), hubo: this.cHubo(), detalle: this.cDetalle(), observacion: this.cObs()
    });
    if (!error) {
      this.toast.ok('Preparación F0288 finalizada — equipo preparado',
        `Cronómetro detenido: tiempo total, complejidad y observación quedaron en el historial y en la trazabilidad. El documento quedó firmado y el equipo está listo para asignación.`);
      this.cHubo.set('');
      this.cDetalle.set('');
      this.cObs.set('');
      this.cNivel.set('Sin complejidad');
    } else {
      this.toast.error('No se puede finalizar la preparación', error);
    }
  }
}
