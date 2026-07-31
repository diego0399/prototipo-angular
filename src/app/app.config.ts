import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding: el token del formulario externo llega como input() del componente.
    provideRouter(routes, withComponentInputBinding()),
    // HttpClient solo lee los JSON simulados de assets/data (no hay API externa).
    provideHttpClient()
  ]
};
