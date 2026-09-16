import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/services/data.service';
import { TerritorioService } from '../../core/services/territorio.service';
import { AreaUnidad, DireccionRegistro, UsuarioFinal } from '../../core/models/territorio';
import { BadgeComponent, HelpTipComponent } from '../../shared/ui';
import { IconComponent } from '../../shared/icon';

/**
 * ESTRUCTURA ORGANIZATIVA — el módulo organizacional del DER, navegable de arriba abajo y de
 * abajo arriba:
 *
 *     ZONA → DEPARTAMENTO → DIRECCION → AREA_UNIDAD → USUARIO_FINAL
 *
 * con CATALOGO_UNIDAD clasificando la DIRECCION y CATALOGO_AREA clasificando el AREA_UNIDAD.
 *
 * Existe porque el prototipo llegaba solo hasta la Dirección/Registro: el usuario final era un
 * nombre suelto en la solicitud, sin ningún lugar en la organización. El DER lo cuelga de un
 * **área**, y de ahí se deduce todo lo demás — esa es la cadena que esta pantalla demuestra.
 *
 * UBICACION se muestra aparte, y a propósito: son **lugares físicos** (bodegas, talleres, salas
 * técnicas), no unidades institucionales, y el DER las separa para que nadie las confunda.
 */
@Component({
  selector: 'app-estructura-organizativa',
  imports: [FormsModule, BadgeComponent, HelpTipComponent, IconComponent],
  styles: `
    .kpi { border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface); padding: 14px 16px; }
    .kpi .k-num { font-size: 26px; font-weight: 800; color: var(--navy-900); line-height: 1.1; }
    .kpi .k-lbl { font-size: 11.5px; color: var(--tx-2); margin-top: 2px; }

    .arbol { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; }
    .col { border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface); overflow: hidden; }
    .col > header { padding: 9px 12px; background: var(--surface-2); border-bottom: 1px solid var(--line);
      font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--tx-2); font-weight: 700; }
    .col > header small { display: block; text-transform: none; letter-spacing: 0; font-weight: 500; color: var(--tx-3); }
    .col ul { list-style: none; margin: 0; padding: 6px; max-height: 340px; overflow-y: auto; }
    .col li button { width: 100%; text-align: left; border: 1px solid transparent; background: none; cursor: pointer;
      padding: 7px 9px; border-radius: var(--r-sm); font-size: 12.5px; color: var(--tx-1); font-family: inherit; }
    .col li button:hover { background: var(--surface-2); }
    .col li button.sel { background: var(--navy-50, var(--surface-2)); border-color: var(--line); font-weight: 700; }
    .col li button span { display: block; font-size: 11px; color: var(--tx-2); font-weight: 400; }
    .vacio { padding: 14px 12px; font-size: 12px; color: var(--tx-3); }

    .cadena { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .cadena .paso { border: 1px solid var(--line); border-radius: 999px; padding: 5px 12px; background: var(--surface);
      font-size: 12px; }
    .cadena .paso b { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: var(--tx-3); font-weight: 700; }
    .cadena ui-icon { color: var(--tx-3); }

    .datos { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px 18px; }
    .datos > div { font-size: 12.5px; }
    .datos span { display: block; color: var(--tx-2); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Sistema</div>
          <h1>
            Estructura organizativa
            <ui-help texto="Zona → Departamento → Dirección → Área → Usuario final. La Dirección la clasifica el catálogo de unidades (IGCN, RC…) y el Área, el catálogo de áreas (Atención al Cliente, Archivo General…). Las ubicaciones son lugares físicos y van aparte." />
          </h1>
          <p class="page-sub">
            El usuario final pertenece a un <b>área</b>, y de ahí se deducen su Dirección, su unidad
            institucional, su departamento y su zona.
          </p>
        </div>
      </div>

      <div class="grid grid-4 mb-3">
        <div class="kpi"><div class="k-num">{{ t.zonas().length }}</div><div class="k-lbl">Zonas</div></div>
        <div class="kpi"><div class="k-num">{{ t.departamentosActivos().length }}</div><div class="k-lbl">Departamentos</div></div>
        <div class="kpi"><div class="k-num">{{ t.direccionesRegistro().length }}</div><div class="k-lbl">Direcciones/Registros (sedes)</div></div>
        <div class="kpi"><div class="k-num">{{ t.usuariosFinales().length }}</div><div class="k-lbl">Usuarios finales registrados</div></div>
      </div>

      <!-- Recorrido descendente: la jerarquía tal como la dibuja el DER. -->
      <div class="card mb-3">
        <div class="card-head">
          <div>
            <h2>Recorrido de la jerarquía</h2>
            <p class="sub">Zona → Departamento → Dirección → Área → Usuario final</p>
          </div>
        </div>
        <div class="card-body">
          <div class="arbol">
            <div class="col">
              <header>Zona <small>ZONA</small></header>
              <ul>
                @for (z of t.zonasOrdenadas(); track z.id) {
                  <li>
                    <button type="button" [class.sel]="zonaSel() === z.id" (click)="elegirZona(z.id)">
                      {{ z.nombre }}
                      <span>{{ t.departamentosDe(z.id).length }} departamentos</span>
                    </button>
                  </li>
                }
              </ul>
            </div>

            <div class="col">
              <header>Departamento <small>DEPARTAMENTO</small></header>
              @if (departamentos().length) {
                <ul>
                  @for (d of departamentos(); track d.id) {
                    <li>
                      <button type="button" [class.sel]="departamentoSel() === d.id" (click)="elegirDepartamento(d.id)">
                        {{ d.nombre }}
                        <span>{{ t.registrosDe(d.id).length }} sedes</span>
                      </button>
                    </li>
                  }
                </ul>
              } @else { <p class="vacio">Elija una zona.</p> }
            </div>

            <div class="col">
              <header>Dirección / Registro <small>DIRECCION · clasificada por CATALOGO_UNIDAD</small></header>
              @if (direcciones().length) {
                <ul>
                  @for (r of direcciones(); track r.id) {
                    <li>
                      <button type="button" [class.sel]="direccionSel() === r.id" (click)="elegirDireccion(r.id)">
                        {{ r.nombre }}
                        <span>Unidad: {{ t.unidadDeDireccion(r.id)?.corta || r.corta }} · {{ t.areasDeDireccion(r.id).length }} áreas</span>
                      </button>
                    </li>
                  }
                </ul>
              } @else { <p class="vacio">Elija un departamento.</p> }
            </div>

            <div class="col">
              <header>Área <small>AREA_UNIDAD · clasificada por CATALOGO_AREA</small></header>
              @if (areas().length) {
                <ul>
                  @for (a of areas(); track a.id) {
                    <li>
                      <button type="button" [class.sel]="areaSel() === a.id" (click)="areaSel.set(a.id); usuarioSel.set('')">
                        {{ t.areaCatalogo(a.areaCatalogoId)?.nombre || a.nombreEspecifico }}
                        <span>{{ t.usuariosFinalesDeArea(a.id).length }} usuarios finales</span>
                      </button>
                    </li>
                  }
                </ul>
              } @else { <p class="vacio">Elija una Dirección/Registro.</p> }
            </div>

            <div class="col">
              <header>Usuario final <small>USUARIO_FINAL</small></header>
              @if (areaSel()) {
                @if (usuarios().length) {
                  <ul>
                    @for (u of usuarios(); track u.id) {
                      <li>
                        <button type="button" [class.sel]="usuarioSel() === u.id" (click)="usuarioSel.set(u.id)">
                          {{ u.nombre }}
                          <span>{{ u.puesto }} · carné {{ u.carne }}</span>
                        </button>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="vacio">
                    Esta área no tiene usuarios finales registrados. No es un error: el usuario final entra al
                    catálogo cuando recibe un equipo, no antes.
                  </p>
                }
              } @else { <p class="vacio">Elija un área.</p> }
            </div>
          </div>
        </div>
      </div>

      <!-- Recorrido ascendente: la cadena completa desde la persona. -->
      @if (cadena(); as c) {
        @if (c.usuarioFinal) {
          <div class="card mb-3">
            <div class="card-head">
              <div>
                <h2>Cadena del usuario final</h2>
                <p class="sub">El recorrido completo del DER, leído desde la persona hacia arriba</p>
              </div>
            </div>
            <div class="card-body">
              <div class="cadena mb-3">
                <div class="paso"><b>Usuario final</b>{{ c.usuarioFinal.nombre }}</div>
                <ui-icon name="chevron" [size]="14" />
                <div class="paso"><b>Área</b>{{ c.areaCatalogo?.nombre || c.areaUnidad?.nombreEspecifico || '—' }}</div>
                <ui-icon name="chevron" [size]="14" />
                <div class="paso"><b>Dirección</b>{{ c.direccion?.nombre || '—' }}</div>
                <ui-icon name="chevron" [size]="14" />
                <div class="paso"><b>Unidad</b>{{ c.unidad?.nombre || '—' }}</div>
                <ui-icon name="chevron" [size]="14" />
                <div class="paso"><b>Departamento</b>{{ c.departamento?.nombre || '—' }}</div>
                <ui-icon name="chevron" [size]="14" />
                <div class="paso"><b>Zona</b>{{ c.zona?.nombre || '—' }}</div>
              </div>

              <div class="datos mb-3">
                <div><span>Carné</span><b class="mono">{{ c.usuarioFinal.carne || '—' }}</b></div>
                <div><span>Puesto</span><b>{{ c.usuarioFinal.puesto || '—' }}</b></div>
                <div><span>Correo institucional</span><b>{{ c.usuarioFinal.email || '—' }}</b></div>
                <div><span>Teléfono</span><b>{{ c.usuarioFinal.telefono || '—' }}</b></div>
                <div><span>Sede</span><b>{{ c.direccion?.nombreSede || '—' }}</b></div>
                <div><span>Dirección física</span><b>{{ c.direccion?.direccionFisica || '—' }}</b></div>
              </div>

              <h3 class="mb-2">Equipos asignados hoy a esta persona</h3>
              @if (equiposDelUsuario().length) {
                <div class="table-wrap">
                  <table class="tbl">
                    <thead>
                      <tr><th>Inventario</th><th>Equipo</th><th>Ciclo</th><th>Expediente único</th><th>Expediente técnico</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      @for (a of equiposDelUsuario(); track a.expediente) {
                        <tr>
                          <td class="mono main-cell">{{ a.equipoInventario }}</td>
                          <td>{{ data.equipoDe(a.equipoInventario)?.marca }} {{ data.equipoDe(a.equipoInventario)?.modelo }}</td>
                          <td class="mono">{{ a.ciclo || '—' }}</td>
                          <td class="mono">{{ a.expedienteUnico || '—' }}</td>
                          <td class="mono">{{ a.responsablesFase.expedienteTecnico || '—' }}</td>
                          <td><ui-badge [estado]="a.estado" /></td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <p class="muted">Sin equipos asignados vigentes.</p>
              }
            </div>
          </div>
        }
      }

      <!-- Ubicaciones: lugares físicos, nunca unidades institucionales. -->
      <div class="card">
        <div class="card-head">
          <div>
            <h2>
              Ubicaciones físicas
              <ui-help texto="El DER reserva UBICACION para lugares concretos: bodegas, talleres, salas técnicas y oficinas. Una Dirección/Registro no es una ubicación: es una unidad institucional." />
            </h2>
            <p class="sub">Dónde puede estar físicamente un equipo. No clasifican unidades institucionales.</p>
          </div>
        </div>
        <div class="card-body table-wrap">
          <table class="tbl">
            <thead><tr><th>Ubicación</th><th>Tipo</th><th>Sede</th><th>Descripción</th><th>Equipos aquí</th></tr></thead>
            <tbody>
              @for (u of t.ubicaciones(); track u.id) {
                <tr>
                  <td class="main-cell">{{ u.nombre }}</td>
                  <td><ui-badge [estado]="u.tipo" /></td>
                  <td>
                    @if (u.direccionId) { {{ t.nombreRegistro(u.direccionId) }} }
                    @else { <span class="muted">Institucional (sin sede)</span> }
                  </td>
                  <td class="sub-cell">{{ u.descripcion }}</td>
                  <td class="mono">{{ equiposEn(u.id) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class EstructuraOrganizativaComponent {
  protected readonly data = inject(DataService);
  protected readonly t = inject(TerritorioService);

  protected readonly zonaSel = signal('');
  protected readonly departamentoSel = signal('');
  protected readonly direccionSel = signal('');
  protected readonly areaSel = signal('');
  protected readonly usuarioSel = signal('');

  protected readonly departamentos = computed(() =>
    this.zonaSel() ? this.t.departamentosDe(this.zonaSel()) : []);
  protected readonly direcciones = computed<DireccionRegistro[]>(() =>
    this.departamentoSel() ? this.t.registrosDe(this.departamentoSel()) : []);
  protected readonly areas = computed<AreaUnidad[]>(() =>
    this.direccionSel() ? this.t.areasDeDireccion(this.direccionSel()) : []);
  protected readonly usuarios = computed<UsuarioFinal[]>(() =>
    this.areaSel() ? this.t.usuariosFinalesDeArea(this.areaSel()) : []);

  /** La cadena se arma desde la persona cuando hay una elegida, y desde el área cuando no. */
  protected readonly cadena = computed(() =>
    this.usuarioSel() ? this.t.cadenaDeUsuarioFinal(this.usuarioSel()) : {});

  /** Asignaciones vigentes de la persona elegida, comparadas por ID de usuario final. */
  protected readonly equiposDelUsuario = computed(() => {
    const id = this.usuarioSel();
    if (!id) return [];
    const uf = this.t.usuarioFinal(id);
    return this.data.asignaciones().filter((a) =>
      a.vigente && (a.usuarioFinalId === id || (!a.usuarioFinalId && !!uf && a.usuarioFinal === uf.nombre)));
  });

  // Cada nivel limpia los de abajo: si se cambia de zona, el departamento anterior ya no aplica.
  protected elegirZona(id: string): void {
    this.zonaSel.set(id);
    this.departamentoSel.set('');
    this.direccionSel.set('');
    this.areaSel.set('');
    this.usuarioSel.set('');
  }
  protected elegirDepartamento(id: string): void {
    this.departamentoSel.set(id);
    this.direccionSel.set('');
    this.areaSel.set('');
    this.usuarioSel.set('');
  }
  protected elegirDireccion(id: string): void {
    this.direccionSel.set(id);
    this.areaSel.set('');
    this.usuarioSel.set('');
  }

  /** Cuántos equipos están hoy físicamente en esa ubicación. */
  protected equiposEn(ubicacionId: string): number {
    return this.data.equipos().filter((e) => e.ubicacionActualId === ubicacionId).length;
  }
}
