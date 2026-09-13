import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { CasoActivoService } from '../../core/services/caso-activo.service';
import { AccesorioVerificado, DocumentoGenerado, EstadoDocumento, ExpedienteTecnico, FirmaProceso, ModuloEvidencia } from '../../core/models/models';
import { BadgeComponent, HelpTipComponent } from '../../shared/ui';
import { IconComponent } from '../../shared/icon';
import { ConstanciaReprocesoComponent } from '../../shared/constancia-reproceso';
import { ConstanciaCorreccionComponent } from '../../shared/constancia-correccion';
import { DocumentoDescargoComponent } from '../../shared/documento-descargo';
import { EvidenciaVista } from '../../shared/evidencias';
import { CampoDoc, SeccionDoc, VisorDocumentoComponent } from '../../shared/visor-documento';
import {
  BuscarExpedienteTecnicoModalComponent, BuscarExpedienteUnicoModalComponent,
  FilaExpedienteTecnico, FilaExpedienteUnico, filaExpedienteTecnico, filaExpedienteUnico
} from '../../shared/buscar-expediente';

interface FilaDoc {
  tipo: DocumentoGenerado['tipo'];
  nombre: string;
  doc?: DocumentoGenerado;
  rutaModulo: string;
}

/**
 * Generador de documentos. No es exclusivo de Soporte: Hardware (Encargado y Técnico) también
 * entra, pero solo para consultar y descargar el F0288 de sus expedientes técnicos. Soporte
 * mantiene acceso completo (F0288, F0302, Reporte final, documentos del Expediente único).
 * Cuando hay más de un expediente disponible se abre el modal «Buscar expediente» en vez de
 * un select largo; con uno solo, se carga automáticamente.
 */
@Component({
  selector: 'app-documentos',
  imports: [
    FormsModule, RouterLink, BadgeComponent, HelpTipComponent,
    BuscarExpedienteUnicoModalComponent, BuscarExpedienteTecnicoModalComponent, ConstanciaReprocesoComponent,
    ConstanciaCorreccionComponent, DocumentoDescargoComponent, IconComponent, VisorDocumentoComponent],
  styles: `
    .cat-busq { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
    .cat-busq input[type='search'] { flex: 1 1 340px; font-size: 13.5px; padding: 10px 14px; }
    .cat-busq select { max-width: 220px; }
    .fr-item { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px dashed var(--line); }
    .fr-item:last-child { border-bottom: 0; }
    .fr-sello { flex: none; width: 38px; height: 38px; border-radius: 50%; border: 2px solid var(--gold-500); color: var(--gold-600); display: grid; place-items: center; font-family: var(--font-brand); font-size: 13px; }
    .fr-main { flex: 1; min-width: 0; }
    .fr-main .f-rot { font-size: 12px; font-weight: 700; color: var(--navy-900); }
    .fr-main .f-quien { font-size: 12.5px; color: var(--tx-2); }
    .fr-main .f-det { font-size: 11px; color: var(--tx-3); }
    .fr-doc { font-size: 11px; color: var(--tx-3); white-space: nowrap; }
    .selector-box { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .selector-box .sel-info { min-width: 0; }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Auditoría</div>
          <h1>
            Generador de documentos
            <ui-help texto="Los documentos F0288 y F0302 se generan automáticamente al cerrar sus checklists; el reporte final se genera aquí cuando el usuario final ya aceptó la recepción. Hardware consulta y descarga únicamente el F0288 de su área." />
          </h1>
          <p class="page-sub">Generación simulada de los documentos oficiales del proceso.</p>
        </div>
      </div>

      @if (esHardware()) {
        <!-- ===== Modo Hardware: solo consulta y descarga del F0288 ===== -->
        <div class="card card-pad mb-3">
          <div class="selector-box">
            <div class="sel-info">
              <div class="sec-title" style="margin-bottom: 3px;">Expediente técnico</div>
              @if (tecSel(); as t) {
                <p class="small">
                  <b class="mono">{{ t.codigo }}</b> · {{ t.marcaModelo }} · inventario {{ t.inventario }} · técnico {{ t.tecnicoPreparacion }}
                </p>
              } @else {
                <p class="small muted">Ninguno seleccionado.</p>
              }
            </div>
            @if (opcionesTec().length > 1) {
              <button class="btn btn-outline btn-sm" (click)="buscarTecAbierto.set(true)"><ui-icon name="search" [size]="14" /> Buscar expediente</button>
            }
          </div>
          @if (auth.esTecnico()) {
            <span class="hint">Solo se muestran los expedientes técnicos y F0288 donde usted participó como técnico de preparación.</span>
          } @else {
            <span class="hint">Se muestran los expedientes técnicos y F0288 del área de Hardware.</span>
          }
        </div>

        @if (tecSel(); as t) {
          <div class="card table-wrap">
            <div class="card-head">
              <div>
                <h2>Documento F0288</h2>
                <p class="sub">Preparación técnica del equipo {{ t.inventario }}</p>
              </div>
              <ui-badge [estado]="t.estado" />
            </div>
            <table class="tbl">
              <thead><tr><th>Documento</th><th>Estado</th><th>Fecha de generación</th><th>Generado por</th><th>Huella</th><th style="text-align:right;">Acciones</th></tr></thead>
              <tbody>
                <tr>
                  <td class="main-cell">F0288 — Preparación técnica</td>
                  <td><ui-badge [estado]="docTec() ? 'Generado' : 'Pendiente'" /></td>
                  <td class="mono">{{ docTec()?.fecha || '—' }}</td>
                  <td>{{ docTec()?.generadoPor || '—' }}</td>
                  <td class="mono">{{ docTec()?.hash || '—' }}</td>
                  <td>
                    <div class="row" style="justify-content: flex-end; flex-wrap: nowrap;">
                      @if (docTec(); as d) {
                        <button class="btn btn-outline btn-sm" (click)="verTec.set(t)">Ver F0288</button>
                        <button class="btn btn-ghost btn-sm" (click)="descargarTec(t)">Descargar F0288</button>
                      } @else {
                        <a class="btn btn-primary btn-sm" routerLink="/preparacion-tecnica">Completar F0288</a>
                      }
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="alert mt-2">
            <span class="alert-ico">i</span>
            <span>Hardware consulta y descarga únicamente el <b>F0288</b>. El F0302, el Reporte final y los documentos del Expediente único que no correspondan a Hardware los gestiona Soporte.</span>
          </div>
        } @else {
          <div class="card card-pad">
            <p class="muted">
              @if (auth.esTecnico()) {
                No tiene expedientes técnicos ni F0288 asignados todavía.
              } @else {
                No hay expedientes técnicos registrados para el área de Hardware.
              }
            </p>
          </div>
        }
      } @else {
        <!-- ===== Modo Soporte: acceso completo por Expediente único ===== -->
        <div class="card card-pad mb-3">
          <div class="selector-box">
            <div class="sel-info">
              <div class="sec-title" style="margin-bottom: 3px;">Expediente único</div>
              @if (expediente(); as x) {
                <p class="small"><b class="mono">{{ x.codigoUnico }}</b> · solicitud {{ x.expediente }} · {{ x.resumenEstado }}</p>
              } @else {
                <p class="small muted">Ninguno seleccionado.</p>
              }
            </div>
            @if (opciones().length > 1) {
              <button class="btn btn-outline btn-sm" (click)="buscarAbierto.set(true)"><ui-icon name="search" [size]="14" /> Buscar expediente</button>
            }
          </div>
          @if (auth.esTecnico()) {
            <span class="hint">Solo se muestran expedientes donde usted participa.</span>
          }
        </div>

        @if (expediente(); as x) {
          <div class="card table-wrap">
            <div class="card-head">
              <div>
                <h2>Documentos del expediente {{ x.codigoUnico }}</h2>
                <p class="sub">{{ x.resumenEstado }}</p>
              </div>
              <ui-badge [estado]="x.estado" />
            </div>
            <table class="tbl">
              <thead>
                <tr><th>Documento</th><th>Estado</th><th>Fecha de generación</th><th>Generado por</th><th>Huella</th><th style="text-align:right;">Acciones</th></tr>
              </thead>
              <tbody>
                @for (f of filas(); track f.tipo) {
                  <tr>
                    <td class="main-cell">{{ f.nombre }}</td>
                    <td><ui-badge [estado]="f.doc ? 'Generado' : 'Pendiente'" /></td>
                    <td class="mono">{{ f.doc?.fecha || '—' }}</td>
                    <td>{{ f.doc?.generadoPor || '—' }}</td>
                    <td class="mono">{{ f.doc?.hash || '—' }}</td>
                    <td>
                      <div class="row" style="justify-content: flex-end; flex-wrap: nowrap;">
                        @if (f.doc) {
                          <button class="btn btn-outline btn-sm" (click)="ver.set(f)">Ver {{ etiqueta(f) }}</button>
                          <button class="btn btn-ghost btn-sm" (click)="descargar(f)">Descargar {{ etiqueta(f) }}</button>
                        } @else {
                          <a class="btn btn-primary btn-sm" [routerLink]="f.rutaModulo">
                            @switch (f.tipo) {
                              @case ('Reporte final') { Generar en Expediente único }
                              @case ('Entrega y aceptación') { Ir a Entrega y aceptación }
                              @default { Generar {{ f.tipo }} }
                            }
                          </a>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (f0288Restringido()) {
            <div class="alert mt-2">
              <span class="alert-ico">i</span>
              <span>El <b>F0288</b> de este proceso no está disponible para su usuario: la preparación técnica la realizó
                <b>{{ unidadPreparo() }}</b> y solo pueden verlo o descargarlo quienes participaron en esa preparación.</span>
            </div>
          }

          <!-- Constancias de los reprocesos F0288 del proceso -->
          @if (constanciasDelProceso().length) {
            <div class="card mt-2 table-wrap">
              <div class="card-head">
                <div>
                  <h2>
                    Constancias de Reproceso F0288
                    <ui-help texto="Documento interno que se genera al firmar un reproceso F0288. Queda guardado en el expediente: puede consultarse y descargarse después, no solo en el momento de la firma." />
                  </h2>
                  <p class="sub">Una constancia por reproceso, dentro del mismo Expediente técnico</p>
                </div>
                <span class="chip">{{ constanciasDelProceso().length }}</span>
              </div>
              <table class="tbl">
                <thead>
                  <tr><th>Documento</th><th>Código de reproceso</th><th>Expediente técnico</th><th>Inventario</th><th>Técnico de Hardware</th><th>Resultado</th><th>Fecha</th><th>Estado</th><th style="text-align:right;">Acciones</th></tr>
                </thead>
                <tbody>
                  @for (d of constanciasDelProceso(); track d.codigo) {
                    <tr>
                      <td class="mono main-cell">{{ d.codigo }}<div class="sub-cell">Constancia de Reproceso F0288</div></td>
                      <td class="mono">{{ d.reproceso }}</td>
                      <td class="mono">{{ d.expedienteTecnico }}</td>
                      <td class="mono">{{ d.inventario }}</td>
                      <td>{{ (d.tecnicoHardware || '—').split('—')[0].trim() }}</td>
                      <td>{{ d.resultado || '—' }}</td>
                      <td class="mono">{{ d.fecha }}<div class="sub-cell">{{ d.hora }}</div></td>
                      <td><ui-badge [estado]="d.estado ?? 'Generado'" /></td>
                      <td style="text-align:right;">
                        <button class="btn btn-outline btn-sm" (click)="verConstancia.set(d.reproceso ?? '')">Ver documento</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          <!-- Constancias de las correcciones F0302 por inconformidad del proceso -->
          @if (constanciasCorreccionDelProceso().length) {
            <div class="card mt-2 table-wrap">
              <div class="card-head">
                <div>
                  <h2>
                    Constancias de Corrección F0302 por Inconformidad
                    <ui-help texto="Documento que se genera al firmar la corrección de una inconformidad del usuario final. Queda guardado en el expediente y puede consultarse después, igual que la constancia de reproceso." />
                  </h2>
                  <p class="sub">Una constancia por corrección firmada por el Técnico de Soporte</p>
                </div>
                <span class="chip">{{ constanciasCorreccionDelProceso().length }}</span>
              </div>
              <table class="tbl">
                <thead>
                  <tr><th>Documento</th><th>Código de corrección</th><th>Tipo de problema</th><th>Usuario final</th><th>Inventario</th><th>Técnico de Soporte</th><th>Fecha</th><th>Estado</th><th style="text-align:right;">Acciones</th></tr>
                </thead>
                <tbody>
                  @for (d of constanciasCorreccionDelProceso(); track d.codigo) {
                    <tr>
                      <td class="mono main-cell">{{ d.codigo }}<div class="sub-cell">Constancia de Corrección F0302</div></td>
                      <td class="mono">{{ d.correccion }}</td>
                      <td>{{ d.tipoProblema || '—' }}</td>
                      <td>{{ d.usuarioFinal || '—' }}</td>
                      <td class="mono">{{ d.inventario }}</td>
                      <td>{{ (d.tecnicoSoporte || '—').split('—')[0].trim() }}</td>
                      <td class="mono">{{ d.fecha }}<div class="sub-cell">{{ d.hora }}</div></td>
                      <td><ui-badge [estado]="d.estado ?? 'Generado'" /></td>
                      <td style="text-align:right;">
                        <button class="btn btn-outline btn-sm" (click)="verConstanciaCor.set(d.correccion ?? '')">Ver documento</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          <!-- Documento de Descargo: existe desde que el equipo se descarga de su usuario final -->
          @if (descargosDelProceso().length) {
            <div class="card mt-2 table-wrap">
              <div class="card-head">
                <div>
                  <h2>
                    Documento de Descargo
                    <ui-help texto="Documento que respalda la salida del equipo del inventario activo de la Dirección/Registro. Se genera con el registro del descargo y queda disponible para consultarlo después." />
                  </h2>
                  <p class="sub">Un documento por descargo registrado sobre el equipo de este expediente</p>
                </div>
                <span class="chip">{{ descargosDelProceso().length }}</span>
              </div>
              <table class="tbl">
                <thead>
                  <tr><th>Documento</th><th>Inventario</th><th>Usuario final entregó</th><th>Motivo</th><th>Acción posterior</th><th>Fecha</th><th>Estado</th><th style="text-align:right;">Acciones</th></tr>
                </thead>
                <tbody>
                  @for (d of descargosDelProceso(); track d.idDescargo) {
                    <tr>
                      <td class="mono main-cell">{{ d.idDescargo }}<div class="sub-cell">Documento de Descargo</div></td>
                      <td class="mono">{{ d.inventario }}</td>
                      <td>{{ d.usuarioFinalEntrega }}</td>
                      <td>{{ d.motivoDescargo }}</td>
                      <td>{{ d.accionPosterior }}</td>
                      <td class="mono">{{ d.fechaDescargo }}</td>
                      <td><ui-badge [estado]="d.estado" /></td>
                      <td style="text-align:right;">
                        <button class="btn btn-outline btn-sm" (click)="verDescargo.set(d.idDescargo)">Ver documento</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          <!-- Firmas simuladas capturadas durante el proceso (se incluyen al descargar) -->
          <div class="card mt-2">
            <div class="card-head">
              <div>
                <h2>
                  Firmas registradas
                  <ui-help texto="Firmas simuladas del proceso: quién firmó, con qué rol y en qué momento. Se derivan del F0288, el F0302, la entrega y la conformidad del usuario final, y se incluyen en los documentos descargados." />
                </h2>
                <p class="sub">Cada firma indica su documento asociado y su estado de captura</p>
              </div>
            </div>
            <div class="card-body">
              @for (f of firmasProceso(); track f.rotulo) {
                <div class="fr-item">
                  <span class="fr-sello">{{ inicialesDe(f.nombre) }}</span>
                  <div class="fr-main">
                    <div class="f-rot">{{ f.rotulo }}</div>
                    <div class="f-quien">{{ f.nombre }}@if (f.rol) { — {{ f.rol }} }</div>
                    <div class="f-det">{{ f.detalle }}@if (f.fecha) { · {{ f.fecha }}@if (f.hora) { · {{ f.hora }} } }</div>
                  </div>
                  <span class="fr-doc">{{ f.documento }}</span>
                  <ui-badge [estado]="f.estado" />
                </div>
              } @empty {
                <p class="muted small">Aún no hay firmas registradas para este proceso.</p>
              }
            </div>
          </div>
        } @else {
          <div class="card card-pad"><p class="muted">Seleccione un expediente único.</p></div>
        }
      }

      <!-- Vista previa formal del documento (modo Soporte) -->
      @if (ver(); as f) {
        <ui-visor-documento
          [abierto]="true"
          [nombre]="f.nombre"
          [subtitulo]="subtituloDoc(f)"
          [codigo]="codigoDoc(f)"
          [fecha]="f.doc?.fecha ?? ''"
          [hora]="f.doc?.hora ?? ''"
          [generadoPor]="f.doc?.generadoPor ?? ''"
          [estado]="f.doc?.estado ?? 'Generado'"
          [huella]="f.doc?.hash ?? ''"
          [referencia]="referenciaDoc()"
          [secciones]="seccionesDoc()"
          [evidencias]="evidenciasVisor()"
          [tituloEvidencias]="tituloEvidenciasDoc(f)"
          [retiradas]="retiradasDoc(f)"
          [firmas]="firmasDe(f)"
          (verEvidencia)="verEvidenciaDoc(f, $event)"
          (descargar)="descargar(f)"
          (cerrar)="ver.set(null)" />
      }

      <!-- Vista previa formal del F0288 (modo Hardware) -->
      @if (verTec(); as t) {
        <ui-visor-documento
          [abierto]="true"
          nombre="F0288 — Preparación técnica"
          [subtitulo]="'Expediente técnico ' + t.codigo + ' · ' + t.tipoExpediente"
          [codigo]="docTecVer()?.codigo || 'F0288-' + t.codigo"
          [fecha]="docTecVer()?.fecha ?? ''"
          [hora]="docTecVer()?.hora ?? ''"
          [generadoPor]="docTecVer()?.generadoPor ?? ''"
          [estado]="docTecVer()?.estado ?? 'Generado'"
          [huella]="docTecVer()?.hash ?? ''"
          [referencia]="t.codigo"
          [secciones]="seccionesTec()"
          [evidencias]="evidenciasTecVisor()"
          tituloEvidencias="Imágenes de evidencia de la preparación"
          [firmas]="firmasTec()"
          (descargar)="descargarTec(t)"
          (cerrar)="verTec.set(null)" />
      }

      @if (buscarAbierto()) {
        <app-buscar-expediente-unico
          [filas]="opciones()"
          titulo="Buscar expediente único"
          sub="Busque por código de expediente único, año, solicitud, inventario o usuario final"
          (seleccionar)="elegir($event)"
          (cerrar)="buscarAbierto.set(false)" />
      }
      @if (buscarTecAbierto()) {
        <app-buscar-expediente-tecnico
          [filas]="opcionesTec()"
          titulo="Buscar expediente técnico"
          sub="Busque por código de expediente técnico, año, inventario, marca, modelo o técnico"
          (seleccionar)="elegirTec($event)"
          (cerrar)="buscarTecAbierto.set(false)" />
      }

      <!-- Catálogo global de constancias: se consultan sin depender del expediente abierto -->
      <div class="card mt-3 table-wrap">
        <div class="card-head">
          <div>
            <h2>Constancias generadas</h2>
            <p class="sub">Documentos firmados de reprocesos F0288 y de correcciones F0302 por inconformidad</p>
          </div>
          <span class="chip">{{ constanciasFiltradas().length }} de {{ todasLasConstancias().length }}</span>
        </div>
        <div class="card-body">
          <div class="cat-busq">
            <input type="search" class="control" [ngModel]="qConstancia()" (ngModelChange)="qConstancia.set($event)"
              placeholder="Buscar por documento, código de reproceso o corrección, expediente técnico, inventario, técnico, usuario final o fecha…" />
            <select class="control" [ngModel]="estadoConstancia()" (ngModelChange)="estadoConstancia.set($event)">
              <option value="">Todos los estados</option>
              @for (e of estadosDocumento; track e) { <option [value]="e">{{ e }}</option> }
            </select>
          </div>
          <table class="tbl">
            <thead>
              <tr><th>Documento</th><th>Proceso relacionado</th><th>Tipo</th><th>Expediente técnico</th><th>Inventario</th><th>Técnico responsable</th><th>Fecha</th><th>Estado</th><th style="text-align:right;">Acciones</th></tr>
            </thead>
            <tbody>
              @for (d of constanciasFiltradas(); track d.codigo) {
                <tr>
                  <td class="mono main-cell">{{ d.codigo }}</td>
                  <td class="mono">{{ d.reproceso || d.correccion }}</td>
                  <td>{{ d.reproceso ? 'Reproceso F0288' : 'Corrección F0302 por inconformidad' }}</td>
                  <td class="mono">{{ d.expedienteTecnico }}</td>
                  <td class="mono">{{ d.inventario }}</td>
                  <td>{{ (d.tecnicoHardware || d.tecnicoSoporte || '—').split('—')[0].trim() }}</td>
                  <td class="mono">{{ d.fecha }}<div class="sub-cell">{{ d.hora }}</div></td>
                  <td><ui-badge [estado]="d.estado ?? 'Generado'" /></td>
                  <td style="text-align:right;">
                    @if (d.reproceso) {
                      <button class="btn btn-outline btn-sm" (click)="verConstancia.set(d.reproceso)">Ver documento</button>
                    } @else {
                      <button class="btn btn-outline btn-sm" (click)="verConstanciaCor.set(d.correccion ?? '')">Ver documento</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="9" class="muted" style="text-align:center; padding: 24px;">
                  @if (todasLasConstancias().length) { Ningún documento coincide con la búsqueda. }
                  @else { Todavía no hay constancias. Se generan al firmar un reproceso F0288 o una corrección F0302 por inconformidad. }
                </td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <ui-documento-descargo [idDescargo]="verDescargo()" (cerrado)="verDescargo.set('')" />
      <ui-constancia-reproceso [idReproceso]="verConstancia()" (cerrado)="verConstancia.set('')" />
      <ui-constancia-correccion [idCorreccion]="verConstanciaCor()" (cerrado)="verConstanciaCor.set('')" />
    </div>
  `
})
export class DocumentosComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly casoActivo = inject(CasoActivoService);

  protected readonly esHardware = computed(() => this.auth.esHardware());

  // ---------- Modo Soporte (Expediente único) ----------
  protected seleccion = signal('');
  protected ver = signal<FilaDoc | null>(null);
  protected buscarAbierto = signal(false);
  /** Reproceso cuya constancia se está consultando; '' cierra el visor. */
  protected verConstancia = signal('');
  /** Corrección F0302 por inconformidad cuya constancia se está consultando. */
  protected verConstanciaCor = signal('');
  protected qConstancia = signal('');
  protected estadoConstancia = signal('');
  protected readonly estadosDocumento: EstadoDocumento[] =
    ['Pendiente de firma', 'Firmado', 'Generado', 'Disponible para consulta'];

  /** Constancias de los reprocesos y de las revisiones de garantía del expediente abierto. */
  protected readonly constanciasDelProceso = computed(() => {
    const x = this.expediente();
    return x
      ? [...this.data.constanciasReproceso(), ...this.data.constanciasRevisionGarantia()]
        .filter((d) => d.expediente === x.expediente)
      : [];
  });
  /** Constancias de corrección F0302 por inconformidad del expediente abierto. */
  protected readonly constanciasCorreccionDelProceso = computed(() => {
    const x = this.expediente();
    return x ? this.data.constanciasCorreccion().filter((d) => d.expediente === x.expediente) : [];
  });

  /** Las tres familias de constancias juntas, de la más reciente a la más antigua. */
  protected readonly todasLasConstancias = computed(() =>
    [...this.data.constanciasReproceso(), ...this.data.constanciasCorreccion(),
      ...this.data.constanciasRevisionGarantia()]
      .sort((a, b) => `${b.fecha} ${b.hora ?? ''}`.localeCompare(`${a.fecha} ${a.hora ?? ''}`))
  );

  /**
   * Catálogo global de constancias con los filtros del pedido: documento, código de reproceso o
   * corrección, expediente técnico, inventario, técnico responsable, usuario final, fecha y estado.
   * Se busca en un solo campo porque son los mismos datos de una fila y separar siete cajas no
   * ayudaría a encontrarlas.
   */
  protected readonly constanciasFiltradas = computed(() => {
    const q = this.qConstancia().toLowerCase().trim();
    const estado = this.estadoConstancia();
    return this.todasLasConstancias().filter((d) => {
      if (estado && (d.estado ?? 'Generado') !== estado) return false;
      if (!q) return true;
      return [d.codigo, d.reproceso, d.correccion, d.tipo, d.expedienteTecnico, d.inventario,
        d.tecnicoHardware, d.tecnicoSoporte, d.usuarioFinal, d.tipoProblema,
        d.resultado, d.fecha, d.generadoPor]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  });

  /** Filas de búsqueda del catálogo «Buscar expediente» (Expediente único), ya filtradas por rol. */
  protected readonly opciones = computed<FilaExpedienteUnico[]>(() =>
    this.data.expedientesUnicosVisibles().map((x) => filaExpedienteUnico(this.data, x))
  );

  /**
   * Con un solo expediente disponible se carga automáticamente; con varios, se retoma el
   * último caso activo (elegido en Expediente único) si sigue visible para el rol, o se
   * requiere el modal «Buscar expediente».
   */
  protected readonly expediente = computed(() => {
    const visibles = this.data.expedientesUnicosVisibles();
    if (visibles.length === 1) return visibles[0];
    const sel = this.seleccion() || this.casoActivo.expediente();
    return visibles.find((x) => x.expediente === sel);
  });

  /** Tipos de documento visibles en Generador de documentos por rol: Técnico de Soporte no ve el Reporte final. */
  protected readonly tiposVisibles = computed<FilaDoc['tipo'][]>(() =>
    this.auth.usuario()?.clave === 'tec-soporte'
      ? ['F0288', 'F0302', 'Entrega y aceptación']
      : ['F0288', 'F0302', 'Entrega y aceptación', 'Reporte final']
  );

  protected readonly sol = computed(() => {
    const x = this.expediente();
    return x ? this.data.solicitud(x.expediente) : undefined;
  });

  /** Configuración F0302 del proceso: aporta al documento el nombre del equipo y la reserva de IP. */
  protected readonly conf = computed(() => {
    const x = this.expediente();
    return x ? this.data.configuracionDe(x.expediente) : undefined;
  });

  protected equipoTxt(): string {
    const s = this.sol();
    const eq = s ? this.data.equipoDe(s.equipoInventario) : undefined;
    return eq ? `${eq.marca} ${eq.modelo} · inventario ${eq.inventario}` : '—';
  }

  /** Expediente técnico vigente del equipo del proceso. */
  protected expTecnicoDoc(): string {
    const inv = this.sol()?.equipoInventario;
    return inv ? (this.data.expTecnicoDeEquipo(inv)?.codigo ?? '') : '';
  }

  /**
   * Historial del ciclo tal como debe leerse en el F0302: preparaciones, intentos de configuración
   * y reprocesos, en orden y **bajo un mismo Expediente técnico**. Solo aparece cuando hubo alguna
   * falla; sin ella el documento no tiene nada que aclarar y la sección sobra.
   */
  protected readonly historialCiclo = computed<string[]>(() => {
    const inv = this.sol()?.equipoInventario;
    if (!inv) return [];
    if (this.data.fallasF0302(inv) === 0) return [];
    const clave = (f?: string, h?: string) => `${f ?? ''} ${h ?? ''}`;
    const filas = [
      ...this.data.preparacionesDeEquipo(inv).map((p, i, todas) => ({
        orden: clave(p.cronometro?.fechaInicio || p.fecha),
        texto: `F0288 #${todas.length - i}: ${p.estado === 'Completada' ? 'Finalizado' : p.estado}`
      })),
      ...this.data.configuracionesDeEquipo(inv).map((c, i, todas) => ({
        orden: clave(c.cronometro?.fechaInicio || c.fecha),
        texto: `F0302 #${todas.length - i}: ` + (c.falla
          ? `Con falla — ${c.falla.tipo}`
          : c.estado === 'Completada' ? 'Finalizado correctamente' : c.estado)
      })),
      ...this.data.reprocesosDeEquipo(inv).map((r) => ({
        orden: clave(r.fechaSolicitud, r.horaSolicitud),
        texto: `Reproceso F0288 #${r.numero} (${r.expedienteTecnico}): ${r.correccionTecnica || r.motivo} · ${r.estado}`
      }))
    ];
    return filas.sort((a, b) => a.orden.localeCompare(b.orden)).map((x) => x.texto);
  });

  /** Preparación F0288 del proceso seleccionado (modo Soporte): aporta los accesorios verificados al documento. */
  protected readonly prep = computed(() => {
    const x = this.expediente();
    const tec = x ? this.data.expTecnicoDe(x.expediente) : undefined;
    return tec ? this.data.preparacionPorCodigo(tec.codigo) : undefined;
  });

  /** Accesorios verificados del F0288 del proceso, solo cuando la respuesta fue «Sí» (equipo usado). */
  protected readonly accesoriosDoc = computed(() => {
    const va = this.prep()?.verificacionAccesorios;
    return va?.respuesta === 'Sí' ? va.accesorios : undefined;
  });

  /**
   * Software instalado previamente en el F0288 que el documento F0302 reporta como heredado: es
   * información del formulario anterior, no se vuelve a configurar en la etapa de Soporte.
   */
  protected readonly heredadoDoc = computed(() => {
    const x = this.expediente();
    const lista = x ? this.data.softwareHeredadoF0288(x.expediente) : [];
    return lista.length > 0 ? lista : undefined;
  });

  /**
   * Actividades del F0302 con captura obligatoria (Agente DLP) y la evidencia registrada: el
   * documento debe dejar constancia del control de seguridad y de quién lo respaldó.
   */
  protected readonly capturasDoc = computed(() => {
    const c = this.conf();
    if (!c) return undefined;
    // Un ítem «No aplica» no va aquí: no tiene evidencia que mostrar y su lugar es el bloque de
    // abajo, con su justificación.
    const items = this.data.softwareChecklistF0302(c)
      .filter((s) => s.requiereEvidencia && s.estado !== 'No aplica');
    if (items.length === 0) return undefined;
    return items.map((s) => ({ item: s, evidencia: c.evidencias.find((e) => e.item === s.nombre && e.archivo) }));
  });

  /**
   * Controles especiales sin evidencia asociada —hoy el Ingreso a dominio— que sí se registraron.
   * Van aparte de los que llevan captura: mezclarlos haría parecer que a este le falta una imagen
   * que nunca se le pidió.
   */
  protected readonly controlesSinEvidenciaDoc = computed(() => {
    const c = this.conf();
    if (!c) return undefined;
    const items = this.data.softwareChecklistF0302(c)
      .filter((s) => this.data.esControlEspecialF0302(s.nombre) && !s.requiereEvidencia && s.estado !== 'No aplica');
    return items.length ? items : undefined;
  });

  /** Ítems del F0302 que quedaron como «No aplica», con su motivo, para el documento generado. */
  protected readonly noAplicaDoc = computed(() => {
    const c = this.conf();
    if (!c) return undefined;
    const fuera = this.data.itemsNoAplicaF0302(c);
    return fuera.length ? fuera : undefined;
  });

  /**
   * Módulo y proceso al que pertenecen las imágenes de un documento generado. El F0288 se respalda
   * con las de la preparación; el F0302, con las de la configuración.
   */
  private refDoc(f: FilaDoc): { modulo: ModuloEvidencia; proceso: string } | undefined {
    if (f.tipo === 'F0288') {
      const codigo = f.doc?.expedienteTecnico ?? f.doc?.expediente ?? '';
      return codigo ? { modulo: 'Preparación F0288', proceso: codigo } : undefined;
    }
    if (f.tipo === 'F0302') {
      const codigo = f.doc?.expediente ?? '';
      return codigo ? { modulo: 'Configuración F0302', proceso: codigo } : undefined;
    }
    return undefined;
  }

  /** Imágenes vigentes de la etapa que respalda el documento. */
  protected evidenciasDoc(f: FilaDoc) {
    const ref = this.refDoc(f);
    if (!ref) return undefined;
    const lista = this.data.evid.de(ref.modulo, ref.proceso);
    return lista.length ? lista : undefined;
  }

  /** Archivos que el documento certificó y que ya no están entre las imágenes de la etapa. */
  protected retiradasDoc(f: FilaDoc): string[] {
    const ref = this.refDoc(f);
    if (!ref) return [];
    const actuales = this.data.evid.de(ref.modulo, ref.proceso).map((e) => e.archivo);
    return (f.doc?.evidencias ?? []).filter((a) => !actuales.includes(a));
  }

  protected verEvidenciaDoc(f: FilaDoc, archivo: string): void {
    const ref = this.refDoc(f);
    if (!ref) return;
    const u = this.auth.usuario();
    this.data.registrarConsultaEvidenciaTecnica(ref.modulo, ref.proceso,
      f.doc?.expediente ?? ref.proceso, archivo, `${u?.nombre} — ${u?.rol}`);
  }

  /** Software del catálogo que el Técnico de Soporte agregó en la Configuración F0302, con su motivo. */
  protected readonly adicionalDoc = computed(() => {
    const c = this.conf();
    const lista = c ? this.data.softwareAdicionalF0302(c).filter((s) => s.codigoSoftware) : [];
    return lista.length > 0 ? lista : undefined;
  });

  /** Software del F0288 del proceso (modo Soporte), igual que `softwareDeTec` en modo Hardware. */
  protected readonly softwareDoc = computed(() => {
    const items = (this.prep()?.secciones ?? []).flatMap((s) => s.items)
      .filter((i) => i.codigoSoftware || i.requiereEvidencia);
    return items.length > 0 ? items : undefined;
  });

  protected readonly filas = computed<FilaDoc[]>(() => {
    const x = this.expediente();
    if (!x) return [];
    const docs = this.data.documentosDe(x.expediente);
    const todas: FilaDoc[] = [
      { tipo: 'F0288', nombre: 'F0288 — Preparación técnica', doc: docs.find((d) => d.tipo === 'F0288'), rutaModulo: '/preparacion-tecnica' },
      { tipo: 'F0302', nombre: 'F0302 — Configuración del equipo', doc: docs.find((d) => d.tipo === 'F0302'), rutaModulo: '/configuracion' },
      { tipo: 'Entrega y aceptación', nombre: 'Entrega y aceptación (constancia)', doc: docs.find((d) => d.tipo === 'Entrega y aceptación'), rutaModulo: '/entrega-aceptacion' },
      { tipo: 'Reporte final', nombre: 'Reporte final de auditoría', doc: docs.find((d) => d.tipo === 'Reporte final'), rutaModulo: '/expediente-unico' }
    ];
    // El F0288 solo aparece si el usuario o su unidad participaron en la preparación técnica:
    // si la preparación la hizo Hardware, Soporte no ve ese F0288 (y viceversa). El Técnico de
    // Soporte solo ve la constancia de Entrega y aceptación si fue el responsable de la entrega.
    const u = this.auth.usuario();
    return todas.filter((f) => {
      if (!this.tiposVisibles().includes(f.tipo)) return false;
      if (f.tipo === 'F0288') return this.data.puedeVerF0288DeProceso(x.expediente);
      if (f.tipo === 'Entrega y aceptación' && u?.clave === 'tec-soporte') {
        return !!this.data.entregaDe(x.expediente)?.tecnicoEntrega.includes(u.nombre);
      }
      return true;
    });
  });

  /** Firmas simuladas del proceso seleccionado (sección «Firmas registradas» y descargas). */
  protected readonly firmasProceso = computed<FirmaProceso[]>(() => {
    const x = this.expediente();
    return x ? this.data.firmasDeProceso(x.expediente) : [];
  });

  /** Firmas que corresponden a un documento concreto (el F0302 incluye también la de preparación). */
  protected firmasDe(f: FilaDoc): FirmaProceso[] {
    const firmas = this.firmasProceso();
    switch (f.tipo) {
      case 'F0288': return firmas.filter((x) => x.documento === 'F0288');
      case 'F0302': return firmas.filter((x) => x.documento === 'F0288' || x.documento === 'F0302');
      case 'Entrega y aceptación': return firmas.filter((x) => x.documento === 'Entrega y aceptación');
      default: return firmas;
    }
  }

  protected etiqueta(f: FilaDoc): string {
    return f.tipo === 'Reporte final' ? 'reporte final' : f.tipo === 'Entrega y aceptación' ? 'entrega y aceptación' : f.tipo;
  }

  protected inicialesDe(nombre: string): string {
    return nombre.split(' ').map((w) => w[0]).join('').replace('.', '').slice(0, 3);
  }

  protected nombreDe(texto: string): string {
    return texto.split('—')[0].trim();
  }

  /** Verdadero cuando el F0288 existe pero la preparación no la hizo el usuario ni su unidad. */
  protected readonly f0288Restringido = computed(() => {
    const x = this.expediente();
    if (!x) return false;
    return !!this.data.expTecnicoDe(x.expediente) && !this.data.puedeVerF0288DeProceso(x.expediente);
  });

  /** Unidad que realizó la preparación técnica del proceso seleccionado (para el mensaje contextual). */
  protected readonly unidadPreparo = computed(() => {
    const x = this.expediente();
    return x ? this.data.expTecnicoDe(x.expediente)?.unidadResponsable ?? '' : '';
  });

  // ================= Armado de los documentos formales =================
  // El visor solo dibuja: aquí se decide qué lleva cada documento y en qué orden. Los datos son
  // los mismos que ya se mostraban y que van en la descarga; lo que cambia es que ahora se leen
  // como una hoja institucional y no como una tarjeta del panel.

  /** Descargo cuyo documento se está consultando desde este módulo; '' cierra el visor. */
  protected verDescargo = signal('');

  /** Descargos registrados sobre el equipo del expediente abierto. */
  protected readonly descargosDelProceso = computed(() => {
    const inv = this.sol()?.equipoInventario;
    return inv ? this.data.descargosDeEquipo(inv) : [];
  });

  /** Proceso al que pertenece el documento, tal como se imprime en el encabezado de la hoja. */
  protected readonly referenciaDoc = computed(() => {
    const x = this.expediente();
    return x ? `${x.codigoUnico} · solicitud ${x.expediente}` : '';
  });

  /**
   * Código del documento. Los F0288/F0302 del prototipo no llevan uno propio —se identifican por
   * su huella—, así que se deriva del tipo y del expediente único para que la hoja no salga sin
   * identificación, que es lo primero que se busca en un documento impreso.
   */
  protected codigoDoc(f: FilaDoc): string {
    const x = this.expediente();
    return f.doc?.codigo || (x ? `${f.tipo.replace(/ /g, '-')}-${x.codigoUnico}` : '');
  }

  protected subtituloDoc(f: FilaDoc): string {
    const inv = this.sol()?.equipoInventario ?? '';
    const x = this.expediente();
    switch (f.tipo) {
      case 'F0288': return `Preparación técnica del equipo ${inv}`;
      case 'F0302': return `Configuración e instalación del equipo ${inv}`;
      case 'Entrega y aceptación': return `Entrega del equipo ${inv} y aceptación del usuario final`;
      default: return `Consolidación de auditoría del expediente único ${x?.codigoUnico ?? ''}`;
    }
  }

  protected tituloEvidenciasDoc(f: FilaDoc): string {
    switch (f.tipo) {
      case 'F0288': return 'Imágenes de evidencia de la preparación';
      case 'F0302': return 'Imágenes de evidencia de la configuración';
      case 'Reporte final': return 'Imágenes de evidencia de todo el expediente';
      default: return 'Imágenes de evidencia del documento';
    }
  }

  /**
   * Imágenes que acompañan al documento abierto. El reporte final las reúne todas —es la
   * consolidación del expediente—; los demás muestran las de su propia etapa.
   */
  protected readonly evidenciasVisor = computed<EvidenciaVista[]>(() => {
    const f = this.ver();
    if (!f) return [];
    if (f.tipo === 'Reporte final') {
      const x = this.expediente();
      return x ? this.data.evidenciasDelExpediente(x.expediente).flatMap((g) => g.lista) : [];
    }
    return this.evidenciasDoc(f) ?? [];
  });

  // ---------- Bloques comunes a los cuatro documentos ----------

  private seccionExpediente(): SeccionDoc {
    const x = this.expediente();
    const s = this.sol();
    return {
      titulo: 'Datos del expediente',
      campos: [
        { etiqueta: 'Expediente único', valor: x?.codigoUnico ?? '—', mono: true },
        { etiqueta: 'Solicitud', valor: x?.expediente ?? '—', mono: true },
        { etiqueta: 'Tipo de requerimiento', valor: this.data.tipoRequerimientoTexto(s) },
        { etiqueta: 'Referencia de origen', valor: s?.origenRef || '—', mono: true },
        { etiqueta: 'Expediente técnico', valor: this.expTecnicoDoc() || '—', mono: true },
        { etiqueta: 'Fecha de la solicitud', valor: s?.fecha ?? '—', mono: true },
        { etiqueta: 'Estado del expediente', valor: x?.resumenEstado ?? '—', ancho: true }
      ]
    };
  }

  private seccionEquipo(): SeccionDoc {
    const inv = this.sol()?.equipoInventario ?? '';
    const eq = inv ? this.data.equipoDe(inv) : undefined;
    return {
      titulo: 'Datos del equipo',
      campos: [
        { etiqueta: 'Equipo', valor: eq ? `${eq.marca} ${eq.modelo}` : '—' },
        { etiqueta: 'Tipo de equipo', valor: eq ? (eq.tipo === 'Desktop' ? 'CPU' : 'Laptop') : '—' },
        { etiqueta: 'Número de inventario', valor: inv || '—', mono: true },
        { etiqueta: 'Número de serie', valor: eq?.serie ?? '—', mono: true },
        { etiqueta: 'Condición', valor: eq?.condicion ?? '—' },
        { etiqueta: 'Procesador', valor: eq?.procesador ?? '—' },
        { etiqueta: 'Memoria RAM', valor: eq?.ram ?? '—' },
        { etiqueta: 'Disco', valor: eq?.disco ?? '—' },
        { etiqueta: 'Sistema operativo', valor: eq?.sistemaOperativo ?? '—' }
      ]
    };
  }

  private seccionUsuarioFinal(): SeccionDoc {
    const s = this.sol();
    return {
      titulo: 'Datos del usuario final',
      campos: [
        { etiqueta: 'Usuario final', valor: s?.destinatario ?? '—' },
        { etiqueta: 'Carné', valor: s?.carne ?? '—', mono: true },
        { etiqueta: 'Dirección o Unidad', valor: s?.unidadDestino ?? '—' },
        { etiqueta: 'Dirección o Gerencia', valor: s?.direccionGerencia ?? '—' },
        { etiqueta: 'Correo institucional', valor: s?.correoDestinatario ?? '—' }
      ]
    };
  }

  /** Quién trabajó el documento. Cambia con el tipo: no es el mismo técnico en cada etapa. */
  private seccionTecnico(tipo: FilaDoc['tipo']): SeccionDoc {
    const x = this.expediente();
    const tec = x ? this.data.expTecnicoDe(x.expediente) : undefined;
    const prep = this.prep();
    const c = this.conf();
    const e = x ? this.data.entregaDe(x.expediente) : undefined;
    const campos: CampoDoc[] = [];

    if (tipo === 'F0288' || tipo === 'Reporte final') {
      campos.push(
        { etiqueta: 'Técnico que preparó el equipo', valor: prep?.tecnico || tec?.tecnicoPreparacion || '—' },
        { etiqueta: 'Unidad responsable de la preparación', valor: tec?.unidadResponsable ?? '—' });
    }
    if (tipo === 'F0302' || tipo === 'Reporte final') {
      campos.push(
        { etiqueta: 'Técnico de Configuración', valor: c?.tecnico || '—' },
        { etiqueta: 'Asignado por', valor: c?.seleccionadoPor || '—' });
    }
    if (tipo === 'Entrega y aceptación' || tipo === 'Reporte final') {
      campos.push(
        { etiqueta: 'Técnico que entregó el equipo', valor: e?.tecnicoEntrega || '—' },
        { etiqueta: 'Técnico que configuró', valor: e?.tecnicoConfiguro || c?.tecnico || '—' });
    }
    return { titulo: 'Técnico responsable', campos };
  }

  // ---------- Bloques propios de cada documento ----------

  /** El checklist del F0288 completo, sección por sección, tal como se trabajó. */
  private seccionesChecklistF0288(): SeccionDoc[] {
    const prep = this.prep();
    if (!prep) return [];
    return prep.secciones
      .filter((s) => s.items.length)
      .map((s) => ({
        titulo: `Checklist de preparación — ${s.titulo}`,
        items: s.items.map((i) => ({
          nombre: i.nombre + (i.versionSeleccionada ? ` (versión ${i.versionSeleccionada})` : ''),
          estado: i.estado,
          nota: [i.nota, i.evidencia ? `Evidencia: ${i.evidencia}` : ''].filter(Boolean).join(' · ')
        }))
      }));
  }

  private seccionesF0288(): SeccionDoc[] {
    const prep = this.prep();
    if (!prep) {
      return [{
        titulo: 'Contenido de la preparación',
        texto: 'No hay checklist de Preparación F0288 guardado para este proceso: el documento se generó '
          + 'en su momento y conserva su huella de integridad, pero el detalle de la preparación no está '
          + 'disponible para reconstruirlo.'
      }];
    }
    const secciones: SeccionDoc[] = [...this.seccionesChecklistF0288()];

    const software = this.softwareDoc();
    if (software) {
      secciones.push({
        titulo: 'Software instalado en la preparación',
        columnas: ['Software', 'Estado', 'Versión', 'Evidencia'],
        filas: software.map((s) => [s.nombre, s.estado, s.versionSeleccionada ?? '—', s.evidencia ?? 'Sin captura registrada'])
      });
    }
    const accesorios = this.accesoriosDoc();
    if (accesorios) {
      secciones.push({
        titulo: 'Accesorios verificados',
        columnas: ['Accesorio', 'Detalle de la verificación'],
        filas: accesorios.map((a) => [a.nombre, this.detalleAccesorio(a)]),
        nota: 'Cada accesorio tiene su propio número de inventario, distinto al del equipo principal.'
      });
    }
    const cierre = prep?.cierre;
    if (cierre) {
      secciones.push({
        titulo: 'Cierre técnico de la preparación',
        campos: [
          { etiqueta: 'Nivel de complejidad', valor: cierre.nivel },
          { etiqueta: '¿Hubo complejidad?', valor: cierre.hubo || 'Sin responder' },
          { etiqueta: 'Observaciones', valor: (cierre.hubo === 'Sí' ? cierre.detalle : cierre.observacion) || 'Sin observaciones registradas.', ancho: true }
        ]
      });
    }
    if (prep?.cronometro) {
      secciones.push({
        titulo: 'Tiempo registrado en la preparación',
        campos: [
          { etiqueta: 'Inicio', valor: `${prep.cronometro.fechaInicio} ${prep.cronometro.horaInicio}`.trim() || '—' },
          { etiqueta: 'Finalización', valor: `${prep.cronometro.fechaFin} ${prep.cronometro.horaFin}`.trim() || '—' },
          { etiqueta: 'Tiempo trabajado', valor: this.data.formatoDuracion(prep.cronometro.duracionMinutos) || 'menos de 1 min' }
        ]
      });
    }
    return secciones;
  }

  private seccionesF0302(): SeccionDoc[] {
    const c = this.conf();
    // Hay documentos F0302 de procesos anteriores cuyo checklist ya no está guardado. El documento
    // lo dice en vez de salir con las secciones vacías, que es peor: parecería que no se configuró.
    if (!c) {
      return [{
        titulo: 'Contenido de la configuración',
        texto: 'No hay checklist de Configuración F0302 guardado para este proceso: el documento se generó '
          + 'en su momento y conserva su huella de integridad, pero el detalle de la configuración no está '
          + 'disponible para reconstruirlo.'
      }];
    }
    const secciones: SeccionDoc[] = [{
      titulo: 'Configuración del equipo',
      campos: [
        { etiqueta: 'Nombre del equipo', valor: c.datos.nombrePC || 'Sin registrar', mono: true },
        { etiqueta: 'Tipo de servicio', valor: c.datos.tipoServicio || '—' },
        { etiqueta: 'Sistema operativo', valor: c.datos.sistemaOperativo || '—' },
        { etiqueta: 'Arquitectura', valor: c.datos.arquitectura || '—' },
        { etiqueta: 'Puesto del usuario final', valor: c.datos.puesto || '—' },
        { etiqueta: 'Estado de la configuración', valor: c.estado }
      ]
    }];

    // Reserva de IP: dato del expediente, no del checklist. Va en su propio apartado porque de
    // él depende que el formulario de conformidad pueda enviarse.
    const reserva: CampoDoc[] = [
      { etiqueta: '¿Requiere reserva de IP?',
        valor: c.datos.requiereReservaIP || 'Pendiente de validación antes de conformidad' },
      { etiqueta: 'IP reservada', valor: this.data.textoIPReservada(c), mono: true }
    ];
    if (c.datos.requiereReservaIP === 'Sí') {
      reserva.push(
        { etiqueta: 'MAC del equipo', valor: c.datos.macEquipo || 'Sin registrar', mono: true },
        { etiqueta: 'Solicitud de reserva',
          valor: this.data.textoEstadoSolicitudIP(c)
            + (c.datos.fechaSolicitudIP ? ` · correo simulado al Departamento de Servidores el ${c.datos.fechaSolicitudIP}` : ''),
          ancho: true });
    } else if (c.datos.requiereReservaIP === 'No') {
      reserva.push({ etiqueta: 'Justificación de no reserva',
        valor: c.datos.justificacionSinReservaIP || 'Sin registrar', ancho: true });
    }
    if (c.datos.ipValidadaPor) {
      reserva.push({ etiqueta: 'Reserva validada por',
        valor: `${c.datos.ipValidadaPor} · ${c.datos.ipValidadaEl}`, ancho: true });
    }
    secciones.push({ titulo: 'Reserva de IP', campos: reserva });

    if (this.historialCiclo().length) {
      secciones.push({
        titulo: 'Historial del ciclo',
        items: this.historialCiclo().map((linea) => ({ nombre: linea, estado: '' })),
        nota: `Expediente técnico: ${this.expTecnicoDoc() || '—'} — el mismo durante todo el ciclo, incluidos los reprocesos.`
      });
    }

    const caps = this.capturasDoc();
    if (caps) {
      secciones.push({
        titulo: 'Controles de seguridad con evidencia',
        columnas: ['Control', 'Estado', 'Evidencia asociada'],
        filas: caps.map((x) => [
          x.item.nombre,
          x.item.estado === 'Realizado' ? 'Completado' : x.item.estado,
          x.evidencia
            ? `${x.evidencia.archivo} · ${x.evidencia.cargadaPor} · ${x.evidencia.fecha} · ${x.evidencia.formulario}`
            : x.item.evidencia || 'Sin evidencia registrada'
        ])
      });
    }
    const ctrls = this.controlesSinEvidenciaDoc();
    if (ctrls) {
      secciones.push({
        titulo: 'Controles de configuración validados',
        items: ctrls.map((s) => ({ nombre: s.nombre, estado: s.estado })),
        nota: 'Estos controles se registran validados y no llevan imagen asociada: no se les pidió captura.'
      });
    }
    const fuera = this.noAplicaDoc();
    if (fuera) {
      secciones.push({
        titulo: 'Ítems marcados como No aplica',
        columnas: ['Ítem', 'Justificación', 'Registrado por'],
        filas: fuera.map((s) => [
          s.nombre, s.justificacionNoAplica || 'Sin justificación registrada',
          s.noAplicaPor ? `${s.noAplicaPor.split('—')[0].trim()} · ${s.fechaNoAplica}` : '—'
        ]),
        nota: 'El documento deja constancia de lo que no se hizo y por qué, no solo de lo que sí se hizo.'
      });
    }
    const heredado = this.heredadoDoc();
    secciones.push({
      titulo: 'Software instalado previamente en la Preparación F0288',
      columnas: ['Software', 'Versión', 'Origen', 'Evidencia'],
      filas: heredado
        ? heredado.map((s) => [s.nombre, s.version, `Preparación F0288 (${s.expedienteTecnico})`, s.evidencia || '—'])
        : [],
      texto: heredado ? '' : 'No hay software del catálogo registrado en la Preparación F0288 de este equipo.',
      nota: 'Este software se hereda del F0288: no se vuelve a configurar en la etapa de Soporte.'
    });
    const adicional = this.adicionalDoc();
    secciones.push({
      titulo: 'Software agregado en la Configuración F0302',
      columnas: ['Software', 'Versión', 'Motivo', 'Estado', 'Observación'],
      filas: adicional
        ? adicional.map((s) => [s.nombre, s.version, s.motivo || 'Sin motivo registrado', s.estado, s.observacion || '—'])
        : [],
      texto: adicional ? '' : 'No se agregó software adicional: el requerimiento no lo necesitaba.'
    });
    return secciones;
  }

  private seccionesEntrega(): SeccionDoc[] {
    const x = this.expediente();
    if (!x) return [];
    const e = this.data.entregaDe(x.expediente);
    const conf = this.data.conformidades().find((c) => c.expediente === x.expediente);
    const secciones: SeccionDoc[] = [{
      titulo: 'Entrega del equipo',
      campos: [
        { etiqueta: 'Fecha de entrega', valor: e?.fechaEntrega ?? '—', mono: true },
        { etiqueta: 'Equipo entregado', valor: e?.equipo ?? '—' },
        { etiqueta: 'Número de inventario', valor: e?.inventario ?? '—', mono: true },
        { etiqueta: 'Estado de la entrega', valor: e?.estado ?? '—' },
        { etiqueta: 'Preparado por', valor: e?.preparadoPor ?? '—' },
        { etiqueta: 'Formulario de conformidad', valor: e?.conformidadToken ?? '—', mono: true }
      ]
    }];

    if (conf) {
      secciones.push({
        titulo: 'Aceptación del usuario final',
        campos: [
          { etiqueta: 'Estado de la conformidad', valor: conf.estado },
          { etiqueta: 'Enviado el', valor: conf.fechaEnvio || '—', mono: true },
          { etiqueta: 'Vence el', valor: conf.vence || '—', mono: true },
          { etiqueta: 'Respondido el', valor: conf.fechaRespuesta || 'Sin responder', mono: true },
          { etiqueta: 'Nombre del equipo aceptado', valor: conf.nombreEquipo || this.conf()?.datos.nombrePC || '—', mono: true },
          { etiqueta: 'IP reservada', valor: conf.ipReservada || this.data.textoIPReservada(this.conf()), mono: true },
          { etiqueta: 'Respuesta del usuario final', valor: conf.respuesta || '—', ancho: true },
          { etiqueta: 'Observaciones del usuario final', valor: conf.observaciones || 'Sin observaciones.', ancho: true }
        ],
        nota: conf.aceptaTerminos
          ? 'El usuario final declaró recibir el equipo conforme y aceptó los términos de resguardo.'
          : 'El usuario final aún no ha aceptado los términos de resguardo.'
      });
    }
    return secciones;
  }

  /**
   * Reporte final: no es un documento más, es la consolidación del expediente. Recorre el proceso
   * completo en el orden en que ocurrió y termina diciendo en qué estado quedó.
   */
  private seccionesReporteFinal(): SeccionDoc[] {
    const x = this.expediente();
    if (!x) return [];
    const id = x.expediente;
    const tec = this.data.expTecnicoDe(id);
    const prep = this.prep();
    const c = this.conf();
    const gar = this.data.garantiaDe(id);
    const secciones: SeccionDoc[] = [];

    secciones.push({
      titulo: 'Expediente técnico',
      campos: [
        { etiqueta: 'Código', valor: tec?.codigo ?? '—', mono: true },
        { etiqueta: 'Tipo de expediente', valor: tec?.tipoExpediente ?? '—' },
        { etiqueta: 'Unidad responsable', valor: tec?.unidadResponsable ?? '—' },
        { etiqueta: 'Creado por', valor: tec?.creadoPor ?? '—' },
        { etiqueta: 'Fecha de creación', valor: tec?.fecha ?? '—', mono: true },
        { etiqueta: 'Estado', valor: tec?.estado ?? '—' }
      ]
    });

    secciones.push({
      titulo: 'Preparación F0288',
      campos: [
        { etiqueta: 'Técnico que preparó', valor: prep?.tecnico ?? '—' },
        { etiqueta: 'Unidad', valor: prep?.unidad ?? '—' },
        { etiqueta: 'Fecha', valor: prep?.fecha ?? '—', mono: true },
        { etiqueta: 'Estado', valor: prep?.estado ?? 'Sin preparación registrada' },
        { etiqueta: 'Tiempo trabajado',
          valor: this.data.formatoDuracion(prep?.cronometro?.duracionMinutos ?? null) || '—' },
        { etiqueta: 'Complejidad', valor: prep?.cierre?.nivel ?? '—' }
      ],
      texto: prep ? '' : 'Este expediente no tiene preparación F0288 registrada.'
    });

    secciones.push({
      titulo: 'Configuración F0302',
      campos: [
        { etiqueta: 'Técnico de Configuración', valor: c?.tecnico ?? '—' },
        { etiqueta: 'Nombre del equipo', valor: c?.datos.nombrePC || '—', mono: true },
        { etiqueta: 'Fecha', valor: c?.fecha ?? '—', mono: true },
        { etiqueta: 'Estado', valor: c?.estado ?? 'Sin configuración registrada' },
        { etiqueta: '¿Requiere reserva de IP?', valor: c?.datos.requiereReservaIP || '—' },
        { etiqueta: 'IP reservada', valor: this.data.textoIPReservada(c), mono: true }
      ],
      texto: c ? '' : 'Este expediente no tiene configuración F0302 registrada.'
    });

    secciones.push(...this.seccionesEntrega());

    if (gar) {
      secciones.push({
        titulo: 'Garantía',
        campos: [
          { etiqueta: 'Tipo de garantía', valor: gar.tipoGarantia ?? '—' },
          { etiqueta: 'Estado', valor: gar.estado },
          { etiqueta: 'Inicio de vigencia', valor: gar.fechaInicio || '—', mono: true },
          { etiqueta: 'Vencimiento', valor: gar.fechaVencimiento || '—', mono: true },
          { etiqueta: 'Proveedor', valor: gar.proveedor || '—' },
          { etiqueta: 'Casos abiertos', valor: String(gar.casos.length) }
        ],
        columnas: gar.casos.length ? ['Caso', 'Apertura', 'Motivo', 'Responsable', 'Estado', 'Resultado'] : undefined,
        filas: gar.casos.map((k) => [k.codigo, k.fechaApertura, k.motivo, k.responsableAtencion, k.estado, k.resultado || '—'])
      });
    }

    const descargos = this.descargosDelProceso();
    if (descargos.length) {
      secciones.push({
        titulo: 'Descargo del equipo',
        columnas: ['Documento', 'Fecha', 'Motivo', 'Estado físico', 'Acción posterior', 'Registrado por'],
        filas: descargos.map((d) => [d.idDescargo, d.fechaDescargo, d.motivoDescargo, d.estadoFisico,
          d.accionPosterior, d.responsableRegistro]),
        nota: 'El descargo cierra el ciclo: la asignación deja de estar vigente y el expediente queda como histórico.'
      });
    }

    // Trazabilidad resumida: solo los hitos. El detalle completo vive en el módulo Trazabilidad y
    // copiarlo entero convertiría el reporte en un registro, no en un resumen.
    const hitos = this.data.eventosDe(id).filter((e) => e.hito);
    secciones.push({
      titulo: 'Trazabilidad resumida',
      columnas: ['Fecha', 'Hora', 'Acción', 'Estado', 'Responsable'],
      filas: hitos.map((e) => [e.fecha, e.hora, e.accion, e.estado, e.usuario]),
      texto: hitos.length ? '' : 'Este expediente todavía no registra hitos de trazabilidad.',
      nota: 'Resumen de hitos. El registro completo de eventos se consulta en el módulo Trazabilidad.'
    });

    const grupos = this.data.evidenciasDelExpediente(id);
    secciones.push({
      titulo: 'Resumen de evidencias del expediente',
      columnas: ['Etapa', 'Proceso', 'Imágenes'],
      filas: grupos.map((g) => [g.etapa, g.proceso, String(g.lista.length)]),
      texto: grupos.length ? '' : 'Este expediente no tiene imágenes de evidencia registradas.'
    });

    const documentos = this.data.documentosDe(id);
    secciones.push({
      titulo: 'Documentos del expediente',
      columnas: ['Documento', 'Generado', 'Generado por', 'Huella'],
      filas: documentos.map((d) => [d.tipo, `${d.fecha} ${d.hora ?? ''}`.trim(), d.generadoPor, d.hash])
    });

    secciones.push({
      titulo: 'Estado final del proceso',
      campos: [
        { etiqueta: 'Estado del expediente único', valor: x.estado },
        { etiqueta: 'Resumen', valor: x.resumenEstado, ancho: true },
        { etiqueta: 'Aceptación del usuario final', valor: this.data.estadoAceptacion(id) },
        { etiqueta: 'Estado de la garantía', valor: gar?.estado ?? 'Sin garantía habilitada' },
        { etiqueta: 'Equipo descargado', valor: descargos.length ? `Sí · ${descargos[0].idDescargo}` : 'No' }
      ],
      nota: 'El cierre es de auditoría: el expediente sigue disponible para casos de garantía mientras la garantía esté vigente.'
    });
    return secciones;
  }

  /** El documento abierto, sección por sección. */
  protected readonly seccionesDoc = computed<SeccionDoc[]>(() => {
    const f = this.ver();
    if (!f) return [];
    const base = [this.seccionExpediente(), this.seccionEquipo(), this.seccionUsuarioFinal(),
      this.seccionTecnico(f.tipo)];
    switch (f.tipo) {
      case 'F0288': return [...base, ...this.seccionesF0288()];
      case 'F0302': return [...base, ...this.seccionesF0302()];
      case 'Entrega y aceptación': return [...base, ...this.seccionesEntrega()];
      case 'Reporte final': return [...base, ...this.seccionesReporteFinal()];
      default: return base;
    }
  });

  // ---------- El F0288 que consulta Hardware ----------

  /** Imágenes de la preparación técnica que respalda el F0288 abierto en modo Hardware. */
  protected readonly evidenciasTecVisor = computed<EvidenciaVista[]>(() => {
    const t = this.verTec();
    return t ? this.data.evid.de('Preparación F0288', t.codigo) : [];
  });

  /** Firma del técnico que preparó el equipo, la única que lleva el F0288. */
  protected readonly firmasTec = computed<FirmaProceso[]>(() => {
    const t = this.verTec();
    if (!t) return [];
    const firma = this.data.preparacionPorCodigo(t.codigo)?.firma;
    return [{
      documento: 'F0288',
      rotulo: 'Técnico que preparó el equipo',
      nombre: this.nombreDe(t.tecnicoPreparacion),
      rol: t.tecnicoPreparacion.split('—')[1]?.trim() ?? '',
      fecha: firma?.fecha || this.docTecVer()?.fecha || '',
      hora: firma?.hora ?? '',
      estado: firma?.estado === 'Pendiente' ? 'Pendiente' : 'Capturada',
      detalle: 'Firma simulada registrada al cerrar la preparación técnica.'
    }];
  });

  protected readonly seccionesTec = computed<SeccionDoc[]>(() => {
    const t = this.verTec();
    if (!t) return [];
    const eq = this.data.equipoDe(t.inventario);
    const prep = this.data.preparacionPorCodigo(t.codigo);
    const secciones: SeccionDoc[] = [
      {
        titulo: 'Datos del expediente técnico',
        campos: [
          { etiqueta: 'Expediente técnico', valor: t.codigo, mono: true },
          { etiqueta: 'Tipo de expediente', valor: t.tipoExpediente },
          { etiqueta: 'Unidad responsable', valor: t.unidadResponsable },
          { etiqueta: 'Creado por', valor: t.creadoPor },
          { etiqueta: 'Fecha de creación', valor: t.fecha, mono: true },
          { etiqueta: 'Estado', valor: t.estado }
        ]
      },
      {
        titulo: 'Datos del equipo',
        campos: [
          { etiqueta: 'Equipo', valor: t.marcaModelo },
          { etiqueta: 'Tipo de equipo', valor: t.tipoEquipo === 'Desktop' ? 'CPU' : 'Laptop' },
          { etiqueta: 'Número de inventario', valor: t.inventario, mono: true },
          { etiqueta: 'Número de serie', valor: eq?.serie ?? '—', mono: true },
          { etiqueta: 'Condición', valor: t.condicion },
          { etiqueta: 'Sistema operativo', valor: eq?.sistemaOperativo ?? '—' }
        ]
      },
      {
        titulo: 'Técnico responsable de la preparación',
        campos: [
          { etiqueta: 'Técnico de preparación', valor: t.tecnicoPreparacion },
          { etiqueta: 'Fecha de la preparación', valor: prep?.fecha ?? '—', mono: true },
          { etiqueta: 'Estado de la preparación', valor: prep?.estado ?? '—' },
          { etiqueta: 'Tiempo trabajado',
            valor: this.data.formatoDuracion(prep?.cronometro?.duracionMinutos ?? null) || '—' }
        ]
      }
    ];

    for (const s of prep?.secciones ?? []) {
      if (!s.items.length) continue;
      secciones.push({
        titulo: `Checklist de preparación — ${s.titulo}`,
        items: s.items.map((i) => ({
          nombre: i.nombre + (i.versionSeleccionada ? ` (versión ${i.versionSeleccionada})` : ''),
          estado: i.estado,
          nota: [i.nota, i.evidencia ? `Evidencia: ${i.evidencia}` : ''].filter(Boolean).join(' · ')
        }))
      });
    }

    const software = this.softwareDeTec(t);
    if (software) {
      secciones.push({
        titulo: 'Software instalado en la preparación',
        columnas: ['Software', 'Estado', 'Versión', 'Evidencia'],
        filas: software.map((s) => [s.nombre, s.estado, s.versionSeleccionada ?? '—',
          s.evidencia ?? (s.requiereEvidencia && s.estado === 'Realizado' ? 'Sin captura registrada' : '—')])
      });
    }
    const accesorios = this.accesoriosDeTec(t);
    if (accesorios) {
      secciones.push({
        titulo: 'Accesorios verificados',
        columnas: ['Accesorio', 'Detalle de la verificación'],
        filas: accesorios.map((a) => [a.nombre, this.detalleAccesorio(a)])
      });
    }
    const obs = this.observacionDeTec(t);
    secciones.push({
      titulo: 'Observaciones de la preparación',
      texto: obs || 'La preparación no registró observaciones.'
    });
    return secciones;
  });

  protected elegir(id: string): void {
    this.seleccion.set(id);
    this.casoActivo.seleccionar(id);
    this.buscarAbierto.set(false);
  }

  /**
   * Descarga el documento como archivo de texto simulado que INCLUYE las firmas capturadas
   * (en el sistema real sería el PDF firmado). La descarga queda en la trazabilidad.
   */
  protected descargar(f: FilaDoc): void {
    const x = this.expediente();
    if (!x || !f.doc) return;
    const s = this.sol();
    const lineas = [
      'SISGOST · Centro Nacional de Registros',
      f.nombre,
      '='.repeat(60),
      `Expediente único: ${x.codigoUnico}`,
      `Solicitud: ${x.expediente} · ${this.data.tipoRequerimientoTexto(s)}`,
      `Equipo: ${this.equipoTxt()}`,
      // El F0302 lleva el nombre del equipo y la reserva de IP como datos clave del expediente.
      ...(f.tipo === 'F0302' && this.conf()
        ? [`Nombre del equipo: ${this.conf()!.datos.nombrePC}`,
           `¿Requiere reserva de IP?: ${this.conf()!.datos.requiereReservaIP || 'Pendiente de validación antes de conformidad'}`,
           `IP reservada: ${this.data.textoIPReservada(this.conf())}`,
           ...(this.conf()!.datos.requiereReservaIP === 'Sí'
             ? [`MAC del equipo: ${this.conf()!.datos.macEquipo || 'Sin registrar'}`,
                `Solicitud de reserva de IP: ${this.data.textoEstadoSolicitudIP(this.conf())}`
                  + (this.conf()!.datos.fechaSolicitudIP
                    ? ` · correo simulado al Departamento de Servidores el ${this.conf()!.datos.fechaSolicitudIP}` : '')]
             : this.conf()!.datos.requiereReservaIP === 'No'
               ? [`Justificación de no reserva: ${this.conf()!.datos.justificacionSinReservaIP || 'Sin registrar'}`]
               : []),
           ...(this.conf()!.datos.ipValidadaPor
             ? [`Reserva validada por: ${this.conf()!.datos.ipValidadaPor} · ${this.conf()!.datos.ipValidadaEl}`]
             : []),
           ...(this.historialCiclo().length
             ? ['', 'HISTORIAL DEL CICLO', '-'.repeat(60),
                ...this.historialCiclo().map((l) => `  ${l}`),
                `  Expediente técnico: ${this.expTecnicoDoc() || '—'} — el mismo durante todo el ciclo, incluidos los reprocesos.`]
             : [])]
        : []),
      `Usuario final: ${s?.destinatario ?? '—'} — ${s?.unidadDestino ?? ''}`,
      `Generado: ${f.doc.fecha} por ${f.doc.generadoPor}`,
      `Huella de integridad: ${f.doc.hash}`,
      ...this.lineasSoftware(f.tipo === 'F0288' ? this.softwareDoc() : undefined),
      ...this.lineasAccesorios(f.tipo === 'F0288' ? this.accesoriosDoc() : undefined),
      ...(f.tipo === 'F0302' ? this.lineasSoftwareF0302() : []),
      '',
      'FIRMAS INCLUIDAS EN EL DOCUMENTO',
      '-'.repeat(60),
      ...this.firmasDe(f).flatMap((fp) => fp.estado === 'Capturada'
        ? [`${fp.rotulo}:`, '  Firmado electrónicamente por:', `  ${fp.nombre}${fp.rol ? '\n  ' + fp.rol : ''}`, `  Fecha: ${fp.fecha}${fp.hora ? ' · ' + fp.hora : ''}`, '']
        : [`${fp.rotulo}: ${fp.estado === 'No aplica' ? 'No aplica (inconformidad registrada; sin firma de aceptación)' : 'Pendiente de captura'}`, '']),
      'Documento de demostración del prototipo SISGOST; las firmas son simuladas.'
    ];
    this.descargarTexto(`${f.tipo.replace(/ /g, '-')}-${x.codigoUnico}.txt`, lineas.join('\n'));
    const u = this.auth.usuario();
    this.data.registrarEvento(x.expediente, `${u?.nombre} — ${u?.rol}`,
      `${f.nombre} descargado con las firmas simuladas`, x.estado, '', false,
      { modulo: 'Generador de documentos', expedienteUnico: x.codigoUnico });
    this.toast.ok('Documento descargado', `${f.nombre} se descargó incluyendo las firmas capturadas.`);
  }

  /** Sección «Software instalado» del documento F0288 descargado, con versión y evidencia de cada ítem. */
  private lineasSoftware(items: { nombre: string; estado: string; versionSeleccionada?: string; evidencia: string | null }[] | undefined): string[] {
    if (!items) return [];
    return [
      '',
      'SOFTWARE INSTALADO EN LA PREPARACIÓN',
      '-'.repeat(60),
      ...items.map((i) => `${i.nombre}: ${i.estado}`
        + (i.versionSeleccionada ? ` — versión ${i.versionSeleccionada}` : '')
        + (i.evidencia ? ` · evidencia: ${i.evidencia}` : ''))
    ];
  }

  /**
   * Los dos apartados de software del documento F0302 descargado: primero lo que ya venía
   * instalado desde la Preparación F0288 (heredado, no se reconfigura) y luego lo que el Técnico
   * de Soporte agregó según el requerimiento del usuario final, con su motivo.
   */
  private lineasSoftwareF0302(): string[] {
    const heredado = this.heredadoDoc();
    const adicional = this.adicionalDoc();
    const caps = this.capturasDoc();
    return [
      ...(caps ? ['', 'CONTROLES DE SEGURIDAD CON EVIDENCIA', '-'.repeat(60),
        ...caps.map((x) => `${x.item.nombre} | ${x.item.estado === 'Realizado' ? 'Configurado' : x.item.estado}`
          + (x.evidencia
            ? ` | evidencia: ${x.evidencia.archivo} | ${x.evidencia.cargadaPor} | ${x.evidencia.fecha} | ${x.evidencia.formulario}`
            : x.item.evidencia ? ` | evidencia: ${x.item.evidencia}` : ' | sin evidencia registrada'))] : []),
      '',
      'SOFTWARE INSTALADO PREVIAMENTE EN F0288',
      '-'.repeat(60),
      ...(heredado
        ? heredado.map((s) => `${s.nombre} | Versión ${s.version} | Preparación F0288 (${s.expedienteTecnico})`
            + (s.evidencia ? ` | evidencia: ${s.evidencia}` : ''))
        : ['No hay software del catálogo registrado en la Preparación F0288 de este equipo.']),
      '',
      'SOFTWARE AGREGADO EN CONFIGURACIÓN F0302',
      '-'.repeat(60),
      ...(adicional
        ? adicional.map((s) => `${s.nombre} | ${s.version} | ${s.motivo || 'sin motivo registrado'} | ${s.estado}`
            + (s.observacion?.trim() ? ` | ${s.observacion.trim()}` : ''))
        : ['No se agregó software adicional: el requerimiento no lo necesitaba.'])
    ];
  }

  /** Sección «Observaciones» del documento F0288 descargado (vacía si la preparación no dejó observación). */
  private lineasObservacion(obs: string): string[] {
    return obs ? ['', 'OBSERVACIONES DE LA PREPARACIÓN', '-'.repeat(60), obs] : [];
  }

  /**
   * Ficha de un accesorio verificado tal como se reporta en el F0288: número, marca, modelo,
   * serie, estado físico, quién lo verificó y cuándo. El accesorio tiene su propio número de
   * inventario, distinto al del equipo principal, así que el número es parte del dato.
   */
  protected detalleAccesorio(a: AccesorioVerificado): string {
    if (!a.seleccionado) return 'No seleccionado';
    if (a.resultadoBusqueda !== 'Encontrado') {
      return `Sin asociar${a.numeroInventario ? ' — ' + a.numeroInventario : ''}${a.resultadoBusqueda ? ' · ' + a.resultadoBusqueda : ''}`;
    }
    const ficha = [a.marca, a.modelo].filter(Boolean).join(' ');
    return `Verificado — ${a.numeroInventario}`
      + (ficha ? ` · ${ficha}` : '')
      + (a.serie ? ` · serie ${a.serie}` : '')
      + (a.estadoFisico ? ` · estado ${a.estadoFisico}` : '')
      + (a.verificadoPor ? ` · verificado por ${a.verificadoPor}` : '')
      + (a.fechaVerificacion ? ` (${a.fechaVerificacion})` : '')
      + (a.observacion.trim() ? ` · observación: ${a.observacion.trim()}` : '');
  }

  /** Sección «Accesorios verificados» del documento F0288 descargado (vacía si no aplica al equipo). */
  private lineasAccesorios(accesorios: AccesorioVerificado[] | undefined): string[] {
    if (!accesorios) return [];
    return [
      '',
      'ACCESORIOS VERIFICADOS',
      '-'.repeat(60),
      ...accesorios.map((a) => `${a.nombre}: ${this.detalleAccesorio(a)}`)
    ];
  }

  private descargarTexto(nombre: string, contenido: string): void {
    const url = URL.createObjectURL(new Blob([contenido], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Modo Hardware (solo F0288) ----------
  protected seleccionTec = signal('');
  protected verTec = signal<ExpedienteTecnico | null>(null);
  protected buscarTecAbierto = signal(false);

  /** Filas de búsqueda del catálogo «Buscar expediente» (Expediente técnico), ya filtradas por rol. */
  protected readonly opcionesTec = computed<FilaExpedienteTecnico[]>(() =>
    this.data.expedientesTecnicosVisibles().map((t) => filaExpedienteTecnico(this.data, t))
  );

  protected readonly tecSel = computed(() => {
    const visibles = this.data.expedientesTecnicosVisibles();
    if (visibles.length === 1) return visibles[0];
    return visibles.find((t) => t.codigo === this.seleccionTec());
  });

  protected readonly docTec = computed(() => {
    const t = this.tecSel();
    return t ? this.data.documentoF0288DeExpTecnico(t.codigo) : undefined;
  });

  /** Documento mostrado en la vista previa del F0288 (independiente de la selección actual). */
  protected readonly docTecVer = computed(() => {
    const t = this.verTec();
    return t ? this.data.documentoF0288DeExpTecnico(t.codigo) : undefined;
  });

  protected elegirTec(codigo: string): void {
    this.seleccionTec.set(codigo);
    this.buscarTecAbierto.set(false);
  }

  /** Firma del técnico de preparación (para la vista previa y la descarga del F0288 de Hardware). */
  protected firmaPrep(t: ExpedienteTecnico) {
    return this.data.preparacionPorCodigo(t.codigo)?.firma;
  }

  /** Accesorios verificados del F0288 (modo Hardware), solo cuando la respuesta fue «Sí» (equipo usado). */
  protected accesoriosDeTec(t: ExpedienteTecnico) {
    const va = this.data.preparacionPorCodigo(t.codigo)?.verificacionAccesorios;
    return va?.respuesta === 'Sí' ? va.accesorios : undefined;
  }

  /**
   * Software instalado que reporta el documento F0288: los ítems del checklist controlados por el
   * catálogo o con captura obligatoria (Windows, Antivirus, OCS Inventory), con su versión y su
   * evidencia. Es la preparación técnica de Hardware: no incluye credenciales, dominio ni DLP,
   * que son actividades de Soporte y se registran en el F0302.
   */
  protected softwareDeTec(t: ExpedienteTecnico) {
    const items = (this.data.preparacionPorCodigo(t.codigo)?.secciones ?? [])
      .flatMap((s) => s.items)
      .filter((i) => i.codigoSoftware || i.requiereEvidencia);
    return items.length > 0 ? items : undefined;
  }

  /** Observación técnica del cierre del F0288 (detalle de complejidad u observación libre). */
  protected observacionDeTec(t: ExpedienteTecnico): string {
    const c = this.data.preparacionPorCodigo(t.codigo)?.cierre;
    if (!c) return '';
    return (c.hubo === 'Sí' ? c.detalle : c.observacion).trim();
  }

  protected descargarTec(t: ExpedienteTecnico): void {
    const d = this.data.documentoF0288DeExpTecnico(t.codigo);
    if (!d) return;
    const firma = this.firmaPrep(t);
    const lineas = [
      'SISGOST · Centro Nacional de Registros',
      'F0288 — Preparación técnica',
      '='.repeat(60),
      `Expediente técnico: ${t.codigo} · ${t.tipoExpediente}`,
      `Equipo: ${t.marcaModelo} · inventario ${t.inventario}`,
      `Unidad responsable: ${t.unidadResponsable}`,
      `Generado: ${d.fecha} por ${d.generadoPor}`,
      `Huella de integridad: ${d.hash}`,
      ...this.lineasSoftware(this.softwareDeTec(t)),
      ...this.lineasObservacion(this.observacionDeTec(t)),
      ...this.lineasAccesorios(this.accesoriosDeTec(t)),
      '',
      'FIRMA INCLUIDA EN EL DOCUMENTO',
      '-'.repeat(60),
      'Técnico que preparó el equipo:',
      '  Firmado electrónicamente por:',
      `  ${t.tecnicoPreparacion}`,
      `  Fecha: ${firma?.fecha || d.fecha}${firma?.hora ? ' · ' + firma.hora : ''}`,
      '',
      'Documento de demostración del prototipo SISGOST; la firma es simulada.'
    ];
    this.descargarTexto(`F0288-${t.codigo}.txt`, lineas.join('\n'));
    const u = this.auth.usuario();
    this.data.registrarEvento(t.codigo, `${u?.nombre} — ${u?.rol}`,
      `F0288 ${t.codigo} descargado con la firma simulada del técnico que preparó`, t.estado, '', false,
      { modulo: 'Generador de documentos', inventario: t.inventario, expedienteTecnico: t.codigo });
    this.toast.ok('F0288 descargado', 'El documento se descargó incluyendo la firma del técnico que preparó el equipo.');
  }
}
