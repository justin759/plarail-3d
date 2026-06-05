import catalogCsv from "../assets/train/catalog.csv?raw";
import type { TrainCarriageType } from "./types";

interface RawCatalogRow {
  type: TrainCarriageType;
  label: string;
  filename: string;
}

export interface TrainCatalogItem extends RawCatalogRow {
  id: string;
  objUrl: string;
  textureUrl: string;
}

const assetUrls = import.meta.glob<string>("../assets/train/*.{obj,png}", {
  eager: true,
  import: "default",
  query: "?url",
});

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function assetUrl(filename: string, suffix: ".obj" | "_d.png") {
  const key = `../assets/train/${filename}${suffix}`;
  const url = assetUrls[key];
  if (!url) {
    throw new Error(`Missing train asset: ${key}`);
  }
  return url;
}

function parseCatalog(csv: string): TrainCatalogItem[] {
  const [headerLine, ...rows] = csv.trim().split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  const typeIndex = headers.indexOf("type");
  const labelIndex = headers.indexOf("label");
  const filenameIndex = headers.indexOf("filename");

  if (typeIndex === -1 || labelIndex === -1 || filenameIndex === -1) {
    throw new Error("assets/train/catalog.csv must include type,label,filename columns.");
  }

  return rows
    .map((row): RawCatalogRow => {
      const cells = parseCsvLine(row);
      const type = cells[typeIndex] as TrainCarriageType;
      if (type !== "front" && type !== "trailer") {
        throw new Error(`Unsupported train carriage type: ${cells[typeIndex]}`);
      }
      return {
        type,
        label: cells[labelIndex],
        filename: cells[filenameIndex],
      };
    })
    .filter((row) => row.label && row.filename)
    .map((row) => ({
      ...row,
      id: `${row.type}:${row.filename}`,
      objUrl: assetUrl(row.filename, ".obj"),
      textureUrl: assetUrl(row.filename, "_d.png"),
    }));
}

export const trainCatalog = parseCatalog(catalogCsv);
export const frontCarriages = trainCatalog.filter((item) => item.type === "front");
export const trailerCarriages = trainCatalog.filter((item) => item.type === "trailer");

export function getTrainCatalogItem(catalogId: string) {
  return trainCatalog.find((item) => item.id === catalogId) ?? null;
}
