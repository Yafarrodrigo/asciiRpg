import CONFIGS from "../CONFIGS.js";
import MapGenerator from "../MapGenerator/MapGenerator.js";
import Tile from "./Tile.js";

export default class Map{
    constructor(width, height, randomGen, seed){
        this.width = width
        this.height = height
        this.tileSize = CONFIGS.mapTileSize
        this.cols = Math.floor(this.width / this.tileSize)
        this.rows = Math.floor(this.height / this.tileSize)
        this.random = randomGen
        this.mapGen = new MapGenerator(width, height, randomGen, seed)
        this.tiles = []
        this.settlements = []
        this.paths = []

        this.mapGen.mapGenWorker = new Worker("/Workers/MapGenWorker.js", {type: "module"})
        this.mapGen.mapGenWorker.postMessage({txt:"start", seed})
        this.mapGen.mapGenWorker.onmessage = ({data}) => {
            if(data.txt === "finished terrain"){
                this.tiles = new Array(this.cols).fill(null).map( () => new Array(this.rows).fill(null))
                for(let x = 0; x < this.cols; x++){
                    for(let y = 0; y < this.rows; y++){
                        const {id,biome,temp,moist,alt,canSpawnSettlement} = data.map[x][y]
                        this.tiles[x][y] = new Tile({id,x,y,biome,temp,moist,alt,canSpawnSettlement})
                    }
                }
                this.mapGen.seeds = data.seeds
                
                // update UI
                document.getElementById('map-seed-info').innerText = seed
                document.getElementById('alt-seed-info').innerText = data.seeds.altitude
                document.getElementById('moist-seed-info').innerText = data.seeds.moisture
                document.getElementById('temp-seed-info').innerText = data.seeds.temperature
                document.getElementById("progress").innerHTML = "0%"
                document.getElementById("progressTxt").innerHTML = "Generating Settlements"

                this.mapGen.mapGenWorker.postMessage({txt:"add settlements"})
            }
            else if(data.txt === "finished settlements"){
                this.settlements = data.settlements.filter( set => set.isConnected)
                document.getElementById("progress").innerHTML = "100%"

                // add roads
                this.paths = data.roads
                this.paths.forEach( path => path.forEach( ({x,y}) => {
                    this.tiles[x][y].changeTile("road")
                }))

                document.getElementById("progressTxt").innerHTML = "Done"
                document.getElementById("progress").innerHTML = ""
                this.mapGen.genAvailable = true
            }
            else if (data.txt === "progress") {
                document.getElementById("progress").innerText = data.progress +"%"
            }
        }
    }

    updateNeighbours(){
        for(let x = 0; x < this.tiles.length; x++){
            for(let y = 0; y < this.tiles[0].length; y++){
                this.tiles[x][y].f = 0 // F = G + H
                this.tiles[x][y].g = 0
                this.tiles[x][y].h = 0
                this.tiles[x][y].neighbors = []
                this.tiles[x][y].previous = null
                if(x > 0 && x < this.tiles.length-1 && y > 0 && y < this.tiles[0].length-1){
                    this.tiles[x][y].neighbors.push(this.tiles[x+1][y])
                    this.tiles[x][y].neighbors.push(this.tiles[x-1][y])
                    this.tiles[x][y].neighbors.push(this.tiles[x][y+1])
                    this.tiles[x][y].neighbors.push(this.tiles[x][y-1])
                    // diagonals
                    this.tiles[x][y].neighbors.push(this.tiles[x+1][y+1])
                    this.tiles[x][y].neighbors.push(this.tiles[x-1][y-1])
                    this.tiles[x][y].neighbors.push(this.tiles[x-1][y+1])
                    this.tiles[x][y].neighbors.push(this.tiles[x+1][y-1])
                }
            }
        }
        return true
    }
}
