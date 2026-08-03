import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { CasoActivoService } from '../../core/services/caso-activo.service';
import { DocumentoGenerado, ExpedienteTecnico, FirmaProceso } from '../../core/models/models';
import { BadgeComponent, HelpTipComponent, ModalComponent } from '../../shared/ui';
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
    RouterLink, BadgeComponent, HelpTipComponent, ModalComponent,
    BuscarExpedienteUnicoModalComponent, BuscarExpedienteTecnicoModalComponent
  ],
  styles: `
    .doc-preview { border: 1px solid var(--line); border-radius: var(--r-md); padding: 26px 30px; background: var(--surface); }
    .doc-preview .dp-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid var(--navy-900); padding-bottom: 12px; margin-bottom: 16px; }
    .doc-preview .dp-head img { height: 38px; }
    .doc-preview .dp-tit { text-align: right; }
    .doc-preview .dp-tit b { font-size: 15px; color: var(--navy-900); display: block; }
    .doc-preview .dp-tit span { font-size: 11px; color: var(--tx-3); letter-spacing: .08em; text-transform: uppercase; }
    .dp-firmas { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-top: 22px; }
    .dp-f { border-top: 1px solid var(--tx-2); padding-top: 6px; font-size: 11.5px; color: var(--tx-2); }
    .dp-f .f-cap { font-size: 10px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--tx-3); }
    .dp-f .f-nombre { font-family: var(--font-brand); font-size: 17px; color: var(--navy-900); margin: 2px 0; }
    .dp-hash { font-size: 10.5px; color: var(--tx-3); margin-top: 16px; text-align: right; font-variant-numeric: tabular-nums; }
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
              <button class="btn btn-outline btn-sm" (click)="buscarTecAbierto.set(true)">🔍 Buscar expediente</button>
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
              <button class="btn btn-outline btn-sm" (click)="buscarAbierto.set(true)">🔍 Buscar expediente</button>
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

      <!-- Vista previa del documento (modo Soporte) -->
      @if (ver(); as f) {
        <ui-modal [titulo]="f.nombre" [sub]="'Vista simulada del documento generado'" (cerrar)="ver.set(null)">
          <div class="doc-preview">
            <div class="dp-head">
              <img src="assets/logos/LogoCNR.png" alt="CNR" />
              <div class="dp-tit">
                <b>{{ f.nombre }}</b>
                <span>SISGOST · Centro Nacional de Registros</span>
              </div>
            </div>
            <dl class="dl">
              <dt>Expediente único</dt><dd>{{ expediente()?.codigoUnico }}</dd>
              <dt>Solicitud</dt><dd>{{ expediente()?.expediente }} · {{ data.tipoRequerimientoTexto(sol()) }}</dd>
              <dt>Equipo</dt><dd>{{ equipoTxt() }}</dd>
              @if (f.tipo === 'F0302' && conf(); as c) {
                <dt>Nombre del equipo</dt><dd class="mono">{{ c.datos.nombrePC }}</dd>
                <dt>¿Requiere reserva de IP?</dt><dd>{{ c.datos.requiereReservaIP || '—' }}</dd>
                <dt>IP reservada</dt><dd class="mono">{{ data.textoIPReservada(c) }}</dd>
              }
              <dt>Usuario final</dt><dd>{{ sol()?.destinatario }} — {{ sol()?.unidadDestino }}</dd>
              <dt>Generado</dt><dd>{{ f.doc?.fecha }} por {{ f.doc?.generadoPor }}</dd>
            </dl>
            <p class="small muted mt-2">
              @switch (f.tipo) {
                @case ('F0288') { Contenido: checklist digital de preparación técnica completado dentro de SISGOST, con evidencias verificadas y firma del técnico que preparó. }
                @case ('F0302') { Contenido: checklist digital de configuración e instalación, software estándar según requerimiento, evidencias verificadas y firmas de preparación y configuración. }
                @case ('Entrega y aceptación') { Contenido: constancia de entrega del equipo con la respuesta del formulario externo y la firma de conformidad simulada del usuario final. }
                @case ('Reporte final') { Contenido: consolidación del expediente único — solicitud, asignación, expediente técnico, F0288, F0302, conformidad del usuario final, garantía y trazabilidad — con las firmas capturadas durante el proceso. }
              }
            </p>
<<<<<<< HEAD
            @if (f.tipo === 'F0288' && accesoriosDoc(); as accs) {
              <div class="mt-2">
                <b>Accesorios verificados</b>
                <dl class="dl mt-1">
                  @for (a of accs; track a.nombre) {
                    <dt>{{ a.nombre }}</dt>
                    <dd>{{ a.seleccionado ? 'Verificado' : 'No seleccionado' }}@if (a.seleccionado && a.numeroInventario) { — {{ a.numeroInventario }} }</dd>
                  }
                </dl>
              </div>
            }
=======
>>>>>>> origin/main
            <div class="dp-firmas">
              @for (fp of firmasDe(f); track fp.rotulo) {
                <div class="dp-f">
                  <div class="f-cap">{{ fp.rotulo }}</div>
                  @if (fp.estado === 'Capturada') {
                    <div class="f-nombre">{{ fp.nombre }}</div>
                    <div>Firmado electrónicamente por: {{ fp.nombre }}@if (fp.rol) { — {{ fp.rol }} }</div>
                    <div>Fecha: {{ fp.fecha }}@if (fp.hora) { · {{ fp.hora }} } · firma simulada</div>
                  } @else if (fp.estado === 'No aplica') {
                    <div>No aplica: el usuario final registró inconformidad; no se genera firma de aceptación.</div>
                  } @else {
                    <div>Firma pendiente de captura.</div>
                  }
                </div>
              }
            </div>
            <div class="dp-hash">Huella de integridad: {{ f.doc?.hash }}</div>
          </div>
        </ui-modal>
      }

      <!-- Vista previa del F0288 (modo Hardware) -->
      @if (verTec(); as t) {
        <ui-modal titulo="F0288 — Preparación técnica" sub="Vista simulada del documento generado" (cerrar)="verTec.set(null)">
          <div class="doc-preview">
            <div class="dp-head">
              <img src="assets/logos/LogoCNR.png" alt="CNR" />
              <div class="dp-tit">
                <b>F0288 — Preparación técnica</b>
                <span>SISGOST · Centro Nacional de Registros</span>
              </div>
            </div>
            <dl class="dl">
              <dt>Expediente técnico</dt><dd>{{ t.codigo }} · {{ t.tipoExpediente }}</dd>
              <dt>Equipo</dt><dd>{{ t.marcaModelo }} · inventario {{ t.inventario }}</dd>
              <dt>Unidad responsable</dt><dd>{{ t.unidadResponsable }}</dd>
              <dt>Técnico de preparación</dt><dd>{{ t.tecnicoPreparacion }}</dd>
              <dt>Generado</dt><dd>{{ docTecVer()?.fecha }} por {{ docTecVer()?.generadoPor }}</dd>
            </dl>
            <p class="small muted mt-2">Contenido: checklist digital de preparación técnica completado dentro de SISGOST, con evidencias verificadas y firma del técnico que preparó.</p>
<<<<<<< HEAD
            @if (accesoriosDeTec(t); as accs) {
              <div class="mt-2">
                <b>Accesorios verificados</b>
                <dl class="dl mt-1">
                  @for (a of accs; track a.nombre) {
                    <dt>{{ a.nombre }}</dt>
                    <dd>{{ a.seleccionado ? 'Verificado' : 'No seleccionado' }}@if (a.seleccionado && a.numeroInventario) { — {{ a.numeroInventario }} }</dd>
                  }
                </dl>
              </div>
            }
=======
>>>>>>> origin/main
            <div class="dp-firmas">
              <div class="dp-f">
                <div class="f-cap">Técnico que preparó el equipo</div>
                <div class="f-nombre">{{ nombreDe(t.tecnicoPreparacion) }}</div>
                <div>Firmado electrónicamente por: {{ t.tecnicoPreparacion }}</div>
                <div>Fecha: {{ firmaPrep(t)?.fecha || docTecVer()?.fecha }}@if (firmaPrep(t)?.hora) { · {{ firmaPrep(t)?.hora }} } · firma simulada</div>
              </div>
            </div>
            <div class="dp-hash">Huella de integridad: {{ docTecVer()?.hash }}</div>
          </div>
        </ui-modal>
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

<<<<<<< HEAD
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

=======
>>>>>>> origin/main
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
           `¿Requiere reserva de IP?: ${this.conf()!.datos.requiereReservaIP || '—'}`,
           `IP reservada: ${this.data.textoIPReservada(this.conf())}`]
        : []),
      `Usuario final: ${s?.destinatario ?? '—'} — ${s?.unidadDestino ?? ''}`,
      `Generado: ${f.doc.fecha} por ${f.doc.generadoPor}`,
      `Huella de integridad: ${f.doc.hash}`,
<<<<<<< HEAD
      ...this.lineasAccesorios(f.tipo === 'F0288' ? this.accesoriosDoc() : undefined),
=======
>>>>>>> origin/main
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

<<<<<<< HEAD
  /** Sección «Accesorios verificados» del documento F0288 descargado (vacía si no aplica al equipo). */
  private lineasAccesorios(accesorios: { nombre: string; seleccionado: boolean; numeroInventario: string }[] | undefined): string[] {
    if (!accesorios) return [];
    return [
      '',
      'ACCESORIOS VERIFICADOS',
      '-'.repeat(60),
      ...accesorios.map((a) => `${a.nombre}: ${a.seleccionado ? `Verificado${a.numeroInventario ? ' — ' + a.numeroInventario : ''}` : 'No seleccionado'}`)
    ];
  }

=======
>>>>>>> origin/main
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

<<<<<<< HEAD
  /** Accesorios verificados del F0288 (modo Hardware), solo cuando la respuesta fue «Sí» (equipo usado). */
  protected accesoriosDeTec(t: ExpedienteTecnico) {
    const va = this.data.preparacionPorCodigo(t.codigo)?.verificacionAccesorios;
    return va?.respuesta === 'Sí' ? va.accesorios : undefined;
  }

=======
>>>>>>> origin/main
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
<<<<<<< HEAD
      ...this.lineasAccesorios(this.accesoriosDeTec(t)),
=======
>>>>>>> origin/main
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
