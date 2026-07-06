import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFileSync } from "node:fs";

const tamanhos = [16, 32, 48, 64, 128, 256];
const svgPath = "build/icon.svg";

const buffers = await Promise.all(tamanhos.map((t) => sharp(svgPath).resize(t, t).png().toBuffer()));

// PNG grande para uso geral (ex.: ícone da janela em telas HiDPI)
writeFileSync("build/icon.png", await sharp(svgPath).resize(512, 512).png().toBuffer());

const icoBuffer = await pngToIco(buffers);
writeFileSync("build/icon.ico", icoBuffer);

console.log("Ícone gerado: build/icon.ico e build/icon.png");
