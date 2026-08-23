"use client";

/**
 * Ícones Material Symbols embutidos como componentes.
 *
 * Ficam inline em vez de <img src="/mic.svg"> porque assim o `currentColor`
 * herda a cor de quem os contém — um SVG carregado como imagem manteria o fill
 * fixo do arquivo e não acompanharia o tema claro/escuro nem os estados dos
 * botões. Os traçados vêm da pasta Icons/ do projeto, sem alteração.
 */

type Props = { className?: string };

function Simbolo({ d, className }: { d: string; className: string }) {
  return (
    <svg
      viewBox="0 -960 960 960"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

/** Microfone comum: o navegador liberou o acesso (ou ainda vai perguntar). */
export function IconeMicrofone({ className = "h-6 w-6" }: Props) {
  return (
    <Simbolo
      className={className}
      d="M395-435q-35-35-35-85v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q0 50-35 85t-85 35q-50 0-85-35Zm85-205Zm-40 520v-123q-104-14-172-93t-68-184h80q0 83 58.5 141.5T480-320q83 0 141.5-58.5T680-520h80q0 105-68 184t-172 93v123h-80Zm68.5-371.5Q520-503 520-520v-240q0-17-11.5-28.5T480-800q-17 0-28.5 11.5T440-760v240q0 17 11.5 28.5T480-480q17 0 28.5-11.5Z"
    />
  );
}

/** Microfone com alerta: acesso negado ou captura indisponível. */
export function IconeMicrofoneBloqueado({ className = "h-6 w-6" }: Props) {
  return (
    <Simbolo
      className={className}
      d="M315-435q-35-35-35-85v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q0 50-35 85t-85 35q-50 0-85-35Zm113.5-56.5Q440-503 440-520v-240q0-17-11.5-28.5T400-800q-17 0-28.5 11.5T360-760v240q0 17 11.5 28.5T400-480q17 0 28.5-11.5ZM440-120h-80v-123q-104-14-172-93t-68-184h80q0 83 58.5 141.5T400-320q11 0 20.5-1t19.5-3v204Zm240-40q8 0 14-6t6-14q0-8-6-14t-14-6q-8 0-14 6t-6 14q0 8 6 14t14 6Zm-20-80h40v-160h-40v160ZM538.5-138.5Q480-197 480-280t58.5-141.5Q597-480 680-480t141.5 58.5Q880-363 880-280t-58.5 141.5Q763-80 680-80t-141.5-58.5ZM400-640Z"
    />
  );
}

/** Trator: a propriedade cadastrada no cabeçalho. */
export function IconeFazenda({ className = "h-4 w-4 shrink-0" }: Props) {
  return (
    <Simbolo
      className={className}
      d="M160-600q-17 0-28.5-11.5T120-640q0-17 11.5-28.5T160-680h120q33 0 56.5 23.5T360-600H160Zm80 360q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Zm582.5-17.5Q840-275 840-300t-17.5-42.5Q805-360 780-360t-42.5 17.5Q720-325 720-300t17.5 42.5Q755-240 780-240t42.5-17.5ZM240-300q-25 0-42.5-17.5T180-360q0-25 17.5-42.5T240-420q25 0 42.5 17.5T300-360q0 25-17.5 42.5T240-300Zm560-139q26 5 43 13.5t37 27.5v-242q0-33-23.5-56.5T800-720H548l-42-44 56-56-28-28-142 142 30 28 56-56 42 42v92q0 33-23.5 56.5T440-520h-81q23 17 37 35t28 45h16q66 0 113-47t47-113v-40h200v201ZM641-320q6-27 14.5-43.5T682-400H436q4 23 4 40t-4 40h205Zm139 160q-58 0-99-41t-41-99q0-58 41-99t99-41q58 0 99 41t41 99q0 58-41 99t-99 41Zm-540 0q-83 0-141.5-58.5T40-360q0-83 58.5-141.5T240-560q83 0 141.5 58.5T440-360q0 83-58.5 141.5T240-160Zm393-360Z"
    />
  );
}

/** Engrenagem: a escolha de provedor e modelo de LLM. */
export function IconeLlm({ className = "h-4 w-4 shrink-0" }: Props) {
  return (
    <Simbolo
      className={className}
      d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z"
    />
  );
}

/** Relógio com seta de retorno: o histórico de conversas. */
export function IconeConversas({ className = "h-4 w-4 shrink-0" }: Props) {
  return (
    <Simbolo
      className={className}
      d="M480-120q-138 0-240.5-91.5T122-440h82q14 104 92.5 172T480-200q117 0 198.5-81.5T760-480q0-117-81.5-198.5T480-760q-69 0-129 32t-101 88h110v80H120v-240h80v94q51-64 124.5-99T480-840q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-480q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-120Zm112-192L440-464v-216h80v184l128 128-56 56Z"
    />
  );
}

/** Chave: o provedor tem chave de API no .env. */
export function IconeChave({ className = "h-4 w-4 shrink-0" }: Props) {
  return (
    <Simbolo
      className={className}
      d="M443.5-736.5Q467-760 500-760t56.5 23.5Q580-713 580-680t-23.5 56.5Q533-600 500-600t-56.5-23.5Q420-647 420-680t23.5-56.5ZM500 0 320-180l60-80-60-80 60-85v-47q-54-32-87-86.5T260-680q0-100 70-170t170-70q100 0 170 70t70 170q0 67-33 121.5T620-472v352L500 0ZM340-680q0 56 34 98.5t86 56.5v125l-41 58 61 82-55 71 75 75 40-40v-371q52-14 86-56.5t34-98.5q0-66-47-113t-113-47q-66 0-113 47t-47 113Z"
    />
  );
}

/** Chave cortada: falta a chave desse provedor no .env. */
export function IconeSemChave({ className = "h-4 w-4 shrink-0" }: Props) {
  return (
    <Simbolo
      className={className}
      d="M790-57 488-359q-32 54-87 86.5T280-240q-100 0-170-70T40-480q0-66 32.5-121t86.5-87L57-790l57-56 732 733-56 56Zm50-543 120 120-183 183-127-126 50-37 72 54 75-74-40-40H553l-80-80h367ZM280-320q51 0 90.5-27.5T428-419l-56-56-48.5-48.5L275-572l-56-56q-44 18-71.5 57.5T120-480q0 66 47 113t113 47Zm-56.5-103.5Q200-447 200-480t23.5-56.5Q247-560 280-560t56.5 23.5Q360-513 360-480t-23.5 56.5Q313-400 280-400t-56.5-23.5Z"
    />
  );
}

/** Exclamação em círculo: atenção, algo não vai funcionar como está. */
export function IconeAtencao({ className = "h-4 w-4 shrink-0" }: Props) {
  return (
    <Simbolo
      className={className}
      d="M508.5-291.5Q520-303 520-320t-11.5-28.5Q497-360 480-360t-28.5 11.5Q440-337 440-320t11.5 28.5Q463-280 480-280t28.5-11.5ZM440-440h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"
    />
  );
}
