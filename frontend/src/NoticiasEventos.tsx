import type { Evento, Noticia } from './api';

const dataLonga = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit' });
const mes = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');

export default function NoticiasEventos({ noticias, eventos }: { noticias: Noticia[]; eventos: Evento[] }) {
  const [destaque, ...demais] = noticias;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
      {/* NOTÍCIAS */}
      <section className="lg:col-span-7 flex flex-col space-y-6" aria-labelledby="titulo-noticias">
        <div className="flex items-end justify-between gap-4">
          <h3 id="titulo-noticias" className="font-headline-md text-headline-md text-on-surface font-bold">
            Notícias
          </h3>
        </div>

        {destaque ? (
          <article className="group rounded-3xl overflow-hidden bg-surface shadow-sm grid grid-cols-1 sm:grid-cols-5">
            {destaque.imagem && (
              <div className="sm:col-span-2 aspect-[16/10] sm:aspect-auto overflow-hidden">
                <img
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                  src={destaque.imagem}
                />
              </div>
            )}
            <div className={`${destaque.imagem ? 'sm:col-span-3' : 'sm:col-span-5'} p-6 flex flex-col space-y-3`}>
              <time className="font-label-sm text-label-sm text-on-surface-variant" dateTime={destaque.criado_em}>
                {dataLonga(destaque.criado_em)}
              </time>
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold leading-snug">
                {destaque.titulo}
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed line-clamp-3">
                {destaque.subtitulo}
              </p>
            </div>
          </article>
        ) : (
          <p className="text-on-surface-variant text-body-md">Nenhuma notícia publicada no momento.</p>
        )}

        {demais.length > 0 && (
          <ul className="flex flex-col divide-y divide-outline-variant/60">
            {demais.map((n) => (
              <li key={n.id} className="py-4 first:pt-0">
                <article className="flex flex-col space-y-1.5">
                  <time className="font-label-sm text-label-sm text-on-surface-variant" dateTime={n.criado_em}>
                    {dataLonga(n.criado_em)}
                  </time>
                  <h4 className="font-label-lg text-label-lg text-on-surface font-semibold leading-snug">{n.titulo}</h4>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* EVENTOS */}
      <section
        className="lg:col-span-5 rounded-3xl bg-primary text-on-primary p-6 sm:p-8 flex flex-col space-y-6 shadow-sm"
        aria-labelledby="titulo-eventos"
      >
        <div className="flex items-center justify-between gap-4">
          <h3 id="titulo-eventos" className="font-headline-md text-headline-md font-bold">
            Próximos Eventos
          </h3>
          <span aria-hidden="true" className="material-symbols-outlined text-[28px] opacity-80">event</span>
        </div>

        {eventos.length > 0 ? (
          <ul className="flex flex-col space-y-3">
            {eventos.map((e) => (
              <li key={e.id} className="flex gap-4 items-center p-3 rounded-2xl bg-white/10">
                <time className="sr-only" dateTime={e.data_hora}>
                  {dataLonga(e.data_hora)}
                </time>
                <div className="shrink-0 w-14 h-16 rounded-xl bg-white text-primary flex flex-col items-center justify-center">
                  <span className="font-headline-sm text-headline-sm font-extrabold leading-none">{dia(e.data_hora)}</span>
                  <span className="font-label-sm text-label-sm font-bold">{mes(e.data_hora)}</span>
                </div>
                <div className="min-w-0 flex flex-col space-y-1">
                  <p className="font-label-lg text-label-lg font-semibold leading-snug">{e.titulo}</p>
                  <p className="font-label-sm text-label-sm text-on-primary/80 inline-flex items-center gap-1">
                    <span aria-hidden="true" className="material-symbols-outlined text-[16px]">schedule</span>
                    {hora(e.data_hora)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-on-primary/80 text-body-md">Nenhum evento agendado no momento.</p>
        )}
      </section>
    </div>
  );
}
