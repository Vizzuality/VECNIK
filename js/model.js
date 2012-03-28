//========================================
// vecnik models
//========================================

(function(VECNIK) {

  // utility
  function Profiler(name){
    this.t0 = 0;
    this.unit = '';
  }
  Profiler.prototype.start = function(unit) {
    this.t0 = new Date().getTime();
    this.unit =  unit || '';
  }
  Profiler.prototype.end= function() {
     var t = new Date().getTime() - this.t0;
     //console.log("PROFILE - " + this.unit + ":" + t);
     return t;
  }

  //========================================
  // tile model 
  //========================================
  function Tile(x, y, zoom) { 
      this.x = x;
      this.y = y;
      this.zoom = zoom;
      this.on('change', this.precache.bind(this))
      this.stats = {
        conversion_time: 0,
        vertices: 0,
        primitive_count: 0
      };
      this.profiler = new Profiler('tile');
  }

  Tile.prototype = new VECNIK.Model();

  Tile.prototype.key = function() {
      return [this.x, this.y, this.zoom].join('-');
  }

  Tile.prototype.geometry = function() {
      return this.data.features;
  }

  Tile.prototype.precache = function() {
      var self = this;
      this.profiler.start('conversion_time');
      var primitives = this.data.features;
      var vertex_count = VECNIK.geometry_stats.vertices;
      if(false && typeof Worker !== undefined) {
        var worker = new Worker('../js/projector.worker.js');
        var ready = 0;
        worker.onmessage = function(ev) {
              this.data.features = ev.data.primitives;
              self.emit('geometry_ready');
        };

         worker.postMessage({
              primitives: primitives,
              zoom: this.zoom, 
              x: this.x, 
              y: this.y
         });

      } else {
        for(var i = 0; i < primitives.length; ++i) {
            var p = primitives[i];
            var converted = VECNIK.project_geometry(p.geometry, this.zoom, this.x, this.y);
            if(converted && converted.length !== 0) {
               p.geometry.projected = converted;
            } else {
               delete p.geometry.coordinates;
               //console.log("problem converting geometries");
            }
        }
        this.emit('geometry_ready');
      }
      this.stats.vertices = VECNIK.geometry_stats.vertices - vertex_count;
      this.stats.primitive_count = primitives.length;
      this.stats.conversion_time = this.profiler.end();
  }


  //========================================
  // tile manager
  //========================================

  function TileManager(dataProvider) {
    this.tiles = {};
    this.dataProvider = dataProvider;
  }

  TileManager.prototype.tileIndex= function(coordinates) {
      return coordinates.toKey();
  }

  TileManager.prototype.get = function(coordinates) {
    return this.tiles[this.tileIndex(coordinates)];
  }

  TileManager.prototype.destroy= function(coordinates) {
    var tile = this.tiles[this.tileIndex(coordinates)];
    tile.destroy();
    console.log("removing " + this.tileIndex(coordinates));
    delete this.tiles[this.tileIndex(coordinates)];
  }

  TileManager.prototype.add = function(coordinates) {
    console.log("adding" + this.tileIndex(coordinates));
    var tile = this.tiles[this.tileIndex(coordinates)] = new Tile(
        coordinates.column, 
        coordinates.row, 
        coordinates.zoom
    );

    VECNIK.get(this.dataProvider.url(coordinates), function(data) {
        tile.set(data);
    });
    return tile;
  }

  VECNIK.Tile = Tile;
  VECNIK.TileManager = TileManager;
  VECNIK.Profiler = Profiler;

})(VECNIK);

if (typeof module !== 'undefined' && module.exports) {
  module.exports.Tile = VECNIK.Tile;
  module.exports.TileManager = VECNIK.TileManager;
}


