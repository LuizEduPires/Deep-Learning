/**
 * Peças visuais do redesign compartilhadas entre as telas: a marca, os ícones
 * de traço e os blocos de formulário. Os ícones Material de icones.tsx seguem
 * em uso onde já estavam (microfone, chave).
 */

type IconeProps = { className?: string; strokeWidth?: number };

const TRACOS = {
  inicio: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  conversa: <path d="M21 12a8.5 8.5 0 0 1-12.4 7.6L3 21l1.4-5.6A8.5 8.5 0 1 1 21 12z" />,
  busca: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.8-3.8" />
    </>
  ),
  broto: (
    <>
      <path d="M7 20h10" />
      <path d="M12 20v-8" />
      <path d="M12 12c0-4 3-7 8-7 0 5-3 8-8 8" />
      <path d="M12 13C12 9.5 9.5 7 5 7c0 4.5 2.5 6 7 6" />
    </>
  ),
  pin: (
    <>
      <path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  direita: <path d="m9 6 6 6-6 6" />,
  esquerda: <path d="m15 6-6 6 6 6" />,
  baixo: <path d="m6 9 6 6 6-6" />,
  cima: <path d="m6 15 6-6 6 6" />,
  enviar: (
    <>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </>
  ),
  chuva: (
    <>
      <path d="M7 16a4.5 4.5 0 1 1 1-8.9A6 6 0 0 1 19 9a4 4 0 0 1-1 7.9" />
      <path d="M8 19v2M12 18v3M16 19v2" />
    </>
  ),
  vento: (
    <>
      <path d="M3 8h11a3 3 0 1 0-3-3" />
      <path d="M3 12h16a3 3 0 1 1-3 3" />
      <path d="M3 16h7" />
    </>
  ),
  gota: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  relogio: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  mais: <path d="M12 5v14M5 12h14" />,
  lixeira: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  escudo: (
    <>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  escudoAlerta: (
    <>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
      <path d="M12 9v4M12 16h.01" />
    </>
  ),
  frasco: (
    <>
      <path d="M9 3h6M10 3v6L5 19a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2L14 9V3" />
      <path d="M7.5 15h9" />
    </>
  ),
  brilho: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
    </>
  ),
  mira: (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  check: <path d="m5 12 5 5 9-10" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  alerta: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 17h.01" />
    </>
  ),
  triangulo: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  livro: (
    <>
      <path d="M4 19.5V5a2 2 0 0 1 2-2h14v14H6a2 2 0 0 0-2 2.5z" />
      <path d="M6 21h14" />
    </>
  ),
  lapis: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  externo: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </>
  ),
  filtro: <path d="M4 5h16l-6 7.5V19l-4 2v-8.5z" />,
  termometro: (
    <>
      <path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z" />
    </>
  ),
  cpu: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </>
  ),
} as const;

export type NomeIcone = keyof typeof TRACOS;

export function Icone({
  nome,
  className = "h-5 w-5",
  strokeWidth = 1.8,
}: IconeProps & { nome: NomeIcone }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      {TRACOS[nome]}
    </svg>
  );
}

/** Marca: a fruta sobre o quadrado verde. */
export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect width="36" height="36" rx="11" fill="#1E5B3A" />
      <path
        d="M18 8c5.5 0 9 4.6 9 10.5S23 29 18 29s-9-4.6-9-10.5S12.5 8 18 8z"
        fill="#E0367A"
      />
      <path
        d="M18 8c0-2 1-3 3-3.5M13 12.5 10 10M23 12.5l3-2.5M11.5 19H8.5M24.5 19h3M13 25.5l-2.5 2M23 25.5l2.5 2"
        stroke="#9BD37B"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="15.5" cy="17" r="1" fill="#FFFFFF" />
      <circle cx="20.5" cy="20" r="1" fill="#FFFFFF" />
      <circle cx="17" cy="23.5" r="1" fill="#FFFFFF" />
    </svg>
  );
}

/** Título de página: display grande, com linha de apoio opcional. */
export function CabecalhoPagina({
  titulo,
  apoio,
  acao,
}: {
  titulo: string;
  apoio?: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-[30px] leading-tight font-bold tracking-tight">
          {titulo}
        </h1>
        {apoio && <p className="mt-1.5 text-[15px] leading-snug text-suave">{apoio}</p>}
      </div>
      {acao}
    </header>
  );
}

export function TituloSecao({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="font-display text-[19px] font-bold tracking-tight">
      {children}
    </h2>
  );
}

/** Aviso de receituário e outros alertas âmbar. */
export function Aviso({
  icone = "escudoAlerta",
  children,
}: {
  icone?: NomeIcone;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5 rounded-2xl bg-alerta-suave px-3.5 py-3 text-[13px] leading-snug text-alerta-texto">
      <Icone nome={icone} className="mt-px h-[18px] w-[18px]" />
      <div>{children}</div>
    </div>
  );
}

export const classeCartao = "rounded-[20px] border border-borda bg-painel";

export const classeInput =
  "min-h-12 w-full rounded-xl border border-borda bg-painel px-3 text-base font-medium text-texto outline-none md:text-[15px] placeholder:font-normal placeholder:text-suave focus:border-marca-texto";

export const classeBotaoPrimario =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-marca px-5 text-base font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40";

export const classeBotaoContorno =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-[1.5px] border-marca-texto bg-painel px-5 text-[15px] font-bold text-marca-texto transition-opacity hover:opacity-80 disabled:opacity-40";

/** Campo de texto com rótulo e lista de sugestões opcional. */
export function Campo(props: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  lista?: string[];
  listaId?: string;
  dica?: string;
  icone?: NomeIcone;
  tipo?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  obrigatorio?: boolean;
  nome?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-bold text-texto-2">
      {props.rotulo}
      <span className="relative flex items-center">
        {props.icone && (
          <Icone nome={props.icone} className="pointer-events-none absolute left-3 h-[18px] w-[18px] text-suave" />
        )}
        <input
          name={props.nome}
          type={props.tipo ?? "text"}
          inputMode={props.inputMode}
          required={props.obrigatorio}
          step={props.tipo === "number" ? "any" : undefined}
          value={props.valor}
          onChange={(e) => props.aoMudar(e.target.value)}
          list={props.lista ? props.listaId : undefined}
          placeholder={props.dica}
          className={`${classeInput} ${props.icone ? "pl-10" : ""}`}
        />
      </span>
      {props.lista && (
        <datalist id={props.listaId}>
          {props.lista.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      )}
    </label>
  );
}

/** Controle segmentado (duas ou três opções lado a lado). */
export function Segmentado<T extends string>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
}: {
  opcoes: { valor: T; rotulo: string; href?: string }[];
  valor: T;
  aoMudar?: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div
      role="group"
      aria-label={rotulo}
      className="grid gap-1 rounded-2xl bg-trilho p-1"
      style={{ gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))` }}
    >
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        const classe = `flex min-h-11 items-center justify-center rounded-xl text-[15px] transition ${
          ativo ? "bg-painel font-bold text-texto shadow-sm" : "font-semibold text-texto-2 hover:text-texto"
        }`;
        return o.href ? (
          <a key={o.valor} href={o.href} aria-current={ativo ? "page" : undefined} className={classe}>
            {o.rotulo}
          </a>
        ) : (
          <button
            key={o.valor}
            type="button"
            aria-pressed={ativo}
            onClick={() => aoMudar?.(o.valor)}
            className={classe}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

/** Chip de filtro rápido. */
export function Chip({
  ativo,
  aoClicar,
  children,
}: {
  ativo?: boolean;
  aoClicar: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={aoClicar}
      className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition ${
        ativo
          ? "border-marca bg-marca text-white"
          : "border-borda bg-painel text-texto hover:border-suave"
      }`}
    >
      {children}
    </button>
  );
}

export function Etiqueta({
  tom = "marca",
  children,
}: {
  tom?: "marca" | "acento" | "neutro" | "alerta";
  children: React.ReactNode;
}) {
  const tons = {
    marca: "bg-marca-suave text-marca-texto",
    acento: "bg-acento-suave text-acento-texto",
    neutro: "bg-fundo text-texto-2",
    alerta: "bg-alerta-suave text-alerta-texto",
  };
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-bold ${tons[tom]}`}>
      {children}
    </span>
  );
}
