var Picture = class Picture {
  constructor(width, height, pixels, routers, measurements, walls, gradient = false) {
    this.width = width;
    this.height = height;
    this.pixels = pixels;
    this.routers = routers;
    this.measurements = measurements;
    this.walls = walls;
    this.gradient = gradient;
  }

  empty(width, height, color) {
    let pixels = new Array(width * height).fill(color);
    return new Picture(width, height, pixels, [], [], []);
  }

  pixel(x, y) {
    return this.pixels[x + y * this.width];
  }

  find_router(x, y) {
    return this.routers.findIndex(item => (Math.abs(item.x - x) < 2) && (Math.abs(item.y - y) < 2));
  }

  find_measurement(x, y) {
    return this.measurements.findIndex(item => (Math.abs(item.x - x) < 3) && (Math.abs(item.y - y) < 3));
  }

  draw(pixels) {
    let copy = this.pixels.slice();
    for (let {x, y, color} of pixels) { 
      copy[x + y * this.width] = color;
    }
    return new Picture(this.width, this.height, copy, this.routers, this.measurements, this.walls);
  }
}
module.exports = Picture

function elt(type, props, ...children) {
  let dom = document.createElement(type);
  if (props) Object.assign(dom, props);
  for (let child of children) {
    if (typeof child != "string") dom.appendChild(child);
    else dom.appendChild(document.createTextNode(child));
  }
  return dom;
}

var wall_scale = 0;
var scale = 5;
var position = {};

var PictureCanvas = class PictureCanvas {
  constructor(picture, pointerDown, pointerUp) {
    this.dom = elt("canvas", {
      onmousedown: event => this.mouse(event, pointerDown),
      onmouseup: event => this.mouse(event, pointerUp),
      ontouchstart: event => this.touch(event, pointerDown)
    });
    this.syncState(picture);
  }

  syncState(picture) {
    this.picture = picture;
    drawPicture(this.picture, this.dom, scale);
  }
}
module.exports = PictureCanvas

function drawPicture(picture, canvas, scale) {
  canvas.width = picture.width * scale;
  canvas.height = picture.height * scale;
  let cx = canvas.getContext("2d");
  for (let y = 0; y < picture.height; y++) {
    for (let x = 0; x < picture.width; x++) {
      cx.fillStyle = picture.pixel(x, y);
      cx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  for (let {x, y} of picture.routers) {
    var img = new Image();
    img.src = "<%= asset_path('router.png') %>";
    img.onload = function() {
        cx.drawImage(img, (x-2) * scale, (y-2) * scale, 5*scale, 5*scale);
    };
  }
  for (let {x, y} of picture.measurements) {
    var img2 = new Image();
    img2.src = "<%= asset_path('circle.png') %>";
    img2.onload = function() {
        cx.drawImage(img2, (x-2) * scale, (y-2) * scale, 3*scale, 3*scale);
    };
  }
  if (picture.height > 150) {
    let steps = Math.floor(picture.height / 160);
    cx.font = "40px serif";
    cx.fillStyle = "#000";
    for (let i = 0; i < steps; ++i) {
      cx.fillText(`Этаж ${i+1}:`, 2*scale, (i*160+9)*scale);
    }
  }
}

PictureCanvas.prototype.mouse = function(downEvent, onDown) {
  if (downEvent.button != 0) return;
  let pos = pointerPosition(downEvent, this.dom);
  let onMove = onDown(pos);
  if (!onMove) return;
  let move = moveEvent => {
    if (moveEvent.buttons == 0) {
      this.dom.removeEventListener("mousemove", move);
    } else {
      let newPos = pointerPosition(moveEvent, this.dom);
      if (newPos.x == pos.x && newPos.y == pos.y) return;
      pos = newPos;
      onMove(newPos);
    }
  };
  this.dom.addEventListener("mousemove", move);
};

function pointerPosition(pos, domNode) {
  let rect = domNode.getBoundingClientRect();
  return {x: Math.floor((pos.clientX - rect.left) / scale),
          y: Math.floor((pos.clientY - rect.top) / scale)};
}

var PixelEditor = class PixelEditor {
  constructor(state, document, config) {
    let {tools, controls, dispatch} = config;
    this.state = state;
    this.canvas = new PictureCanvas(state.picture, pos => {
      let tool = tools[this.state.tool];
      let onMove;
      if (tool == measure) {
        let res = this.state.picture.find_measurement(pos.x, pos.y);
        if (res == -1) {
          window.mesDialog.showModal();
        } else {
          this.state.picture.measurements.splice(res, 1);
          dispatch({picture: this.state.picture.draw([])});
        }
        position = pos;
        window.mesDialog.addEventListener("close", () => {
          let value = document.getElementById("mesDialog").returnValue;
          if (value) {
            onMove = measure(position, this.state, dispatch, value);
            document.getElementById("mesDialog").returnValue = "";
            document.getElementById("measurement").value = "";
          }
        });
      } else if (tool == router) {
        let res = this.state.picture.find_router(pos.x, pos.y);
        if (res == -1) {
          window.routerDialog.showModal();
        } else {
          this.state.picture.routers.splice(res, 1);
          dispatch({picture: this.state.picture.draw([])});
        }
        position = pos;
        window.routerDialog.addEventListener("close", () => {
          let value = document.getElementById("routerDialog").returnValue;
          let parsed = {};
          let pairs = value.split(",");
          for (let i = 0, len = pairs.length, keyVal; i < len; ++i) {
            keyVal = pairs[i].split(":");
            if (keyVal[0]) {
              parsed[keyVal[0]] = keyVal[1];
            }
          }
          if (parsed.coef) {
            onMove = router(position, this.state, dispatch, parsed);
            document.getElementById("routerDialog").returnValue = "";
            document.getElementById("router_coef").value = "";
          }
        });
      } else if (tool == line) {
        this.state.picture.walls.push({x: pos});
        onMove = line(pos, this.state, dispatch);
        window.wallDialog.addEventListener("close", () => {
          let value = document.getElementById("wallDialog").returnValue;
          if (value) {
            let wall = this.state.picture.walls.pop();
            wall['thickness'] = Number(value);
            if (wall_scale == 0) {
              window.length_single_Dialog.showModal();
            } else {
              wall['length'] = Math.sqrt(Math.pow(Math.abs(wall.x.x - wall.y.x), 2) + Math.pow(Math.abs(wall.x.y - wall.y.y), 2)) * wall_scale;
            }
            this.state.picture.walls.push(wall);
            document.getElementById("wallDialog").returnValue = "";
            document.getElementById("wall_thickness").value = "";
          }
        });
        window.length_single_Dialog.addEventListener("close", () => {
          let value = document.getElementById("length_single_Dialog").returnValue;
          let wall = this.state.picture.walls.pop();
          wall_scale = value / Math.sqrt(Math.pow(Math.abs(wall.x.x - wall.y.x), 2) + Math.pow(Math.abs(wall.x.y - wall.y.y), 2));
          wall['length'] = Number(value);
          this.state.picture.walls.push(wall);
        });
      } else if (tool == rectangle) {
        this.state.picture.walls.push({x: pos});
        onMove = rectangle(pos, this.state, dispatch);
        window.rectDialog.addEventListener("close", () => {
          let value = document.getElementById("rectDialog").returnValue;
          if (value) {
            let length = this.state.picture.walls.length;
            for (let i = 1; i < 5; ++i) {
              this.state.picture.walls[length - i]['thickness'] = Number(value);
            }
            if (wall_scale == 0) {
              window.length_rect_Dialog.showModal();
            } else {
              for (let i = 1; i < 5; ++i) {
                let wall = this.state.picture.walls[length - i];
                wall['length'] = (Math.abs(wall.x.x - wall.y.x) + Math.abs(wall.x.y - wall.y.y)) * wall_scale;
              }
            }
            document.getElementById("rectDialog").returnValue = "";
            document.getElementById("rect_thickness").value = "";
          }
        });
        window.length_rect_Dialog.addEventListener("close", () => {
          let value = document.getElementById("length_rect_Dialog").returnValue;
          let wall_1 = this.state.picture.walls.pop();
          let wall_2 = this.state.picture.walls.pop();
          let wall_1_length = Math.abs(wall_1.x.x - wall_1.y.x) + Math.abs(wall_1.x.y - wall_1.y.y);
          let wall_2_length = Math.abs(wall_2.x.x - wall_2.y.x) + Math.abs(wall_2.x.y - wall_2.y.y);
          if (wall_1_length > wall_2_length) {
            wall_scale = value / wall_1_length;
          } else {
            wall_scale = value / wall_2_length;
          }
          this.state.picture.walls.push(wall_2);
          this.state.picture.walls.push(wall_1);
          let length = this.state.picture.walls.length;
          for (let i = 1; i < 5; ++i) {
            let wall = this.state.picture.walls[length - i];
            wall['length'] = (Math.abs(wall.x.x - wall.y.x) + Math.abs(wall.x.y - wall.y.y)) * wall_scale;
          }
        });
      } else {
        onMove = tool(pos, this.state, dispatch);
      }
      if (onMove) return pos => onMove(pos, this.state);
    }, newPos => {
      let tool = tools[this.state.tool];
      document.getElementById('wall_length_label').innerHTML = '';
      document.getElementById('wall_2_length_label').innerHTML = '';
      if (tool == line) {
        let wall = this.state.picture.walls.pop();
        wall['y'] = newPos;
        wall['color'] = this.state.color;
        this.state.picture.walls.push(wall);
        document.getElementById("wall_enter").setAttribute('disabled', 'disabled');
        window.wallDialog.showModal();
      } else if (tool == rectangle) {
        let wall = this.state.picture.walls.pop();
        let oldPos = wall['x'];
        wall['y'] = {x: newPos.x, y: oldPos.y};
        wall['color'] = this.state.color;
        this.state.picture.walls.push(wall);
        this.state.picture.walls.push({x: {x: newPos.x, y: oldPos.y}, y: newPos, color: this.state.color});
        this.state.picture.walls.push({x: newPos, y: {x: oldPos.x, y: newPos.y}, color: this.state.color});
        this.state.picture.walls.push({x: {x: oldPos.x, y: newPos.y}, y: oldPos, color: this.state.color});
        document.getElementById("rect_enter").setAttribute('disabled', 'disabled');
        window.rectDialog.showModal();
      }
    });
    this.controls = controls.map(
      Control => new Control(state, config));
    this.dom = elt("div", {}, this.canvas.dom, elt("br"));
    let contrls = this.controls.reduce(
                    (a, c) => a.concat(" ", c.dom), []);
    let doma = document.getElementById('footer');
    for (let elem of contrls) {
      if (typeof elem != "string") doma.appendChild(elem);
      else doma.appendChild(document.createTextNode(elem));
    }
  }
  syncState(state) {
    this.state = state;
    this.canvas.syncState(this.state.picture);
    for (let ctrl of this.controls) ctrl.syncState(state);
  }
}

var ToolSelect = class ToolSelect {
  constructor(state, {tools, dispatch}) {
    this.select = elt("select", {
      onchange: () => dispatch({tool: this.select.value})
    }, ...Object.keys(tools).map(name => elt("option", {
      selected: name == state.tool
    }, name)));
    this.dom = elt("label", {id: "toolselect"}, "Tool: ", this.select);
  }
  syncState(state) { this.select.value = state.tool; }
}

var ColorSelect = class ColorSelect {
  constructor(state, {colors, dispatch}) {
    this.colors = colors;
    this.select = elt("select", {
      onchange: () => dispatch({color: colors.find(item => item.name == this.select.value).color})
    }, ...colors.map(item => elt("option", {
        selected: item.color == state.color
    }, item.name)));
    this.dom = elt("label", null, "Material: ", this.select);
  }
  syncState(state) {
    this.select.value = this.colors.find(item => item.color == state.color).name; 
  }
}

function drawCircle({x, y}, state, drawn) {
  let radius = state.thickness / 2;
  let radiusC = Math.ceil(radius);
  for (let dy = -radiusC; dy <= radiusC; dy++) {
    for (let dx = -radiusC; dx <= radiusC; dx++) {
      let dist = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
      if (dist > radius) continue;
      let l = y + dy, k = x + dx;
      if (l < 0 || l >= state.picture.height ||
          k < 0 || k >= state.picture.width) continue;
      if ((state.color == "#f0f0f0") && 
          (state.picture.pixel(k,l) == "#d0d0d0")) continue;
      if (state.picture.pixel(k,l) == "#99ff99") continue;
      drawn.push({x: k, y: l, color: state.color});
    }
  }
  return drawn;
}

function drawLine(from, to, state) {
  let points = [];
  if (Math.abs(from.x - to.x) > Math.abs(from.y - to.y)) {
    if (from.x > to.x) [from, to] = [to, from];
    let slope = (to.y - from.y) / (to.x - from.x);
    for (let {x, y} = from; x <= to.x; x++) {
      y_cur = Math.round(y);
      points.push({x, y_cur, color: state.color});
      points = drawCircle({x, y: y_cur}, state, points);
      y += slope;
    }
  } else {
    if (from.y > to.y) [from, to] = [to, from];
    let slope = (to.x - from.x) / (to.y - from.y);
    for (let {x, y} = from; y <= to.y; y++) {
      x_cur = Math.round(x);
      points.push({x: x_cur, y, color: state.color});
      points = drawCircle({x: x_cur, y}, state, points);
      x += slope;
    }
  }
  return points;
}

function line(pos, state, dispatch) {
  return end => {
    let line = drawLine(pos, end, state);
    if (wall_scale != 0) {
      let value = Math.sqrt(Math.pow(Math.abs(pos.x - end.x), 2) + Math.pow(Math.abs(pos.y - end.y), 2)) * wall_scale;
      document.getElementById('wall_length_label').innerHTML = `Длина стены: ${Math.round(value * 100) / 100}см`;
    }
    dispatch({picture: state.picture.draw(line)});
  };
}

function rectangle(start, state, dispatch) {
  function addSide(x1, y1, x2, y2, state, rect) {
    let arr = drawLine({x: x1, y: y1}, {x: x2, y: y2}, state);
    for (let point of arr) {
      rect.push(point);
    }
    return rect;
  }
  function drawRectangle(pos) {
    let xStart = Math.min(start.x, pos.x);
    let yStart = Math.min(start.y, pos.y);
    let xEnd = Math.max(start.x, pos.x);
    let yEnd = Math.max(start.y, pos.y);
    if (wall_scale != 0) {
      let value_1 = (xEnd-xStart) * wall_scale;
      let value_2 = (yEnd-yStart) * wall_scale;
      document.getElementById('wall_length_label').innerHTML = `Длина стены 1: ${Math.round(value_1 * 100) / 100}см`;
      document.getElementById('wall_2_length_label').innerHTML = `Длина стены 2: ${Math.round(value_2 * 100) / 100}см`;
    }
    let rect = [];
    rect = addSide(xStart, yStart, xEnd, yStart, state, rect);
    rect = addSide(xEnd, yStart, xEnd, yEnd, state, rect);
    rect = addSide(xEnd, yEnd, xStart, yEnd, state, rect);
    rect = addSide(xStart, yEnd, xStart, yStart, state, rect);
    dispatch({picture: state.picture.draw(rect)});
  }
  drawRectangle(start);
  return drawRectangle;
}

var around = [{dx: -1, dy: 0}, {dx: 1, dy: 0},
                {dx: 0, dy: -1}, {dx: 0, dy: 1}];

function fill({x, y}, state, dispatch) {
  let targetColor = state.picture.pixel(x, y);
  let drawn = [{x, y, color: state.color}];
  for (let done = 0; done < drawn.length; done++) {
    for (let {dx, dy} of around) {
      let x = drawn[done].x + dx, y = drawn[done].y + dy;
      if (x >= 0 && x < state.picture.width &&
          y >= 0 && y < state.picture.height &&
          state.picture.pixel(x, y) == targetColor &&
          !drawn.some(p => p.x == x && p.y == y)) {
        drawn.push({x, y, color: state.color});
      }
    }
  }
  dispatch({picture: state.picture.draw(drawn)});
}

function pick(pos, state, dispatch) {
  let color = state.picture.pixel(pos.x, pos.y);
  if ((color != "#d0d0d0") || (color != "#99ff99")) color = "#f0f0f0"; 
  dispatch({color: color});
}

function router(pos, state, dispatch, value) {
  state.picture.routers.push({x: pos.x, y: pos.y, coef: value.coef, frequency: value.frequency});
  dispatch({picture: state.picture.draw([])});
}

function measure(pos, state, dispatch, value) {
  state.picture.measurements.push({x: pos.x, y: pos.y, value: value});
  dispatch({picture: state.picture.draw([])});
}

function zones(state, dispatch, params) {
    let xhr = new XMLHttpRequest();
    let json = JSON.stringify({
      pixels: state.picture.pixels,
      routers: state.picture.routers,
      walls: state.picture.walls,
      measurements: state.picture.measurements,
      receiver_coef: params.coef,
      wall_scale: wall_scale
    });
    xhr.open('POST', '/api/v1/zones');
    xhr.setRequestHeader('Content-type', 'application/json; charset=utf-8');
    xhr.responseType = 'json';
    xhr.send(json);
    xhr.onload = function() {
      if (xhr.status != 201) {
        alert(`Error ${xhr.status}: ${xhr.statusText}`);
      } else {
      }
      dispatch({picture: state.picture.draw_zones(xhr.response.pixels)});
    };
}

function erase(state, dispatch) {

}

var EraserButton = class EraserButton {
  constructor(state, {dispatch}) {
    this.picture = state.picture;
    this.dom = elt("button", {
      id: "menu-button",
      onclick: () => erase(state, dispatch)
    }, "Eraser");
  }
  syncState(state) { this.picture = state.picture; }
}

var EraseAllButton = class EraseAllButton {
  constructor(state, {dispatch}) {
    this.picture = Picture.empty(350, 150, "#f0f0f0");
    this.dom = elt("button", {
      id: "menu-button",
      onclick: () => dispatch({color: "#999999", picture: Picture.empty(350, 150, "#f0f0f0")})
    }, "EraseAll");
  }
  syncState(state) { this.picture = state.picture; }
}

var ZonesButton = class ZonesButton {
  constructor(state, {dispatch}) {
    this.state = state;
    this.picture = state.picture;
    this.dom = elt("button", {
      id: "menu-button",
      onclick: () => {
        if (this.state.picture.routers.length == 0) {
          alert("Установите сперва маршрутизатор");
        } else {
          window.zonesDialog.showModal();
        }
      }
    }, "Zones");
    window.zonesDialog.addEventListener("close", () => {
      let value = document.getElementById("zonesDialog").returnValue;
      let parsed = {};
      let pairs = value.split(",");
      for (let i = 0, len = pairs.length, keyVal; i < len; ++i) {
        keyVal = pairs[i].split(":");
        if (keyVal[0]) {
          parsed[keyVal[0]] = keyVal[1];
        }
      }
      if (value) {
        zones(this.state, dispatch, parsed);
        document.getElementById("zonesDialog").returnValue = "";
        document.getElementById("measurement").value = "";
      }
    });
  }
  syncState(state) {
    this.state = state;
    this.picture = state.picture; 
  }
}

var AddFloorButton = class AddFloorButton {
  constructor(state, {dispatch}) {
    this.picture = state.picture;
    this.dom = elt("button", {
      id: "menu-button",
      onclick: () => {
        if (this.picture.height == 150) {
          this.picture.height += 10;
          this.picture.pixels = new Array(this.picture.width * 10).fill("#99ff99").concat(this.picture.pixels);
        }
        let arr = new Array(this.picture.width * 10).fill("#99ff99");
        for (let y = this.picture.height - 150; y < this.picture.height; ++y) {
          for (let x = 0; x < this.picture.width; ++x) {
            let pixel = this.picture.pixel(x,y);
            if (pixel == "#d0d0d0") {
              pixel = "#f0f0f0";
            } else if ((pixel != "#f0f0f0") && (pixel != "#99ff99")) {
              pixel = "#d0d0d0";
            }
            arr.push(pixel);
          }
        }
        this.picture.height += 160;
        this.picture.pixels = this.picture.pixels.concat(arr);
        dispatch({picture: this.picture});
      }
    }, "AddFloor");
  }
  syncState(state) { this.picture = state.picture; }
}

function historyUpdateState(state, action) {
  return Object.assign({}, state, action);
}

var startState = {
  tool: "line",
  color: "#999999",
  thickness: 1,
  picture: Picture.empty(350, 150, "#f0f0f0"),
  gradient: false,
  done: [],
  doneAt: 0
};

var available_colors = ["#99d8f0", "#444c1d", "#44251d", "#796f5a", "#a03623", "#999999", "#738595", "#686c5e", "#99ff99"];

var baseColors = [{name: "гипсокартон", color: "#99d8f0"},
                  {name: "стекло", color: "#444c1d"},
                  {name: "двойное стекло", color: "#44251d"},
                  {name: "дерево", color: "#796f5a"},
                  {name: "кирпич", color: "#a03623"}, 
                  {name: "бетон", color: "#999999"},
                  {name: "металл", color: "#738595"},
                  {name: "железобетон", color: "#686c5e"}];

var baseTools = {line, rectangle, router, measure};

var baseControls = [
  ToolSelect, ColorSelect,  EraseAllButton, AddFloorButton, ZonesButton
];

function startPixelEditor({state = startState,
                           tools = baseTools,
                           colors = baseColors,
                           controls = baseControls}) {
  if (!document.createElement('dialog').showModal) {
    import('/dist/dialog-polyfill.js')
    .then(dialogPolyfill =>
      document.querySelectorAll('dialog')
      .forEach(dialogPolyfill.registerDialog)
    )
  }

  let app = new PixelEditor(state, document, {
    tools,
    colors,
    controls,
    dispatch(action) {
      state = historyUpdateState(state, action);
      app.syncState(state);
    }
  });
  return app.dom;
}

function setMesValue() {
  let button = document.getElementById("measure_enter");
  let value = document.getElementById("measurement").value;
  button.value = value;
}

function setRouterValue() {
  let button = document.getElementById("router_enter");
  let coef = document.getElementById("router_coef").value;
  let frequency = document.querySelector('input[name="freq"]:checked').value;
  let map = {coef: coef, frequency: frequency};
  if (coef) {
    button.value = Object.keys(map).reduce((data, key) => {
      data.push(`${key}:${map[key]}`);
      return data;
    }, []);
  } else {
    button.value = "";
  }
}

function setWallThickness() {
  let button = document.getElementById("wall_enter");
  let value = document.getElementById("wall_thickness").value;
  button.value = value;
}

function checkwallDialog() {
  let button = document.getElementById("wall_enter");
  let value = document.getElementById("wall_thickness").value;
  if (value > 0) button.removeAttribute('disabled');
}

function setrectThickness() {
  let button = document.getElementById("rect_enter");
  let value = document.getElementById("rect_thickness").value;
  button.value = value;
}

function checkrectDialog() {
  let button = document.getElementById("rect_enter");
  let value = document.getElementById("rect_thickness").value;
  if (value > 0) button.removeAttribute('disabled');
}

function setWallLengthSingle() {
  let button = document.getElementById("wall_length_single_enter");
  let value = document.getElementById("wall_length").value;
  button.value = value;
}

function checklengthDialog() {
  let button = document.getElementById("wall_length_single_enter");
  let value = document.getElementById("wall_length").value;
  if (value > 0) button.removeAttribute('disabled');
}

function checklengthrectDialog() {
  let button = document.getElementById("wall_length_rect_enter");
  let value = document.getElementById("rect_length").value;
  if (value > 0) button.removeAttribute('disabled');
}

function setWallLengthRect() {
  let button = document.getElementById("wall_length_rect_enter");
  let value = document.getElementById("rect_length").value;
  button.value = value;
}

function checkzonesDialog() {
  let button = document.getElementById("zones_values");
  let value = document.getElementById("receiver_coef").value;
  if (value > 0) button.removeAttribute('disabled');
}

function setZonesValues() {
  let button = document.getElementById("zones_values");
  let coef = document.getElementById("receiver_coef").value;
  let map = {coef: coef};
  if (coef) {
    button.value = Object.keys(map).reduce((data, key) => {
      data.push(`${key}:${map[key]}`);
      return data;
    }, []);
  } else {
    button.value = "";
  }
}