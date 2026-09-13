import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { ConsultaInventario, Equipo, FilaValidacionLote, MotivoIngreso } from '../../core/models/models';
import { BadgeComponent, HelpTipComponent, ModalComponent } from '../../shared/ui';

/**
 * Inventario de Hardware: control de los equipos que faltan por preparar, en preparación,
 * preparados, no asignados y asignados. No es un simple registro de equipos.
 */
@Component({
  selector: 'app-inventario-hardware',
  imports: [FormsModule, BadgeComponent, HelpTipComponent, ModalComponent],
  styles: `
    .resumen { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 18px; }
    @media (max-width: 1100px) { .resumen { grid-template-columns: repeat(2, 1fr); } }
    .stat {
      background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md);
      padding: 12px 16px; cursor: pointer; text-align: left; font-family: var(--font);
      transition: border-color .12s, box-shadow .12s;
    }
    .stat:hover { border-color: var(--blue-500); }
    .stat.on { border-color: var(--navy-800); box-shadow: inset 0 0 0 1px var(--navy-800); }
    .stat .n { font-size: 24px; font-weight: 700; color: var(--navy-900); line-height: 1.1; }
    .stat .t { font-size: 11.5px; color: var(--tx-3); margin-top: 2px; }
    .filtros { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .filtros input { max-width: 320px; }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .f-chip {
      border: 1px solid var(--line-strong); background: var(--surface); color: var(--tx-2);
      font-size: 12px; font-weight: 500; padding: 5px 12px; border-radius: 999px; cursor: pointer;
      transition: all .12s; font-family: var(--font);
    }
    .f-chip:hover { border-color: var(--blue-500); color: var(--blue-600); }
    .f-chip.on { background: var(--navy-800); border-color: var(--navy-800); color: #fff; }
    .sin-exp {
      display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: .05em;
      color: var(--danger); background: var(--danger-bg); border: 1px solid var(--danger-line);
      border-radius: 999px; padding: 3px 9px; white-space: nowrap;
    }
    .exp-cod { font-family: var(--font-mono, monospace); font-size: 12.5px; font-weight: 700; color: var(--navy-900); }
    /* Consulta a la base institucional simulada: una tarjeta por paso (buscar → resultado). */
    .paso { border: 1px solid var(--line); border-radius: var(--r-md); padding: 16px 18px; background: var(--surface-2); }
    .paso-t {
      font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
      color: var(--tx-3); margin-bottom: 12px; display: flex; gap: 10px; align-items: center; justify-content: space-between;
    }
    .paso.hallado { background: var(--surface); border-color: var(--ok); }
    .paso.hallado .paso-t { color: var(--ok); }
    .origen {
      font-size: 10.5px; font-weight: 600; letter-spacing: 0; text-transform: none;
      color: var(--tx-3); border: 1px solid var(--line-strong); border-radius: 999px; padding: 3px 10px;
    }
    .buscar-row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Gestión</div>
          <h1>
            Inventario de Hardware
            <ui-help texto="No es un simple registro de equipos: controla los equipos que faltan por preparar, en preparación, preparados, no asignados y asignados. Normalmente los equipos pendientes de preparación no tienen expediente técnico." />
          </h1>
          <p class="page-sub">Equipos pendientes de preparación, preparados y asignados.</p>
        </div>
        @if (puedeIngresar()) {
          <div class="row" style="flex-wrap: nowrap;">
            <button class="btn btn-gold" (click)="abrirIngreso()">＋ Ingreso individual</button>
            <button class="btn btn-outline" (click)="abrirIngresoMultiple()">＋ Ingreso múltiple</button>
          </div>
        }
      </div>

      <!-- Resumen por estado -->
      <div class="resumen">
        <button class="stat" [class.on]="fPrep() === 'Pendiente de preparación'" (click)="togglePrep('Pendiente de preparación')">
          <div class="n">{{ contarPrep('Pendiente de preparación') }}</div>
          <div class="t">Pendientes de preparación</div>
        </button>
        <button class="stat" [class.on]="fPrep() === 'En preparación'" (click)="togglePrep('En preparación')">
          <div class="n">{{ contarPrep('En preparación') }}</div>
          <div class="t">En preparación</div>
        </button>
        <button class="stat" [class.on]="fPrep() === 'Preparado'" (click)="togglePrep('Preparado')">
          <div class="n">{{ contarPrep('Preparado') }}</div>
          <div class="t">Preparados</div>
        </button>
        <button class="stat" [class.on]="fAsig() === 'No asignado'" (click)="toggleAsig('No asignado')">
          <div class="n">{{ contarAsig('No asignado') }}</div>
          <div class="t">No asignados</div>
        </button>
        <button class="stat" [class.on]="fAsig() === 'Asignado'" (click)="toggleAsig('Asignado')">
          <div class="n">{{ contarAsig('Asignado') }}</div>
          <div class="t">Asignados</div>
        </button>
      </div>

      <div class="card mb-2 card-pad">
        <div class="filtros">
          <input class="control" type="search" placeholder="Buscar por inventario, marca, modelo, serie, nombre del equipo o IP reservada…" [(ngModel)]="q" />
          <select class="control" style="max-width: 170px;" [(ngModel)]="fTipo">
            <option value="">Tipo: todos</option>
            <option value="Laptop">Laptop</option>
            <option value="Desktop">CPU / Desktop</option>
          </select>
          <select class="control" style="max-width: 190px;" [(ngModel)]="fCond">
            <option value="">Condición: todas</option>
            <option value="Nuevo">Nuevo</option>
            <option value="Usado">Usado</option>
          </select>
          <div class="chips">
            <button class="f-chip" [class.on]="!fPrep() && !fAsig()" (click)="limpiar()">Todos ({{ data.equipos().length }})</button>
          </div>
        </div>
      </div>

      <div class="card table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Inventario</th>
              <th>Equipo</th>
              <th>Especificaciones</th>
              <th>Preparación</th>
              <th>Asignación</th>
              <th>Expediente técnico</th>
              <th>Ingreso</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (e of filtrados(); track e.inventario) {
              <tr>
                <td>
                  <div class="main-cell mono">{{ e.inventario }}</div>
                  <div class="sub-cell">Serie {{ e.serie }}</div>
                </td>
                <td>
                  <div class="main-cell">{{ e.marca }} {{ e.modelo }}</div>
                  <div class="sub-cell">{{ e.tipo === 'Desktop' ? 'CPU / Desktop' : 'Laptop' }} · {{ e.condicion.toLowerCase() }}</div>
                </td>
                <td>
                  <div class="main-cell">{{ e.ram.split('·')[0].trim() }} · {{ e.disco.split('·')[0].trim() }}</div>
                  <div class="sub-cell">{{ e.sistemaOperativo || 'Sin sistema operativo base' }}</div>
                </td>
                <td>
                  <ui-badge [estado]="data.estadoPreparacionEquipo(e.inventario)" />
                  @if (tecnicoPreparo(e); as t) { <div class="sub-cell">{{ t }}</div> }
                </td>
                <td>
                  <ui-badge [estado]="data.estadoAsignacionEquipo(e.inventario)" />
                  @if (data.asignacionDeEquipo(e.inventario); as a) { <div class="sub-cell">{{ a.usuarioFinal }}</div> }
                </td>
                <td>
                  @if (data.expTecnicoDeEquipo(e.inventario); as t) {
                    <div class="exp-cod">{{ t.codigo }}</div>
                    <div class="sub-cell">{{ expUnicoTxt(e) || t.estado }}</div>
                  } @else {
                    <span class="sin-exp">NO TIENE EXPEDIENTE TÉCNICO</span>
                  }
                </td>
                <td>
                  <div class="main-cell mono">{{ e.fechaIngreso || '—' }}</div>
                  <div class="sub-cell">{{ e.ingresadoPor || 'Sin registro de ingreso' }}</div>
                </td>
                <td>
                  <div class="row" style="justify-content: flex-end; flex-wrap: nowrap;">
                    <button class="btn btn-ghost btn-sm" (click)="detalle.set(e)">Ver detalle</button>
                    @if (data.puedeCrearNuevoExpedienteTecnico(e.inventario) && esEncargado()) {
                      <button class="btn btn-primary btn-sm" (click)="crearExpediente(e)">Crear Expediente técnico</button>
                    }
                    @if (data.esperaReingresoAHardware(e.inventario) && puedeIngresar()) {
                      <button class="btn btn-gold btn-sm" (click)="abrirReingreso(e)">Registrar reingreso</button>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="muted" style="text-align:center; padding: 28px;">No hay equipos que coincidan con los filtros.</td></tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Detalle del equipo -->
      @if (detalle(); as e) {
        <ui-modal [titulo]="e.marca + ' ' + e.modelo" [sub]="'Inventario ' + e.inventario" (cerrar)="detalle.set(null)">
          <div class="grid grid-2">
            <dl class="dl">
              <dt>Número de inventario</dt><dd class="mono">{{ e.inventario }}</dd>
              <dt>Serie</dt><dd class="mono">{{ e.serie }}</dd>
              <dt>Tipo de equipo</dt><dd>{{ e.tipo === 'Desktop' ? 'CPU / Desktop' : 'Laptop' }}</dd>
              <dt>Condición</dt><dd><ui-badge [estado]="e.condicion" /></dd>
              <dt>Marca y modelo</dt><dd>{{ e.marca }} {{ e.modelo }}</dd>
              <dt>Procesador</dt><dd>{{ e.procesador }}</dd>
              <dt>RAM</dt><dd>{{ e.ram }}</dd>
              <dt>Disco</dt><dd>{{ e.disco }}</dd>
              <dt>Sistema operativo base</dt><dd>{{ e.sistemaOperativo || '—' }}</dd>
            </dl>
            <dl class="dl">
              <dt>Estado de preparación</dt><dd><ui-badge [estado]="data.estadoPreparacionEquipo(e.inventario)" /></dd>
              <dt>Estado de asignación</dt><dd><ui-badge [estado]="data.estadoAsignacionEquipo(e.inventario)" /></dd>
              <dt>Expediente técnico</dt>
              <dd>
                @if (data.expTecnicoDeEquipo(e.inventario); as t) { <span class="exp-cod">{{ t.codigo }}</span> · {{ t.estado }} }
                @else { <span class="sin-exp">NO TIENE EXPEDIENTE TÉCNICO</span> }
              </dd>
              <dt>Fecha de ingreso</dt><dd>{{ e.fechaIngreso ? e.fechaIngreso + (e.horaIngreso ? ' · ' + e.horaIngreso : '') : '—' }}</dd>
              <dt>Ingresado por</dt><dd>{{ e.ingresadoPor || '—' }}</dd>
              <dt>Origen del dato</dt><dd>{{ e.origenDato || '—' }}</dd>
              <dt>Última actualización</dt><dd class="mono">{{ e.ultimaActualizacion || '—' }}</dd>
              <dt>Fecha de adquisición
                <ui-help texto="Viene de la base institucional al ingresar el equipo. Es la fecha desde la que corre la garantía del proveedor; no es la fecha de ingreso al inventario." />
              </dt>
              <dd class="mono">{{ e.fechaAdquisicion || 'No consta' }}</dd>
              <dt>Proveedor</dt><dd>{{ e.proveedor || '—' }}</dd>
              <dt>Técnico que preparó</dt><dd>{{ tecnicoPreparo(e) || '—' }}</dd>
              <dt>Fecha de preparación</dt><dd>{{ fechaPreparacion(e) || '—' }}</dd>
              <dt>Nombre del equipo</dt><dd class="mono">{{ data.nombreEquipoActual(e.inventario) || '—' }}</dd>
              <dt>Reserva de IP</dt><dd>{{ data.reservaIPEquipo(e.inventario).requiere || '—' }}</dd>
              <dt>IP reservada</dt><dd class="mono">{{ data.textoIPReservada(ultimaConfig(e)) }}</dd>
              <dt>MAC del equipo</dt><dd class="mono">{{ macDe(e) || 'Sin registrar' }}</dd>
              @if (data.reservaIPEquipo(e.inventario).requiere === 'Sí') {
                <dt>Solicitud de reserva de IP</dt><dd>{{ data.textoEstadoSolicitudIP(ultimaConfig(e)) }}</dd>
              }
              <dt>Usuario final asignado</dt><dd>{{ data.asignacionDeEquipo(e.inventario)?.usuarioFinal || '—' }}</dd>
              <dt>Expediente único asociado</dt><dd>{{ expUnicoTxt(e) || '—' }}</dd>
              <dt>Observaciones</dt><dd>{{ e.observaciones || 'Sin observaciones' }}</dd>
            </dl>
          </div>

          @if (resumen(e); as r) {
            <div class="grid grid-2 mt-2">
              <dl class="dl">
                <dt>Responsable operativo</dt><dd>{{ r.responsableOperativo }}</dd>
                <dt>Veces ingresado a Hardware</dt><dd>{{ r.vecesIngresado }}</dd>
                <dt>Veces preparado</dt><dd>{{ r.vecesPreparado }}</dd>
                <dt>Veces configurado</dt><dd>{{ r.vecesConfigurado }}</dd>
                <dt>Intentos F0302</dt><dd>{{ r.intentosF0302 }}</dd>
                <dt>Fallas F0302</dt><dd>{{ r.fallasF0302 }}</dd>
                <dt>Reprocesos F0288</dt><dd>{{ r.reprocesosF0288 }} <span class="chip">No suman expedientes técnicos</span></dd>
                <dt>Veces asignado</dt><dd>{{ r.vecesAsignado }}</dd>
                <dt>Veces descargado</dt><dd>{{ r.vecesDescargado }}</dd>
              </dl>
              <dl class="dl">
                <dt>Último técnico que preparó</dt><dd>{{ r.ultimoTecnicoPreparo || '—' }}</dd>
                <dt>Último técnico que configuró</dt><dd>{{ r.ultimoTecnicoConfiguro || '—' }}</dd>
                <dt>Última preparación</dt>
                <dd>@if (r.ultimaPreparacion; as p) { {{ p.firma.fecha }} · {{ data.formatoDuracion(p.cronometro?.duracionMinutos) }} · {{ p.cierre?.nivel }} } @else { — }</dd>
                <dt>Última configuración</dt>
                <dd>@if (r.ultimaConfiguracion; as c) { {{ c.fecha }} · {{ data.formatoDuracion(c.cronometro?.duracionMinutos) }} · {{ c.cierre?.nivel }} } @else { — }</dd>
                <dt>Estado de garantía</dt><dd><ui-badge [estado]="r.estadoGarantia" /></dd>
                <dt>Último descargo</dt>
                <dd>@if (r.ultimoDescargo; as d) { {{ d.fechaDescargo }} · {{ d.motivoDescargo }} } @else { — }</dd>
              </dl>
            </div>
          }
          @if (data.puedeCrearNuevoExpedienteTecnico(e.inventario)) {
            <div class="alert warn mt-2">
              <span class="alert-ico">!</span>
              <span>
                @if (data.expTecnicoDeEquipo(e.inventario); as t) {
                  Este equipo <b>reingresó a Hardware</b>: su expediente técnico anterior
                  (<b class="mono">{{ t.codigo }}</b>) quedó <b>{{ t.estado }}</b> y no se
                  reutiliza. Puede crearse un <b>nuevo Expediente técnico</b> y una nueva
                  Preparación F0288, conservando el ciclo anterior como historial.
                } @else {
                  Este equipo aún <b>no tiene Expediente técnico</b>: debe crearse y completar la Preparación técnica F0288 antes de poder asignarlo a un usuario final.
                }
              </span>
            </div>
          }
          @if (data.esperaReingresoAHardware(e.inventario)) {
            <div class="alert warn mt-2">
              <span class="alert-ico">!</span>
              <span>
                Este equipo fue <b>descargado</b>
                @if (data.ultimoDescargo(e.inventario); as d) { el <b class="mono">{{ d.fechaDescargo }}</b> ({{ d.motivoDescargo }} · {{ d.accionPosterior }}) }
                y quedó <b>en espera de reingreso a Hardware</b>: esa acción posterior no genera el
                ingreso automáticamente. Debe <b>registrarse el reingreso</b> para poder crear un
                nuevo Expediente técnico y repetir la Preparación F0288; solo entonces vuelve a
                estar disponible para asignarlo.
              </span>
            </div>
          }
          @if (!auth.esTecnico()) {
            <div class="row mt-2" style="justify-content: flex-end;">
              <button class="btn btn-outline" (click)="verHistorial(e)">Ver historial técnico del equipo</button>
              @if (data.puedeCrearNuevoExpedienteTecnico(e.inventario) && esEncargado()) {
                <button class="btn btn-primary" (click)="crearExpediente(e)">Crear Expediente técnico</button>
              }
              @if (data.esperaReingresoAHardware(e.inventario) && puedeIngresar()) {
                <button class="btn btn-gold" (click)="abrirReingreso(e)">Registrar reingreso a Hardware</button>
              }
            </div>
          }
        </ui-modal>
      }

      <!-- Reingreso a Hardware de un equipo descargado en espera (solo Encargados y Administrador) -->
      @if (reingreso(); as e) {
        <ui-modal titulo="Registrar reingreso a Hardware"
          [sub]="e.marca + ' ' + e.modelo + ' · Inventario ' + e.inventario"
          (cerrar)="reingreso.set(null)">
          <div class="alert mt-0">
            <span class="alert-ico">i</span>
            <span>
              El reingreso <b>no reabre nada del ciclo anterior</b>: el Expediente técnico
              @if (data.expTecnicoDeEquipo(e.inventario); as t) { <b class="mono">{{ t.codigo }}</b> } y su F0288
              quedan como historial. Solo habilita crear un <b>nuevo Expediente técnico</b> y repetir la
              Preparación F0288 antes de volver a asignar el equipo.
            </span>
          </div>
          @if (data.ultimoDescargo(e.inventario); as d) {
            <dl class="dl mt-2">
              <dt>Descargo que lo dejó en espera</dt>
              <dd><span class="mono">{{ d.idDescargo }}</span> · {{ d.fechaDescargo }} · {{ d.motivoDescargo }}</dd>
              <dt>Acción posterior registrada</dt><dd>{{ d.accionPosterior }}</dd>
              <dt>Usuario final anterior</dt><dd>{{ d.usuarioFinalEntrega }}</dd>
              <dt>Estado físico reportado</dt><dd>{{ d.estadoFisico || '—' }}</dd>
            </dl>
          }
          <div class="grid grid-2 mt-2">
            <div class="field">
              <label>Motivo del reingreso <span class="req">*</span></label>
              <select class="control" [(ngModel)]="rMotivo">
                @for (m of motivosReingreso; track m) { <option [value]="m">{{ m }}</option> }
              </select>
            </div>
            <div class="field">
              <label>Observaciones</label>
              <input class="control" [(ngModel)]="rObs" placeholder="Estado en que se recibe, destino previsto…" />
            </div>
          </div>
          <div class="row mt-2" style="gap: 8px; flex-wrap: wrap; align-items: center;">
            <span class="small muted">Estado tras el reingreso:</span>
            <ui-badge [estado]="'Pendiente de preparación'" />
            <ui-badge [estado]="'No asignado'" />
          </div>
          <div class="row mt-2" style="justify-content: flex-end;">
            <button class="btn btn-ghost" (click)="reingreso.set(null)">Cancelar</button>
            <button class="btn btn-gold" (click)="registrarReingreso()">Registrar reingreso a Hardware</button>
          </div>
        </ui-modal>
      }

      <!-- Ingresar equipo: se consulta la base institucional y se autocompleta (Encargados y Administrador) -->
      @if (ingresoAbierto()) {
        <ui-modal titulo="Ingresar equipo al Inventario de Hardware"
          sub="Los datos del equipo se consultan por número de inventario; no se llenan a mano"
          (cerrar)="ingresoAbierto.set(false)">

          <!-- Paso 1: consulta -->
          <div class="paso">
            <div class="paso-t"><span>Buscar equipo en base institucional simulada</span></div>
            <div class="buscar-row">
              <div class="field" style="flex: 1 1 260px;">
                <label>Número de inventario <span class="req">*</span></label>
                <input class="control mono" [(ngModel)]="cInv" (keyup.enter)="buscarEquipo()"
                  placeholder="2201-00-101-0001" />
              </div>
              <button class="btn btn-primary" (click)="buscarEquipo()">Buscar equipo</button>
            </div>
            <p class="small muted mt-1">
              CPU: <b class="mono">2201-00-101-xxxx</b> · Laptop: <b class="mono">2201-00-920-xxxx</b>.
              @if (tipoDetectado(); as t) {
                El número corresponde a <b>{{ t === 'Desktop' ? 'CPU / Desktop' : 'Laptop' }}</b>.
              }
            </p>
          </div>

          <!-- Paso 2: resultado de la consulta -->
          @if (consulta(); as c) {
            @switch (c.resultado) {
              @case ('Formato inválido') {
                <div class="alert danger mt-2">
                  <span class="alert-ico">!</span>
                  <span>
                    El número de inventario <b>no cumple con el formato esperado</b>.
                    Para CPU use: <b class="mono">2201-00-101-xxxx</b>.
                    Para Laptop use: <b class="mono">2201-00-920-xxxx</b>.
                  </span>
                </div>
              }
              @case ('No encontrado') {
                <div class="alert danger mt-2">
                  <span class="alert-ico">!</span>
                  <span>
                    No se encontró información para el número <b class="mono">{{ c.inventario }}</b> en la
                    <b>base institucional simulada</b>. Verifique el número ingresado. No se autocompletó
                    ningún dato: el equipo no puede ingresarse sin respaldo del registro institucional.
                  </span>
                </div>
              }
              @case ('Ya registrado') {
                <div class="alert warn mt-2">
                  <span class="alert-ico">!</span>
                  <span>
                    Este equipo <b>ya se encuentra registrado en el Inventario de Hardware</b>: no se duplica.
                    Puede consultar su historial técnico para ver en qué punto del flujo está.
                  </span>
                </div>
              }
            }

            @if (c.equipo; as f) {
              <div class="paso hallado mt-2">
                <div class="paso-t">
                  <span>Equipo encontrado</span>
                  <span class="origen">Origen: base institucional simulada</span>
                </div>
                <div class="grid grid-2">
                  <dl class="dl">
                    <dt>Número de inventario</dt><dd class="mono">{{ f.inventario }}</dd>
                    <dt>Tipo de equipo</dt><dd>{{ f.tipo === 'Desktop' ? 'CPU / Desktop' : 'Laptop' }}</dd>
                    <dt>Marca</dt><dd>{{ f.marca }}</dd>
                    <dt>Modelo</dt><dd>{{ f.modelo }}</dd>
                    <dt>Serie</dt><dd class="mono">{{ f.serie }}</dd>
                    <dt>Estado físico inicial</dt><dd><ui-badge [estado]="f.estadoFisicoInicial" /></dd>
                  </dl>
                  <dl class="dl">
                    <dt>Procesador</dt><dd>{{ f.procesador }}</dd>
                    <dt>Memoria RAM</dt><dd>{{ f.ram }}</dd>
                    <dt>Almacenamiento</dt><dd>{{ f.almacenamiento }}</dd>
                    <dt>Sistema operativo</dt>
                    <dd>{{ f.sistemaOperativo || 'No trae: se instala durante la preparación' }}</dd>
                    <dt>Responsable operativo
                      <ui-help texto="Se calcula según el tipo de equipo (CPU/Desktop → Encargado de Hardware, Laptop → Encargado de Soporte); es informativo y no se guarda como campo del equipo." />
                    </dt>
                    <dd>{{ data.responsableOperativo({ tipo: f.tipo }) }}</dd>
                    <dt>Última actualización</dt><dd class="mono">{{ f.ultimaActualizacion }}</dd>
                  </dl>
                </div>
                <!-- Adquisición y garantía: es de aquí de donde sale el inicio de la garantía
                     del proveedor, no de la aceptación del usuario final ni del ingreso. -->
                <div class="grid grid-2 mt-2">
                  <dl class="dl">
                    <dt>Fecha de adquisición
                      <ui-help texto="Fecha en que la institución compró el equipo. Es la fecha desde la que corre la garantía del proveedor; no es la fecha de ingreso al Inventario de Hardware." />
                    </dt>
                    <dd class="mono">{{ f.fechaAdquisicion || 'No consta en el registro institucional' }}</dd>
                    <dt>Fecha de recepción</dt><dd class="mono">{{ f.fechaRecepcion || '—' }}</dd>
                    <dt>Proveedor</dt><dd>{{ f.proveedor || '—' }}</dd>
                  </dl>
                  <dl class="dl">
                    <dt>Tipo de garantía sugerida</dt>
                    <dd>@if (f.tipoGarantiaSugerida) { <ui-badge [estado]="f.tipoGarantiaSugerida" /> } @else { — }</dd>
                    <dt>Garantía del proveedor</dt>
                    <dd class="mono">
                      @if (f.inicioGarantiaProveedor) {
                        {{ f.inicioGarantiaProveedor }} → {{ f.vencimientoGarantiaProveedor }}
                      } @else { — }
                    </dd>
                    <dt>Duración</dt><dd>{{ f.duracionGarantiaProveedor || '—' }}</dd>
                  </dl>
                </div>
                @if (f.estadoFisicoInicial === 'Nuevo' && !f.fechaAdquisicion) {
                  <div class="alert warn mt-2">
                    <span class="alert-ico">!</span>
                    <span>{{ data.MSG_DATOS_INSTITUCIONALES }}</span>
                  </div>
                }
                <p class="small mt-1">
                  <b>Observación del registro institucional:</b> {{ f.observacionRegistro }}
                </p>
              </div>

              @if (c.resultado === 'Encontrado') {
                <div class="field mt-2">
                  <label>Observaciones del ingreso</label>
                  <input class="control" [(ngModel)]="cObs"
                    placeholder="Si se deja vacío se guarda la observación del registro institucional." />
                </div>
                <div class="row mt-2" style="gap: 8px; flex-wrap: wrap; align-items: center;">
                  <span class="small muted">Estados al guardar:</span>
                  <ui-badge [estado]="'Pendiente de preparación'" />
                  <ui-badge [estado]="'No asignado'" />
                  <span class="sin-exp">NO TIENE EXPEDIENTE TÉCNICO</span>
                </div>
                <div class="alert mt-2">
                  <span class="alert-ico">i</span>
                  <span>
                    Al guardar se registran automáticamente la <b>fecha y hora de ingreso</b>, el
                    <b>responsable</b> ({{ auth.usuario()?.nombre }}), el <b>origen del dato</b> y la consulta
                    completa en Trazabilidad. Después un Encargado podrá <b>crear su Expediente técnico</b> y
                    trabajar la <b>Preparación F0288</b>; solo entonces el equipo quedará preparado y asignable.
                  </span>
                </div>
              }
              @if (c.resultado === 'Ya registrado') {
                <div class="row mt-2" style="justify-content: flex-end;">
                  <button class="btn btn-outline" (click)="verHistorialDe(f.inventario)">Ver historial técnico del equipo</button>
                </div>
              }
            }
          }

          <!-- Registro manual: acción especial del Administrador cuando el número no está en la base -->
          @if (manual()) {
            <div class="alert warn mt-2">
              <span class="alert-ico">!</span>
              <span>
                <b>Registro manual del Administrador.</b> El número <b class="mono">{{ nInv() }}</b> no existe en la
                base institucional simulada, así que estos datos se cargan bajo su responsabilidad y el equipo
                quedará con origen <b>Registro manual</b> en su ficha y en la trazabilidad.
              </span>
            </div>
            <div class="grid grid-2 mt-2">
              <div class="field">
                <label>Número de inventario <span class="req">*</span></label>
                <input class="control mono" readonly [value]="nInv()" />
              </div>
              <div class="field">
                <label>Serie (si aplica)</label>
                <input class="control" [(ngModel)]="nSerie" placeholder="Serie del fabricante…" />
              </div>
              <div class="field">
                <label>Tipo de equipo <span class="req">*</span></label>
                <select class="control" [(ngModel)]="nTipo">
                  <option value="Laptop">Laptop</option>
                  <option value="Desktop">CPU / Desktop</option>
                </select>
              </div>
              <div class="field">
                <label>Estado físico inicial <span class="req">*</span></label>
                <select class="control" [(ngModel)]="nCond">
                  <option value="Nuevo">Nuevo</option>
                  <option value="Usado">Usado</option>
                </select>
              </div>
              <div class="field">
                <label>Marca <span class="req">*</span></label>
                <input class="control" [(ngModel)]="nMarca" placeholder="HP, Dell, Lenovo…" />
              </div>
              <div class="field">
                <label>Modelo <span class="req">*</span></label>
                <input class="control" [(ngModel)]="nModelo" placeholder="EliteBook 840 G11…" />
              </div>
              <div class="field">
                <label>Memoria RAM <span class="req">*</span></label>
                <input class="control" [(ngModel)]="nRam" placeholder="16 GB" />
              </div>
              <div class="field">
                <label>Almacenamiento <span class="req">*</span></label>
                <input class="control" [(ngModel)]="nDisco" placeholder="512 GB SSD" />
              </div>
              <div class="field">
                <label>Procesador</label>
                <input class="control" [(ngModel)]="nProc" placeholder="Intel Core i7…" />
              </div>
              <div class="field">
                <label>Sistema operativo (si aplica)</label>
                <input class="control" [(ngModel)]="nSO" placeholder="Windows 11 Pro, o vacío si se instalará en la preparación" />
              </div>
              <div class="field">
                <label>Observaciones</label>
                <input class="control" [(ngModel)]="nObs" placeholder="Origen del equipo, detalles de recepción…" />
              </div>
              <div class="field">
                <label>Responsable operativo
                  <ui-help texto="Se calcula automáticamente según el tipo de equipo (CPU/Desktop → Encargado de Hardware, Laptop → Encargado de Soporte); es informativo y no se guarda como campo del equipo." />
                </label>
                <input class="control" readonly [value]="data.responsableOperativo({ tipo: nTipo() })" />
              </div>
            </div>
            <div class="row mt-2" style="justify-content: flex-end;">
              <button class="btn btn-ghost" (click)="manual.set(false)">Cancelar registro manual</button>
              <button class="btn btn-gold" (click)="registrarEquipoManual()">Registrar equipo manualmente</button>
            </div>
          } @else {
            <div class="row mt-2" style="justify-content: flex-end;">
              <button class="btn btn-ghost" (click)="ingresoAbierto.set(false)">Cerrar</button>
              @if (consulta()?.resultado === 'No encontrado' && auth.esAdmin()) {
                <button class="btn btn-outline" (click)="abrirManual()">Registrar manualmente (Administrador)</button>
              }
              @if (consultaGuardable(); as f) {
                <button class="btn btn-gold" (click)="ingresarConsultado()">Ingresar equipo al Inventario de Hardware</button>
              }
            </div>
          }
        </ui-modal>
      }

      <!-- Ingreso múltiple: pegar listado o generar por rango, validar contra la base institucional y previsualizar -->
      @if (loteAbierto()) {
        <ui-modal titulo="Ingreso múltiple de equipos" sub="Se valida cada número contra la base institucional simulada antes de ingresar" (cerrar)="loteAbierto.set(false)">
          <div class="row mt-0" style="gap: 8px;">
            <button class="btn btn-sm" [class.btn-primary]="loteModo() === 'listado'" [class.btn-outline]="loteModo() !== 'listado'" (click)="loteModo.set('listado')">Pegar listado</button>
            <button class="btn btn-sm" [class.btn-primary]="loteModo() === 'rango'" [class.btn-outline]="loteModo() !== 'rango'" (click)="loteModo.set('rango')">Generar por rango</button>
          </div>

          @if (loteModo() === 'listado') {
            <div class="field mt-2">
              <label>Números de inventario (uno por línea) <span class="req">*</span></label>
              <textarea class="control mono" rows="6" placeholder="2201-00-101-0001&#10;2201-00-101-0002&#10;2201-00-920-0001" [(ngModel)]="loteTexto"></textarea>
            </div>
          } @else {
            <div class="form-grid mt-2">
              <div class="field">
                <label>Tipo de equipo</label>
                <select class="control" [(ngModel)]="loteTipoRango">
                  <option value="Desktop">CPU</option>
                  <option value="Laptop">Laptop</option>
                </select>
              </div>
              <div></div>
              <div class="field">
                <label>Desde <span class="req">*</span></label>
                <input class="control mono" [(ngModel)]="loteDesde" [placeholder]="loteTipoRango() === 'Desktop' ? '2201-00-101-0001' : '2201-00-920-0001'" />
              </div>
              <div class="field">
                <label>Hasta <span class="req">*</span></label>
                <input class="control mono" [(ngModel)]="loteHasta" [placeholder]="loteTipoRango() === 'Desktop' ? '2201-00-101-0010' : '2201-00-920-0010'" />
              </div>
            </div>
          }

          <div class="row mt-2" style="justify-content: flex-end;">
            <button class="btn btn-primary" (click)="validarLote()">Validar equipos</button>
          </div>

          @if (loteFilas(); as filas) {
            <div class="table-wrap mt-2">
              <table class="tbl">
                <thead>
                  <tr><th></th><th>Inventario</th><th>Tipo</th><th>Marca</th><th>Modelo</th><th>Serie</th><th>Resultado</th></tr>
                </thead>
                <tbody>
                  @for (f of filas; track f.inventario) {
                    <tr>
                      <td><input type="checkbox" [checked]="f.resultado === 'Listo para ingresar'" disabled /></td>
                      <td class="mono main-cell">{{ f.inventario || '—' }}</td>
                      <td>{{ f.tipo === 'Desktop' ? 'CPU' : f.tipo === 'Laptop' ? 'Laptop' : '—' }}</td>
                      <td>{{ f.marca || '—' }}</td>
                      <td>{{ f.modelo || '—' }}</td>
                      <td class="mono">{{ f.serie || '—' }}</td>
                      <td><ui-badge [estado]="f.resultado" /></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="small muted mt-1">
              Solo se ingresarán los equipos marcados <b>Listo para ingresar</b> ({{ contarListos(filas) }} de {{ filas.length }}).
            </p>
            <div class="row mt-2" style="justify-content: flex-end;">
              <button class="btn btn-ghost" (click)="loteAbierto.set(false)">Cerrar</button>
              <button class="btn btn-gold" [disabled]="contarListos(filas) === 0" (click)="ingresarLote()">Ingresar equipos válidos al Inventario de Hardware</button>
            </div>
          }
        </ui-modal>
      }
    </div>
  `
})
export class InventarioHardwareComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected q = signal('');
  protected fTipo = signal('');
  protected fCond = signal('');
  protected fPrep = signal('');
  protected fAsig = signal('');
  protected detalle = signal<Equipo | null>(null);

  /** Solo los Encargados (Soporte o Hardware) crean expedientes técnicos. */
  protected readonly esEncargado = computed(() => {
    const rol = this.auth.usuario()?.clave;
    return rol === 'enc-soporte' || rol === 'enc-hardware';
  });

  /** Ingresan equipos al inventario los Encargados y el Administrador; los técnicos no. */
  protected readonly puedeIngresar = computed(() => this.esEncargado() || this.auth.esAdmin());

  // ---------- Reingreso a Hardware de un equipo descargado en espera ----------
  protected reingreso = signal<Equipo | null>(null);
  protected rMotivo = signal<MotivoIngreso>('Reingreso por reasignación');
  protected rObs = signal('');
  /** Solo motivos de reingreso: «Preparación inicial» corresponde al primer ingreso del equipo. */
  protected readonly motivosReingreso: MotivoIngreso[] = [
    'Reingreso por reasignación', 'Reingreso por cambio de usuario', 'Reingreso por devolución',
    'Reingreso por garantía', 'Reingreso por revisión técnica'
  ];

  protected abrirReingreso(e: Equipo): void {
    this.rMotivo.set(this.data.motivoReingresoSugerido(e.inventario));
    this.rObs.set('');
    this.reingreso.set(e);
  }

  protected registrarReingreso(): void {
    const e = this.reingreso();
    if (!e) return;
    if (!this.puedeIngresar()) {
      this.toast.error('Acción no permitida', 'Solo los Encargados o el Administrador registran ingresos a Hardware.');
      return;
    }
    const u = this.auth.usuario();
    const error = this.data.registrarReingresoAHardware(
      e.inventario, this.rMotivo(), `${u?.nombre} — ${u?.rol}`, this.rObs().trim());
    if (error) {
      this.toast.error('No se puede registrar el reingreso', error);
      return;
    }
    this.reingreso.set(null);
    this.detalle.set(null);
    this.toast.ok(`Reingreso del equipo ${e.inventario} registrado`,
      'El equipo quedó pendiente de preparación y no asignado. Ya puede crearse su nuevo Expediente técnico y repetir la Preparación F0288.');
  }

  // ---------- Ingresar equipo: consulta a la base institucional simulada ----------
  protected ingresoAbierto = signal(false);
  /** Número que se está consultando y observación opcional del ingreso. */
  protected cInv = signal('');
  protected cObs = signal('');
  /** Resultado de la última consulta; null mientras no se haya buscado nada. */
  protected consulta = signal<ConsultaInventario | null>(null);
  /** Registro manual: solo lo abre el Administrador cuando el número no está en la base. */
  protected manual = signal(false);

  /** Tipo deducido del número que se está escribiendo, para orientar antes de buscar. */
  protected readonly tipoDetectado = computed(() => this.data.tipoPorNumeroInventario(this.cInv()));

  /** Ficha lista para guardarse: solo cuando la consulta encontró el equipo y no está duplicado. */
  protected readonly consultaGuardable = computed(() => {
    const c = this.consulta();
    return c?.resultado === 'Encontrado' ? c.equipo : undefined;
  });

  protected buscarEquipo(): void {
    this.manual.set(false);
    const u = this.auth.usuario();
    this.consulta.set(this.data.consultarBaseInstitucional(this.cInv(), `${u?.nombre} — ${u?.rol}`));
  }

  protected ingresarConsultado(): void {
    const ficha = this.consultaGuardable();
    if (!ficha) return;
    if (!this.puedeIngresar()) {
      this.toast.error('Acción no permitida', 'Solo los Encargados o el Administrador ingresan equipos al inventario.');
      return;
    }
    const u = this.auth.usuario();
    const error = this.data.ingresarDesdeCatalogo(ficha, `${u?.nombre} — ${u?.rol}`, this.cObs());
    if (error) {
      this.toast.error('No se puede registrar el equipo', error);
      return;
    }
    this.ingresoAbierto.set(false);
    this.toast.ok(`Equipo ${ficha.inventario} ingresado al Inventario de Hardware`,
      'Los datos se autocompletaron desde la base institucional simulada. Quedó pendiente de preparación, no asignado y sin Expediente técnico; ya puede crearse su Expediente técnico.');
  }

  /** Abre el «Historial técnico del equipo» de un equipo ya registrado, desde la consulta. */
  protected verHistorialDe(inventario: string): void {
    this.ingresoAbierto.set(false);
    this.router.navigate(['/trazabilidad'], { queryParams: { inventario } });
  }

  // ---------- Registro manual (acción especial del Administrador) ----------
  protected nInv = signal('');
  protected nSerie = signal('');
  protected nTipo = signal<'Laptop' | 'Desktop'>('Laptop');
  protected nCond = signal<'Nuevo' | 'Usado'>('Nuevo');
  protected nMarca = signal('');
  protected nModelo = signal('');
  protected nRam = signal('');
  protected nDisco = signal('');
  protected nProc = signal('');
  protected nSO = signal('');
  protected nObs = signal('');

  protected abrirIngreso(): void {
    this.cInv.set('');
    this.cObs.set('');
    this.consulta.set(null);
    this.manual.set(false);
    this.limpiarManual();
    this.ingresoAbierto.set(true);
  }

  private limpiarManual(): void {
    [this.nInv, this.nSerie, this.nMarca, this.nModelo, this.nRam, this.nDisco, this.nProc, this.nSO, this.nObs]
      .forEach((s) => s.set(''));
    this.nTipo.set('Laptop');
    this.nCond.set('Nuevo');
  }

  /** El número consultado no existe en la base: el Administrador puede cargarlo bajo su responsabilidad. */
  protected abrirManual(): void {
    this.limpiarManual();
    this.nInv.set(this.consulta()?.inventario ?? this.cInv().trim());
    this.nTipo.set(this.tipoDetectado() ?? 'Laptop');
    this.manual.set(true);
  }

  protected registrarEquipoManual(): void {
    if (!this.auth.esAdmin()) {
      this.toast.error('Acción no permitida', 'El registro manual, sin respaldo de la base institucional, es una acción exclusiva del Administrador.');
      return;
    }
    const requeridos: [string, string][] = [
      [this.nInv().trim(), 'número de inventario'], [this.nMarca().trim(), 'marca'],
      [this.nModelo().trim(), 'modelo'], [this.nRam().trim(), 'RAM'], [this.nDisco().trim(), 'disco']
    ];
    const faltantes = requeridos.filter(([v]) => !v).map(([, n]) => n);
    if (faltantes.length > 0) {
      this.toast.warn('Datos incompletos', `Complete: ${faltantes.join(', ')}.`);
      return;
    }
    const u = this.auth.usuario();
    const error = this.data.agregarEquipo({
      inventario: this.nInv().trim(),
      serie: this.nSerie().trim(),
      marca: this.nMarca().trim(),
      modelo: this.nModelo().trim(),
      tipo: this.nTipo(),
      condicion: this.nCond(),
      procesador: this.nProc().trim(),
      ram: this.nRam().trim(),
      disco: this.nDisco().trim(),
      sistemaOperativo: this.nSO().trim(),
      observaciones: this.nObs().trim()
    }, `${u?.nombre} — ${u?.rol}`);
    if (error) {
      this.toast.error('No se puede registrar el equipo', error);
      return;
    }
    this.ingresoAbierto.set(false);
    this.toast.ok(`Equipo ${this.nInv().trim()} ingresado al inventario (registro manual)`,
      'El equipo quedó con origen «Registro manual» porque no figura en la base institucional simulada. Se registró la fecha, la hora y el usuario, y el evento quedó en Trazabilidad. Ya puede crearse su Expediente técnico.');
  }

  // ---------- Ingreso múltiple ----------
  protected loteAbierto = signal(false);
  protected loteModo = signal<'listado' | 'rango'>('listado');
  protected loteTexto = signal('');
  protected loteTipoRango = signal<'Laptop' | 'Desktop'>('Desktop');
  protected loteDesde = signal('');
  protected loteHasta = signal('');
  protected loteFilas = signal<FilaValidacionLote[] | null>(null);

  protected abrirIngresoMultiple(): void {
    this.loteModo.set('listado');
    this.loteTexto.set('');
    this.loteDesde.set('');
    this.loteHasta.set('');
    this.loteFilas.set(null);
    this.loteAbierto.set(true);
  }

  protected validarLote(): void {
    const u = this.auth.usuario();
    const usuarioTxt = `${u?.nombre} — ${u?.rol}`;
    let numeros: string[];
    if (this.loteModo() === 'listado') {
      numeros = this.loteTexto().split(/\r?\n/).map((n) => n.trim()).filter(Boolean);
      if (!numeros.length) {
        this.toast.warn('Nada que validar', 'Pegue al menos un número de inventario.');
        return;
      }
    } else {
      const { numeros: generados, error } = this.data.generarRangoInventario(this.loteDesde(), this.loteHasta());
      if (error) {
        this.toast.error('Rango no válido', error);
        return;
      }
      numeros = generados;
      this.data.registrarRangoGenerado(this.loteDesde().trim(), this.loteHasta().trim(), numeros.length, usuarioTxt);
    }
    this.loteFilas.set(this.data.validarLoteInventario(numeros, usuarioTxt, this.loteModo()));
  }

  protected contarListos(filas: FilaValidacionLote[]): number {
    return filas.filter((f) => f.resultado === 'Listo para ingresar').length;
  }

  protected ingresarLote(): void {
    const filas = this.loteFilas();
    if (!filas) return;
    if (!this.puedeIngresar()) {
      this.toast.error('Acción no permitida', 'Solo los Encargados o el Administrador ingresan equipos al inventario.');
      return;
    }
    const u = this.auth.usuario();
    const { exitosos, errores } = this.data.ingresarLoteValido(filas, `${u?.nombre} — ${u?.rol}`);
    this.loteAbierto.set(false);
    if (exitosos > 0) {
      this.toast.ok(`${exitosos} equipo(s) ingresado(s) al Inventario de Hardware`,
        'Todos quedaron pendientes de preparación, no asignados y sin Expediente técnico.');
    }
    if (errores.length) {
      this.toast.warn('Algunos equipos no se pudieron ingresar', errores.join(' · '));
    }
  }

  protected contarPrep(estado: string): number {
    return this.data.equipos().filter((e) => this.data.estadoPreparacionEquipo(e.inventario) === estado).length;
  }
  protected contarAsig(estado: string): number {
    return this.data.equipos().filter((e) => this.data.estadoAsignacionEquipo(e.inventario) === estado).length;
  }

  protected togglePrep(estado: string): void {
    this.fPrep.set(this.fPrep() === estado ? '' : estado);
  }
  protected toggleAsig(estado: string): void {
    this.fAsig.set(this.fAsig() === estado ? '' : estado);
  }
  protected limpiar(): void {
    this.fPrep.set('');
    this.fAsig.set('');
  }

  protected readonly filtrados = computed(() => {
    const q = this.q().toLowerCase().trim();
    return this.data.equipos().filter((e) => {
      if (this.fPrep() && this.data.estadoPreparacionEquipo(e.inventario) !== this.fPrep()) return false;
      if (this.fAsig() && this.data.estadoAsignacionEquipo(e.inventario) !== this.fAsig()) return false;
      if (this.fTipo() && e.tipo !== this.fTipo()) return false;
      if (this.fCond() && e.condicion !== this.fCond()) return false;
      if (!q) return true;
      // También se busca por el nombre del equipo y por su IP reservada (datos del F0302).
      const ip = this.data.reservaIPEquipo(e.inventario).ip;
      return `${e.inventario} ${e.marca} ${e.modelo} ${e.serie} ${this.data.nombreEquipoActual(e.inventario)} ${ip}`
        .toLowerCase().includes(q);
    });
  });

  /** Configuración F0302 más reciente del equipo: de ahí salen el nombre del equipo y la reserva de IP. */
  protected ultimaConfig(e: Equipo) {
    return this.data.configuracionesDeEquipo(e.inventario)[0];
  }

  /** MAC vigente: la registrada al solicitar la reserva de IP o, si no hay, la del registro institucional. */
  protected macDe(e: Equipo): string {
    return (this.ultimaConfig(e)?.datos.macEquipo ?? '').trim() || (e.mac ?? '');
  }

  protected tecnicoPreparo(e: Equipo): string {
    const tec = this.data.expTecnicoDeEquipo(e.inventario);
    if (!tec || this.data.estadoPreparacionEquipo(e.inventario) === 'Pendiente de preparación') return '';
    return tec.tecnicoPreparacion.split('—')[0].trim();
  }

  protected fechaPreparacion(e: Equipo): string {
    const tec = this.data.expTecnicoDeEquipo(e.inventario);
    if (!tec) return '';
    return this.data.preparacionPorCodigo(tec.codigo)?.firma.fecha || '';
  }

  /** Resumen consolidado del equipo (ingresos, preparaciones, configuraciones, asignaciones, descargos). */
  protected resumen(e: Equipo) {
    return this.data.resumenEquipo(e.inventario);
  }

  protected expUnicoTxt(e: Equipo): string {
    if (!e.expediente) return '';
    const xu = this.data.expedienteUnicoDe(e.expediente);
    return xu ? `Expediente único ${xu.codigoUnico}` : '';
  }

  protected crearExpediente(e: Equipo): void {
    this.detalle.set(null);
    this.router.navigate(['/expediente-tecnico'], { queryParams: { inventario: e.inventario } });
  }

  /** Abre el «Historial técnico del equipo» (pestañas) en Trazabilidad. */
  protected verHistorial(e: Equipo): void {
    this.detalle.set(null);
    this.router.navigate(['/trazabilidad'], { queryParams: { inventario: e.inventario } });
  }
}
