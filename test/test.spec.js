const Picture = require("../my_code");
const PictureCanvas = require("../my_code");

describe("Picture", () => {
  const picture = new Picture(2, 1, ["#999999", "#666666"], [{ "x": 11, "y": 9, "coef": "3", "frequency": "5.0" }], [{x: 81, y: 50, value: "-0.28"}], []);
  
  test("tests Picture.empty()", () => {
    const emptySpy = jest.spyOn(picture, "empty");
    picture.empty(1, 2, "#f0f0f0");
    expect(emptySpy).toHaveBeenCalledWith(1, 2, "#f0f0f0");
    expect(emptySpy).toHaveReturnedWith({"gradient": false, "height": 2, "measurements": [], "pixels": ["#f0f0f0", "#f0f0f0"], "routers": [], "walls": [], "width": 1});
  });

  test("tests Picture.pixel()", () => {
    const pixelSpy = jest.spyOn(picture, "pixel");
    picture.pixel(0, 0);
    expect(pixelSpy).toHaveBeenCalledWith(0, 0);
    expect(pixelSpy).toHaveReturnedWith("#999999");
  });

  test("tests Picture.find_router()", () => {
    const routerSpy = jest.spyOn(picture, "find_router");
    picture.find_router(10, 10);
    expect(routerSpy).toHaveBeenCalledWith(10, 10);
    expect(routerSpy).toHaveReturnedWith(0);
  });

  test("tests Picture.find_measurement()", () => {
    const measurementSpy = jest.spyOn(picture, "find_measurement");
    picture.find_measurement(80, 49);
    expect(measurementSpy).toHaveBeenCalledWith(80, 49);
    expect(measurementSpy).toHaveReturnedWith(0);
  });

  test("tests Picture.draw()", () => {
    const drawSpy = jest.spyOn(picture, "draw");
    picture.draw([{"x": 1, "y": 0, "color": "#999999"}]);
    expect(drawSpy).toHaveBeenCalledWith([{"x": 1, "y": 0, "color": "#999999"}]);
    expect(drawSpy).toHaveReturnedWith({"gradient": false, "height": 1, "measurements": [{"value": "-0.28", "x": 81, "y": 50}], "pixels": ["#999999", "#999999"], "routers": [{"coef": "3", "frequency": "5.0", "x": 11, "y": 9}], "walls": [], "width": 2});
  });
});

describe("PictureCanvas", () => {
  picture = {"gradient": false, "height": 1, "measurements": [{"value": "-0.28", "x": 81, "y": 50}], "pixels": ["#999999", "#999999"], "routers": [{"coef": "3", "frequency": "5.0", "x": 11, "y": 9}], "walls": [], "width": 2};
  spyOn("../my_code", 'elt').and.returnValue(true);
  const pictureCanvas = new PictureCanvas(picture);

  test("tests PictureCanvas.syncState()", () => {
    spyOn("../my_code", 'drawPicture').and.returnValue(true);
    const syncSpy = jest.spyOn(pictureCanvas, "syncState");
    pictureCanvas.syncState(picture);
    expect(syncSpy).toHaveBeenCalledWith(picture);
    expect(syncSpy).toHaveReturnedWith("#999999");
  });
});

const state = { "tool": "line", "color": "#999999", "thickness": 1, "picture": Picture.empty(350, 150, "#f0f0f0")};
const tools = {line, rectangle, router, measure};
const config = [ ToolSelect, ColorSelect,  EraseAllButton, AddFloorButton, ZonesButton];
const colors = [{"name": "гипсокартон", "color": "#99d8f0"},
                {"name": "стекло", "color": "#444c1d"},
                {"name": "двойное стекло", "color": "#44251d"},
                {"name": "дерево", "color": "#796f5a"},
                {"name": "кирпич", "color": "#a03623"}, 
                {"name": "бетон", "color": "#999999"},
                {"name": "металл", "color": "#738595"},
                {"name": "железобетон", "color": "#686c5e"}]
jest.mock("./dispatch", () => () => true);

describe("PixelEditor", () => {
  test("tests PixelEditor.syncState()", () => {
    const pixelEditor = new PixelEditor(state, document, config);
    const syncSpy = jest.spyOn(pixelEditor, "syncState");
    const toolSpy = jest.spyOn(new ToolSelect(state, {tools, dispatch}), "syncState");
    const colorSpy = jest.spyOn(new ColorSelect(state, {colors, dispatch}), "syncState");
    const eraseSpy = jest.spyOn(new EraseAllButton(state, {dispatch}), "syncState");
    const addfloorSpy = jest.spyOn(new AddFloorButton(state, {dispatch}), "syncState");
    const zonesSpy = jest.spyOn(new ZonesButton(state, {dispatch}), "syncState");
    pixelEditor.syncState(state);
    expect(syncSpy).toHaveBeenCalled();
    expect(toolSpy).toHaveBeenCalled();
    expect(colorSpy).toHaveBeenCalled();
    expect(eraseSpy).toHaveBeenCalled();
    expect(addfloorSpy).toHaveBeenCalled();
    expect(zonesSpy).toHaveBeenCalled();
  });
});

describe("ToolSelect", () => {
  test("tests ToolSelect.syncState()", () => {
    const toolselect = new ToolSelect(state, {tools, dispatch});
    const new_state = { "tool": "router"};
    const syncSpy = jest.spyOn(toolselect, "syncState");
    toolselect.syncState(new_state);
    expect(syncSpy).toHaveBeenCalled();
    expect(syncSpy).toHaveReturnedWith(true);
    expect(state.tool).toEqual(new_state.tool);
  });
});

describe("ColorSelect", () => {
  test("tests ColorSelect.syncState()", () => {
    const colorselect = new ColorSelect(state, {tools, dispatch});
    const new_state = {"color": "#666666" };
    const syncSpy = jest.spyOn(colorselect, "syncState");
    colorselect.syncState(new_state);
    expect(syncSpy).toHaveBeenCalled();
    expect(syncSpy).toHaveReturnedWith(true);
    expect(state.color).toEqual(new_state.color);
  });
});

describe("EraseAllButton", () => {
  test("tests EraseAllButton.syncState()", () => {
    const eraseButton = new EraseAllButton(state, {dispatch});
    const new_state = {"picture": ["#999999", "#666666"] };
    const syncSpy = jest.spyOn(eraseButton, "syncState");
    eraseButton.syncState(new_state);
    expect(syncSpy).toHaveBeenCalled();
    expect(syncSpy).toHaveReturnedWith(true);
    expect(state.picture).toEqual(new_state.picture);
  });
});

describe("AddFloorButton", () => {
  test("tests AddFloorButton.syncState()", () => {
    const addfloorButton = new AddFloorButton(state, {dispatch});
    const new_state = {"picture": ["#999999", "#666666"] };
    const syncSpy = jest.spyOn(addfloorButton, "syncState");
    addfloorButton.syncState(new_state);
    expect(syncSpy).toHaveBeenCalled();
    expect(syncSpy).toHaveReturnedWith(true);
    expect(state.picture).toEqual(new_state.picture);
  });
});

describe("ZonesButton", () => {
  test("tests ZonesButton.syncState()", () => {
    const zonesButton = new ZonesButton(state, {dispatch});
    const new_state = {"picture": ["#999999", "#666666"] };
    const syncSpy = jest.spyOn(zonesButton, "syncState");
    eraseButton.syncState(new_state);
    expect(syncSpy).toHaveBeenCalled();
    expect(syncSpy).toHaveReturnedWith(true);
    expect(state.picture).toEqual(new_state.picture);
  });
});