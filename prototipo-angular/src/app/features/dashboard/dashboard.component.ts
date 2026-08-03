import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ExpedienteTecnico, PreparacionF0288 } from '../../core/models/models';
import { BadgeComponent } from '../../shared/ui';

interface FaseCount { nombre: string; corto: string; n: number; color: string; }

/**
 * Panel ejecutivo dinámico según rol: cada usuario ve solo los indicadores y accesos
 * de los módulos que le corresponden. Los técnicos ven sus tareas asignadas; los
 * Encargados, la información global de su área; el Administrador, la administración.
 */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, BadgeComponent],
  styles: `
    .saludo { font-size: 13.5px; color: var(--tx-2); }

    .etapa-card {
      display: block; text-decoration: none; border: 1px solid var(--line); border-radius: var(--r-md);
      padding: 14px 16px; background: var(--surface); transition: border-color .12s, box-shadow .12s;
    }
    .etapa-card:hover { border-color: var(--blue-500); box-shadow: var(--shadow-1); text-decoration: none; }
    .etapa-n {
      width: 22px; height: 22px; border-radius: 50%; background: var(--navy-800); color: #fff;
      font-size: 11px; font-weight: 700; display: grid; place-items: center; margin-bottom: 9px;
    }
    .etapa-tit { font-size: 12.5px; font-weight: 700; color: var(--navy-900); margin-bottom: 6px; line-height: 1.25; }
    .etapa-cifra { font-size: 24px; font-weight: 700; color: var(--navy-900); line-height: 1; font-variant-numeric: tabular-nums; }
    .etapa-lbl { font-size: 11px; color: var(--tx-3); margin-top: 3px; }

    /* Tarjeta destacada del técnico: su tarea más reciente, sin buscarla */
    .dest-card { border: 1px solid var(--gold-500); border-left: 5px solid var(--gold-500); border-radius: var(--r-md); background: var(--surface); padding: 16px 18px; }
    .d-titulo { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--gold-600); }
    .dest-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px 18px; margin-top: 10px; }
    .d-k { font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--tx-3); }
    .d-v { font-size: 13px; color: var(--navy-900); margin-top: 2px; }

    .mini-item {
      display: flex; gap: 10px; align-items: center; padding: 9px 4px; border-bottom: 1px solid var(--line);
      font-size: 12.5px; color: var(--tx-2);
    }
    .mini-item:last-child { border-bottom: 0; }
    .mini-item .mi-main { color: var(--navy-900); font-weight: 600; }
    .mini-item .mi-right { margin-left: auto; display: flex; gap: 8px; align-items: center; }
    .tec-chip {
      display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--tx-2);
      border: 1px solid var(--line); border-radius: 999px; padding: 4px 11px; background: var(--surface-2);
    }
    .tec-chip b { color: var(--navy-900); }

    /* Gráfico de barras (CSS) */
    .barras { display: grid; gap: 12px; }
    .barra-row { display: grid; grid-template-columns: 170px 1fr 34px; align-items: center; gap: 12px; font-size: 12.5px; }
    .barra-row .b-label { color: var(--tx-2); font-weight: 500; text-align: right; }
    .barra-track { height: 22px; border-radius: 7px; background: var(--surface-2); overflow: hidden; border: 1px solid var(--line); }
    .barra-fill { height: 100%; border-radius: 6px 0 0 6px; transition: width .4s; min-width: 2px; }
    .barra-row .b-n { font-weight: 700; color: var(--navy-900); font-variant-numeric: tabular-nums; }

    /* Dona (conic-gradient) */
    .dona-wrap { display: flex; gap: 26px; align-items: center; flex-wrap: wrap; }
    .dona { width: 160px; height: 160px; border-radius: 50%; position: relative; flex: none; }
    .dona::after { content: ''; position: absolute; inset: 22%; border-radius: 50%; background: var(--surface); box-shadow: inset 0 0 0 1px var(--line); }
    .dona .centro { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; z-index: 1; }
    .dona .centro b { font-size: 26px; color: var(--navy-900); line-height: 1; }
    .dona .centro span { font-size: 10.5px; color: var(--tx-3); text-transform: uppercase; letter-spacing: .06em; font-weight: 700; }
    .leyenda { display: grid; gap: 8px; font-size: 12.5px; }
    .leyenda .l-item { display: flex; align-items: center; gap: 8px; color: var(--tx-2); }
    .leyenda .l-dot { width: 10px; height: 10px; border-radius: 3px; flex: none; }
    .leyenda b { color: var(--navy-900); margin-left: auto; padding-left: 14px; font-variant-numeric: tabular-nums; }

    .acti { display: grid; gap: 0; }
    .acti-item { display: grid; grid-template-columns: 88px 1fr auto; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--line); align-items: start; font-size: 13px; }
    .acti-item:last-child { border-bottom: 0; }
    .acti-when { color: var(--tx-3); font-weight: 700; font-size: 11.5px; font-variant-numeric: tabular-nums; padding-top: 2px; }
    .acti-what { color: var(--navy-900); font-weight: 500; }
    .acti-who { color: var(--tx-3); font-size: 12px; margin-top: 1px; }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Gestión</div>
          <h1>Panel ejecutivo</h1>
          <p class="saludo">Hola, <b>{{ auth.usuario()?.nombre }}</b> — {{ subtitulo() }}</p>
        </div>
        @switch (clave()) {
          @case ('tec-hardware') { <a class="btn btn-primary" routerLink="/preparacion-tecnica">Continuar preparación F0288</a> }
          @case ('tec-soporte') { <a class="btn btn-primary" routerLink="/configuracion">Continuar Configuración F0302</a> }
          @case ('enc-hardware') { <a class="btn btn-primary" routerLink="/inventario-hardware">Inventario de Hardware</a> }
          @case ('admin') { <a class="btn btn-primary" routerLink="/administracion">Administración</a> }
          @default { <a class="btn btn-primary" routerLink="/solicitudes">Ver solicitudes</a> }
        }
      </div>

      @switch (clave()) {
        <!-- ─────────── Técnico de Hardware: solo sus preparaciones F0288 ─────────── -->
        @case ('tec-hardware') {
          @if (prepDestacada(); as p) {
            <div class="dest-card mb-2">
              <div class="d-titulo">Último expediente F0288 asignado</div>
              <div class="row-between mt-1">
                <h2 style="font-size:18px;">{{ p.expedienteTecnico }}</h2>
                <ui-badge [estado]="p.estado" />
              </div>
              <div class="dest-grid">
                <div><div class="d-k">Inventario</div><div class="d-v mono">{{ p.datosGenerales.inventario }}</div></div>
                <div><div class="d-k">Equipo</div><div class="d-v">{{ expTecDe(p)?.marcaModelo || '—' }}</div></div>
                <div><div class="d-k">Técnico asignado</div><div class="d-v">{{ p.tecnico.split('—')[0].trim() }}</div></div>
                <div><div class="d-k">Fecha de asignación</div><div class="d-v mono">{{ p.fecha }}</div></div>
              </div>
              <div class="row mt-2">
                <a class="btn btn-gold" routerLink="/preparacion-tecnica">Continuar preparación F0288</a>
              </div>
            </div>
          }
          <div class="grid grid-5 mb-2">
            <div class="kpi" style="--kpi-accent: var(--navy-800)">
              <div class="kpi-label">F0288 asignadas</div>
              <div class="kpi-value">{{ data.preparacionesVisibles().length }}</div>
              <div class="kpi-hint">Preparaciones a su cargo</div>
            </div>
            <div class="kpi" style="--kpi-accent: var(--gold-500)">
              <div class="kpi-label">Pendientes / en proceso</div>
              <div class="kpi-value">{{ prepsPendientes().length }}</div>
              <div class="kpi-hint">
                @if (prepEnCurso(); as p) { ⏱ Cronómetro en curso desde {{ p.cronometro?.horaInicio?.slice(0, 5) }} } @else { Por finalizar }
              </div>
            </div>
            <div class="kpi" style="--kpi-accent: var(--ok)">
              <div class="kpi-label">Finalizadas</div>
              <div class="kpi-value">{{ prepsFinalizadas().length }}</div>
              <div class="kpi-hint">F0288 generado</div>
            </div>
            <div class="kpi" style="--kpi-accent: var(--blue-500)">
              <div class="kpi-label">Tiempo promedio</div>
              <div class="kpi-value">{{ data.formatoDuracion(tiempoPromedioPrep()) || '—' }}</div>
              <div class="kpi-hint">De sus preparaciones finalizadas</div>
            </div>
            <div class="kpi" style="--kpi-accent: var(--warn)">
              <div class="kpi-label">Con complejidad</div>
              <div class="kpi-value">{{ prepsComplejas().length }}</div>
              <div class="kpi-hint">Nivel medio o alto registrado</div>
            </div>
          </div>
          <div class="grid grid-2 mb-2">
            <div class="card">
              <div class="card-head"><div><h2>Preparaciones pendientes</h2><p class="sub">En curso o por iniciar</p></div></div>
              <div class="card-body">
                @for (p of prepsPendientes(); track p.expedienteTecnico) {
                  <div class="mini-item">
                    <span class="mi-main mono">{{ p.expedienteTecnico }}</span>
                    <span class="mono">{{ p.datosGenerales.inventario }}</span>
                    @if (p.cronometro && p.cronometro.duracionMinutos === null) { <span class="tec-chip">⏱ en curso</span> }
                    <span class="mi-right"><ui-badge [estado]="p.estado" /><a class="btn btn-ghost btn-sm" routerLink="/preparacion-tecnica">Abrir</a></span>
                  </div>
                } @empty { <p class="muted small">No tiene preparaciones F0288 pendientes en este momento.</p> }
              </div>
            </div>
            <div class="card">
              <div class="card-head"><div><h2>Últimas preparaciones finalizadas</h2><p class="sub">Con su tiempo total y complejidad</p></div></div>
              <div class="card-body">
                @for (p of prepsFinalizadas(); track p.expedienteTecnico) {
                  <div class="mini-item">
                    <span class="mi-main mono">{{ p.expedienteTecnico }}</span>
                    <span class="mono">{{ p.firma.fecha || p.fecha }}</span>
                    @if (p.cronometro?.duracionMinutos !== null && p.cronometro) { <span class="tec-chip">⏱ <b>{{ data.formatoDuracion(p.cronometro.duracionMinutos) }}</b></span> }
                    @if (p.cierre; as ci) { <span class="tec-chip">{{ ci.nivel }}</span> }
                    <span class="mi-right"><ui-badge [estado]="'Completada'" /></span>
                  </div>
                } @empty { <p class="muted small">Aún no tiene preparaciones finalizadas.</p> }
              </div>
            </div>
          </div>
        }

        <!-- ─────────── Técnico de Soporte: sus F0302, entregas y participaciones ─────────── -->
        @case ('tec-soporte') {
          @if (auth.usuario()?.direccionAsignada) {
            <p class="small muted mt-1">Dirección asignada: <b>{{ auth.usuario()?.direccionAsignada }}</b></p>
          }
          <div class="grid grid-5 mb-2">
            <div class="kpi" style="--kpi-accent: var(--navy-800)">
              <div class="kpi-label">F0302 asignadas</div>
              <div class="kpi-value">{{ data.configuracionesVisibles().length }}</div>
              <div class="kpi-hint">Configuraciones a su cargo</div>
            </div>
            <div class="kpi" style="--kpi-accent: var(--gold-500)">
              <div class="kpi-label">F0302 en curso</div>
              <div class="kpi-value">{{ confsEnCurso().length }}</div>
              <div class="kpi-hint">
                @if (confEnCurso(); as c) { ⏱ Cronómetro en curso desde {{ c.cronometro?.horaInicio?.slice(0, 5) }} } @else { Por finalizar }
              </div>
            </div>
            <div class="kpi" style="--kpi-accent: var(--ok)">
              <div class="kpi-label">F0302 finalizadas</div>
              <div class="kpi-value">{{ confsFinalizadas().length }}</div>
              <div class="kpi-hint">
                Tiempo promedio: {{ data.formatoDuracion(tiempoPromedioConf()) || '—' }} ·
                {{ confsComplejas().length }} con complejidad
              </div>
            </div>
            <div class="kpi" style="--kpi-accent: var(--blue-500)">
              <div class="kpi-label">Entregas asignadas</div>
              <div class="kpi-value">{{ data.entregasVisibles().length }}</div>
              <div class="kpi-hint">Donde participa</div>
            </div>
            <div class="kpi" style="--kpi-accent: var(--warn)">
              <div class="kpi-label">F0288 participadas</div>
              <div class="kpi-value">{{ data.preparacionesVisibles().length }}</div>
              <div class="kpi-hint">Solo si Soporte preparó</div>
            </div>
          </div>
          <div class="row mb-2">
            <a class="btn btn-gold" routerLink="/configuracion">Continuar Configuración F0302</a>
            @if (data.entregasVisibles().length > 0) {
              <a class="btn btn-outline" routerLink="/entrega-aceptacion">Entrega y aceptación</a>
            }
            @if (data.preparacionesVisibles().length > 0) {
              <a class="btn btn-outline" routerLink="/preparacion-tecnica">Preparación F0288</a>
            }
          </div>
          <div class="grid grid-2 mb-2">
            <div class="card">
              <div class="card-head"><div><h2>Configuraciones F0302</h2><p class="sub">Asignadas a usted</p></div></div>
              <div class="card-body">
                @for (c of data.configuracionesVisibles(); track c.expediente) {
                  <div class="mini-item">
                    <span class="mi-main mono">{{ c.expediente }}</span>
                    <span>{{ c.datos.asignadoA }}</span>
                    @if (c.cronometro?.duracionMinutos !== null && c.cronometro) { <span class="tec-chip">⏱ <b>{{ data.formatoDuracion(c.cronometro.duracionMinutos) }}</b></span> }
                    @else if (c.cronometro) { <span class="tec-chip">⏱ en curso</span> }
                    @if (c.cierre; as ci) { <span class="tec-chip">{{ ci.nivel }}</span> }
                    <span class="mi-right"><ui-badge [estado]="c.estado" /><a class="btn btn-ghost btn-sm" routerLink="/configuracion">Abrir</a></span>
                  </div>
                } @empty { <p class="muted small">No tiene configuraciones F0302 asignadas en este momento.</p> }
              </div>
            </div>
            <div class="card">
              <div class="card-head"><div><h2>Expedientes donde participa</h2><p class="sub">Activos o cerrados con su participación</p></div></div>
              <div class="card-body">
                @for (x of data.expedientesUnicosVisibles(); track x.codigoUnico) {
                  <div class="mini-item">
                    <span class="mi-main mono">{{ x.codigoUnico }}</span>
                    <span>{{ x.resumenEstado }}</span>
                    <span class="mi-right"><ui-badge [estado]="x.estado" /></span>
                  </div>
                } @empty { <p class="muted small">Aún no participa en expedientes únicos.</p> }
              </div>
            </div>
          </div>
        }

        <!-- ─────────── Encargado de Hardware: información global de su área ─────────── -->
        @case ('enc-hardware') {
          <div class="grid grid-5 mb-2">
            <div class="kpi" style="--kpi-accent: var(--gold-500)">
              <div class="kpi-label">Pendientes de preparación</div>
              <div class="kpi-value">{{ nEquiposHw('Pendiente de preparación') }}</div>
              <div class="kpi-hint">Equipos de Hardware</div>
            </div>
            <div class="kpi" style="--kpi-accent: var(--blue-500)">
              <div class="kpi-label">En preparación</div>
              <div class="kpi-value">{{ nEquiposHw('En preparación') }}</div>
              <div class="kpi-hint">Con F0288 en curso</div>
            </div>
            <div class="kpi" style="--kpi-accent: var(--ok)">
              <div class="kpi-label">Preparados</div>
              <div class="kpi-value">{{ nEquiposHw('Preparado') }}</div>
              <div class="kpi-hint">F0288 finalizado</div>
            </div>
            <div class="kpi" style="--kpi-accent: var(--navy-800)">
              <div class="kpi-label">Expedientes técnicos</div>
              <div class="kpi-value">{{ data.expedientesTecnicosVisibles().length }}</div>
              <div class="kpi-hint">Creados en Hardware</div>
            </div>
            <div class="kpi" style="--kpi-accent: var(--warn)">
              <div class="kpi-label">F0288 activas</div>
              <div class="kpi-value">{{ prepsPendientes().length }}</div>
              <div class="kpi-hint">{{ prepsFinalizadas().length }} finalizadas</div>
            </div>
          </div>
          <div class="grid grid-2 mb-2">
            <div class="card">
              <div class="card-head">
                <div><h2>Técnicos con tareas asignadas</h2><p class="sub">Preparaciones F0288 activas por técnico</p></div>
                <a class="btn btn-outline btn-sm" routerLink="/preparacion-tecnica">Preparación F0288</a>
              </div>
              <div class="card-body">
                <div class="row" style="flex-wrap: wrap;">
                  @for (t of porTecnico(); track t.nombre) {
                    <span class="tec-chip">{{ t.nombre }} <b>{{ t.n }}</b></span>
                  } @empty { <p class="muted small">Sin preparaciones activas por técnico.</p> }
                </div>
              </div>
            </div>
            <div class="card">
              <div class="card-head">
                <div><h2>Últimos equipos ingresados</h2><p class="sub">Inventario de Hardware, con fecha y usuario de ingreso</p></div>
                <a class="btn btn-outline btn-sm" routerLink="/inventario-hardware">Ver inventario</a>
              </div>
              <div class="card-body">
                @for (e of ultimosIngresos(); track e.inventario) {
                  <div class="mini-item">
                    <span class="mi-main mono">{{ e.inventario }}</span>
                    <span>{{ e.marca }} {{ e.modelo }}</span>
                    <span class="mi-right mono">{{ e.fechaIngreso || '—' }}</span>
                  </div>
                } @empty { <p class="muted small">Sin registros de ingreso.</p> }
              </div>
            </div>
          </div>
          <div class="card mb-2">
            <div class="card-head">
              <div><h2>Tiempos y complejidad de preparación F0288</h2><p class="sub">Del área de Hardware: promedio, complejidad y equipos con mayor tiempo</p></div>
            </div>
            <div class="card-body">
              <div class="grid grid-3">
                <div>
                  <div class="kpi" style="--kpi-accent: var(--blue-500)">
                    <div class="kpi-label">Tiempo promedio de preparación</div>
                    <div class="kpi-value">{{ data.formatoDuracion(tiempoPromedioPrep()) || '—' }}</div>
                    <div class="kpi-hint">{{ prepsFinalizadas().length }} preparaciones finalizadas</div>
                  </div>
                </div>
                <div>
                  <p class="small" style="font-weight: 700; color: var(--navy-900); margin-bottom: 6px;">Preparaciones con complejidad</p>
                  @for (p of prepsComplejas(); track p.expedienteTecnico) {
                    <div class="mini-item">
                      <span class="mi-main mono">{{ p.expedienteTecnico }}</span>
                      <span class="tec-chip">{{ p.cierre?.nivel }}</span>
                      <span class="mi-right mono">{{ data.formatoDuracion(p.cronometro?.duracionMinutos) || '—' }}</span>
                    </div>
                  } @empty { <p class="muted small">Sin preparaciones con complejidad media o alta.</p> }
                </div>
                <div>
                  <p class="small" style="font-weight: 700; color: var(--navy-900); margin-bottom: 6px;">Equipos con mayor tiempo de preparación</p>
                  @for (p of prepsMasLentas(); track p.expedienteTecnico) {
                    <div class="mini-item">
                      <span class="mi-main mono">{{ p.datosGenerales.inventario }}</span>
                      <span class="mono">{{ p.expedienteTecnico }}</span>
                      <span class="mi-right mono">⏱ {{ data.formatoDuracion(p.cronometro?.duracionMinutos) }}</span>
                    </div>
                  } @empty { <p class="muted small">Aún no hay tiempos de preparación registrados.</p> }
                </div>
              </div>
            </div>
          </div>
        }

        <!-- ─────────── Administrador: información administrativa del sistema ─────────── -->
        @case ('admin') {
          <div class="grid grid-5 mb-2">
            <a class="etapa-card" routerLink="/administracion">
              <div class="etapa-tit">Usuarios</div>
              <div class="etapa-cifra">{{ data.usuarios().length }}</div>
              <div class="etapa-lbl">internos activos</div>
            </a>
            <a class="etapa-card" routerLink="/administracion">
              <div class="etapa-tit">Roles operativos</div>
              <div class="etapa-cifra">5</div>
              <div class="etapa-lbl">con permisos definidos</div>
            </a>
            <a class="etapa-card" routerLink="/administracion">
              <div class="etapa-tit">Catálogos</div>
              <div class="etapa-cifra">13</div>
              <div class="etapa-lbl">fuentes de datos simuladas</div>
            </a>
            <a class="etapa-card" routerLink="/generador-documentos">
              <div class="etapa-tit">Documentos</div>
              <div class="etapa-cifra">{{ data.documentos().length }}</div>
              <div class="etapa-lbl">generados en el sistema</div>
            </a>
            <a class="etapa-card" routerLink="/trazabilidad">
              <div class="etapa-tit">Accesos y trazabilidad</div>
              <div class="etapa-cifra">{{ data.eventos().length }}</div>
              <div class="etapa-lbl">eventos registrados</div>
            </a>
          </div>
          <div class="alert mb-2">
            <span class="alert-ico">i</span>
            <span>Panel administrativo: gestione <b>usuarios, roles, catálogos y parámetros</b> desde Administración. La operación del proceso corresponde a los Encargados y Técnicos según su rol.</span>
          </div>
        }

        <!-- ─────────── Encargado de Soporte: información global del proceso ─────────── -->
        @default {
          <div class="grid grid-5 mb-2">
            <div class="kpi" style="--kpi-accent: var(--navy-800)">
              <div class="kpi-label">Solicitudes totales</div>
              <div class="kpi-value">{{ data.solicitudes().length }}</div>
              <div class="kpi-hint">{{ nPorEstado('Entrante') }} entrantes sin asignación</div>
            </div>
            <div class="kpi" style="--kpi-accent: var(--gold-500)">
              <div class="kpi-label">Equipos preparados</div>
              <div class="kpi-value">{{ data.equiposDisponiblesParaAsignar().length }}</div>
              <div class="kpi-hint">Disponibles para asignar</div>
            </div>
            <div class="kpi" style="--kpi-accent: var(--blue-500)">
              <div class="kpi-label">En configuración</div>
              <div class="kpi-value">{{ enConfiguracion() }}</div>
              <div class="kpi-hint">Expedientes con F0302 activo</div>
            </div>
            <div class="kpi" style="--kpi-accent: var(--warn)">
              <div class="kpi-label">Pend. de conformidad</div>
              <div class="kpi-value">{{ nPorEstado('Pendiente de aceptación') }}</div>
              <div class="kpi-hint">Formulario externo enviado</div>
            </div>
            <div class="kpi" style="--kpi-accent: var(--ok)">
              <div class="kpi-label">Garantías vigentes</div>
              <div class="kpi-value">{{ garantiasVigentes() }}</div>
              <div class="kpi-hint">{{ casosAbiertos() }} casos abiertos · {{ data.documentos().length }} documentos</div>
            </div>
          </div>

          <!-- Flujo del proceso por etapa: mismas 4 etapas del menú, con cifras reales -->
          <div class="card mb-2">
            <div class="card-head">
              <div>
                <h2>Flujo del proceso por etapa</h2>
                <p class="sub">De la disponibilidad de solicitudes y equipos al cierre de la auditoría</p>
              </div>
            </div>
            <div class="card-body">
              <div class="grid grid-4">
                @for (e of etapas(); track e.titulo; let i = $index) {
                  <a class="etapa-card" [routerLink]="e.ruta">
                    <div class="etapa-n">{{ i + 1 }}</div>
                    <div class="etapa-tit">{{ e.titulo }}</div>
                    <div class="etapa-cifra">{{ e.n }}</div>
                    <div class="etapa-lbl">{{ e.etiqueta }}</div>
                  </a>
                }
              </div>
            </div>
          </div>

          <div class="grid grid-2">
            <div class="card">
              <div class="card-head">
                <div>
                  <h2>Solicitudes por fase</h2>
                  <p class="sub">Distribución actual del proceso</p>
                </div>
              </div>
              <div class="card-body">
                <div class="barras">
                  @for (f of fases(); track f.nombre) {
                    <div class="barra-row">
                      <span class="b-label">{{ f.nombre }}</span>
                      <div class="barra-track">
                        <div class="barra-fill" [style.width.%]="pct(f.n)" [style.background]="f.color"></div>
                      </div>
                      <span class="b-n">{{ f.n }}</span>
                    </div>
                  }
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-head">
                <div>
                  <h2>Cierre del proceso</h2>
                  <p class="sub">Conformidad del usuario final y garantías</p>
                </div>
              </div>
              <div class="card-body">
                <div class="dona-wrap">
                  <div class="dona" [style.background]="donaCss()">
                    <div class="centro">
                      <b>{{ data.solicitudes().length }}</b>
                      <span>solicitudes</span>
                    </div>
                  </div>
                  <div class="leyenda">
                    @for (f of fases(); track f.nombre) {
                      @if (f.n > 0) {
                        <div class="l-item">
                          <span class="l-dot" [style.background]="f.color"></span>
                          {{ f.nombre }} <b>{{ f.n }}</b>
                        </div>
                      }
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Estado global de tiempos del flujo (cronómetros F0288 / F0302) -->
          <div class="card mt-2">
            <div class="card-head">
              <div>
                <h2>Estado global de tiempos del flujo</h2>
                <p class="sub">Tiempos y complejidad registrados por los cronómetros F0288 y F0302</p>
              </div>
            </div>
            <div class="card-body">
              <div class="grid grid-4 mb-2">
                <div class="kpi" style="--kpi-accent: var(--blue-500)">
                  <div class="kpi-label">Tiempo promedio F0288</div>
                  <div class="kpi-value">{{ data.formatoDuracion(tiempoPromedioPrepGlobal()) || '—' }}</div>
                  <div class="kpi-hint">Preparación técnica</div>
                </div>
                <div class="kpi" style="--kpi-accent: var(--navy-800)">
                  <div class="kpi-label">Tiempo promedio F0302</div>
                  <div class="kpi-value">{{ data.formatoDuracion(tiempoPromedioConf()) || '—' }}</div>
                  <div class="kpi-hint">Configuración</div>
                </div>
                <div class="kpi" style="--kpi-accent: var(--warn)">
                  <div class="kpi-label">Con complejidad</div>
                  <div class="kpi-value">{{ confsComplejas().length + prepsComplejasGlobal().length }}</div>
                  <div class="kpi-hint">{{ prepsComplejasGlobal().length }} en F0288 · {{ confsComplejas().length }} en F0302</div>
                </div>
                <div class="kpi" style="--kpi-accent: var(--gold-500)">
                  <div class="kpi-label">Cronómetros en curso</div>
                  <div class="kpi-value">{{ cronometrosEnCurso() }}</div>
                  <div class="kpi-hint">Preparaciones o configuraciones en proceso</div>
                </div>
              </div>
              <div class="grid grid-2">
                <div>
                  <p class="small" style="font-weight: 700; color: var(--navy-900); margin-bottom: 6px;">Configuraciones F0302 por técnico</p>
                  <div class="row" style="flex-wrap: wrap;">
                    @for (t of confsPorTecnico(); track t.nombre) {
                      <span class="tec-chip">{{ t.nombre }} <b>{{ t.n }}</b>@if (t.promedio !== null) { <span>· ⏱ {{ data.formatoDuracion(t.promedio) }}</span> }</span>
                    } @empty { <p class="muted small">Sin configuraciones registradas.</p> }
                  </div>
                </div>
                <div>
                  <p class="small" style="font-weight: 700; color: var(--navy-900); margin-bottom: 6px;">Expedientes con mayor tiempo de atención</p>
                  @for (x of expedientesMayorTiempo(); track x.codigo) {
                    <div class="mini-item">
                      <span class="mi-main mono">{{ x.codigo }}</span>
                      <span>{{ x.usuario }}</span>
                      <span class="mi-right mono">⏱ {{ data.formatoDuracion(x.total) }}</span>
                    </div>
                  } @empty { <p class="muted small">Aún no hay tiempos registrados en el flujo.</p> }
                </div>
              </div>
            </div>
          </div>
        }
      }

      <!-- Actividad reciente: respeta la visibilidad por rol -->
      <div class="card mt-2">
        <div class="card-head">
          <div>
            <h2>Actividad reciente</h2>
            <p class="sub">{{ auth.esTecnico() ? 'Últimos hitos de sus procesos' : 'Últimos hitos registrados en la trazabilidad' }}</p>
          </div>
          <a class="btn btn-outline btn-sm" routerLink="/trazabilidad">Ver trazabilidad completa</a>
        </div>
        <div class="card-body">
          <div class="acti">
            @for (e of hitosRecientes(); track $index) {
              <div class="acti-item">
                <span class="acti-when">{{ e.fecha }}<br />{{ e.hora }}</span>
                <span>
                  <div class="acti-what">{{ e.accion }}</div>
                  <div class="acti-who">{{ e.expediente }} · {{ e.usuario }}</div>
                </span>
                <ui-badge [estado]="e.estado" />
              </div>
            } @empty {
              <p class="muted small">Sin hitos registrados para su rol todavía.</p>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);

  protected readonly clave = computed(() => this.auth.usuario()?.clave ?? '');

  protected readonly subtitulo = computed(() => {
    switch (this.clave()) {
      case 'tec-hardware': return 'sus preparaciones F0288 y expedientes técnicos asignados.';
      case 'tec-soporte': return 'sus configuraciones F0302, entregas y expedientes donde participa.';
      case 'enc-hardware': return 'estado global del área de Hardware: inventario, expedientes técnicos y F0288.';
      case 'admin': return 'administración del sistema: usuarios, roles, catálogos y accesos.';
      default: return 'estado general del proceso y seguimiento de solicitudes al día de hoy.';
    }
  });

  // ---- Técnicos y Encargado de Hardware: preparaciones visibles por rol ----
  protected readonly prepsPendientes = computed(() =>
    this.data.preparacionesVisibles().filter((p) => p.estado !== 'Completada').sort((a, b) => b.fecha.localeCompare(a.fecha))
  );
  protected readonly prepsFinalizadas = computed(() =>
    this.data.preparacionesVisibles().filter((p) => p.estado === 'Completada')
      .sort((a, b) => (b.firma.fecha || b.fecha).localeCompare(a.firma.fecha || a.fecha))
  );
  /** Última F0288 asignada o pendiente del técnico conectado (la misma que carga Preparación). */
  protected readonly prepDestacada = computed(() => this.prepsPendientes()[0]);

  protected expTecDe(p: PreparacionF0288): ExpedienteTecnico | undefined {
    return this.data.expedientesTecnicos().find((x) => x.codigo === p.expedienteTecnico);
  }

  // ---- Tiempos y complejidad (cronómetros F0288 / F0302) ----
  private promedio(mins: number[]): number | null {
    return mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : null;
  }
  private duraciones(regs: { cronometro?: { duracionMinutos: number | null } }[]): number[] {
    return regs
      .map((r) => r.cronometro?.duracionMinutos)
      .filter((d): d is number => d !== null && d !== undefined);
  }
  private esCompleja(cierre?: { nivel: string }): boolean {
    return cierre?.nivel === 'Media' || cierre?.nivel === 'Alta';
  }

  /** Preparación con cronómetro corriendo del rol conectado, si existe. */
  protected readonly prepEnCurso = computed(() =>
    this.prepsPendientes().find((p) => p.cronometro && p.cronometro.duracionMinutos === null)
  );
  protected readonly tiempoPromedioPrep = computed(() => this.promedio(this.duraciones(this.prepsFinalizadas())));
  protected readonly prepsComplejas = computed(() =>
    this.prepsFinalizadas().filter((p) => this.esCompleja(p.cierre))
  );
  protected readonly prepsMasLentas = computed(() =>
    [...this.prepsFinalizadas()]
      .filter((p) => p.cronometro?.duracionMinutos !== null && p.cronometro !== undefined)
      .sort((a, b) => (b.cronometro?.duracionMinutos ?? 0) - (a.cronometro?.duracionMinutos ?? 0))
      .slice(0, 3)
  );

  // ---- Técnico de Soporte ----
  protected readonly confsEnCurso = computed(() =>
    this.data.configuracionesVisibles().filter((c) => c.estado !== 'Completada')
  );
  protected readonly confsFinalizadas = computed(() =>
    this.data.configuracionesVisibles().filter((c) => c.estado === 'Completada')
  );
  /** Configuración con cronómetro corriendo del rol conectado, si existe. */
  protected readonly confEnCurso = computed(() =>
    this.confsEnCurso().find((c) => c.cronometro && c.cronometro.duracionMinutos === null)
  );
  protected readonly tiempoPromedioConf = computed(() => this.promedio(this.duraciones(this.confsFinalizadas())));
  protected readonly confsComplejas = computed(() =>
    this.confsFinalizadas().filter((c) => this.esCompleja(c.cierre))
  );

  // ---- Encargado de Soporte: estado global de tiempos del flujo ----
  protected readonly tiempoPromedioPrepGlobal = computed(() =>
    this.promedio(this.duraciones(this.data.preparaciones().filter((p) => p.estado === 'Completada')))
  );
  protected readonly prepsComplejasGlobal = computed(() =>
    this.data.preparaciones().filter((p) => p.estado === 'Completada' && this.esCompleja(p.cierre))
  );
  protected readonly cronometrosEnCurso = computed(() =>
    this.data.preparaciones().filter((p) => p.cronometro && p.cronometro.duracionMinutos === null).length +
    this.data.configuraciones().filter((c) => c.cronometro && c.cronometro.duracionMinutos === null).length
  );
  protected readonly confsPorTecnico = computed(() => {
    const grupos = new Map<string, number[]>();
    for (const c of this.data.configuraciones()) {
      const nombre = c.tecnico.split('—')[0].trim();
      const lista = grupos.get(nombre) ?? [];
      if (c.cronometro?.duracionMinutos !== null && c.cronometro?.duracionMinutos !== undefined) {
        lista.push(c.cronometro.duracionMinutos);
      }
      grupos.set(nombre, lista);
    }
    return [...grupos.entries()].map(([nombre, mins]) => ({
      nombre,
      n: this.data.configuraciones().filter((c) => c.tecnico.includes(nombre)).length,
      promedio: this.promedio(mins)
    }));
  });
  /** Expedientes únicos con mayor tiempo total de atención (preparación + configuración). */
  protected readonly expedientesMayorTiempo = computed(() =>
    this.data.configuraciones()
      .map((c) => {
        const tecCodigo = this.data.expTecnicoDe(c.expediente)?.codigo;
        const prep = tecCodigo ? this.data.preparacionPorCodigo(tecCodigo) : undefined;
        const total = (c.cronometro?.duracionMinutos ?? 0) + (prep?.cronometro?.duracionMinutos ?? 0);
        return {
          codigo: this.data.expedienteUnicoDe(c.expediente)?.codigoUnico ?? c.expediente,
          usuario: c.datos.asignadoA,
          total
        };
      })
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 3)
  );

  // ---- Encargado de Hardware ----
  protected nEquiposHw(estado: string): number {
    return this.data.equiposConRecorrido().filter((e) => this.data.estadoPreparacionEquipo(e.inventario) === estado).length;
  }
  protected readonly porTecnico = computed(() => {
    const conteo = new Map<string, number>();
    for (const p of this.prepsPendientes()) {
      const nombre = p.tecnico.split('—')[0].trim();
      conteo.set(nombre, (conteo.get(nombre) ?? 0) + 1);
    }
    return [...conteo.entries()].map(([nombre, n]) => ({ nombre, n }));
  });
  protected readonly ultimosIngresos = computed(() =>
    [...this.data.equiposConRecorrido()]
      .filter((e) => !!e.fechaIngreso)
      .sort((a, b) => (b.fechaIngreso! + (b.horaIngreso ?? '')).localeCompare(a.fechaIngreso! + (a.horaIngreso ?? '')))
      .slice(0, 5)
  );

  // ---- Encargado de Soporte (vista global) ----
  protected readonly etapas = computed(() => [
    { titulo: 'Entrada y disponibilidad', ruta: '/solicitudes', n: this.nPorEstado('Entrante'), etiqueta: 'solicitudes entrantes' },
    { titulo: 'Preparación técnica', ruta: '/inventario-hardware', n: this.equiposEnPreparacion(), etiqueta: 'equipos en preparación' },
    { titulo: 'Asignación y configuración', ruta: '/expediente-unico', n: this.enConfiguracion(), etiqueta: 'expedientes en configuración' },
    { titulo: 'Cierre y auditoría', ruta: '/garantia', n: this.nPorEstado('Pendiente de aceptación') + this.garantiasVigentes(), etiqueta: 'por cerrar o en garantía' }
  ]);

  protected equiposEnPreparacion(): number {
    return this.data.equipos().filter((e) => this.data.estadoPreparacionEquipo(e.inventario) !== 'Preparado').length;
  }

  protected enConfiguracion(): number {
    return this.data.expedientesUnicos().filter((x) => x.estado === 'En configuración').length;
  }

  private readonly paleta: Record<string, string> = {
    'Entrante': 'var(--gold-500)',
    'Asignada': '#7c95c9',
    'En preparación': 'var(--blue-500)',
    'En configuración': 'var(--navy-700)',
    'Pendiente de aceptación': '#d9a514',
    'Entregado': '#2c9e68',
    'No conforme': 'var(--danger)',
    'Cerrado': '#8fa1b8'
  };

  protected nPorEstado(estado: string): number {
    return this.data.solicitudes().filter((s) => s.estado === estado).length;
  }

  protected readonly garantiasVigentes = computed(() =>
    this.data.garantias().filter((g) => g.estado === 'Vigente' || g.estado === 'Caso abierto').length
  );

  protected readonly casosAbiertos = computed(() =>
    this.data.garantias().flatMap((g) => g.casos).filter((c) => c.estado === 'Abierto' || c.estado === 'En revisión').length
  );

  protected readonly fases = computed<FaseCount[]>(() =>
    Object.keys(this.paleta).map((nombre) => ({
      nombre, corto: nombre, n: this.nPorEstado(nombre), color: this.paleta[nombre]
    }))
  );

  protected pct(n: number): number {
    const max = Math.max(1, ...this.fases().map((f) => f.n));
    return (n / max) * 100;
  }

  protected readonly donaCss = computed(() => {
    const total = Math.max(1, this.data.solicitudes().length);
    let acc = 0;
    const stops: string[] = [];
    for (const f of this.fases()) {
      if (f.n === 0) continue;
      const desde = (acc / total) * 360;
      acc += f.n;
      const hasta = (acc / total) * 360;
      stops.push(`${f.color} ${desde}deg ${hasta}deg`);
    }
    return `conic-gradient(${stops.join(', ') || 'var(--neutral-bg) 0deg 360deg'})`;
  });

  protected readonly hitosRecientes = computed(() =>
    [...this.data.eventosVisibles()].filter((e) => e.hito).slice(-6).reverse()
  );
}
