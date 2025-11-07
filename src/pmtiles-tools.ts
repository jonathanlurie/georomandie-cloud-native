import { findTile, type PMTiles, zxyToTileId } from "pmtiles";
import type { TileIndex } from "./main";



/**
 * Get the HTTP byte offset and length for a specific tile
 */
export async function getTileByteRange(
  pmtiles: PMTiles,
  tileIndex: TileIndex,
): Promise<{ offset: number; length: number } | null> {
  const {z, x, y} = tileIndex;
  
  // Convert tile coordinates to Hilbert tile ID
  const tileId = zxyToTileId(z, x, y);
  
  // Get the header
  const header = await pmtiles.getHeader();
  
  // Check if tile is within valid zoom range
  if (z < header.minZoom || z > header.maxZoom) {
    return null;
  }
  
  // Start with root directory
  let directoryOffset = header.rootDirectoryOffset;
  let directoryLength = header.rootDirectoryLength;
  
  // Navigate through up to 3 levels of directories
  for (let depth = 0; depth <= 3; depth++) {
    const directory = await pmtiles.cache.getDirectory(
      pmtiles.source,
      directoryOffset,
      directoryLength,
      header
    );
    
    const entry = findTile(directory, tileId);
    
    if (entry) {
      if (entry.runLength > 0) {
        // Found the tile! Return the byte range
        return {
          offset: header.tileDataOffset + entry.offset,
          length: entry.length
        };
      }
      
      // Need to go deeper into leaf directory
      directoryOffset = header.leafDirectoryOffset + entry.offset;
      directoryLength = entry.length;
    } else {
      // Tile not found
      return null;
    }
  }
  
  throw new Error("Maximum directory depth exceeded");
}


/**
 * Get the total size of the PMTiles file
 */
export async function getPMTilesFileSize(pmtiles: PMTiles): Promise<number> {
  const header = await pmtiles.getHeader();
  
  // The file size is the tile data offset + tile data length
  // This represents the last byte of actual data in the archive
  if (header.tileDataLength !== undefined) {
    return header.tileDataOffset + header.tileDataLength;
  }
  
  // If tileDataLength is not set, you need to calculate it
  // by finding the end of the last tile
  throw new Error('tileDataLength not available in header');
}
