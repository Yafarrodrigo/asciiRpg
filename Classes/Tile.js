import TILES from "../TILES.js"
import { Utils } from "../Utils/Utils.js"

export default class Tile{
    constructor({id, x, y, tileId, temp, moist, alt}){
        // permanent
        this.id = id
        this.tileId = tileId
        this.x = x
        this.y = y
        this.temp = temp
        this.moist = moist
        this.alt = alt

        this.tempValue = `${(50 * this.temp).toFixed(2)}°`
        this.altValue = `${(this.alt -0.35) >= 0 ? (1000 * (this.alt -0.35)).toFixed(2) : 0}m`
        this.moistValue = `${parseInt(50 * this.moist)}%`

        // variable
        this.biome = TILES[tileId].biome
        this.isSettlement = false
        this.canSpawnSettlement = TILES[tileId].canSpawnSettlement
        this.canPlayerSpawn = TILES[tileId].canSpawnSettlement
        this.canWalk = TILES[tileId].canWalk
        this.canHaveRoad = false
        this.isRoad = false
        this.character = {...TILES[tileId].character[Math.floor(Math.random()*TILES[tileId].character.length)]}
        this.color = TILES[tileId].color

        this.resource = this.getRandomResource(tileId)
        if(this.resource !== null){
            this.canPlayerSpawn = false
            if(this.resource.name === "trees" || this.resource.name === "rocks"){
                this.canWalk = false
            }
        }
    }

    changeTile(tileId){
        const newTile = TILES[tileId]
        this.color = newTile.color
        this.canWalk = newTile.canWalk
        this.canHaveRoad = newTile.canHaveRoad
        if(tileId === "road"){
            this.resource = null
            this.isSettlement = false
            this.isRoad = true
            this.canPlayerSpawn = true
        }else if(newTile.biome === "settlement"){
            this.resource = null
            this.character = null
            this.isSettlement = true
            this.isRoad = false
            this.canPlayerSpawn = false
        }else{
            this.biome = newTile.biome
            this.resource = this.getRandomResource(tileId)
            this.character = newTile.character[Math.floor(Math.random()*newTile.character.length)]
        }
    }

    getRandomResource(tileId){
        return Math.random() > 0.85 ? Utils.weightedRandom(TILES[tileId].resources) : null
    }
}