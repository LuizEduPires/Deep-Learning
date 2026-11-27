import assert from "node:assert/strict";
import test from "node:test";
import { mesclarFontesAnalise } from "../src/server/planos-plantio";
import { entradaPlanoPlantioSchema, montarPerguntaAnalise } from "../src/plantio/validacao";

const entradaValida = {
  propertyId: "7b11f89a-91be-40ed-9b58-76da31e3e5a0",
  cultivar: "  Pitaya vermelha  ",
  plannedDate: "2026-10-15",
  irrigationAvailable: true,
  notes: "  Solo bem drenado  ",
};

test("valida os campos e normaliza cultivar e observações do plano", () => {
  assert.deepEqual(entradaPlanoPlantioSchema.parse(entradaValida), {
    ...entradaValida,
    cultivar: "Pitaya vermelha",
    notes: "Solo bem drenado",
  });
});

test("rejeita propriedade, data e tipo de pitaya inválidos", () => {
  assert.equal(
    entradaPlanoPlantioSchema.safeParse({ ...entradaValida, propertyId: "invalido" }).success,
    false,
  );
  assert.equal(
    entradaPlanoPlantioSchema.safeParse({ ...entradaValida, plannedDate: "2026-02-30" }).success,
    false,
  );
  assert.equal(
    entradaPlanoPlantioSchema.safeParse({ ...entradaValida, cultivar: " " }).success,
    false,
  );
});

test("aceita observações ausentes", () => {
  assert.equal(
    entradaPlanoPlantioSchema.safeParse({
      propertyId: entradaValida.propertyId,
      cultivar: entradaValida.cultivar,
      plannedDate: entradaValida.plannedDate,
      irrigationAvailable: entradaValida.irrigationAvailable,
    }).success,
    true,
  );
});

test("instrui análise a usar clima e conhecimento sem inventar faixa térmica", () => {
  const pergunta = montarPerguntaAnalise({
    cultivar: "Palora",
    plannedDate: "2026-10-15",
    irrigationAvailable: false,
    notes: null,
  });
  assert.match(pergunta, /próximos 14 dias/);
  assert.match(pergunta, /não invente limites/);
  assert.match(pergunta, /melhor época anual/);
  assert.match(pergunta, /Palora/);
});

test("mescla fontes da previsão antes das fontes da análise", () => {
  const fontePrevisao = {
    tool: "previsao_tempo",
    label: "Open-Meteo",
  };
  const fonteAnalise = {
    tool: "busca_conhecimento",
    label: "Base técnica",
  };

  assert.deepEqual(mesclarFontesAnalise([fontePrevisao], [fonteAnalise]), [
    fontePrevisao,
    fonteAnalise,
  ]);
});

test("mantém as fontes da análise quando a previsão não retorna fontes", () => {
  const fonteAnalise = {
    tool: "busca_conhecimento",
    label: "Base técnica",
  };

  assert.deepEqual(mesclarFontesAnalise(undefined, [fonteAnalise]), [fonteAnalise]);
});
