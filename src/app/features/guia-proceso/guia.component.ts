import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { rolesDeRuta } from '../../core/config/permisos';
import { Equipo } from '../../core/models/models';
import { BadgeComponent, HelpTipComponent } from '../../shared/ui';
import { IconComponent } from '../../shared/icon';

type EstadoPaso = 'Pendiente' | 'En proceso' | 'Finalizado' | 'Bloqueado' | 'Disponible' | 'Reingresado' | 'Cerrado' | 'No aplica';

interface Paso {
  n: number;
  titulo: string;
  estado: EstadoPaso;
  detalle: string;
  ruta: string;
  accion: string;
}

interface AccesoRapido {
  titulo: string;
  ruta: string;
}

/**
 * Guía del proceso (modo demostración): muestra el flujo completo del sistema —del ingreso
 * al Inventario de Hardware hasta el Servicio de garantía— como stepper con el estado real
 * de cada paso para el equipo seleccionado. Los accesos rápidos y los botones de cada paso
 * respetan los permisos por rol (misma tabla que el menú y los guards).
 */
@Component({
  selector: 'app-guia-proceso',
  imports: [RouterLink, BadgeComponent, HelpTipComponent, IconComponent],
  styles: `
    .buscador { position: relative; max-width: 520px; }
    .buscador .lupa { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--tx-3); font-size: 14px; }
    .buscador input { padding-left: 34px; }
    .eq-chip {
      display: inline-flex; flex-direction: column; align-items: flex-start; gap: 1px;
      border: 1px solid var(--line-strong); border-radius: 10px; padding: 6px 12px; margin: 4px 8px 0 0;
      background: var(--surface); cursor: pointer; font-family: var(--font); text-align: left;
    }
    .eq-chip:hover { border-color: var(--blue-600); }
    .eq-chip.on { border-color: var(--gold-500); background: var(--gold-100); }
    .eq-chip .e-inv { font-family: var(--font-mono, monospace); font-size: 12px; font-weight: 700; color: var(--navy-900); }
    .eq-chip .e-eq { font-size: 11px; color: var(--tx-3); }
    .paso { display: flex; gap: 14px; position: relative; padding-bottom: 18px; }
    .paso:last-child { padding-bottom: 0; }
    .paso::before { content: ''; position: absolute; left: 15px; top: 34px; bottom: 2px; width: 2px; background: var(--line); }
    .paso:last-child::before { display: none; }
    .p-num {
      flex: none; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center;
      font-size: 13px; font-weight: 700; border: 2px solid var(--line-strong); color: var(--tx-3); background: var(--surface); z-index: 1;
    }
    .paso.fin .p-num { border-color: var(--ok); color: var(--ok); background: var(--ok-bg); }
    .paso.curso .p-num { border-color: var(--blue-600); color: var(--blue-600); background: var(--blue-050); }
    .p-body { flex: 1; min-width: 0; display: flex; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
    .p-info { flex: 1; min-width: 200px; }
    .p-tit { font-size: 13.5px; font-weight: 700; color: var(--navy-900); }
    .p-det { font-size: 12px; color: var(--tx-3); margin-top: 2px; }
    .acc-rap { display: flex; flex-wrap: wrap; gap: 8px; }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Entrada y disponibilidad</div>
          <h1>
            Guía del proceso
            <ui-help texto="Modo demostración: recorra el flujo completo del sistema, desde el ingreso del equipo al Inventario de Hardware hasta el Servicio de garantía. Cada paso muestra su estado real para el equipo seleccionado y los accesos respetan los permisos de su rol." />
          </h1>
          <p class="page-sub">Demostración del flujo completo con el estado real de cada paso.</p>
        </div>
      </div>

      <!-- Accesos rápidos del rol conectado -->
      <div class="card card-pad mb-3">
        <div class="sec-title" style="margin-bottom: 8px;">Accesos rápidos de su rol</div>
        <div class="acc-rap">
          @for (a of accesos(); track a.ruta) {
            <a class="btn btn-outline btn-sm" [routerLink]="a.ruta">{{ a.titulo }}</a>
          }
        </div>
        <span class="hint">Solo se muestran los módulos permitidos para su rol; el resto del flujo se demuestra cambiando de usuario.</span>
      </div>

      <!-- Selección del equipo a recorrer -->
      <div class="card card-pad mb-3">
        <div class="sec-title" style="margin-bottom: 8px;">Equipo a recorrer</div>
        <div class="buscador mb-1">
          <span class="lupa"><ui-icon name="search" [size]="15" /></span>
          <input class="control" placeholder="Buscar por inventario, marca, modelo, expediente o usuario final…"
            [value]="q()" (input)="buscar($event)" />
        </div>
        @for (e of resultados(); track e.inventario) {
          <button class="eq-chip" [class.on]="e.inventario === equipoSel()?.inventario" (click)="seleccionar(e)">
            <span class="e-inv">{{ e.inventario }}</span>
            <span class="e-eq">{{ e.marca }} {{ e.modelo }} · {{ e.tipo }} {{ e.condicion.toLowerCase() }}</span>
          </button>
        } @empty {
          <p class="muted small">
            @if (auth.esTecnico()) {
              No hay equipos de procesos donde usted participe que coincidan con la búsqueda.
            } @else {
              Ningún equipo coincide con la búsqueda.
            }
          </p>
        }
        @if (auth.esTecnico()) {
          <span class="hint">Vista limitada por rol: solo los equipos de procesos donde usted participa.</span>
        }
      </div>

      <!-- Stepper del flujo completo -->
      @if (equipoSel(); as eq) {
        <div class="card">
          <div class="card-head">
            <div>
              <h2>Flujo del equipo {{ eq.inventario }}</h2>
              <p class="sub">{{ eq.marca }} {{ eq.modelo }} · {{ eq.tipo }} {{ eq.condicion.toLowerCase() }}</p>
            </div>
            <ui-badge [estado]="data.estadoPreparacionEquipo(eq.inventario)" />
          </div>
          <div class="card-body">
            @for (p of pasos(); track p.n) {
              <div class="paso" [class.fin]="p.estado === 'Finalizado'" [class.curso]="p.estado === 'En proceso' || p.estado === 'Disponible'">
                <span class="p-num">@if (p.estado === 'Finalizado') { <ui-icon name="check" [size]="13" /> } @else { {{ p.n }} }</span>
                <div class="p-body">
                  <div class="p-info">
                    <div class="p-tit">{{ p.titulo }}</div>
                    <div class="p-det">{{ p.detalle }}</div>
                  </div>
                  <ui-badge [estado]="p.estado" />
                  @if (p.estado !== 'Bloqueado' && permitido(p.ruta)) {
                    <a class="btn btn-ghost btn-sm" [routerLink]="p.ruta">{{ p.accion }}</a>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="card card-pad">
          <p class="muted">Seleccione un equipo para recorrer su flujo completo.</p>
        </div>
      }
    </div>
  `
})
export class GuiaProcesoComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);

  protected readonly q = signal('');
  protected readonly seleccionInv = signal('');

  /** Equipos que el rol puede recorrer: Encargados/Admin según su alcance; técnicos, solo donde participan. */
  protected readonly equiposVisibles = computed<Equipo[]>(() => {
    if (!this.auth.esTecnico()) return this.data.equiposConRecorrido();
    const nombre = this.auth.usuario()?.nombre ?? '';
    return this.data.equipos().filter((e) => {
      const tec = this.data.expTecnicoDeEquipo(e.inventario);
      if (tec && (tec.tecnicoPreparacion.includes(nombre) || tec.creadoPor.includes(nombre))) return true;
      const asig = this.data.asignacionDeEquipo(e.inventario);
      return !!asig && this.data.participaEnProceso(asig.expediente, nombre);
    });
  });

  protected readonly resultados = computed<Equipo[]>(() => {
    const q = this.q().toLowerCase().trim();
    const lista = this.equiposVisibles();
    if (!q) return lista.slice(0, 8);
    return lista.filter((e) => {
      const asig = this.data.asignacionDeEquipo(e.inventario);
      const texto = [
        e.inventario, e.marca, e.modelo, e.tipo, e.expediente,
        this.data.expTecnicoDeEquipo(e.inventario)?.codigo, asig?.expediente, asig?.usuarioFinal
      ].filter(Boolean).join(' ').toLowerCase();
      return texto.includes(q);
    }).slice(0, 8);
  });

  protected readonly equipoSel = computed<Equipo | undefined>(() => {
    const lista = this.resultados();
    return lista.find((e) => e.inventario === this.seleccionInv()) ?? lista[0];
  });

  protected buscar(ev: Event): void {
    this.q.set((ev.target as HTMLInputElement).value);
  }
  protected seleccionar(e: Equipo): void {
    this.seleccionInv.set(e.inventario);
  }

  /** Un módulo es accesible si la tabla de permisos lo permite para la clave conectada. */
  protected permitido(ruta: string): boolean {
    const clave = this.auth.usuario()?.clave;
    const roles = rolesDeRuta(ruta);
    return !roles || (!!clave && roles.includes(clave));
  }

  protected readonly accesos = computed<AccesoRapido[]>(() => {
    const todos: AccesoRapido[] = [
      { titulo: 'Ingresar equipo', ruta: '/inventario-hardware' },
      { titulo: 'Crear Expediente técnico', ruta: '/expediente-tecnico' },
      { titulo: 'Continuar preparación F0288', ruta: '/preparacion-tecnica' },
      { titulo: 'Asignar equipo', ruta: '/expediente-unico' },
      { titulo: 'Crear Expediente único', ruta: '/expediente-unico' },
      { titulo: 'Continuar Configuración F0302', ruta: '/configuracion' },
      { titulo: 'Entrega y conformidad', ruta: '/entrega-aceptacion' },
      { titulo: 'Servicio de garantía', ruta: '/garantia' },
      { titulo: 'Generador de documentos', ruta: '/generador-documentos' },
      { titulo: 'Trazabilidad', ruta: '/trazabilidad' }
    ];
    return todos.filter((a) => this.permitido(a.ruta));
  });

  /** Los 10 pasos del flujo con su estado real, derivado de los datos del equipo seleccionado. */
  protected readonly pasos = computed<Paso[]>(() => {
    const eq = this.equipoSel();
    if (!eq) return [];
    const inv = eq.inventario;
    const tec = this.data.expTecnicoDeEquipo(inv);
    const prep = tec ? this.data.preparacionPorCodigo(tec.codigo) : undefined;
    const preparado = this.data.estadoPreparacionEquipo(inv) === 'Preparado';
    const asig = this.data.asignacionDeEquipo(inv);
    const id = asig?.expediente ?? eq.expediente;
    const sol = id ? this.data.solicitud(id) : undefined;
    const unico = id ? this.data.expedienteUnicoDe(id) : undefined;
    const conf = id ? this.data.configuracionDe(id) : undefined;
    const conformidad = id ? this.data.conformidades().find((c) => c.expediente === id) : undefined;
    const gar = id ? this.data.garantiaDe(id) : undefined;
    const descargo = this.data.ultimoDescargo(inv);
    const ingresos = this.data.ingresosDeEquipo(inv);
    const reingreso = ingresos.find((i) => i.motivoIngreso !== 'Preparación inicial');
    const tecs = this.data.expedientesTecnicosDeEquipo(inv);
    const nuevoTec = tecs.length > 1 ? tecs[0] : undefined;
    const nuevaPrep = nuevoTec ? this.data.preparacionPorCodigo(nuevoTec.codigo) : undefined;

    return [
      {
        n: 1, titulo: 'Inventario de Hardware', estado: 'Finalizado',
        detalle: `Equipo ingresado${eq.fechaIngreso ? ' el ' + eq.fechaIngreso : ''}${eq.ingresadoPor ? ' por ' + eq.ingresadoPor : ''}.`,
        ruta: '/inventario-hardware', accion: 'Ver inventario'
      },
      {
        n: 2, titulo: 'Expediente técnico',
        estado: tec ? 'Finalizado' : 'Disponible',
        detalle: tec ? `${tec.codigo} · ${tec.tipoExpediente} · creado el ${tec.fecha}.` : 'El equipo aún no tiene Expediente técnico: puede crearlo un Encargado.',
        ruta: '/expediente-tecnico', accion: tec ? 'Ver expediente' : 'Crear Expediente técnico'
      },
      {
        n: 3, titulo: 'Preparación técnica F0288',
        estado: prep ? (prep.estado === 'Completada' ? 'Finalizado' : 'En proceso') : (tec ? 'Pendiente' : 'Bloqueado'),
        detalle: prep
          ? (prep.estado === 'Completada'
              ? `F0288 generado y firmado por ${prep.tecnico}${prep.firma.fecha ? ' el ' + prep.firma.fecha : ''}.`
              : `Checklist en curso · técnico ${prep.tecnico}.`)
          : 'Se habilita al crear el Expediente técnico.',
        ruta: '/preparacion-tecnica', accion: prep?.estado === 'Completada' ? 'Ver F0288' : 'Continuar F0288'
      },
      {
        n: 4, titulo: 'Equipo preparado',
        estado: preparado ? 'Finalizado' : (prep ? 'Pendiente' : 'Bloqueado'),
        detalle: preparado ? 'El equipo quedó preparado y disponible para asignación.' : 'Se marca automáticamente al generar el F0288.',
        ruta: '/inventario-hardware', accion: 'Ver estado'
      },
      {
        n: 5, titulo: 'Solicitud / requerimiento',
        estado: sol ? 'Finalizado' : (preparado ? 'Disponible' : 'Bloqueado'),
        detalle: sol ? `${this.data.tipoRequerimientoTexto(sol)} · ${sol.destinatario} (${sol.unidadDestino}).` : 'El equipo preparado espera una solicitud para asignarse.',
        ruta: '/solicitudes', accion: 'Ver solicitudes'
      },
      {
        n: 6, titulo: 'Asignación de equipo',
        estado: asig ? 'Finalizado' : (preparado ? 'Disponible' : 'Bloqueado'),
        detalle: asig ? `Asignado a ${asig.usuarioFinal} el ${asig.fecha}.` : 'Un Encargado asigna el equipo preparado a la solicitud.',
        ruta: '/expediente-unico', accion: asig ? 'Ver asignación' : 'Crear Expediente único'
      },
      {
        n: 7, titulo: 'Expediente único',
        estado: unico ? 'Finalizado' : (asig ? 'Disponible' : 'Bloqueado'),
        detalle: unico ? `${unico.codigoUnico} · ${unico.resumenEstado}.` : 'El Encargado de Soporte crea el Expediente único del proceso.',
        ruta: '/expediente-unico', accion: unico ? 'Ver expediente único' : 'Crear Expediente único'
      },
      {
        n: 8, titulo: 'Configuración F0302',
        estado: conf ? (conf.estado === 'Completada' ? 'Finalizado' : 'En proceso') : (unico ? 'Pendiente' : 'Bloqueado'),
        detalle: conf
          ? (conf.estado === 'Completada' ? `F0302 generado y firmado por ${conf.tecnico}.` : `Checklist en curso · técnico ${conf.tecnico}.`)
          : 'Se habilita al crear el Expediente único.',
        ruta: '/configuracion', accion: conf?.estado === 'Completada' ? 'Ver F0302' : 'Continuar F0302'
      },
      {
        n: 9, titulo: 'Entrega y aceptación',
        estado: conformidad
          ? (conformidad.estado === 'Aceptado' ? 'Finalizado' : 'En proceso')
          : (conf?.estado === 'Completada' ? 'Disponible' : 'Bloqueado'),
        detalle: conformidad
          ? (conformidad.estado === 'Aceptado'
              ? `Aceptado por ${conformidad.usuarioFinal} con firma de conformidad simulada.`
              : conformidad.estado === 'No conforme'
                ? 'Inconformidad registrada: sin firma de aceptación, pendiente de revisión.'
                : 'Formulario de conformidad enviado; pendiente de respuesta del usuario final.')
          : 'Se habilita al generar el F0302.',
        ruta: '/entrega-aceptacion', accion: 'Ver entrega'
      },
      {
        n: 10, titulo: 'Servicio de garantía',
        estado: gar ? 'Finalizado' : 'Bloqueado',
        detalle: gar
          ? `${this.data.garantiaVencida(gar) ? 'Garantía vencida' : gar.estado} · ${gar.fechaInicio} → ${gar.fechaVencimiento} · ${gar.casos.length} caso(s).`
          : 'Inicia automáticamente cuando el usuario final acepta el equipo.',
        ruta: '/garantia', accion: 'Ver garantía'
      },
      {
        n: 11, titulo: 'Descargo, si aplica',
        estado: descargo ? 'Finalizado' : (gar ? 'Disponible' : 'No aplica'),
        detalle: descargo
          ? `Descargado el ${descargo.fechaDescargo} · ${descargo.motivoDescargo} · acción: ${descargo.accionPosterior}.`
          : 'No se ha registrado un descargo para este equipo.',
        ruta: '/descargo', accion: descargo ? 'Ver descargo' : 'Registrar descargo'
      },
      {
        n: 12, titulo: 'Reingreso a Hardware, si aplica',
        estado: reingreso ? 'Reingresado' : 'No aplica',
        detalle: reingreso
          ? `Reingresado el ${reingreso.fechaIngreso} · ${reingreso.motivoIngreso}.`
          : 'No aplica: no hubo descargo con reingreso a Hardware.',
        ruta: '/inventario-hardware', accion: 'Ver inventario'
      },
      {
        n: 13, titulo: 'Nueva preparación, si aplica',
        estado: nuevoTec ? (nuevaPrep?.estado === 'Completada' ? 'Finalizado' : 'En proceso') : (reingreso ? 'Disponible' : 'No aplica'),
        detalle: nuevoTec
          ? `${nuevoTec.codigo} · ${nuevoTec.tipoExpediente}.`
          : 'No aplica: sin reingreso posterior al primer ciclo.',
        ruta: nuevoTec ? '/preparacion-tecnica' : '/expediente-tecnico',
        accion: nuevoTec ? 'Ver preparación' : 'Crear Expediente técnico'
      }
    ];
  });
}
