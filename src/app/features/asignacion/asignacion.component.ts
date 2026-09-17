import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { CasoActivoService } from '../../core/services/caso-activo.service';
import { Equipo } from '../../core/models/models';
import { BadgeComponent, HelpTipComponent, MarcaModeloPipe, ModalComponent, TipoRequerimientoPipe } from '../../shared/ui';
import { IconComponent } from '../../shared/icon';

/**
 * Asignación de equipo a usuario final. Solo se asignan equipos del Inventario de Hardware
 * que ya están preparados: con Expediente técnico completado y F0288 finalizado.
 */
@Component({
  selector: 'app-asignacion',
  imports: [FormsModule, RouterLink, BadgeComponent, HelpTipComponent, MarcaModeloPipe, ModalComponent,
    TipoRequerimientoPipe, IconComponent],
  styles: `
    .resumen-eq { background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 14px 16px; }
    .resumen-eq .eq-nombre { font-size: 17px; font-weight: 700; color: var(--navy-900); }
    .resumen-eq .eq-datos { font-size: 12.5px; color: var(--tx-2); margin-top: 3px; }
    .fase-tbl { font-size: 12.5px; }
    .busq-filtros { display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin-bottom: 14px; }
    @media (max-width: 800px) { .busq-filtros { grid-template-columns: 1fr; } }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .chip-f {
      border: 1px solid var(--line-strong); background: var(--surface); color: var(--tx-2);
      border-radius: 999px; padding: 5px 13px; font-size: 12px; cursor: pointer;
    }
    .chip-f:hover { border-color: var(--blue-500); }
    .chip-f.on { background: var(--navy-900); border-color: var(--navy-900); color: #fff; }
    .det-fila { background: var(--surface-2); }
    .datos { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 6px 20px; }
    .datos span { display: block; font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--tx-3); }
    .datos b { font-size: 13px; font-weight: 500; color: var(--navy-900); display: block; }
    .datos b + b { font-weight: 400; color: var(--tx-2); font-size: 12.5px; }
    .resumen-asig { background: var(--surface-2); border-radius: var(--r-md); padding: 12px 16px; margin-top: 14px; }
    .resumen-asig .r-t { font-size: 11px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--tx-3); margin-bottom: 6px; }
    .valida { margin-top: 12px; }
    /* Las dos acciones de la pantalla, una al lado de la otra. */
    .acciones { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
    .acc-op {
      display: flex; align-items: center; gap: 11px; text-align: left; cursor: pointer;
      border: 1px solid var(--line-strong); background: var(--surface); border-radius: var(--r-md);
      padding: 13px 16px; color: var(--tx-2);
    }
    .acc-op:hover { border-color: var(--blue-500); }
    .acc-op.on { border-color: var(--navy-900); box-shadow: 0 0 0 2px var(--blue-100); color: var(--navy-900); }
    .acc-op b { display: block; font-size: 13.5px; color: var(--navy-900); }
    .acc-op small { font-size: 11.5px; color: var(--tx-3); }
    .chk { font-size: 13px; margin-top: 6px; display: flex; align-items: center; gap: 7px; }
    .chk.ok { color: var(--ok); }
    .chk.pend { color: var(--tx-3); }
    .chk b { color: var(--navy-900); }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Gestión</div>
          <h1>
            Asignación de equipo
            <ui-help texto="Solo pueden asignarse equipos preparados: con Expediente técnico completado, F0288 finalizado y sin asignación previa. El responsable de asignación se toma del usuario conectado." />
          </h1>
          <p class="page-sub">Selección del equipo preparado y asignación al usuario final.</p>
        </div>
      </div>

      @if (!esEncargado()) {
        <div class="alert warn mb-2">
          <span class="alert-ico">!</span>
          <span><b>No tiene permisos para realizar asignaciones.</b> Esta acción corresponde a un Encargado. La pantalla se muestra en modo consulta.</span>
        </div>
      }

      <!--
        Dos acciones separadas: asignar por primera vez y corregir una asignación ya hecha. Se
        separan porque no comparten reglas: la corrección exige motivo y depende de cuánto proceso
        haya encima del equipo.
      -->
      <div class="acciones mb-3">
        <button class="acc-op" [class.on]="modo() === 'nueva'" (click)="modo.set('nueva')">
          <ui-icon name="plus" [size]="16" />
          <span><b>Nueva asignación</b><small>Requerimientos que todavía no tienen equipo</small></span>
        </button>
        <button class="acc-op" [class.on]="modo() === 'modificar'" (click)="modo.set('modificar')">
          <ui-icon name="edit" [size]="16" />
          <span><b>Modificar asignación existente</b><small>Solo para corregir errores administrativos</small></span>
        </button>
      </div>

      @if (modo() === 'nueva') {
      <div class="card mb-3">
        <div class="card-head">
          <div>
            <h2>Nueva asignación</h2>
            <p class="sub">Solo requerimientos sin equipo asociado, y equipos preparados del tipo que piden</p>
          </div>
        </div>
        <div class="card-body">
          <div class="form-grid">
            <!-- Paso 1: el requerimiento se elige en un catálogo, no en un desplegable largo -->
            <div class="field full">
              <label>Requerimiento <span class="req">*</span></label>
              @if (sol(); as s) {
                <div class="resumen-eq">
                  <div class="row-between" style="flex-wrap: wrap; gap: 12px;">
                    <div>
                      <div class="eq-nombre mono">{{ s.expediente }}</div>
                      <div class="eq-datos">{{ s.tipoEquipo | tipoRequerimiento }} · {{ s.destinatario }} — {{ s.unidadDestino }}</div>
                      <div class="eq-datos">{{ s.correoDestinatario }}</div>
                    </div>
                    <div class="row" style="flex-direction: column; align-items: flex-end; gap: 8px;">
                      <ui-badge [estado]="s.estado" />
                      <button class="btn btn-outline btn-sm" (click)="abrirBusquedaSol()" [disabled]="!esEncargado()">Cambiar requerimiento</button>
                    </div>
                  </div>
                </div>
                <span class="hint">Requerimiento seleccionado correctamente. Ahora seleccione un equipo preparado compatible.</span>
              } @else {
                <div class="row">
                  <button class="btn btn-primary" (click)="abrirBusquedaSol()" [disabled]="!esEncargado()">
                    <ui-icon name="search" [size]="15" /> Buscar requerimiento
                  </button>
                  <span class="hint">Seleccione un requerimiento pendiente para iniciar la asignación del equipo.</span>
                </div>
              }
            </div>

            <!-- Paso 2: equipo preparado, ya filtrado por el tipo que pide el requerimiento -->
            @if (sol(); as s) {
              <div class="field full">
                <label>
                  Equipo preparado <span class="req">*</span>
                  <ui-help texto="Solo equipos del tipo que pide el requerimiento que YA tienen su Expediente único abierto: en el DER la asignación cuelga del Expediente único, así que primero se crea el expediente y después se asigna el equipo al usuario final. Además: preparados, con F0288 finalizado y firmado, sin asignación activa y sin reproceso ni falla abierta." />
                </label>
                @if (equipo(); as e) {
                  <div class="resumen-eq">
                    <div class="row-between" style="flex-wrap: wrap; gap: 12px;">
                      <div>
                        <div class="eq-nombre">{{ e | marcaModelo }}</div>
                        <div class="eq-datos">
                          {{ e.tipo === 'Desktop' ? 'CPU' : 'Laptop' }} · inventario {{ e.inventario }} ·
                          {{ e.procesador }} · {{ e.ram.split('·')[0].trim() }}
                        </div>
                        <div class="eq-datos">
                          Expediente técnico <b class="mono">{{ expTecEquipo()?.codigo }}</b> ·
                          F0288 <ui-badge [estado]="estadoF0288(e.inventario)" /> ·
                          <ui-badge estado="Preparado" />
                        </div>
                      </div>
                      <div class="row" style="flex-direction: column; align-items: flex-end; gap: 8px;">
                        <ui-badge [estado]="e.condicion" />
                        <button class="btn btn-outline btn-sm" (click)="abrirBusqueda()" [disabled]="!esEncargado()">Cambiar equipo</button>
                      </div>
                    </div>
                  </div>
                } @else {
                  <div class="row">
                    <button class="btn btn-primary" (click)="abrirBusqueda()" [disabled]="!esEncargado()">
                      <ui-icon name="search" [size]="15" /> Buscar equipo preparado
                    </button>
                    <span class="hint">
                      Solo {{ s.tipoEquipo === 'Desktop' ? 'CPU' : 'laptops' }} con F0288 firmado, sin asignación
                      y <b>con su Expediente único ya creado</b>. Si el equipo que busca no aparece, lo que falta
                      es su Expediente único: créelo en <a routerLink="/expediente-unico">Expediente único</a>.
                    </span>
                  </div>
                }
              </div>
            }

            <div class="field">
              <label>
                Responsable de asignación
                <ui-help texto="Se llena automáticamente con el usuario conectado. Los técnicos no realizan asignaciones: esta acción corresponde a un Encargado." />
              </label>
              <input class="control" readonly [value]="responsableTxt()" />
              @if (!esEncargado()) { <span class="error">Campo bloqueado: su rol no realiza asignaciones.</span> }
            </div>

            <div class="field">
              <label>Condición del equipo</label>
              <div class="opt-row">
                <span class="opt" [class.on]="equipo()?.condicion === 'Nuevo'"><input type="radio" disabled [checked]="equipo()?.condicion === 'Nuevo'" /> Nuevo</span>
                <span class="opt" [class.on]="equipo()?.condicion === 'Usado'"><input type="radio" disabled [checked]="equipo()?.condicion === 'Usado'" /> Usado</span>
              </div>
              <span class="hint">La condición proviene del equipo del inventario, no de la solicitud.</span>
            </div>

            @if (esLaptop()) {
              <div class="full alert">
                <span class="alert-ico">i</span>
                <span><b>Laptop:</b> la Dirección decide la asignación y el Encargado de Soporte ejecuta el registro en SISGOST.</span>
              </div>
            }

            @if (soloEncSoporte()) {
              <div class="full alert danger">
                <span class="alert-ico">!</span>
                <span>Esta solicitud es un <b>Requerimiento de Laptop</b>. La asignación solo puede ser registrada por el <b>Encargado de Soporte</b>.</span>
              </div>
            }

            @if (hardwareLaptop()) {
              <div class="full alert danger">
                <span class="alert-ico">!</span>
                <span>El <b>Encargado de Hardware</b> no está habilitado para asignar laptops. Las laptops las asigna el Encargado de Soporte según decisión de la Dirección.</span>
              </div>
            }

            @if (requiereMotivo()) {
              <div class="full alert warn">
                <span class="alert-ico">!</span>
                <span>Para asignar un <b>CPU nuevo desde Hardware</b> debe registrar la autorización o motivo correspondiente.</span>
              </div>
              <div class="field full">
                <label>Motivo de autorización / observación obligatoria <span class="req">*</span></label>
                <textarea class="control" [class.invalid]="motivoInvalido()" rows="3"
                  placeholder="Ej.: reposición urgente por falla del equipo anterior; autorización DTI-2026-…"
                  [(ngModel)]="observacion" [disabled]="!esEncargado()"></textarea>
                @if (motivoInvalido()) { <span class="error">La observación es obligatoria para este caso.</span> }
              </div>
            } @else {
              <div class="field full">
                <label>Observación <span class="hint">(opcional)</span></label>
                <textarea class="control" rows="2" placeholder="Observaciones de la asignación…" [(ngModel)]="observacion" [disabled]="!esEncargado()"></textarea>
              </div>
            }
          </div>

          <!-- Resumen y validaciones antes de confirmar -->
          @if (sol(); as s) {
            @if (equipo(); as e) {
              <div class="resumen-asig">
                <div class="r-t">Resumen de asignación</div>
                <div class="datos">
                  <div><span>Requerimiento</span><b class="mono">{{ s.expediente }}</b><b>{{ s.tipoEquipo | tipoRequerimiento }}</b></div>
                  <div><span>Usuario final</span><b>{{ s.destinatario }}</b><b>{{ s.correoDestinatario }}</b></div>
                  <div><span>Equipo seleccionado</span><b class="mono">{{ e.inventario }}</b><b>{{ e | marcaModelo }}</b></div>
                  <div><span>Expediente técnico</span><b class="mono">{{ expTecEquipo()?.codigo || '—' }}</b><b>F0288 {{ textoF0288() }}</b></div>
                </div>
              </div>
            }
            <div class="valida">
              @for (v of validaciones(); track v.lbl) {
                <p class="chk" [class.ok]="v.ok" [class.pend]="!v.ok">
                  <ui-icon [name]="v.ok ? 'check' : 'clock'" [size]="14" />
                  {{ v.ok ? v.lbl : v.falta }}
                </p>
              }
            </div>
          }
        </div>
        <div class="card-foot">
          <span class="small muted" style="margin-right: auto;">Después de asignar: <b>crear el Expediente único y continuar a configuración</b>.</span>
          <button class="btn btn-primary btn-lg" (click)="asignar()"
            [disabled]="!esEncargado() || !solicitudSel() || !equipoSel() || hardwareLaptop() || soloEncSoporte()">
            Confirmar asignación
          </button>
        </div>
      </div>
      }

      @if (modo() === 'modificar') {
        <!-- Corrección de una asignación ya registrada -->
        <div class="card mb-3">
          <div class="card-head">
            <div>
              <h2>Modificar asignación existente</h2>
              <p class="sub">Solo para corregir errores administrativos; exige motivo y depende del avance del proceso</p>
            </div>
          </div>
          <div class="card-body">
            @if (!puedeModificar()) {
              <p class="chk pend">
                <ui-icon name="alert" [size]="14" />
                Su rol puede consultar las asignaciones, pero no modificarlas. La corrección corresponde a un Encargado o al Administrador.
              </p>
            }
            @if (asigSel(); as a) {
              <div class="resumen-eq">
                <div class="row-between" style="flex-wrap: wrap; gap: 12px;">
                  <div>
                    <div class="eq-nombre mono">{{ a.expediente }}</div>
                    <div class="eq-datos">{{ a.usuarioFinal }}</div>
                    <div class="eq-datos">
                      Equipo actual <b class="mono">{{ a.equipoInventario }}</b> ·
                      {{ data.equipoDe(a.equipoInventario) | marcaModelo }} ·
                      asignado el {{ a.fecha }} por {{ a.responsableAsignacion }}
                    </div>
                  </div>
                  <button class="btn btn-outline btn-sm" (click)="abrirBusquedaAsig()">Cambiar asignación a corregir</button>
                </div>
              </div>

              @if (caso(); as c) {
                <p class="chk" [class.ok]="c.permiteCambioEquipo" [class.pend]="!c.permiteCambioEquipo">
                  <ui-icon [name]="c.permiteCambioEquipo ? 'check' : 'alert'" [size]="14" />
                  {{ c.caso === 'Modificable' ? 'La asignación aún no tiene Expediente único: puede corregirse.' : c.aviso }}
                </p>

                @if (c.permiteCambioEquipo && puedeModificar()) {
                  <div class="field mt-2">
                    <label>Equipo nuevo <span class="req">*</span></label>
                    @if (equipoNuevo(); as e) {
                      <div class="resumen-eq">
                        <div class="row-between" style="flex-wrap: wrap; gap: 12px;">
                          <div>
                            <div class="eq-nombre">{{ e | marcaModelo }}</div>
                            <div class="eq-datos">
                              {{ e.tipo === 'Desktop' ? 'CPU' : 'Laptop' }} · inventario {{ e.inventario }} ·
                              expediente técnico <b class="mono">{{ data.expTecnicoDeEquipo(e.inventario)?.codigo }}</b> ·
                              F0288 <ui-badge [estado]="estadoF0288(e.inventario)" />
                            </div>
                          </div>
                          <button class="btn btn-outline btn-sm" (click)="abrirBusquedaEquipoMod()">Cambiar equipo</button>
                        </div>
                      </div>
                    } @else {
                      <button class="btn btn-primary" (click)="abrirBusquedaEquipoMod()">
                        <ui-icon name="search" [size]="15" /> Buscar equipo preparado
                      </button>
                      <span class="hint">Mismas reglas que una asignación nueva: Expediente único abierto, preparado, F0288 firmado, libre y del tipo del requerimiento.</span>
                    }
                  </div>

                  <div class="field mt-2">
                    <label>Motivo de modificación <span class="req">*</span></label>
                    <textarea class="control" rows="2" [(ngModel)]="motivoMod"
                      placeholder="Ej.: se seleccionó equipo incorrecto por error administrativo."></textarea>
                  </div>
                  <div class="field mt-2">
                    <label>Observación <span class="req">*</span></label>
                    <textarea class="control" rows="2" [(ngModel)]="observacionMod"
                      placeholder="Qué se revisó o acordó antes de corregir la asignación."></textarea>
                  </div>
                  <label class="opt mt-1" [class.on]="confirmaEncargado()" style="display: flex;">
                    <input type="checkbox" [checked]="confirmaEncargado()" (change)="confirmaEncargado.set(!confirmaEncargado())" />
                    Confirmo como Encargado la modificación de esta asignación <span class="req">*</span>
                  </label>
                  <button class="btn btn-primary btn-lg mt-2" [disabled]="!puedeGuardarMod()" (click)="guardarModificacion()">
                    Guardar modificación
                  </button>
                  @if (faltaMod(); as f) { <span class="hint">{{ f }}</span> }
                } @else {
                  <!-- Proceso avanzado: se consulta y se observa, no se cambia el equipo -->
                  <div class="row mt-2">
                    <a class="btn btn-outline btn-sm" routerLink="/expediente-unico">Ver expediente</a>
                    <a class="btn btn-outline btn-sm" routerLink="/trazabilidad" [queryParams]="{ inventario: a.equipoInventario }">Ver historial técnico</a>
                    <a class="btn btn-outline btn-sm" routerLink="/trazabilidad">Ver trazabilidad</a>
                    @if (c.caso === 'Conformidad enviada') {
                      <a class="btn btn-outline btn-sm" routerLink="/descargo">Gestionar descargo</a>
                    }
                  </div>
                  @if (puedeModificar()) {
                    <div class="field mt-2">
                      <label>Observación administrativa</label>
                      <textarea class="control" rows="2" [(ngModel)]="observacionAdmin"
                        placeholder="Deje constancia de lo observado; no cambia el equipo asignado."></textarea>
                      <button class="btn btn-outline btn-sm mt-1" (click)="guardarObservacion()">Registrar observación administrativa</button>
                    </div>
                  }
                }
              }

              @if (a.modificaciones?.length) {
                <div class="sec-title mt-3">Historial de modificaciones</div>
                <div class="table-wrap">
                  <table class="tbl">
                    <thead><tr><th>Fecha</th><th>Equipo anterior</th><th>Equipo nuevo</th><th>Motivo</th><th>Modificado por</th><th>Estado</th></tr></thead>
                    <tbody>
                      @for (m of a.modificaciones; track m.fecha + m.hora) {
                        <tr>
                          <td class="mono">{{ m.fecha }}<div class="sub-cell">{{ m.hora }}</div></td>
                          <td class="mono">{{ m.soloObservacion ? '—' : m.equipoAnterior }}</td>
                          <td class="mono">{{ m.soloObservacion ? '—' : m.equipoNuevo }}</td>
                          <td class="sub-cell" style="max-width: 260px;">{{ m.motivo }}
                            @if (m.observacion && m.observacion !== m.motivo) { <div>{{ m.observacion }}</div> }
                          </td>
                          <td>{{ m.encargado.split('—')[0].trim() }}<div class="sub-cell">{{ m.rol }}</div></td>
                          <td>{{ m.soloObservacion ? 'Observación administrativa' : m.estadoAnterior + ' → ' + m.estadoNuevo }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            } @else {
              <div class="row">
                <button class="btn btn-primary" (click)="abrirBusquedaAsig()">
                  <ui-icon name="search" [size]="15" /> Buscar asignación existente
                </button>
                <span class="hint">Busque la asignación por requerimiento, inventario, usuario final o fecha.</span>
              </div>
            }
          </div>
        </div>
      }

      <div class="card">
        <div class="card-head">
          <div>
            <h2>Asignaciones registradas</h2>
            <p class="sub">Incluye los responsables técnicos por fase de cada proceso</p>
          </div>
        </div>
        <div class="card-body">
          @for (a of data.asignaciones(); track a.expediente) {
            <details class="acc">
              <summary>
                <span class="mono">{{ a.expediente }}</span>
                <span class="muted small">{{ data.equipoDe(a.equipoInventario) | marcaModelo }} · {{ a.usuarioFinal }}</span>
                <ui-badge [estado]="a.estado" />
                <span class="acc-arrow"><ui-icon name="chevron" [size]="13" /></span>
              </summary>
              <div class="acc-body">
                <div class="grid grid-2">
                  <dl class="dl">
                    <dt>Asignado por</dt><dd>{{ a.responsableAsignacion }}</dd>
                    <dt>Fecha</dt><dd>{{ a.fecha }}</dd>
                    <dt>Expediente técnico</dt><dd class="mono">{{ a.responsablesFase.expedienteTecnico || '—' }}</dd>
                    <dt>Decisión de Dirección</dt><dd>{{ a.decideDireccion ? 'Sí — la Dirección decidió el destinatario' : 'No aplica' }}</dd>
                    @if (a.observacion) { <dt>Observación</dt><dd>{{ a.observacion }}</dd> }
                  </dl>
                  <div>
                    <div class="sec-title">Responsables técnicos por fase</div>
                    <table class="tbl fase-tbl">
                      <thead><tr><th>Fase</th><th>Responsable</th><th>Estado</th></tr></thead>
                      <tbody>
                        <tr>
                          <td>Preparación (F0288)</td>
                          <td>{{ a.responsablesFase.tecnicoPreparacion }}</td>
                          <td><ui-badge [estado]="a.responsablesFase.estadoPreparacion" /></td>
                        </tr>
                        <tr>
                          <td>Configuración (F0302)</td>
                          <td>{{ a.responsablesFase.tecnicoConfiguracion }}</td>
                          <td><ui-badge [estado]="a.responsablesFase.estadoConfiguracion" /></td>
                        </tr>
                        <tr>
                          <td>Entrega</td>
                          <td>{{ a.responsablesFase.responsableEntrega }}</td>
                          <td><ui-badge [estado]="a.responsablesFase.estadoEntrega" /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </details>
          } @empty {
            <p class="muted">Aún no hay asignaciones registradas.</p>
          }
        </div>
      </div>

      <!-- Paso 1 · Catálogo de requerimientos -->
      @if (buscarSolAbierto()) {
        <ui-modal titulo="Seleccionar requerimiento para asignación" sub="Solo requerimientos pendientes, sin equipo asociado" (cerrar)="buscarSolAbierto.set(false)">
          <div class="field mb-2">
            <input class="control" type="search"
              placeholder="Código, tipo, usuario final, correo, unidad, descripción, estado o fecha…" [(ngModel)]="qSol" />
          </div>
          <div class="chips mb-2">
            @for (fx of filtrosSol; track fx) {
              <button class="chip-f" [class.on]="fSol() === fx" (click)="fSol.set(fx)">{{ fx }}</button>
            }
          </div>
          <div class="table-wrap">
            <table class="tbl">
              <thead>
                <tr><th>Código</th><th>Tipo</th><th>Usuario final</th><th>Correo</th><th>Descripción</th><th>Fecha</th><th>Estado</th><th style="text-align:right;">Acción</th></tr>
              </thead>
              <tbody>
                @for (s of solicitudesFiltradas(); track s.expediente) {
                  <tr>
                    <td class="mono main-cell">{{ s.expediente }}</td>
                    <td>{{ s.tipoEquipo | tipoRequerimiento }}</td>
                    <td>{{ s.destinatario }}<div class="sub-cell">{{ s.unidadDestino }}</div></td>
                    <td class="sub-cell">{{ s.correoDestinatario }}</td>
                    <td class="sub-cell" style="max-width: 220px;">{{ s.descripcion }}</td>
                    <td class="mono">{{ s.fecha }}</td>
                    <td><ui-badge [estado]="s.estado" /></td>
                    <td>
                      <div class="row" style="justify-content: flex-end; flex-wrap: nowrap;">
                        <button class="btn btn-ghost btn-sm" (click)="detalleSol.set(detalleSol() === s.expediente ? '' : s.expediente)">
                          <ui-icon name="eye" [size]="13" /> {{ detalleSol() === s.expediente ? 'Ocultar' : 'Ver detalle' }}
                        </button>
                        <button class="btn btn-primary btn-sm" (click)="seleccionarSolicitud(s.expediente)">Seleccionar</button>
                      </div>
                    </td>
                  </tr>
                  @if (detalleSol() === s.expediente) {
                    <tr>
                      <td colspan="8" class="det-fila">
                        <div class="datos">
                          <div><span>Código</span><b class="mono">{{ s.expediente }}</b></div>
                          <div><span>Tipo</span><b>{{ s.tipoEquipo | tipoRequerimiento }}</b></div>
                          <div><span>Usuario final</span><b>{{ s.destinatario }}</b></div>
                          <div><span>Correo institucional</span><b>{{ s.correoDestinatario }}</b></div>
                          <div><span>Dirección o unidad</span><b>{{ s.unidadDestino }} · {{ s.direccionGerencia }}</b></div>
                          <div><span>Descripción</span><b>{{ s.descripcion }}</b></div>
                          <div><span>Fecha de registro</span><b class="mono">{{ s.fecha }}</b></div>
                          <div><span>Estado</span><b>{{ s.estado }} · {{ s.diasEnFase }} días en fase</b></div>
                          <div><span>Observaciones</span><b>{{ s.nota || s.pendiente || '—' }}</b></div>
                        </div>
                        <button class="btn btn-primary btn-sm mt-2" (click)="seleccionarSolicitud(s.expediente)">Seleccionar requerimiento</button>
                      </td>
                    </tr>
                  }
                } @empty {
                  <tr><td colspan="8" class="muted" style="text-align:center; padding: 26px;">
                    @if (data.solicitudesParaAsignar().length) {
                      Ningún requerimiento coincide con la búsqueda.
                    } @else {
                      <b>No hay solicitudes pendientes sin equipo asignado.</b>
                      <div class="mt-1">Solo se muestran solicitudes que aún no cuentan con una asignación de equipo.</div>
                    }
                  </td></tr>
                }
              </tbody>
            </table>
          </div>
        </ui-modal>
      }

      <!-- Corrección · Catálogo de asignaciones ya registradas -->
      @if (buscarAsigAbierto()) {
        <ui-modal titulo="Buscar asignación existente" sub="Solo asignaciones con equipo y sin Expediente único creado" (cerrar)="buscarAsigAbierto.set(false)">
          <div class="field mb-2">
            <input class="control" type="search"
              placeholder="Requerimiento, inventario, usuario final, correo, tipo de equipo, fecha o estado…" [(ngModel)]="qAsig" />
          </div>
          <div class="chips mb-2">
            @for (fx of filtrosAsig; track fx) {
              <button class="chip-f" [class.on]="fAsig() === fx" (click)="fAsig.set(fx)">{{ fx }}</button>
            }
          </div>
          <div class="table-wrap">
            <table class="tbl">
              <thead>
                <tr><th>Código</th><th>Tipo</th><th>Usuario final</th><th>Correo</th><th>Equipo asignado</th><th>Inventario</th><th>Fecha de asignación</th><th>Estado</th><th style="text-align:right;">Acción</th></tr>
              </thead>
              <tbody>
                @for (a of asignacionesFiltradas(); track a.expediente) {
                  <tr>
                    <td class="mono main-cell">{{ a.expediente }}</td>
                    <td>{{ a.tipoEquipo === 'Desktop' ? 'Requerimiento de CPU' : 'Requerimiento de Laptop' }}</td>
                    <td>{{ a.usuarioFinal }}</td>
                    <td class="sub-cell">{{ data.solicitud(a.expediente)?.correoDestinatario }}</td>
                    <td>{{ data.equipoDe(a.equipoInventario) | marcaModelo }}</td>
                    <td class="mono">{{ a.equipoInventario }}</td>
                    <td class="mono">{{ a.fecha }}</td>
                    <td><ui-badge estado="Asignado sin Expediente único" /></td>
                    <td>
                      <div class="row" style="justify-content: flex-end; flex-wrap: nowrap;">
                        <button class="btn btn-ghost btn-sm" (click)="detalleAsig.set(detalleAsig() === a.expediente ? '' : a.expediente)">
                          <ui-icon name="eye" [size]="13" /> {{ detalleAsig() === a.expediente ? 'Ocultar' : 'Ver detalle' }}
                        </button>
                        <button class="btn btn-primary btn-sm" [disabled]="!puedeModificar()" (click)="seleccionarAsignacion(a.expediente)">
                          Modificar
                        </button>
                      </div>
                    </td>
                  </tr>
                  @if (detalleAsig() === a.expediente) {
                    <tr>
                      <td colspan="9" class="det-fila">
                        <div class="datos">
                          <div><span>Requerimiento</span><b class="mono">{{ a.expediente }}</b></div>
                          <div><span>Usuario final</span><b>{{ a.usuarioFinal }}</b></div>
                          <div><span>Equipo asignado</span><b class="mono">{{ a.equipoInventario }}</b><b>{{ data.equipoDe(a.equipoInventario) | marcaModelo }}</b></div>
                          <div><span>Expediente técnico</span><b class="mono">{{ a.responsablesFase.expedienteTecnico || '—' }}</b></div>
                          <div><span>Expediente único</span><b class="mono">{{ data.expedienteUnicoDe(a.expediente)?.codigoUnico || 'Sin crear' }}</b></div>
                          <div><span>Fecha de asignación</span><b class="mono">{{ a.fecha }}</b></div>
                          <div><span>Asignado por</span><b>{{ a.responsableAsignacion }}</b></div>
                          <div><span>Estado</span><b>Asignado sin Expediente único</b></div>
                        </div>
                      </td>
                    </tr>
                  }
                } @empty {
                  <tr><td colspan="9" class="muted" style="text-align:center; padding: 26px;">
                    @if (data.asignacionesModificables().length) {
                      Ninguna asignación coincide con la búsqueda.
                    } @else {
                      <b>No hay asignaciones disponibles para modificar.</b>
                      <div class="mt-1">Solo pueden modificarse asignaciones que aún no tienen Expediente único creado.</div>
                    }
                  </td></tr>
                }
              </tbody>
            </table>
          </div>
        </ui-modal>
      }

      <!-- Paso 2 · Catálogo de equipos preparados del tipo que pide el requerimiento -->
      @if (buscarAbierto()) {
        <ui-modal titulo="Buscar equipo preparado" sub="Preparados, con F0288 firmado, sin asignación y sin reproceso ni falla abierta" (cerrar)="buscarAbierto.set(false)">
          <div class="busq-filtros">
            <input class="control" type="search" placeholder="Inventario, marca, modelo, serie o expediente técnico…" [(ngModel)]="q" />
            <select class="control" [(ngModel)]="fCond">
              <option value="">Condición: todas</option>
              <option value="Nuevo">Nuevo</option>
              <option value="Usado">Usado</option>
            </select>
          </div>

          <div class="table-wrap">
            <table class="tbl">
              <thead>
                <tr><th>Inventario</th><th>Tipo</th><th>Marca / modelo</th><th>Serie</th><th>Expediente técnico</th><th>F0288</th><th style="text-align:right;">Acción</th></tr>
              </thead>
              <tbody>
                @for (e of disponibles(); track e.inventario) {
                  <tr>
                    <td class="mono main-cell">{{ e.inventario }}</td>
                    <td>{{ e.tipo === 'Desktop' ? 'CPU' : 'Laptop' }}<div class="sub-cell">{{ e.condicion.toLowerCase() }}</div></td>
                    <td>{{ e | marcaModelo }}</td>
                    <td class="mono sub-cell">{{ e.serie }}</td>
                    <td class="mono">{{ data.expTecnicoDeEquipo(e.inventario)?.codigo }}
                      <div class="sub-cell">{{ data.expTecnicoDeEquipo(e.inventario)?.tecnicoPreparacion?.split('—')?.[0]?.trim() }}</div>
                    </td>
                    <td><ui-badge [estado]="estadoF0288(e.inventario)" /></td>
                    <td>
                      <div class="row" style="justify-content: flex-end;">
                        <button class="btn btn-primary btn-sm" (click)="seleccionarEquipo(e)">Seleccionar</button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="7" class="muted" style="text-align:center; padding: 26px;">
                    No hay equipos preparados compatibles con este requerimiento.
                  </td></tr>
                }
              </tbody>
            </table>
          </div>
        </ui-modal>
      }
    </div>
  `
})
export class AsignacionComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly casoActivo = inject(CasoActivoService);

  /** Llega como query param desde Solicitudes («Enviar a asignación»). */
  readonly solicitud = input<string>();

  protected solicitudSel = signal('');
  protected equipoSel = signal('');
  protected observacion = signal('');
  protected intento = signal(false);

  // Catálogo de requerimientos (paso 1)
  protected buscarSolAbierto = signal(false);
  protected qSol = signal('');
  protected fSol = signal('Todos');
  protected detalleSol = signal('');
  /**
   * Filtros del catálogo de nueva asignación. «Pendientes de asignación» y «Sin equipo asociado»
   * describen lo mismo que ya garantiza la lista; se mantienen porque son la forma en que el
   * usuario nombra lo que busca, no porque filtren algo distinto.
   */
  protected readonly filtrosSol = ['Todos', 'Requerimiento de CPU', 'Requerimiento de Laptop',
    'Pendientes de asignación', 'Sin equipo asociado', 'Más recientes'];

  // Catálogo de equipos preparados (paso 2)
  protected buscarAbierto = signal(false);
  protected q = signal('');
  protected fCond = signal('');

  /** Acción de la pantalla: asignar por primera vez o corregir una asignación ya hecha. */
  protected modo = signal<'nueva' | 'modificar'>('nueva');

  // Corrección de asignaciones existentes
  protected buscarAsigAbierto = signal(false);
  protected qAsig = signal('');
  protected fAsig = signal('Asignaciones recientes');
  protected detalleAsig = signal('');
  protected asigSelId = signal('');
  protected equipoNuevoSel = signal('');
  protected motivoMod = signal('');
  protected observacionMod = signal('');
  protected observacionAdmin = signal('');
  protected confirmaEncargado = signal(false);
  /** true mientras el buscador de equipos se abrió desde la corrección y no desde una asignación nueva. */
  private paraModificacion = signal(false);
  /**
   * Filtros de la corrección. Los de «Con Expediente único», «En proceso de configuración» y
   * «Finalizadas» desaparecieron: esas asignaciones ya no se listan aquí, así que filtrarían cero.
   */
  protected readonly filtrosAsig = ['Asignaciones recientes', 'Requerimiento de CPU', 'Requerimiento de Laptop'];

  constructor() {
    effect(() => {
      const q = this.solicitud();
      if (q && this.data.solicitud(q)?.estado === 'Entrante') this.solicitudSel.set(q);
    });
  }

  /**
   * Catálogo del paso 1: los requerimientos que todavía pueden recibir equipo. Los que ya lo
   * tienen aparecen **solo cuando se los busca por su código o su nombre**, y sin acción de
   * seleccionar: esconderlos del todo dejaría al usuario buscando uno que sí existe.
   */
  protected readonly solicitudesFiltradas = computed(() => {
    const q = this.qSol().toLowerCase().trim();
    const filtro = this.fSol();
    // El catálogo **siempre** parte de los requerimientos sin equipo: ni la búsqueda por texto ni
    // «Todos» pueden ampliarlo. Antes, escribir en el buscador agregaba el resto de solicitudes
    // —así aparecían las ya asignadas—, y eso es justo lo que este flujo no debe ofrecer.
    const lista = this.data.solicitudesParaAsignar().filter((s) => {
      if (filtro === 'Requerimiento de CPU' && s.tipoEquipo !== 'Desktop') return false;
      if (filtro === 'Requerimiento de Laptop' && s.tipoEquipo !== 'Laptop') return false;
      if (filtro === 'Pendientes de asignación' && s.estado !== 'Entrante') return false;
      if (filtro === 'Sin equipo asociado' && !!this.asignacionDe(s.expediente)) return false;
      if (!q) return true;
      return [s.expediente, this.data.tipoRequerimientoTexto(s), s.destinatario, s.correoDestinatario,
        s.unidadDestino, s.direccionGerencia, s.descripcion, s.estado, s.fecha]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
    return filtro === 'Más recientes'
      ? [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha))
      : lista;
  });

  /** Asignación vigente del requerimiento, si ya tiene equipo. */
  protected asignacionDe(id: string) {
    const a = this.data.asignacionDe(id);
    return a?.vigente ? a : undefined;
  }

  // ---------- Corrección de asignaciones ----------
  protected readonly puedeModificar = computed(() => this.data.puedeModificarAsignaciones());
  protected readonly asigSel = computed(() =>
    this.asigSelId() ? this.data.asignaciones().find((a) => a.expediente === this.asigSelId()) : undefined
  );
  /** Requerimiento de la asignación en corrección: de él sale el tipo de equipo permitido. */
  protected readonly solAsig = computed(() =>
    this.asigSelId() ? this.data.solicitud(this.asigSelId()) : undefined
  );
  protected readonly caso = computed(() =>
    this.asigSelId() ? this.data.casoModificacionAsignacion(this.asigSelId()) : undefined
  );
  protected readonly equipoNuevo = computed(() =>
    this.equipoNuevoSel() ? this.data.equipoDe(this.equipoNuevoSel()) : undefined
  );

  /** Fase del proceso; en este catálogo todas son «Asignado sin Expediente único», y se busca por ella. */
  protected estadoProceso(id: string): string {
    if (this.data.conformidadDeProceso(id)) return 'Conformidad enviada';
    if (this.data.configuracionIniciada(id)) return 'Configuración F0302 iniciada';
    if (this.data.expedienteUnicoDe(id)) return 'Expediente único creado';
    return 'Asignado sin Expediente único';
  }

  /**
   * Catálogo de la corrección: **solo asignaciones sin Expediente único**. Es la otra mitad del
   * corte de la pantalla — lo que no aparece aquí aparece en «Nueva asignación», y al revés—, así
   * que ninguna de las dos listas puede reutilizar la del otro flujo.
   */
  protected readonly asignacionesFiltradas = computed(() => {
    const q = this.qAsig().toLowerCase().trim();
    const filtro = this.fAsig();
    const lista = this.data.asignacionesModificables().filter((a) => {
      if (filtro === 'Requerimiento de CPU' && a.tipoEquipo !== 'Desktop') return false;
      if (filtro === 'Requerimiento de Laptop' && a.tipoEquipo !== 'Laptop') return false;
      if (!q) return true;
      const eq = this.data.equipoDe(a.equipoInventario);
      const s = this.data.solicitud(a.expediente);
      return [a.expediente, a.equipoInventario, a.usuarioFinal, s?.correoDestinatario,
        a.tipoEquipo === 'Desktop' ? 'CPU' : 'Laptop', eq?.marca, eq?.modelo, a.fecha,
        a.estado, this.estadoProceso(a.expediente)]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
    return filtro === 'Asignaciones recientes'
      ? [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha))
      : lista;
  });

  protected abrirBusquedaAsig(): void {
    this.qAsig.set('');
    this.fAsig.set('Asignaciones recientes');
    this.detalleAsig.set('');
    this.buscarAsigAbierto.set(true);
    const a = this.asigSel();
    this.data.registrarEvento(a?.expediente ?? 'Asignación de equipo', this.responsableTxt(),
      'Asignación existente consultada', 'Consulta', 'Catálogo de asignaciones abierto para corrección.', false,
      { modulo: 'Asignación de equipo', rol: this.auth.usuario()?.rol });
  }

  protected seleccionarAsignacion(id: string): void {
    this.asigSelId.set(id);
    this.equipoNuevoSel.set('');
    this.motivoMod.set('');
    this.observacionMod.set('');
    this.confirmaEncargado.set(false);
    this.buscarAsigAbierto.set(false);
    const caso = this.data.casoModificacionAsignacion(id);
    this.data.registrarEvento(id, this.responsableTxt(), 'Solicitud de modificación de asignación iniciada',
      caso.caso, caso.aviso || 'La asignación admite corrección del equipo.', false,
      { modulo: 'Asignación de equipo', inventario: this.data.asignacionDe(id)?.equipoInventario,
        rol: this.auth.usuario()?.rol, usuarioFinal: this.data.asignacionDe(id)?.usuarioFinal });
    if (!caso.permiteCambioEquipo) {
      this.data.registrarModificacionRechazada(id, this.responsableTxt(), this.auth.usuario()?.rol ?? '');
      this.toast.warn('Modificación no permitida', caso.aviso);
    }
  }

  protected abrirBusquedaEquipoMod(): void {
    this.paraModificacion.set(true);
    this.q.set('');
    this.buscarAbierto.set(true);
  }

  /** Falta lo que falta, en una línea, igual que en la asignación nueva. */
  protected faltaMod(): string {
    if (this.puedeGuardarMod()) return '';
    if (!this.equipoNuevoSel()) return 'Seleccione el equipo nuevo.';
    if (!this.motivoMod().trim()) return 'Debe justificar el motivo de la modificación de la asignación.';
    if (!this.observacionMod().trim()) return 'Registre la observación de la modificación.';
    return 'Confirme como Encargado la modificación de esta asignación.';
  }

  /** Toda modificación exige motivo, observación y confirmación explícita del Encargado. */
  protected puedeGuardarMod(): boolean {
    return this.puedeModificar() && !!this.equipoNuevoSel() && !!this.motivoMod().trim()
      && !!this.observacionMod().trim() && this.confirmaEncargado();
  }

  protected guardarModificacion(): void {
    const id = this.asigSelId();
    const error = this.data.modificarAsignacion(id, this.equipoNuevoSel(), this.motivoMod(),
      this.observacionMod(), this.responsableTxt(), this.auth.usuario()?.rol ?? '');
    if (error) { this.toast.error('No se pudo modificar la asignación', error); return; }
    this.toast.ok('Asignación modificada',
      `${id}: el equipo quedó corregido y el anterior volvió a estar disponible para asignación.`);
    this.equipoNuevoSel.set('');
    this.motivoMod.set('');
    this.observacionMod.set('');
    this.confirmaEncargado.set(false);
  }

  protected guardarObservacion(): void {
    const error = this.data.registrarObservacionAsignacion(this.asigSelId(), this.observacionAdmin(),
      this.responsableTxt(), this.auth.usuario()?.rol ?? '');
    if (error) { this.toast.error('No se pudo registrar la observación', error); return; }
    this.observacionAdmin.set('');
    this.toast.ok('Observación registrada', 'Queda en el historial de la asignación y en la trazabilidad.');
  }

  protected readonly sol = computed(() =>
    this.solicitudSel() ? this.data.solicitud(this.solicitudSel()) : undefined
  );

  protected readonly equipo = computed(() =>
    this.equipoSel() ? this.data.equipoDe(this.equipoSel()) : undefined
  );

  protected readonly expTecEquipo = computed(() =>
    this.equipoSel() ? this.data.expTecnicoDeEquipo(this.equipoSel()) : undefined
  );

  protected readonly esLaptop = computed(() =>
    this.sol()?.tipoEquipo === 'Laptop' || this.equipo()?.tipo === 'Laptop'
  );

  /** Estado del F0288 del equipo, para el badge del resumen y del catálogo. */
  protected estadoF0288(inventario: string): string {
    const tec = this.data.expTecnicoDeEquipo(inventario);
    const prep = tec ? this.data.preparacionPorCodigo(tec.codigo) : undefined;
    return prep?.estado || 'Sin registrar';
  }
  protected textoF0288(): string {
    const tec = this.expTecEquipo();
    const prep = tec ? this.data.preparacionPorCodigo(tec.codigo) : undefined;
    if (!prep) return 'sin registrar';
    if (prep.estado !== 'Completada') return prep.estado.toLowerCase();
    return prep.firma?.estado === 'Firmado' ? 'finalizado y firmado' : 'finalizado, pendiente de firma';
  }

  /** Requisitos de la asignación, como checklist con icono en lugar de un párrafo. */
  protected readonly validaciones = computed(() => [
    { lbl: 'Requerimiento seleccionado', falta: 'Falta seleccionar el requerimiento', ok: !!this.sol() },
    { lbl: 'Equipo preparado seleccionado', falta: 'Falta seleccionar el equipo preparado', ok: !!this.equipo() },
    { lbl: 'F0288 validado', falta: 'Falta el F0288 finalizado y firmado del equipo',
      ok: !!this.equipo() && this.textoF0288() === 'finalizado y firmado' },
    { lbl: 'Asignación confirmada', falta: 'Pendiente confirmar asignación', ok: false }
  ]);

  /** El responsable de asignación se toma del usuario conectado (no es campo libre). */
  protected readonly rol = computed(() => this.auth.usuario()?.clave ?? '');
  protected readonly esEncargado = computed(() => this.rol() === 'enc-soporte' || this.rol() === 'enc-hardware');
  protected readonly responsableTxt = computed(() => {
    const u = this.auth.usuario();
    return u ? `${u.nombre} — ${u.rol}` : '—';
  });

  /**
   * Requerimientos originados en un documento de dirección: solo el Encargado de Soporte registra
   * la asignación. El valor `origenTipo` es del modelo de datos; en pantalla nunca se nombra.
   */
  protected readonly soloEncSoporte = computed(() =>
    this.sol()?.origenTipo === 'Memorando' && this.rol() !== 'enc-soporte' && !!this.sol()
  );

  /** Encargado de Hardware + laptop: combinación no permitida. */
  protected readonly hardwareLaptop = computed(() =>
    this.rol() === 'enc-hardware' && this.esLaptop()
  );

  /** Encargado de Hardware + CPU nuevo: requiere autorización con motivo obligatorio. */
  protected readonly requiereMotivo = computed(() =>
    this.rol() === 'enc-hardware' && this.equipo()?.tipo === 'Desktop' && this.equipo()?.condicion === 'Nuevo'
  );

  protected readonly motivoInvalido = computed(() =>
    this.intento() && this.requiereMotivo() && !this.observacion().trim()
  );

  /**
   * Equipos del paso 2: los asignables, **del tipo que pide el requerimiento**. El tipo ya no es
   * un filtro que el usuario pueda cambiar: buscar una laptop para un requerimiento de CPU solo
   * llevaba a una advertencia después de elegirla.
   */
  protected readonly disponibles = computed(() => {
    const q = this.q().toLowerCase().trim();
    // El tipo sale del requerimiento en juego: el de la asignación nueva o el de la que se corrige.
    const tipo = this.paraModificacion() ? this.solAsig()?.tipoEquipo : this.sol()?.tipoEquipo;
    // El requerimiento en juego: su Expediente único es el que decide qué equipo puede asignársele.
    const solId = this.paraModificacion() ? (this.solAsig()?.expediente ?? '') : (this.sol()?.expediente ?? '');
    return this.data.equiposParaAsignar().filter((e) => {
      if (tipo && e.tipo !== tipo) return false;
      // Con el orden del DER el equipo llega **ya con su Expediente único abierto**. Si ese
      // expediente nació de otro requerimiento, este equipo no es para esta asignación.
      const et = this.data.cicloAbiertoDeEquipo(e.inventario);
      const eu = et ? this.data.expedienteUnicoDeExpTecnico(et.codigo) : undefined;
      if (solId && eu?.expediente && eu.expediente !== solId) return false;
      if (this.fCond() && e.condicion !== this.fCond()) return false;
      if (!q) return true;
      const tec = this.data.expTecnicoDeEquipo(e.inventario);
      return [e.inventario, e.marca, e.modelo, e.serie, e.tipo === 'Desktop' ? 'CPU' : 'Laptop',
        tec?.codigo, tec?.tecnicoPreparacion, this.estadoF0288(e.inventario)]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  });

  protected abrirBusquedaSol(): void {
    this.qSol.set('');
    this.fSol.set('Todos');
    this.detalleSol.set('');
    this.buscarSolAbierto.set(true);
    this.data.registrarEvento('Asignación de equipo', this.responsableTxt(),
      'Requerimiento consultado para nueva asignación', 'Consulta',
      'Catálogo de requerimientos sin equipo asociado.', false,
      { modulo: 'Asignación de equipo', rol: this.auth.usuario()?.rol });
  }

  /** Cambiar de requerimiento descarta el equipo elegido: era para el requerimiento anterior. */
  protected seleccionarSolicitud(id: string): void {
    // Respaldo del filtro base: si un requerimiento con equipo llegara igual hasta aquí, no se toma.
    const bloqueo = this.data.validarSolicitudParaAsignar(id);
    if (bloqueo) { this.toast.error('Requerimiento ya asignado', bloqueo); return; }
    if (this.solicitudSel() !== id) this.equipoSel.set('');
    this.solicitudSel.set(id);
    this.buscarSolAbierto.set(false);
    const s = this.data.solicitud(id);
    this.data.registrarEvento(id, this.responsableTxt(), 'Requerimiento seleccionado para asignación',
      s?.estado ?? 'Entrante', `${this.data.tipoRequerimientoTexto(s)} · ${s?.destinatario}`, false,
      { modulo: 'Asignación de equipo', rol: this.auth.usuario()?.rol, usuarioFinal: s?.destinatario });
  }

  protected abrirBusqueda(): void {
    if (!this.solicitudSel()) {
      this.toast.warn('Seleccione primero el requerimiento', 'Elija el requerimiento antes de buscar el equipo.');
      return;
    }
    this.paraModificacion.set(false);
    this.q.set('');
    this.buscarAbierto.set(true);
    this.data.registrarEvento(this.solicitudSel(), this.responsableTxt(),
      'Equipo preparado consultado para asignación', 'Consulta',
      `Catálogo de equipos ${this.sol()?.tipoEquipo === 'Desktop' ? 'CPU' : 'Laptop'} preparados.`, false,
      { modulo: 'Asignación de equipo', rol: this.auth.usuario()?.rol });
  }

  /** El equipo elegido va al paso 2 de la asignación nueva o a la corrección, según de dónde se abrió. */
  protected seleccionarEquipo(e: Equipo): void {
    if (this.paraModificacion()) this.equipoNuevoSel.set(e.inventario);
    else this.equipoSel.set(e.inventario);
    this.buscarAbierto.set(false);
  }

  protected asignar(): void {
    this.intento.set(true);
    const s = this.sol();
    if (!this.esEncargado()) {
      this.toast.error('Acción no permitida', 'No tiene permisos para realizar asignaciones. Esta acción corresponde a un Encargado.');
      return;
    }
    if (!s) {
      this.toast.warn('Seleccione la solicitud', 'Elija una solicitud entrante para asignar el equipo.');
      return;
    }
    if (!this.equipoSel()) {
      this.toast.warn('Seleccione el equipo', 'Busque y seleccione un equipo preparado del Inventario de Hardware.');
      return;
    }
    if (this.soloEncSoporte()) {
      this.toast.error('Asignación no permitida', 'Esta solicitud es un Requerimiento de Laptop. La asignación solo puede ser registrada por el Encargado de Soporte.');
      return;
    }
    if (this.hardwareLaptop()) {
      this.toast.error('Asignación no permitida', 'El Encargado de Hardware no puede asignar laptops.');
      return;
    }
    if (this.requiereMotivo() && !this.observacion().trim()) {
      this.toast.error('Falta la observación obligatoria', 'Para asignar un CPU nuevo desde Hardware debe registrar la autorización o motivo correspondiente.');
      return;
    }
    const error = this.data.asignarEquipo(s.expediente, this.equipoSel(), this.responsableTxt(), this.observacion().trim(), this.esLaptop());
    if (error) {
      this.toast.error('No se puede asignar el equipo', error);
      return;
    }
    this.toast.ok('Equipo asignado', `${s.expediente} asignado a ${s.destinatario}. Siguiente paso: crear el Expediente único y continuar a configuración.`);
    // Deja este caso como «activo» para que Expediente único lo retome sin volver a buscarlo.
    this.casoActivo.seleccionar(s.expediente);
    this.solicitudSel.set('');
    this.equipoSel.set('');
    this.observacion.set('');
    this.intento.set(false);
  }
}
