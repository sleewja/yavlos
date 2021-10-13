// YAVLO$ get rich, but don't drink too much champagne

// ***********************************************
// global variables
// ***********************************************

var DEBUG = true; // display debug info

var MONEY_INCREMENT_ON_DOLLAR = 100; // money increment when hitting a dollar symbol
var VELOCITY_INCREMENT_ON_DOLLAR = 1; // speed increment [pixel/second] when hitting dollar
var ALCOHOL_LEVEL_INCREMENT_ON_CHAMPAGNE = 0.2; // [g/l] when drinking one glass of champagne
var MAX_ALCOHOL_LEVEL = 5;
var MAX_NUM_CHAMPAGNE_PER_KILOPIXEL_SQUARE = 0.2; 
// Z-levels for scene rendering
var Z_SYMBOLS = 0;
var Z_PLAYER = 1;
var Z_HEADER = 10; // header and footer hide the world
var Z_TRACES = Z_SYMBOLS;
// scene dimensions, relative
var HEADER_HEIGTH_PERCENT = 10; // % of total window height
var FOOTER_HEIGHT_PERCENT = 15; // % of total window height
var BUTTON_HEIGHT_PERCENT = 13;
var SYMBOLS_MARGIN = 3; // %, margin where no symbols are put
var COLOR_PLAYER = "black";
var COLOR_COVIDOS = "red";
var COLOR_TRACES = "gray";
var TRACE_FRAME_STEP = 2; // number of frames between each trace update
var TRACE_MAX_COUNT = 100; // max number of traces to remember
var TRACE_SIZE = 2; // size of trace blocks
var COVIDOS_SPEED_FACTOR = 0.3; // ratio to yavlos speed, a bit slower

var startTime;
var money = 0; // dollars, the only thing that matter$ !
var moneyPerSecond = 0; // it's not only about getting dollars, it's about getting them as fast as possible!
var alcoholLevel = 0; // [g/l] 0..MAX_ALCOHOL_LEVEL
var velocity = 100; // pixels/second
var angle = 0; // 0 = upwards, 90 = rightwards, -90 = leftwards
var traces = []; // array of arrays of entities: trace of player(s)

// world dimensions
var yWorldMin;
var yWorldMax;
var worldHeight;
var worldArea;

// drunken walk properties
var hickupTime = 0; // ms, time for hickup perturbation, (re)starts at 0 at each hickup
var minAngularDeviation;
var maxAngularDeviation;
var minVelocityFactor;
var maxVelocityFactor;
var hickupTargetDuration; // ms, duration to reach target deviation
var hickupHoldDuration; // ms, duration on target deviation
var hickupRecoveryDuration; // ms, duration to recover to unperturbed direction and speed
var hickupDuration = 0; // ms
var maxInterHickupDuration; // ms
var hickupTargetAngularDeviation = 0; // must be initialised because linked to text for debug
var hickupTargetVelocityFactor = 1; // must be initialised because linked to text for debug
var nextHickUpTime;
var maxConsecutiveHickups;
var numConsecutiveHickups;
var hickupConsecutiveCounter = 0;
var maxAngularTurnError; // max angular error when making a turn [degrees]


const MOVE_REQUEST = {
  NONE: "none",
  LEFT: "left",
  RIGHT: "right",
};

var doBindGlobalEvents = true; // bind global events only once
var arrowKeysPressed = 0;
var moveRequest = MOVE_REQUEST.NONE;
var stopped = false;

// ***********************************************
// world inhabitants
// ***********************************************
var symbols = {
  Dollar: {
    color: "green",
    onHitOn: function (aEntity, hitDatas) {
      onHitOnDollar(aEntity, hitDatas);
    },
  },
  Champagne: {
    color: "yellow",
    onHitOn: function (aEntity, hitDatas) {
      onHitOnChampagne(aEntity, hitDatas);
    },
  },
};

// ***********************************************
// init Crafty
// ***********************************************

// window_width, window_height are set in index.html
// this is a basic implementation of responsive design
// to adapt the canvas dimension to the window
// (purpose: play on PC as well as on mobile device)
Crafty.init(window_width, window_height); // uses by default 'cr-stage' div

// ***********************************************
// functions
// ***********************************************

/**
 * get a random float in a [min,max] interval
 * 
 * @param {*} min 
 * @param {*} max 
 */
function randomFloatInInterval(min, max){
  return ( min + Math.random()*(max-min));
}

/**
 * Random sign: returns -1 or 1
 */
function randomSign(){
  return ( Math.random() < 0.5 ? -1 : +1);
}

/**
 * Calculate the vector vx,vy for a given magnitude and angle
 *
 * @param {*} aMagnitude
 * @param {*} aAngleInDeg 0 = upwards, 90 = rightwards
 */
function calculateVector(aMagnitude, aAngleInDeg) {
  angleInRad = Crafty.math.degToRad(aAngleInDeg);
  return new Crafty.math.Vector2D(
    aMagnitude * Math.sin(angleInRad),
    -aMagnitude * Math.cos(angleInRad)
  );
}

/**
 * Update drunken walk properties, according to alcohol level
 * Option A: too smooth: no hard hickups
 * 
 * @param {*} aAlcoholLevel 
 */
function updateDrunkenWalkProperties_optionA(aAlcoholLevel) {
  lambda = aAlcoholLevel/MAX_ALCOHOL_LEVEL; // 0..1
  minAngularDeviation = -180*lambda;
  maxAngularDeviation = 180*lambda;
  minVelocityFactor = 1 - lambda;
  maxVelocityFactor = 1;
  hickupTargetDuration = 200; // ms, duration to reach target deviation
  hickupHoldDuration = 0; // ms, duration on target
  hickupRecoveryDuration = 200; // ms, duration to recover to unperturbed direction and speed
  hickupDuration = (hickupTargetDuration + hickupHoldDuration + hickupRecoveryDuration);
  // max interval time between two hickups [ms] (time between end of hickup and begin of next one)
  maxInterHickupDuration = 10*hickupDuration*(1 - lambda); 
}


/**
 * Update drunken walk properties, according to alcohol level
 * 
 * @param {*} aAlcoholLevel 
 */
function updateDrunkenWalkProperties(aAlcoholLevel) {
  lambda = aAlcoholLevel/MAX_ALCOHOL_LEVEL; // 0..1
  minAngularDeviation = 80; // 45..45
  maxAngularDeviation = 110 + (180-110)*lambda; // 60..180 degrees
  minVelocityFactor = 1 - 1.5*lambda; // 1..(-0.5)
  maxVelocityFactor = 1 + 0.5*lambda; // 1..(1.5)
  hickupTargetDuration = lambda<0.1 ? 0 : 400*lambda; // ms, duration to reach target deviation
  hickupHoldDuration = hickupTargetDuration/5; // ms, duration on target deviation
  hickupRecoveryDuration = hickupTargetDuration; // ms, duration to recover to unperturbed direction and speed
  hickupDuration = (hickupTargetDuration + hickupHoldDuration + hickupRecoveryDuration);
  // max interval time between two hickups [ms] (time between end of hickup and begin of next one)
  maxInterHickupDuration = 500 + 10*hickupDuration*(1 - lambda); // ms
  maxConsecutiveHickups = 0.55 + Math.round(lambda * 9); // 1..10
  // max absolute angular error when making a turn
  maxAngularTurnError = 0; // [degrees]
}

/**
 * Calculate perturbation in angle and speed due to drunken walk
 * return an array:
 * [velocityFactor, angularDeviation]:
 *  - velocityFactor = velocity multiplier
 *  - angularDeviation = -180..+180: angle deviation
 * 
 * @param {*} aDeltaT time since last call, in millisecons [ms]
 */
function calculateDrunkenWalk(aDeltaT) {
  if (hickupDuration == 0){
    // there is no hickup to generate: no perturbation
    velocityFactor = 1;
    angularDeviation = 0;
  } else {
    // we have to generate hickups
    if (hickupTime == 0) {
      // start of a new hickup, calculate its properties
      // random between min and max, then randomly apply negative sign
      hickupTargetAngularDeviation = randomFloatInInterval(minAngularDeviation,maxAngularDeviation);
      hickupTargetAngularDeviation *= randomSign();
      // random between min and max
      hickupTargetVelocityFactor = randomFloatInInterval(minVelocityFactor,maxVelocityFactor);
      // already schedule the next hickup
      if (hickupConsecutiveCounter == 0){
        // first hickup in a series of consecutive hickups,
        // determine how many consecutive hickups to trigger
        numConsecutiveHickups = Math.round(randomFloatInInterval(1,maxConsecutiveHickups));
      }
      hickupConsecutiveCounter++;
      if ( hickupConsecutiveCounter < numConsecutiveHickups ){
        // we are still in the series of consecutive counters: schedule the next one
        // immediately after this one
        nextHickUpTime = hickupDuration;
      } else {
        // we finished the series of consecutive hickups
        // schedule the next one some interval time after this one
        nextHickUpTime = hickupDuration + maxInterHickupDuration*Math.random();
        // and start a new series
        hickupConsecutiveCounter = 0;
      }
    }
  
    // calculate the perturbations at this time
    if (hickupTime <= hickupTargetDuration) {
      // we are on our way to the target perturbation: progress goes from 0 to 1
      if (hickupTargetDuration == 0){
        progress = 1;
      } else {
        progress = hickupTime / hickupTargetDuration;
      }
      angularDeviationProgress = progress;
    } else if (hickupTime <= (hickupTargetDuration+hickupHoldDuration)) {
      // we are on hold: velocity remains at the target
      progress = 1;
      // but angular deviation has to swap sign to get back to the straight line
      // angularDeviationProgress goes from 1 down to -1 during the hold phase
      if ( hickupHoldDuration == 0) {
        angularDeviationProgress = 0;
      } else {
        angularDeviationProgress = 1 - 2*(hickupTime - hickupTargetDuration)/hickupHoldDuration;
      }
    } else if (hickupTime <= hickupDuration) {
      // we are on our way to recovery (back to zero angular deviation and speed factor 1)
      // progress goes from 1 down to 0
      if (hickupRecoveryDuration == 0){
        progress = 1;
      } else {
        progress = 1 - 
        (hickupTime - (hickupTargetDuration+hickupHoldDuration))
        /hickupRecoveryDuration;
      }
      angularDeviationProgress = - progress;
    } else {
      // idle phase between two hickups
      progress = 0;
      angularDeviationProgress = 0;
    }
    velocityFactor = 1 - progress * (1 - hickupTargetVelocityFactor);
    angularDeviation = angularDeviationProgress * hickupTargetAngularDeviation;

    // advance the time
    hickupTime += aDeltaT;
    if (hickupTime >= nextHickUpTime) {
      // trigger the next hickup
      hickupTime = 0;
    }
  }

  return [velocityFactor,angularDeviation];
}

/**
 * Action oh hittong a Dollar symbol
 *
 * @param {*} aDollarEntity
 * @param {*} aHitDatas
 */
function onHitOnDollar(aDollarEntity, aHitDatas) {
  money += MONEY_INCREMENT_ON_DOLLAR;
  aDollarEntity.destroy();
  // accelerate
  velocity += VELOCITY_INCREMENT_ON_DOLLAR;
  // create a new dollar elsewhere
  createSymbols("Dollar", 1);
  // and a new champagne, if max not yet reached
  if (Crafty("Champagne").get().length < worldArea*MAX_NUM_CHAMPAGNE_PER_KILOPIXEL_SQUARE/1000) {
    createSymbols("Champagne", 1);
  }
}

/**
 * Action oh hittong a Champagne symbol
 *
 * @param {*} aChampagneEntity
 * @param {*} aHitDatas
 */
function onHitOnChampagne(aChampagneEntity, aHitDatas) {
  alcoholLevel = Math.min(alcoholLevel + ALCOHOL_LEVEL_INCREMENT_ON_CHAMPAGNE, MAX_ALCOHOL_LEVEL);
  aChampagneEntity.destroy();

  // update drunken walk properties
  updateDrunkenWalkProperties(alcoholLevel);
}

/**
 * Create aNumber symbols at random positions in the world
 *
 * @param {*} aSymbol
 * @param {*} aNumber
 */
function createSymbols(aSymbol, aNumber) {
  for (i = 0; i < aNumber; i++) {
    xNewBorn =
      (window_width * SYMBOLS_MARGIN) / 100 +
      (Math.random() * window_width * (100 - 2 * SYMBOLS_MARGIN)) / 100;
    yNewBorn =
      yWorldMin +
      (worldHeight * SYMBOLS_MARGIN) / 100 +
      (Math.random() * worldHeight * (100 - 2 * SYMBOLS_MARGIN)) / 100;

    var entity = Crafty.e("2D, Canvas, Color, Collision, " + aSymbol)
      .attr({
        x: xNewBorn,
        y: yNewBorn,
        z: Z_SYMBOLS,
      })
      .checkHits("YavlosPlayer")
      .bind("HitOn", function (hitDatas) {
        symbols[aSymbol].onHitOn(this, hitDatas);
      }); // end of chained calls from Crafty.e()
    // if at this stage the width is 0, it means that no sprite
    // is available for this symbol; in that case make a 10x10 square
    if (entity.w == 0) {
      entity.w = 10;
      entity.h = 10;
      entity.color(symbols[aSymbol].color);
    }
  }
}

// draw header
function drawHeader() {
  headerBox = Crafty.e("2D, Canvas, Color")
    .attr({
      x: 0,
      y: 0,
      w: window_width,
      h: (window_height * HEADER_HEIGTH_PERCENT) / 100,
      z: Z_HEADER,
    })
    .color("lightgray");

  moneyText = Crafty.e("2D, Canvas, Text, Persists")
    .attr({
      x: 0,
      y: 10,
      z: Z_HEADER,
    })
    .textFont({
      size: "25px",
    })
    .text(function () {
      return "$ " + money.toLocaleString('en-US', {maximumFractionDigits:2});
    })
    .dynamicTextGeneration(true);

  alcoholLevelText = Crafty.e("2D, Canvas, Text, Persists")
    .attr({
      x: window_width - 100,
      y: 10,
      z: Z_HEADER,
    })
    .textFont({
      size: "25px",
    })
    .text(function () {
      return alcoholLevel.toFixed(2) + " g/l";
    })
    .dynamicTextGeneration(true);
}

// draw footer
function drawFooter() {
  footerBox = Crafty.e("2D, Canvas, Color")
    .attr({
      x: 0,
      y: (window_height * (100 - FOOTER_HEIGHT_PERCENT)) / 100,
      w: window_width,
      h: (window_height * FOOTER_HEIGHT_PERCENT) / 100,
      z: Z_HEADER,
    })
    .color("lightgray");

  // buttons
  buttons_h = (window_height * BUTTON_HEIGHT_PERCENT) / 100;
  buttons_margin =
    (window_height * (FOOTER_HEIGHT_PERCENT - BUTTON_HEIGHT_PERCENT)) / 2 / 100;
  buttons_y = window_height - buttons_h - buttons_margin;
  buttons_w = (window_width - 3 * buttons_margin) / 2;
  // left turn button
  leftButton = Crafty.e("2D, Canvas, Mouse, Color")
    .attr({
      x: buttons_margin,
      y: buttons_y,
      w: buttons_w,
      h: buttons_h,
      z: Z_HEADER,
    })
    .color("darkgray")
    .bind("MouseDown", function (MouseEvent) {
      if (!stopped) {
        moveRequest = MOVE_REQUEST.LEFT;
        this.color("gray");
      }
    })
    .bind("MouseUp", function (MouseEvent) {
      this.color("darkgray");
    });
  // right turn button
  rightButton = Crafty.e("2D, Canvas, Mouse, Color")
    .attr({
      x: window_width - buttons_margin - buttons_w,
      y: buttons_y,
      w: buttons_w,
      h: buttons_h,
      z: Z_HEADER,
    })
    .color("darkgray")
    .bind("MouseDown", function (MouseEvent) {
      if (!stopped) {
        moveRequest = MOVE_REQUEST.RIGHT;
        this.color("gray");
      }
    })
    .bind("MouseUp", function (MouseEvent) {
      this.color("darkgray");
    });
  // write texr on top of buttons
  Crafty.e("2D, Canvas, Text")
    .attr({
      x: buttons_margin + buttons_w / 2,
      y: buttons_y + buttons_h / 3,
      z: Z_HEADER,
    })
    .textAlign("center")
    .textFont({
      size: "60px",
    })
    .text("↰");
  // right turn button
  Crafty.e("2D, Canvas, Text")
    .attr({
      x: window_width - buttons_margin - buttons_w / 2,
      y: buttons_y + buttons_h / 3,
      z: Z_HEADER,
    })
    .textAlign("center")
    .textFont({
      size: "60px",
    })
    .text("↱");

  if (DEBUG) {
    Crafty.e("2D, Canvas, Text")
      .attr({
        x: 0,
        y: window_height - 20,
        z: Z_HEADER,
      })
      .text(function () {
        return (
          "window_width:" + window_width + "  window_height:" + window_height
        );
      })
      .dynamicTextGeneration(true)
      .textColor("#FF0000");
  }

  if (DEBUG) {
    Crafty.e("2D, Canvas, Text")
      .attr({
        x: 0,
        y: window_height - 50,
        z: Z_HEADER,
      })
      .text(function () {
        return "moveRequest:" + moveRequest;
      })
      .dynamicTextGeneration(true)
      .textColor("#FF0000");
  }
  if (DEBUG) {
    Crafty.e("2D, Canvas, Text")
      .attr({
        x: 0,
        y: window_height - 70,
        z: Z_HEADER,
      })
      .text(function () {
        return ("target angular deviation: " + hickupTargetAngularDeviation.toFixed(0) + " "
            + "target velocity factor: " + hickupTargetVelocityFactor.toFixed(2));
      })
      .dynamicTextGeneration(true)
      .textColor("#FF0000");
  }

}

function drawWorld() {
  // Set some globals
  yWorldMin = headerBox.h;
  yWorldMax = footerBox.y;
  worldHeight = yWorldMax - yWorldMin;
  worldArea = worldHeight * window_width;

  // populate initial world
  createSymbols("Dollar", 4);
  createSymbols("Champagne", 1);

  // add yavlos player
  velocityVector = calculateVector(velocity, angle);
  Crafty.e("2D, Canvas, Color, Motion, YavlosPlayer")
    .attr({
      x: window_width / 2,
      y: (window_height * (100 - FOOTER_HEIGHT_PERCENT)) / 100 - 30,
      w: 10,
      h: 10,
      z: Z_PLAYER, // behind footer and header
      vx: velocityVector.x,
      vy: velocityVector.y,
    })
    .color(COLOR_PLAYER)
    .origin("center"); // origin to rotate around

  // add covidos
  Crafty.e("2D, Canvas, Color, Motion, Covidos")
  .attr({
    x: window_width,
    y: window_height,
    w: 10,
    h: 10,
    z: Z_PLAYER, // behind footer and header
  })
  .color(COLOR_COVIDOS)
  .origin("center"); // origin to rotate around

}

// update trace of each player: (supports multiple players, who knows
// could be needed in the future)
// Actions:
// - remove too old traces
// - set older traces more transparent
// - put a new trace at the new position
// Notes:
// - the traces are a FIFO list
function updateTraces() {
  playerEntities = Crafty("YavlosPlayer").get();
  covidosEntities = Crafty("Covidos").get();
  // concatenate both:
  entities = playerEntities.concat(covidosEntities);
  // i = player index
  // j = trace index
  for (i = 0; i < entities.length; i++) {
    // first check if there are already traces for this player
    if (traces.length > i) {
      // remove too old traces, at beginning of list
      if (traces[i].length > TRACE_MAX_COUNT) {
        for (j = 0; j < traces[i].length - TRACE_MAX_COUNT; j++) {
          // destroy the entity
          traces[i][j].destroy();
        }
        // and remove them from the list
        traces[i].splice(0, traces[i].length - TRACE_MAX_COUNT);
      }
      // make old traces more transparent
      for (j = 0; j < traces[i].length; j++) {
        // strength = 1.0 for last element (the newest)
        // strength = 1/TRACE_MAX_COUNT for first element (the oldest)
        colorStrength = (j + 1) / traces[i].length;
        traces[i][j].color(entities[i].color(), colorStrength);
      }
    } else {
      // create the list of traces for this kangaroo
      traces[i] = [];
    }

    // put a new trace at the new position (at the center of player)
    offsetX = 5;
    offsetY = -5;
    traces[i].push(
      Crafty.e("2D, Canvas, Color, Trace")
        .attr({
          x: entities[i]._x + offsetX - TRACE_SIZE,
          y: entities[i]._y + entities[i]._h + offsetY - TRACE_SIZE,
          w: TRACE_SIZE,
          h: TRACE_SIZE,
          z: Z_TRACES,
        })
        .color(entities[i].color())
    );
  }
}

// ***********************************************
// game logic
// ***********************************************

function bindGlobalEvents() {
  // global keyboard events
  
  // one-direction control (one move at a time, needs key up before next move
  Crafty.bind("KeyDown", function (e) {
    if (e.key == Crafty.keys.LEFT_ARROW || e.key == Crafty.keys.RIGHT_ARROW) {
      arrowKeysPressed++;
    }
    // forbid two arrows pressed
    if (!stopped && arrowKeysPressed == 1) {
      // By default no move request
      moveRequest = MOVE_REQUEST.NONE;
      switch (e.key) {
        case Crafty.keys.LEFT_ARROW:
          moveRequest = MOVE_REQUEST.LEFT;
          leftButton.color("gray");
          break;
        case Crafty.keys.RIGHT_ARROW:
          moveRequest = MOVE_REQUEST.RIGHT;
          rightButton.color("gray");
          break;
      }
    }
  });

  Crafty.bind("KeyUp", function (e) {
    if (e.key == Crafty.keys.LEFT_ARROW || e.key == Crafty.keys.RIGHT_ARROW) {
      if (arrowKeysPressed > 0) {
        arrowKeysPressed--;
      }
      switch (e.key) {
        case Crafty.keys.LEFT_ARROW:
          leftButton.color("darkgray");
          break;
        case Crafty.keys.RIGHT_ARROW:
          rightButton.color("darkgray");
          break;
      }
    }
  });

  Crafty.bind("UpdateFrame", function (eventData) {
    // If there is a move request: treat it
    if (moveRequest != MOVE_REQUEST.NONE) {
      turnAngle = 90 + randomSign()*randomFloatInInterval(0,maxAngularTurnError);
      switch (moveRequest) {
        case MOVE_REQUEST.LEFT:
          angle -= turnAngle; // counter-clockwise
          break;
        case MOVE_REQUEST.RIGHT:
          angle += turnAngle; // clockwise
          break;
      }
      // consume the move request
      moveRequest = MOVE_REQUEST.NONE;
    }

    // Drunken walk perturbation (hickups) depending on alcohol level
    [velocityFactor, angularDeviation] = calculateDrunkenWalk(eventData.dt);
    perturbatedVelocity = velocity*velocityFactor;
    perturbatedAngle = angle+angularDeviation;
    velocityVector = calculateVector(perturbatedVelocity, perturbatedAngle);
    yavlosPlayer = Crafty("YavlosPlayer");
    yavlosPlayer.vx = velocityVector.x;
    yavlosPlayer.vy = velocityVector.y;
    yavlosPlayer.rotation = angle;

    // make Covidos follow Yavlos
    covidos = Crafty("Covidos");
    followAngle = Crafty.math.radToDeg(Math.atan2(
      yavlosPlayer.x - covidos.x,covidos.y - yavlosPlayer.y));
    velocityVector = calculateVector(velocity*COVIDOS_SPEED_FACTOR,followAngle);
    covidos.vx = velocityVector.x;
    covidos.vy = velocityVector.y;
    covidos.rotation = followAngle;

    // update trace of player, every 2 frames
    if (eventData.frame % TRACE_FRAME_STEP == 0) {
      updateTraces();
    }

  });
}

// "main" scene is the entry point
Crafty.scene("main", function () {
  if (doBindGlobalEvents) {
    doBindGlobalEvents = false;
    bindGlobalEvents();
  }
  startTime = new Date().getTime();
  money = 0;
  alcoholLevel = 0;
  updateDrunkenWalkProperties(alcoholLevel);
  // update the money/second, every second
  Crafty.e("Delay").delay(
    function () {
      timeNow = new Date().getTime();
      seconds = (timeNow - startTime) / 1000;
      moneyPerSecond = money / seconds;
    },
    1000,
    -1
  );

  drawHeader();
  drawFooter();
  drawWorld();
});

Crafty.scene("main");
