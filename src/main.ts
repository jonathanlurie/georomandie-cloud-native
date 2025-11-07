import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import maplibregl, { type EaseToOptions, type FlyToOptions } from "maplibre-gl";
import {
  Protocol,
  PMTiles,
} from "pmtiles";
import { getStyle } from "basemapkit";
import { getPMTilesFileSize, getTileByteRange } from "./pmtiles-tools";


export type TileIndex = {
  z: number,
  x: number,
  y: number,
}

const lang = "fr";
const pmtiles = "https://fsn1.your-objectstorage.com/public-map-data/pmtiles/planet.pmtiles";
const sprite = "https://raw.githubusercontent.com/jonathanlurie/phosphor-mlgl-sprite/refs/heads/main/sprite/phosphor-diecut";
const glyphs = "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf";
const pmtilesTerrain = "https://fsn1.your-objectstorage.com/public-map-data/pmtiles/terrain-mapterhorn.pmtiles";
const terrainTileEncoding = "terrarium";


const places: FlyToOptions[] = [
  // Lausanne
  {
    zoom: 16,
    center: {lng: 6.634012, lat: 46.520457}
  },

  // Paris
  {
    zoom: 16,
    center: {lng: 2.34918, lat: 48.85366}
  },

  // Madrid
  {
    zoom: 16,
    center: {lng: -3.715176, lat: 40.417034}
  },

  // Reykjavik
  {
    zoom: 16,
    center: {lng: -21.944152, lat: 64.146756}
  },

  // Montreal
  {
    zoom: 16,
    center: {lng: -73.570012, lat: 45.503256}
  },
];


function showOffsetIndicator(rangeBar: HTMLDivElement, percent: number) {
  const percentNonLinear = 1 - (1 - percent) ** 3;

  const indicatorDiv = document.createElement("div");
  indicatorDiv.classList.add("offset-indicator", "fade-out-auto");
  indicatorDiv.style.setProperty("left", `${(percentNonLinear * 100).toFixed(4)}%`)
  rangeBar.appendChild(indicatorDiv);

  const to = setTimeout(() => {
    rangeBar.removeChild(indicatorDiv);
    clearTimeout(to);
  }, 1000);
}


function sleepAsync(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function flyToAsync(map: maplibregl.Map, options: FlyToOptions) {
  return new Promise((resolve, _reject) => {
    
    map.once("moveend", () => {
      resolve(true);
    });

    map.once("touchstart", () => {
      resolve(false);
    });

    map.once("mousedown", () => {
      resolve(false);
    });

    map.flyTo(options);
  });
}



(async () => {

  const appDiv = document.getElementById("app") as HTMLDivElement;
  const rangeBarBasemap = document.getElementById("range-bar-basemap") as HTMLDivElement;
  const rangeBarTerrain = document.getElementById("range-bar-terrain") as HTMLDivElement;

  if (!appDiv || !rangeBarBasemap || !rangeBarTerrain) {
    return;
  }

  maplibregl.addProtocol("pmtiles", new Protocol().tile);

  


  const style = getStyle("avenue", {
    pmtiles,
    sprite,
    glyphs,
    lang,
    terrain: {
      pmtiles: pmtilesTerrain,
      encoding: terrainTileEncoding,
    },
    globe: true,
  });

  const map = new maplibregl.Map({
    container: appDiv,
    maxPitch: 89,
    hash: true,
    style,
    center: [0, 0],
    zoom: 3,
  });

  await new Promise((resolve) => map.on("load", resolve));


  const basemapPmtiles = new PMTiles(pmtiles);
  const basemapPmtilesBytelength = await getPMTilesFileSize(basemapPmtiles);

  const terrainPmtiles = new PMTiles(pmtilesTerrain);
  const terrainPmtilesBytelength = await getPMTilesFileSize(terrainPmtiles);

  console.log(basemapPmtiles);



  


  map.on("move", async () => {
    const coveringTiles = map.coveringTiles({tileSize: 512}).map((val) => ({z: val.canonical.z, x: val.canonical.x, y: val.canonical.y}) as TileIndex);
    const pmtileBasemapRangeInfoPromised = await Promise.allSettled(coveringTiles.map(((ti) => getTileByteRange(basemapPmtiles, ti))));
    const pmtileBasemapRangeInfo = pmtileBasemapRangeInfoPromised.map((promiseInfo) => {
      if (promiseInfo.status === "rejected") {
        return null;
      }
      return promiseInfo.value;
    });

    const pmtileTerrainRangeInfoPromised = await Promise.allSettled(coveringTiles.map(((ti) => getTileByteRange(terrainPmtiles, ti))));
    const pmtileTerrainRangeInfo = pmtileTerrainRangeInfoPromised.map((promiseInfo) => {
      if (promiseInfo.status === "rejected") {
        return null;
      }
      return promiseInfo.value;
    });

    for (let i = 0; i < coveringTiles.length; i += 1) {
      const basemapRangeInfo = pmtileBasemapRangeInfo[i];
      const terrainRangeInfo = pmtileTerrainRangeInfo[i];

      if (basemapRangeInfo) {
        showOffsetIndicator(rangeBarBasemap, basemapRangeInfo.offset / basemapPmtilesBytelength);
      }

      if (terrainRangeInfo) {
        showOffsetIndicator(rangeBarTerrain, terrainRangeInfo.offset / terrainPmtilesBytelength);
      } 
    }
  })


  let lastLocationIndex = 0;
  let counter = 0;

  while(true) {
    lastLocationIndex = (lastLocationIndex + counter) % places.length;
    await flyToAsync(map, {
      ...places[lastLocationIndex],
      speed: 0.7,
    });

    await sleepAsync(1000);
    counter ++;
  }
})()