import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../core/services/data.service';
import { Equipo, ExpedienteTecnico, ExpedienteUnico, PreparacionF0288 } from '../core/models/models';
import { BadgeComponent, MarcaModeloPipe, ModalComponent } from './ui';

/**
 * Modales reutilizables «Buscar expediente». Se usan en todas las pantallas donde se elige un
 * Expediente único o un Expediente técnico / preparación F0288 entre varios disponibles
 * (Generador de documentos, Configuración F0302, Preparación F0288, Entrega y aceptación):
 * nunca un select largo cuando hay más de uno. Incluyen filtro por año porque la codificación
 * es dinámica por año (EXP-AÑO-#### · EXP-PT-AÑO-####) y pueden convivir expedientes de años
 * anteriores con los del año actual.
 */
export interface FilaExpedienteUnico {
  expediente: string;
  codigoUnico: string;
  solicitud: string;
  anio: string;
  inventario: string;
  usuarioFinal: string;
  estado: string;
  fase: string;
  responsable: string;
  tecnicoConfiguracion: string;
  /** Nombre del equipo (hostname) registrado en el F0302, cuando ya existe la configuración. */
  nombreEquipo: string;
  /** Reserva de IP del F0302: la IP reservada, «No aplica» o «—» si aún no se responde. */
  ipReservada: string;
}

/** Arma la fila de búsqueda de un Expediente único a partir de los datos relacionados. */
export function filaExpedienteUnico(data: DataService, x: ExpedienteUnico): FilaExpedienteUnico {
  const s = data.solicitud(x.expediente);
  const eq = s ? data.equipoDe(s.equipoInventario) : undefined;
  const asig = data.asignacionDe(x.expediente);
  const conf = data.configuracionDe(x.expediente);
  return {
    expediente: x.expediente,
    codigoUnico: x.codigoUnico,
    solicitud: x.expediente,
    anio: (x.codigoUnico.match(/\b(20\d{2})\b/) ?? [])[1] ?? '',
    inventario: eq?.inventario ?? s?.equipoInventario ?? '',
    usuarioFinal: s ? `${s.destinatario} — ${s.unidadDestino}` : '—',
    estado: x.estado,
    fase: x.resumenEstado,
    responsable: asig?.responsableAsignacion ?? '',
    tecnicoConfiguracion: conf?.tecnico ?? asig?.responsablesFase.tecnicoConfiguracion ?? '',
    nombreEquipo: conf?.datos.nombrePC ?? '',
    ipReservada: data.textoIPReservada(conf)
  };
}

@Component({
  selector: 'app-buscar-expediente-unico',
  imports: [FormsModule, BadgeComponent, ModalComponent],
  styles: `
    .busq-filtros { display: grid; grid-template-columns: 1.6fr .7fr 1fr 1fr; gap: 10px; margin-bottom: 14px; }
    @media (max-width: 800px) { .busq-filtros { grid-template-columns: 1fr 1fr; } }
  `,
  template: `
    <ui-modal [titulo]="titulo()" [sub]="sub()" (cerrar)="cerrar.emit()">
      <div class="busq-filtros">
        <input class="control" type="search" placeholder="Expediente, solicitud, inventario, nombre del equipo, IP reservada, usuario o técnico…" [(ngModel)]="q" />
        <select class="control" [(ngModel)]="fAnio">
          <option value="">Año: todos</option>
          @for (a of anios(); track a) { <option [value]="a">{{ a }}</option> }
        </select>
        <select class="control" [(ngModel)]="fEstado">
          <option value="">Estado: todos</option>
          @for (e of estados(); track e) { <option [value]="e">{{ e }}</option> }
        </select>
        <select class="control" [(ngModel)]="fFase">
          <option value="">Fase actual: todas</option>
          @for (f of fases(); track f) { <option [value]="f">{{ f }}</option> }
        </select>
      </div>
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr><th>Expediente</th><th>Solicitud</th><th>Inventario</th><th>Nombre del equipo</th><th>IP reservada</th><th>Usuario final</th><th>Técnico de configuración</th><th>Estado</th><th>Fase actual</th><th style="text-align:right;"></th></tr>
          </thead>
          <tbody>
            @for (f of resultado(); track f.expediente) {
              <tr>
                <td class="mono main-cell">{{ f.codigoUnico }}</td>
                <td class="mono">{{ f.solicitud }}</td>
                <td class="mono">{{ f.inventario || '—' }}</td>
                <td class="mono">{{ f.nombreEquipo || '—' }}</td>
                <td class="mono">{{ f.ipReservada }}</td>
                <td>{{ f.usuarioFinal || '—' }}</td>
                <td>{{ f.tecnicoConfiguracion || '—' }}</td>
                <td><ui-badge [estado]="f.estado" /></td>
                <td>{{ f.fase }}</td>
                <td>
                  <div class="row" style="justify-content: flex-end;">
                    <button class="btn btn-primary btn-sm" (click)="seleccionar.emit(f.expediente)">Seleccionar</button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="10" class="muted" style="text-align:center; padding: 22px;">No hay expedientes disponibles con esa búsqueda.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </ui-modal>
  `
})
export class BuscarExpedienteUnicoModalComponent {
  readonly filas = input.required<FilaExpedienteUnico[]>();
  readonly titulo = input('Buscar expediente');
  readonly sub = input('Busque por código, solicitud, inventario, usuario final o estado');
  readonly seleccionar = output<string>();
  readonly cerrar = output<void>();

  protected q = signal('');
  protected fAnio = signal('');
  protected fEstado = signal('');
  protected fFase = signal('');

  protected readonly anios = computed(() => [...new Set(this.filas().map((f) => f.anio).filter(Boolean))].sort().reverse());
  protected readonly estados = computed(() => [...new Set(this.filas().map((f) => f.estado))]);
  protected readonly fases = computed(() => [...new Set(this.filas().map((f) => f.fase))]);

  protected readonly resultado = computed(() => {
    const q = this.q().toLowerCase().trim();
    return this.filas().filter((f) => {
      if (this.fAnio() && f.anio !== this.fAnio()) return false;
      if (this.fEstado() && f.estado !== this.fEstado()) return false;
      if (this.fFase() && f.fase !== this.fFase()) return false;
      if (!q) return true;
      return `${f.codigoUnico} ${f.solicitud} ${f.anio} ${f.inventario} ${f.nombreEquipo} ${f.ipReservada} ${f.usuarioFinal} ${f.responsable} ${f.tecnicoConfiguracion}`
        .toLowerCase().includes(q);
    });
  });
}

/** Fila de búsqueda de un Expediente técnico o de una preparación F0288. */
export interface FilaExpedienteTecnico {
  codigo: string;
  inventario: string;
  equipo: string;
  tipoEquipo: string;
  anio: string;
  preparacion: string;
  tecnico: string;
  unidad: string;
}

export function filaExpedienteTecnico(data: DataService, t: ExpedienteTecnico): FilaExpedienteTecnico {
  const eq = data.equipoDe(t.inventario);
  return {
    codigo: t.codigo,
    inventario: t.inventario,
    equipo: eq ? `${eq.marca} ${eq.modelo}` : t.marcaModelo,
    tipoEquipo: eq?.tipo ?? t.tipoEquipo,
    anio: (t.codigo.match(/\b(20\d{2})\b/) ?? [])[1] ?? t.fecha.slice(0, 4),
    preparacion: t.estado,
    tecnico: t.tecnicoPreparacion,
    unidad: t.unidadResponsable
  };
}

/** Fila de búsqueda a partir de una preparación F0288 (mismo catálogo, estado del checklist). */
export function filaPreparacion(data: DataService, p: PreparacionF0288): FilaExpedienteTecnico {
  const eq = data.equipoDe(p.datosGenerales.inventario);
  return {
    codigo: p.expedienteTecnico,
    inventario: p.datosGenerales.inventario,
    equipo: eq ? `${eq.marca} ${eq.modelo}` : '—',
    tipoEquipo: eq?.tipo ?? '',
    anio: (p.expedienteTecnico.match(/\b(20\d{2})\b/) ?? [])[1] ?? p.fecha.slice(0, 4),
    preparacion: p.estado,
    tecnico: p.tecnico,
    unidad: p.unidad
  };
}

@Component({
  selector: 'app-buscar-expediente-tecnico',
  imports: [FormsModule, BadgeComponent, ModalComponent],
  styles: `
    .busq-filtros { display: grid; grid-template-columns: 1.6fr .7fr 1fr 1fr; gap: 10px; margin-bottom: 14px; }
    @media (max-width: 800px) { .busq-filtros { grid-template-columns: 1fr 1fr; } }
  `,
  template: `
    <ui-modal [titulo]="titulo()" [sub]="sub()" (cerrar)="cerrar.emit()">
      <div class="busq-filtros">
        <input class="control" type="search" placeholder="Código, inventario, marca, modelo, tipo o técnico…" [(ngModel)]="q" />
        <select class="control" [(ngModel)]="fAnio">
          <option value="">Año: todos</option>
          @for (a of anios(); track a) { <option [value]="a">{{ a }}</option> }
        </select>
        <select class="control" [(ngModel)]="fTecnico">
          <option value="">Técnico: todos</option>
          @for (t of tecnicos(); track t) { <option [value]="t">{{ t }}</option> }
        </select>
        <select class="control" [(ngModel)]="fPrep">
          <option value="">Preparación: todas</option>
          @for (e of preparaciones(); track e) { <option [value]="e">{{ e }}</option> }
        </select>
      </div>
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr><th>Expediente técnico</th><th>Inventario</th><th>Equipo</th><th>Año</th><th>Técnico</th><th>Preparación</th><th>Unidad</th><th style="text-align:right;"></th></tr>
          </thead>
          <tbody>
            @for (f of resultado(); track f.codigo) {
              <tr>
                <td class="mono main-cell">{{ f.codigo }}</td>
                <td class="mono">{{ f.inventario }}</td>
                <td>{{ f.equipo }}</td>
                <td class="mono">{{ f.anio }}</td>
                <td>{{ f.tecnico }}</td>
                <td><ui-badge [estado]="f.preparacion" /></td>
                <td>{{ f.unidad }}</td>
                <td>
                  <div class="row" style="justify-content: flex-end;">
                    <button class="btn btn-primary btn-sm" (click)="seleccionar.emit(f.codigo)">Seleccionar</button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="muted" style="text-align:center; padding: 22px;">No hay expedientes técnicos disponibles con esa búsqueda.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </ui-modal>
  `
})
export class BuscarExpedienteTecnicoModalComponent {
  readonly filas = input.required<FilaExpedienteTecnico[]>();
  readonly titulo = input('Buscar expediente');
  readonly sub = input('Busque por código, inventario, marca, modelo, tipo o técnico');
  readonly seleccionar = output<string>();
  readonly cerrar = output<void>();

  protected q = signal('');
  protected fAnio = signal('');
  protected fTecnico = signal('');
  protected fPrep = signal('');

  protected readonly anios = computed(() => [...new Set(this.filas().map((f) => f.anio).filter(Boolean))].sort().reverse());
  protected readonly tecnicos = computed(() => [...new Set(this.filas().map((f) => f.tecnico).filter(Boolean))]);
  protected readonly preparaciones = computed(() => [...new Set(this.filas().map((f) => f.preparacion))]);

  protected readonly resultado = computed(() => {
    const q = this.q().toLowerCase().trim();
    return this.filas().filter((f) => {
      if (this.fAnio() && f.anio !== this.fAnio()) return false;
      if (this.fTecnico() && f.tecnico !== this.fTecnico()) return false;
      if (this.fPrep() && f.preparacion !== this.fPrep()) return false;
      if (!q) return true;
      return `${f.codigo} ${f.inventario} ${f.equipo} ${f.tipoEquipo} ${f.anio} ${f.tecnico} ${f.unidad}`.toLowerCase().includes(q);
    });
  });
}

/** Fila de búsqueda de un equipo con asignación vigente (candidato a Descargo). */
export interface FilaEquipoAsignado {
  inventario: string;
  equipo: Equipo;
  usuarioFinal: string;
  responsableOperativo: string;
  fechaAsignacion: string;
}

export function filaEquipoAsignado(data: DataService, equipo: Equipo): FilaEquipoAsignado | null {
  const asig = data.asignacionDeEquipo(equipo.inventario);
  if (!asig) return null;
  // El descargo solo se habilita tras la aceptación del usuario final y la garantía habilitada.
  if (data.estadoAceptacion(asig.expediente) !== 'Aceptado' || !data.garantiaDe(asig.expediente)) return null;
  return {
    inventario: equipo.inventario,
    equipo,
    usuarioFinal: asig.usuarioFinal,
    responsableOperativo: data.responsableOperativo(equipo),
    fechaAsignacion: asig.fecha
  };
}

@Component({
  selector: 'app-buscar-equipo-asignado',
  imports: [FormsModule, BadgeComponent, MarcaModeloPipe, ModalComponent],
  styles: `
    .busq-filtros { display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin-bottom: 14px; }
    @media (max-width: 800px) { .busq-filtros { grid-template-columns: 1fr; } }
  `,
  template: `
    <ui-modal [titulo]="titulo()" [sub]="sub()" (cerrar)="cerrar.emit()">
      <div class="busq-filtros">
        <input class="control" type="search" placeholder="Inventario, marca, modelo o usuario final…" [(ngModel)]="q" />
        <select class="control" [(ngModel)]="fResponsable">
          <option value="">Responsable operativo: todos</option>
          @for (r of responsables(); track r) { <option [value]="r">{{ r }}</option> }
        </select>
      </div>
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr><th>Inventario</th><th>Equipo</th><th>Usuario final</th><th>Responsable operativo</th><th>Fecha asignación</th><th style="text-align:right;"></th></tr>
          </thead>
          <tbody>
            @for (f of resultado(); track f.inventario) {
              <tr>
                <td class="mono main-cell">{{ f.inventario }}</td>
                <td>{{ f.equipo | marcaModelo }}</td>
                <td>{{ f.usuarioFinal }}</td>
                <td><ui-badge [estado]="f.responsableOperativo" /></td>
                <td class="mono">{{ f.fechaAsignacion }}</td>
                <td>
                  <div class="row" style="justify-content: flex-end;">
                    <button class="btn btn-primary btn-sm" (click)="seleccionar.emit(f.inventario)">Seleccionar</button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="muted" style="text-align:center; padding: 22px;">No hay equipos con asignación vigente que coincidan con la búsqueda.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </ui-modal>
  `
})
export class BuscarEquipoAsignadoModalComponent {
  readonly filas = input.required<FilaEquipoAsignado[]>();
  readonly titulo = input('Buscar equipo asignado');
  readonly sub = input('Solo se muestran equipos con asignación vigente a un usuario final');
  readonly seleccionar = output<string>();
  readonly cerrar = output<void>();

  protected q = signal('');
  protected fResponsable = signal('');

  protected readonly responsables = computed(() => [...new Set(this.filas().map((f) => f.responsableOperativo))]);

  protected readonly resultado = computed(() => {
    const q = this.q().toLowerCase().trim();
    return this.filas().filter((f) => {
      if (this.fResponsable() && f.responsableOperativo !== this.fResponsable()) return false;
      if (!q) return true;
      return `${f.inventario} ${f.equipo.marca} ${f.equipo.modelo} ${f.usuarioFinal}`.toLowerCase().includes(q);
    });
  });
}
