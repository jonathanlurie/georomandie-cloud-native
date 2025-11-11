import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import maplibregl, { type FlyToOptions } from "maplibre-gl";
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

  // NYC
  {
    zoom: 13,
    center: {lng: -73.97893, lat: 40.74304}
  },

  // SF
  {
    zoom: 14,
    center: {lng: -122.472697, lat: 37.806629}
  },

  // Rio
  {
    zoom: 14,
    center: {lng: -43.210494, lat: -22.910876}
  },


  // Auckland
  {
    zoom: 15,
    center: {lng: 174.75724, lat: -36.84545}
  },

  // Sidney
  {
    zoom: 15,
    center: {lng: 151.2074, lat: -33.86207}
  },

  // Hong Kong
  {
    zoom: 16,
    center: {lng: 114.161917, lat: 22.279069}
  },

  // Tokyo
  {
    zoom: 15,
    center: {lng: 139.75246, lat: 35.68322}
  },

  // Dubai
  {
    zoom: 15,
    center: {lng: 55.13401, lat: 25.11534}
  },


  // Istanbul
  {
    zoom: 15,
    center: {lng: 28.973688, lat: 41.006644}
  },

  // Venise
  {
    zoom: 16,
    center: {lng: 12.334513, lat: 45.437001}
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

let map: maplibregl.Map;
let counter = 0;
let isAnimating = false;

async function loopAnimate(map: maplibregl.Map) {
  if (!map) return;

  isAnimating = true;

  while(true) {
    counter = counter % places.length;
    
    const shouldContinue = await flyToAsync(map, {
      ...places[counter],
      speed: 0.3,
    });

    if (!shouldContinue) {
      isAnimating = false;
      return;
    }

    await sleepAsync(500);
    counter ++;
  }
}


window.addEventListener("keyup", (e) => {
  e.stopPropagation();
  e.preventDefault();

  if (e.code === "Space" && !isAnimating) {
    loopAnimate(map);
  }
});


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
    hidePOIs: true,
    lang,
    terrain: {
      pmtiles: pmtilesTerrain,
      encoding: terrainTileEncoding,
    },
    globe: true,
  });  

  map = new maplibregl.Map({
    container: appDiv,
    maxPitch: 89,
    hash: false,
    style,
    center: places[0].center,
    zoom: places[0].zoom,
    attributionControl: {
      compact: true,
      customAttribution: [
        "Camptocamp",
      ]
    }
  });

  await new Promise((resolve) => map.on("load", resolve));

  const basemapPmtiles = new PMTiles(pmtiles);
  const basemapPmtilesBytelength = await getPMTilesFileSize(basemapPmtiles);
  const terrainPmtiles = new PMTiles(pmtilesTerrain);
  const terrainPmtilesBytelength = await getPMTilesFileSize(terrainPmtiles);

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
})()