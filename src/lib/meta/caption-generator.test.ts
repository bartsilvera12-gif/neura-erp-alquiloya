// Tests del caption generator. Corre con:
// node --experimental-strip-types --test src/lib/meta/caption-generator.test.ts

import test from "node:test";
import assert from "node:assert/strict";

const { generateCaption } = await import("./caption-generator.ts");

test("caption con todos los datos incluye titulo, precio, ubicacion, features, URL", () => {
  const out = generateCaption({
    titulo: "Departamento amplio en zona centrica",
    descripcion: "Departamento de 2 dormitorios, cocina equipada",
    operacion: "alquiler",
    tipo: "depto",
    ciudad: "Asuncion",
    barrio: "Villa Morra",
    precio: 5000000,
    moneda: "PYG",
    precio_periodo: "mensual",
    dormitorios: 2,
    banos: 1,
    cocheras: 1,
    superficie_m2: 80,
    codigo: "AY-PUB-123",
    publicUrl: "https://alquiloya.com.py/publico?prop=xyz",
  });
  assert.match(out, /Departamento amplio en zona centrica/);
  assert.match(out, /En alquiler/);
  assert.match(out, /Gs\. 5\.000\.000/);
  assert.match(out, /\/ mensual/);
  assert.match(out, /Villa Morra, Asuncion/);
  assert.match(out, /2 dormitorios/);
  assert.match(out, /alquiloya\.com\.py\/publico\?prop=xyz/);
  assert.match(out, /AY-PUB-123/);
  assert.match(out, /#AlquiloYa/);
});

test("caption sin datos opcionales no inventa nada", () => {
  const out = generateCaption({
    titulo: "Casa simple",
  });
  assert.match(out, /Casa simple/);
  assert.doesNotMatch(out, /dormitorio/);
  assert.doesNotMatch(out, /Gs\./);
  assert.doesNotMatch(out, /📍/);
  // Solo titulo + hashtags
  assert.match(out, /#AlquiloYa/);
});

test("dormitorios en singular cuando es 1", () => {
  const out = generateCaption({ titulo: "x", dormitorios: 1, banos: 1, cocheras: 1 });
  assert.match(out, /1 dormitorio /);
  assert.match(out, /1 baño /);
  assert.match(out, /1 cochera/);
});

test("USD se formatea con prefijo USD", () => {
  const out = generateCaption({ titulo: "x", precio: 250000, moneda: "USD" });
  assert.match(out, /USD 250000/);
});

test("descripcion mayor a 400 chars se trunca con ...", () => {
  const desc = "a".repeat(500);
  const out = generateCaption({ titulo: "x", descripcion: desc });
  assert.match(out, /a{397}\.\.\./);
});

test("maxLength trunca el caption entero", () => {
  const out = generateCaption(
    { titulo: "titulo repetido ".repeat(100), descripcion: "descripcion" },
    { maxLength: 100 },
  );
  assert.ok(out.length <= 100, "caption respeta maxLength");
  assert.match(out, /\.\.\.$/);
});

test("hashtags custom reemplazan los default", () => {
  const out = generateCaption(
    { titulo: "x" },
    { hashtags: ["#TestOne", "#TestTwo"] },
  );
  assert.match(out, /#TestOne/);
  assert.match(out, /#TestTwo/);
  assert.doesNotMatch(out, /#AlquiloYa/);
});

test("operacion desconocida no rompe (skip)", () => {
  const out = generateCaption({ titulo: "x", operacion: "cesion" });
  assert.doesNotMatch(out, /En cesion/);
  assert.match(out, /x/);
});

test("precio 0 o negativo no se muestra", () => {
  const out1 = generateCaption({ titulo: "x", precio: 0, moneda: "PYG" });
  const out2 = generateCaption({ titulo: "x", precio: -100, moneda: "PYG" });
  assert.doesNotMatch(out1, /Gs\./);
  assert.doesNotMatch(out2, /Gs\./);
});
