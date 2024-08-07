import mulberry32 from "../Utils/mulberry32.js"
import Noise from "../Utils/perlin.js"
import {Utils} from "../Utils/Utils.js"
import Tile from "../Classes/Tile.js"
import Settlement from "../Classes/Settlement.js"
import CONFIGS from "../CONFIGS.js"
import FindPath from "../Utils/AStar.js"

let random
let working = false
const mapValues = {}

onmessage = function({data}) {
    if(working) return
    working = true
    if(data.txt === "start"){

        random = mulberry32(data.seed*9999)
        const noise = new Noise()
        console.time("terrain")
        const {terrainMap: map, possibleSettlementSpawns, seeds} = generateMap(random,noise)
        console.timeEnd("terrain")
        mapValues.terrainMap = map
        mapValues.possibleSettlementSpawns = possibleSettlementSpawns
        postMessage({txt:"finished terrain", map, seeds})
    }
    else if(data.txt === "add settlements"){
        
        console.time("settlements")
        const {settlements, MAP} = placeRandomSettlements()
        console.timeEnd("settlements")
        mapValues.terrainMap = MAP
        mapValues.settlements = settlements

        console.time("roads")
        const roads = connectSettlements(random)
        console.timeEnd("roads")

        postMessage({txt:"finished settlements", settlements, roads})
    }
    working = false
}

function generateMap(random, noise){

    const cols = Math.floor(CONFIGS.mapWidth / CONFIGS.mapTileSize)
    const rows = Math.floor(CONFIGS.mapHeight / CONFIGS.mapTileSize)
    const { temperature:t, moisture:m, altitude:a } = CONFIGS.perlin
    const terrainMap = new Array(cols).fill(null).map( () => new Array(rows).fill(null))
    const mapData = {}
    const possibleSettlementSpawns = []
    const seeds = {
        temperature: 0,
        moisture: 0,
        altitude: 0
    }

    const tempNoiseMap = generateNoiseMap(noise, random, rows,cols, t.scale, t.frequency, t.octaves, t.persistance, t.lacunarity)
    mapData.temperature = tempNoiseMap.map
    seeds.temperature = tempNoiseMap.seed

    const moistNoiseMap = generateNoiseMap(noise, random, rows, cols, m.scale, m.frequency, m.octaves, m.persistance, m.lacunarity)
    mapData.moisture = moistNoiseMap.map
    seeds.moisture = moistNoiseMap.seed

    const altNoiseMap = generateNoiseMap(noise, random, rows, cols, a.scale, a.frequency, a.octaves, a.persistance, a.lacunarity)
    mapData.altitude = altNoiseMap.map
    seeds.altitude = altNoiseMap.seed
    
    let counter = 0
    let progress = 0
    for(let x = 0; x < cols; x++){
        for(let y = 0; y < rows; y++){
            const temp = mapData.temperature[x][y]
            const alt = mapData.altitude[x][y]
            const moist = mapData.moisture[x][y]

            progress = Math.floor(counter++ / (cols * rows) * 100)
            if(progress % 5 === 0) postMessage({txt:"progress", progress})

            let id = y + (x*cols)
            // my abajo -> agua
            if(Utils.between(alt, 0, 0.3)){
                terrainMap[x][y] = new Tile({id,x,y,tileId:"deepWater", temp,moist,alt})
            }
            else if(Utils.between(alt, 0.3, 0.35)){
                terrainMap[x][y] = new Tile({id,x,y,tileId:"water", temp,moist,alt})
            }
            // entre el agua y lo demas -> playa
            else if(Utils.between(alt, 0.35, 0.4)){
                terrainMap[x][y] = new Tile({id,x,y,tileId:"beach", temp,moist,alt})
                possibleSettlementSpawns.push({x,y})
            }
            // lo demas, pero no muuuy alto -> diferentes biomas
            else if(Utils.between(alt, 0.4, 0.7)){
                // plains
                if(moist <= 0.8 && Utils.between(temp,0.1,0.5) || moist <= 0.7 && Utils.between(temp,0.5,0.7)){
                    terrainMap[x][y] = new Tile({id,x,y,tileId:"plains", temp,moist,alt})
                    possibleSettlementSpawns.push({x,y})
                // forest
                }else if(Utils.between(moist, 0.8,0.9) && Utils.between(temp,0.1,0.5)){
                    terrainMap[x][y] = new Tile({id,x,y,tileId:"forest", temp,moist,alt})
                    possibleSettlementSpawns.push({x,y})
                }
                // jungle
                else if (Utils.between(moist,0.7,0.9) && Utils.between(temp,0.5,1)){
                    terrainMap[x][y] = new Tile({id,x,y,tileId:"jungle", temp,moist,alt})
                    possibleSettlementSpawns.push({x,y})
                }
                // desert
                else if ((moist <= 0.7 && temp >= 0.7)){
                    terrainMap[x][y] = new Tile({id,x,y,tileId:"desert", temp,moist,alt})
                    possibleSettlementSpawns.push({x,y})
                }
                // oasis
                else if((moist >= 0.9 && temp >= 0.7)){
                    terrainMap[x][y] = new Tile({id,x,y,tileId:"oasis", temp,moist,alt})
                }
                // water (lakes,rivers)
                else if (moist >= 0.9 && temp >= 0.1){
                    terrainMap[x][y] = new Tile({id,x,y,tileId:"lake", temp,moist,alt})
                }else{
                    terrainMap[x][y] = new Tile({id,x,y,tileId:"plains", temp,moist,alt})
                }
            }
            // arriba de todo montañas y nieve
            else{
                if(alt > 0.925 && temp < 0.2) terrainMap[x][y] = new Tile({id,x,y,tileId:"snow", temp,moist,alt})
                else if(alt > 0.9) terrainMap[x][y] = new Tile({id,x,y,tileId:"highMountain", temp,moist,alt})
                else if(alt > 0.8) terrainMap[x][y] = new Tile({id,x,y,tileId:"midMountain", temp,moist,alt})
                else if(alt > 0.7){
                    terrainMap[x][y] = new Tile({id,x,y,tileId:"lowMountain", temp,moist,alt})
                    possibleSettlementSpawns.push({x,y})
                }
                else terrainMap[x][y] = new Tile({id,x,y,tileId:"plains", temp,moist,alt})
            }
        }
    }
    
    return {terrainMap,possibleSettlementSpawns, seeds}
}

function generateNoiseMap(noise, random, rows, cols, scale, freq, octaves, persistance, lacunarity){
    const seed = random()
    noise.seed(seed)
    const map = new Array(cols).fill(null).map( () => new Array(rows).fill(null))
    let minNoiseHeight = 0
    let maxNoiseHeight = 0
    for(let x = 0; x < cols; x++){
        for(let y = 0; y < rows; y++){

            let noiseHeight = 0
            let frequency = freq
            let amplitude = 1

            for(let i = 0; i < octaves; i++){
                const sampleX = x / scale * frequency
                const sampleY = y / scale * frequency

                const value = Math.abs(noise.perlin2(sampleX,sampleY) + 0.5) // el +0.5 es dudoso
                noiseHeight += value * amplitude

                amplitude *= persistance
                frequency *= lacunarity
            }

            if(noiseHeight > maxNoiseHeight) maxNoiseHeight = noiseHeight
            else if(noiseHeight < minNoiseHeight) minNoiseHeight = noiseHeight

            map[x][y] = noiseHeight
        }
    }

    for(let x = 0; x < cols; x++){
        for(let y = 0; y < rows; y++){
            map[x][y] = Utils.invlerp(minNoiseHeight,maxNoiseHeight,map[x][y])
        }
    }
    
    return {map,seed}
}

// sketchy pero funciona
function placeRandomSettlements(){
    const qty = CONFIGS.qtySettlements
    const possibleSettlementSpawns = mapValues.possibleSettlementSpawns
    const MAP = mapValues.terrainMap
    let randomIndex
    let x,y
    let distances = []
    let safeCounter = 0
    let idCounter = 0
    let settlements = []
    // first settlement
    randomIndex = Math.floor(random()*possibleSettlementSpawns.length)
    x = possibleSettlementSpawns[randomIndex].x
    y = possibleSettlementSpawns[randomIndex].y
    MAP[x][y].isSettlement = true
    MAP[x][y].settlementId = idCounter
    idCounter++
    settlements.push(new Settlement(MAP[x][y].x,MAP[x][y].y))

    for(let i = 0; i < qty-1; i++){
        let found = false
        while(found === false && safeCounter <= 1000){  // pick random position -> check distances with all other settlements
            
            distances = []
            randomIndex = Math.floor(random()*possibleSettlementSpawns.length)

            x = possibleSettlementSpawns[randomIndex].x
            y = possibleSettlementSpawns[randomIndex].y
            
            for(let j = 0; j < settlements.length; j++){
                let xx = settlements[j].x
                let yy = settlements[j].y
                distances.push(Utils.distance(x,y,xx,yy))
            }
            const minDistBetween = Math.floor(MAP.length / (qty/5))
            if(distances.filter( dist => dist < minDistBetween).length == 0) found = true
            safeCounter++
        }
        if(found === true){
            MAP[x][y].isSettlement = true
            MAP[x][y].settlementId = idCounter
            idCounter++
            settlements.push(new Settlement(MAP[x][y].x,MAP[x][y].y)) 
        }
    }

    return {settlements,MAP}
}

function connectSettlements(random){
    const settlements = mapValues.settlements
    const map = mapValues.terrainMap
    const paths = []
    let nearestSettlement = null
    let farthestSettlement = null
    let minDist = Number.POSITIVE_INFINITY
    let maxDist = 0
    let counter = 0
    let progress = 0

    for(let i = 0; i < settlements.length; i++){
        const settlement = settlements[i]
        for(let j = 0; j < settlements.length; j++){
        
            progress = Math.floor(counter++ / (Math.pow(settlements.length,2)) * 100)
            postMessage({txt:"progress",progress:progress})

            const currentTarget = settlements[j]
            const {x,y} = settlement
            const {x:x2,y:y2} = currentTarget

            if(x === x2 && y === y2) continue

            const dist = Utils.distance(x,y,x2,y2)

            if(dist < minDist){
                minDist = dist
                nearestSettlement = currentTarget
            }
            if(dist > maxDist){
                maxDist = dist
                farthestSettlement = currentTarget
            }
        }
        
        let newPath
        if(nearestSettlement !== null){
            newPath = FindPath(settlement,nearestSettlement,map)
            if(newPath !== undefined && newPath.length >1){
                paths.push(newPath)
                settlement.isConnected = true
                nearestSettlement.isConnected = true
            } 
            
         }
        /* if(farthestSettlement !== null){
            newPath = FindPath(settlement,farthestSettlement,map)
            if(newPath !== undefined  && newPath.length >1){
                paths.push(newPath)
                settlement.isConnected = true
                farthestSettlement.isConnected = true
            }
        } */
    }

    return paths
}