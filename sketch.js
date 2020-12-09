// ===== GLOBALS
let textureBuffer;
const parsedDomainsLinked = []; // this is 1-1 with HISTORY_DATA
const parsedDomains = []; // removes duplicates
const tileSize = 48;
const tilePadding = 15;
const tileSpacing = tileSize + tilePadding;
let cam; //  main camera
const planeList = []; // contains tile types for every record in HISTORY_DATA
const spacerData = []; // contains differences in time between each record in HISTORY_DATA
let camX = 0;
const camY = 0;
let camZ = 0;
let rightSideLimit = 0; // how far the camera can go right
const imageData = {};
const colorPalettes = {};
const colorThief = new ColorThief();
const moveDelta = 100;
let usedFont;
let mostVisitedSites;
let minDataDate;
let maxDataDate;

// sorts HISTORY_DATA from old to new
function sortHistoryData(data) {
  data.sort((a, b) => {
    const aTimestamp = new Date(a.lastVisitTimeUTC);
    const bTimestamp = new Date(b.lastVisitTimeUTC);

    if (aTimestamp.getTime() < bTimestamp.getTime()) {
      return -1;
    }
    if (aTimestamp.getTime() > bTimestamp.getTime()) {
      return 1;
    }

    return 0;
  });
}

// finds domains that appear the most in parsedDomainsLinked
// https://stackoverflow.com/questions/53509971/get-most-occurring-elements-in-array-javascript/53510045
// https://stackoverflow.com/questions/1069666/sorting-object-property-by-values
function highestFreq(arr) {
  const counts = arr.reduce((a, c) => {
    a[c] = (a[c] || 0) + 1;
    return a;
  }, {});

  var sortable = [];
  for (var item in counts) {
    sortable.push([item, counts[item]]);
  }

  sortable.sort(function (a, b) {
    return b[1] - a[1];
  });

  return sortable;
}

// goes through records in HISTORY_DATA and extracts domains into parsedDomainsLinked and parsedDomains
function getParsedDomains(data) {
  data.forEach((record) => {
    const current = new URL(record.url);
    parsedDomainsLinked.push(current.host);
    if (!parsedDomains.includes(current.host)) parsedDomains.push(current.host);
  });
}

// calculates differences in time between each record in HISTORY_DATA and puts them into spacerData
function getSpacerData(data) {
  for (let index = 0; index < data.length - 1; index++) {
    const before = new Date(data[index].lastVisitTimeUTC);
    const after = new Date(data[index + 1].lastVisitTimeUTC);

    spacerData.push(after.getTime() - before.getTime());
  }
}

// makes a list of tiles to use based on spacerData
function constructPanelList(data) {
  // console.log("MAX DIFF: ", Math.max(...data));
  // floor | >1 hour
  // back | between 1 hour and 30 minutes
  // side | less than 30 minutes
  data.forEach((timeDiff) => {
    if (timeDiff >= 3600000) {
      // 1 hour
      planeList.push("floor");
    } else if (timeDiff < 3600000 && timeDiff >= 1800000) {
      planeList.push("back");
    } else {
      if (Math.random() < 0.5) {
        if (Math.random() < 0.2) {
          planeList.push("floor");
        } else {
          planeList.push(random(["side", "back"]));
        }
      } else {
        planeList.push("side");
      }
    }
  });

  // spacer data accounts for only N-1 history items
  // this one adds the extra one
  planeList.push(random(["side", "back", "floor"]));
}

// calculates rightSideLimit, which is how far you can scroll the camera to the right
function calculateRightSideLimit(data) {
  data.forEach((tile) => {
    rightSideLimit += tileSize;
  });

  // rightSideLimit += width / 2;
}

// grabs a list of colors for each domain's favicon
function calculateColorPalettes(data) {
  data.forEach((domain) => {
    colorPalettes[domain] = colorThief.getPalette(imageData[domain].canvas);
  });
}

// redraws background elements
function redrawBackground() {
  background("#030214");

  cam.ortho(-width / 2, width / 2, -height / 2, height / 2, -2000, 2000);
}

// ===== CREATE BOX
function createBox(type, domain) {
  /*
    types: floor, side, back
  */
  push();

  // // DEBUG show all colors
  // push();
  // colorPalettes[domain].forEach((colorArray) => {
  //   translate(30, 30, 0);
  //   fill(...colorArray);
  //   stroke(...colorPalettes[domain][0]);
  //   box(10);
  // });
  // pop();

  // console.log(domain, colorPalettes[domain]);
  strokeWeight(2);
  if (colorPalettes[domain]) {
    stroke(...colorPalettes[domain][2]);
    textureBuffer.background(
      colorPalettes[domain][0][0] * 0.6,
      colorPalettes[domain][0][1] * 0.6,
      colorPalettes[domain][0][2] * 0.6
    );
  } else {
    textureBuffer.background("gray");
  }

  textureBuffer.resetMatrix();
  textureBuffer.translate(textureBuffer.width / 2, textureBuffer.height / 2);
  textureBuffer.scale(-1, 1);

  if (type == "floor") {
    textureBuffer.rotate(PI);
  } else if (type == "side") {
    textureBuffer.scale(-1, 1);
  } else if (type == "back") {
    textureBuffer.rotate(PI + PI / 2);
    textureBuffer.scale(1, -1);
    textureBuffer.scale(-1, 1);
  }

  texture(textureBuffer);
  textureBuffer.image(
    imageData[domain],
    0,
    0,
    tileSize * 0.75,
    tileSize * 0.75
  );

  switch (type) {
    case "floor":
      box(tileSize, 0, tileSize);
      break;
    case "side":
      box(tileSize, tileSize, 0);
      break;
    case "back":
      box(0, tileSize, tileSize);
      break;
    default:
      console.error("createBox called invalid type: " + type);
      break;
  }

  pop();
}

// Isometric view
// https://medium.com/@sachafrosell/getting-to-grips-with-the-basics-of-p5js-50c65a0c1a1
// ===== PRELOAD
function preload() {
  // parse data
  sortHistoryData(HISTORY_DATA); // sorts history
  getParsedDomains(HISTORY_DATA); // gets all domains in history and removes duplicates
  getSpacerData(HISTORY_DATA); // calculates time differences between each record
  constructPanelList(spacerData); // creates plane types from space data
  calculateRightSideLimit(planeList);

  console.log(HISTORY_DATA);
  console.log(parsedDomains);
  console.log(spacerData);
  usedFont = loadFont("inconsolata.otf");

  const loadingNode = document.getElementById("deleteIfProblem");

  // ===== LOAD IMAGES
  parsedDomains.forEach((domain) => {
    console.log(domain);

    imageData[domain] = loadImage(
      `https://api.faviconkit.com/${domain}/64`,
      () => {
        console.log(`${domain} CACHED`);
      },
      () => {
        // NOTE image failure here means the entire project doesn't load, even if I set a fallback
        // console.log("LOADING ICON FOR " + domain + " FAILED, USING 64DEV");
        // imageData[domain] = loadImage("./64dev.png");

        const logElement = document.getElementById("p5_loading");

        if (loadingNode) loadingNode.remove();
        if (!document.getElementById("createIfProblem")) {
          const alertElement = document.createTextNode(
            "Project won't load due to errors: "
          );
          logElement.appendChild(alertElement);
        }

        const errorElement = document.createTextNode(
          `Couldn't get texture for ${domain}`
        );
        logElement.appendChild(errorElement);
      }
    );

    // NOTE comment out the top loadImage during development so you dont spam faviconkit.com
    // uncomment the loadImage below
    // imageData[domain] = loadImage("./64dev.png");
    // imageData[domain] = loadImage("./scrunch.png");
  });

  // imageData["www.youtube.com"] = loadImage("./yt.png");
  // imageData["twitter.com"] = loadImage("./tw.png");
}

// ===== LEVELER SYSTEM

let gridYLevel = 0;
const localXLevel = 0;
// flips whether things go left or right
// true -> things go right
// false -> things go left
let levelFlipper = true;

// ===== SPACER UTILITES
// FLOOR AXIS MOVE
const moveFloorUp = () => {
  gridYLevel++;
  translate(tileSpacing, 0, 0);
};
const moveFloorDown = () => {
  gridYLevel--;
  translate(-tileSpacing, 0, 0);
};

const moveSideRight = () => {
  translate(tileSpacing, 0, 0);
  gridYLevel++;
};
const moveSideLeft = () => {
  gridYLevel--;
  translate(-tileSpacing, 0, 0);
};

const moveBackRight = () => {
  gridYLevel--;
  translate(0, 0, tileSpacing);
};
const moveBackLeft = () => {
  gridYLevel++;
  translate(0, 0, -tileSpacing);
};

// FLOOR TO X
const spaceFloorToSide = () => {
  gridYLevel++;
  translate(tileSpacing, -tileSpacing / 2, tileSpacing / 2);
};
const spaceFloorToFloor = () => {
  translate(tileSpacing, 0, tileSpacing);
};
const spaceFloorToBack = () => {
  translate(tileSpacing, 0, tileSpacing / 2);
};

// SIDE TO X
const spaceSideToFloor = () => {
  translate(tileSpacing / 2, 0, tileSpacing);
};
const spaceSideToBack = () => {
  translate(tileSpacing, tileSpacing / 2, 0);
};
const spaceSideToSide = (debugIndex) => {
  // NOTE implements flipper
  if (levelFlipper) {
    // console.log(debugIndex, " <- MOVING RIGHT");
    moveSideRight();
  } else {
    // console.log(debugIndex, " <- MOVING LEFT");
    moveSideLeft();
  }
};

// BACK TO X
const spaceBackToSide = () => {
  translate(tileSpacing / 2, 0, tileSpacing / 2);
};
const spaceBackToFloor = () => {
  gridYLevel--;
  translate(tileSpacing, tileSpacing, tileSpacing / 2);
};
const spaceBackToBack = () => {
  // NOTE implements flipper
  if (levelFlipper) {
    moveBackRight();
  } else {
    moveBackLeft();
  }
};

const moveDefs = {
  sidefloor: spaceSideToFloor,
  sideback: spaceSideToBack,
  sideside: spaceSideToSide,
  floorfloor: spaceFloorToFloor,
  floorback: spaceFloorToBack,
  floorside: spaceFloorToSide,
  backfloor: spaceBackToFloor,
  backback: spaceBackToBack,
  backside: spaceBackToSide,
};

const floorMover = (num) => {
  for (let leveler = 0; leveler < Math.abs(num); leveler++) {
    if (num < 0) moveFloorDown();
    if (num > 0) moveFloorUp();
  }
};

// ===== INTRO CARD STUFF
function drawIntroCard() {
  push();
  // shift half the screen
  translate(-width / 2, -height * 0.4, 0);
  // shift for some padding
  translate(-200, -300, 0);

  textSize(48);
  text("INTERNET STORYBOARD", 0, 0);
  textSize(32);
  text("Your history tells a story.", 0, 58);
  text(
    `From ${minDataDate.toLocaleString("en-US", {
      dateStyle: "short",
      timeStyle: "short",
    })} to ${maxDataDate.toLocaleString("en-US", {
      dateStyle: "short",
      timeStyle: "short",
    })}`,
    0,
    92
  );
  text("Scroll or use left/right arrow keys to move.", 0, 126);
  translate(-tileSpacing - 32, tileSpacing + 32, tileSpacing + 32);

  text("Most visited:", 0, 0);

  translate(0, tileSpacing / 2, tileSpacing / 2);
  createBox("side", mostVisitedSites[0][0]);
  translate(tileSpacing, 0, 0);
  createBox("side", mostVisitedSites[1][0]);
  translate(tileSpacing, 0, 0);
  createBox("side", mostVisitedSites[2][0]);
  translate(tileSpacing, 0, 0);

  translate(-tileSpacing, 0, 0);
  translate(-tileSpacing, 0, 0);
  translate(-tileSpacing, 0, 0);
  translate(-tileSpacing / 2, 0, 0);
  translate(0, tileSpacing + 10, 0);

  text(
    mostVisitedSites[0][0] + " (" + mostVisitedSites[0][1] + " times)",
    0,
    0
  );
  text(
    mostVisitedSites[1][0] + " (" + mostVisitedSites[1][1] + " times)",
    0,
    tileSpacing / 2
  );
  text(
    mostVisitedSites[2][0] + " (" + mostVisitedSites[2][1] + " times)",
    0,
    (tileSpacing / 2) * 2
  );

  pop();
}

// draws the time of a history record given its index
function drawTimeCheckpoint(index) {
  push();
  const checkpoint = new Date(HISTORY_DATA[index].lastVisitTimeUTC);

  const timeString = checkpoint.toLocaleString("en-US", {
    timeStyle: "short",
  });
  noStroke();
  fill("white");

  textSize(32);
  translate(0, -tileSpacing, 0);
  translate(-tileSpacing / 2, 0, tileSpacing / 2);

  cylinder(1, tileSpacing / 2);

  translate(0, -tileSpacing / 2, 0);

  text(timeString, -10, 0);
  pop();
}

// ===== SETUP
function setup() {
  calculateColorPalettes(parsedDomains); // creates color palettes from domain icons
  createCanvas(windowWidth, windowHeight, WEBGL);
  frameRate(15);
  // noLoop();

  cam = createCamera();
  cam.setPosition(camX, camY, camZ);

  redrawBackground();
  // normalMaterial();

  // set up texture properties to draw the favicons on
  textureBuffer = createGraphics(tileSize, tileSize);
  textureBuffer.imageMode(CENTER);
  textureBuffer.translate(textureBuffer.width / 2, textureBuffer.height / 2);

  // find most visited sites for intro card
  mostVisitedSites = highestFreq(parsedDomainsLinked);

  textFont(usedFont);

  // find dates used in intro card
  minDataDate = new Date(HISTORY_DATA[0].lastVisitTimeUTC);
  maxDataDate = new Date(
    HISTORY_DATA[HISTORY_DATA.length - 1].lastVisitTimeUTC
  );
}

// ===== DRAW
function draw() {
  gridYLevel = 0;
  // ===== DONT EDIT STUFF BELOW THIS LINE
  redrawBackground();
  // orbitControl();

  // isometric rotation
  rotateX(-PI / 6 + -0.1);
  rotateY(PI / 4);
  // rotateY(map(mouseX, 0, width, 0, 10));
  // ===== DONT EDIT STUFF ABOVE THIS LINE

  drawIntroCard();

  // start somewhere off the center
  floorMover(-6);

  // ===== places boxes
  // this better have more than 2 entries
  for (let index = 0; index < planeList.length - 1; index++) {
    const givenSide = planeList[index];
    const givenSideNext = planeList[index + 1];

    if (gridYLevel <= -7) {
      levelFlipper = true;
      spaceFloorToFloor();
      spaceSideToSide(index);
    }
    if (gridYLevel >= 7) {
      levelFlipper = false;
      spaceFloorToFloor();
      spaceSideToSide(index);
    }
    if (givenSide == "floor") levelFlipper = !levelFlipper;

    if (index > 0) {
      const currentHour = new Date(
        HISTORY_DATA[index].lastVisitTimeUTC
      ).getHours();
      const lastHour = new Date(
        HISTORY_DATA[index - 1].lastVisitTimeUTC
      ).getHours();

      if (lastHour < currentHour) {
        drawTimeCheckpoint(index);
      }
    }

    createBox(givenSide, parsedDomainsLinked[index]);

    moveDefs[givenSide + givenSideNext](index);

    if (planeList[index + 1] == "back") {
      spaceFloorToFloor(); // this apparently works best for the side-back-side bug
    }

    // ===== ISO CAM DEBUG
    // const debugSizer = map(mouseX, 0, width, 0, 5000);
    // box(debugSizer, tileSize, tileSize);
  }

  // places last box
  drawTimeCheckpoint(planeList.length - 1);
  createBox(
    planeList[planeList.length - 1],
    parsedDomainsLinked[planeList.length - 1]
  );

  // movement controls
  if (
    keyIsDown(RIGHT_ARROW) ||
    keyIsDown(68) /* &&
    cam.eyeX + moveDelta < rightSideLimit*/
  ) {
    camX += moveDelta;
    camZ -= 19;
  } else if (
    (keyIsDown(LEFT_ARROW) || keyIsDown(65)) &&
    cam.eyeX - moveDelta > -100
  ) {
    camX -= moveDelta;
    camZ += 19;
  }

  // console.log(camX, camY, camZ);
  cam.setPosition(camX, camY, camZ);
  // console.log("FINAL Y LEVEL: ", gridYLevel);

  // NOTE reset states of variables back to what they were initialized with
  // not having this makes stuff jitter
  levelFlipper = true;
}

function mouseWheel(event) {
  if (cam.eyeX + event.delta < 0 /*|| cam.eyeX + event.delta > rightSideLimit*/)
    return; // dont move beyond edges

  if (event.delta > 0) {
    camX += moveDelta;

    camZ -= 19;
  } else {
    camX -= moveDelta;

    camZ += 19;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  redrawBackground();
}
