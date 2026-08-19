// URL da API por ambiente. Em localhost nada é definido e a app usa o default
// http://localhost:3005/api; em produção (Vercel) aponta para o backend publicado.
// Porta 3005 é exclusiva do OncoGuia — ver ~/Antigravity/PORTS.md antes de mudar.
if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  window.ONCOGUIA_API_BASE = "https://oncoguia-backend.vercel.app/api";
}
