/** Ritmo de cabeçalho de tela: selo de ícone (opcional) → olho → título → linha de apoio. Espelha .cabecalho-secao do site, em escala mais contida para uso de tela cheia por horas. */
export function CabecalhoSecao({
  olho,
  titulo,
  apoio,
  icone,
  acoes,
}: {
  olho: string;
  titulo: string;
  apoio?: string;
  icone?: string;
  acoes?: React.ReactNode;
}) {
  return (
    <header className="sm-cabecalho-secao flex items-start justify-between gap-4">
      <div>
        {icone && (
          <span className="sm-selo-ico" aria-hidden="true">
            <span className="sm-ico">{icone}</span>
          </span>
        )}
        <p className="sm-olho">{olho}</p>
        <h1 className="sm-titulo-secao">{titulo}</h1>
        {apoio && <p className="sm-linha-secao">{apoio}</p>}
      </div>
      {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
    </header>
  );
}
