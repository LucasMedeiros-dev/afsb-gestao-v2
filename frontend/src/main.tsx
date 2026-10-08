import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Landing from './Landing.tsx';
import Login from './Login.tsx';
import Area from './painel/Area.tsx';
import Painel from './painel/Painel.tsx';

// Sem router: o painel navega por pushState dentro de /painel; nginx/Vite já
// devolvem o index em qualquer rota.
const caminho = window.location.pathname.replace(/\/+$/, '');
const Pagina =
  caminho === '/login' ? Login
  : caminho.startsWith('/painel') ? Painel
  : caminho.startsWith('/area') ? Area
  : Landing;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Pagina />
  </StrictMode>,
);
