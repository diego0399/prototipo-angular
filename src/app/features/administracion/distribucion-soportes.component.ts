import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { DistribucionSoporte } from '../../core/models/models';
import { etiquetaRoles } from '../../core/models/roles';
import { BadgeComponent, HelpTipComponent } from '../../shared/ui';
import { IconComponent } from '../../shared/icon';
import { URL_CONTROLES_MENSUALES } from '../../core/config/modulos';

/** Una fila territorial: un ámbito de distribución con quién responde por él. */
interface FilaAmbito {
  clave: string;
  zona: string;
  zonaId: string;
  departamentoId: string;
  departamento: string;
  ambito: string;
  tipo: 'Departamento' | 'Dirección/Registro';
  porDireccion: boolean;
  /** Direcciones/Registros que el ámbito cubre; en un departamento completo, todas las suyas. */
  alcance: string[];
  asignaciones: DistribucionSoporte[];
  equipos: number;
  solicitudes: number;
}

/**
 * Distribución de Soportes — **vista de consulta** del ecosistema.
 *
 * La distribución es un registro compartido con una sola fuente de escritura: se administra en
 * **SISGOST — Controles Mensuales** y este módulo la CONSUME. Aquí se muestra tal como la aplica
 * Gestión de Equipos, que es lo que hay que poder verificar antes de crear un Expediente único:
 * qué técnicos pueden configurar el equipo de un requerimiento y quién quedará como soporte
 * responsable cuando el usuario final acepte.
 *
 * ## La regla territorial
 *
 * · En **San Salvador** la distribución es por **Dirección/Registro**: al crear el expediente
 *   único solo aparecen los técnicos asignados a ese Registro.
 * · En **los demás departamentos** es por **Departamento**: aparece el responsable del
 *   departamento aunque nunca se le haya asignado ese Registro en particular.
 *
 * Editar desde aquí abriría una segunda fuente de escritura sobre el mismo registro compartido,
 * que es exactamente lo que la regla del ecosistema evita. Por eso las acciones llevan a
 * Controles Mensuales en lugar de duplicarse.
 */
@Component({
  selector: 'app-distribucion-soportes',
  imports: [FormsModule, BadgeComponent, HelpTipComponent, IconComponent],
  styles: `
    .filtros { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
    @media (max-width: 1000px) { .filtros { grid-template-columns: repeat(2, 1fr); } }
    .zona-h {
      display: flex; align-items: baseline; gap: 10px; margin: 18px 0 8px;
      padding-bottom: 6px; border-bottom: 2px solid var(--gold-500);
    }
    .zona-h h2 { margin: 0; font-size: 15px; color: var(--navy-900); }
    .zona-h .n { font-size: 12px; color: var(--tx-3); }
    .sin-tec { font-size: 12.5px; color: var(--danger, #b3261e); font-weight: 600; }
    .alcance { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; }
    .mini { font-size: 11.5px; color: var(--tx-3); }
    .resp-lista { display: grid; gap: 3px; }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Sistema</div>
          <h1>
            Distribución de Soportes por Departamento y Dirección/Registro
            <ui-help texto="Define qué Técnico de Soporte responde por cada Departamento o Dirección/Registro. De aquí salen los técnicos que pueden ser Técnico de Configuración de un requerimiento y el soporte responsable del equipo una vez aceptado." />
          </h1>
          <p class="page-sub">
            En San Salvador la responsabilidad es por Dirección/Registro; en los demás departamentos,
            por Departamento completo.
          </p>
        </div>
        <a class="btn btn-outline" [href]="urlControles">
          <ui-icon name="external" [size]="13" /> Administrar en Controles Mensuales
        </a>
      </div>

      <div class="alert mb-2">
        <span class="alert-ico">i</span>
        <span>
          <b>La distribución se administra en SISGOST — Controles Mensuales.</b>
          Es un registro compartido por los dos módulos: allí se asignan y desactivan los responsables,
          y aquí se aplica —al crear el Expediente único solo pueden recibir equipos para configurar
          los técnicos que responden por el requerimiento—. Esta pantalla es de consulta y se
          actualiza sola: no hay ningún botón de sincronizar.
        </span>
      </div>

      @if (sinResponsable().length) {
        <div class="alert warn mb-3">
          <span class="alert-ico">!</span>
          <span>
            <b>{{ sinResponsable().length }} ámbito(s) sin Técnico de Soporte responsable.</b>
            No se podrá crear el Expediente único de sus requerimientos hasta asignar uno:
            {{ textoSinResponsable() }}.
          </span>
        </div>
      }

      <div class="card mb-3">
        <div class="card-head">
          <div>
            <h2>Mapa territorial</h2>
            <p class="sub">{{ filas().length }} ámbito(s) · {{ conResponsable() }} con responsable</p>
          </div>
        </div>
        <div class="card-body">
          <div class="filtros">
            <select class="control" [(ngModel)]="fZona" (ngModelChange)="fDepartamento.set('')">
              <option value="">Zona: todas</option>
              @for (z of data.territorio.zonasOrdenadas(); track z.id) { <option [value]="z.id">{{ z.nombre }}</option> }
            </select>
            <select class="control" [(ngModel)]="fDepartamento">
              <option value="">Departamento: todos</option>
              @for (d of departamentosFiltro(); track d.id) { <option [value]="d.id">{{ d.nombre }}</option> }
            </select>
            <select class="control" [(ngModel)]="fTecnico">
              <option value="">Técnico de Soporte: todos</option>
              @for (t of data.tecnicosSoporteConCarga(); track t.nombreRol) {
                <option [value]="t.usuario.usuario">{{ t.usuario.nombre }}</option>
              }
            </select>
            <select class="control" [(ngModel)]="fEstado">
              <option value="">Estado: todos</option>
              <option value="activo">Con responsable</option>
              <option value="inactivo">Sin responsable</option>
            </select>
          </div>

          @for (g of porZona(); track g.zonaId) {
            <div class="zona-h">
              <h2>{{ g.zona }}</h2>
              <span class="n">{{ g.filas.length }} ámbito(s)</span>
            </div>
            <div class="table-wrap">
              <table class="tbl">
                <thead>
                  <tr>
                    <th>Departamento</th><th>Dirección/Registro</th><th>Tipo de asignación</th>
                    <th>Técnico responsable</th><th>Roles del técnico</th><th>Desde</th>
                    <th>Equipos activos</th><th>Requerimientos</th><th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  @for (f of g.filas; track f.clave) {
                    <tr>
                      <td class="main-cell">{{ f.departamento }}</td>
                      <td>
                        {{ f.ambito }}
                        @if (!f.porDireccion) {
                          <div class="mini">Cubre {{ f.alcance.length }} Direcciones/Registros</div>
                          <div class="alcance">
                            @for (r of f.alcance; track r) { <span class="badge">{{ r }}</span> }
                          </div>
                        }
                      </td>
                      <td>{{ f.tipo }}</td>
                      <td>
                        <div class="resp-lista">
                          @for (d of f.asignaciones; track d.id) { <b>{{ soloNombre(d.tecnico) }}</b> }
                          @if (!f.asignaciones.length) { <span class="sin-tec">Sin responsable</span> }
                        </div>
                      </td>
                      <td class="mini">
                        @for (d of f.asignaciones; track d.id) { <div>{{ rolesDe(d.tecnico) }}</div> }
                        @if (!f.asignaciones.length) { <span class="muted">—</span> }
                      </td>
                      <td class="mono">
                        @for (d of f.asignaciones; track d.id) { <div>{{ d.fecha }}</div> }
                        @if (!f.asignaciones.length) { <span class="muted">—</span> }
                      </td>
                      <td class="mono">{{ f.equipos }}</td>
                      <td class="mono">{{ f.solicitudes }}</td>
                      <td><ui-badge [estado]="f.asignaciones.length ? 'Activa' : 'Sin asignar'" /></td>
                    </tr>
                  } @empty {
                    <tr><td colspan="9" class="muted" style="text-align:center; padding: 22px;">Ningún ámbito coincide con los filtros.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          } @empty {
            <p class="muted">Ningún ámbito coincide con los filtros seleccionados.</p>
          }
        </div>
      </div>

      <!-- Vista por técnico: qué atiende cada uno, con el alcance real de sus asignaciones -->
      <div class="mb-2 sec-title">Ámbitos atendidos por cada soporte</div>
      <div class="card table-wrap mb-3">
        <table class="tbl">
          <thead>
            <tr><th>Técnico de Soporte</th><th>Roles</th><th>Ámbitos asignados</th><th>Equipos activos a su cargo</th><th>Estado</th></tr>
          </thead>
          <tbody>
            @for (t of data.tecnicosSoporteConCarga(); track t.nombreRol) {
              <tr>
                <td class="main-cell">{{ t.usuario.nombre }}<div class="sub-cell">{{ t.usuario.unidad }}</div></td>
                <td class="mini">{{ etiqueta(t.usuario.roles) }}</td>
                <td>
                  @for (d of data.direccionesDeTecnico(t.nombreRol); track d.id) {
                    <div>{{ data.soportes.etiqueta(d.direccion, d.unidad) }}</div>
                  } @empty {
                    <span class="muted">No atiende ningún ámbito territorial.</span>
                  }
                </td>
                <td class="mono">{{ data.controlesDeSoporte(t.nombreRol).length }}</td>
                <td><ui-badge [estado]="t.usuario.estado" /></td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Historial: incluye las asignaciones desactivadas -->
      <div class="card table-wrap">
        <div class="card-head">
          <div>
            <h2>Registro de la distribución</h2>
            <p class="sub">Las asignaciones desactivadas no se borran: los equipos aceptados mientras estuvieron vigentes las conservan en su historial</p>
          </div>
        </div>
        <table class="tbl">
          <thead>
            <tr>
              <th>Código</th><th>Zona</th><th>Departamento</th><th>Dirección/Registro</th><th>Tipo</th>
              <th>Técnico</th><th>Asignada por</th><th>Fecha</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            @for (d of todas(); track d.id) {
              <tr [style.opacity]="d.activo ? 1 : .6">
                <td class="mono main-cell">{{ d.id }}</td>
                <td>{{ zonaDe(d) }}</td>
                <td>{{ d.direccion }}</td>
                <td>{{ d.unidad }}</td>
                <td>{{ tipoDe(d) }}</td>
                <td>{{ soloNombre(d.tecnico) }}</td>
                <td>{{ soloNombre(d.asignadoPor) }}</td>
                <td class="mono">{{ d.fecha }}</td>
                <td><ui-badge [estado]="d.activo ? 'Activa' : 'Desactivada'" /></td>
              </tr>
            } @empty {
              <tr><td colspan="9" class="muted" style="text-align:center; padding: 22px;">Aún no hay distribución registrada.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class DistribucionSoportesComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);

  protected readonly urlControles = URL_CONTROLES_MENSUALES;

  protected readonly fZona = signal('');
  protected readonly fDepartamento = signal('');
  protected readonly fTecnico = signal('');
  protected readonly fEstado = signal('');

  protected departamentosFiltro() {
    const z = this.fZona();
    const lista = this.data.territorio.departamentosActivos();
    return z ? lista.filter((d) => d.zonaId === z) : lista;
  }

  /** Un ámbito por cada fila que la regla territorial admite. */
  protected readonly filas = computed<FilaAmbito[]>(() => {
    const t = this.data.territorio;
    return t.ambitosDistribuibles()
      .map((a) => {
        const registro = a.direccionRegistroId ? t.nombreRegistro(a.direccionRegistroId) : '';
        const alcance = a.direccionRegistroId
          ? [registro]
          : t.registrosDe(a.departamentoId).map((r) => r.nombre);
        return {
          clave: `${a.departamentoId}|${a.direccionRegistroId ?? '*'}`,
          zonaId: a.zonaId,
          zona: t.nombreZona(a.zonaId),
          departamentoId: a.departamentoId,
          departamento: t.nombreDepartamento(a.departamentoId),
          ambito: registro || 'Todo el departamento',
          tipo: (a.tipo === 'DIRECCION_REGISTRO' ? 'Dirección/Registro' : 'Departamento') as FilaAmbito['tipo'],
          porDireccion: a.tipo === 'DIRECCION_REGISTRO',
          alcance,
          asignaciones: this.data.soportes.deDireccionUnidad(a.departamentoId, registro),
          equipos: this.equiposDe(a.departamentoId, registro),
          solicitudes: this.solicitudesDe(a.departamentoId, registro)
        };
      })
      .filter((f) => !this.fZona() || f.zonaId === this.fZona())
      .filter((f) => !this.fDepartamento() || f.departamentoId === this.fDepartamento())
      .filter((f) => !this.fTecnico() || f.asignaciones.some((d) => d.tecnicoId === this.idDe(this.fTecnico())))
      .filter((f) => !this.fEstado()
        || (this.fEstado() === 'activo' ? f.asignaciones.length > 0 : f.asignaciones.length === 0));
  });

  protected readonly porZona = computed(() => this.data.territorio.zonasOrdenadas()
    .map((z) => ({ zonaId: z.id, zona: z.nombre, filas: this.filas().filter((f) => f.zonaId === z.id) }))
    .filter((g) => g.filas.length > 0));

  protected readonly conResponsable = computed(() => this.filas().filter((f) => f.asignaciones.length).length);

  /** Ámbitos sin responsable **que tienen requerimientos o equipos**: los que bloquean el proceso. */
  protected readonly sinResponsable = computed(() => this.data.territorio.ambitosDistribuibles()
    .map((a) => {
      const registro = a.direccionRegistroId ? this.data.territorio.nombreRegistro(a.direccionRegistroId) : '';
      return {
        etiqueta: this.data.territorio.etiqueta(a.departamentoId, registro),
        asignaciones: this.data.soportes.deDireccionUnidad(a.departamentoId, registro).length,
        solicitudes: this.solicitudesDe(a.departamentoId, registro)
      };
    })
    .filter((a) => !a.asignaciones && a.solicitudes > 0));

  protected textoSinResponsable(): string {
    return this.sinResponsable().map((a) => a.etiqueta).join('; ');
  }

  private equiposDe(departamento: string, registro: string): number {
    const t = this.data.territorio;
    const reg = t.idRegistro(departamento, registro);
    return this.data.controles().filter((c) => c.estado === 'Activo en Dirección/Registro'
      && t.idDepartamento(c.direccion) === departamento
      && (!reg || t.idRegistro(departamento, c.unidad) === reg)).length;
  }

  private solicitudesDe(departamento: string, registro: string): number {
    const t = this.data.territorio;
    const reg = t.idRegistro(departamento, registro);
    return this.data.solicitudes().filter((s) => t.idDepartamento(s.departamentoId || s.direccionGerencia) === departamento
      && (!reg || t.idRegistro(departamento, s.direccionRegistroId || s.unidadDestino) === reg)).length;
  }

  private idDe(usuario: string): string {
    const u = this.data.usuarios().find((x) => x.usuario === usuario);
    return this.data.soportes.idTecnico(u?.nombre ?? usuario);
  }

  /** Todas las asignaciones, vigentes primero, para el registro histórico. */
  protected readonly todas = computed(() => [...this.data.distribuciones()]
    .sort((a, b) => Number(b.activo) - Number(a.activo)
      || a.direccion.localeCompare(b.direccion) || a.unidad.localeCompare(b.unidad)));

  protected soloNombre(texto: string): string { return this.data.soportes.soloNombre(texto); }

  protected zonaDe(d: DistribucionSoporte): string {
    return this.data.territorio.nombreZona(d.zonaId || this.data.territorio.zonaDe(d.departamentoId || d.direccion));
  }

  protected tipoDe(d: DistribucionSoporte): string {
    return d.tipoAsignacion === 'DIRECCION_REGISTRO' ? 'Dirección/Registro' : 'Departamento';
  }

  /** Todos los roles del técnico, no solo aquel con el que figura en la asignación. */
  protected rolesDe(tecnico: string): string {
    const id = this.data.soportes.idTecnico(tecnico);
    const u = this.data.usuarios().find((x) => this.data.soportes.idTecnico(x.nombre) === id);
    return u ? etiquetaRoles(u.roles ?? []) : this.data.soportes.rolDe(tecnico);
  }

  protected etiqueta(roles: FilaAmbito['alcance'] | string[] | undefined): string {
    return etiquetaRoles((roles ?? []) as never);
  }
}
